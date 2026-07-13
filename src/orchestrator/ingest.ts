import path from 'path';
import { readFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import matter from 'gray-matter';
import type { LLMClient } from '../llm/client.js';
import type { Config } from '../config.js';
import type { Chunk } from '../chunking/types.js';
import type { ExtractionResult } from '../extractor/types.js';
import { isExtractionFailure } from '../extractor/types.js';
import type { ProcessedSource, IngestionResult } from '../ingestion/types.js';
import type { IngestionState } from '../ingestion/state.js';
import { aggregateCounts, filterByThreshold } from '../ingestion/state.js';
import { writeDocumentPage } from '../writers/document.js';
import { writeRawPage } from '../writers/raw.js';
import { writeSourcePage, type DocumentPageLink } from '../writers/source.js';
import { writeWikiIndex, writeIndexOfIndexes } from '../writers/index.js';
import { lintWiki, writeLintReport, checkFrontmatter, checkCitations, checkWikilinks } from '../lint/index.js';
import { runWikiOfWikiAgent, type WikiOfWikiSummary } from '../orchestrator/wiki-of-wiki.js';
import { SlugRegistry, slugify } from '../utils/slug.js';
import {
  extractEntities,
  entityPageTitle,
  entityFileNameWithRegistry,
  writeEntityPage,
  type EntityMention,
  type MentionLocation as EntityMentionLocation,
} from '../entities/index.js';
import {
  extractTopics,
  topicPageTitle,
  topicFileName,
  writeTopicPage,
  type Topic,
  type MentionLocation as TopicMentionLocation,
} from '../topics/index.js';
import {
  structureAnalyst,
  entityExtractor,
  relationshipExtractor,
  evidenceCollector,
  pagePlanner,
  chunkWriter,
  critic,
  createInitialMemory,
  updateMemory,
  entityTopicPageWriter,
  entityCritic,
  applyEntityAudit,
  type EntityTopicPageOutput,
  type EntityTopicPageInputEntity,
  type EntityTopicPageInputTopic,
} from './agents.js';
import {
  compactMemoryIfNeeded,
  saveMemory,
  saveMemorySummary,
  DEFAULT_MEMORY_CAPS,
} from './memory.js';
import { writeWikiIndexContract, writeFolderIndexContract, type WikiIndexData } from './contracts.js';
import { validatePagePlan } from './validation.js';
import { checkCompleteness, type CompletenessResult } from '../validation/completeness.js';
import { CLIError } from '../errors.js';
import {
  detectStructuralProposals,
  detectNewPageTypes,
  updateFolderIndexForNewPageTypes,
  updateAgentsMdForNewPageTypes,
  promptProposalApproval,
  writeProposalFile,
  isSimpleProposal,
  folderPlacementsFromProposal,
  syncFolderPageTypes,
} from './proposals.js';
import type { ProgressReporter } from '../progress/types.js';
import { NoOpReporter } from '../progress/types.js';
import type { OrchestratorMemory, FolderPlan, CriticReview, PagePlan, StructuralProposal, PageUpdate, ExtractedEntity } from './types.js';

export interface IngestOrchestratorResult {
  memory: OrchestratorMemory;
  folderPlacements: FolderPlan[];
  pages: PagePlan[];
  pageUpdates?: PageUpdate[];
  critic: CriticReview;
  proposals: StructuralProposal[];
  extractedEntities: ExtractedEntity[];
  extractedTopics: { name: string; count: number; related: string[] }[];
}

export interface IngestOutputContext {
  workspace: string;
  slug: string;
  config: Config;
  processed: ProcessedSource[];
  state: IngestionState;
  memory?: OrchestratorMemory;
  folderPlacements: FolderPlan[];
  result: IngestionResult;
  llmClient?: LLMClient;
}

export async function runIngestOrchestrator(
  workspace: string,
  slug: string,
  config: Config,
  result: ExtractionResult,
  chunks: Chunk[],
  llmClient: LLMClient,
  previousMemory?: OrchestratorMemory,
  samplingStrategy?: { category: string; reason: string },
  options?: { autoApproveProposals?: boolean },
  reporter?: ProgressReporter,
): Promise<IngestOrchestratorResult> {
  const progress = reporter ?? new NoOpReporter();
  const agentsMd = readAgentsMd(workspace, slug);
  const stepStart = Date.now();
  const logStep = (label: string) => {
    console.log(`  ${label}: ${((Date.now() - stepStart) / 1000).toFixed(1)}s`);
  };

  const structure = await progress.step(
    'structure-analyst',
    'Analyzing document structure',
    () => structureAnalyst(result, chunks, llmClient, agentsMd, previousMemory),
  );
  logStep('structureAnalyst');

  // Entity extraction runs per chunk so the LLM receives a focused context and
  // can accurately identify proper named entities. Results are accumulated and
  // deduplicated across chunks.
  const accumulatedMemory = previousMemory
    ? mergeMemory(previousMemory, result, chunks)
    : createInitialMemory(result, chunks);
  const entityMap = new Map<string, ExtractedEntity>();
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    progress.chunkProgress(result.fileName, chunk.id, chunkIndex + 1, chunks.length);
    const { entities: chunkEntities } = await progress.step(
      'entity-extractor',
      `Extracting entities from chunk ${chunk.id}`,
      () => entityExtractor(
        result,
        [chunk],
        llmClient,
        agentsMd,
        accumulatedMemory,
      ),
    );
    for (const entity of chunkEntities) {
      const canonical = entity.canonical || slugify(entity.name);
      const existing = entityMap.get(canonical);
      if (existing) {
        existing.count += entity.count;
        existing.mentions.push(...entity.mentions);
        existing.confidence = Math.max(existing.confidence, entity.confidence);
        for (const alias of entity.aliases) {
          if (!existing.aliases.includes(alias)) {
            existing.aliases.push(alias);
          }
        }
        if (!existing.description && entity.description) {
          existing.description = entity.description;
        }
        if (entity.relationships) {
          existing.relationships = existing.relationships ?? [];
          for (const rel of entity.relationships) {
            if (!existing.relationships.some((r) => r.predicate === rel.predicate && r.object === rel.object)) {
              existing.relationships.push(rel);
            }
          }
        }
      } else {
        entityMap.set(canonical, { ...entity, canonical });
      }
    }
    // Make accumulated entities visible to the next chunk for alias resolution.
    accumulatedMemory.state.entities = Object.fromEntries(entityMap);
  }
  const entities = Array.from(entityMap.values());
  logStep('entityExtractor');

  const audit = await progress.step(
    'entity-critic',
    'Auditing extracted entities',
    () => entityCritic(entities, result, llmClient, agentsMd),
  );
  const auditedEntities = applyEntityAudit(entities, audit);
  logStep('entityCritic');

  const { relationships } = await progress.step(
    'relationship-extractor',
    'Extracting relationships',
    () => relationshipExtractor(result, auditedEntities, llmClient, agentsMd, previousMemory),
  );
  logStep('relationshipExtractor');

  const evidence = await progress.step(
    'evidence-collector',
    'Collecting evidence',
    () => evidenceCollector(result, chunks, llmClient, agentsMd, previousMemory),
  );
  logStep('evidenceCollector');

  // Step 4: PagePlanner (LLM-only; aborts on invalid or empty output)
  const plannerOutput = await progress.step(
    'page-planner',
    'Planning wiki pages',
    () => pagePlanner(
      result,
      structure,
      auditedEntities,
      evidence,
      llmClient,
      agentsMd,
      previousMemory,
      samplingStrategy,
    ),
  );

  if (plannerOutput.folderPlacements.length === 0) {
    throw new CLIError('PagePlanner returned no folder placements.');
  }

  const folderPlacements = plannerOutput.folderPlacements;

  // Detect structural-change proposals relative to the previously approved folder
  // hierarchy. Simple new-folder proposals can be approved interactively (or with
  // --yes). Complex proposals are written to .kimi-code/proposals/ for later review.
  const previousHierarchy = previousMemory?.state.folderHierarchy ?? {};
  let resolvedFolderPlacements: FolderPlan[] = folderPlacements;
  let resolvedPages = plannerOutput.pages;
  const proposals = detectStructuralProposals(previousHierarchy, folderPlacements);

  if (proposals.length > 0) {
    const proposal = proposals[0];
    let approved = false;
    if (isSimpleProposal(proposal)) {
      approved = await promptProposalApproval(proposal, { autoApprove: options?.autoApproveProposals ?? false });
    } else {
      const proposalPath = writeProposalFile(workspace, slug, proposal);
      console.log(`Structural change proposal written to: ${proposalPath}`);
    }
    progress.proposal(proposal.type, proposal.reason, approved);
    if (approved) {
      resolvedFolderPlacements = folderPlacementsFromProposal(previousHierarchy, proposal);
    } else if (Object.keys(previousHierarchy).length > 0) {
      resolvedFolderPlacements = Object.values(previousHierarchy);
      resolvedPages = plannerOutput.pages.filter((p) =>
        resolvedFolderPlacements.some((f) => f.folder === p.folder),
      );
    } else {
      throw new CLIError(
        `Structural proposal was rejected and no existing folder hierarchy is available. ` +
          `Review the proposal and re-run with --yes or approve it manually.`,
      );
    }
    proposal.applied = approved;
  }

  syncFolderPageTypes(resolvedFolderPlacements, resolvedPages);

  const memory = previousMemory
    ? mergeMemory(previousMemory, result, chunks)
    : createInitialMemory(result, chunks);

  const validationResult = await writeAndValidateChunks(
    workspace,
    resolvedPages,
    chunks,
    result,
    config,
    llmClient,
    agentsMd,
    memory,
    resolvedFolderPlacements,
    progress,
  );
  const pageUpdates = validationResult.pageUpdates;
  logStep('chunkWriter');
  logStep('critic');

  const validationReview = validatePagePlan(resolvedPages, resolvedFolderPlacements);
  const combinedIssues = [
    ...validationResult.critic.issues,
    ...validationResult.completenessIssues.map((m) => ({ type: 'missing' as const, message: m, severity: 'medium' as const })),
    ...validationReview.issues,
  ];
  const combinedCritic: CriticReview = {
    approved: validationResult.critic.approved && validationResult.completenessIssues.length === 0,
    issues: combinedIssues,
    confidence: combinedIssues.length === 0 ? 'high' : 'low',
    checks: validationResult.critic.checks,
    blockingIssues: validationResult.critic.blockingIssues,
  };

  const extractedTopics = mergeFragmentTopics(extractTopicsFromPagePlans(resolvedPages));
  updateMemory(memory, result.filePath, auditedEntities, relationships, extractedTopics, resolvedFolderPlacements);

  // Rolling memory compaction and persistence.
  compactMemoryIfNeeded(memory, {
    maxEntities: config.llm?.maxRollingMemoryTokens ? 500 : DEFAULT_MEMORY_CAPS.maxEntities,
    maxTopics: DEFAULT_MEMORY_CAPS.maxTopics,
    maxRelationships: DEFAULT_MEMORY_CAPS.maxRelationships,
    maxRollingMemoryTokens: config.llm?.maxRollingMemoryTokens ?? DEFAULT_MEMORY_CAPS.maxRollingMemoryTokens,
    compactionRatio: DEFAULT_MEMORY_CAPS.compactionRatio,
  });
  const wikiDir = path.join(workspace, 'wikis', slug);
  const outputDir = path.join(wikiDir, 'output');
  saveMemory(outputDir, memory);
  saveMemorySummary(outputDir, memory);

  return {
    memory,
    folderPlacements: resolvedFolderPlacements,
    pages: resolvedPages,
    pageUpdates,
    critic: combinedCritic,
    proposals,
    extractedEntities: auditedEntities,
    extractedTopics,
  };
}

function extractTopicsFromPagePlans(
  pages: PagePlan[],
): { name: string; count: number; related: string[] }[] {
  const topics = new Map<string, { name: string; count: number; related: Set<string> }>();
  for (const page of pages) {
    if (page.pageType !== 'topic') continue;
    const name = topicNameFromPagePlan(page);
    const existing = topics.get(name);
    if (existing) {
      existing.count += 1;
      for (const r of page.related) existing.related.add(r);
    } else {
      topics.set(name, { name, count: 1, related: new Set(page.related) });
    }
  }
  return Array.from(topics.values()).map((t) => ({ ...t, related: Array.from(t.related) }));
}

function mergeFragmentTopics(
  topics: { name: string; count: number; related: string[] }[],
): { name: string; count: number; related: string[] }[] {
  const sorted = [...topics].sort(
    (a, b) => b.name.length - a.name.length || a.name.localeCompare(b.name),
  );
  const merged: { name: string; count: number; related: Set<string> }[] = [];
  for (const topic of sorted) {
    const target = merged.find((m) => isTopicFragment(topic.name, m.name));
    if (target) {
      target.count += topic.count;
      for (const r of topic.related) target.related.add(r);
    } else {
      merged.push({ name: topic.name, count: topic.count, related: new Set(topic.related) });
    }
  }
  return merged.map((m) => ({ ...m, related: Array.from(m.related) }));
}

function isTopicFragment(shorter: string, longer: string): boolean {
  const sWords = shorter.toLowerCase().split(/[\s\-]+/).filter(Boolean);
  if (sWords.length < 2) return false;
  const lWords = longer.toLowerCase().split(/[\s\-]+/).filter(Boolean);
  if (sWords.length >= lWords.length) return false;
  const prefixMatch = sWords.every((w, i) => w === lWords[i]);
  const suffixMatch = sWords.every((w, i) => w === lWords[lWords.length - sWords.length + i]);
  return prefixMatch || suffixMatch;
}

function topicNameFromPagePlan(page: PagePlan): string {
  const lower = page.title.toLowerCase();
  if (lower.startsWith('topic:')) {
    return lower.slice(6).trim();
  }
  return lower.trim();
}

async function writeAndValidateChunks(
  workspace: string,
  pages: PagePlan[],
  chunks: Chunk[],
  result: ExtractionResult,
  config: Config,
  llmClient: LLMClient,
  agentsMd: string | undefined,
  memory: OrchestratorMemory,
  folderPlacements: FolderPlan[],
  reporter: ProgressReporter,
): Promise<{
  pageUpdates: PageUpdate[];
  critic: CriticReview;
  completenessIssues: string[];
}> {
  const progress = reporter;
  let pageUpdates = await progress.step(
    'chunk-writer',
    'Writing document chunks',
    () => chunkWriter(
      pages,
      chunks,
      result,
      config,
      llmClient,
      agentsMd,
      memory,
    ),
  );
  let criticReview = await progress.step(
    'critic',
    'Reviewing generated pages',
    () => critic(
      result,
      pages,
      folderPlacements,
      llmClient,
      agentsMd,
      memory,
      pageUpdates,
    ),
  );
  if (criticReview.issues.length > 0) {
    progress.criticIssues(criticReview.issues);
  }
  let completenessIssues = collectCompletenessIssues(chunks, pageUpdates, result);
  const schemaIssues = validatePageUpdates(workspace, pages, pageUpdates, result, config);
  completenessIssues = completenessIssues.concat(schemaIssues);

  // Retry up to a bounded number of attempts, feeding the Critic, completeness,
  // and schema/link/citation issues back to the ChunkWriter as explicit instructions.
  const maxRetries = Math.max(1, config.llm?.maxRetries ?? 2);
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (
      !llmClient.isEnabled() ||
      (completenessIssues.length === 0 && criticReview.approved && criticReview.blockingIssues.length === 0)
    ) {
      break;
    }

    const feedback = buildWriterFeedback(criticReview, completenessIssues);
    pageUpdates = await progress.step(
      'chunk-writer',
      `Retrying chunk writer (attempt ${attempt})`,
      () => chunkWriter(
        pages,
        chunks,
        result,
        config,
        llmClient,
        agentsMd,
        memory,
        feedback,
      ),
    );
    criticReview = await progress.step(
      'critic',
      `Re-reviewing generated pages (attempt ${attempt})`,
      () => critic(
        result,
        pages,
        folderPlacements,
        llmClient,
        agentsMd,
        memory,
        pageUpdates,
      ),
    );
    if (criticReview.issues.length > 0) {
      progress.criticIssues(criticReview.issues);
    }
    completenessIssues = collectCompletenessIssues(chunks, pageUpdates, result);
    const retriedSchemaIssues = validatePageUpdates(workspace, pages, pageUpdates, result, config);
    completenessIssues = completenessIssues.concat(retriedSchemaIssues);
  }

  return {
    pageUpdates,
    critic: criticReview,
    completenessIssues,
  };
}

function buildWriterFeedback(criticReview: CriticReview, completenessIssues: string[]): string[] {
  const feedback: string[] = [];
  for (const issue of criticReview.blockingIssues) {
    feedback.push(`[BLOCKING] ${issue.check}: ${issue.message}`);
  }
  for (const issue of criticReview.issues) {
    feedback.push(`[${issue.severity.toUpperCase()}] ${issue.type}: ${issue.message}`);
  }
  for (const issue of completenessIssues) {
    feedback.push(`[COMPLETENESS] ${issue}`);
  }
  return feedback;
}

function validatePageUpdates(
  workspace: string,
  pages: PagePlan[],
  pageUpdates: PageUpdate[],
  _result: ExtractionResult,
  config: Config,
): string[] {
  const issues: string[] = [];
  const titleMap = buildKnownTitleMap(pages, config, _result.fileName);

  for (const update of pageUpdates) {
    const file = update.filePath;
    issues.push(...checkFrontmatter(file, update.frontmatter).map((i) => i.message));
    issues.push(...checkCitations(file, update.body, update.frontmatter, workspace).map((i) => i.message));
    issues.push(...checkWikilinks(file, update.body, titleMap).map((i) => i.message));
  }

  return issues;
}

function buildKnownTitleMap(pages: PagePlan[], config: Config, sourceFileName?: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const page of pages) {
    map.set(page.title, page.fileName);
    if (page.pageType === 'entity') {
      const clean = page.title.replace(/^Entity:\s*/i, '').trim();
      map.set(`Entity: ${clean}`, page.fileName);
      map.set(clean, page.fileName);
    } else if (page.pageType === 'topic') {
      const clean = page.title.replace(/^Topic:\s*/i, '').trim();
      map.set(`Topic: ${clean}`, page.fileName);
      map.set(clean, page.fileName);
    }
  }
  const wikiIndexTitle = `${config.wiki.title} Index`;
  map.set(wikiIndexTitle, 'index.md');
  map.set(config.wiki.title, 'index.md');
  if (sourceFileName) {
    map.set(`Source: ${sourceFileName}`, `sources/${path.basename(sourceFileName, path.extname(sourceFileName))}.md`);
  }
  return map;
}

function collectCompletenessIssues(
  chunks: Chunk[],
  pageUpdates: PageUpdate[],
  result: ExtractionResult,
): string[] {
  const issues: string[] = [];
  for (const chunk of chunks) {
    const filePath = `documents/${chunk.id}.md`;
    const update = pageUpdates.find((u) => u.filePath === filePath);
    if (!update) {
      issues.push(`Chunk ${chunk.id} has no generated page (${filePath}).`);
      continue;
    }
    const completeness = checkCompleteness(
      chunk,
      update,
      result.tables,
      result.figures,
    );
    if (!completeness.ok) {
      for (const issue of completeness.missing) {
        issues.push(`Chunk ${chunk.id}: ${issue.message}`);
      }
    }
  }
  return issues;
}

export function writeIngestContracts(
  workspace: string,
  slug: string,
  config: Config,
  memory: OrchestratorMemory,
  folderPlacements: FolderPlan[],
  sourceCount: number,
  documentCount: number,
  rawCount: number,
  warnings: string[],
  folderPages: Record<string, string[]> = {},
): string[] {
  const wikiDir = path.join(workspace, 'wikis', slug);
  const wikiIndexPath = path.join(wikiDir, 'index.md');

  const indexData: WikiIndexData = {
    slug,
    title: config.wiki.title,
    description: config.wiki.description,
    scope: memory.rollingSummary,
    sourceCount,
    documentCount,
    entityCount: Object.keys(memory.state.entities).length,
    topicCount: Object.keys(memory.state.topics).length,
    rawCount,
    folders: folderPlacements,
    warnings,
  };

  writeWikiIndexContract(wikiIndexPath, indexData, config);

  const folderIndexes: string[] = [];
  for (const folder of folderPlacements) {
    const folderIndexPath = path.join(wikiDir, folder.folder, 'index.md');
    writeFolderIndexContract(folderIndexPath, folder, indexData, memory, folderPages);
    folderIndexes.push(folderIndexPath);
  }

  return folderIndexes;
}

export async function writeIngestOutput(context: IngestOutputContext): Promise<void> {
  const { workspace, slug, config, processed, state, memory, folderPlacements, result, llmClient } = context;
  const wikiDir = path.join(workspace, 'wikis', slug);
  const outputDir = path.join(wikiDir, config.output.dir);
  const sourcesDir = path.join(outputDir, 'sources');
  const documentsDir = path.join(outputDir, 'documents');
  const rawDir = path.join(outputDir, 'raw');
  const entitiesDir = path.join(outputDir, 'entities');
  const topicsDir = path.join(outputDir, 'topics');
  const lintDir = path.join(outputDir, 'lint');

  for (const dir of [sourcesDir, documentsDir, rawDir, entitiesDir, topicsDir, lintDir]) {
    mkdirSync(dir, { recursive: true });
  }

  // Determine global entities and topics from all sources (changed + unchanged).
  const { entities: globalEntityCounts, topics: globalTopicCounts } = aggregateCounts(state.sources);
  const selectedEntityNames = filterByThreshold(
    globalEntityCounts,
    config.ingestion.entity_threshold,
    config.ingestion.max_entities,
  );
  const selectedTopicNames = filterByThreshold(
    globalTopicCounts,
    config.ingestion.topic_threshold,
    config.ingestion.max_topics,
  );
  const entityTitles = selectedEntityNames.map((name) => entityPageTitle({ name, type: inferEntityType(name), count: 0 }));
  const topicTitles = selectedTopicNames.map((name) => topicPageTitle({ name, count: 0 }));

  // Write document pages, raw pages, and source pages for changed sources.
  const entityLocations: Record<string, EntityMentionLocation[]> = {};
  const topicLocations: Record<string, TopicMentionLocation[]> = {};

  for (const source of processed) {
    if (isExtractionFailure(source.outcome)) continue;
    const extractionResult = source.outcome;
    const chunks = source.chunks!;

    const documentLinks: DocumentPageLink[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const documentPageId = source.documentPageIds![i];
      const filePath = path.join(wikiDir, config.output.dir, documentPageId);
      const update = source.pageUpdates?.find((u) => u.filePath.toLowerCase() === documentPageId.toLowerCase());
      if (!update) {
        throw new CLIError(`No LLM-generated page found for chunk ${chunk.id} (${documentPageId}).`);
      }
      writeDocumentPage(
        filePath,
        chunk,
        config,
        { frontmatter: update.frontmatter, body: update.body },
        entityTitles,
        topicTitles,
      );
      result.documentPages++;

      // Use the LLM-written title, or the chunk title if the frontmatter is missing one,
      // so that source and index pages link to the exact page title.
      const parsed = matter(readFileSync(filePath, 'utf-8'));
      documentLinks.push({ title: String(parsed.data.title || chunk.title), pageRange: chunk.pageRange });
    }

    for (const rawPageId of source.rawPageIds || []) {
      const pageNumber = parseInt(rawPageId.match(/page-(\d+)\.md$/)?.[1] || '0', 10);
      const page = extractionResult.pages.find((p) => p.physicalPage === pageNumber);
      if (page) {
        writeRawPage(path.join(wikiDir, config.output.dir, rawPageId), extractionResult, page, config.wiki.slug);
        result.rawPages++;
      }
    }

    // documentLinks is populated inside the document loop above so titles reflect the LLM-written frontmatter.
    const rawLinks = (source.rawPageIds || []).map((id) => ({
      title: `Raw fragment: ${source.fileName}, page ${id.match(/page-(\d+)\.md$/)?.[1] || 0}`,
      physicalPage: parseInt(id.match(/page-(\d+)\.md$/)?.[1] || '0', 10),
    }));
    writeSourcePage(
      path.join(wikiDir, config.output.dir, source.sourcePageId),
      extractionResult,
      documentLinks,
      rawLinks,
      config.wiki.slug,
    );
    source.documentLinks = documentLinks;

    const pageRanges = chunks.map((c) => c.pageRange).join(', ');
    for (const name of Object.keys(source.entities)) {
      const title = entityPageTitle({ name, type: 'organization', count: 0 });
      if (!entityLocations[title]) entityLocations[title] = [];
      entityLocations[title].push({ source: source.fileName, filePath: source.relativeFile, pages: pageRanges });
    }
    for (const name of Object.keys(source.topics)) {
      const title = topicPageTitle({ name, count: 0 });
      if (!topicLocations[title]) topicLocations[title] = [];
      topicLocations[title].push({ source: source.fileName, filePath: source.relativeFile, pages: pageRanges });
    }
  }

  // Write entity pages.
  const entityRegistry = new SlugRegistry();
  const globalEntityTypeScores: Record<string, Record<EntityMention['type'], number>> = {};
  for (const source of processed) {
    if (!source.entityTypes) continue;
    for (const [name, type] of Object.entries(source.entityTypes)) {
      if (!globalEntityTypeScores[name]) {
        globalEntityTypeScores[name] = { person: 0, organization: 0, product: 0, location: 0, case: 0, event: 0 };
      }
      const sourceCount = source.entities[name] || 1;
      globalEntityTypeScores[name][type] += sourceCount;
    }
  }
  function resolveEntityType(name: string): EntityMention['type'] {
    const scores = globalEntityTypeScores[name];
    if (!scores) return inferEntityType(name);
    const entries = Object.entries(scores) as [EntityMention['type'], number][];
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][1] > 0 ? entries[0][0] : inferEntityType(name);
  }

  // Prepare LLM-authored entity/topic page bodies. If the LLM is disabled or
  // returns invalid output, the writer aborts.
  const entityInputs: EntityTopicPageInputEntity[] = selectedEntityNames.map((name) => {
    const type = resolveEntityType(name);
    const title = entityPageTitle({ name, type, count: 0 });
    const count = globalEntityCounts[name];
    const memoryEntity = memory?.state.entities[slugify(name)] ?? memory?.state.entities[name.toLowerCase()];
    return {
      name,
      type,
      count,
      mentions: entityLocations[title] || [],
      description: memoryEntity?.description,
      relationships: memoryEntity?.relationships,
    };
  });
  const topicInputs: EntityTopicPageInputTopic[] = selectedTopicNames.map((name) => {
    const title = topicPageTitle({ name, count: 0 });
    const count = globalTopicCounts[name];
    const related = memory?.state.topics[name]?.related ?? topicLocations[title]?.map((m) => m.source) ?? [];
    return {
      name,
      count,
      mentions: topicLocations[title] || [],
      related,
    };
  });
  const agentsMd = readAgentsMd(workspace, slug);
  const entityTopicBodies = llmClient
    ? await entityTopicPageWriter(entityInputs, topicInputs, config, llmClient, agentsMd, memory)
    : undefined;
  const entityBodies = new Map(entityTopicBodies?.entities.map((e) => [e.name, e.body]) ?? []);
  const topicBodies = new Map(entityTopicBodies?.topics.map((t) => [t.name, t.body]) ?? []);

  for (const name of selectedEntityNames) {
    const type = resolveEntityType(name);
    const title = entityPageTitle({ name, type, count: 0 });
    const count = globalEntityCounts[name];
    const entity: EntityMention = { name, type, count };
    // Memory stores entities by canonical slug; selected names use the display name.
    const memoryEntity = memory?.state.entities[slugify(name)] ?? memory?.state.entities[name.toLowerCase()];
    const entityMentions = entityLocations[title] || [];
    writeEntityPage(
      path.join(entitiesDir, entityFileNameWithRegistry(entity, entityRegistry)),
      entity,
      config,
      entityMentions,
      {
        description: memoryEntity?.description,
        relationships: memoryEntity?.relationships,
        sources: buildMentionSources(entityMentions),
      },
      entityBodies.get(name),
    );
    result.entityPages++;
  }

  // Write topic pages.
  for (const name of selectedTopicNames) {
    const title = topicPageTitle({ name, count: 0 });
    const count = globalTopicCounts[name];
    const topic: Topic = { name, count };
    const related = memory?.state.topics[name]?.related ?? topicLocations[title]?.map((m) => m.source) ?? [];
    const topicMentions = topicLocations[title] || [];
    writeTopicPage(
      path.join(topicsDir, topicFileName(topic)),
      topic,
      config,
      topicMentions,
      related,
      topicBodies.get(name),
      buildMentionSources(topicMentions),
    );
    result.topicPages++;
  }

  // Build index page information.
  const sourcePageInfos = buildSourcePageInfos(wikiDir, config.output.dir, state, processed);
  const documentPageInfos = buildDocumentPageInfos(wikiDir, config.output.dir, state, processed);
  const rawPageInfos = buildRawPageInfos(wikiDir, config.output.dir, state, processed);

  // Write dynamic folder hierarchy contracts and update rolling memory.
  const folderPages = collectFolderPages(wikiDir, config.output.dir, folderPlacements.map((f) => f.folder));
  result.folderIndexes = writeIngestContracts(
    workspace,
    slug,
    config,
    memory || createEmptyMemory(),
    folderPlacements,
    result.sourceFiles,
    result.documentPages,
    result.rawPages,
    result.warnings,
    folderPages,
  );

  // Write the wiki-level index as the final generated page (overwrites the skeleton/contract stub).
  const wikiIndexPath = path.join(outputDir, 'index.md');
  writeWikiIndex(
    wikiIndexPath,
    config,
    sourcePageInfos,
    documentPageInfos,
    entityTitles,
    topicTitles,
    rawPageInfos,
    { warnings: result.warnings.length + result.errors.length, errors: result.errors.length },
    folderPlacements.map((f) => ({ folder: f.folder, title: f.title })),
  );

  // Write top-level index-of-indexes with cross-wiki name surfacing.
  const wikiSlugs = discoverWikisForIndex(workspace);
  const wikiSummaries: WikiOfWikiSummary[] = wikiSlugs.map((s) => summarizeWiki(workspace, s));
  const wikiOfWikiResult = runWikiOfWikiAgent(workspace, wikiSummaries);
  writeIndexOfIndexes(workspace, wikiOfWikiResult.wikis, wikiOfWikiResult.crossWikiNames);

  // Run lint and write report.
  const lintResult = lintWiki(workspace, slug, config);
  writeLintReport(workspace, slug, config, lintResult);
  result.lintIssues = lintResult.issues.length;
  result.warnings.push(
    ...lintResult.issues.map((i) => `[${i.type}] ${i.file}: ${i.message}`),
  );
}

function mergeMemory(
  previous: OrchestratorMemory,
  result: ExtractionResult,
  chunks: Chunk[],
): OrchestratorMemory {
  const merged: OrchestratorMemory = {
    rollingSummary: previous.rollingSummary + `\nProcessing ${result.fileName} (${result.physicalPages} pages, ${chunks.length} chunks).`,
    historicalSummary: previous.historicalSummary,
    summaryOnly: previous.summaryOnly,
    state: {
      document: {
        title: previous.state.document.title || result.metadata.title || result.fileName,
        totalPages: Math.max(previous.state.document.totalPages, result.physicalPages),
        currentChunk: previous.state.document.currentChunk + chunks.length,
        boundaryType: previous.state.document.boundaryType,
      },
      entities: { ...previous.state.entities },
      topics: { ...previous.state.topics },
      relationships: [...previous.state.relationships],
      sources: { ...previous.state.sources },
      folderHierarchy: { ...previous.state.folderHierarchy },
      rawFragments: [...previous.state.rawFragments],
      duplicateFlags: [...previous.state.duplicateFlags],
      sourceEntities: { ...previous.state.sourceEntities },
      sourceTopics: { ...previous.state.sourceTopics },
    },
  };

  merged.state.sources[result.filePath] = {
    sha256: result.sha256,
    logicalPages: String(result.logicalPages),
    physicalPages: result.physicalPages,
    warnings: result.warnings,
  };

  for (const page of result.pages) {
    if (page.isScanned) {
      merged.state.rawFragments.push({
        source: result.filePath,
        pages: String(page.physicalPage),
        reason: 'Scanned or image-only page',
        fragment: page.text.slice(0, 200),
      });
    }
  }

  return merged;
}

function readAgentsMd(workspace: string, slug: string): string | undefined {
  const agentsPath = path.join(workspace, 'wikis', slug, 'AGENTS.md');
  if (!existsSync(agentsPath)) {
    return undefined;
  }
  try {
    const content = readFileSync(agentsPath, 'utf-8');
    // Strip frontmatter so the prompt receives only the markdown body.
    const frontmatterEnd = content.indexOf('\n---');
    if (frontmatterEnd !== -1 && content.startsWith('---')) {
      return content.slice(frontmatterEnd + 4).trim();
    }
    return content.trim();
  } catch {
    return undefined;
  }
}

function createEmptyMemory(): OrchestratorMemory {
  return {
    rollingSummary: 'No memory accumulated yet.',
    historicalSummary: '',
    summaryOnly: false,
    state: {
      document: { title: '', totalPages: 0, currentChunk: 0, boundaryType: 'page' },
      entities: {},
      topics: {},
      relationships: [],
      sources: {},
      folderHierarchy: {},
      rawFragments: [],
      duplicateFlags: [],
      sourceEntities: {},
      sourceTopics: {},
    },
  };
}

function inferEntityType(name: string): EntityMention['type'] {
  const lower = name.toLowerCase();
  const orgSuffixes = ['inc', 'llc', 'corp', 'ltd', 'co', 'company', 'group', 'corporation', 'plc', 'gmbh', 'sa', 'bv'];
  if (orgSuffixes.some((s) => lower.endsWith(s))) return 'organization';
  const orgKeywords = [
    'center', 'centre', 'institute', 'institution', 'committee', 'bank', 'department',
    'foundation', 'association', 'council', 'agency', 'board', 'commission', 'office',
    'bureau', 'administration', 'authority', 'organization', 'organisation', 'union',
    'alliance', 'consortium', 'society', 'federation', 'chamber', 'exchange', 'corporation',
    'incorporated', 'library', 'medicine', 'database',
  ];
  if (orgKeywords.some((kw) => lower.includes(' ' + kw + ' ') || lower.endsWith(' ' + kw))) return 'organization';
  const productKeywords = [
    'inventory', 'product', 'device', 'system', 'platform', 'tool', 'database', 'software',
    'application', 'framework', 'model', 'api', 'bond', 'loan', 'lease', 'facility',
    'program', 'project', 'initiative', 'standard', 'metric', 'instrument', 'catalog',
    'handbook', 'registry', 'index',
  ];
  if (productKeywords.some((kw) => lower.includes(' ' + kw + ' ') || lower.endsWith(' ' + kw))) return 'product';
  // Two capitalized words is the classic person pattern.
  if (/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(name)) return 'person';
  // Unknown multi-word names default to organization rather than person, because
  // most unrecognized named entities in annual reports are institutions, funds, or
  // frameworks.
  return 'organization';
}

function buildMentionSources(
  mentions: { source: string; filePath?: string; pages: string }[],
): { id: string; file: string; pages: string; extracted: string }[] {
  const now = new Date().toISOString();
  const seen = new Map<string, string>();
  let index = 0;
  for (const mention of mentions) {
    if (!mention.filePath) continue;
    if (seen.has(mention.filePath)) {
      const existing = seen.get(mention.filePath)!;
      seen.set(mention.filePath, `${existing}, ${mention.pages}`);
    } else {
      seen.set(mention.filePath, mention.pages);
    }
  }
  const sources: { id: string; file: string; pages: string; extracted: string }[] = [];
  for (const [file, pages] of seen) {
    sources.push({ id: `src${++index}`, file, pages, extracted: now });
  }
  return sources;
}

function buildSourcePageInfos(
  wikiDir: string,
  outputDirName: string,
  state: { sources: Record<string, { sourcePage: string }> },
  processed: ProcessedSource[],
): any[] {
  const infos: any[] = [];
  const outputDir = path.join(wikiDir, outputDirName);

  for (const source of processed) {
    if (isExtractionFailure(source.outcome)) continue;
    const result = source.outcome;
    infos.push({
      fileName: source.fileName,
      filePath: source.relativeFile,
      title: `Source: ${source.fileName}`,
      physicalPages: result.physicalPages,
      logicalPages: result.logicalPages,
      warnings: result.warnings,
    });
  }

  for (const [relativeFile, sourceState] of Object.entries(state.sources)) {
    if (processed.some((p) => p.relativeFile === relativeFile)) continue;
    const sourcePagePath = path.join(outputDir, sourceState.sourcePage);
    if (!existsSync(sourcePagePath)) continue;
    const parsed = matter(readFileSync(sourcePagePath, 'utf-8'));
    infos.push({
      fileName: path.basename(relativeFile),
      filePath: relativeFile,
      title: parsed.data.title || `Source: ${path.basename(relativeFile)}`,
      physicalPages: parsed.data.physical_pages || 0,
      logicalPages: parsed.data.logical_pages || 0,
      warnings: parsed.data.warnings || [],
    });
  }

  return infos;
}

function buildDocumentPageInfos(
  wikiDir: string,
  outputDirName: string,
  state: { sources: Record<string, { documentPages: string[] }> },
  processed: ProcessedSource[],
): any[] {
  const infos: any[] = [];
  const outputDir = path.join(wikiDir, outputDirName);

  for (const source of processed) {
    if (source.documentLinks) {
      for (const link of source.documentLinks) {
        infos.push({
          fileName: `${link.pageRange}.md`,
          title: link.title,
          sourceFile: source.fileName,
          sourcePageTitle: `Source: ${source.fileName}`,
          pageRange: link.pageRange,
        });
      }
      continue;
    }
    if (!source.chunks) continue;
    for (const chunk of source.chunks) {
      infos.push({
        fileName: `${chunk.id}.md`,
        title: chunk.title,
        sourceFile: source.fileName,
        sourcePageTitle: `Source: ${source.fileName}`,
        pageRange: chunk.pageRange,
      });
    }
  }

  for (const [relativeFile, sourceState] of Object.entries(state.sources)) {
    if (processed.some((p) => p.relativeFile === relativeFile)) continue;
    for (const docPage of sourceState.documentPages) {
      const docPagePath = path.join(outputDir, docPage);
      if (!existsSync(docPagePath)) continue;
      const parsed = matter(readFileSync(docPagePath, 'utf-8'));
      const pageRange = parsed.data.sources?.[0]?.pages || '?';
      infos.push({
        fileName: path.basename(docPage),
        title: parsed.data.title || path.basename(docPage, '.md'),
        sourceFile: path.basename(relativeFile),
        sourcePageTitle: `Source: ${path.basename(relativeFile)}`,
        pageRange,
      });
    }
  }

  return infos;
}

function buildRawPageInfos(
  wikiDir: string,
  outputDirName: string,
  state: { sources: Record<string, { rawPages: string[] }> },
  processed: ProcessedSource[],
): any[] {
  const infos: any[] = [];
  const outputDir = path.join(wikiDir, outputDirName);

  for (const source of processed) {
    if (!source.rawPageIds) continue;
    for (const rawPageId of source.rawPageIds) {
      const rawPagePath = path.join(outputDir, rawPageId);
      if (!existsSync(rawPagePath)) continue;
      const parsed = matter(readFileSync(rawPagePath, 'utf-8'));
      infos.push({
        fileName: path.basename(rawPageId),
        title: parsed.data.title || path.basename(rawPageId, '.md'),
        sourceFile: source.fileName,
      });
    }
  }

  for (const [relativeFile, sourceState] of Object.entries(state.sources)) {
    if (processed.some((p) => p.relativeFile === relativeFile)) continue;
    for (const rawPage of sourceState.rawPages) {
      const rawPagePath = path.join(outputDir, rawPage);
      if (!existsSync(rawPagePath)) continue;
      const parsed = matter(readFileSync(rawPagePath, 'utf-8'));
      infos.push({
        fileName: path.basename(rawPage),
        title: parsed.data.title || path.basename(rawPage, '.md'),
        sourceFile: path.basename(relativeFile),
      });
    }
  }

  return infos;
}

function discoverWikisForIndex(workspace: string): string[] {
  const wikisDir = path.join(workspace, 'wikis');
  if (!existsSync(wikisDir)) return [];
  return readdirSync(wikisDir)
    .filter((entry) => {
      const full = path.join(wikisDir, entry);
      return statSync(full).isDirectory() && existsSync(path.join(full, 'raw'));
    })
    .sort();
}

function collectFolderPages(
  wikiDir: string,
  outputDirName: string,
  folders: string[],
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const folder of folders) {
    const fullDir = path.join(wikiDir, outputDirName, folder);
    if (!existsSync(fullDir)) continue;
    const entries = readdirSync(fullDir)
      .filter((f) => f.endsWith('.md') && f !== 'index.md')
      .sort();
    result[folder] = entries;
  }
  return result;
}

export function summarizeWiki(
  workspace: string,
  slug: string,
): {
  slug: string;
  title: string;
  description: string;
  sourceCount: number;
  documentCount: number;
  entityCount: number;
  topicCount: number;
  rawCount: number;
} {
  const wikiDir = path.join(workspace, 'wikis', slug);
  const configPath = path.join(wikiDir, 'config.json');
  let title = slug;
  let description = '';
  if (existsSync(configPath)) {
    try {
      const parsed = JSON.parse(readFileSync(configPath, 'utf-8'));
      title = parsed.wiki?.title || slug;
      description = parsed.wiki?.description || '';
    } catch {
      // Ignore config parse errors.
    }
  }

  const rawDir = path.join(wikiDir, 'raw');
  const sourceCount = existsSync(rawDir) ? readdirSync(rawDir).filter((f) => f.toLowerCase().endsWith('.pdf')).length : 0;
  const documentsDir = path.join(wikiDir, 'documents');
  const entitiesDir = path.join(wikiDir, 'entities');
  const topicsDir = path.join(wikiDir, 'topics');
  const rawOutputDir = path.join(wikiDir, 'raw');
  const documentCount = existsSync(documentsDir)
    ? readdirSync(documentsDir).filter((f) => f.endsWith('.md') && f !== 'index.md').length
    : 0;
  const entityCount = existsSync(entitiesDir)
    ? readdirSync(entitiesDir).filter((f) => f.endsWith('.md') && f !== 'index.md').length
    : 0;
  const topicCount = existsSync(topicsDir)
    ? readdirSync(topicsDir).filter((f) => f.endsWith('.md') && f !== 'index.md').length
    : 0;
  const rawCount = existsSync(rawOutputDir)
    ? readdirSync(rawOutputDir).filter((f) => f.endsWith('.md') && f !== 'index.md').length
    : 0;

  return { slug, title, description, sourceCount, documentCount, entityCount, topicCount, rawCount };
}
