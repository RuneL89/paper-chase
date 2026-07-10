import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import matter from 'gray-matter';
import { toRelativePathFromDir } from '../workspace.js';

import type { OrchestratorMemory } from '../orchestrator/types.js';

export interface PageState {
  folder: string;
  pageType: string;
  generatedHash: string;
  updatedAt: string;
}

export interface SourceState {
  sha256: string;
  mtime: number;
  sourcePage: string;
  documentPages: string[];
  rawPages: string[];
  entities: Record<string, number>;
  topics: Record<string, number>;
  chunkCount: number;
}

export interface IngestionState {
  version: string;
  lastRun: string;
  sources: Record<string, SourceState>;
  memory?: OrchestratorMemory;
  pages?: Record<string, PageState>;
}

export const STATE_VERSION = '1.1';

export function defaultState(): IngestionState {
  return {
    version: STATE_VERSION,
    lastRun: new Date().toISOString(),
    sources: {},
    pages: {},
  };
}

export function statePath(wikiDir: string, _outputDir?: string): string {
  return path.join(wikiDir, 'output', '.state', 'ingest-state.json');
}

export function loadState(stateFile: string): IngestionState {
  if (!existsSync(stateFile)) {
    return defaultState();
  }
  try {
    const parsed = JSON.parse(readFileSync(stateFile, 'utf-8')) as IngestionState;
    return {
      ...defaultState(),
      ...parsed,
      sources: parsed.sources ?? {},
      pages: parsed.pages ?? {},
    };
  } catch {
    return defaultState();
  }
}

export function saveState(stateFile: string, state: IngestionState): void {
  mkdirSync(path.dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');
}

export function hashFile(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

export function hashPageContent(content: string): string {
  const parsed = matter(content);
  const normalized = { ...parsed.data };
  delete normalized.updated;
  return createHash('sha256')
    .update(matter.stringify(parsed.content, normalized))
    .digest('hex');
}

export function refreshPageState(
  state: IngestionState,
  wikiDir: string,
  outputDirName: string,
): void {
  const outputDir = path.join(wikiDir, outputDirName);
  if (!existsSync(outputDir)) {
    return;
  }

  const pages: Record<string, PageState> = { ...state.pages };

  function walk(dir: string): void {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = path.join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (entry.endsWith('.md')) {
        const relative = toRelativePathFromDir(outputDir, full);
        if (relative === 'index.md' || relative.endsWith('/index.md')) {
          continue;
        }
        try {
          const content = readFileSync(full, 'utf-8');
          const parsed = matter(content);
          const folder = relative.includes('/') ? path.dirname(relative).replace(/\\/g, '/') : '';
          pages[relative] = {
            folder,
            pageType: String(parsed.data.type || 'document'),
            generatedHash: hashPageContent(content),
            updatedAt: new Date().toISOString(),
          };
        } catch {
          // Skip malformed files.
        }
      }
    }
  }

  walk(outputDir);
  state.pages = pages;
}

export function fileChanged(
  state: IngestionState,
  filePath: string,
  sha256: string,
  _mtime: number,
): boolean {
  const entry = state.sources[filePath];
  if (!entry) return true;
  return entry.sha256 !== sha256;
}

export function detectRemovedSources(
  state: IngestionState,
  currentFiles: string[],
): string[] {
  const currentSet = new Set(currentFiles);
  return Object.keys(state.sources).filter((filePath) => !currentSet.has(filePath));
}

export function updateSourceState(
  state: IngestionState,
  filePath: string,
  sha256: string,
  mtime: number,
  sourcePage: string,
  documentPages: string[],
  rawPages: string[],
  entities: Record<string, number>,
  topics: Record<string, number>,
  chunkCount: number,
): void {
  state.sources[filePath] = {
    sha256,
    mtime,
    sourcePage,
    documentPages,
    rawPages,
    entities,
    topics,
    chunkCount,
  };
}

export function aggregateCounts(
  sources: Record<string, SourceState>,
): { entities: Record<string, number>; topics: Record<string, number> } {
  const entities: Record<string, number> = {};
  const topics: Record<string, number> = {};

  for (const source of Object.values(sources)) {
    for (const [name, count] of Object.entries(source.entities)) {
      entities[name] = (entities[name] ?? 0) + count;
    }
    for (const [name, count] of Object.entries(source.topics)) {
      topics[name] = (topics[name] ?? 0) + count;
    }
  }

  return { entities, topics };
}

export function filterByThreshold(
  counts: Record<string, number>,
  threshold: number,
  maxItems: number,
): string[] {
  const entries = Object.entries(counts)
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries.slice(0, maxItems).map(([name]) => name);
}

export function findSourceForPage(
  state: IngestionState,
  pagePath: string,
): { sourcePath: string; sourceState: SourceState } | undefined {
  for (const [sourcePath, sourceState] of Object.entries(state.sources)) {
    if (sourceState.documentPages.includes(pagePath)) {
      return { sourcePath, sourceState };
    }
    if (sourceState.rawPages.includes(pagePath)) {
      return { sourcePath, sourceState };
    }
    if (sourceState.sourcePage === pagePath) {
      return { sourcePath, sourceState };
    }
  }
  return undefined;
}
