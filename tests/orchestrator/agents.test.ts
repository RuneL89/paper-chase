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

function makeAgentClient(responses: Record<string, unknown>): LLMClient {
  const fetchFn = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof init?.body === 'string' ? init.body : '{}';
    const parsed = JSON.parse(raw) as { messages?: { content?: string }[] };
    const prompt = parsed.messages?.[0]?.content ?? '';
    const agentMatch = prompt.match(/You are the ([A-Za-z]+) agent/);
    const agent = agentMatch?.[1] ?? 'unknown';
    const json = responses[agent] ?? {};
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify(json) } }] }),
      json: async () => ({ choices: [{ message: { content: JSON.stringify(json) } }] }),
    };
  }) as unknown as typeof fetch;

  return new LLMClient(
    { ...DEFAULT_LLM_CONFIG, enabled: true, provider: 'openai', model: 'gpt-4o', apiKey: 'test' },
    fetchFn,
  );
}

function makeDisabledClient(): LLMClient {
  return new LLMClient({ ...DEFAULT_LLM_CONFIG, enabled: false });
}

describe('structureAnalyst', () => {
  it('TAC-001: throws a CLIError when LLM is disabled', async () => {
    await expect(structureAnalyst(makeExtractionResult(), [makeChunk()], makeDisabledClient())).rejects.toThrow(
      'LLM is required for structure analysis',
    );
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
  it('TAC-003: throws a CLIError when LLM is disabled', async () => {
    await expect(entityExtractor(makeExtractionResult(), [makeChunk()], makeDisabledClient())).rejects.toThrow(
      'LLM is required for entity extraction',
    );
  });

  it('TAC-004: parses LLM entities and resolves canonical names', async () => {
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
    expect(result.entities).toHaveLength(1);
    const acme = result.entities.find((e) => e.name === 'Acme Corporation');
    expect(acme).toBeDefined();
    expect(acme?.canonical).toBe('acme-corporation');
    expect(acme?.aliases).toContain('Acme Corp');
  });

  it('TAC-004A: merges LLM entities that share aliases into a single canonical entity', async () => {
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
    expect(result.entities[0].canonical).toBe('acme-corporation');
    expect(result.entities[0].count).toBeGreaterThanOrEqual(3);
    expect(result.entities[0].aliases).toContain('Acme Corp');
  });
});

describe('relationshipExtractor', () => {
  it('TAC-005: throws a CLIError when LLM is disabled', async () => {
    const entities = [
      { name: 'Acme Corp', canonical: 'acme-corp', aliases: [], type: 'organization' as const, count: 1, mentions: [], confidence: 0.9 },
    ];
    await expect(relationshipExtractor(makeExtractionResult(), entities, makeDisabledClient())).rejects.toThrow(
      'LLM is required for relationship extraction',
    );
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
  it('TAC-007: throws a CLIError when LLM is disabled', async () => {
    await expect(evidenceCollector(makeExtractionResult(), [makeChunk()], makeDisabledClient())).rejects.toThrow(
      'LLM is required for evidence collection',
    );
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
  it('TAC-009: throws a CLIError when LLM is disabled', async () => {
    const chunk = makeChunkWithContent(
      'Annual report page one. Acme Corp reported record earnings as part of its Climate Strategy and Net Zero Commitment.',
    );
    await expect(
      pagePlanner(
        makeExtractionResult(),
        await structureAnalyst(makeExtractionResult(), [chunk], makeClient({ headings: [], sections: [], boundaries: [], pageRange: '1', boundaryType: 'page', readingOrderFlags: [] })),
        (await entityExtractor(
          makeExtractionResult(),
          [chunk],
          makeClient({
            entities: [
              {
                name: 'Acme Corp',
                type: 'organization',
                aliases: [],
                count: 1,
                mentions: [{ page: 1, context: 'Acme Corp reported earnings.' }],
                confidence: 0.9,
                description: 'Acme Corp.',
              },
            ],
          }),
        )).entities,
        await evidenceCollector(makeExtractionResult(), [chunk], makeClient({ claims: [], tables: [], figures: [] })),
        makeDisabledClient(),
      ),
    ).rejects.toThrow('LLM is required for page planning');
  });

  it('TAC-010: parses LLM page plan and normalizes topic related links', async () => {
    const chunk = makeChunkWithContent('Acme Corp reported record earnings.');
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
      await structureAnalyst(makeExtractionResult(), [chunk], makeAgentClient({
        StructureAnalyst: { headings: [], sections: [], boundaries: [], pageRange: '1', boundaryType: 'page', readingOrderFlags: [] },
      })),
      entities,
      await evidenceCollector(makeExtractionResult(), [chunk], makeAgentClient({
        EvidenceCollector: { claims: [], tables: [], figures: [] },
      })),
      makeClient(llmJson),
    );
    const topicPage = result.pages.find((p) => p.pageType === 'topic');
    expect(topicPage).toBeDefined();
    expect(topicPage?.related.length).toBeGreaterThan(0);
    expect(topicPage?.related[0]).toContain('acme-corp');
  });
});

describe('critic', () => {
  it('TAC-011: throws a CLIError when LLM is disabled', async () => {
    const chunk = makeChunkWithContent('Acme Corp reported record earnings.');
    const plan = await pagePlanner(
      makeExtractionResult(),
      await structureAnalyst(makeExtractionResult(), [chunk], makeAgentClient({
        StructureAnalyst: { headings: [], sections: [], boundaries: [], pageRange: '1', boundaryType: 'page', readingOrderFlags: [] },
      })),
      (await entityExtractor(makeExtractionResult(), [chunk], makeAgentClient({
        EntityExtractor: {
          entities: [
            {
              name: 'Acme Corp',
              type: 'organization',
              aliases: [],
              count: 1,
              mentions: [{ page: 1, context: 'Acme Corp reported earnings.' }],
              confidence: 0.9,
              description: 'Acme Corp.',
            },
          ],
        },
      }))).entities,
      await evidenceCollector(makeExtractionResult(), [chunk], makeAgentClient({
        EvidenceCollector: { claims: [], tables: [], figures: [] },
      })),
      makeAgentClient({
        PagePlanner: {
          pages: [
            {
              pageType: 'document',
              title: 'Annual Report Page 1',
              fileName: 'annual-report-part-001.md',
              folder: 'documents',
              tags: ['document'],
              citations: [],
              wikilinks: [],
              related: [],
            },
          ],
          folderPlacements: [
            { folder: 'documents', title: 'Documents', description: '', pageTypes: ['document'], children: [] },
          ],
          discovery: { existingDocument: true, newEntities: false, newTopics: false, hasTablesFigures: false, rawPages: false, newPageType: false },
        },
      }),
    );
    await expect(critic(makeExtractionResult(), plan.pages, plan.folderPlacements, makeDisabledClient())).rejects.toThrow(
      'LLM is required for critic review',
    );
  });

  it('TAC-012: merges LLM issues with deterministic validation issues', async () => {
    const chunk = makeChunkWithContent('Acme Corp reported record earnings.');
    const plan = await pagePlanner(
      makeExtractionResult(),
      await structureAnalyst(makeExtractionResult(), [chunk], makeAgentClient({
        StructureAnalyst: { headings: [], sections: [], boundaries: [], pageRange: '1', boundaryType: 'page', readingOrderFlags: [] },
      })),
      (await entityExtractor(makeExtractionResult(), [chunk], makeAgentClient({
        EntityExtractor: {
          entities: [
            {
              name: 'Acme Corp',
              type: 'organization',
              aliases: [],
              count: 1,
              mentions: [{ page: 1, context: 'Acme Corp reported earnings.' }],
              confidence: 0.9,
              description: 'Acme Corp.',
            },
          ],
        },
      }))).entities,
      await evidenceCollector(makeExtractionResult(), [chunk], makeAgentClient({
        EvidenceCollector: { claims: [], tables: [], figures: [] },
      })),
      makeAgentClient({
        PagePlanner: {
          pages: [
            {
              pageType: 'document',
              title: 'Annual Report Page 1',
              fileName: 'annual-report-part-001.md',
              folder: 'documents',
              tags: ['document'],
              citations: [],
              wikilinks: [],
              related: [],
            },
          ],
          folderPlacements: [
            { folder: 'documents', title: 'Documents', description: '', pageTypes: ['document'], children: [] },
          ],
          discovery: { existingDocument: true, newEntities: false, newTopics: false, hasTablesFigures: false, rawPages: false, newPageType: false },
        },
      }),
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
