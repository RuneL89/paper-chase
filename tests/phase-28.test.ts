import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
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
import { dirname, join, relative } from 'node:path';
import matter from 'gray-matter';
import { afterAll, afterEach, expect, test, vi } from 'vitest';
import { ingest, type IngestResult } from '../src/commands/ingest';
import { init } from '../src/commands/init';
import type { ChunkExtraction } from '../src/commands/extract-chunk';
import type { ExtractorResult } from '../src/agents/extractor';
import type { EntityPageData } from '../src/pages/entity-page';
import type { TopicPageData } from '../src/pages/topic-page';
import type { CurationOutcome } from '../src/agents/curation';
import * as materializerModule from '../src/materializer';
import { sha256 } from '../src/utils/hash';
import {
  readPdfProgress,
  materializeCachePath,
} from '../src/state/pdf-progress';
import {
  appendCrashLogRecord,
  crashLogPath,
  tailLines,
  CRASH_LOG_STDERR_TAIL_LINES,
} from '../src/state/crash-log';
import {
  runIngestConductor,
  type CrashPanelState,
  type SpawnWorkerFn,
} from '../src/tui/ingest-conductor';
import {
  serializeWorkerEvent,
  type WorkerEvent,
} from '../src/commands/worker-protocol';

/**
 * Phase 28 gates 28.1–28.8 (fine-grained crash resume, phase doc §4; canon:
 * vision `04` §1 Fine-grained crash resume rider, user-ratified 2026-09-07,
 * + Step 11 fine-grained extension). EVERY gate is LLM-free ($0): extraction
 * rides the injected `extractChunkFn` seam (writing the `_provenance`
 * envelope exactly like the real path — stub-written JSONs are
 * checkpoint-consumable), synthesis chains run through injected
 * `synthesize*Fn` stubs, and crash gates use scripted SpawnWorkerFn fakes
 * (the phase-27 harness) plus one REAL worker-subcommand subprocess whose
 * engine dies deterministically before any LLM call (a missing wiki).
 *
 * Gate 28.9 (doc gates) is verified at closeout by the DOX pass — vision 04
 * rider + Step 11 extension, root AGENTS.md preference + dist 1.0.32 chain
 * entries, and the `.state/phase-16-status.json` deviation note for the
 * amended per-PDF-atomicity expectation (superseded by the Step 11
 * extension).
 *
 * House convention (phase-16): pinned `Date` via fake timers wherever
 * timestamps land in byte-compared artifacts; `poolStaggerMs: 0` on every
 * synthesis run; the golden-master PDF (3 pages) with `pagesPerChunk: 1`
 * yields exactly 3 chunks per PDF so chunk-level resume is observable
 * without fabricating fixtures.
 */

const GOLDEN_MASTER_PDF = 'test-pdfs/golden-master.pdf';
const GOLDEN_MASTER_2_PDF = 'test-pdfs/golden-master-2.pdf';
const PINNED = new Date('2026-09-07T12:00:00.000Z');
const REPORT_PDF = 'report.pdf';

const execFileAsync = promisify(execFile);

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

function setupWikiWithPdf(pdfName: string = REPORT_PDF): string {
  const workspace = makeTempDir('paper-chase-g28-');
  init('test-wiki', { workspace });
  const rawDir = wikiPath(workspace, 'raw');
  mkdirSync(rawDir, { recursive: true });
  copyFileSync(GOLDEN_MASTER_PDF, join(rawDir, pdfName));
  return workspace;
}

/** The `_provenance` envelope, read from the document page's frontmatter (the real path's source). */
function envelopeFor(wikiDir: string, chunkId: string): Record<string, string> {
  const page = matter(readFileSync(join(wikiDir, 'documents', `${chunkId}.md`), 'utf-8'));
  const source = Array.isArray(page.data.sources) ? (page.data.sources[0] as Record<string, unknown>) : undefined;
  return {
    sha256: typeof source?.sha256 === 'string' ? source.sha256 : '',
    pages: typeof source?.pages === 'string' ? source.pages : '',
    sourceFile: typeof source?.file === 'string' ? source.file : '',
    extractedAt: new Date().toISOString(),
  };
}

/**
 * Recording extractChunkFn stub: writes the extraction JSON exactly like the
 * real path (envelope first) and logs every invocation — the zero-call
 * assertions of the resume gates read this log.
 */
function makeExtractStub(byChunk: (chunkId: string) => ExtractorResult): {
  fn: (wikiDir: string, chunkId: string) => Promise<ChunkExtraction>;
  calls: string[];
} {
  const calls: string[] = [];
  const fn = async (wikiDir: string, chunkId: string): Promise<ChunkExtraction> => {
    calls.push(chunkId);
    const extraction = byChunk(chunkId);
    const jsonPath = join(wikiDir, '.state', 'extracted', `${chunkId}.json`);
    mkdirSync(dirname(jsonPath), { recursive: true });
    writeFileSync(
      jsonPath,
      JSON.stringify({ _provenance: envelopeFor(wikiDir, chunkId), ...extraction }, null, 2) + '\n',
      'utf-8',
    );
    return { chunkId, result: extraction, jsonPath, jsonRelativePath: `.state/extracted/${chunkId}.json` };
  };
  return { fn, calls };
}

/**
 * A flat extraction fixture (phase-16 shape). With pagesPerChunk: 1 the
 * golden master's 3 pages become 3 chunks, so a chunk's mentions must carry
 * THAT chunk's page number or the checkpoint guard's schema re-validation
 * (page-in-range) rejects the stored JSON.
 */
function buildExtraction(entityCount: number, page: number = 1): ExtractorResult {
  return {
    entities: Array.from({ length: entityCount }, (_, index) => ({
      name: `Entity ${index}`,
      type: 'person',
      slug: `entity-${index}`,
      folder: 'entities/people',
      significance: `Significance for entity ${index}`,
      mentions: [{ page, context: `Mention context for entity ${index}` }],
    })),
    relationships: [],
    claims: [],
    timeline: [],
    context: 'Phase 28 fixture extraction.',
  };
}

/** Preservation-passing synthesized entity page (phase-16 harness shape). */
function passingEntityPage(data: EntityPageData): string {
  return [
    `Synthesis prose for ${data.title}.`,
    '',
    ...data.mentions.map((mention) => `- Page ${mention.page}: "${mention.context}" [^src1]`),
    ...data.relationships.map((relationship) => `- ${relationship.evidence} [^src1]`),
    ...data.claims.map((claim) => `- ${claim.text} [^src1]`),
    '',
    '[^src1]: report.pdf, pages 1-3',
    '',
  ].join('\n');
}

/** Preservation-passing synthesized topic page. */
function passingTopicPage(data: TopicPageData): string {
  return [
    `Topic synthesis for ${data.title}.`,
    '',
    ...data.claims.map((claim) => `- ${claim.text} [^src1]`),
    '',
    '[^src1]: report.pdf, pages 1-3',
    '',
  ].join('\n');
}

function keepAllOutcome(): CurationOutcome {
  return { decisions: { merges: [], drops: [], keep: [] }, attempts: 1, fallbacks: [], vetoes: [] };
}

function readIngestionSources(workspace: string): Record<string, unknown> {
  const path = wikiPath(workspace, '.state', 'ingestion.json');
  if (!existsSync(path)) {
    return {}; // a first-time PDF aborted before ANY checkpoint was written
  }
  const raw = readFileSync(path, 'utf-8');
  return (JSON.parse(raw) as { sources: Record<string, unknown> }).sources;
}

/** Remove one source's record so the PDF re-enters the loop on the next run (keep everything else). */
function forgetSource(workspace: string, sourceSlug: string): void {
  const path = wikiPath(workspace, '.state', 'ingestion.json');
  const parsed = JSON.parse(readFileSync(path, 'utf-8')) as { sources: Record<string, unknown> };
  delete parsed.sources[sourceSlug];
  writeFileSync(path, JSON.stringify(parsed, null, 2) + '\n', 'utf-8');
}

function extractionJsonPath(workspace: string, chunkId: string): string {
  return wikiPath(workspace, '.state', 'extracted', `${chunkId}.json`);
}

/** Recursively map a directory tree to { relativePath: bytes } for byte-comparison (phase-16 harness). */
function snapshotTree(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string): void => {
    if (!existsSync(dir)) {
      return;
    }
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        out.set(relative(root, full).split('\\').join('/'), readFileSync(full, 'utf-8'));
      }
    }
  };
  walk(root);
  return out;
}

// ---------------------------------------------------------------------------
// Gate 28.1: a valid per-chunk checkpoint skips the Extractor call
// ---------------------------------------------------------------------------

test('gate 28.1 (engine): a valid checkpoint is consumed — no extraction call, counts still reported, one resume line', async () => {
  const workspace = setupWikiWithPdf();
  const leg1 = makeExtractStub((chunkId) => buildExtraction(4, Number(chunkId.slice(-3))));
  await ingest('test-wiki', { workspace, pagesPerChunk: 1, extractChunkFn: leg1.fn });
  expect(leg1.calls).toHaveLength(3);
  forgetSource(workspace, 'report');

  const leg2 = makeExtractStub((chunkId) => buildExtraction(4, Number(chunkId.slice(-3))));
  const progressLines: string[] = [];
  const result = await ingest('test-wiki', {
    workspace,
    pagesPerChunk: 1,
    extractChunkFn: leg2.fn,
    onProgress: (line: string) => progressLines.push(line),
  });

  // ZERO extraction calls — all three chunks were valid checkpoints.
  expect(leg2.calls).toEqual([]);
  // The run report still counts every chunk from the stored JSON.
  expect(result.extractions).toHaveLength(3);
  for (const entry of result.extractions) {
    expect(entry.entities).toBe(4);
  }
  // Exactly ONE dim resume line per PDF (the ratified wording).
  const resumeLines = progressLines.filter((line) => line.includes('Resuming'));
  expect(resumeLines).toEqual(['Resuming report.pdf — 3/3 chunks already extracted, skipping...']);
  // The per-PDF checkpoint landed again.
  expect(readIngestionSources(workspace)['report']).toBeDefined();
});

// ---------------------------------------------------------------------------
// Gate 28.2: every invalid checkpoint variant re-extracts (data never skipped)
// ---------------------------------------------------------------------------

test('gate 28.2 (engine): corrupt / schema-invalid / hash-mismatch / pages-mismatch / legacy JSONs each re-extract', async () => {
  const valid = buildExtraction(3);

  const variants: Array<{ name: string; write: (workspace: string, realHash: string) => void }> = [
    {
      name: 'corrupt JSON',
      write: (workspace) => writeFileSync(extractionJsonPath(workspace, 'report-part-001'), '{ not json'),
    },
    {
      name: 'schema-invalid content',
      write: (workspace, realHash) => {
        const broken = { ...valid, entities: [{ ...valid.entities[0], slug: 'Entity_1' }] };
        writeFileSync(
          extractionJsonPath(workspace, 'report-part-001'),
          JSON.stringify({ _provenance: { sha256: realHash, pages: '1-1', sourceFile: `raw/${REPORT_PDF}`, extractedAt: PINNED.toISOString() }, ...broken }, null, 2),
        );
      },
    },
    {
      name: 'envelope hash mismatch',
      write: (workspace, realHash) => {
        writeFileSync(
          extractionJsonPath(workspace, 'report-part-001'),
          JSON.stringify({ _provenance: { sha256: realHash === 'deadbeef' ? 'deadbeef2' : 'deadbeef', pages: '1-1', sourceFile: `raw/${REPORT_PDF}`, extractedAt: PINNED.toISOString() }, ...valid }, null, 2),
        );
      },
    },
    {
      name: 'envelope pages mismatch',
      write: (workspace, realHash) => {
        writeFileSync(
          extractionJsonPath(workspace, 'report-part-001'),
          JSON.stringify({ _provenance: { sha256: realHash, pages: '9-9', sourceFile: `raw/${REPORT_PDF}`, extractedAt: PINNED.toISOString() }, ...valid }, null, 2),
        );
      },
    },
    {
      name: 'legacy no envelope',
      write: (workspace) => writeFileSync(extractionJsonPath(workspace, 'report-part-001'), JSON.stringify(valid, null, 2)),
    },
  ];

  for (const variant of variants) {
    const workspace = setupWikiWithPdf();
    // Run once so the document pages exist and the real hash is knowable,
    // then replace chunk 1's checkpoint with the invalid variant and make
    // the PDF re-enter the loop.
    const seed = makeExtractStub((chunkId) => valid);
    await ingest('test-wiki', { workspace, pagesPerChunk: 1, extractChunkFn: seed.fn });
    const realHash = await sha256(wikiPath(workspace, 'raw', REPORT_PDF));
    variant.write(workspace, realHash);
    forgetSource(workspace, 'report');

    const leg2 = makeExtractStub((chunkId) => valid);
    await ingest('test-wiki', { workspace, pagesPerChunk: 1, extractChunkFn: leg2.fn });
    // The invalid variant forced a re-extraction of chunk 1.
    expect(leg2.calls, variant.name).toContain('report-part-001');
    // ...and the re-written file is a VALID checkpoint again (envelope present).
    const rewritten = JSON.parse(readFileSync(extractionJsonPath(workspace, 'report-part-001'), 'utf-8')) as Record<string, unknown>;
    expect(rewritten._provenance, variant.name).toBeDefined();
  }
});

// ---------------------------------------------------------------------------
// Gate 28.3: envelope write + first-run identity
// ---------------------------------------------------------------------------

test('gate 28.3 (engine): a fresh run writes the envelope everywhere, emits no resume lines, leaves no scaffolding', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED);
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  const runOnce = async (): Promise<{ workspace: string; progressLines: string[] }> => {
    const workspace = setupWikiWithPdf();
    const stub = makeExtractStub(() => buildExtraction(2));
    const progressLines: string[] = [];
    await ingest('test-wiki', {
      workspace,
      pagesPerChunk: 1,
      extractChunkFn: stub.fn,
      onProgress: (line: string) => progressLines.push(line),
    });
    return { workspace, progressLines };
  };

  const first = await runOnce();

  // Every extraction JSON carries the envelope as its FIRST key, with the
  // frontmatter's sha256/pages/sourceFile and a parseable timestamp.
  const realHash = await sha256(wikiPath(first.workspace, 'raw', REPORT_PDF));
  for (const chunk of ['report-part-001', 'report-part-002', 'report-part-003']) {
    const parsed = JSON.parse(readFileSync(extractionJsonPath(first.workspace, chunk), 'utf-8')) as Record<string, unknown>;
    expect(Object.keys(parsed)[0]).toBe('_provenance');
    const envelope = parsed._provenance as Record<string, string>;
    expect(envelope.sha256).toBe(realHash);
    expect(envelope.pages).toMatch(/^[1-3]-[1-3]$/);
    expect(envelope.sourceFile).toContain(REPORT_PDF);
    expect(Number.isNaN(Date.parse(envelope.extractedAt))).toBe(false);
  }

  // No resume line on a healthy first run (recovery-path only).
  expect(first.progressLines.some((line) => line.includes('Resuming'))).toBe(false);

  // No scaffolding left behind: the progress file AND the cache dir are gone
  // once every PDF checkpointed (byte-identity with the pre-Phase-28 .state tree).
  expect(existsSync(wikiPath(first.workspace, '.state', 'pdf-progress.json'))).toBe(false);
  expect(existsSync(wikiPath(first.workspace, '.state', 'pdf-progress'))).toBe(false);

  // Determinism: a second pinned fresh run produces the identical durable tree
  // (documents + sources + extracted JSONs + ingestion state + rolling memory).
  const second = await runOnce();
  const dirRoots = ['documents', 'sources', '.state/extracted'];
  for (const rel of dirRoots) {
    const a = snapshotTree(wikiPath(first.workspace, rel));
    const b = snapshotTree(wikiPath(second.workspace, rel));
    expect([...b.keys()].sort(), rel).toEqual([...a.keys()].sort());
    for (const [path, bytes] of a) {
      expect(b.get(path), `${rel}/${path}`).toBe(bytes);
    }
  }
  for (const rel of ['.state/ingestion.json', '.state/rolling-memory.json']) {
    expect(readFileSync(wikiPath(second.workspace, ...rel.split('/')), 'utf-8'), rel).toBe(
      readFileSync(wikiPath(first.workspace, ...rel.split('/')), 'utf-8'),
    );
  }
});

// ---------------------------------------------------------------------------
// Gate 28.4: a worker death mid-extraction resumes at the first missing chunk
// ---------------------------------------------------------------------------

test('gate 28.4 (engine): crash mid-extraction — the retry resumes at the first missing chunk with one resume line', async () => {
  const workspace = setupWikiWithPdf();
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  // Leg 1: chunk 2 dies hard (an escaped error — the worker-death shape).
  const leg1 = makeExtractStub((chunkId) => buildExtraction(5, Number(chunkId.slice(-3))));
  const dying = async (wikiDir: string, chunkId: string): Promise<ChunkExtraction> => {
    if (chunkId === 'report-part-002') {
      throw new Error('simulated worker death mid-extraction');
    }
    return leg1.fn(wikiDir, chunkId);
  };
  await expect(
    ingest('test-wiki', { workspace, pagesPerChunk: 1, extractChunkFn: dying }),
  ).rejects.toThrow('simulated worker death mid-extraction');

  // The dead attempt left chunk 1's checkpoint on disk and NO per-PDF record.
  expect(existsSync(extractionJsonPath(workspace, 'report-part-001'))).toBe(true);
  expect(readIngestionSources(workspace)['report']).toBeUndefined();

  // Leg 2: the auto-retry — resumes at the FIRST MISSING chunk.
  const leg2 = makeExtractStub((chunkId) => buildExtraction(5, Number(chunkId.slice(-3))));
  const progressLines: string[] = [];
  await ingest('test-wiki', {
    workspace,
    pagesPerChunk: 1,
    extractChunkFn: leg2.fn,
    onProgress: (line: string) => progressLines.push(line),
  });

  expect(leg2.calls).toEqual(['report-part-002', 'report-part-003']);
  const resumeLines = progressLines.filter((line) => line.includes('Resuming'));
  expect(resumeLines).toEqual(['Resuming report.pdf — 1/3 chunks already extracted, skipping...']);
  expect(readIngestionSources(workspace)['report']).toBeDefined();
});

// ---------------------------------------------------------------------------
// Gate 28.5: changed-PDF cleanup deletes stale JSONs, preserves fresh checkpoints
// ---------------------------------------------------------------------------

test('gate 28.5 (engine): the changed-PDF cleanup removes mismatched JSONs but preserves fresh-hash checkpoints', async () => {
  const workspace = setupWikiWithPdf();
  const seed = makeExtractStub((chunkId) => buildExtraction(3, Number(chunkId.slice(-3))));
  await ingest('test-wiki', { workspace, pagesPerChunk: 1, extractChunkFn: seed.fn });
  const oldChunks = readdirSync(wikiPath(workspace, '.state', 'extracted')).filter((name) => name.endsWith('.json'));
  expect(oldChunks.length).toBeGreaterThanOrEqual(2);

  // Change the PDF (different fixture = different hash) — the re-ingest path.
  copyFileSync(GOLDEN_MASTER_2_PDF, wikiPath(workspace, 'raw', REPORT_PDF));
  const newHash = await sha256(wikiPath(workspace, 'raw', REPORT_PDF));
  const oldHash = await sha256(GOLDEN_MASTER_PDF);
  expect(newHash).not.toBe(oldHash);

  // Simulate a crashed changed-PDF attempt: part-001 was ALREADY re-extracted
  // under the NEW hash before the crash (a fresh checkpoint); the other old
  // JSONs still carry the OLD hash (stale).
  const freshCheckpoint = JSON.stringify(
    {
      _provenance: { sha256: newHash, pages: '1-1', sourceFile: `raw/${REPORT_PDF}`, extractedAt: PINNED.toISOString() },
      ...buildExtraction(6, 1),
    },
    null,
    2,
  ) + '\n';
  writeFileSync(extractionJsonPath(workspace, 'report-part-001'), freshCheckpoint);

  const leg2 = makeExtractStub((chunkId) => buildExtraction(6, Number(chunkId.slice(-3))));
  await ingest('test-wiki', { workspace, pagesPerChunk: 1, extractChunkFn: leg2.fn });

  // part-001 SURVIVED the cleanup byte-for-byte (fresh-hash checkpoint) and
  // was consumed — never re-extracted. Every OTHER chunk re-extracted.
  expect(leg2.calls).not.toContain('report-part-001');
  expect(readFileSync(extractionJsonPath(workspace, 'report-part-001'), 'utf-8')).toBe(freshCheckpoint);
  expect(leg2.calls.length).toBeGreaterThanOrEqual(1);
  // No stale (old-hash) JSON can remain: every surviving file is either the
  // fresh checkpoint or newly written under the new hash.
  for (const name of readdirSync(wikiPath(workspace, '.state', 'extracted'))) {
    if (!name.endsWith('.json')) continue;
    const parsed = JSON.parse(readFileSync(wikiPath(workspace, '.state', 'extracted', name), 'utf-8')) as { _provenance?: { sha256?: string } };
    expect(parsed._provenance?.sha256, name).toBe(newHash);
  }
});

// ---------------------------------------------------------------------------
// Gate 28.6: stage markers — crash after materialize resumes with materialize
// (and its curation pair) SKIPPED, and the entry is removed at the checkpoint
// ---------------------------------------------------------------------------

test('gate 28.6 (engine): crash mid-synthesis — retry skips materialize + curation, restores aggregates, removes the entry at the checkpoint', { timeout: 60_000 }, async () => {
  const workspace = setupWikiWithPdf();
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  const synthStubs = (calls: string[], explodeOn?: string) => ({
    synthesizeEntityFn: async (data: EntityPageData) => {
      calls.push(data.slug);
      if (data.slug === explodeOn) {
        throw new Error('Anthropic API error (HTTP 404): {"error":{"message":"model not found"}}');
      }
      return passingEntityPage(data);
    },
    synthesizeEntityPermissiveFn: async (data: EntityPageData) => passingEntityPage(data),
    synthesizeTopicFn: async (data: TopicPageData) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data: TopicPageData) => passingTopicPage(data),
  });

  // Leg 1: 10 entities; entity-9 dies on a fatal 404 mid-synthesis (after
  // materialize + curation completed for this PDF). 1/10 = 10% does not trip
  // the outage detector before the kill lands (the 16.11 arithmetic).
  const leg1Synth: string[] = [];
  await expect(
    ingest('test-wiki', {
      workspace,
      synthesis: true,
      poolStaggerMs: 0,
      curateTopicsFn: async () => keepAllOutcome(),
      curateEntitiesFn: async () => keepAllOutcome(),
      extractChunkFn: makeExtractStub(() => buildExtraction(10, 1)).fn,
      ...synthStubs(leg1Synth, 'entity-9'),
    }),
  ).rejects.toThrow('HTTP 404');

  // The in-flight progress entry survived the crash with the stage markers
  // and the synthesis journal: 9 done pages, the cache beside it.
  const progress = await readPdfProgress(wikiPath(workspace));
  const entry = progress['report'];
  expect(entry).toBeDefined();
  expect(entry.stages.extraction).toBe(true);
  expect(entry.stages.materialize).toBe(true);
  expect(entry.stages.curation).toBe(true);
  expect(entry.stages.synthesis?.done ?? []).toContain('entities/people/entity-5.md');
  expect(existsSync(materializeCachePath(wikiPath(workspace), 'report'))).toBe(true);

  // Leg 2: the auto-retry. Materialize and its curation pair must be SKIPPED.
  const materializeSpy = vi.spyOn(materializerModule, 'materialize');
  let curationCalls = 0;
  const countingCuration = {
    curateTopicsFn: async () => {
      curationCalls += 1;
      return keepAllOutcome();
    },
    curateEntitiesFn: async () => {
      curationCalls += 1;
      return keepAllOutcome();
    },
  };
  const leg2Extraction = makeExtractStub(() => buildExtraction(10, 1));
  const leg2Synth: string[] = [];
  const progressLines: string[] = [];
  await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...countingCuration,
    extractChunkFn: leg2Extraction.fn,
    onProgress: (line: string) => progressLines.push(line),
    ...synthStubs(leg2Synth),
  });

  expect(leg2Extraction.calls).toEqual([]); // chunks: per-chunk checkpoints
  expect(materializeSpy).not.toHaveBeenCalled(); // stage marker + cache restore
  expect(curationCalls).toBe(0); // the curation pair rode the skip
  expect(leg2Synth).toEqual(['entity-9']); // 9 done pages skipped by their records
  expect(progressLines.some((line) => line.includes('Resuming report.pdf'))).toBe(true);

  // The checkpoint removed the scaffolding: entry gone, cache file gone.
  expect(existsSync(wikiPath(workspace, '.state', 'pdf-progress.json'))).toBe(false);
  expect(existsSync(materializeCachePath(wikiPath(workspace), 'report'))).toBe(false);
  expect(readIngestionSources(workspace)['report']).toBeDefined();
});

// ---------------------------------------------------------------------------
// Gate 28.7: the journal is observer-only — a fingerprint-mismatched page
// re-synthesizes despite a journal done-entry
// ---------------------------------------------------------------------------

test('gate 28.7 (engine): a changed-aggregate page re-synthesizes despite the journal marking it done', { timeout: 60_000 }, async () => {
  const workspace = setupWikiWithPdf();
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  const synthStubs = (calls: string[]) => ({
    synthesizeEntityFn: async (data: EntityPageData) => {
      calls.push(data.slug);
      return passingEntityPage(data);
    },
    synthesizeEntityPermissiveFn: async (data: EntityPageData) => passingEntityPage(data),
    synthesizeTopicFn: async (data: TopicPageData) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data: TopicPageData) => passingTopicPage(data),
  });

  // Leg 1: crash on entity-9 (fatal 404) with entities 0-8 done.
  await expect(
    ingest('test-wiki', {
      workspace,
      synthesis: true,
      poolStaggerMs: 0,
      curateTopicsFn: async () => keepAllOutcome(),
      curateEntitiesFn: async () => keepAllOutcome(),
      extractChunkFn: makeExtractStub(() => buildExtraction(10, 1)).fn,
      synthesizeEntityFn: async (data: EntityPageData) => {
        if (data.slug === 'entity-9') {
          throw new Error('Anthropic API error (HTTP 404): {"error":{"message":"model not found"}}');
        }
        return passingEntityPage(data);
      },
      synthesizeEntityPermissiveFn: async (data: EntityPageData) => passingEntityPage(data),
      synthesizeTopicFn: async (data: TopicPageData) => passingTopicPage(data),
      synthesizeTopicPermissiveFn: async (data: TopicPageData) => passingTopicPage(data),
    }),
  ).rejects.toThrow('HTTP 404');

  // The journal marked entity-5 done (the override premise).
  expect((await readPdfProgress(wikiPath(workspace)))['report'].stages.synthesis?.done).toContain('entities/people/entity-5.md');

  // Tamper: entity-5 gains a NEW mention — the aggregate changes (the page's
  // dataHash no longer matches its record) while the envelope stays valid, so
  // the chunk checkpoint still holds and only the aggregate diverges.
  const path = extractionJsonPath(workspace, 'report-part-001');
  const parsed = JSON.parse(readFileSync(path, 'utf-8')) as {
    _provenance: Record<string, string>;
    entities: Array<{ slug: string; mentions: Array<{ page: number; context: string }> }>;
  };
  const entity5 = parsed.entities.find((entity) => entity.slug === 'entity-5');
  entity5?.mentions.push({ page: 2, context: 'Extra evidence added after the crash' });
  writeFileSync(path, JSON.stringify(parsed, null, 2) + '\n', 'utf-8');

  // Leg 2: entity-5 RE-SYNTHESIZES (fingerprint mismatch beats the journal's
  // done-entry) alongside entity-9 (never done); the other 8 done pages skip.
  // entity-5 takes the AMENDMENT path first (record exists + fingerprint
  // changed); the empty-operations patch stub fails preservation, exhausts
  // the reask loop, and falls back to FULL synthesis — the Phase 26
  // never-half-patched law — landing entity-5 in the synthesis call log.
  const leg2Synth: string[] = [];
  const amendmentCalls: string[] = [];
  await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async () => keepAllOutcome(),
    extractChunkFn: makeExtractStub(() => buildExtraction(10, 1)).fn,
    amendmentFn: async (request) => {
      amendmentCalls.push(request.pageSlug);
      return '{ "operations": [] }';
    },
    ...synthStubs(leg2Synth),
  });

  expect(amendmentCalls).toContain('entity-5');
  expect(leg2Synth.sort()).toEqual(['entity-5', 'entity-9']);
});

// ---------------------------------------------------------------------------
// Gate 28.8: crash telemetry — fatal capture, cost-line filtering, stderr mirror, panel row
// ---------------------------------------------------------------------------

test('gate 28.8a (unit): tailLines filters LLM cost lines before the cut; crash records round-trip the fatal fields', async () => {
  const costLine = (index: number) => `LLM Call | Tokens: ${index}/${index} | Cost: $0.001${index}`;
  const mixed = [
    ...Array.from({ length: 30 }, (_, index) => costLine(index)),
    'Error: extractor hit the 32768-token cap',
    '    at extractChunk (src/agents/extractor.ts:421:15)',
    ...Array.from({ length: 10 }, (_, index) => costLine(100 + index)),
  ].join('\n');
  const tail = tailLines(mixed, CRASH_LOG_STDERR_TAIL_LINES);
  expect(tail.split('\n')).toEqual([
    'Error: extractor hit the 32768-token cap',
    '    at extractChunk (src/agents/extractor.ts:421:15)',
  ]);

  const workspace = makeTempDir('paper-chase-g28-crash-');
  const dir = wikiPath(workspace);
  await appendCrashLogRecord(dir, {
    timestamp: '2026-09-07T09:28:54.000Z',
    pdf: 'DAD_2025.pdf',
    phase: 'pdf',
    exitCode: 1,
    stderrTail: 'cost lines filtered away',
    attempt: 1,
    autoRetried: true,
    fatalError: 'Error: extractor hit the 32768-token cap',
    fatalStack: '    at extractChunk (src/agents/extractor.ts:421:15)',
  });
  const record = JSON.parse(readFileSync(crashLogPath(dir), 'utf-8').trim());
  expect(record.fatalError).toBe('Error: extractor hit the 32768-token cap');
  expect(record.fatalStack).toBe('    at extractChunk (src/agents/extractor.ts:421:15)');

  // Without a fatal event (hard crash), the fields stay ABSENT — the record
  // shape is additive (gate 27.6's exact-equal assertion still holds).
  await appendCrashLogRecord(dir, {
    timestamp: '2026-09-07T09:31:00.000Z',
    pdf: null,
    phase: 'finalize',
    exitCode: 3,
    stderrTail: 'hard death',
    attempt: 1,
    autoRetried: true,
  });
  const second = JSON.parse(readFileSync(crashLogPath(dir), 'utf-8').trim().split('\n')[1]);
  expect(second.fatalError).toBeUndefined();
  expect(second.fatalStack).toBeUndefined();
});

test('gate 28.8b (conductor): a fatal event + cost-noise stderr become a diagnosed crash record', { timeout: 60_000 }, async () => {
  const workspace = setupWikiWithPdf();
  const costNoise = Array.from({ length: 30 }, (_, index) => `LLM Call | Tokens: ${index}/900 | Cost: $0.000${index}`).join('\n');

  let invocation = 0;
  const spawnWorker: SpawnWorkerFn = (args, handlers) => {
    invocation += 1;
    const onClose = new Promise<{ code: number | null }>((resolvePromise) => {
      queueMicrotask(() => {
        if (invocation === 1) {
          handlers.onStdoutChunk(
            serializeWorkerEvent({
              type: 'fatal',
              error: 'Error: extractor hit the 32768-token cap',
              stack: 'at extractChunk (src/agents/extractor.ts:421:15)',
            } satisfies WorkerEvent),
          );
          handlers.onStderrChunk(`${costNoise}\nError: extractor hit the 32768-token cap\n`);
          resolvePromise({ code: 1 });
        } else {
          handlers.onStdoutChunk(
            serializeWorkerEvent({
              type: 'result',
              result: {
                wiki: 'test-wiki',
                wikiDir: wikiPath(workspace),
                ingested: [{ source: 'report', file: REPORT_PDF, pageCount: 3, documentPages: [], warnings: [], tablesFound: 0 }],
                skipped: [],
                extractions: [],
              } as unknown as IngestResult,
            } satisfies WorkerEvent),
          );
          resolvePromise({ code: 0 });
        }
      });
    });
    return { onClose, kill: () => {} };
  };

  const run = await runIngestConductor('test-wiki', {
    workspace,
    ingest: {},
    onProgress: () => {},
    spawnWorker,
    autoRetry: { retries: 3, backoffMs: 0 },
    sleep: async () => {},
  });

  expect(run.status).toBe('complete');
  const crashLines = readFileSync(crashLogPath(wikiPath(workspace)), 'utf-8').trim().split('\n');
  expect(crashLines).toHaveLength(1);
  const record = JSON.parse(crashLines[0]) as { fatalError?: string; fatalStack?: string; stderrTail?: string };
  expect(record.fatalError).toBe('Error: extractor hit the 32768-token cap');
  expect(record.fatalStack).toBe('at extractChunk (src/agents/extractor.ts:421:15)');
  expect(record.stderrTail).toBe('Error: extractor hit the 32768-token cap');
  expect(record.stderrTail?.includes('LLM Call |')).toBe(false);
});

test('gate 28.8c (worker subprocess): the caught fatal error lands on worker stderr AND stdout as a fatal event', { timeout: 90_000 }, async () => {
  // A REAL worker subcommand whose engine throws deterministically BEFORE any
  // LLM call: a real initialized wiki with a CORRUPTED ingestion state (the
  // readIngestionState descriptive-throw path) — exercising the cli.ts catch
  // path end-to-end (fatal event on stdout + console.error on stderr + exit 1).
  // Spawned with the phase-20 house pattern: execFile + explicit cwd.
  const workspace = setupWikiWithPdf();
  mkdirSync(wikiPath(workspace, '.state'), { recursive: true });
  writeFileSync(wikiPath(workspace, '.state', 'ingestion.json'), '{ corrupt on purpose');
  const tsxEntry = join('node_modules', 'tsx', 'dist', 'cli.mjs');
  expect(existsSync(tsxEntry)).toBe(true);

  let failure: { code?: number; stdout?: string; stderr?: string } | null = null;
  // Strip the VITEST env var from the child: src/cli.ts only executes as a
  // direct run when it is absent (its import-under-vitest guard, line ~264) —
  // this child IS a direct execution and must run the real subcommand.
  const childEnv = { ...process.env };
  delete childEnv.VITEST;
  try {
    await execFileAsync(
      process.execPath,
      [tsxEntry, 'src/cli.ts', 'ingest-worker', 'test-wiki', '--workspace', workspace, '--pdf', REPORT_PDF],
      { cwd: process.cwd(), maxBuffer: 16 * 1024 * 1024, encoding: 'utf-8', env: childEnv },
    );
  } catch (err) {
    failure = err as { code?: number; stdout?: string; stderr?: string };
  }

  // The worker exited 1 with the caught error...
  expect(failure, 'the worker must fail on the corrupted state').not.toBeNull();
  expect(failure?.code).toBe(1);
  // The fatal event is the terminal stdout line...
  const lines = (failure?.stdout ?? '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  expect(lines.length).toBeGreaterThan(0);
  const fatalLine = JSON.parse(lines[lines.length - 1]) as { type: string; error: string };
  expect(fatalLine.type).toBe('fatal');
  expect(fatalLine.error).toContain('not valid JSON');
  // ...and the SAME error text now also lands on worker stderr (the mirror).
  expect(failure?.stderr ?? '').toContain(fatalLine.error);
});

// ---------------------------------------------------------------------------
// Gate 28.9: doc gates — verified at closeout (DOX pass): vision 04 §1 rider
// (2026-09-07) + Step 11 extension, root AGENTS.md preference + dist 1.0.32
// chain entries, .state/phase-16-status.json deviation note.
// ---------------------------------------------------------------------------
