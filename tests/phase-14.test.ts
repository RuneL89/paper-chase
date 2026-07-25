import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import React from 'react';
import { render } from 'ink';
import { afterAll, afterEach, expect, test, vi } from 'vitest';
import { request as undiciRequest } from 'undici';
import matter from 'gray-matter';
import {
  CURATION_SINGLE_CALL_LIMIT,
  bucketCandidates,
  bucketStem,
  curateEntities,
  curateTopics,
  validateEntityDecisions,
  validateTopicDecisions,
  type CurationOutcome,
  type EntityCurationCandidate,
  type TopicCurationCandidate,
} from '../src/agents/curation';
import { rewriteWikilinkTargets } from '../src/utils/wikilinks';
import { materialize } from '../src/materializer';
import { init } from '../src/commands/init';
import { ingest } from '../src/commands/ingest';
import { resolveModel, setModelRouting } from '../src/llm/client';
import { seedModelsForProvider } from '../src/tui/settings';
import { SettingsScreen } from '../src/tui/settings-screen';
import { curationOverridesPath, readCurationOverrides } from '../src/state/curation-overrides';
import { curationReportPath, type CurationReport } from '../src/state/curation-report';
import type { IngestionMetrics } from '../src/state/metrics';
import type { ExtractorResult } from '../src/agents/extractor';
import type { ChunkExtraction } from '../src/commands/extract-chunk';
import type { EntityPageData } from '../src/pages/entity-page';
import type { TopicPageData } from '../src/pages/topic-page';

/**
 * Phase 14 gates 14.1–14.14 (topic & entity curation, phase doc §3; canon:
 * vision `04` §3.2 Step 6 aggregate → curate → apply → write + §6 keep-all
 * fallback, vision `05` §7 topic eligibility + §6 entity identity + §2
 * aliases, vision `07` §2.3 reask bound). EVERY gate is LLM-free ($0): the
 * curation calls are exercised through the injected `callLLMFn` /
 * `curateTopicsFn` / `curateEntitiesFn` seams, and the two transport-policy
 * tests (gate 14.3) mock the undici layer — no live call can happen even
 * with a key present.
 *
 * Gate 14.14 (full-suite regression: `npx tsc --noEmit` clean + key-less
 * `npm test` green, curation stubbed off → pre-Phase-14 behavior
 * byte-identical) is encoded by this file being part of the suite plus the
 * gate-14.4 byte-identity test below; its pass/fail evidence is recorded in
 * `.state/phase-14-status.json`. The only pre-existing suite touched by the
 * restructure is tests/phase-11.test.ts (five enumerated sites: the new
 * Curation Model TUI row shifts row navigation by one and the provider
 * reset now seeds five model slots).
 */

vi.mock('undici', () => ({ request: vi.fn() }));
const mockUndiciRequest = vi.mocked(undiciRequest);

const GOLDEN_MASTER_PDF = 'test-pdfs/golden-master.pdf';
const HAIKU = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-5';
const OPUS = 'claude-opus-4-8';
const GPT_LUNA = 'gpt-5.6-luna';
const GPT_TERRA = 'gpt-5.6-terra';

const tempDirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
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

/** Init a wiki (no PDF needed — materialize reads only .state/extracted). */
function setupWiki(): string {
  const workspace = makeTempDir('paper-chase-g14-');
  init('test-wiki', { workspace });
  return workspace;
}

/** Init a wiki and copy the golden master into raw/ (for ingest-level gates). */
function setupWikiWithPdf(): string {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  mkdirSync(join(wikiDir, 'raw'), { recursive: true });
  copyFileSync(GOLDEN_MASTER_PDF, join(wikiDir, 'raw', 'golden-master.pdf'));
  return workspace;
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/**
 * The Phase 14 fixture: the Odense-clinic pattern (gate 14.6) — three slug
 * variants of one clinic (odense the city page, odense-2, odense-bup) with
 * mentions spread across them and cross-relationships, plus topics that
 * merge (financial/financials, with a duplicate claim text to prove text
 * dedupe) and a meta-descriptor topic to drop (statistical, whose claim
 * stays on acme-corp's page — the preservation contract).
 */
function odenseExtraction(): ExtractorResult {
  return {
    entities: [
      {
        name: 'Odense',
        type: 'place',
        slug: 'odense',
        folder: 'entities/places',
        significance: 'The city where the clinic operates.',
        mentions: [
          { page: 1, context: 'The clinic in Odense treats children.' },
          { page: 2, context: 'Odense municipality funds the program.' },
        ],
      },
      {
        name: 'Odense BUP',
        type: 'organization',
        slug: 'odense-2',
        folder: 'entities/organizations',
        significance: 'The child psychiatry clinic (BUP) in Odense.',
        mentions: [{ page: 1, context: 'Odense BUP opened its doors in 2019.' }],
      },
      {
        name: 'Odense BUP Ambulatorium',
        type: 'organization',
        slug: 'odense-bup',
        folder: 'entities/organizations/health',
        significance: 'The outpatient clinic of Odense BUP.',
        mentions: [{ page: 2, context: 'Odense BUP Ambulatorium handles outpatient visits.' }],
      },
      {
        name: 'Acme Corp',
        type: 'company',
        slug: 'acme-corp',
        folder: 'entities/companies',
        significance: 'The auditor of Odense BUP.',
        mentions: [{ page: 3, context: 'Acme Corp audited Odense BUP in 2024.' }],
      },
    ],
    relationships: [
      {
        subject: 'odense-2',
        predicate: 'located-in',
        object: 'odense',
        evidence: 'Odense BUP is located in Odense',
        page: 1,
      },
      {
        subject: 'acme-corp',
        predicate: 'audited',
        object: 'odense-2',
        evidence: 'Acme Corp audited Odense BUP in 2024',
        page: 3,
      },
    ],
    claims: [
      { text: 'Revenue was $42.5M in Q3 2024', type: 'financial', entities: ['acme-corp'], page: 2 },
      { text: 'The financials were restated in 2025', type: 'financials', entities: ['acme-corp'], page: 2 },
      // Same text under the duplicate topic — the merged topic lists it once.
      { text: 'Revenue was $42.5M in Q3 2024', type: 'financials', entities: ['acme-corp'], page: 2 },
      { text: 'Statistical methods were applied throughout', type: 'statistical', entities: ['acme-corp'], page: 3 },
      { text: 'The board approved the merger', type: 'governance', entities: ['odense-2'], page: 3 },
      { text: 'The audit opinion was unqualified', type: 'audits', entities: ['acme-corp', 'odense-2'], page: 3 },
    ],
    timeline: [
      { date: '2024-11-05', event: 'Acme Corp completed the Odense audit', entities: ['acme-corp', 'odense'] },
    ],
    context: 'Odense clinic fixture for Phase 14.',
  };
}

/** Install one chunk's document page + extraction JSON (phase-13 harness). */
function installChunk(
  wikiDir: string,
  chunkId: string,
  extraction: ExtractorResult,
  pages = '1-3',
  body?: string,
): void {
  const documentsDir = join(wikiDir, 'documents');
  const extractedDir = join(wikiDir, '.state', 'extracted');
  mkdirSync(documentsDir, { recursive: true });
  mkdirSync(extractedDir, { recursive: true });
  const frontmatter = {
    title: chunkId,
    type: 'document',
    sources: [{ file: 'wikis/test-wiki/raw/golden-master.pdf', pages }],
    updated: new Date().toISOString(),
  };
  const content = body ?? `\n## Extracted Text: Pages ${pages}\n\nFake chunk content.\n`;
  writeFileSync(join(documentsDir, `${chunkId}.md`), matter.stringify(content, frontmatter), 'utf-8');
  writeFileSync(
    join(extractedDir, `${chunkId}.json`),
    JSON.stringify(extraction, null, 2) + '\n',
    'utf-8',
  );
}

/** Injected Layer 2 stub for the ingest-level gates (phase-13 harness). */
function makeExtractChunkFnStub(extraction: ExtractorResult) {
  return async (wikiDir: string, chunkId: string): Promise<ChunkExtraction> => {
    const jsonPath = join(wikiDir, '.state', 'extracted', `${chunkId}.json`);
    mkdirSync(join(jsonPath, '..'), { recursive: true });
    writeFileSync(jsonPath, JSON.stringify(extraction, null, 2) + '\n', 'utf-8');
    return {
      chunkId,
      result: extraction,
      jsonPath,
      jsonRelativePath: `.state/extracted/${chunkId}.json`,
    };
  };
}

/** Preservation-passing synthesized entity page (phase-13 harness). */
function entityStubPage(data: EntityPageData): string {
  const lines: string[] = [
    '---',
    `title: ${JSON.stringify(data.title)}`,
    'type: entity',
    `wiki: ${data.wiki}`,
    `updated: ${new Date().toISOString()}`,
    '---',
    '',
    `Synthesis prose for ${data.title}.`,
    '',
    ...data.mentions.map((mention) => `- Page ${mention.page}: "${mention.context}" [^src1]`),
    ...data.relationships.map((relationship) => `- ${relationship.evidence} [^src1]`),
    ...data.claims.map((claim) => `- ${claim.text} [^src1]`),
    '',
    '[^src1]: golden-master.pdf, pages 1-3',
    '',
  ];
  return lines.join('\n');
}

/** Preservation-passing synthesized topic page (phase-13 harness). */
function topicStubPage(data: TopicPageData): string {
  return [
    '---',
    `title: ${JSON.stringify(data.title)}`,
    'type: topic',
    `wiki: ${data.wiki}`,
    `updated: ${new Date().toISOString()}`,
    '---',
    '',
    `Topic synthesis for ${data.title}.`,
    '',
    ...data.claims.map((claim) => `- ${claim.text} [^src1]`),
    '',
    '[^src1]: golden-master.pdf, pages 1-3',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Curation stub helpers
// ---------------------------------------------------------------------------

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function topicCandidate(slug: string, overrides?: Partial<TopicCurationCandidate>): TopicCurationCandidate {
  return {
    slug,
    title: titleCase(slug),
    folder: `topics/${slug}`,
    claimCount: 1,
    sampleClaims: [`A claim about ${slug}.`],
    onDisk: false,
    ...overrides,
  };
}

function entityCandidate(slug: string, overrides?: Partial<EntityCurationCandidate>): EntityCurationCandidate {
  return {
    slug,
    title: titleCase(slug),
    type: 'organization',
    folder: 'entities/organizations',
    mentionCount: 1,
    significance: `Significance of ${slug}.`,
    sampleMentions: [`A mention of ${slug}.`],
    onDisk: false,
    ...overrides,
  };
}

/** A valid keep-all response body for the given slugs (topics or entities). */
function keepAllJson(slugs: string[]): string {
  return JSON.stringify({ merge: [], drop: [], keep: slugs, unsure: [] });
}

/** A keep-all outcome for the materialize-level injected curation stubs. */
function keepAllOutcome(): CurationOutcome {
  // The materialize applies only merges/drops from an injected outcome, so an
  // empty-keep list here is the deterministic no-op (validation already ran
  // inside the real curation call this stub replaces).
  return { decisions: { merges: [], drops: [], keep: [] }, attempts: 1, fallbacks: [], vetoes: [] };
}

/** Parse the candidate slugs out of a filled curation prompt. */
function slugsFromPrompt(prompt: string): string[] {
  const match = /=== CANDIDATES ===\n([\s\S]*?)\n=== END CANDIDATES ===/.exec(prompt);
  if (match === null) {
    throw new Error('no candidates block in curation prompt');
  }
  return (JSON.parse(match[1]) as Array<{ slug: string }>).map((candidate) => candidate.slug);
}

/** The full-merge decision set shared by the materialize-level gates. */
function fullTopicMergeOutcome(): CurationOutcome {
  return {
    decisions: {
      merges: [{ from: ['financials'], into: 'financial' }],
      drops: ['statistical'],
      keep: ['audits', 'financial', 'governance'],
    },
    attempts: 1,
    fallbacks: [],
    vetoes: [],
  };
}

function fullEntityMergeOutcome(): CurationOutcome {
  return {
    decisions: {
      merges: [{ from: ['odense', 'odense-2'], into: 'odense-bup' }],
      drops: [],
      keep: ['acme-corp', 'odense-bup'],
    },
    attempts: 1,
    fallbacks: [],
    vetoes: [],
  };
}

// ---------------------------------------------------------------------------
// Snapshot helpers (gate 14.4 byte-identity)
// ---------------------------------------------------------------------------

/**
 * Map of wiki-relative path -> content for every file under entities/,
 * topics/, and documents/, with `updated:` frontmatter lines stripped (the
 * only run-varying bytes in deterministic pages).
 */
function snapshotContentTree(wikiDir: string): Map<string, string> {
  const snapshot = new Map<string, string>();
  const walk = (absolute: string, relative: string): void => {
    if (!existsSync(absolute)) {
      return;
    }
    for (const entry of readdirSync(absolute, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const entryAbs = join(absolute, entry.name);
      const entryRel = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(entryAbs, entryRel);
      } else if (entry.isFile()) {
        snapshot.set(
          entryRel,
          readFileSync(entryAbs, 'utf-8').replace(/^updated: .*$/gm, 'updated: <stripped>'),
        );
      }
    }
  };
  for (const section of ['entities', 'topics', 'documents']) {
    walk(join(wikiDir, section), section);
  }
  return snapshot;
}

// ---------------------------------------------------------------------------
// TUI harness (phase-11/phase-13 pattern)
// ---------------------------------------------------------------------------

type FakeStdin = PassThrough & {
  isTTY: boolean;
  setRawMode: (mode: boolean) => void;
  ref: () => FakeStdin;
  unref: () => FakeStdin;
};
type FakeStdout = PassThrough & { isTTY: boolean; columns: number; rows: number };

function createFakeStdin(): FakeStdin {
  const stdin = new PassThrough() as FakeStdin;
  stdin.isTTY = true;
  stdin.setRawMode = () => {};
  stdin.ref = () => stdin;
  stdin.unref = () => stdin;
  return stdin;
}

const ESC = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ESC}(?:\\[[0-?]*[ -/]*[@-~]|[@-Z\\\\-_])`, 'g');

async function renderSettingsOutput(workspace: string): Promise<string> {
  const stdin = createFakeStdin();
  const stdout = new PassThrough() as FakeStdout;
  stdout.isTTY = false;
  stdout.columns = 120;
  stdout.rows = 40;
  let output = '';
  stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  const instance = render(
    React.createElement(SettingsScreen, { onBack: () => {}, workspace }),
    {
      stdout: stdout as unknown as NodeJS.WriteStream,
      stdin: stdin as unknown as NodeJS.ReadStream,
    },
  );
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 600));
  instance.unmount();
  return output.replace(ANSI_PATTERN, '');
}

// ---------------------------------------------------------------------------
// Gate 14.1: Decision-list validation rule classes
// ---------------------------------------------------------------------------

const SLUGS = new Set(['alpha', 'beta', 'gamma', 'delta']);

test('gate 14.1: valid topic and entity decision lists pass (unsure folds into keep; into auto-kept)', () => {
  const topics = validateTopicDecisions(
    JSON.stringify({
      merge: [{ from: ['alpha'], into: 'beta' }],
      drop: ['gamma'],
      keep: ['delta'],
      unsure: [],
    }),
    SLUGS,
  );
  expect(topics.valid).toBe(true);
  expect(topics.errors).toEqual([]);
  expect(topics.decisions?.merges).toEqual([{ from: ['alpha'], into: 'beta' }]);
  expect(topics.decisions?.drops).toEqual(['gamma']);
  expect(topics.decisions?.keep).toEqual(['beta', 'delta']);

  const entities = validateEntityDecisions(
    JSON.stringify({
      merge: [{ from: ['alpha'], into: 'beta' }],
      keep: ['gamma'],
      unsure: ['delta'],
    }),
    SLUGS,
  );
  expect(entities.valid).toBe(true);
  expect(entities.decisions?.drops).toEqual([]);
  expect(entities.decisions?.keep).toEqual(['beta', 'delta', 'gamma']);
});

test('gate 14.1: an unknown slug in any bucket is rejected and names the slug', () => {
  const cases: Array<{ label: string; body: unknown }> = [
    { label: 'merge.from', body: { merge: [{ from: ['ghost'], into: 'alpha' }], drop: [], keep: ['beta', 'gamma', 'delta'] } },
    { label: 'merge.into', body: { merge: [{ from: ['alpha'], into: 'ghost' }], drop: [], keep: ['beta', 'gamma', 'delta'] } },
    { label: 'drop', body: { merge: [], drop: ['ghost'], keep: ['alpha', 'beta', 'gamma', 'delta'] } },
    { label: 'keep', body: { merge: [], drop: [], keep: ['alpha', 'beta', 'gamma', 'delta', 'ghost'] } },
    { label: 'unsure', body: { merge: [], drop: [], keep: ['alpha', 'beta', 'gamma', 'delta'], unsure: ['ghost'] } },
  ];
  for (const { label, body } of cases) {
    const result = validateTopicDecisions(JSON.stringify(body), SLUGS);
    expect(result.valid, `bucket ${label}`).toBe(false);
    expect(result.errors.join('\n'), `bucket ${label}`).toContain("unknown slug 'ghost'");
  }
});

test('gate 14.1: a slug in two buckets is rejected', () => {
  const keepAndDrop = validateTopicDecisions(
    JSON.stringify({ merge: [], drop: ['alpha'], keep: ['alpha', 'beta', 'gamma', 'delta'] }),
    SLUGS,
  );
  expect(keepAndDrop.valid).toBe(false);
  expect(keepAndDrop.errors.join('\n')).toContain("slug 'alpha' appears in multiple buckets");

  const intoAndKeep = validateTopicDecisions(
    JSON.stringify({ merge: [{ from: ['beta'], into: 'alpha' }], drop: [], keep: ['alpha', 'gamma', 'delta'] }),
    SLUGS,
  );
  expect(intoAndKeep.valid).toBe(false);
  expect(intoAndKeep.errors.join('\n')).toContain("slug 'alpha' appears in multiple buckets");
});

test('gate 14.1: an input slug missing from every bucket is rejected', () => {
  const result = validateTopicDecisions(
    JSON.stringify({ merge: [], drop: [], keep: ['alpha', 'beta'] }),
    SLUGS,
  );
  expect(result.valid).toBe(false);
  expect(result.errors.join('\n')).toContain('missing from every bucket');
  expect(result.errors.join('\n')).toContain('delta');
  expect(result.errors.join('\n')).toContain('gamma');
});

test('gate 14.1: an into that is dropped is rejected', () => {
  const result = validateTopicDecisions(
    JSON.stringify({ merge: [{ from: ['beta'], into: 'alpha' }], drop: ['alpha'], keep: ['gamma', 'delta'] }),
    SLUGS,
  );
  expect(result.valid).toBe(false);
  expect(result.errors.join('\n')).toContain("merge target 'alpha' is dropped");
});

test('gate 14.1: a self-merge is rejected', () => {
  const result = validateTopicDecisions(
    JSON.stringify({ merge: [{ from: ['alpha', 'beta'], into: 'alpha' }], drop: [], keep: ['gamma', 'delta'] }),
    SLUGS,
  );
  expect(result.valid).toBe(false);
  expect(result.errors.join('\n')).toContain('self-merge');
});

test('gate 14.1: entity curation is merge-only — a non-empty drop bucket is rejected', () => {
  const result = validateEntityDecisions(
    JSON.stringify({ merge: [], drop: ['alpha'], keep: ['beta', 'gamma', 'delta'] }),
    SLUGS,
  );
  expect(result.valid).toBe(false);
  expect(result.errors.join('\n')).toContain('merge-only');
});

test('gate 14.1: malformed output is rejected; fenced JSON parses', () => {
  expect(validateTopicDecisions('not json at all', SLUGS).valid).toBe(false);
  expect(validateTopicDecisions('[1,2,3]', SLUGS).valid).toBe(false);
  expect(validateTopicDecisions('{"merge": "nope"}', SLUGS).valid).toBe(false);
  const fenced = validateTopicDecisions(
    '```json\n{"merge":[],"drop":[],"keep":["alpha","beta","gamma","delta"],"unsure":[]}\n```',
    SLUGS,
  );
  expect(fenced.valid).toBe(true);
});

// ---------------------------------------------------------------------------
// Gate 14.2: Union-find chain resolution
// ---------------------------------------------------------------------------

test('gate 14.2: A->B, B->C collapses deterministically to one merge into the canonical survivor', () => {
  const slugs = new Set(['a-x', 'b-x', 'c-x', 'd-x']);
  const result = validateTopicDecisions(
    JSON.stringify({
      merge: [
        { from: ['a-x'], into: 'b-x' },
        { from: ['b-x'], into: 'c-x' },
      ],
      drop: [],
      keep: ['d-x'],
      unsure: [],
    }),
    slugs,
  );
  expect(result.valid).toBe(true);
  expect(result.decisions?.merges).toEqual([{ from: ['a-x', 'b-x'], into: 'c-x' }]);
  expect(result.decisions?.keep).toEqual(['c-x', 'd-x']);
});

test('gate 14.2: a merge cycle (into merged away — no unique survivor) is rejected', () => {
  const slugs = new Set(['a-x', 'b-x', 'c-x', 'd-x']);
  const result = validateTopicDecisions(
    JSON.stringify({
      merge: [
        { from: ['a-x'], into: 'b-x' },
        { from: ['b-x'], into: 'a-x' },
      ],
      drop: [],
      keep: ['c-x', 'd-x'],
      unsure: [],
    }),
    slugs,
  );
  expect(result.valid).toBe(false);
  expect(result.errors.join('\n')).toContain('no unique survivor');
});

test('gate 14.2: a legitimate chain passes on the FIRST attempt — no reask loop', async () => {
  const candidates = ['a-x', 'b-x', 'c-x'].map((slug) => topicCandidate(slug));
  const prompts: string[] = [];
  const outcome = await curateTopics(candidates, {
    agentsMd: 'Test constitution.',
    callLLMFn: async (prompt) => {
      prompts.push(prompt);
      return JSON.stringify({
        merge: [
          { from: ['a-x'], into: 'b-x' },
          { from: ['b-x'], into: 'c-x' },
        ],
        drop: [],
        keep: [],
        unsure: [],
      });
    },
  });
  expect(prompts).toHaveLength(1);
  expect(outcome.attempts).toBe(1);
  expect(outcome.fallbacks).toEqual([]);
  expect(outcome.decisions?.merges).toEqual([{ from: ['a-x', 'b-x'], into: 'c-x' }]);
  expect(outcome.decisions?.keep).toEqual(['c-x']);
});

// ---------------------------------------------------------------------------
// Gate 14.3: Reask then keep-all fallback
// ---------------------------------------------------------------------------

test('gate 14.3: attempt 1 invalid -> attempt 2 prompt carries the offending entries -> valid -> applied', async () => {
  const candidates = ['alpha', 'beta', 'gamma'].map((slug) => topicCandidate(slug));
  const prompts: string[] = [];
  const contexts: Array<string | undefined> = [];
  const outcome = await curateTopics(candidates, {
    agentsMd: 'Test constitution.',
    callLLMFn: async (prompt, options) => {
      prompts.push(prompt);
      contexts.push(options.context);
      if (prompts.length === 1) {
        // Offending entry: a slug that does not exist in the candidate set.
        return JSON.stringify({ merge: [], drop: [], keep: ['alpha', 'beta', 'gamma', 'ghost'], unsure: [] });
      }
      return JSON.stringify({
        merge: [{ from: ['beta'], into: 'alpha' }],
        drop: [],
        keep: ['gamma'],
        unsure: [],
      });
    },
  });
  expect(prompts).toHaveLength(2);
  // The reask prompt is the base prompt plus the correction block, which
  // feeds the exact offending entries back (phase doc §2.2).
  expect(prompts[1].startsWith(`${prompts[0]}\n\n=== CORRECTION REQUIRED ===`)).toBe(true);
  expect(prompts[1]).toContain("unknown slug 'ghost'");
  expect(contexts).toEqual(['curation-topics', 'curation-topics#attempt2']);
  expect(outcome.attempts).toBe(2);
  expect(outcome.fallbacks).toEqual([]);
  expect(outcome.decisions?.merges).toEqual([{ from: ['beta'], into: 'alpha' }]);
  expect(outcome.decisions?.keep).toEqual(['alpha', 'gamma']);
});

test('gate 14.3: all attempts invalid -> keep-all fallback (decisions null, cause validation-exhaustion)', async () => {
  const candidates = ['alpha', 'beta'].map((slug) => topicCandidate(slug));
  let calls = 0;
  const outcome = await curateTopics(candidates, {
    agentsMd: 'Test constitution.',
    callLLMFn: async () => {
      calls += 1;
      return JSON.stringify({ merge: [], drop: [], keep: ['alpha', 'beta', 'ghost'], unsure: [] });
    },
  });
  expect(calls).toBe(3); // the Phase 12 reask bound
  expect(outcome.attempts).toBe(3);
  expect(outcome.decisions).toBeNull();
  expect(outcome.fallbacks).toEqual([{ scope: 'curation-topics', cause: 'validation-exhaustion' }]);
});

test('gate 14.3: HTTP 4xx -> immediate fallback, zero transport retries, zero reasks', async () => {
  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'gate-14-3-test-key';
  mockUndiciRequest.mockResolvedValue({
    statusCode: 400,
    body: { json: async () => ({ error: { message: 'bad request' } }) },
  } as never);
  try {
    const outcome = await curateTopics([topicCandidate('alpha')], { agentsMd: 'Test constitution.' });
    expect(mockUndiciRequest).toHaveBeenCalledTimes(1);
    expect(outcome.decisions).toBeNull();
    expect(outcome.fallbacks).toEqual([{ scope: 'curation-topics', cause: 'http-4xx' }]);
  } finally {
    if (savedKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  }
}, 30000);

test('gate 14.3: transient exhaustion -> fallback only after the bounded transport retries', async () => {
  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'gate-14-3-test-key';
  mockUndiciRequest.mockResolvedValue({
    statusCode: 429,
    body: { json: async () => ({ error: { message: 'rate limited' } }) },
  } as never);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const outcome = await curateTopics([topicCandidate('alpha')], { agentsMd: 'Test constitution.' });
    // maxRetries: 2 inside the curation transport options -> 3 total calls.
    expect(mockUndiciRequest).toHaveBeenCalledTimes(3);
    expect(outcome.decisions).toBeNull();
    expect(outcome.fallbacks).toEqual([{ scope: 'curation-topics', cause: 'transport-exhaustion' }]);
  } finally {
    warn.mockRestore();
    if (savedKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  }
}, 30000);

test('gate 14.3 (materialize level): fallback warns, lands in the report, and writes every candidate as-is', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', odenseExtraction());
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const result = await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async () => ({
      decisions: null,
      attempts: 3,
      fallbacks: [{ scope: 'curation-topics', cause: 'validation-exhaustion' }],
      vetoes: [],
    }),
    curateEntitiesFn: async () => keepAllOutcome(),
  });
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('topic curation keep-all fallback'));
  expect(result.curation?.fallbacks).toEqual([
    { concern: 'topics', scope: 'curation-topics', cause: 'validation-exhaustion' },
  ]);
  // Keep-all: nothing merged, nothing dropped, nothing deleted.
  expect(result.curation?.topicMerges).toEqual([]);
  expect(result.curation?.topicDrops).toEqual([]);
  expect(result.curation?.removedPages).toEqual([]);
  expect(result.topicPages.map((page) => page.slug).sort()).toEqual([
    'audits',
    'financial',
    'financials',
    'governance',
    'statistical',
  ]);
  expect(result.entityPages.map((page) => page.slug).sort()).toEqual([
    'acme-corp',
    'odense',
    'odense-2',
    'odense-bup',
  ]);
  const report = JSON.parse(readFileSync(curationReportPath(wikiDir), 'utf-8')) as CurationReport;
  expect(report.topics.fallbacks).toEqual([{ scope: 'curation-topics', cause: 'validation-exhaustion' }]);
  expect(report.entities.fallbacks).toEqual([]);
});

test('gate 14.3 (ingest level): the fallback lands in the additive curationFallbacks metrics counter', async () => {
  const workspace = setupWikiWithPdf();
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  await ingest('test-wiki', {
    workspace,
    synthesis: true,
    extractChunkFn: makeExtractChunkFnStub(odenseExtraction()),
    synthesizeEntityFn: async (data) => entityStubPage(data),
    synthesizeEntityPermissiveFn: async () => 'permissive stub (never called)',
    synthesizeTopicFn: async (data) => topicStubPage(data),
    synthesizeTopicPermissiveFn: async () => 'topic permissive stub (never called)',
    curateTopicsFn: async () => ({
      decisions: null,
      attempts: 3,
      fallbacks: [{ scope: 'curation-topics', cause: 'validation-exhaustion' }],
      vetoes: [],
    }),
    curateEntitiesFn: async () => keepAllOutcome(),
  });
  const metrics = JSON.parse(
    readFileSync(wikiPath(workspace, '.state', 'metrics.json'), 'utf-8'),
  ) as IngestionMetrics;
  expect(metrics.curationFallbacks).toBe(1);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('topic curation keep-all fallback'));
}, 60000);

// ---------------------------------------------------------------------------
// Gate 14.4: All-or-nothing application (byte-identical keep-all)
// ---------------------------------------------------------------------------

test('gate 14.4: curation ON with a fallback/keep-all outcome is byte-identical to curation OFF', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', odenseExtraction());

  // Run A: pre-Phase-14 path (curation flag absent).
  const resultA = await materialize('test-wiki', { workspace });
  expect(resultA.curation).toBeUndefined();
  const treeA = snapshotContentTree(wikiDir);
  const memoryA = readFileSync(join(wikiDir, '.state', 'rolling-memory.json'), 'utf-8');

  // Reset the generated state (extraction JSONs stay — they are input).
  rmSync(join(wikiDir, 'entities'), { recursive: true, force: true });
  rmSync(join(wikiDir, 'topics'), { recursive: true, force: true });
  for (const stateFile of readdirSync(join(wikiDir, '.state'))) {
    if (stateFile !== 'extracted') {
      rmSync(join(wikiDir, '.state', stateFile), { recursive: true, force: true });
    }
  }

  // Run B: curation enabled; topics fall back (decisions null), entities
  // return a valid keep-all — a list that fails validation applies NOTHING,
  // and a 90%-valid list is never partially applied (all-or-nothing).
  const resultB = await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async () => ({
      decisions: null,
      attempts: 3,
      fallbacks: [{ scope: 'curation-topics', cause: 'validation-exhaustion' }],
      vetoes: [],
    }),
    curateEntitiesFn: async () => keepAllOutcome(),
  });
  expect(resultB.curation?.fallbacks).toHaveLength(1);

  const treeB = snapshotContentTree(wikiDir);
  const memoryB = readFileSync(join(wikiDir, '.state', 'rolling-memory.json'), 'utf-8');

  expect([...treeB.keys()].sort()).toEqual([...treeA.keys()].sort());
  for (const [path, contentA] of treeA.entries()) {
    expect(treeB.get(path), path).toBe(contentA);
  }
  // Rolling memory has no timestamps — byte-comparable across runs.
  expect(memoryB).toBe(memoryA);
});

// ---------------------------------------------------------------------------
// Gate 14.5: Topic merge/drop application
// ---------------------------------------------------------------------------

test('gate 14.5: topic merge unions claims (text-deduped, title from into); dropped topics vanish but their claims survive', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', odenseExtraction());

  const result = await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async () => fullTopicMergeOutcome(),
    curateEntitiesFn: async () => keepAllOutcome(),
  });

  expect(result.curation?.topicMerges).toEqual([{ from: ['financials'], into: 'financial' }]);
  expect(result.curation?.topicDrops).toEqual(['statistical']);
  expect(result.topicPages.map((page) => page.slug).sort()).toEqual([
    'audits',
    'financial',
    'governance',
  ]);

  // Merge: claims unioned into the survivor, identical texts deduped, title
  // from the into topic.
  const financialPath = wikiPath(workspace, 'topics', 'financial', 'financial.md');
  expect(existsSync(financialPath)).toBe(true);
  const financialRaw = readFileSync(financialPath, 'utf-8');
  expect(matter(financialRaw).data.title).toBe('Financial');
  expect(financialRaw).toContain('The financials were restated in 2025');
  expect(financialRaw.split('Revenue was $42.5M in Q3 2024').length - 1).toBe(1);

  // The merged-away and dropped topics are never written.
  expect(existsSync(wikiPath(workspace, 'topics', 'financials'))).toBe(false);
  expect(existsSync(wikiPath(workspace, 'topics', 'statistical'))).toBe(false);

  // Preservation contract: the dropped topic's claim still appears on its
  // entity page and in the document page data.
  const acme = result.entityPages.find((page) => page.slug === 'acme-corp');
  expect(acme?.claims.map((claim) => claim.text)).toContain(
    'Statistical methods were applied throughout',
  );
  const acmeRaw = readFileSync(wikiPath(workspace, 'entities', 'companies', 'acme-corp.md'), 'utf-8');
  expect(acmeRaw).toContain('Statistical methods were applied throughout');
  expect(result.documentPages[0]?.claims.map((claim) => claim.text)).toContain(
    'Statistical methods were applied throughout',
  );

  const report = JSON.parse(readFileSync(curationReportPath(wikiDir), 'utf-8')) as CurationReport;
  expect(report.topics.merges).toEqual([{ from: ['financials'], into: 'financial' }]);
  expect(report.topics.drops).toEqual(['statistical']);
});

// ---------------------------------------------------------------------------
// Gate 14.6: Entity merge application (the Odense-clinic pattern)
// ---------------------------------------------------------------------------

test('gate 14.6: entity merge unions everything, repoints relationships, accumulates aliases, leaves no old pages', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', odenseExtraction());

  const result = await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async () => fullEntityMergeOutcome(),
  });

  expect(result.curation?.entityMerges).toEqual([
    { from: ['odense', 'odense-2'], into: 'odense-bup' },
  ]);
  expect(result.entityPages.map((page) => page.slug).sort()).toEqual(['acme-corp', 'odense-bup']);

  const into = result.entityPages.find((page) => page.slug === 'odense-bup');
  expect(into?.folder).toBe('entities/organizations/health');
  // Mentions unioned across the three variants and deduped (2 + 1 + 1).
  expect(into?.mentions).toHaveLength(4);
  expect(into?.mentions.map((mention) => mention.context)).toEqual(
    expect.arrayContaining([
      'The clinic in Odense treats children.',
      'Odense municipality funds the program.',
      'Odense BUP opened its doors in 2019.',
      'Odense BUP Ambulatorium handles outpatient visits.',
    ]),
  );
  // Relationships unioned; subject/object slugs repointed to the survivor
  // (the located-in self-loop is kept — the union is literal).
  const locatedIn = into?.relationships.find((relationship) => relationship.predicate === 'located-in');
  expect(locatedIn?.subject).toBe('odense-bup');
  expect(locatedIn?.object).toBe('odense-bup');
  // Claims unioned (board approval via odense-2; audit opinion via odense-2).
  expect(into?.claims.map((claim) => claim.text).sort()).toEqual([
    'The audit opinion was unqualified',
    'The board approved the merger',
  ]);
  // Timeline unioned and repointed.
  expect(into?.timeline).toHaveLength(1);
  expect(into?.timeline?.[0]?.entities).toEqual(['acme-corp', 'odense-bup']);
  // Every variant title accumulated as an alias of the canonical page.
  expect(into?.mergedAliases).toEqual(expect.arrayContaining(['Odense', 'Odense BUP']));

  // The relationship on the unmerged entity is repointed too.
  const acme = result.entityPages.find((page) => page.slug === 'acme-corp');
  expect(acme?.relationships[0]?.object).toBe('odense-bup');

  // One page at the into folder; nothing left at the old folders (single-run:
  // the merged-away pages are never even written).
  const intoPath = wikiPath(workspace, 'entities', 'organizations', 'health', 'odense-bup.md');
  expect(existsSync(intoPath)).toBe(true);
  expect(existsSync(wikiPath(workspace, 'entities', 'places', 'odense.md'))).toBe(false);
  expect(existsSync(wikiPath(workspace, 'entities', 'organizations', 'odense-2.md'))).toBe(false);

  // The on-disk page carries the aliases in frontmatter (vision `05` §2).
  const intoFrontmatter = matter(readFileSync(intoPath, 'utf-8')).data;
  expect(intoFrontmatter.aliases).toEqual(expect.arrayContaining(['Odense', 'Odense BUP']));
  expect(intoFrontmatter.title).toBe('Odense BUP Ambulatorium');
});

// ---------------------------------------------------------------------------
// Gate 14.7: Exact-segment wikilink rewrite
// ---------------------------------------------------------------------------

test('gate 14.7 (unit): pipe form, bare form, prefix collisions, empty map', () => {
  const rewrites = new Map([['odense', { into: 'odense-bup', fromTitle: 'Odense' }]]);
  expect(rewriteWikilinkTargets('See [[odense|the city]] now.', rewrites)).toBe(
    'See [[odense-bup|the city]] now.',
  );
  expect(rewriteWikilinkTargets('See [[odense]] now.', rewrites)).toBe(
    'See [[odense-bup|Odense]] now.',
  );
  // Prefix-collision safety: the exact target segment must match, so
  // odense-bup-auditorium and odense-2 are NOT touched by the odense rewrite.
  expect(rewriteWikilinkTargets('[[odense-bup-auditorium|X]] and [[odense-2]]', rewrites)).toBe(
    '[[odense-bup-auditorium|X]] and [[odense-2]]',
  );
  // An empty map returns the input byte-identically.
  const input = '[[odense]] unchanged';
  expect(rewriteWikilinkTargets(input, new Map())).toBe(input);
});

test('gate 14.7 (integration): links inside pre-existing document pages are rewritten; frontmatter and citations untouched', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  const body =
    '\n## Extracted Text: Pages 1-3\n\n' +
    'Links: [[odense|the city]], [[odense]], [[odense-bup-auditorium|X]], [[odense-2]]. [^src1]\n\n' +
    '[^src1]: golden-master.pdf, pages 1-3\n';
  installChunk(wikiDir, 'golden-master-part-001', odenseExtraction(), '1-3', body);

  const result = await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async () => ({
      decisions: {
        merges: [{ from: ['odense'], into: 'odense-bup' }],
        drops: [],
        keep: ['acme-corp', 'odense-2', 'odense-bup'],
      },
      attempts: 1,
      fallbacks: [],
      vetoes: [],
    }),
  });

  const documentPath = wikiPath(workspace, 'documents', 'golden-master-part-001.md');
  const rewrittenRaw = readFileSync(documentPath, 'utf-8');
  expect(rewrittenRaw).toContain('[[odense-bup|the city]]');
  expect(rewrittenRaw).toContain('[[odense-bup|Odense]]');
  // Prefix collisions and kept slugs untouched.
  expect(rewrittenRaw).toContain('[[odense-bup-auditorium|X]]');
  expect(rewrittenRaw).toContain('[[odense-2]]');
  expect(rewrittenRaw).not.toContain('[[odense]]');
  expect(rewrittenRaw).not.toContain('[[odense|');
  // Frontmatter + citation markers untouched.
  const parsed = matter(rewrittenRaw);
  expect(parsed.data.title).toBe('golden-master-part-001');
  expect(parsed.data.type).toBe('document');
  expect(rewrittenRaw).toContain('[^src1]');

  expect(result.curation?.rewrittenLinks.map((entry) => entry.path)).toEqual([
    'documents/golden-master-part-001.md',
  ]);
});

test('gate 14.7 (integration, topics): a topic merge repoints wikilinks across content pages; prefix collisions and the into-slug untouched', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  const body =
    '\n## Extracted Text: Pages 1-3\n\n' +
    'Links: [[financials|the financials topic]], [[financials]], [[financials-quarterly]], [[financial]]. [^src1]\n\n' +
    '[^src1]: golden-master.pdf, pages 1-3\n';
  installChunk(wikiDir, 'golden-master-part-001', odenseExtraction(), '1-3', body);

  const result = await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async () => fullTopicMergeOutcome(),
    curateEntitiesFn: async () => keepAllOutcome(),
  });

  // The topic merge applied (financials → financial) and registered into the
  // same rewrite pass the entity merges use.
  expect(result.curation?.topicMerges).toEqual([{ from: ['financials'], into: 'financial' }]);
  const documentPath = wikiPath(workspace, 'documents', 'golden-master-part-001.md');
  const rewrittenRaw = readFileSync(documentPath, 'utf-8');
  // Pipe form keeps its display text; bare form gains "|From Title".
  expect(rewrittenRaw).toContain('[[financial|the financials topic]]');
  expect(rewrittenRaw).toContain('[[financial|Financials]]');
  // Exact-segment matching: the prefix collision and the into-slug are untouched.
  expect(rewrittenRaw).toContain('[[financials-quarterly]]');
  expect(rewrittenRaw).toContain('[[financial]].');
  expect(rewrittenRaw).not.toContain('[[financials]]');
  expect(rewrittenRaw).not.toContain('[[financials|');
  // Frontmatter + citation markers untouched.
  const parsed = matter(rewrittenRaw);
  expect(parsed.data.title).toBe('golden-master-part-001');
  expect(rewrittenRaw).toContain('[^src1]');

  expect(result.curation?.rewrittenLinks.map((entry) => entry.path)).toEqual([
    'documents/golden-master-part-001.md',
  ]);
});

// ---------------------------------------------------------------------------
// Gate 14.8: Manual-edit skip
// ---------------------------------------------------------------------------

test('gate 14.8: a manually-edited from-page is skipped, logged as a conflict, and treated as keep', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', odenseExtraction());

  // Run 1 (curation OFF): the tool's own writes become the recorded hashes.
  const run1 = await materialize('test-wiki', { workspace });
  const pageHashes = Object.fromEntries(run1.writtenPages.map((page) => [page.path, page.hash]));

  // The journalist edits the odense page.
  const odensePath = wikiPath(workspace, 'entities', 'places', 'odense.md');
  writeFileSync(odensePath, `${readFileSync(odensePath, 'utf-8')}\nManual note by the journalist.\n`, 'utf-8');

  // Run 2: curation wants odense merged away — the veto must fire.
  const run2 = await materialize('test-wiki', {
    workspace,
    pageHashes,
    curation: true,
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async () => ({
      decisions: {
        merges: [{ from: ['odense'], into: 'odense-bup' }],
        drops: [],
        keep: ['acme-corp', 'odense-2', 'odense-bup'],
      },
      attempts: 1,
      fallbacks: [],
      vetoes: [],
    }),
  });

  expect(run2.curation?.manualEditSkips).toEqual([
    { page: 'entities/places/odense.md', concern: 'entities', action: 'merge' },
  ]);
  // The vetoed merge applies NOTHING (its only from was skipped).
  expect(run2.curation?.entityMerges).toEqual([]);
  expect(run2.curation?.removedPages).toEqual([]);

  // The manual edit survives (the page is never merged away or overwritten).
  expect(readFileSync(odensePath, 'utf-8')).toContain('Manual note by the journalist.');
  // ...and the conflict log records the curation-specific reason.
  const conflicts = JSON.parse(readFileSync(wikiPath(workspace, '.state', 'conflicts.json'), 'utf-8')) as {
    conflicts: Array<{ page?: string; reason?: string; type?: string }>;
  };
  const curationEntry = conflicts.conflicts.find(
    (entry) => entry.page === 'entities/places/odense.md' && (entry.reason ?? '').includes('Curation entities merge'),
  );
  expect(curationEntry?.type).toBe('manual-edit');
  expect(curationEntry?.reason).toContain("merge of 'odense' into 'odense-bup'");

  // The rest of the application proceeds: odense-bup is re-materialized.
  expect(existsSync(wikiPath(workspace, 'entities', 'organizations', 'health', 'odense-bup.md'))).toBe(true);
});

// ---------------------------------------------------------------------------
// Gate 14.9: Update-mode deletions + re-materialization
// ---------------------------------------------------------------------------

test('gate 14.9: on-disk merged-away/dropped pages are deleted with their empty folder chains; survivors re-materialize', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', odenseExtraction());

  // Run 1 (curation OFF): every candidate lands on disk.
  const run1 = await materialize('test-wiki', { workspace });
  expect(existsSync(wikiPath(workspace, 'topics', 'financials', 'financials.md'))).toBe(true);
  expect(existsSync(wikiPath(workspace, 'entities', 'places', 'odense.md'))).toBe(true);
  const pageHashes = Object.fromEntries(run1.writtenPages.map((page) => [page.path, page.hash]));

  // Run 2 (curation ON): merge financials->financial, drop statistical,
  // merge odense + odense-2 -> odense-bup.
  const run2 = await materialize('test-wiki', {
    workspace,
    pageHashes,
    curation: true,
    curateTopicsFn: async () => fullTopicMergeOutcome(),
    curateEntitiesFn: async () => fullEntityMergeOutcome(),
  });

  // Deletions: every on-disk location of a merged-away/dropped slug.
  expect(run2.curation?.removedPages.sort()).toEqual([
    'entities/organizations/odense-2.md',
    'entities/places/odense.md',
    'topics/financials/financials.md',
    'topics/statistical/statistical.md',
  ]);
  expect(existsSync(wikiPath(workspace, 'topics', 'financials', 'financials.md'))).toBe(false);
  expect(existsSync(wikiPath(workspace, 'topics', 'statistical', 'statistical.md'))).toBe(false);
  expect(existsSync(wikiPath(workspace, 'entities', 'places', 'odense.md'))).toBe(false);
  expect(existsSync(wikiPath(workspace, 'entities', 'organizations', 'odense-2.md'))).toBe(false);

  // Empty folder chains pruned deterministically; non-empty parents survive.
  expect(existsSync(wikiPath(workspace, 'topics', 'financials'))).toBe(false);
  expect(existsSync(wikiPath(workspace, 'topics', 'statistical'))).toBe(false);
  expect(existsSync(wikiPath(workspace, 'entities', 'places'))).toBe(false);
  expect(existsSync(wikiPath(workspace, 'topics'))).toBe(true);
  expect(existsSync(wikiPath(workspace, 'entities', 'organizations'))).toBe(true);

  // The into pages are re-materialized (and thereby re-enter synthesis).
  expect(run2.topicPages.map((page) => page.slug).sort()).toEqual(['audits', 'financial', 'governance']);
  expect(run2.entityPages.map((page) => page.slug).sort()).toEqual(['acme-corp', 'odense-bup']);
  const financialRaw = readFileSync(wikiPath(workspace, 'topics', 'financial', 'financial.md'), 'utf-8');
  expect(financialRaw).toContain('The financials were restated in 2025');
  expect(existsSync(wikiPath(workspace, 'entities', 'organizations', 'health', 'odense-bup.md'))).toBe(true);

  // Rolling memory (written AFTER curation) reflects the curated set.
  const memory = JSON.parse(readFileSync(wikiPath(workspace, '.state', 'rolling-memory.json'), 'utf-8')) as {
    entities: Array<{ slug: string }>;
    topics: string[];
  };
  expect(memory.entities.map((entity) => entity.slug)).toEqual(['acme-corp', 'odense-bup']);
  expect(memory.topics).toEqual(['audits', 'financial', 'governance']);

  // The report records the deletions.
  const report = JSON.parse(readFileSync(curationReportPath(wikiDir), 'utf-8')) as CurationReport;
  expect(report.removedPages.sort()).toEqual([
    'entities/organizations/odense-2.md',
    'entities/places/odense.md',
    'topics/financials/financials.md',
    'topics/statistical/statistical.md',
  ]);
  expect(report.entities.merges).toEqual([{ from: ['odense', 'odense-2'], into: 'odense-bup' }]);
});

// ---------------------------------------------------------------------------
// Gate 14.10: The `curation` model-routing slot
// ---------------------------------------------------------------------------

test('gate 14.10: resolveModel maps the curation call type through the routing table', () => {
  setModelRouting({ default: HAIKU, extractor: HAIKU, synthesis: OPUS, dox: null, curation: SONNET });
  try {
    expect(resolveModel('curation')).toBe(SONNET);
    // A null entry means "Same as default".
    setModelRouting({ default: HAIKU, extractor: null, synthesis: null, dox: null, curation: null });
    expect(resolveModel('curation')).toBe(HAIKU);
    // An explicit per-call override beats the routing table.
    expect(resolveModel('curation', OPUS)).toBe(OPUS);
    // The other call types are unaffected by the new slot.
    expect(resolveModel('synthesis')).toBe(HAIKU);
  } finally {
    setModelRouting(null);
  }
});

test('gate 14.10: a legacy routing table without the field normalizes to null (byte-identical behavior)', () => {
  setModelRouting({ default: HAIKU, extractor: HAIKU, synthesis: SONNET, dox: null });
  try {
    expect(resolveModel('curation')).toBe(HAIKU);
    expect(resolveModel('synthesis')).toBe(SONNET);
  } finally {
    setModelRouting(null);
  }
});

test('gate 14.10: seedModelsForProvider seeds the mid-tier curation default on both providers', () => {
  expect(seedModelsForProvider('anthropic')).toEqual({
    provider: 'anthropic',
    default: HAIKU,
    extractor: null,
    synthesis: null,
    dox: null,
    curation: SONNET,
  });
  expect(seedModelsForProvider('openai')).toEqual({
    provider: 'openai',
    default: GPT_LUNA,
    extractor: null,
    synthesis: null,
    dox: null,
    curation: GPT_TERRA,
  });
});

test('gate 14.10: the Settings screen shows the Curation Model row with mid-tier recommendations on both providers', async () => {
  const anthropicWorkspace = makeTempDir('paper-chase-g14-10a-');
  const anthropicOutput = await renderSettingsOutput(anthropicWorkspace);
  expect(anthropicOutput).toContain('Curation Model');
  expect(anthropicOutput).toContain('Sonnet — mid-tier judgment for merge/drop decisions');

  const openaiWorkspace = makeTempDir('paper-chase-g14-10b-');
  writeFileSync(
    join(openaiWorkspace, '.paper-chase.json'),
    JSON.stringify({
      synthesis: true,
      updateAgents: false,
      models: { provider: 'openai', default: GPT_LUNA, extractor: null, synthesis: null, dox: null },
      apiKeys: { anthropic: null, openai: null },
    }),
    'utf-8',
  );
  const openaiOutput = await renderSettingsOutput(openaiWorkspace);
  expect(openaiOutput).toContain('Curation Model');
  expect(openaiOutput).toContain('GPT-5.6 Terra — mid-tier judgment for merge/drop decisions');
}, 30000);

// ---------------------------------------------------------------------------
// Gate 14.11: Overrides honored
// ---------------------------------------------------------------------------

test('gate 14.11: readCurationOverrides creates an empty file when absent and ignores malformed content with a warning', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);

  // Absent -> created empty.
  expect(existsSync(curationOverridesPath(wikiDir))).toBe(false);
  const created = await readCurationOverrides(wikiDir);
  expect(created.neverMerge).toEqual([]);
  expect(JSON.parse(readFileSync(curationOverridesPath(wikiDir), 'utf-8'))).toEqual({ neverMerge: [] });

  // Malformed JSON -> ignored with a warning (never crashes).
  writeFileSync(curationOverridesPath(wikiDir), '{ not json', 'utf-8');
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const malformed = await readCurationOverrides(wikiDir);
  expect(malformed.neverMerge).toEqual([]);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('curation-overrides.json'));
  warn.mockRestore();

  // Valid JSON, wrong shape -> same treatment.
  writeFileSync(curationOverridesPath(wikiDir), JSON.stringify({ neverMerge: 'not-an-array' }), 'utf-8');
  const warn2 = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const wrongShape = await readCurationOverrides(wikiDir);
  expect(wrongShape.neverMerge).toEqual([]);
  expect(warn2).toHaveBeenCalledWith(expect.stringContaining('curation-overrides.json'));
  warn2.mockRestore();
});

test('gate 14.11: a neverMerge pair is forced into keep even when the model merges it', async () => {
  const candidates = ['odense', 'odense-bup', 'acme-corp'].map((slug) => entityCandidate(slug));
  const outcome = await curateEntities(candidates, {
    agentsMd: 'Test constitution.',
    neverMerge: [['odense', 'odense-bup']],
    callLLMFn: async () =>
      JSON.stringify({
        merge: [{ from: ['odense'], into: 'odense-bup' }],
        keep: ['acme-corp'],
        unsure: [],
      }),
  });
  expect(outcome.fallbacks).toEqual([]);
  expect(outcome.vetoes).toEqual([{ from: 'odense', into: 'odense-bup' }]);
  expect(outcome.decisions?.merges).toEqual([]);
  expect(outcome.decisions?.keep).toEqual(['acme-corp', 'odense', 'odense-bup']);
});

test('gate 14.11: the materializer passes the overrides file through to both curation calls', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', odenseExtraction());
  mkdirSync(join(wikiDir, '.state'), { recursive: true });
  writeFileSync(
    curationOverridesPath(wikiDir),
    JSON.stringify({ neverMerge: [['odense', 'odense-bup']] }),
    'utf-8',
  );

  const seenNeverMerge: Array<Array<[string, string]> | undefined> = [];
  await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async (_candidates, options) => {
      seenNeverMerge.push(options.neverMerge);
      return keepAllOutcome();
    },
    curateEntitiesFn: async (_candidates, options) => {
      seenNeverMerge.push(options.neverMerge);
      return keepAllOutcome();
    },
  });
  expect(seenNeverMerge).toHaveLength(2);
  for (const neverMerge of seenNeverMerge) {
    expect(neverMerge).toEqual([['odense', 'odense-bup']]);
  }
});

// ---------------------------------------------------------------------------
// Gate 14.12: Two-round scaling
// ---------------------------------------------------------------------------

test('gate 14.12 (unit): bucketStem normalizes plurals and trailing digits; bucketCandidates packs deterministically', () => {
  expect(bucketStem('topic-001')).toBe('topic');
  expect(bucketStem('Topic-010')).toBe('topic');
  expect(bucketStem('financials')).toBe('financial');
  expect(bucketStem('external-factors')).toBe('external-factor');
  expect(bucketStem('odense-2')).toBe('odense');
  expect(bucketStem('odense-bup')).toBe('odense-bup');

  const candidates = ['a-1', 'a-2', 'a-3', 'b-1'].map((slug) => topicCandidate(slug));
  const buckets = bucketCandidates(candidates, 3);
  // Stems sorted (a before b); the oversized stem group splits in order.
  expect(buckets.map((bucket) => bucket.map((candidate) => candidate.slug))).toEqual([
    ['a-1', 'a-2', 'a-3'],
    ['b-1'],
  ]);
  expect(buckets.map((bucket) => bucket.map((candidate) => candidate.slug))).toEqual(
    bucketCandidates(candidates, 3).map((bucket) => bucket.map((candidate) => candidate.slug)),
  );
});

/** 260 synthetic topics, all sharing one stem -> 250 + 10 buckets. */
function syntheticTopics(count: number): TopicCurationCandidate[] {
  return Array.from({ length: count }, (_, index) =>
    topicCandidate(`topic-${String(index + 1).padStart(3, '0')}`),
  );
}

test('gate 14.12: >250 candidates run two rounds — one validated call per bucket plus the reconciliation call', async () => {
  expect(CURATION_SINGLE_CALL_LIMIT).toBe(250);
  const candidates = syntheticTopics(260);
  const contexts: string[] = [];
  const bucketSizes: number[] = [];
  const outcome = await curateTopics(candidates, {
    agentsMd: 'Test constitution.',
    callLLMFn: async (prompt, options) => {
      contexts.push(options.context ?? '');
      const slugs = slugsFromPrompt(prompt);
      bucketSizes.push(slugs.length);
      return keepAllJson(slugs);
    },
  });
  // Round 1: 250 + 10; round 2: one reconciliation over all 260 survivors.
  expect(contexts).toEqual([
    'curation-topics-bucket-1',
    'curation-topics-bucket-2',
    'curation-topics-reconciliation',
  ]);
  expect(bucketSizes).toEqual([250, 10, 260]);
  expect(outcome.fallbacks).toEqual([]);
  expect(outcome.decisions?.merges).toEqual([]);
  expect(outcome.decisions?.keep).toHaveLength(260);
  // The final set never grows.
  expect((outcome.decisions?.keep.length ?? 0) + (outcome.decisions?.merges.length ?? 0)).toBeLessThanOrEqual(
    candidates.length,
  );
});

test('gate 14.12: a reconciliation fallback leaves the round-1 results intact', async () => {
  const candidates = syntheticTopics(260);
  const reconciliationSizes: number[] = [];
  const outcome = await curateTopics(candidates, {
    agentsMd: 'Test constitution.',
    callLLMFn: async (prompt, options) => {
      const slugs = slugsFromPrompt(prompt);
      if ((options.context ?? '').includes('reconciliation')) {
        reconciliationSizes.push(slugs.length);
        throw new Error('Anthropic API error (HTTP 500): overloaded');
      }
      // Round 1, bucket 1: merge the first two topics (a legitimate in-bucket
      // duplicate). Bucket 2: keep all.
      if (slugs.includes('topic-001')) {
        return JSON.stringify({
          merge: [{ from: ['topic-001'], into: 'topic-002' }],
          drop: [],
          keep: slugs.filter((slug) => slug !== 'topic-001' && slug !== 'topic-002'),
          unsure: [],
        });
      }
      return keepAllJson(slugs);
    },
  });
  // The reconciliation saw only the 259 survivors (topic-001 already gone).
  expect(reconciliationSizes).toEqual([259]);
  expect(outcome.fallbacks).toEqual([
    { scope: 'curation-topics-reconciliation', cause: 'transport-exhaustion' },
  ]);
  // Round 1's merge survives the reconciliation fallback (per-round keep-all
  // only folds in as keep decisions for THAT round's candidates).
  expect(outcome.decisions?.merges).toEqual([{ from: ['topic-001'], into: 'topic-002' }]);
  expect(outcome.decisions?.keep).toHaveLength(259);
  expect(outcome.decisions?.keep).not.toContain('topic-001');
});

// ---------------------------------------------------------------------------
// Gate 14.13: Language + prompt contracts
// ---------------------------------------------------------------------------

test('gate 14.13: both curation prompts carry the {languageDirective} block', () => {
  for (const file of ['prompts/curation-topics.prompt.txt', 'prompts/curation-entities.prompt.txt']) {
    const template = readFileSync(file, 'utf-8');
    expect(template, file).toContain('=== LANGUAGE ===\n{languageDirective}');
    expect(template, file).toContain('{agentsMd}');
    expect(template, file).toContain('{candidates}');
  }
});

test('gate 14.13: the language block is removed byte-identically for en/en and filled for non-English runs', async () => {
  const candidates = ['alpha'].map((slug) => topicCandidate(slug));
  const prompts: string[] = [];
  const stub = async (prompt: string): Promise<string> => {
    prompts.push(prompt);
    return keepAllJson(['alpha']);
  };

  await curateTopics(candidates, { agentsMd: 'Test constitution.', callLLMFn: stub });
  expect(prompts[0]).not.toContain('=== LANGUAGE ===');

  await curateTopics(candidates, {
    agentsMd: 'Test constitution.',
    language: { input: 'da', output: 'da' },
    callLLMFn: stub,
  });
  expect(prompts[1]).toContain('=== LANGUAGE ===');
  expect(prompts[1]).toContain('Danish');
  // The curation language rule: identities judged in the output language,
  // samples verbatim (vision `04` §9.4).
  expect(prompts[1]).toContain('verbatim source evidence');
});

test('gate 14.13: curation input includes the on-disk set (self-healing); extraction JSONs are never touched', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', odenseExtraction());

  // Run 1 (curation ON, keep-all): fresh candidates — nothing on disk yet.
  const run1Candidates: TopicCurationCandidate[] = [];
  await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async (candidates) => {
      run1Candidates.push(...candidates);
      return keepAllOutcome();
    },
    curateEntitiesFn: async () => keepAllOutcome(),
  });
  expect(run1Candidates.length).toBe(5);
  expect(run1Candidates.every((candidate) => candidate.onDisk === false)).toBe(true);

  // A hand-written topic page that no extraction produced (on-disk only).
  mkdirSync(wikiPath(workspace, 'topics', 'manual-review'), { recursive: true });
  writeFileSync(
    wikiPath(workspace, 'topics', 'manual-review', 'manual-review.md'),
    matter.stringify('\n## Claims\n\n- A hand-written claim.\n', {
      title: 'Manual Review',
      type: 'topic',
      wiki: 'test-wiki',
      updated: new Date().toISOString(),
    }),
    'utf-8',
  );

  const extractedBefore = readFileSync(
    wikiPath(workspace, '.state', 'extracted', 'golden-master-part-001.json'),
    'utf-8',
  );

  // Run 2 (curation ON with a real merge): the input must include every
  // on-disk topic, the hand-written page included.
  const run2Candidates: TopicCurationCandidate[] = [];
  const run2 = await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async (candidates) => {
      run2Candidates.push(...candidates);
      return {
        decisions: {
          merges: [{ from: ['financials'], into: 'financial' }],
          drops: [],
          keep: ['audits', 'financial', 'governance', 'manual-review', 'statistical'],
        },
        attempts: 1,
        fallbacks: [],
        vetoes: [],
      };
    },
    curateEntitiesFn: async () => keepAllOutcome(),
  });

  const bySlug = new Map(run2Candidates.map((candidate) => [candidate.slug, candidate]));
  for (const slug of ['audits', 'financial', 'financials', 'governance', 'statistical']) {
    expect(bySlug.get(slug)?.onDisk, slug).toBe(true);
  }
  expect(bySlug.get('manual-review')?.onDisk).toBe(true);
  expect(bySlug.get('manual-review')?.claimCount).toBe(1);
  expect(run2Candidates).toHaveLength(6);

  // Reversibility: the extraction JSONs are byte-identical after a merge run.
  expect(readFileSync(wikiPath(workspace, '.state', 'extracted', 'golden-master-part-001.json'), 'utf-8')).toBe(
    extractedBefore,
  );

  // Rolling memory (written after curation) reflects the curated set.
  const memory = JSON.parse(readFileSync(wikiPath(workspace, '.state', 'rolling-memory.json'), 'utf-8')) as {
    topics: string[];
  };
  expect(memory.topics).toEqual(['audits', 'financial', 'governance', 'statistical']);
  // The hand-written page survived the run (never tracked, never deleted).
  expect(existsSync(wikiPath(workspace, 'topics', 'manual-review', 'manual-review.md'))).toBe(true);
  expect(run2.curation?.removedPages).toEqual(['topics/financials/financials.md']);
});
