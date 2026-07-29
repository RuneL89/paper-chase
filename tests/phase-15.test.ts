import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { afterAll, afterEach, expect, test, vi } from 'vitest';
import { request as undiciRequest } from 'undici';
import { ingest, SYNTHESIS_POOL_SIZE } from '../src/commands/ingest';
import { init } from '../src/commands/init';
import { runPool } from '../src/utils/worker-pool';
import { callLLM, setModelRouting } from '../src/llm/client';
import type { ChunkExtraction } from '../src/commands/extract-chunk';
import type { ExtractorResult } from '../src/agents/extractor';
import type { CurationOutcome } from '../src/agents/curation';
import type { EntityPageData } from '../src/pages/entity-page';
import type { TopicPageData } from '../src/pages/topic-page';

/**
 * Phase 15 gates 15.1–15.7 (synthesis concurrency, phase doc §3; canon:
 * vision `04` §1 concurrency note + optimizations.md L5 user-narrowed
 * scope — ONLY entity/topic synthesis pooled, fixed cap 4). EVERY gate is
 * LLM-free ($0): the synthesis chain is exercised through the injected
 * `synthesize*Fn` seams with controllable async delays, and the one gate
 * that drives the REAL `callLLM` (15.3, to prove the serialized
 * `llm-calls.json` append queue) mocks the undici transport with a FAKE
 * key — no live call can happen even with a key present.
 *
 * Gate 15.7 (full-suite regression: `npx tsc --noEmit` clean + key-less
 * `npm test` green, existing ingest/synthesis gates passing UNMODIFIED
 * because pool semantics reduce to sequential semantics for instant stubs)
 * is encoded by this file being part of the suite; its pass/fail evidence
 * is recorded in `.state/phase-15-status.json`.
 *
 * Delay-stub convention: pool work is forced to overlap with real
 * `setTimeout` delays (never wall-clock assertions — the in-flight counter
 * proves the cap and the overlap). Report byte-stability in gate 15.2 is
 * pinned by faking ONLY `Date` (timers stay real so delays still work).
 */

vi.mock('undici', () => ({ request: vi.fn() }));
const mockUndiciRequest = vi.mocked(undiciRequest);

const GOLDEN_MASTER_PDF = 'test-pdfs/golden-master.pdf';
const tempDirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
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

function wikiPath(workspace: string, ...parts: string[]): string {
  return join(workspace, 'wikis', 'test-wiki', ...parts);
}

/** Init a wiki and copy the golden master into raw/ (phase-12 harness). */
function setupWikiWithPdf(): string {
  const workspace = makeTempDir('paper-chase-g15-');
  init('test-wiki', { workspace });
  const wikiDir = wikiPath(workspace);
  mkdirSync(join(wikiDir, 'raw'), { recursive: true });
  copyFileSync(GOLDEN_MASTER_PDF, join(wikiDir, 'raw', 'golden-master.pdf'));
  return workspace;
}

const delay = (ms: number): Promise<void> => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/**
 * N entities (`entity-0`…`entity-N`, one mention each) plus two claims per
 * requested topic type (attached to entity-0), so materialize produces N
 * entity pages and one topic page per type.
 */
function buildExtraction(entityCount: number, topicTypes: string[] = []): ExtractorResult {
  const entities = Array.from({ length: entityCount }, (_, index) => ({
    name: `Entity ${index}`,
    type: 'person',
    slug: `entity-${index}`,
    folder: 'entities/people',
    significance: `Significance for entity ${index}`,
    mentions: [{ page: 1, context: `Mention context for entity ${index}` }],
  }));
  const claims = topicTypes.flatMap((type) =>
    [0, 1].map((kind) => ({
      text: `Claim ${kind} for topic ${type}`,
      type,
      entities: ['entity-0'],
      page: 2,
    })),
  );
  return {
    entities,
    relationships: [],
    claims,
    timeline: [],
    context: 'Phase 15 fixture extraction.',
  };
}

/** Injected Layer 2 stub: writes the extraction JSON exactly like the real path. */
function makeExtractChunkFnStub(extraction: ExtractorResult) {
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

/** Preservation-passing synthesized entity page (phase-12 harness shape). */
function passingEntityPage(data: EntityPageData): string {
  return [
    `Synthesis prose for ${data.title}.`,
    '',
    ...data.mentions.map((mention) => `- Page ${mention.page}: "${mention.context}" [^src1]`),
    ...data.relationships.map((relationship) => `- ${relationship.evidence} [^src1]`),
    ...data.claims.map((claim) => `- ${claim.text} [^src1]`),
    '',
    '[^src1]: golden-master.pdf, pages 1-3',
    '',
  ].join('\n');
}

/** Preservation-passing synthesized topic page. */
function passingTopicPage(data: TopicPageData): string {
  return [
    `Topic synthesis for ${data.title}.`,
    '',
    ...data.claims.map((claim) => `- ${claim.text} [^src1]`),
    '',
    '[^src1]: golden-master.pdf, pages 1-3',
    '',
  ].join('\n');
}

interface SynthesisReportEntryShape {
  pageType: string;
  slug: string;
  strict: { attempted: boolean; passed: boolean; attempts?: number };
  permissive: { attempted: boolean; passed: boolean; attempts?: number };
  finalMode: string;
}

/**
 * Phase 14 keep-all curation stub (the phase-14 harness shape): injected at
 * every ingest call below because `synthesis: true` enables the curation
 * stage — stubbing it keeps these gates deterministic and LLM-free even
 * when a fake key + mocked transport are active (gate 15.3), where the real
 * curation calls would otherwise log extra llm-calls.json lines.
 */
function keepAllOutcome(): CurationOutcome {
  return { decisions: { merges: [], drops: [], keep: [] }, attempts: 1, fallbacks: [], vetoes: [] };
}

const CURATION_STUBS = {
  curateTopicsFn: async () => keepAllOutcome(),
  curateEntitiesFn: async () => keepAllOutcome(),
};

function readReportEntries(workspace: string): SynthesisReportEntryShape[] {
  const raw = readFileSync(wikiPath(workspace, '.state', 'synthesis-report.json'), 'utf-8');
  return (JSON.parse(raw) as { entries: SynthesisReportEntryShape[] }).entries;
}

// ---------------------------------------------------------------------------
// Gate 15.1: Pool cap is hard
// ---------------------------------------------------------------------------
test('gate 15.1: a 20-page run never exceeds 4 in-flight, overlaps, and completes every page', async () => {
  const workspace = setupWikiWithPdf();
  let inFlight = 0;
  let maxInFlight = 0;
  const enter = () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
  };
  const exit = () => {
    inFlight -= 1;
  };

  const result = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    // Phase 16: disable the 250ms dispatch stagger so these pool-SEMANTICS
    // gates keep their overlap/scramble timing (the stagger itself is gate 16.8).
    poolStaggerMs: 0,
    ...CURATION_STUBS,
    extractChunkFn: makeExtractChunkFnStub(buildExtraction(20, ['financial', 'governance', 'audits'])),
    synthesizeEntityFn: async (data) => {
      enter();
      try {
        await delay(5 + Math.random() * 20);
        return passingEntityPage(data);
      } finally {
        exit();
      }
    },
    synthesizeEntityPermissiveFn: async () => {
      throw new Error('permissive entity chain must not run — strict passes for every page');
    },
    synthesizeTopicFn: async (data) => {
      enter();
      try {
        await delay(5 + Math.random() * 20);
        return passingTopicPage(data);
      } finally {
        exit();
      }
    },
    synthesizeTopicPermissiveFn: async () => {
      throw new Error('permissive topic chain must not run — strict passes for every page');
    },
  });

  // All 20 entity pages + 3 topic pages complete.
  expect(result.synthesized).toBe(20);
  expect(result.synthesizedTopics).toBe(3);
  expect(result.synthesisConflicts).toBe(0);
  expect(result.topicConflicts).toBe(0);
  // The hard cap: the shared in-flight counter never exceeded 4 at any await
  // point; the overlap (max > 1) proves the pool actually ran concurrently
  // (the counter, not a wall-clock bound — in practice the cap is reached
  // because the first four tasks start before the event loop turns).
  expect(maxInFlight).toBeLessThanOrEqual(SYNTHESIS_POOL_SIZE);
  expect(maxInFlight).toBeGreaterThan(1);
});

// ---------------------------------------------------------------------------
// Gate 15.2: Deterministic report order under scrambled completion
// ---------------------------------------------------------------------------
test('gate 15.2: synthesis-report entries stay in original page order under scrambled completion and are byte-stable', async () => {
  // Fake ONLY Date so entry timestamps are fixed; setTimeout stays real so
  // the delay stubs still scramble completion order.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-07-24T12:00:00.000Z'));

  const runOnce = async (delayFor: (index: number) => number) => {
    const workspace = setupWikiWithPdf();
    const entityStartOrder: string[] = [];
    const topicStartOrder: string[] = [];
    await ingest('test-wiki', {
      workspace,
      synthesis: true,
      // Phase 16: stagger disabled — see gate 15.1 note.
      poolStaggerMs: 0,
      ...CURATION_STUBS,
      extractChunkFn: makeExtractChunkFnStub(buildExtraction(12, ['financial', 'governance', 'audits'])),
      synthesizeEntityFn: async (data) => {
        entityStartOrder.push(data.slug);
        await delay(delayFor(Number(data.slug.replace('entity-', ''))));
        return passingEntityPage(data);
      },
      synthesizeEntityPermissiveFn: async () => {
        throw new Error('permissive entity chain must not run');
      },
      synthesizeTopicFn: async (data) => {
        topicStartOrder.push(data.slug);
        await delay(delayFor(data.slug.length * 3 + 1));
        return passingTopicPage(data);
      },
      synthesizeTopicPermissiveFn: async () => {
        throw new Error('permissive topic chain must not run');
      },
    });
    const reportRaw = readFileSync(wikiPath(workspace, '.state', 'synthesis-report.json'), 'utf-8');
    return { workspace, reportRaw, entityStartOrder, topicStartOrder };
  };

  // Two runs with different (deterministic) completion scrambles.
  const runA = await runOnce((index) => 5 + ((index * 7) % 15));
  const runB = await runOnce((index) => 5 + (((index * 11) + 3) % 15));

  // The pool starts tasks in input order, so the recorded invocation order
  // IS the original page order — the report must match it for both stages.
  const entriesA = readReportEntries(runA.workspace);
  expect(entriesA.filter((entry) => entry.pageType === 'entity').map((entry) => entry.slug)).toEqual(
    runA.entityStartOrder,
  );
  expect(entriesA.filter((entry) => entry.pageType === 'topic').map((entry) => entry.slug)).toEqual(
    runA.topicStartOrder,
  );
  // Entity stage entries all precede topic stage entries.
  expect(entriesA.map((entry) => entry.pageType)).toEqual([
    ...runA.entityStartOrder.map(() => 'entity'),
    ...runA.topicStartOrder.map(() => 'topic'),
  ]);
  // Byte-stable across repeated runs despite different completion order
  // (timestamps pinned by the faked Date above).
  expect(runB.reportRaw).toBe(runA.reportRaw);
});

// ---------------------------------------------------------------------------
// Gate 15.3: Serialized JSONL writes
// ---------------------------------------------------------------------------
test('gate 15.3: llm-calls.json has no torn lines under the 4-worker load and conflicts.json loses no entries', async () => {
  const workspace = setupWikiWithPdf();
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  // The REAL callLLM runs inside the synthesis stubs against the mocked
  // transport with a FAKE key, so the production logPath append seam is what
  // the pool stresses. One llm-calls.json line per stub call.
  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'phase-15-fake-key';
  let stubCalls = 0;
  mockUndiciRequest.mockImplementation(async () => {
    await delay(Math.random() * 10);
    return {
      statusCode: 200,
      body: {
        json: async () => ({
          content: [{ type: 'text', text: 'synthesis stub output' }],
          usage: { input_tokens: 12, output_tokens: 34 },
        }),
      },
    } as never;
  });

  try {
    const result = await ingest('test-wiki', {
      workspace,
      synthesis: true,
      // Phase 16: stagger disabled — see gate 15.1 note.
      poolStaggerMs: 0,
      ...CURATION_STUBS,
      extractChunkFn: makeExtractChunkFnStub(buildExtraction(10, ['financial'])),
      // entity-0…4 pass strict on attempt 1; entity-5…9 fail BOTH modes
      // (3 strict + 3 permissive calls each) so five pages log conflicts
      // concurrently.
      synthesizeEntityFn: async (data, _agentsMd, logPath, _language, _feedback, _attempt) => {
        stubCalls += 1;
        await callLLM('strict entity synthesis', undefined, {
          callType: 'synthesis',
          context: data.slug,
          logPath,
        });
        await delay(Math.random() * 15);
        if (Number(data.slug.replace('entity-', '')) >= 5) {
          return 'A thin page that preserves none of the required verbatim strings.';
        }
        return passingEntityPage(data);
      },
      synthesizeEntityPermissiveFn: async (data, _agentsMd, logPath, _language, _feedback, _attempt) => {
        stubCalls += 1;
        await callLLM('permissive entity synthesis', undefined, {
          callType: 'permissive-synthesis',
          context: data.slug,
          logPath,
        });
        await delay(Math.random() * 15);
        return 'A thin permissive page that preserves nothing either.';
      },
      synthesizeTopicFn: async (data, _agentsMd, logPath, _language, _feedback, _attempt) => {
        stubCalls += 1;
        await callLLM('strict topic synthesis', undefined, {
          callType: 'topic-synthesis',
          context: data.slug,
          logPath,
        });
        await delay(Math.random() * 10);
        return passingTopicPage(data);
      },
      synthesizeTopicPermissiveFn: async () => {
        throw new Error('permissive topic chain must not run');
      },
    });

    expect(result.synthesized).toBe(5);
    expect(result.synthesisConflicts).toBe(5);
    expect(result.synthesizedTopics).toBe(1);

    // llm-calls.json: line count equals the number of stub calls and every
    // line parses as a complete JSON record (no torn/interleaved lines).
    const logRaw = readFileSync(wikiPath(workspace, '.state', 'llm-calls.json'), 'utf-8');
    const lines = logRaw.split('\n').filter((line) => line.trim() !== '');
    expect(lines).toHaveLength(stubCalls);
    const contexts = new Set<string>();
    for (const line of lines) {
      const entry = JSON.parse(line) as { callType?: string; context?: string; timestamp?: string };
      expect(typeof entry.timestamp).toBe('string');
      expect(typeof entry.callType).toBe('string');
      contexts.add(`${entry.callType}:${entry.context}`);
    }
    // 5 passing entities ×1 strict call + 5 failing entities ×6 calls + 1 topic = 36.
    expect(stubCalls).toBe(36);
    expect(contexts.size).toBeGreaterThan(0);

    // conflicts.json: the five concurrent preservation-failure appends all
    // survived — valid JSON, one entry per failed page, no lost updates.
    const conflicts = JSON.parse(
      readFileSync(wikiPath(workspace, '.state', 'conflicts.json'), 'utf-8'),
    ) as { conflicts: Array<{ slug: string; pageType: string }> };
    expect(conflicts.conflicts).toHaveLength(5);
    expect(conflicts.conflicts.map((entry) => entry.slug).sort()).toEqual([
      'entity-5',
      'entity-6',
      'entity-7',
      'entity-8',
      'entity-9',
    ]);
    expect(conflicts.conflicts.every((entry) => entry.pageType === 'entity')).toBe(true);
  } finally {
    if (savedKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  }
});

// ---------------------------------------------------------------------------
// Gate 15.4: Per-page semantics unchanged
// ---------------------------------------------------------------------------
test('gate 15.4: strict/permissive/template outcomes, attempt counts, and feedback are sequential-equivalent and independent', async () => {
  const workspace = setupWikiWithPdf();
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const attemptsByKey = new Map<string, number[]>();
  const feedbackByKey = new Map<string, Array<string | undefined>>();
  const record = (key: string, attempt: number | undefined, feedback: string | undefined) => {
    const attempts = attemptsByKey.get(key) ?? [];
    attempts.push(attempt ?? -1);
    attemptsByKey.set(key, attempts);
    const feedbacks = feedbackByKey.get(key) ?? [];
    feedbacks.push(feedback);
    feedbackByKey.set(key, feedbacks);
  };

  // entity-0: strict passes attempt 1. entity-1: strict fails ×3, permissive
  // fails once then passes attempt 2. entity-2: strict fails ×3, permissive
  // fails ×3 → structured template. topic financial: strict passes.
  const result = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    // Phase 16: disable the 250ms dispatch stagger so these pool-SEMANTICS
    // gates keep their overlap/scramble timing (the stagger itself is gate 16.8).
    poolStaggerMs: 0,
    ...CURATION_STUBS,
    extractChunkFn: makeExtractChunkFnStub(buildExtraction(3, ['financial'])),
    synthesizeEntityFn: async (data, _agentsMd, _logPath, _language, feedback, attempt) => {
      record(`strict:${data.slug}`, attempt, feedback);
      await delay(Math.random() * 10);
      if (data.slug === 'entity-0') {
        return passingEntityPage(data);
      }
      return 'A thin page that preserves none of the required verbatim strings.';
    },
    synthesizeEntityPermissiveFn: async (data, _agentsMd, _logPath, _language, feedback, attempt) => {
      record(`permissive:${data.slug}`, attempt, feedback);
      await delay(Math.random() * 10);
      if (data.slug === 'entity-1' && attempt === 2) {
        return passingEntityPage(data);
      }
      return 'A thin permissive page that preserves nothing either.';
    },
    synthesizeTopicFn: async (data) => {
      await delay(Math.random() * 5);
      return passingTopicPage(data);
    },
    synthesizeTopicPermissiveFn: async () => {
      throw new Error('permissive topic chain must not run');
    },
  });

  // Outcome counters exactly as the sequential code produced them.
  expect(result.synthesized).toBe(1);
  expect(result.synthesizedPermissive).toBe(1);
  expect(result.synthesisConflicts).toBe(1);
  expect(result.synthesizedTopics).toBe(1);

  // Reask attempt sequences per page/mode (the real writers compose the
  // `<ctx>#attempt<N>` log contexts from these numbers — phase-12 pins that
  // composition; the pool must not alter the per-page attempt flow).
  expect(attemptsByKey.get('strict:entity-0')).toEqual([1]);
  expect(attemptsByKey.get('strict:entity-1')).toEqual([1, 2, 3]);
  expect(attemptsByKey.get('permissive:entity-1')).toEqual([1, 2]);
  expect(attemptsByKey.get('strict:entity-2')).toEqual([1, 2, 3]);
  expect(attemptsByKey.get('permissive:entity-2')).toEqual([1, 2, 3]);
  // Attempt 1 carries no feedback; attempt 2 carries the correction block
  // with the page's own exact dropped mention (per-page, under the pool).
  expect(feedbackByKey.get('strict:entity-1')?.[0]).toBeUndefined();
  expect(feedbackByKey.get('strict:entity-1')?.[1]).toContain('=== CORRECTION REQUIRED ===');
  expect(feedbackByKey.get('strict:entity-1')?.[1]).toContain(
    'Dropped mention (restore this exact text): Mention context for entity 1',
  );

  // Report entries in original page order with the exact sequential shape.
  const entries = readReportEntries(workspace);
  expect(entries.map((entry) => entry.slug)).toEqual(['entity-0', 'entity-1', 'entity-2', 'financial']);
  expect(entries[0]).toMatchObject({
    pageType: 'entity',
    slug: 'entity-0',
    strict: { attempted: true, passed: true, attempts: 1 },
    permissive: { attempted: false, passed: false },
    finalMode: 'strict-synthesis',
  });
  expect(entries[1]).toMatchObject({
    pageType: 'entity',
    slug: 'entity-1',
    strict: { attempted: true, passed: false, attempts: 3 },
    permissive: { attempted: true, passed: true, attempts: 2 },
    finalMode: 'permissive-synthesis',
  });
  expect(entries[2]).toMatchObject({
    pageType: 'entity',
    slug: 'entity-2',
    strict: { attempted: true, passed: false, attempts: 3 },
    permissive: { attempted: true, passed: false, attempts: 3 },
    finalMode: 'structured-template',
  });
  expect(entries[3]).toMatchObject({
    pageType: 'topic',
    slug: 'financial',
    strict: { attempted: true, passed: true, attempts: 1 },
    permissive: { attempted: false, passed: false },
    finalMode: 'strict-synthesis',
  });

  // One page's fallback does not affect another page's mode: entity-0 is
  // strict-synthesis despite its pool neighbours failing every mode, and
  // only entity-2 lands in conflicts.json.
  const conflicts = JSON.parse(
    readFileSync(wikiPath(workspace, '.state', 'conflicts.json'), 'utf-8'),
  ) as { conflicts: Array<{ slug: string }> };
  expect(conflicts.conflicts.map((entry) => entry.slug)).toEqual(['entity-2']);
  const entityZeroPage = readFileSync(wikiPath(workspace, 'entities', 'people', 'entity-0.md'), 'utf-8');
  expect(entityZeroPage).toContain('Synthesis prose for Entity 0.');

  // Repair accounting under the pool: entity-1 (2 strict + 1 permissive)
  // + entity-2 (2 strict + 2 permissive) = 7 feedback repairs.
  const metrics = JSON.parse(readFileSync(wikiPath(workspace, '.state', 'metrics.json'), 'utf-8')) as {
    feedbackRepairs?: number;
  };
  expect(metrics.feedbackRepairs).toBe(7);

  // The per-page WARNING lines (preservation-failure notices) are kept.
  expect(warnSpy).toHaveBeenCalledWith(
    expect.stringContaining('Strict synthesis failed preservation for entity-1'),
  );
  expect(warnSpy).toHaveBeenCalledWith(
    expect.stringContaining('Strict synthesis failed preservation for entity-2'),
  );
  expect(warnSpy).toHaveBeenCalledWith(
    expect.stringContaining('Permissive synthesis also failed preservation for entity-2'),
  );
});

// ---------------------------------------------------------------------------
// Gate 15.5: Aggregate progress
// ---------------------------------------------------------------------------
test('gate 15.5: the progress stream carries the aggregate N/M (4 workers) counter to M/M for both stages, with no per-page spam', async () => {
  const workspace = setupWikiWithPdf();
  const progressLines: string[] = [];

  await ingest('test-wiki', {
    workspace,
    synthesis: true,
    // Phase 16: disable the 250ms dispatch stagger so these pool-SEMANTICS
    // gates keep their overlap/scramble timing (the stagger itself is gate 16.8).
    poolStaggerMs: 0,
    ...CURATION_STUBS,
    onProgress: (message) => progressLines.push(message),
    extractChunkFn: makeExtractChunkFnStub(buildExtraction(8, ['financial', 'governance', 'audits'])),
    synthesizeEntityFn: async (data) => {
      await delay(Math.random() * 10);
      return passingEntityPage(data);
    },
    synthesizeEntityPermissiveFn: async () => {
      throw new Error('permissive entity chain must not run');
    },
    synthesizeTopicFn: async (data) => {
      await delay(Math.random() * 10);
      return passingTopicPage(data);
    },
    synthesizeTopicPermissiveFn: async () => {
      throw new Error('permissive topic chain must not run');
    },
  });

  const counterPattern = new RegExp(
    `^Synthesis: (\\d+)/(\\d+) pages complete \\(${SYNTHESIS_POOL_SIZE} workers\\)$`,
  );
  const counterLines = progressLines.filter((line) => counterPattern.test(line));
  const entityLines = counterLines.filter((line) => line.includes('/8 pages complete'));
  const topicLines = counterLines.filter((line) => line.includes('/3 pages complete'));

  // One re-emission per completion, N climbing 1..M in completion order.
  expect(entityLines).toHaveLength(8);
  expect(entityLines.map((line) => Number(counterPattern.exec(line)?.[1]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  expect(topicLines).toHaveLength(3);
  expect(topicLines.map((line) => Number(counterPattern.exec(line)?.[1]))).toEqual([1, 2, 3]);
  // Reaches M/M for both stages, entity stage before topic stage.
  expect(counterLines).toContain(`Synthesis: 8/8 pages complete (${SYNTHESIS_POOL_SIZE} workers)`);
  expect(counterLines).toContain(`Synthesis: 3/3 pages complete (${SYNTHESIS_POOL_SIZE} workers)`);
  const lastEntityLine = progressLines.lastIndexOf(`Synthesis: 8/8 pages complete (${SYNTHESIS_POOL_SIZE} workers)`);
  const firstTopicLine = progressLines.indexOf(`Synthesis: 1/3 pages complete (${SYNTHESIS_POOL_SIZE} workers)`);
  expect(lastEntityLine).toBeGreaterThanOrEqual(0);
  expect(firstTopicLine).toBeGreaterThan(lastEntityLine);

  // No per-page spam from the pool path: no line names an individual page,
  // and the pre-Phase-15 per-stage "Writing synthesis for…" line is gone.
  expect(progressLines.some((line) => line.includes('entity-'))).toBe(false);
  expect(progressLines.some((line) => line.includes('Writing synthesis'))).toBe(false);
});

// ---------------------------------------------------------------------------
// Gate 15.6: Sequential stages untouched
// ---------------------------------------------------------------------------
test('gate 15.6: extraction/curation/DOX/workspace/updater contain no runPool, the cap is a fixed constant, and DOX stays single-flight', async () => {
  // Source-level proof: runPool is used only by the synthesis stages — and
  // never in the ratified-sequential stages. Phase 22 gate 22.10 (enumerated
  // touch): the count grows 2 → 3 — the composite synthesis stage pools too
  // (the same bounded-pool contract at the same fixed cap).
  // Phase 23 (enumerated touch): the count grows 3 → 4 — the comparison
  // synthesis stage pools too (the same bounded-pool contract, same cap).
  const ingestSource = readFileSync('src/commands/ingest.ts', 'utf-8');
  expect(ingestSource.match(/await runPool\(/g) ?? []).toHaveLength(4);
  for (const file of [
    'src/materializer.ts',
    'src/dox-writer.ts',
    'src/agents/curation.ts',
    'src/agents/agents-updater.ts',
    'src/commands/extract-chunk.ts',
  ]) {
    expect(readFileSync(file, 'utf-8').includes('runPool')).toBe(false);
  }
  // Fixed cap, NOT a Settings field (ratified scope).
  expect(ingestSource).toContain('SYNTHESIS_POOL_SIZE = 4');
  expect(SYNTHESIS_POOL_SIZE).toBe(4);
  expect(readFileSync('src/tui/settings.ts', 'utf-8').includes('SYNTHESIS_POOL_SIZE')).toBe(false);
  expect(readFileSync('src/tui/settings-screen.tsx', 'utf-8').includes('SYNTHESIS_POOL_SIZE')).toBe(false);

  // Behavioral proof: a stubbed DOX writeDoxIndexFn in-flight counter never
  // exceeds 1 during a full pooled ingest; extraction (3 chunks at
  // pagesPerChunk 1, delay-stubbed) never exceeds 1 either.
  const workspace = setupWikiWithPdf();
  let doxInFlight = 0;
  let maxDoxInFlight = 0;
  let extractInFlight = 0;
  let maxExtractInFlight = 0;
  // Three chunks at pagesPerChunk 1; each chunk contributes a DISJOINT slice
  // of the fixture (two entities; the claims ride chunk 1) so no entity
  // accumulates cross-chunk duplicate mentions — those would carry distinct
  // (file, pages) provenance and need multiple citation keys, which the
  // one-key passing page used by every gate in this file does not provide.
  const chunkExtraction = (chunkId: string): ExtractorResult => {
    const part = Number(chunkId.split('-').pop() ?? '1');
    const start = (part - 1) * 2;
    return {
      entities: [0, 1].map((offset) => ({
        name: `Entity ${start + offset}`,
        type: 'person',
        slug: `entity-${start + offset}`,
        folder: 'entities/people',
        significance: `Significance for entity ${start + offset}`,
        mentions: [{ page: 1, context: `Mention context for entity ${start + offset}` }],
      })),
      relationships: [],
      claims:
        part === 1
          ? [0, 1].map((kind) => ({
              text: `Claim ${kind} for topic financial`,
              type: 'financial',
              entities: ['entity-0'],
              page: 1,
            }))
          : [],
      timeline: [],
      context: 'Phase 15 gate 15.6 fixture extraction.',
    };
  };

  await ingest('test-wiki', {
    workspace,
    synthesis: true,
    // Phase 16: disable the 250ms dispatch stagger so these pool-SEMANTICS
    // gates keep their overlap/scramble timing (the stagger itself is gate 16.8).
    poolStaggerMs: 0,
    ...CURATION_STUBS,
    pagesPerChunk: 1,
    doxLlm: true,
    extractChunkFn: async (wikiDir, chunkId) => {
      extractInFlight += 1;
      maxExtractInFlight = Math.max(maxExtractInFlight, extractInFlight);
      try {
        await delay(10);
        return await makeExtractChunkFnStub(chunkExtraction(chunkId))(wikiDir, chunkId);
      } finally {
        extractInFlight -= 1;
      }
    },
    synthesizeEntityFn: async (data) => {
      await delay(5);
      return passingEntityPage(data);
    },
    synthesizeEntityPermissiveFn: async () => {
      throw new Error('permissive entity chain must not run');
    },
    synthesizeTopicFn: async (data) => {
      await delay(5);
      return passingTopicPage(data);
    },
    synthesizeTopicPermissiveFn: async () => {
      throw new Error('permissive topic chain must not run');
    },
    writeDoxIndexFn: async (context) => {
      doxInFlight += 1;
      maxDoxInFlight = Math.max(maxDoxInFlight, doxInFlight);
      try {
        await delay(10);
        // Complete catalog body (2026-07-25): every supplied target present,
        // so the body passes on attempt 1 without validator-feedback retries.
        const catalog = [
          ...context.childIndexes.map((child) => `- ${child.linkText} — child area`),
          ...context.pages.map((page) => `- ${page.linkText} — a page`),
        ].join('\n');
        const sections = context.isRoot
          ? `## Start Here\n\n- start\n\n## Pages\n\n${catalog}`
          : `## Pages\n\n${catalog}\n\n## Navigation\n\n- up`;
        return [`# ${context.title}`, '', 'Prose.', '', sections, '', '## Statistics', '', '- placeholder', ''].join(
          '\n',
        );
      } finally {
        doxInFlight -= 1;
      }
    },
    writeWorkspaceIndexFn: async () => 'A workspace entry description.',
    writeWorkspaceProseFn: async () => 'Cross-wiki prose.',
  });

  expect(maxDoxInFlight).toBe(1);
  expect(maxExtractInFlight).toBe(1);
});

// ---------------------------------------------------------------------------
// Supplementary (§2.1 contract): runPool input-order results and
// fail-after-settle rejection semantics, at the helper level.
// ---------------------------------------------------------------------------
test('supplementary: runPool returns results in input order under scrambled completion and rejects after in-flight settles', async () => {
  // Reverse-weighted delays (later items finish first) — results must come
  // back in INPUT order regardless of completion order.
  const items = Array.from({ length: 10 }, (_, index) => index);
  const results = await runPool(
    items,
    async (item) => {
      await delay((10 - item) * 3);
      return item * 100;
    },
    { concurrency: 4 },
  );
  expect(results).toEqual(items.map((item) => item * 100));

  // A rejected item rejects the pool after the in-flight workers settle;
  // items not yet started never start.
  const started: number[] = [];
  const settled: number[] = [];
  const pool = runPool(
    [0, 1, 2, 3, 4, 5],
    async (item) => {
      started.push(item);
      if (item === 2) {
        await delay(1);
        throw new Error('boom');
      }
      await delay(25);
      settled.push(item);
      return item;
    },
    { concurrency: 4 },
  );
  await expect(pool).rejects.toThrow('boom');
  // The first four items started; items 4 and 5 never started after the
  // failure; the three in-flight siblings settled before the pool rejected.
  expect(started.sort()).toEqual([0, 1, 2, 3]);
  expect(settled.sort()).toEqual([0, 1, 3]);
});
