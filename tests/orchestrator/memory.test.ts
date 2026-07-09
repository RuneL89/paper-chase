import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import {
  loadMemory,
  saveMemory,
  memoryPaths,
  countSummaryTokens,
  compactMemoryIfNeeded,
  DEFAULT_MEMORY_CAPS,
  saveMemorySummary,
} from '../../src/orchestrator/memory.js';
import type { OrchestratorMemory } from '../../src/orchestrator/types.js';

describe('rolling memory', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'llm-wiki-cli-memory-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('TAC-001: returns an empty memory when no file exists', () => {
    const memory = loadMemory(tmpDir);
    expect(memory.rollingSummary).toBe('');
    expect(Object.keys(memory.state.entities)).toHaveLength(0);
  });

  it('TAC-002: persists and loads memory', () => {
    const memory = loadMemory(tmpDir);
    memory.rollingSummary = 'Test summary.';
    memory.state.entities['russell-barkley'] = {
      name: 'Russell Barkley',
      type: 'person',
      mentions: [{ page: 1, context: 'mentioned' }],
      confidence: 1,
    };
    saveMemory(tmpDir, memory);

    const paths = memoryPaths(tmpDir);
    expect(existsSync(paths.structured)).toBe(true);

    const loaded = loadMemory(tmpDir);
    expect(loaded.rollingSummary).toBe('Test summary.');
    expect(loaded.state.entities['russell-barkley'].name).toBe('Russell Barkley');
  });

  it('TAC-003: counts summary tokens approximately', () => {
    expect(countSummaryTokens('one two three')).toBeGreaterThan(0);
  });

  it('TAC-004: detects when memory exceeds caps', () => {
    const memory = loadMemory(tmpDir);
    memory.state.entities = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [
        `entity-${i}`,
        { name: `Entity ${i}`, type: 'person', mentions: [], confidence: 1 },
      ]),
    );
    const caps = { ...DEFAULT_MEMORY_CAPS, maxEntities: 5 };
    expect(compactMemoryIfNeeded(memory, caps).compacted).toBe(true);
  });

  it('TAC-005: archives oldest 20% of entities and records historical summary', () => {
    const memory = loadMemory(tmpDir);
    for (let i = 1; i <= 10; i++) {
      memory.state.entities[`entity-${i}`] = { name: `Entity ${i}`, type: 'organization', count: i, mentions: [], confidence: 1 };
    }
    const caps = { ...DEFAULT_MEMORY_CAPS, maxEntities: 5 };
    const result = compactMemoryIfNeeded(memory, caps);

    expect(result.compacted).toBe(true);
    expect(result.archivedEntities.length).toBe(2);
    expect(Object.keys(memory.state.entities).length).toBe(8);
    expect(memory.historicalSummary).toContain('Archived entities');
  });

  it('TAC-006: archives oldest 20% of topics and relationships', () => {
    const memory = loadMemory(tmpDir);
    for (let i = 1; i <= 10; i++) {
      memory.state.topics[`topic-${i}`] = { tags: ['topic'], mentions: Array(i).fill({ source: 's', pages: '1' }), related: [] };
      memory.state.relationships.push({ subject: `A${i}`, predicate: 'related to', object: `B${i}`, evidence: '', pages: '1' });
    }
    const caps = { ...DEFAULT_MEMORY_CAPS, maxTopics: 5, maxRelationships: 5 };
    const result = compactMemoryIfNeeded(memory, caps);

    expect(result.compacted).toBe(true);
    expect(result.archivedTopics.length).toBe(2);
    expect(result.archivedRelationships.length).toBe(2);
    expect(Object.keys(memory.state.topics).length).toBe(8);
    expect(memory.state.relationships.length).toBe(8);
  });

  it('TAC-007: archives oldest 20% of rolling summary when token cap exceeded', () => {
    const memory = loadMemory(tmpDir);
    memory.rollingSummary = Array(1000).fill('word').join(' ');
    const caps = { ...DEFAULT_MEMORY_CAPS, maxRollingMemoryTokens: 100 };
    const result = compactMemoryIfNeeded(memory, caps);

    expect(result.compacted).toBe(true);
    expect(countSummaryTokens(memory.rollingSummary)).toBeLessThan(countSummaryTokens(Array(1000).fill('word').join(' ')));
    expect(memory.historicalSummary).toContain('Archived summary');
  });

  it('TAC-008: enables summary-only mode when caps still exceeded after compaction', () => {
    const memory = loadMemory(tmpDir);
    for (let i = 1; i <= 100; i++) {
      memory.state.entities[`entity-${i}`] = { name: `Entity ${i}`, type: 'organization', count: i, mentions: [], confidence: 1 };
    }
    const caps = { ...DEFAULT_MEMORY_CAPS, maxEntities: 5 };
    const result = compactMemoryIfNeeded(memory, caps);

    expect(result.summaryOnly).toBe(true);
    expect(memory.summaryOnly).toBe(true);
  });

  it('TAC-009: writes current and historical sections to memory summary file', () => {
    const memory = loadMemory(tmpDir);
    memory.rollingSummary = 'Current summary.';
    memory.historicalSummary = 'Historical summary.';
    memory.summaryOnly = true;
    saveMemorySummary(tmpDir, memory);

    const summary = readFileSync(memoryPaths(tmpDir).summary, 'utf-8');
    expect(summary).toContain('Current Summary');
    expect(summary).toContain('Historical Summary');
    expect(summary).toContain('Summary-only');
  });
});
