import { existsSync, readFileSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { CLIError } from '../errors.js';
import type { Config } from '../config.js';
import type { Chunk } from '../chunking/types.js';
import type { ExtractionResult } from '../extractor/types.js';
import type { ProgressReporter } from '../progress/types.js';
import { NoOpReporter } from '../progress/types.js';
import type { LLMClient } from '../llm/client.js';
import type { IngestionState } from './state.js';
import {
  hashPageContent,
  verifyPreservation,
  isPageManuallyEdited,
  movePageState,
  buildMergedSources,
  normalizeRelationshipsForEntity,
} from './state.js';
import type { OrchestratorMemory, FolderPlan, PagePlan, ExtractedEntity, ExtractedRelationship } from '../orchestrator/types.js';
import {
  entityTopicPageWriter,
  type EntityTopicPageInputEntity,
  type EntityTopicPageInputTopic,
  type EntityTopicPageOutput,
} from '../orchestrator/agents.js';
import {
  writeEntityPage,
  entityPageTitle,
  entityFilePath,
  migrateLegacyEntityPage,
  removeLegacyEntityPage,
  type EntityMention,
  type MentionLocation as EntityMentionLocation,
} from '../entities/index.js';
import {
  writeTopicPage,
  topicPageTitle,
  topicFileName,
  type Topic,
  type MentionLocation as TopicMentionLocation,
} from '../topics/index.js';
import { slugify } from '../utils/slug.js';
import type { IngestionResult } from './types.js';
import { toRelativePathFromDir } from '../workspace.js';

export interface ChunkMaterializationContext {
  workspace: string;
  slug: string;
  config: Config;
  source: ExtractionResult;
  chunk: Chunk;
  memory: OrchestratorMemory;
  llmClient: LLMClient;
  state: IngestionState;
  result: IngestionResult;
  folderPlacements: FolderPlan[];
  pages: PagePlan[];
  reporter?: ProgressReporter;
  /**
   * True when this is the final chunk of the source. LLM-planned topic pages
   * that no chunk content matched are materialized here so every planned page
   * exists by the end of the source.
   */
  isLastChunk?: boolean;
}

export async function materializeChunkEntitiesAndTopics(
  context: ChunkMaterializationContext,
  chunkEntities: ExtractedEntity[],
  chunkRelationships: ExtractedRelationship[],
): Promise<void> {
  const progress = context.reporter ?? new NoOpReporter();
  const { workspace, slug, config, source, chunk, memory, state, result, llmClient } = context;
  const wikiDir = path.join(workspace, 'wikis', slug);

  // Determine which entities are touched by this chunk or its relationships.
  const affectedEntitySlugs = new Set<string>();
  for (const entity of chunkEntities) {
    affectedEntitySlugs.add(entity.canonical || slugify(entity.name));
  }
  for (const rel of chunkRelationships) {
    const subjectSlug = findCanonicalSlugByName(rel.subject, memory);
    const objectSlug = findCanonicalSlugByName(rel.object, memory);
    if (subjectSlug) affectedEntitySlugs.add(subjectSlug);
    if (objectSlug) affectedEntitySlugs.add(objectSlug);
  }

  // Determine which topics are touched by this chunk. Topic pages exist only
  // because the LLM decided they should (PagePlanner plans and topics already
  // established in rolling memory); deterministic code merely matches which of
  // those LLM-decided topics this chunk's content touches.
  const chunkTopicNames = new Set<string>();
  const chunkContentLower = chunk.content.toLowerCase();
  for (const page of context.pages) {
    if (page.pageType !== 'topic') continue;
    const topicName = page.title.replace(/^Topic:\s*/i, '').trim().toLowerCase();
    if (!topicName) continue;
    if (chunkContentLower.includes(topicName)) {
      chunkTopicNames.add(topicName);
    } else if (context.isLastChunk) {
      // Ensure every LLM-planned topic page is materialized at least once per
      // source even when no chunk contains the title verbatim.
      const topicPath = path.join(wikiDir, 'topics', topicFileName({ name: topicName, count: 1 }));
      if (!existsSync(topicPath)) {
        chunkTopicNames.add(topicName);
      }
    }
  }
  for (const name of Object.keys(memory.state.topics)) {
    if (chunkContentLower.includes(name.toLowerCase())) {
      chunkTopicNames.add(name.toLowerCase());
    }
  }
  const affectedTopicNames = Array.from(chunkTopicNames);

  if (affectedEntitySlugs.size === 0 && affectedTopicNames.length === 0) {
    return;
  }

  // Build the full set of known entities and topics for wikilink guidance.
  const knownEntityInputs = buildKnownEntityInputs(memory, source);
  const knownTopicInputs = buildKnownTopicInputs(memory, source);

  // Build the update inputs for the affected entities and topics.
  const entityInputs: EntityTopicPageInputEntity[] = [];
  for (const slug of affectedEntitySlugs) {
    const memoryEntity = memory.state.entities[slug];
    if (!memoryEntity) continue;

    const entity: EntityMention = {
      name: memoryEntity.name,
      type: memoryEntity.type,
      count: memoryEntity.count,
      description: memoryEntity.description,
      relationships: memoryEntity.relationships,
    };

    // Manual-edit detection must run against the legacy flat path BEFORE any
    // migration renames the file, because the stored page state is keyed by
    // the path the page had when it was last generated.
    const legacyRelativePath = path.posix.join('entities', `${slugify(memoryEntity.name)}.md`);
    const legacyFullPath = path.join(wikiDir, legacyRelativePath);
    const preMigrationNewPath = path.join(wikiDir, entityFilePath(entity, memory.state.entityTaxonomy));
    const legacyExists = !existsSync(preMigrationNewPath) && existsSync(legacyFullPath);
    if (legacyExists) {
      const legacyContent = readFileSync(legacyFullPath, 'utf-8');
      if (isPageManuallyEdited(legacyRelativePath, legacyContent, state)) {
        recordSkippedUpdate(
          result,
          progress,
          `Entity page ${memoryEntity.name} (legacy path) is manually edited; skipping migration and update to preserve human changes.`,
        );
        continue;
      }
    }

    const { filePath } = migrateLegacyEntityPage(wikiDir, entity, memory.state.entityTaxonomy);
    const relativePath = toRelativePathFromDir(wikiDir, filePath);
    if (legacyExists) {
      // The page moved on disk; move its stored state with it so manual-edit
      // detection continues on the new path.
      movePageState(state, legacyRelativePath, relativePath);
    }
    const existing = readExistingPage(filePath);
    const isManual = existing ? isPageManuallyEdited(relativePath, existing.content, state) : false;

    if (isManual) {
      recordSkippedUpdate(
        result,
        progress,
        `Entity page ${memoryEntity.name} is manually edited; skipping update to preserve human changes.`,
      );
      continue;
    }

    const relsForEntity = chunkRelationships.filter(
      (r) =>
        r.subject.toLowerCase() === memoryEntity.name.toLowerCase() ||
        r.object.toLowerCase() === memoryEntity.name.toLowerCase(),
    );

    const sources = buildMergedSources(existing, source, chunk);
    const mentions: EntityMentionLocation[] = [
      { source: source.fileName, filePath: source.filePath, pages: chunk.pageRange },
    ];

    const input: EntityTopicPageInputEntity = {
      name: memoryEntity.name,
      type: memoryEntity.type,
      count: memoryEntity.count,
      mentions,
      description: memoryEntity.description,
      relationships: memoryEntity.relationships,
      existingBody: existing?.body,
      sources,
    };

    entityInputs.push(input);
  }

  const topicInputs: EntityTopicPageInputTopic[] = [];
  for (const name of affectedTopicNames) {
    const memoryTopic = memory.state.topics[name];
    const count = memoryTopic ? memoryTopic.related.length + memoryTopic.mentions.length : 1;
    const topic: Topic = { name, count };
    const filePath = path.join(wikiDir, 'topics', topicFileName(topic));
    const relativePath = toRelativePathFromDir(wikiDir, filePath);
    const existing = readExistingPage(filePath);
    const isManual = existing ? isPageManuallyEdited(relativePath, existing.content, state) : false;

    if (isManual) {
      recordSkippedUpdate(
        result,
        progress,
        `Topic page ${name} is manually edited; skipping update to preserve human changes.`,
      );
      continue;
    }

    const sources = buildMergedSources(existing, source, chunk);
    const mentions: TopicMentionLocation[] = [
      { source: source.fileName, filePath: source.filePath, pages: chunk.pageRange },
    ];
    const related = memoryTopic ? [...memoryTopic.related] : [];

    const input: EntityTopicPageInputTopic = {
      name,
      count,
      mentions,
      related,
      existingBody: existing?.body,
      sources,
    };

    topicInputs.push(input);
  }

  if (entityInputs.length === 0 && topicInputs.length === 0) {
    return;
  }

  // Batch LLM update with one retry and no deterministic fallback.
  const llmBodies = await progress.step(
    'entity-topic-writer',
    `Updating ${entityInputs.length} entity and ${topicInputs.length} topic pages for chunk ${chunk.id}`,
    () =>
      callEntityTopicWriterWithRetry(
        entityInputs,
        topicInputs,
        config,
        llmClient,
        readAgentsMd(workspace, slug),
        memory,
        knownEntityInputs,
        knownTopicInputs,
        chunk.id,
        progress,
      ),
  );

  const entityEntryMap = new Map(llmBodies.entities.map((e) => [normalizePageName(e.name), e]));
  const topicEntryMap = new Map(llmBodies.topics.map((t) => [normalizePageName(t.name), t]));

  for (const input of entityInputs) {
    const entity = {
      name: input.name,
      type: input.type,
      count: input.count,
      description: input.description,
      relationships: input.relationships,
    };
    const { filePath } = migrateLegacyEntityPage(wikiDir, entity, memory.state.entityTaxonomy);
    const relativePath = toRelativePathFromDir(wikiDir, filePath);
    const existing = readExistingPage(filePath);
    const generatedEntry = entityEntryMap.get(normalizePageName(input.name));
    if (!generatedEntry) {
      // Completeness is validated (with one repair retry) before this loop, so
      // a missing body here is a defect; abort rather than silently drop evidence.
      throw new CLIError(`Entity page ${input.name} was not returned by the LLM writer after the repair retry.`);
    }
    const generatedBody = generatedEntry.body;

    const preserved = !existing || verifyPreservation(existing.body, generatedBody);
    if (!preserved) {
      recordSkippedUpdate(
        result,
        progress,
        `Entity page ${input.name} LLM rewrite did not preserve existing content; skipping update.`,
      );
      continue;
    }

    writeEntityPage(
      filePath,
      entity,
      config,
      input.mentions,
      { ...buildEntityOptions(input), tags: generatedEntry.tags },
      generatedBody,
    );
    removeLegacyEntityPage(wikiDir, entity);
    updatePageState(state, relativePath, wikiDir, 'entity');
    result.entityPages++;
  }

  for (const input of topicInputs) {
    const topic: Topic = { name: input.name, count: input.count };
    const filePath = path.join(wikiDir, 'topics', topicFileName(topic));
    const relativePath = toRelativePathFromDir(wikiDir, filePath);
    const existing = readExistingPage(filePath);
    const generatedEntry = topicEntryMap.get(normalizePageName(input.name));
    if (!generatedEntry) {
      // Completeness is validated (with one repair retry) before this loop, so
      // a missing body here is a defect; abort rather than silently drop evidence.
      throw new CLIError(`Topic page ${input.name} was not returned by the LLM writer after the repair retry.`);
    }
    const generatedBody = generatedEntry.body;

    const preserved = !existing || verifyPreservation(existing.body, generatedBody);
    if (!preserved) {
      recordSkippedUpdate(
        result,
        progress,
        `Topic page ${input.name} LLM rewrite did not preserve existing content; skipping update.`,
      );
      continue;
    }

    writeTopicPage(
      filePath,
      topic,
      config,
      input.mentions,
      generatedEntry.related,
      generatedBody,
      input.sources,
      generatedEntry.tags,
    );
    updatePageState(state, relativePath, wikiDir, 'topic');
    result.topicPages++;
  }
}

async function callEntityTopicWriterWithRetry(
  entityInputs: EntityTopicPageInputEntity[],
  topicInputs: EntityTopicPageInputTopic[],
  config: Config,
  llmClient: LLMClient,
  agentsMd: string | undefined,
  memory: OrchestratorMemory,
  knownEntityInputs: EntityTopicPageInputEntity[],
  knownTopicInputs: EntityTopicPageInputTopic[],
  chunkId: string,
  progress: ProgressReporter,
): Promise<EntityTopicPageOutput> {
  // A response missing any requested page body is invalid output: it gets one
  // stricter repair retry naming the missing pages, then the run aborts.
  // Silently skipping pages the LLM omitted would drop chunk evidence.
  let firstOutput: EntityTopicPageOutput | undefined;
  let failureReason: string;

  try {
    firstOutput = await entityTopicPageWriter(
      entityInputs,
      topicInputs,
      config,
      llmClient,
      agentsMd,
      memory,
      knownEntityInputs,
      knownTopicInputs,
    );
    const missing = findMissingPageBodies(firstOutput, entityInputs, topicInputs);
    if (missing.length === 0) {
      return firstOutput;
    }
    failureReason = `The response was missing bodies for: ${missing.join(', ')}.`;
  } catch (err) {
    failureReason = err instanceof Error ? err.message : String(err);
  }

  progress.warning(`Entity/topic writer failed for chunk ${chunkId}: ${failureReason} Retrying once.`);
  progress.retry(chunkId, 'EntityTopicPageWriter', 2, failureReason);
  try {
    const secondOutput = await entityTopicPageWriter(
      entityInputs,
      topicInputs,
      config,
      llmClient,
      agentsMd,
      memory,
      knownEntityInputs,
      knownTopicInputs,
      `The previous attempt failed with: ${failureReason} Return ONLY a valid JSON object matching the schema, with a non-empty body for EVERY requested entity and topic (do not omit any), and preserve every existing citation and wikilink when an existing body is provided.`,
    );
    const merged = mergeWriterOutputs(firstOutput, secondOutput);
    const stillMissing = findMissingPageBodies(merged, entityInputs, topicInputs);
    if (stillMissing.length > 0) {
      throw new CLIError(`The repaired response was still missing bodies for: ${stillMissing.join(', ')}.`);
    }
    return merged;
  } catch (retryErr) {
    throw new CLIError(
      `Entity/topic writer failed for chunk ${chunkId} after one retry: ${
        retryErr instanceof Error ? retryErr.message : String(retryErr)
      }`,
    );
  }
}

function normalizePageName(name: string): string {
  return name.trim().toLowerCase();
}

function findMissingPageBodies(
  output: EntityTopicPageOutput,
  entityInputs: EntityTopicPageInputEntity[],
  topicInputs: EntityTopicPageInputTopic[],
): string[] {
  const returnedEntities = new Set(
    output.entities.filter((e) => e.body && e.body.trim().length > 0).map((e) => normalizePageName(e.name)),
  );
  const returnedTopics = new Set(
    output.topics.filter((t) => t.body && t.body.trim().length > 0).map((t) => normalizePageName(t.name)),
  );
  const missing: string[] = [];
  for (const input of entityInputs) {
    if (!returnedEntities.has(normalizePageName(input.name))) missing.push(`entity "${input.name}"`);
  }
  for (const input of topicInputs) {
    if (!returnedTopics.has(normalizePageName(input.name))) missing.push(`topic "${input.name}"`);
  }
  return missing;
}

function mergeWriterOutputs(
  first: EntityTopicPageOutput | undefined,
  second: EntityTopicPageOutput,
): EntityTopicPageOutput {
  if (!first) return second;
  const entities = new Map(first.entities.map((e) => [normalizePageName(e.name), e]));
  for (const e of second.entities) entities.set(normalizePageName(e.name), e);
  const topics = new Map(first.topics.map((t) => [normalizePageName(t.name), t]));
  for (const t of second.topics) topics.set(normalizePageName(t.name), t);
  return { entities: Array.from(entities.values()), topics: Array.from(topics.values()) };
}

function recordSkippedUpdate(
  result: IngestionResult,
  progress: ProgressReporter,
  message: string,
): void {
  progress.warning(message);
  result.warnings = result.warnings ?? [];
  result.warnings.push(message);
  result.skippedUpdates = result.skippedUpdates ?? [];
  result.skippedUpdates.push(message);
}

function findCanonicalSlugByName(name: string, memory: OrchestratorMemory): string | undefined {
  const lower = name.toLowerCase().trim();
  for (const [slug, entity] of Object.entries(memory.state.entities)) {
    if (entity.name.toLowerCase() === lower) return slug;
    for (const alias of entity.aliases) {
      if (alias.toLowerCase() === lower) return slug;
    }
  }
  return undefined;
}

function readExistingPage(filePath: string): { content: string; body: string; frontmatter: Record<string, unknown> } | undefined {
  if (!existsSync(filePath)) return undefined;
  try {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = matter(content);
    return { content, body: parsed.content, frontmatter: parsed.data };
  } catch {
    return undefined;
  }
}

function buildEntityOptions(input: EntityTopicPageInputEntity): {
  description?: string;
  relationships?: EntityMention['relationships'];
  sources?: { id: string; file: string; pages: string; extracted: string }[];
} {
  return {
    description: input.description,
    relationships: input.relationships,
    sources: input.sources,
  };
}

function buildKnownEntityInputs(
  memory: OrchestratorMemory,
  source: ExtractionResult,
): EntityTopicPageInputEntity[] {
  return Object.values(memory.state.entities).map((entity) => ({
    name: entity.name,
    type: entity.type,
    count: entity.count,
    mentions: [{ source: source.fileName, filePath: source.filePath, pages: 'various' }],
    description: entity.description,
    relationships: entity.relationships,
  }));
}

function buildKnownTopicInputs(
  memory: OrchestratorMemory,
  source: ExtractionResult,
): EntityTopicPageInputTopic[] {
  return Object.entries(memory.state.topics).map(([name, topic]) => ({
    name,
    count: topic.related.length + topic.mentions.length,
    mentions: [{ source: source.fileName, filePath: source.filePath, pages: 'various' }],
    related: [...topic.related],
  }));
}

function updatePageState(
  state: IngestionState,
  relativePath: string,
  wikiDir: string,
  pageType: string,
): void {
  const fullPath = path.join(wikiDir, relativePath);
  if (!existsSync(fullPath)) return;
  const content = readFileSync(fullPath, 'utf-8');
  state.pages = state.pages ?? {};
  state.pages[relativePath] = {
    folder: path.dirname(relativePath).replace(/\\/g, '/'),
    pageType,
    generatedHash: hashPageContent(content),
    updatedAt: new Date().toISOString(),
  };
}

function readAgentsMd(workspace: string, slug: string): string | undefined {
  const agentsPath = path.join(workspace, 'wikis', slug, 'AGENTS.md');
  if (!existsSync(agentsPath)) return undefined;
  try {
    const content = readFileSync(agentsPath, 'utf-8');
    const frontmatterEnd = content.indexOf('\n---');
    if (frontmatterEnd !== -1 && content.startsWith('---')) {
      return content.slice(frontmatterEnd + 4).trim();
    }
    return content.trim();
  } catch {
    return undefined;
  }
}
