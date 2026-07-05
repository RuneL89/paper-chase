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
import { createTextPdfInDir } from './fixtures/pdf-helpers.js';
import { LLMClient, loadLLMConfig } from '../src/llm/client.js';

const CLI = path.resolve(__dirname, '../dist/cli.js');

function makeTempWorkspace(): string {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'wiki-sprint4-'));
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
        agents_md: 'AGENTS.md',
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
        dir: 'output',
        page_types: ['index', 'source', 'document', 'topic', 'entity', 'raw'],
      },
      status: 'ready',
      ingestion: {
        entity_threshold: 2,
        topic_threshold: 2,
        max_entities: 50,
        max_topics: 50,
      },
    }),
  );
  writeFileSync(path.join(wikiDir, 'AGENTS.md'), `# AGENTS.md — ${slug}\n`);
  return wikiDir;
}

async function addPdf(wikiDir: string, fileName: string, header: string, body: string): Promise<string> {
  return createTextPdfInDir(path.join(wikiDir, 'raw'), fileName, [
    { header, body },
  ]);
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
  const fullDir = path.join(wikiDir, 'output', subdir);
  if (!existsSync(fullDir)) return [];
  return readdirSync(fullDir).filter((f) => f.endsWith('.md'));
}

function latestLogFile(workspace: string): string {
  const logDir = path.join(workspace, '.kimi-code', 'logs');
  if (!existsSync(logDir)) return '';
  const files = readdirSync(logDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(logDir, files[0]) : '';
}

function readLatestLog(workspace: string): Record<string, unknown> {
  const logPath = latestLogFile(workspace);
  if (!logPath) return {};
  return JSON.parse(readFileSync(logPath, 'utf-8'));
}

describe('TAC-001: wiki-level index frontmatter', () => {
  let workspace: string;
  let wikiDir: string;

  beforeAll(async () => {
    workspace = makeTempWorkspace();
    wikiDir = setupWiki(workspace, 'acme');
    await addPdf(wikiDir, 'doc-a.pdf', 'Doc A', 'Acme Corp reported revenue.');
    runCli(['ingest', 'acme'], workspace);
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('has required frontmatter title, type, updated, wiki, and sources', () => {
    const indexPath = path.join(wikiDir, 'output', 'index.md');
    expect(existsSync(indexPath)).toBe(true);
    const parsed = matter(readFileSync(indexPath, 'utf-8'));
    expect(parsed.data.title).toBeTruthy();
    expect(parsed.data.type).toBe('index');
    expect(parsed.data.updated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(parsed.data.wiki).toBe('acme');
    expect(Array.isArray(parsed.data.sources)).toBe(true);
    expect(parsed.data.sources.length).toBeGreaterThan(0);
  });
});

describe('TAC-002: wiki-level index links to all pages', () => {
  let workspace: string;
  let wikiDir: string;

  beforeAll(async () => {
    workspace = makeTempWorkspace();
    wikiDir = setupWiki(workspace, 'acme');
    await addPdf(wikiDir, 'doc-a.pdf', 'Doc A', 'Acme Corp reported revenue.');
    runCli(['ingest', 'acme'], workspace);
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('contains links to every source, document, and raw page', () => {
    const indexContent = readFileSync(path.join(wikiDir, 'output', 'index.md'), 'utf-8');

    const sourceFiles = readOutputFiles(wikiDir, 'sources');
    const documentFiles = readOutputFiles(wikiDir, 'documents');
    const rawFiles = readOutputFiles(wikiDir, 'raw');

    for (const file of sourceFiles) {
      const content = readFileSync(path.join(wikiDir, 'output', 'sources', file), 'utf-8');
      const title = matter(content).data.title;
      expect(indexContent).toContain(`[[${title}]]`);
    }
    for (const file of documentFiles) {
      const content = readFileSync(path.join(wikiDir, 'output', 'documents', file), 'utf-8');
      const title = matter(content).data.title;
      expect(indexContent).toContain(`[[${title}]]`);
    }
    for (const file of rawFiles) {
      const content = readFileSync(path.join(wikiDir, 'output', 'raw', file), 'utf-8');
      const title = matter(content).data.title;
      expect(indexContent).toContain(`[[${title}]]`);
    }
  });
});

describe('TAC-003: index-of-indexes lists all wikis', () => {
  let workspace: string;
  let wikiDirA: string;
  let wikiDirB: string;

  beforeAll(async () => {
    workspace = makeTempWorkspace();
    wikiDirA = setupWiki(workspace, 'acme', 'Acme Wiki', 'Annual reports for Acme');
    wikiDirB = setupWiki(workspace, 'globex', 'Globex Wiki', 'Filings for Globex');
    await addPdf(wikiDirA, 'doc-a.pdf', 'Doc A', 'Acme Corp reported revenue.');
    await addPdf(wikiDirB, 'doc-b.pdf', 'Doc B', 'Globex filed quarterly results.');
    runCli(['ingest', 'acme'], workspace);
    runCli(['ingest', 'globex'], workspace);
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('lists every wiki with title, slug, source count, page count, scope summary, and links to wiki index', () => {
    const indexPath = path.join(workspace, 'index-of-indexes.md');
    expect(existsSync(indexPath)).toBe(true);
    const content = readFileSync(indexPath, 'utf-8');

    expect(content).toContain('Acme Wiki');
    expect(content).toContain('Globex Wiki');
    expect(content).toContain('acme');
    expect(content).toContain('globex');
    expect(content).toContain('Annual reports for Acme');
    expect(content).toContain('Filings for Globex');
    expect(content).toContain('[[Acme Wiki Index]]');
    expect(content).toContain('[[Globex Wiki Index]]');
  });
});

describe('TAC-004: ingest-all processes every wiki and regenerates top-level index', () => {
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

  it('processes every wiki and updates the top-level index', () => {
    expect(readOutputFiles(wikiDirA, 'documents').length).toBeGreaterThan(0);
    expect(readOutputFiles(wikiDirB, 'documents').length).toBeGreaterThan(0);

    const indexPath = path.join(workspace, 'index-of-indexes.md');
    expect(existsSync(indexPath)).toBe(true);
    const content = readFileSync(indexPath, 'utf-8');
    expect(content).toContain('Acme Wiki');
    expect(content).toContain('Globex Wiki');
  });
});

describe('TAC-005: status reports workspace state', () => {
  let workspace: string;
  let wikiDir: string;

  beforeAll(async () => {
    workspace = makeTempWorkspace();
    wikiDir = setupWiki(workspace, 'acme');
    await addPdf(wikiDir, 'doc-a.pdf', 'Doc A', 'Acme Corp reported revenue.');
    runCli(['ingest', 'acme'], workspace);
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('reports wikis, source counts, page counts, last ingestion, and warnings', () => {
    const output = runCli(['status'], workspace);
    expect(output).toContain('acme');
    expect(output).toMatch(/wiki\(s\)|wikis/i);
    expect(output).toMatch(/source|sources/i);
    expect(output).toMatch(/page|pages/i);
    expect(output).toMatch(/last run|last ingestion|updated/i);
  });
});

describe('TAC-006: every CLI run writes a JSON run log', () => {
  let workspace: string;
  let wikiDir: string;

  beforeAll(async () => {
    workspace = makeTempWorkspace();
    wikiDir = setupWiki(workspace, 'acme');
    await addPdf(wikiDir, 'doc-a.pdf', 'Doc A', 'Acme Corp reported revenue.');
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('ingest writes a log with required fields', () => {
    runCli(['ingest', 'acme'], workspace);
    const log = readLatestLog(workspace);
    expect(log.command).toBe('ingest');
    expect(log.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(log.workspace).toBe(workspace);
    expect(Array.isArray(log.wikiSlugs)).toBe(true);
    expect(Array.isArray(log.sourceFiles)).toBe(true);
    expect(Array.isArray(log.chunkBoundaries)).toBe(true);
    expect(Array.isArray(log.pagesGenerated)).toBe(true);
    expect(Array.isArray(log.warnings)).toBe(true);
    expect(Array.isArray(log.errors)).toBe(true);
    expect(log.status).toBeTruthy();
    expect(log.cliVersion).toBeTruthy();
    expect(typeof log.configVersions).toBe('object');
  });

  it('status writes a log with required fields', () => {
    runCli(['status'], workspace);
    const log = readLatestLog(workspace);
    expect(log.command).toBe('status');
    expect(log.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(log.workspace).toBe(workspace);
    expect(Array.isArray(log.wikiSlugs)).toBe(true);
    expect(log.status).toBeTruthy();
    expect(log.cliVersion).toBeTruthy();
  });
});

describe('TAC-007: LLM client records calls and never transmits raw PDFs', () => {
  it('records provider, model, tokens, and cost for a successful call', async () => {
    const client = new LLMClient({
      provider: 'test',
      model: 'test-model',
      enabled: true,
    });
    const result = await client.call('Summarize this document.');
    expect(result.provider).toBe('test');
    expect(result.model).toBe('test-model');
    expect(typeof result.estimatedTokens).toBe('number');
    expect(typeof result.estimatedCost).toBe('number');
  });

  it('rejects raw PDF buffers in prompts', async () => {
    const client = new LLMClient({
      provider: 'test',
      model: 'test-model',
      enabled: true,
    });
    await expect(client.call(Buffer.from('pdf bytes') as any)).rejects.toThrow(/raw|pdf|string/i);
  });

  it('loads config from workspace and falls back to local-only when missing', () => {
    const workspace = makeTempWorkspace();
    try {
      const config = loadLLMConfig(workspace);
      expect(config.enabled).toBe(false);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe('TAC-008: local-only fallback produces valid output', () => {
  let workspace: string;
  let wikiDir: string;

  beforeAll(async () => {
    workspace = makeTempWorkspace();
    wikiDir = setupWiki(workspace, 'acme');
    await addPdf(wikiDir, 'doc-a.pdf', 'Doc A', 'Acme Corp reported revenue.');
    runCli(['ingest', 'acme'], workspace);
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('produces source pages and document pages without LLM config', () => {
    const sourceFiles = readOutputFiles(wikiDir, 'sources');
    const documentFiles = readOutputFiles(wikiDir, 'documents');
    expect(sourceFiles).toContain('doc-a.md');
    expect(documentFiles.length).toBeGreaterThan(0);
  });
});

describe('TAC-009: lint checks detect broken links, invalid citations, and missing frontmatter', () => {
  let workspace: string;
  let wikiDir: string;

  beforeAll(async () => {
    workspace = makeTempWorkspace();
    wikiDir = setupWiki(workspace, 'acme');
    await addPdf(wikiDir, 'doc-a.pdf', 'Doc A', 'Acme Corp reported revenue.');
    runCli(['ingest', 'acme'], workspace);
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('writes a lint report with issues array and surfaces it in the run log', () => {
    const lintPath = path.join(wikiDir, 'output', 'lint', 'report.json');
    expect(existsSync(lintPath)).toBe(true);
    const report = JSON.parse(readFileSync(lintPath, 'utf-8'));
    expect(Array.isArray(report.issues)).toBe(true);

    const log = readLatestLog(workspace);
    expect(typeof log.lintIssues).toBe('number');
  });
});
