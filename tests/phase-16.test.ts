import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { afterAll, afterEach, expect, test, vi } from 'vitest';
import { request as undiciRequest } from 'undici';
import {
  ingest,
  SYNTHESIS_POOL_SIZE,
  SYNTHESIS_POOL_STAGGER_MS,
  TRANSPORT_OUTAGE_CONSECUTIVE_LIMIT,
  TRANSPORT_OUTAGE_RATE,
} from '../src/commands/ingest';
import { init } from '../src/commands/init';
import { runPool } from '../src/utils/worker-pool';
import {
  callLLM,
  setModelRouting,
  setTransportRetrySleeper,
  transportRetryDelayMs,
  isTransientTransportError,
  LARGE_CALL_HEADERS_TIMEOUT_MS,
  LARGE_CALL_MAX_TOKENS,
  TRANSIENT_MAX_ATTEMPTS,
  transientStallDelayMs,
  setStallWaitReporter,
  transportStallsLogPath,
  parseRetryAfterSeconds,
  RETRY_AFTER_MAX_SECONDS,
  type StallWaitInfo,
} from '../src/llm/client';
import {
  curateTopics,
  estimateDecisionListTokens,
  validateEntityDecisions,
  validateTopicDecisions,
  CURATION_SINGLE_CALL_LIMIT,
  CURATION_SIZE_TRIGGER_TOKENS,
  type CurationOutcome,
  type TopicCurationCandidate,
} from '../src/agents/curation';
import { materialize } from '../src/materializer';
import {
  pageDataHash,
  recordSynthesisPage,
  synthesisPagePath,
} from '../src/state/synthesis-state';
import type { ChunkExtraction } from '../src/commands/extract-chunk';
import type { ExtractorResult } from '../src/agents/extractor';
import type { EntityPageData } from '../src/pages/entity-page';
import type { TopicPageData } from '../src/pages/topic-page';

/**
 * Phase 16 gates 16.1–16.12 (run resilience, phase doc §3; canon: vision
 * `04` §6 per-page transport fallback + outage detector, Step 9 synthesis
 * resume, Step 11 per-PDF checkpointing, §1 pool transport tuning, Step 6
 * decision-list sizing; vision `07` §2.3/§5). EVERY gate is LLM-free ($0):
 * synthesis chains run through injected `synthesize*Fn` stubs whose thrown
 * errors simulate the client's post-retry exhaustion; the two gates that
 * drive the REAL `callLLM` (16.8 timeout/backoff) mock the undici transport
 * with a FAKE key, and the backoff/stagger waits are observed through
 * injected sleepers and clocks — never wall-clock assertions.
 *
 * Convention: every ingest call passes `poolStaggerMs: 0` so the 250ms
 * production dispatch stagger never slows the gates; the stagger itself is
 * proven in gate 16.8 with an injected clock. Most synthesis stubs are
 * synchronous; gate 16.2 (where outage-detector streaks depend on pool
 * COMPLETION order) uses per-index increasing delays so completions are
 * strictly index-ordered (pickup times are non-decreasing in index, so the
 * delay gaps keep completion gaps positive — never a wall-clock assertion).
 * The per-page synthesis-record write rides the serialized queue with real
 * fs, so kill-and-resume gates rely on pickup order (always index order via
 * the shared counter) plus the pool's settle-before-reject guarantee, never
 * on completion order.
 *
 * Outage-detector arithmetic the fixtures rely on (ratified rule: abort when
 * consecutive transport failures reach 5, or failures EXCEED 10% of the
 * stage's attempted pages): 1/10 = 10% exactly does NOT exceed, so a
 * 10-page stage tolerates exactly one transport-failed page; 2 failures need
 * two 10-page stages (one each — gate 16.1) or a 20+ page stage; 3/20 = 15%
 * aborts while 1/20 = 5% completes (gate 16.3).
 *
 * Gate 16.12 (full-suite regression: `npx tsc --noEmit` clean + key-less
 * `npm test` green, pre-existing tests untouched except the enumerated
 * semantic updates recorded in `.state/phase-16-status.json`) is encoded by
 * this file being part of the suite.
 *
 * Phase 16 v1.0.3 (user directive 2026-08-22) re-casts gates 16.13–16.17:
 * the reactive 429/5xx stall — an opted-in caller's HTTP 429 or 5xx gets
 * TRANSIENT_MAX_ATTEMPTS total attempts with the escalating
 * `transientStallDelayMs` floor (1/5/15/45/90 min, ~2.6 h of waiting), a
 * provider Retry-After header still wins when larger on 429, network errors
 * keep the caller's bound and the exponential backoff, and the stall
 * surfaces on the ingest progress channel via the `setStallWaitReporter`
 * seam (cleared when the run ends). All waits go through the injected
 * sleeper — never wall-clock.
 */

vi.mock('undici', () => ({ request: vi.fn() }));
const mockUndiciRequest = vi.mocked(undiciRequest);

const GOLDEN_MASTER_PDF = 'test-pdfs/golden-master.pdf';
const tempDirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  setModelRouting(null);
  setTransportRetrySleeper(null);
  setStallWaitReporter(null);
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

/** Init a wiki and copy the golden master into raw/ (phase-15 harness). */
function setupWikiWithPdf(): string {
  const workspace = makeTempDir('paper-chase-g16-');
  init('test-wiki', { workspace });
  const wikiDir = wikiPath(workspace);
  mkdirSync(join(wikiDir, 'raw'), { recursive: true });
  copyFileSync(GOLDEN_MASTER_PDF, join(wikiDir, 'raw', 'golden-master.pdf'));
  return workspace;
}

// ---------------------------------------------------------------------------
// Error fixtures — the exact shapes src/llm/client.ts throws (both providers'
// messages match these patterns), representing EXHAUSTED bounded retries.
// ---------------------------------------------------------------------------

/** Transient: network/timeout class still throwing after the bounded retries. */
function exhaustedTimeoutError(): Error {
  return new Error('Anthropic API transport error after 3 attempt(s): Headers Timeout Error');
}

/** Transient: HTTP 429 still throwing after the bounded retries. */
function exhausted429Error(): Error {
  return new Error('Anthropic API error (HTTP 429): {"error":{"message":"rate limited"}}');
}

/** Deterministic: HTTP 404 — NEVER retried, NEVER falls back per page. */
function http404Error(): Error {
  return new Error('Anthropic API error (HTTP 404): {"error":{"message":"model not found"}}');
}

// ---------------------------------------------------------------------------
// Shared fixtures (phase-15 harness shapes)
// ---------------------------------------------------------------------------

/** N entities (entity-0..entity-N, one mention each) plus two claims per topic type. */
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
    context: 'Phase 16 fixture extraction.',
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

/** Preservation-passing synthesized entity page (phase-15 harness shape). */
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

function readReportEntries(workspace: string): SynthesisReportEntryShape[] {
  const raw = readFileSync(wikiPath(workspace, '.state', 'synthesis-report.json'), 'utf-8');
  return (JSON.parse(raw) as { entries: SynthesisReportEntryShape[] }).entries;
}

interface SynthesisStateShape {
  pages: Record<string, { mode: string; dataHash: string; synthesizedAt: string }>;
}

function readSynthesisStateFile(workspace: string): SynthesisStateShape {
  const raw = readFileSync(wikiPath(workspace, '.state', 'synthesis-state.json'), 'utf-8');
  return JSON.parse(raw) as SynthesisStateShape;
}

function readMetrics(workspace: string): { transportFailures?: number } {
  return JSON.parse(readFileSync(wikiPath(workspace, '.state', 'metrics.json'), 'utf-8')) as {
    transportFailures?: number;
  };
}

/** Phase 14 keep-all curation stub, injected at every ingest (phase-15 harness). */
function keepAllOutcome(): CurationOutcome {
  return { decisions: { merges: [], drops: [], keep: [] }, attempts: 1, fallbacks: [], vetoes: [] };
}

const CURATION_STUBS = {
  curateTopicsFn: async () => keepAllOutcome(),
  curateEntitiesFn: async () => keepAllOutcome(),
};

/** Recursively map a directory tree to { relativePath: bytes } for byte-comparison. */
function snapshotTree(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string): void => {
    if (!existsSync(dir)) {
      return;
    }
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        out.set(relative(root, full).split('\\').join('/'), readFileSync(full, 'utf-8'));
      }
    }
  };
  walk(root);
  return out;
}

// ---------------------------------------------------------------------------
// Gate 16.1: Per-page transport fallback
// ---------------------------------------------------------------------------
test('gate 16.1: exhausted-transport pages land on the template with transport-fallback entries, loud warnings, and metrics.transportFailures === 2', async () => {
  const workspace = setupWikiWithPdf();
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const progressLines: string[] = [];

  // Ten entity pages AND ten topic pages: one transport failure per stage =
  // 10% of each stage — exactly at the threshold, which does NOT exceed it,
  // so the run completes with two fallbacks (the outage detector is proven
  // separately in gates 16.2/16.3).
  const result = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...CURATION_STUBS,
    onProgress: (message) => progressLines.push(message),
    extractChunkFn: makeExtractChunkFnStub(
      buildExtraction(10, ['t-a', 't-b', 't-c', 't-d', 't-e', 't-f', 't-g', 't-h', 't-i', 't-j']),
    ),
    synthesizeEntityFn: async (data) => {
      if (data.slug === 'entity-3') {
        throw exhaustedTimeoutError();
      }
      return passingEntityPage(data);
    },
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => {
      if (data.slug === 't-c') {
        throw exhausted429Error();
      }
      return passingTopicPage(data);
    },
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
  });

  // The run completes; every other page synthesized normally.
  expect(result.synthesized).toBe(9);
  expect(result.synthesizedTopics).toBe(9);
  expect(result.synthesisConflicts).toBe(0);
  expect(result.topicConflicts).toBe(0);

  // Ordered report: both failures recorded as transport-fallback in place.
  const entries = readReportEntries(workspace);
  expect(entries.map((entry) => entry.slug)).toEqual([
    ...Array.from({ length: 10 }, (_, index) => `entity-${index}`),
    ...['t-a', 't-b', 't-c', 't-d', 't-e', 't-f', 't-g', 't-h', 't-i', 't-j'],
  ]);
  const entity3 = entries.find((entry) => entry.slug === 'entity-3');
  expect(entity3?.finalMode).toBe('transport-fallback');
  expect(entity3?.strict).toEqual({ attempted: true, passed: false });
  const topicC = entries.find((entry) => entry.slug === 't-c');
  expect(topicC?.finalMode).toBe('transport-fallback');
  expect(entries.filter((entry) => entry.finalMode === 'transport-fallback')).toHaveLength(2);
  expect(entries.filter((entry) => entry.finalMode === 'strict-synthesis')).toHaveLength(18);

  // Loud per-page warnings with the exact ratified strings + the summary warning.
  expect(warnSpy).toHaveBeenCalledWith('Transport failure for entity-3 after retries — template fallback.');
  expect(warnSpy).toHaveBeenCalledWith('Transport failure for t-c after retries — template fallback.');
  expect(progressLines).toContain(
    'Warning: 2 page(s) fell back to the structured template after transport failures this run — re-run ingest to retry them.',
  );

  // Additive metrics counter.
  expect(readMetrics(workspace).transportFailures).toBe(2);

  // The fallback pages on disk are the deterministic structured template
  // (identical to the quality-exhaustion fallback); their synthesis-state
  // records carry the fallback modes (retried on the next run — gate 16.5).
  const entity3Page = readFileSync(wikiPath(workspace, 'entities', 'people', 'entity-3.md'), 'utf-8');
  expect(entity3Page).toContain('## Mentions');
  expect(entity3Page).not.toContain('Synthesis prose for Entity 3.');
  const passingPage = readFileSync(wikiPath(workspace, 'entities', 'people', 'entity-0.md'), 'utf-8');
  expect(passingPage).toContain('Synthesis prose for Entity 0.');
  const records = readSynthesisStateFile(workspace);
  expect(records.pages['entities/people/entity-3.md']?.mode).toBe('transport-fallback');
  expect(records.pages['topics/t-c/t-c.md']?.mode).toBe('transport-fallback');
  expect(records.pages['entities/people/entity-0.md']?.mode).toBe('strict-synthesis');
});

// ---------------------------------------------------------------------------
// Gate 16.2: Outage detector — consecutive
// ---------------------------------------------------------------------------

const delay = (ms: number): Promise<void> => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

/**
 * Outage-detector streaks depend on COMPLETION order, which is racy under
 * the pool with instant stubs (the per-page record write yields to real fs).
 * Per-index increasing delays make completion strictly index-ordered:
 * pickup times are non-decreasing in index, so completion gaps stay positive.
 */
const indexDelay = (slug: string): Promise<void> => delay(Number(slug.replace('entity-', '')) * 10);

test('gate 16.2: 5 consecutive transport-failed pages abort the run with the transport error', async () => {
  const workspace = setupWikiWithPdf();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  // The ratified thresholds.
  expect(TRANSPORT_OUTAGE_CONSECUTIVE_LIMIT).toBe(5);
  expect(TRANSPORT_OUTAGE_RATE).toBe(0.1);

  // 50 pages: 5 consecutive failures is exactly 10% — the rate rule cannot
  // fire, so only the consecutive rule aborts.
  await expect(
    ingest('test-wiki', {
      workspace,
      synthesis: true,
      poolStaggerMs: 0,
      ...CURATION_STUBS,
      extractChunkFn: makeExtractChunkFnStub(buildExtraction(50)),
      synthesizeEntityFn: async (data) => {
        await indexDelay(data.slug);
        if (['entity-0', 'entity-1', 'entity-2', 'entity-3', 'entity-4'].includes(data.slug)) {
          throw exhaustedTimeoutError();
        }
        return passingEntityPage(data);
      },
      synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
      synthesizeTopicFn: async (data) => passingTopicPage(data),
      synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
    }),
  // The run aborts with THE transport error (fail loud), not a wrapped one.
  ).rejects.toThrow('Headers Timeout Error');
  // Aborted mid-stage: the post-synthesis preliminary metrics never wrote.
  expect(existsSync(wikiPath(workspace, '.state', 'metrics.json'))).toBe(false);
}, 30000);

test('gate 16.2: two 4-streaks separated by successes complete — the consecutive counter resets on success', async () => {
  const workspace = setupWikiWithPdf();
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  // 80 entity pages: entity-0..3 fail (streak of 4), entity-4 succeeds
  // (reset), entity-5..8 fail (streak of 4), the rest succeed. Total 8/80 =
  // 10% — at the rate threshold, not over it. Without the reset, the two
  // streaks would accumulate to 8 consecutive and trip the detector, so
  // completing proves the reset.
  const result = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...CURATION_STUBS,
    extractChunkFn: makeExtractChunkFnStub(buildExtraction(80)),
    synthesizeEntityFn: async (data) => {
      await indexDelay(data.slug);
      const index = Number(data.slug.replace('entity-', ''));
      if (index <= 3 || (index >= 5 && index <= 8)) {
        throw exhaustedTimeoutError();
      }
      return passingEntityPage(data);
    },
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
  });

  expect(result.synthesized).toBe(72);
  expect(readMetrics(workspace).transportFailures).toBe(8);
  expect(readReportEntries(workspace).filter((entry) => entry.finalMode === 'transport-fallback')).toHaveLength(8);
}, 30000);

// ---------------------------------------------------------------------------
// Gate 16.3: Outage detector — rate
// ---------------------------------------------------------------------------
test('gate 16.3: 3 transport-failed pages out of 20 (15%) aborts; 1 of 20 (5%) completes', async () => {
  // Abort case: failures spread out (consecutive never exceeds 1), so only
  // the rate rule can trip — the third failure is 15% > 10%.
  const abortWorkspace = setupWikiWithPdf();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  await expect(
    ingest('test-wiki', {
      workspace: abortWorkspace,
      synthesis: true,
      poolStaggerMs: 0,
      ...CURATION_STUBS,
      extractChunkFn: makeExtractChunkFnStub(buildExtraction(20)),
      synthesizeEntityFn: async (data) => {
        if (['entity-0', 'entity-5', 'entity-10'].includes(data.slug)) {
          throw exhaustedTimeoutError();
        }
        return passingEntityPage(data);
      },
      synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
      synthesizeTopicFn: async (data) => passingTopicPage(data),
      synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
    }),
  ).rejects.toThrow('Headers Timeout Error');

  // Completion case: one failure of twenty (5%).
  const okWorkspace = setupWikiWithPdf();
  const result = await ingest('test-wiki', {
    workspace: okWorkspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...CURATION_STUBS,
    extractChunkFn: makeExtractChunkFnStub(buildExtraction(20)),
    synthesizeEntityFn: async (data) => {
      if (data.slug === 'entity-0') {
        throw exhaustedTimeoutError();
      }
      return passingEntityPage(data);
    },
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
  });
  expect(result.synthesized).toBe(19);
  expect(readMetrics(okWorkspace).transportFailures).toBe(1);
});

// ---------------------------------------------------------------------------
// Gate 16.4: 4xx never falls back
// ---------------------------------------------------------------------------
test('gate 16.4: a stubbed 404 mid-stage aborts immediately — one call, zero fallbacks', async () => {
  const workspace = setupWikiWithPdf();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const callsBySlug = new Map<string, number>();

  await expect(
    ingest('test-wiki', {
      workspace,
      synthesis: true,
      poolStaggerMs: 0,
      ...CURATION_STUBS,
      extractChunkFn: makeExtractChunkFnStub(buildExtraction(5)),
      synthesizeEntityFn: async (data) => {
        callsBySlug.set(data.slug, (callsBySlug.get(data.slug) ?? 0) + 1);
        if (data.slug === 'entity-2') {
          throw http404Error();
        }
        return passingEntityPage(data);
      },
      synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
      synthesizeTopicFn: async (data) => passingTopicPage(data),
      synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
    }),
  ).rejects.toThrow('HTTP 404');

  // Exactly one call for the 404 page (thrown errors are never retried by
  // the chain) and the run aborted: no report file was ever appended, and
  // no page recorded a transport fallback.
  expect(callsBySlug.get('entity-2')).toBe(1);
  expect(existsSync(wikiPath(workspace, '.state', 'synthesis-report.json'))).toBe(false);
  const stateRaw = wikiPath(workspace, '.state', 'synthesis-state.json');
  if (existsSync(stateRaw)) {
    const records = readSynthesisStateFile(workspace);
    expect(Object.values(records.pages).every((record) => record.mode !== 'transport-fallback')).toBe(true);
  }
  // The 404 page was never written as a fallback page by the synthesis stage.
  const page = readFileSync(wikiPath(workspace, 'entities', 'people', 'entity-2.md'), 'utf-8');
  expect(page).toContain('## Mentions');
  expect(page).not.toContain('Synthesis prose for Entity 2.');
});

// ---------------------------------------------------------------------------
// Gate 16.5: Resume skip + template retry
// ---------------------------------------------------------------------------
test('gate 16.5: run 2 skips the 8 passed pages (zero calls), retries the 2 template pages, and a fingerprint flip re-synthesizes one page', async () => {
  const workspace = setupWikiWithPdf();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const progressLines: string[] = [];

  // Leg 1: 8 pages pass strict on attempt 1; 2 pages fail BOTH modes to the
  // structured template. The run is then KILLED (the AGENTS.md updater stub
  // throws after synthesis is fully checkpointed).
  await expect(
    ingest('test-wiki', {
      workspace,
      synthesis: true,
      poolStaggerMs: 0,
      ...CURATION_STUBS,
      updateAgents: true,
      proposeAgentsUpdateFn: async () => {
        throw new Error('simulated kill after synthesis');
      },
      onProgress: (message) => progressLines.push(message),
      extractChunkFn: makeExtractChunkFnStub(buildExtraction(10)),
      synthesizeEntityFn: async (data) => {
        if (data.slug === 'entity-8' || data.slug === 'entity-9') {
          return 'A thin page that preserves none of the required verbatim strings.';
        }
        return passingEntityPage(data);
      },
      synthesizeEntityPermissiveFn: async () => 'A thin permissive page that preserves nothing either.',
      synthesizeTopicFn: async (data) => passingTopicPage(data),
      synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
    }),
  ).rejects.toThrow('simulated kill after synthesis');

  // The kill left a complete checkpoint: 8 pass records + 2 template records.
  const leg1Records = readSynthesisStateFile(workspace);
  expect(Object.keys(leg1Records.pages)).toHaveLength(10);
  expect(leg1Records.pages['entities/people/entity-0.md']?.mode).toBe('strict-synthesis');
  expect(leg1Records.pages['entities/people/entity-8.md']?.mode).toBe('structured-template');

  // Leg 2: identical data, plain ingest (no flags). Call-counting stubs prove
  // the 8 passed pages make ZERO LLM calls and only the 2 template pages are
  // retried (passing this time).
  const leg2Calls = new Map<string, number>();
  progressLines.length = 0;
  const leg2 = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...CURATION_STUBS,
    onProgress: (message) => progressLines.push(message),
    extractChunkFn: makeExtractChunkFnStub(buildExtraction(10)),
    synthesizeEntityFn: async (data) => {
      leg2Calls.set(data.slug, (leg2Calls.get(data.slug) ?? 0) + 1);
      return passingEntityPage(data);
    },
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
  });

  expect(leg2.synthesisSkipped).toBe(8);
  for (let index = 0; index <= 7; index++) {
    expect(leg2Calls.get(`entity-${index}`) ?? 0, `entity-${index} must be skipped`).toBe(0);
  }
  expect(leg2Calls.get('entity-8')).toBe(1);
  expect(leg2Calls.get('entity-9')).toBe(1);
  expect(leg2.synthesized).toBe(2);
  expect(progressLines).toContain('Synthesis: 8 page(s) skipped (unchanged data).');
  // The retried pages now hold pass records.
  const leg2Records = readSynthesisStateFile(workspace);
  expect(leg2Records.pages['entities/people/entity-8.md']?.mode).toBe('strict-synthesis');

  // Leg 3: flip ONE page's aggregate — entity-0 gains a mention in the
  // extraction JSON on disk. (The PDF itself is hash-skipped on every leg,
  // so the extraction stub never re-runs; editing the aggregate input
  // directly is exactly what a changed PDF + re-extraction would produce.)
  // The fingerprint changes, so entity-0 alone is re-synthesized.
  const flipped = buildExtraction(10);
  flipped.entities[0].mentions.push({ page: 2, context: 'A second mention context for entity 0' });
  await writeFile(
    wikiPath(workspace, '.state', 'extracted', 'golden-master-part-001.json'),
    JSON.stringify(flipped, null, 2) + '\n',
    'utf-8',
  );
  const leg3Calls = new Map<string, number>();
  const leg3 = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...CURATION_STUBS,
    extractChunkFn: makeExtractChunkFnStub(flipped),
    synthesizeEntityFn: async (data) => {
      leg3Calls.set(data.slug, (leg3Calls.get(data.slug) ?? 0) + 1);
      return passingEntityPage(data);
    },
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
  });
  expect(leg3Calls.get('entity-0')).toBe(1);
  expect([...leg3Calls.keys()].filter((slug) => slug.startsWith('entity-'))).toEqual(['entity-0']);
  expect(leg3.synthesisSkipped).toBe(9);
});

// ---------------------------------------------------------------------------
// Gate 16.6: Materialize preserves passed pages
// ---------------------------------------------------------------------------

/** Install a document page + extraction JSON fixture (phase-14 harness). */
async function installChunk(wikiDir: string, chunkId: string, extraction: ExtractorResult): Promise<void> {
  await mkdir(join(wikiDir, 'documents'), { recursive: true });
  await mkdir(join(wikiDir, '.state', 'extracted'), { recursive: true });
  const documentPage = [
    '---',
    `title: ${chunkId}`,
    'type: document',
    'wiki: test-wiki',
    'sources:',
    '- file: wikis/test-wiki/raw/golden-master.pdf',
    '  pages: 1-3',
    '  extracted: 2026-07-25T00:00:00.000Z',
    '  sha256: fixture',
    'updated: 2026-07-25T00:00:00.000Z',
    '---',
    '',
    `## Extracted Text: Pages 1-3`,
    '',
    'Fixture chunk text.',
    '',
  ].join('\n');
  await writeFile(join(wikiDir, 'documents', `${chunkId}.md`), documentPage, 'utf-8');
  await writeFile(
    join(wikiDir, '.state', 'extracted', `${chunkId}.json`),
    JSON.stringify(extraction, null, 2) + '\n',
    'utf-8',
  );
}

test('gate 16.6: a skip-eligible page is byte-preserved by materialize; a fingerprint-changed page is rewritten', async () => {
  const workspace = makeTempDir('paper-chase-g16-mat-');
  init('test-wiki', { workspace });
  const wikiDir = wikiPath(workspace);
  const language = { input: 'en' as const, output: 'en' as const };

  await installChunk(wikiDir, 'golden-master-part-001', buildExtraction(2));
  const first = await materialize('test-wiki', { workspace });
  expect(first.preservedPages).toEqual([]);
  const entity0 = first.entityPages.find((page) => page.slug === 'entity-0');
  const entity1 = first.entityPages.find((page) => page.slug === 'entity-1');
  expect(entity0).toBeDefined();
  expect(entity1).toBeDefined();

  // Simulate a completed synthesis: entity-0's page is replaced by prose and
  // checkpointed with a matching fingerprint; entity-1 gets no record.
  const entity0Path = join(wikiDir, 'entities', 'people', 'entity-0.md');
  const synthesizedProse = '---\ntitle: Entity 0\n---\n\nSYNTHESIZED PROSE — already paid for.\n';
  await writeFile(entity0Path, synthesizedProse, 'utf-8');
  await recordSynthesisPage(wikiDir, synthesisPagePath(entity0 as EntityPageData), {
    mode: 'strict-synthesis',
    dataHash: pageDataHash(entity0 as EntityPageData, language),
    synthesizedAt: '2026-07-25T00:00:00.000Z',
  });

  // A resume materialize with identical data: the recorded page is preserved
  // BYTE-FOR-BYTE (never rewritten); the unrecorded page is rewritten.
  const second = await materialize('test-wiki', { workspace });
  expect(readFileSync(entity0Path, 'utf-8')).toBe(synthesizedProse);
  expect(second.preservedPages.map((page) => page.path)).toEqual(['entities/people/entity-0.md']);
  expect(second.writtenPages.map((page) => page.path)).toEqual(['entities/people/entity-1.md']);
  // ...but the preserved page still flows to the synthesis stage as data.
  expect(second.entityPages.map((page) => page.slug).sort()).toEqual(['entity-0', 'entity-1']);

  // Flip entity-0's aggregate (a second mention): the fingerprint changes and
  // the page is rewritten from the new aggregate.
  const flipped = buildExtraction(2);
  flipped.entities[0].mentions.push({ page: 2, context: 'A second mention context for entity 0' });
  await installChunk(wikiDir, 'golden-master-part-001', flipped);
  const third = await materialize('test-wiki', { workspace });
  const rewritten = readFileSync(entity0Path, 'utf-8');
  expect(rewritten).not.toBe(synthesizedProse);
  expect(rewritten).toContain('## Mentions');
  expect(rewritten).toContain('A second mention context for entity 0');
  expect(third.preservedPages).toEqual([]);
  expect(third.writtenPages.map((page) => page.path).sort()).toEqual([
    'entities/people/entity-0.md',
    'entities/people/entity-1.md',
  ]);
});

// ---------------------------------------------------------------------------
// Gate 16.7: Per-PDF checkpoint
// ---------------------------------------------------------------------------
test('gate 16.7: a run killed after PDF 1 has it recorded; the resume skips its extraction and the final state equals an uninterrupted run', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-07-25T12:00:00.000Z'));

  const setupTwoPdfWiki = (): string => {
    const workspace = setupWikiWithPdf();
    // 'aaa-master.pdf' sorts before 'bbb-master.pdf', so processing order is
    // deterministic: PDF aaa completes, PDF bbb is the one that gets killed.
    copyFileSync(GOLDEN_MASTER_PDF, wikiPath(workspace, 'raw', 'aaa-master.pdf'));
    copyFileSync(GOLDEN_MASTER_PDF, wikiPath(workspace, 'raw', 'bbb-master.pdf'));
    rmSync(wikiPath(workspace, 'raw', 'golden-master.pdf'), { force: true });
    return workspace;
  };
  const extractionFor = (chunkId: string): ExtractorResult => {
    const second = chunkId.startsWith('bbb-master');
    return {
      entities: [0, 1].map((offset) => ({
        name: `Entity ${second ? offset + 2 : offset}`,
        type: 'person',
        slug: `entity-${second ? offset + 2 : offset}`,
        folder: 'entities/people',
        significance: `Significance for entity ${second ? offset + 2 : offset}`,
        mentions: [{ page: 1, context: `Mention context for entity ${second ? offset + 2 : offset}` }],
      })),
      relationships: [],
      claims: [
        {
          text: `Claim for topic financial from ${second ? 'PDF 2' : 'PDF 1'}`,
          type: 'financial',
          entities: [`entity-${second ? 2 : 0}`],
          page: 2,
        },
      ],
      timeline: [],
      context: 'Phase 16 gate 16.7 fixture.',
    };
  };

  // Leg 1: PDF 2's extraction throws — the run dies AFTER PDF 1 completed.
  const killedWorkspace = setupTwoPdfWiki();
  const leg1ExtractionCalls: string[] = [];
  await expect(
    ingest('test-wiki', {
      workspace: killedWorkspace,
      synthesis: true,
      poolStaggerMs: 0,
      ...CURATION_STUBS,
      extractChunkFn: async (wikiDir, chunkId) => {
        leg1ExtractionCalls.push(chunkId);
        if (chunkId.startsWith('bbb-master')) {
          throw new Error('ExtractorError: simulated kill during PDF 2 extraction');
        }
        return makeExtractChunkFnStub(extractionFor(chunkId))(wikiDir, chunkId);
      },
      synthesizeEntityFn: async (data) => passingEntityPage(data),
      synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
      synthesizeTopicFn: async (data) => passingTopicPage(data),
      synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
    }),
  ).rejects.toThrow('simulated kill during PDF 2 extraction');
  // PDF aaa extracted fully, PDF bbb's extraction attempted (and killed).
  expect(leg1ExtractionCalls).toEqual(['aaa-master-part-001', 'bbb-master-part-001']);

  // The checkpoint: PDF 1 is recorded EXACTLY as a completed run records it.
  const checkpoint = JSON.parse(
    readFileSync(wikiPath(killedWorkspace, '.state', 'ingestion.json'), 'utf-8'),
  ) as {
    sources: Record<string, { hash: string; documentPages: string[]; ingestedAt: string; language?: string }>;
    pageHashes?: Record<string, string>;
  };
  expect(Object.keys(checkpoint.sources)).toEqual(['aaa-master']);
  expect(checkpoint.sources['aaa-master'].documentPages).toEqual(['documents/aaa-master-part-001.md']);
  expect(checkpoint.sources['aaa-master'].ingestedAt).toBe('2026-07-25T12:00:00.000Z');
  expect(checkpoint.sources['aaa-master'].language).toBe('en');
  expect(checkpoint.sources['aaa-master'].hash).toHaveLength(64);

  // Leg 2: plain ingest (no flags) — PDF 1's extraction is skipped ENTIRELY.
  const leg2ExtractionCalls: string[] = [];
  await ingest('test-wiki', {
    workspace: killedWorkspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...CURATION_STUBS,
    extractChunkFn: async (wikiDir, chunkId) => {
      leg2ExtractionCalls.push(chunkId);
      return makeExtractChunkFnStub(extractionFor(chunkId))(wikiDir, chunkId);
    },
    synthesizeEntityFn: async (data) => passingEntityPage(data),
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
  });
  expect(leg2ExtractionCalls).toEqual(['bbb-master-part-001']);

  // The uninterrupted comparison run at the same pinned time.
  const uninterruptedWorkspace = setupTwoPdfWiki();
  await ingest('test-wiki', {
    workspace: uninterruptedWorkspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...CURATION_STUBS,
    extractChunkFn: async (wikiDir, chunkId) => makeExtractChunkFnStub(extractionFor(chunkId))(wikiDir, chunkId),
    synthesizeEntityFn: async (data) => passingEntityPage(data),
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
  });

  // Final state equals the uninterrupted run's: ingestion state + the full
  // generated page tree, byte-for-byte.
  expect(readFileSync(wikiPath(killedWorkspace, '.state', 'ingestion.json'), 'utf-8')).toBe(
    readFileSync(wikiPath(uninterruptedWorkspace, '.state', 'ingestion.json'), 'utf-8'),
  );
  for (const section of ['documents', 'sources', 'entities', 'topics']) {
    expect(snapshotTree(wikiPath(killedWorkspace, section))).toEqual(
      snapshotTree(wikiPath(uninterruptedWorkspace, section)),
    );
  }
});

// ---------------------------------------------------------------------------
// Gate 16.8: Transport tuning
// ---------------------------------------------------------------------------
test('gate 16.8: staggered dispatch spreads the first pickups deterministically (injected clock)', async () => {
  let fakeNow = 0;
  const sleepCalls: number[] = [];
  const pickupTimes: number[] = [];
  const results = await runPool(
    [0, 1, 2, 3, 4, 5],
    async (item) => {
      pickupTimes.push(fakeNow);
      return item * 10;
    },
    {
      concurrency: SYNTHESIS_POOL_SIZE,
      staggerMs: SYNTHESIS_POOL_STAGGER_MS,
      sleepFn: async (ms) => {
        sleepCalls.push(ms);
        fakeNow += ms;
      },
    },
  );
  // Results stay in input order; pickups are exactly one stagger apart (the
  // injected clock is EAGER — each pickup's slot reservation advances it
  // immediately, so pickup #k lands at (k+1) x stagger here; the production
  // invariant proven is the deterministic 250ms spacing, i.e. the first
  // four pickups are NOT simultaneous).
  expect(results).toEqual([0, 10, 20, 30, 40, 50]);
  expect(pickupTimes.slice(0, 4)).toEqual([250, 500, 750, 1000]);
  expect(new Set(pickupTimes.slice(0, 4)).size).toBe(4);
  expect(SYNTHESIS_POOL_STAGGER_MS).toBe(250);
  expect(sleepCalls.length).toBeGreaterThanOrEqual(6);
  expect(sleepCalls.every((ms) => ms === SYNTHESIS_POOL_STAGGER_MS)).toBe(true);
  // And the plain Phase 15 behavior is untouched when no stagger is given.
  const unstaggered = await runPool([0, 1, 2], async (item) => item, { concurrency: 2 });
  expect(unstaggered).toEqual([0, 1, 2]);
});

test('gate 16.8: large-output calls carry the 600s headers timeout; smaller calls keep the default', async () => {
  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'gate-16-8-fake-key';
  mockUndiciRequest.mockResolvedValue({
    statusCode: 200,
    body: {
      json: async () => ({ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } }),
    },
  } as never);
  try {
    await callLLM('p', undefined, { maxTokens: LARGE_CALL_MAX_TOKENS });
    await callLLM('p', undefined, { maxTokens: LARGE_CALL_MAX_TOKENS - 1 });
    await callLLM('p');
    const optionsOf = (index: number) => mockUndiciRequest.mock.calls[index]?.[1] as Record<string, unknown>;
    expect(optionsOf(0).headersTimeout).toBe(LARGE_CALL_HEADERS_TIMEOUT_MS);
    expect(LARGE_CALL_HEADERS_TIMEOUT_MS).toBe(600_000);
    expect('headersTimeout' in optionsOf(1)).toBe(false);
    expect('headersTimeout' in optionsOf(2)).toBe(false);
  } finally {
    if (savedKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  }
});

test('gate 16.8: the transport retry backoff is exponential (5s/15s/45s), asserted from the delay function and an injected sleeper', async () => {
  // The delay function IS the sequence (no wall-clock sleeping).
  expect([transportRetryDelayMs(1), transportRetryDelayMs(2), transportRetryDelayMs(3)]).toEqual([
    5000, 15000, 45000,
  ]);

  // And callLLM actually waits those amounts between attempts: a network
  // error x2 then a success with maxRetries 2, sleeper injected and
  // recording. Network errors are the non-stall transient class — a 429/5xx
  // would trigger the Phase 16 v1.0.3 stall floor instead (gates 16.13–16.16).
  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'gate-16-8-fake-key';
  const delays: number[] = [];
  setTransportRetrySleeper(async (ms) => {
    delays.push(ms);
  });
  mockUndiciRequest
    .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
    .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
    .mockResolvedValueOnce({
      statusCode: 200,
      body: {
        json: async () => ({ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } }),
      },
    } as never);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    await expect(callLLM('p', undefined, { maxRetries: 2 })).resolves.toBe('ok');
    expect(mockUndiciRequest).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([5000, 15000]);
  } finally {
    if (savedKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  }
});

test('gate 16.8 (supplementary): isTransientTransportError matches the client classification — 429/5xx/network transient, 4xx never', () => {
  expect(isTransientTransportError(exhaustedTimeoutError())).toBe(true);
  expect(isTransientTransportError(exhausted429Error())).toBe(true);
  expect(isTransientTransportError(new Error('Anthropic API error (HTTP 500): {}'))).toBe(true);
  expect(isTransientTransportError(new Error('Anthropic API error (HTTP 503): {}'))).toBe(true);
  expect(isTransientTransportError(new Error('OpenAI API transport error after 3 attempt(s): socket hang up'))).toBe(true);
  expect(isTransientTransportError(new Error('OpenAI API error (HTTP 429): {}'))).toBe(true);
  expect(isTransientTransportError(http404Error())).toBe(false);
  expect(isTransientTransportError(new Error('Anthropic API error (HTTP 400): {}'))).toBe(false);
  expect(isTransientTransportError(new Error('ANTHROPIC_API_KEY is not set.'))).toBe(false);
  expect(isTransientTransportError(new Error('some other failure'))).toBe(false);
  expect(isTransientTransportError('not an error')).toBe(false);
});

// ---------------------------------------------------------------------------
// Gates 16.13–16.17: Reactive 429/5xx stall (Phase 16 v1.0.3, user directive
// 2026-08-22). A throttled or erroring provider's 429/5xx gets
// TRANSIENT_MAX_ATTEMPTS total attempts with the escalating stall floor
// (1/5/15/45/90 min, ~2.6 h of waiting) so the throttle/error window clears
// instead of aborting the run; network errors keep the caller's bound and
// the exponential backoff. All waits go through the injected sleeper —
// never wall-clock.
// ---------------------------------------------------------------------------

/** Undici mock: a 429 with an optional Retry-After header (seconds). */
function rateLimit429(retryAfterSeconds?: number) {
  const headers: Record<string, string> = {};
  if (retryAfterSeconds !== undefined) {
    headers['retry-after'] = String(retryAfterSeconds);
  }
  return {
    statusCode: 429,
    headers,
    body: { json: async () => ({ error: { message: 'rate limited' } }) },
  } as never;
}

/** Undici mock: an HTTP 500 server error from a saturated provider. */
function serverError500() {
  return {
    statusCode: 500,
    body: { json: async () => ({ error: { code: '500', message: 'Operation failed' } }) },
  } as never;
}

/** Undici mock: a plain 200 with a text answer. */
function success200() {
  return {
    statusCode: 200,
    body: {
      json: async () => ({ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } }),
    },
  } as never;
}

test('gate 16.13: the stall floor escalates (1min/5min/15min/45min/90min); Retry-After wins when larger', async () => {
  // The floor function IS the sequence (no wall-clock sleeping).
  expect([1, 2, 3, 4, 5].map(transientStallDelayMs)).toEqual([60000, 300000, 900000, 2700000, 5400000]);

  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'gate-16-13-fake-key';
  const delays: number[] = [];
  setTransportRetrySleeper(async (ms) => {
    delays.push(ms);
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    // Retry-After: 7 -> the 60s floor wins on the first wait.
    mockUndiciRequest
      .mockResolvedValueOnce(rateLimit429(7))
      .mockResolvedValueOnce(success200());
    await expect(callLLM('p', undefined, { maxRetries: 2 })).resolves.toBe('ok');
    expect(delays).toEqual([60000]);

    // Retry-After: 90 -> the header wins over the 60s floor.
    delays.length = 0;
    mockUndiciRequest.mockReset();
    mockUndiciRequest
      .mockResolvedValueOnce(rateLimit429(90))
      .mockResolvedValueOnce(success200());
    await expect(callLLM('p', undefined, { maxRetries: 2 })).resolves.toBe('ok');
    expect(delays).toEqual([90000]);
  } finally {
    if (savedKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  }
});

test('gate 16.14: a 429 gets 6 total attempts with escalating stalls — beyond the caller maxRetries', async () => {
  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'gate-16-14-fake-key';
  const delays: number[] = [];
  setTransportRetrySleeper(async (ms) => {
    delays.push(ms);
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    mockUndiciRequest
      .mockResolvedValueOnce(rateLimit429())
      .mockResolvedValueOnce(rateLimit429())
      .mockResolvedValueOnce(rateLimit429())
      .mockResolvedValueOnce(rateLimit429())
      .mockResolvedValueOnce(rateLimit429())
      .mockResolvedValueOnce(success200());
    await expect(callLLM('p', undefined, { maxRetries: 2 })).resolves.toBe('ok');
    expect(mockUndiciRequest).toHaveBeenCalledTimes(6);
    expect(TRANSIENT_MAX_ATTEMPTS).toBe(6);
    expect(delays).toEqual([60000, 300000, 900000, 2700000, 5400000]);
  } finally {
    if (savedKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  }
});

test('gate 16.15: a persistent 429 aborts after exactly 6 attempts with the attempt-count error', async () => {
  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'gate-16-15-fake-key';
  setTransportRetrySleeper(async () => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    mockUndiciRequest.mockResolvedValue(rateLimit429());
    let error: Error | undefined;
    try {
      await callLLM('p', undefined, { maxRetries: 2 });
    } catch (err) {
      error = err as Error;
    }
    expect(mockUndiciRequest).toHaveBeenCalledTimes(6);
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toMatch(/API error \(HTTP 429\) after 6 attempt\(s\)/);
    expect(isTransientTransportError(error)).toBe(true);
  } finally {
    if (savedKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  }
});

test('gate 16.16: a 503 gets the same 6-attempt stall ladder; network errors keep 3 attempts with the exponential backoff; maxRetries 0 keeps the frozen no-retry for both', async () => {
  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'gate-16-16-fake-key';
  const delays: number[] = [];
  setTransportRetrySleeper(async (ms) => {
    delays.push(ms);
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    // 5xx shares the stall ladder (Phase 16 v1.0.3): 503 x2 then success ->
    // the 60s and 300s stall floors for waits 1 and 2.
    mockUndiciRequest
      .mockResolvedValueOnce({ statusCode: 503, body: { json: async () => ({ error: { message: 'unavailable' } }) } } as never)
      .mockResolvedValueOnce({ statusCode: 503, body: { json: async () => ({ error: { message: 'unavailable' } }) } } as never)
      .mockResolvedValueOnce(success200());
    await expect(callLLM('p', undefined, { maxRetries: 2 })).resolves.toBe('ok');
    expect(mockUndiciRequest).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([60000, 300000]);

    // Network errors are the non-stall transient class: 3 attempts with the
    // exponential backoff.
    delays.length = 0;
    mockUndiciRequest.mockReset();
    mockUndiciRequest
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValueOnce(success200());
    await expect(callLLM('p', undefined, { maxRetries: 2 })).resolves.toBe('ok');
    expect(mockUndiciRequest).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([5000, 15000]);

    // Frozen default: maxRetries 0 -> a 429 and a 500 both throw on the
    // first attempt.
    delays.length = 0;
    mockUndiciRequest.mockReset();
    mockUndiciRequest.mockResolvedValueOnce(rateLimit429());
    await expect(callLLM('p')).rejects.toThrow(/API error \(HTTP 429\) after 1 attempt\(s\)/);
    expect(mockUndiciRequest).toHaveBeenCalledTimes(1);

    mockUndiciRequest.mockReset();
    mockUndiciRequest.mockResolvedValueOnce(serverError500());
    await expect(callLLM('p')).rejects.toThrow(/API error \(HTTP 500\) after 1 attempt\(s\)/);
    expect(mockUndiciRequest).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  } finally {
    if (savedKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  }
});

test('gate 16.16b: a persistent 500 aborts after exactly 6 attempts with the attempt-count error', async () => {
  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'gate-16-16b-fake-key';
  setTransportRetrySleeper(async () => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    mockUndiciRequest.mockResolvedValue(serverError500());
    let error: Error | undefined;
    try {
      await callLLM('p', undefined, { maxRetries: 2 });
    } catch (err) {
      error = err as Error;
    }
    expect(mockUndiciRequest).toHaveBeenCalledTimes(6);
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toMatch(/API error \(HTTP 500\) after 6 attempt\(s\)/);
    expect(isTransientTransportError(error)).toBe(true);
  } finally {
    if (savedKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  }
});

test('gate 16.18: every failed 429/5xx attempt persists to .state/transport-stalls.jsonl — retry waits and the exhausted abort included; the call log stays success-only', async () => {
  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'gate-16-18-fake-key';
  setTransportRetrySleeper(async () => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    // 429 then success: ONE stall record with the 60s wait; the call log
    // holds only the successful call (cost accounting untouched).
    const logPath = join(makeTempDir('paper-chase-g16-18-'), 'llm-calls.json');
    mockUndiciRequest
      .mockResolvedValueOnce(rateLimit429())
      .mockResolvedValueOnce(success200());
    await expect(
      callLLM('p', undefined, { maxRetries: 2, callType: 'extractor', context: 'chunk-1', logPath }),
    ).resolves.toBe('ok');
    const stallRecords = readFileSync(transportStallsLogPath(logPath), 'utf-8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(stallRecords).toHaveLength(1);
    expect(stallRecords[0]).toMatchObject({
      callType: 'extractor',
      context: 'chunk-1',
      provider: 'anthropic',
      statusCode: 429,
      attempt: 1,
      maxAttempts: 6,
      exhausted: false,
      waitSeconds: 60,
      error: 'rate limited',
    });
    expect(typeof stallRecords[0]?.model).toBe('string');
    expect(typeof stallRecords[0]?.timestamp).toBe('string');
    const callRecords = readFileSync(logPath, 'utf-8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(callRecords).toHaveLength(1);
    expect(callRecords[0]?.cost as number).toBeGreaterThan(0);

    // Persistent 500: SIX records (attempts 1..6), the last exhausted with
    // waitSeconds 0 and the provider's error message; no successful call
    // logged at all.
    const logPath2 = join(makeTempDir('paper-chase-g16-18b-'), 'llm-calls.json');
    mockUndiciRequest.mockReset();
    mockUndiciRequest.mockResolvedValue(serverError500());
    await expect(callLLM('p', undefined, { maxRetries: 2, logPath: logPath2 })).rejects.toThrow(
      /API error \(HTTP 500\) after 6 attempt\(s\)/,
    );
    const stallRecords2 = readFileSync(transportStallsLogPath(logPath2), 'utf-8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(stallRecords2).toHaveLength(6);
    expect(stallRecords2.map((r) => r.attempt)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(stallRecords2.map((r) => r.waitSeconds)).toEqual([60, 300, 900, 2700, 5400, 0]);
    expect(stallRecords2.map((r) => r.exhausted)).toEqual([false, false, false, false, false, true]);
    expect(stallRecords2[5]?.error).toBe('Operation failed');
    expect(existsSync(logPath2)).toBe(false);
  } finally {
    if (savedKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  }
});

test('gate 16.17: the stall reporter receives the exact wait info (429 and 500) and owns the stall message; without it the warn fires', async () => {
  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'gate-16-17-fake-key';
  setTransportRetrySleeper(async () => {});
  const reported: StallWaitInfo[] = [];
  setStallWaitReporter((info) => reported.push(info));
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    mockUndiciRequest
      .mockResolvedValueOnce(rateLimit429())
      .mockResolvedValueOnce(rateLimit429())
      .mockResolvedValueOnce(success200());
    await expect(callLLM('p', undefined, { maxRetries: 2 })).resolves.toBe('ok');
    expect(reported).toEqual([
      { waitSeconds: 60, attempt: 2, maxAttempts: 6, statusCode: 429 },
      { waitSeconds: 300, attempt: 3, maxAttempts: 6, statusCode: 429 },
    ]);
    expect(warn).not.toHaveBeenCalled();

    // A 500 stalls through the same reporter with its own status code.
    reported.length = 0;
    mockUndiciRequest.mockReset();
    mockUndiciRequest
      .mockResolvedValueOnce(serverError500())
      .mockResolvedValueOnce(success200());
    await expect(callLLM('p', undefined, { maxRetries: 2 })).resolves.toBe('ok');
    expect(reported).toEqual([{ waitSeconds: 60, attempt: 2, maxAttempts: 6, statusCode: 500 }]);
    expect(warn).not.toHaveBeenCalled();

    // Without a reporter the console.warn path fires with the stall line.
    setStallWaitReporter(null);
    reported.length = 0;
    warn.mockClear();
    mockUndiciRequest.mockReset();
    mockUndiciRequest
      .mockResolvedValueOnce(rateLimit429())
      .mockResolvedValueOnce(success200());
    await expect(callLLM('p', undefined, { maxRetries: 2 })).resolves.toBe('ok');
    expect(reported).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/Rate limited \(HTTP 429\) — waiting 60s before retry \(attempt 2\/6\)/);

    // The 500 warn path names the provider error.
    warn.mockClear();
    mockUndiciRequest.mockReset();
    mockUndiciRequest
      .mockResolvedValueOnce(serverError500())
      .mockResolvedValueOnce(success200());
    await expect(callLLM('p', undefined, { maxRetries: 2 })).resolves.toBe('ok');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/Provider error \(HTTP 500\) — waiting 60s before retry \(attempt 2\/6\)/);
  } finally {
    setStallWaitReporter(null);
    if (savedKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  }
});

test('gate 16.17 (ingest level): a stalled 429 surfaces on the run\'s progress channel; the reporter never outlives the run', async () => {
  const workspace = setupWikiWithPdf();
  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'gate-16-17-fake-key';
  setTransportRetrySleeper(async () => {});
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const lines: string[] = [];
  try {
    // First DOX LLM call of the run hits a 429 (stall through the instant
    // sleeper), then everything else succeeds deterministically.
    mockUndiciRequest
      .mockResolvedValueOnce(rateLimit429())
      .mockResolvedValue(success200());
    await ingest('test-wiki', {
      workspace,
      extract: false,
      doxLlm: true,
      onProgress: (line) => lines.push(line),
    });
    expect(
      lines.some((line) =>
        /Rate limited by provider \(HTTP 429\) — waiting 60s before retry \(attempt 2\/6\)/.test(line),
      ),
    ).toBe(true);

    // Phase 16 v1.0.4: the stall also persists to the wiki's audit log.
    const stallsFile = join(workspace, 'wikis', 'test-wiki', '.state', 'transport-stalls.jsonl');
    expect(existsSync(stallsFile)).toBe(true);

    // The reporter must not outlive the run: a post-run 429 uses the
    // console.warn path (the finished run's progress channel stays silent).
    warn.mockClear();
    mockUndiciRequest.mockReset();
    mockUndiciRequest
      .mockResolvedValueOnce(rateLimit429())
      .mockResolvedValueOnce(success200());
    await expect(callLLM('p', undefined, { maxRetries: 2 })).resolves.toBe('ok');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/Rate limited \(HTTP 429\) — waiting 60s before retry \(attempt 2\/6\)/);
    expect(lines.some((line) => line.includes('waiting 60s before retry (attempt 2/6)') && line.startsWith('Rate limited by provider'))).toBe(true);
  } finally {
    if (savedKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  }
});

// ---------------------------------------------------------------------------
// Gate 16.9: Slim decision-list schema
// ---------------------------------------------------------------------------
test('gate 16.9: neither curation prompt instructs a keep bucket; validation derives the keep complement', () => {
  for (const file of ['prompts/curation-topics.prompt.txt', 'prompts/curation-entities.prompt.txt']) {
    const template = readFileSync(file, 'utf-8');
    // The Phase 14 prompt contract is intact (gate 14.13).
    expect(template, file).toContain('=== LANGUAGE ===\n{languageDirective}');
    expect(template, file).toContain('{agentsMd}');
    expect(template, file).toContain('{candidates}');
    // No "keep" bucket: no JSON schema key and no bullet describing one —
    // the prompt instructs the derived complement instead.
    expect(template, file).not.toMatch(/"keep"\s*:/);
    expect(template, file).toContain('kept automatically');
    // Per-decision justifications are capped by the prompt.
    expect(template, file).toContain('cap it at a few words');
  }
});

test('gate 16.9: the slim schema passes with the exact derived keep; legacy keep is accepted when consistent and rejected when contradictory', () => {
  const slugs = new Set(['alpha', 'beta', 'gamma', 'delta']);

  // Slim topic output (no keep key at all): valid; keep derived as the
  // exact complement (beta survives the merge, delta was never listed).
  const slimTopics = validateTopicDecisions(
    JSON.stringify({ merge: [{ from: ['alpha'], into: 'beta' }], drop: ['gamma'] }),
    slugs,
  );
  expect(slimTopics.valid).toBe(true);
  expect(slimTopics.decisions?.merges).toEqual([{ from: ['alpha'], into: 'beta' }]);
  expect(slimTopics.decisions?.drops).toEqual(['gamma']);
  expect(slimTopics.decisions?.keep).toEqual(['beta', 'delta']);
  // Every candidate accounted for exactly once across the final list (the
  // derived keep already includes the merge survivor 'beta').
  const accounted = [
    ...slimTopics.decisions!.merges.flatMap((merge) => merge.from),
    ...slimTopics.decisions!.drops,
    ...slimTopics.decisions!.keep,
  ].sort();
  expect(accounted).toEqual(['alpha', 'beta', 'delta', 'gamma']);

  // Slim entity output (merge + unsure only): unsure folds into the derived
  // keep alongside the survivor and the unlisted candidate.
  const slimEntities = validateEntityDecisions(
    JSON.stringify({ merge: [{ from: ['alpha'], into: 'beta' }], unsure: ['delta'] }),
    slugs,
  );
  expect(slimEntities.valid).toBe(true);
  expect(slimEntities.decisions?.keep).toEqual(['beta', 'delta', 'gamma']);

  // Legacy output WITH a keep list, exactly consistent with the buckets:
  // accepted (and the derived keep matches the pre-Phase-16 result).
  const legacyConsistent = validateTopicDecisions(
    JSON.stringify({ merge: [{ from: ['alpha'], into: 'beta' }], drop: ['gamma'], keep: ['delta'] }),
    slugs,
  );
  expect(legacyConsistent.valid).toBe(true);
  expect(legacyConsistent.decisions?.keep).toEqual(['beta', 'delta']);

  // Legacy output whose keep list contradicts the other buckets: rejected,
  // naming the unaccounted slugs.
  const legacyContradictory = validateTopicDecisions(
    JSON.stringify({ merge: [], drop: [], keep: ['alpha', 'beta'] }),
    slugs,
  );
  expect(legacyContradictory.valid).toBe(false);
  expect(legacyContradictory.errors.join('\n')).toContain("'keep' list contradicts");
  expect(legacyContradictory.errors.join('\n')).toContain('gamma');
  expect(legacyContradictory.errors.join('\n')).toContain('delta');

  // A slim output is still rejected for the other rule classes (double-listing).
  const doubleListed = validateTopicDecisions(
    JSON.stringify({ merge: [{ from: ['alpha'], into: 'beta' }], drop: ['alpha'] }),
    slugs,
  );
  expect(doubleListed.valid).toBe(false);
});

// ---------------------------------------------------------------------------
// Gate 16.10: Size-based bucketing
// ---------------------------------------------------------------------------

/** A synthetic candidate whose ~450-char slug inflates the output estimate. */
function longSlugCandidate(index: number): TopicCurationCandidate {
  return {
    slug: `topic-${'x'.repeat(440)}-${String(index).padStart(4, '0')}`,
    title: `Long Topic ${index}`,
    folder: 'topics/long',
    claimCount: 2,
    sampleClaims: [`Sample claim ${index}`],
    onDisk: false,
  };
}

function slugsFromPrompt(prompt: string): string[] {
  const match = /=== CANDIDATES ===\n([\s\S]*?)\n=== END CANDIDATES ===/.exec(prompt);
  if (match === null) {
    throw new Error('no candidates block in curation prompt');
  }
  return (JSON.parse(match[1]) as Array<{ slug: string }>).map((candidate) => candidate.slug);
}

test('gate 16.10: a below-250 set engineered to overflow the output estimate triggers bucketing + reconciliation, each round independently validated', async () => {
  const candidates = Array.from({ length: 200 }, (_, index) => longSlugCandidate(index));
  // The engineering premise: the estimate approaches the ceiling while the
  // count stays below the old 250 trigger.
  expect(candidates.length).toBeLessThanOrEqual(CURATION_SINGLE_CALL_LIMIT);
  expect(estimateDecisionListTokens(candidates)).toBeGreaterThanOrEqual(CURATION_SIZE_TRIGGER_TOKENS);

  const contexts: string[] = [];
  const bucketSizes: number[] = [];
  // Prompts per BASE context (the reask's `#attempt<N>` suffix stripped).
  const promptsByBase = new Map<string, string[]>();
  const baseOf = (context: string): string => context.replace(/#attempt\d+$/, '');
  const outcome = await curateTopics(candidates, {
    agentsMd: 'Test constitution.',
    callLLMFn: async (prompt, options) => {
      const context = options.context ?? '';
      const base = baseOf(context);
      contexts.push(context);
      const slugs = slugsFromPrompt(prompt);
      bucketSizes.push(slugs.length);
      const seen = [...(promptsByBase.get(base) ?? []), prompt];
      promptsByBase.set(base, seen);
      // Bucket 1: first attempt is INVALID (a ghost slug) to prove each
      // bucket call is independently validated with its own reask loop;
      // attempt 2 merges its first two candidates legitimately.
      if (base === 'curation-topics-bucket-1' && seen.length === 1) {
        return JSON.stringify({ merge: [{ from: ['ghost'], into: slugs[0] }], drop: [] });
      }
      if (base === 'curation-topics-bucket-1') {
        return JSON.stringify({ merge: [{ from: [slugs[0]], into: slugs[1] }], drop: [] });
      }
      return JSON.stringify({ merge: [], drop: [] });
    },
  });

  // Bucketing happened BELOW the count trigger: more than one bucket call,
  // each within the count limit, then one reconciliation over the survivors.
  const bucketBases = [...promptsByBase.keys()].filter((context) => context.includes('-bucket-'));
  expect(bucketBases.length).toBeGreaterThan(1);
  expect(contexts[contexts.length - 1]).toBe('curation-topics-reconciliation');
  expect(bucketSizes.every((size) => size <= CURATION_SINGLE_CALL_LIMIT)).toBe(true);
  // Bucket 1 needed two attempts (independent validation + reask); the other
  // calls passed first time.
  expect(promptsByBase.get('curation-topics-bucket-1')).toHaveLength(2);
  expect(promptsByBase.get('curation-topics-bucket-1')?.[1]).toContain('=== CORRECTION REQUIRED ===');
  // The reconciliation round ran over the survivors: 199 (bucket 1's merge
  // absorbed one), and the final list keeps that merge with no fallbacks.
  const reconciliationSlugs = slugsFromPrompt(
    (promptsByBase.get('curation-topics-reconciliation') ?? [])[0] ?? '',
  );
  expect(reconciliationSlugs).toHaveLength(199);
  expect(outcome.fallbacks).toEqual([]);
  expect(outcome.decisions?.merges).toHaveLength(1);
  expect(outcome.decisions?.keep).toHaveLength(199);
});

test('gate 16.10: the per-round keep-all fallback is intact under the size trigger', async () => {
  const candidates = Array.from({ length: 200 }, (_, index) => longSlugCandidate(index));
  const contexts: string[] = [];
  const baseOf = (context: string): string => context.replace(/#attempt\d+$/, '');
  const outcome = await curateTopics(candidates, {
    agentsMd: 'Test constitution.',
    callLLMFn: async (prompt, options) => {
      const context = options.context ?? '';
      const base = baseOf(context);
      contexts.push(context);
      const slugs = slugsFromPrompt(prompt);
      // Bucket 1's transport dies (after the client's bounded retries, which
      // the stub compresses to one throw): that bucket keeps all candidates;
      // bucket 2 merges its first two; the reconciliation still runs.
      if (base === 'curation-topics-bucket-1') {
        throw new Error('Anthropic API error (HTTP 500): overloaded');
      }
      if (base === 'curation-topics-bucket-2') {
        return JSON.stringify({ merge: [{ from: [slugs[0]], into: slugs[1] }], drop: [] });
      }
      return JSON.stringify({ merge: [], drop: [] });
    },
  });
  expect(contexts[contexts.length - 1]).toBe('curation-topics-reconciliation');
  // The failed bucket's keep-all fallback is recorded; bucket 2's merge
  // survives; the final set never grows (the derived keep already includes
  // the merge target, so only the merged-away slug leaves the count).
  expect(outcome.fallbacks).toEqual([{ scope: 'curation-topics-bucket-1', cause: 'transport-exhaustion' }]);
  expect(outcome.decisions?.merges).toHaveLength(1);
  const finalSize =
    (outcome.decisions?.keep.length ?? 0) +
    (outcome.decisions?.merges ?? []).reduce((count, merge) => count + merge.from.length, 0) +
    (outcome.decisions?.drops.length ?? 0);
  expect(finalSize).toBe(candidates.length);
});

// ---------------------------------------------------------------------------
// Gate 16.11: Kill-and-resume integration
// ---------------------------------------------------------------------------
test('gate 16.11: kill mid-synthesis then resume — PDFs not re-extracted, passes not re-synthesized, templates retried, final wiki + state byte-equal to uninterrupted', async () => {
  const PINNED = new Date('2026-07-25T12:00:00.000Z');

  const setupTwoPdfWiki = (): string => {
    const workspace = setupWikiWithPdf();
    // 'pdf-a.pdf' sorts before 'pdf-b.pdf' in raw/, and their chunks sort the
    // same way in .state/extracted/, so the entity pool's page order is the
    // natural entity-0..entity-9 (pickup order is always index order).
    copyFileSync(GOLDEN_MASTER_PDF, wikiPath(workspace, 'raw', 'pdf-a.pdf'));
    copyFileSync(GOLDEN_MASTER_PDF, wikiPath(workspace, 'raw', 'pdf-b.pdf'));
    rmSync(wikiPath(workspace, 'raw', 'golden-master.pdf'), { force: true });
    return workspace;
  };
  // PDF a -> entity-0..4, PDF b -> entity-5..9 (one chunk each).
  const extractionFor = (chunkId: string): ExtractorResult => {
    const base = chunkId.startsWith('pdf-b') ? 5 : 0;
    return {
      entities: [0, 1, 2, 3, 4].map((offset) => ({
        name: `Entity ${base + offset}`,
        type: 'person',
        slug: `entity-${base + offset}`,
        folder: 'entities/people',
        significance: `Significance for entity ${base + offset}`,
        mentions: [{ page: 1, context: `Mention context for entity ${base + offset}` }],
      })),
      relationships: [],
      claims: [],
      timeline: [],
      context: 'Phase 16 gate 16.11 fixture.',
    };
  };

  // ---- Leg 1 (killed mid-synthesis): entity-8 exhausts transport (a
  // transport-fallback record, retried later), entity-9 throws a fatal 404 —
  // the run dies with 9 of 10 pages checkpointed. 1/10 = 10% does not trip
  // the outage detector before the kill lands.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED);
  const killedWorkspace = setupTwoPdfWiki();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const leg1SynthCalls: string[] = [];
  await expect(
    ingest('test-wiki', {
      workspace: killedWorkspace,
      synthesis: true,
      poolStaggerMs: 0,
      ...CURATION_STUBS,
      extractChunkFn: async (wikiDir, chunkId) => makeExtractChunkFnStub(extractionFor(chunkId))(wikiDir, chunkId),
      synthesizeEntityFn: async (data) => {
        leg1SynthCalls.push(data.slug);
        if (data.slug === 'entity-8') {
          throw exhaustedTimeoutError();
        }
        if (data.slug === 'entity-9') {
          throw http404Error();
        }
        return passingEntityPage(data);
      },
      synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
      synthesizeTopicFn: async (data) => passingTopicPage(data),
      synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
    }),
  ).rejects.toThrow('HTTP 404');

  // The kill left 9 checkpointed records (8 passes + the transport fallback);
  // entity-9 has none. Both PDFs are recorded (per-PDF checkpoints).
  const leg1Records = readSynthesisStateFile(killedWorkspace);
  expect(Object.keys(leg1Records.pages)).toHaveLength(9);
  expect(leg1Records.pages['entities/people/entity-8.md']?.mode).toBe('transport-fallback');
  expect(leg1Records.pages['entities/people/entity-0.md']?.mode).toBe('strict-synthesis');
  const leg1Ingestion = JSON.parse(
    readFileSync(wikiPath(killedWorkspace, '.state', 'ingestion.json'), 'utf-8'),
  ) as { sources: Record<string, unknown> };
  expect(Object.keys(leg1Ingestion.sources).sort()).toEqual(['pdf-a', 'pdf-b']);

  // ---- Leg 2: plain ingest (no flags), same pinned time.
  vi.setSystemTime(PINNED);
  const leg2ExtractionCalls: string[] = [];
  const leg2SynthCalls: string[] = [];
  const leg2 = await ingest('test-wiki', {
    workspace: killedWorkspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...CURATION_STUBS,
    extractChunkFn: async (wikiDir, chunkId) => {
      leg2ExtractionCalls.push(chunkId);
      return makeExtractChunkFnStub(extractionFor(chunkId))(wikiDir, chunkId);
    },
    synthesizeEntityFn: async (data) => {
      leg2SynthCalls.push(data.slug);
      return passingEntityPage(data);
    },
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
  });

  // Completed PDFs are NOT re-extracted; passed pages are NOT re-synthesized
  // (zero calls for them); the transport-fallback page and the never-
  // checkpointed page are retried.
  expect(leg2ExtractionCalls).toEqual([]);
  expect(leg2.synthesisSkipped).toBe(8);
  expect(leg2SynthCalls.sort()).toEqual(['entity-8', 'entity-9']);
  expect(leg2.synthesized).toBe(2);

  // ---- The uninterrupted comparison run at the same pinned time.
  const uninterruptedWorkspace = setupTwoPdfWiki();
  await ingest('test-wiki', {
    workspace: uninterruptedWorkspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...CURATION_STUBS,
    extractChunkFn: async (wikiDir, chunkId) => makeExtractChunkFnStub(extractionFor(chunkId))(wikiDir, chunkId),
    synthesizeEntityFn: async (data) => passingEntityPage(data),
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
  });

  // Byte-comparison: the whole generated page tree plus every deterministic
  // state artifact of the run. metrics.json is EXCLUDED by design: it is a
  // run-history audit (its chunksSkipped reflects the resume's hash-skips),
  // not part of the wiki — every artifact a READER of the wiki depends on is
  // byte-identical.
  const killedTree = snapshotTree(wikiPath(killedWorkspace));
  const uninterruptedTree = snapshotTree(wikiPath(uninterruptedWorkspace));
  killedTree.delete('.state/metrics.json');
  uninterruptedTree.delete('.state/metrics.json');
  expect([...killedTree.keys()].sort()).toEqual([...uninterruptedTree.keys()].sort());
  for (const [path, bytes] of killedTree) {
    expect(bytes, `byte-compare ${path}`).toBe(uninterruptedTree.get(path));
  }
});

// ---------------------------------------------------------------------------
// Gates 16.19–16.21: transport hardening (Phase 16 v1.0.5, user-ratified
// 2026-08-23). (a) Every attempt carries an ABSOLUTE deadline
// (`AbortSignal.timeout`) so a silently-dead or byte-trickling connection can
// no longer hang the ingest forever — a timeout lands in the existing
// network-error path (≤3 attempts, 5/15/45s backoff). (b) The honored
// `Retry-After` is clamped to the top stall rung (90 min) and the HTTP-date
// form is parsed. (c) The provider's stop reason reaches callers via
// `onResponseMeta` so validators detect truncation deterministically.
// All waits go through the injected sleeper — never wall-clock.
// ---------------------------------------------------------------------------

test('gate 16.19: every attempt carries an absolute deadline; a timeout is a bounded network-class transient', async () => {
  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'gate-16-19-fake-key';
  const delays: number[] = [];
  setTransportRetrySleeper(async (ms) => {
    delays.push(ms);
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    // A large-output call: 600s headers timeout AND an AbortSignal deadline.
    mockUndiciRequest.mockResolvedValueOnce(success200());
    await expect(callLLM('p', undefined, { maxTokens: 32768, maxRetries: 2 })).resolves.toBe('ok');
    const largeOptions = mockUndiciRequest.mock.calls[0]?.[1] as {
      headersTimeout?: number;
      signal?: unknown;
    };
    expect(largeOptions.headersTimeout).toBe(LARGE_CALL_HEADERS_TIMEOUT_MS);
    expect(largeOptions.signal).toBeInstanceOf(AbortSignal);

    // A small call: no explicit headers timeout, still a deadline signal.
    mockUndiciRequest.mockReset();
    mockUndiciRequest.mockResolvedValueOnce(success200());
    await expect(callLLM('p', undefined, { maxTokens: 2048 })).resolves.toBe('ok');
    const smallOptions = mockUndiciRequest.mock.calls[0]?.[1] as {
      headersTimeout?: number;
      signal?: unknown;
    };
    expect(smallOptions.headersTimeout).toBeUndefined();
    expect(smallOptions.signal).toBeInstanceOf(AbortSignal);

    // A timed-out attempt (undici rejects with an abort/timeout error) takes
    // the NETWORK path: the caller's ≤3-attempt bound with the 5s/15s
    // exponential backoff, then the fail-loud attempt-count error — never an
    // unbounded hang.
    mockUndiciRequest.mockReset();
    const timeoutError = new Error('The operation timed out');
    timeoutError.name = 'TimeoutError';
    mockUndiciRequest.mockRejectedValue(timeoutError);
    let caught: Error | undefined;
    try {
      await callLLM('p', undefined, { maxRetries: 2 });
    } catch (err) {
      caught = err as Error;
    }
    expect(mockUndiciRequest).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([5000, 15000]);
    expect(caught?.message).toMatch(/API transport error after 3 attempt\(s\)/);
    expect(isTransientTransportError(caught)).toBe(true);
  } finally {
    if (savedKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  }
});

test('gate 16.20: Retry-After is honored (seconds and HTTP-date) but clamped to the 90-minute top rung', async () => {
  // Unit legs: the parser handles delta-seconds, HTTP-date, and garbage.
  expect(parseRetryAfterSeconds('120')).toBe(120);
  const now = Date.parse('2026-08-23T12:00:00Z');
  expect(parseRetryAfterSeconds('Sun, 23 Aug 2026 12:02:00 GMT', now)).toBe(120);
  expect(parseRetryAfterSeconds('Sun, 23 Aug 2026 11:58:00 GMT', now)).toBe(0);
  expect(Number.isNaN(parseRetryAfterSeconds('not-a-date'))).toBe(true);

  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'gate-16-20-fake-key';
  const delays: number[] = [];
  setTransportRetrySleeper(async (ms) => {
    delays.push(ms);
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    // A hostile/huge Retry-After is honored only up to the 90-min top rung.
    mockUndiciRequest
      .mockResolvedValueOnce(rateLimit429(99999999))
      .mockResolvedValueOnce(success200());
    await expect(callLLM('p', undefined, { maxRetries: 2 })).resolves.toBe('ok');
    expect(delays).toEqual([RETRY_AFTER_MAX_SECONDS * 1000]);

    // The HTTP-date form is parsed (a 120s-ahead date beats the 60s floor).
    delays.length = 0;
    mockUndiciRequest.mockReset();
    const twoMinutesAhead = new Date(Date.now() + 120_000).toUTCString();
    mockUndiciRequest
      .mockResolvedValueOnce({
        statusCode: 429,
        headers: { 'retry-after': twoMinutesAhead },
        body: { json: async () => ({ error: { message: 'rate limited' } }) },
      } as never)
      .mockResolvedValueOnce(success200());
    await expect(callLLM('p', undefined, { maxRetries: 2 })).resolves.toBe('ok');
    expect(delays.length).toBe(1);
    expect(delays[0]).toBeGreaterThanOrEqual(115_000);
    expect(delays[0]).toBeLessThanOrEqual(120_000);
  } finally {
    if (savedKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  }
});

test('gate 16.21: onResponseMeta carries the provider stop reason (anthropic stop_reason / OpenAI finish_reason)', async () => {
  const savedAnthropicKey = process.env.ANTHROPIC_API_KEY;
  const savedOpenAiKey = process.env.OPENAI_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'gate-16-21-fake-key';
  try {
    // Anthropic shape: top-level stop_reason 'max_tokens' = truncation.
    mockUndiciRequest.mockResolvedValueOnce({
      statusCode: 200,
      body: {
        json: async () => ({
          content: [{ type: 'text', text: 'ok' }],
          stop_reason: 'max_tokens',
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      },
    } as never);
    const metas: Array<{ finishReason?: string }> = [];
    await expect(
      callLLM('p', undefined, { onResponseMeta: (meta) => metas.push(meta) }),
    ).resolves.toBe('ok');
    expect(metas).toEqual([{ finishReason: 'max_tokens' }]);

    // OpenAI shape: choices[0].finish_reason 'length' = truncation.
    process.env.OPENAI_API_KEY = 'gate-16-21-openai-key';
    setModelRouting({
      provider: 'openai',
      default: 'gpt-5.6-luna',
      extractor: null,
      synthesis: null,
      dox: null,
      crossWiki: null,
      crossWikiJudgment: null,
    });
    mockUndiciRequest.mockReset();
    mockUndiciRequest.mockResolvedValueOnce({
      statusCode: 200,
      body: {
        json: async () => ({
          choices: [{ message: { content: 'ok' }, finish_reason: 'length' }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
      },
    } as never);
    metas.length = 0;
    await expect(
      callLLM('p', undefined, { onResponseMeta: (meta) => metas.push(meta) }),
    ).resolves.toBe('ok');
    expect(metas).toEqual([{ finishReason: 'length' }]);

    // A normal end-of-turn response carries its stop reason too (no truncation
    // vocabulary — the json-corrector's `isTruncationFinishReason` reads it).
    mockUndiciRequest.mockReset();
    setModelRouting(null);
    mockUndiciRequest.mockResolvedValueOnce({
      statusCode: 200,
      body: {
        json: async () => ({
          content: [{ type: 'text', text: 'ok' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      },
    } as never);
    metas.length = 0;
    await expect(
      callLLM('p', undefined, { onResponseMeta: (meta) => metas.push(meta) }),
    ).resolves.toBe('ok');
    expect(metas).toEqual([{ finishReason: 'end_turn' }]);
  } finally {
    setModelRouting(null);
    if (savedAnthropicKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedAnthropicKey;
    }
    if (savedOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = savedOpenAiKey;
    }
  }
});
