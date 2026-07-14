import { describe, it, expect } from 'vitest';
import { chunkWriter } from '../../src/orchestrator/agents.js';
import { LLMClient } from '../../src/llm/client.js';
import { DEFAULT_LLM_CONFIG } from '../../src/llm/types.js';
import type { Chunk } from '../../src/chunking/types.js';
import type { ExtractionResult } from '../../src/extractor/types.js';
import type { Config } from '../../src/config.js';
import type { PagePlan } from '../../src/orchestrator/types.js';

function makeConfig(slug: string): Config {
  return {
    wiki: {
      slug,
      title: `${slug} Wiki`,
      description: `Wiki for ${slug}`,
      version: '1.0',
    },
    schema: {
      wiki_index_md: 'index.md',
      chunking_strategy_md: 'chunking-strategy.md',
    },
    chunking: {
      max_chunk_size: 100000,
      min_chunk_size: 1000,
      split_boundary: 'page',
      never_split: ['table'],
      overlap: 0,
    },
    extraction: {
      engine: 'pdfjs-dist',
      ocr_enabled: true,
      page_range: null,
    },
    output: { page_types: ['index', 'source', 'document', 'topic', 'entity', 'raw'],
    },
    ingestion: {
      entity_threshold: 2,
      topic_threshold: 2,
      max_entities: 50,
      max_topics: 50,
    },
    status: 'ready',
    resilience: {
      recoveryMode: 'abort',
      circuitBreakerThreshold: 0.3,
      circuitBreakerWindowMs: 300000,
    },
  };
}

function makeChunk(): Chunk {
  return {
    id: 'annual-report-part-001',
    title: 'Part 1: annual-report',
    pageRange: '1',
    boundaryType: 'page',
    content: 'Annual report page one. Acme Corp reported record earnings. Acme Corp plans market expansion.',
    sources: [
      {
        id: 'src1',
        file: 'wikis/acme/raw/annual-report.pdf',
        pages: '1',
        extracted: '2026-07-08T00:00:00.000Z',
        sha256: 'a'.repeat(64),
      },
    ],
    tags: ['document'],
    belowMin: false,
    charCount: 58,
  };
}

function makeExtractionResult(): ExtractionResult {
  return {
    fileName: 'annual-report.pdf',
    filePath: 'wikis/acme/raw/annual-report.pdf',
    physicalPages: 1,
    logicalPages: 1,
    metadata: { title: 'Annual Report' },
    pages: [
      {
        physicalPage: 1,
        logicalPage: 1,
        text: 'Annual report page one. Acme Corp reported record earnings.',
        isScanned: false,
        estimatedHeadings: ['Annual Report'],
      },
    ],
    tables: [],
    figures: [],
    warnings: [],
    ingested: '2026-07-08T00:00:00.000Z',
  };
}

function makePagePlan(): PagePlan {
  return {
    pageType: 'document',
    title: 'Annual Report Page 1',
    fileName: 'annual-report-part-001.md',
    folder: 'documents',
    tags: ['annual-report'],
    citations: ['src1'],
    wikilinks: ['Acme Corp'],
    related: ['entities/acme-corp.md'],
  };
}

function makeEntityPagePlan(): PagePlan {
  return {
    pageType: 'entity',
    title: 'Entity: Acme Corp',
    fileName: 'acme-corp.md',
    folder: 'entities',
    tags: ['organization'],
    citations: ['src1'],
    wikilinks: [],
    related: [],
  };
}

function mockFetchJson(json: unknown): typeof fetch {
  return (async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify(json) } }] }),
    json: async () => ({ choices: [{ message: { content: JSON.stringify(json) } }] }),
  })) as unknown as typeof fetch;
}

describe('chunkWriter', () => {
  it('TAC-001: throws a CLIError when LLM is disabled', async () => {
    const client = new LLMClient({ ...DEFAULT_LLM_CONFIG, enabled: false });
    await expect(
      chunkWriter(
        [makePagePlan()],
        [makeChunk()],
        makeExtractionResult(),
        makeConfig('acme'),
        client,
      ),
    ).rejects.toThrow('LLM is required for chunk writing');
  });

  it('TAC-002: parses valid LLM JSON into page updates with citations and wikilinks', async () => {
    const llmJson = {
      pages: [
        {
          filePath: 'documents/annual-report-part-001.md',
          frontmatter: {
            title: 'Annual Report Page 1',
            type: 'document',
            wiki: 'acme',
            tags: ['annual-report', 'earnings'],
            confidence: 'high',
            created: '2026-07-08T00:00:00.000Z',
            updated: '2026-07-08T00:00:00.000Z',
            sources: [
              {
                id: 'src1',
                file: 'wikis/acme/raw/annual-report.pdf',
                pages: '1',
                extracted: '2026-07-08T00:00:00.000Z',
                label: 'Annual Report',
              },
            ],
          },
          body: 'Acme Corp reported record earnings [^src1]. See [[Entity: Acme Corp]] for details.',
          citations: [{ claim: 'Acme Corp reported record earnings', sources: ['src1'] }],
        },
      ],
    };
    const client = new LLMClient(
      { ...DEFAULT_LLM_CONFIG, enabled: true, provider: 'openai', model: 'gpt-4o', apiKey: 'test' },
      mockFetchJson(llmJson),
    );

    const updates = await chunkWriter(
      [makePagePlan(), makeEntityPagePlan()],
      [makeChunk()],
      makeExtractionResult(),
      makeConfig('acme'),
      client,
    );

    expect(updates).toHaveLength(1);
    expect(updates[0].body).toContain('[^src1]');
    expect(updates[0].body).toContain('[[Entity: Acme Corp]]');
    expect(updates[0].frontmatter.confidence).toBe('high');
    expect(updates[0].frontmatter.tags).toContain('earnings');
  });

  it('TAC-003: throws a CLIError when LLM returns invalid JSON', async () => {
    const client = new LLMClient(
      { ...DEFAULT_LLM_CONFIG, enabled: true, provider: 'openai', model: 'gpt-4o', apiKey: 'test' },
      (async () => ({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify({ choices: [{ message: { content: 'not valid json' } }] }),
        json: async () => ({ choices: [{ message: { content: 'not valid json' } }] }),
      })) as unknown as typeof fetch,
    );

    await expect(
      chunkWriter(
        [makePagePlan()],
        [makeChunk()],
        makeExtractionResult(),
        makeConfig('acme'),
        client,
      ),
    ).rejects.toThrow(/ChunkWriter returned invalid/);
  });

  it('TAC-004: throws a CLIError when LLM frontmatter fails schema validation', async () => {
    const llmJson = {
      pages: [
        {
          filePath: 'documents/annual-report-part-001.md',
          frontmatter: {
            title: 'Annual Report Page 1',
            type: 'invalid-type',
            wiki: 'acme',
          },
          body: 'Body with no valid frontmatter.',
        },
      ],
    };
    const client = new LLMClient(
      { ...DEFAULT_LLM_CONFIG, enabled: true, provider: 'openai', model: 'gpt-4o', apiKey: 'test' },
      mockFetchJson(llmJson),
    );

    await expect(
      chunkWriter(
        [makePagePlan(), makeEntityPagePlan()],
        [makeChunk()],
        makeExtractionResult(),
        makeConfig('acme'),
        client,
      ),
    ).rejects.toThrow('ChunkWriter page has invalid type: invalid-type');
  });
});
