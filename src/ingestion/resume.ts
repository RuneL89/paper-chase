import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import type { Chunk } from '../chunking/types.js';

export type ChunkStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'quarantined';

export interface ChunkState {
  chunkId: string;
  source: string;
  pagePath: string;
  status: ChunkStatus;
  updatedAt: string;
  error?: string;
}

export interface RunManifest {
  version: string;
  startedAt: string;
  updatedAt: string;
  chunks: ChunkState[];
}

export const RESUME_VERSION = '1.0';

export function chunkStateDir(wikiDir: string, _outputDir?: string): string {
  return path.join(wikiDir, 'output', '.state', 'chunks');
}

export function chunkStatePath(
  wikiDir: string,
  _outputDir?: string,
  sourceSlug?: string,
  chunkId?: string,
): string {
  return path.join(chunkStateDir(wikiDir), `${sourceSlug}-${chunkId}.json`);
}

export function runManifestPath(wikiDir: string, _outputDir?: string): string {
  return path.join(wikiDir, 'output', '.state', 'run-manifest.json');
}

export function defaultManifest(): RunManifest {
  return {
    version: RESUME_VERSION,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    chunks: [],
  };
}

export function loadChunkState(statePath: string): ChunkState | undefined {
  if (!existsSync(statePath)) return undefined;
  try {
    return JSON.parse(readFileSync(statePath, 'utf-8')) as ChunkState;
  } catch {
    return undefined;
  }
}

export function writeChunkState(statePath: string, state: ChunkState): void {
  mkdirSync(path.dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
}

export function loadRunManifest(manifestPath: string): RunManifest {
  if (!existsSync(manifestPath)) {
    return defaultManifest();
  }
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf-8')) as RunManifest;
    return {
      ...defaultManifest(),
      ...parsed,
      chunks: Array.isArray(parsed.chunks) ? parsed.chunks : [],
    };
  } catch {
    return defaultManifest();
  }
}

export function writeRunManifest(manifestPath: string, manifest: RunManifest): void {
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  manifest.updatedAt = new Date().toISOString();
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

export function buildChunkStates(
  sourceSlug: string,
  chunks: Chunk[],
  documentPageIds: string[],
): ChunkState[] {
  return chunks.map((chunk, index) => ({
    chunkId: chunk.id,
    source: sourceSlug,
    pagePath: documentPageIds[index] ?? `documents/${chunk.id}.md`,
    status: 'pending',
    updatedAt: new Date().toISOString(),
  }));
}

export function initializeRunManifest(
  manifest: RunManifest,
  chunkStates: ChunkState[],
): RunManifest {
  const existingById = new Map(manifest.chunks.map((c) => [`${c.source}-${c.chunkId}`, c]));
  for (const state of chunkStates) {
    const key = `${state.source}-${state.chunkId}`;
    if (!existingById.has(key)) {
      manifest.chunks.push(state);
    }
  }
  manifest.updatedAt = new Date().toISOString();
  return manifest;
}

export function updateChunkStatus(
  manifest: RunManifest,
  statePath: string,
  sourceSlug: string,
  chunkId: string,
  status: ChunkStatus,
  error?: string,
): void {
  const key = `${sourceSlug}-${chunkId}`;
  const state = manifest.chunks.find((c) => `${c.source}-${c.chunkId}` === key);
  if (state) {
    state.status = status;
    state.updatedAt = new Date().toISOString();
    if (error) state.error = error;
  }
  writeChunkState(statePath, state ?? {
    chunkId,
    source: sourceSlug,
    pagePath: `documents/${chunkId}.md`,
    status,
    updatedAt: new Date().toISOString(),
    error,
  });
}

export function isChunkCompleted(state: ChunkState | undefined): boolean {
  return state?.status === 'completed';
}

export function allChunksCompleted(states: ChunkState[]): boolean {
  return states.length > 0 && states.every((s) => isChunkCompleted(s));
}

export function getSourceChunkStates(
  manifest: RunManifest,
  sourceSlug: string,
): ChunkState[] {
  return manifest.chunks.filter((c) => c.source === sourceSlug);
}
