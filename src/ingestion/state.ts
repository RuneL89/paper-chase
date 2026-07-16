import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import matter from 'gray-matter';
import { toRelativePathFromDir } from '../workspace.js';

import type { OrchestratorMemory } from '../orchestrator/types.js';
import type { ExtractedRelationship } from '../orchestrator/types.js';
import type { Chunk } from '../chunking/types.js';
import type { ExtractionResult } from '../extractor/types.js';

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

export function statePath(wikiDir: string): string {
  return path.join(wikiDir, '.state', 'ingest-state.json');
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

export function verifyPreservation(oldBody: string, newBody: string): boolean {
  const oldCitations = new Set(oldBody.match(/\[\^src\d+\]/g) ?? []);
  const newCitations = new Set(newBody.match(/\[\^src\d+\]/g) ?? []);
  for (const c of oldCitations) {
    if (!newCitations.has(c)) return false;
  }
  const oldLinks = new Set(oldBody.match(/\[\[[^\]]+\]\]/g) ?? []);
  const newLinks = new Set(newBody.match(/\[\[[^\]]+\]\]/g) ?? []);
  for (const l of oldLinks) {
    if (!newLinks.has(l)) return false;
  }
  return true;
}

export function isPageManuallyEdited(relativePath: string, content: string, state: IngestionState): boolean {
  const stored = state.pages?.[relativePath];
  if (!stored) return false;
  const currentHash = hashPageContent(content);
  return stored.generatedHash !== currentHash;
}

export function buildMergedSources(
  existing: { frontmatter: Record<string, unknown> } | undefined,
  source: ExtractionResult,
  chunk: Chunk,
): { id: string; file: string; pages: string; extracted: string }[] {
  const sources: { id: string; file: string; pages: string; extracted: string }[] = [];
  const existingSources = Array.isArray(existing?.frontmatter.sources)
    ? (existing?.frontmatter.sources as { id: string; file: string; pages: string; extracted: string }[])
    : [];
  for (const s of existingSources) {
    if (s.id && s.file) {
      sources.push(s);
    }
  }

  const maxIndex = sources.reduce((max, s) => {
    const match = s.id.match(/^src(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);

  sources.push({
    id: `src${maxIndex + 1}`,
    file: source.filePath,
    pages: chunk.pageRange,
    extracted: new Date().toISOString(),
  });

  return sources;
}

export function normalizeRelationshipsForEntity(
  entityName: string,
  relationships?: { predicate: string; object: string; evidence: string; pages: string }[],
): ExtractedRelationship[] {
  return (relationships ?? []).map((r) => ({
    subject: entityName,
    predicate: r.predicate,
    object: r.object,
    evidence: r.evidence,
    pages: r.pages,
  }));
}

/**
 * Refresh per-page state after a run.
 *
 * Preservation-first semantics: the stored `generatedHash` is the baseline for
 * manual-edit detection, so it may only be re-baselined for pages the system
 * actually wrote in this run (`writtenPaths`). A page whose on-disk content
 * differs from its stored hash and that was NOT written this run is a manual
 * edit; its old baseline is preserved so the conflict keeps being detected and
 * reported on every subsequent run instead of being silently absorbed.
 *
 * Root-level files (index.md, AGENTS.md, chunking-strategy.md) are never
 * tracked: they are contracts/guides maintained by the system, not content
 * pages, and tracking them would make re-ingestion treat them as misplaced
 * content (moving or deleting them).
 */
export function refreshPageState(
  state: IngestionState,
  wikiDir: string,
  writtenPaths?: Set<string>,
): void {
  if (!existsSync(wikiDir)) {
    return;
  }

  const previous = state.pages ?? {};
  const pages: Record<string, PageState> = {};

  function walk(dir: string): void {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = path.join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (entry === '.state' || entry === 'lint') continue;
        walk(full);
      } else if (entry.endsWith('.md')) {
        const relative = toRelativePathFromDir(wikiDir, full);
        if (!relative.includes('/')) {
          // Root-level contract/guide files are not content pages.
          continue;
        }
        if (relative.endsWith('/index.md')) {
          continue;
        }
        try {
          const content = readFileSync(full, 'utf-8');
          const parsed = matter(content);
          const folder = path.dirname(relative).replace(/\\/g, '/');
          const currentHash = hashPageContent(content);
          const prior = previous[relative];

          if (prior && prior.generatedHash !== currentHash && !writtenPaths?.has(relative)) {
            // Manual edit: keep the last generated baseline so the conflict
            // remains detectable; never adopt the human's content as "generated".
            pages[relative] = prior;
            continue;
          }

          pages[relative] = {
            folder,
            pageType: String(parsed.data.type || 'document'),
            generatedHash: currentHash,
            updatedAt: prior && prior.generatedHash === currentHash ? prior.updatedAt : new Date().toISOString(),
          };
        } catch {
          // Skip malformed files.
        }
      }
    }
  }

  walk(wikiDir);
  state.pages = pages;
}

/**
 * Re-key a page's stored state when the file is moved (e.g., legacy flat
 * entity pages migrating into typed sub-folders), preserving the generated
 * hash so manual-edit detection follows the page to its new path.
 */
export function movePageState(state: IngestionState, oldRelativePath: string, newRelativePath: string): void {
  const entry = state.pages?.[oldRelativePath];
  if (!entry) return;
  state.pages = state.pages ?? {};
  state.pages[newRelativePath] = {
    ...entry,
    folder: path.dirname(newRelativePath).replace(/\\/g, '/'),
  };
  delete state.pages[oldRelativePath];
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
