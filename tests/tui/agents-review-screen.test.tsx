import React from 'react';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, afterEach, expect, test } from 'vitest';
import { render, type Instance } from 'ink';
import { init } from '../../src/commands/init';
import { AgentsReviewScreen } from '../../src/tui/agents-review-screen';

/**
 * Phase 9 §5.1 TUI tests: the Review AGENTS.md Updates screen renders the
 * proposed-changes summary (new folders, new page types, diff stats), applies
 * the proposal (UAT 9.3), discards it, and renders a static fallback without
 * a TTY. Hermetic temp workspaces; no LLM calls.
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

function writeStructuralChanges(dir: string): void {
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
            timestamp: '2026-07-21T12:00:00Z',
            type: 'new-page-type',
            path: 'transaction',
            reason: "New entity page type 'transaction' discovered during extraction",
          },
        ],
        knownPageTypes: ['transaction'],
      },
      null,
      2,
    ),
  );
}

async function makeWikiWithProposal(workspace: string, wiki: string): Promise<void> {
  await init(wiki, { workspace });
  const dir = join(workspace, 'wikis', wiki);
  writeStructuralChanges(dir);
  const current = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
  writeFileSync(
    join(dir, '.state', 'proposed-agents.md'),
    `${current}\nProposed addition: entities/companies/offshore folder example.\n`,
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

test('review screen renders the proposed-changes summary with diff stats', async () => {
  const workspace = makeTempDir('llm-wiki-agentsreview-');
  await makeWikiWithProposal(workspace, 'test-wiki');

  const screen = renderCaptured(
    <AgentsReviewScreen onBack={() => {}} workspace={workspace} wiki="test-wiki" />,
  );
  await waitFor(() => screen.output().includes('Proposed changes'));
  screen.unmount();
  await tick(50);

  const frame = screen.output();
  expect(frame).toContain('Review AGENTS.md Updates');
  expect(frame).toContain('Wiki: test-wiki');
  expect(frame).toContain('+ Added folder: entities/companies/offshore');
  expect(frame).toContain('+ Added page type: transaction');
  expect(frame).toMatch(/Diff: [2-9]\d* lines added, 0 removed/);
  expect(frame).toContain('[A] Apply Changes');
  expect(frame).toContain('[D] Discard');
  expect(frame).toContain('[V] View Full Diff');
});

test('apply copies the proposal over AGENTS.md (UAT 9.3)', async () => {
  const workspace = makeTempDir('llm-wiki-agentsreview-');
  await makeWikiWithProposal(workspace, 'test-wiki');
  const dir = join(workspace, 'wikis', 'test-wiki');
  const before = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
  expect(before).not.toContain('Proposed addition');

  const screen = renderCaptured(
    <AgentsReviewScreen onBack={() => {}} workspace={workspace} wiki="test-wiki" />,
  );
  await waitFor(() => screen.output().includes('Proposed changes'));
  screen.stdin.write('a');
  await waitFor(() => screen.output().includes('Applied proposed AGENTS.md updates'));
  screen.unmount();
  await tick(50);

  const after = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
  expect(after).toContain('Proposed addition: entities/companies/offshore folder example.');
  expect(after).toContain('## Language');
});

test('discard deletes the proposal file', async () => {
  const workspace = makeTempDir('llm-wiki-agentsreview-');
  await makeWikiWithProposal(workspace, 'test-wiki');
  const proposalPath = join(workspace, 'wikis', 'test-wiki', '.state', 'proposed-agents.md');
  expect(existsSync(proposalPath)).toBe(true);

  const screen = renderCaptured(
    <AgentsReviewScreen onBack={() => {}} workspace={workspace} wiki="test-wiki" />,
  );
  await waitFor(() => screen.output().includes('Proposed changes'));
  screen.stdin.write('d');
  await waitFor(() => screen.output().includes('Discarded proposed AGENTS.md updates'));
  screen.unmount();
  await tick(50);

  expect(existsSync(proposalPath)).toBe(false);
});

test('view full diff shows added lines and scrolls back to the summary', async () => {
  const workspace = makeTempDir('llm-wiki-agentsreview-');
  await makeWikiWithProposal(workspace, 'test-wiki');

  const screen = renderCaptured(
    <AgentsReviewScreen onBack={() => {}} workspace={workspace} wiki="test-wiki" />,
  );
  await waitFor(() => screen.output().includes('Proposed changes'));
  screen.stdin.write('v');
  // 'Full Diff (' (with the counts) appears ONLY in the diff view — the
  // summary's '[V] View Full Diff' label must not satisfy this wait.
  await waitFor(() => screen.output().includes('Full Diff ('));
  expect(screen.output()).toContain('+ Proposed addition: entities/companies/offshore folder example.');
  screen.stdin.write(ESC);
  await tick(300);
  screen.unmount();
  await tick(50);
});

test('wiki without a proposal shows guidance', async () => {
  const workspace = makeTempDir('llm-wiki-agentsreview-');
  await init('test-wiki', { workspace });

  const screen = renderCaptured(
    <AgentsReviewScreen onBack={() => {}} workspace={workspace} wiki="test-wiki" />,
  );
  await waitFor(() => screen.output().includes('No proposal found'));
  screen.unmount();
  await tick(50);

  expect(screen.output()).toContain('--update-agents');
});

test('review screen renders a static fallback without a TTY', async () => {
  const workspace = makeTempDir('llm-wiki-agentsreview-notty-');
  await makeWikiWithProposal(workspace, 'test-wiki');

  const stdin = createFakeStdin();
  stdin.isTTY = false;
  const stdout = createFakeStdout();
  stdout.isTTY = false;
  let output = '';
  stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  const instance = render(
    <AgentsReviewScreen onBack={() => {}} workspace={workspace} wiki="test-wiki" />,
    {
      stdout: stdout as unknown as NodeJS.WriteStream,
      stdin: stdin as unknown as NodeJS.ReadStream,
    },
  );
  await tick(400);
  instance.unmount();
  await tick(50);

  const frame = stripAnsi(output);
  expect(frame).toContain('Review AGENTS.md Updates');
  expect(frame).toContain('Proposed changes');
});
