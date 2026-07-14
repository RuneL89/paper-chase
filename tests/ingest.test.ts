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
  statSync,
} from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { createTextPdfInDir } from './fixtures/pdf-helpers.js';

const CLI = path.resolve(__dirname, '../dist/cli.js');
const FIXTURES = path.resolve(__dirname, 'fixtures');
const MALFORMED_PDF = path.join(FIXTURES, 'malformed.pdf');

function makeTempWorkspace(): string {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'wiki-ingest-'));
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

function setupWiki(workspace: string, slug: string): string {
  const wikiDir = path.join(workspace, 'wikis', slug);
  const rawDir = path.join(wikiDir, 'raw');
  mkdirSync(rawDir, { recursive: true });
  writeFileSync(
    path.join(wikiDir, 'config.json'),
    JSON.stringify({
      wiki: {
        slug,
        title: 'Test Wiki',
        description: 'Test wiki for Sprint 3',
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
      output: { page_types: ['index', 'source', 'document', 'topic', 'entity', 'raw'],
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

function runCliError(args: string[], cwd: string): { status: number; stderr: string; stdout: string } {
  try {
    const stdout = runCli(args, cwd);
    return { status: 0, stderr: '', stdout };
  } catch (e: any) {
    return { status: e.status ?? 1, stderr: String(e.stderr ?? ''), stdout: String(e.stdout ?? '') };
  }
}

function readOutputFiles(wikiDir: string, subdir: string): string[] {
  const fullDir = path.join(wikiDir, subdir);
  if (!existsSync(fullDir)) return [];
  const files: string[] = [];
  function walk(current: string) {
    for (const entry of readdirSync(current)) {
      const full = path.join(current, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
      } else if (entry.endsWith('.md') && entry !== 'index.md') {
        files.push(path.relative(fullDir, full));
      }
    }
  }
  walk(fullDir);
  return files;
}

function readMtimes(dir: string): Record<string, number> {
  const result: Record<string, number> = {};
  function walk(current: string) {
    for (const entry of readdirSync(current)) {
      const full = path.join(current, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
      } else {
        result[path.relative(dir, full)] = st.mtimeMs;
      }
    }
  }
  if (existsSync(dir)) walk(dir);
  return result;
}

function mtimesChanged(a: Record<string, number>, b: Record<string, number>): string[] {
  const changed: string[] = [];
  for (const key of Object.keys(a)) {
    if (a[key] !== b[key]) changed.push(key);
  }
  for (const key of Object.keys(b)) {
    if (!(key in a)) changed.push(key);
  }
  return changed;
}

async function addEntityPdf(wikiDir: string, fileName: string): Promise<string> {
  return createTextPdfInDir(path.join(wikiDir, 'raw'), fileName, [
    {
      header: 'Entity Doc Page 1',
      body: 'Acme Corp reported Quarterly Revenue. Alice Smith is the CEO.',
    },
    {
      header: 'Entity Doc Page 2',
      body: 'Acme Corp plans Market Expansion in 2025. Unknown Startup was not involved.',
    },
  ]);
}

async function addSecondEntityPdf(wikiDir: string, fileName: string): Promise<string> {
  return createTextPdfInDir(path.join(wikiDir, 'raw'), fileName, [
    {
      header: 'Second Entity Doc',
      body: 'Acme Corp acquired a smaller firm. Bob Jones helped with the deal. Market Expansion continues.',
    },
  ]);
}

describe('TAC-001: ingest processes all PDFs and produces document and source pages', () => {
  let workspace: string;
  let wikiDir: string;

  beforeAll(async () => {
    workspace = makeTempWorkspace();
    wikiDir = setupWiki(workspace, 'acme');
    await addEntityPdf(wikiDir, 'doc-a.pdf');
    await addSecondEntityPdf(wikiDir, 'doc-b.pdf');
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('produces one source page per PDF and at least one document page per chunk', () => {
    runCli(['ingest', 'acme'], workspace);

    const sourceFiles = readOutputFiles(wikiDir, 'sources');
    const documentFiles = readOutputFiles(wikiDir, 'documents');

    expect(sourceFiles).toContain('doc-a.md');
    expect(sourceFiles).toContain('doc-b.md');
    expect(documentFiles.length).toBeGreaterThanOrEqual(2);

    const indexPath = path.join(wikiDir, 'index.md');
    expect(existsSync(indexPath)).toBe(true);
  });
});

describe('TAC-002: entity pages generated for repeated mentions with threshold', () => {
  let workspace: string;
  let wikiDir: string;

  beforeAll(async () => {
    workspace = makeTempWorkspace();
    wikiDir = setupWiki(workspace, 'acme');
    await addEntityPdf(wikiDir, 'doc-a.pdf');
    await addSecondEntityPdf(wikiDir, 'doc-b.pdf');
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('generates an entity page for Acme Corp (mentioned twice) but not for Bob Jones (mentioned once)', () => {
    runCli(['ingest', 'acme'], workspace);

    const entityFiles = readOutputFiles(wikiDir, 'entities');
    const titles = entityFiles.map((fileName) => {
      const content = readFileSync(path.join(wikiDir, 'entities', fileName), 'utf-8');
      return matter(content).data.title as string;
    });

    expect(titles.some((t) => t.includes('Acme Corp'))).toBe(true);
    expect(titles.some((t) => t.includes('Bob Jones'))).toBe(false);
  });
});

describe('TAC-003: topic pages generated for recurring themes', () => {
  let workspace: string;
  let wikiDir: string;

  beforeAll(async () => {
    workspace = makeTempWorkspace();
    wikiDir = setupWiki(workspace, 'acme');
    await addEntityPdf(wikiDir, 'doc-a.pdf');
    await addSecondEntityPdf(wikiDir, 'doc-b.pdf');
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('generates topic pages for recurring themes detected across the corpus', () => {
    runCli(['ingest', 'acme'], workspace);

    const topicFiles = readOutputFiles(wikiDir, 'topics');
    const titles = topicFiles.map((fileName) => {
      const content = readFileSync(path.join(wikiDir, 'topics', fileName), 'utf-8');
      return matter(content).data.title as string;
    });

    expect(topicFiles.length).toBeGreaterThan(0);
    expect(titles.some((t) => /revenue|market|expansion/i.test(t))).toBe(true);
  });
});

describe('TAC-004: wikilinks use [[Page Title]] and lint records unresolved links', () => {
  let workspace: string;
  let wikiDir: string;

  beforeAll(async () => {
    workspace = makeTempWorkspace();
    wikiDir = setupWiki(workspace, 'acme');
    await addEntityPdf(wikiDir, 'doc-a.pdf');
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('includes resolved [[...]] links in document pages and records unresolved links in lint output', () => {
    runCli(['ingest', 'acme'], workspace);

    const documentFiles = readOutputFiles(wikiDir, 'documents');
    let hasWikilink = false;
    for (const fileName of documentFiles) {
      const content = readFileSync(path.join(wikiDir, 'documents', fileName), 'utf-8');
      if (/\[\[.*\]\]/.test(content)) {
        hasWikilink = true;
      }
    }
    expect(hasWikilink).toBe(true);

    const lintPath = path.join(wikiDir, 'lint', 'wikilinks.json');
    expect(existsSync(lintPath)).toBe(true);
    const lint = JSON.parse(readFileSync(lintPath, 'utf-8'));
    expect(Array.isArray(lint.issues)).toBe(true);
  });
});

describe('TAC-005: document pages link to source page and wiki-level index', () => {
  let workspace: string;
  let wikiDir: string;

  beforeAll(async () => {
    workspace = makeTempWorkspace();
    wikiDir = setupWiki(workspace, 'acme');
    await addEntityPdf(wikiDir, 'doc-a.pdf');
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('contains links to the source page and the wiki-level index', () => {
    runCli(['ingest', 'acme'], workspace);

    const documentFiles = readOutputFiles(wikiDir, 'documents');
    expect(documentFiles.length).toBeGreaterThan(0);

    const content = readFileSync(
      path.join(wikiDir, 'documents', documentFiles[0]),
      'utf-8',
    );

    expect(content).toMatch(/\[\[Source: doc-a\.pdf\]\]/);
    expect(content).toMatch(/\[\[Test Wiki Index\]\]/);
  });
});

describe('TAC-005A: ingest creates dynamic folder-level index contracts', () => {
  let workspace: string;
  let wikiDir: string;

  beforeAll(async () => {
    workspace = makeTempWorkspace();
    wikiDir = setupWiki(workspace, 'acme');
    await addEntityPdf(wikiDir, 'doc-a.pdf');
    await addSecondEntityPdf(wikiDir, 'doc-b.pdf');
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('creates folder-level index.md files for populated folders', () => {
    runCli(['ingest', 'acme'], workspace);

    expect(existsSync(path.join(wikiDir, 'documents', 'index.md'))).toBe(true);
    expect(existsSync(path.join(wikiDir, 'sources', 'index.md'))).toBe(true);
    expect(existsSync(path.join(wikiDir, 'entities', 'index.md'))).toBe(true);
    expect(existsSync(path.join(wikiDir, 'topics', 'index.md'))).toBe(true);

    const folderIndex = readFileSync(path.join(wikiDir, 'documents', 'index.md'), 'utf-8');
    const parsed = matter(folderIndex);
    expect(parsed.data.type).toBe('index');
    expect(parsed.data.title).toBeTruthy();
    expect(parsed.content).toContain('Parent:');
  });
});

describe('TAC-006: incremental re-run after adding one PDF updates only affected pages', () => {
  let workspace: string;
  let wikiDir: string;
  let firstDocumentMtimes: Record<string, number>;

  beforeAll(async () => {
    workspace = makeTempWorkspace();
    wikiDir = setupWiki(workspace, 'acme');
    await addEntityPdf(wikiDir, 'doc-a.pdf');
    runCli(['ingest', 'acme'], workspace);

    // Give the filesystem a moment to ensure any later write would change mtime.
    await new Promise((r) => setTimeout(r, 100));
    firstDocumentMtimes = readMtimes(path.join(wikiDir, 'documents'));

    await addSecondEntityPdf(wikiDir, 'doc-b.pdf');
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('creates pages for the new PDF but leaves existing document pages untouched', () => {
    runCli(['ingest', 'acme'], workspace);

    const documentFiles = readOutputFiles(wikiDir, 'documents');
    expect(documentFiles.some((f) => f.includes('doc-b'))).toBe(true);

    const secondDocumentMtimes = readMtimes(path.join(wikiDir, 'documents'));
    const changed = mtimesChanged(firstDocumentMtimes, secondDocumentMtimes);
    const docAChanged = changed.filter((key) => key.includes('doc-a'));

    expect(docAChanged).toHaveLength(0);
  });
});

describe('TAC-007: incremental re-run with no source changes produces no writes', () => {
  let workspace: string;
  let wikiDir: string;
  let firstMtimes: Record<string, number>;

  beforeAll(async () => {
    workspace = makeTempWorkspace();
    wikiDir = setupWiki(workspace, 'acme');
    await addEntityPdf(wikiDir, 'doc-a.pdf');
    runCli(['ingest', 'acme'], workspace);

    await new Promise((r) => setTimeout(r, 100));
    firstMtimes = readMtimes(wikiDir);
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('does not modify any output file when no source PDF has changed', () => {
    runCli(['ingest', 'acme'], workspace);

    const secondMtimes = readMtimes(wikiDir);
    const changed = mtimesChanged(firstMtimes, secondMtimes);

    expect(changed).toHaveLength(0);
  });
});

describe('TAC-008: malformed PDF during full ingestion writes a raw page and continues', () => {
  let workspace: string;
  let wikiDir: string;

  beforeAll(async () => {
    workspace = makeTempWorkspace();
    wikiDir = setupWiki(workspace, 'acme');
    await addEntityPdf(wikiDir, 'doc-a.pdf');
    const rawPath = path.join(wikiDir, 'raw', 'malformed.pdf');
    writeFileSync(rawPath, readFileSync(MALFORMED_PDF));
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('writes a raw page for the malformed PDF and still processes the valid PDF', () => {
    const { status, stderr, stdout } = runCliError(['ingest', 'acme'], workspace);
    const output = stdout + stderr;

    expect(status).toBe(0);
    expect(output).toMatch(/malformed|warning|error/i);

    const sourceFiles = readOutputFiles(wikiDir, 'sources');
    expect(sourceFiles).toContain('doc-a.md');

    const rawFiles = readOutputFiles(wikiDir, 'raw');
    expect(rawFiles.some((f) => f.includes('malformed'))).toBe(true);

    const documentFiles = readOutputFiles(wikiDir, 'documents');
    expect(documentFiles.some((f) => f.includes('doc-a'))).toBe(true);
  });
});

describe('UAC-001: ingest prints plain-language progress summary', () => {
  let workspace: string;
  let wikiDir: string;

  beforeAll(async () => {
    workspace = makeTempWorkspace();
    wikiDir = setupWiki(workspace, 'acme');
    await addEntityPdf(wikiDir, 'doc-a.pdf');
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('prints progress and counts for the processed PDF', () => {
    const output = runCli(['ingest', 'acme'], workspace);

    expect(output).toMatch(/ingest|processed|source|document|entity|topic/i);
    expect(output).toMatch(/doc-a\.pdf/);
  });
});
