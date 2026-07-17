import React from 'react';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, afterEach, expect, test } from 'vitest';
import { render, type Instance } from 'ink';
import { DoxBrowser } from '../../src/tui/dox-browser';

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

function makeWikiWithDox(workspace: string, wiki: string): void {
  const wikiDir = join(workspace, 'wikis', wiki);
  mkdirSync(join(wikiDir, 'entities', 'people', 'executives'), { recursive: true });
  mkdirSync(join(wikiDir, 'topics', 'financial'), { recursive: true });
  mkdirSync(join(wikiDir, 'documents'), { recursive: true });
  mkdirSync(join(wikiDir, 'sources'), { recursive: true });
  mkdirSync(join(wikiDir, 'raw'), { recursive: true });
  mkdirSync(join(wikiDir, '.state'), { recursive: true });

  writeFileSync(
    join(wikiDir, 'index.md'),
    '---\ntitle: "Test Wiki"\ntype: index\nwiki: test-wiki\nupdated: 2026-07-16T10:00:00Z\nchildren:\n  - entities/index.md\n  - topics/index.md\n  - documents/index.md\n  - sources/index.md\n---\n\n# Test Wiki\n\nA citation-backed wiki.\n',
  );
  writeFileSync(
    join(wikiDir, 'entities', 'index.md'),
    '---\ntitle: "Entities"\ntype: index\nwiki: test-wiki\nupdated: 2026-07-16T10:00:00Z\nchildren:\n  - people/index.md\n---\n\n# Entities\n',
  );
  writeFileSync(
    join(wikiDir, 'entities', 'people', 'index.md'),
    '---\ntitle: "People"\ntype: index\nwiki: test-wiki\nupdated: 2026-07-16T10:00:00Z\nchildren:\n  - executives/index.md\n---\n\n# People\n',
  );
  writeFileSync(
    join(wikiDir, 'entities', 'people', 'executives', 'index.md'),
    '---\ntitle: "Executives"\ntype: index\nwiki: test-wiki\nupdated: 2026-07-16T10:00:00Z\nchildren:\n  - john-smith.md\n---\n\n# Executives\n',
  );
  writeFileSync(
    join(wikiDir, 'entities', 'people', 'executives', 'john-smith.md'),
    '---\ntitle: "John Smith"\ntype: entity\n---\n\n## Mentions\n\n- Page 1: "John Smith, CEO of Acme Corp" [^src1]\n',
  );
  writeFileSync(
    join(wikiDir, 'topics', 'index.md'),
    '---\ntitle: "Topics"\ntype: index\nwiki: test-wiki\nupdated: 2026-07-16T10:00:00Z\nchildren:\n  - financial/index.md\n---\n\n# Topics\n',
  );
  writeFileSync(
    join(wikiDir, 'topics', 'financial', 'index.md'),
    '---\ntitle: "Financial"\ntype: index\nwiki: test-wiki\nupdated: 2026-07-16T10:00:00Z\nchildren:\n  - financial.md\n---\n\n# Financial\n',
  );
  writeFileSync(
    join(wikiDir, 'topics', 'financial', 'financial.md'),
    '---\ntitle: "Financial"\ntype: topic\n---\n\n## Claims\n\n- Revenue was $42.5M in Q3 2024 [^src1]\n',
  );

  // raw/ and .state/ should be ignored by the browser.
  writeFileSync(join(wikiDir, 'raw', 'ignored.pdf'), 'not a pdf', 'utf-8');
  writeFileSync(join(wikiDir, '.state', 'ignored.json'), '{}', 'utf-8');

  // AGENTS.md should be ignored.
  writeFileSync(
    join(wikiDir, 'AGENTS.md'),
    '# Constitution\n\nThis is the wiki constitution.\n',
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

// Phase 5 §5.1: DOX browser renders the contract tree.
test('DOX browser renders the contract tree', async () => {
  const workspace = makeTempDir('llm-wiki-doxbrowser-');
  makeWikiWithDox(workspace, 'test-wiki');

  const screen = renderCaptured(
    <DoxBrowser onBack={() => {}} workspace={workspace} wiki="test-wiki" />,
  );
  await waitFor(() => screen.output().includes('test-wiki/'));
  screen.unmount();
  await tick(50);

  const frame = screen.output();
  expect(frame).toContain('Browse DOX Contracts');
  expect(frame).toContain('test-wiki/');
  expect(frame).toContain('entities/');
  expect(frame).toContain('topics/');
  expect(frame).toContain('documents/');
  expect(frame).toContain('sources/');
  expect(frame).toContain('Escape: back');
  // raw/ and .state/ should not appear.
  expect(frame).not.toContain('raw/');
  expect(frame).not.toContain('.state/');
  // AGENTS.md should not appear.
  expect(frame).not.toContain('AGENTS.md');
});

// §5.1: Enter on the root index.md opens the contract viewer.
test('DOX browser opens an index.md viewer on Enter', async () => {
  const workspace = makeTempDir('llm-wiki-doxbrowser-index-');
  makeWikiWithDox(workspace, 'test-wiki');

  const screen = renderCaptured(
    <DoxBrowser onBack={() => {}} workspace={workspace} wiki="test-wiki" />,
  );
  await waitFor(() => screen.output().includes('test-wiki/'));
  // Expand root, move past the four folders, select root index.md, enter.
  const keys = [KEY.right, KEY.down, KEY.down, KEY.down, KEY.down, KEY.down, KEY.enter];
  for (const key of keys) {
    screen.stdin.write(key);
    await tick(100);
  }
  await tick(200);
  screen.unmount();
  await tick(50);

  const frame = screen.output();
  expect(frame).toContain('Viewer');
  expect(frame).toContain('# Test Wiki');
  expect(frame).toContain('type: index');
  expect(frame).toContain('Escape: back to tree');
});

// §5.1: Enter on a content page opens the file viewer.
test('DOX browser opens a content page viewer on Enter', async () => {
  const workspace = makeTempDir('llm-wiki-doxbrowser-content-');
  makeWikiWithDox(workspace, 'test-wiki');

  const screen = renderCaptured(
    <DoxBrowser onBack={() => {}} workspace={workspace} wiki="test-wiki" />,
  );
  await waitFor(() => screen.output().includes('test-wiki/'));
  // Expand root -> entities/ -> people/ -> executives/ -> select john-smith.md -> enter.
  const keys = [
    KEY.right,
    KEY.down,
    KEY.down,
    KEY.right,
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

// Escape contract: viewer -> tree -> menu.
test('escape steps back from DOX viewer to tree to menu', async () => {
  const workspace = makeTempDir('llm-wiki-doxbrowser-esc-');
  makeWikiWithDox(workspace, 'test-wiki');

  let backCount = 0;
  const screen = renderCaptured(
    <DoxBrowser onBack={() => (backCount += 1)} workspace={workspace} wiki="test-wiki" />,
  );
  await waitFor(() => screen.output().includes('test-wiki/'));
  const keys = [
    KEY.right,
    KEY.down,
    KEY.down,
    KEY.right,
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
test('DOX browser renders a static fallback without a TTY', async () => {
  const workspace = makeTempDir('llm-wiki-doxbrowser-notty-');
  makeWikiWithDox(workspace, 'test-wiki');

  const stdin = createFakeStdin();
  stdin.isTTY = false;
  const stdout = createFakeStdout();
  stdout.isTTY = false;
  let output = '';
  stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  const instance = render(
    <DoxBrowser onBack={() => {}} workspace={workspace} wiki="test-wiki" />,
    {
      stdout: stdout as unknown as NodeJS.WriteStream,
      stdin: stdin as unknown as NodeJS.ReadStream,
    },
  );
  await tick(400);
  instance.unmount();
  await tick(50);

  const frame = stripAnsi(output);
  expect(frame).toContain('Browse DOX Contracts');
  expect(frame).toContain('john-smith.md');
  expect(frame).toContain('requires a TTY');
  expect(frame).toContain('Escape: back');
  expect(frame).not.toContain('raw/');
  expect(frame).not.toContain('.state/');
  expect(frame).not.toContain('AGENTS.md');
});
