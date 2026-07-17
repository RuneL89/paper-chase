import React from 'react';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, afterEach, expect, test } from 'vitest';
import { render, type Instance } from 'ink';
import { AddPdfsScreen } from '../../src/tui/add-pdfs-screen';
import { addPdfToWiki, cleanPastedPath } from '../../src/commands/add-pdf';
import { sha256 } from '../../src/utils/hash';

// User-directed Phase 1 extension (2026-07-17, compliance log entry
// "2026-07-17 10:20"): TUI "Add PDFs" screen + addPdfToWiki helper.
// Refined 2026-07-17 (entry "2026-07-17 10:55"): the primary add control is
// now the native graphical file picker ("[ Browse for PDFs... ]"); the manual
// path input is the fallback. Screen tests inject the pickFiles stub so no
// real dialog ever spawns; the dialog itself is covered by user UAT.
// Screen tests use temp workspaces via the screen's optional workspace prop
// (same hermetic convention as tests/tui/phase-01-screens.test.tsx).

const GOLDEN_MASTER = 'test-pdfs/golden-master.pdf';
// Known digest of the golden master (gate 1.6); used to prove byte-identical
// copies and that the source file is never modified.
const GOLDEN_SHA256 = '1e4f2cbec74a83bf8ae56f3a45035827ec405bd02989d6b38f08929b80ac339d';

const ESCAPE = String.fromCharCode(27);

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

/** Fake TTY stdin (same harness as tests/tui/menu.test.tsx). */
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

/**
 * Capture Ink output on a fake stdout and assert after unmount (Ink 7
 * non-interactive mode only writes the final frame on unmount). Pass
 * `tty: false` to exercise the non-TTY static fallback.
 */
function renderCaptured(node: React.ReactElement, options: { tty?: boolean } = {}): CapturedRender {
  const stdin = createFakeStdin();
  if (options.tty === false) {
    stdin.isTTY = false;
  }
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

/** Poll a condition (async screen work happens between Ink frames). */
async function waitFor(condition: () => boolean, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor timed out');
    }
    await tick(50);
  }
}

// ---------------------------------------------------------------------------
// Screen tests
// ---------------------------------------------------------------------------

// Screen renders and lists an existing wiki (temp workspace fixture).
test('add-pdfs screen renders and lists an existing wiki', async () => {
  const workspace = makeTempDir('llm-wiki-addpdfs-list-');
  mkdirSync(join(workspace, 'wikis', 'fake-wiki', 'raw'), { recursive: true });

  const screen = renderCaptured(<AddPdfsScreen onBack={() => {}} onResult={() => {}} workspace={workspace} />);
  await tick(400); // let useWikiList / useRawContents load
  screen.unmount();
  await tick(50);

  const frame = screen.output();
  expect(frame).toContain('Add PDFs');
  expect(frame).toContain('fake-wiki');
  expect(frame).toContain('Press Escape to go back');
});

// Screen shows the current contents of the selected wiki's raw/ folder.
test('add-pdfs screen shows current raw/ contents', async () => {
  const workspace = makeTempDir('llm-wiki-addpdfs-contents-');
  mkdirSync(join(workspace, 'wikis', 'fake-wiki', 'raw'), { recursive: true });
  writeFileSync(join(workspace, 'wikis', 'fake-wiki', 'raw', 'already-there.pdf'), 'placeholder');

  const screen = renderCaptured(<AddPdfsScreen onBack={() => {}} onResult={() => {}} workspace={workspace} />);
  await tick(400);
  screen.unmount();
  await tick(50);

  const frame = screen.output();
  expect(frame).toContain('Contents of fake-wiki/raw/');
  expect(frame).toContain('already-there.pdf');
});

// End-to-end: select a wiki, paste a quoted path, Enter copies the PDF.
test('adds a PDF via the interactive select-and-paste flow', async () => {
  const workspace = makeTempDir('llm-wiki-addpdfs-flow-');
  mkdirSync(join(workspace, 'wikis', 'add-me', 'raw'), { recursive: true });

  let result: string | undefined;
  const screen = renderCaptured(
    <AddPdfsScreen onBack={() => {}} onResult={(message) => (result = message)} workspace={workspace} />,
  );
  await tick(400); // let the wiki list load
  screen.stdin.write('\r'); // Enter: choose the highlighted wiki -> path input
  await tick(150);
  // Quoted absolute path, exactly like a Windows drag-drop paste.
  const pasted = `"${resolve(GOLDEN_MASTER).replaceAll('\\', '/')}"`;
  screen.stdin.write(pasted);
  await tick(150);
  screen.stdin.write('\r'); // Enter: copy the PDF into raw/
  await waitFor(() => result !== undefined);
  screen.unmount();
  await tick(50);

  expect(result).toBe('Added golden-master.pdf to add-me/raw/');
  const dest = join(workspace, 'wikis', 'add-me', 'raw', 'golden-master.pdf');
  expect(existsSync(dest)).toBe(true);
  expect(await sha256(dest)).toBe(GOLDEN_SHA256);

  const frame = screen.output();
  expect(frame).toContain('Added golden-master.pdf to add-me/raw/');
  // Input cleared after a successful add: the pasted path is no longer shown.
  expect(frame).not.toContain(pasted);
  // raw/ contents refreshed live after the add.
  expect(frame).toContain('golden-master.pdf');
}, 30000);

// A bad path shows the ErrorBox and copies nothing.
test('shows an error for a missing file and copies nothing', async () => {
  const workspace = makeTempDir('llm-wiki-addpdfs-error-');
  mkdirSync(join(workspace, 'wikis', 'add-me', 'raw'), { recursive: true });

  const screen = renderCaptured(<AddPdfsScreen onBack={() => {}} onResult={() => {}} workspace={workspace} />);
  await tick(400);
  screen.stdin.write('\r'); // choose the wiki
  await tick(150);
  screen.stdin.write(join(workspace, 'does-not-exist.pdf').replaceAll('\\', '/'));
  await tick(150);
  screen.stdin.write('\r');
  await tick(500); // let the failed add settle (non-interactive Ink flushes on unmount)
  screen.unmount();
  await tick(50);

  const frame = screen.output();
  expect(frame).toContain('Error');
  expect(frame).toContain('File not found');
  expect(existsSync(join(workspace, 'wikis', 'add-me', 'raw', 'does-not-exist.pdf'))).toBe(false);
});

// Escape contract: Escape in the path input returns to the wiki selector;
// Escape in the selector goes back to the menu.
test('escape leaves the path input for the selector, then goes back', async () => {
  const workspace = makeTempDir('llm-wiki-addpdfs-escape-');
  mkdirSync(join(workspace, 'wikis', 'pick-me', 'raw'), { recursive: true });

  let backCount = 0;
  const screen = renderCaptured(
    <AddPdfsScreen
      onBack={() => {
          backCount += 1;
        }}
      onResult={() => {}}
      workspace={workspace}
    />,
  );
  await tick(400);
  screen.stdin.write('\r'); // -> path input mode
  await tick(150);
  screen.stdin.write(ESCAPE); // -> back to the wiki selector
  await tick(150);
  expect(backCount).toBe(0);
  screen.stdin.write(ESCAPE); // -> back to the menu
  await waitFor(() => backCount === 1);
  screen.unmount();
  await tick(50);
  expect(backCount).toBe(1);
});

// Non-TTY contract (src/AGENTS.md): static fallback, no crash, info visible.
test('add-pdfs screen renders a static fallback without a TTY', async () => {
  const workspace = makeTempDir('llm-wiki-addpdfs-notty-');
  mkdirSync(join(workspace, 'wikis', 'static-wiki', 'raw'), { recursive: true });
  writeFileSync(join(workspace, 'wikis', 'static-wiki', 'raw', 'doc.pdf'), 'placeholder');

  const screen = renderCaptured(<AddPdfsScreen onBack={() => {}} onResult={() => {}} workspace={workspace} />, {
    tty: false,
  });
  await tick(400);
  screen.unmount();
  await tick(50);

  const frame = screen.output();
  expect(frame).toContain('Add PDFs');
  expect(frame).toContain('static-wiki');
  expect(frame).toContain('doc.pdf');
  // Both add controls are visible in the static fallback.
  expect(frame).toContain('Browse for PDFs');
  expect(frame).toContain('Fallback: enter path manually');
  expect(frame).toContain('require a TTY');
});

// ---------------------------------------------------------------------------
// Native-picker redesign tests (2026-07-17 10:55): the pickFiles prop is a
// stub — tests never spawn the real OpenFileDialog.
// ---------------------------------------------------------------------------

// After choosing a wiki, the Browse button renders as the primary,
// default-focused control, with the manual path input demoted below it.
test('browse button is the primary control; manual input is the fallback', async () => {
  const workspace = makeTempDir('llm-wiki-addpdfs-browse-ui-');
  mkdirSync(join(workspace, 'wikis', 'add-me', 'raw'), { recursive: true });

  const screen = renderCaptured(<AddPdfsScreen onBack={() => {}} onResult={() => {}} workspace={workspace} />);
  await tick(400);
  screen.stdin.write('\r'); // choose the wiki -> add mode
  await tick(200);
  screen.unmount();
  await tick(50);

  const frame = screen.output();
  // Primary control, highlighted by default (the '> ' focus marker).
  expect(frame).toContain('> [ Browse for PDFs... ]');
  // Fallback row still present below it.
  expect(frame).toContain('Fallback: enter path manually');
  expect(frame).toContain('PDF path:');
});

// End-to-end browse flow: Enter on the Browse button "opens the picker"
// (stubbed), every picked file is copied into raw/, SuccessBox summarizes.
test('browse flow adds every picked PDF and summarizes the batch', async () => {
  const workspace = makeTempDir('llm-wiki-addpdfs-browse-');
  mkdirSync(join(workspace, 'wikis', 'add-me', 'raw'), { recursive: true });
  const sourceDir = join(workspace, 'picked');
  mkdirSync(sourceDir, { recursive: true });
  copyFileSync(GOLDEN_MASTER, join(sourceDir, 'first doc.pdf'));
  copyFileSync(GOLDEN_MASTER, join(sourceDir, 'second.pdf'));

  let result: string | undefined;
  const screen = renderCaptured(
    <AddPdfsScreen
      onBack={() => {}}
      onResult={(message) => (result = message)}
      workspace={workspace}
      pickFiles={async () => [join(sourceDir, 'first doc.pdf'), join(sourceDir, 'second.pdf')]}
    />,
  );
  await tick(400);
  screen.stdin.write('\r'); // choose the wiki -> add mode (Browse focused)
  await tick(200);
  screen.stdin.write('\r'); // Enter on Browse -> picker
  await waitFor(() => result !== undefined);
  screen.unmount();
  await tick(50);

  expect(result).toBe('Added 2 file(s) to add-me/raw/: first doc.pdf, second.pdf');
  for (const name of ['first doc.pdf', 'second.pdf']) {
    const dest = join(workspace, 'wikis', 'add-me', 'raw', name);
    expect(existsSync(dest)).toBe(true);
    expect(await sha256(dest)).toBe(GOLDEN_SHA256);
  }
  const frame = screen.output();
  expect(frame).toContain('Added 2 file(s) to add-me/raw/');
  // raw/ contents refreshed after the batch add.
  expect(frame).toContain('second.pdf');
}, 30000);

// Cancelling the dialog is neutral: "No files selected.", no ErrorBox.
test('cancelling the picker shows a neutral message, not an error', async () => {
  const workspace = makeTempDir('llm-wiki-addpdfs-cancel-');
  mkdirSync(join(workspace, 'wikis', 'add-me', 'raw'), { recursive: true });

  let settled = false;
  const screen = renderCaptured(
    <AddPdfsScreen
      onBack={() => {}}
      onResult={() => {}}
      workspace={workspace}
      pickFiles={async () => {
          settled = true;
          return null;
        }}
    />,
  );
  await tick(400);
  screen.stdin.write('\r'); // choose the wiki
  await tick(200);
  screen.stdin.write('\r'); // Enter on Browse
  await waitFor(() => settled);
  await tick(200);
  screen.unmount();
  await tick(50);

  const frame = screen.output();
  expect(frame).toContain('No files selected.');
  expect(frame).not.toContain('Error');
});

// A dialog failure explains what happened and points at the manual fallback.
test('a picker failure shows an error pointing at manual entry', async () => {
  const workspace = makeTempDir('llm-wiki-addpdfs-pickerfail-');
  mkdirSync(join(workspace, 'wikis', 'add-me', 'raw'), { recursive: true });

  let settled = false;
  const screen = renderCaptured(
    <AddPdfsScreen
      onBack={() => {}}
      onResult={() => {}}
      workspace={workspace}
      pickFiles={async () => {
          settled = true;
          throw new Error('powershell.exe not found');
        }}
    />,
  );
  await tick(400);
  screen.stdin.write('\r'); // choose the wiki
  await tick(200);
  screen.stdin.write('\r'); // Enter on Browse
  await waitFor(() => settled);
  await tick(200);
  screen.unmount();
  await tick(50);

  const frame = screen.output();
  expect(frame).toContain('Error');
  expect(frame).toContain('file picker could not be opened');
  expect(frame).toContain('powershell.exe not found');
  expect(frame).toContain('manual path entry');
});

// Per-file failures land in the ErrorBox while successes still count.
test('mixed browse results: successes count, failures are reported', async () => {
  const workspace = makeTempDir('llm-wiki-addpdfs-mixed-');
  mkdirSync(join(workspace, 'wikis', 'add-me', 'raw'), { recursive: true });
  const good = join(workspace, 'good.pdf');
  copyFileSync(GOLDEN_MASTER, good);
  const missing = join(workspace, 'missing.pdf');

  let result: string | undefined;
  const screen = renderCaptured(
    <AddPdfsScreen
      onBack={() => {}}
      onResult={(message) => (result = message)}
      workspace={workspace}
      pickFiles={async () => [good, missing]}
    />,
  );
  await tick(400);
  screen.stdin.write('\r'); // choose the wiki
  await tick(200);
  screen.stdin.write('\r'); // Enter on Browse
  await waitFor(() => result !== undefined);
  await tick(200);
  screen.unmount();
  await tick(50);

  expect(result).toBe('Added 1 file(s) to add-me/raw/: good.pdf');
  expect(existsSync(join(workspace, 'wikis', 'add-me', 'raw', 'good.pdf'))).toBe(true);
  expect(existsSync(join(workspace, 'wikis', 'add-me', 'raw', 'missing.pdf'))).toBe(false);
  const frame = screen.output();
  expect(frame).toContain('Added 1 file(s) to add-me/raw/: good.pdf');
  expect(frame).toContain('Error');
  expect(frame).toContain('Could not add 1 file(s)');
  expect(frame).toContain('File not found');
});

// ---------------------------------------------------------------------------
// addPdfToWiki helper unit tests
// ---------------------------------------------------------------------------

// Copies a real PDF into a wiki raw/ (created when missing), byte-identical,
// without modifying the source.
test('helper copies a real PDF into raw/ and preserves bytes', async () => {
  const workspace = makeTempDir('llm-wiki-addpdf-copy-');
  const dir = join(workspace, 'wikis', 'unit-wiki');
  mkdirSync(dir, { recursive: true }); // note: no raw/ yet

  const result = await addPdfToWiki(dir, GOLDEN_MASTER);

  expect(result.fileName).toBe('golden-master.pdf');
  expect(result.destPath).toBe(join(dir, 'raw', 'golden-master.pdf'));
  expect(existsSync(result.destPath)).toBe(true);
  expect(await sha256(result.destPath)).toBe(GOLDEN_SHA256);
  // The golden master must never be modified.
  expect(await sha256(GOLDEN_MASTER)).toBe(GOLDEN_SHA256);
});

// Strips surrounding double quotes, single quotes, and whitespace.
test('helper strips surrounding quotes and whitespace', async () => {
  const workspace = makeTempDir('llm-wiki-addpdf-quotes-');
  const dir = join(workspace, 'wikis', 'unit-wiki');
  mkdirSync(dir, { recursive: true });
  const absolute = resolve(GOLDEN_MASTER);

  expect(cleanPastedPath(`  "${absolute}"  `)).toBe(absolute);
  expect(cleanPastedPath(`'${absolute}'`)).toBe(absolute);
  expect(cleanPastedPath(`  ${absolute} `)).toBe(absolute);

  const doubleQuoted = await addPdfToWiki(dir, `"${absolute}"`);
  expect(doubleQuoted.fileName).toBe('golden-master.pdf');
  expect(existsSync(doubleQuoted.destPath)).toBe(true);

  const singleQuoted = await addPdfToWiki(dir, `  '${absolute}' `);
  expect(existsSync(singleQuoted.destPath)).toBe(true);
});

// Rejects a missing file with a descriptive error.
test('helper rejects a missing file', async () => {
  const workspace = makeTempDir('llm-wiki-addpdf-missing-');
  const dir = join(workspace, 'wikis', 'unit-wiki');
  mkdirSync(dir, { recursive: true });

  await expect(addPdfToWiki(dir, join(workspace, 'nope.pdf'))).rejects.toThrow(/not found/i);
  await expect(addPdfToWiki(dir, '   ')).rejects.toThrow(/no file path/i);
});

// Rejects a non-PDF file with a clear message.
test('helper rejects a non-PDF file', async () => {
  const workspace = makeTempDir('llm-wiki-addpdf-notpdf-');
  const dir = join(workspace, 'wikis', 'unit-wiki');
  mkdirSync(dir, { recursive: true });
  const txtFile = join(workspace, 'notes.txt');
  writeFileSync(txtFile, 'not a pdf');

  await expect(addPdfToWiki(dir, txtFile)).rejects.toThrow(/not a pdf/i);
  expect(existsSync(join(dir, 'raw', 'notes.txt'))).toBe(false);
});

// Paths with spaces work; the destination file name stays as-is.
test('helper accepts paths with spaces and keeps the file name', async () => {
  const workspace = makeTempDir('llm-wiki-addpdf-spaces-');
  const dir = join(workspace, 'wikis', 'unit-wiki');
  mkdirSync(dir, { recursive: true });
  const spacedDir = join(workspace, 'folder with spaces');
  mkdirSync(spacedDir, { recursive: true });
  const spacedSource = join(spacedDir, 'my report.pdf');
  copyFileSync(GOLDEN_MASTER, spacedSource);

  const result = await addPdfToWiki(dir, `"${spacedSource}"`);

  expect(result.fileName).toBe('my report.pdf');
  const dest = join(dir, 'raw', 'my report.pdf');
  expect(existsSync(dest)).toBe(true);
  expect(await sha256(dest)).toBe(GOLDEN_SHA256);
});
