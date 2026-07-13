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
  buildMergedSources,
  normalizeRelationshipsForEntity,
} from './state.js';
import type { OrchestratorMemory, FolderPlan, PagePlan, ExtractedEntity, ExtractedRelationship } from '../orchestrator/types.js';
import {
  entityTopicPageWriter,
  type EntityTopicPageInputEntity,
  type EntityTopicPageInputTopic,
} from '../orchestrator/agents.js';
import {
  writeEntityPage,
  entityPageTitle,
  entityFileName,
  type EntityMention,
  type MentionLocation as EntityMentionLocation,
} from '../entities/index.js';
import {
  writeTopicPage,
  topicPageTitle,
  topicFileName,
  extractTopics,
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
}

export async function materializeChunkEntitiesAndTopics(
  context: ChunkMaterializationContext,
  chunkEntities: ExtractedEntity[],
  chunkRelationships: ExtractedRelationship[],
): Promise<void> {
  const progress = context.reporter ?? new NoOpReporter();
  const { workspace, slug, config, source, chunk, memory, state, result, llmClient } = context;
  const outputDir = path.join(workspace, 'wikis', slug, config.output.dir);

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

  // Determine which topics are touched by this chunk.
  const chunkTopicNames = new Set<string>();
  for (const topic of extractTopics(chunk.content, { max: 50 })) {
    chunkTopicNames.add(topic.name.toLowerCase());
  }
  // Also consider topic pages planned for this chunk's content.
  for (const page of context.pages) {
    if (page.pageType !== 'topic') continue;
    const topicName = page.title.replace(/^Topic:\s*/i, '').trim().toLowerCase();
    if (chunkTopicNames.has(topicName) || chunk.content.toLowerCase().includes(topicName)) {
      chunkTopicNames.add(topicName);
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
  const manuallyEditedEntities: { entity: EntityMention; filePath: string; rels: ExtractedRelationship[]; input: EntityTopicPageInputEntity }[] = [];
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
    const filePath = path.join(outputDir, 'entities', entityFileName(entity));
    const relativePath = toRelativePathFromDir(outputDir, filePath);
    const existing = readExistingPage(filePath);
    const isManual = existing ? isPageManuallyEdited(relativePath, existing.content, state) : false;

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

    if (isManual) {
      manuallyEditedEntities.push({ entity, filePath, rels: relsForEntity, input });
      continue;
    }

    entityInputs.push(input);
  }

  const topicInputs: EntityTopicPageInputTopic[] = [];
  const manuallyEditedTopics: { topic: Topic; filePath: string; input: EntityTopicPageInputTopic }[] = [];
  for (const name of affectedTopicNames) {
    const memoryTopic = memory.state.topics[name];
    const count = memoryTopic ? memoryTopic.related.length + memoryTopic.mentions.length : 1;
    const topic: Topic = { name, count };
    const filePath = path.join(outputDir, 'topics', topicFileName(topic));
    const relativePath = toRelativePathFromDir(outputDir, filePath);
    const existing = readExistingPage(filePath);
    const isManual = existing ? isPageManuallyEdited(relativePath, existing.content, state) : false;

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

    if (isManual) {
      manuallyEditedTopics.push({ topic, filePath, input });
      continue;
    }

    topicInputs.push(input);
  }

  // Batch LLM update for non-manually edited pages.
  if (entityInputs.length > 0 || topicInputs.length > 0) {
    try {
      const llmBodies = await progress.step(
        'entity-topic-writer',
        `Updating ${entityInputs.length} entity and ${topicInputs.length} topic pages for chunk ${chunk.id}`,
        () =>
          entityTopicPageWriter(
            entityInputs,
            topicInputs,
            config,
            llmClient,
            readAgentsMd(workspace, slug),
            memory,
            knownEntityInputs,
            knownTopicInputs,
          ),
      );

      const entityBodyMap = new Map(llmBodies.entities.map((e) => [e.name, e.body]));
      const topicBodyMap = new Map(llmBodies.topics.map((t) => [t.name, t.body]));

      for (const input of entityInputs) {
        const entity = {
          name: input.name,
          type: input.type,
          count: input.count,
          description: input.description,
          relationships: input.relationships,
        };
        const filePath = path.join(outputDir, 'entities', entityFileName(entity));
        const relativePath = toRelativePathFromDir(outputDir, filePath);
        const existing = readExistingPage(filePath);
        const generatedBody = entityBodyMap.get(input.name);
        if (!generatedBody) continue;

        const preserved = !existing || verifyPreservation(existing.body, generatedBody);
        if (!preserved) {
          progress.warning(
            `Entity page ${input.name} LLM rewrite did not preserve existing content; appending instead.`,
          );
          const fallbackBody = appendChunkToEntityBody(existing?.body ?? '', input.name, source, chunk, [
            ...normalizeRelationshipsForEntity(input.name, input.relationships),
          ]);
          writeEntityPage(filePath, entity, config, input.mentions, buildEntityOptions(input), fallbackBody);
          updatePageState(state, relativePath, outputDir, 'entity');
          result.entityPages++;
          continue;
        }

        writeEntityPage(filePath, entity, config, input.mentions, buildEntityOptions(input), generatedBody);
        updatePageState(state, relativePath, outputDir, 'entity');
        result.entityPages++;
      }

      for (const input of topicInputs) {
        const topic: Topic = { name: input.name, count: input.count };
        const filePath = path.join(outputDir, 'topics', topicFileName(topic));
        const relativePath = toRelativePathFromDir(outputDir, filePath);
        const existing = readExistingPage(filePath);
        const generatedBody = topicBodyMap.get(input.name);
        if (!generatedBody) continue;

        const preserved = !existing || verifyPreservation(existing.body, generatedBody);
        if (!preserved) {
          progress.warning(
            `Topic page ${input.name} LLM rewrite did not preserve existing content; appending instead.`,
          );
          const fallbackBody = appendChunkToTopicBody(existing?.body ?? '', input.name, source, chunk);
          writeTopicPage(filePath, topic, config, input.mentions, input.related, fallbackBody, input.sources);
          updatePageState(state, relativePath, outputDir, 'topic');
          result.topicPages++;
          continue;
        }

        writeTopicPage(filePath, topic, config, input.mentions, input.related, generatedBody, input.sources);
        updatePageState(state, relativePath, outputDir, 'topic');
        result.topicPages++;
      }
    } catch (err) {
      // If the batch LLM call fails, fall back to deterministic append for all
      // affected pages so information is not lost.
      progress.warning(
        `Entity/topic writer failed for chunk ${chunk.id}: ${err instanceof Error ? err.message : String(err)}. Appending only.`,
      );
      for (const input of entityInputs) {
        const entity = {
          name: input.name,
          type: input.type,
          count: input.count,
          description: input.description,
          relationships: input.relationships,
        };
        const filePath = path.join(outputDir, 'entities', entityFileName(entity));
        const relativePath = toRelativePathFromDir(outputDir, filePath);
        const existing = readExistingPage(filePath);
        const fallbackBody = appendChunkToEntityBody(
          existing?.body ?? '',
          input.name,
          source,
          chunk,
          normalizeRelationshipsForEntity(input.name, input.relationships),
        );
        writeEntityPage(filePath, entity, config, input.mentions, buildEntityOptions(input), fallbackBody);
        updatePageState(state, relativePath, outputDir, 'entity');
        result.entityPages++;
      }
      for (const input of topicInputs) {
        const topic: Topic = { name: input.name, count: input.count };
        const filePath = path.join(outputDir, 'topics', topicFileName(topic));
        const relativePath = toRelativePathFromDir(outputDir, filePath);
        const existing = readExistingPage(filePath);
        const fallbackBody = appendChunkToTopicBody(existing?.body ?? '', input.name, source, chunk);
        writeTopicPage(filePath, topic, config, input.mentions, input.related, fallbackBody, input.sources);
        updatePageState(state, relativePath, outputDir, 'topic');
        result.topicPages++;
      }
    }
  }

  // Deterministic append for pages that were manually edited.
  for (const { entity, filePath, rels, input } of manuallyEditedEntities) {
    const relativePath = toRelativePathFromDir(outputDir, filePath);
    const existing = readExistingPage(filePath);
    const fallbackBody = appendChunkToEntityBody(
      existing?.body ?? '',
      entity.name,
      source,
      chunk,
      rels,
    );
    writeEntityPage(filePath, entity, config, input.mentions, buildEntityOptions(input), fallbackBody);
    updatePageState(state, relativePath, outputDir, 'entity');
    result.entityPages++;
  }
  for (const { topic, filePath, input } of manuallyEditedTopics) {
    const relativePath = toRelativePathFromDir(outputDir, filePath);
    const existing = readExistingPage(filePath);
    const fallbackBody = appendChunkToTopicBody(existing?.body ?? '', topic.name, source, chunk);
    writeTopicPage(filePath, topic, config, input.mentions, input.related, fallbackBody, input.sources);
    updatePageState(state, relativePath, outputDir, 'topic');
    result.topicPages++;
  }
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

function appendChunkToEntityBody(
  existingBody: string,
  entityName: string,
  source: ExtractionResult,
  chunk: Chunk,
  relationships: ExtractedRelationship[],
): string {
  const lines = existingBody.trim().length > 0 ? [existingBody] : [`# Entity: ${entityName}`];
  lines.push('');
  lines.push(`## New mentions from ${source.fileName}, pages ${chunk.pageRange}`);
  lines.push('');
  lines.push(`- Mentioned in ${source.fileName}, pages ${chunk.pageRange}.`);
  for (const rel of relationships) {
    if (
      rel.subject.toLowerCase() === entityName.toLowerCase() ||
      rel.object.toLowerCase() === entityName.toLowerCase()
    ) {
      lines.push(`- ${rel.subject} ${rel.predicate} ${rel.object} — ${rel.evidence} (${rel.pages}).`);
    }
  }
  return lines.join('\n');
}

function appendChunkToTopicBody(
  existingBody: string,
  topicName: string,
  source: ExtractionResult,
  chunk: Chunk,
): string {
  const lines = existingBody.trim().length > 0 ? [existingBody] : [`# Topic: ${topicName}`];
  lines.push('');
  lines.push(`## New mentions from ${source.fileName}, pages ${chunk.pageRange}`);
  lines.push('');
  lines.push(`- Mentioned in ${source.fileName}, pages ${chunk.pageRange}.`);
  return lines.join('\n');
}

function updatePageState(
  state: IngestionState,
  relativePath: string,
  outputDir: string,
  pageType: string,
): void {
  const fullPath = path.join(outputDir, relativePath);
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
