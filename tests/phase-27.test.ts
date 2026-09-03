import { mkdtempSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { afterAll, expect, test, vi } from 'vitest';
import { init } from '../src/commands/init';
import { ingest, formatIngestSummary, type IngestResult } from '../src/commands/ingest';
import type { ChunkExtraction } from '../src/commands/extract-chunk';
import type { ExtractorResult } from '../src/agents/extractor';
import type { CurationOutcome } from '../src/agents/curation';
import {
  serializeWorkerEvent,
  parseWorkerEventLine,
  createWorkerEventReader,
  type WorkerEvent,
} from '../src/commands/worker-protocol';
import {
  runIngestConductor,
  mergeIngestResults,
  discoverWorkspacePdfs,
  AUTO_RETRY_RETRIES,
  AUTO_RETRY_BACKOFF_MS,
  type SpawnWorkerFn,
  type CrashPanelState,
} from '../src/tui/ingest-conductor';
import { resolveWorkerCommand, WORKER_CMD_ENV } from '../src/tui/worker-spawn';
import { crashLogPath, tailLines, CRASH_LOG_STDERR_TAIL_LINES } from '../src/state/crash-log';
import { wikiDir } from '../src/utils/paths';
import { readIngestionState } from '../src/state/ingestion-state';
import { buildCitationMap, type EntityPageData } from '../src/pages/entity-page';
import type { TopicPageData } from '../src/pages/topic-page';

/**
 * Phase 27 gates 27.1–27.11 (per-PDF worker-process isolation; canon: vision
 * `04` §1 Worker-process isolation amendment, user-ratified 2026-09-02).
 * $0 LLM budget — every gate is deterministic: engine-split equivalence runs
 * on the frozen stub seams (the phase-26 fixture pattern), crash gates use a
 * scripted fake SpawnWorkerFn (the real fault-injection env var is exercised
 * indirectly through the same outcome shapes), and doc gates read the canon
 * artifacts off disk.
 */

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

function wikiPath(workspace: string, ...parts: string[]): string {
  return join(workspace, 'wikis', 'test-wiki', ...parts);
}

const GOLDEN_MASTER_PDF = 'test-pdfs/golden-master.pdf';
const PINNED = new Date('2026-09-02T12:00:00.000Z');
const REPORT_2023 = 'report-2023.pdf';
const REPORT_2024 = 'report-2024.pdf';

async function setupWikiWithPdfs(fileNames: string[]): Promise<string> {
  const workspace = makeTempDir('paper-chase-g27-');
  await init('test-wiki', { workspace });
  const rawDir = wikiPath(workspace, 'raw');
  mkdirSync(rawDir, { recursive: true });
  for (const fileName of fileNames) {
    copyFileSync(GOLDEN_MASTER_PDF, join(rawDir, fileName));
  }
  return workspace;
}

function keepAllOutcome(): CurationOutcome {
  return { decisions: { merges: [], drops: [], keep: [] }, attempts: 1, fallbacks: [], vetoes: [] };
}

const KEEP_ALL_STUBS = {
  curateTopicsFn: async () => keepAllOutcome(),
  curateEntitiesFn: async () => keepAllOutcome(),
};

function makeExtractChunkFnStub(byChunk: Record<string, ExtractorResult>) {
  const seen: string[] = [];
  const fn = async (wikiDirParam: string, chunkId: string): Promise<ChunkExtraction> => {
    seen.push(chunkId);
    const extraction = byChunk[chunkId];
    if (!extraction) {
      throw new Error(`unexpected chunk ${chunkId}`);
    }
    const jsonPath = join(wikiDirParam, '.state', 'extracted', `${chunkId}.json`);
    mkdirSync(dirname(jsonPath), { recursive: true });
    writeFileSync(jsonPath, JSON.stringify(extraction, null, 2) + '\n', 'utf-8');
    return { chunkId, result: extraction, jsonPath, jsonRelativePath: `.state/extracted/${chunkId}.json` };
  };
  return { fn, seen };
}

function extractionFixture(source: string, entityName: string, slug: string): ExtractorResult {
  // The phase-26 fixture shape: per-entity slug/folder/significance, plain
  // page/context mentions (source keys are derived from the chunk id).
  return {
    entities: [
      {
        name: entityName,
        type: 'organization',
        slug,
        folder: 'entities/organizations',
        significance: `${entityName} as described in ${source}.`,
        mentions: [
          { page: 1, context: `${entityName} appears in ${source}` },
          { page: 2, context: `The ${entityName} board met twice` },
        ],
      },
    ],
    relationships: [],
    claims: [
      {
        text: `${entityName} operated in ${source}`,
        type: 'operational',
        entities: [slug],
        page: 3,
      },
    ],
    timeline: [],
    context: `Phase 27 fixture ${source}.`,
  } as ExtractorResult;
}

function citationMarker(
  data: {
    mentions: Array<{ page?: number; context?: string; source: string; pages: string }>;
    relationships: Array<{ source: string; pages: string }>;
    claims: Array<{ text?: string; type?: string; entities?: string[]; page?: number; source: string; pages: string }>;
    incomingRelationships?: Array<{ source: string; pages: string }>;
  },
  source: string,
  pages: string,
): string {
  // The phase-26 fixture pattern: the marker the deterministic citation map
  // assigns, so every evidence item is preserved verbatim (the synthesis
  // stubs must PASS preservation, not fall back to templates).
  const { citationMap } = buildCitationMap(data as unknown as Parameters<typeof buildCitationMap>[0]);
  const index = citationMap.get(`${source}|${pages}`);
  if (index === undefined) {
    throw new Error(`Citation map missing entry for ${source} pages ${pages}`);
  }
  return `[^src${index}]`;
}

function passingEntityPage(data: EntityPageData): string {
  const lines: string[] = [`Synthesis prose for ${data.title}.`, ''];
  if (data.mentions.length > 0) {
    lines.push('## Mentions');
    for (const mention of data.mentions) {
      lines.push(`- Page ${mention.page}: "${mention.context}" ${citationMarker(data, mention.source, mention.pages)}`);
    }
    lines.push('');
  }
  const relationships = [...data.relationships, ...(data.incomingRelationships ?? [])];
  if (relationships.length > 0) {
    lines.push('## Relationships');
    for (const relationship of relationships) {
      lines.push(`- ${relationship.evidence} ${citationMarker(data, relationship.source, relationship.pages)}`);
    }
    lines.push('');
  }
  if (data.claims.length > 0) {
    lines.push('## Claims');
    for (const claim of data.claims) {
      lines.push(`- ${claim.text} ${citationMarker(data, claim.source, claim.pages)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function passingTopicPage(data: TopicPageData): string {
  const lines: string[] = [`Topic synthesis for ${data.title}.`, ''];
  if (data.claims.length > 0) {
    lines.push('## Claims');
    for (const claim of data.claims) {
      lines.push(`- ${claim.text} ${citationMarker({ mentions: [], relationships: [], claims: data.claims }, claim.source, claim.pages)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/** Deterministic, preservation-passing synthesis stubs (phase-26 pattern). */
function synthesisStubs() {
  const entityCalls: string[] = [];
  return {
    entityCalls,
    synthesizeEntityFn: async (data: EntityPageData) => {
      entityCalls.push(data.title);
      return passingEntityPage(data);
    },
    synthesizeEntityPermissiveFn: async (data: EntityPageData) => passingEntityPage(data),
    synthesizeTopicFn: async (data: TopicPageData) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data: TopicPageData) => passingTopicPage(data),
  };
}

function treeSnapshot(root: string, skip: (path: string) => boolean, base = root): Map<string, string> {
  const out = new Map<string, string>();
  for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      for (const [path, bytes] of treeSnapshot(full, skip, base)) {
        out.set(path, bytes);
      }
    } else if (entry.isFile() && statSync(full).isFile()) {
      const rel = relative(base, full).split('\\').join('/');
      if (rel.toLowerCase().endsWith('.pdf') || skip(rel)) {
        continue;
      }
      out.set(rel, readFileSync(full, 'utf-8'));
    }
  }
  return out;
}

/** Run-window artifacts that legitimately differ between one run and two. */
const VOLATILE_STATE = new Set([
  '.state/metrics.json',
  '.state/llm-calls.json',
  '.state/transport-stalls.jsonl',
  '.state/validation-report.json',
  '.state/conflicts.json',
]);

// ---------------------------------------------------------------------------
// Gate 27.1: engine-split equivalence
// ---------------------------------------------------------------------------

test('gate 27.1 (ingest): sequential onlyPdfs runs converge to the full-run tree; a selected run checkpoints only its PDF', { timeout: 180_000 }, async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED);

  const extraction2023 = extractionFixture('report-2023', 'Alpha Corp', 'alpha-corp');
  const extraction2024 = extractionFixture('report-2024', 'Beta LLC', 'beta-llc');

  const runOptions = () => {
    const stubs = synthesisStubs();
    const extractor = makeExtractChunkFnStub({
      'report-2023-part-001': extraction2023,
      'report-2024-part-001': extraction2024,
    });
    return {
      options: {
        synthesis: true,
        poolStaggerMs: 0,
        ...KEEP_ALL_STUBS,
        extractChunkFn: extractor.fn,
        // The 26.3 pattern: an empty-patch amendment stub — run B's new
        // topic evidence degrades through reask into the (stubbed) full
        // synthesis, deterministically, in BOTH run shapes.
        amendmentFn: async () => '{ "operations": [] }',
        ...stubs,
      },
      extractor,
    };
  };

  // (a) The full run — the pre-Phase-27 shape (no selectors).
  const fullWorkspace = await setupWikiWithPdfs([REPORT_2023, REPORT_2024]);
  const full = runOptions();
  const fullResult = await ingest('test-wiki', { workspace: fullWorkspace, ...full.options });

  // (b) The conductor shape: one worker per PDF, then the finalize worker —
  // exactly what runIngestConductor spawns (per-PDF workers skip the tail;
  // the finalize worker runs only the tail).
  const seqWorkspace = await setupWikiWithPdfs([REPORT_2023, REPORT_2024]);
  const runA = runOptions();
  const resultA = await ingest('test-wiki', { workspace: seqWorkspace, onlyPdfs: [REPORT_2023], ...runA.options });
  // Checkpoint law: a selected run records ONLY its PDF (assert BEFORE the
  // second worker records its own).
  const stateA = await readIngestionState(wikiPath(seqWorkspace));
  expect(Object.keys(stateA.sources)).toEqual(['report-2023']);
  expect(resultA.ingested.map((source) => source.file)).toEqual([REPORT_2023]);
  const runB = runOptions();
  await ingest('test-wiki', { workspace: seqWorkspace, onlyPdfs: [REPORT_2024], ...runB.options });
  const runF = runOptions();
  await ingest('test-wiki', { workspace: seqWorkspace, finalizeOnly: true, ...runF.options });

  // Convergence: every durable artifact matches the full run.
  const fullTree = treeSnapshot(wikiPath(fullWorkspace), (p) => VOLATILE_STATE.has(p));
  const seqTree = treeSnapshot(wikiPath(seqWorkspace), (p) => VOLATILE_STATE.has(p));
  const fullKeys = Array.from(fullTree.keys()).sort();
  const seqKeys = Array.from(seqTree.keys()).sort();
  expect(seqKeys).toEqual(fullKeys);
  const mismatches = fullKeys.filter((key) => fullTree.get(key) !== seqTree.get(key));
  if (mismatches.length > 0) {
    const first = mismatches[0];
    expect(seqTree.get(first)).toBe(fullTree.get(first));
  }

  // The unselected full run still works (regression guard for the loop edit).
  expect(fullResult.ingested.map((source) => source.file)).toEqual([REPORT_2023, REPORT_2024]);
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Gate 27.2: the worker event protocol
// ---------------------------------------------------------------------------

test('gate 27.2 (protocol): round-trip of all four event shapes; noise tolerated; chunk-safe reader', () => {
  const progress: WorkerEvent = { type: 'progress', line: 'Chunk 3/24 (pages 11-15)' };
  const stall: WorkerEvent = {
    type: 'stall',
    info: { waitSeconds: 600, attempt: 2, maxAttempts: 6, statusCode: 0, label: 'curation-entities-bucket-2' },
  };
  const result: WorkerEvent = { type: 'result', result: { wiki: 'x', ingested: [] } };
  const fatal: WorkerEvent = { type: 'fatal', error: 'boom', stack: 'at x' };

  for (const event of [progress, stall, result, fatal]) {
    const line = serializeWorkerEvent(event);
    expect(line.endsWith('\n')).toBe(true);
    expect(parseWorkerEventLine(line)).toEqual(event);
  }

  // Noise and blank lines are ignored (never relayed, never crash the reader).
  expect(parseWorkerEventLine('')).toBeNull();
  expect(parseWorkerEventLine('not json at all')).toBeNull();
  expect(parseWorkerEventLine('{"type":"unknown"}')).toBeNull();
  expect(parseWorkerEventLine(JSON.stringify({ type: 'progress', line: 42 }))).toBeNull();
  // A stall event without its info payload is noise, not a crash (v1.0.1).
  expect(parseWorkerEventLine(JSON.stringify({ type: 'stall' }))).toBeNull();

  // The reader reassembles events split across arbitrary chunk boundaries.
  const events: WorkerEvent[] = [];
  const reader = createWorkerEventReader((event) => events.push(event));
  const blob = `${serializeWorkerEvent(progress)}${serializeWorkerEvent(result)}`;
  reader.push(blob.slice(0, 17));
  reader.push(blob.slice(17, 40));
  reader.push(blob.slice(40));
  expect(events).toEqual([progress, result]);

  // flush() surfaces a trailing line that never got its newline (a worker
  // dying mid-write).
  const dying = createWorkerEventReader((event) => events.push(event));
  dying.push(serializeWorkerEvent(fatal).trimEnd());
  dying.flush();
  expect(events[events.length - 1]).toEqual(fatal);
});

// ---------------------------------------------------------------------------
// Gate 27.3: conductor sequencing + result merge
// ---------------------------------------------------------------------------

interface ScriptedSpawnCall {
  args: string[];
  emitStderr?: string;
}

/** A fake SpawnWorkerFn driven by a per-invocation script. */
function makeScriptedSpawn(scripts: Array<(call: ScriptedSpawnCall) => { lines: WorkerEvent[]; code: number | null }>): {
  spawnWorker: SpawnWorkerFn;
  calls: ScriptedSpawnCall[];
} {
  const calls: ScriptedSpawnCall[] = [];
  let invocation = 0;
  const spawnWorker: SpawnWorkerFn = (args, handlers) => {
    const call: ScriptedSpawnCall = { args };
    calls.push(call);
    const script = scripts[Math.min(invocation, scripts.length - 1)];
    invocation += 1;
    const { lines, code } = script(call);
    let closed = false;
    const onClose = new Promise<{ code: number | null }>((resolvePromise) => {
      queueMicrotask(() => {
        for (const line of lines) {
          handlers.onStdoutChunk(serializeWorkerEvent(line));
        }
        if (call.emitStderr !== undefined) {
          handlers.onStderrChunk(call.emitStderr);
        }
        closed = true;
        resolvePromise({ code });
      });
    });
    return {
      onClose,
      kill: () => {
        if (!closed) {
          // The scripted fake resolves kills as a null-code close.
          handlers.onStderrChunk('killed\n');
        }
      },
    };
  };
  return { spawnWorker, calls };
}

function workerResultFor(pdf: string | null): { type: 'result'; result: Partial<IngestResult> } {
  if (pdf === null) {
    return {
      type: 'result',
      result: { synthesized: 1, finalValidation: { links: { broken: [] }, citations: { invalid: [], missingSource: [] }, schema: { invalid: [] } } as never },
    };
  }
  return {
    type: 'result',
    result: {
      ingested: [{ source: pdf.replace(/\.pdf$/, ''), file: pdf, pageCount: 5, documentPages: [], warnings: [], tablesFound: 0 }],
      synthesized: 2,
      patchedPages: 1,
    },
  };
}

test('gate 27.3 (conductor): two PDFs then finalize — three spawns in order, results merged', { timeout: 60_000 }, async () => {
  const workspace = await setupWikiWithPdfs([REPORT_2023, REPORT_2024]);
  const { spawnWorker, calls } = makeScriptedSpawn([
    () => ({ lines: [{ type: 'progress', line: 'pdf a line' }, workerResultFor(REPORT_2023)], code: 0 }),
    () => ({ lines: [{ type: 'progress', line: 'pdf b line' }, workerResultFor(REPORT_2024)], code: 0 }),
    () => ({ lines: [{ type: 'progress', line: 'finalize line' }, workerResultFor(null)], code: 0 }),
  ]);
  const progressLines: string[] = [];

  const run = await runIngestConductor('test-wiki', {
    workspace,
    ingest: {},
    onProgress: (line) => progressLines.push(line),
    spawnWorker,
  });

  expect(run.status).toBe('complete');
  expect(calls).toHaveLength(3);
  // Strict sequencing: PDF a, then PDF b, then finalize — nothing else.
  const spawnSequence = calls.map((call) =>
    call.args.includes('--finalize') ? 'finalize' : call.args[call.args.indexOf('--pdf') + 1],
  );
  expect(spawnSequence).toEqual([REPORT_2023, REPORT_2024, 'finalize']);
  expect(calls[0].args).toContain('--pdf');
  expect(calls[0].args[calls[0].args.indexOf('--pdf') + 1]).toBe(REPORT_2023);
  expect(calls[1].args[calls[1].args.indexOf('--pdf') + 1]).toBe(REPORT_2024);
  expect(calls[2].args).toContain('--finalize');

  // Relay: worker progress lines reach the channel verbatim, in order, each
  // preceded by its v1.0.1 conductor banner (the per-worker separator).
  expect(progressLines).toEqual([
    `── [1/2] ${REPORT_2023} ──`,
    'pdf a line',
    `── [2/2] ${REPORT_2024} ──`,
    'pdf b line',
    '── [finalize] validation · DOX · workspace · cross-wiki · updater ──',
    'finalize line',
  ]);

  // Merge: lists concatenated, counters summed, finalize's object fields win.
  expect(run.result.ingested.map((source) => source.file)).toEqual([REPORT_2023, REPORT_2024]);
  expect(run.result.synthesized).toBe(2 + 2 + 1);
  expect(run.result.patchedPages).toBe(2);
  expect(run.result.finalValidation).toBeDefined();
});

test('gate 27.3b (unit): mergeIngestResults sums counters, concats lists, keeps objects from later workers', () => {
  const base: IngestResult = {
    wiki: 'w',
    wikiDir: '/w',
    ingested: [],
    skipped: ['old.pdf'],
    extractions: [],
    synthesized: 3,
    patchedPages: 1,
    deferred: ['crashed.pdf'],
  };
  const worker: IngestResult = {
    wiki: 'w',
    wikiDir: '/w',
    ingested: [
      { source: 'a', file: 'a.pdf', pageCount: 1, documentPages: [], warnings: [], tablesFound: 0 },
    ],
    skipped: [],
    extractions: [],
    synthesized: 2,
    synthesizedTopics: 4,
    languages: { input: 'da', output: 'da' },
    agentsUpdateProposed: true,
  };
  const merged = mergeIngestResults(base, worker);
  expect(merged.ingested).toHaveLength(1);
  expect(merged.skipped).toEqual(['old.pdf']);
  expect(merged.deferred).toEqual(['crashed.pdf']);
  expect(merged.synthesized).toBe(5);
  expect(merged.synthesizedTopics).toBe(4);
  expect(merged.languages).toEqual({ input: 'da', output: 'da' });
  expect(merged.agentsUpdateProposed).toBe(true);
});

// ---------------------------------------------------------------------------
// Gate 27.4: crash → auto-retry → same-PDF respawn → completion
// ---------------------------------------------------------------------------

test('gate 27.4 (conductor): a crashed worker is retried on the SAME PDF, audited, and the run completes', { timeout: 60_000 }, async () => {
  const workspace = await setupWikiWithPdfs([REPORT_2023, REPORT_2024]);
  let aAttempts = 0;
  const { spawnWorker, calls } = makeScriptedSpawn([
    () => {
      aAttempts += 1;
      return { lines: [{ type: 'progress', line: 'partial work line' }], code: 1 }; // crash, no result
    },
    () => {
      aAttempts += 1;
      return { lines: [{ type: 'progress', line: 'resumed line' }, workerResultFor(REPORT_2023)], code: 0 };
    },
    () => ({ lines: [workerResultFor(REPORT_2024)], code: 0 }),
    () => ({ lines: [workerResultFor(null)], code: 0 }),
  ]);
  const progressLines: string[] = [];

  const run = await runIngestConductor('test-wiki', {
    workspace,
    ingest: {},
    onProgress: (line) => progressLines.push(line),
    spawnWorker,
    autoRetry: { retries: 3, backoffMs: 0 },
    sleep: async () => {},
  });

  expect(run.status).toBe('complete');
  expect(aAttempts).toBe(2);
  // The retry targeted the SAME PDF.
  expect(calls[0].args).toContain(REPORT_2023);
  expect(calls[1].args).toContain(REPORT_2023);

  // The audit log recorded the death with autoRetried=true.
  const crashLines = readFileSync(crashLogPath(wikiPath(workspace)), 'utf-8').trim().split('\n');
  expect(crashLines).toHaveLength(1);
  const record = JSON.parse(crashLines[0]) as { pdf: string; phase: string; exitCode: number; attempt: number; autoRetried: boolean };
  expect(record.pdf).toBe(REPORT_2023);
  expect(record.phase).toBe('pdf');
  expect(record.exitCode).toBe(1);
  expect(record.attempt).toBe(1);
  expect(record.autoRetried).toBe(true);

  // The auto-retry announcement is visible on the progress channel.
  expect(progressLines.some((line) => line.includes('auto-retry') && line.includes(REPORT_2023))).toBe(true);
});

// ---------------------------------------------------------------------------
// Gate 27.5: defer semantics (user-initiated Skip)
// ---------------------------------------------------------------------------

test('gate 27.5 (conductor): user Skip defers the PDF — nothing deleted, next run re-selects it', { timeout: 60_000 }, async () => {
  const workspace = await setupWikiWithPdfs([REPORT_2023, REPORT_2024]);
  const { spawnWorker } = makeScriptedSpawn([
    () => ({ lines: [], code: 1 }), // a crashes ×4 (1 + 3 auto-retries)
    () => ({ lines: [], code: 1 }),
    () => ({ lines: [], code: 1 }),
    () => ({ lines: [], code: 1 }),
    () => ({ lines: [workerResultFor(REPORT_2024)], code: 0 }), // b succeeds
    () => ({ lines: [workerResultFor(null)], code: 0 }), // finalize
  ]);

  const panels: Array<CrashPanelState | null> = [];
  const run = await runIngestConductor('test-wiki', {
    workspace,
    ingest: {},
    onProgress: () => {},
    spawnWorker,
    autoRetry: { retries: 3, backoffMs: 0 },
    sleep: async () => {},
    onCrashPanel: (state) => {
      if (state !== null) {
        panels.push(state);
      }
    },
    requestDecision: async (state) => (state.pdf === REPORT_2023 ? 'skip' : 'abort'),
  });

  expect(run.status).toBe('complete');
  expect(run.result.deferred).toEqual([REPORT_2023]);
  expect(run.result.ingested.map((source) => source.file)).toEqual([REPORT_2024]);

  // The deferred PDF was NOT recorded as ingested — the next run selects it.
  // (The scripted workers never run the engine, so NOTHING is recorded —
  // the deferral lives in the conductor's result, and the engine-level
  // recording is gate 27.1's checkpoint law.)
  const state = await readIngestionState(wikiPath(workspace));
  expect(state.sources['report-2023']).toBeUndefined();
  expect(state.sources['report-2024']).toBeUndefined();
  expect(await discoverWorkspacePdfs(workspace, 'test-wiki')).toContain(REPORT_2023);
  // Nothing deleted: the PDF is still in raw/.
  expect(existsSync(wikiPath(workspace, 'raw', REPORT_2023))).toBe(true);

  // Four crash records: attempts 1-3 autoRetried, attempt 4 surfaced.
  const crashLines = readFileSync(crashLogPath(wikiPath(workspace)), 'utf-8').trim().split('\n');
  expect(crashLines).toHaveLength(4);
  const lastRecord = JSON.parse(crashLines[3]);
  expect(lastRecord.attempt).toBe(4);
  expect(lastRecord.autoRetried).toBe(false);

  // The panel was surfaced (phase + exit code + stderr tail present).
  expect(panels).toHaveLength(1);
  const surfaced = panels[0];
  expect(surfaced).not.toBeNull();
  expect((surfaced as CrashPanelState).phase).toBe('pdf');
  expect((surfaced as CrashPanelState).exitCode).toBe(1);

  // The banner mentions the deferral.
  expect(formatIngestSummary(run.result)).toContain('1 deferred');
});

// ---------------------------------------------------------------------------
// Gate 27.6: crash-log bounding + record shape
// ---------------------------------------------------------------------------

test('gate 27.6 (unit): tailLines bounds the stderr tail; the record carries every field', async () => {
  expect(CRASH_LOG_STDERR_TAIL_LINES).toBe(25);
  const many = Array.from({ length: 60 }, (_, index) => `line ${index}`).join('\n');
  const tail = tailLines(many, CRASH_LOG_STDERR_TAIL_LINES);
  expect(tail.split('\n')).toHaveLength(25);
  expect(tail.startsWith('line 35')).toBe(true);

  const workspace = await setupWikiWithPdfs([]);
  const dir = wikiDir(workspace, 'test-wiki');
  const { appendCrashLogRecord } = await import('../src/state/crash-log');
  await appendCrashLogRecord(dir, {
    timestamp: '2026-09-02T18:55:00.000Z',
    pdf: 'X.pdf',
    phase: 'pdf',
    exitCode: 1,
    stderrTail: 'Error: escaped',
    attempt: 2,
    autoRetried: true,
  });
  const parsed = JSON.parse(readFileSync(crashLogPath(dir), 'utf-8').trim());
  expect(parsed).toEqual({
    timestamp: '2026-09-02T18:55:00.000Z',
    pdf: 'X.pdf',
    phase: 'pdf',
    exitCode: 1,
    stderrTail: 'Error: escaped',
    attempt: 2,
    autoRetried: true,
  });
});

// ---------------------------------------------------------------------------
// Gate 27.7: spawn resolver
// ---------------------------------------------------------------------------

test('gate 27.7 (resolver): dev path, bundle path, env override, and the loud missing-entry error', () => {
  const prev = process.env[WORKER_CMD_ENV];

  // (a) Dev path: this repo has tsx + src/cli.ts.
  const dev = resolveWorkerCommand();
  expect(dev.command).toBe(process.execPath);
  expect(dev.baseArgs[1].endsWith(join('src', 'cli.ts'))).toBe(true);
  expect(dev.baseArgs[0].endsWith(join('tsx', 'dist', 'cli.mjs'))).toBe(true);

  // (b) Bundle path: a root with dist/chase.mjs but no tsx.
  const bundleRoot = makeTempDir('g27-bundle-');
  mkdirSync(join(bundleRoot, 'dist'), { recursive: true });
  writeFileSync(join(bundleRoot, 'dist', 'chase.mjs'), '// bundle\n');
  const bundle = resolveWorkerCommand(bundleRoot);
  expect(bundle.baseArgs).toEqual([join(bundleRoot, 'dist', 'chase.mjs')]);

  // (c) Missing entry: loud configuration error BEFORE any spawn.
  const emptyRoot = makeTempDir('g27-empty-');
  expect(() => resolveWorkerCommand(emptyRoot)).toThrow(/Worker entry not found/);

  // (d) The test/ops override wins outright.
  process.env[WORKER_CMD_ENV] = 'C:/fake/worker.cmd';
  try {
    expect(resolveWorkerCommand(bundleRoot)).toEqual({ command: 'C:/fake/worker.cmd', baseArgs: [] });
  } finally {
    if (prev === undefined) {
      delete process.env[WORKER_CMD_ENV];
    } else {
      process.env[WORKER_CMD_ENV] = prev;
    }
  }
});

// ---------------------------------------------------------------------------
// Gate 27.8: interrupt forwarding (SIGINT/abort)
// ---------------------------------------------------------------------------

test('gate 27.8 (conductor): abort kills the active worker, ends the run cleanly, spawns nothing further', { timeout: 60_000 }, async () => {
  const workspace = await setupWikiWithPdfs([REPORT_2023, REPORT_2024]);

  const calls: Array<{ args: string[]; killed: boolean; resolveClose: (code: number | null) => void }> = [];
  const spawnWorker: SpawnWorkerFn = (args) => {
    const call = { args, killed: false, resolveClose: (_code: number | null) => {} };
    const onClose = new Promise<{ code: number | null }>((resolvePromise) => {
      call.resolveClose = (code) => resolvePromise({ code });
    });
    calls.push(call);
    return {
      onClose,
      kill: () => {
        call.killed = true;
        call.resolveClose(null);
      },
    };
  };

  const controller = new AbortController();
  const pending = runIngestConductor('test-wiki', {
    workspace,
    ingest: {},
    onProgress: () => {},
    spawnWorker,
    signal: controller.signal,
  });

  // Wait until the first worker is up, then abort (the Ctrl+C path).
  await vi.waitFor(() => expect(calls).toHaveLength(1));
  controller.abort();
  const run = await pending;

  expect(run.status).toBe('aborted');
  expect(calls).toHaveLength(1); // no PDF-b worker, no finalize
  expect(calls[0].killed).toBe(true); // the active worker was terminated
});

// ---------------------------------------------------------------------------
// Gate 27.9: auto-retry cap — stop and surface, never auto-defer
// ---------------------------------------------------------------------------

test('gate 27.9 (conductor): cap = 1 + 3 attempts with backoff waits, then the panel — never auto-defer', { timeout: 60_000 }, async () => {
  const workspace = await setupWikiWithPdfs([REPORT_2023]);
  const { spawnWorker, calls } = makeScriptedSpawn([() => ({ lines: [], code: 1 })]);
  const sleeps: number[] = [];
  let decisionSeen = false;

  const run = await runIngestConductor('test-wiki', {
    workspace,
    ingest: {},
    onProgress: () => {},
    spawnWorker,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    requestDecision: async () => {
      decisionSeen = true;
      return 'abort';
    },
  });

  expect(AUTO_RETRY_RETRIES).toBe(3);
  expect(AUTO_RETRY_BACKOFF_MS).toBe(30_000);
  expect(calls).toHaveLength(4); // 1 + 3 auto-retries, exactly
  expect(sleeps).toEqual([30_000, 30_000, 30_000]);
  expect(decisionSeen).toBe(true); // the USER decided — never auto-defer
  expect(run.status).toBe('aborted');
  expect(run.result.deferred).toEqual([]); // abort ≠ defer
});

// ---------------------------------------------------------------------------
// Gate 27.10: pixel-identity of the ingest options passed through
// ---------------------------------------------------------------------------

test('gate 27.10 (conductor): worker args carry the ingest options verbatim (screen parity)', { timeout: 60_000 }, async () => {
  const workspace = await setupWikiWithPdfs([REPORT_2023]);
  const { spawnWorker, calls } = makeScriptedSpawn([
    () => ({ lines: [workerResultFor(REPORT_2023)], code: 0 }),
    () => ({ lines: [workerResultFor(null)], code: 0 }),
  ]);
  await runIngestConductor('test-wiki', {
    workspace,
    ingest: {
      extract: true,
      synthesis: true,
      updateAgents: true,
      doxLlm: true,
      crossWiki: true,
      forceCrossWiki: true,
      inputLanguage: 'da',
      outputLanguage: 'da',
    },
    onProgress: () => {},
    spawnWorker,
  });

  const pdfArgs = calls[0].args;
  expect(pdfArgs.slice(0, 4)).toEqual(['ingest-worker', 'test-wiki', '--workspace', workspace]);
  expect(pdfArgs).toContain('--pdf');
  expect(pdfArgs).toContain('--synthesis');
  expect(pdfArgs).toContain('--update-agents');
  expect(pdfArgs).not.toContain('--no-extract');
  expect(pdfArgs).not.toContain('--no-dox-llm');
  expect(pdfArgs).not.toContain('--no-cross-wiki');
  expect(pdfArgs).toContain('--force-cross-wiki');
  expect(pdfArgs[pdfArgs.indexOf('--input-language') + 1]).toBe('da');
  expect(pdfArgs[pdfArgs.indexOf('--output-language') + 1]).toBe('da');
  // The opt-out flags map correctly (the inverse direction).
  const second = makeScriptedSpawn([
    () => ({ lines: [workerResultFor(REPORT_2023)], code: 0 }),
    () => ({ lines: [workerResultFor(null)], code: 0 }),
  ]);
  // re-use workspace: PDF 1 already "ingested" only in the scripted world —
  // the conductor still discovers it (no engine ran), so it spawns again.
  await runIngestConductor('test-wiki', {
    workspace,
    ingest: { extract: false, doxLlm: false, crossWiki: false },
    onProgress: () => {},
    spawnWorker: second.spawnWorker,
  });
  const optOutArgs = second.calls[0].args;
  expect(optOutArgs).toContain('--no-extract');
  expect(optOutArgs).toContain('--no-dox-llm');
  expect(optOutArgs).toContain('--no-cross-wiki');
});

// ---------------------------------------------------------------------------
// Gate 27.11: doc gates — the canon artifacts are law
// ---------------------------------------------------------------------------

test('gate 27.11 (docs): vision amendment, preference, phase doc, and VERSION all present', () => {
  const vision = readFileSync(join(import.meta.dirname, '..', 'Project Vision', '04_orchestration_detailed.md'), 'utf-8');
  expect(vision).toContain('Worker-process isolation (amended 2026-09-02, user-ratified)');
  expect(vision).toContain('crash-log.jsonl');
  expect(vision).toContain('never auto-defers');

  const agents = readFileSync(join(import.meta.dirname, '..', 'AGENTS.md'), 'utf-8');
  expect(agents).toContain('2026-09-02: Per-PDF worker-process isolation');

  const phaseDoc = readFileSync(join(import.meta.dirname, '..', 'Implementation Plan', 'PHASE_27_per_pdf_worker_isolation.md'), 'utf-8');
  expect(phaseDoc).toContain('Worker-process isolation amendment');
  for (const gate of ['27.1', '27.2', '27.3', '27.4', '27.5', '27.6', '27.7', '27.8', '27.9', '27.10', '27.11']) {
    expect(phaseDoc).toContain(gate);
  }

  // The launcher VERSION was bumped (asset-affecting change: TUI bundle).
  const launcher = readFileSync(join(import.meta.dirname, '..', 'scripts', 'launcher-entry.ts'), 'utf-8');
  expect(launcher).toMatch(/VERSION = '1\.0\.3[0-9]'/);
});

// ---------------------------------------------------------------------------
// v1.0.1 gates (worker-scope fencing + conductor observability, user-ratified
// 2026-09-03 — born from the live rkkp evidence: false orphan warnings from
// every skip-worker, and the all-skip repair fallback re-running per worker)
// ---------------------------------------------------------------------------

test('gate 27.12 (orphan fencing): a scoped worker never emits removed-PDF warnings; a vanished target skips gracefully', { timeout: 120_000 }, async () => {
  // Both PDFs ingested once (Layer-1 only — deterministic, no stubs needed).
  const workspace = await setupWikiWithPdfs([REPORT_2023, REPORT_2024]);
  await ingest('test-wiki', { workspace, extract: false, onProgress: () => {} });
  const state = await readIngestionState(wikiPath(workspace));
  expect(Object.keys(state.sources).sort()).toEqual(['report-2023', 'report-2024']);

  // The scoped worker's filtered list holds ONLY its own PDF — before the
  // fix this false-flagged every OTHER recorded source (the live AKDB bug:
  // four false "no longer in raw/" warnings with all PDFs present).
  const scopedLines: string[] = [];
  const scoped = await ingest('test-wiki', {
    workspace,
    extract: false,
    onlyPdfs: [REPORT_2023],
    onProgress: (line) => scopedLines.push(line),
  });
  expect(scopedLines.some((line) => line.includes('no longer in raw/'))).toBe(false);
  expect(scoped.ingested).toHaveLength(0); // hash-skip
  expect(scoped.skipped).toEqual(['report-2023']); // the skipped list carries source slugs

  // A scoped worker whose target vanished between discovery and spawn: one
  // honest skip line, no all-sources warning spam, clean return.
  const ghostLines: string[] = [];
  const ghost = await ingest('test-wiki', {
    workspace,
    extract: false,
    onlyPdfs: ['ghost.pdf'],
    onProgress: (line) => ghostLines.push(line),
  });
  expect(ghostLines).toEqual(['Skipping ghost.pdf — no longer in raw/.']);
  expect(ghost.ingested).toHaveLength(0);
});

test('gate 27.13 (orphan fencing): the finalize run keeps the removed-PDF warning — Phase 8 law at run level', { timeout: 120_000 }, async () => {
  const workspace = await setupWikiWithPdfs([REPORT_2023]);
  await ingest('test-wiki', { workspace, extract: false, onProgress: () => {} });

  // The PDF is genuinely removed — the finalize worker (no selector, full
  // raw/ list) must still warn exactly once; derived pages are kept.
  rmSync(wikiPath(workspace, 'raw', REPORT_2023));
  const finalizeLines: string[] = [];
  await ingest('test-wiki', {
    workspace,
    extract: false,
    finalizeOnly: true,
    onProgress: (line) => finalizeLines.push(line),
  });
  const warnings = finalizeLines.filter((line) => line.includes('no longer in raw/'));
  expect(warnings).toEqual([
    'Warning: report-2023 is recorded in ingestion state but its PDF is no longer in raw/. Derived pages were kept.',
  ]);
});

test('gate 27.14 (fallback fencing): a hash-skipping scoped worker makes ZERO curation calls', { timeout: 180_000 }, async () => {
  // Run A (full, fresh): records the source with real extraction stubs.
  const extraction2023 = extractionFixture('report-2023', 'Alpha Corp', 'alpha-corp');
  const stubs = synthesisStubs();
  const extractor = makeExtractChunkFnStub({ 'report-2023-part-001': extraction2023 });
  const workspace = await setupWikiWithPdfs([REPORT_2023]);
  await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...KEEP_ALL_STUBS,
    extractChunkFn: extractor.fn,
    ...stubs,
  });
  const state = await readIngestionState(wikiPath(workspace));
  expect(Object.keys(state.sources)).toEqual(['report-2023']);

  // Run B (scoped, hash-skip): before v1.0.1 the all-skip fallback re-ran
  // materialize + curation + synthesis for the WHOLE wiki inside this
  // worker (the live 8h53m AFDK pass); now the fallback is run-level and
  // per-PDF workers never run it.
  const runBStubs = synthesisStubs();
  const curateTopicsCalls: string[] = [];
  const curateEntitiesCalls: string[] = [];
  const lines: string[] = [];
  await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    curateTopicsFn: async () => {
      curateTopicsCalls.push('topics');
      return keepAllOutcome();
    },
    curateEntitiesFn: async () => {
      curateEntitiesCalls.push('entities');
      return keepAllOutcome();
    },
    extractChunkFn: extractor.fn,
    ...runBStubs,
    onlyPdfs: [REPORT_2023],
    onProgress: (line) => lines.push(line),
  });
  expect(lines).toContain(`Skipping ${REPORT_2023} (unchanged)`);
  expect(curateTopicsCalls).toHaveLength(0);
  expect(curateEntitiesCalls).toHaveLength(0);
  expect(runBStubs.entityCalls).toHaveLength(0); // no fallback synthesis either
});

test('gate 27.15 (idleFallback): the finalize run repairs an all-skip wiki ONLY when the conductor asks', { timeout: 180_000 }, async () => {
  const extraction2023 = extractionFixture('report-2023', 'Alpha Corp', 'alpha-corp');
  const extractor = makeExtractChunkFnStub({ 'report-2023-part-001': extraction2023 });
  const workspace = await setupWikiWithPdfs([REPORT_2023]);
  await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...KEEP_ALL_STUBS,
    extractChunkFn: extractor.fn,
    ...synthesisStubs(),
  });

  // Without the flag: a finalize run performs no materialize/curation (the
  // pre-v1.0.1 law — per-PDF workers already did the work).
  const idleCounters = { topics: 0, entities: 0 };
  await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    curateTopicsFn: async () => {
      idleCounters.topics += 1;
      return keepAllOutcome();
    },
    curateEntitiesFn: async () => {
      idleCounters.entities += 1;
      return keepAllOutcome();
    },
    extractChunkFn: extractor.fn,
    ...synthesisStubs(),
    finalizeOnly: true,
  });
  expect(idleCounters.topics).toBe(0);
  expect(idleCounters.entities).toBe(0);

  // With the flag (the conductor's "nothing was ingested this run" signal):
  // exactly ONE repair pass — materialize + curation + synthesis — runs
  // before the tail. The 2026-07-21 repair law, restored to batch semantics.
  const repairCounters = { topics: 0, entities: 0 };
  const repairStubs = synthesisStubs();
  await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    curateTopicsFn: async () => {
      repairCounters.topics += 1;
      return keepAllOutcome();
    },
    curateEntitiesFn: async () => {
      repairCounters.entities += 1;
      return keepAllOutcome();
    },
    extractChunkFn: extractor.fn,
    ...repairStubs,
    finalizeOnly: true,
    idleFallback: true,
  });
  expect(repairCounters.topics).toBeGreaterThan(0);
  expect(repairCounters.entities).toBeGreaterThan(0);
});

test('gate 27.16 (conductor): --idle-fallback iff nothing ingested; banners and worker positions on every spawn', { timeout: 60_000 }, async () => {
  // Busy run: a PDF worker landed an ingest → the finalize worker gets NO
  // idle-fallback flag.
  const busy = await setupWikiWithPdfs([REPORT_2023, REPORT_2024]);
  const busySpawn = makeScriptedSpawn([
    () => ({ lines: [workerResultFor(REPORT_2023)], code: 0 }),
    () => ({ lines: [workerResultFor(REPORT_2024)], code: 0 }),
    () => ({ lines: [workerResultFor(null)], code: 0 }),
  ]);
  const busyPositions: Array<{ index: number; total: number; pdf: string | null; phase: string }> = [];
  const busyRun = await runIngestConductor('test-wiki', {
    workspace: busy,
    ingest: {},
    onProgress: () => {},
    spawnWorker: busySpawn.spawnWorker,
    onWorkerChange: (info) => busyPositions.push({ ...info }),
  });
  expect(busyRun.status).toBe('complete');
  expect(busySpawn.calls[2].args).toContain('--finalize');
  expect(busySpawn.calls[2].args).not.toContain('--idle-fallback');
  expect(busyPositions).toEqual([
    { index: 1, total: 2, pdf: REPORT_2023, phase: 'pdf' },
    { index: 2, total: 2, pdf: REPORT_2024, phase: 'pdf' },
    { index: 3, total: 2, pdf: null, phase: 'finalize' },
  ]);

  // Idle run: every PDF hash-skipped (empty ingested lists) → the finalize
  // worker carries the repair flag.
  const idle = await setupWikiWithPdfs([REPORT_2023]);
  const idleResult: Partial<IngestResult> = { ingested: [], skipped: [REPORT_2023] };
  const idleSpawn = makeScriptedSpawn([
    () => ({ lines: [{ type: 'result', result: idleResult }], code: 0 }),
    () => ({ lines: [workerResultFor(null)], code: 0 }),
  ]);
  const idleProgress: string[] = [];
  const idleRun = await runIngestConductor('test-wiki', {
    workspace: idle,
    ingest: {},
    onProgress: (line) => idleProgress.push(line),
    spawnWorker: idleSpawn.spawnWorker,
  });
  expect(idleRun.status).toBe('complete');
  expect(idleSpawn.calls[1].args).toContain('--finalize');
  expect(idleSpawn.calls[1].args).toContain('--idle-fallback');
  expect(idleProgress).toContain(`── [1/1] ${REPORT_2023} ──`);
  expect(idleProgress).toContain('── [finalize] validation · DOX · workspace · cross-wiki · updater ──');
});

test('gate 27.17 (stall relay): a worker stall event reaches onStall with the label; the text line still relays', { timeout: 60_000 }, async () => {
  const workspace = await setupWikiWithPdfs([REPORT_2023]);
  const stallInfo = { waitSeconds: 600, attempt: 2, maxAttempts: 6, statusCode: 0, label: 'curation-entities-bucket-2#attempt3' };
  const { spawnWorker } = makeScriptedSpawn([
    () => ({
      lines: [
        { type: 'stall', info: stallInfo },
        { type: 'progress', line: 'Connection problem (network/timeout) — curation-entities-bucket-2#attempt3: waiting 600s before retry (attempt 2/6)...' },
        workerResultFor(REPORT_2023),
      ],
      code: 0,
    }),
    () => ({ lines: [workerResultFor(null)], code: 0 }),
  ]);
  const stalls: Array<{ waitSeconds: number; label?: string }> = [];
  const progress: string[] = [];
  await runIngestConductor('test-wiki', {
    workspace,
    ingest: {},
    onProgress: (line) => progress.push(line),
    onStall: (info) => stalls.push({ waitSeconds: info.waitSeconds, label: info.label }),
    spawnWorker,
  });
  expect(stalls).toEqual([{ waitSeconds: 600, label: 'curation-entities-bucket-2#attempt3' }]);
  expect(progress).toContain(
    'Connection problem (network/timeout) — curation-entities-bucket-2#attempt3: waiting 600s before retry (attempt 2/6)...',
  );
});

test('gate 27.19 (docs): the v1.0.1 canon artifacts are law', () => {
  const vision = readFileSync(join(import.meta.dirname, '..', 'Project Vision', '04_orchestration_detailed.md'), 'utf-8');
  expect(vision).toContain('2026-09-03'); // the observability rider
  const phaseDoc = readFileSync(join(import.meta.dirname, '..', 'Implementation Plan', 'PHASE_27_per_pdf_worker_isolation.md'), 'utf-8');
  expect(phaseDoc).toContain('v1.0.1 Fix Iteration (2026-09-03)');
  for (const gate of ['27.12', '27.13', '27.14', '27.15', '27.16', '27.17', '27.18', '27.19']) {
    expect(phaseDoc).toContain(gate);
  }
});
