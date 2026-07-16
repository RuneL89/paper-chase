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
import { slugify } from '../utils/slug.js';
import {
  entityPageTitle,
  type EntityMention,
} from '../entities/index.js';
import { topicPageTitle } from '../topics/index.js';
import { materializeChunkEntitiesAndTopics } from '../ingestion/chunk-materializer.js';
export {
  verifyPreservation,
  buildMergedSources,
  isPageManuallyEdited,
  normalizeRelationshipsForEntity,
} from '../ingestion/state.js';
import {
  structureAnalyst,
  entityExtractor,
  relationshipExtractorForChunk,
  evidenceCollector,
  pagePlanner,
  chunkWriterForChunk,
  critic,
  sourcePageWriter,
  rawPageWriter,
  createInitialMemory,
  updateMemory,
  mergeEntityTaxonomy,
  prepareMemoryForSource,
  updateMemoryForChunk,
  entityCritic,
  applyEntityAudit,
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
  applyStructuralChanges,
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
  reporter?: ProgressReporter,
  ingestionResult?: IngestionResult,
  state?: IngestionState,
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
  // deduplicated across chunks, and per-chunk outputs are stored for the
  // per-chunk materialization loop below.
  const accumulatedMemory = previousMemory
    ? mergeMemory(previousMemory, result, chunks)
    : createInitialMemory(result, chunks);
  const entityMap = new Map<string, ExtractedEntity>();
  const chunkEntityOutputs: ExtractedEntity[][] = [];
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
    chunkEntityOutputs.push(chunkEntities);
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

  // Evidence and page planning happen once per source so the folder structure
  // is stable for the whole source; entity/topic pages are updated per-chunk.
  const evidence = await progress.step(
    'evidence-collector',
    'Collecting evidence',
    () => evidenceCollector(result, chunks, llmClient, agentsMd, previousMemory),
  );
  logStep('evidenceCollector');

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
      chunks,
    ),
  );

  if (plannerOutput.folderPlacements.length === 0) {
    throw new CLIError('PagePlanner returned no folder placements.');
  }

  const folderPlacements = plannerOutput.folderPlacements;

  // Detect structural-change proposals relative to the previously approved folder
  // hierarchy. All structural changes are applied autonomously by the LLM and logged
  // for after-the-fact human review; there is no approval gate.
  const previousHierarchy = previousMemory?.state.folderHierarchy ?? {};
  let resolvedFolderPlacements: FolderPlan[] = folderPlacements;
  let resolvedPages = plannerOutput.pages;
  const proposals = detectStructuralProposals(previousHierarchy, folderPlacements);

  if (proposals.length > 0) {
    const proposal = proposals[0];
    const applied = applyStructuralChanges(
      workspace,
      slug,
      proposal,
      config,
      accumulatedMemory,
      state,
    );
    resolvedFolderPlacements = folderPlacementsFromProposal(previousHierarchy, applied);
    progress.proposal(applied.type, applied.reason, true);
    console.log(`Structural change applied and logged for wiki "${slug}": ${applied.reason}`);
  }

  syncFolderPageTypes(resolvedFolderPlacements, resolvedPages);

  // Prepare rolling memory for this source: subtract old contributions on re-ingestion
  // and start with a fresh source ledger for per-chunk accumulation.
  const memory = previousMemory
    ? mergeMemory(previousMemory, result, chunks)
    : createInitialMemory(result, chunks);
  prepareMemoryForSource(memory, result.filePath);

  if (plannerOutput.entityTaxonomy) {
    mergeEntityTaxonomy(memory, plannerOutput.entityTaxonomy);
  }

  const wikiDir = path.join(workspace, 'wikis', slug);
  const outputDir = wikiDir;
  mkdirSync(outputDir, { recursive: true });
  for (const dir of ['documents', 'sources', 'raw', 'topics']) {
    mkdirSync(path.join(outputDir, dir), { recursive: true });
  }
  mkdirSync(path.join(outputDir, 'entities'), { recursive: true });
  for (const sub of memory.state.entityTaxonomy.subFolders) {
    mkdirSync(path.join(outputDir, 'entities', sub.slug), { recursive: true });
  }
  const pageUpdates: PageUpdate[] = [];
  const documentLinks: DocumentPageLink[] = [];
  const allCriticIssues: CriticReview['issues'] = [];
  const allBlockingIssues: CriticReview['blockingIssues'] = [];
  const allChecks: CriticReview['checks'] = [];
  let allApproved = true;
  const allCompletenessIssues: string[] = [];

  // Topic pages exist only because the LLM decided they should (vision 02 §4):
  // seed rolling memory from the PagePlanner's topic plans BEFORE the chunk
  // loop so per-chunk materialization updates exactly the LLM-planned topics.
  // Deterministic n-gram topic extraction must not decide page existence.
  const extractedTopics = extractTopicsFromPagePlans(resolvedPages);
  updateMemoryForChunk(memory, result.filePath, [], [], extractedTopics);

  // Per-chunk incremental flush: for each chunk we extract relationships, update
  // memory, write the document page, and update affected entity/topic pages.
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    const chunkEntities = chunkEntityOutputs[chunkIndex];

    updateMemoryForChunk(memory, result.filePath, chunkEntities, [], []);

    const { relationships: chunkRelationships } = await progress.step(
      'relationship-extractor',
      `Extracting relationships for chunk ${chunk.id}`,
      () => relationshipExtractorForChunk(result, chunk, auditedEntities, llmClient, agentsMd, memory),
    );
    updateMemoryForChunk(memory, result.filePath, [], chunkRelationships, []);

    const validationResult = await writeAndValidateChunk(
      workspace,
      resolvedPages,
      chunk,
      result,
      config,
      llmClient,
      agentsMd,
      memory,
      resolvedFolderPlacements,
      progress,
    );
    const pageUpdate = validationResult.pageUpdate;
    pageUpdates.push(pageUpdate);
    allCriticIssues.push(...validationResult.critic.issues);
    allBlockingIssues.push(...validationResult.critic.blockingIssues);
    allChecks.push(...validationResult.critic.checks);
    allApproved = allApproved && validationResult.critic.approved;
    allCompletenessIssues.push(...validationResult.completenessIssues);

    const documentPageId = `documents/${chunk.id}.md`;
    const filePath = path.join(outputDir, documentPageId);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeDocumentPage(
      filePath,
      chunk,
      config,
      { frontmatter: pageUpdate.frontmatter, body: pageUpdate.body },
    );
    if (ingestionResult) {
      ingestionResult.documentPages++;
    }

    const parsed = matter(readFileSync(filePath, 'utf-8'));
    documentLinks.push({ title: String(parsed.data.title || chunk.title), pageRange: chunk.pageRange });

    await materializeChunkEntitiesAndTopics(
      {
        workspace,
        slug,
        config,
        source: result,
        chunk,
        memory,
        llmClient,
        state: state ?? {
          version: '1.1',
          lastRun: new Date().toISOString(),
          sources: {},
          pages: {},
        },
        result: ingestionResult ?? {
          sourceFiles: 0,
          sourceFilePaths: [],
          documentPages: 0,
          rawPages: 0,
          entityPages: 0,
          topicPages: 0,
          warnings: [],
          errors: [],
          changed: [],
          added: [],
          removed: [],
          chunkBoundaries: [],
          lintIssues: 0,
        },
        folderPlacements: resolvedFolderPlacements,
        pages: resolvedPages,
        reporter: progress,
        isLastChunk: chunkIndex === chunks.length - 1,
      },
      chunkEntities,
      chunkRelationships,
    );
  }
  logStep('chunkWriter');
  logStep('critic');

  // Write raw pages for this source.
  const baseSlug = path.basename(result.fileName, path.extname(result.fileName));
  const rawPageIds = result.pages
    .filter((page) => page.isScanned)
    .map((page) => `raw/${baseSlug}-page-${page.physicalPage}.md`);
  for (const rawPageId of rawPageIds) {
    const pageNumber = parseInt(rawPageId.match(/page-(\d+)\.md$/)?.[1] || '0', 10);
    const page = result.pages.find((p) => p.physicalPage === pageNumber);
    if (page) {
      const { body: rawBody } = await rawPageWriter(result, page, config, llmClient, agentsMd, memory);
      writeRawPage(path.join(outputDir, rawPageId), result, page, rawBody, config.wiki.slug);
      if (ingestionResult) {
        ingestionResult.rawPages++;
      }
    }
  }

  const rawLinks = rawPageIds.map((id) => ({
    title: `Raw fragment: ${result.fileName}, page ${id.match(/page-(\d+)\.md$/)?.[1] || 0}`,
    physicalPage: parseInt(id.match(/page-(\d+)\.md$/)?.[1] || '0', 10),
  }));
  const { body: sourceBody } = await sourcePageWriter(
    result,
    documentLinks,
    rawLinks,
    config,
    llmClient,
    agentsMd,
    memory,
  );
  writeSourcePage(
    path.join(outputDir, `sources/${baseSlug}.md`),
    result,
    sourceBody,
    config.wiki.slug,
  );

  // Finalize the folder hierarchy in memory (topics were seeded from the
  // LLM page plans before the chunk loop).
  for (const folder of resolvedFolderPlacements) {
    memory.state.folderHierarchy[folder.folder] = folder;
  }

  // Rolling memory compaction and persistence.
  compactMemoryIfNeeded(memory, {
    maxEntities: config.llm?.maxRollingMemoryTokens ? 500 : DEFAULT_MEMORY_CAPS.maxEntities,
    maxTopics: DEFAULT_MEMORY_CAPS.maxTopics,
    maxRelationships: DEFAULT_MEMORY_CAPS.maxRelationships,
    maxRollingMemoryTokens: config.llm?.maxRollingMemoryTokens ?? DEFAULT_MEMORY_CAPS.maxRollingMemoryTokens,
    compactionRatio: DEFAULT_MEMORY_CAPS.compactionRatio,
  });
  saveMemory(outputDir, memory);
  saveMemorySummary(outputDir, memory);

  const validationReview = validatePagePlan(resolvedPages, resolvedFolderPlacements);
  const combinedIssues = [
    ...allCriticIssues,
    ...allCompletenessIssues.map((m) => ({ type: 'missing' as const, message: m, severity: 'medium' as const })),
    ...validationReview.issues,
  ];
  const combinedCritic: CriticReview = {
    approved: allApproved && allCompletenessIssues.length === 0,
    issues: combinedIssues,
    confidence: combinedIssues.length === 0 ? 'high' : 'low',
    checks: allChecks,
    blockingIssues: allBlockingIssues,
  };

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

function topicNameFromPagePlan(page: PagePlan): string {
  const lower = page.title.toLowerCase();
  if (lower.startsWith('topic:')) {
    return lower.slice(6).trim();
  }
  return lower.trim();
}

async function writeAndValidateChunk(
  workspace: string,
  pages: PagePlan[],
  chunk: Chunk,
  result: ExtractionResult,
  config: Config,
  llmClient: LLMClient,
  agentsMd: string | undefined,
  memory: OrchestratorMemory,
  folderPlacements: FolderPlan[],
  reporter: ProgressReporter,
): Promise<{
  pageUpdate: PageUpdate;
  critic: CriticReview;
  completenessIssues: string[];
}> {
  const progress = reporter;
  let pageUpdate = await progress.step(
    'chunk-writer',
    `Writing document chunk ${chunk.id}`,
    () => chunkWriterForChunk(
      pages,
      chunk,
      result,
      config,
      llmClient,
      agentsMd,
      memory,
    ),
  );
  let criticReview = await progress.step(
    'critic',
    `Reviewing chunk ${chunk.id}`,
    () => critic(
      result,
      pages,
      folderPlacements,
      llmClient,
      agentsMd,
      memory,
      [pageUpdate],
      chunk,
      config,
    ),
  );
  if (criticReview.issues.length > 0) {
    progress.criticIssues(criticReview.issues);
  }
  let completenessIssues = collectCompletenessIssues([chunk], [pageUpdate], result);
  const schemaIssues = validatePageUpdates(workspace, pages, [pageUpdate], result, config);
  completenessIssues = completenessIssues.concat(schemaIssues);

  const maxRetries = Math.max(1, config.llm?.maxRetries ?? 2);
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (
      !llmClient.isEnabled() ||
      (completenessIssues.length === 0 && criticReview.approved && criticReview.blockingIssues.length === 0)
    ) {
      break;
    }

    const feedback = buildWriterFeedback(criticReview, completenessIssues);
    pageUpdate = await progress.step(
      'chunk-writer',
      `Retrying chunk ${chunk.id} (attempt ${attempt})`,
      () => chunkWriterForChunk(
        pages,
        chunk,
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
      `Re-reviewing chunk ${chunk.id} (attempt ${attempt})`,
      () => critic(
        result,
        pages,
        folderPlacements,
        llmClient,
        agentsMd,
        memory,
        [pageUpdate],
        chunk,
      ),
    );
    if (criticReview.issues.length > 0) {
      progress.criticIssues(criticReview.issues);
    }
    completenessIssues = collectCompletenessIssues([chunk], [pageUpdate], result);
    const retriedSchemaIssues = validatePageUpdates(workspace, pages, [pageUpdate], result, config);
    completenessIssues = completenessIssues.concat(retriedSchemaIssues);
  }

  // Vision 07 §8: if the reprocessed output still fails the Critic's blocking
  // checks or deterministic validation, the run aborts. Committing the chunk
  // anyway (with the failures demoted to warnings) would put unvalidated
  // content — e.g., unmapped citations or dropped tables — into the wiki.
  if (
    llmClient.isEnabled() &&
    (criticReview.blockingIssues.length > 0 || completenessIssues.length > 0)
  ) {
    const details = [
      ...criticReview.blockingIssues.map((i) => `[BLOCKING] ${i.check}: ${i.message}`),
      ...completenessIssues.map((m) => `[VALIDATION] ${m}`),
    ];
    throw new CLIError(
      `Chunk ${chunk.id} failed validation after ${maxRetries + 1} attempts; aborting instead of committing unvalidated content.\n${details.join('\n')}`,
    );
  }

  return {
    pageUpdate,
    critic: criticReview,
    completenessIssues,
  };
}

function buildWriterFeedback(criticReview: CriticReview, completenessIssues: string[]): string[] {
  const feedback: string[] = [
    'Fix EVERY issue below. Then re-check your entire body for: wikilinks whose target (the text before any pipe) is not an exact title from the Known pages list (forbidden — use plain text instead), and factual claims without an inline [^srcN] citation.',
  ];
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
  indexData: WikiIndexData,
  folderPages: Record<string, string[]> = {},
): string[] {
  const wikiDir = path.join(workspace, 'wikis', slug);
  const wikiIndexPath = path.join(wikiDir, 'index.md');

  writeWikiIndexContract(wikiIndexPath, indexData, config);

  const folderIndexes: string[] = [];
  for (const folder of folderPlacements) {
    const folderIndexPath = path.join(wikiDir, folder.folder, 'index.md');
    writeFolderIndexContract(folderIndexPath, folder, indexData, memory, folderPages);
    folderIndexes.push(folderIndexPath);
  }

  return folderIndexes;
}

export interface IngestFinalOutputContext {
  workspace: string;
  slug: string;
  config: Config;
  state: IngestionState;
  memory: OrchestratorMemory;
  folderPlacements: FolderPlan[];
  result: IngestionResult;
  processed?: ProcessedSource[];
}

export async function writeIngestFinalOutput(context: IngestFinalOutputContext): Promise<void> {
  const { workspace, slug, config, state, memory, folderPlacements, result, processed = [] } = context;
  const wikiDir = path.join(workspace, 'wikis', slug);
  const outputDir = wikiDir;

  // Ensure the lint directory exists.
  const lintDir = path.join(outputDir, 'lint');
  mkdirSync(lintDir, { recursive: true });

  // Count pages that were already written incrementally so the final result reflects
  // the actual output rather than what was buffered in memory.
  result.documentPages = countPagesInFolder(outputDir, 'documents');
  result.rawPages = countPagesInFolder(outputDir, 'raw');
  result.entityPages = countPagesInFolder(outputDir, 'entities');
  result.topicPages = countPagesInFolder(outputDir, 'topics');

  // Build page information from the persisted state and the files already on disk.
  const sourcePageInfos = buildSourcePageInfos(wikiDir, state, processed);
  const documentPageInfos = buildDocumentPageInfos(wikiDir, state, processed);
  const rawPageInfos = buildRawPageInfos(wikiDir, state, processed);

  // Determine selected entity and topic titles for the wiki index.
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
  const entityTitles = selectedEntityNames.map((name) =>
    entityPageTitle({ name, type: inferEntityType(name), count: 0 }),
  );
  const topicTitles = selectedTopicNames.map((name) => topicPageTitle({ name, count: 0 }));

  // Reflect entity sub-folders in the entities folder plan.
  const entitySubFolders = memory.state.entityTaxonomy.subFolders;
  const entityFolderPlan = folderPlacements.find((f) => f.folder === 'entities');
  if (entityFolderPlan) {
    entityFolderPlan.children = entitySubFolders.map((s) => s.slug);
  }

  // Build folder page catalogs, including entity sub-folders.
  const folderPages = collectFolderPages(wikiDir, folderPlacements.map((f) => f.folder));
  if (entityFolderPlan) {
    folderPages['entities'] = entitySubFolders.map((s) => `${s.slug}/index.md`);
  }
  const subFolderPages = collectEntitySubFolderPages(wikiDir, entitySubFolders);
  for (const [key, value] of Object.entries(subFolderPages)) {
    folderPages[key] = value;
  }

  const indexData: WikiIndexData = {
    slug,
    title: config.wiki.title,
    description: config.wiki.description,
    scope: memory.rollingSummary,
    sourceCount: result.sourceFiles,
    documentCount: result.documentPages,
    rawCount: result.rawPages,
    entityCount: Object.keys(memory.state.entities).length,
    topicCount: Object.keys(memory.state.topics).length,
    folders: folderPlacements,
    warnings: result.warnings,
  };

  // Write dynamic folder hierarchy contracts and update rolling memory.
  result.folderIndexes = writeIngestContracts(
    workspace,
    slug,
    config,
    memory || createEmptyMemory(),
    folderPlacements,
    indexData,
    folderPages,
  );

  // Write each entity sub-folder index as a DOX child contract.
  for (const sub of entitySubFolders) {
    const subFolderPlan: FolderPlan = {
      folder: `entities/${sub.slug}`,
      title: sub.title,
      description: sub.description,
      pageTypes: ['entity'],
      children: [],
    };
    const subIndexPath = path.join(outputDir, 'entities', sub.slug, 'index.md');
    writeFolderIndexContract(subIndexPath, subFolderPlan, indexData, memory, folderPages);
    result.folderIndexes.push(subIndexPath);
  }

  // Write the wiki-level index as the final generated page.
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
  result.warnings.push(...lintResult.issues.map((i) => `[${i.type}] ${i.file}: ${i.message}`));
}

function countPagesInFolder(outputDir: string, folder: string): number {
  const dir = path.join(outputDir, folder);
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      count += countPagesInFolder(outputDir, path.join(folder, entry));
    } else if (entry.endsWith('.md') && entry !== 'index.md') {
      count++;
    }
  }
  return count;
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
      entityTaxonomy: {
        subFolders: [...previous.state.entityTaxonomy.subFolders],
        assignments: { ...previous.state.entityTaxonomy.assignments },
      },
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

export function readAgentsMd(workspace: string, slug: string): string | undefined {
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

export function createEmptyMemory(): OrchestratorMemory {
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
      entityTaxonomy: { subFolders: [], assignments: {} },
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

function buildSourcePageInfos(
  wikiDir: string,
  state: { sources: Record<string, { sourcePage: string }> },
  processed: ProcessedSource[],
): any[] {
  const infos: any[] = [];

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
    const sourcePagePath = path.join(wikiDir, sourceState.sourcePage);
    if (!existsSync(sourcePagePath)) continue;
    const parsed = matter(readFileSync(sourcePagePath, 'utf-8'));
    infos.push({
      fileName: path.basename(relativeFile),
      filePath: relativeFile,
      title: parsed.data.title || `Source: ${path.basename(relativeFile)}`,
      physicalPages: parsed.data.pages || 0,
      logicalPages: parsed.data.pages || 0,
      warnings: parsed.data.warnings || [],
    });
  }

  return infos;
}

function buildDocumentPageInfos(
  wikiDir: string,
  state: { sources: Record<string, { documentPages: string[] }> },
  processed: ProcessedSource[],
): any[] {
  const infos: any[] = [];

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
    if (source.documentPageIds) {
      for (const docPage of source.documentPageIds) {
        const docPagePath = path.join(wikiDir, docPage);
        if (!existsSync(docPagePath)) continue;
        const parsed = matter(readFileSync(docPagePath, 'utf-8'));
        const pageRange =
          parsed.data.sources?.[0]?.pages ||
          source.chunks?.find((c) => `documents/${c.id}.md` === docPage)?.pageRange ||
          '?';
        infos.push({
          fileName: path.basename(docPage),
          title: parsed.data.title || path.basename(docPage, '.md'),
          sourceFile: source.fileName,
          sourcePageTitle: `Source: ${source.fileName}`,
          pageRange,
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
      const docPagePath = path.join(wikiDir, docPage);
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
  state: { sources: Record<string, { rawPages: string[] }> },
  processed: ProcessedSource[],
): any[] {
  const infos: any[] = [];

  for (const source of processed) {
    if (!source.rawPageIds) continue;
    for (const rawPageId of source.rawPageIds) {
      const rawPagePath = path.join(wikiDir, rawPageId);
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
      const rawPagePath = path.join(wikiDir, rawPage);
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
  folders: string[],
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const folder of folders) {
    const fullDir = path.join(wikiDir, folder);
    if (!existsSync(fullDir)) continue;
    const entries = readdirSync(fullDir)
      .filter((f) => f.endsWith('.md') && f !== 'index.md')
      .sort();
    result[folder] = entries;
  }
  return result;
}

function collectEntitySubFolderPages(
  wikiDir: string,
  subFolders: { slug: string }[],
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const sub of subFolders) {
    const fullDir = path.join(wikiDir, 'entities', sub.slug);
    if (!existsSync(fullDir)) continue;
    const entries = readdirSync(fullDir)
      .filter((f) => f.endsWith('.md') && f !== 'index.md')
      .sort();
    result[`entities/${sub.slug}`] = entries;
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
  const documentCount = countPagesInFolder(wikiDir, 'documents');
  const entityCount = countPagesInFolder(wikiDir, 'entities');
  const topicCount = countPagesInFolder(wikiDir, 'topics');
  const rawCount = countPagesInFolder(wikiDir, 'raw');

  return { slug, title, description, sourceCount, documentCount, entityCount, topicCount, rawCount };
}
