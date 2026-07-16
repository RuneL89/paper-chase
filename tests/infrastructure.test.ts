import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { extractText } from '../src/extraction/pdf';
import { sha256 } from '../src/utils/hash';
import { callLLM } from '../src/llm/client';

const GOLDEN_MASTER = 'test-pdfs/golden-master.pdf';

/**
 * Gate 0.3 reference hash. The spec compares against `shasum -a 256`, which
 * is not reliably executable from the Windows test shell. Strategy: try
 * `shasum -a 256` first; if that fails, fall back to `certutil -hashfile
 * <file> SHA256` (available on every Windows machine); if neither works,
 * fall back to a one-shot node:crypto reference computed independently of
 * the streaming implementation under test.
 */
function referenceSha256(filePath: string): string {
  try {
    return execSync(`shasum -a 256 "${filePath}"`).toString().trim().split(/\s+/)[0].toLowerCase();
  } catch {
    // shasum unavailable; try certutil
  }
  try {
    const out = execSync(`certutil -hashfile "${filePath}" SHA256`).toString();
    const hashLine = out
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, ''))
      .find((line) => /^[a-fA-F0-9]{64}$/.test(line));
    if (hashLine) {
      return hashLine.toLowerCase();
    }
  } catch {
    // certutil unavailable; use node reference below
  }
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

// Gate 0.1: PDF Extraction Works
test('extractText returns all text from golden master', async () => {
  const text = await extractText(GOLDEN_MASTER);
  expect(text).toContain('John Smith'); // known name from page 1
  expect(text).toContain('Acme Corp'); // known company from page 1
  expect(text).toContain('March 15, 2024'); // known date from page 1
  expect(text).toContain('$42.5 million'); // known number from page 2
  expect(text).toContain('Board Members'); // known heading from page 3
});

// Gate 0.2: Page-Range Extraction Works
test('extractText with page range returns only those pages', async () => {
  const text = await extractText(GOLDEN_MASTER, 1, 1);
  expect(text).toContain('John Smith');
  expect(text).not.toContain('Board Members'); // page 3 content
});

// Gate 0.3: SHA-256 Hashing Works
test('sha256 returns correct hash', async () => {
  const hash = await sha256(GOLDEN_MASTER);
  expect(hash).toMatch(/^[a-f0-9]{64}$/);
  const expected = referenceSha256(GOLDEN_MASTER);
  expect(hash).toBe(expected);
});

// Gate 0.4: LLM Client Logs Cost (live call — self-skips without a key;
// run with ANTHROPIC_API_KEY set in the environment to execute it)
test.skipIf(!process.env.ANTHROPIC_API_KEY)('callLLM logs cost and returns response', async () => {
  const consoleSpy = vi.spyOn(console, 'log');
  const response = await callLLM('Say "hello"', 'You are a test assistant.');
  expect(response).toBeTruthy();
  expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('LLM Call'));
  expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cost:'));
  consoleSpy.mockRestore();
});

// Gate 0.5: CLI Commands Exist
test('CLI has init, ingest, and test commands', async () => {
  const { program } = await import('../src/cli');
  expect(program.commands.map((c) => c.name())).toContain('init');
  expect(program.commands.map((c) => c.name())).toContain('ingest');
  expect(program.commands.map((c) => c.name())).toContain('test');
});
