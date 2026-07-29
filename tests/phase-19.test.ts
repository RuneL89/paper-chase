import { createHash } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { afterAll, afterEach, expect, test, vi } from 'vitest';
import matter from 'gray-matter';
import { ingest } from '../src/commands/ingest';
import { init } from '../src/commands/init';
import { materialize } from '../src/materializer';
import { buildCitationMap, type EntityPageData } from '../src/pages/entity-page';
import type { TopicPageData } from '../src/pages/topic-page';
import type { ChunkExtraction } from '../src/commands/extract-chunk';
import type { ExtractorResult } from '../src/agents/extractor';
import type { CurationOutcome } from '../src/agents/curation';

/**
 * Phase 19 gates 19.1–19.5 (stale-hash convergence / manual-edit guard
 * false-flags, phase doc §2/§3; canon: vision `07` §3 preservation-first
 * materialization, `04` §3.2 Step 6 + Step 11; backlog B19). EVERY gate is
 * LLM-free ($0): the synthesis stages run through injected stubs exactly like
 * the phase-15/16/17 harnesses, and every ingest call passes
 * `poolStaggerMs: 0`.
 *
 * Root cause encoded here (phase doc §2.1 — the convicted stage): the Phase
 * 16 PER-PDF CHECKPOINT in `src/commands/ingest.ts` (`state.pageHashes =
 * workingPageHashes; writeIngestionState(...)` right after each PDF's
 * materialize) persists PRE-SYNTHESIS (structured-template) hashes. The four
 * synthesis write points then REPLACE those pages without folding the new
 * content hash into the persisted state; only the end-of-run re-hash
 * (ingest.ts:1416-1431) reconciles. A run that ABORTS between a synthesis
 * write and that re-hash (e.g. a fatal HTTP 4xx mid-stage, gate 16.4's
 * pattern) leaves `recorded == template hash` while `disk == synthesized
 * page`. The next run's Phase 16 preservedPages convergence masks the leak
 * whenever `.state/synthesis-state.json` holds a matching record; with the
 * records absent (the afdk condition, phase doc §1) the same pages are
 * false-flagged as manually edited — and every completed re-ingest keeps the
 * stale record (the pages are conflict-skipped, so the re-hash never covers
 * them). Live evidence: rkkp-afdk (2026-07-28, 8 pages, hand-repaired) and
 * rkkp-adhd (2026-07-25, 138 of 164 pages, unrepaired).
 *
 * Gate 19.5's full-suite leg is the orchestrator's; this file being part of
 * the suite with `npx tsc --noEmit` clean encodes this file's leg.
 */

const GOLDEN_MASTER_PDF = 'test-pdfs/golden-master.pdf';
const GOLDEN_MASTER_2_PDF = 'test-pdfs/golden-master-2.pdf';
const tempDirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

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

function wikiPath(workspace: string, ...parts: string[]): string {
  return join(workspace, 'wikis', 'test-wiki', ...parts);
}

/** Absolute path for a wiki-relative page path (forward slashes). */
function pageAbs(workspace: string, rel: string): string {
  return join(wikiPath(workspace), ...rel.split('/'));
}

function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

function readPageHashes(workspace: string): Record<string, string> {
  const raw = readFileSync(wikiPath(workspace, '.state', 'ingestion.json'), 'utf-8');
  return (JSON.parse(raw) as { pageHashes?: Record<string, string> }).pageHashes ?? {};
}

function readManualEditPages(workspace: string): string[] {
  const path = wikiPath(workspace, '.state', 'conflicts.json');
  if (!existsSync(path)) {
    return [];
  }
  const parsed = JSON.parse(readFileSync(path, 'utf-8')) as { conflicts: Array<{ type?: string; page?: string }> };
  return parsed.conflicts.filter((entry) => entry.type === 'manual-edit').map((entry) => entry.page ?? '');
}

/** Init a wiki and copy the golden master into raw/ (phase-15/16 harness). */
function setupWikiWithPdf(prefix = 'paper-chase-g19-'): string {
  const workspace = makeTempDir(prefix);
  init('test-wiki', { workspace });
  mkdirSync(wikiPath(workspace, 'raw'), { recursive: true });
  copyFileSync(GOLDEN_MASTER_PDF, wikiPath(workspace, 'raw', 'golden-master.pdf'));
  return workspace;
}

/** Pin the clock (phase-15/16 Date-only pattern: setTimeout stays real). */
function pinClock(): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-07-29T10:00:00.000Z'));
}

/** Injected Layer 2 stub: writes the extraction JSON exactly like the real path. */
function makeExtractChunkFnStub(extraction: ExtractorResult) {
  return async (wikiDir: string, chunkId: string): Promise<ChunkExtraction> => {
    const jsonPath = join(wikiDir, '.state', 'extracted', `${chunkId}.json`);
    await mkdir(dirname(jsonPath), { recursive: true });
    await writeFile(jsonPath, JSON.stringify(extraction, null, 2) + '\n', 'utf-8');
    return { chunkId, result: extraction, jsonPath, jsonRelativePath: `.state/extracted/${chunkId}.json` };
  };
}

/** Phase 14 keep-all curation stub (phase-15 harness). */
function keepAllOutcome(): CurationOutcome {
  return { decisions: { merges: [], drops: [], keep: [] }, attempts: 1, fallbacks: [], vetoes: [] };
}

const CURATION_STUBS = {
  curateTopicsFn: async () => keepAllOutcome(),
  curateEntitiesFn: async () => keepAllOutcome(),
};

/** Deterministic: HTTP 404 — NEVER retried, NEVER falls back per page (phase-16 fixture). */
function http404Error(): Error {
  return new Error('Anthropic API error (HTTP 404): {"error":{"message":"model not found"}}');
}

/**
 * Preservation-passing synthesized entity page (phase-17 harness shape):
 * every mention context, relationship evidence (outgoing AND incoming), and
 * claim text verbatim, plus exactly the on-map citation markers.
 */
function passingEntityPage(data: EntityPageData): string {
  const { keys } = buildCitationMap(data);
  const markers = keys.map((key) => `[^${key}]`).join(' ');
  return [
    `Synthesis prose for ${data.title}.`,
    '',
    ...data.mentions.map((mention) => `- Page ${mention.page}: "${mention.context}" ${markers}`),
    ...data.relationships.map((relationship) => `- ${relationship.evidence} ${markers}`),
    ...(data.incomingRelationships ?? []).map((relationship) => `- ${relationship.evidence} ${markers}`),
    ...data.claims.map((claim) => `- ${claim.text} ${markers}`),
    '',
    '## Sources',
    '',
    ...keys.map((key) => `[^${key}]: golden-master.pdf, pages 1-3`),
    '',
  ].join('\n');
}

/** Preservation-passing synthesized topic page (same marker discipline). */
function passingTopicPage(data: TopicPageData): string {
  const { keys } = buildCitationMap({ mentions: [], relationships: [], claims: data.claims });
  const markers = keys.map((key) => `[^${key}]`).join(' ');
  return [
    `Topic synthesis for ${data.title}.`,
    '',
    ...data.claims.map((claim) => `- ${claim.text} ${markers}`),
    '',
    '## Sources',
    '',
    ...keys.map((key) => `[^${key}]: golden-master.pdf, pages 1-3`),
    '',
  ].join('\n');
}

/** Install one chunk's document page + extraction JSON (phase-03/14/17 harness). */
function installChunk(
  wikiDir: string,
  chunkId: string,
  extraction: ExtractorResult,
  sourceFile: string,
  pages: string,
): void {
  const documentsDir = join(wikiDir, 'documents');
  const extractedDir = join(wikiDir, '.state', 'extracted');
  mkdirSync(documentsDir, { recursive: true });
  mkdirSync(extractedDir, { recursive: true });
  const frontmatter = {
    title: chunkId,
    type: 'document',
    sources: [{ file: sourceFile, pages }],
    updated: new Date().toISOString(),
  };
  const body = `\n## Extracted Text: Pages ${pages}\n\nFake chunk content.\n`;
  writeFileSync(join(documentsDir, `${chunkId}.md`), matter.stringify(body, frontmatter), 'utf-8');
  writeFileSync(join(extractedDir, `${chunkId}.json`), JSON.stringify(extraction, null, 2) + '\n', 'utf-8');
}

/** Every entity/topic content page on disk (wiki-relative, index.md excluded). */
function listEntityTopicPages(workspace: string): string[] {
  const wikiDir = wikiPath(workspace);
  const out: string[] = [];
  const walk = (abs: string, rel: string): void => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const childRel = `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(join(abs, entry.name), childRel);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md') && entry.name.toLowerCase() !== 'index.md') {
        out.push(childRel);
      }
    }
  };
  for (const section of ['entities', 'topics']) {
    const root = join(wikiDir, section);
    if (existsSync(root)) {
      walk(root, section);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * The §2.4 hash-consistency invariant: every entity/topic content page on
 * disk (all tool-written in these fixtures) has a recorded hash equal to
 * sha256 of its disk content, and no entity/topic pageHashes key points at a
 * missing file. This invariant is the regression net for future hash leaks.
 */
function assertHashInvariant(workspace: string): void {
  const hashes = readPageHashes(workspace);
  const pages = listEntityTopicPages(workspace);
  expect(pages.length, 'fixture must produce entity/topic pages').toBeGreaterThan(0);
  for (const rel of pages) {
    const recorded = hashes[rel];
    expect(recorded, `${rel} must be tracked in pageHashes`).toBeDefined();
    expect(recorded, `${rel}: recorded hash must equal sha256(disk content)`).toBe(
      hashContent(readFileSync(pageAbs(workspace, rel), 'utf-8')),
    );
  }
  for (const rel of Object.keys(hashes)) {
    if (rel.startsWith('entities/') || rel.startsWith('topics/')) {
      expect(existsSync(pageAbs(workspace, rel)), `stale pageHashes entry for deleted page ${rel}`).toBe(true);
    }
  }
}

// ---------------------------------------------------------------------------
// The kill-resume fixture (gates 19.1 + 19.2): one entity, two topics. Run 1
// synthesizes the entity and topic-one, then topic-two's strict stub throws a
// fatal HTTP 404 (gate 16.4's abort pattern) — the run dies AFTER the per-PDF
// checkpoint persisted pre-synthesis hashes but BEFORE the end-of-run
// re-hash. The pool's settle-before-reject guarantee (phase-16 convention)
// lands topic-one's write + record even though topic-two rejects.
// ---------------------------------------------------------------------------

const KILL_RESUME_EXTRACTION: ExtractorResult = {
  entities: [
    {
      name: 'Alpha',
      type: 'person',
      slug: 'alpha',
      folder: 'entities/people',
      significance: 'The fixture entity.',
      mentions: [{ page: 1, context: 'Alpha addressed the board' }],
    },
  ],
  relationships: [],
  claims: [
    { text: 'Claim one about alpha', type: 'topic-one', entities: ['alpha'], page: 2 },
    { text: 'Claim two about alpha', type: 'topic-two', entities: ['alpha'], page: 3 },
  ],
  timeline: [],
  context: 'Phase 19 kill-resume fixture.',
};

const ALPHA_REL = 'entities/people/alpha.md';
const TOPIC_ONE_REL = 'topics/topic-one/topic-one.md';
const TOPIC_TWO_REL = 'topics/topic-two/topic-two.md';

/** Run 1 of the kill-resume fixture: aborts mid-topic-stage on a fatal 404. */
async function runAbortedIngest(workspace: string, progressLines: string[]): Promise<void> {
  await expect(
    ingest('test-wiki', {
      workspace,
      synthesis: true,
      poolStaggerMs: 0,
      ...CURATION_STUBS,
      onProgress: (message) => progressLines.push(message),
      extractChunkFn: makeExtractChunkFnStub(KILL_RESUME_EXTRACTION),
      synthesizeEntityFn: async (data) => passingEntityPage(data),
      synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
      synthesizeTopicFn: async (data) => {
        if (data.slug === 'topic-two') {
          // Let topic-one's write + checkpoint settle before the fatal throw
          // (the pool settles in-flight tasks before rejecting — phase-16
          // convention; the delay keeps this independent of completion order).
          await new Promise((resolve) => setTimeout(resolve, 25));
          throw http404Error();
        }
        return passingTopicPage(data);
      },
      synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
    }),
  ).rejects.toThrow('HTTP 404');
}

/** Run 2 of the kill-resume fixture: every stub passes; the ingest completes. */
async function runPassingIngest(workspace: string, progressLines: string[]) {
  return ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...CURATION_STUBS,
    onProgress: (message) => progressLines.push(message),
    extractChunkFn: makeExtractChunkFnStub(KILL_RESUME_EXTRACTION),
    synthesizeEntityFn: async (data) => passingEntityPage(data),
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
  });
}

// ---------------------------------------------------------------------------
// Gate 19.1: root-cause reproduction (phase doc §2.1) — the kill-resume
// fixture that CONVICTED the leaking stage. Historical record (pre-fix,
// verified by the Implementer and recorded in .state/phase-19-status.json):
// after the abort the synthesized pages' recorded hashes were the
// pre-synthesis TEMPLATE folds persisted by the per-PDF checkpoint
// (ingest.ts:868), never reconciled, and the completed resume false-flagged
// both pages as manually edited (self-perpetuating). With the orchestrator's
// finally-guarded re-hash (patch P1) applied, this same fixture now proves
// the FIX: the abort converges recorded == disk and the resume false-flags
// nothing. Gate 19.2 pins the same end-state on an independent fixture.
// ---------------------------------------------------------------------------
test('gate 19.1: kill-resume reproduction — with the checkpoint fix, the abort converges every hash and the completed resume false-flags nothing', { timeout: 60000 }, async () => {
  pinClock();
  const workspace = setupWikiWithPdf('paper-chase-g19-1-');
  const progressLines: string[] = [];

  await runAbortedIngest(workspace, progressLines);

  // After the abort, every byte on disk is tool-written: the entity and
  // topic-one pages hold the synthesized (strict-pass) content.
  const topicOneDisk = readFileSync(pageAbs(workspace, TOPIC_ONE_REL), 'utf-8');
  const alphaDisk = readFileSync(pageAbs(workspace, ALPHA_REL), 'utf-8');
  const topicTwoDisk = readFileSync(pageAbs(workspace, TOPIC_TWO_REL), 'utf-8');
  expect(topicOneDisk).toContain('Topic synthesis for Topic One.');
  expect(alphaDisk).toContain('Synthesis prose for Alpha.');
  expect(topicTwoDisk).not.toContain('Topic synthesis for Topic Two.');

  // THE FIX: the finally-guarded re-hash ran before the abort propagated, so
  // the recorded hashes for the synthesized pages ARE the disk hashes (the
  // pre-fix leak: they were the stale template folds).
  const hashesAfterAbort = readPageHashes(workspace);
  expect(hashesAfterAbort[TOPIC_ONE_REL]).toBeDefined();
  expect(hashesAfterAbort[ALPHA_REL]).toBeDefined();
  expect(hashesAfterAbort[TOPIC_ONE_REL]).toBe(hashContent(topicOneDisk));
  expect(hashesAfterAbort[ALPHA_REL]).toBe(hashContent(alphaDisk));
  expect(hashesAfterAbort[TOPIC_TWO_REL]).toBe(hashContent(topicTwoDisk));

  // STAGE-PROOF (inverted): the recorded hashes are the FINAL synthesized
  // content, NOT the deterministic structured-template render of the same
  // aggregate (rendered in an identical copy of the wiki whose synthesis
  // records are removed so the materializer re-renders the template) — the
  // checkpoint's pre-synthesis fold no longer leaks into the persisted state.
  const copyWorkspace = makeTempDir('paper-chase-g19-1-copy-');
  mkdirSync(join(copyWorkspace, 'wikis'), { recursive: true });
  cpSync(wikiPath(workspace), wikiPath(copyWorkspace), { recursive: true });
  rmSync(wikiPath(copyWorkspace, '.state', 'synthesis-state.json'), { force: true });
  const copyRender = await materialize('test-wiki', { workspace: copyWorkspace });
  const copyHashByPath = new Map(copyRender.writtenPages.map((page) => [page.path, page.hash]));
  expect(hashesAfterAbort[TOPIC_ONE_REL]).not.toBe(copyHashByPath.get(TOPIC_ONE_REL));
  expect(hashesAfterAbort[ALPHA_REL]).not.toBe(copyHashByPath.get(ALPHA_REL));

  // The afdk exposure condition: without `.state/synthesis-state.json` the
  // Phase 16 preservedPages convergence is absent — the fix must hold anyway.
  rmSync(wikiPath(workspace, '.state', 'synthesis-state.json'), { force: true });

  // The COMPLETED re-ingest false-flags NOTHING and leaves no stale records.
  progressLines.length = 0;
  await runPassingIngest(workspace, progressLines);
  expect(progressLines.some((message) => message.includes('(manually edited)'))).toBe(false);
  expect(readManualEditPages(workspace)).toEqual([]);

  const hashesAfterResume = readPageHashes(workspace);
  expect(hashesAfterResume[TOPIC_ONE_REL]).toBe(hashContent(readFileSync(pageAbs(workspace, TOPIC_ONE_REL), 'utf-8')));
  expect(hashesAfterResume[ALPHA_REL]).toBe(hashContent(readFileSync(pageAbs(workspace, ALPHA_REL), 'utf-8')));
  expect(hashesAfterResume[TOPIC_ONE_REL]).toBe(hashesAfterAbort[TOPIC_ONE_REL]);
  // ...while the page that was never synthesized converged end-to-end.
  expect(hashesAfterResume[TOPIC_TWO_REL]).toBe(hashContent(readFileSync(pageAbs(workspace, TOPIC_TWO_REL), 'utf-8')));
});

// ---------------------------------------------------------------------------
// Gate 19.2: with the leaking stage fixed, the reproduction passes. The fix
// lives in `src/commands/ingest.ts` (the convicted stage): the orchestrator
// applied the finally-guarded re-hash around the synthesis stages
// (`.state/phase-19-status.json` patch P1) and flipped `test.fails` to `test`.
// ---------------------------------------------------------------------------
test('gate 19.2: with the ingest.ts checkpoint fix, the abort leaves recorded == disk and the completed resume has zero false flags', { timeout: 60000 }, async () => {
  pinClock();
  const workspace = setupWikiWithPdf('paper-chase-g19-2-');
  const progressLines: string[] = [];

  await runAbortedIngest(workspace, progressLines);

  // Post-fix expectation: the finally-guarded re-hash ran before the abort
  // propagated, so even the aborted run left recorded == disk for every page.
  const hashesAfterAbort = readPageHashes(workspace);
  expect(hashesAfterAbort[TOPIC_ONE_REL]).toBe(hashContent(readFileSync(pageAbs(workspace, TOPIC_ONE_REL), 'utf-8')));
  expect(hashesAfterAbort[ALPHA_REL]).toBe(hashContent(readFileSync(pageAbs(workspace, ALPHA_REL), 'utf-8')));
  expect(hashesAfterAbort[TOPIC_TWO_REL]).toBe(hashContent(readFileSync(pageAbs(workspace, TOPIC_TWO_REL), 'utf-8')));

  rmSync(wikiPath(workspace, '.state', 'synthesis-state.json'), { force: true });

  progressLines.length = 0;
  await runPassingIngest(workspace, progressLines);
  expect(progressLines.some((message) => message.includes('(manually edited)'))).toBe(false);
  expect(readManualEditPages(workspace)).toEqual([]);
  assertHashInvariant(workspace);
});

// ---------------------------------------------------------------------------
// Gate 19.3: safe convergence (phase doc §2.3) — a page whose disk content
// equals the current deterministic render but whose recorded hash is stale
// converges WITHOUT a conflict entry and IS updated; a page with a true
// human edit (content matching no render) still conflicts exactly as today.
// ---------------------------------------------------------------------------
test('gate 19.3: safe convergence — stale recorded hash over a provably-tool-written page converges; a true human edit still conflicts', async () => {
  pinClock();
  const workspace = makeTempDir('paper-chase-g19-3-');
  init('test-wiki', { workspace });
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'source-one-part-001', KILL_RESUME_EXTRACTION, 'wikis/test-wiki/raw/source-one.pdf', '1-3');

  const first = await materialize('test-wiki', { workspace });
  expect(first.writtenPages.map((page) => page.path)).toEqual(
    expect.arrayContaining([ALPHA_REL, TOPIC_ONE_REL, TOPIC_TWO_REL]),
  );

  // Leg A: stale (bogus) recorded hashes over untouched tool-written pages —
  // disk still equals the deterministic render of the current aggregate.
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const legA = await materialize('test-wiki', {
    workspace,
    pageHashes: {
      [ALPHA_REL]: '0'.repeat(64),
      [TOPIC_ONE_REL]: '0'.repeat(64),
    },
  });
  // Converged, NOT conflicted: the pages are updated and reported.
  expect(legA.convergedPages).toEqual(expect.arrayContaining([ALPHA_REL, TOPIC_ONE_REL]));
  expect(legA.conflicts).toEqual([]);
  expect(legA.entityPages.map((page) => page.slug)).toContain('alpha');
  expect(legA.topicPages.map((page) => page.slug)).toContain('topic-one');
  // The writtenPages fold records the DISK hash (the convergence point), so
  // the caller's bookkeeping converges to truth.
  const writtenA = new Map(legA.writtenPages.map((page) => [page.path, page.hash]));
  expect(writtenA.get(ALPHA_REL)).toBe(hashContent(readFileSync(pageAbs(workspace, ALPHA_REL), 'utf-8')));
  expect(writtenA.get(TOPIC_ONE_REL)).toBe(hashContent(readFileSync(pageAbs(workspace, TOPIC_ONE_REL), 'utf-8')));
  // A convergence note is logged per page — never a conflicts.json entry.
  expect(
    logSpy.mock.calls.some(
      ([message]) => typeof message === 'string' && message.includes(`Converged stale page hash for ${ALPHA_REL}`),
    ),
  ).toBe(true);
  expect(
    logSpy.mock.calls.some(
      ([message]) => typeof message === 'string' && message.includes(`Converged stale page hash for ${TOPIC_ONE_REL}`),
    ),
  ).toBe(true);
  expect(readManualEditPages(workspace)).toEqual([]);
  logSpy.mockRestore();

  // Leg B: true human edits — content matching no render must STILL conflict
  // (human-edit protection is not weakened).
  const humanNote = '\nA journalist rewrote this paragraph by hand.\n';
  writeFileSync(pageAbs(workspace, ALPHA_REL), readFileSync(pageAbs(workspace, ALPHA_REL), 'utf-8') + humanNote, 'utf-8');
  writeFileSync(pageAbs(workspace, TOPIC_ONE_REL), readFileSync(pageAbs(workspace, TOPIC_ONE_REL), 'utf-8') + humanNote, 'utf-8');
  const recordedAfterA = Object.fromEntries(legA.writtenPages.map((page) => [page.path, page.hash]));
  const legB = await materialize('test-wiki', { workspace, pageHashes: recordedAfterA });
  expect(legB.conflicts).toEqual(expect.arrayContaining([ALPHA_REL, TOPIC_ONE_REL]));
  expect(legB.convergedPages).toEqual([]);
  expect(legB.entityPages.map((page) => page.slug)).not.toContain('alpha');
  expect(legB.topicPages.map((page) => page.slug)).not.toContain('topic-one');
  // The human edit survives on disk, and the conflict is logged for review.
  expect(readFileSync(pageAbs(workspace, ALPHA_REL), 'utf-8')).toContain('A journalist rewrote this paragraph by hand.');
  expect(readFileSync(pageAbs(workspace, TOPIC_ONE_REL), 'utf-8')).toContain('A journalist rewrote this paragraph by hand.');
  const manualEditPages = readManualEditPages(workspace);
  expect(manualEditPages).toHaveLength(2);
  expect(manualEditPages).toEqual(expect.arrayContaining([ALPHA_REL, TOPIC_ONE_REL]));
});

// ---------------------------------------------------------------------------
// Gate 19.4: the §2.4 hash-consistency invariant across a two-PDF fixture
// ingest with curation ACTIVE (a topic merge and an entity merge applied):
// after the completed ingest, every tool-written content page's recorded
// hash equals sha256 of its disk content, and merged-away pages leave no
// stale entries behind.
// ---------------------------------------------------------------------------
test('gate 19.4: hash-consistency invariant across a two-PDF ingest with curation active', { timeout: 60000 }, async () => {
  pinClock();
  const workspace = makeTempDir('paper-chase-g19-4-');
  init('test-wiki', { workspace });
  mkdirSync(wikiPath(workspace, 'raw'), { recursive: true });
  copyFileSync(GOLDEN_MASTER_PDF, wikiPath(workspace, 'raw', 'golden-master.pdf'));
  copyFileSync(GOLDEN_MASTER_2_PDF, wikiPath(workspace, 'raw', 'golden-master-2.pdf'));

  const extraction: ExtractorResult = {
    entities: [
      {
        name: 'Alpha',
        type: 'person',
        slug: 'alpha',
        folder: 'entities/people',
        significance: 'The merge survivor.',
        mentions: [{ page: 1, context: 'Alpha addressed the board' }],
      },
      {
        name: 'Beta',
        type: 'person',
        slug: 'beta',
        folder: 'entities/people',
        significance: 'Merged into alpha.',
        mentions: [{ page: 2, context: 'Beta seconded the motion' }],
      },
    ],
    relationships: [],
    claims: [
      { text: 'Claim A about alpha', type: 'topic-a', entities: ['alpha'], page: 2 },
      { text: 'Claim B about beta', type: 'topic-b', entities: ['beta'], page: 3 },
    ],
    timeline: [],
    context: 'Phase 19 invariant fixture.',
  };

  const result = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    extractChunkFn: makeExtractChunkFnStub(extraction),
    // Curation ACTIVE with real merges: topic-b merges into topic-a, entity
    // beta merges into alpha — the merged-away pages are deleted and their
    // hash entries must vanish with them.
    curateTopicsFn: async () => ({
      decisions: { merges: [{ from: ['topic-b'], into: 'topic-a' }], drops: [], keep: [] },
      attempts: 1,
      fallbacks: [],
      vetoes: [],
    }),
    curateEntitiesFn: async () => ({
      decisions: { merges: [{ from: ['beta'], into: 'alpha' }], drops: [], keep: [] },
      attempts: 1,
      fallbacks: [],
      vetoes: [],
    }),
    synthesizeEntityFn: async (data) => passingEntityPage(data),
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
  });

  // Curation applied: one survivor entity page, one survivor topic page.
  expect(result.synthesized).toBe(1);
  expect(result.synthesizedTopics).toBe(1);
  expect(existsSync(pageAbs(workspace, 'entities/people/beta.md'))).toBe(false);
  expect(existsSync(pageAbs(workspace, 'topics/topic-b/topic-b.md'))).toBe(false);
  expect(existsSync(pageAbs(workspace, 'entities/people/alpha.md'))).toBe(true);
  expect(existsSync(pageAbs(workspace, 'topics/topic-a/topic-a.md'))).toBe(true);

  // THE INVARIANT (phase doc §2.4): recorded == sha256(disk) for every
  // tool-written content page, across both per-PDF checkpoints and the
  // end-of-run re-hash, with curation deletions folded.
  assertHashInvariant(workspace);
});
