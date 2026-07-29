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
import { writeDoxContracts, writeWorkspaceIndex, parseWorkspaceSegments } from '../src/dox-writer';
import type { DoxIndexContext, DoxWorkspaceEntryContext, DoxWorkspaceProseContext } from '../src/dox-writer';
import { checkLinks } from '../src/validation/link-checker';
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
// 2026-07-19 refinement, test 1: bottom-up child-index synthesis.
// A parent folder's LLM context must contain the EXACT child index markdown
// written earlier in the same run, and children must be processed before
// their parent (deepest-first post-order at every level).
// ---------------------------------------------------------------------------
test('parent folders receive freshly-written child index content (bottom-up synthesis)', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  const calls: Array<{ label: string; context: DoxIndexContext }> = [];
  await writeDoxContracts('test-wiki', {
    workspace,
    doxLlm: true,
    writeDoxIndexFn: (context) => {
      calls.push({ label: context.contextLabel, context });
      return Promise.resolve(richStubIndex(context));
    },
  });

  // Post-order: every folder is processed after all of its descendants.
  const order = calls.map((call) => call.label);
  const indexOf = (label: string) => order.indexOf(label);
  expect(indexOf('entities/people/executives')).toBeGreaterThanOrEqual(0);
  expect(indexOf('entities/people/executives')).toBeLessThan(indexOf('entities/people'));
  expect(indexOf('entities/people')).toBeLessThan(indexOf('entities'));
  expect(indexOf('entities')).toBeLessThan(indexOf('(root)'));

  // The parent's context carries the exact child index markdown from this run.
  const peopleCall = calls.find((call) => call.label === 'entities/people');
  expect(peopleCall).toBeDefined();
  const childEntry = peopleCall!.context.childIndexes.find(
    (child) => child.path === 'entities/people/executives/index.md',
  );
  expect(childEntry).toBeDefined();
  const writtenChild = readFileSync(
    join(workspace, 'wikis', 'test-wiki', 'entities', 'people', 'executives', 'index.md'),
    'utf-8',
  );
  expect(childEntry!.content).toBe(writtenChild);

  // The wiki root reads the top-folder indexes through the same mechanism.
  const rootCall = calls.find((call) => call.label === '(root)');
  expect(rootCall).toBeDefined();
  const entitiesEntry = rootCall!.context.childIndexes.find((child) => child.path === 'entities/index.md');
  expect(entitiesEntry).toBeDefined();
  const writtenEntities = readFileSync(join(workspace, 'wikis', 'test-wiki', 'entities', 'index.md'), 'utf-8');
  expect(entitiesEntry!.content).toBe(writtenEntities);
});

// ---------------------------------------------------------------------------
// 2026-07-19 refinement, test 2: zero-page parent folder.
// A folder with only sub-folders must get the LLM's rich synthesis (NOT the
// generic deterministic template), with `## Pages` cataloguing the child
// folders — the required-sections fallback must not fire.
// ---------------------------------------------------------------------------
test('zero-page parent folder synthesizes child folders instead of falling back', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  let warnCount = 0;
  try {
    await writeDoxContracts('test-wiki', {
      workspace,
      doxLlm: true,
      writeDoxIndexFn: (context) => {
        // Scoped to entities/people (2026-07-25): any zero-page parent matched
        // this branch before, but its body catalogs only the executives child —
        // the catalog completeness enforcement rejects that for other folders.
        if (context.folderPath === 'entities/people' && context.pages.length === 0 && context.childIndexes.length > 0) {
          const body = [
            `# ${context.title}`,
            '',
            'This area groups the executive leadership profiles covered by its child folder, which profiles John Smith, the CEO of Acme Corp.',
            '',
            '## Pages',
            '',
            '- [[entities/people/executives/index|Executives]] — Executive leadership profiles, including CEO John Smith',
            '',
            '## Navigation',
            '',
            `- Parent: ${context.parentLinkText}`,
            '',
            '## Statistics',
            '',
            '- Pages: 0',
            '- Sub-folders: 1',
            '- Sources: 0',
            '',
          ].join('\n');
          return Promise.resolve(body);
        }
        return Promise.resolve(richStubIndex(context));
      },
    });
    // Captured before mockRestore (which clears the recorded calls).
    warnCount = warnSpy.mock.calls.length;
  } finally {
    warnSpy.mockRestore();
  }

  const index = readFileSync(join(workspace, 'wikis', 'test-wiki', 'entities', 'people', 'index.md'), 'utf-8');

  // The stub's synthesis was used — not the generic deterministic template.
  expect(index).toContain('This area groups the executive leadership profiles');
  expect(index).not.toContain('This folder contains pages and sub-folders related to people.');

  // `## Pages` catalogues the child folder in pipe form; no "No pages" placeholder.
  expect(index).toContain('## Pages');
  expect(index).toContain('[[entities/people/executives/index|Executives]]');
  expect(index).not.toContain('No pages in this folder');

  // No required-sections fallback and no link repairs were needed.
  expect(warnCount).toBe(0);
});

// ---------------------------------------------------------------------------
// 2026-07-19 refinement, test 3: deterministic wikilink safeguard (reworked
// 2026-07-20 for the Obsidian-native pipe form).
// (a) An unresolvable link that uniquely matches a wiki page by title is
//     rewritten to that page's canonical pipe form [[basename|Title]].
// (b) An unresolvable link matching nothing is de-linked (brackets stripped,
//     display text kept). Final validation: zero broken links on index pages.
// ---------------------------------------------------------------------------
test('unresolvable LLM wikilinks are repaired or de-linked deterministically', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  let repairWarningCount = 0;
  try {
    await writeDoxContracts('test-wiki', {
      workspace,
      doxLlm: true,
      writeDoxIndexFn: (context) => {
        if (context.folderPath === 'sources') {
          // 'sources/golden-master.md' has title "Source: Golden Master", so
          // [[Source: Golden Master]] matches that page uniquely by title —
          // the live-run failure mode this repair fixes. The bare-title form
          // is kept in the PROSE (exercising the repair); the ## Pages catalog
          // uses the exact supplied form (2026-07-25 completeness enforcement).
          const body = [
            '# Sources',
            '',
            'This folder holds the provenance record for the ingested PDF, described by [[Source: Golden Master]] and cross-referenced from [[Nonexistent Thing]].',
            '',
            '## Pages',
            '',
            '- [[golden-master|Source: Golden Master]] — Provenance record for the golden master PDF',
            '',
            '## Navigation',
            '',
            '- Parent: [[Test Wiki]]',
            '',
            '## Statistics',
            '',
            '- Pages: 1',
            '- Sub-folders: 0',
            '- Sources: 1',
            '',
          ].join('\n');
          return Promise.resolve(body);
        }
        return Promise.resolve(richStubIndex(context));
      },
    });
    // Captured before mockRestore (which clears the recorded calls).
    repairWarningCount = warnSpy.mock.calls.filter((args) => String(args[0]).includes('repaired')).length;
  } finally {
    warnSpy.mockRestore();
  }

  const sourcesIndex = readFileSync(join(workspace, 'wikis', 'test-wiki', 'sources', 'index.md'), 'utf-8');

  // (a) Unique title match -> rewritten to the canonical pipe form.
  expect(sourcesIndex).not.toContain('[[Source: Golden Master]]');
  expect(sourcesIndex).toContain('[[golden-master|Source: Golden Master]]');

  // (b) No match -> brackets stripped, display text kept.
  expect(sourcesIndex).toContain('Nonexistent Thing');
  expect(sourcesIndex).not.toContain('[[Nonexistent Thing]]');

  // Resolvable-but-bare legacy links are normalized to the canonical pipe
  // form: [[Test Wiki]] resolves via the wiki-root fallback and becomes
  // [[index|Test Wiki]].
  expect(sourcesIndex).toContain('- Parent: [[index|Test Wiki]]');

  // A single repair summary line for the folder — no console spam.
  expect(repairWarningCount).toBe(1);

  // The wiki's own link validation reports zero broken links on index pages.
  const links = await checkLinks('test-wiki', workspace);
  expect(links.broken.filter((entry) => entry.page.endsWith('index.md'))).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 6.17 (2026-07-25 navigation fix, user-ratified): catalog completeness.
// Every index must catalog ALL its direct pages and child folders with their
// exact supplied link forms — the wiki root included (Start Here is curated;
// `## Pages` is complete) — and an index must never link to itself. A human
// or agent must be able to reach every page by following only the
// parent/child index chain (vision `03` §4.2). Completeness failures are
// content defects named in the reask feedback; exhaustion writes the
// fully-catalogued deterministic body.
// ---------------------------------------------------------------------------
test('gate 6.17a: the wiki-root LLM index catalogs all four top-area indexes', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  await writeDoxContracts('test-wiki', {
    workspace,
    doxLlm: true,
    writeDoxIndexFn: (context) => Promise.resolve(richStubIndex(context)),
  });

  const rootIndex = readFileSync(join(workspace, 'wikis', 'test-wiki', 'index.md'), 'utf-8');
  expect(rootIndex).toContain('## Start Here');
  expect(rootIndex).toContain('## Pages');
  for (const link of [
    '[[entities/index|Entities]]',
    '[[topics/index|Topics]]',
    '[[documents/index|Documents]]',
    '[[sources/index|Sources]]',
  ]) {
    expect(rootIndex).toContain(link);
  }
});

test('gate 6.17b: a folder index missing a page catalog link is re-asked with the exact target named', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  const seenFeedback: Array<string | undefined> = [];
  let executivesCalls = 0;
  await writeDoxContracts('test-wiki', {
    workspace,
    doxLlm: true,
    writeDoxIndexFn: (context, feedback) => {
      if (context.folderPath !== 'entities/people/executives') {
        return Promise.resolve(richStubIndex(context));
      }
      executivesCalls++;
      seenFeedback.push(feedback);
      if (executivesCalls === 1) {
        // Catalogs nothing — omits the required [[john-smith|John Smith]] link.
        return Promise.resolve(
          [
            '# Executives',
            '',
            'Prose.',
            '',
            '## Pages',
            '',
            '- No pages in this folder.',
            '',
            '## Navigation',
            '',
            '- Parent: [[entities/people/index|People]]',
            '',
            '## Statistics',
            '',
            '- placeholder',
            '',
          ].join('\n'),
        );
      }
      return Promise.resolve(richStubIndex(context));
    },
  });

  expect(executivesCalls).toBe(2);
  expect(seenFeedback[0]).toBeUndefined(); // attempt 1: byte-identical prompt
  const feedback = seenFeedback[1] ?? '';
  expect(feedback).toContain('missing catalog link');
  expect(feedback).toContain('"john-smith"');
  const index = readFileSync(
    join(workspace, 'wikis', 'test-wiki', 'entities', 'people', 'executives', 'index.md'),
    'utf-8',
  );
  expect(index).toContain('[[john-smith|John Smith]]');
});

test('gate 6.17c: a self-referential catalog link is rejected and named in the feedback', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  // Mirrors the live 2026-07-25 defect: a single-page folder whose `## Pages`
  // bullet links its own index (circular) instead of the content page.
  const seenFeedback: Array<string | undefined> = [];
  let executivesCalls = 0;
  await writeDoxContracts('test-wiki', {
    workspace,
    doxLlm: true,
    writeDoxIndexFn: (context, feedback) => {
      if (context.folderPath !== 'entities/people/executives') {
        return Promise.resolve(richStubIndex(context));
      }
      executivesCalls++;
      seenFeedback.push(feedback);
      if (executivesCalls === 1) {
        return Promise.resolve(
          [
            '# Executives',
            '',
            'Prose.',
            '',
            '## Pages',
            '',
            '- [[entities/people/executives/index|Executives]] — links itself instead of the page',
            '',
            '## Navigation',
            '',
            '- Parent: [[entities/people/index|People]]',
            '',
            '## Statistics',
            '',
            '- placeholder',
            '',
          ].join('\n'),
        );
      }
      return Promise.resolve(richStubIndex(context));
    },
  });

  expect(executivesCalls).toBe(2);
  const feedback = seenFeedback[1] ?? '';
  expect(feedback).toContain('self-referential link');
  expect(feedback).toContain('entities/people/executives/index');
  // The missing page link is named in the same feedback.
  expect(feedback).toContain('"john-smith"');
});

test('gate 6.17d: exhausted retries write the deterministic body — fully catalogued at every level', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  await writeDoxContracts('test-wiki', {
    workspace,
    doxLlm: true,
    writeDoxIndexFn: () => Promise.resolve('garbage with no sections'),
  });

  // The root fallback carries the complete four-child catalog.
  const rootIndex = readFileSync(join(workspace, 'wikis', 'test-wiki', 'index.md'), 'utf-8');
  expect(rootIndex).toContain('## Pages');
  for (const link of [
    '[[entities/index|Entities]]',
    '[[topics/index|Topics]]',
    '[[documents/index|Documents]]',
    '[[sources/index|Sources]]',
  ]) {
    expect(rootIndex).toContain(link);
  }

  // A folder fallback catalogs its pages.
  const executives = readFileSync(
    join(workspace, 'wikis', 'test-wiki', 'entities', 'people', 'executives', 'index.md'),
    'utf-8',
  );
  expect(executives).toContain('[[john-smith|John Smith]]');
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

// ---------------------------------------------------------------------------
// Gate 6.7: DOX Pages Pass Final Validation
// LLM-free deviation: ingest is driven by an injected extractChunkFn stub so
// the gate verifies first + final validation without a key (phase doc §3.5:
// validate content pages -> DOX Writer -> re-validate wiki).
// ---------------------------------------------------------------------------
test('DOX pages pass final validation', async () => {
  const workspace = setupMaterializedWiki();
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  const stubExtraction: ExtractorResult = fakeExtraction().extraction;

  const result = await ingest('test-wiki', {
    workspace,
    extractChunkFn: () =>
      Promise.resolve({
        chunkId: 'golden-master-part-001',
        result: stubExtraction,
        jsonPath: join(wikiDir, '.state', 'extracted', 'golden-master-part-001.json'),
        jsonRelativePath: '.state/extracted/golden-master-part-001.json',
      }),
  });

  // First (content-page) validation is preserved...
  expect(result.validation).toBeDefined();
  // ...and the final validation pass covers the wiki including the DOX pages.
  expect(result.finalValidation).toBeDefined();
  expect(result.finalValidation?.links.broken).toEqual([]);
  expect(result.finalValidation?.schema.invalid).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 6.8: Descriptions Are Content-Based
// LLM-free: the DOX Writer's LLM is replaced by an injected writeDoxIndexFn
// stub returning rich, content-based prose with deliberately WRONG frontmatter
// and statistics — proving the LLM writes the description while deterministic
// code re-imposes children and counts (vision `03` §6).
// ---------------------------------------------------------------------------
function richStubIndex(context: {
  isRoot: boolean;
  title: string;
  parentLinkText?: string;
  pages?: Array<{ name: string; title: string; linkText: string }>;
  childIndexes?: Array<{ path: string; title: string; linkText: string }>;
}): string {
  // Links use the Obsidian-native pipe form (2026-07-20 user-directed
  // change), matching what the prompt now instructs the LLM to emit.
  // 2026-07-25 navigation fix: the `## Pages` catalog must be COMPLETE —
  // every direct page and every child folder with its exact supplied link
  // form (the root catalogs its four top-area indexes too) — or the catalog
  // completeness enforcement rejects the body as a content defect.
  const catalogLines = [
    ...(context.childIndexes ?? []).map((child) => `- ${child.linkText} — ${child.title} area`),
    ...(context.pages ?? []).map((page) => `- ${page.linkText} — ${page.title || 'untitled'} page`),
  ];
  const body = context.isRoot
    ? [
        '# Test Wiki',
        '',
        "This wiki traces executive leadership and financial performance at Acme Corp, including John Smith, the CEO of Acme Corp, and the company's quarterly revenue results.",
        '',
        '## Start Here',
        '',
        '- [[entities/people/executives/index|Executives]] — Executive leadership at Acme Corp, including CEO John Smith',
        '- [[entities/companies/index|Companies]] — Acme Corp, the company whose results are presented',
        '',
        '## Pages',
        '',
        ...catalogLines,
        '',
        '## Statistics',
        '',
        '- Sources: 999',
        '- Document pages: 999',
        '- Entity pages: 999',
        '- Topic pages: 999',
        '',
      ].join('\n')
    : [
        `# ${context.title}`,
        '',
        'This folder profiles executive leadership at Acme Corp: John Smith, the CEO of Acme Corp, with every mention, relationship, and claim cited back to the source PDF pages.',
        '',
        '## Pages',
        '',
        ...catalogLines,
        '',
        '## Navigation',
        '',
        // The real parent from the context (2026-07-25): a hardcoded parent
        // is the folder's OWN index when the stub serves `entities/people`,
        // and the self-link ban rejects self-referential bodies.
        `- Parent: ${context.parentLinkText ?? '[[entities/people/index|People]]'}`,
        '',
        '## Statistics',
        '',
        '- Pages: 999',
        '- Sub-folders: 999',
        '- Sources: 999',
        '',
      ].join('\n');
  // Deliberately hallucinated frontmatter: enforcement must discard all of it.
  return matter.stringify(body, {
    title: 'Hallucinated Title',
    type: 'entity',
    wiki: 'wrong-wiki',
    updated: '2020-01-01T00:00:00.000Z',
    children: ['ghost.md'],
  });
}

test('folder index description reflects actual content', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  await writeDoxContracts('test-wiki', {
    workspace,
    doxLlm: true,
    writeDoxIndexFn: (context) => Promise.resolve(richStubIndex(context)),
  });

  const index = readFileSync(
    join(workspace, 'wikis', 'test-wiki', 'entities', 'people', 'executives', 'index.md'),
    'utf-8',
  );

  // Rich, content-based description — not the generic template.
  expect(index.toLowerCase()).toContain('executive');
  expect(index).toContain('CEO of Acme Corp');
  expect(index).not.toContain('This folder contains pages and sub-folders related to');

  // Deterministic enforcement: frontmatter is re-imposed even though the stub
  // returned hallucinated frontmatter (the LLM cannot hallucinate files).
  const parsed = matter(index);
  expect(parsed.data.type).toBe('index');
  expect(parsed.data.title).toBe('Executives');
  expect(parsed.data.wiki).toBe('test-wiki');
  expect(parsed.data.children).toEqual(['john-smith.md']);
  expect(index).not.toContain('ghost.md');

  // Deterministic enforcement: statistics are re-imposed even though the stub
  // returned wrong counts (the LLM cannot hallucinate counts).
  expect(index).toContain('- Pages: 1');
  expect(index).toContain('- Sub-folders: 0');
  expect(index).toContain('- Sources: 0');
  expect(index).not.toContain('999');

  // The same enforcement holds at the wiki root.
  const rootIndex = readFileSync(join(workspace, 'wikis', 'test-wiki', 'index.md'), 'utf-8');
  const parsedRoot = matter(rootIndex);
  expect(parsedRoot.data.children).toEqual([
    'entities/index.md',
    'topics/index.md',
    'documents/index.md',
    'sources/index.md',
  ]);
  expect(rootIndex).toContain('- Entity pages: 2');
  expect(rootIndex).not.toContain('999');
});

// ---------------------------------------------------------------------------
// Supplementary: LLM failure falls back to the deterministic contract.
// A missing API key / failed LLM call must never crash the DOX Writer — the
// folder simply gets the deterministic contract (vision `03` §6).
// ---------------------------------------------------------------------------
test('DOX LLM failure falls back to the deterministic contract', async () => {
  // Reference run: fully deterministic contracts.
  const workspaceDeterministic = setupMaterializedWiki();
  await materialize('test-wiki', { workspace: workspaceDeterministic });
  await writeDoxContracts('test-wiki', { workspace: workspaceDeterministic });

  // LLM run where every LLM call throws.
  const workspaceLlm = setupMaterializedWiki();
  await materialize('test-wiki', { workspace: workspaceLlm });
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    await writeDoxContracts('test-wiki', {
      workspace: workspaceLlm,
      doxLlm: true,
      writeDoxIndexFn: () => Promise.reject(new Error('LLM unavailable')),
    });
    expect(warnSpy).toHaveBeenCalled();
  } finally {
    warnSpy.mockRestore();
  }

  // The fallback contract equals the deterministic contract (ignoring the
  // `updated` timestamp, which necessarily differs between two runs).
  const relativeIndexPath = join('entities', 'people', 'executives', 'index.md');
  const deterministic = readFileSync(
    join(workspaceDeterministic, 'wikis', 'test-wiki', relativeIndexPath),
    'utf-8',
  );
  const fallback = readFileSync(join(workspaceLlm, 'wikis', 'test-wiki', relativeIndexPath), 'utf-8');
  const normalize = (text: string) => text.replace(/^updated:.*$/m, 'updated: <timestamp>');
  expect(normalize(fallback)).toBe(normalize(deterministic));
  expect(fallback).toContain('This folder contains pages and sub-folders related to executives.');
});

// ---------------------------------------------------------------------------
// UAT 6.3 aliases fix (user decision 2026-07-19, Option A): every index.md
// carries `aliases: [<folder/wiki title>]` so title-form wikilinks like
// [[Entities]] resolve in Obsidian. Covers the deterministic path and the
// LLM-enforced path (deterministic frontmatter re-imposition). LLM-free.
// ---------------------------------------------------------------------------
test('materialized wiki + DOX contracts produce index pages with folder-title aliases', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  await writeDoxContracts('test-wiki', { workspace });

  const wikiDir = join(workspace, 'wikis', 'test-wiki');

  // Folder indexes: alias is the folder title (basename is always 'index').
  const entitiesIndex = matter(readFileSync(join(wikiDir, 'entities', 'index.md'), 'utf-8'));
  expect(entitiesIndex.data.aliases).toEqual(['Entities']);
  const executivesIndex = matter(
    readFileSync(join(wikiDir, 'entities', 'people', 'executives', 'index.md'), 'utf-8'),
  );
  expect(executivesIndex.data.aliases).toEqual(['Executives']);

  // Root index: alias is the wiki title.
  const rootIndex = matter(readFileSync(join(wikiDir, 'index.md'), 'utf-8'));
  expect(rootIndex.data.aliases).toEqual(['Test Wiki']);

  // Content pages from the same run follow the same rule.
  const entityPage = matter(
    readFileSync(join(wikiDir, 'entities', 'people', 'executives', 'john-smith.md'), 'utf-8'),
  );
  expect(entityPage.data.aliases).toEqual(['John Smith']);
  const documentPage = matter(
    readFileSync(join(wikiDir, 'documents', 'golden-master-part-001.md'), 'utf-8'),
  );
  expect(documentPage.data.aliases).toBeUndefined();
});

test('LLM-mode DOX contracts re-impose aliases over model-written frontmatter', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });

  await writeDoxContracts('test-wiki', {
    workspace,
    doxLlm: true,
    writeDoxIndexFn: (context) => Promise.resolve(richStubIndex(context)),
  });

  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  // The stub returns hallucinated frontmatter; the deterministic re-imposition
  // must still produce the correct alias for both a folder and the root.
  const executivesIndex = matter(
    readFileSync(join(wikiDir, 'entities', 'people', 'executives', 'index.md'), 'utf-8'),
  );
  expect(executivesIndex.data.title).toBe('Executives');
  expect(executivesIndex.data.aliases).toEqual(['Executives']);
  const rootIndex = matter(readFileSync(join(wikiDir, 'index.md'), 'utf-8'));
  expect(rootIndex.data.aliases).toEqual(['Test Wiki']);
});

// ---------------------------------------------------------------------------
// 2026-07-20 user-directed change: deterministic DOX catalogs and navigation
// use Obsidian-native pipe-form wikilinks (compliance-log entry
// [2026-07-20 00:15]) — content pages [[basename|Title]], folder indexes
// [[<folder-path>/index|Title]], wiki root [[index|Wiki Title]]. LLM-free.
// ---------------------------------------------------------------------------
test('deterministic DOX contracts use pipe-form wikilinks in catalogs and navigation', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  await writeDoxContracts('test-wiki', { workspace });

  const wikiDir = join(workspace, 'wikis', 'test-wiki');

  // Root Start Here links the top-folder indexes by path.
  const rootIndex = readFileSync(join(wikiDir, 'index.md'), 'utf-8');
  expect(rootIndex).toContain('[[entities/index|Entities]]');
  expect(rootIndex).toContain('[[topics/index|Topics]]');
  expect(rootIndex).toContain('[[documents/index|Documents]]');
  expect(rootIndex).toContain('[[sources/index|Sources]]');

  // Content-page catalog entry: basename target, title display.
  const executivesIndex = readFileSync(
    join(wikiDir, 'entities', 'people', 'executives', 'index.md'),
    'utf-8',
  );
  expect(executivesIndex).toContain('- [[john-smith|John Smith]]');
  expect(executivesIndex).toContain('- Parent: [[entities/people/index|People]]');

  // Zero-page parent catalogs its child folder by folder-path/index.
  const peopleIndex = readFileSync(join(wikiDir, 'entities', 'people', 'index.md'), 'utf-8');
  expect(peopleIndex).toContain('- [[entities/people/executives/index|Executives]]');
  expect(peopleIndex).toContain('- Parent: [[entities/index|Entities]]');

  // Top-level folder: root parent link + sibling folder links.
  const entitiesIndex = readFileSync(join(wikiDir, 'entities', 'index.md'), 'utf-8');
  expect(entitiesIndex).toContain('- Parent: [[index|Test Wiki]]');
  expect(entitiesIndex).toContain('- Sibling: [[topics/index|Topics]]');

  // No legacy bare title-form links remain on index pages, and the wiki's own
  // link validation reports zero broken links (gate 6.7's bar, pipe-aware).
  for (const indexPath of [rootIndex, executivesIndex, peopleIndex, entitiesIndex]) {
    expect(indexPath).not.toMatch(/\[\[(?!index\|)(?:[A-Z][a-z]+(?: [A-Z][a-z]+)+)\]\]/);
  }
  const links = await checkLinks('test-wiki', workspace);
  expect(links.broken.filter((entry) => entry.page.endsWith('index.md'))).toEqual([]);
});


// ---------------------------------------------------------------------------
// Workspace index (wikis/index-of-indexes.md) amendments:
// - 2026-07-20 (user-ratified): the workspace index is a DOX Writer output.
// - 2026-07-21 per-wiki segments (user-ratified): catalog lines are per-wiki
//   owned — an ingest refreshes only the triggering wiki's line.
// - 2026-07-21 prose model (user-ratified): the coherent cross-wiki prose
//   regenerates ONLY on wiki-set changes (add/remove) or when missing;
//   routine ingests preserve it byte-for-byte. Gates 6.9-6.16. LLM-free.
// ---------------------------------------------------------------------------

/** Build a second wiki with a hand-written root index next to test-wiki. */
async function setupSecondWiki(workspace: string): Promise<string> {
  const secondWikiDir = join(workspace, 'wikis', 'second-wiki');
  await init('second-wiki', { workspace });
  const secondRootBody = [
    '# Second Wiki',
    '',
    'This wiki profiles the Danish shipping industry: maersk-line entities and freight-rate topics from three annual reports.',
    '',
    '## Start Here',
    '',
    '- [[entities/index|Entities]] — Shipping companies and executives',
    '',
    '## Statistics',
    '',
    '- Sources: 3',
    '',
  ].join('\n');
  writeFileSync(
    join(secondWikiDir, 'index.md'),
    matter.stringify(secondRootBody, {
      title: 'Second Wiki',
      type: 'index',
      wiki: 'second-wiki',
      updated: new Date().toISOString(),
      children: ['entities/index.md'],
    }),
    'utf-8',
  );
  return secondWikiDir;
}

// Gate 6.9: Workspace Index Exists and Lists All Wikis
test('workspace index-of-indexes.md exists and lists all wikis', async () => {
  const workspace = setupMaterializedWiki();
  await ingest('test-wiki', { workspace, extract: false });

  const indexPath = join(workspace, 'wikis', 'index-of-indexes.md');
  expect(existsSync(indexPath)).toBe(true);
  const index = readFileSync(indexPath, 'utf-8');
  const parsed = matter(index);
  expect(parsed.data.type).toBe('index');
  expect(parsed.data.title).toBe('Index of Indexes');
  // No `wiki` field — the workspace contract governs every wiki (vision 03 §4.2).
  expect(parsed.data.wiki).toBeUndefined();
  expect(parsed.data.aliases).toEqual(['Index of Indexes']);
  expect(parsed.data.children).toEqual(['test-wiki/index.md']);
  // Pipe-form link to the wiki root, resolvable when wikis/ is the vault.
  expect(index).toContain('[[test-wiki/index|Test Wiki]]');
  // 2026-07-21 prose model: the coherent prose block exists.
  expect(index).toContain('<!-- workspace-prose -->');
});

// Gate 6.10: Workspace Index Statistics Are Accurate
test('workspace index statistics are accurate', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  await writeDoxContracts('test-wiki', { workspace });
  await writeWorkspaceIndex({ workspace, wikiSlug: 'test-wiki' });

  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  const index = readFileSync(join(workspace, 'wikis', 'index-of-indexes.md'), 'utf-8');

  expect(index).toContain('- Wikis: 1');
  expect(index).toContain(`- Sources: ${countContentFiles(join(wikiDir, 'sources'))}`);
  expect(index).toContain(`- Document pages: ${countContentFiles(join(wikiDir, 'documents'))}`);
  expect(index).toContain(`- Entity pages: ${countContentFiles(join(wikiDir, 'entities'))}`);
  expect(index).toContain(`- Topic pages: ${countContentFiles(join(wikiDir, 'topics'))}`);
});

// Gate 6.11: Workspace Index Falls Back Deterministically (per-concern, 2026-07-21)
test('workspace index falls back to deterministic prose and line on LLM failure', async () => {
  // Reference run: fully deterministic workspace index.
  const workspaceDeterministic = setupMaterializedWiki();
  await materialize('test-wiki', { workspace: workspaceDeterministic });
  await writeDoxContracts('test-wiki', { workspace: workspaceDeterministic });
  await writeWorkspaceIndex({ workspace: workspaceDeterministic, wikiSlug: 'test-wiki' });

  // LLM run where BOTH workspace calls throw.
  const workspaceLlm = setupMaterializedWiki();
  await materialize('test-wiki', { workspace: workspaceLlm });
  await writeDoxContracts('test-wiki', { workspace: workspaceLlm });
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    await writeWorkspaceIndex({
      workspace: workspaceLlm,
      wikiSlug: 'test-wiki',
      doxLlm: true,
      writeWorkspaceIndexFn: () => Promise.reject(new Error('LLM unavailable')),
      writeWorkspaceProseFn: () => Promise.reject(new Error('LLM unavailable')),
    });
    expect(warnSpy).toHaveBeenCalled();
  } finally {
    warnSpy.mockRestore();
  }

  const deterministic = readFileSync(
    join(workspaceDeterministic, 'wikis', 'index-of-indexes.md'),
    'utf-8',
  );
  const fallback = readFileSync(join(workspaceLlm, 'wikis', 'index-of-indexes.md'), 'utf-8');
  const normalize = (text: string) => text.replace(/^updated:.*$/m, 'updated: <timestamp>');
  expect(normalize(fallback)).toBe(normalize(deterministic));
  expect(fallback).toContain('## Wikis');
  expect(fallback).toContain('- Wikis: 1');
});

// Amendment supplementary 1: the entry call receives ONLY the triggering
// wiki's freshly-written root contract (never the other wiki's), and its
// description lands in the catalog line; the prose call receives ALL root
// contracts (only on set change).
test('workspace entry synthesizes only the triggering wiki; prose synthesizes all', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  await writeDoxContracts('test-wiki', { workspace });
  await setupSecondWiki(workspace);

  let entryContext: DoxWorkspaceEntryContext | undefined;
  let proseContext: DoxWorkspaceProseContext | undefined;
  await writeWorkspaceIndex({
    workspace,
    wikiSlug: 'test-wiki',
    doxLlm: true,
    outputLanguage: 'English',
    writeWorkspaceIndexFn: (context) => {
      entryContext = context;
      return Promise.resolve('Acme fixture wiki with executives, companies, and financial topics.');
    },
    writeWorkspaceProseFn: (context) => {
      proseContext = context;
      return Promise.resolve('Two wikis: a Danish shipping corpus and an Acme fixture.');
    },
  });

  expect(entryContext).toBeDefined();
  expect(entryContext!.contextLabel).toBe('workspace entry test-wiki');
  expect(entryContext!.wikiSlug).toBe('test-wiki');
  expect(entryContext!.wikiTitle).toBe('Test Wiki');
  expect(entryContext!.outputLanguage).toBe('English');
  const writtenTestRoot = readFileSync(join(workspace, 'wikis', 'test-wiki', 'index.md'), 'utf-8');
  expect(entryContext!.wikiRootIndex).toBe(writtenTestRoot);
  expect(JSON.stringify(entryContext)).not.toContain('maersk-line');

  // The prose call ran (set changed: file did not exist) with ALL contracts.
  expect(proseContext).toBeDefined();
  expect(proseContext!.wikis.map((wiki) => wiki.slug)).toEqual(['second-wiki', 'test-wiki']);
  expect(JSON.stringify(proseContext)).toContain('maersk-line');

  const index = readFileSync(join(workspace, 'wikis', 'index-of-indexes.md'), 'utf-8');
  const segments = parseWorkspaceSegments(index);
  expect(segments.workspaceProse).toBe('Two wikis: a Danish shipping corpus and an Acme fixture.');
  expect(segments.catalog.get('test-wiki')).toBe(
    '- [[test-wiki/index|Test Wiki]] — Acme fixture wiki with executives, companies, and financial topics.',
  );
  // The non-triggering wiki gets a placeholder line, not an LLM description.
  expect(segments.catalog.get('second-wiki')).toContain('No description yet');
  // Deterministic ground truth is re-imposed.
  const parsed = matter(index);
  expect(parsed.data.title).toBe('Index of Indexes');
  expect(parsed.data.wiki).toBeUndefined();
  expect(parsed.data.children).toEqual(['second-wiki/index.md', 'test-wiki/index.md']);
  expect(index).toContain('- Wikis: 2');
});

// Amendment supplementary 2: a wiki without a root index.md (init only,
// never ingested) is not listed; with no ingested wiki at all, no workspace
// index is written.
test('workspace pass skips wikis without a root index and writes nothing when none exist', async () => {
  const workspace = makeTempDir('llm-wiki-phase6-ws-');
  await init('young-wiki', { workspace });
  await writeWorkspaceIndex({ workspace, wikiSlug: 'young-wiki' });
  expect(existsSync(join(workspace, 'wikis', 'index-of-indexes.md'))).toBe(false);

  const wikiDir = join(workspace, 'wikis', 'young-wiki');
  writeFileSync(
    join(wikiDir, 'index.md'),
    matter.stringify('# Young Wiki\n\nA wiki.\n', {
      title: 'Young Wiki',
      type: 'index',
      wiki: 'young-wiki',
      updated: new Date().toISOString(),
      children: [],
    }),
    'utf-8',
  );
  await writeWorkspaceIndex({ workspace, wikiSlug: 'young-wiki' });
  const index = readFileSync(join(workspace, 'wikis', 'index-of-indexes.md'), 'utf-8');
  const parsed = matter(index);
  expect(parsed.data.children).toEqual(['young-wiki/index.md']);
  expect(index).toContain('- Wikis: 1');
});

// Gate 6.12: Workspace Pass Rewrites Only the Triggering Wiki's Catalog Line
test('ingest of wiki B rewrites only wiki B catalog line; wiki A line is byte-identical', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  await writeDoxContracts('test-wiki', { workspace });
  await setupSecondWiki(workspace);
  const indexPath = join(workspace, 'wikis', 'index-of-indexes.md');

  await writeWorkspaceIndex({
    workspace,
    wikiSlug: 'test-wiki',
    doxLlm: true,
    outputLanguage: 'English',
    writeWorkspaceIndexFn: async () => 'Alpha English description.',
    writeWorkspaceProseFn: async () => 'Coherent workspace prose.',
  });
  const before = parseWorkspaceSegments(readFileSync(indexPath, 'utf-8'));
  const lineA = before.catalog.get('test-wiki');
  expect(lineA).toBe('- [[test-wiki/index|Test Wiki]] — Alpha English description.');

  await writeWorkspaceIndex({
    workspace,
    wikiSlug: 'second-wiki',
    doxLlm: true,
    outputLanguage: 'Danish',
    writeWorkspaceIndexFn: async () => 'Beta dansk beskrivelse.',
    writeWorkspaceProseFn: async () => {
      throw new Error('must not be called — the wiki set did not change');
    },
  });
  const after = parseWorkspaceSegments(readFileSync(indexPath, 'utf-8'));
  // Wiki A's catalog line is byte-identical; the prose block is untouched.
  expect(after.catalog.get('test-wiki')).toBe(lineA);
  expect(after.workspaceProse).toBe('Coherent workspace prose.');
  // Wiki B's line was written, in Danish.
  expect(after.catalog.get('second-wiki')).toBe(
    '- [[second-wiki/index|Second Wiki]] — Beta dansk beskrivelse.',
  );
});

// Gate 6.13: Mixed-Language Catalog Survives
test('a Danish catalog line survives an English wiki ingest', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  await writeDoxContracts('test-wiki', { workspace });
  await setupSecondWiki(workspace);
  const indexPath = join(workspace, 'wikis', 'index-of-indexes.md');

  await writeWorkspaceIndex({
    workspace,
    wikiSlug: 'second-wiki',
    doxLlm: true,
    outputLanguage: 'Danish',
    writeWorkspaceIndexFn: async () => 'Møbler A/Ss årsrapport med omsætning på 12,5 millioner kr.',
    writeWorkspaceProseFn: async () => 'To wikier på tværs af sprog.',
  });
  await writeWorkspaceIndex({
    workspace,
    wikiSlug: 'test-wiki',
    doxLlm: true,
    outputLanguage: 'English',
    writeWorkspaceIndexFn: async () => 'Acme Corp annual results with executive entities.',
  });

  const segments = parseWorkspaceSegments(readFileSync(indexPath, 'utf-8'));
  // The Danish line is NOT translated by the later English run.
  expect(segments.catalog.get('second-wiki')).toBe(
    '- [[second-wiki/index|Second Wiki]] — Møbler A/Ss årsrapport med omsætning på 12,5 millioner kr.',
  );
  expect(segments.catalog.get('test-wiki')).toBe(
    '- [[test-wiki/index|Test Wiki]] — Acme Corp annual results with executive entities.',
  );
  // And the prose block survived both runs (written once, set unchanged after).
  expect(segments.workspaceProse).toBe('To wikier på tværs af sprog.');
});

// Gate 6.14: Workspace Fallback Is Per-Concern and Removals Drop Lines
test('LLM failure writes a deterministic line for the triggering wiki only; a removed wiki loses its line', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  await writeDoxContracts('test-wiki', { workspace });
  await setupSecondWiki(workspace);
  const indexPath = join(workspace, 'wikis', 'index-of-indexes.md');

  await writeWorkspaceIndex({
    workspace,
    wikiSlug: 'test-wiki',
    doxLlm: true,
    outputLanguage: 'English',
    writeWorkspaceIndexFn: async () => 'Rich English description.',
    writeWorkspaceProseFn: async () => 'Workspace prose.',
  });
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    await writeWorkspaceIndex({
      workspace,
      wikiSlug: 'second-wiki',
      doxLlm: true,
      writeWorkspaceIndexFn: () => Promise.reject(new Error('LLM down')),
      writeWorkspaceProseFn: async () => {
        throw new Error('must not be called — the wiki set did not change');
      },
    });
  } finally {
    warnSpy.mockRestore();
  }

  const index = readFileSync(indexPath, 'utf-8');
  const segments = parseWorkspaceSegments(index);
  // The other wiki's LLM-written line is untouched by the failure...
  expect(segments.catalog.get('test-wiki')).toBe(
    '- [[test-wiki/index|Test Wiki]] — Rich English description.',
  );
  // ...and the failing triggering wiki falls back to the deterministic
  // description (first prose paragraph of its root index).
  expect(segments.catalog.get('second-wiki')).toContain('Danish shipping industry');

  // Removing a wiki from disk drops its line and children entry — and IS a
  // set change, so the prose regenerates (gate 6.15 covers this in detail).
  rmSync(join(workspace, 'wikis', 'second-wiki'), { recursive: true, force: true });
  await writeWorkspaceIndex({
    workspace,
    wikiSlug: 'test-wiki',
    doxLlm: true,
    outputLanguage: 'English',
    writeWorkspaceIndexFn: async () => 'Updated description.',
    writeWorkspaceProseFn: async () => 'One wiki remains.',
  });
  const after = readFileSync(indexPath, 'utf-8');
  expect(after).not.toContain('second-wiki');
  expect(after).not.toContain('Danish shipping industry');
  expect(after).toContain('- Wikis: 1');
  expect(after).toContain('Updated description.');
  expect(matter(after).data.children).toEqual(['test-wiki/index.md']);
});

// Gate 6.15 (prose amendment 2026-07-21): Prose Regenerates Only on Wiki-Set Change
test('workspace prose regenerates only when a wiki is added or removed', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  await writeDoxContracts('test-wiki', { workspace });
  const indexPath = join(workspace, 'wikis', 'index-of-indexes.md');

  let proseCalls = 0;
  const proseFn = async () => {
    proseCalls++;
    return `Prose version ${proseCalls}.`;
  };
  const entryFn = async () => 'Entry description.';

  // First run: no file → prose written (call 1).
  await writeWorkspaceIndex({ workspace, wikiSlug: 'test-wiki', doxLlm: true, writeWorkspaceIndexFn: entryFn, writeWorkspaceProseFn: proseFn });
  expect(proseCalls).toBe(1);
  expect(parseWorkspaceSegments(readFileSync(indexPath, 'utf-8')).workspaceProse).toBe('Prose version 1.');

  // Routine ingest (same wiki set): prose preserved, no prose call.
  await writeWorkspaceIndex({ workspace, wikiSlug: 'test-wiki', doxLlm: true, writeWorkspaceIndexFn: entryFn, writeWorkspaceProseFn: proseFn });
  expect(proseCalls).toBe(1);
  expect(parseWorkspaceSegments(readFileSync(indexPath, 'utf-8')).workspaceProse).toBe('Prose version 1.');

  // Adding a wiki: prose regenerates (call 2).
  await setupSecondWiki(workspace);
  await writeWorkspaceIndex({ workspace, wikiSlug: 'second-wiki', doxLlm: true, writeWorkspaceIndexFn: entryFn, writeWorkspaceProseFn: proseFn });
  expect(proseCalls).toBe(2);
  expect(parseWorkspaceSegments(readFileSync(indexPath, 'utf-8')).workspaceProse).toBe('Prose version 2.');

  // Routine ingest again: preserved.
  await writeWorkspaceIndex({ workspace, wikiSlug: 'test-wiki', doxLlm: true, writeWorkspaceIndexFn: entryFn, writeWorkspaceProseFn: proseFn });
  expect(proseCalls).toBe(2);

  // Removing a wiki: prose regenerates (call 3).
  rmSync(join(workspace, 'wikis', 'second-wiki'), { recursive: true, force: true });
  await writeWorkspaceIndex({ workspace, wikiSlug: 'test-wiki', doxLlm: true, writeWorkspaceIndexFn: entryFn, writeWorkspaceProseFn: proseFn });
  expect(proseCalls).toBe(3);
  expect(parseWorkspaceSegments(readFileSync(indexPath, 'utf-8')).workspaceProse).toBe('Prose version 3.');
});

// Gate 6.16 (prose amendment 2026-07-21): Prose Synthesizes ALL Root Contracts
test('workspace prose call receives every wiki root contract; catalog lines stay per-wiki', async () => {
  const workspace = setupMaterializedWiki();
  await materialize('test-wiki', { workspace });
  await writeDoxContracts('test-wiki', { workspace });
  const secondWikiDir = await setupSecondWiki(workspace);

  let proseContext: DoxWorkspaceProseContext | undefined;
  await writeWorkspaceIndex({
    workspace,
    wikiSlug: 'test-wiki',
    doxLlm: true,
    outputLanguage: 'English',
    writeWorkspaceIndexFn: async () => 'Entry.',
    writeWorkspaceProseFn: (context) => {
      proseContext = context;
      return Promise.resolve('Synthesis across both wikis.');
    },
  });

  expect(proseContext).toBeDefined();
  expect(proseContext!.wikis.map((wiki) => wiki.slug)).toEqual(['second-wiki', 'test-wiki']);
  const writtenTestRoot = readFileSync(join(workspace, 'wikis', 'test-wiki', 'index.md'), 'utf-8');
  const writtenSecondRoot = readFileSync(join(secondWikiDir, 'index.md'), 'utf-8');
  expect(proseContext!.wikis.find((wiki) => wiki.slug === 'test-wiki')!.content).toBe(writtenTestRoot);
  expect(proseContext!.wikis.find((wiki) => wiki.slug === 'second-wiki')!.content).toBe(writtenSecondRoot);
  expect(proseContext!.outputLanguage).toBe('English');
});
