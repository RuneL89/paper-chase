import { expect, test } from 'vitest';
import { parseSelectedPath } from '../src/utils/folder-dialog';

// User-directed extension (2026-08-24, extending the 2026-07-17 native-picker
// preference to the Create New Wiki screen): native graphical folder picker.
// These tests cover the pure stdout parser only — pickFolder itself spawns
// the real Windows FolderBrowserDialog and is exercised by user UAT, never by
// automated tests (tests/AGENTS.md: tests must be hermetic).

// A confirmed selection prints exactly one line: the folder path.
test('parseSelectedPath parses a single path', () => {
  expect(parseSelectedPath('C:\\Users\\atavi\\Projects\\Wiki v5\r\n')).toBe('C:\\Users\\atavi\\Projects\\Wiki v5');
});

// Windows line endings (\r\n) must not leak \r into the path.
test('parseSelectedPath strips Windows carriage returns', () => {
  expect(parseSelectedPath('C:\\My Work\\wiki stuff\r\n')).toBe('C:\\My Work\\wiki stuff');
});

// Unix-style newlines are tolerated too (defensive parsing).
test('parseSelectedPath tolerates plain LF newlines', () => {
  expect(parseSelectedPath('D:\\wikis\n')).toBe('D:\\wikis');
});

// Cancel prints nothing: empty output yields null.
test('parseSelectedPath maps empty output to null', () => {
  expect(parseSelectedPath('')).toBeNull();
  expect(parseSelectedPath('\r\n')).toBeNull();
  expect(parseSelectedPath('   \r\n  ')).toBeNull();
});

// Paths with spaces survive (the path is printed whole, one line).
test('parseSelectedPath keeps paths with spaces intact', () => {
  expect(parseSelectedPath('C:\\My Documents\\Wiki v5\r\n')).toBe('C:\\My Documents\\Wiki v5');
});

// Blank lines around the selection are skipped; the first non-empty line is
// the selection.
test('parseSelectedPath skips blank lines and takes the first non-empty entry', () => {
  expect(parseSelectedPath('\r\nC:\\wf\r\n\r\n')).toBe('C:\\wf');
});
