import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, expect, test, vi } from 'vitest';
import matter from 'gray-matter';
import { init } from '../src/commands/init';
import { ingest } from '../src/commands/ingest';
import { materialize } from '../src/materializer';
import { writeDoxContracts } from '../src/dox-writer';
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
      context: 'Fake extraction fixture for Phase 6 DOX Writer tests.',
    },
  };
}

function setupMaterializedWiki(): string {
  const workspace = makeTempDir('llm-wiki-phase6-');
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  init('test-wiki', { workspace });
  mkdirSync(join(wikiDir, 'raw'), { recursive: true });
  copyFileSync(GOLDEN_MASTER_PDF, join(wikiDir, 'raw', 'golden-master.pdf'));
  installFakeChunk(wikiDir, fakeExtraction());
  // Add a minimal source page so the sources/ folder gets an index.md.
  mkdirSync(join(wikiDir, 'sources'), { recursive: true });
  writeFileSync(
    join(wikiDir, 'sources', 'golden-master.md'),
    '---\ntitle: "Source: Golden Master"\ntype: source\nwiki: test-wiki\nfile: wikis/test-wiki/raw/golden-master.pdf\nsha256: abc123\npages: 3\ningested: 2026-07-16T10:00:00Z\nupdated: 2026-07-16T10:00:00Z\n---\n\nSource page.',
    'utf-8',
  );
  return workspace;
}

function listFolders(wikiDir: string): string[] {
  const folders: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== '.state' && entry.name !== 'raw') {
        folders.push(join(dir, entry.name));
        walk(join(dir, entry.name));
      }
    }
  }
  walk(wikiDir);
  return folders;
}

function countContentFiles(dir: string): number {
  let count = 0;
  function walk(current: string): void {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md') && entry.name !== 'index.md') {
        count++;
      }
    }
  }
  walk(dir);
  return count;
}

// ---------------------------------------------------------------------------
// Gate 6.1: Every Folder Has an index.md
// ---------------------------------------------------------------------------
test('every folder has an index.md', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  await writeDoxContracts('test-wiki', { workspace });

  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  const folders = listFolders(wikiDir);
  for (const folder of folders) {
    expect(existsSync(join(folder, 'index.md'))).toBe(true);
  }
});

// ---------------------------------------------------------------------------
// Gate 6.2: index.md Lists All Children
// ---------------------------------------------------------------------------
test('index.md lists all pages in folder', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  await writeDoxContracts('test-wiki', { workspace });

  const index = readFileSync(
    join(workspace, 'wikis', 'test-wiki', 'entities', 'people', 'executives', 'index.md'),
    'utf-8',
  );
  const parsed = matter(index);
  expect(parsed.data.children).toContain('john-smith.md');
});

// ---------------------------------------------------------------------------
// Gate 6.3: Wiki-Level index.md Links to Top Folders
// ---------------------------------------------------------------------------
test('wiki-level index.md links to all top folders', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  await writeDoxContracts('test-wiki', { workspace });

  const index = readFileSync(join(workspace, 'wikis', 'test-wiki', 'index.md'), 'utf-8');
  expect(index).toContain('entities/');
  expect(index).toContain('topics/');
  expect(index).toContain('documents/');
  expect(index).toContain('sources/');
});

// ---------------------------------------------------------------------------
// Gate 6.4: index.md Has Valid Frontmatter
// ---------------------------------------------------------------------------
test('index.md has valid YAML frontmatter', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  await writeDoxContracts('test-wiki', { workspace });

  const index = readFileSync(join(workspace, 'wikis', 'test-wiki', 'index.md'), 'utf-8');
  const parsed = matter(index);
  expect(parsed.data.type).toBe('index');
  expect(parsed.data.title).toBeTruthy();
  expect(parsed.data.children).toBeInstanceOf(Array);
});

// ---------------------------------------------------------------------------
// Gate 6.5: index.md Statistics Are Accurate
// ---------------------------------------------------------------------------
test('index.md statistics are accurate', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  await writeDoxContracts('test-wiki', { workspace });

  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  const index = readFileSync(join(wikiDir, 'index.md'), 'utf-8');

  const entityCount = countContentFiles(join(wikiDir, 'entities'));
  const topicCount = countContentFiles(join(wikiDir, 'topics'));
  const documentCount = countContentFiles(join(wikiDir, 'documents'));
  const sourceCount = countContentFiles(join(wikiDir, 'sources'));

  expect(index).toContain(`Entity pages: ${entityCount}`);
  expect(index).toContain(`Topic pages: ${topicCount}`);
  expect(index).toContain(`Document pages: ${documentCount}`);
  expect(index).toContain(`Sources: ${sourceCount}`);
});

// ---------------------------------------------------------------------------
// Gate 6.6: Re-Running Ingest Regenerates Contracts
// LLM-free deviation: ingest is driven by an injected extractChunkFn stub so
// the gate verifies that ingest() regenerates index.md without a key.
// ---------------------------------------------------------------------------
test('re-ingest regenerates index.md files', async () => {
  const workspace = setupMaterializedWiki();
  const wikiDir = join(workspace, 'wikis', 'test-wiki');

  const stubExtraction: ExtractorResult = fakeExtraction().extraction;
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

  const executivesIndexPath = join(
    wikiDir,
    'entities',
    'people',
    'executives',
    'index.md',
  );
  const firstIndex = readFileSync(executivesIndexPath, 'utf-8');
  const firstMtime = statSync(executivesIndexPath).mtimeMs;

  // Add a new entity page manually and re-run ingest.
  mkdirSync(join(wikiDir, 'entities', 'people', 'executives'), { recursive: true });
  writeFileSync(
    join(wikiDir, 'entities', 'people', 'executives', 'new-person.md'),
    '---\ntitle: "New Person"\ntype: entity\nupdated: 2026-07-16T10:00:00Z\n---\n\nNew entity page.',
    'utf-8',
  );

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

  const secondIndex = readFileSync(executivesIndexPath, 'utf-8');
  const secondMtime = statSync(executivesIndexPath).mtimeMs;

  expect(secondIndex).not.toBe(firstIndex);
  expect(secondIndex).toContain('new-person.md');
  expect(secondMtime).toBeGreaterThan(firstMtime);
});

// ---------------------------------------------------------------------------
// Supplementary: DOX Writer skips raw/ and .state/.
// ---------------------------------------------------------------------------
test('DOX Writer does not index raw or .state folders', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  await writeDoxContracts('test-wiki', { workspace });

  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  expect(existsSync(join(wikiDir, 'raw', 'index.md'))).toBe(false);
  expect(existsSync(join(wikiDir, '.state', 'index.md'))).toBe(false);
});

// ---------------------------------------------------------------------------
// Supplementary: folder-level index has valid frontmatter and children.
// ---------------------------------------------------------------------------
test('folder-level index has type index and children array', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  await writeDoxContracts('test-wiki', { workspace });

  const index = readFileSync(
    join(workspace, 'wikis', 'test-wiki', 'entities', 'people', 'index.md'),
    'utf-8',
  );
  const parsed = matter(index);
  expect(parsed.data.type).toBe('index');
  expect(parsed.data.title).toBe('People');
  expect(parsed.data.children).toBeInstanceOf(Array);
  expect(parsed.data.children).toContain('executives/index.md');
});

// ---------------------------------------------------------------------------
// Supplementary: DOX Writer integration runs via ingest(extract: false).
// ---------------------------------------------------------------------------
test('ingest without extraction still writes DOX contracts', async () => {
  const workspace = setupMaterializedWiki();
  await ingest('test-wiki', { workspace, extract: false });
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  expect(existsSync(join(wikiDir, 'index.md'))).toBe(true);
  expect(existsSync(join(wikiDir, 'documents', 'index.md'))).toBe(true);
  expect(existsSync(join(wikiDir, 'sources', 'index.md'))).toBe(true);
});
