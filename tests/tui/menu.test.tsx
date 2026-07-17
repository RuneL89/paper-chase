import React from 'react';
import { PassThrough } from 'node:stream';
import { afterEach, expect, test } from 'vitest';
import { render, type Instance } from 'ink';
import { App, type Screen } from '../../src/tui/app';
import { MENU_ITEMS, MenuScreen, resolveMenuSelection } from '../../src/tui/menu';
import { InitScreen } from '../../src/tui/init-screen';
import { IngestScreen } from '../../src/tui/ingest-screen';
import { AddPdfsScreen } from '../../src/tui/add-pdfs-screen';
import { ExtractorTestScreen } from '../../src/tui/extractor-test-screen';
import { TestScreen } from '../../src/tui/test-screen';
import { SettingsScreen } from '../../src/tui/settings-screen';
import { EntityBrowser } from '../../src/tui/entity-browser';
import { TopicBrowser } from '../../src/tui/topic-browser';

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
// UPDATED 2026-07-17 (user-directed extension): the menu now has 6 items —
// 'Add PDFs (copy into raw/)' was added after 'Ingest PDFs (ingest)' per the
// user's request to copy files into raw/ entirely from the TUI (compliance
// log entry "2026-07-17 10:20"). The original 5-option assertion is
// superseded; the deviation is recorded in .state/phase-1-status.json.
// UPDATED 2026-07-17 (Phase 2, phase doc §5.2 + compliance log 2026-07-17
// 12:00 noted adaptation 7): 'Test Extractor' was inserted immediately after
// 'Ingest PDFs (ingest)' — the menu now has 7 items.
test('TUI menu shows all options', async () => {
  const menu = renderCaptured(<MenuScreen onSelect={() => {}} lastResult="" />);
  await tick();
  menu.unmount(); // non-interactive Ink writes the final frame on unmount
  await tick(50);
  const frame = menu.output();
  expect(frame).toContain('Create New Wiki');
  expect(frame).toContain('Ingest PDFs');
  expect(frame).toContain('Test Extractor');
  expect(frame).toContain('Add PDFs');
  expect(frame).toContain('Browse Entities');
  expect(frame).toContain('Browse Topics');
  expect(frame).toContain('Run Tests');
  expect(frame).toContain('Settings');
  expect(frame).toContain('Exit');
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
  app.stdin.write('\r'); // Enter on "Create New Wiki (init)"
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
    ['ingest', 'ingest'],
    ['extractor-test', 'extractor-test'],
    ['add-pdfs', 'add-pdfs'],
    ['entity-browser', 'entity-browser'],
    ['topic-browser', 'topic-browser'],
    ['test', 'test'],
    ['settings', 'settings'],
    ['exit', 'exit'],
  ];
  for (const [value, screen] of expected) {
    expect(resolveMenuSelection(value)).toBe(screen);
  }
  // 9 items: 7 from Phase 2 + Phase 3 browse screens.
  expect(MENU_ITEMS.map((item) => item.value)).toEqual([
    'init',
    'ingest',
    'extractor-test',
    'add-pdfs',
    'entity-browser',
    'topic-browser',
    'test',
    'settings',
    'exit',
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

  const ingest = renderCaptured(<IngestScreen onBack={noop} onResult={noop} />);
  await tick();
  ingest.unmount();
  await tick(50);
  expect(ingest.output()).toContain('Ingest PDFs');
  expect(ingest.output()).toContain('Press Escape to go back');

  const addPdfs = renderCaptured(<AddPdfsScreen onBack={noop} onResult={noop} />);
  await tick();
  addPdfs.unmount();
  await tick(50);
  expect(addPdfs.output()).toContain('Add PDFs');
  expect(addPdfs.output()).toContain('Press Escape to go back');

  const extractorTest = renderCaptured(<ExtractorTestScreen onBack={noop} onResult={noop} />);
  await tick();
  extractorTest.unmount();
  await tick(50);
  expect(extractorTest.output()).toContain('Test Extractor');
  expect(extractorTest.output()).toContain('Press Escape to go back');

  const entityBrowser = renderCaptured(<EntityBrowser onBack={noop} />);
  await tick(400);
  entityBrowser.unmount();
  await tick(50);
  expect(entityBrowser.output()).toContain('Browse Entities');
  expect(entityBrowser.output()).toContain('Escape: back');

  const topicBrowser = renderCaptured(<TopicBrowser onBack={noop} />);
  await tick(400);
  topicBrowser.unmount();
  await tick(50);
  expect(topicBrowser.output()).toContain('Browse Topics');
  expect(topicBrowser.output()).toContain('Escape: back');

  // autoRun=false so this does not spawn `npm test` inside the test runner
  const testScreen = renderCaptured(<TestScreen onBack={noop} onResult={noop} autoRun={false} />);
  await tick();
  testScreen.unmount();
  await tick(50);
  expect(testScreen.output()).toContain('Run Tests');
  expect(testScreen.output()).toContain('Press Escape to go back');

  const settings = renderCaptured(<SettingsScreen onBack={noop} onResult={noop} />);
  await tick();
  settings.unmount();
  await tick(50);
  expect(settings.output()).toContain('Settings');
  expect(settings.output()).toContain('Press Escape to go back');
});
