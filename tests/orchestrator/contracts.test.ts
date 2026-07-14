import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { writeWikiIndexContract, writeFolderIndexContract } from '../../src/orchestrator/contracts.js';
import type { FolderPlan, OrchestratorMemory } from '../../src/orchestrator/types.js';
import type { Config } from '../../src/config.js';

function makeTempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'wiki-contracts-'));
}

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

function makeWikiIndexData(slug: string, title: string): any {
  return {
    slug,
    title,
    description: `Wiki for ${slug}`,
    scope: 'Test scope',
    sourceCount: 1,
    documentCount: 2,
    entityCount: 0,
    topicCount: 0,
    rawCount: 0,
    folders: [],
    warnings: [],
  };
}

function makeMemory(): OrchestratorMemory {
  return {
    rollingSummary: 'Test memory',
    state: {
      document: { title: '', totalPages: 0, currentChunk: 0, boundaryType: 'page' },
      entities: {},
      topics: {},
      relationships: [],
      sources: {},
      folderHierarchy: {},
      rawFragments: [],
    },
  };
}

function makeFolderPlan(): FolderPlan {
  return {
    folder: 'documents',
    title: 'Documents',
    description: 'Document chunks extracted from the source PDFs.',
    pageTypes: ['document'],
    children: [],
  };
}

describe('TAC-002: wiki-level index contract', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = makeTempDir();
  });

  it('includes wiki, created, updated, and children', () => {
    const outputPath = path.join(tempDir, 'wiki-index.md');
    const data = makeWikiIndexData('acme', 'Acme Wiki');
    data.folders = [makeFolderPlan()];
    const config = makeConfig('acme');

    writeWikiIndexContract(outputPath, data, config);

    const content = readFileSync(outputPath, 'utf-8');
    const parsed = matter(content);

    expect(parsed.data.title).toBe('Acme Wiki Index');
    expect(parsed.data.type).toBe('index');
    expect(parsed.data.wiki).toBe('acme');
    expect(parsed.data.created).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(parsed.data.updated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Array.isArray(parsed.data.children)).toBe(true);
  });

  it('preserves an existing created timestamp', () => {
    const outputPath = path.join(tempDir, 'wiki-index-preserved.md');
    const existingCreated = '2026-01-01T00:00:00.000Z';
    writeFileSync(
      outputPath,
      matter.stringify('# Existing index\n', {
        title: 'Existing Index',
        type: 'index',
        created: existingCreated,
      }),
    );

    const data = makeWikiIndexData('acme', 'Acme Wiki');
    const config = makeConfig('acme');
    writeWikiIndexContract(outputPath, data, config);

    const content = readFileSync(outputPath, 'utf-8');
    const parsed = matter(content);
    expect(parsed.data.created).toBe(existingCreated);
    expect(parsed.data.updated).not.toBe(existingCreated);
  });
});

describe('TAC-003: folder-level index contract has all six DOX sections', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = makeTempDir();
  });

  it('includes Purpose, Page Types, Naming Convention, Links, Rules, and Catalog', () => {
    const outputPath = path.join(tempDir, 'documents', 'index.md');
    const folder = makeFolderPlan();
    const data = makeWikiIndexData('acme', 'Acme Wiki');
    const config = makeConfig('acme');
    const memory = makeMemory();
    const folderPages: Record<string, string[]> = {
      documents: ['annual-report-part-001.md', 'annual-report-part-002.md'],
    };

    writeFolderIndexContract(outputPath, folder, data, memory, folderPages);

    const content = readFileSync(outputPath, 'utf-8');
    const parsed = matter(content);

    expect(parsed.data.title).toBe('Documents');
    expect(parsed.data.type).toBe('index');
    expect(parsed.data.wiki).toBe('acme');
    expect(parsed.data.created).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(parsed.data.updated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(parsed.content).toContain('## Purpose');
    expect(parsed.content).toContain('## Page Types');
    expect(parsed.content).toContain('## Naming Convention');
    expect(parsed.content).toContain('## Links to Other Folders');
    expect(parsed.content).toContain('## Folder-Specific Rules');
    expect(parsed.content).toContain('## Catalog');
    expect(parsed.content).toContain('annual-report-part-001.md');
  });

  it('preserves an existing created timestamp', () => {
    const outputPath = path.join(tempDir, 'documents-preserved', 'index.md');
    const existingCreated = '2026-01-01T00:00:00.000Z';
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(
      outputPath,
      matter.stringify('# Existing folder index\n', {
        title: 'Documents',
        type: 'index',
        created: existingCreated,
      }),
    );

    const folder = makeFolderPlan();
    const data = makeWikiIndexData('acme', 'Acme Wiki');
    const config = makeConfig('acme');
    const memory = makeMemory();

    writeFolderIndexContract(outputPath, folder, data, memory, {});

    const content = readFileSync(outputPath, 'utf-8');
    const parsed = matter(content);
    expect(parsed.data.created).toBe(existingCreated);
    expect(parsed.data.updated).not.toBe(existingCreated);
  });
});
