import React from 'react';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, afterEach, expect, test } from 'vitest';
import { render, type Instance } from 'ink';
import { init } from '../../src/commands/init';
import { StructuralChangesScreen } from '../../src/tui/structural-changes-screen';

/**
 * Phase 9 §5.2 TUI tests: the Structural Changes screen renders the change
 * log (timestamps, new folders, reasons), shows an empty state when nothing
 * is logged, and renders a static fallback without a TTY. Hermetic temp
 * workspaces; no LLM calls.
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

async function makeWikiWithChanges(workspace: string, wiki: string): Promise<void> {
  await init(wiki, { workspace });
  const dir = join(workspace, 'wikis', wiki);
  mkdirSync(join(dir, '.state', 'proposals'), { recursive: true });
  writeFileSync(
    join(dir, '.state', 'proposals', 'structural-changes.json'),
    JSON.stringify(
      {
        changes: [
          {
            timestamp: '2026-07-21T12:00:00Z',
            type: 'new-folder',
            path: 'entities/companies/offshore',
            reason: '2 entities placed in this folder',
            affectedEntities: ['acme-bvi', 'shell-corp-ltd'],
          },
          {
            timestamp: '2026-07-21T12:01:00Z',
            type: 'new-folder',
            path: 'topics/legal/litigation',
            reason: "Topic page 'litigation' created from claims of type 'litigation'",
            affectedEntities: ['acme-corp'],
          },
        ],
        knownPageTypes: [],
      },
      null,
      2,
    ),
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

test('structural changes screen renders the log with timestamps and reasons (UAT 9.4)', async () => {
  const workspace = makeTempDir('llm-wiki-structchanges-');
  await makeWikiWithChanges(workspace, 'test-wiki');

  const screen = renderCaptured(
    <StructuralChangesScreen onBack={() => {}} workspace={workspace} wiki="test-wiki" />,
  );
  await waitFor(() => screen.output().includes('entities/companies/offshore'));
  screen.unmount();
  await tick(50);

  const frame = screen.output();
  expect(frame).toContain('Structural Changes');
  expect(frame).toContain('Wiki: test-wiki');
  expect(frame).toContain('2026-07-21 12:00');
  expect(frame).toContain('New folder: entities/companies/offshore');
  expect(frame).toContain('Reason: 2 entities placed in this folder');
  expect(frame).toContain('Entities: acme-bvi, shell-corp-ltd');
  expect(frame).toContain('New folder: topics/legal/litigation');
});

test('wiki without a log shows the empty state', async () => {
  const workspace = makeTempDir('llm-wiki-structchanges-');
  await init('test-wiki', { workspace });

  const screen = renderCaptured(
    <StructuralChangesScreen onBack={() => {}} workspace={workspace} wiki="test-wiki" />,
  );
  await waitFor(() => screen.output().includes('No structural changes logged'));
  screen.unmount();
  await tick(50);
});

test('structural changes screen renders a static fallback without a TTY', async () => {
  const workspace = makeTempDir('llm-wiki-structchanges-notty-');
  await makeWikiWithChanges(workspace, 'test-wiki');

  const stdin = createFakeStdin();
  stdin.isTTY = false;
  const stdout = createFakeStdout();
  stdout.isTTY = false;
  let output = '';
  stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  const instance = render(
    <StructuralChangesScreen onBack={() => {}} workspace={workspace} wiki="test-wiki" />,
    {
      stdout: stdout as unknown as NodeJS.WriteStream,
      stdin: stdin as unknown as NodeJS.ReadStream,
    },
  );
  await tick(400);
  instance.unmount();
  await tick(50);

  const frame = stripAnsi(output);
  expect(frame).toContain('Structural Changes');
  expect(frame).toContain('entities/companies/offshore');
});
