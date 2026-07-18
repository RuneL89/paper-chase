import React from 'react';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { render, type Instance } from 'ink';
import { InitScreen } from '../../src/tui/init-screen';
import { IngestScreen } from '../../src/tui/ingest-screen';
import { init } from '../../src/commands/init';

const GOLDEN_MASTER = 'test-pdfs/golden-master.pdf';

const cleanup: Array<() => void> = [];

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

type FakeStdin = PassThrough & {
  isTTY: boolean;
  setRawMode: (mode: boolean) => void;
  ref: () => FakeStdin;
  unref: () => FakeStdin;
};
type FakeStdout = PassThrough & { isTTY: boolean; columns: number; rows: number };

/** Fake TTY stdin (same harness as tests/tui/menu.test.tsx). */
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
  stdout.isTTY = false;
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
  waitUntilRenderFlush: Instance['waitUntilRenderFlush'];
}

/**
 * Capture Ink output on a fake stdout and assert after unmount (Ink 7
 * non-interactive mode only writes the final frame on unmount). Pass
 * `tty: false` to exercise the non-TTY static fallbacks.
 */
function renderCaptured(node: React.ReactElement, options: { tty?: boolean } = {}): CapturedRender {
  const stdin = createFakeStdin();
  if (options.tty === false) {
    stdin.isTTY = false;
  }
  const stdout = createFakeStdout();
  let output = '';
  stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  const instance = render(node, {
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
    waitUntilRenderFlush: instance.waitUntilRenderFlush,
  };
}

const tick = (ms = 150) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

/** Poll a condition (async screen work happens between Ink frames). */
async function waitFor(condition: () => boolean, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor timed out');
    }
    await tick(50);
  }
}

// §5.4 tests use a temp workspace instead of ./wikis so the repo stays clean
// (deviation recorded in .state/phase-1-status.json; the §5.4 assertions are
// preserved verbatim apart from the workspace location).
let workspace: string;

beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), 'llm-wiki-phase1-tui-'));
});

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

// §5.4: init screen renders form fields
test('init screen renders form fields', async () => {
  const screen = renderCaptured(<InitScreen onBack={() => {}} onResult={() => {}} />);
  await tick();
  screen.unmount();
  await tick(50);
  expect(screen.output()).toContain('Title');
  expect(screen.output()).toContain('Workspace');
  expect(screen.output()).toContain('Create Wiki');
});

// §5.4: ingest screen lists existing wikis
test('ingest screen lists existing wikis', async () => {
  mkdirSync(join(workspace, 'wikis', 'fake-wiki', 'raw'), { recursive: true });
  const screen = renderCaptured(<IngestScreen onBack={() => {}} onResult={() => {}} workspace={workspace} />);
  await tick(400); // let useWikiList / useWikiDetails load
  screen.unmount();
  await tick(50);
  expect(screen.output()).toContain('fake-wiki');
  expect(screen.output()).toContain('PDFs in raw/');
  expect(screen.output()).toContain('Last ingest');
});

// Non-TTY contract (src/AGENTS.md): static fallback, no crash, labels visible.
test('init screen renders a static form without a TTY', async () => {
  const screen = renderCaptured(<InitScreen onBack={() => {}} onResult={() => {}} />, { tty: false });
  await tick();
  screen.unmount();
  await tick(50);
  expect(screen.output()).toContain('Title');
  expect(screen.output()).toContain('Workspace');
});

// §5.1 behavior: Tab between fields, Enter on "Create Wiki" runs init().
test('init screen creates a wiki from a title-derived slug', async () => {
  let result: string | undefined;
  const screen = renderCaptured(
    <InitScreen onBack={() => {}} onResult={(message) => (result = message)} defaultWorkspace={workspace} />,
  );
  await tick();
  screen.stdin.write('TUI Wiki'); // Title field (focused first)
  await tick(100);
  screen.stdin.write('\t'); // -> Workspace (pre-filled with the temp workspace)
  await tick(100);
  screen.stdin.write('\t'); // -> [ Create Wiki ]
  await tick(100);
  screen.stdin.write('\r'); // run init()
  await waitFor(() => result !== undefined);
  screen.unmount();
  await tick(50);

  expect(result).toContain("Wiki 'tui-wiki' created");
  expect(screen.output()).toContain("Wiki 'tui-wiki' created");
  expect(existsSync(join(workspace, 'wikis', 'tui-wiki', 'AGENTS.md'))).toBe(true);
  expect(existsSync(join(workspace, 'wikis', 'tui-wiki', 'raw'))).toBe(true);
});

// §5.2 behavior: Enter on a wiki runs ingest() with progress lines.
test('ingest screen runs ingestion with progress display', async () => {
  // Isolated workspace so the wiki list contains exactly one entry.
  const solo = mkdtempSync(join(tmpdir(), 'llm-wiki-phase1-tui-solo-'));
  try {
    await init('ingest-me', { workspace: solo });
    copyFileSync(GOLDEN_MASTER, join(solo, 'wikis', 'ingest-me', 'raw', 'golden-master.pdf'));

    let result: string | undefined;
    const screen = renderCaptured(
      // extract={false} (Phase 2 deviation, .state/phase-2-status.json): this
      // Phase 1 flow test exercises Layer 1 only and must never call the LLM.
      <IngestScreen onBack={() => {}} onResult={(message) => (result = message)} workspace={solo} extract={false} />,
    );
    await tick(400); // let the wiki list load
    screen.stdin.write('\r'); // run ingest on the highlighted wiki
    await waitFor(() => result !== undefined, 30000);
    screen.unmount();
    await tick(50);

    const frame = screen.output();
    expect(frame).toContain('Extracting text');
    expect(frame).toContain('Chunk 1/1');
    expect(frame).toContain('Done!');
    expect(result).toContain('Ingest complete: 1 ingested, 0 skipped');
    expect(existsSync(join(solo, 'wikis', 'ingest-me', 'documents', 'golden-master-part-001.md'))).toBe(true);
  } finally {
    rmSync(solo, { recursive: true, force: true });
  }
}, 60000);

// Escape = back (Ink 7 contract, src/AGENTS.md).
test('escape on the init screen goes back', async () => {
  let backCalled = false;
  const screen = renderCaptured(<InitScreen onBack={() => (backCalled = true)} onResult={() => {}} />);
  await tick();
  screen.stdin.write(String.fromCharCode(27)); // Escape
  await waitFor(() => backCalled);
  screen.unmount();
  expect(backCalled).toBe(true);
});
