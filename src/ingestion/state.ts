import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

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
}

export const STATE_VERSION = '1.0';

export function defaultState(): IngestionState {
  return {
    version: STATE_VERSION,
    lastRun: new Date().toISOString(),
    sources: {},
  };
}

export function statePath(wikiDir: string, outputDir: string): string {
  return path.join(wikiDir, outputDir, '.state', 'ingest-state.json');
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
    };
  } catch {
    return defaultState();
  }
}

export function saveState(stateFile: string, state: IngestionState): void {
  mkdirSync(path.dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');
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
