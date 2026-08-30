import React from 'react';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, afterEach, expect, test } from 'vitest';
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
