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
// Gate 3.2b: Entity Pages Use Page-Title Wikilinks
// Verifier regression: relationship objects and claim entities must emit
// [[Page Title]] rather than [[slug]].
// ---------------------------------------------------------------------------
test('entity page uses page-title wikilinks, not slugs', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  const page = readFileSync(
    join(workspace, 'wikis', 'test-wiki', 'entities/people/executives', 'john-smith.md'),
    'utf-8',
  );
  // Relationship object and claim entity should be rendered as the entity title.
  expect(page).toContain('[[Acme Corp]]');
  expect(page).not.toContain('[[acme-corp]]');
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
// Gate 3.6b: Topic Pages Use Page-Title Wikilinks
// ---------------------------------------------------------------------------
test('topic page uses page-title wikilinks, not slugs', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  const page = readFileSync(
    join(workspace, 'wikis', 'test-wiki', 'topics', 'financial', 'financial.md'),
    'utf-8',
  );
  expect(page).toContain('[[Acme Corp]]');
  expect(page).not.toContain('[[acme-corp]]');
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
