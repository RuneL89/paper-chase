import { readdirSync, statSync, mkdirSync, existsSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import matter from 'gray-matter';
import type { Config } from '../config.js';
import { wikiPath, toRelativePath } from '../workspace.js';
import { safeExtractPdf } from '../extractor/batch.js';
import { isExtractionFailure, type ExtractionResult, type ExtractionFailure } from '../extractor/types.js';
import { analyzeAndChunk } from '../chunking/chunker.js';
import type { Chunk } from '../chunking/types.js';
import { writeDocumentPage } from '../writers/document.js';
import { writeSourcePage } from '../writers/source.js';
import { writeRawPage, writeFailureRawPage } from '../writers/raw.js';
import { writeWikiIndex, writeIndexOfIndexes } from '../writers/index.js';
import { buildRunLog, writeRunLog } from '../log.js';
import { lintWiki, writeLintReport } from '../lint/index.js';
import { createLLMClient } from '../llm/client.js';
import { runIngestOrchestrator, writeIngestContracts, type StructuralProposal } from '../orchestrator/ingest.js';
import { runWikiOfWikiAgent, type WikiOfWikiSummary } from '../orchestrator/wiki-of-wiki.js';
import type { OrchestratorMemory, FolderPlan } from '../orchestrator/types.js';
import {
  extractEntities,
  entityPageTitle,
  entityFileName,
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
  loadState,
  saveState,
  fileChanged,
  detectRemovedSources,
  aggregateCounts,
  filterByThreshold,
  updateSourceState,
  statePath,
} from './state.js';

export interface IngestionResult {
  sourceFiles: number;
  sourceFilePaths: string[];
  documentPages: number;
  rawPages: number;
  entityPages: number;
  topicPages: number;
  warnings: string[];
  errors: string[];
  changed: string[];
  added: string[];
  removed: string[];
  chunkBoundaries: { source: string; boundary: string; pageRange: string }[];
  lintIssues: number;
  proposals?: StructuralProposal[];
  folderIndexes?: string[];
}

interface ProcessedSource {
  relativeFile: string;
  fileName: string;
  baseSlug: string;
  sha256: string;
  mtime: number;
  outcome: ExtractionResult | ExtractionFailure;
  chunks?: Chunk[];
  documentPageIds?: string[];
  rawPageIds?: string[];
  sourcePageId: string;
  entities: Record<string, number>;
  topics: Record<string, number>;
}

export async function runIngestion(
  workspace: string,
  slug: string,
  config: Config,
): Promise<IngestionResult> {
  const wikiDir = wikiPath(workspace, slug);
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

  const stateFile = statePath(wikiDir, config.output.dir);
  const state = loadState(stateFile);
  const rawDirPath = path.join(wikiDir, 'raw');

  const pdfFiles = readdirSync(rawDirPath)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .map((f) => path.join(rawDirPath, f))
    .sort();

  const result: IngestionResult = {
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
  };

  const llmClient = createLLMClient(workspace);
  let memory: OrchestratorMemory | undefined = state.memory;
  const allProposals: StructuralProposal[] = [];
  const allFolderPlacements: Map<string, FolderPlan> = new Map();

  result.sourceFiles = pdfFiles.length;
  result.sourceFilePaths = pdfFiles.map((f) => toRelativePath(workspace, f));

  const currentFiles: string[] = [];
  const changedFiles: string[] = [];

  for (const filePath of pdfFiles) {
    const relative = toRelativePath(workspace, filePath);
    currentFiles.push(relative);
    const sha256 = hashFile(filePath);
    if (fileChanged(state, relative, sha256, 0)) {
      changedFiles.push(filePath);
      if (state.sources[relative]) {
        result.changed.push(relative);
      } else {
        result.added.push(relative);
      }
    }
  }

  result.removed = detectRemovedSources(state, currentFiles);

  if (changedFiles.length === 0 && result.removed.length === 0) {
    // No source changes. Preserve existing output and write a run log for this invocation.
    writeIngestRunLog(workspace, slug, config, result);
    return result;
  }

  // Remove stale output from deleted PDFs.
  for (const removedFile of result.removed) {
    const sourceState = state.sources[removedFile];
    if (!sourceState) continue;
    for (const docPage of sourceState.documentPages) {
      const fullPath = path.join(wikiDir, config.output.dir, docPage);
      if (existsSync(fullPath)) rmSync(fullPath);
    }
    for (const rawPage of sourceState.rawPages) {
      const fullPath = path.join(wikiDir, config.output.dir, rawPage);
      if (existsSync(fullPath)) rmSync(fullPath);
    }
    const sourcePage = path.join(wikiDir, config.output.dir, sourceState.sourcePage);
    if (existsSync(sourcePage)) rmSync(sourcePage);
    delete state.sources[removedFile];
  }

  // Extract and chunk all changed sources in memory first.
  const processed: ProcessedSource[] = [];
  for (const filePath of changedFiles) {
    const relativeFile = toRelativePath(workspace, filePath);
    const fileName = path.basename(filePath);
    const baseSlug = path.basename(filePath, path.extname(filePath));
    const stats = statSync(filePath);
    const sha256 = hashFile(filePath);

    const outcome = await safeExtractPdf(filePath);
    if (isExtractionFailure(outcome)) {
      const failure = outcome;
      const rawPageId = `raw/${baseSlug}.md`;
      const rawPagePath = path.join(wikiDir, config.output.dir, rawPageId);
      writeFailureRawPage(rawPagePath, failure);
      result.errors.push(`Failed to extract ${fileName}: ${failure.reason}`);
      result.rawPages++;

      updateSourceState(
        state,
        relativeFile,
        sha256,
        stats.mtimeMs,
        '',
        [],
        [rawPageId],
        {},
        {},
        0,
      );
      processed.push({
        relativeFile,
        fileName,
        baseSlug,
        sha256,
        mtime: stats.mtimeMs,
        outcome: failure,
        sourcePageId: '',
        entities: {},
        topics: {},
      });
      continue;
    }

    const extractionResult = outcome;
    extractionResult.filePath = relativeFile;

    const { chunks } = analyzeAndChunk(extractionResult, config);

    for (const chunk of chunks) {
      result.chunkBoundaries.push({
        source: relativeFile,
        boundary: chunk.boundaryType,
        pageRange: chunk.pageRange,
      });
    }

    // Sprint 8: run the ingest orchestrator for this source, accumulating memory.
    const orchestratorResult = await runIngestOrchestrator(
      workspace,
      slug,
      config,
      extractionResult,
      chunks,
      llmClient,
      memory,
    );
    memory = orchestratorResult.memory;
    for (const proposal of orchestratorResult.proposals) {
      allProposals.push(proposal);
    }
    for (const folder of orchestratorResult.folderPlacements) {
      allFolderPlacements.set(folder.folder, folder);
    }
    result.warnings.push(...orchestratorResult.critic.issues.map((i) => i.message));
    const documentPageIds = chunks.map((chunk) => `documents/${chunk.id}.md`);
    const rawPageIds = extractionResult.pages
      .filter((page) => page.isScanned)
      .map((page) => `raw/${baseSlug}-page-${page.physicalPage}.md`);

    const fullText = chunks.map((c) => c.content).join('\n\n');
    const extractedEntities = extractEntities(fullText, { max: config.ingestion.max_entities });
    const extractedTopics = extractTopics(fullText, { max: config.ingestion.max_topics });

    const entities: Record<string, number> = {};
    for (const entity of extractedEntities) {
      entities[entity.name] = entity.count;
    }
    const topics: Record<string, number> = {};
    for (const topic of extractedTopics) {
      topics[topic.name] = topic.count;
    }

    updateSourceState(
      state,
      relativeFile,
      sha256,
      stats.mtimeMs,
      `sources/${baseSlug}.md`,
      documentPageIds,
      rawPageIds,
      entities,
      topics,
      chunks.length,
    );

    result.warnings.push(...extractionResult.warnings);

    processed.push({
      relativeFile,
      fileName,
      baseSlug,
      sha256,
      mtime: stats.mtimeMs,
      outcome: extractionResult,
      chunks,
      documentPageIds,
      rawPageIds,
      sourcePageId: `sources/${baseSlug}.md`,
      entities,
      topics,
    });
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

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      writeDocumentPage(
        path.join(wikiDir, config.output.dir, source.documentPageIds![i]),
        chunk,
        config,
        entityTitles,
        topicTitles,
      );
      result.documentPages++;
    }

    for (const rawPageId of source.rawPageIds || []) {
      const pageNumber = parseInt(rawPageId.match(/page-(\d+)\.md$/)?.[1] || '0', 10);
      const page = extractionResult.pages.find((p) => p.physicalPage === pageNumber);
      if (page) {
        writeRawPage(path.join(wikiDir, config.output.dir, rawPageId), extractionResult, page);
        result.rawPages++;
      }
    }

    const documentLinks = chunks.map((c) => ({ title: c.title, pageRange: c.pageRange }));
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
  for (const name of selectedEntityNames) {
    const title = entityPageTitle({ name, type: inferEntityType(name), count: 0 });
    const count = globalEntityCounts[name];
    const entity: EntityMention = { name, type: inferEntityType(name), count };
    writeEntityPage(
      path.join(entitiesDir, entityFileName(entity)),
      entity,
      config,
      entityLocations[title] || [],
    );
    result.entityPages++;
  }

  // Write topic pages.
  for (const name of selectedTopicNames) {
    const title = topicPageTitle({ name, count: 0 });
    const count = globalTopicCounts[name];
    const topic: Topic = { name, count };
    writeTopicPage(
      path.join(topicsDir, topicFileName(topic)),
      topic,
      config,
      topicLocations[title] || [],
    );
    result.topicPages++;
  }

  // Build index page information.
  const sourcePageInfos = buildSourcePageInfos(wikiDir, config.output.dir, state, processed);
  const documentPageInfos = buildDocumentPageInfos(wikiDir, config.output.dir, state, processed);
  const rawPageInfos = buildRawPageInfos(wikiDir, config.output.dir, state, processed);

  // Sprint 8: write dynamic folder hierarchy contracts and update rolling memory.
  const folderPlacements = Array.from(allFolderPlacements.values());
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
  );
  result.proposals = allProposals;

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

  state.lastRun = new Date().toISOString();
  state.memory = memory;
  saveState(stateFile, state);

  writeIngestRunLog(workspace, slug, config, result);

  return result;
}

function writeIngestRunLog(
  workspace: string,
  slug: string,
  config: Config,
  result: IngestionResult,
): void {
  const log = buildRunLog(
    'ingest',
    workspace,
    {
      wikiSlugs: [slug],
      sourceFiles: result.sourceFilePaths,
      chunkBoundaries: result.chunkBoundaries,
      pagesGenerated: [
        { type: 'document', count: result.documentPages },
        { type: 'raw', count: result.rawPages },
        { type: 'entity', count: result.entityPages },
        { type: 'topic', count: result.topicPages },
      ],
      warnings: result.warnings,
      errors: result.errors,
      status: result.errors.length === 0 ? 'success' : 'partial',
      cliVersion: '0.0.1',
      configVersions: { [slug]: config.wiki.version },
      lintIssues: result.lintIssues,
    },
  );
  writeRunLog(workspace, log);
}

function hashFile(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function createEmptyMemory(): OrchestratorMemory {
  return {
    rollingSummary: 'No memory accumulated yet.',
    state: {
      document: { title: '', totalPages: 0, currentChunk: 0, boundaryType: 'page' },
      entities: {},
      topics: {},
      relationships: [],
      sources: {},
      folderHierarchy: {},
      rawFragments: [],
    },
  };
}

function inferEntityType(name: string): EntityMention['type'] {
  const suffixes = ['Inc', 'LLC', 'Corp', 'Ltd', 'Company', 'Co', 'Group'];
  if (suffixes.some((s) => name.toLowerCase().endsWith(s.toLowerCase()))) return 'organization';
  if (/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(name)) return 'person';
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
