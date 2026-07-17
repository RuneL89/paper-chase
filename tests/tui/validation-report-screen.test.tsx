import React from 'react';
import { PassThrough } from 'node:stream';
import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'ink';
import { ValidationReportScreen } from '../../src/tui/validation-report-screen';
import type { ValidationSummary } from '../../src/validation';

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
  };
}

const tick = (ms = 150) => new Promise<void>((resolvePromise) => setTimeout(resolvePromise, ms));

const okSummary: ValidationSummary = {
  wikiSlug: 'test-wiki',
  links: { broken: [], orphaned: [], totalLinks: 3, totalPages: 2 },
  citations: { invalid: [], missingSource: [], totalCitations: 1 },
  schema: { invalid: [], totalPages: 2 },
};

const badSummary: ValidationSummary = {
  wikiSlug: 'test-wiki',
  links: {
    broken: [{ page: 'entities/a.md', link: 'Missing Page' }],
    orphaned: ['entities/orphan.md'],
    totalLinks: 1,
    totalPages: 2,
  },
  citations: { invalid: [], missingSource: [], totalCitations: 0 },
  schema: { invalid: [], totalPages: 2 },
};

test('validation report screen renders without crashing', async () => {
  const screen = renderCaptured(
    <ValidationReportScreen
      onBack={() => {}}
      onResult={() => {}}
      validateFn={() => Promise.resolve(okSummary)}
    />,
  );
  await tick();
  screen.unmount();
  await tick(50);
  expect(screen.output()).toContain('Validation Report');
});

test('validation report auto-runs for the provided wiki', async () => {
  const validateFn = vi.fn().mockResolvedValue(okSummary);
  const screen = renderCaptured(
    <ValidationReportScreen
      onBack={() => {}}
      onResult={() => {}}
      wiki="test-wiki"
      validateFn={validateFn}
    />,
  );
  await tick(300);
  screen.unmount();
  await tick(50);
  expect(validateFn).toHaveBeenCalledWith('test-wiki', '.');
  expect(screen.output()).toContain('Link check:');
  expect(screen.output()).toContain('Citation check:');
  expect(screen.output()).toContain('Schema check:');
  expect(screen.output()).toContain('✓');
});

test('validation report shows failures with red X and details', async () => {
  const validateFn = vi.fn().mockResolvedValue(badSummary);
  const screen = renderCaptured(
    <ValidationReportScreen
      onBack={() => {}}
      onResult={() => {}}
      wiki="test-wiki"
      validateFn={validateFn}
    />,
  );
  await tick(300);
  screen.unmount();
  await tick(50);
  expect(screen.output()).toContain('✗');
  expect(screen.output()).toContain('Missing Page');
  expect(screen.output()).toContain('entities/orphan.md');
});

test('validation report shows error state', async () => {
  const validateFn = vi.fn().mockRejectedValue(new Error('disk read failed'));
  const screen = renderCaptured(
    <ValidationReportScreen
      onBack={() => {}}
      onResult={() => {}}
      wiki="test-wiki"
      validateFn={validateFn}
    />,
  );
  await tick(300);
  screen.unmount();
  await tick(50);
  expect(screen.output()).toContain('disk read failed');
});

test('validation report renders selector when no wiki is provided', async () => {
  const validateFn = vi.fn().mockResolvedValue(okSummary);
  const screen = renderCaptured(
    <ValidationReportScreen
      onBack={() => {}}
      onResult={() => {}}
      validateFn={validateFn}
    />,
  );
  await tick(300);
  screen.unmount();
  await tick(50);
  expect(screen.output()).toContain('Select Wiki');
});

test('validation report escapes back to the menu', async () => {
  let escaped = false;
  const screen = renderCaptured(
    <ValidationReportScreen
      onBack={() => {
        escaped = true;
      }}
      onResult={() => {}}
      wiki="test-wiki"
      validateFn={() => Promise.resolve(okSummary)}
    />,
  );
  await tick(300);
  screen.stdin.write('\u001b'); // Escape
  await tick();
  screen.unmount();
  expect(escaped).toBe(true);
});
