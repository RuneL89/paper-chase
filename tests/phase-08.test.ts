import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterAll, afterEach, expect, test, vi } from 'vitest';
import { init } from '../src/commands/init';
import { ingest } from '../src/commands/ingest';
import type { ExtractorResult } from '../src/agents/extractor';
import type { ChunkExtraction } from '../src/commands/extract-chunk';
import type { IngestionMetrics } from '../src/state/metrics';
import type { ConflictsState } from '../src/state/conflicts';

const GOLDEN_MASTER_PDF = 'test-pdfs/golden-master.pdf';
const GOLDEN_MASTER_2_PDF = 'test-pdfs/golden-master-2.pdf';
const tempDirs: string[] = [];

afterAll(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/**
 * Extraction fixture for golden-master.pdf (3 pages, one chunk at the
 * default 5 pages/chunk): John Smith (CEO, existing world) and Acme Corp,
 * a financial claim — consistent with the fixture's known text.
 */
function extractionOne(): ExtractorResult {
  return {
    entities: [
      {
        name: 'John Smith',
        type: 'person',
        slug: 'john-smith',
        folder: 'entities/people/executives',
        significance: 'CEO of Acme Corp',
        mentions: [{ page: 1, context: 'John Smith presented the annual results of Acme Corp' }],
      },
      {
        name: 'Acme Corp',
        type: 'company',
        slug: 'acme-corp',
        folder: 'entities/companies',
        significance: 'The company whose results are presented',
        mentions: [{ page: 1, context: 'annual results of Acme Corp on March 15, 2024' }],
      },
    ],
    relationships: [
      {
        subject: 'john-smith',
        predicate: 'is-ceo-of',
        object: 'acme-corp',
        evidence: 'John Smith is the CEO of Acme Corp',
        page: 3,
      },
    ],
    claims: [
      {
        text: 'Total revenue for the year reached $42.5 million',
        type: 'financial',
        entities: ['acme-corp'],
        page: 2,
      },
    ],
    timeline: [],
    context: 'Annual results presentation for Acme Corp.',
  };
}

/**
 * Extraction fixture for golden-master-2.pdf (2 pages, one chunk): John
 * Smith again in a NEW context (court testimony), Jane Doe (new entity,
 * General Counsel), and a NEW claim type (legal vs financial).
 */
function extractionTwo(): ExtractorResult {
  return {
    entities: [
      {
        name: 'John Smith',
        type: 'person',
        slug: 'john-smith',
        folder: 'entities/people/executives',
        significance: 'CEO of Acme Corp',
        mentions: [{ page: 1, context: 'John Smith testified before the Delaware Court of Chancery' }],
      },
      {
        name: 'Jane Doe',
        type: 'person',
        slug: 'jane-doe',
        folder: 'entities/people/executives',
        significance: 'General Counsel of Acme Corp',
        mentions: [
          { page: 1, context: 'Jane Doe, General Counsel of Acme Corp' },
          { page: 2, context: 'Jane Doe confirmed that Acme Corp entered settlement negotiations' },
        ],
      },
      {
        name: 'Acme Corp',
        type: 'company',
        slug: 'acme-corp',
        folder: 'entities/companies',
        significance: 'Defendant in the class-action lawsuit',
        mentions: [{ page: 1, context: 'class-action lawsuit filed against Acme Corp' }],
      },
    ],
    relationships: [
      {
        subject: 'jane-doe',
        predicate: 'is-general-counsel-of',
        object: 'acme-corp',
        evidence: 'Jane Doe, General Counsel of Acme Corp',
        page: 1,
      },
    ],
    claims: [
      {
        text: 'The proposed settlement is valued at $3.1 million',
        type: 'legal',
        entities: ['acme-corp', 'jane-doe'],
        page: 2,
      },
    ],
    timeline: [],
    context: 'Legal proceedings update for Acme Corp.',
  };
}

/** Test-only extractChunkFn that persists the extracted JSON like the real path. */
function stubExtractChunkFn(byChunk: Record<string, ExtractorResult>) {
  return async (wikiDir: string, chunkId: string): Promise<ChunkExtraction> => {
    const extraction = byChunk[chunkId];
    if (!extraction) {
      throw new Error(`No stub extraction for chunk ${chunkId}.`);
    }
    const extractedDir = join(wikiDir, '.state', 'extracted');
    mkdirSync(extractedDir, { recursive: true });
    const jsonPath = join(extractedDir, `${chunkId}.json`);
    writeFileSync(jsonPath, JSON.stringify(extraction, null, 2) + '\n', 'utf-8');
    return {
      chunkId,
      result: extraction,
      jsonPath,
      jsonRelativePath: `.state/extracted/${chunkId}.json`,
    };
  };
}

const defaultStub = () =>
  stubExtractChunkFn({
    'golden-master-part-001': extractionOne(),
    'golden-master-2-part-001': extractionTwo(),
  });

/** Fresh temp workspace with test-wiki initialised and golden-master.pdf in raw/. */
function setupWiki(): string {
  const workspace = makeTempDir('llm-wiki-phase8-');
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  init('test-wiki', { workspace });
  mkdirSync(join(wikiDir, 'raw'), { recursive: true });
  copyFileSync(GOLDEN_MASTER_PDF, join(wikiDir, 'raw', 'golden-master.pdf'));
  return workspace;
}

function wikiPath(workspace: string, ...segments: string[]): string {
  return join(workspace, 'wikis', 'test-wiki', ...segments);
}

function addSecondPdf(workspace: string): void {
  copyFileSync(GOLDEN_MASTER_2_PDF, wikiPath(workspace, 'raw', 'golden-master-2.pdf'));
}

/** Recursive .md file listing (replaces the spec's globSync; no glob dep). */
function listMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  function walk(current: string): void {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        files.push(absolute);
      }
    }
  }
  walk(dir);
  return files;
}

function readConflictsFile(workspace: string): ConflictsState {
  return JSON.parse(readFileSync(wikiPath(workspace, '.state', 'conflicts.json'), 'utf-8')) as ConflictsState;
}

// ---------------------------------------------------------------------------
// Gate 8.1: New PDF Adds New Entities
// LLM-free deviation (tests/AGENTS.md): the literal gate's `ingest('test-wiki')`
// live-LLM calls are restructured to temp-workspace runs with an injected
// extractChunkFn stub; the pass criterion is unchanged.
// ---------------------------------------------------------------------------
test('gate 8.1: new PDF adds new entities to wiki', async () => {
  const workspace = setupWiki();
  await ingest('test-wiki', { workspace, extractChunkFn: defaultStub() }); // first PDF
  addSecondPdf(workspace);
  await ingest('test-wiki', { workspace, extractChunkFn: defaultStub() }); // second PDF

  expect(existsSync(wikiPath(workspace, 'entities', 'people', 'executives', 'jane-doe.md'))).toBe(true);
});

// ---------------------------------------------------------------------------
// Gate 8.2: New PDF Updates Existing Entity Pages
// ---------------------------------------------------------------------------
test('gate 8.2: new PDF updates existing entity pages', async () => {
  const workspace = setupWiki();
  await ingest('test-wiki', { workspace, extractChunkFn: defaultStub() });
  const pagePath = wikiPath(workspace, 'entities', 'people', 'executives', 'john-smith.md');
  const firstPage = readFileSync(pagePath, 'utf-8');

  addSecondPdf(workspace);
  await ingest('test-wiki', { workspace, extractChunkFn: defaultStub() });
  const secondPage = readFileSync(pagePath, 'utf-8');

  expect(secondPage.length).toBeGreaterThan(firstPage.length); // more content
  expect(secondPage).toContain('golden-master-2.pdf'); // new source mentioned
});

// ---------------------------------------------------------------------------
// Gate 8.3: Unchanged PDFs Are Skipped
// Restructured deviation: the skip message flows through the onProgress
// callback (Phase 1 gate precedent — the CLI wires onProgress to console.log),
// so the test passes `onProgress: console.log` and spies console.log exactly
// like the literal gate. Pass criterion unchanged.
// ---------------------------------------------------------------------------
test('gate 8.3: unchanged PDFs are skipped on re-ingest', async () => {
  const workspace = setupWiki();
  await ingest('test-wiki', { workspace, extractChunkFn: defaultStub() });
  const consoleSpy = vi.spyOn(console, 'log');
  await ingest('test-wiki', { workspace, extractChunkFn: defaultStub(), onProgress: (m) => console.log(m) });
  expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping'));
  expect(consoleSpy).toHaveBeenCalledWith('Skipping golden-master.pdf (unchanged)');
});

// ---------------------------------------------------------------------------
// Gate 8.4: Rolling Memory Reflects Both PDFs
// ---------------------------------------------------------------------------
test('gate 8.4: rolling memory contains entities from both PDFs', async () => {
  const workspace = setupWiki();
  await ingest('test-wiki', { workspace, extractChunkFn: defaultStub() });
  addSecondPdf(workspace);
  await ingest('test-wiki', { workspace, extractChunkFn: defaultStub() });

  const memory = JSON.parse(readFileSync(wikiPath(workspace, '.state', 'rolling-memory.json'), 'utf-8')) as {
    entities: Array<{ slug: string }>;
  };
  const slugs = memory.entities.map((e) => e.slug);
  expect(slugs).toContain('john-smith');
  expect(slugs).toContain('jane-doe');
});

// ---------------------------------------------------------------------------
// Gate 8.5: Manual Edit Conflict Is Detected
// ---------------------------------------------------------------------------
test('gate 8.5: manual edit conflict is detected', async () => {
  const workspace = setupWiki();
  await ingest('test-wiki', { workspace, extractChunkFn: defaultStub() });

  // Manually edit an entity page
  const pagePath = wikiPath(workspace, 'entities', 'people', 'executives', 'john-smith.md');
  const edited = readFileSync(pagePath, 'utf-8') + '\n\nManual edit.';
  writeFileSync(pagePath, edited, 'utf-8');

  // Add new PDF
  addSecondPdf(workspace);
  await ingest('test-wiki', { workspace, extractChunkFn: defaultStub() });

  const conflicts = readConflictsFile(workspace);
  expect(conflicts.conflicts.length).toBeGreaterThan(0);

  // Phase doc §2.5 exact JSON shape for the manual-edit entry.
  const manualEdit = conflicts.conflicts.find(
    (entry) => 'type' in entry && entry.type === 'manual-edit',
  );
  expect(manualEdit).toBeDefined();
  expect(manualEdit).toMatchObject({
    type: 'manual-edit',
    page: 'entities/people/executives/john-smith.md',
    reason: 'Page was manually edited since last ingestion. Skipping update.',
  });
  expect(typeof manualEdit?.timestamp).toBe('string');

  // The update was skipped: the journalist's edit survives the ingest.
  expect(readFileSync(pagePath, 'utf-8')).toContain('Manual edit.');
});

// ---------------------------------------------------------------------------
// Gate 8.6: No Duplicate Entity Pages
// Restructured deviation: globSync is replaced by a small recursive readdir
// helper (no glob dependency in the project). Pass criterion unchanged.
// ---------------------------------------------------------------------------
test('gate 8.6: no duplicate entity pages for same slug', async () => {
  const workspace = setupWiki();
  await ingest('test-wiki', { workspace, extractChunkFn: defaultStub() });
  addSecondPdf(workspace);
  await ingest('test-wiki', { workspace, extractChunkFn: defaultStub() });

  const files = listMarkdownFiles(wikiPath(workspace, 'entities'));
  const johnSmithFiles = files.filter((f) => f.includes('john-smith'));
  expect(johnSmithFiles).toHaveLength(1);
});

// ---------------------------------------------------------------------------
// Supplementary: the tool's own rewrites are never flagged as manual edits.
// A normal second ingest updates john-smith.md (hash matches the recorded
// write) and must log NO conflict.
// ---------------------------------------------------------------------------
test('supplementary: tool writes are not flagged as manual edits', async () => {
  const workspace = setupWiki();
  await ingest('test-wiki', { workspace, extractChunkFn: defaultStub() });
  addSecondPdf(workspace);
  await ingest('test-wiki', { workspace, extractChunkFn: defaultStub() });

  expect(existsSync(wikiPath(workspace, '.state', 'conflicts.json'))).toBe(false);
});

// ---------------------------------------------------------------------------
// Supplementary (phase doc §2.2): removed PDFs log a warning and keep their
// derived pages.
// ---------------------------------------------------------------------------
test('supplementary: removed PDF warns and keeps derived pages', async () => {
  const workspace = setupWiki();
  await ingest('test-wiki', { workspace, extractChunkFn: defaultStub() });

  rmSync(wikiPath(workspace, 'raw', 'golden-master.pdf'));
  const lines: string[] = [];
  await ingest('test-wiki', { workspace, extractChunkFn: defaultStub(), onProgress: (m) => lines.push(m) });

  expect(lines.some((line) => line.includes('golden-master') && line.includes('no longer in raw/'))).toBe(true);
  expect(existsSync(wikiPath(workspace, 'entities', 'people', 'executives', 'john-smith.md'))).toBe(true);
});

// ---------------------------------------------------------------------------
// Supplementary (phase doc §2.2): a changed PDF is fully re-processed — the
// old extraction JSON is replaced, so a shorter PDF leaves no stale chunk
// extractions behind.
// ---------------------------------------------------------------------------
test('supplementary: changed PDF replaces stale extraction JSON', async () => {
  const workspace = setupWiki();
  const stub = stubExtractChunkFn({
    'golden-master-part-001': extractionOne(),
    'golden-master-part-002': extractionOne(),
  });
  // 3 pages at 2 pages/chunk -> part-001 (pages 1-2) + part-002 (page 3).
  await ingest('test-wiki', { workspace, pagesPerChunk: 2, extractChunkFn: stub });
  expect(existsSync(wikiPath(workspace, '.state', 'extracted', 'golden-master-part-002.json'))).toBe(true);

  // Replace the PDF with different bytes (golden-master-2 content, 2 pages)
  // under the SAME file name -> same source slug, different SHA-256.
  copyFileSync(GOLDEN_MASTER_2_PDF, wikiPath(workspace, 'raw', 'golden-master.pdf'));
  await ingest('test-wiki', { workspace, pagesPerChunk: 2, extractChunkFn: stub });

  // The stale second chunk's document page AND extraction JSON are gone.
  expect(existsSync(wikiPath(workspace, 'documents', 'golden-master-part-002.md'))).toBe(false);
  expect(existsSync(wikiPath(workspace, '.state', 'extracted', 'golden-master-part-002.json'))).toBe(false);
});

// ---------------------------------------------------------------------------
// Supplementary (vision `04` §9.3, phase doc §7): a changed PDF is
// re-processed under the current run's input language, with a warning when
// it differs from the language the PDF was originally extracted under.
// ---------------------------------------------------------------------------
test('supplementary: changed PDF re-processed under current language warns on drift', async () => {
  const workspace = setupWiki();
  await ingest('test-wiki', { workspace, extractChunkFn: defaultStub() }); // en

  copyFileSync(GOLDEN_MASTER_2_PDF, wikiPath(workspace, 'raw', 'golden-master.pdf')); // changed bytes
  const lines: string[] = [];
  await ingest('test-wiki', {
    workspace,
    inputLanguage: 'da',
    extractChunkFn: defaultStub(),
    onProgress: (m) => lines.push(m),
  });

  expect(
    lines.some(
      (line) =>
        line.includes('golden-master.pdf') &&
        line.includes("originally extracted under input language 'en'") &&
        line.includes("'da'"),
    ),
  ).toBe(true);

  // The new extraction language is recorded for the next comparison.
  const state = JSON.parse(readFileSync(wikiPath(workspace, '.state', 'ingestion.json'), 'utf-8')) as {
    sources: Record<string, { language?: string }>;
  };
  expect(state.sources['golden-master'].language).toBe('da');
});

// ---------------------------------------------------------------------------
// Supplementary (phase doc §5.1): the run's compounding metrics are recorded
// to .state/metrics.json for the TUI Ingestion Log screen.
// ---------------------------------------------------------------------------
test('supplementary: metrics.json records new PDFs, new/updated entities, conflicts, cost', async () => {
  const workspace = setupWiki();
  await ingest('test-wiki', { workspace, extractChunkFn: defaultStub() });
  addSecondPdf(workspace);
  await ingest('test-wiki', { workspace, extractChunkFn: defaultStub() });

  const metrics = JSON.parse(readFileSync(wikiPath(workspace, '.state', 'metrics.json'), 'utf-8')) as IngestionMetrics;
  expect(typeof metrics.run).toBe('string');
  expect(metrics.newPdfs).toEqual(['golden-master-2.pdf']);
  expect(metrics.newEntities.map((e) => e.slug)).toContain('jane-doe');
  const johnSmith = metrics.updatedEntities.find((e) => e.slug === 'john-smith');
  expect(johnSmith).toBeDefined();
  expect(johnSmith?.addedMentions).toBeGreaterThan(0);
  expect(metrics.conflicts).toBe(0);
  expect(metrics.totalCost).toBe(0); // stub-driven run: no logged LLM calls
});

// ---------------------------------------------------------------------------
// UAT regression fixtures (2026-07-21): the cross-run folder fork observed on
// a live wiki — run 1 assigns slug X folder A, run 2 (a new PDF) re-derives
// folder B for the same slug. Vision 03 §3.2 ("The first folder assignment
// wins") applies ACROSS runs via the previous rolling memory.
// ---------------------------------------------------------------------------

/** Run 1: jane-doe is extracted into entities/people/board-members. */
function forkExtractionRunOne(): ExtractorResult {
  return {
    entities: [
      {
        name: 'Jane Doe',
        type: 'person',
        slug: 'jane-doe',
        folder: 'entities/people/board-members',
        significance: 'Board member of Acme Corp',
        mentions: [{ page: 1, context: 'Jane Doe joined the board of Acme Corp' }],
      },
    ],
    relationships: [],
    claims: [],
    timeline: [],
    context: 'Board announcement for Acme Corp.',
  };
}

/** Run 2 (new PDF): the SAME slug is re-derived into entities/people/executives. */
function forkExtractionRunTwo(): ExtractorResult {
  return {
    entities: [
      {
        name: 'Jane Doe',
        type: 'person',
        slug: 'jane-doe',
        folder: 'entities/people/executives',
        significance: 'Board member of Acme Corp',
        mentions: [{ page: 1, context: 'Jane Doe testified before the Delaware Court of Chancery' }],
      },
    ],
    relationships: [],
    claims: [],
    timeline: [],
    context: 'Legal proceedings update for Acme Corp.',
  };
}

/**
 * Reproduce the buggy pre-fix run-2 outcome by hand: a merged page at the NEW
 * folder B with its hash recorded, rolling memory overwritten to folder B,
 * and the run-1 page left orphaned at folder A (its recorded hash intact).
 * Also lays down the run-2 extraction JSON + document page so the repair
 * run's merge is real.
 */
function simulateForkedSecondRun(workspace: string): void {
  const orphanAbsolute = wikiPath(workspace, 'entities', 'people', 'board-members', 'jane-doe.md');
  const merged = readFileSync(orphanAbsolute, 'utf-8') + '\nMerged mention from the second PDF.\n';
  mkdirSync(wikiPath(workspace, 'entities', 'people', 'executives'), { recursive: true });
  writeFileSync(wikiPath(workspace, 'entities', 'people', 'executives', 'jane-doe.md'), merged, 'utf-8');

  const memoryPath = wikiPath(workspace, '.state', 'rolling-memory.json');
  const memory = JSON.parse(readFileSync(memoryPath, 'utf-8')) as {
    entities: Array<{ slug: string; folder: string; mentionCount: number }>;
    folderStructure: string[];
  };
  memory.entities = memory.entities.map((entity) =>
    entity.slug === 'jane-doe' ? { ...entity, folder: 'entities/people/executives' } : entity,
  );
  memory.folderStructure = [...memory.folderStructure, 'entities/people/executives'].sort();
  writeFileSync(memoryPath, JSON.stringify(memory, null, 2) + '\n', 'utf-8');

  const statePath = wikiPath(workspace, '.state', 'ingestion.json');
  const state = JSON.parse(readFileSync(statePath, 'utf-8')) as { pageHashes: Record<string, string> };
  state.pageHashes['entities/people/executives/jane-doe.md'] = createHash('sha256')
    .update(merged, 'utf-8')
    .digest('hex');
  writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf-8');

  writeFileSync(
    wikiPath(workspace, '.state', 'extracted', 'golden-master-2-part-001.json'),
    JSON.stringify(forkExtractionRunTwo(), null, 2) + '\n',
    'utf-8',
  );
  writeFileSync(
    wikiPath(workspace, 'documents', 'golden-master-2-part-001.md'),
    matter.stringify('\n## Extracted Text: Pages 1-2\n\nFake second chunk.\n', {
      title: 'golden-master-2-part-001',
      type: 'document',
      sources: [{ file: 'wikis/test-wiki/raw/golden-master-2.pdf', pages: '1-2' }],
      updated: new Date().toISOString(),
    }),
    'utf-8',
  );
}

// ---------------------------------------------------------------------------
// UAT regression (2026-07-21, vision 03 §3.2 + 04 §3.2 Step 6): a second run
// that re-derives a DIFFERENT folder for a known slug must not fork the
// entity. Exactly one page exists, at the FIRST folder; the data from both
// runs is merged there; rolling memory still records the first folder.
// ---------------------------------------------------------------------------
test('regression: cross-run folder fork keeps one page at the first folder with merged data', async () => {
  const workspace = setupWiki();
  await ingest('test-wiki', {
    workspace,
    extractChunkFn: stubExtractChunkFn({ 'golden-master-part-001': forkExtractionRunOne() }),
  });
  expect(existsSync(wikiPath(workspace, 'entities', 'people', 'board-members', 'jane-doe.md'))).toBe(true);

  addSecondPdf(workspace);
  await ingest('test-wiki', {
    workspace,
    extractChunkFn: stubExtractChunkFn({ 'golden-master-2-part-001': forkExtractionRunTwo() }),
  });

  // Exactly ONE page for the slug, at the run-1 folder.
  const janeDoeFiles = listMarkdownFiles(wikiPath(workspace, 'entities')).filter((f) => f.includes('jane-doe'));
  expect(janeDoeFiles).toHaveLength(1);
  expect(janeDoeFiles[0]).toBe(wikiPath(workspace, 'entities', 'people', 'board-members', 'jane-doe.md'));
  expect(existsSync(wikiPath(workspace, 'entities', 'people', 'executives', 'jane-doe.md'))).toBe(false);

  // Rolling memory still records the FIRST folder — it never moves an entity.
  const memory = JSON.parse(readFileSync(wikiPath(workspace, '.state', 'rolling-memory.json'), 'utf-8')) as {
    entities: Array<{ slug: string; folder: string }>;
    folderStructure: string[];
  };
  expect(memory.entities.find((e) => e.slug === 'jane-doe')?.folder).toBe('entities/people/board-members');
  expect(memory.folderStructure).not.toContain('entities/people/executives');

  // The single page merges mentions and sources from BOTH runs.
  const page = readFileSync(janeDoeFiles[0], 'utf-8');
  expect(page).toContain('Jane Doe joined the board of Acme Corp');
  expect(page).toContain('Jane Doe testified before the Delaware Court of Chancery');
  expect(page).toContain('golden-master.pdf');
  expect(page).toContain('golden-master-2.pdf');
});

// ---------------------------------------------------------------------------
// UAT regression (2026-07-21): an already-forked wiki is repaired by one more
// (all-skipped) ingest — an UNMODIFIED orphan is a tool write and is deleted.
// ---------------------------------------------------------------------------
test('regression: unmodified fork orphan is deleted and its removal is logged', async () => {
  const workspace = setupWiki();
  await ingest('test-wiki', {
    workspace,
    extractChunkFn: stubExtractChunkFn({ 'golden-master-part-001': forkExtractionRunOne() }),
  });
  simulateForkedSecondRun(workspace);

  const lines: string[] = [];
  await ingest('test-wiki', {
    workspace,
    extractChunkFn: stubExtractChunkFn({}),
    onProgress: (m) => lines.push(m),
  });

  const orphanRel = 'entities/people/board-members/jane-doe.md';
  const canonicalRel = 'entities/people/executives/jane-doe.md';
  expect(existsSync(wikiPath(workspace, ...orphanRel.split('/')))).toBe(false);
  expect(existsSync(wikiPath(workspace, ...canonicalRel.split('/')))).toBe(true);
  expect(lines).toContain(`Removed duplicate page ${orphanRel} (entity now lives at ${canonicalRel}).`);

  // The deleted page's hash entry is removed; a tool write is never a conflict.
  const state = JSON.parse(readFileSync(wikiPath(workspace, '.state', 'ingestion.json'), 'utf-8')) as {
    pageHashes: Record<string, string>;
  };
  expect(state.pageHashes[orphanRel]).toBeUndefined();
  expect(existsSync(wikiPath(workspace, '.state', 'conflicts.json'))).toBe(false);

  // Rolling memory keeps the entity at its current folder and drops the
  // orphan's folder from the structure; the canonical page holds both runs.
  const memory = JSON.parse(readFileSync(wikiPath(workspace, '.state', 'rolling-memory.json'), 'utf-8')) as {
    entities: Array<{ slug: string; folder: string }>;
    folderStructure: string[];
  };
  expect(memory.entities.find((e) => e.slug === 'jane-doe')?.folder).toBe('entities/people/executives');
  expect(memory.folderStructure).not.toContain('entities/people/board-members');
  const canonical = readFileSync(wikiPath(workspace, ...canonicalRel.split('/')), 'utf-8');
  expect(canonical).toContain('Jane Doe joined the board of Acme Corp');
  expect(canonical).toContain('Jane Doe testified before the Delaware Court of Chancery');
});

// ---------------------------------------------------------------------------
// UAT regression (2026-07-21): a MANUALLY-EDITED orphan is a journalist's
// work — it is KEPT and surfaced as a manual-edit conflict for review.
// ---------------------------------------------------------------------------
test('regression: manually-edited fork orphan is kept and logged as a manual-edit conflict', async () => {
  const workspace = setupWiki();
  await ingest('test-wiki', {
    workspace,
    extractChunkFn: stubExtractChunkFn({ 'golden-master-part-001': forkExtractionRunOne() }),
  });
  simulateForkedSecondRun(workspace);

  const orphanAbsolute = wikiPath(workspace, 'entities', 'people', 'board-members', 'jane-doe.md');
  writeFileSync(orphanAbsolute, readFileSync(orphanAbsolute, 'utf-8') + '\nManual edit on the forked page.\n', 'utf-8');

  await ingest('test-wiki', { workspace, extractChunkFn: stubExtractChunkFn({}) });

  // The edited orphan survives the repair run.
  expect(existsSync(orphanAbsolute)).toBe(true);
  expect(readFileSync(orphanAbsolute, 'utf-8')).toContain('Manual edit on the forked page.');

  // ...and the journalist is told via a manual-edit conflict.
  const conflicts = readConflictsFile(workspace);
  const entry = conflicts.conflicts.find(
    (c) => 'type' in c && c.type === 'manual-edit' && c.page === 'entities/people/board-members/jane-doe.md',
  );
  expect(entry).toBeDefined();
  expect(entry && 'reason' in entry ? entry.reason : '').toContain('Duplicate page');
  expect(entry && 'reason' in entry ? entry.reason : '').toContain('Kept for review');

  // The canonical page is unaffected and carries the merged data.
  const canonical = readFileSync(wikiPath(workspace, 'entities', 'people', 'executives', 'jane-doe.md'), 'utf-8');
  expect(canonical).toContain('Jane Doe joined the board of Acme Corp');
  expect(canonical).toContain('Jane Doe testified before the Delaware Court of Chancery');
});

// ---------------------------------------------------------------------------
// UAT regression (2026-07-21, crash-safe finalization): the run record
// (metrics.json + language.json) is persisted BEFORE the validation/DOX/
// workspace stages, so an interruption in that window never loses it. The
// throwing writeDoxIndexFn stub observes the state mid-run; per the Phase 6
// contract its failure is retried and falls back to the deterministic
// contract, so the ingest completes exactly as before.
// ---------------------------------------------------------------------------
test('regression: metrics.json and language state are persisted before the DOX stage', async () => {
  const workspace = setupWiki();
  const captured: { metrics?: IngestionMetrics | null; language?: { lastInputLanguage?: string } | null } = {};
  const writeDoxIndexFn = async (): Promise<string> => {
    const metricsFile = wikiPath(workspace, '.state', 'metrics.json');
    captured.metrics = existsSync(metricsFile)
      ? (JSON.parse(readFileSync(metricsFile, 'utf-8')) as IngestionMetrics)
      : null;
    const languageFile = wikiPath(workspace, '.state', 'language.json');
    captured.language = existsSync(languageFile)
      ? (JSON.parse(readFileSync(languageFile, 'utf-8')) as { lastInputLanguage?: string })
      : null;
    throw new Error('stub DOX failure');
  };

  await ingest('test-wiki', {
    workspace,
    extractChunkFn: defaultStub(),
    doxLlm: true,
    writeDoxIndexFn,
    writeWorkspaceIndexFn: async (): Promise<string> => {
      throw new Error('stub workspace failure');
    },
    writeWorkspaceProseFn: async (): Promise<string> => {
      throw new Error('stub workspace prose failure');
    },
  });

  // The preliminary pass wrote the run record before the DOX stage ran.
  expect(captured.metrics).toBeDefined();
  expect(captured.metrics?.newPdfs).toEqual(['golden-master.pdf']);
  expect(captured.metrics?.newEntities.map((e) => e.slug)).toContain('john-smith');
  expect(captured.language?.lastInputLanguage).toBe('en');

  // Behavior for the DOX failure itself is unchanged (deterministic fallback).
  expect(existsSync(wikiPath(workspace, 'index.md'))).toBe(true);

  // The final write refreshed the metrics with the run's final data.
  const finalMetrics = JSON.parse(
    readFileSync(wikiPath(workspace, '.state', 'metrics.json'), 'utf-8'),
  ) as IngestionMetrics;
  expect(finalMetrics.newEntities.map((e) => e.slug)).toContain('john-smith');
});

// ---------------------------------------------------------------------------
// UAT regression (2026-07-21, crash-safe finalization): metrics are auxiliary
// — a metrics write failure warns and never fails an otherwise-successful
// ingest (both the preliminary and the final write).
// ---------------------------------------------------------------------------
test('regression: a metrics write failure warns but never fails the ingest', async () => {
  const workspace = setupWiki();
  // Force writeMetrics to fail: the metrics.json path is a directory.
  mkdirSync(wikiPath(workspace, '.state', 'metrics.json'), { recursive: true });

  const lines: string[] = [];
  const result = await ingest('test-wiki', {
    workspace,
    extractChunkFn: defaultStub(),
    onProgress: (m) => lines.push(m),
  });

  expect(result.ingested).toHaveLength(1);
  expect(lines.some((l) => l.startsWith('Warning: could not record preliminary ingestion metrics:'))).toBe(true);
  expect(lines.some((l) => l.startsWith('Warning: could not record ingestion metrics:'))).toBe(true);
  expect(lines).toContain('Done!');
});
