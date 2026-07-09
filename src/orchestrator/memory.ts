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
  historicalSummary: '',
  summaryOnly: false,
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
    duplicateFlags: [],
    sourceEntities: {},
    sourceTopics: {},
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
    return {
      ...emptyMemory,
      ...parsed,
      state: { ...emptyMemory.state, ...parsed.state },
    };
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
 * The file contains a current summary section and a historical archive section.
 */
export function saveMemorySummary(outputDir: string, memory: OrchestratorMemory): void {
  const paths = memoryPaths(outputDir);
  mkdirSync(path.dirname(paths.summary), { recursive: true });

  const lines: string[] = ['# Rolling Memory Summary', ''];

  if (memory.rollingSummary) {
    lines.push('## Current Summary');
    lines.push(memory.rollingSummary);
    lines.push('');
  }

  if (memory.summaryOnly) {
    lines.push('## Mode');
    lines.push('Summary-only: the LLM receives only the compressed summary; structured state is used for deterministic lookups.');
    lines.push('');
  }

  if (memory.historicalSummary) {
    lines.push('## Historical Summary');
    lines.push(memory.historicalSummary);
    lines.push('');
  }

  writeFileSync(paths.summary, lines.join('\n'));
}

/**
 * Counts the tokens in the rolling summary using a simple word-based approximation.
 */
export function countSummaryTokens(summary: string): number {
  return Math.ceil(summary.split(/\s+/).filter(Boolean).length * 1.35);
}

/**
 * Returns true if the memory exceeds the configured caps.
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

interface CompactionResult {
  compacted: boolean;
  archivedEntities: string[];
  archivedTopics: string[];
  archivedRelationships: string[];
  summaryOnly: boolean;
}

/**
 * Compacts rolling memory when it exceeds the configured caps.
 * Oldest 20% of entities, topics, relationships, and summary text are archived
 * into the historical summary. If the memory still cannot fit, summary-only mode
 * is enabled.
 */
export function compactMemoryIfNeeded(memory: OrchestratorMemory, caps: MemoryCaps): CompactionResult {
  if (!memoryExceedsCaps(memory, caps)) {
    return {
      compacted: false,
      archivedEntities: [],
      archivedTopics: [],
      archivedRelationships: [],
      summaryOnly: false,
    };
  }

  const result: CompactionResult = {
    compacted: true,
    archivedEntities: [],
    archivedTopics: [],
    archivedRelationships: [],
    summaryOnly: false,
  };

  // Archive oldest 20% of entities.
  const entityKeys = Object.keys(memory.state.entities);
  if (entityKeys.length > caps.maxEntities) {
    const archiveCount = Math.max(1, Math.floor(entityKeys.length * caps.compactionRatio));
    const sortedByMention = entityKeys.sort((a, b) => {
      const countA = memory.state.entities[a].count ?? 0;
      const countB = memory.state.entities[b].count ?? 0;
      return countA - countB;
    });
    const toArchive = sortedByMention.slice(0, archiveCount);
    result.archivedEntities = toArchive;

    const historical = toArchive
      .map((key) => {
        const entity = memory.state.entities[key];
        return `${entity.name} (${entity.type}, mentions: ${entity.count ?? 0})`;
      })
      .join(', ');
    appendHistorical(memory, `Archived entities: ${historical}.`);

    for (const key of toArchive) {
      delete memory.state.entities[key];
    }
  }

  // Archive oldest 20% of topics.
  const topicKeys = Object.keys(memory.state.topics);
  if (topicKeys.length > caps.maxTopics) {
    const archiveCount = Math.max(1, Math.floor(topicKeys.length * caps.compactionRatio));
    const sortedByMention = topicKeys.sort((a, b) => {
      const countA = memory.state.topics[a].mentions?.length ?? 0;
      const countB = memory.state.topics[b].mentions?.length ?? 0;
      return countA - countB;
    });
    const toArchive = sortedByMention.slice(0, archiveCount);
    result.archivedTopics = toArchive;

    const historical = toArchive
      .map((key) => {
        const topic = memory.state.topics[key];
        return `${key} (mentions: ${topic.mentions?.length ?? 0})`;
      })
      .join(', ');
    appendHistorical(memory, `Archived topics: ${historical}.`);

    for (const key of toArchive) {
      delete memory.state.topics[key];
    }
  }

  // Archive oldest 20% of relationships.
  if (memory.state.relationships.length > caps.maxRelationships) {
    const archiveCount = Math.max(1, Math.floor(memory.state.relationships.length * caps.compactionRatio));
    const toArchive = memory.state.relationships.slice(0, archiveCount);
    result.archivedRelationships = toArchive.map((r) => `${r.subject} - ${r.predicate} - ${r.object}`);

    const historical = toArchive.map((r) => `${r.subject} - ${r.predicate} - ${r.object} (${r.pages})`).join('; ');
    appendHistorical(memory, `Archived relationships: ${historical}.`);

    memory.state.relationships = memory.state.relationships.slice(archiveCount);
  }

  // Archive oldest 20% of summary if it exceeds token cap.
  if (countSummaryTokens(memory.rollingSummary) > caps.maxRollingMemoryTokens) {
    const words = memory.rollingSummary.split(/\s+/).filter(Boolean);
    const archiveCount = Math.max(1, Math.floor(words.length * caps.compactionRatio));
    const archivedWords = words.slice(0, archiveCount);
    const remainingWords = words.slice(archiveCount);

    appendHistorical(memory, `Archived summary: ${archivedWords.join(' ')}`);
    memory.rollingSummary = remainingWords.join(' ');
  }

  // If memory still exceeds caps after compaction, switch to summary-only mode.
  if (memoryExceedsCaps(memory, caps)) {
    result.summaryOnly = true;
    memory.summaryOnly = true;
  } else {
    memory.summaryOnly = false;
  }

  return result;
}

function appendHistorical(memory: OrchestratorMemory, text: string): void {
  if (!memory.historicalSummary) {
    memory.historicalSummary = text;
  } else {
    memory.historicalSummary += '\n\n' + text;
  }
}
