import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';

import type { Config } from '../config.js';
import { wikiPath, toRelativePathFromDir } from '../workspace.js';
import { buildRunLog, writeRunLog } from '../log.js';
import type { FolderPlan, PagePlan, StructuralProposal } from '../orchestrator/types.js';
import { writeFolderIndexContract, writeWikiIndexContract, type WikiIndexData } from '../orchestrator/contracts.js';
import { updateAgentsMdForNewPageTypes } from '../orchestrator/proposals.js';
import { runWikiOfWikiAgent, type WikiOfWikiSummary } from '../orchestrator/wiki-of-wiki.js';
import { writeIndexOfIndexes } from '../writers/index.js';
import { lintWiki, writeLintReport } from '../lint/index.js';
import {
  loadState,
  saveState,
  statePath,
  hashPageContent,
  refreshPageState,
  type IngestionState,
  type PageState,
} from './state.js';

export interface ReingestResult {
  affectedPages: string[];
  skippedPages: string[];
  manualEditWarnings: string[];
  pagesMoved: string[];
  pagesDeleted: string[];
  updated: string[];
}

/**
 * Run selective re-ingestion after a structural change has been applied and logged.
 *
 * The implementation is deterministic: it compares the current page states against the
 * applied folder hierarchy, moves pages whose page type now belongs in a different folder,
 * and deletes pages whose page type has been removed. Manually edited pages are always
 * skipped and reported so human edits are never disturbed. It does not re-extract
 * unchanged PDFs.
 */
export async function runReingest(
  workspace: string,
  slug: string,
  config: Config,
  newFolderHierarchy?: Record<string, FolderPlan>,
): Promise<ReingestResult> {
  const wikiDir = wikiPath(workspace, slug);
  const stateFile = statePath(wikiDir);
  const state = loadState(stateFile);
  const outputDir = wikiDir;

  const hierarchy = newFolderHierarchy || state.memory?.state.folderHierarchy || {};

  const result: ReingestResult = {
    affectedPages: [],
    skippedPages: [],
    manualEditWarnings: [],
    pagesMoved: [],
    pagesDeleted: [],
    updated: [],
  };

  if (Object.keys(hierarchy).length === 0) {
    return result;
  }

  if (!state.pages || Object.keys(state.pages).length === 0) {
    // No prior ingestion state: just refresh contracts and AGENTS.md for the new hierarchy.
    updateContractsAndAgents(workspace, slug, config, state, hierarchy, outputDir, result);
    saveState(stateFile, state);
    writeReingestRunLog(workspace, slug, config, result);
    return result;
  }

  const plan = buildReingestPlan(state, hierarchy, outputDir);
  result.affectedPages = Array.from(plan.affectedPages);
  result.manualEditWarnings = plan.manualEditWarnings;
  result.skippedPages = Array.from(plan.pagesToSkip);

  if (plan.affectedPages.size === 0) {
    updateContractsAndAgents(workspace, slug, config, state, hierarchy, outputDir, result);
    saveState(stateFile, state);
    writeReingestRunLog(workspace, slug, config, result);
    return result;
  }

  // Move/delete affected pages and update source state to reflect new paths.
  const pageTypeToFolder = buildTypeToFolderMap(hierarchy);
  const folderTitles = new Map<string, string>();
  for (const folder of Object.values(hierarchy)) {
    folderTitles.set(folder.folder, folder.title);
  }

  for (const pagePath of plan.affectedPages) {
    if (plan.pagesToSkip.has(pagePath)) {
      continue;
    }

    const pageState = state.pages![pagePath];
    if (!pageState) continue;

    const fullPath = path.join(outputDir, pagePath);
    if (!existsSync(fullPath)) {
      delete state.pages![pagePath];
      continue;
    }

    const allowedFolder = pageTypeToFolder.get(pageState.pageType);
    if (!allowedFolder) {
      // Page type removed: delete the page.
      rmSync(fullPath);
      delete state.pages![pagePath];
      removePageFromSource(state, pagePath);
      result.pagesDeleted.push(pagePath);
      continue;
    }

    if (allowedFolder !== pageState.folder) {
      // Skip moves for manually edited pages so human edits are not disturbed.
      const currentContent = readFileSync(fullPath, 'utf-8');
      const currentHash = hashPageContent(currentContent);
      const hasManualEdits = pageState.generatedHash && pageState.generatedHash !== currentHash;
      if (hasManualEdits) {
        const warning = `Page "${pagePath}" has manual edits and will not be moved by re-ingestion.`;
        result.manualEditWarnings.push(warning);
        result.skippedPages.push(pagePath);
        continue;
      }

      // Page type now belongs in a different folder: move the page without rewriting content.
      const fileName = path.basename(pagePath);
      const targetPath = path.join(outputDir, allowedFolder, fileName);
      mkdirSync(path.dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, readFileSync(fullPath));
      rmSync(fullPath);
      const targetRelative = toRelativePathFromDir(outputDir, targetPath);
      updatePagePathInSource(state, pagePath, targetRelative);
      state.pages![targetRelative] = {
        ...pageState,
        folder: allowedFolder,
        updatedAt: new Date().toISOString(),
      };
      delete state.pages![pagePath];
      result.pagesMoved.push(`${pagePath} -> ${targetRelative}`);
      continue;
    }

    // Page type still in the same folder but marked affected (e.g. a page type rename).
    // Do not rewrite frontmatter deterministically; defer content updates to the LLM.
  }

  // Remove empty folders that may have been left behind after moving pages.
  cleanupEmptyFolders(outputDir, Object.keys(hierarchy));

  updateContractsAndAgents(workspace, slug, config, state, hierarchy, outputDir, result);

  refreshPageState(state, wikiDir);
  saveState(stateFile, state);
  writeReingestRunLog(workspace, slug, config, result);

  return result;
}

export interface ReingestPlan {
  affectedPages: Set<string>;
  pagesToSkip: Set<string>;
  manualEditWarnings: string[];
}

export function buildReingestPlan(
  state: IngestionState,
  hierarchy: Record<string, FolderPlan>,
  outputDir: string,
): ReingestPlan {
  const affectedPages = new Set<string>();
  const pagesToSkip = new Set<string>();
  const manualEditWarnings: string[] = [];

  const typeToFolder = buildTypeToFolderMap(hierarchy);

  for (const [pagePath, pageState] of Object.entries(state.pages || {})) {
    const fullPath = path.join(outputDir, pagePath);
    if (!existsSync(fullPath)) {
      affectedPages.add(pagePath);
      continue;
    }

    const folderPlan = hierarchy[pageState.folder];
    const folderRemoved = !folderPlan;
    const typeRemoved = !typeToFolder.has(pageState.pageType);
    const typeMoved = folderPlan && !folderPlan.pageTypes.includes(pageState.pageType);

    if (folderRemoved || typeRemoved || typeMoved) {
      affectedPages.add(pagePath);

      const currentContent = readFileSync(fullPath, 'utf-8');
      const currentHash = hashPageContent(currentContent);
      const hasManualEdits = pageState.generatedHash && pageState.generatedHash !== currentHash;

      if (hasManualEdits) {
        const warning = `Page "${pagePath}" has manual edits and will be skipped by re-ingestion.`;
        manualEditWarnings.push(warning);
        pagesToSkip.add(pagePath);
      }
    }
  }

  return { affectedPages, pagesToSkip, manualEditWarnings };
}

function buildTypeToFolderMap(hierarchy: Record<string, FolderPlan>): Map<string, string> {
  const map = new Map<string, string>();
  for (const folder of Object.values(hierarchy)) {
    for (const pageType of folder.pageTypes) {
      if (!map.has(pageType)) {
        map.set(pageType, folder.folder);
      }
    }
  }
  return map;
}

function removePageFromSource(state: IngestionState, pagePath: string): void {
  for (const sourceState of Object.values(state.sources)) {
    sourceState.documentPages = sourceState.documentPages.filter((p) => p !== pagePath);
    sourceState.rawPages = sourceState.rawPages.filter((p) => p !== pagePath);
  }
}

function updatePagePathInSource(state: IngestionState, oldPath: string, newPath: string): void {
  for (const sourceState of Object.values(state.sources)) {
    const docIndex = sourceState.documentPages.indexOf(oldPath);
    if (docIndex !== -1) {
      sourceState.documentPages[docIndex] = newPath;
    }
    const rawIndex = sourceState.rawPages.indexOf(oldPath);
    if (rawIndex !== -1) {
      sourceState.rawPages[rawIndex] = newPath;
    }
    if (sourceState.sourcePage === oldPath) {
      sourceState.sourcePage = newPath;
    }
  }
}

function cleanupEmptyFolders(outputDir: string, protectedFolders: string[]): void {
  if (!existsSync(outputDir)) return;
  const defaultProtected = new Set(['documents', 'sources', 'entities', 'topics', 'raw', '.state', 'lint', ...protectedFolders]);
  const entries = readdirSync(outputDir);
  for (const entry of entries) {
    const full = path.join(outputDir, entry);
    const stat = statSync(full);
    if (!stat.isDirectory()) continue;
    if (defaultProtected.has(entry)) {
      continue;
    }
    const files = readdirSync(full);
    if (files.length === 0) {
      rmSync(full);
    }
  }
}

function updateContractsAndAgents(
  workspace: string,
  slug: string,
  config: Config,
  state: IngestionState,
  hierarchy: Record<string, FolderPlan>,
  outputDir: string,
  _result: ReingestResult,
): void {
  const wikiDir = path.join(workspace, 'wikis', slug);
  const wikiIndexPath = path.join(wikiDir, 'index.md');
  const folders = Object.values(hierarchy);
  const folderPages = collectFolderPages(outputDir, folders.map((f) => f.folder));

  const entitySubFolders = state.memory?.state.entityTaxonomy.subFolders ?? [];
  const entityFolderPlan = folders.find((f) => f.folder === 'entities');
  if (entityFolderPlan) {
    entityFolderPlan.children = entitySubFolders.map((s) => s.slug);
  }
  if (entityFolderPlan) {
    folderPages['entities'] = entitySubFolders.map((s) => `${s.slug}/index.md`);
  }
  for (const sub of entitySubFolders) {
    const fullDir = path.join(outputDir, 'entities', sub.slug);
    if (existsSync(fullDir)) {
      folderPages[`entities/${sub.slug}`] = readdirSync(fullDir)
        .filter((f) => f.endsWith('.md') && f !== 'index.md')
        .sort();
    }
  }

  const sourceCount = countPagesInFolder(outputDir, 'sources');
  const documentCount = countPagesInFolder(outputDir, 'documents');
  const rawCount = countPagesInFolder(outputDir, 'raw');
  const entityCount = countPagesInFolder(outputDir, 'entities');
  const topicCount = countPagesInFolder(outputDir, 'topics');

  const indexData: WikiIndexData = {
    slug,
    title: config.wiki.title,
    description: config.wiki.description,
    scope: state.memory?.rollingSummary || '',
    sourceCount,
    documentCount,
    entityCount,
    topicCount,
    rawCount,
    folders,
    warnings: [],
  };

  for (const folder of folders) {
    const folderIndexPath = path.join(wikiDir, folder.folder, 'index.md');
    mkdirSync(path.dirname(folderIndexPath), { recursive: true });
    writeFolderIndexContract(
      folderIndexPath,
      folder,
      indexData,
      state.memory || {
        rollingSummary: '',
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
      },
      folderPages,
    );
  }

  // Write entity sub-folder indexes as DOX child contracts.
  for (const sub of entitySubFolders) {
    const subFolderPlan: FolderPlan = {
      folder: `entities/${sub.slug}`,
      title: sub.title,
      description: sub.description,
      pageTypes: ['entity'],
      children: [],
    };
    const subIndexPath = path.join(wikiDir, 'entities', sub.slug, 'index.md');
    mkdirSync(path.dirname(subIndexPath), { recursive: true });
    writeFolderIndexContract(
      subIndexPath,
      subFolderPlan,
      indexData,
      state.memory || {
        rollingSummary: '',
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
      },
      folderPages,
    );
  }

  // Update wiki-level index to reflect the new folder list.
  writeWikiIndexContract(wikiIndexPath, indexData, config);

  // Update AGENTS.md to document any new folders and their page types.
  const agentsMdPath = path.join(wikiDir, 'AGENTS.md');
  const previousHierarchy = state.memory?.state.folderHierarchy || {};
  for (const folder of folders) {
    if (!previousHierarchy[folder.folder]) {
      updateAgentsMdForNewPageTypes(agentsMdPath, folder.folder, folder.pageTypes);
    }
  }

  // Update memory with the new approved hierarchy so subsequent ingests use it.
  if (state.memory) {
    state.memory.state.folderHierarchy = { ...hierarchy };
  }

  // Refresh top-level index-of-indexes.
  const wikiSlugs = discoverWikisForIndex(workspace);
  const wikiSummaries = wikiSlugs.map((s) => summarizeWiki(workspace, s));
  const wikiOfWikiResult = runWikiOfWikiAgent(workspace, wikiSummaries);
  writeIndexOfIndexes(workspace, wikiOfWikiResult.wikis, wikiOfWikiResult.crossWikiNames);

  const lintResult = lintWiki(workspace, slug, config);
  writeLintReport(workspace, slug, config, lintResult);
}

function collectFolderPages(outputDir: string, folders: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const folder of folders) {
    const fullDir = path.join(outputDir, folder);
    if (!existsSync(fullDir)) continue;
    const entries = readdirSync(fullDir)
      .filter((f) => f.endsWith('.md') && f !== 'index.md')
      .sort();
    result[folder] = entries;
  }
  return result;
}

function countPagesInFolder(outputDir: string, folder: string): number {
  const fullDir = path.join(outputDir, folder);
  if (!existsSync(fullDir)) return 0;
  let count = 0;
  for (const entry of readdirSync(fullDir)) {
    const entryPath = path.join(fullDir, entry);
    if (statSync(entryPath).isDirectory()) {
      count += countPagesInFolder(outputDir, path.join(folder, entry));
    } else if (entry.endsWith('.md') && entry !== 'index.md') {
      count++;
    }
  }
  return count;
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

function summarizeWiki(workspace: string, slug: string): WikiOfWikiSummary {
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
      // ignore
    }
  }

  const rawDir = path.join(wikiDir, 'raw');
  const sourceCount = existsSync(rawDir)
    ? readdirSync(rawDir).filter((f) => f.toLowerCase().endsWith('.pdf')).length
    : 0;

  const counts: Record<string, number> = {};
  for (const folder of ['documents', 'entities', 'topics', 'raw']) {
    counts[folder] = countPagesInFolder(wikiDir, folder);
  }

  return {
    slug,
    title,
    description,
    sourceCount,
    documentCount: counts.documents,
    entityCount: counts.entities,
    topicCount: counts.topics,
    rawCount: counts.raw,
  };
}

function writeReingestRunLog(
  workspace: string,
  slug: string,
  _config: Config,
  result: ReingestResult,
): void {
  const warnings: string[] = [];
  if (result.manualEditWarnings.length > 0) {
    warnings.push(...result.manualEditWarnings);
  }
  if (result.pagesMoved.length > 0) {
    warnings.push(`Moved pages: ${result.pagesMoved.join(', ')}`);
  }
  if (result.pagesDeleted.length > 0) {
    warnings.push(`Deleted pages: ${result.pagesDeleted.join(', ')}`);
  }
  if (result.skippedPages.length > 0) {
    warnings.push(`Skipped pages with manual edits: ${result.skippedPages.join(', ')}`);
  }
  const log = buildRunLog('reingest', workspace, {
    wikiSlugs: [slug],
    warnings,
    status: result.manualEditWarnings.length > 0 ? 'partial' : 'success',
  });
  writeRunLog(workspace, log);
}

export function applyReingestFromProposal(
  workspace: string,
  slug: string,
  config: Config,
  proposal: StructuralProposal,
): Promise<ReingestResult> {
  const hierarchy = folderHierarchyFromProposal(workspace, slug, config, proposal);
  return runReingest(workspace, slug, config, hierarchy);
}

function folderHierarchyFromProposal(
  workspace: string,
  slug: string,
  config: Config,
  proposal: StructuralProposal,
): Record<string, FolderPlan> {
  const wikiDir = path.join(workspace, 'wikis', slug);
  const stateFile = statePath(wikiDir);
  const state = loadState(stateFile);
  const existing = state.memory?.state.folderHierarchy || {};
  const merged: Record<string, FolderPlan> = { ...existing };
  for (const folder of proposal.newFolderPlans) {
    merged[folder.folder] = folder;
  }
  return merged;
}

export { statePath };
