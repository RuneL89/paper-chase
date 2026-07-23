import React from 'react';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, afterEach, expect, test } from 'vitest';
import { render, type Instance } from 'ink';
import { App, type Screen } from '../../src/tui/app';
import { MENU_ITEMS, MenuScreen, resolveMenuSelection } from '../../src/tui/menu';
import { InitScreen } from '../../src/tui/init-screen';
import { IngestScreen } from '../../src/tui/ingest-screen';
import { AddPdfsScreen } from '../../src/tui/add-pdfs-screen';
import { SettingsScreen } from '../../src/tui/settings-screen';

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

/**
 * Fake TTY stdin for Ink. Ink determines raw-mode support from `stdin.isTTY`
 * and reads keypresses via a `readable` listener on the stream, so a
 * PassThrough with `isTTY`/`setRawMode`/`ref`/`unref` stubs lets tests drive
 * the real input pipeline (useInput -> ink-select-input) without a terminal.
 */
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

// Ink 7's render() no longer returns lastFrame(), and with a non-TTY stdout
// Ink runs in non-interactive mode where the frame is only written on
// unmount. So tests capture everything written to a fake stdout stream and
// assert after unmount(). ANSI escape codes are stripped for assertions.
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

const tick = (ms = 150) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

// Gate 0.6: TUI Renders Without Crashing
test('TUI renders without crashing', () => {
  const { unmount } = render(<App />);
  unmount();
});

// Gate 0.7: TUI Menu Shows All Options
// UPDATED 2026-07-22 (Phase 11, phase doc §2.3): the development and review
// screens are gone; the production menu is exactly five items — Create New
// Wiki, Add PDFs, Ingest PDFs, Settings, Exit — with clean labels (no
// parenthetical command suffixes). The removed items must NOT render.
test('TUI menu shows exactly the five production options', async () => {
  const menu = renderCaptured(<MenuScreen onSelect={() => {}} lastResult="" />);
  await tick();
  menu.unmount(); // non-interactive Ink writes the final frame on unmount
  await tick(50);
  const frame = menu.output();
  expect(frame).toContain('Create New Wiki');
  expect(frame).toContain('Add PDFs');
  expect(frame).toContain('Ingest PDFs');
  expect(frame).toContain('Settings');
  expect(frame).toContain('Exit');
  // Removed development/review entries (Phase 11 §2.3).
  expect(frame).not.toContain('Run Tests');
  expect(frame).not.toContain('Test Extractor');
  expect(frame).not.toContain('View Validation Report');
  expect(frame).not.toContain('View Ingestion Log');
  expect(frame).not.toContain('Browse Entities');
  expect(frame).not.toContain('Browse Topics');
  expect(frame).not.toContain('Browse DOX Contracts');
  expect(frame).not.toContain('Review AGENTS.md Updates');
  expect(frame).not.toContain('View Structural Changes');
});

// Gate 0.8: TUI Can Navigate Screens.
// The spec's version renders <App /> twice and writes to stdin of the first
// instance; in a non-TTY test runner raw mode is unsupported on process.stdin
// so that approach cannot work as written. Restructured to still genuinely
// verify the pass criterion ("menu selection navigates to the correct
// screen") three ways:
//   a) end-to-end: drive the real Ink input pipeline with a fake TTY stdin,
//      press Enter on the first menu item, and assert the App shows the init
//      screen;
//   b) unit: the menu-value -> screen mapping (resolveMenuSelection) is
//      correct for every menu item;
//   c) integration: rendering each target screen directly shows its content.
test('pressing Enter on the first menu item navigates to the init screen', async () => {
  const app = renderCaptured(<App />);
  await tick(); // let Ink mount and enter raw mode
  app.stdin.write('\r'); // Enter on "Create New Wiki"
  await tick();
  app.unmount();
  await tick(50);

  const frame = app.output();
  expect(frame).toContain('Create New Wiki');
  expect(frame).toContain('Press Escape to go back');
});

test('every menu item maps to its screen', () => {
  const expected: Array<[string, Screen]> = [
    ['init', 'init'],
    ['add-pdfs', 'add-pdfs'],
    ['ingest', 'ingest'],
    ['settings', 'settings'],
    ['exit', 'exit'],
  ];
  for (const [value, screen] of expected) {
    expect(resolveMenuSelection(value)).toBe(screen);
  }
  // Phase 11 (phase doc §2.3): exactly five items, in this order.
  expect(MENU_ITEMS.map((item) => item.value)).toEqual(['init', 'add-pdfs', 'ingest', 'settings', 'exit']);
  expect(MENU_ITEMS.map((item) => item.label)).toEqual([
    'Create New Wiki',
    'Add PDFs',
    'Ingest PDFs',
    'Settings',
    'Exit',
  ]);
});

test('each screen renders its expected content', async () => {
  const noop = () => {};

  const init = renderCaptured(<InitScreen onBack={noop} onResult={noop} />);
  await tick();
  init.unmount();
  await tick(50);
  expect(init.output()).toContain('Create New Wiki');
  expect(init.output()).toContain('Press Escape to go back');

  const addPdfs = renderCaptured(<AddPdfsScreen onBack={noop} onResult={noop} />);
  await tick();
  addPdfs.unmount();
  await tick(50);
  expect(addPdfs.output()).toContain('Add PDFs');
  expect(addPdfs.output()).toContain('Press Escape to go back');

  const ingest = renderCaptured(<IngestScreen onBack={noop} onResult={noop} />);
  await tick();
  ingest.unmount();
  await tick(50);
  expect(ingest.output()).toContain('Ingest PDFs');
  expect(ingest.output()).toContain('Up/Down: select wiki');
  expect(ingest.output()).toContain('Enter: run ingest');

  const settings = renderCaptured(<SettingsScreen onBack={noop} onResult={noop} />);
  await tick();
  settings.unmount();
  await tick(50);
  expect(settings.output()).toContain('Settings');
  // Phase 11 (phase doc §2.2): the model routing section is present.
  expect(settings.output()).toContain('LLM Model Routing');
});

// Phase 11 (phase doc §2.4): the welcome splash appears on first launch only
// (neither `.paper-chase.json` nor the legacy `.llm-wiki-cli.json` present).
test('welcome splash shows on first launch and hides once a config file exists', async () => {
  const fresh = makeTempDir('paper-chase-menu-splash-');
  const first = renderCaptured(<MenuScreen onSelect={() => {}} lastResult="" workspace={fresh} />);
  await tick(300); // let the settings-file check resolve
  first.unmount();
  await tick(50);
  expect(first.output()).toContain('Paper Chase v.1.0 — the paper chase, automated.');
  expect(first.output()).toContain('Create a wiki, add PDFs, then ingest.');

  writeFileSync(join(fresh, '.paper-chase.json'), '{"synthesis":true}');
  const returning = renderCaptured(<MenuScreen onSelect={() => {}} lastResult="" workspace={fresh} />);
  await tick(300);
  returning.unmount();
  await tick(50);
  expect(returning.output()).not.toContain('the paper chase, automated.');
});

// Phase 11 (phase doc §2.4): the legacy pre-rebrand config file also
// suppresses the splash (an existing user is not on first launch).
test('welcome splash stays hidden when only the legacy config file exists', async () => {
  const dir = makeTempDir('paper-chase-menu-legacy-');
  writeFileSync(join(dir, '.llm-wiki-cli.json'), '{"synthesis":true}');
  const menu = renderCaptured(<MenuScreen onSelect={() => {}} lastResult="" workspace={dir} />);
  await tick(300);
  menu.unmount();
  await tick(50);
  expect(menu.output()).not.toContain('the paper chase, automated.');
});
