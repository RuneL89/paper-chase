import { spawn, type ChildProcess } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { IngestResult } from '../commands/ingest';
import type { StallWaitInfo } from '../llm/client';
import { wikiDir } from '../utils/paths';
import { createWorkerEventReader, type WorkerEvent } from '../commands/worker-protocol';
import { appendCrashLogRecord, tailLines, CRASH_LOG_STDERR_TAIL_LINES } from '../state/crash-log';
import { resolveWorkerCommand } from './worker-spawn';

/**
 * Phase 27 (vision `04` §1 Worker-process isolation amendment, user-ratified
 * 2026-09-02): the TUI/CLI conductor. The TUI process becomes a thin
 * conductor that spawns ONE headless `ingest-worker` child per PDF, relays
 * the worker's progress events onto the SAME progress channel the screen
 * always used (byte-identical lines — the engine inside the worker emits
 * them), merges each worker's IngestResult into the run total, and finally
 * spawns the `--finalize` worker for the deferred tail (DOX / workspace /
 * cross-wiki / updater).
 *
 * Crash containment (the amendment's purpose): a worker that dies for ANY
 * reason — escaped error, OOM abort, native crash — never ends the run.
 * The conductor owns the worker's stdout/stderr pipes, so the death is
 * always visible: the crash is appended to `.state/crash-log.jsonl`, and
 * after the ratified auto-retry cap (3 retries, 30 s backoff) the
 * crash-recovery panel is surfaced for the USER's decision (retry / skip /
 * abort). Never auto-defer.
 *
 * Sequencing law is unchanged: workers run strictly one at a time; the
 * finalize worker runs only after the last PDF worker exits; the engine's
 * own per-PDF checkpointing makes every retry resume instead of restart.
 */

/** The user-ratified auto-retry cap (2026-09-02): 3 retries, 30 s backoff. */
export const AUTO_RETRY_RETRIES = 3;
export const AUTO_RETRY_BACKOFF_MS = 30_000;

export type CrashPhase = 'pdf' | 'finalize';

/** State for the crash-recovery panel (the phase's only new UI). */
export interface CrashPanelState {
  /** PDF file name; null for the finalize worker. */
  pdf: string | null;
  phase: CrashPhase;
  exitCode: number | null;
  stderrTail: string;
  /** The attempt number that died (1-based; 2..4 are auto-retries). */
  attempt: number;
}

export type CrashDecision = 'retry' | 'skip' | 'abort';

/** The ingest options the conductor forwards verbatim to every worker. */
export interface ConductorIngestOptions {
  extract?: boolean;
  synthesis?: boolean;
  updateAgents?: boolean;
  doxLlm?: boolean;
  crossWiki?: boolean;
  forceCrossWiki?: boolean;
  inputLanguage?: string;
  outputLanguage?: string;
  pagesPerChunk?: number;
}

export interface ConductorRun {
  result: IngestResult;
  /** `aborted` when the user chose Abort (or Ctrl+C) — landed work stays. */
  status: 'complete' | 'aborted';
}

/** Injectable spawn (tests); default spawns the resolved worker command. */
export type SpawnWorkerFn = (
  args: string[],
  handlers: { onStdoutChunk: (chunk: string) => void; onStderrChunk: (chunk: string) => void },
) => { onClose: Promise<{ code: number | null }>; kill(): void };

const defaultSpawnWorker: SpawnWorkerFn = (args, handlers) => {
  const resolved = resolveWorkerCommand();
  const child: ChildProcess = spawn(resolved.command, [...resolved.baseArgs, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    // No shell — spaced-path-safe on Windows (the bin/chase.js precedent).
    shell: false,
    env: process.env,
  });
  child.stdout?.setEncoding('utf-8');
  child.stderr?.setEncoding('utf-8');
  child.stdout?.on('data', (chunk: string) => handlers.onStdoutChunk(chunk));
  child.stderr?.on('data', (chunk: string) => handlers.onStderrChunk(chunk));
  const onClose = new Promise<{ code: number | null }>((resolvePromise) => {
    child.on('error', (err: Error) => {
      // Spawn failure (missing executable) — treated as a crash with code null.
      handlers.onStderrChunk(`worker spawn failed: ${err.message}\n`);
      resolvePromise({ code: null });
    });
    child.on('close', (code) => resolvePromise({ code: code ?? null }));
  });
  return { onClose, kill: () => child.kill() };
};

/** Merge a worker's result into the run total (lists concat, counters sum). */
export function mergeIngestResults(base: IngestResult, worker: IngestResult): IngestResult {
  const merged: IngestResult = {
    ...base,
    ingested: [...base.ingested, ...(worker.ingested ?? [])],
    skipped: [...base.skipped, ...(worker.skipped ?? [])],
    deferred: [...(base.deferred ?? []), ...(worker.deferred ?? [])],
    extractions: [...base.extractions, ...(worker.extractions ?? [])],
  };
  const numericKeys: Array<keyof IngestResult> = [
    'synthesized',
    'synthesizedPermissive',
    'synthesizedTopics',
    'synthesizedTopicsPermissive',
    'synthesisConflicts',
    'topicConflicts',
    'synthesizedComposites',
    'synthesizedCompositesPermissive',
    'compositeConflicts',
    'synthesizedComparisons',
    'synthesizedComparisonsPermissive',
    'comparisonConflicts',
    'patchedPages',
    'patchFallbacks',
    'synthesisSkipped',
    'synthesisTopicsSkipped',
    'synthesisCompositesSkipped',
    'synthesisComparisonsSkipped',
  ];
  for (const key of numericKeys) {
    const baseValue = base[key];
    const workerValue = worker[key];
    if (typeof baseValue === 'number' || typeof workerValue === 'number') {
      (merged as unknown as Record<string, unknown>)[key] =
        (typeof baseValue === 'number' ? baseValue : 0) + (typeof workerValue === 'number' ? workerValue : 0);
    }
  }
  // Object fields: the worker that produced them wins (later stages own
  // them — finalValidation/crossWiki from finalize, languages from any).
  for (const key of ['validation', 'finalValidation', 'crossWiki', 'languages'] as const) {
    if (worker[key] !== undefined) {
      (merged as unknown as Record<string, unknown>)[key] = worker[key];
    }
  }
  if (worker.agentsUpdateProposed) {
    merged.agentsUpdateProposed = true;
  }
  if (worker.synthesisRan) {
    merged.synthesisRan = true;
  }
  return merged;
}

/** Discover the run's PDFs exactly as the engine does (sorted .pdf files). */
export async function discoverWorkspacePdfs(workspace: string, slug: string): Promise<string[]> {
  const rawDir = join(wikiDir(workspace, slug), 'raw');
  if (!existsSync(rawDir)) {
    throw new Error(`Wiki '${slug}' not found at ${wikiDir(workspace, slug)}. Run 'init ${slug}' first.`);
  }
  return (await readdir(rawDir))
    .filter((file) => file.toLowerCase().endsWith('.pdf'))
    .sort();
}

export interface ConductorOptions {
  workspace: string;
  ingest: ConductorIngestOptions;
  onProgress: (line: string) => void;
  /** Fired with the panel state when user input is needed; null when cleared. */
  onCrashPanel?: (state: CrashPanelState | null) => void;
  /** The user-decision channel (the panel's R/S/A keys); default: abort. */
  requestDecision?: (state: CrashPanelState) => Promise<CrashDecision>;
  /**
   * Phase 27 v1.0.1: fired at every worker spawn (attempts included) with
   * the run-position info the screen renders as the persistent status row.
   */
  onWorkerChange?: (info: WorkerPosition) => void;
  /**
   * Phase 27 v1.0.1: structured stall relay — a worker's transport-stall
   * wait start, for the screen's live countdown row (the plain text stall
   * line still flows through onProgress).
   */
  onStall?: (info: StallWaitInfo) => void;
  spawnWorker?: SpawnWorkerFn;
  autoRetry?: { retries: number; backoffMs: number };
  sleep?: (ms: number) => Promise<void>;
  /**
   * Phase 27 (§2.4): cooperative abort — wired to SIGINT by the TUI. When
   * aborted, the CURRENT worker is killed (resume machinery covers the
   * rest), no further workers spawn, and the run resolves `aborted` with
   * everything landed so far.
   */
  signal?: AbortSignal;
}

/** The run-position snapshot the screen's status row renders (v1.0.1). */
export interface WorkerPosition {
  /** 1-based position within the run (finalize = total + 1). */
  index: number;
  /** Number of PDFs in the run (the finalize worker is extra). */
  total: number;
  /** PDF file name; null for the finalize worker. */
  pdf: string | null;
  phase: CrashPhase;
}

interface WorkerOutcome {
  ok: boolean;
  result?: IngestResult;
  exitCode: number | null;
  stderrTail: string;
}

/** Run ONE worker (pdf or finalize) and resolve its outcome. */
async function runWorker(
  spawnWorker: SpawnWorkerFn,
  args: string[],
  onProgress: (line: string) => void,
  signal?: AbortSignal,
  onStall?: (info: StallWaitInfo) => void,
): Promise<WorkerOutcome> {
  let stderr = '';
  let workerResult: IngestResult | undefined;
  const reader = createWorkerEventReader((event: WorkerEvent) => {
    if (event.type === 'progress') {
      onProgress(event.line);
    } else if (event.type === 'stall') {
      // Phase 27 v1.0.1: structured stall relay for the screen's live
      // countdown row (the text stall line already arrived via progress).
      onStall?.(event.info);
    } else if (event.type === 'result') {
      workerResult = event.result as IngestResult;
    }
    // fatal events: the error text also lands on stderr via the worker's
    // console.error; the close code is the crash signal.
  });
  const child = spawnWorker(args, {
    onStdoutChunk: (chunk) => reader.push(chunk),
    onStderrChunk: (chunk) => {
      stderr = (stderr + chunk).slice(-64 * 1024);
    },
  });
  // §2.4 interrupt forwarding: an abort kills the current worker; the
  // engine's checkpoint/resume law covers the rest on the next run.
  const onAbort = () => child.kill();
  signal?.addEventListener('abort', onAbort, { once: true });
  let code: number | null;
  try {
    ({ code } = await child.onClose);
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
  reader.flush();
  return {
    ok: code === 0 && workerResult !== undefined,
    result: workerResult,
    exitCode: code,
    stderrTail: tailLines(stderr, CRASH_LOG_STDERR_TAIL_LINES),
  };
}

function buildWorkerArgs(
  slug: string,
  workspace: string,
  ingest: ConductorIngestOptions,
  scope: { pdf: string } | { finalize: true },
  /** v1.0.1: finalize-only — run the all-skipped repair pass first (the
   * conductor sets this iff no PDF was ingested this run). */
  idleFallback?: boolean,
): string[] {
  const args = ['ingest-worker', slug, '--workspace', workspace];
  if ('pdf' in scope) {
    args.push('--pdf', scope.pdf);
  } else {
    args.push('--finalize');
    if (idleFallback === true) {
      args.push('--idle-fallback');
    }
  }
  if (ingest.extract === false) {
    args.push('--no-extract');
  }
  if (ingest.synthesis === true) {
    args.push('--synthesis');
  }
  if (ingest.updateAgents === true) {
    args.push('--update-agents');
  }
  if (ingest.doxLlm === false) {
    args.push('--no-dox-llm');
  }
  if (ingest.crossWiki === false) {
    args.push('--no-cross-wiki');
  }
  if (ingest.forceCrossWiki === true) {
    args.push('--force-cross-wiki');
  }
  if (ingest.inputLanguage !== undefined) {
    args.push('--input-language', ingest.inputLanguage);
  }
  if (ingest.outputLanguage !== undefined) {
    args.push('--output-language', ingest.outputLanguage);
  }
  return args;
}

export async function runIngestConductor(slug: string, options: ConductorOptions): Promise<ConductorRun> {
  const spawnWorker = options.spawnWorker ?? defaultSpawnWorker;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolvePromise) => setTimeout(resolvePromise, ms)));
  const retries = options.autoRetry?.retries ?? AUTO_RETRY_RETRIES;
  const backoffMs = options.autoRetry?.backoffMs ?? AUTO_RETRY_BACKOFF_MS;
  const dir = wikiDir(options.workspace, slug);

  const pdfFiles = await discoverWorkspacePdfs(options.workspace, slug);

  const result: IngestResult = {
    wiki: slug,
    wikiDir: dir,
    ingested: [],
    skipped: [],
    deferred: [],
    extractions: [],
    synthesized: 0,
    synthesizedPermissive: 0,
    synthesizedTopics: 0,
    synthesizedTopicsPermissive: 0,
    synthesisConflicts: 0,
    topicConflicts: 0,
    patchedPages: 0,
    patchFallbacks: 0,
  };

  const runScopedWorker = async (
    phase: CrashPhase,
    pdf: string | null,
    position: { index: number; total: number },
    /** v1.0.1: finalize-only idle-fallback flag (repair pass first). */
    idleFallback?: boolean,
  ): Promise<{ outcome: 'complete' | 'aborted' | 'skipped'; merged: IngestResult }> => {
    let merged = result;
    let attempt = 0;
    for (;;) {
      if (options.signal?.aborted) {
        return { outcome: 'aborted', merged };
      }
      attempt += 1;
      // Phase 27 v1.0.1 observability: banner (on every attempt — a retry is
      // a new worker the user should see start) + the position snapshot the
      // screen's status row renders.
      const banner =
        phase === 'pdf'
          ? `── [${position.index}/${position.total}] ${pdf as string} ──`
          : '── [finalize] validation · DOX · workspace · cross-wiki · updater ──';
      options.onProgress(banner);
      options.onWorkerChange?.({ index: position.index, total: position.total, pdf, phase });
      const scope: { pdf: string } | { finalize: true } =
        phase === 'pdf' ? { pdf: pdf as string } : { finalize: true };
      const outcome = await runWorker(
        spawnWorker,
        buildWorkerArgs(slug, options.workspace, options.ingest, scope, idleFallback),
        options.onProgress,
        options.signal,
        options.onStall,
      );
      if (outcome.ok && outcome.result !== undefined) {
        merged = mergeIngestResults(merged, outcome.result);
        return { outcome: 'complete', merged };
      }
      // Crash path: audit first (every death AND every auto-retry attempt).
      const autoRetried = attempt <= retries;
      await appendCrashLogRecord(dir, {
        timestamp: new Date().toISOString(),
        pdf,
        phase,
        exitCode: outcome.exitCode,
        stderrTail: outcome.stderrTail,
        attempt,
        autoRetried,
      }).catch(() => {
        // The audit log must never block recovery; state files carry the rest.
      });
      const label = phase === 'pdf' ? (pdf as string) : 'finalize pass';
      if (options.signal?.aborted) {
        return { outcome: 'aborted', merged };
      }
      if (autoRetried) {
        options.onProgress(
          `Worker for ${label} exited unexpectedly (code ${outcome.exitCode ?? 'none'}) — auto-retry in ${Math.round(backoffMs / 1000)}s (attempt ${attempt}/${retries + 1})...`,
        );
        await sleep(backoffMs);
        continue;
      }
      // Cap exhausted: surface the panel, await the USER's decision.
      // Never auto-defer (2026-09-02 ratified law).
      const panelState: CrashPanelState = {
        pdf,
        phase,
        exitCode: outcome.exitCode,
        stderrTail: outcome.stderrTail,
        attempt,
      };
      options.onCrashPanel?.(panelState);
      const decision =
        options.requestDecision !== undefined ? await options.requestDecision(panelState) : 'abort';
      options.onCrashPanel?.(null);
      if (decision === 'retry') {
        // A manual retry resets the auto-retry counter — the user chose it.
        attempt = 0;
        continue;
      }
      if (decision === 'skip' && phase === 'pdf') {
        merged.deferred = [...(merged.deferred ?? []), pdf as string];
        options.onProgress(`Deferred ${pdf} — it will be re-attempted on the next ingest run.`);
        return { outcome: 'skipped', merged };
      }
      return { outcome: 'aborted', merged };
    }
  };

  let workerIndex = 0;
  for (const pdf of pdfFiles) {
    workerIndex += 1;
    const { outcome, merged } = await runScopedWorker('pdf', pdf, { index: workerIndex, total: pdfFiles.length });
    Object.assign(result, merged);
    if (outcome === 'aborted') {
      return { result, status: 'aborted' };
    }
  }

  // Phase 27 v1.0.1: the finalize worker runs the all-skipped repair pass
  // ONLY when nothing was ingested this run — restoring the 2026-07-21
  // repair law's batch semantics (exactly one repair pass per all-skip run)
  // instead of one fallback per hash-skipped PDF worker.
  const idleFallback = result.ingested.length === 0;
  const finalize = await runScopedWorker(
    'finalize',
    null,
    { index: pdfFiles.length + 1, total: pdfFiles.length },
    idleFallback,
  );
  Object.assign(result, finalize.merged);
  if (finalize.outcome === 'aborted') {
    return { result, status: 'aborted' };
  }
  return { result, status: 'complete' };
}
