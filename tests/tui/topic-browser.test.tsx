import React from 'react';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, afterEach, expect, test } from 'vitest';
import { render, type Instance } from 'ink';
import { TopicBrowser } from '../../src/tui/topic-browser';

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

function makeWikiWithTopics(workspace: string, wiki: string): void {
  const topicsDir = join(workspace, 'wikis', wiki, 'topics');
  mkdirSync(join(topicsDir, 'financial'), { recursive: true });
  writeFileSync(
    join(topicsDir, 'financial', 'financial.md'),
    '---\ntitle: "Financial"\ntype: topic\n---\n\n## Claims\n\n- Revenue was $42.5M in Q3 2024 [^src1]\n',
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

// Phase 3 §5.2: topic browser renders folder tree and files.
test('topic browser renders the folder tree', async () => {
  const workspace = makeTempDir('llm-wiki-topicbrowser-');
  makeWikiWithTopics(workspace, 'test-wiki');

  const screen = renderCaptured(
    <TopicBrowser onBack={() => {}} workspace={workspace} wiki="test-wiki" />,
  );
  await waitFor(() => screen.output().includes('financial/'));
  screen.unmount();
  await tick(50);

  const frame = screen.output();
  expect(frame).toContain('Browse Topics');
  expect(frame).toContain('topics/');
  expect(frame).toContain('financial/');
  expect(frame).toContain('Escape: back');
});

// §5.2: Enter on a file opens the viewer.
// Navigation path: expand root, move to financial/, expand, move to financial.md, enter.
test('topic browser opens a file viewer on Enter', async () => {
  const workspace = makeTempDir('llm-wiki-topicbrowser-view-');
  makeWikiWithTopics(workspace, 'test-wiki');

  const screen = renderCaptured(
    <TopicBrowser onBack={() => {}} workspace={workspace} wiki="test-wiki" />,
  );
  await waitFor(() => screen.output().includes('financial/'));
  const keys = [KEY.right, KEY.down, KEY.right, KEY.down, KEY.enter];
  for (const key of keys) {
    screen.stdin.write(key);
    await tick(100);
  }
  await tick(200);
  screen.unmount();
  await tick(50);

  const frame = screen.output();
  expect(frame).toContain('Viewer');
  expect(frame).toContain('Revenue was $42.5M');
  expect(frame).toContain('Escape: back to tree');
});

// Escape contract: viewer -> tree -> menu.
test('escape steps back from topic viewer to tree to menu', async () => {
  const workspace = makeTempDir('llm-wiki-topicbrowser-esc-');
  makeWikiWithTopics(workspace, 'test-wiki');

  let backCount = 0;
  const screen = renderCaptured(
    <TopicBrowser onBack={() => (backCount += 1)} workspace={workspace} wiki="test-wiki" />,
  );
  await waitFor(() => screen.output().includes('financial/'));
  const keys = [KEY.right, KEY.down, KEY.right, KEY.down, KEY.enter];
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
test('topic browser renders a static fallback without a TTY', async () => {
  const workspace = makeTempDir('llm-wiki-topicbrowser-notty-');
  makeWikiWithTopics(workspace, 'test-wiki');

  const stdin = createFakeStdin();
  stdin.isTTY = false;
  const stdout = createFakeStdout();
  stdout.isTTY = false;
  let output = '';
  stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  const instance = render(
    <TopicBrowser onBack={() => {}} workspace={workspace} wiki="test-wiki" />,
    {
      stdout: stdout as unknown as NodeJS.WriteStream,
      stdin: stdin as unknown as NodeJS.ReadStream,
    },
  );
  await tick(400);
  instance.unmount();
  await tick(50);

  const frame = stripAnsi(output);
  expect(frame).toContain('Browse Topics');
  expect(frame).toContain('financial.md');
  expect(frame).toContain('requires a TTY');
  expect(frame).toContain('Escape: back');
});
