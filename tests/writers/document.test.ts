import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { writeDocumentPage } from '../../src/writers/document.js';
import type { Chunk } from '../../src/chunking/types.js';
import type { Config } from '../../src/config.js';

function makeTempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'wiki-document-writer-'));
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

function makeChunk(): Chunk {
  return {
    id: 'annual-report-part-001',
    title: 'Part 1: annual-report',
    pageRange: '1',
    boundaryType: 'page',
    content: 'Annual report page one.',
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
    charCount: 23,
  };
}

describe('TAC-001: document page frontmatter', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = makeTempDir();
  });

  it('includes wiki, created, updated, and sources with label', () => {
    const outputPath = path.join(tempDir, 'doc.md');
    const chunk = makeChunk();
    const config = makeConfig('acme');

    writeDocumentPage(outputPath, chunk, config);

    const content = readFileSync(outputPath, 'utf-8');
    const parsed = matter(content);

    expect(parsed.data.type).toBe('document');
    expect(parsed.data.wiki).toBe('acme');
    expect(parsed.data.created).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(parsed.data.updated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Array.isArray(parsed.data.sources)).toBe(true);
    expect(parsed.data.sources[0]).toMatchObject({
      id: 'src1',
      file: 'wikis/acme/raw/annual-report.pdf',
      pages: '1',
      label: 'Annual Report',
    });
  });

  it('preserves an existing created timestamp', () => {
    const outputPath = path.join(tempDir, 'doc-preserved.md');
    const existingCreated = '2026-01-01T00:00:00.000Z';
    writeFileSync(
      outputPath,
      matter.stringify('# Existing doc\n', {
        title: 'Existing',
        type: 'document',
        created: existingCreated,
      }),
    );

    const chunk = makeChunk();
    const config = makeConfig('acme');
    writeDocumentPage(outputPath, chunk, config);

    const content = readFileSync(outputPath, 'utf-8');
    const parsed = matter(content);
    expect(parsed.data.created).toBe(existingCreated);
    expect(parsed.data.updated).not.toBe(existingCreated);
  });
});
