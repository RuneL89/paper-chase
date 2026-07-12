import { describe, it, expect } from 'vitest';
import type { ExtractionResult } from '../../src/extractor/types.js';
import type { Config } from '../../src/config.js';
import { classifyCorpus } from '../../src/orchestrator/sampling.js';

function makeConfig(overrides: Partial<Config['sampling']> = {}): Config {
  return {
    wiki: { slug: 'test', title: 'Test', description: '', version: '1.0' },
    schema: { wiki_index_md: 'index.md', chunking_strategy_md: 'chunking-strategy.md' },
    chunking: {
      max_chunk_size: 100000,
      min_chunk_size: 1000,
      split_boundary: 'page',
      never_split: ['table'],
      overlap: 0,
    },
    extraction: { engine: 'pdfjs-dist', ocr_enabled: true, page_range: null },
    output: { dir: '.', page_types: ['index', 'source', 'document', 'topic', 'entity', 'raw'] },
    ingestion: { entity_threshold: 2, topic_threshold: 2, max_entities: 50, max_topics: 50 },
    sampling: {
      large_page_threshold: 500,
      strategy_page_budget: 50,
      similarity_metadata_keys: ['title', 'author'],
      ...overrides,
    },
    status: 'ready',
    resilience: { recoveryMode: 'abort', circuitBreakerThreshold: 0.3, circuitBreakerWindowMs: 300000 },
  } as Config;
}

function makeResult(physicalPages: number, metadata: Record<string, unknown> = {}): ExtractionResult {
  return {
    filePath: 'raw/sample.pdf',
    fileName: 'sample.pdf',
    sha256: 'abc',
    sizeBytes: 1000,
    physicalPages,
    logicalPages: physicalPages,
    metadata,
    pages: [],
    tables: [],
    figures: [],
    warnings: [],
    ingested: new Date().toISOString(),
    hasTables: false,
    hasFigures: false,
    isScanned: false,
  };
}

function makeOther(name: string, pages: number, metadata: Record<string, unknown> = {}) {
  return { fileName: name, pageCount: pages, metadata };
}

describe('classifyCorpus', () => {
  it('classifies a single document above the threshold as single-very-large', () => {
    const result = makeResult(600, { title: 'Large Leak' });
    const config = makeConfig();
    const strategy = classifyCorpus(result, [], config);
    expect(strategy.category).toBe('single-very-large');
    expect(strategy.tocSearch).toEqual({ enabled: true, firstPages: 50 });
    expect(strategy.reason).toContain('600 pages');
  });

  it('classifies a single document below the threshold as similar-manageable', () => {
    const result = makeResult(30, { title: 'Annual Report' });
    const config = makeConfig();
    const strategy = classifyCorpus(result, [], config);
    expect(strategy.category).toBe('similar-manageable');
    expect(strategy.readFirstFully).toBe(true);
  });

  it('classifies multiple similar manageable documents as similar-manageable', () => {
    const result = makeResult(30, { title: 'Annual Report 2022' });
    const others = [
      makeOther('report-2023.pdf', 30, { title: 'Annual Report 2023' }),
      makeOther('report-2024.pdf', 30, { title: 'Annual Report 2024' }),
    ];
    const config = makeConfig();
    const strategy = classifyCorpus(result, others, config);
    expect(strategy.category).toBe('similar-manageable');
    expect(strategy.readFirstFully).toBe(true);
    expect(strategy.sampleRemaining).toBe(true);
  });

  it('classifies multiple similar large documents as similar-large', () => {
    const result = makeResult(600, { title: 'EU Donations 2022' });
    const others = [
      makeOther('donations-2023.pdf', 650, { title: 'EU Donations 2023' }),
    ];
    const config = makeConfig();
    const strategy = classifyCorpus(result, others, config);
    expect(strategy.category).toBe('similar-large');
    expect(strategy.readFirstFully).toBe(true);
    expect(strategy.deferRestToIngest).toBe(true);
  });

  it('classifies mixed-size documents as mixed-corpus', () => {
    const result = makeResult(600, { title: 'Large Leak' });
    const others = [
      makeOther('memo.pdf', 5, { title: 'Memo' }),
    ];
    const config = makeConfig();
    const strategy = classifyCorpus(result, others, config);
    expect(strategy.category).toBe('mixed-corpus');
    expect(strategy.groups).toBeDefined();
    expect(strategy.groups!.length).toBeGreaterThanOrEqual(2);
  });

  it('classifies mixed metadata documents as mixed-corpus', () => {
    const result = makeResult(30, { title: 'Annual Report' });
    const others = [
      makeOther('memo.pdf', 30, { title: 'Legal Memo' }),
    ];
    const config = makeConfig();
    const strategy = classifyCorpus(result, others, config);
    expect(strategy.category).toBe('mixed-corpus');
  });
});
