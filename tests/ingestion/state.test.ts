import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import {
  loadState,
  saveState,
  fileChanged,
  detectRemovedSources,
  updateSourceState,
  defaultState,
  type IngestionState,
} from '../../src/ingestion/state.js';

describe('TAC-001: fileChanged detects new files', () => {
  it('returns true when the file is not in state', () => {
    const state = defaultState();
    expect(fileChanged(state, 'wikis/acme/raw/annual-report.pdf', 'abc123', 0)).toBe(true);
  });
});

describe('TAC-002: fileChanged skips unchanged files', () => {
  it('returns false when the SHA-256 matches the stored hash', () => {
    const state = defaultState();
    updateSourceState(
      state,
      'wikis/acme/raw/annual-report.pdf',
      'abc123',
      0,
      'sources/annual-report.md',
      ['documents/annual-report-part-001.md'],
      [],
      {},
      {},
      1,
    );
    expect(fileChanged(state, 'wikis/acme/raw/annual-report.pdf', 'abc123', 0)).toBe(false);
  });
});

describe('TAC-003: fileChanged detects changed files', () => {
  it('returns true when the SHA-256 differs', () => {
    const state = defaultState();
    updateSourceState(
      state,
      'wikis/acme/raw/annual-report.pdf',
      'abc123',
      0,
      'sources/annual-report.md',
      ['documents/annual-report-part-001.md'],
      [],
      {},
      {},
      1,
    );
    expect(fileChanged(state, 'wikis/acme/raw/annual-report.pdf', 'def456', 0)).toBe(true);
  });
});

describe('TAC-004: detectRemovedSources identifies removed files', () => {
  it('returns files that are no longer present', () => {
    const state = defaultState();
    updateSourceState(
      state,
      'wikis/acme/raw/annual-report.pdf',
      'abc123',
      0,
      'sources/annual-report.md',
      ['documents/annual-report-part-001.md'],
      [],
      {},
      {},
      1,
    );
    updateSourceState(
      state,
      'wikis/acme/raw/old-report.pdf',
      'xyz789',
      0,
      'sources/old-report.md',
      ['documents/old-report-part-001.md'],
      [],
      {},
      {},
      1,
    );

    const current = ['wikis/acme/raw/annual-report.pdf'];
    const removed = detectRemovedSources(state, current);
    expect(removed).toContain('wikis/acme/raw/old-report.pdf');
    expect(removed).not.toContain('wikis/acme/raw/annual-report.pdf');
  });
});

describe('TAC-005: updateSourceState persists derived counts', () => {
  let tmpDir: string;
  let stateFile: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'llm-wiki-cli-state-'));
    stateFile = path.join(tmpDir, 'ingest-state.json');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('saves and reloads SHA-256, page counts, and derived page lists', () => {
    const state = loadState(stateFile);
    updateSourceState(
      state,
      'wikis/acme/raw/annual-report.pdf',
      'abc123',
      1234567890,
      'sources/annual-report.md',
      ['documents/annual-report-part-001.md', 'documents/annual-report-part-002.md'],
      ['raw/annual-report-page-005.md'],
      { 'Acme Corp': 3 },
      { 'revenue': 2 },
      2,
    );
    saveState(stateFile, state);

    const raw = JSON.parse(readFileSync(stateFile, 'utf-8')) as IngestionState;
    const source = raw.sources['wikis/acme/raw/annual-report.pdf'];
    expect(source).toBeDefined();
    expect(source.sha256).toBe('abc123');
    expect(source.mtime).toBe(1234567890);
    expect(source.sourcePage).toBe('sources/annual-report.md');
    expect(source.documentPages).toHaveLength(2);
    expect(source.rawPages).toContain('raw/annual-report-page-005.md');
    expect(source.entities).toEqual({ 'Acme Corp': 3 });
    expect(source.topics).toEqual({ revenue: 2 });
    expect(source.chunkCount).toBe(2);
  });
});
