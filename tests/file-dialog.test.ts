import { expect, test } from 'vitest';
import { parseDialogOutput } from '../src/utils/file-dialog';

// User-directed Phase 1 refinement (2026-07-17, compliance log entry
// "2026-07-17 10:55"): native graphical file picker. These tests cover the
// pure stdout parser only — pickPdfFiles itself spawns the real Windows
// OpenFileDialog and is exercised by user UAT, never by automated tests
// (tests/AGENTS.md: tests must be hermetic).

// A single selected file: one line, one path.
test('parseDialogOutput parses a single path', () => {
  expect(parseDialogOutput('C:\\docs\\report.pdf\r\n')).toEqual(['C:\\docs\\report.pdf']);
});

// Multi-select prints one file name per line.
test('parseDialogOutput parses multiple paths', () => {
  const stdout = 'C:\\docs\\a.pdf\r\nC:\\docs\\b.pdf\r\nD:\\elsewhere\\c.pdf\r\n';
  expect(parseDialogOutput(stdout)).toEqual(['C:\\docs\\a.pdf', 'C:\\docs\\b.pdf', 'D:\\elsewhere\\c.pdf']);
});

// Windows line endings (\r\n) must not leak \r into the paths.
test('parseDialogOutput strips Windows carriage returns', () => {
  const paths = parseDialogOutput('C:\\a.pdf\r\nC:\\b.pdf\r\n');
  for (const path of paths) {
    expect(path).not.toContain('\r');
  }
});

// Unix-style newlines are tolerated too (defensive parsing).
test('parseDialogOutput tolerates plain LF newlines', () => {
  expect(parseDialogOutput('C:\\a.pdf\nC:\\b.pdf\n')).toEqual(['C:\\a.pdf', 'C:\\b.pdf']);
});

// Cancel prints nothing: empty output yields an empty array.
test('parseDialogOutput maps empty output to an empty array', () => {
  expect(parseDialogOutput('')).toEqual([]);
  expect(parseDialogOutput('\r\n')).toEqual([]);
  expect(parseDialogOutput('   \r\n  ')).toEqual([]);
});

// Paths with spaces survive (file names are printed whole, one per line).
test('parseDialogOutput keeps paths with spaces intact', () => {
  const stdout = 'C:\\My Documents\\my report.pdf\r\nD:\\folder with spaces\\final v2.pdf\r\n';
  expect(parseDialogOutput(stdout)).toEqual([
    'C:\\My Documents\\my report.pdf',
    'D:\\folder with spaces\\final v2.pdf',
  ]);
});

// Blank lines between entries are skipped rather than producing empty paths.
test('parseDialogOutput skips blank lines between entries', () => {
  expect(parseDialogOutput('C:\\a.pdf\r\n\r\nC:\\b.pdf\r\n')).toEqual(['C:\\a.pdf', 'C:\\b.pdf']);
});
