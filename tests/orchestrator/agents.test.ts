import { describe, it, expect } from 'vitest';
import {
  structureAnalyst,
  entityExtractor,
  relationshipExtractor,
  evidenceCollector,
  pagePlanner,
  critic,
} from '../../src/orchestrator/agents.js';
import { LLMClient } from '../../src/llm/client.js';
import { DEFAULT_LLM_CONFIG } from '../../src/llm/types.js';
import type { Chunk } from '../../src/chunking/types.js';
import type { ExtractionResult } from '../../src/extractor/types.js';
import type { Config } from '../../src/config.js';
import type { PagePlan, FolderPlan } from '../../src/orchestrator/types.js';

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
    output: {
      dir: '.',
      page_types: ['index', 'source', 'document', 'topic', 'entity', 'raw'],
    },
    ingestion: {
      entity_threshold: 2,
      topic_threshold: 2,
      max_entities: 50,
      max_topics: 50,
    },
    status: 'ready',
    resilience: {
      recoveryMode: 'fallback',
      circuitBreakerThreshold: 0.3,
      circuitBreakerWindowMs: 300000,
    },
  };
}

function makeChunkWithContent(content: string): Chunk {
  const chunk = makeChunk();
  chunk.content = content;
  chunk.charCount = content.length;
  return chunk;
}

function makeChunk(): Chunk {
  return {
    id: 'annual-report-part-001',
    title: 'Part 1: annual-report',
    pageRange: '1',
    boundaryType: 'page',
    content: 'Annual report page one. Acme Corp reported record earnings for the fiscal year and announced plans for market expansion. Acme Corp and Globex Inc are strategic partners.',
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
        text: 'Annual report page one. Acme Corp reported record earnings alongside Globex Inc. Acme Corp and Globex Inc are partners.',
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

function mockFetchJson(json: unknown): typeof fetch {
  return (async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify(json) } }] }),
    json: async () => ({ choices: [{ message: { content: JSON.stringify(json) } }] }),
  })) as unknown as typeof fetch;
}

function makeClient(json: unknown): LLMClient {
  return new LLMClient(
    { ...DEFAULT_LLM_CONFIG, enabled: true, provider: 'openai', model: 'gpt-4o', apiKey: 'test' },
    mockFetchJson(json),
  );
}

function makeDisabledClient(): LLMClient {
  return new LLMClient({ ...DEFAULT_LLM_CONFIG, enabled: false });
}

describe('structureAnalyst', () => {
  it('TAC-001: returns deterministic fallback when LLM is disabled', async () => {
    const result = await structureAnalyst(makeExtractionResult(), [makeChunk()], makeDisabledClient());
    expect(result.headings).toHaveLength(1);
    expect(result.boundaries).toHaveLength(1);
    expect(result.pageRange).toBe('1-1');
  });

  it('TAC-002: parses valid LLM JSON into structure output', async () => {
    const llmJson = {
      headings: [{ title: 'Executive Summary', page: 1, level: 1 }],
      sections: [{ title: 'Executive Summary', startPage: 1, endPage: 1, level: 1 }],
      boundaries: [{ type: 'page', pageRange: '1', description: 'Annual report page one' }],
      pageRange: '1',
      boundaryType: 'page',
      readingOrderFlags: [],
    };
    const result = await structureAnalyst(makeExtractionResult(), [makeChunk()], makeClient(llmJson));
    expect(result.headings[0].title).toBe('Executive Summary');
    expect(result.pageRange).toBe('1');
  });
});

describe('entityExtractor', () => {
  it('TAC-003: returns deterministic fallback entities when LLM is disabled', async () => {
    const result = await entityExtractor(makeExtractionResult(), [makeChunk()], makeDisabledClient());
    const names = result.entities.map((e) => e.name);
    expect(names).toContain('Acme Corp');
    expect(names).toContain('Globex Inc');
  });

  it('TAC-004: parses LLM entities and resolves canonical names, merging with deterministic fallback', async () => {
    const llmJson = {
      entities: [
        {
          name: 'Acme Corporation',
          canonical: 'acme-corp',
          aliases: ['Acme Corp'],
          type: 'organization',
          count: 2,
          mentions: [{ page: 1, context: 'Acme Corp reported record earnings.' }],
          confidence: 0.9,
          description: 'A fictional multinational conglomerate used in examples.',
        },
      ],
    };
    const result = await entityExtractor(makeExtractionResult(), [makeChunk()], makeClient(llmJson));
    expect(result.entities).toHaveLength(2);
    const acme = result.entities.find((e) => e.name === 'Acme Corporation');
    const globex = result.entities.find((e) => e.name === 'Globex Inc');
    expect(acme).toBeDefined();
    expect(globex).toBeDefined();
    expect(acme?.canonical).toBe('acme-corp');
  });

  it('TAC-004A: merges LLM entities that share aliases into a single canonical entity, including deterministic fallback', async () => {
    const llmJson = {
      entities: [
        {
          name: 'Acme Corp',
          canonical: 'acme-corp',
          aliases: [],
          type: 'organization',
          count: 1,
          mentions: [{ page: 1, context: 'Acme Corp reported record earnings.' }],
          confidence: 0.9,
          description: 'Short alias for Acme Corporation.',
        },
        {
          name: 'Acme Corporation',
          canonical: 'acme-corporation',
          aliases: ['Acme Corp'],
          type: 'organization',
          count: 2,
          mentions: [{ page: 1, context: 'Acme Corporation announced expansion.' }],
          confidence: 0.85,
          description: 'A fictional multinational conglomerate used in examples.',
        },
      ],
    };
    const chunk = makeChunkWithContent('Acme Corp reported record earnings. Acme Corp announced expansion plans.');
    const result = await entityExtractor(makeExtractionResult(), [chunk], makeClient(llmJson));
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].name).toBe('Acme Corporation');
    expect(result.entities[0].canonical).toBe('acme-corp');
    expect(result.entities[0].count).toBeGreaterThanOrEqual(3);
    expect(result.entities[0].aliases).toContain('Acme Corp');
  });
});

describe('relationshipExtractor', () => {
  it('TAC-005: returns deterministic fallback relationships when LLM is disabled', async () => {
    const entities = (await entityExtractor(makeExtractionResult(), [makeChunk()], makeDisabledClient())).entities;
    const result = await relationshipExtractor(makeExtractionResult(), entities, makeDisabledClient());
    expect(result.relationships.length).toBeGreaterThan(0);
  });

  it('TAC-006: parses LLM relationships and normalizes subjects/objects', async () => {
    const entities = [
      { name: 'Acme Corp', canonical: 'acme-corp', aliases: [], type: 'organization' as const, count: 1, mentions: [], confidence: 0.9 },
      { name: 'Globex', canonical: 'globex', aliases: [], type: 'organization' as const, count: 1, mentions: [], confidence: 0.9 },
    ];
    const llmJson = {
      relationships: [
        {
          subject: 'Acme Corp',
          predicate: 'partnered with',
          object: 'Globex',
          evidence: 'Globex is a partner.',
          pages: '1',
        },
      ],
    };
    const result = await relationshipExtractor(makeExtractionResult(), entities, makeClient(llmJson));
    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0].predicate).toBe('partnered with');
  });
});

describe('evidenceCollector', () => {
  it('TAC-007: returns deterministic fallback evidence when LLM is disabled', async () => {
    const result = await evidenceCollector(makeExtractionResult(), [makeChunk()], makeDisabledClient());
    expect(result.claims.length).toBeGreaterThan(0);
  });

  it('TAC-008: parses LLM evidence output', async () => {
    const llmJson = {
      claims: [{ text: 'Acme Corp reported record earnings.', evidence: 'Acme Corp reported record earnings.', pages: '1' }],
      tables: [],
      figures: [],
    };
    const result = await evidenceCollector(makeExtractionResult(), [makeChunk()], makeClient(llmJson));
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].text).toContain('Acme Corp');
  });
});

describe('pagePlanner', () => {
  it('TAC-009: returns deterministic fallback plan with discovery checklist when LLM is disabled', async () => {
    const chunk = makeChunkWithContent(
      'Annual report page one. Acme Corp reported record earnings as part of its Climate Strategy and Net Zero Commitment.',
    );
    const result = await pagePlanner(
      makeExtractionResult(),
      await structureAnalyst(makeExtractionResult(), [chunk], makeDisabledClient()),
      (await entityExtractor(makeExtractionResult(), [chunk], makeDisabledClient())).entities,
      await evidenceCollector(makeExtractionResult(), [chunk], makeDisabledClient()),
      makeDisabledClient(),
    );
    expect(result.pages.length).toBeGreaterThan(0);
    expect(result.discovery).toBeDefined();
    expect(result.discovery.existingDocument).toBe(false);
    expect(result.discovery.newTopics).toBe(true);
  });

  it('TAC-010: parses LLM page plan and normalizes topic related links', async () => {
    const entities = [
      { name: 'Acme Corp', canonical: 'acme-corp', aliases: [], type: 'organization' as const, count: 1, mentions: [], confidence: 0.9 },
    ];
    const llmJson = {
      pages: [
        {
          pageType: 'topic',
          title: 'Topic: Earnings Growth',
          fileName: 'earnings-growth.md',
          folder: 'topics',
          tags: ['topic'],
          citations: ['src1'],
          wikilinks: [],
          related: [],
        },
      ],
      folderPlacements: [
        { folder: 'documents', title: 'Documents', description: '', pageTypes: ['document'], children: [] },
        { folder: 'topics', title: 'Topics', description: '', pageTypes: ['topic'], children: [] },
      ] as FolderPlan[],
      wikilinks: [],
      citations: ['src1'],
      discovery: {
        existingDocument: true,
        newEntities: false,
        newTopics: true,
        hasTablesFigures: false,
        rawPages: false,
        newPageType: false,
      },
    };
    const result = await pagePlanner(
      makeExtractionResult(),
      await structureAnalyst(makeExtractionResult(), [makeChunk()], makeDisabledClient()),
      entities,
      await evidenceCollector(makeExtractionResult(), [makeChunk()], makeDisabledClient()),
      makeClient(llmJson),
    );
    const topicPage = result.pages.find((p) => p.pageType === 'topic');
    expect(topicPage).toBeDefined();
    expect(topicPage?.related.length).toBeGreaterThan(0);
    expect(topicPage?.related[0]).toContain('acme-corp');
  });
});

describe('critic', () => {
  it('TAC-011: returns deterministic fallback review when LLM is disabled', async () => {
    const plan = await pagePlanner(
      makeExtractionResult(),
      await structureAnalyst(makeExtractionResult(), [makeChunk()], makeDisabledClient()),
      (await entityExtractor(makeExtractionResult(), [makeChunk()], makeDisabledClient())).entities,
      await evidenceCollector(makeExtractionResult(), [makeChunk()], makeDisabledClient()),
      makeDisabledClient(),
    );
    const result = await critic(makeExtractionResult(), plan.pages, plan.folderPlacements, makeDisabledClient());
    expect(result.issues).toBeDefined();
    expect(result.confidence).toBeDefined();
  });

  it('TAC-012: merges LLM issues with deterministic fallback issues', async () => {
    const plan = await pagePlanner(
      makeExtractionResult(),
      await structureAnalyst(makeExtractionResult(), [makeChunk()], makeDisabledClient()),
      (await entityExtractor(makeExtractionResult(), [makeChunk()], makeDisabledClient())).entities,
      await evidenceCollector(makeExtractionResult(), [makeChunk()], makeDisabledClient()),
      makeDisabledClient(),
    );
    const llmJson = {
      issues: [{ type: 'suggestion', message: 'Consider adding a topic page.', severity: 'low' }],
      confidence: 'high',
    };
    const result = await critic(makeExtractionResult(), plan.pages, plan.folderPlacements, makeClient(llmJson));
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.message === 'Consider adding a topic page.')).toBe(true);
  });
});
