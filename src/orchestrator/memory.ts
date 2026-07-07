import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import type { OrchestratorMemory } from './types.js';

export interface MemoryCaps {
  maxEntities: number;
  maxTopics: number;
  maxRelationships: number;
  maxRollingMemoryTokens: number;
  compactionRatio: number;
}

export const DEFAULT_MEMORY_CAPS: MemoryCaps = {
  maxEntities: 500,
  maxTopics: 200,
  maxRelationships: 500,
  maxRollingMemoryTokens: 8000,
  compactionRatio: 0.2,
};

export interface RollingMemoryPaths {
  structured: string;
  summary: string;
  chunksDir: string;
}

/**
 * Returns the file paths for rolling memory inside a wiki output directory.
 */
export function memoryPaths(outputDir: string): RollingMemoryPaths {
  const stateDir = path.join(outputDir, '.state');
  return {
    structured: path.join(stateDir, 'rolling-memory.json'),
    summary: path.join(stateDir, 'memory-summary.md'),
    chunksDir: path.join(stateDir, 'chunks'),
  };
}

const emptyMemory: OrchestratorMemory = {
  rollingSummary: '',
  state: {
    document: {
      title: '',
      totalPages: 0,
      currentChunk: 0,
      boundaryType: 'page',
    },
    entities: {},
    topics: {},
    relationships: [],
    sources: {},
    folderHierarchy: {},
    rawFragments: [],
  },
};

/**
 * Loads the rolling memory from disk, or returns an empty memory object
 * if the file does not exist yet.
 */
export function loadMemory(outputDir: string): OrchestratorMemory {
  const paths = memoryPaths(outputDir);
  if (!existsSync(paths.structured)) {
    return structuredClone(emptyMemory);
  }

  try {
    const raw = readFileSync(paths.structured, 'utf-8');
    const parsed = JSON.parse(raw) as OrchestratorMemory;
    return { ...emptyMemory, ...parsed };
  } catch {
    return structuredClone(emptyMemory);
  }
}

/**
 * Persists the rolling memory structured state to disk.
 */
export function saveMemory(outputDir: string, memory: OrchestratorMemory): void {
  const paths = memoryPaths(outputDir);
  mkdirSync(path.dirname(paths.structured), { recursive: true });
  writeFileSync(paths.structured, JSON.stringify(memory, null, 2) + '\n');
}

/**
 * Persists the compressed natural-language summary to disk.
 */
export function saveMemorySummary(outputDir: string, summary: string): void {
  const paths = memoryPaths(outputDir);
  mkdirSync(path.dirname(paths.summary), { recursive: true });
  writeFileSync(paths.summary, summary);
}

/**
 * Counts the tokens in the rolling summary using a simple word-based approximation.
 */
export function countSummaryTokens(summary: string): number {
  return Math.ceil(summary.split(/\s+/).filter(Boolean).length * 1.35);
}

/**
 * Returns true if the memory exceeds the configured caps.
 * Full compaction logic is implemented in Sprint 5; this is the Sprint 1
 * detection helper.
 */
export function memoryExceedsCaps(memory: OrchestratorMemory, caps: MemoryCaps): boolean {
  const entityCount = Object.keys(memory.state.entities).length;
  const topicCount = Object.keys(memory.state.topics).length;
  const relationshipCount = memory.state.relationships.length;
  const summaryTokens = countSummaryTokens(memory.rollingSummary);

  return (
    entityCount > caps.maxEntities ||
    topicCount > caps.maxTopics ||
    relationshipCount > caps.maxRelationships ||
    summaryTokens > caps.maxRollingMemoryTokens
  );
}

/**
 * Stub for the compaction logic that will be fully implemented in Sprint 5.
 * In Sprint 1 it only records that the memory has exceeded caps and would
 * need compaction.
 */
export function compactMemoryIfNeeded(
  memory: OrchestratorMemory,
  caps: MemoryCaps,
): { compacted: boolean; archivedEntities: string[]; archivedTopics: string[] } {
  if (!memoryExceedsCaps(memory, caps)) {
    return { compacted: false, archivedEntities: [], archivedTopics: [] };
  }

  // Sprint 1: only mark that compaction is required; do not mutate memory.
  return { compacted: true, archivedEntities: [], archivedTopics: [] };
}
