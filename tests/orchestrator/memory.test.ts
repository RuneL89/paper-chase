import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import {
  loadMemory,
  saveMemory,
  memoryPaths,
  countSummaryTokens,
  compactMemoryIfNeeded,
  DEFAULT_MEMORY_CAPS,
} from '../../src/orchestrator/memory.js';

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
});
