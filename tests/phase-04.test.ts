import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, test, vi } from 'vitest';
import matter from 'gray-matter';
import { checkLinks } from '../src/validation/link-checker';
import { checkCitations } from '../src/validation/citation-checker';
import { validateSchema } from '../src/validation/schema-validator';
import { validateWiki, logValidation } from '../src/validation';
import { materialize } from '../src/materializer';
import { init } from '../src/commands/init';
import { ingest } from '../src/commands/ingest';
import type { ExtractorResult } from '../src/agents/extractor';

const GOLDEN_MASTER_PDF = 'test-pdfs/golden-master.pdf';
const tempDirs: string[] = [];

afterAll(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

interface FakeChunkFixture {
  sourceSlug: string;
  chunkId: string;
  sourceFile: string;
  pageRange: string;
  extraction: ExtractorResult;
}

function installFakeChunk(wikiDir: string, fixture: FakeChunkFixture): void {
  const documentsDir = join(wikiDir, 'documents');
  const extractedDir = join(wikiDir, '.state', 'extracted');
  mkdirSync(documentsDir, { recursive: true });
  mkdirSync(extractedDir, { recursive: true });

  const docFileName = `${fixture.chunkId}.md`;
  const body = `\n## Extracted Text: Pages ${fixture.pageRange}\n\nFake chunk content for ${fixture.sourceSlug}.\n`;
  const frontmatter = {
    title: fixture.chunkId,
    type: 'document',
    sources: [{ file: fixture.sourceFile, pages: fixture.pageRange }],
    updated: new Date().toISOString(),
  };
  writeFileSync(join(documentsDir, docFileName), matter.stringify(body, frontmatter), 'utf-8');
  writeFileSync(
    join(extractedDir, `${fixture.chunkId}.json`),
    JSON.stringify(fixture.extraction, null, 2) + '\n',
    'utf-8',
  );
}

function fakeExtraction(): FakeChunkFixture {
  return {
    sourceSlug: 'golden-master',
    chunkId: 'golden-master-part-001',
    sourceFile: 'wikis/test-wiki/raw/golden-master.pdf',
    pageRange: '1-3',
    extraction: {
      entities: [
        {
          name: 'John Smith',
          type: 'person',
          slug: 'john-smith',
          folder: 'entities/people/executives',
          significance: 'CEO of Acme Corp',
          mentions: [{ page: 1, context: 'John Smith, CEO of Acme Corp' }],
        },
        {
          name: 'Acme Corp',
          type: 'company',
          slug: 'acme-corp',
          folder: 'entities/companies',
          significance: 'The company whose results are presented',
          mentions: [{ page: 1, context: 'annual results of Acme Corp' }],
        },
      ],
      relationships: [
        {
          subject: 'john-smith',
          predicate: 'is-ceo-of',
          object: 'acme-corp',
          evidence: 'John Smith, CEO of Acme Corp',
          page: 1,
        },
      ],
      claims: [
        {
          text: 'Revenue was $42.5M in Q3 2024',
          type: 'financial',
          entities: ['acme-corp'],
          page: 2,
        },
      ],
      timeline: [],
      context: 'Fake extraction fixture for Phase 4 validation tests.',
    },
  };
}

function setupMaterializedWiki(): string {
  const workspace = makeTempDir('llm-wiki-phase4-');
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  init('test-wiki', { workspace });
  mkdirSync(join(wikiDir, 'raw'), { recursive: true });
  copyFileSync(GOLDEN_MASTER_PDF, join(wikiDir, 'raw', 'golden-master.pdf'));
  installFakeChunk(wikiDir, fakeExtraction());
  return workspace;
}

// ---------------------------------------------------------------------------
// Gate 4.1: Link Checker Finds All Links
// ---------------------------------------------------------------------------
test('link checker finds all wikilinks in wiki', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  const result = await checkLinks('test-wiki', workspace);
  expect(result.totalLinks).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Gate 4.2: All Links Resolve to Existing Files
// ---------------------------------------------------------------------------
test('all wikilinks resolve to existing files', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  const result = await checkLinks('test-wiki', workspace);
  expect(result.broken).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Gate 4.3: Citation Checker Validates Citations
// ---------------------------------------------------------------------------
test('all citations map to valid source definitions', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  const result = await checkCitations('test-wiki', workspace);
  expect(result.invalid).toHaveLength(0);
  expect(result.missingSource).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Gate 4.4: Schema Validator Checks Frontmatter
// ---------------------------------------------------------------------------
test('all pages have valid frontmatter', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  const result = await validateSchema('test-wiki', workspace);
  expect(result.invalid).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Gate 4.5: Orphaned Pages Are Detected
// ---------------------------------------------------------------------------
test('orphaned pages are detected', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  const orphanPath = join(workspace, 'wikis', 'test-wiki', 'entities', 'orphan.md');
  writeFileSync(
    orphanPath,
    '---\ntitle: Orphan\ntype: entity\nupdated: 2026-07-16T10:00:00Z\n---\n\nOrphan page.',
    'utf-8',
  );

  const result = await checkLinks('test-wiki', workspace);
  const expectedRelative = 'wikis/test-wiki/entities/orphan.md';
  expect(result.orphaned).toContain(expectedRelative);
});

// ---------------------------------------------------------------------------
// Gate 4.6: Validation Results Are Logged
// LLM-free deviation: ingest is driven by an injected extractChunkFn stub so
// the gate verifies that ingest() logs the validation summary without a key.
// ---------------------------------------------------------------------------
test('validation results are logged to console', async () => {
  const workspace = makeTempDir('llm-wiki-phase4-');
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  init('test-wiki', { workspace });
  mkdirSync(join(wikiDir, 'raw'), { recursive: true });
  copyFileSync(GOLDEN_MASTER_PDF, join(wikiDir, 'raw', 'golden-master.pdf'));

  const stubExtraction: ExtractorResult = fakeExtraction().extraction;
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  try {
    await ingest('test-wiki', {
      workspace,
      extractChunkFn: () =>
        Promise.resolve({
          chunkId: 'golden-master-part-001',
          result: stubExtraction,
          jsonPath: join(wikiDir, '.state', 'extracted', 'golden-master-part-001.json'),
          jsonRelativePath: '.state/extracted/golden-master-part-001.json',
        }),
    });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Link check'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Citation check'));
  } finally {
    consoleSpy.mockRestore();
  }
});

// ---------------------------------------------------------------------------
// Supplementary: validateWiki aggregates all three checks and never throws.
// ---------------------------------------------------------------------------
test('validateWiki returns a combined summary', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  const summary = await validateWiki('test-wiki', workspace);
  expect(summary.links.totalPages).toBeGreaterThan(0);
  expect(summary.citations.totalCitations).toBeGreaterThanOrEqual(0);
  expect(summary.schema.totalPages).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Supplementary: logValidation prints the summary and warnings.
// ---------------------------------------------------------------------------
test('logValidation prints summary and warnings', async () => {
  const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
  const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  try {
    logValidation({
      wikiSlug: 'test-wiki',
      links: { broken: [], orphaned: [], totalLinks: 3, totalPages: 2 },
      citations: { invalid: [], missingSource: [], totalCitations: 1 },
      schema: { invalid: [], totalPages: 2 },
    });
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Link check'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Citation check'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Schema check'));
    expect(consoleWarn).not.toHaveBeenCalled();
  } finally {
    consoleLog.mockRestore();
    consoleWarn.mockRestore();
  }
});

// ---------------------------------------------------------------------------
// Supplementary: broken links and invalid citations are reported as warnings.
// ---------------------------------------------------------------------------
test('logValidation warns about issues', async () => {
  const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
  const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  try {
    logValidation({
      wikiSlug: 'test-wiki',
      links: {
        broken: [{ page: 'entities/a.md', link: 'Missing' }],
        orphaned: ['entities/orphan.md'],
        totalLinks: 1,
        totalPages: 2,
      },
      citations: {
        invalid: [{ page: 'entities/a.md', citation: '[^src1]' }],
        missingSource: [{ page: 'entities/a.md', citation: '[^src2]' }],
        totalCitations: 2,
      },
      schema: {
        invalid: [{ page: 'entities/a.md', issue: 'Missing title' }],
        totalPages: 1,
      },
    });
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Broken link'));
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Orphaned'));
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Invalid citation'));
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Missing source'));
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Schema violation'));
  } finally {
    consoleLog.mockRestore();
    consoleWarn.mockRestore();
  }
});

// ---------------------------------------------------------------------------
// Supplementary: the broken-link detection and invalid-citation detection paths.
// ---------------------------------------------------------------------------
test('link checker reports broken wikilinks', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  const pagePath = join(workspace, 'wikis', 'test-wiki', 'entities', 'companies', 'acme-corp.md');
  const page = readFileSync(pagePath, 'utf-8');
  writeFileSync(pagePath, page + '\n\nSee also [[Nonexistent Page]].\n', 'utf-8');

  const result = await checkLinks('test-wiki', workspace);
  const broken = result.broken.find((b) => b.link === 'Nonexistent Page');
  expect(broken).toBeDefined();
});

test('citation checker reports invalid citations', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  const pagePath = join(workspace, 'wikis', 'test-wiki', 'entities', 'companies', 'acme-corp.md');
  const page = readFileSync(pagePath, 'utf-8');
  writeFileSync(pagePath, page + '\n\nUnverified claim [^src99].\n', 'utf-8');

  const result = await checkCitations('test-wiki', workspace);
  const invalid = result.invalid.find((i) => i.citation === '[^src99]' && i.page.endsWith('acme-corp.md'));
  expect(invalid).toBeDefined();
});

// ---------------------------------------------------------------------------
// Supplementary: schema validator rejects invalid frontmatter.
// ---------------------------------------------------------------------------
test('schema validator rejects missing title', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  const badPath = join(workspace, 'wikis', 'test-wiki', 'entities', 'bad.md');
  writeFileSync(
    badPath,
    '---\ntype: entity\nupdated: 2026-07-16T10:00:00Z\n---\n\nNo title.',
    'utf-8',
  );

  const result = await validateSchema('test-wiki', workspace);
  const bad = result.invalid.find((i) => i.page.endsWith('bad.md') && i.issue.includes('title'));
  expect(bad).toBeDefined();
});
