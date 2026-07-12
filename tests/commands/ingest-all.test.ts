import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'child_process';
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
} from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { createTextPdfInDir } from '../fixtures/pdf-helpers.js';

const CLI = path.resolve(__dirname, '../../dist/cli.js');

function makeTempWorkspace(): string {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'wiki-ingest-all-'));
  mkdirSync(path.join(tmp, '.kimi-code'), { recursive: true });
  writeFileSync(
    path.join(tmp, '.kimi-code', 'config.json'),
    JSON.stringify({
      chunking: { max_chunk_size: 40000, min_chunk_size: 100 },
      extraction: { engine: 'pdfjs-dist' },
      llm: { provider: 'test', model: 'test', enabled: true },
    }),
  );
  return tmp;
}

function setupWiki(workspace: string, slug: string, title?: string, description?: string): string {
  const wikiDir = path.join(workspace, 'wikis', slug);
  const rawDir = path.join(wikiDir, 'raw');
  mkdirSync(rawDir, { recursive: true });
  writeFileSync(
    path.join(wikiDir, 'config.json'),
    JSON.stringify({
      wiki: {
        slug,
        title: title ?? `${slug} Wiki`,
        description: description ?? `Wiki for ${slug}`,
        version: '1.0',
      },
      schema: {
        wiki_index_md: 'index.md',
        chunking_strategy_md: 'chunking-strategy.md',
      },
      chunking: {
        max_chunk_size: 40000,
        min_chunk_size: 100,
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
      status: 'ready',
      ingestion: {
        entity_threshold: 2,
        topic_threshold: 2,
        max_entities: 50,
        max_topics: 50,
      },
      llm: { provider: 'test', model: 'test', enabled: true },
    }),
  );
  writeFileSync(path.join(wikiDir, 'index.md'), `# ${slug} Wiki\n`);
  return wikiDir;
}

function runCli(args: string[], cwd: string): string {
  return execFileSync('node', [CLI, ...args], {
    cwd,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
}

function readOutputFiles(wikiDir: string, subdir: string): string[] {
  const fullDir = path.join(wikiDir, subdir);
  if (!existsSync(fullDir)) return [];
  return readdirSync(fullDir).filter((f) => f.endsWith('.md') && f !== 'index.md');
}

async function addPdf(wikiDir: string, fileName: string, header: string, body: string): Promise<string> {
  return createTextPdfInDir(path.join(wikiDir, 'raw'), fileName, [{ header, body }]);
}

describe('TAC-001: ingest-all processes every wiki and updates index-of-indexes once', () => {
  let workspace: string;
  let wikiDirA: string;
  let wikiDirB: string;

  beforeAll(async () => {
    workspace = makeTempWorkspace();
    wikiDirA = setupWiki(workspace, 'acme', 'Acme Wiki', 'Annual reports for Acme');
    wikiDirB = setupWiki(workspace, 'globex', 'Globex Wiki', 'Filings for Globex');
    await addPdf(wikiDirA, 'doc-a.pdf', 'Doc A', 'Acme Corp reported revenue.');
    await addPdf(wikiDirB, 'doc-b.pdf', 'Doc B', 'Globex filed quarterly results.');
    runCli(['ingest-all'], workspace);
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('processes every wiki', () => {
    expect(readOutputFiles(wikiDirA, 'documents').length).toBeGreaterThan(0);
    expect(readOutputFiles(wikiDirB, 'documents').length).toBeGreaterThan(0);
    expect(readOutputFiles(wikiDirA, 'sources').length).toBeGreaterThan(0);
    expect(readOutputFiles(wikiDirB, 'sources').length).toBeGreaterThan(0);
  });

  it('updates the top-level index-of-indexes.md once', () => {
    const indexPath = path.join(workspace, 'index-of-indexes.md');
    expect(existsSync(indexPath)).toBe(true);
    const content = readFileSync(indexPath, 'utf-8');
    const parsed = matter(content);
    expect(parsed.data.title).toBe('Index of Indexes');
    expect(parsed.data.type).toBe('index');
    expect(parsed.data.created).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(content).toContain('Acme Wiki');
    expect(content).toContain('Globex Wiki');
    expect(content).toContain('[[Acme Wiki Index]]');
    expect(content).toContain('[[Globex Wiki Index]]');
  });

  it('prints a summary per wiki', () => {
    const output = runCli(['ingest-all'], workspace);
    expect(output).toContain('acme');
    expect(output).toContain('globex');
    expect(output).toMatch(/Ingest-all complete for 2 wiki/);
  });
});
