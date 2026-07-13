import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { analyzeAndChunk } from '../../src/chunking/chunker.js';
import { writeChunkingStrategy } from '../../src/chunking/strategy-writer.js';
import { extractPdf } from '../../src/extractor/pdf.js';
import {
  createTenPagePdf,
  createMultiPageTablePdf,
  createScannedPdf,
  createTextPdfInDir,
} from '../fixtures/pdf-helpers.js';
import type { Config } from '../../src/config.js';

const baseConfig: Config = {
  wiki: { slug: 'test', title: 'Test', description: '', version: '1.0' },
  schema: { wiki_index_md: 'index.md', chunking_strategy_md: 'chunking-strategy.md' },
  chunking: { max_chunk_size: 100000, min_chunk_size: 100, split_boundary: 'page', never_split: ['table'], overlap: 0 },
  extraction: { engine: 'pdfjs-dist', ocr_enabled: true, page_range: null },
  output: { dir: '.', page_types: ['index', 'source', 'document', 'topic', 'entity', 'raw'] },
  ingestion: { entity_threshold: 2, topic_threshold: 2, max_entities: 50, max_topics: 50 },
  sampling: { large_page_threshold: 500, strategy_page_budget: 50, similarity_metadata_keys: ['title', 'author'] },
  status: 'ready',
  llm: { provider: 'test', model: 'local', enabled: false, maxRetries: 3, baseDelay: 1000, concurrency: 5, maxRollingMemoryTokens: 8000 },
  resilience: { recoveryMode: 'abort', circuitBreakerThreshold: 0.3, circuitBreakerWindowMs: 300000 },
};

describe('TAC-001: page-based chunking', () => {
  let filePath: string;

  beforeAll(async () => {
    filePath = await createTenPagePdf();
  });

  it('chunks a 10-page PDF into one chunk per page', async () => {
    const result = await extractPdf(filePath);
    const { chunks } = await analyzeAndChunk(result, baseConfig);

    expect(chunks).toHaveLength(10);
    for (let i = 0; i < 10; i++) {
      const chunk = chunks[i];
      expect(chunk.pageRange).toBe(String(i + 1));
      expect(chunk.id).toBe(`ten-page-part-${String(i + 1).padStart(3, '0')}`);
      expect(chunk.content).toContain(`Page ${i + 1}`);
    }
  });
});

describe('TAC-002: multi-page table preservation', () => {
  let filePath: string;

  beforeAll(async () => {
    filePath = await createMultiPageTablePdf();
  });

  it('keeps a multi-page table in a single chunk', async () => {
    const result = await extractPdf(filePath);
    const { chunks, structure } = await analyzeAndChunk(result, baseConfig);

    expect(structure.multiPageObjects.length).toBeGreaterThan(0);
    const tableObject = structure.multiPageObjects.find((o) => o.type === 'table');
    expect(tableObject).toBeDefined();
    expect(tableObject!.startPage).toBe(1);
    expect(tableObject!.endPage).toBe(2);

    const tableChunks = chunks.filter((c) => c.pageRange === '1-2');
    expect(tableChunks).toHaveLength(1);
    expect(tableChunks[0].boundaryType).toBe('table');
  });
});

describe('TAC-003: scanned page skipping', () => {
  let filePath: string;

  beforeAll(async () => {
    filePath = await createScannedPdf();
  });

  it('excludes scanned pages from document chunks', async () => {
    const result = await extractPdf(filePath);
    const { chunks } = await analyzeAndChunk(result, baseConfig);

    expect(result.pages[0].isScanned).toBe(true);
    expect(chunks).toHaveLength(0);
  });
});

describe('TAC-004: chunk source SHA-256', () => {
  let filePath: string;

  beforeAll(async () => {
    filePath = await createTenPagePdf();
  });

  it('includes the source SHA-256 in every chunk source', async () => {
    const result = await extractPdf(filePath);
    const { chunks } = await analyzeAndChunk(result, baseConfig);

    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.sources).toHaveLength(1);
      expect(chunk.sources[0].sha256).toBe(result.sha256);
      expect(chunk.sources[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});

describe('TAC-005: deterministic chunking strategy document', () => {
  let tmpDir: string;
  let filePath: string;

  beforeAll(async () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'llm-wiki-cli-chunking-'));
    filePath = await createTextPdfInDir(tmpDir, 'annual-report.pdf', [
      { header: 'Annual Report', body: 'This is the first page of the annual report.' },
      { header: 'Revenue', body: 'This page describes revenue figures.' },
    ]);
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes a deterministic audit trail with boundaries and rationale', async () => {
    const result = await extractPdf(filePath);
    const { structure, strategy } = await analyzeAndChunk(result, baseConfig);
    const strategyPath = path.join(tmpDir, 'chunking-strategy.md');
    writeChunkingStrategy(strategyPath, structure, strategy);

    expect(existsSync(strategyPath)).toBe(true);
    const content = readFileSync(strategyPath, 'utf-8');
    expect(content).toContain('# Chunking Strategy');
    expect(content).toContain('Source Provenance');
    expect(content).toContain(strategy.sha256);
    expect(content).toContain('Page 1');
    expect(content).toContain('| Physical Page |');
    expect(content).toContain('Chosen Chunk Boundaries');
    expect(content).toContain('Never-Split Rules');
    expect(content).toContain('Chunk Size Policy');
    expect(content).toContain('Fallback Rule');
    expect(content).not.toContain(result.ingested);
  });
});
