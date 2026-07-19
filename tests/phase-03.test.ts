import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import matter from 'gray-matter';
import { materialize } from '../src/materializer';
import { init } from '../src/commands/init';
import { ingest } from '../src/commands/ingest';
import { aliasesForTitle, enforceAliasesInMarkdown } from '../src/utils/aliases';
import { formatWikilink, parseWikilinkTarget } from '../src/utils/wikilinks';
import { writeEntityPage } from '../src/pages/entity-page';
import { writeTopicPage } from '../src/pages/topic-page';
import { renderSourcePage } from '../src/pages/source-page';
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

/**
 * Lay down a fake Layer-1 document page and a fake Layer-2 extraction JSON so the
 * Materializer can be tested without any LLM calls.
 */
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

function fakeExtractionOne(): FakeChunkFixture {
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
          mentions: [
            { page: 1, context: 'John Smith, CEO of Acme Corp' },
            { page: 3, context: 'John Smith attended the board meeting' },
          ],
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
      context: 'Fake extraction fixture for Phase 3 materializer tests.',
    },
  };
}

function fakeExtractionTwo(): FakeChunkFixture {
  return {
    sourceSlug: 'golden-master',
    chunkId: 'golden-master-part-002',
    sourceFile: 'wikis/test-wiki/raw/golden-master.pdf',
    pageRange: '4-5',
    extraction: {
      entities: [
        {
          name: 'John Smith',
          type: 'person',
          slug: 'john-smith',
          folder: 'entities/people/executives',
          significance: 'CEO of Acme Corp',
          mentions: [{ page: 4, context: 'John Smith signed the quarterly filing' }],
        },
      ],
      relationships: [],
      claims: [
        {
          text: 'Operating expenses were $12M in Q3 2024',
          type: 'financial',
          entities: ['acme-corp'],
          page: 4,
        },
      ],
      timeline: [],
      context: 'Second fake extraction fixture for re-ingest test.',
    },
  };
}

function setupMaterializedWiki(): string {
  const workspace = makeTempDir('llm-wiki-phase3-');
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  init('test-wiki', { workspace });
  installFakeChunk(wikiDir, fakeExtractionOne());
  return workspace;
}

// ---------------------------------------------------------------------------
// Gate 3.1: Materializer Creates Entity Pages
// ---------------------------------------------------------------------------
test('materializer creates entity pages for all extracted entities', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  const extraction = fakeExtractionOne().extraction;
  for (const entity of extraction.entities) {
    const path = join(workspace, 'wikis', 'test-wiki', entity.folder, `${entity.slug}.md`);
    expect(existsSync(path)).toBe(true);
  }
});

// ---------------------------------------------------------------------------
// Gate 3.2: Entity Pages Have Valid Frontmatter
// ---------------------------------------------------------------------------
test('entity page has valid YAML frontmatter', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  const page = readFileSync(
    join(workspace, 'wikis', 'test-wiki', 'entities/people/executives', 'john-smith.md'),
    'utf-8',
  );
  const parsed = matter(page);
  expect(parsed.data.type).toBe('entity');
  expect(parsed.data.title).toBe('John Smith');
  expect(parsed.data.sources).toBeInstanceOf(Array);
});

// ---------------------------------------------------------------------------
// Gate 3.2b: Entity Pages Use Obsidian-Native Pipe-Form Wikilinks
// 2026-07-20 user-directed change (supersedes the 2026-07-17 title-form fix):
// relationship objects and claim entities must emit [[slug|Page Title]].
// ---------------------------------------------------------------------------
test('entity page uses pipe-form wikilinks, not bare titles or slugs', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  const page = readFileSync(
    join(workspace, 'wikis', 'test-wiki', 'entities/people/executives', 'john-smith.md'),
    'utf-8',
  );
  // Relationship object and claim entity render in Obsidian's native pipe form.
  expect(page).toContain('[[acme-corp|Acme Corp]]');
  expect(page).not.toContain('[[acme-corp]]');
  expect(page).not.toContain('[[Acme Corp]]');
});

// ---------------------------------------------------------------------------
// Gate 3.3: Entity Pages Contain All Mentions
// ---------------------------------------------------------------------------
test('entity page contains all mentions from extraction', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  const page = readFileSync(
    join(workspace, 'wikis', 'test-wiki', 'entities/people/executives', 'john-smith.md'),
    'utf-8',
  );
  const extraction = fakeExtractionOne().extraction;
  const john = extraction.entities.find((e) => e.slug === 'john-smith');
  for (const m of john!.mentions) {
    expect(page).toContain(m.context);
  }
});

// ---------------------------------------------------------------------------
// Gate 3.4: Entity Pages Have Citations
// ---------------------------------------------------------------------------
test('entity page has citations for every mention', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  const page = readFileSync(
    join(workspace, 'wikis', 'test-wiki', 'entities/people/executives', 'john-smith.md'),
    'utf-8',
  );
  const srcMatches = page.match(/\[\^src\d+\]/g);
  expect(srcMatches).not.toBeNull();
  expect(srcMatches!.length).toBeGreaterThanOrEqual(1);
});

// ---------------------------------------------------------------------------
// Gate 3.5: Folders Are Created Dynamically
// ---------------------------------------------------------------------------
test('materializer creates folders dynamically', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  expect(existsSync(join(workspace, 'wikis', 'test-wiki', 'entities/people/executives'))).toBe(true);
});

// ---------------------------------------------------------------------------
// Gate 3.6: Topic Pages Are Created
// ---------------------------------------------------------------------------
test('materializer creates topic pages', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  const files = readdirSync(join(workspace, 'wikis', 'test-wiki', 'topics'), { recursive: true });
  expect(files.length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Gate 3.6b: Topic Pages Use Obsidian-Native Pipe-Form Wikilinks
// ---------------------------------------------------------------------------
test('topic page uses pipe-form wikilinks, not bare titles or slugs', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  const page = readFileSync(
    join(workspace, 'wikis', 'test-wiki', 'topics', 'financial', 'financial.md'),
    'utf-8',
  );
  expect(page).toContain('[[acme-corp|Acme Corp]]');
  expect(page).not.toContain('[[acme-corp]]');
  expect(page).not.toContain('[[Acme Corp]]');
});

// ---------------------------------------------------------------------------
// Gate 3.7: Rolling Memory is Updated
// ---------------------------------------------------------------------------
test('rolling memory contains all entities', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  const memory = JSON.parse(
    readFileSync(join(workspace, 'wikis', 'test-wiki', '.state', 'rolling-memory.json'), 'utf-8'),
  );
  expect(memory.entities).toBeInstanceOf(Array);
  expect(memory.entities.length).toBeGreaterThan(0);
  expect(memory.folderStructure).toBeInstanceOf(Array);
  expect(memory.sources).toContain('golden-master');
});

// ---------------------------------------------------------------------------
// Gate 3.8: Re-Running Ingest Updates Existing Pages
// LLM-free deviation: we create a second fake extraction JSON and call
// materialize again, rather than running a second live extraction.
// ---------------------------------------------------------------------------
test('re-materializing updates existing entity pages', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  const firstPage = readFileSync(
    join(workspace, 'wikis', 'test-wiki', 'entities/people/executives', 'john-smith.md'),
    'utf-8',
  );

  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  installFakeChunk(wikiDir, fakeExtractionTwo());
  await materialize('test-wiki', { workspace });

  const secondPage = readFileSync(
    join(workspace, 'wikis', 'test-wiki', 'entities/people/executives', 'john-smith.md'),
    'utf-8',
  );
  expect(secondPage).not.toBe(firstPage);
  expect(secondPage).toContain('John Smith signed the quarterly filing');
});

// ---------------------------------------------------------------------------
// Supplementary: materializer handles the real ingest pipeline with
// extract:false (no LLM) and pre-existing extraction files.
// ---------------------------------------------------------------------------
test('ingest with extract:false does not remove entity pages created by materializer', async () => {
  const workspace = makeTempDir('llm-wiki-phase3-ingest-');
  await init('test-wiki', { workspace });
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  copyFileSync(GOLDEN_MASTER_PDF, join(wikiDir, 'raw', 'golden-master.pdf'));
  installFakeChunk(wikiDir, fakeExtractionOne());
  await materialize('test-wiki', { workspace });

  expect(existsSync(join(wikiDir, 'entities/people/executives', 'john-smith.md'))).toBe(true);

  await ingest('test-wiki', { workspace, extract: false });
  expect(existsSync(join(wikiDir, 'entities/people/executives', 'john-smith.md'))).toBe(true);
});

// ---------------------------------------------------------------------------
// UAT 6.3 aliases fix (user decision 2026-07-19, Option A): page frontmatter
// carries `aliases: [<title>]` when the title differs from the file basename
// (case-insensitive) so title-form [[Page Title]] wikilinks resolve in
// Obsidian. Helper unit tests + per-writer rule tests, all LLM-free.
// ---------------------------------------------------------------------------
test('aliasesForTitle: exact match yields no alias', () => {
  expect(aliasesForTitle('governance-structure', 'governance-structure')).toBeUndefined();
});

test('aliasesForTitle: case-insensitive match yields no alias', () => {
  expect(aliasesForTitle('Secretary', 'secretary')).toBeUndefined();
  expect(aliasesForTitle('FINANCIAL', 'financial')).toBeUndefined();
});

test('aliasesForTitle: mismatch yields the title as the single alias', () => {
  expect(aliasesForTitle('Governance Structure', 'governance-structure')).toEqual([
    'Governance Structure',
  ]);
  expect(aliasesForTitle('Entities', 'index')).toEqual(['Entities']);
  expect(aliasesForTitle('Coca Cola Wiki', 'index')).toEqual(['Coca Cola Wiki']);
});

test('aliasesForTitle: special characters are preserved for js-yaml to escape', () => {
  expect(aliasesForTitle('Source: Golden Master.pdf', 'golden-master')).toEqual([
    'Source: Golden Master.pdf',
  ]);
  expect(aliasesForTitle('', 'anything')).toBeUndefined();
});

test('enforceAliasesInMarkdown adds, removes, and preserves as appropriate', () => {
  const withFrontmatter = matter.stringify('\nBody text.\n', {
    title: 'John Smith',
    type: 'entity',
    updated: '2026-07-19T00:00:00.000Z',
  });
  const enforced = matter(enforceAliasesInMarkdown(withFrontmatter, 'John Smith', 'john-smith'));
  expect(enforced.data.aliases).toEqual(['John Smith']);
  expect(enforced.data.title).toBe('John Smith');
  expect(enforced.content).toContain('Body text.');

  // A stale alias is removed when the title matches the slug case-insensitively.
  const stale = matter.stringify('\nBody text.\n', {
    title: 'Secretary',
    type: 'entity',
    aliases: ['Secretary'],
    updated: '2026-07-19T00:00:00.000Z',
  });
  const cleaned = matter(enforceAliasesInMarkdown(stale, 'Secretary', 'secretary'));
  expect(cleaned.data.aliases).toBeUndefined();

  // Pages without a frontmatter block are returned unchanged (never invented).
  const bare = 'No frontmatter here.\n';
  expect(enforceAliasesInMarkdown(bare, 'Some Title', 'some-title')).toBe(bare);
});

test('entity page frontmatter carries the title alias when title differs from slug', () => {
  const page = writeEntityPage({
    title: 'John Smith',
    slug: 'john-smith',
    folder: 'entities/people',
    type: 'person',
    wiki: 'test-wiki',
    mentions: [],
    relationships: [],
    claims: [],
    slugToTitle: {},
  });
  const parsed = matter(page);
  expect(parsed.data.aliases).toEqual(['John Smith']);
});

test('entity page frontmatter omits the alias on a case-insensitive title/slug match', () => {
  const page = writeEntityPage({
    title: 'Secretary',
    slug: 'secretary',
    folder: 'entities/people',
    type: 'person',
    wiki: 'test-wiki',
    mentions: [],
    relationships: [],
    claims: [],
    slugToTitle: {},
  });
  const parsed = matter(page);
  expect(parsed.data.aliases).toBeUndefined();
});

test('topic page frontmatter follows the alias rule', () => {
  const aliased = writeTopicPage({
    title: 'Financial Performance',
    slug: 'financial-performance',
    folder: 'topics/financial-performance',
    wiki: 'test-wiki',
    claims: [],
    slugToTitle: {},
  });
  expect(matter(aliased).data.aliases).toEqual(['Financial Performance']);

  const matched = writeTopicPage({
    title: 'Financial',
    slug: 'financial',
    folder: 'topics/financial',
    wiki: 'test-wiki',
    claims: [],
    slugToTitle: {},
  });
  expect(matter(matched).data.aliases).toBeUndefined();
});

test('source page frontmatter carries the "Source: <file>" alias with YAML-safe escaping', () => {
  const page = renderSourcePage({
    wiki: 'test-wiki',
    fileName: 'Golden Master.pdf',
    filePath: 'wikis/test-wiki/raw/Golden Master.pdf',
    sourceSlug: 'golden-master',
    sha256: 'abc123',
    pageCount: 3,
    ingested: '2026-07-19T00:00:00.000Z',
    updated: '2026-07-19T00:00:00.000Z',
    warnings: [],
    documentPages: [],
  });
  const parsed = matter(page);
  expect(parsed.data.aliases).toEqual(['Source: Golden Master.pdf']);
});

test('document pages written by ingest carry no aliases field', async () => {
  const workspace = makeTempDir('llm-wiki-phase3-aliases-doc-');
  await init('test-wiki', { workspace });
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  copyFileSync(GOLDEN_MASTER_PDF, join(wikiDir, 'raw', 'golden-master.pdf'));

  await ingest('test-wiki', { workspace, extract: false });

  const documents = readdirSync(join(wikiDir, 'documents')).filter(
    (name) => name.endsWith('.md') && name !== 'index.md',
  );
  expect(documents.length).toBeGreaterThan(0);
  for (const name of documents) {
    const parsed = matter(readFileSync(join(wikiDir, 'documents', name), 'utf-8'));
    // The document page title always equals its chunk-id basename.
    expect(parsed.data.title).toBe(name.replace(/\.md$/, ''));
    expect(parsed.data.aliases).toBeUndefined();
  }
});

// ---------------------------------------------------------------------------
// 2026-07-20 user-directed change: Obsidian-native pipe-form wikilinks
// (compliance-log entry [2026-07-20 00:15]). Unit tests for the shared helper
// in src/utils/wikilinks.ts — the single home for link formatting/parsing.
// ---------------------------------------------------------------------------
test('formatWikilink emits the pipe form when display differs from target', () => {
  expect(formatWikilink('board-of-directors', 'Board of Directors')).toBe(
    '[[board-of-directors|Board of Directors]]',
  );
  expect(formatWikilink('entities/people/executives/index', 'Executives')).toBe(
    '[[entities/people/executives/index|Executives]]',
  );
  expect(formatWikilink('index', 'Coca Cola Wiki')).toBe('[[index|Coca Cola Wiki]]');
  // Case-only differences still get the pipe form (equality is exact).
  expect(formatWikilink('secretary', 'Secretary')).toBe('[[secretary|Secretary]]');
});

test('formatWikilink emits the bare form when display is missing or equals the target', () => {
  expect(formatWikilink('secretary', 'secretary')).toBe('[[secretary]]');
  expect(formatWikilink('golden-master-part-001')).toBe('[[golden-master-part-001]]');
  expect(formatWikilink('some-file', '')).toBe('[[some-file]]');
});

test('formatWikilink trims target and display', () => {
  expect(formatWikilink('  acme-corp ', ' Acme Corp ')).toBe('[[acme-corp|Acme Corp]]');
});

test('parseWikilinkTarget splits on the first pipe only', () => {
  expect(parseWikilinkTarget('board-of-directors|Board of Directors')).toEqual({
    target: 'board-of-directors',
    display: 'Board of Directors',
  });
  expect(parseWikilinkTarget('a|b|c')).toEqual({ target: 'a', display: 'b|c' });
  expect(parseWikilinkTarget('Acme Corp')).toEqual({ target: 'Acme Corp' });
});

test('parseWikilinkTarget keeps special characters in the display text', () => {
  expect(
    parseWikilinkTarget("board-of-directors|The Coca-Cola Company's Board of Directors"),
  ).toEqual({
    target: 'board-of-directors',
    display: "The Coca-Cola Company's Board of Directors",
  });
  expect(parseWikilinkTarget('golden-master|Source: Golden Master')).toEqual({
    target: 'golden-master',
    display: 'Source: Golden Master',
  });
});

test('parseWikilinkTarget trims and treats an empty display as absent', () => {
  expect(parseWikilinkTarget('  acme-corp | Acme Corp  ')).toEqual({
    target: 'acme-corp',
    display: 'Acme Corp',
  });
  expect(parseWikilinkTarget('acme-corp|')).toEqual({ target: 'acme-corp' });
});
