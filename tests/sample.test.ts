import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'child_process';
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
} from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';

const CLI = path.resolve(__dirname, '../dist/cli.js');
const FIXTURES = path.resolve(__dirname, 'fixtures');
const FIVE_PAGE_PDF = path.join(FIXTURES, 'five-page.pdf');
const TABLE_PDF = path.join(FIXTURES, 'table.pdf');

function makeTempWorkspace(): string {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'wiki-sample-'));
  mkdirSync(path.join(tmp, '.kimi-code'), { recursive: true });
  writeFileSync(
    path.join(tmp, '.kimi-code', 'config.json'),
    JSON.stringify({
      chunking: { max_chunk_size: 40000, min_chunk_size: 100 },
      extraction: { engine: 'pdfjs-dist' },
    }),
  );
  return tmp;
}

function setupWiki(workspace: string, slug: string): string {
  const wikiDir = path.join(workspace, 'wikis', slug);
  const rawDir = path.join(wikiDir, 'raw');
  mkdirSync(rawDir, { recursive: true });
  return wikiDir;
}

function runCli(args: string[], cwd: string): string {
  return execFileSync('node', [CLI, ...args], {
    cwd,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
}

function runCliError(args: string[], cwd: string): { status: number; stderr: string } {
  try {
    runCli(args, cwd);
    return { status: 0, stderr: '' };
  } catch (e: any) {
    return { status: e.status ?? 1, stderr: String(e.stderr ?? '') };
  }
}

describe('TAC-001: sample command creates required artifacts', () => {
  let workspace: string;
  let pdfPath: string;

  beforeAll(() => {
    workspace = makeTempWorkspace();
    setupWiki(workspace, 'acme');
    pdfPath = path.join(workspace, 'wikis', 'acme', 'raw', 'five-page.pdf');
    copyFileSync(FIVE_PAGE_PDF, pdfPath);
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('creates chunking-strategy.md, index.md, config.json, and a document page', () => {
    runCli(['sample', 'acme', 'wikis/acme/raw/five-page.pdf'], workspace);

    const wikiDir = path.join(workspace, 'wikis', 'acme');
    const documentsDir = path.join(wikiDir, 'documents');

    expect(existsSync(path.join(wikiDir, 'chunking-strategy.md'))).toBe(true);
    expect(existsSync(path.join(wikiDir, 'index.md'))).toBe(true);
    expect(existsSync(path.join(wikiDir, 'config.json'))).toBe(true);

    const documentFiles = readdirFiles(documentsDir);
    expect(documentFiles.length).toBeGreaterThan(0);
    expect(documentFiles[0]).toMatch(/\.md$/);
  });
});

describe('TAC-001A: sample command creates folder-level index contracts', () => {
  let workspace: string;
  let pdfPath: string;

  beforeAll(() => {
    workspace = makeTempWorkspace();
    setupWiki(workspace, 'acme');
    pdfPath = path.join(workspace, 'wikis', 'acme', 'raw', 'five-page.pdf');
    copyFileSync(FIVE_PAGE_PDF, pdfPath);
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('creates at least one folder-level index.md with type index and parent link', () => {
    runCli(['sample', 'acme', 'wikis/acme/raw/five-page.pdf'], workspace);

    const wikiDir = path.join(workspace, 'wikis', 'acme');
    expect(existsSync(path.join(wikiDir, 'documents', 'index.md'))).toBe(true);
    expect(existsSync(path.join(wikiDir, 'sources', 'index.md'))).toBe(true);

    const folderIndex = readFileSync(path.join(wikiDir, 'documents', 'index.md'), 'utf-8');
    const parsed = matter(folderIndex);
    expect(parsed.data.type).toBe('index');
    expect(parsed.data.title).toBeTruthy();
    expect(parsed.content).toContain('Parent:');
  });
});

describe('TAC-002: chunking-strategy.md contents', () => {
  let workspace: string;
  let pdfPath: string;

  beforeAll(() => {
    workspace = makeTempWorkspace();
    setupWiki(workspace, 'acme');
    pdfPath = path.join(workspace, 'wikis', 'acme', 'raw', 'five-page.pdf');
    copyFileSync(FIVE_PAGE_PDF, pdfPath);
    runCli(['sample', 'acme', 'wikis/acme/raw/five-page.pdf'], workspace);
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('contains structure description, chunk boundaries, never-split rules, sizes, fallback, and example', () => {
    const content = readFileSync(path.join(workspace, 'wikis', 'acme', 'chunking-strategy.md'), 'utf-8');

    expect(content).toMatch(/structure|discovered|document layout/i);
    expect(content).toMatch(/chunk boundary|split boundary|boundary/i);
    expect(content).toMatch(/never split|never-split|do not split|must not split/i);
    expect(content).toMatch(/max.*chunk|maximum/i);
    expect(content).toMatch(/min.*chunk|minimum/i);
    expect(content).toMatch(/fallback|malformed|unparseable/i);
    expect(content).toMatch(/example|concrete chunk|sample chunk/i);
    expect(content).toMatch(/page\s*\d+|pages?\s*\d+/i);
  });
});

describe('TAC-003: config.json schema', () => {
  let workspace: string;

  beforeAll(() => {
    workspace = makeTempWorkspace();
    setupWiki(workspace, 'acme');
    const pdfPath = path.join(workspace, 'wikis', 'acme', 'raw', 'five-page.pdf');
    copyFileSync(FIVE_PAGE_PDF, pdfPath);
    runCli(['sample', 'acme', 'wikis/acme/raw/five-page.pdf'], workspace);
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('contains wiki metadata, schema references, chunking parameters, extraction settings, output paths, and status', () => {
    const configPath = path.join(workspace, 'wikis', 'acme', 'config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));

    expect(config.wiki).toBeDefined();
    expect(config.wiki.slug).toBe('acme');
    expect(config.wiki.title).toBeTruthy();
    expect(config.wiki.description).toBeTruthy();
    expect(config.wiki.version).toBeTruthy();

    expect(config.schema).toBeDefined();
    expect(config.schema.wiki_index_md).toBeTruthy();
    expect(config.schema.chunking_strategy_md).toBeTruthy();

    expect(config.chunking).toBeDefined();
    expect(typeof config.chunking.max_chunk_size).toBe('number');
    expect(typeof config.chunking.min_chunk_size).toBe('number');
    expect(config.chunking.split_boundary).toBeTruthy();
    expect(Array.isArray(config.chunking.never_split)).toBe(true);

    expect(config.extraction).toBeDefined();
    expect(config.extraction.engine).toBeTruthy();
    expect(typeof config.extraction.ocr_enabled).toBe('boolean');

    expect(config.output).toBeDefined();
    expect(config.output.dir).toBeTruthy();
    expect(Array.isArray(config.output.page_types)).toBe(true);

    expect(config.status).toBeTruthy();
  });
});

describe('TAC-004: document page frontmatter', () => {
  let workspace: string;

  beforeAll(() => {
    workspace = makeTempWorkspace();
    setupWiki(workspace, 'acme');
    const pdfPath = path.join(workspace, 'wikis', 'acme', 'raw', 'five-page.pdf');
    copyFileSync(FIVE_PAGE_PDF, pdfPath);
    runCli(['sample', 'acme', 'wikis/acme/raw/five-page.pdf'], workspace);
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('has type: document with required frontmatter fields', () => {
    const documentsDir = path.join(workspace, 'wikis', 'acme', 'documents');
    const files = readdirFiles(documentsDir);
    expect(files.length).toBeGreaterThan(0);

    const content = readFileSync(path.join(documentsDir, files[0]), 'utf-8');
    const parsed = matter(content);

    expect(parsed.data.type).toBe('document');
    expect(parsed.data.title).toBeTruthy();
    expect(parsed.data.tags).toBeInstanceOf(Array);
    expect(parsed.data.sources).toBeInstanceOf(Array);
    expect(parsed.data.sources.length).toBeGreaterThan(0);
    expect(parsed.data.confidence).toMatch(/high|medium|low/);
  });
});

describe('TAC-005: citations in document pages', () => {
  let workspace: string;

  beforeAll(() => {
    workspace = makeTempWorkspace();
    setupWiki(workspace, 'acme');
    const pdfPath = path.join(workspace, 'wikis', 'acme', 'raw', 'five-page.pdf');
    copyFileSync(FIVE_PAGE_PDF, pdfPath);
    runCli(['sample', 'acme', 'wikis/acme/raw/five-page.pdf'], workspace);
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('uses inline [^srcN] and maps to sources with file, pages, and extracted timestamp', () => {
    const documentsDir = path.join(workspace, 'wikis', 'acme', 'documents');
    const files = readdirFiles(documentsDir);
    const content = readFileSync(path.join(documentsDir, files[0]), 'utf-8');
    const parsed = matter(content);

    const inlineCitations = parsed.content.match(/\[\^src\d+\]/g);
    expect(inlineCitations).toBeTruthy();
    expect(inlineCitations!.length).toBeGreaterThan(0);

    const source = parsed.data.sources[0];
    expect(source.file).toBeTruthy();
    expect(source.pages).toBeTruthy();
    expect(source.extracted).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const citedNumbers = new Set(inlineCitations!.map((c) => c.match(/\d+/)![0]));
    for (const n of citedNumbers) {
      const key = `src${n}`;
      expect(parsed.data.sources.some((s: any) => s.id === key)).toBe(true);
    }
  });
});

describe('TAC-006: tables and figures are not split arbitrarily', () => {
  let workspace: string;

  beforeAll(() => {
    workspace = makeTempWorkspace();
    setupWiki(workspace, 'acme');
    const pdfPath = path.join(workspace, 'wikis', 'acme', 'raw', 'table.pdf');
    copyFileSync(TABLE_PDF, pdfPath);
    runCli(['sample', 'acme', 'wikis/acme/raw/table.pdf'], workspace);
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('keeps table content on a single page chunk or at a semantic boundary', () => {
    const documentsDir = path.join(workspace, 'wikis', 'acme', 'documents');
    const files = readdirFiles(documentsDir);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = readFileSync(path.join(documentsDir, file), 'utf-8');
      // The extracted table must appear as structured markdown, not just concatenated text.
      expect(content).toContain('Q1 |');
      expect(content).toContain('Q3 |');
      expect(content).toMatch(/---\s*\|[^\n]*---/);
    }
  });
});

describe('TAC-007: small chunks are flagged, not discarded', () => {
  let workspace: string;

  beforeAll(() => {
    workspace = makeTempWorkspace();
    setupWiki(workspace, 'acme');
    const pdfPath = path.join(workspace, 'wikis', 'acme', 'raw', 'five-page.pdf');
    copyFileSync(FIVE_PAGE_PDF, pdfPath);
    runCli(['sample', 'acme', 'wikis/acme/raw/five-page.pdf'], workspace);
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('marks small chunks in metadata rather than dropping them', () => {
    const documentsDir = path.join(workspace, 'wikis', 'acme', 'documents');
    const files = readdirFiles(documentsDir);
    expect(files.length).toBeGreaterThan(0);

    const allFlagged = files.every((file) => {
      const content = readFileSync(path.join(documentsDir, file), 'utf-8');
      const parsed = matter(content);
      return parsed.data.below_min === true || parsed.data.below_min === false;
    });

    expect(allFlagged).toBe(true);
  });
});

describe('TAC-008: sample command rejects PDFs outside raw folder', () => {
  it('exits with a non-zero code when the PDF is not inside the wiki raw folder', () => {
    const workspace = makeTempWorkspace();
    try {
      setupWiki(workspace, 'acme');
      const outsidePdf = path.join(workspace, 'five-page.pdf');
      copyFileSync(FIVE_PAGE_PDF, outsidePdf);

      const { status, stderr } = runCliError(
        ['sample', 'acme', 'five-page.pdf'],
        workspace,
      );
      expect(status).not.toBe(0);
      expect(stderr).toMatch(/raw|inside|folder|directory/i);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});

function readdirFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return require('fs')
    .readdirSync(dir)
    .filter((f: string) => !f.startsWith('.') && f !== 'index.md');
}
