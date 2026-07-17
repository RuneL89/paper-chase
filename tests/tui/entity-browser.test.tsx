import React from 'react';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, afterEach, expect, test } from 'vitest';
import { render, type Instance } from 'ink';
import { EntityBrowser } from '../../src/tui/entity-browser';

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

function makeWikiWithEntities(workspace: string, wiki: string): void {
  const entitiesDir = join(workspace, 'wikis', wiki, 'entities');
  mkdirSync(join(entitiesDir, 'people', 'executives'), { recursive: true });
  mkdirSync(join(entitiesDir, 'companies'), { recursive: true });
  writeFileSync(
    join(entitiesDir, 'people', 'executives', 'john-smith.md'),
    '---\ntitle: "John Smith"\ntype: entity\n---\n\n## Mentions\n\n- Page 1: "John Smith, CEO of Acme Corp" [^src1]\n',
  );
  writeFileSync(
    join(entitiesDir, 'people', 'executives', 'jane-doe.md'),
    '---\ntitle: "Jane Doe"\ntype: entity\n---\n\n## Mentions\n\n- Page 1: "Jane Doe, CFO of Acme Corp" [^src1]\n',
  );
  writeFileSync(
    join(entitiesDir, 'companies', 'acme-corp.md'),
    '---\ntitle: "Acme Corp"\ntype: entity\n---\n',
  );
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

const KEY = {
  down: '\u001b[B',
  up: '\u001b[A',
  right: '\u001b[C',
  left: '\u001b[D',
  enter: '\r',
  escape: ESC,
};

// Phase 3 §5.1: screen renders and lists entity folders/files.
test('entity browser renders the folder tree', async () => {
  const workspace = makeTempDir('llm-wiki-entitybrowser-');
  makeWikiWithEntities(workspace, 'test-wiki');

  const screen = renderCaptured(
    <EntityBrowser onBack={() => {}} workspace={workspace} wiki="test-wiki" />,
  );
  await waitFor(() => screen.output().includes('people/'));
  screen.unmount();
  await tick(50);

  const frame = screen.output();
  expect(frame).toContain('Browse Entities');
  expect(frame).toContain('entities/');
  expect(frame).toContain('people/');
  expect(frame).toContain('companies/');
  expect(frame).toContain('Escape: back');
});

// §5.1: Enter on a file opens the viewer.
// Navigation path: expand root, move to people/, expand, move to executives/, expand,
// move past jane-doe.md to john-smith.md, enter.
test('entity browser opens a file viewer on Enter', async () => {
  const workspace = makeTempDir('llm-wiki-entitybrowser-view-');
  makeWikiWithEntities(workspace, 'test-wiki');

  const screen = renderCaptured(
    <EntityBrowser onBack={() => {}} workspace={workspace} wiki="test-wiki" />,
  );
  await waitFor(() => screen.output().includes('people/'));
  // Expand root -> select people/ -> expand -> select executives/ -> expand -> select jane-doe.md -> select john-smith.md -> enter
  const keys = [
    KEY.right,
    KEY.down,
    KEY.down,
    KEY.right,
    KEY.down,
    KEY.right,
    KEY.down,
    KEY.down,
    KEY.enter,
  ];
  for (const key of keys) {
    screen.stdin.write(key);
    await tick(100);
  }
  await tick(200);
  screen.unmount();
  await tick(50);

  const frame = screen.output();
  expect(frame).toContain('Viewer');
  expect(frame).toContain('John Smith, CEO of Acme Corp');
  expect(frame).toContain('Escape: back to tree');
});

// Escape contract: viewer -> tree -> menu (onBack).
test('escape steps back from viewer to tree to menu', async () => {
  const workspace = makeTempDir('llm-wiki-entitybrowser-esc-');
  makeWikiWithEntities(workspace, 'test-wiki');

  let backCount = 0;
  const screen = renderCaptured(
    <EntityBrowser onBack={() => (backCount += 1)} workspace={workspace} wiki="test-wiki" />,
  );
  await waitFor(() => screen.output().includes('people/'));
  const keys = [
    KEY.right,
    KEY.down,
    KEY.down,
    KEY.right,
    KEY.down,
    KEY.right,
    KEY.down,
    KEY.down,
    KEY.enter,
  ];
  for (const key of keys) {
    screen.stdin.write(key);
    await tick(100);
  }
  await tick(200);
  // Escape back to tree.
  screen.stdin.write(KEY.escape);
  await tick(200);
  expect(backCount).toBe(0);
  // Escape back to menu.
  screen.stdin.write(KEY.escape);
  await tick(200);
  screen.unmount();
  await tick(50);
  expect(backCount).toBe(1);
});

// Non-TTY contract: static fallback, no crash, info visible.
test('entity browser renders a static fallback without a TTY', async () => {
  const workspace = makeTempDir('llm-wiki-entitybrowser-notty-');
  makeWikiWithEntities(workspace, 'test-wiki');

  const stdin = createFakeStdin();
  stdin.isTTY = false;
  const stdout = createFakeStdout();
  stdout.isTTY = false;
  let output = '';
  stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  const instance = render(
    <EntityBrowser onBack={() => {}} workspace={workspace} wiki="test-wiki" />,
    {
      stdout: stdout as unknown as NodeJS.WriteStream,
      stdin: stdin as unknown as NodeJS.ReadStream,
    },
  );
  await tick(400);
  instance.unmount();
  await tick(50);

  const frame = stripAnsi(output);
  expect(frame).toContain('Browse Entities');
  expect(frame).toContain('john-smith.md');
  expect(frame).toContain('requires a TTY');
  expect(frame).toContain('Escape: back');
});
