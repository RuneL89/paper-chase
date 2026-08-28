import React from 'react';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, afterEach, expect, test } from 'vitest';
import { render, type Instance } from 'ink';
import { App } from '../../src/tui/app';
import { InitScreen } from '../../src/tui/init-screen';
import { AddPdfsScreen } from '../../src/tui/add-pdfs-screen';
import { IngestScreen } from '../../src/tui/ingest-screen';
import { init } from '../../src/commands/init';

// 2026-08-28 (user-reported bug fix): the workspace chosen in Create New Wiki
// was dropped the moment the screen returned — Add PDFs and Ingest kept using
// the launch folder (cwd), so PDFs landed in dist\wikis\... instead of the
// picked workspace. These tests pin the fix: the created workspace becomes
// the ACTIVE one for the session, the selectors aggregate EVERY registered
// workspace, and the wiki list is a live scan (deleted wikis vanish).
//
// The regression drives the real user flow through the injected pickFolder
// stub (the App threads it into InitScreen, the ingestFn precedent) so no
// real dialog spawns and no backspace handling is required.

const GOLDEN_MASTER = 'test-pdfs/golden-master.pdf';

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

const tick = (ms = 150) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function waitFor(condition: () => boolean, timeoutMs = 15000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (condition()) {
      return;
    }
    await tick(50);
  }
  throw new Error('waitFor timed out');
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

function renderCaptured(node: React.ReactElement): CapturedRender {
  const stdin = createFakeStdin();
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

// The reported bug: create a wiki in a DIFFERENT folder via the picker, add a
// PDF, and the copy must land in the picked workspace — never the App's seed.
test('a wiki created via the folder picker activates its workspace for Add PDFs', async () => {
  const workspaceA = makeTempDir('paper-chase-app-ws-a-');
  const workspaceB = makeTempDir('paper-chase-app-ws-b-');
  const registered: string[] = [];
  // The picker promise is resolved manually — ink only writes the final frame
  // on unmount for a non-TTY stdout, so mid-flight state is observable only
  // through filesystem effects and this controlled handshake, never output().
  let resolvePicker!: (workspace: string) => void;
  const app = renderCaptured(
    React.createElement(App, {
      workspace: workspaceA,
      pickFolder: () => new Promise((resolvePromise) => (resolvePicker = resolvePromise)),
      onWorkspaceRegistered: (workspace) => registered.push(workspace),
    }),
  );
  try {
    await tick(400); // let the menu mount
    app.stdin.write('\r'); // Enter on "Create New Wiki"
    await tick(200);
    app.stdin.write('Flow Wiki'); // Title field (focused first)
    await tick(150);
    app.stdin.write('\t'); // -> Workspace (pre-filled with workspaceA)
    await tick(100);
    app.stdin.write('\t'); // -> [ Browse... ]
    await tick(100);
    app.stdin.write('\r'); // opens the picker stub
    await tick(300); // dialog "in flight"
    resolvePicker(workspaceB); // the user picks workspaceB
    await tick(300); // the field fills + re-renders
    app.stdin.write('\t'); // -> Output Language
    await tick(100);
    app.stdin.write('\r'); // Enter on the dropdown submits -> init()
    await waitFor(() => existsSync(join(workspaceB, 'wikis', 'flow-wiki', 'AGENTS.md')), 30000);
    await tick(300); // let the app route straight to Add PDFs (initialWiki)
    // Add PDFs via the manual fallback: typing jumps focus to the path input.
    app.stdin.write(resolve(GOLDEN_MASTER));
    await tick(300);
    app.stdin.write('\r'); // submit the path -> copy -> "Start ingesting now?"
    await waitFor(
      () => existsSync(join(workspaceB, 'wikis', 'flow-wiki', 'raw', 'golden-master.pdf')),
      30000,
    );
    await tick(300);
    app.unmount();
    await tick(50);

    const frame = app.output();
    expect(frame).toContain('Add PDFs');
    expect(frame).toContain('Copied 1 file(s) to wikis/flow-wiki/raw/.');
    // The PDF landed in the PICKED workspace...
    expect(existsSync(join(workspaceB, 'wikis', 'flow-wiki', 'raw', 'golden-master.pdf'))).toBe(true);
    // ...and the pre-fix bug target (the App seed) was never touched.
    expect(existsSync(join(workspaceA, 'wikis', 'flow-wiki'))).toBe(false);
    // The production hook heard the new workspace exactly once.
    expect(registered).toEqual([workspaceB]);
  } finally {
    app.unmount();
  }
}, 60000);

// InitScreen contract: onCreated carries the slug AND the workspace.
test('InitScreen onCreated carries the slug and the workspace', async () => {
  const workspace = makeTempDir('paper-chase-init-payload-');
  let created: { slug: string; workspace: string } | undefined;
  const screen = renderCaptured(
    <InitScreen defaultWorkspace={workspace} onBack={() => {}} onCreated={(result) => (created = result)} />,
  );
  await tick(300);
  screen.stdin.write('Payload Wiki');
  await tick(150);
  screen.stdin.write('\t'); // -> Workspace (pre-filled)
  await tick(100);
  screen.stdin.write('\t'); // -> [ Browse... ]
  await tick(100);
  screen.stdin.write('\t'); // -> Output Language
  await tick(100);
  screen.stdin.write('\r'); // Enter on the dropdown submits
  await waitFor(() => created !== undefined, 30000);
  screen.unmount();
  await tick(50);

  expect(created).toEqual({ slug: 'payload-wiki', workspace });
  expect(existsSync(join(workspace, 'wikis', 'payload-wiki', 'AGENTS.md'))).toBe(true);
}, 30000);

// Multi-workspace aggregation: both folders' wikis appear in ONE selector,
// each labeled with its workspace (single-workspace frames stay unlabeled).
test('Add PDFs and Ingest list the wikis of every registered workspace', async () => {
  const workspaceA = makeTempDir('paper-chase-agg-a-');
  const workspaceB = makeTempDir('paper-chase-agg-b-');
  await init('wiki-a', { workspace: workspaceA });
  await init('wiki-b', { workspace: workspaceB });

  const addPdfs = renderCaptured(
    <AddPdfsScreen workspace={workspaceA} workspaces={[workspaceA, workspaceB]} onBack={() => {}} />,
  );
  await tick(400);
  addPdfs.unmount();
  await tick(50);
  const addFrame = addPdfs.output();
  expect(addFrame).toContain(`wiki-a (${workspaceA})`);
  expect(addFrame).toContain(`wiki-b (${workspaceB})`);

  const ingestScreen = renderCaptured(
    <IngestScreen workspace={workspaceA} workspaces={[workspaceA, workspaceB]} onBack={() => {}} />,
  );
  await tick(400);
  ingestScreen.unmount();
  await tick(50);
  const ingestFrame = ingestScreen.output();
  expect(ingestFrame).toContain(`wiki-a (${workspaceA})`);
  expect(ingestFrame).toContain(`wiki-b (${workspaceB})`);

  // Single-workspace frames stay byte-compatible: no workspace suffix.
  const single = renderCaptured(<AddPdfsScreen workspace={workspaceA} onBack={() => {}} />);
  await tick(400);
  single.unmount();
  await tick(50);
  const singleFrame = single.output();
  expect(singleFrame).toContain('wiki-a');
  expect(singleFrame).not.toContain(`wiki-a (${workspaceA})`);
}, 30000);

// The list is a LIVE filesystem scan, never a stored list: a wiki folder
// deleted on disk is gone from the selector on the next screen entry.
test('a deleted wiki folder disappears from the selector on the next screen entry', async () => {
  const workspaceA = makeTempDir('paper-chase-del-a-');
  const workspaceB = makeTempDir('paper-chase-del-b-');
  await init('keep-me', { workspace: workspaceA });
  await init('delete-me', { workspace: workspaceB });

  const first = renderCaptured(
    <AddPdfsScreen workspace={workspaceA} workspaces={[workspaceA, workspaceB]} onBack={() => {}} />,
  );
  await tick(400);
  first.unmount();
  await tick(50);
  expect(first.output()).toContain('delete-me');

  rmSync(join(workspaceB, 'wikis', 'delete-me'), { recursive: true, force: true });

  // Next entry re-scans both folders: the deleted wiki is gone, the other stays.
  const second = renderCaptured(
    <AddPdfsScreen workspace={workspaceA} workspaces={[workspaceA, workspaceB]} onBack={() => {}} />,
  );
  await tick(400);
  second.unmount();
  await tick(50);
  const frame = second.output();
  expect(frame).toContain('keep-me');
  expect(frame).not.toContain('delete-me');
}, 30000);
