import React from 'react';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, afterEach, expect, test, vi } from 'vitest';
import { render, type Instance } from 'ink';
import { request as undiciRequest } from 'undici';
import { App } from '../src/tui/app';
import { MenuScreen, MENU_ITEMS } from '../src/tui/menu';
import { SettingsScreen } from '../src/tui/settings-screen';
import { IngestScreen } from '../src/tui/ingest-screen';
import { loadSettings, saveSettings, seedModelsForProvider } from '../src/tui/settings';
import { callLLM, getApiKeyStatus, resolveModel, setModelRouting, type ModelRouting } from '../src/llm/client';
import { init } from '../src/commands/init';
import { ingest } from '../src/commands/ingest';

// Phase 11 (phase doc §3): the nine technical approval gates. Everything here
// is LLM-free — gate 11.2's callLLM check mocks the undici transport (same
// pattern as tests/phase-07.test.ts), gate 11.6 ingests with extract: false,
// and every other gate is deterministic by construction.

vi.mock('undici', () => ({ request: vi.fn() }));
const mockUndiciRequest = vi.mocked(undiciRequest);

const HAIKU = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-5';
const OPUS = 'claude-opus-4-8';
const GPT_LUNA = 'gpt-5.6-luna';
const GPT_TERRA = 'gpt-5.6-terra';
const GPT_SOL = 'gpt-5.6-sol';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const GOLDEN_MASTER = 'test-pdfs/golden-master.pdf';

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
  setModelRouting(null);
  mockUndiciRequest.mockReset();
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

const DOWN = `${ESC}[B`;
const RIGHT = `${ESC}[C`;
const LEFT = `${ESC}[D`;

interface CapturedRender {
  stdin: FakeStdin;
  output: () => string;
  unmount: () => void;
  waitUntilRenderFlush: Instance['waitUntilRenderFlush'];
}

/**
 * Capture Ink output on a fake stdout and assert after unmount (Ink 7
 * non-interactive mode only writes the final frame on unmount).
 */
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
// Gate 11.1: Model Routing Settings Persist
// ---------------------------------------------------------------------------

test('gate 11.1: settings screen saves model routing to .paper-chase.json', async () => {
  const workspace = makeTempDir('paper-chase-g11-1-');
  let result: string | undefined;
  const screen = renderCaptured(
    // React.createElement rather than JSX: the phase gate files are .ts
    // (JSX only compiles in .tsx), matching the tests/phase-NN.test.ts
    // naming convention.
    React.createElement(SettingsScreen, {
      onBack: () => {},
      onResult: (message: string) => (result = message),
      workspace,
    }),
  );
  await tick(400); // let loadSettings resolve (defaults in an empty workspace)

  // Rows: Synthesis, Update Agents, Provider, Default Model, Extractor Model,
  // Synthesis Writer Model, DOX Writer Model, Curation Model, Anthropic API
  // Key, OpenAI API Key, [ Save ], [ Back ] (the v1.5.0 API-key rows sit
  // AFTER the model rows, so the Down-counts to the model rows are unchanged;
  // Phase 14 added the Curation Model row before the API-key rows, moving
  // [ Save ] from index 9 to index 10).
  screen.stdin.write(DOWN);
  await tick(100);
  screen.stdin.write(DOWN);
  await tick(100);
  screen.stdin.write(DOWN); // -> Default Model
  await tick(100);
  screen.stdin.write(DOWN); // -> Extractor Model
  await tick(100);
  screen.stdin.write(RIGHT); // Same as default -> Haiku
  await tick(100);
  screen.stdin.write(DOWN); // -> Synthesis Writer Model
  await tick(100);
  screen.stdin.write(RIGHT); // Same as default -> Haiku
  await tick(100);
  screen.stdin.write(RIGHT); // Haiku -> Sonnet
  await tick(100);
  screen.stdin.write(DOWN); // -> DOX Writer Model
  await tick(100);
  screen.stdin.write(DOWN); // -> Curation Model (Phase 14)
  await tick(100);
  screen.stdin.write(DOWN); // -> Anthropic API Key
  await tick(100);
  screen.stdin.write(DOWN); // -> OpenAI API Key
  await tick(100);
  screen.stdin.write(DOWN); // -> [ Save ]
  await tick(100);
  screen.stdin.write('\r');
  await waitFor(() => result !== undefined);
  screen.unmount();
  await tick(50);

  const config = JSON.parse(readFileSync(join(workspace, '.paper-chase.json'), 'utf-8')) as {
    models: {
      provider: string;
      default: string;
      extractor: string | null;
      synthesis: string | null;
      dox: string | null;
    };
  };
  expect(config.models.provider).toBe('anthropic');
  expect(config.models.extractor).toBe(HAIKU);
  expect(config.models.synthesis).toBe(SONNET);
  expect(config.models.default).toBe(HAIKU);
  expect(config.models.dox).toBeNull();
}, 30000);

// ---------------------------------------------------------------------------
// Gate 11.2: Model Routing Is Applied to LLM Calls
// ---------------------------------------------------------------------------

test('gate 11.2: resolveModel maps call types through the routing table', () => {
  const routing: ModelRouting = { default: HAIKU, extractor: HAIKU, synthesis: SONNET, dox: null };
  setModelRouting(routing);
  try {
    expect(resolveModel('extractor')).toBe(HAIKU);
    expect(resolveModel('synthesis')).toBe(SONNET);
    expect(resolveModel('permissive-synthesis')).toBe(SONNET);
    expect(resolveModel('topic-synthesis')).toBe(SONNET);
    expect(resolveModel('permissive-topic-synthesis')).toBe(SONNET);
    // A null routing entry means "Same as default".
    expect(resolveModel('dox-writer')).toBe(HAIKU);
    // Unmapped call types resolve to the routing default.
    expect(resolveModel('agents-updater')).toBe(HAIKU);
    expect(resolveModel()).toBe(HAIKU);
    // An explicit per-call override beats the routing table.
    expect(resolveModel('extractor', OPUS)).toBe(OPUS);
  } finally {
    setModelRouting(null);
  }
});

test('gate 11.2: with no routing set, resolution is the pre-Phase-11 env-then-default behavior', () => {
  setModelRouting(null);
  const saved = process.env.ANTHROPIC_MODEL;
  try {
    process.env.ANTHROPIC_MODEL = 'env-model-sentinel';
    expect(resolveModel('extractor')).toBe('env-model-sentinel');
    // v1.5.0 hygiene: the Settings screen's API-key status helper triggers
    // the client's one-time .env load, so a project-root .env carrying
    // ANTHROPIC_MODEL may have populated the var earlier in this fork —
    // delete it explicitly for the built-in-default assertion.
    delete process.env.ANTHROPIC_MODEL;
    expect(resolveModel('extractor')).toBe(HAIKU); // built-in DEFAULT_MODEL
  } finally {
    if (saved === undefined) {
      delete process.env.ANTHROPIC_MODEL;
    } else {
      process.env.ANTHROPIC_MODEL = saved;
    }
  }
});

test('gate 11.2: callLLM sends the routed extractor model in the request body', async () => {
  setModelRouting({ default: HAIKU, extractor: SONNET, synthesis: null, dox: null });
  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'gate-11-2-test-key';
  mockUndiciRequest.mockResolvedValueOnce({
    statusCode: 200,
    body: {
      json: async () => ({
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    },
  } as never);
  try {
    await callLLM('hello', undefined, { callType: 'extractor' });
    expect(mockUndiciRequest).toHaveBeenCalledTimes(1);
    const options = mockUndiciRequest.mock.calls[0][1] as { body: string };
    const body = JSON.parse(options.body) as { model: string };
    expect(body.model).toBe(SONNET);
  } finally {
    setModelRouting(null);
    if (savedKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  }
});

// ---------------------------------------------------------------------------
// Gate 11.3: Non-Production Menu Items Removed
// ---------------------------------------------------------------------------

test('gate 11.3: menu only shows production items: Create New Wiki, Add PDFs, Ingest PDFs, Settings, Exit', async () => {
  const workspace = makeTempDir('paper-chase-g11-3-');
  const menu = renderCaptured(React.createElement(MenuScreen, { onSelect: () => {}, lastResult: '', workspace }));
  await tick(300);
  menu.unmount();
  await tick(50);
  const frame = menu.output();
  for (const label of ['Create New Wiki', 'Add PDFs', 'Ingest PDFs', 'Settings', 'Exit']) {
    expect(frame).toContain(label);
  }
  for (const removed of [
    'Run Tests',
    'Test Extractor',
    'View Validation Report',
    'View Ingestion Log',
    'Browse Entities',
    'Browse Topics',
    'Browse DOX Contracts',
    'Review AGENTS.md Updates',
    'View Structural Changes',
  ]) {
    expect(frame).not.toContain(removed);
  }
});

// ---------------------------------------------------------------------------
// Gate 11.4: Continuous Workflow After Init
// ---------------------------------------------------------------------------

test('gate 11.4: after init, TUI goes to Add PDFs then prompts for ingest', async () => {
  const workspace = makeTempDir('paper-chase-g11-4-');
  const pdfSource = resolve(GOLDEN_MASTER);
  // The App's workspace prop keeps the driven flow hermetic (no chdir —
  // process.chdir is unsupported inside vitest workers).
  const app = renderCaptured(React.createElement(App, { workspace }));
  try {
    await tick(400); // let the menu mount (and the first-launch splash check run)
    app.stdin.write('\r'); // Enter on "Create New Wiki"
    await tick(200);
    app.stdin.write('Flow Wiki'); // Title field (focused first)
    await tick(150);
    app.stdin.write('\t'); // -> Workspace (pre-filled with the temp workspace)
    await tick(150);
    app.stdin.write('\t'); // -> Output Language
    await tick(150);
    app.stdin.write('\r'); // Enter submits the form -> init()
    await waitFor(() => existsSync(join(workspace, 'wikis', 'flow-wiki', 'AGENTS.md')), 30000);
    await tick(300); // let the app route straight to Add PDFs (initialWiki)
    // Add PDFs via the manual fallback: typing jumps focus to the path input.
    app.stdin.write(pdfSource);
    await tick(300);
    app.stdin.write('\r'); // submit the path -> copy -> "Start ingesting now?"
    await waitFor(() => existsSync(join(workspace, 'wikis', 'flow-wiki', 'raw', 'golden-master.pdf')), 30000);
    await tick(300);
    app.unmount();
    await tick(50);

    const frame = app.output();
    // The screen we land on is Add PDFs (never the menu in between) ...
    expect(frame).toContain('Add PDFs');
    // ... the Phase 11 banner fired for the wiki created moments earlier ...
    expect(frame).toContain('Copied 1 file(s) to wikis/flow-wiki/raw/.');
    // ... and the ingest prompt is showing.
    expect(frame).toContain('Start ingesting now? [Y/n]');
  } finally {
    app.unmount();
  }
}, 60000);

// ---------------------------------------------------------------------------
// Gate 11.5: README.md Exists and Has Required Sections
// ---------------------------------------------------------------------------

test('gate 11.5: README.md contains all required sections', () => {
  const readme = readFileSync('README.md', 'utf-8');
  expect(readme).toContain('# Paper Chase');
  expect(readme).toContain('The paper chase, automated.');
  expect(readme).toContain('## Introduction');
  expect(readme).toContain('## Functional Architecture');
  expect(readme).toContain('## Step-by-Step Architecture');
  expect(readme).toContain('## Detailed Technical Architecture');
  expect(readme).toContain('## Project Structure');
});

// ---------------------------------------------------------------------------
// Gate 11.6: Metrics Are Saved
// ---------------------------------------------------------------------------

test('gate 11.6: metrics are saved to .state/metrics.json', async () => {
  const workspace = makeTempDir('paper-chase-g11-6-');
  await init('metrics-wiki', { workspace });
  copyFileSync(GOLDEN_MASTER, join(workspace, 'wikis', 'metrics-wiki', 'raw', 'golden-master.pdf'));
  // extract: false keeps the gate LLM-free (Layer 1 only).
  await ingest('metrics-wiki', { workspace, extract: false, onProgress: () => {} });

  const metricsFile = join(workspace, 'wikis', 'metrics-wiki', '.state', 'metrics.json');
  expect(existsSync(metricsFile)).toBe(true);
  const metrics = JSON.parse(readFileSync(metricsFile, 'utf-8')) as Record<string, unknown>;
  expect(metrics.chunksProcessed).toBeDefined();
  expect(metrics.totalCost).toBeDefined();
}, 120000);

// ---------------------------------------------------------------------------
// Gate 11.7: Branding Sweep Is Complete
// ---------------------------------------------------------------------------

test('gate 11.7: no old branding remains in living docs or src', () => {
  const root = process.cwd();
  const scanDirs = ['src', 'tests', 'templates', 'scripts', 'Project Vision', 'Implementation Plan'];
  const scanFiles = ['AGENTS.md', 'README.md', 'package.json', join('wikis', 'AGENTS.md'), join('bin', 'chase.js')];
  const scanExtensions = new Set(['.md', '.ts', '.tsx', '.json', '.txt', '.js']);

  // Documented exclusions:
  // - this file (the scanner names the patterns it hunts for);
  // - the Phase 11 phase doc itself: §2.1 is the rename specification and
  //   must keep the old brand to describe it, and its gate text quotes the
  //   allowed-exclusion examples.
  const excludedFiles = new Set(
    [join('tests', 'phase-11.test.ts'), join('Implementation Plan', 'PHASE_11_polish.md')].map((p) =>
      resolve(root, p),
    ),
  );
  // Line-level exclusions: stable Document IDs keep their prefix; the
  // "formerly LLM Wiki CLI" note is the allowed historical reference; the
  // legacy settings file name is functional (read-only fallback); the v1
  // archive branch name is git history; the README's single "Naming rules:"
  // sentence states the forbidden forms in order to prohibit them (phase doc
  // §2.5 requires the rules to be stated).
  const lineExclusions = [
    'Document ID',
    'formerly LLM Wiki CLI',
    '.llm-wiki-cli.json',
    'archive/v1-main',
    'Naming rules:',
  ];

  // Built without string literals of the hunted patterns so this file does
  // not match itself even without the file-level exclusion.
  const oldBrand = new RegExp(['llm', 'wiki', 'cli'].join('[-_ ]'), 'i');
  const forbidden = new RegExp(['paper' + 'chase', 'Paper' + 'Chase', 'Paper' + 'Case'].join('|'));

  const offenders: string[] = [];
  const checkFile = (filePath: string) => {
    const lines = readFileSync(filePath, 'utf-8').split('\n');
    lines.forEach((line, index) => {
      if (lineExclusions.some((exclusion) => line.includes(exclusion))) {
        return;
      }
      if (oldBrand.test(line) || forbidden.test(line)) {
        offenders.push(`${filePath}:${index + 1}: ${line.trim().slice(0, 120)}`);
      }
    });
  };
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (excludedFiles.has(full)) {
        continue;
      }
      if (statSync(full).isDirectory()) {
        if (entry !== 'node_modules' && entry !== '.git' && entry !== '.state') {
          walk(full);
        }
        continue;
      }
      const dot = entry.lastIndexOf('.');
      if (dot >= 0 && scanExtensions.has(entry.slice(dot))) {
        checkFile(full);
      }
    }
  };
  for (const dir of scanDirs) {
    walk(resolve(root, dir));
  }
  for (const file of scanFiles) {
    const full = resolve(root, file);
    if (existsSync(full) && !excludedFiles.has(full)) {
      checkFile(full);
    }
  }
  expect(offenders).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 11.8: CLI Identifies as `chase`
// ---------------------------------------------------------------------------

test('gate 11.8: commander program is named chase', async () => {
  const { program } = await import('../src/cli');
  expect(program.name()).toBe('chase');
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as { name: string; bin: Record<string, string> };
  expect(pkg.name).toBe('paper-chase');
  expect(pkg.bin.chase).toBe(join('bin', 'chase.js').replace(/\\/g, '/'));
});

// ---------------------------------------------------------------------------
// Gate 11.9: Legacy Config Fallback Works
// ---------------------------------------------------------------------------

test('gate 11.9: settings load from legacy .llm-wiki-cli.json and save to .paper-chase.json', async () => {
  const workspace = makeTempDir('paper-chase-g11-9-');
  writeFileSync(join(workspace, '.llm-wiki-cli.json'), JSON.stringify({ synthesis: true, updateAgents: true }));

  const loaded = await loadSettings(workspace);
  expect(loaded.synthesis).toBe(true);
  expect(loaded.updateAgents).toBe(true);
  // Older files carry no models block — the routing defaults are filled in
  // (provider defaults to 'anthropic', Phase 11 v1.4.0). Phase 14: the
  // additive curation slot normalizes to null (legacy byte-identical).
  expect(loaded.models).toEqual({ provider: 'anthropic', default: HAIKU, extractor: null, synthesis: null, dox: null, curation: null });

  await saveSettings(workspace, loaded);
  expect(existsSync(join(workspace, '.paper-chase.json'))).toBe(true);
  const saved = JSON.parse(readFileSync(join(workspace, '.paper-chase.json'), 'utf-8')) as {
    synthesis: boolean;
    updateAgents: boolean;
  };
  expect(saved.synthesis).toBe(true);
  expect(saved.updateAgents).toBe(true);
  // The legacy file is never deleted or rewritten.
  expect(existsSync(join(workspace, '.llm-wiki-cli.json'))).toBe(true);
});

test('gate 11.9: the new .paper-chase.json wins when both files exist', async () => {
  const workspace = makeTempDir('paper-chase-g11-9b-');
  writeFileSync(join(workspace, '.llm-wiki-cli.json'), JSON.stringify({ synthesis: true }));
  writeFileSync(join(workspace, '.paper-chase.json'), JSON.stringify({ synthesis: false, updateAgents: true }));

  const loaded = await loadSettings(workspace);
  expect(loaded.synthesis).toBe(false);
  expect(loaded.updateAgents).toBe(true);
});

// ---------------------------------------------------------------------------
// Gate 11.10: Provider Switching Persists and Routes (Phase 11 v1.4.0)
// ---------------------------------------------------------------------------

test('gate 11.10: provider persists through save/load and legacy configs load as anthropic', async () => {
  const workspace = makeTempDir('paper-chase-g11-10a-');
  const settings = await loadSettings(workspace); // defaults in an empty workspace
  settings.models = { provider: 'openai', default: GPT_LUNA, extractor: null, synthesis: GPT_TERRA, dox: null };
  await saveSettings(workspace, settings);

  const raw = JSON.parse(readFileSync(join(workspace, '.paper-chase.json'), 'utf-8')) as {
    models: { provider: string };
  };
  expect(raw.models.provider).toBe('openai');

  const loaded = await loadSettings(workspace);
  expect(loaded.models.provider).toBe('openai');
  expect(loaded.models.default).toBe(GPT_LUNA);
  expect(loaded.models.synthesis).toBe(GPT_TERRA);
  expect(loaded.models.extractor).toBeNull();

  // A pre-v1.4.0 config (models block without provider) loads as 'anthropic'.
  const legacyWorkspace = makeTempDir('paper-chase-g11-10b-');
  writeFileSync(
    join(legacyWorkspace, '.paper-chase.json'),
    JSON.stringify({ models: { default: HAIKU, extractor: null, synthesis: SONNET, dox: null } }),
  );
  const legacyLoaded = await loadSettings(legacyWorkspace);
  expect(legacyLoaded.models.provider).toBe('anthropic');
  expect(legacyLoaded.models.synthesis).toBe(SONNET);
});

test('gate 11.10: provider-aware resolution routes call types through the openai table', () => {
  setModelRouting({ provider: 'openai', default: GPT_LUNA, extractor: null, synthesis: GPT_TERRA, dox: GPT_SOL });
  try {
    // A null routing entry means "Same as default".
    expect(resolveModel('extractor')).toBe(GPT_LUNA);
    expect(resolveModel('synthesis')).toBe(GPT_TERRA);
    expect(resolveModel('permissive-synthesis')).toBe(GPT_TERRA);
    expect(resolveModel('topic-synthesis')).toBe(GPT_TERRA);
    expect(resolveModel('permissive-topic-synthesis')).toBe(GPT_TERRA);
    expect(resolveModel('dox-writer')).toBe(GPT_SOL);
    // Unmapped call types resolve to the routing default.
    expect(resolveModel('agents-updater')).toBe(GPT_LUNA);
    expect(resolveModel()).toBe(GPT_LUNA);
    // An explicit per-call override beats the routing table.
    expect(resolveModel('extractor', GPT_SOL)).toBe(GPT_SOL);
  } finally {
    setModelRouting(null);
  }
});

test('gate 11.10: legacy routing without a provider field keeps anthropic resolution', () => {
  setModelRouting({ default: HAIKU, extractor: SONNET, synthesis: null, dox: null });
  try {
    expect(resolveModel('extractor')).toBe(SONNET);
    expect(resolveModel('dox-writer')).toBe(HAIKU);
  } finally {
    setModelRouting(null);
  }
});

test('gate 11.10: openai provider posts the Chat Completions shape and parses the reply', async () => {
  setModelRouting({ provider: 'openai', default: GPT_TERRA, extractor: null, synthesis: null, dox: null });
  const savedKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'gate-11-10-openai-key';
  mockUndiciRequest.mockResolvedValueOnce({
    statusCode: 200,
    body: {
      json: async () => ({
        choices: [{ message: { content: 'openai reply text' } }],
        usage: { prompt_tokens: 1000, completion_tokens: 500 },
      }),
    },
  } as never);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const logPath = join(makeTempDir('paper-chase-g11-10log-'), 'llm-calls.json');
  try {
    // options.temperature is deliberately set: it must NOT reach the wire.
    const text = await callLLM('hello openai', 'be terse', {
      callType: 'extractor',
      temperature: 0.3,
      maxTokens: 2048,
      logPath,
    });
    expect(text).toBe('openai reply text');
    expect(mockUndiciRequest).toHaveBeenCalledTimes(1);

    const [url, requestOptions] = mockUndiciRequest.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url).toBe(OPENAI_URL);
    expect(requestOptions.headers['content-type']).toBe('application/json');
    expect(requestOptions.headers.authorization).toBe('Bearer gate-11-10-openai-key');
    expect(requestOptions.headers['x-api-key']).toBeUndefined();

    const body = JSON.parse(requestOptions.body) as Record<string, unknown>;
    expect(body.model).toBe(GPT_TERRA);
    expect(body.max_completion_tokens).toBe(2048);
    expect('max_tokens' in body).toBe(false);
    expect('temperature' in body).toBe(false);
    // The system prompt is a leading system message, not a top-level field.
    expect(body.system).toBeUndefined();
    expect(body.messages).toEqual([
      { role: 'system', content: 'be terse' },
      { role: 'user', content: 'hello openai' },
    ]);

    // Cost comes from the OpenAI price table: terra $2.5/$15 per MTok →
    // (1000 * 2.5 + 500 * 15) / 1e6 = $0.01.
    expect(logSpy).toHaveBeenCalledWith('LLM Call | Tokens: 1000/500 | Cost: $0.0100');

    // The llm-calls.json entry carries the additive provider field.
    const entry = JSON.parse(readFileSync(logPath, 'utf-8').trim()) as Record<string, unknown>;
    expect(entry.provider).toBe('openai');
    expect(entry.model).toBe(GPT_TERRA);
    expect(entry.inputTokens).toBe(1000);
    expect(entry.outputTokens).toBe(500);
    expect(entry.cost as number).toBeCloseTo(0.01, 10);
  } finally {
    logSpy.mockRestore();
    setModelRouting(null);
    if (savedKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = savedKey;
    }
  }
});

test('gate 11.10: missing OPENAI_API_KEY with provider openai throws the exact error', async () => {
  setModelRouting({ provider: 'openai', default: GPT_LUNA, extractor: null, synthesis: null, dox: null });
  const savedKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    // v1.5.0: the missing-key error gained the "Add it in Settings" middle
    // sentence (gate 11.11 covers both providers' full wording).
    await expect(callLLM('hi')).rejects.toThrow(
      'OPENAI_API_KEY is not set. Add it in Settings, export it in your environment, or add it to a .env file in the project root.',
    );
    expect(mockUndiciRequest).not.toHaveBeenCalled();
  } finally {
    setModelRouting(null);
    if (savedKey !== undefined) {
      process.env.OPENAI_API_KEY = savedKey;
    }
  }
});

test('gate 11.10: seedModelsForProvider re-seeds both providers to cheapest tier plus nulls (Phase 14: mid-tier curation)', () => {
  expect(seedModelsForProvider('openai')).toEqual({
    provider: 'openai',
    default: GPT_LUNA,
    extractor: null,
    synthesis: null,
    dox: null,
    curation: GPT_TERRA,
  });
  expect(seedModelsForProvider('anthropic')).toEqual({
    provider: 'anthropic',
    default: HAIKU,
    extractor: null,
    synthesis: null,
    dox: null,
    curation: SONNET,
  });
});

test('gate 11.10: switching provider in the settings screen re-seeds the five model slots', async () => {
  const workspace = makeTempDir('paper-chase-g11-10c-');
  let result: string | undefined;
  const screen = renderCaptured(
    React.createElement(SettingsScreen, {
      onBack: () => {},
      onResult: (message: string) => (result = message),
      workspace,
    }),
  );
  await tick(400); // let loadSettings resolve (defaults in an empty workspace)

  // Rows: Synthesis, Update Agents, Provider, Default Model, Extractor Model,
  // Synthesis Writer Model, DOX Writer Model, Curation Model, Anthropic API
  // Key, OpenAI API Key, [ Save ], [ Back ] — Provider is index 2, [ Save ]
  // is index 10 since Phase 14 added the Curation Model row (8 Downs between
  // them).
  screen.stdin.write(DOWN);
  await tick(100);
  screen.stdin.write(DOWN); // -> Provider
  await tick(100);
  screen.stdin.write(RIGHT); // Anthropic -> OpenAI (slots re-seed immediately)
  await tick(100);
  for (let i = 0; i < 8; i++) {
    screen.stdin.write(DOWN); // Provider -> ... -> [ Save ]
    await tick(100);
  }
  screen.stdin.write('\r');
  await waitFor(() => result !== undefined);
  screen.unmount();
  await tick(50);

  const openaiConfig = JSON.parse(readFileSync(join(workspace, '.paper-chase.json'), 'utf-8')) as {
    models: { provider: string; default: string; extractor: string | null; synthesis: string | null; dox: string | null; curation: string | null };
  };
  expect(openaiConfig.models.provider).toBe('openai');
  expect(openaiConfig.models.default).toBe(GPT_LUNA);
  expect(openaiConfig.models.extractor).toBeNull();
  expect(openaiConfig.models.synthesis).toBeNull();
  expect(openaiConfig.models.dox).toBeNull();
  expect(openaiConfig.models.curation).toBe(GPT_TERRA);

  // Switch back: a fresh render loads the saved openai settings; LEFT on the
  // Provider row re-seeds to the Anthropic defaults.
  let result2: string | undefined;
  const screen2 = renderCaptured(
    React.createElement(SettingsScreen, {
      onBack: () => {},
      onResult: (message: string) => (result2 = message),
      workspace,
    }),
  );
  await tick(400);
  screen2.stdin.write(DOWN);
  await tick(100);
  screen2.stdin.write(DOWN); // -> Provider
  await tick(100);
  screen2.stdin.write(LEFT); // OpenAI -> Anthropic
  await tick(100);
  for (let i = 0; i < 8; i++) {
    screen2.stdin.write(DOWN);
    await tick(100);
  }
  screen2.stdin.write('\r');
  await waitFor(() => result2 !== undefined);
  screen2.unmount();
  await tick(50);

  const anthropicConfig = JSON.parse(readFileSync(join(workspace, '.paper-chase.json'), 'utf-8')) as {
    models: { provider: string; default: string; extractor: string | null; synthesis: string | null; dox: string | null; curation: string | null };
  };
  expect(anthropicConfig.models.provider).toBe('anthropic');
  expect(anthropicConfig.models.default).toBe(HAIKU);
  expect(anthropicConfig.models.extractor).toBeNull();
  expect(anthropicConfig.models.synthesis).toBeNull();
  expect(anthropicConfig.models.dox).toBeNull();
  expect(anthropicConfig.models.curation).toBe(SONNET);
}, 30000);

test('gate 11.10: anthropic request shape is byte-identical to the pre-extension client', async () => {
  setModelRouting({ provider: 'anthropic', default: HAIKU, extractor: SONNET, synthesis: null, dox: null });
  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'gate-11-10-anthropic-key';
  const okBody = async () => ({
    content: [{ type: 'text', text: 'ok' }],
    usage: { input_tokens: 1, output_tokens: 2 },
  });
  mockUndiciRequest
    .mockResolvedValueOnce({ statusCode: 200, body: { json: okBody } } as never)
    .mockResolvedValueOnce({ statusCode: 200, body: { json: okBody } } as never);
  try {
    // Full shape: system prompt + explicit temperature, extractor routing.
    await callLLM('hello', 'system prompt', { callType: 'extractor', temperature: 0.5 });
    // Minimal shape: defaults only, no callType (routing default).
    await callLLM('plain');

    expect(mockUndiciRequest).toHaveBeenCalledTimes(2);
    const [url1, options1] = mockUndiciRequest.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url1).toBe(ANTHROPIC_URL);
    expect(options1.headers['content-type']).toBe('application/json');
    expect(options1.headers['x-api-key']).toBe('gate-11-10-anthropic-key');
    expect(options1.headers['anthropic-version']).toBe('2023-06-01');
    expect(options1.headers.authorization).toBeUndefined();
    expect(options1.body).toBe(
      JSON.stringify({
        model: SONNET,
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'hello' }],
        system: 'system prompt',
        temperature: 0.5,
      }),
    );

    const [url2, options2] = mockUndiciRequest.mock.calls[1] as unknown as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url2).toBe(ANTHROPIC_URL);
    expect(options2.body).toBe(
      JSON.stringify({
        model: HAIKU,
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'plain' }],
      }),
    );
  } finally {
    setModelRouting(null);
    if (savedKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  }
});

// ---------------------------------------------------------------------------
// Gate 11.11: API Keys in Settings (Phase 11 v1.5.0)
// ---------------------------------------------------------------------------
// All LLM-free: the undici transport is mocked and every key is a FAKE test
// string. SECURITY: no real key may ever appear in this suite — the masked
// display assertions deliberately use `expect(frame).not.toContain('sk-…')`.

const FAKE_ANT_KEY = 'sk-ant-test-0000-ab12';
const FAKE_ANT_STORED = 'sk-ant-test-stored-5678';
const FAKE_ANT_ENV = 'sk-ant-test-env-9012';
const FAKE_OPENAI_STORED = 'sk-openai-test-stored-3456';
const FAKE_OPENAI_ENV = 'sk-openai-test-env-7890';

/** Restore a process.env var after a test. */
function restoreEnv(name: string, saved: string | undefined): void {
  if (saved === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = saved;
  }
}

const okAnthropicResponse = () =>
  ({
    statusCode: 200,
    body: {
      json: async () => ({
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    },
  }) as never;

const okOpenAIResponse = () =>
  ({
    statusCode: 200,
    body: {
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
    },
  }) as never;

test('gate 11.11: apiKeys round-trip through save/load; a missing block loads as nulls', async () => {
  const workspace = makeTempDir('paper-chase-g11-11a-');
  const settings = await loadSettings(workspace); // defaults in an empty workspace
  expect(settings.apiKeys).toEqual({ anthropic: null, openai: null });

  settings.apiKeys = { anthropic: FAKE_ANT_KEY, openai: null };
  await saveSettings(workspace, settings);

  const raw = JSON.parse(readFileSync(join(workspace, '.paper-chase.json'), 'utf-8')) as {
    apiKeys: { anthropic: string | null; openai: string | null };
  };
  expect(raw.apiKeys).toEqual({ anthropic: FAKE_ANT_KEY, openai: null });

  const loaded = await loadSettings(workspace);
  expect(loaded.apiKeys).toEqual({ anthropic: FAKE_ANT_KEY, openai: null });

  // A pre-v1.5.0 config (no apiKeys block) loads with nulls.
  const legacyWorkspace = makeTempDir('paper-chase-g11-11b-');
  writeFileSync(join(legacyWorkspace, '.paper-chase.json'), JSON.stringify({ synthesis: true }));
  const legacyLoaded = await loadSettings(legacyWorkspace);
  expect(legacyLoaded.synthesis).toBe(true);
  expect(legacyLoaded.apiKeys).toEqual({ anthropic: null, openai: null });
});

test('gate 11.11: anthropic key resolution — stored beats env, env without stored, neither throws the Settings error', async () => {
  // Fire the client's one-time .env load up front so deleting the env var
  // below sticks (a project-root .env may carry a real key; the load runs at
  // most once per process).
  getApiKeyStatus('anthropic', null);
  const savedEnv = process.env.ANTHROPIC_API_KEY;
  try {
    // 1. The Settings-stored key wins over the environment.
    process.env.ANTHROPIC_API_KEY = FAKE_ANT_ENV;
    setModelRouting({
      default: HAIKU,
      extractor: null,
      synthesis: null,
      dox: null,
      apiKeys: { anthropic: FAKE_ANT_STORED },
    });
    mockUndiciRequest.mockResolvedValueOnce(okAnthropicResponse());
    await callLLM('hi');
    let headers = (mockUndiciRequest.mock.calls[0][1] as { headers: Record<string, string> }).headers;
    expect(headers['x-api-key']).toBe(FAKE_ANT_STORED);

    // 2. With no stored key the environment is used.
    setModelRouting({ default: HAIKU, extractor: null, synthesis: null, dox: null });
    mockUndiciRequest.mockResolvedValueOnce(okAnthropicResponse());
    await callLLM('hi');
    headers = (mockUndiciRequest.mock.calls[1][1] as { headers: Record<string, string> }).headers;
    expect(headers['x-api-key']).toBe(FAKE_ANT_ENV);

    // 3. Neither stored nor env → the exact missing-key error naming Settings.
    delete process.env.ANTHROPIC_API_KEY;
    await expect(callLLM('hi')).rejects.toThrow(
      'ANTHROPIC_API_KEY is not set. Add it in Settings, export it in your environment, or add it to a .env file in the project root.',
    );
    expect(mockUndiciRequest).toHaveBeenCalledTimes(2);
  } finally {
    setModelRouting(null);
    restoreEnv('ANTHROPIC_API_KEY', savedEnv);
  }
});

test('gate 11.11: openai key resolution — stored beats env, env without stored, neither throws the Settings error', async () => {
  getApiKeyStatus('openai', null); // fire the one-time .env load (see above)
  const savedEnv = process.env.OPENAI_API_KEY;
  try {
    // 1. The Settings-stored key wins over the environment.
    process.env.OPENAI_API_KEY = FAKE_OPENAI_ENV;
    setModelRouting({
      provider: 'openai',
      default: GPT_LUNA,
      extractor: null,
      synthesis: null,
      dox: null,
      apiKeys: { openai: FAKE_OPENAI_STORED },
    });
    mockUndiciRequest.mockResolvedValueOnce(okOpenAIResponse());
    await callLLM('hi');
    let headers = (mockUndiciRequest.mock.calls[0][1] as { headers: Record<string, string> }).headers;
    expect(headers.authorization).toBe(`Bearer ${FAKE_OPENAI_STORED}`);

    // 2. With no stored key the environment is used.
    setModelRouting({ provider: 'openai', default: GPT_LUNA, extractor: null, synthesis: null, dox: null });
    mockUndiciRequest.mockResolvedValueOnce(okOpenAIResponse());
    await callLLM('hi');
    headers = (mockUndiciRequest.mock.calls[1][1] as { headers: Record<string, string> }).headers;
    expect(headers.authorization).toBe(`Bearer ${FAKE_OPENAI_ENV}`);

    // 3. Neither stored nor env → the exact missing-key error naming Settings.
    delete process.env.OPENAI_API_KEY;
    await expect(callLLM('hi')).rejects.toThrow(
      'OPENAI_API_KEY is not set. Add it in Settings, export it in your environment, or add it to a .env file in the project root.',
    );
    expect(mockUndiciRequest).toHaveBeenCalledTimes(2);
  } finally {
    setModelRouting(null);
    restoreEnv('OPENAI_API_KEY', savedEnv);
  }
});

test('gate 11.11: getApiKeyStatus reports stored/environment/none and never more than 4 key characters', () => {
  getApiKeyStatus('openai', null); // fire the one-time .env load (see above)
  const savedEnv = process.env.OPENAI_API_KEY;
  try {
    // Stored key → 'stored' + last4.
    const stored = getApiKeyStatus('openai', FAKE_OPENAI_STORED);
    expect(stored).toEqual({ source: 'stored', last4: '3456' });

    // Env only → 'environment' + last4.
    process.env.OPENAI_API_KEY = FAKE_OPENAI_ENV;
    const environment = getApiKeyStatus('openai', null);
    expect(environment).toEqual({ source: 'environment', last4: '7890' });

    // Stored still wins when both exist.
    expect(getApiKeyStatus('openai', FAKE_OPENAI_STORED).source).toBe('stored');

    // Neither → 'none' + null.
    delete process.env.OPENAI_API_KEY;
    expect(getApiKeyStatus('openai', null)).toEqual({ source: 'none', last4: null });

    // The helper NEVER returns more than the last 4 characters of a key.
    for (const status of [stored, environment]) {
      expect(status.last4).not.toBeNull();
      expect(status.last4!.length).toBeLessThanOrEqual(4);
    }
    expect(stored.last4).not.toBe(FAKE_OPENAI_STORED);
    expect(environment.last4).not.toBe(FAKE_OPENAI_ENV);
  } finally {
    restoreEnv('OPENAI_API_KEY', savedEnv);
  }
});

test('gate 11.11: the settings screen masks stored keys — last4 shown, the full key never rendered', async () => {
  const workspace = makeTempDir('paper-chase-g11-11mask-');
  const settings = await loadSettings(workspace);
  settings.apiKeys = { anthropic: FAKE_ANT_KEY, openai: null };
  await saveSettings(workspace, settings);

  // Guarantee the '[not set]' assertion for the untouched provider even if
  // the shell happens to export OPENAI_API_KEY.
  const savedOpenAiEnv = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  let frame = '';
  let editFrame = '';
  try {
    // 1. Load-only render: the stored key displays as source + last4.
    //    (Ink's non-interactive mode only writes the final frame on unmount,
    //    so the load state and the post-edit state need separate renders.)
    const screen = renderCaptured(
      React.createElement(SettingsScreen, { onBack: () => {}, workspace }),
    );
    await tick(400); // let loadSettings resolve
    screen.unmount();
    await tick(50);
    frame = screen.output();

    // 2. Edit-drive render: typed key material must stay masked in the frame.
    const editScreen = renderCaptured(
      React.createElement(SettingsScreen, { onBack: () => {}, workspace }),
    );
    await tick(400);
    for (let i = 0; i < 8; i++) {
      editScreen.stdin.write(DOWN); // -> Anthropic API Key (Phase 14: past the Curation Model row)
      await tick(60);
    }
    editScreen.stdin.write('\r'); // open the masked editor
    await tick(100);
    editScreen.stdin.write('sk-ant-test-typed-4321');
    await tick(150);
    editScreen.stdin.write('\r'); // submit -> staged, row re-renders with new last4
    await tick(100);
    editScreen.unmount();
    await tick(50);
    editFrame = editScreen.output();
  } finally {
    restoreEnv('OPENAI_API_KEY', savedOpenAiEnv);
  }
  // The stored fake key renders as source + last4 only …
  expect(frame).toContain('Anthropic API Key: [configured ••••ab12]');
  // … and the untouched provider shows 'not set'.
  expect(frame).toContain('OpenAI API Key: [not set]');
  // The freshly staged edit re-renders with ITS last4 …
  expect(editFrame).toContain('Anthropic API Key: [configured ••••4321]');
  // … and no full key material appears in any rendered frame (the masked
  // TextInput never echoes typed input in clear).
  for (const output of [frame, editFrame]) {
    expect(output).not.toContain(FAKE_ANT_KEY);
    expect(output).not.toContain('sk-ant-test');
  }
}, 30000);

test('gate 11.11: stage a key -> Save persists it; Escape cancels an edit; empty submit clears', async () => {
  const workspace = makeTempDir('paper-chase-g11-11stage-');
  const readConfig = () =>
    JSON.parse(readFileSync(join(workspace, '.paper-chase.json'), 'utf-8')) as {
      apiKeys: { anthropic: string | null; openai: string | null };
    };
  const focusAnthropicKeyRow = async (screen: CapturedRender) => {
    for (let i = 0; i < 8; i++) {
      screen.stdin.write(DOWN); // -> Anthropic API Key (Phase 14: past the Curation Model row)
      await tick(80);
    }
  };

  // 1. Stage a key and save it.
  let result1: string | undefined;
  const screen1 = renderCaptured(
    React.createElement(SettingsScreen, {
      onBack: () => {},
      onResult: (message: string) => (result1 = message),
      workspace,
    }),
  );
  await tick(400);
  await focusAnthropicKeyRow(screen1);
  screen1.stdin.write('\r'); // open the editor
  await tick(100);
  screen1.stdin.write(FAKE_ANT_KEY);
  await tick(150);
  screen1.stdin.write('\r'); // submit -> staged
  await tick(100);
  screen1.stdin.write(DOWN); // -> OpenAI API Key
  await tick(80);
  screen1.stdin.write(DOWN); // -> [ Save ]
  await tick(80);
  screen1.stdin.write('\r');
  await waitFor(() => result1 !== undefined);
  screen1.unmount();
  await tick(50);
  expect(readConfig().apiKeys).toEqual({ anthropic: FAKE_ANT_KEY, openai: null });

  // 2. Escape cancels an edit: typed junk is never staged, so the saved
  //    config still holds the key from step 1. (If Escape failed, the editor
  //    would swallow the Downs and [ Save ] would never fire — waitFor would
  //    time out, so this beat proves the cancel path.)
  let result2: string | undefined;
  const screen2 = renderCaptured(
    React.createElement(SettingsScreen, {
      onBack: () => {},
      onResult: (message: string) => (result2 = message),
      workspace,
    }),
  );
  await tick(400);
  await focusAnthropicKeyRow(screen2);
  screen2.stdin.write('\r'); // open the editor
  await tick(100);
  screen2.stdin.write('sk-ant-test-junk-9999');
  await tick(150);
  screen2.stdin.write(ESC); // cancel the edit
  await tick(100);
  screen2.stdin.write(DOWN); // -> OpenAI API Key
  await tick(80);
  screen2.stdin.write(DOWN); // -> [ Save ]
  await tick(80);
  screen2.stdin.write('\r');
  await waitFor(() => result2 !== undefined);
  screen2.unmount();
  await tick(50);
  expect(readConfig().apiKeys).toEqual({ anthropic: FAKE_ANT_KEY, openai: null });

  // 3. Empty submit stages a CLEAR; Save persists the null.
  let result3: string | undefined;
  const screen3 = renderCaptured(
    React.createElement(SettingsScreen, {
      onBack: () => {},
      onResult: (message: string) => (result3 = message),
      workspace,
    }),
  );
  await tick(400);
  await focusAnthropicKeyRow(screen3);
  screen3.stdin.write('\r'); // open the editor
  await tick(100);
  screen3.stdin.write('\r'); // empty submit -> staged clear
  await tick(100);
  screen3.stdin.write(DOWN); // -> OpenAI API Key
  await tick(80);
  screen3.stdin.write(DOWN); // -> [ Save ]
  await tick(80);
  screen3.stdin.write('\r');
  await waitFor(() => result3 !== undefined);
  screen3.unmount();
  await tick(50);
  expect(readConfig().apiKeys).toEqual({ anthropic: null, openai: null });
}, 60000);

test('gate 11.11: a call made with a stored key writes no key material to llm-calls.json or the console', async () => {
  setModelRouting({
    default: HAIKU,
    extractor: null,
    synthesis: null,
    dox: null,
    apiKeys: { anthropic: FAKE_ANT_STORED },
  });
  const logPath = join(makeTempDir('paper-chase-g11-11log-'), 'llm-calls.json');
  mockUndiciRequest.mockResolvedValueOnce(okAnthropicResponse());
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await callLLM('hi', undefined, { callType: 'extractor', context: 'gate-11.11', logPath });

    // The auth header DID carry the stored key (that is the one sanctioned
    // place for key material on the wire) …
    const headers = (mockUndiciRequest.mock.calls[0][1] as { headers: Record<string, string> }).headers;
    expect(headers['x-api-key']).toBe(FAKE_ANT_STORED);

    // … but the log entry is exactly the pre-v1.5.0 field set — no key,
    // no authorization, no token field beyond the two token COUNT fields.
    const entry = JSON.parse(readFileSync(logPath, 'utf-8').trim()) as Record<string, unknown>;
    expect(Object.keys(entry).sort()).toEqual(
      ['timestamp', 'callType', 'context', 'provider', 'model', 'inputTokens', 'outputTokens', 'cost'].sort(),
    );
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain(FAKE_ANT_STORED);
    expect(serialized).not.toContain('sk-ant-test');

    // The console cost line carries no key material either.
    for (const call of logSpy.mock.calls) {
      expect(call.join(' ')).not.toContain('sk-ant-test');
    }
  } finally {
    logSpy.mockRestore();
    setModelRouting(null);
  }
});

// ---------------------------------------------------------------------------
// Gate 11.12: Post-Ingest AGENTS.md Proposal Review Shortcut (Phase 11 v1.6.0)
// ---------------------------------------------------------------------------
// User directive 2026-07-23: at the end of an ingestion that wrote
// `.state/proposed-agents.md`, the success state offers a `p` shortcut into
// the (flow-only) review screen showing the diff; Accept replaces AGENTS.md
// with the proposal, Reject does NOTHING (the proposal file is kept — this
// supersedes the 2026-07-21 reject-deletes preference). All LLM-free: the
// ingest is stubbed via the injectable `ingestFn`.

const REVIEW_HINT = 'AGENTS.md update proposed — press [P] to review the diff.';

// Gate 11.12 polls frames WHILE a screen is mounted; the shared
// renderCaptured above uses a non-TTY stdout, and Ink 7's non-interactive
// mode only writes the final frame on unmount. This TTY variant (same
// harness as tests/tui/agents-review-screen.test.tsx) streams every frame.
function renderCapturedTty(node: React.ReactElement): CapturedRender {
  const stdin = createFakeStdin();
  const stdout = createFakeStdout();
  stdout.isTTY = true;
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

/** Minimal stub IngestResult for the injectable ingestFn. */
function stubIngestResult(agentsUpdateProposed: boolean) {
  return {
    wiki: 'review-wiki',
    wikiDir: '',
    ingested: [
      { source: 'fixture', file: 'fixture.pdf', pageCount: 1, documentPages: [], warnings: [], tablesFound: 0 },
    ],
    skipped: [],
    extractions: [],
    ...(agentsUpdateProposed ? { agentsUpdateProposed: true } : {}),
  };
}

/** Temp wiki whose .state/proposed-agents.md differs from AGENTS.md. */
async function makeReviewFixture(workspace: string, slug: string): Promise<{ agentsPath: string; proposalPath: string }> {
  await init(slug, { workspace });
  const dir = join(workspace, 'wikis', slug);
  const agentsPath = join(dir, 'AGENTS.md');
  const proposalPath = join(dir, '.state', 'proposed-agents.md');
  const current = readFileSync(agentsPath, 'utf-8');
  writeFileSync(proposalPath, `${current}\nProposed addition: review-shortcut fixture line.\n`);
  return { agentsPath, proposalPath };
}

test('gate 11.12: the review hint shows only when the run proposed AGENTS.md updates', async () => {
  const workspace = makeTempDir('paper-chase-g11-12-hint-');
  await init('review-wiki', { workspace });

  // 1. Proposal written -> the success state shows the `p` hint.
  const withProposal = renderCapturedTty(
    React.createElement(IngestScreen, {
      onBack: () => {},
      workspace,
      ingestFn: async () => stubIngestResult(true),
    }),
  );
  await waitFor(() => withProposal.output().includes('review-wiki'));
  withProposal.stdin.write('\r'); // run the ingest
  await waitFor(() => withProposal.output().includes('Ingest complete: 1 ingested, 0 skipped.'));
  withProposal.unmount();
  await tick(50);
  expect(withProposal.output()).toContain(REVIEW_HINT);

  // 2. No proposal -> no hint, and `p` is a no-op (the callback never fires).
  let reviewed: string | undefined;
  const withoutProposal = renderCapturedTty(
    React.createElement(IngestScreen, {
      onBack: () => {},
      workspace,
      ingestFn: async () => stubIngestResult(false),
      onReviewAgents: (wiki: string) => (reviewed = wiki),
    }),
  );
  await waitFor(() => withoutProposal.output().includes('review-wiki'));
  withoutProposal.stdin.write('\r');
  await waitFor(() => withoutProposal.output().includes('Ingest complete: 1 ingested, 0 skipped.'));
  withoutProposal.stdin.write('p');
  await tick(300);
  withoutProposal.unmount();
  await tick(50);
  expect(withoutProposal.output()).not.toContain(REVIEW_HINT);
  expect(reviewed).toBeUndefined();
}, 60000);

/**
 * Drive the App from the menu into the flow-only review screen: menu ->
 * Ingest PDFs -> run the stubbed ingest (proposal written) -> `p`.
 */
async function driveAppToReview(workspace: string): Promise<CapturedRender> {
  const app = renderCapturedTty(
    React.createElement(App, { workspace, ingestFn: async () => stubIngestResult(true) }),
  );
  await tick(400); // let the menu mount
  app.stdin.write(DOWN); // -> Add PDFs
  await tick(150);
  app.stdin.write(DOWN); // -> Ingest PDFs
  await tick(150);
  app.stdin.write('\r');
  await waitFor(() => app.output().includes('review-wiki'));
  app.stdin.write('\r'); // run the ingest (selected wiki defaults to the only one)
  await waitFor(() => app.output().includes(REVIEW_HINT));
  app.stdin.write('p'); // the post-ingest shortcut
  await waitFor(() => app.output().includes('Diff preview'));
  return app;
}

test('gate 11.12: p routes the app to the review screen, which shows the diff; accept replaces AGENTS.md', async () => {
  const workspace = makeTempDir('paper-chase-g11-12-accept-');
  const { agentsPath, proposalPath } = await makeReviewFixture(workspace, 'review-wiki');
  const agentsBefore = readFileSync(agentsPath, 'utf-8');
  const proposalText = readFileSync(proposalPath, 'utf-8');
  expect(agentsBefore).not.toContain('Proposed addition');

  const app = await driveAppToReview(workspace);
  try {
    const frame = app.output();
    expect(frame).toContain('Review AGENTS.md Updates');
    expect(frame).toContain('Wiki: review-wiki');
    // The rendered diff carries the line-diff markers/context for the proposal.
    expect(frame).toContain('+ Proposed addition: review-shortcut fixture line.');
    expect(frame).toContain('[A] Accept');
    expect(frame).toContain('[R] Reject');

    app.stdin.write('a');
    await waitFor(() => app.output().includes('Accepted proposed AGENTS.md updates for review-wiki.'));
    await tick(200);
  } finally {
    app.unmount();
    await tick(50);
  }

  // Accept semantics (unchanged): AGENTS.md becomes byte-identical to the
  // proposal; the proposal file itself is left on disk.
  expect(readFileSync(agentsPath, 'utf-8')).toBe(proposalText);
  expect(existsSync(proposalPath)).toBe(true);
}, 60000);

test('gate 11.12: reject is a no-op — AGENTS.md and the proposal stay byte-identical', async () => {
  const workspace = makeTempDir('paper-chase-g11-12-reject-');
  const { agentsPath, proposalPath } = await makeReviewFixture(workspace, 'review-wiki');
  const agentsBefore = readFileSync(agentsPath, 'utf-8');
  const proposalBefore = readFileSync(proposalPath, 'utf-8');

  const app = await driveAppToReview(workspace);
  try {
    app.stdin.write('r');
    await waitFor(() =>
      app.output().includes('Rejected proposed AGENTS.md updates for review-wiki. No changes made.'),
    );
    await tick(200);
  } finally {
    app.unmount();
    await tick(50);
  }

  // v1.6.0 reject semantics: NOTHING changes — the proposal is kept for
  // later manual review and AGENTS.md is untouched.
  expect(readFileSync(agentsPath, 'utf-8')).toBe(agentsBefore);
  expect(existsSync(proposalPath)).toBe(true);
  expect(readFileSync(proposalPath, 'utf-8')).toBe(proposalBefore);
}, 60000);

test('gate 11.12: the main menu is unchanged — five items, agents-review absent (gate 11.3 regression)', () => {
  expect(MENU_ITEMS.map((item) => item.value)).toEqual(['init', 'add-pdfs', 'ingest', 'settings', 'exit']);
  expect(MENU_ITEMS.some((item) => item.value === 'agents-review')).toBe(false);
});
