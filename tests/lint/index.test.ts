import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { lintWiki, writeLintReport } from '../../src/lint/index.js';
import type { Config } from '../../src/config.js';

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
      recoveryMode: 'abort',
      circuitBreakerThreshold: 0.3,
      circuitBreakerWindowMs: 300000,
    },
  };
}

function makeTempWiki(): { workspace: string; wikiDir: string; slug: string } {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'wiki-lint-'));
  const slug = 'acme';
  const wikiDir = path.join(workspace, 'wikis', slug);
  mkdirSync(path.join(wikiDir, 'documents'), { recursive: true });
  mkdirSync(path.join(wikiDir, 'sources'), { recursive: true });
  mkdirSync(path.join(wikiDir, 'topics'), { recursive: true });
  mkdirSync(path.join(wikiDir, 'entities'), { recursive: true });
  return { workspace, wikiDir, slug };
}

function writePage(wikiDir: string, folder: string, fileName: string, title: string, type: string, content: string, frontmatter: Record<string, unknown> = {}): void {
  writeFileSync(
    path.join(wikiDir, folder, fileName),
    matter.stringify(content, {
      title,
      type,
      wiki: 'acme',
      created: '2026-07-08T00:00:00Z',
      updated: '2026-07-08T00:00:00Z',
      ...frontmatter,
    }),
  );
}

describe('lint report', () => {
  let workspace: string;
  let wikiDir: string;
  let slug: string;

  beforeAll(() => {
    const tmp = makeTempWiki();
    workspace = tmp.workspace;
    wikiDir = tmp.wikiDir;
    slug = tmp.slug;
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('TAC-001: includes all required lint report fields', () => {
    writePage(wikiDir, 'documents', 'doc-a.md', 'Doc A', 'document', 'Content.', {
      tags: ['doc'],
      sources: [{ id: 'src1', file: 'raw/a.pdf', pages: '1', label: 'A' }],
      confidence: 'high',
    });
    writePage(wikiDir, 'sources', 'a.md', 'Source: A', 'source', 'Source page.', {
      file: 'wikis/acme/raw/a.pdf',
      logical_pages: 1,
      physical_pages: 1,
      sha256: 'a'.repeat(64),
      ingested: '2026-07-08T00:00:00Z',
      warnings: [],
      label: 'A',
    });

    const result = lintWiki(workspace, slug, makeConfig(slug));
    writeLintReport(workspace, slug, makeConfig(slug), result);

    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.total_pages).toBe(2);
    expect(result.pages_by_type).toHaveProperty('document');
    expect(result.pages_by_type).toHaveProperty('source');
    expect(typeof result.errors).toBe('number');
    expect(typeof result.warnings).toBe('number');
    expect(typeof result.broken_links).toBe('number');
    expect(typeof result.orphaned_pages).toBe('number');
    expect(typeof result.citation_issues).toBe('number');
    expect(typeof result.duplicate_entities_flagged).toBe('number');
    expect(typeof result.stale_pages).toBe('number');
  });

  it('TAC-002: flags orphaned pages', () => {
    writePage(wikiDir, 'documents', 'orphan.md', 'Orphan Page', 'document', 'No links to this page.', {
      tags: ['doc'],
      sources: [{ id: 'src1', file: 'raw/a.pdf', pages: '1', label: 'A' }],
      confidence: 'high',
    });

    const result = lintWiki(workspace, slug, makeConfig(slug));
    expect(result.orphaned_pages).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.type === 'orphaned-page')).toBe(true);
  });

  it('TAC-003: flags invalid citations', () => {
    writePage(wikiDir, 'documents', 'bad-citation.md', 'Bad Citation', 'document', 'Claim without source [^src2].', {
      tags: ['doc'],
      sources: [{ id: 'src1', file: 'raw/a.pdf', pages: '1', label: 'A' }],
      confidence: 'high',
    });

    const result = lintWiki(workspace, slug, makeConfig(slug));
    expect(result.citation_issues).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.type === 'invalid-citation')).toBe(true);
  });

  it('TAC-004: flags missing source files', () => {
    writePage(wikiDir, 'documents', 'missing-source.md', 'Missing Source', 'document', 'Claim [^src1].', {
      tags: ['doc'],
      sources: [{ id: 'src1', file: 'raw/missing.pdf', pages: '1', label: 'Missing' }],
      confidence: 'high',
    });

    const result = lintWiki(workspace, slug, makeConfig(slug));
    expect(result.issues.some((i) => i.type === 'missing-source-file')).toBe(true);
  });

  it('TAC-005: writes report.json with new schema', () => {
    const result = lintWiki(workspace, slug, makeConfig(slug));
    const reportPath = writeLintReport(workspace, slug, makeConfig(slug), result);
    const parsed = JSON.parse(readFileSync(reportPath, 'utf-8')) as Record<string, unknown>;
    expect(parsed.timestamp).toBeTruthy();
    expect(parsed.total_pages).toBeGreaterThanOrEqual(0);
    expect(parsed.pages_by_type).toBeTypeOf('object');
  });

  it('TAC-006: duplicate-entity detection does not flag identical base names in different sub-folders', () => {
    mkdirSync(path.join(wikiDir, 'entities', 'people'), { recursive: true });
    mkdirSync(path.join(wikiDir, 'entities', 'organizations'), { recursive: true });
    writeFileSync(
      path.join(wikiDir, 'entities', 'people', 'john-smith.md'),
      matter.stringify('Person John Smith.', { title: 'John Smith', type: 'entity', wiki: 'acme' }),
    );
    writeFileSync(
      path.join(wikiDir, 'entities', 'organizations', 'john-smith.md'),
      matter.stringify('Organization John Smith Inc.', { title: 'John Smith Inc.', type: 'entity', wiki: 'acme' }),
    );

    const result = lintWiki(workspace, slug, makeConfig(slug));
    expect(result.duplicate_entities_flagged).toBe(0);
    expect(result.issues.some((i) => i.type === 'duplicate-entity')).toBe(false);
  });
});
