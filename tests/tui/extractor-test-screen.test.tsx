import React from 'react';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, afterEach, expect, test } from 'vitest';
import { render, type Instance } from 'ink';
import { ExtractorTestScreen } from '../../src/tui/extractor-test-screen';
import { ExtractorError } from '../../src/agents/extractor';
import type { ChunkExtraction } from '../../src/commands/extract-chunk';

/**
 * Phase 2 §5.1 TUI tests for the Test Extractor screen.
 *
 * The screen's extractChunkFn prop is ALWAYS a stub here (same pattern as the
 * add-pdfs screen's injectable pickFiles): these tests never make a real LLM
 * call. Hermetic temp workspaces per tests/AGENTS.md.
 */

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

/** Wiki fixture with one document-page chunk in documents/. */
function makeWikiWithChunk(workspace: string, wiki: string, chunkId = 'golden-master-part-001'): void {
  mkdirSync(join(workspace, 'wikis', wiki, 'documents'), { recursive: true });
  writeFileSync(
    join(workspace, 'wikis', wiki, 'documents', `${chunkId}.md`),
    `---\ntitle: ${chunkId}\ntype: document\n---\n\n## Extracted Text: Pages 1-3\n\nJohn Smith presented the annual results of Acme Corp.\n`,
  );
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

/** Capture Ink output on a fake stdout and assert after unmount (Ink 7). */
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

/** Stub extraction result: 2 entities, 1 relationship, 1 claim. */
function stubExtraction(chunkId: string): ChunkExtraction {
  return {
    chunkId,
    jsonPath: join('stub', '.state', 'extracted', `${chunkId}.json`),
    jsonRelativePath: `.state/extracted/${chunkId}.json`,
    result: {
      entities: [
        {
          name: 'John Smith',
          type: 'person',
          slug: 'john-smith',
          folder: 'entities/people/executives',
          significance: 'CEO presenting the annual results.',
          mentions: [{ page: 1, context: 'John Smith presented the annual results' }],
        },
        {
          name: 'Acme Corp',
          type: 'company',
          slug: 'acme-corp',
          folder: 'entities/companies',
          significance: 'The company whose results are presented.',
          mentions: [{ page: 1, context: 'annual results of Acme Corp' }],
        },
      ],
      relationships: [
        { subject: 'john-smith', predicate: 'is-ceo-of', object: 'acme-corp', evidence: 'John Smith is the CEO of Acme Corp', page: 3 },
      ],
      claims: [{ text: 'Total revenue reached $42.5 million [^src1]', type: 'financial', entities: ['acme-corp'], page: 2 }],
      timeline: [{ date: 'March 15, 2024', event: 'Annual results presented', entities: ['john-smith', 'acme-corp'] }],
      context: 'This chunk presents the annual results of Acme Corp delivered by CEO John Smith.',
    },
  };
}

// §5.1: screen renders and lists wikis (temp workspace fixture).
test('extractor-test screen renders and lists an existing wiki', async () => {
  const workspace = makeTempDir('llm-wiki-extractortest-list-');
  makeWikiWithChunk(workspace, 'test-wiki');

  const screen = renderCaptured(<ExtractorTestScreen onBack={() => {}} onResult={() => {}} workspace={workspace} />);
  await tick(400); // let useWikiList load
  screen.unmount();
  await tick(50);

  const frame = screen.output();
  expect(frame).toContain('Test Extractor');
  expect(frame).toContain('Select Wiki');
  expect(frame).toContain('test-wiki');
  expect(frame).toContain('Press Escape to go back');
});

// §5.1 + noted adaptation 6: chunks are listed from documents/.
test('extractor-test screen lists chunks from documents/', async () => {
  const workspace = makeTempDir('llm-wiki-extractortest-chunks-');
  makeWikiWithChunk(workspace, 'test-wiki');

  const screen = renderCaptured(<ExtractorTestScreen onBack={() => {}} onResult={() => {}} workspace={workspace} />);
  await tick(400);
  screen.stdin.write('\r'); // Enter: choose the wiki -> chunk list
  await tick(400); // let useDocumentChunks load
  screen.unmount();
  await tick(50);

  const frame = screen.output();
  expect(frame).toContain('Select Chunk');
  expect(frame).toContain('golden-master-part-001');
});

// §5.1: full flow — select wiki, select chunk, Run Extraction, results panel.
test('runs extraction via the stub and shows the results panel', async () => {
  const workspace = makeTempDir('llm-wiki-extractortest-run-');
  makeWikiWithChunk(workspace, 'test-wiki');

  let result: string | undefined;
  const screen = renderCaptured(
    <ExtractorTestScreen
      onBack={() => {}}
      onResult={(message) => (result = message)}
      workspace={workspace}
      extractChunkFn={async (_wikiDir, chunkId) => stubExtraction(chunkId)}
    />,
  );
  await tick(400);
  screen.stdin.write('\r'); // choose wiki
  await tick(400);
  screen.stdin.write('\r'); // choose chunk -> action panel ([ Run Extraction ] focused)
  await tick(150);
  screen.stdin.write('\r'); // Run Extraction
  await waitFor(() => result !== undefined);
  await tick(150);
  screen.unmount();
  await tick(50);

  expect(result).toBe('Extracted 2 entities, 1 relationships, 1 claims from chunk golden-master-part-001.');
  const frame = screen.output();
  expect(frame).toContain('Extraction Results');
  expect(frame).toContain('Entities: 2');
  expect(frame).toContain('- John Smith (person)');
  expect(frame).toContain('- Acme Corp (company)');
  expect(frame).toContain('Relationships: 1');
  expect(frame).toContain('Claims: 1');
  expect(frame).toContain('JSON saved to .state/extracted/golden-master-part-001.json');
  expect(frame).toContain('[ View JSON ]');
  expect(frame).toContain('[ Back ]');
}, 30000);

// §5.1: "View JSON" opens the scrollable JSON viewer. Non-interactive Ink
// only writes the final frame on unmount, so the test unmounts while the
// viewer is open.
test('view JSON opens the JSON viewer', async () => {
  const workspace = makeTempDir('llm-wiki-extractortest-json-');
  makeWikiWithChunk(workspace, 'test-wiki');

  let result: string | undefined;
  const screen = renderCaptured(
    <ExtractorTestScreen
      onBack={() => {}}
      onResult={(message) => (result = message)}
      workspace={workspace}
      extractChunkFn={async (_wikiDir, chunkId) => stubExtraction(chunkId)}
    />,
  );
  await tick(400);
  screen.stdin.write('\r'); // choose wiki
  await tick(400);
  screen.stdin.write('\r'); // choose chunk
  await tick(150);
  screen.stdin.write('\r'); // Run Extraction
  await waitFor(() => result !== undefined);
  await tick(150);
  screen.stdin.write('\r'); // [ View JSON ] is focused by default -> viewer
  await tick(200);
  screen.unmount(); // final frame = the open viewer
  await tick(50);

  const frame = screen.output();
  expect(frame).toContain('JSON viewer');
  expect(frame).toContain('"entities"');
  expect(frame).toContain('"john-smith"');
});

// Escape contract from the viewer: the final frame is the results panel
// again (its [ View JSON ] [ Back ] buttons), not the viewer.
test('escape from the JSON viewer returns to the results panel', async () => {
  const workspace = makeTempDir('llm-wiki-extractortest-jsonesc-');
  makeWikiWithChunk(workspace, 'test-wiki');

  let result: string | undefined;
  const screen = renderCaptured(
    <ExtractorTestScreen
      onBack={() => {}}
      onResult={(message) => (result = message)}
      workspace={workspace}
      extractChunkFn={async (_wikiDir, chunkId) => stubExtraction(chunkId)}
    />,
  );
  await tick(400);
  screen.stdin.write('\r'); // choose wiki
  await tick(400);
  screen.stdin.write('\r'); // choose chunk
  await tick(150);
  screen.stdin.write('\r'); // Run Extraction
  await waitFor(() => result !== undefined);
  await tick(150);
  screen.stdin.write('\r'); // -> viewer
  await tick(200);
  screen.stdin.write(ESCAPE); // viewer -> results
  await tick(200);
  screen.unmount();
  await tick(50);

  const frame = screen.output();
  expect(frame).toContain('[ View JSON ]');
  expect(frame).not.toContain('JSON viewer');
});

// Error path: an ExtractorError lands in the ErrorBox, no silent crash.
test('shows the ErrorBox when extraction fails', async () => {
  const workspace = makeTempDir('llm-wiki-extractortest-error-');
  makeWikiWithChunk(workspace, 'test-wiki');

  let result: string | undefined;
  const screen = renderCaptured(
    <ExtractorTestScreen
      onBack={() => {}}
      onResult={(message) => (result = message)}
      workspace={workspace}
      extractChunkFn={async () => {
        throw new ExtractorError('Extractor returned invalid JSON: Unexpected token', { rawResponse: 'not json' });
      }}
    />,
  );
  await tick(400);
  screen.stdin.write('\r'); // choose wiki
  await tick(400);
  screen.stdin.write('\r'); // choose chunk
  await tick(150);
  screen.stdin.write('\r'); // Run Extraction -> fails
  await waitFor(() => result !== undefined);
  await tick(200);
  screen.unmount();
  await tick(50);

  expect(result).toContain('Error');
  const frame = screen.output();
  expect(frame).toContain('Error');
  expect(frame).toContain('Extractor returned invalid JSON');
}, 30000);

// Escape contract: chunk list -> wiki list -> menu (onBack).
test('escape steps back from chunk list to wiki list to menu', async () => {
  const workspace = makeTempDir('llm-wiki-extractortest-escape-');
  makeWikiWithChunk(workspace, 'test-wiki');

  let backCount = 0;
  const screen = renderCaptured(
    <ExtractorTestScreen
      onBack={() => {
        backCount += 1;
      }}
      onResult={() => {}}
      workspace={workspace}
    />,
  );
  await tick(400);
  screen.stdin.write('\r'); // -> chunk list
  await tick(200);
  screen.stdin.write(ESCAPE); // -> wiki list
  await tick(200);
  expect(backCount).toBe(0);
  screen.stdin.write(ESCAPE); // -> menu
  await waitFor(() => backCount === 1);
  screen.unmount();
  await tick(50);
  expect(backCount).toBe(1);
});

// Non-TTY contract (src/AGENTS.md): static fallback, no crash, info visible.
test('extractor-test screen renders a static fallback without a TTY', async () => {
  const workspace = makeTempDir('llm-wiki-extractortest-notty-');
  makeWikiWithChunk(workspace, 'static-wiki');

  const screen = renderCaptured(
    <ExtractorTestScreen onBack={() => {}} onResult={() => {}} workspace={workspace} />,
    { tty: false },
  );
  await tick(400);
  screen.unmount();
  await tick(50);

  const frame = screen.output();
  expect(frame).toContain('Test Extractor');
  expect(frame).toContain('static-wiki');
  expect(frame).toContain('[ Run Extraction ] [ Back ]');
  expect(frame).toContain('requires a TTY');
});
