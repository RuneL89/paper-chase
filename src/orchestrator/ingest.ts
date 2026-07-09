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
import { lintWiki, writeLintReport, repairWikilinks } from '../lint/index.js';
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
  defaultFolderPlacements,
} from './agents.js';
import {
  compactMemoryIfNeeded,
  saveMemory,
  saveMemorySummary,
  DEFAULT_MEMORY_CAPS,
} from './memory.js';
import { writeWikiIndexContract, writeFolderIndexContract, type WikiIndexData } from './contracts.js';
import { validatePagePlan } from './validation.js';
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
): Promise<IngestOrchestratorResult> {
  const agentsMd = readAgentsMd(workspace, slug);
  const stepStart = Date.now();
  const logStep = (label: string) => {
    console.log(`  ${label}: ${((Date.now() - stepStart) / 1000).toFixed(1)}s`);
  };

  const structure = await structureAnalyst(result, chunks, llmClient, agentsMd, previousMemory);
  logStep('structureAnalyst');

  // Entity extraction runs per chunk so the LLM receives a focused context and
  // can accurately identify proper named entities. Results are accumulated and
  // deduplicated across chunks.
  const accumulatedMemory = previousMemory
    ? mergeMemory(previousMemory, result, chunks)
    : createInitialMemory(result, chunks);
  const entityMap = new Map<string, ExtractedEntity>();
  for (const chunk of chunks) {
    const { entities: chunkEntities } = await entityExtractor(
      result,
      [chunk],
      llmClient,
      agentsMd,
      accumulatedMemory,
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

  const { relationships } = await relationshipExtractor(result, entities, llmClient, agentsMd, previousMemory);
  logStep('relationshipExtractor');

  const evidence = await evidenceCollector(result, chunks, llmClient, agentsMd, previousMemory);
  logStep('evidenceCollector');

  let plannerOutput;
  try {
    plannerOutput = await pagePlanner(
      result,
      structure,
      entities,
      evidence,
      llmClient,
      agentsMd,
      previousMemory,
      samplingStrategy,
    );
  } catch (error) {
    plannerOutput = {
      pages: [],
      folderPlacements: defaultFolderPlacements(result, entities),
      wikilinks: [],
      citations: [],
      discovery: {
        existingDocument: false,
        newEntities: false,
        newTopics: false,
        hasTablesFigures: false,
        rawPages: false,
        newPageType: false,
      },
    };
  }

  const folderPlacements = plannerOutput.folderPlacements.length > 0
    ? plannerOutput.folderPlacements
    : defaultFolderPlacements(result, entities);

  const memory = previousMemory
    ? mergeMemory(previousMemory, result, chunks)
    : createInitialMemory(result, chunks);

  const pageUpdates = await chunkWriter(
    plannerOutput.pages,
    chunks,
    result,
    config,
    llmClient,
    agentsMd,
    memory,
  );
  logStep('chunkWriter');

  const criticReview = await critic(
    result,
    plannerOutput.pages,
    folderPlacements,
    llmClient,
    agentsMd,
    memory,
    pageUpdates,
  );
  logStep('critic');
  const validationReview = validatePagePlan(plannerOutput.pages, folderPlacements);
  const combinedIssues = [...criticReview.issues, ...validationReview.issues];
  const combinedCritic: CriticReview = {
    issues: combinedIssues,
    confidence: combinedIssues.length === 0 ? 'high' : 'low',
  };

  const extractedTopics = mergeFragmentTopics(extractTopicsFromPagePlans(plannerOutput.pages));
  updateMemory(memory, result.filePath, entities, relationships, extractedTopics, folderPlacements);

  // Rolling memory compaction and persistence.
  compactMemoryIfNeeded(memory, {
    maxEntities: config.llm?.maxRollingMemoryTokens ? 500 : DEFAULT_MEMORY_CAPS.maxEntities,
    maxTopics: DEFAULT_MEMORY_CAPS.maxTopics,
    maxRelationships: DEFAULT_MEMORY_CAPS.maxRelationships,
    maxRollingMemoryTokens: config.llm?.maxRollingMemoryTokens ?? DEFAULT_MEMORY_CAPS.maxRollingMemoryTokens,
    compactionRatio: DEFAULT_MEMORY_CAPS.compactionRatio,
  });
  const wikiDir = path.join(workspace, 'wikis', slug);
  const outputDir = path.join(wikiDir, config.output.dir);
  saveMemory(outputDir, memory);
  saveMemorySummary(outputDir, memory);

  const proposals = detectStructuralProposals(
    previousMemory?.state.folderHierarchy ?? {},
    folderPlacements,
  );

  return {
    memory,
    folderPlacements,
    pages: plannerOutput.pages,
    pageUpdates,
    critic: combinedCritic,
    proposals,
    extractedEntities: entities,
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
  const { workspace, slug, config, processed, state, memory, folderPlacements, result } = context;
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
      if (update) {
        writeDocumentPage(
          filePath,
          chunk,
          config,
          entityTitles,
          topicTitles,
          { frontmatter: update.frontmatter, body: update.body },
        );
      } else {
        writeDocumentPage(filePath, chunk, config, entityTitles, topicTitles);
      }
      result.documentPages++;

      // Use the actual LLM-written title (or fallback to the deterministic title)
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
      entityLocations[title].push({ source: source.fileName, pages: pageRanges });
    }
    for (const name of Object.keys(source.topics)) {
      const title = topicPageTitle({ name, count: 0 });
      if (!topicLocations[title]) topicLocations[title] = [];
      topicLocations[title].push({ source: source.fileName, pages: pageRanges });
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
  for (const name of selectedEntityNames) {
    const type = resolveEntityType(name);
    const title = entityPageTitle({ name, type, count: 0 });
    const count = globalEntityCounts[name];
    const entity: EntityMention = { name, type, count };
    // Memory stores entities by canonical slug; selected names use the display name.
    const memoryEntity = memory?.state.entities[slugify(name)] ?? memory?.state.entities[name.toLowerCase()];
    writeEntityPage(
      path.join(entitiesDir, entityFileNameWithRegistry(entity, entityRegistry)),
      entity,
      config,
      entityLocations[title] || [],
      {
        description: memoryEntity?.description,
        relationships: memoryEntity?.relationships,
      },
    );
    result.entityPages++;
  }

  // Write topic pages.
  for (const name of selectedTopicNames) {
    const title = topicPageTitle({ name, count: 0 });
    const count = globalTopicCounts[name];
    const topic: Topic = { name, count };
    const related = memory?.state.topics[name]?.related ?? topicLocations[title]?.map((m) => m.source) ?? [];
    writeTopicPage(
      path.join(topicsDir, topicFileName(topic)),
      topic,
      config,
      topicLocations[title] || [],
      related,
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

  // Repair any wikilinks that the LLM wrote to titles that were not actually
  // created (e.g. a fragment topic), so the deterministic lint pass is clean.
  repairWikilinks(workspace, slug, config);

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

function detectStructuralProposals(
  previousHierarchy: Record<string, FolderPlan>,
  currentPlacements: FolderPlan[],
): StructuralProposal[] {
  const previousFolders = new Set(Object.keys(previousHierarchy));
  const currentFolders = new Set(currentPlacements.map((f) => f.folder));
  const addedFolders = currentPlacements.filter((f) => !previousFolders.has(f.folder));

  if (previousFolders.size === 0 || addedFolders.length === 0) {
    return [];
  }

  return [
    {
      type: 'new-folder',
      reason: `New corpus content requires additional folders: ${addedFolders.map((f) => f.title).join(', ')}.`,
      currentFolders: Array.from(previousFolders),
      proposedFolders: Array.from(currentFolders),
    },
  ];
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
