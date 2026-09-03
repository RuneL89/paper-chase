import React from 'react';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, afterEach, expect, test, vi } from 'vitest';
import { render, type Instance } from 'ink';
import { init } from '../../src/commands/init';
import type { IngestResult } from '../../src/commands/ingest';
import { IngestScreen } from '../../src/tui/ingest-screen';

/**
 * Phase 16 v1.0.2 (user directive 2026-08-20): the ingest screen renders the
 * client's 429 stall as a live progress line — during a multi-minute throttle
 * wait the user sees "Rate limited by provider (HTTP 429) — waiting Ns ..."
 * instead of a frozen screen (the line rides the run's existing onProgress
 * channel, so the screen needs no new plumbing). Hermetic temp workspace; the
 * ingest itself is an injected stub — no LLM calls.
 */

const cleanup: Array<() => void> = [];
const tempDirs: string[] = [];

afterEach(() => {
  while (cleanup.length > 0) {
    const fn = cleanup.pop();
    try {
      fn?.();
    } catch {
      // already unmounted
    }
  }
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

type FakeStdin = PassThrough & {
  isTTY: boolean;
  setRawMode: (mode: boolean) => void;
  ref: () => FakeStdin;
  unref: () => FakeStdin;
};
type FakeStdout = PassThrough & { isTTY: boolean; columns: number; rows: number };

function createFakeStdin(): FakeStdin {
  const stdin = new PassThrough() as FakeStdin;
  stdin.isTTY = true;
  stdin.setRawMode = () => {};
  stdin.ref = () => stdin;
  stdin.unref = () => stdin;
  return stdin;
}

function createFakeStdout(): FakeStdout {
  const stdout = new PassThrough() as FakeStdout;
  stdout.isTTY = true;
  stdout.columns = 80;
  stdout.rows = 24;
  return stdout;
}

const ESC = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ESC}(?:\\[[0-?]*[ -/]*[@-~]|[@-Z\\\\-_])`, 'g');

function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

interface CapturedRender {
  stdin: FakeStdin;
  output: () => string;
  unmount: () => void;
}

function renderCaptured(node: React.ReactElement): CapturedRender {
  const stdin = createFakeStdin();
  const stdout = createFakeStdout();
  let output = '';
  stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  const instance: Instance = render(node, {
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
  });
  let unmounted = false;
  const unmount = () => {
    if (!unmounted) {
      unmounted = true;
      instance.unmount();
    }
  };
  cleanup.push(unmount);
  return {
    stdin,
    output: () => stripAnsi(output),
    unmount,
  };
}

const tick = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitFor(condition: () => boolean, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor timed out');
    }
    await tick(50);
  }
}

const STALL_LINE = 'Rate limited by provider (HTTP 429) — waiting 60s before retry (attempt 2/6)...';

test('the ingest screen renders a 429 stall line from the run progress channel', async () => {
  const workspace = makeTempDir('paper-chase-ingest-stall-');
  await init('test-wiki', { workspace });

  const screen = renderCaptured(
    <IngestScreen
      workspace={workspace}
      initialWiki={{ workspace, slug: 'test-wiki' }}
      onBack={() => {}}
      ingestFn={async (_wiki, options) => {
        // The real client reports the stall through ingest's onProgress; the
        // stub emits the exact line the wiring produces.
        const onProgress = options.onProgress as ((line: string) => void) | undefined;
        onProgress?.(STALL_LINE);
        return { ingested: [], skipped: [], synthesisRan: false } as unknown as IngestResult;
      }}
    />,
  );
  await waitFor(() => screen.output().includes('test-wiki'));
  screen.stdin.write('\r');
  await waitFor(() => screen.output().includes('Ingest complete'));
  screen.unmount();
  await tick(50);

  expect(stripAnsi(screen.output())).toContain(STALL_LINE);
});

// Phase 16 v1.0.6 (user-ratified 2026-08-30): a NETWORK/timeout stall
// (statusCode 0) surfaces with its own label — the same live-line contract
// as the 429/5xx stalls, so a multi-hour ride-out is visible, never a frozen
// screen.
const NETWORK_STALL_LINE = 'Connection problem (network/timeout) — waiting 600s before retry (attempt 2/6)...';

test('the ingest screen renders a network/timeout stall line from the run progress channel', async () => {
  const workspace = makeTempDir('paper-chase-ingest-netstall-');
  await init('test-wiki', { workspace });

  const screen = renderCaptured(
    <IngestScreen
      workspace={workspace}
      initialWiki={{ workspace, slug: 'test-wiki' }}
      onBack={() => {}}
      ingestFn={async (_wiki, options) => {
        const onProgress = options.onProgress as ((line: string) => void) | undefined;
        onProgress?.(NETWORK_STALL_LINE);
        return { ingested: [], skipped: [], synthesisRan: false } as unknown as IngestResult;
      }}
    />,
  );
  await waitFor(() => screen.output().includes('test-wiki'));
  screen.stdin.write('\r');
  await waitFor(() => screen.output().includes('Ingest complete'));
  screen.unmount();
  await tick(50);

  // The line is 82 chars — two over the 80-column frame — so normalize
  // whitespace before asserting (the phase-11 footer-wrap precedent).
  expect(stripAnsi(screen.output()).replace(/\s+/g, ' ')).toContain(NETWORK_STALL_LINE);
});

// ---------------------------------------------------------------------------
// Phase 27 (vision 04 §1 Worker-process isolation, user-ratified 2026-09-02):
// the conductor path replaces the in-process call as the PRODUCTION run
// shape. Pixel-identity: a healthy conductor-driven run renders the SAME
// progress lines and banner as the in-process seam (the crash panel is the
// only new UI and appears ONLY when a worker died and the retry cap hit).
// ---------------------------------------------------------------------------

const CONDUCTOR_PROGRESS = 'Ingested report-a.pdf -> 2 document page(s)';

test('Phase 27: a healthy conductor-driven run renders the same lines and banner as the in-process path', async () => {
  const workspace = makeTempDir('paper-chase-ingest-cond-');
  await init('test-wiki', { workspace });

  const conductorFn = vi.fn(async (_slug: string, options: { onProgress: (line: string) => void }) => {
    options.onProgress(CONDUCTOR_PROGRESS);
    return {
      status: 'complete',
      result: {
        wiki: 'test-wiki',
        wikiDir: join(workspace, 'wikis', 'test-wiki'),
        ingested: [],
        skipped: [],
        extractions: [],
      } as unknown as IngestResult,
    };
  });

  const screen = renderCaptured(
    <IngestScreen
      workspace={workspace}
      initialWiki={{ workspace, slug: 'test-wiki' }}
      onBack={() => {}}
      conductorFn={conductorFn as never}
    />,
  );
  await waitFor(() => screen.output().includes('test-wiki'));
  screen.stdin.write('\r');
  await waitFor(() => screen.output().includes('Ingest complete'));
  screen.unmount();
  await tick(50);

  expect(conductorFn).toHaveBeenCalledTimes(1);
  expect(screen.output()).toContain(CONDUCTOR_PROGRESS);
  expect(screen.output()).toContain('Ingest complete: 0 ingested, 0 skipped.');
  // No crash panel in a healthy run — the phase's only new UI stays hidden.
  expect(screen.output()).not.toContain('[R] Retry');
});

test('Phase 27: the crash panel renders on cap exhaustion and the R/S/A keys decide', async () => {
  const workspace = makeTempDir('paper-chase-ingest-crash-');
  await init('test-wiki', { workspace });

  let decide: ((decision: 'retry' | 'skip' | 'abort') => void) | null = null;
  const panelSeen: string[] = [];
  const conductorFn = async (
    _slug: string,
    options: {
      onProgress: (line: string) => void;
      onCrashPanel?: (state: unknown) => void;
      requestDecision?: () => Promise<'retry' | 'skip' | 'abort'>;
    },
  ) => {
    options.onProgress('Worker for report-a.pdf exited unexpectedly (code 1) — auto-retry in 30s (attempt 3/4)...');
    options.onCrashPanel?.({
      pdf: 'report-a.pdf',
      phase: 'pdf',
      exitCode: 1,
      stderrTail: 'Error: something escaped',
      attempt: 4,
    });
    panelSeen.push('shown');
    const decision = await options.requestDecision!();
    panelSeen.push(decision);
    options.onCrashPanel?.(null);
    return {
      status: 'aborted',
      result: { wiki: 'test-wiki', wikiDir: join(workspace, 'wikis', 'test-wiki'), ingested: [], skipped: [], extractions: [] } as unknown as IngestResult,
    };
  };

  const screen = renderCaptured(
    <IngestScreen
      workspace={workspace}
      initialWiki={{ workspace, slug: 'test-wiki' }}
      onBack={() => {}}
      conductorFn={conductorFn as never}
    />,
  );
  await waitFor(() => screen.output().includes('test-wiki'));
  screen.stdin.write('\r');

  // The panel: title with exit code/attempt, stderr tail, key legend.
  await waitFor(() => screen.output().includes('[R] Retry'));
  expect(screen.output()).toContain('Worker for report-a.pdf exited unexpectedly');
  expect(screen.output()).toContain('Error: something escaped');
  expect(screen.output()).toContain('[S] Skip PDF');

  // R resolves the pending decision; the run then aborts per the stub.
  screen.stdin.write('r');
  await waitFor(() => screen.output().includes('Ingest aborted'));
  screen.unmount();
  await tick(50);
  expect(panelSeen).toEqual(['shown', 'retry']);
});

// ---------------------------------------------------------------------------
// Phase 27 v1.0.1 (user-ratified 2026-09-03): conductor observability — the
// persistent worker-position row and the live stall countdown row render
// during a run and vanish when it ends. The conductor stub holds the run
// open so the rows can be asserted mid-flight.
// ---------------------------------------------------------------------------

test('Phase 27 v1.0.1: the worker-position row and live stall countdown render during a conductor run', async () => {
  const workspace = makeTempDir('paper-chase-ingest-rows-');
  await init('test-wiki', { workspace });

  const release = { first: () => {}, second: () => {} };
  const conductorFn = async (
    _slug: string,
    options: {
      onProgress: (line: string) => void;
      onWorkerChange?: (info: { index: number; total: number; pdf: string | null; phase: string }) => void;
      onStall?: (info: { waitSeconds: number; attempt: number; maxAttempts: number; statusCode: number; label?: string }) => void;
    },
  ) => {
    options.onWorkerChange?.({ index: 2, total: 37, pdf: 'AKDB_2025.pdf', phase: 'pdf' });
    options.onProgress('── [2/37] AKDB_2025.pdf ──');
    // A live stall with a countdown (10-minute wait); held open so the row
    // can be asserted mid-flight.
    options.onStall?.({ waitSeconds: 600, attempt: 2, maxAttempts: 6, statusCode: 0, label: 'curation-entities-bucket-2' });
    await new Promise<void>((resolvePromise) => {
      release.first = resolvePromise;
    });
    // A clamped stall (deadline already reached — the retry is in flight);
    // held open again so the clamp state is observable before the run ends.
    options.onStall?.({ waitSeconds: 0, attempt: 3, maxAttempts: 6, statusCode: 0, label: 'curation-entities-bucket-2' });
    await new Promise<void>((resolvePromise) => {
      release.second = resolvePromise;
    });
    return {
      status: 'complete',
      result: { wiki: 'test-wiki', wikiDir: join(workspace, 'wikis', 'test-wiki'), ingested: [], skipped: [], extractions: [] } as unknown as IngestResult,
    };
  };

  const screen = renderCaptured(
    <IngestScreen
      workspace={workspace}
      initialWiki={{ workspace, slug: 'test-wiki' }}
      onBack={() => {}}
      conductorFn={conductorFn as never}
    />,
  );
  await waitFor(() => screen.output().includes('test-wiki'));
  screen.stdin.write('\r');

  // Mid-run: the position row (worker 2 of 38 — 37 PDFs + finalize) and the
  // live countdown with the failing call's label.
  await waitFor(() => screen.output().includes('AKDB_2025.pdf'));
  const midRun = screen.output().replace(/\s+/g, ' ');
  expect(midRun).toContain('Worker 2/38 · AKDB_2025.pdf');
  expect(midRun).toContain('elapsed');
  expect(midRun).toContain('Connection problem (network/timeout) — curation-entities-bucket-2');
  expect(midRun).toMatch(/retry in (9|10)m/);
  expect(midRun).toContain('attempt 2/6');

  // Release the held run; the zero-second stall clamps to "in flight" (the
  // run stays held so the clamp state is observable), then finish. The stall
  // row exceeds 80 columns and wraps, so assert on whitespace-normalized
  // output (the phase-11 footer-wrap precedent).
  release.first();
  await waitFor(() => screen.output().replace(/\s+/g, ' ').includes('retry in flight'));
  release.second();
  await waitFor(() => screen.output().includes('Ingest complete'));
  screen.unmount();
  await tick(50);

  // Post-run: both rows are gone (they are run-scoped, not history).
  const after = screen.output().slice(screen.output().lastIndexOf('Ingest complete'));
  expect(after.replace(/\s+/g, ' ')).not.toContain('Worker 2/38');
  expect(after.replace(/\s+/g, ' ')).not.toContain('retry in flight');
});
