import React from 'react';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
  expect(screen.output()).toContain('Browse'); // 2026-08-24 folder-picker button
  expect(screen.output()).toContain('Wiki folder will be created at:'); // always-on breadcrumb
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
  expect(screen.output()).toContain('Browse');
  expect(screen.output()).toContain('Wiki folder will be created at:');
});

// §5.1 behavior: Tab between fields, Enter on "Create Wiki" runs init().
// 2026-08-24: [ Browse... ] is a focus stop between Workspace and Output
// Language, so the walk is Title → Tab → Workspace → Tab → Browse → Tab →
// Language, and Enter on the language dropdown submits (unchanged rule).
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
  screen.stdin.write('\t'); // -> [ Browse... ]
  await tick(100);
  screen.stdin.write('\t'); // -> Output Language
  await tick(100);
  screen.stdin.write('\r'); // Enter on the dropdown runs init()
  await waitFor(() => result !== undefined);
  screen.unmount();
  await tick(50);

  expect(result).toContain("Wiki 'tui-wiki' created");
  expect(screen.output()).toContain("Wiki 'tui-wiki' created");
  expect(existsSync(join(workspace, 'wikis', 'tui-wiki', 'AGENTS.md'))).toBe(true);
  expect(existsSync(join(workspace, 'wikis', 'tui-wiki', 'raw'))).toBe(true);
});

// 2026-08-24 user directive: the always-on breadcrumb shows the resolved
// absolute target from the moment the screen opens (before any input), with
// the slug placeholder until Title forms a valid slug.
test('init screen shows the always-on target breadcrumb before any input', async () => {
  const screen = renderCaptured(
    <InitScreen onBack={() => {}} onResult={() => {}} defaultWorkspace={'C:\\w'} />,
  );
  await tick();
  screen.unmount();
  await tick(50);
  const frame = screen.output();
  expect(frame).toContain('Wiki folder will be created at:');
  expect(frame).toContain('C:\\w\\wikis\\<title-slug>');
});

// The breadcrumb slug fills in live as the Title is typed.
test('breadcrumb slug fills in as the Title is typed', async () => {
  const screen = renderCaptured(
    <InitScreen onBack={() => {}} onResult={() => {}} defaultWorkspace={'C:\\w'} />,
  );
  await tick();
  screen.stdin.write('Tui Wiki'); // Title field (focused first)
  await tick(150);
  screen.unmount();
  await tick(50);
  expect(screen.output()).toContain('C:\\w\\wikis\\tui-wiki');
});

// 2026-08-24 folder picker: Enter on [ Browse... ] calls the injected picker
// (never the real dialog in tests), pre-seeded with the current workspace
// value when it exists, and the picked parent folder fills the field with the
// breadcrumb following.
test('browse opens the folder picker and fills the workspace field', async () => {
  let pickedInitial: string | undefined;
  const screen = renderCaptured(
    <InitScreen
      onBack={() => {}}
      onResult={() => {}}
      defaultWorkspace={workspace}
      pickFolder={async (initial) => {
        pickedInitial = initial;
        return 'C:\\wf';
      }}
    />,
  );
  await tick();
  screen.stdin.write('\t'); // -> Workspace
  await tick(100);
  screen.stdin.write('\t'); // -> [ Browse... ]
  await tick(100);
  screen.stdin.write('\r'); // open the picker
  await waitFor(() => pickedInitial !== undefined);
  await tick(150);
  screen.unmount();
  await tick(50);
  const frame = screen.output();
  expect(pickedInitial).toBe(resolve(workspace)); // pre-seeded with the existing temp workspace
  expect(frame).toContain('C:\\wf'); // field value ...
  expect(frame).toContain('C:\\wf\\wikis'); // ... and the breadcrumb follows
});

// Cancelling the folder picker is neutral (2026-07-17 picker contract).
test('cancelling the folder picker is neutral', async () => {
  let called = false;
  const screen = renderCaptured(
    <InitScreen
      onBack={() => {}}
      onResult={() => {}}
      defaultWorkspace={'C:\\w'}
      pickFolder={async () => {
        called = true;
        return null;
      }}
    />,
  );
  await tick();
  screen.stdin.write('\t'); // -> Workspace
  await tick(100);
  screen.stdin.write('\t'); // -> [ Browse... ]
  await tick(100);
  screen.stdin.write('\r');
  await waitFor(() => called);
  await tick(150);
  screen.unmount();
  await tick(50);
  const frame = screen.output();
  expect(frame).toContain('No folder selected — workspace unchanged.');
  expect(frame).toContain('C:\\w\\wikis'); // workspace value untouched
});

// A picker failure shows the manual-fallback guidance (asserted before any
// typing — editing the field clears the stale error).
test('folder picker failure shows the manual-fallback guidance', async () => {
  let called = false;
  const screen = renderCaptured(
    <InitScreen
      onBack={() => {}}
      onResult={() => {}}
      defaultWorkspace={'C:\\w'}
      pickFolder={async () => {
        called = true;
        throw new Error('powershell.exe not found');
      }}
    />,
  );
  await tick();
  screen.stdin.write('\t'); // -> Workspace
  await tick(100);
  screen.stdin.write('\t'); // -> [ Browse... ]
  await tick(100);
  screen.stdin.write('\r');
  await waitFor(() => called);
  await tick(150);
  screen.unmount();
  await tick(50);
  const frame = screen.output();
  expect(frame).toContain('The folder picker could not be opened');
  expect(frame).toContain('powershell.exe not found');
  // The guidance wraps at 80 columns — assert the unwrapped tail substring.
  expect(frame).toContain('folder path in the Workspace field instead.');
});

// The workspace field stays fully usable after a picker failure: Tab wraps
// browse -> language -> create -> back -> title -> workspace, and typing
// lands in the field (clearing the stale error).
test('workspace field stays usable after a picker failure', async () => {
  let called = false;
  const screen = renderCaptured(
    <InitScreen
      onBack={() => {}}
      onResult={() => {}}
      defaultWorkspace={'C:\\w'}
      pickFolder={async () => {
        called = true;
        throw new Error('powershell.exe not found');
      }}
    />,
  );
  await tick();
  screen.stdin.write('\t'); // -> Workspace
  await tick(100);
  screen.stdin.write('\t'); // -> [ Browse... ]
  await tick(100);
  screen.stdin.write('\r');
  await waitFor(() => called);
  await tick(150);
  for (let i = 0; i < 5; i += 1) {
    screen.stdin.write('\t');
    await tick(80);
  }
  screen.stdin.write('D:\\manual'); // types into the Workspace field
  await tick(150);
  screen.unmount();
  await tick(50);
  const frame = screen.output();
  expect(frame).toContain('D:\\manual'); // the typed path landed in the field
  expect(frame).not.toContain('The folder picker could not be opened'); // editing cleared the stale error
});

// Input is gated while the picker is in flight: an Enter pressed during the
// wait never reaches the form (no submit), and the resolved pick lands after.
test('input is gated while the folder picker is in flight', async () => {
  let releasePicker!: (value: string | null) => void;
  const screen = renderCaptured(
    <InitScreen
      onBack={() => {}}
      onResult={() => {}}
      defaultWorkspace={'C:\\w'}
      pickFolder={() =>
        new Promise<string | null>((res) => {
          releasePicker = res;
        })
      }
    />,
  );
  await tick();
  screen.stdin.write('\t'); // -> Workspace
  await tick(100);
  screen.stdin.write('\t'); // -> [ Browse... ]
  await tick(100);
  screen.stdin.write('\r'); // open the picker (stays pending)
  await tick(200);
  screen.stdin.write('\r'); // Enter while busy — must NOT submit the form
  await tick(100);
  releasePicker('C:\\picked');
  await tick(300);
  screen.unmount();
  await tick(50);
  const frame = screen.output();
  expect(frame).toContain('C:\\picked'); // the resolved pick landed after the wait
  expect(frame).not.toContain('Title is required.'); // the busy Enter was gated, not submitted
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
