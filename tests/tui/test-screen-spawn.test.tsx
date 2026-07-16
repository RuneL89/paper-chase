import React from 'react';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'ink';

/**
 * UAT 0.2 regression test (traces UAT 0.2: "Run the test suite via TUI").
 *
 * The first UAT 0.2 run crashed with `spawn EINVAL`: on Windows `npm`
 * resolves to `npm.cmd`, and Node >= 20.12.2 refuses to spawn .cmd/.bat
 * files without `shell: true` (CVE-2024-27980 mitigation). This test proves
 * the TestScreen always spawns the test run through a shell. Isolated in its
 * own file so the node:child_process mock cannot leak into other suites.
 */

const spawnMock = vi.fn();

vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => {
    spawnMock(...args);
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough;
      stderr: PassThrough;
      kill: () => void;
    };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {};
    setImmediate(() => child.emit('close', 0));
    return child;
  },
}));

import { TestScreen } from '../../src/tui/test-screen';

type FakeStdin = PassThrough & {
  isTTY: boolean;
  setRawMode: (mode: boolean) => void;
  ref: () => FakeStdin;
  unref: () => FakeStdin;
};

function createFakeStdin(): FakeStdin {
  const stdin = new PassThrough() as FakeStdin;
  stdin.isTTY = true;
  stdin.setRawMode = () => {};
  stdin.ref = () => stdin;
  stdin.unref = () => stdin;
  return stdin;
}

afterEach(() => {
  spawnMock.mockClear();
});

test('TestScreen spawns npm test through a shell (UAT 0.2 regression)', async () => {
  const stdin = createFakeStdin();
  const { unmount } = render(<TestScreen onBack={() => {}} onResult={() => {}} />, {
    stdin: stdin as unknown as NodeJS.ReadStream,
  });

  // Give useEffect a chance to fire the spawn, then let the fake child close.
  await new Promise((resolve) => setTimeout(resolve, 150));
  unmount();

  expect(spawnMock).toHaveBeenCalledTimes(1);
  expect(spawnMock).toHaveBeenCalledWith(
    expect.stringMatching(/^npm(\.cmd)?$/),
    ['test'],
    expect.objectContaining({ shell: true }),
  );
});
