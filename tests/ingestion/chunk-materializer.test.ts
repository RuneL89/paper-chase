import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import matter from 'gray-matter';
import { materializeChunkEntitiesAndTopics } from '../../src/ingestion/chunk-materializer.js';
import { hashPageContent, type IngestionState } from '../../src/ingestion/state.js';
import type { Chunk } from '../../src/chunking/types.js';
import type { ExtractionResult } from '../../src/extractor/types.js';
import type { Config } from '../../src/config.js';
import type { OrchestratorMemory, ExtractedEntity, ExtractedRelationship } from '../../src/orchestrator/types.js';
import type { LLMClient } from '../../src/llm/client.js';
import type { LLMResponse } from '../../src/llm/types.js';
import type { IngestionResult } from '../../src/ingestion/types.js';

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
    output: { page_types: ['index', 'source', 'document', 'topic', 'entity', 'raw'] },
    ingestion: {
      entity_threshold: 2,
      topic_threshold: 2,
      max_entities: 50,
      max_topics: 50,
    },
    status: 'ready',
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

function makeChunk(): Chunk {
  return {
    id: 'annual-report-part-001',
    title: 'Part 1: annual-report',
    pageRange: '1',
    boundaryType: 'page',
    content: 'Annual report page one. Acme Corp reported record earnings.',
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

function makeMemory(): OrchestratorMemory {
  return {
    rollingSummary: 'Test memory',
    historicalSummary: '',
    summaryOnly: false,
    state: {
      document: {
        title: 'Annual Report',
        totalPages: 1,
        currentChunk: 0,
        boundaryType: 'page',
      },
      entities: {
        'acme-corp': {
          name: 'Acme Corp',
          canonical: 'acme-corp',
          aliases: ['Acme Corporation'],
          type: 'organization',
          count: 2,
          mentions: [{ page: 1, context: 'Acme Corp reported record earnings.' }],
          confidence: 0.9,
          description: 'A fictional conglomerate.',
          relationships: [],
        },
      },
      topics: {},
      relationships: [],
      sources: {},
      folderHierarchy: {
        documents: { folder: 'documents', title: 'Documents', pageTypes: ['document'], children: [] },
        entities: { folder: 'entities', title: 'Entities', pageTypes: ['entity'], children: ['organizations'] },
        topics: { folder: 'topics', title: 'Topics', pageTypes: ['topic'], children: [] },
      },
      entityTaxonomy: {
        subFolders: [{ slug: 'organizations', title: 'Organizations', description: 'Organizations.' }],
        assignments: { 'acme-corp': 'organizations' },
      },
      rawFragments: [],
      duplicateFlags: [],
      sourceEntities: {},
      sourceTopics: {},
    },
  };
}

function makeState(): IngestionState {
  return {
    version: '1.1',
    lastRun: new Date().toISOString(),
    sources: {},
    pages: {},
    memory: makeMemory(),
  };
}

function makeResult(): IngestionResult {
  return {
    sourceFiles: 0,
    sourceFilePaths: [],
    documentPages: 0,
    rawPages: 0,
    entityPages: 0,
    topicPages: 0,
    warnings: [],
    errors: [],
    changed: [],
    added: [],
    removed: [],
    chunkBoundaries: [],
    lintIssues: 0,
  };
}

function makeMockClient(response: LLMResponse): LLMClient {
  return {
    isEnabled: () => true,
    call: async () => response,
  } as unknown as LLMClient;
}

function makeFailingClient(error: Error): LLMClient {
  return {
    isEnabled: () => true,
    call: async () => {
      throw error;
    },
  } as unknown as LLMClient;
}

function buildEntityTopicWriterResponse(entityBodies: Record<string, string>, topicBodies: Record<string, string>): LLMResponse {
  return {
    provider: 'test',
    model: 'test',
    text: JSON.stringify({
      entities: Object.entries(entityBodies).map(([name, body]) => ({ name, body, tags: ['sample-entity', 'test-corpus'] })),
      topics: Object.entries(topicBodies).map(([name, body]) => ({ name, body, tags: ['sample-topic', 'test-corpus'], related: [] })),
    }),
    estimatedTokens: 100,
    estimatedCost: 0,
  };
}

describe('materializeChunkEntitiesAndTopics', () => {
  let tmpDir: string;
  let workspace: string;
  let wikiDir: string;
  let config: Config;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'llm-wiki-cli-materializer-'));
    workspace = tmpDir;
    wikiDir = path.join(workspace, 'wikis', 'acme');
    mkdirSync(path.join(wikiDir, 'raw'), { recursive: true });
    config = makeConfig('acme');
    writeFileSync(
      path.join(wikiDir, 'config.json'),
      JSON.stringify({ ...config, status: 'ready' }),
    );
    writeFileSync(
      path.join(wikiDir, 'AGENTS.md'),
      '---\ntype: ingestion-guide\n---\n\n# AGENTS.md\n\nTest ingestion guide.',
    );
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes a new entity page when the LLM returns a valid body', async () => {
    const result = makeResult();
    const state = makeState();

    const response = buildEntityTopicWriterResponse(
      { 'Acme Corp': '# Entity: Acme Corp\n\nA sample entity body for testing.' },
      {},
    );

    await materializeChunkEntitiesAndTopics(
      {
        workspace,
        slug: 'acme',
        config,
        source: makeExtractionResult(),
        chunk: makeChunk(),
        memory: state.memory!,
        llmClient: makeMockClient(response),
        state,
        result,
        folderPlacements: [],
        pages: [],
      },
      [{ name: 'Acme Corp', canonical: 'acme-corp', aliases: [], type: 'organization', count: 2, mentions: [], confidence: 0.9, description: 'A fictional conglomerate.' }],
      [],
    );

    const entityPath = path.join(wikiDir, 'entities', 'organizations', 'acme-corp.md');
    expect(existsSync(entityPath)).toBe(true);
    const content = readFileSync(entityPath, 'utf-8');
    const parsed = matter(content);
    expect(parsed.data.type).toBe('entity');
    expect(parsed.content).toContain('A sample entity body for testing');
    expect(result.entityPages).toBe(1);
  });

  it('throws a CLIError when the LLM writer fails after one retry', async () => {
    const result = makeResult();
    const state = makeState();
    const error = new Error('LLM writer unavailable');

    await expect(
      materializeChunkEntitiesAndTopics(
        {
          workspace,
          slug: 'acme',
          config,
          source: makeExtractionResult(),
          chunk: makeChunk(),
          memory: state.memory!,
          llmClient: makeFailingClient(error),
          state,
          result,
          folderPlacements: [],
          pages: [],
        },
        [{ name: 'Acme Corp', canonical: 'acme-corp', aliases: [], type: 'organization', count: 2, mentions: [], confidence: 0.9, description: 'A fictional conglomerate.' }],
        [],
      ),
    ).rejects.toThrow('Entity/topic writer failed for chunk annual-report-part-001 after one retry');
  });

  it('skips an update when the LLM rewrite drops an existing citation', async () => {
    const result = makeResult();
    const state = makeState();

    const entityDir = path.join(wikiDir, 'entities', 'organizations');
    mkdirSync(entityDir, { recursive: true });
    const entityPath = path.join(entityDir, 'acme-corp.md');
    const existingBody = '# Entity: Acme Corp\n\nOriginal fact with citation [^src1].';
    writeFileSync(entityPath, matter.stringify(existingBody, { title: 'Entity: Acme Corp', type: 'entity', updated: '2026-01-01T00:00:00Z' }));

    state.pages = {
      'entities/organizations/acme-corp.md': {
        folder: 'entities/organizations',
        pageType: 'entity',
        generatedHash: hashPageContent(readFileSync(entityPath, 'utf-8')),
        updatedAt: '2026-01-01T00:00:00Z',
      },
    };

    const response = buildEntityTopicWriterResponse(
      { 'Acme Corp': '# Entity: Acme Corp\n\nNew body without the old citation.' },
      {},
    );

    await materializeChunkEntitiesAndTopics(
      {
        workspace,
        slug: 'acme',
        config,
        source: makeExtractionResult(),
        chunk: makeChunk(),
        memory: state.memory!,
        llmClient: makeMockClient(response),
        state,
        result,
        folderPlacements: [],
        pages: [],
      },
      [{ name: 'Acme Corp', canonical: 'acme-corp', aliases: [], type: 'organization', count: 2, mentions: [], confidence: 0.9, description: 'A fictional conglomerate.' }],
      [],
    );

    const content = readFileSync(entityPath, 'utf-8');
    expect(content).toContain('Original fact with citation [^src1]');
    expect(result.entityPages).toBe(0);
    expect(result.skippedUpdates).toBeDefined();
    expect(result.skippedUpdates?.some((m) => m.includes('Acme Corp') && m.includes('preserve'))).toBe(true);
  });

  it('skips an update when the entity page was manually edited', async () => {
    const result = makeResult();
    const state = makeState();

    const entityDir = path.join(wikiDir, 'entities', 'organizations');
    mkdirSync(entityDir, { recursive: true });
    const entityPath = path.join(entityDir, 'acme-corp.md');
    const originalBody = '# Entity: Acme Corp\n\nHuman-edited content.';
    writeFileSync(entityPath, matter.stringify(originalBody, { title: 'Entity: Acme Corp', type: 'entity', updated: '2026-01-01T00:00:00Z' }));

    state.pages = {
      'entities/organizations/acme-corp.md': {
        folder: 'entities/organizations',
        pageType: 'entity',
        generatedHash: 'not-the-real-hash',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    };

    const response = buildEntityTopicWriterResponse(
      { 'Acme Corp': '# Entity: Acme Corp\n\nLLM-generated body.' },
      {},
    );

    await materializeChunkEntitiesAndTopics(
      {
        workspace,
        slug: 'acme',
        config,
        source: makeExtractionResult(),
        chunk: makeChunk(),
        memory: state.memory!,
        llmClient: makeMockClient(response),
        state,
        result,
        folderPlacements: [],
        pages: [],
      },
      [{ name: 'Acme Corp', canonical: 'acme-corp', aliases: [], type: 'organization', count: 2, mentions: [], confidence: 0.9, description: 'A fictional conglomerate.' }],
      [],
    );

    const content = readFileSync(entityPath, 'utf-8');
    expect(content).toContain('Human-edited content');
    expect(result.entityPages).toBe(0);
    expect(result.skippedUpdates).toBeDefined();
    expect(result.skippedUpdates?.some((m) => m.includes('Acme Corp') && m.includes('manually edited'))).toBe(true);
  });
});
