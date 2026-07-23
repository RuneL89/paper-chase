import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { afterAll, afterEach, expect, test, vi } from 'vitest';
import { request as undiciRequest } from 'undici';
import {
  buildCorrectionBlock,
  REASK_CORRECTION_INSTRUCTION,
  runWithFeedbackRetry,
} from '../src/llm/reask';
import { extractChunk, ExtractorError, type ExtractorResult } from '../src/agents/extractor';
import { ingest } from '../src/commands/ingest';
import { init } from '../src/commands/init';
import { writeDoxContracts } from '../src/dox-writer';
import { proposeAgentsUpdate } from '../src/agents/agents-updater';
import { setModelRouting } from '../src/llm/client';
import { materialize } from '../src/materializer';
import type { ChunkExtraction } from '../src/commands/extract-chunk';

/**
 * Phase 12 gates 12.1–12.8 (validation feedback retry / "reask", phase doc
 * §3; vision `04` §6 four-class retry policy, user-ratified 2026-07-23).
 *
 * EVERY gate is LLM-free: gates 12.1–12.3 + 12.8 spy on `callLLM` (or mock
 * the undici transport with a FAKE key); gates 12.4–12.7 drive ingest /
 * writeDoxContracts / proposeAgentsUpdate through the injected seams
 * (extractChunkFn, synthesizeEntityFn, writeDoxIndexFn, writeWorkspaceIndexFn,
 * writeWorkspaceProseFn, callLLMFn) so no real LLM call can happen even with
 * a key present. Total implementation-test LLM cost: $0.
 *
 * What the gates pin:
 *  - Attempt 1 at every site is byte-identical to the pre-Phase-12 prompt
 *    (the correction block appears only on attempts 2+).
 *  - The correction block carries the invalid output verbatim plus the
 *    validator's EXACT error strings, delimited by === CORRECTION REQUIRED ===.
 *  - ≤3 total attempts everywhere; exhaustion keeps the pre-Phase-12 behavior
 *    (Extractor aborts fail-loud; DOX/workspace/updater write deterministic
 *    fallbacks; synthesis keeps the strict→permissive→template chain).
 *  - HTTP 4xx is never re-asked (exactly 1 transport call, no correction
 *    prompt composed); transient 429/5xx retry lives inside callLLM, unchanged.
 *  - metrics.feedbackRepairs is written every run and the prompt-quality
 *    warning fires only at ≥5 repairs or >25% of the run's logged LLM calls.
 */

const GOLDEN_MASTER_PDF = 'test-pdfs/golden-master.pdf';
const tempDirs: string[] = [];

afterAll(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  mockUndiciRequest.mockReset();
  setModelRouting(null);
});

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

// The undici transport is mocked so gate 12.8 can run the REAL callLLM with a
// FAKE key and assert the 404 is never re-asked (same pattern as gate 11.10).
vi.mock('undici', () => ({ request: vi.fn() }));
const mockUndiciRequest = vi.mocked(undiciRequest);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/** The standard two-entity extraction, valid against the schema. */
function fakeExtraction(): ExtractorResult {
  return {
    entities: [
      {
        name: 'John Smith',
        type: 'person',
        slug: 'john-smith',
        folder: 'entities/people/executives',
        significance: 'CEO of Acme Corp',
        mentions: [{ page: 1, context: 'John Smith, CEO of Acme Corp' }],
      },
      {
        name: 'Acme Corp',
        type: 'company',
        slug: 'acme-corp',
        folder: 'entities/companies',
        significance: 'The company whose results are presented',
        mentions: [{ page: 1, context: 'annual results of Acme Corp' }],
      },
    ],
    relationships: [
      {
        subject: 'john-smith',
        predicate: 'is-ceo-of',
        object: 'acme-corp',
        evidence: 'John Smith, CEO of Acme Corp',
        page: 1,
      },
    ],
    claims: [
      {
        text: 'Revenue was $42.5M in Q3 2024',
        type: 'financial',
        entities: ['acme-corp'],
        page: 2,
      },
    ],
    timeline: [],
    context: 'Fake extraction fixture for Phase 12 reask tests.',
  };
}

/**
 * The gate-12.2 slip (phase doc §3, mirroring the UAT-found failure): six
 * valid entities and a seventh whose folder escaped the entities//topics
 * taxonomy. After slug normalization the folder survives verbatim, so the
 * validator reports `entities[6]: folder "products/assessment-tools" must
 * start with "entities/" or "topics/"`.
 */
function slippedFolderExtraction(): ExtractorResult {
  const base = fakeExtraction();
  const extraNames = [
    ['Beta Tool', 'beta-tool'],
    ['Gamma Tool', 'gamma-tool'],
    ['Delta Tool', 'delta-tool'],
    ['Epsilon Tool', 'epsilon-tool'],
  ] as const;
  const entities = [
    ...base.entities,
    ...extraNames.map(([name, slug]) => ({
      name,
      type: 'product',
      slug,
      folder: 'entities/products',
      significance: `${name} significance`,
      mentions: [{ page: 1, context: `${name} is mentioned on page one` }],
    })),
    {
      name: 'Zeta Tool',
      type: 'product',
      slug: 'zeta-tool',
      folder: 'products/assessment-tools', // the slip
      significance: 'Zeta Tool significance',
      mentions: [{ page: 1, context: 'Zeta Tool is mentioned on page one' }],
    },
  ];
  return { ...base, entities };
}

/** Injected Layer 2 stub: writes the extraction JSON exactly like the real path. */
function makeExtractChunkFnStub(extraction: ExtractorResult = fakeExtraction()) {
  return async (wikiDir: string, chunkId: string): Promise<ChunkExtraction> => {
    const jsonPath = join(wikiDir, '.state', 'extracted', `${chunkId}.json`);
    await mkdir(dirname(jsonPath), { recursive: true });
    await writeFile(jsonPath, JSON.stringify(extraction, null, 2) + '\n', 'utf-8');
    return {
      chunkId,
      result: extraction,
      jsonPath,
      jsonRelativePath: `.state/extracted/${chunkId}.json`,
    };
  };
}

/** Init a wiki and copy the golden master into raw/ (no ingest). */
function setupWikiWithPdf(): string {
  const workspace = makeTempDir('paper-chase-g12-');
  init('test-wiki', { workspace });
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  mkdirSync(join(wikiDir, 'raw'), { recursive: true });
  copyFileSync(GOLDEN_MASTER_PDF, join(wikiDir, 'raw', 'golden-master.pdf'));
  return workspace;
}

/** Init a wiki, copy the golden master in, and run a full LLM-free ingest. */
async function setupIngestedWiki(): Promise<string> {
  const workspace = setupWikiWithPdf();
  await ingest('test-wiki', { workspace, extractChunkFn: makeExtractChunkFnStub() });
  return workspace;
}

function wikiPath(workspace: string, ...parts: string[]): string {
  return join(workspace, 'wikis', 'test-wiki', ...parts);
}

/** Capture console.warn output for the duration of `fn`. */
async function captureWarnings(fn: () => Promise<unknown>): Promise<string[]> {
  const warnings: string[] = [];
  const spy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    warnings.push(args.map((arg) => String(arg)).join(' '));
  });
  try {
    await fn();
  } finally {
    spy.mockRestore();
  }
  return warnings;
}

// ---------------------------------------------------------------------------
// Gate 12.1: Extractor JSON-parse reask
// ---------------------------------------------------------------------------
test('gate 12.1: extractor retries a JSON-parse failure with the invalid output and exact parse error fed back', async () => {
  const workspace = makeTempDir('paper-chase-g12-1-');
  const logPath = join(workspace, 'llm-calls.json');
  const valid = JSON.stringify(fakeExtraction());
  const invalidJson = '{ this is not json';
  const seenPrompts: string[] = [];
  const seenContexts: Array<string | undefined> = [];

  const spy = vi
    .spyOn(await import('../src/llm/client'), 'callLLM')
    .mockImplementation(async (prompt: string, _system?: string, options?: { context?: string }) => {
      seenPrompts.push(prompt);
      seenContexts.push(options?.context);
      return seenPrompts.length === 1 ? invalidJson : valid;
    });

  const result = await extractChunk('chunk text', '1-3', 'raw/golden-master.pdf', 'AGENTS', [], [], {
    logPath,
    context: 'golden-master-part-001',
  });

  expect(spy).toHaveBeenCalledTimes(2);
  expect(result.entities.map((entity) => entity.slug)).toContain('john-smith');

  // Attempt 2 carries the correction block: the invalid output verbatim and
  // the exact parse error the validator produced.
  const attempt2 = seenPrompts[1];
  expect(attempt2).toContain('=== CORRECTION REQUIRED ===');
  expect(attempt2).toContain(REASK_CORRECTION_INSTRUCTION);
  expect(attempt2).toContain(invalidJson);
  expect(attempt2).toContain('Extractor returned invalid JSON:');
  // Attempt 1 has no correction block; attempt 2 is the SAME prompt + block.
  expect(seenPrompts[0]).not.toContain('=== CORRECTION REQUIRED ===');
  expect(attempt2.startsWith(`${seenPrompts[0]}\n\n=== CORRECTION REQUIRED ===`)).toBe(true);
  // Log contexts: attempt 1 plain, attempt 2 numbered. (The spy bypasses the
  // client's log write, so the on-disk log is not asserted here — the
  // production logging path is covered by the callLLM seams elsewhere.)
  expect(seenContexts).toEqual(['golden-master-part-001', 'golden-master-part-001#attempt2']);
});

// ---------------------------------------------------------------------------
// Gate 12.2: Extractor schema-violation reask
// ---------------------------------------------------------------------------
test('gate 12.2: extractor retries a schema violation with the exact validator message fed back', async () => {
  const workspace = makeTempDir('paper-chase-g12-2-');
  const logPath = join(workspace, 'llm-calls.json');
  const slipped = JSON.stringify(slippedFolderExtraction());
  const valid = JSON.stringify(fakeExtraction());
  const seenPrompts: string[] = [];

  vi.spyOn(await import('../src/llm/client'), 'callLLM').mockImplementation(async (prompt: string) => {
    seenPrompts.push(prompt);
    return seenPrompts.length === 1 ? slipped : valid;
  });

  const result = await extractChunk('chunk text', '1-3', 'raw/golden-master.pdf', 'AGENTS', [], [], {
    logPath,
    context: 'adhd-2022-part-005',
  });
  expect(result.entities).toHaveLength(2);

  expect(seenPrompts).toHaveLength(2);
  const attempt2 = seenPrompts[1];
  // The exact validator message for the slipped seventh entity (index 6).
  expect(attempt2).toContain(
    'entities[6]: folder "products/assessment-tools" must start with "entities/" or "topics/"',
  );
  // The invalid output rides along verbatim.
  expect(attempt2).toContain(slipped);
});

// ---------------------------------------------------------------------------
// Gate 12.3: Extractor exhaustion stays fail-loud
// ---------------------------------------------------------------------------
test('gate 12.3: extractor exhaustion aborts with the pre-Phase-12 schema error after exactly 3 attempts', async () => {
  const workspace = makeTempDir('paper-chase-g12-3-');
  const logPath = join(workspace, 'llm-calls.json');
  const slipped = JSON.stringify(slippedFolderExtraction());
  const seenContexts: Array<string | undefined> = [];

  const spy = vi
    .spyOn(await import('../src/llm/client'), 'callLLM')
    .mockImplementation(async (_prompt: string, _system?: string, options?: { context?: string }) => {
      seenContexts.push(options?.context);
      return slipped;
    });

  let caught: unknown;
  try {
    await extractChunk('chunk text', '1-3', 'raw/golden-master.pdf', 'AGENTS', [], [], {
      logPath,
      context: 'chunk-x',
    });
  } catch (err) {
    caught = err;
  }

  expect(spy).toHaveBeenCalledTimes(3);
  expect(caught).toBeInstanceOf(ExtractorError);
  const message = (caught as Error).message;
  expect(message).toContain('Extractor output failed schema validation:');
  expect(message).toContain(
    'entities[6]: folder "products/assessment-tools" must start with "entities/" or "topics/"',
  );
  expect(seenContexts).toEqual(['chunk-x', 'chunk-x#attempt2', 'chunk-x#attempt3']);
});

// ---------------------------------------------------------------------------
// Gate 12.4: Synthesis reask
// ---------------------------------------------------------------------------
test('gate 12.4: synthesis re-asks with the exact dropped mention in the feedback and replaces the page on success', async () => {
  const workspace = setupWikiWithPdf();
  const droppedMention = 'John Smith, CEO of Acme Corp';
  const seenFeedback: Array<string | undefined> = [];
  const seenAttempts: Array<number | undefined> = [];

  const result = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    extractChunkFn: makeExtractChunkFnStub(),
    synthesizeEntityFn: async (data, _agentsMd, _logPath, _language, feedback, attempt) => {
      if (data.slug !== 'john-smith') {
        // The other entity passes immediately (full preservation shape:
        // verbatim strings plus the citation marker the materializer derived).
        return [
          `Synthesis prose for ${data.title}.`,
          '',
          ...data.mentions.map((mention) => `- Page ${mention.page}: "${mention.context}"`),
          ...data.relationships.map((relationship) => `- ${relationship.evidence}`),
          ...data.claims.map((claim) => `- ${claim.text}`),
          '',
          '[^src1]: golden-master.pdf, pages 1-3',
          '',
        ].join('\n');
      }
      seenFeedback.push(feedback);
      seenAttempts.push(attempt);
      if (attempt === 1) {
        // Preservation-failing page: mentions nothing verbatim from the data.
        return 'A thin summary that preserves none of the required verbatim strings.';
      }
      // Attempt 2: complete page — every verbatim string the preservation
      // check looks for (mentions, relationship evidence, claims) plus the
      // citation marker the materializer derived from the source data.
      return [
        `Synthesis prose for ${data.title}.`,
        '',
        ...data.mentions.map((mention) => `- Page ${mention.page}: "${mention.context}"`),
        ...data.relationships.map((relationship) => `- ${relationship.evidence}`),
        ...data.claims.map((claim) => `- ${claim.text}`),
        '',
        '[^src1]: golden-master.pdf, pages 1-3',
        '',
      ].join('\n');
    },
    // Defensive: the strict stub passes on attempt 2, so the permissive chain
    // link is never reached — but without an injected stub the real permissive
    // writer would make a live LLM call if it ever ran. Topic stubs return a
    // preservation-passing page (claim texts + citation marker) so the topic
    // chain stays out of the repair accounting this gate pins.
    synthesizeEntityPermissiveFn: async () => 'permissive stub (never called)',
    synthesizeTopicFn: async (data) =>
      [
        `Topic synthesis for ${data.title}.`,
        '',
        ...data.claims.map((claim) => `- ${claim.text}`),
        '',
        '[^src1]: golden-master.pdf, pages 1-3',
        '',
      ].join('\n'),
    synthesizeTopicPermissiveFn: async () => 'topic permissive stub (never called)',
  });

  // john-smith needed one repair; acme-corp passed on attempt 1 → both pages
  // are synthesized.
  expect(result.synthesized).toBe(2);
  expect(result.synthesisConflicts).toBe(0);
  expect(seenAttempts).toEqual([1, 2]);
  // Attempt 1 receives no feedback (byte-identical prompt at the writer).
  expect(seenFeedback[0]).toBeUndefined();
  // Attempt 2 carries the exact dropped substring in the correction block.
  const feedback = seenFeedback[1] ?? '';
  expect(feedback).toContain('=== CORRECTION REQUIRED ===');
  expect(feedback).toContain(`Dropped mention (restore this exact text): ${droppedMention}`);
  expect(feedback).toContain('A thin summary that preserves none of the required verbatim strings.');

  const page = readFileSync(
    wikiPath(workspace, 'entities', 'people', 'executives', 'john-smith.md'),
    'utf-8',
  );
  expect(page).toContain(droppedMention);

  const metrics = JSON.parse(readFileSync(wikiPath(workspace, '.state', 'metrics.json'), 'utf-8')) as {
    feedbackRepairs?: number;
  };
  expect(metrics.feedbackRepairs).toBe(1);
});

// ---------------------------------------------------------------------------
// Gate 12.5: DOX Writer reask
// ---------------------------------------------------------------------------
test('gate 12.5: DOX writer re-asks with the missing-section name in the feedback; exhaustion writes the deterministic body', async () => {
  const completeBody = (title: string) =>
    [
      `# ${title}`,
      '',
      'Complete prose.',
      '',
      '## Statistics',
      '',
      '- placeholder',
      '',
      '## Start Here',
      '',
      'Start reading here.',
      '',
      '## Wikis',
      '',
      '- wiki',
      '',
      '## Pages',
      '',
      '- [[index|Index]]',
      '',
      '## Navigation',
      '',
      '- up',
      '',
    ].join('\n');

  // -- success on attempt 2 (root fails once, folders pass first try) --------
  const workspace = makeTempDir('paper-chase-g12-5a-');
  init('test-wiki', { workspace });
  await materialize('test-wiki', { workspace });

  const seenFeedback: Array<string | undefined> = [];
  let rootCalls = 0;
  await writeDoxContracts('test-wiki', {
    workspace,
    doxLlm: true,
    writeDoxIndexFn: async (context, feedback, _attempt) => {
      if (context.folderPath !== '') {
        return completeBody(context.title); // folders pass on attempt 1
      }
      rootCalls++;
      seenFeedback.push(feedback);
      // Attempt 1: markdown missing ## Start Here (a section the ROOT level
      // requires) — the validator rejects it and names the section verbatim.
      return rootCalls === 1
        ? ['# Test Wiki', '', 'Prose.', '', '## Statistics', '', '- placeholder', ''].join('\n')
        : completeBody(context.title);
    },
  });

  expect(rootCalls).toBe(2);
  expect(seenFeedback[0]).toBeUndefined(); // attempt 1: byte-identical prompt
  const feedback = seenFeedback[1] ?? '';
  expect(feedback).toContain('=== CORRECTION REQUIRED ===');
  expect(feedback).toContain('missing required section: ## Start Here');
  // The invalid attempt-1 body rides along verbatim.
  expect(feedback).toContain('Prose.');
  const rootIndex = readFileSync(join(workspace, 'wikis', 'test-wiki', 'index.md'), 'utf-8');
  expect(rootIndex).toContain('## Statistics');

  // -- exhaustion → deterministic body ---------------------------------------
  const workspaceB = makeTempDir('paper-chase-g12-5b-');
  init('test-wiki', { workspace: workspaceB });
  await materialize('test-wiki', { workspace: workspaceB });
  let callsB = 0;
  await writeDoxContracts('test-wiki', {
    workspace: workspaceB,
    doxLlm: true,
    writeDoxIndexFn: async () => {
      callsB++;
      return 'not a contract at all';
    },
  });
  const rootIndexB = readFileSync(join(workspaceB, 'wikis', 'test-wiki', 'index.md'), 'utf-8');
  expect(rootIndexB).toContain('## Statistics');
  expect(rootIndexB).toContain('type: index');
  expect(callsB).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Gate 12.6: Workspace pass + AGENTS.md Updater reask
// ---------------------------------------------------------------------------
test('gate 12.6: updater re-asks with the missing sections in the feedback; exhaustion writes the deterministic fallback', async () => {
  const workspace = await setupIngestedWiki();
  const current = readFileSync(wikiPath(workspace, 'AGENTS.md'), 'utf-8');

  // -- success on attempt 2 -------------------------------------------------
  const seenPrompts: string[] = [];
  let updaterCalls = 0;
  const proposal = await proposeAgentsUpdate('test-wiki', {
    workspace,
    callLLMFn: async (prompt) => {
      updaterCalls++;
      seenPrompts.push(prompt);
      if (updaterCalls === 1) {
        // Missing ## Page Types (and far too short to be a real constitution).
        return 'short proposal without the required structure';
      }
      return `${current}\nReviewed additions.\n`;
    },
  });

  expect(updaterCalls).toBe(2);
  expect(proposal).toContain('## Page Types');
  const attempt2 = seenPrompts[1];
  expect(attempt2).toContain('=== CORRECTION REQUIRED ===');
  expect(attempt2).toContain('missing required section: ## Page Types');
  expect(attempt2).toContain('proposal is too short');
  expect(attempt2).toContain('short proposal without the required structure');
  // Attempt 1 is the bare prompt (no correction block); attempt 2 appends it.
  expect(seenPrompts[0]).not.toContain('=== CORRECTION REQUIRED ===');
  expect(attempt2.startsWith(`${seenPrompts[0]}\n\n=== CORRECTION REQUIRED ===`)).toBe(true);

  // -- exhaustion → deterministic fallback ----------------------------------
  const workspaceB = await setupIngestedWiki();
  let callsB = 0;
  const fallback = await proposeAgentsUpdate('test-wiki', {
    workspace: workspaceB,
    callLLMFn: async () => {
      callsB++;
      return 'still not a constitution';
    },
  });
  expect(callsB).toBe(3);
  expect(fallback).toContain('## Proposed Additions (deterministic fallback)');
  expect(fallback).toContain('### New Folders Created');
});

// ---------------------------------------------------------------------------
// Gate 12.7: Repair-rate accounting + warning
// ---------------------------------------------------------------------------
test('gate 12.7: a run with >=5 repairs warns and writes metrics.feedbackRepairs; below threshold stays quiet; the 25%-of-calls branch warns', async () => {
  // -- ≥5 repairs → warning + metrics ---------------------------------------
  // Failing-once stub: every FOLDER index fails attempt 1 missing required
  // sections and passes attempt 2. The fixture wiki materializes 8 folders
  // (documents, sources, entities, entities/companies, entities/people,
  // entities/people/executives, topics, topics/financial) → exactly 8 repairs
  // (≥5 absolute branch); the root passes first try. The llm-calls log is
  // seeded with 40 entries so the >25% ratio branch (8/40 = 20%) does NOT
  // hold — only the absolute ≥5 branch fires, and metrics.feedbackRepairs is
  // exact.
  const workspace = setupWikiWithPdf();
  const progressLines: string[] = [];
  const seedLog = join(workspace, 'wikis', 'test-wiki', '.state', 'llm-calls.json');
  // countLlmCallsSince(dir, runStartedAt) counts entries at/AFTER the run's
  // start timestamp. The seeds must therefore be timestamped at/after
  // runStartedAt — but runStartedAt is captured inside the run, a few ms after
  // this setup line. Timestamp the seeds slightly in the FUTURE so they
  // unambiguously land inside the run's window regardless of that ε.
  const seedTimestamp = new Date(Date.now() + 60_000).toISOString();
  mkdirSync(dirname(seedLog), { recursive: true });
  writeFileSync(
    seedLog,
    Array.from({ length: 40 }, (_, index) =>
      JSON.stringify({ timestamp: seedTimestamp, callType: 'extractor', context: `seed-${index}` }),
    ).join('\n') + '\n',
    'utf-8',
  );
  let doxCalls = 0;
  await ingest('test-wiki', {
    workspace,
    extractChunkFn: makeExtractChunkFnStub(),
    doxLlm: true,
    onProgress: (message) => progressLines.push(message),
    writeDoxIndexFn: async (context, _feedback, attempt) => {
      doxCalls++;
      if (context.folderPath !== '' && attempt === 1) {
        return '# Broken\n\nNo required sections here.\n';
      }
      return [
        `# ${context.title}`,
        '',
        'Prose.',
        '',
        '## Statistics',
        '',
        '- placeholder',
        '',
        '## Start Here',
        '',
        '- start',
        '',
        '## Wikis',
        '',
        '- wiki',
        '',
        '## Pages',
        '',
        '- [[index|Index]]',
        '',
        '## Navigation',
        '',
        '- up',
        '',
      ].join('\n');
    },
    writeWorkspaceIndexFn: async () => 'A workspace entry description.',
    writeWorkspaceProseFn: async () => 'Cross-wiki prose.',
  });

  const warning = progressLines.find((line) => line.includes('validator-feedback repair'));
  expect(warning).toBeDefined();
  expect(warning).toMatch(/Warning: 8 of \d+ LLM calls this run needed validator-feedback repair/);
  const metrics = JSON.parse(readFileSync(wikiPath(workspace, '.state', 'metrics.json'), 'utf-8')) as {
    feedbackRepairs?: number;
  };
  expect(metrics.feedbackRepairs).toBe(8);
  expect(doxCalls).toBeGreaterThan(0);

  // -- below threshold → no warning ------------------------------------------
  const workspaceB = setupWikiWithPdf();
  const progressB: string[] = [];
  await ingest('test-wiki', {
    workspace: workspaceB,
    extractChunkFn: makeExtractChunkFnStub(),
    onProgress: (message) => progressB.push(message),
  });
  expect(progressB.some((line) => line.includes('validator-feedback repair'))).toBe(false);
  const metricsB = JSON.parse(
    readFileSync(wikiPath(workspaceB, '.state', 'metrics.json'), 'utf-8'),
  ) as { feedbackRepairs?: number };
  expect(metricsB.feedbackRepairs).toBe(0);

  // -- 25%-of-calls branch: 1 repair against 3 logged calls → warning --------
  const workspaceC = setupWikiWithPdf();
  const progressC: string[] = [];
  const llmLogC = join(workspaceC, 'wikis', 'test-wiki', '.state', 'llm-calls.json');
  // Future-timestamped so the seeds land at/after the run's runStartedAt (the
  // count includes entries >= runStartedAt; see scenario A above).
  const now = new Date(Date.now() + 60_000).toISOString();
  mkdirSync(dirname(llmLogC), { recursive: true });
  writeFileSync(
    llmLogC,
    [
      JSON.stringify({ timestamp: now, callType: 'extractor', context: 'seed-1' }),
      JSON.stringify({ timestamp: now, callType: 'extractor', context: 'seed-2' }),
      JSON.stringify({ timestamp: now, callType: 'extractor', context: 'seed-3' }),
      '',
    ].join('\n'),
    'utf-8',
  );
  await ingest('test-wiki', {
    workspace: workspaceC,
    extractChunkFn: makeExtractChunkFnStub(),
    doxLlm: true,
    onProgress: (message) => progressC.push(message),
    // Exactly one repair: the root fails once, everything else passes first try.
    writeDoxIndexFn: async (context, _feedback, attempt) => {
      if (context.folderPath === '' && attempt === 1) {
        return '# Broken\n\nNo required sections here.\n';
      }
      return [
        `# ${context.title}`,
        '',
        'Prose.',
        '',
        '## Statistics',
        '',
        '- placeholder',
        '',
        '## Start Here',
        '',
        '- start',
        '',
        '## Pages',
        '',
        '- [[index|Index]]',
        '',
        '## Navigation',
        '',
        '- up',
        '',
      ].join('\n');
    },
    writeWorkspaceIndexFn: async () => 'A workspace entry description.',
    writeWorkspaceProseFn: async () => 'Cross-wiki prose.',
  });
  const warningC = progressC.find((line) => line.includes('validator-feedback repair'));
  expect(warningC).toBeDefined();
  expect(warningC).toMatch(/Warning: 1 of [3-9]\d* LLM calls this run needed validator-feedback repair/);
});

// ---------------------------------------------------------------------------
// Gate 12.8: HTTP 4xx never re-asked
// ---------------------------------------------------------------------------
test('gate 12.8: a mocked 404 reaches the extractor exactly once and no correction prompt is composed', async () => {
  // Helper level: a throwing runLlm propagates on the first attempt — the
  // loop is never entered for transport errors.
  let helperCalls = 0;
  await expect(
    runWithFeedbackRetry(
      async () => {
        helperCalls++;
        throw new Error('Anthropic API error (HTTP 404): {"error":{"message":"model not found"}}');
      },
      () => ({ valid: false, errors: ['unused'] }),
      { label: 'helper-level-4xx' },
    ),
  ).rejects.toThrow('HTTP 404');
  expect(helperCalls).toBe(1);

  // Client level: the REAL extractChunk → callLLM → mocked undici 404. A FAKE
  // key is set so the client reaches the transport; the 404 must surface as a
  // plain HTTP error (not an ExtractorError) after exactly ONE request.
  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'gate-12-8-fake-key';
  // Neutralize any provider routing a repo-local settings file may have left
  // in effect — this test must reach the mocked Anthropic transport.
  setModelRouting({
    provider: 'anthropic',
    default: 'claude-haiku-4-5-20251001',
    extractor: null,
    synthesis: null,
    dox: null,
  });
  const seenBodies: string[] = [];
  mockUndiciRequest.mockImplementation(async (_url: unknown, options: unknown) => {
    seenBodies.push((options as { body: string }).body);
    return {
      statusCode: 404,
      body: { json: async () => ({ error: { message: 'model not found' } }) },
    } as never;
  });
  try {
    let caught: unknown;
    try {
      await extractChunk('chunk text', '1-3', 'raw/golden-master.pdf', 'AGENTS', [], [], {
        context: 'chunk-404',
      });
    } catch (err) {
      caught = err;
    }
    expect(mockUndiciRequest).toHaveBeenCalledTimes(1);
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(ExtractorError);
    expect((caught as Error).message).toContain('HTTP 404');
    // The single request body carries the bare attempt-1 prompt — no
    // correction block was ever composed.
    expect(seenBodies).toHaveLength(1);
    expect(seenBodies[0]).not.toContain('=== CORRECTION REQUIRED ===');
  } finally {
    if (savedKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  }
});

// ---------------------------------------------------------------------------
// Helper-level contract pins (LLM-free): correction block shape and the
// attempt/byte-identity loop semantics every site composes.
// ---------------------------------------------------------------------------
test('gate 12.x (helper): buildCorrectionBlock carries the instruction, exact errors, and invalid output verbatim', () => {
  const block = buildCorrectionBlock('THE INVALID OUTPUT', [
    'first exact error',
    'second exact error',
  ]);
  expect(block).toBe(
    [
      '=== CORRECTION REQUIRED ===',
      REASK_CORRECTION_INSTRUCTION,
      '',
      'Validation errors:',
      '- first exact error',
      '- second exact error',
      '',
      'Your previous output:',
      'THE INVALID OUTPUT',
      '=== END CORRECTION ===',
    ].join('\n'),
  );
});

test('gate 12.x (helper): runWithFeedbackRetry gives attempt 1 null feedback, numbers attempts, and stops at exhaustion', async () => {
  const seen: Array<{ feedback: string | null; attempt: number }> = [];
  const outcome = await runWithFeedbackRetry<string>(
    async (feedback, attempt) => {
      seen.push({ feedback, attempt });
      return attempt === 3 ? 'good' : 'bad';
    },
    (output) =>
      output === 'good'
        ? { valid: true, errors: [] }
        : { valid: false, errors: [`error-for-${output}`] },
    { label: 'helper-loop' },
  );
  expect(outcome.output).toBe('good');
  expect(outcome.attempts).toBe(3);
  expect(seen.map((entry) => entry.attempt)).toEqual([1, 2, 3]);
  expect(seen[0].feedback).toBeNull();
  expect(seen[1].feedback).toContain('- error-for-bad');
  expect(seen[1].feedback).toContain('bad');

  // Exhaustion: maxAttempts reached with no valid output → output null, the
  // final errors preserved, and no fourth call.
  let calls = 0;
  const exhausted = await runWithFeedbackRetry<string>(
    async () => {
      calls++;
      return 'never valid';
    },
    () => ({ valid: false, errors: ['always failing'] }),
    { label: 'helper-exhaustion' },
  );
  expect(calls).toBe(3);
  expect(exhausted.output).toBeNull();
  expect(exhausted.attempts).toBe(3);
  expect(exhausted.lastErrors).toEqual(['always failing']);
});
