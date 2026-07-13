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
  hashPageContent,
  verifyPreservation,
  isPageManuallyEdited,
  buildMergedSources,
  normalizeRelationshipsForEntity,
  type IngestionState,
} from '../../src/ingestion/state.js';
import type { Chunk } from '../../src/chunking/types.js';
import type { ExtractionResult } from '../../src/extractor/types.js';

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

describe('preservation helpers', () => {
  it('approves a new body that keeps all old citations and wikilinks', () => {
    const oldBody = 'Acme earned $1M [^src1]. See also [[Topic: Revenue]].';
    const newBody = 'Acme earned $1M [^src1] and grew 10% [^src2]. See also [[Topic: Revenue]] and [[Entity: Acme Corporation]].';
    expect(verifyPreservation(oldBody, newBody)).toBe(true);
  });

  it('rejects a new body that drops an old citation', () => {
    const oldBody = 'Acme earned $1M [^src1].';
    const newBody = 'Acme earned money.';
    expect(verifyPreservation(oldBody, newBody)).toBe(false);
  });

  it('rejects a new body that drops an old wikilink', () => {
    const oldBody = 'See [[Entity: Acme Corporation]].';
    const newBody = 'See Acme Corporation.';
    expect(verifyPreservation(oldBody, newBody)).toBe(false);
  });
});

describe('source merging helpers', () => {
  it('preserves existing source ids and appends a new sequential id', () => {
    const existing = {
      frontmatter: {
        sources: [
          { id: 'src1', file: 'doc-a.pdf', pages: '1', extracted: '2026-01-01T00:00:00Z' },
          { id: 'src2', file: 'doc-b.pdf', pages: '2', extracted: '2026-01-02T00:00:00Z' },
        ],
      },
    };
    const source: ExtractionResult = {
      fileName: 'doc-c.pdf',
      filePath: 'wikis/acme/raw/doc-c.pdf',
    } as unknown as ExtractionResult;
    const chunk: Chunk = { pageRange: '3' } as unknown as Chunk;

    const merged = buildMergedSources(existing, source, chunk);
    expect(merged).toHaveLength(3);
    expect(merged[0].id).toBe('src1');
    expect(merged[1].id).toBe('src2');
    expect(merged[2].id).toBe('src3');
    expect(merged[2].file).toBe('wikis/acme/raw/doc-c.pdf');
    expect(merged[2].pages).toBe('3');
  });

  it('starts at src1 when there are no existing sources', () => {
    const source: ExtractionResult = {
      fileName: 'doc-a.pdf',
      filePath: 'wikis/acme/raw/doc-a.pdf',
    } as unknown as ExtractionResult;
    const chunk: Chunk = { pageRange: '1' } as unknown as Chunk;

    const merged = buildMergedSources(undefined, source, chunk);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('src1');
  });
});

describe('manual-edit detection', () => {
  it('flags a page as manually edited when the stored hash differs', () => {
    const state = defaultState();
    const content = '# Entity: Acme';
    state.pages = {
      'entities/acme.md': {
        folder: 'entities',
        pageType: 'entity',
        generatedHash: 'not-the-real-hash',
        updatedAt: new Date().toISOString(),
      },
    };
    expect(isPageManuallyEdited('entities/acme.md', content, state)).toBe(true);
  });

  it('does not flag a page when no prior state exists', () => {
    const state = defaultState();
    expect(isPageManuallyEdited('entities/acme.md', '# Entity: Acme', state)).toBe(false);
  });

  it('does not flag a page when the hash matches', () => {
    const state = defaultState();
    const content = '# Entity: Acme';
    state.pages = {
      'entities/acme.md': {
        folder: 'entities',
        pageType: 'entity',
        generatedHash: hashPageContent(content),
        updatedAt: new Date().toISOString(),
      },
    };
    expect(isPageManuallyEdited('entities/acme.md', content, state)).toBe(false);
  });
});

describe('relationship normalization', () => {
  it('adds the entity name as subject to partial relationships', () => {
    const relationships = [
      { predicate: 'acquired', object: 'Beta Inc', evidence: 'press release', pages: '5' },
    ];
    const normalized = normalizeRelationshipsForEntity('Acme Corp', relationships);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({
      subject: 'Acme Corp',
      predicate: 'acquired',
      object: 'Beta Inc',
      evidence: 'press release',
      pages: '5',
    });
  });

  it('returns an empty array when no relationships are provided', () => {
    expect(normalizeRelationshipsForEntity('Acme Corp')).toEqual([]);
  });
});
