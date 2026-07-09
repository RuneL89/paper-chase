import { readdirSync, statSync, existsSync, readFileSync, rmSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import type { Config } from '../config.js';
import { wikiPath, toRelativePath } from '../workspace.js';
import { safeExtractPdf } from '../extractor/batch.js';
import { isExtractionFailure, type ExtractionResult, type ExtractionFailure } from '../extractor/types.js';
import { analyzeAndChunk } from '../chunking/chunker.js';
import { buildRunLog, writeRunLog } from '../log.js';
import { createLLMClient } from '../llm/client.js';
import { runIngestOrchestrator, writeIngestOutput } from '../orchestrator/ingest.js';
import {
  writeProposalFile,
  detectNewPageTypes,
  updateFolderIndexForNewPageTypes,
  updateAgentsMdForNewPageTypes,
} from '../orchestrator/proposals.js';
import {
  loadState,
  saveState,
  fileChanged,
  detectRemovedSources,
  updateSourceState,
  statePath,
  refreshPageState,
} from './state.js';
import { appendLogEntry, type LogEntry } from '../writers/log.js';
import { runReingest } from './reingest.js';
import {
  chunkStatePath,
  runManifestPath,
  loadRunManifest,
  writeRunManifest,
  buildChunkStates,
  initializeRunManifest,
  updateChunkStatus,
  getSourceChunkStates,
} from './resume.js';
import type { IngestionResult, ProcessedSource } from './types.js';

export async function runIngestion(
  workspace: string,
  slug: string,
  config: Config,
  resume = false,
  autoApproveProposals = false,
): Promise<IngestionResult> {
  const wikiDir = wikiPath(workspace, slug);
  const stateFile = statePath(wikiDir, config.output.dir);
  const manifestFile = runManifestPath(wikiDir, config.output.dir);
  let manifest = loadRunManifest(manifestFile);
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
  let memory = state.memory;
  const allProposals: import('../orchestrator/types.js').StructuralProposal[] = [];
  const allFolderPlacements: Map<string, import('../orchestrator/types.js').FolderPlan> = new Map();
  const allPages: import('../orchestrator/types.js').PagePlan[] = [];
  const originalFolderHierarchy = { ...(state.memory?.state.folderHierarchy ?? {}) };
  const removedSourceStates: Record<string, import('./state.js').SourceState> = {};

  result.sourceFiles = pdfFiles.length;
  result.sourceFilePaths = pdfFiles.map((f) => toRelativePath(workspace, f));

  const currentFiles: string[] = [];
  const changedFiles: string[] = [];

  for (const filePath of pdfFiles) {
    const relative = toRelativePath(workspace, filePath);
    currentFiles.push(relative);
    const sha256 = hashFile(filePath);
    const changed = fileChanged(state, relative, sha256, 0);
    const baseSlug = path.basename(filePath, path.extname(filePath));

    let shouldProcess = changed;
    if (resume && !shouldProcess) {
      const existingStates = getSourceChunkStates(manifest, baseSlug);
      shouldProcess = existingStates.length === 0 || existingStates.some((s) => s.status !== 'completed');
    }

    if (changed) {
      if (state.sources[relative]) {
        result.changed.push(relative);
      } else {
        result.added.push(relative);
      }
    }

    if (shouldProcess) {
      changedFiles.push(filePath);
    }
  }

  result.removed = detectRemovedSources(state, currentFiles);

  if (changedFiles.length === 0 && result.removed.length === 0) {
    writeIngestRunLog(workspace, slug, config, result, []);
    return result;
  }

  // Remove stale output from deleted PDFs.
  for (const removedFile of result.removed) {
    const sourceState = state.sources[removedFile];
    if (sourceState) {
      removedSourceStates[removedFile] = { ...sourceState };
    }
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

    const outcome = await safeExtractPdf(filePath, undefined, slug);
    if (isExtractionFailure(outcome)) {
      const failure = outcome;
      const rawPageId = `raw/${baseSlug}.md`;
      const rawPagePath = path.join(wikiDir, config.output.dir, rawPageId);
      const { writeFailureRawPage } = await import('../writers/raw.js');
      writeFailureRawPage(rawPagePath, failure, config.wiki.slug);
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

    const { chunks, strategy } = analyzeAndChunk(extractionResult, config);
    const documentPageIds = chunks.map((chunk) => `documents/${chunk.id}.md`);
    const chunkStates = buildChunkStates(baseSlug, chunks, documentPageIds);
    manifest = initializeRunManifest(manifest, chunkStates);

    for (const chunk of chunks) {
      const statePath = chunkStatePath(wikiDir, config.output.dir, baseSlug, chunk.id);
      updateChunkStatus(manifest, statePath, baseSlug, chunk.id, 'processing');
    }

    for (const chunk of chunks) {
      result.chunkBoundaries.push({
        source: relativeFile,
        boundary: chunk.boundaryType,
        pageRange: chunk.pageRange,
      });
    }

    // Run the ingest orchestrator for this source, accumulating memory.
    const orchestratorResult = await runIngestOrchestrator(
      workspace,
      slug,
      config,
      extractionResult,
      chunks,
      llmClient,
      memory,
      strategy.samplingStrategy,
      { autoApproveProposals },
    );
    memory = orchestratorResult.memory;
    for (const proposal of orchestratorResult.proposals) {
      allProposals.push(proposal);
    }
    for (const folder of orchestratorResult.folderPlacements) {
      allFolderPlacements.set(folder.folder, folder);
    }
    allPages.push(...orchestratorResult.pages);
    result.warnings.push(...orchestratorResult.critic.issues.map((i) => i.message));
    const rawPageIds = extractionResult.pages
      .filter((page) => page.isScanned)
      .map((page) => `raw/${baseSlug}-page-${page.physicalPage}.md`);

    for (const chunk of chunks) {
      const statePath = chunkStatePath(wikiDir, config.output.dir, baseSlug, chunk.id);
      const pagePath = `documents/${chunk.id}.md`;
      const hasUpdate = orchestratorResult.pageUpdates?.some((u) => u.filePath === pagePath);
      updateChunkStatus(
        manifest,
        statePath,
        baseSlug,
        chunk.id,
        hasUpdate ? 'completed' : 'failed',
      );
    }
    writeRunManifest(manifestFile, manifest);

    const entities: Record<string, number> = {};
    const entityTypes: Record<string, import('../entities/index.js').EntityMention['type']> = {};
    for (const entity of orchestratorResult.extractedEntities) {
      const canonicalEntity = memory.state.entities[entity.canonical];
      const displayName = canonicalEntity?.name ?? entity.name;
      entities[displayName] = (entities[displayName] ?? 0) + entity.count;
      // Resolve type conflicts by keeping the most-frequent type for this source.
      const currentType = entityTypes[displayName];
      if (!currentType) {
        entityTypes[displayName] = entity.type as import('../entities/index.js').EntityMention['type'];
      }
    }
    const topics: Record<string, number> = {};
    for (const topic of orchestratorResult.extractedTopics) {
      // Ensure planned topic pages are materialized even when the concept only
      // appears in one source or chunk.
      topics[topic.name] = Math.max(topic.count, config.ingestion.topic_threshold);
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
      entityTypes,
      topics,
      pageUpdates: orchestratorResult.pageUpdates,
    });
  }

  // Delegate all markdown content generation and contract/index writing to the orchestrator.
  const folderPlacements = Array.from(allFolderPlacements.values());
  await writeIngestOutput({
    workspace,
    slug,
    config,
    processed,
    state,
    memory,
    folderPlacements,
    result,
  });
  result.proposals = allProposals;

  // Persist per-page metadata so selective re-ingestion can compare against the
  // last generated version and detect manual edits.
  refreshPageState(state, wikiDir, config.output.dir);

  // Dual documentation: new page types inside existing folders are auto-approved,
  // but must be documented in both the folder-level index.md and the wiki AGENTS.md.
  const newPageTypes = detectNewPageTypes(originalFolderHierarchy, allPages);
  const agentsMdPath = path.join(wikiDir, 'AGENTS.md');
  for (const [folder, types] of newPageTypes) {
    updateAgentsMdForNewPageTypes(agentsMdPath, folder, Array.from(types));
  }

  state.lastRun = new Date().toISOString();
  state.memory = memory;
  saveState(stateFile, state);
  writeRunManifest(manifestFile, manifest);

  // Append the append-only audit record for this ingestion run.
  const logEntry = buildIngestLogEntry(
    workspace,
    slug,
    config,
    result,
    processed,
    allProposals,
    removedSourceStates,
  );
  appendLogEntry(wikiDir, config.output.dir, logEntry);

  // If a structural proposal was approved during this run, align existing pages with
  // the new hierarchy without re-extracting unchanged PDFs.
  if (memory && allProposals.some((p) => p.applied)) {
    await runReingest(workspace, slug, config, memory.state.folderHierarchy);
  }

  writeIngestRunLog(workspace, slug, config, result, llmClient.getRecords());

  return result;
}

function buildIngestLogEntry(
  workspace: string,
  slug: string,
  config: Config,
  result: IngestionResult,
  processed: ProcessedSource[],
  proposals: import('../orchestrator/types.js').StructuralProposal[],
  removedSourceStates: Record<string, import('./state.js').SourceState>,
): LogEntry {
  const wikiDir = wikiPath(workspace, slug);
  const rawDir = path.join(wikiDir, 'raw');

  const sourceStatuses = new Map<string, 'added' | 'changed' | 'removed' | 'unchanged'>();
  for (const added of result.added) sourceStatuses.set(added, 'added');
  for (const changed of result.changed) sourceStatuses.set(changed, 'changed');
  for (const removed of result.removed) sourceStatuses.set(removed, 'removed');

  const sources: LogEntry['sources'] = [];
  for (const filePath of processed) {
    const relative = filePath.relativeFile;
    const status = sourceStatuses.get(relative) ?? 'changed';
    sources.push({ filePath: relative, sha256: filePath.sha256, status });
  }
  for (const removed of result.removed) {
    if (!processed.some((p) => p.relativeFile === removed)) {
      sources.push({ filePath: removed, status: 'removed' });
    }
  }

  const pages: LogEntry['pages'] = [];
  for (const source of processed) {
    const status = sourceStatuses.get(source.relativeFile) ?? 'changed';
    const action: LogEntryPage['action'] = status === 'added' ? 'created' : 'updated';
    for (const docPage of source.documentPageIds ?? []) {
      pages.push({ filePath: docPage, action });
    }
    for (const rawPage of source.rawPageIds ?? []) {
      pages.push({ filePath: rawPage, action });
    }
    if (source.sourcePageId) {
      pages.push({ filePath: source.sourcePageId, action });
    }
  }
  for (const removed of result.removed) {
    const sourceState = removedSourceStates[removed];
    if (!sourceState) continue;
    for (const docPage of sourceState.documentPages) {
      pages.push({ filePath: docPage, action: 'deleted' });
    }
    for (const rawPage of sourceState.rawPages) {
      pages.push({ filePath: rawPage, action: 'deleted' });
    }
    pages.push({ filePath: sourceState.sourcePage, action: 'deleted' });
  }

  const structuralChanges = proposals.length > 0
    ? proposals.map((p) => `${p.type}: ${p.reason} (${p.applied ? 'applied' : 'proposed'})`)
    : undefined;

  return {
    timestamp: new Date().toISOString(),
    command: 'ingest',
    sources,
    pages,
    structuralChanges,
    errors: result.errors,
    warnings: result.warnings,
    quarantined: [],
  };
}

/** Single page entry for the append-only log. */
interface LogEntryPage {
  filePath: string;
  action: 'created' | 'updated' | 'deleted' | 'moved';
  from?: string;
}

function writeIngestRunLog(
  workspace: string,
  slug: string,
  config: Config,
  result: IngestionResult,
  llmCalls: import('../llm/types.js').LLMCallRecord[],
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
      lintIssues: result.lintIssues,
      llmCalls,
    },
  );
  writeRunLog(workspace, log);
}

function hashFile(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}
