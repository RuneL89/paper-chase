import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, expect, test, vi } from 'vitest';
import matter from 'gray-matter';
import {
  isGenericLabelSlug,
  isBareGenericLabelSlug,
  labelSlugTokens,
  substantiveTokens,
  tokenOverlapJaccard,
  GENERIC_LABEL_OVERLAP_THRESHOLD,
  type ProposedDisambiguation,
} from '../src/agents/pre-merge';
import {
  disambiguateLabel,
  parseDisambiguationVerdict,
  stripReEntryBlock,
  validateDisambiguationReentry,
  validateDisambiguationVerdict,
  DISAMBIGUATION_MAX_TOKENS,
  type DisambiguationMember,
  type DisambiguationOutcome,
} from '../src/agents/disambiguation';
import type { CurationOutcome } from '../src/agents/curation';
import { materialize, type DisambiguationSummary } from '../src/materializer';
import { init } from '../src/commands/init';
import {
  curationDecisionsPath,
  readCurationDecisions,
  type CurationDecisionsData,
} from '../src/state/curation-decisions';
import { curationReportPath } from '../src/state/curation-report';
import { checkLinks } from '../src/validation/link-checker';
import { checkCitations } from '../src/validation/citation-checker';
import { validateSchema } from '../src/validation/schema-validator';
import {
  buildTopicCompositeCitationMap,
  writeTopicCompositePage,
  type TopicCompositePageData,
} from '../src/pages/composite-page';
import * as llmClient from '../src/llm/client';
import { appRoot } from '../src/utils/app-root';
import type { ExtractorResult } from '../src/agents/extractor';

/**
 * Phase 25 gates 25.1–25.8 (generic-label disambiguation — Option E Variant
 * B; phase doc §2.1–§2.4; canon: vision `02` §4.6 class 6 + `05` §6 class 6
 * + §7 same-label rule + `04` §3.2 Step 6b, all amended 2026-08-26
 * user-ratified; backlog B23). EVERY gate except the live 25.9 is LLM-free
 * ($0): the judgment rides the injected `disambiguateFn` seam (the
 * `curateTopicsFn` precedent) and curation rides the keep-all stubs.
 * Fixtures mirror the ratifying evidence: `Indikator 2` = first specialised
 * palliative treatment contact within 10 days (DPD_2025.pdf) vs surgery
 * within 24 hours of arrival (HOFTER_2025.pdf).
 *
 * Gate 25.9 is the ONE live call (glm-5.3-flash only — the §3 pinning rule):
 * the real `disambiguateLabel` with the curation slot pinned to
 * zhipu/glm-5.3-flash, self-skipping without ZAI_API_KEY so the key-less
 * suite profile is unchanged. Gate 25.8 is the aggregate full-suite gate —
 * this file being part of the key-less run IS the gate.
 */

const tempDirs: string[] = [];

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
  const workspace = makeTempDir('paper-chase-g25-');
  init('test-wiki', { workspace });
  return workspace;
}

/**
 * Install one chunk's document page + extraction JSON (the phase-14/22
 * harness, extended with the chunk's SOURCE FILE — the disambiguation
 * fixtures deliberately span two distinct source PDFs).
 */
function installChunk(
  wikiDir: string,
  chunkId: string,
  extraction: ExtractorResult,
  options: { pages?: string; sourceFile?: string; body?: string } = {},
): void {
  const pages = options.pages ?? '1-3';
  const sourceFile = options.sourceFile ?? 'wikis/test-wiki/raw/golden-master.pdf';
  const documentsDir = join(wikiDir, 'documents');
  const extractedDir = join(wikiDir, '.state', 'extracted');
  mkdirSync(documentsDir, { recursive: true });
  mkdirSync(extractedDir, { recursive: true });
  const frontmatter = {
    title: chunkId,
    type: 'document',
    sources: [{ file: sourceFile, pages }],
    updated: new Date().toISOString(),
  };
  const content = options.body ?? `\n## Extracted Text: Pages ${pages}\n\nFake chunk content.\n`;
  writeFileSync(join(documentsDir, `${chunkId}.md`), matter.stringify(content, frontmatter), 'utf-8');
  writeFileSync(join(extractedDir, `${chunkId}.json`), JSON.stringify(extraction, null, 2) + '\n', 'utf-8');
}

/** A keep-all outcome for the materialize-level injected curation stubs. */
function keepAllOutcome(): CurationOutcome {
  return { decisions: { merges: [], drops: [], keep: [] }, attempts: 1, fallbacks: [], vetoes: [] };
}

const KEEP_ALL_STUBS = {
  curateTopicsFn: async () => keepAllOutcome(),
  curateEntitiesFn: async () => keepAllOutcome(),
};

/** The keep-one-page disambiguation stub (a denied split). */
function noSplitOutcome(): DisambiguationOutcome {
  return { verdict: { split: false }, attempts: 1, fallbacks: [] };
}

function readDecisions(workspace: string): CurationDecisionsData {
  return JSON.parse(readFileSync(curationDecisionsPath(wikiPath(workspace)), 'utf-8')) as CurationDecisionsData;
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Shared fixtures — the ratifying DPD/HOFTER evidence (phase doc §Canon
// basis), as inline fixture strings
// ---------------------------------------------------------------------------

const DPD_SOURCE = 'wikis/test-wiki/raw/DPD_2025.pdf';
const HOFTER_SOURCE = 'wikis/test-wiki/raw/HOFTER_2025.pdf';
const DAMP_SOURCE = 'wikis/test-wiki/raw/DAMP_2025.pdf';

const DPD_MENTION_1 = 'Modtagne patienter der har deres første behandlingskontakt senest 10 dage efter modtagelse af henvendelse til det palliative team.';
const DPD_MENTION_2 = 'Målt som andel af alle modtagne henvendelser til teams med et koordineret palliativt behandlingsforløb.';
const HOFTER_MENTION_1 = 'Andelen af patienter, der opereres senest 24 timer efter ankomst til skadestuen.';
const HOFTER_MENTION_2 = 'Korrelerer med komplikationsrisiko og mortalitet efter hoftefraktur på skadestuen.';

/** Source A of the divergent fixture: the palliative-contact meaning. */
function dpdIndikatorExtraction(): ExtractorResult {
  return {
    entities: [
      {
        name: 'Indikator 2',
        type: 'quality-indicator',
        slug: 'indikator-2',
        folder: 'entities/quality-indicators',
        significance: 'Palliative treatment contact timing.',
        mentions: [
          { page: 1, context: DPD_MENTION_1 },
          { page: 2, context: DPD_MENTION_2 },
        ],
      },
    ],
    relationships: [],
    claims: [],
    timeline: [],
    context: 'DPD indicator fixture.',
  };
}

/** Source B of the divergent fixture: the hip-fracture surgery meaning. */
function hofterIndikatorExtraction(): ExtractorResult {
  return {
    entities: [
      {
        name: 'Indikator 2',
        type: 'quality-indicator',
        slug: 'indikator-2',
        folder: 'entities/quality-indicators',
        significance: 'Hip fracture surgery delay.',
        mentions: [
          { page: 4, context: HOFTER_MENTION_1 },
          { page: 5, context: HOFTER_MENTION_2 },
        ],
      },
      {
        name: 'HOFTER Registry',
        type: 'organization',
        slug: 'hofter-registry',
        folder: 'entities/organizations',
        significance: 'The hip-fracture registry.',
        mentions: [{ page: 6, context: 'HOFTER er den nationale hoftefrakturdatabase.' }],
      },
    ],
    relationships: [],
    claims: [
      {
        text: 'Indikator 2 achieving the 24-hour surgery target varies across regions in the HOFTER corpus.',
        type: 'surgery-delay',
        entities: ['hofter-registry', 'indikator-2'],
        page: 5,
      },
    ],
    timeline: [],
    context: 'HOFTER indicator fixture.',
  };
}

/** The same-register control: one measure restated by two sources (high overlap). */
function sameRegisterExtraction(meaning: 'a' | 'b'): ExtractorResult {
  const context =
    meaning === 'a'
      ? 'Indikator 2 måler andelen af patienter der opereres senest 24 timer efter ankomst.'
      : 'Andelen af patienter som opereres inden for 24 timer efter ankomst til sygehuset måles.';
  return {
    entities: [
      {
        name: 'Indikator 2',
        type: 'quality-indicator',
        slug: 'indikator-2',
        folder: 'entities/quality-indicators',
        significance: 'Surgery delay measure.',
        mentions: [{ page: meaning === 'a' ? 1 : 4, context }],
      },
    ],
    relationships: [],
    claims: [],
    timeline: [],
    context: 'Same-register control fixture.',
  };
}

/** A non-generic slug with disjoint multi-source evidence (the shape control). */
function rigshospitaletExtraction(meaning: 'a' | 'b'): ExtractorResult {
  return {
    entities: [
      {
        name: 'Rigshospitalet',
        type: 'organization',
        slug: 'rigshospitalet',
        folder: 'entities/organizations',
        significance: 'The national university hospital.',
        mentions: [
          {
            page: meaning === 'a' ? 1 : 4,
            context:
              meaning === 'a'
                ? 'Rigshospitalet huser det nationale transplantationscentrum og hjertekirurgisk afdeling.'
                : 'Rigshospitalets giraf-tårn er en kendt arkitektonisk landmærkeattraktion for besøgende.',
          },
        ],
      },
    ],
    relationships: [],
    claims: [],
    timeline: [],
    context: 'Non-generic control fixture.',
  };
}

/** The confirmed-split verdict members for the DPD/HOFTER fixture. */
function dpdHofterMembers(): DisambiguationMember[] {
  return [
    {
      slug: 'indikator-2-first-treatment-contact',
      title: 'First palliative treatment contact',
      sources: [DPD_SOURCE],
    },
    {
      slug: 'indikator-2-surgery-within-24h',
      title: 'Surgery within 24 hours',
      sources: [HOFTER_SOURCE],
    },
  ];
}

function splitOutcome(members: DisambiguationMember[], reason = 'two registries, two meanings'): DisambiguationOutcome {
  return { verdict: { split: true, reason, members }, attempts: 1, fallbacks: [] };
}

/** Install the two-source divergent entity fixture into a wiki. */
function installDivergentEntityFixture(wikiDir: string): void {
  installChunk(wikiDir, 'dpd-2025-part-001', dpdIndikatorExtraction(), { pages: '1-3', sourceFile: DPD_SOURCE });
  installChunk(wikiDir, 'hofter-2025-part-001', hofterIndikatorExtraction(), { pages: '4-6', sourceFile: HOFTER_SOURCE });
}

// ---------------------------------------------------------------------------
// Gate 25.1 — the detector controls
// ---------------------------------------------------------------------------

test('gate 25.1: the generic-label shape — pattern families recognized, non-generic slugs rejected', () => {
  for (const slug of ['indikator-2', 'indicator-7', 'table-3', 'tabel-3', 'section-2', 'afsnit-4', 'appendix-1', 'appendiks-1', 'figure-12', 'figur-3', 'indikator-2-ct-skanning']) {
    expect(isGenericLabelSlug(slug), slug).toBe(true);
  }
  for (const slug of ['rigshospitalet', 'indikator', 'table', 'indikatorx-2', 'region-hovedstaden', '2-indikator']) {
    expect(isGenericLabelSlug(slug), slug).toBe(false);
  }
  // The bare-renumber guard for member slugs (gate 25.2 vocabulary).
  expect(isBareGenericLabelSlug('indikator-3')).toBe(true);
  expect(isBareGenericLabelSlug('indikator-2-first-treatment-contact')).toBe(false);
  // Token helpers: stopwords, bare numbers, and the label's own tokens excluded.
  const tokens = substantiveTokens(
    ['Indikator 2 måler andelen af patienter, der opereres senest 24 timer efter ankomst.'],
    labelSlugTokens('indikator-2'),
  );
  expect(Array.from(tokens).sort()).toEqual(['andelen', 'ankomst', 'måler', 'opereres', 'patienter', 'senest', 'timer']);
  expect(tokenOverlapJaccard(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
  expect(tokenOverlapJaccard(new Set(['a']), new Set(['b']))).toBe(0);
});

test('gate 25.1: two-source disjoint tokens IS flagged; single source, high overlap, and non-generic slugs are NOT', async () => {
  // (a) The divergent two-source fixture IS flagged.
  const divergent = setupWiki();
  installDivergentEntityFixture(wikiPath(divergent));
  const runA = await materialize('test-wiki', {
    workspace: divergent,
    curation: true,
    ...KEEP_ALL_STUBS,
    disambiguateFn: async () => noSplitOutcome(),
  });
  const summaryA = runA.disambiguation as DisambiguationSummary;
  expect(summaryA.ran).toBe(true);
  expect(summaryA.proposed).toEqual([
    {
      slug: 'indikator-2',
      title: 'Indikator 2',
      concern: 'entities',
      sources: [
        { file: DPD_SOURCE, samples: [DPD_MENTION_1, DPD_MENTION_2] },
        {
          file: HOFTER_SOURCE,
          samples: [
            HOFTER_MENTION_1,
            HOFTER_MENTION_2,
            'Indikator 2 achieving the 24-hour surgery target varies across regions in the HOFTER corpus.',
          ],
        },
      ],
    },
  ]);

  // (b) One source only → NOT flagged.
  const single = setupWiki();
  installChunk(wikiPath(single), 'dpd-2025-part-001', dpdIndikatorExtraction(), { pages: '1-3', sourceFile: DPD_SOURCE });
  const runB = await materialize('test-wiki', {
    workspace: single,
    curation: true,
    ...KEEP_ALL_STUBS,
    disambiguateFn: async () => noSplitOutcome(),
  });
  expect(runB.disambiguation?.proposed).toEqual([]);

  // (c) Two sources restating the SAME measure → NOT flagged (heterogeneity gate).
  const same = setupWiki();
  installChunk(wikiPath(same), 'dpd-2025-part-001', sameRegisterExtraction('a'), { pages: '1-3', sourceFile: DPD_SOURCE });
  installChunk(wikiPath(same), 'hofter-2025-part-001', sameRegisterExtraction('b'), { pages: '4-6', sourceFile: HOFTER_SOURCE });
  const runC = await materialize('test-wiki', {
    workspace: same,
    curation: true,
    ...KEEP_ALL_STUBS,
    disambiguateFn: async () => noSplitOutcome(),
  });
  expect(runC.disambiguation?.proposed).toEqual([]);

  // (d) A non-generic slug with disjoint multi-source evidence → NOT flagged.
  const nonGeneric = setupWiki();
  installChunk(wikiPath(nonGeneric), 'dpd-2025-part-001', rigshospitaletExtraction('a'), { pages: '1-3', sourceFile: DPD_SOURCE });
  installChunk(wikiPath(nonGeneric), 'hofter-2025-part-001', rigshospitaletExtraction('b'), { pages: '4-6', sourceFile: HOFTER_SOURCE });
  const runD = await materialize('test-wiki', {
    workspace: nonGeneric,
    curation: true,
    ...KEEP_ALL_STUBS,
    disambiguateFn: async () => noSplitOutcome(),
  });
  expect(runD.disambiguation?.proposed).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 25.2 — the judgment prompt + schema validation
// ---------------------------------------------------------------------------

function dpdHofterProposal(): ProposedDisambiguation {
  return {
    slug: 'indikator-2',
    title: 'Indikator 2',
    concern: 'entities',
    sources: [
      { file: DPD_SOURCE, samples: [DPD_MENTION_1, DPD_MENTION_2] },
      { file: HOFTER_SOURCE, samples: [HOFTER_MENTION_1, HOFTER_MENTION_2] },
    ],
  };
}

test('gate 25.2: the prompt carries the language directive, per-source evidence, and the member rules; the RE-ENTRY block strips byte-identically', async () => {
  const template = readFileSync(join(appRoot(), 'prompts', 'disambiguation.prompt.txt'), 'utf-8');
  expect(template).toContain('=== LANGUAGE ===\n{languageDirective}\n');
  expect(template).toContain('{slug}');
  expect(template).toContain('{title}');
  expect(template).toContain('{agentsMd}');
  expect(template).toContain('=== PER-SOURCE EVIDENCE ===\n{evidence}');
  expect(template).toContain('=== RE-ENTRY ===\n{reEntryRules}\n=== END RE-ENTRY ===');
  // Member rules (gate vocabulary).
  expect(template).toContain('NEVER a bare renumbering');
  expect(template).toContain('EXACTLY ONE member');
  // The fresh prompt strips the whole RE-ENTRY block.
  const stripped = stripReEntryBlock(template);
  expect(stripped).not.toContain('RE-ENTRY');
  expect(stripped).not.toContain('{reEntryRules}');

  // The filled prompt (en/en): evidence present, LANGUAGE block removed, no re-entry.
  const prompts: string[] = [];
  const optionsSeen: Array<Record<string, unknown>> = [];
  const outcome = await disambiguateLabel(
    { proposal: dpdHofterProposal() },
    {
      agentsMd: '(No AGENTS.md provided.)',
      callLLMFn: async (prompt, callOptions) => {
        prompts.push(prompt);
        optionsSeen.push(callOptions as unknown as Record<string, unknown>);
        return JSON.stringify({ split: false });
      },
    },
  );
  expect(outcome.verdict).toEqual({ split: false });
  expect(prompts).toHaveLength(1);
  expect(prompts[0]).toContain(DPD_MENTION_1.slice(0, 60));
  expect(prompts[0]).toContain(HOFTER_MENTION_1.slice(0, 60));
  expect(prompts[0]).toContain('Slug: indikator-2');
  expect(prompts[0]).not.toContain('=== LANGUAGE ===');
  expect(prompts[0]).not.toContain('RE-ENTRY');
  expect(optionsSeen[0].callType).toBe('disambiguate');
  expect(optionsSeen[0].maxTokens).toBe(DISAMBIGUATION_MAX_TOKENS);
  expect(DISAMBIGUATION_MAX_TOKENS).toBeGreaterThanOrEqual(2048);
  expect(optionsSeen[0].context).toBe('disambiguate:indikator-2');

  // The da/da fill carries the curation language directive (samples verbatim).
  const daPrompts: string[] = [];
  await disambiguateLabel(
    { proposal: dpdHofterProposal() },
    {
      agentsMd: '(No AGENTS.md provided.)',
      language: { input: 'da', output: 'da' },
      callLLMFn: async (prompt) => {
        daPrompts.push(prompt);
        return JSON.stringify({ split: false });
      },
    },
  );
  expect(daPrompts[0]).toContain('=== LANGUAGE ===');
  expect(daPrompts[0]).toContain('Danish');
});

test('gate 25.2: schema accepts a well-formed split and a no-split; rejects a 1-member split, a member without sources, a doubly-mapped source, and a bare-renumber slug — each naming the offending member', () => {
  const proposal = dpdHofterProposal();
  // Well-formed split + no-split pass.
  const good = validateDisambiguationVerdict(
    { split: true, reason: 'two meanings', members: dpdHofterMembers() },
    proposal,
  );
  expect(good.valid).toBe(true);
  expect(good.verdict?.members).toHaveLength(2);
  expect(validateDisambiguationVerdict({ split: false }, proposal).valid).toBe(true);

  // 1-member split.
  const one = validateDisambiguationVerdict(
    { split: true, members: [dpdHofterMembers()[0]] },
    proposal,
  );
  expect(one.valid).toBe(false);
  expect(one.errors.some((error) => error.includes('2-4 members (got 1)'))).toBe(true);

  // A member without sources — the rejection names the member.
  const noSources = validateDisambiguationVerdict(
    {
      split: true,
      members: [
        { slug: 'indikator-2-first-treatment-contact', title: 'First contact', sources: [] },
        { slug: 'indikator-2-surgery-within-24h', title: 'Surgery', sources: [HOFTER_SOURCE] },
      ],
    },
    proposal,
  );
  expect(noSources.valid).toBe(false);
  expect(noSources.errors.some((error) => error.includes('members[0] ("indikator-2-first-treatment-contact")') && error.includes('"sources"'))).toBe(true);
  expect(noSources.errors.some((error) => error.includes(`source "${DPD_SOURCE}" is not mapped to any member`))).toBe(true);

  // A source mapped to two members.
  const double = validateDisambiguationVerdict(
    {
      split: true,
      members: [
        { slug: 'member-a', title: 'A', sources: [DPD_SOURCE, HOFTER_SOURCE] },
        { slug: 'member-b', title: 'B', sources: [HOFTER_SOURCE] },
      ],
    },
    proposal,
  );
  expect(double.valid).toBe(false);
  expect(double.errors.some((error) => error.includes(`source "${HOFTER_SOURCE}" is mapped to two members ("member-a", "member-b")`))).toBe(true);

  // A bare-renumber member slug.
  const renumber = validateDisambiguationVerdict(
    {
      split: true,
      members: [
        { slug: 'indikator-3', title: 'Renumbered', sources: [DPD_SOURCE] },
        { slug: 'member-b', title: 'B', sources: [HOFTER_SOURCE] },
      ],
    },
    proposal,
  );
  expect(renumber.valid).toBe(false);
  expect(renumber.errors.some((error) => error.includes('members[0] ("indikator-3")') && error.includes('bare renumbering'))).toBe(true);
});

test('gate 25.2 (live-gate regression): a split verdict echoing BASENAME sources passes and canonicalizes to the proposal full paths', () => {
  const proposal = dpdHofterProposal();
  // Member A echoes the full path, member B echoes the basename (the exact
  // live glm-5.3-flash form that exhausted gate 25.9 pre-fix).
  const verdict = validateDisambiguationVerdict(
    {
      split: true,
      reason: 'two registries, two meanings',
      members: [
        { slug: 'indikator-2-first-treatment-contact', title: 'First contact', sources: [DPD_SOURCE] },
        { slug: 'indikator-2-surgery-within-24h', title: 'Surgery within 24 hours', sources: ['HOFTER_2025.pdf'] },
      ],
    },
    proposal,
  );
  expect(verdict.valid, verdict.errors.join('; ')).toBe(true);
  // The normalized members carry the CANONICAL full paths (the sticky
  // sourceMap and later routing keep using full paths exactly as before).
  expect(verdict.verdict?.members).toEqual([
    { slug: 'indikator-2-first-treatment-contact', title: 'First contact', sources: [DPD_SOURCE] },
    { slug: 'indikator-2-surgery-within-24h', title: 'Surgery within 24 hours', sources: [HOFTER_SOURCE] },
  ]);
  // A basename naming BOTH members at once still fails coverage (mapped twice).
  const doubled = validateDisambiguationVerdict(
    {
      split: true,
      members: [
        { slug: 'member-a', title: 'A', sources: ['DPD_2025.pdf'] },
        { slug: 'member-b', title: 'B', sources: ['DPD_2025.pdf', HOFTER_SOURCE] },
      ],
    },
    proposal,
  );
  expect(doubled.valid).toBe(false);
  expect(doubled.errors.some((error) => error.includes(`source "${DPD_SOURCE}" is mapped to two members ("member-a", "member-b")`))).toBe(true);
  // An echo matching NO proposal file by either form keeps the existing error.
  const miss = validateDisambiguationVerdict(
    {
      split: true,
      members: [
        { slug: 'member-a', title: 'A', sources: ['UNKNOWN_2025.pdf'] },
        { slug: 'member-b', title: 'B', sources: [HOFTER_SOURCE] },
      ],
    },
    proposal,
  );
  expect(miss.valid).toBe(false);
  expect(miss.errors.some((error) => error.includes('source "UNKNOWN_2025.pdf" is not one of the label\'s source files'))).toBe(true);
  expect(miss.errors.some((error) => error.includes(`source "${DPD_SOURCE}" is not mapped to any member`))).toBe(true);
});

test('gate 25.2: an invalid verdict re-asks with the exact member-naming errors in the correction block; exhaustion and 4xx keep one page', async () => {
  const prompts: string[] = [];
  const contexts: string[] = [];
  const outcome = await disambiguateLabel(
    { proposal: dpdHofterProposal() },
    {
      agentsMd: '(No AGENTS.md provided.)',
      callLLMFn: async (prompt, callOptions) => {
        prompts.push(prompt);
        contexts.push(String(callOptions.context));
        return prompts.length === 1
          ? JSON.stringify({ split: true, members: [{ slug: 'indikator-3', title: 'X', sources: [DPD_SOURCE, HOFTER_SOURCE] }] })
          : JSON.stringify({ split: false });
      },
    },
  );
  expect(outcome.attempts).toBe(2);
  expect(outcome.verdict).toEqual({ split: false });
  expect(prompts).toHaveLength(2);
  expect(prompts[1].startsWith(prompts[0] + '\n\n=== CORRECTION REQUIRED ===')).toBe(true);
  expect(prompts[1]).toContain('members[0] ("indikator-3"): a bare renumbering of a generic label is not a member slug');
  expect(prompts[1]).toContain('2-4 members (got 1)');
  expect(contexts).toEqual(['disambiguate:indikator-2', 'disambiguate:indikator-2#attempt2']);

  // Validation exhaustion → keep-one-page fallback (3 attempts, never throws).
  let invalidCalls = 0;
  const exhausted = await disambiguateLabel(
    { proposal: dpdHofterProposal() },
    {
      agentsMd: '(No AGENTS.md provided.)',
      callLLMFn: async () => {
        invalidCalls += 1;
        return 'not json at all';
      },
    },
  );
  expect(invalidCalls).toBe(3);
  expect(exhausted.verdict).toBeNull();
  expect(exhausted.fallbacks).toEqual([{ cause: 'validation-exhaustion' }]);
  expect(parseDisambiguationVerdict('not json at all').errors[0]).toContain('output is not valid JSON');

  // A thrown HTTP 4xx → immediate keep-one-page fallback, never retried.
  let thrownCalls = 0;
  const fourxx = await disambiguateLabel(
    { proposal: dpdHofterProposal() },
    {
      agentsMd: '(No AGENTS.md provided.)',
      callLLMFn: async () => {
        thrownCalls += 1;
        throw new Error('Zhipu API error (HTTP 401) after 1 attempt(s)');
      },
    },
  );
  expect(thrownCalls).toBe(1);
  expect(fourxx.verdict).toBeNull();
  expect(fourxx.fallbacks).toEqual([{ cause: 'http-4xx' }]);
});

test('gate 25.2: routing — the disambiguate call type rides the curation slot (Default fallback), never a new Settings row', () => {
  const routing = {
    provider: 'anthropic' as const,
    default: 'claude-haiku-4.5',
    extractor: null,
    synthesis: null,
    dox: null,
    crossWiki: null,
    crossWikiJudgment: null,
    curation: { provider: 'zhipu' as const, model: 'glm-5.3-flash' },
  };
  expect(llmClient.resolveSlotFromRouting(routing, 'disambiguate')).toEqual({
    provider: 'zhipu',
    model: 'glm-5.3-flash',
  });
  const legacy = { ...routing, curation: null };
  expect(llmClient.resolveSlotFromRouting(legacy, 'disambiguate')).toEqual({
    provider: 'anthropic',
    model: 'claude-haiku-4.5',
  });
});

test('gate 25.2/25.6: re-entry validation — existing members keep their exact sources; a new source joins one member or founds one', () => {
  const existingMembers: DisambiguationMember[] = [
    { slug: 'indikator-2-first-treatment-contact', title: 'First contact', sources: [DPD_SOURCE] },
    { slug: 'indikator-2-surgery-within-24h', title: 'Surgery', sources: [HOFTER_SOURCE] },
  ];
  const proposal: ProposedDisambiguation = {
    slug: 'indikator-2',
    title: 'Indikator 2',
    concern: 'entities',
    sources: [
      { file: DPD_SOURCE, samples: [DPD_MENTION_1] },
      { file: HOFTER_SOURCE, samples: [HOFTER_MENTION_1] },
      { file: DAMP_SOURCE, samples: ['Genindlæggelser inden for 30 dage efter udskrivelse måles.'] },
    ],
  };
  // A well-formed re-entry: existing members untouched, the new source founds a member.
  const good = validateDisambiguationReentry(
    {
      split: true,
      reason: 'new meaning',
      members: [
        ...existingMembers,
        { slug: 'indikator-2-readmission-rate', title: 'Readmission rate', sources: [DAMP_SOURCE] },
      ],
    },
    { proposal, existingMembers },
  );
  expect(good.valid).toBe(true);
  // An existing member's sources were re-assigned → named rejection.
  const altered = validateDisambiguationReentry(
    {
      split: true,
      members: [
        { slug: 'indikator-2-first-treatment-contact', title: 'First contact', sources: [DPD_SOURCE, DAMP_SOURCE] },
        { slug: 'indikator-2-surgery-within-24h', title: 'Surgery', sources: [HOFTER_SOURCE] },
      ],
    },
    { proposal, existingMembers },
  );
  expect(altered.valid).toBe(false);
  expect(altered.errors.some((error) => error.includes('existing member "indikator-2-first-treatment-contact" must keep exactly its existing sources'))).toBe(true);
  // split:false on a re-entry is nonsensical → rejected.
  const dissolve = validateDisambiguationReentry({ split: false }, { proposal, existingMembers });
  expect(dissolve.valid).toBe(false);
  expect(dissolve.errors[0]).toContain('the label is already split');
});

// ---------------------------------------------------------------------------
// Gate 25.3 — application + the sticky record (zero-call second run)
// ---------------------------------------------------------------------------

test('gate 25.3: a confirmed split writes ONE class-6 composite at the generic slug, records the sticky sourceMap, and run 2 makes ZERO judgment calls and reproduces the composite byte-identically', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-08-27T10:00:00Z'));
  try {
    const workspace = setupWiki();
    const wdir = wikiPath(workspace);
    installDivergentEntityFixture(wdir);

    // Run 1: the judgment confirms the split.
    let calls = 0;
    const run1 = await materialize('test-wiki', {
      workspace,
      curation: true,
      ...KEEP_ALL_STUBS,
      disambiguateFn: async () => {
        calls += 1;
        return splitOutcome(dpdHofterMembers());
      },
    });
    expect(calls).toBe(1);
    expect(run1.disambiguation?.applied).toEqual([
      {
        concern: 'entities',
        into: 'indikator-2',
        members: dpdHofterMembers().map((member) => ({ slug: member.slug, sources: member.sources })),
        reason: 'two registries, two meanings',
      },
    ]);
    // ONE composite at the generic slug; the ordinary entity page is gone.
    expect(run1.compositePages).toHaveLength(1);
    expect(run1.compositePages[0]).toMatchObject({ slug: 'indikator-2', class: 6, folder: 'entities/quality-indicators' });
    expect(run1.entityPages.map((page) => page.slug)).toEqual(['hofter-registry']);
    const compositePath = join(wdir, 'entities', 'quality-indicators', 'indikator-2.md');
    const composite1 = matter(readFileSync(compositePath, 'utf-8'));
    expect(composite1.data.type).toBe('composite');
    expect(composite1.data.class).toBe(6);
    expect(composite1.data.members).toEqual([
      expect.objectContaining({ slug: 'indikator-2-first-treatment-contact' }),
      expect.objectContaining({ slug: 'indikator-2-surgery-within-24h' }),
    ]);
    // Per-member evidence groups under the derived member titles.
    expect(composite1.content).toContain('### Indikator 2 First Treatment Contact');
    expect(composite1.content).toContain(DPD_MENTION_1);
    expect(composite1.content).toContain('### Indikator 2 Surgery Within 24h');
    expect(composite1.content).toContain(HOFTER_MENTION_1);
    // Member pages never exist.
    expect(existsSync(join(wdir, 'entities', 'quality-indicators', 'indikator-2-first-treatment-contact.md'))).toBe(false);
    expect(existsSync(join(wdir, 'entities', 'quality-indicators', 'indikator-2-surgery-within-24h.md'))).toBe(false);
    // The sticky record incl. sourceMap is written.
    const decisions1 = readDecisions(workspace);
    expect(decisions1.decisions).toEqual([
      {
        concern: 'entities',
        action: 'disambiguate',
        from: ['indikator-2-first-treatment-contact', 'indikator-2-surgery-within-24h'],
        into: 'indikator-2',
        signal: 'generic-heterogeneity',
        sourceMap: {
          [DPD_SOURCE]: 'indikator-2-first-treatment-contact',
          [HOFTER_SOURCE]: 'indikator-2-surgery-within-24h',
        },
        decidedAt: '2026-08-27T10:00:00.000Z',
        runId: '2026-08-27T10:00:00.000Z',
      },
    ]);
    const afterRun1 = readFileSync(compositePath, 'utf-8');

    // Run 2: the SAME data — the sticky record pre-applies, ZERO judgment
    // calls, and the composite is byte-identical.
    const run2 = await materialize('test-wiki', {
      workspace,
      curation: true,
      ...KEEP_ALL_STUBS,
      disambiguateFn: async () => {
        calls += 1;
        return noSplitOutcome();
      },
    });
    expect(calls).toBe(1);
    expect(run2.disambiguation?.proposed).toEqual([]);
    expect(run2.disambiguation?.fromSticky).toEqual([
      {
        concern: 'entities',
        into: 'indikator-2',
        members: ['indikator-2-first-treatment-contact', 'indikator-2-surgery-within-24h'],
      },
    ]);
    expect(run2.compositePages).toHaveLength(1);
    expect(readFileSync(compositePath, 'utf-8')).toBe(afterRun1);
    // Nothing new was recorded.
    expect(readDecisions(workspace).decisions).toHaveLength(1);
  } finally {
    vi.useRealTimers();
  }
});

// ---------------------------------------------------------------------------
// Gate 25.4 — the class-6 TOPIC composite + the validator exception
// ---------------------------------------------------------------------------

/** The topic-leg fixture: the same generic claim type, two divergent meanings. */
function installDivergentTopicFixture(wikiDir: string): void {
  installChunk(
    wikiDir,
    'dpd-2025-part-001',
    {
      entities: [],
      relationships: [],
      claims: [
        {
          text: 'DPD: Modtagne patienter har deres første palliative behandlingskontakt senest 10 dage efter modtagelse.',
          type: 'indikator-2',
          entities: [],
          page: 1,
        },
      ],
      timeline: [],
      context: 'DPD topic fixture.',
    },
    { pages: '1-3', sourceFile: DPD_SOURCE },
  );
  installChunk(
    wikiDir,
    'hofter-2025-part-001',
    {
      entities: [],
      relationships: [],
      claims: [
        {
          text: 'HOFTER: Andelen af patienter, der opereres senest 24 timer efter ankomst til skadestuen.',
          type: 'indikator-2',
          entities: [],
          page: 4,
        },
      ],
      timeline: [],
      context: 'HOFTER topic fixture.',
    },
    { pages: '4-6', sourceFile: HOFTER_SOURCE },
  );
}

test('gate 25.4: a class-6 TOPIC composite renders with members block, per-member claim groups, and complete topic frontmatter; a class-3 cluster on a topic is still a validation error', async () => {
  // The unit leg: the deterministic shell.
  const compositeTitle = 'Indikator 2 First Treatment Contact — Indikator 2 Surgery Within 24h';
  const data: TopicCompositePageData = {
    title: compositeTitle,
    slug: 'indikator-2',
    folder: 'topics/indikator-2',
    wiki: 'test-wiki',
    class: 6,
    members: [
      { slug: 'indikator-2-first-treatment-contact', title: 'Indikator 2 First Treatment Contact', sources: [DPD_SOURCE] },
      { slug: 'indikator-2-surgery-within-24h', title: 'Indikator 2 Surgery Within 24h', sources: [HOFTER_SOURCE] },
    ],
    memberClaims: [
      {
        slug: 'indikator-2-first-treatment-contact',
        claims: [
          { text: 'First contact within 10 days.', type: 'indikator-2', entities: [], page: 1, source: DPD_SOURCE, pages: '1-3' },
        ],
      },
      {
        slug: 'indikator-2-surgery-within-24h',
        claims: [
          { text: 'Surgery within 24 hours.', type: 'indikator-2', entities: [], page: 4, source: HOFTER_SOURCE, pages: '4-6' },
        ],
      },
    ],
    slugToTitle: {},
    aliases: ['Indikator 2 First Treatment Contact', 'Indikator 2 Surgery Within 24h'],
  };
  const rendered = writeTopicCompositePage(data);
  const parsed = matter(rendered);
  expect(parsed.data.type).toBe('composite');
  expect(parsed.data.class).toBe(6);
  expect(parsed.data.members).toHaveLength(2);
  expect(parsed.data.aliases).toEqual([
    compositeTitle,
    'Indikator 2 First Treatment Contact',
    'Indikator 2 Surgery Within 24h',
  ]);
  expect(parsed.data.wiki).toBe('test-wiki');
  expect(typeof parsed.data.updated).toBe('string');
  expect(parsed.data.sources).toEqual([
    { file: DPD_SOURCE, pages: '1-3' },
    { file: HOFTER_SOURCE, pages: '4-6' },
  ]);
  expect(parsed.data.tags).toEqual(['indikator-2']);
  expect(parsed.data.sparse).toBeUndefined();
  expect(parsed.content).toContain('## Members');
  expect(parsed.content).toContain('### Indikator 2 First Treatment Contact');
  expect(parsed.content).toContain('- First contact within 10 days. [^src1]');
  expect(parsed.content).toContain('### Indikator 2 Surgery Within 24h');
  expect(parsed.content).toContain('- Surgery within 24 hours. [^src2]');
  expect(parsed.content).toContain(`[^src1]: DPD_2025.pdf, pages 1-3`);
  expect(buildTopicCompositeCitationMap(data).citationMap.get(`${DPD_SOURCE}|1-3`)).toBe(1);

  // The materialize leg: the topic concern splits into a topic composite.
  const workspace = setupWiki();
  installDivergentTopicFixture(wikiPath(workspace));
  const run = await materialize('test-wiki', {
    workspace,
    curation: true,
    ...KEEP_ALL_STUBS,
    disambiguateFn: async (request) => {
      expect(request.proposal.concern).toBe('topics');
      return splitOutcome(dpdHofterMembers());
    },
  });
  expect(run.disambiguation?.applied[0].concern).toBe('topics');
  expect(run.topicCompositePages).toHaveLength(1);
  expect(run.topicPages).toEqual([]);
  const topicCompositePath = wikiPath(workspace, 'topics', 'indikator-2', 'indikator-2.md');
  const topicPage = matter(readFileSync(topicCompositePath, 'utf-8'));
  expect(topicPage.data.type).toBe('composite');
  expect(topicPage.data.class).toBe(6);
  expect(topicPage.content).toContain('### Indikator 2 First Treatment Contact');
  expect(topicPage.content).toContain('første palliative behandlingskontakt');
  expect(topicPage.content).toContain('### Indikator 2 Surgery Within 24h');
  expect(topicPage.content).toContain('opereres senest 24 timer');

  // The validator exception: class 6 is legal under topics/, class 1-5 is not.
  const good = await validateSchema('test-wiki', workspace);
  expect(good.invalid).toEqual([]);
  const bad = setupWiki();
  const badPage = wikiPath(bad, 'topics', 'indikator-2', 'indikator-2.md');
  mkdirSync(dirname(badPage), { recursive: true });
  writeFileSync(
    badPage,
    matter.stringify('\nbody\n', {
      title: 'Indikator 2',
      type: 'composite',
      class: 3,
      members: [{ slug: 'a' }, { slug: 'b' }],
      wiki: 'test-wiki',
      updated: new Date().toISOString(),
      sources: [{ file: 'x.pdf', pages: '1-2' }],
    }),
    'utf-8',
  );
  const badResult = await validateSchema('test-wiki', bad);
  expect(badResult.invalid).toEqual([
    {
      page: expect.stringContaining('topics/indikator-2/indikator-2.md'),
      issue: 'composite class 1-5 is not allowed on topic pages — only class 6 (generic-label disambiguation) is',
    },
  ]);
  // Class 7 is out of range everywhere.
  const outOfRange = setupWiki();
  mkdirSync(wikiPath(outOfRange, 'entities'), { recursive: true });
  writeFileSync(
    wikiPath(outOfRange, 'entities', 'indikator-2.md'),
    matter.stringify('\nbody\n', {
      title: 'Indikator 2',
      type: 'composite',
      class: 7,
      members: [{ slug: 'a' }, { slug: 'b' }],
      wiki: 'test-wiki',
      updated: new Date().toISOString(),
      sources: [{ file: 'x.pdf', pages: '1-2' }],
    }),
    'utf-8',
  );
  expect((await validateSchema('test-wiki', outOfRange)).invalid[0].issue).toContain('integer 1-6');
});

// ---------------------------------------------------------------------------
// Gate 25.5 — preservation + links
// ---------------------------------------------------------------------------

test('gate 25.5: every per-member verbatim item is present, the unioned citation map defines every marker, wikilinks to the generic slug resolve, and member pages are absent', async () => {
  const workspace = setupWiki();
  const wdir = wikiPath(workspace);
  installDivergentEntityFixture(wdir);
  // The citation checker requires each cited source PDF in raw/ (the
  // phase-23 golden-master-copy convention).
  mkdirSync(join(wdir, 'raw'), { recursive: true });
  copyFileSync(join(appRoot(), 'test-pdfs', 'golden-master.pdf'), join(wdir, 'raw', 'DPD_2025.pdf'));
  copyFileSync(join(appRoot(), 'test-pdfs', 'golden-master.pdf'), join(wdir, 'raw', 'HOFTER_2025.pdf'));
  const run = await materialize('test-wiki', {
    workspace,
    curation: true,
    ...KEEP_ALL_STUBS,
    disambiguateFn: async () => splitOutcome(dpdHofterMembers()),
  });
  expect(run.compositePages).toHaveLength(1);

  const compositeRaw = readFileSync(join(wdir, 'entities', 'quality-indicators', 'indikator-2.md'), 'utf-8');
  const composite = matter(compositeRaw);
  // Every per-member verbatim evidence item (mentions + the claim riding the HOFTER member).
  for (const item of [DPD_MENTION_1, DPD_MENTION_2, HOFTER_MENTION_1, HOFTER_MENTION_2, 'Indikator 2 achieving the 24-hour surgery target varies across regions in the HOFTER corpus.']) {
    expect(compositeRaw).toContain(item);
  }
  // The unioned citation map defines every marker used in the body.
  const markers = Array.from(composite.content.matchAll(/\[\^src(\d+)\]/g)).map((match) => `src${match[1]}`);
  const defined = new Set(
    Array.from(composite.content.matchAll(/^\[\^src(\d+)\]:/gm)).map((match) => `src${match[1]}`),
  );
  expect(markers.length).toBeGreaterThan(0);
  for (const marker of markers) {
    expect(defined.has(marker), marker).toBe(true);
  }
  // Member pages do not exist on disk.
  expect(existsSync(join(wdir, 'entities', 'quality-indicators', 'indikator-2-first-treatment-contact.md'))).toBe(false);
  expect(existsSync(join(wdir, 'entities', 'quality-indicators', 'indikator-2-surgery-within-24h.md'))).toBe(false);
  // Wikilinks targeting the generic slug resolve to the composite (the
  // hofter-registry page links [[indikator-2|…]]; the whole wiki is clean).
  const registryPage = readFileSync(join(wdir, 'entities', 'organizations', 'hofter-registry.md'), 'utf-8');
  expect(registryPage).toContain('[[indikator-2|');
  const links = await checkLinks('test-wiki', workspace);
  expect(links.broken).toEqual([]);
  const citations = await checkCitations('test-wiki', workspace);
  expect(citations.missingSource).toEqual([]);
  expect(citations.invalid).toEqual([]);
  expect(citations.missingFrontmatterSource).toEqual([]);
  const schema = await validateSchema('test-wiki', workspace);
  expect(schema.invalid).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 25.6 — a third source with a NEW meaning re-enters the judgment
// ---------------------------------------------------------------------------

test('gate 25.6: a third source with a new meaning re-enters the judgment scoped to that source; existing members untouched; sourceMap grows', async () => {
  const workspace = setupWiki();
  const wdir = wikiPath(workspace);
  installDivergentEntityFixture(wdir);
  await materialize('test-wiki', {
    workspace,
    curation: true,
    ...KEEP_ALL_STUBS,
    disambiguateFn: async () => splitOutcome(dpdHofterMembers()),
  });

  // A third source arrives with a THIRD meaning.
  installChunk(
    wdir,
    'damp-2025-part-001',
    {
      entities: [
        {
          name: 'Indikator 2',
          type: 'quality-indicator',
          slug: 'indikator-2',
          folder: 'entities/quality-indicators',
          significance: 'Readmission measure.',
          mentions: [
            { page: 7, context: 'DAMP mäter genindlæggelser registreret inden for 30 dage efter udskrivelse fra psykiatrisk afdeling.' },
          ],
        },
      ],
      relationships: [],
      claims: [],
      timeline: [],
      context: 'DAMP fixture.',
    },
    { pages: '7-9', sourceFile: DAMP_SOURCE },
  );

  const seenRequests: Array<{ existing?: string[]; sources: string[] }> = [];
  const run3 = await materialize('test-wiki', {
    workspace,
    curation: true,
    ...KEEP_ALL_STUBS,
    disambiguateFn: async (request) => {
      seenRequests.push({
        existing: request.existingMembers?.map((member) => member.slug),
        sources: request.proposal.sources.map((source) => source.file),
      });
      // The re-entry verdict: existing members re-stated EXACTLY, the new
      // source founds a third member.
      return splitOutcome([
        ...dpdHofterMembers(),
        { slug: 'indikator-2-readmission-rate', title: 'Readmission rate', sources: [DAMP_SOURCE] },
      ]);
    },
  });

  // ONE scoped call: the judgment saw the existing members and every source
  // (sorted — DAMP sorts before DPD).
  expect(seenRequests).toEqual([
    {
      existing: ['indikator-2-first-treatment-contact', 'indikator-2-surgery-within-24h'],
      sources: [DAMP_SOURCE, DPD_SOURCE, HOFTER_SOURCE],
    },
  ]);
  expect(run3.disambiguation?.reentries).toEqual([
    {
      concern: 'entities',
      into: 'indikator-2',
      newSources: [DAMP_SOURCE],
      newMembers: ['indikator-2-readmission-rate'],
    },
  ]);
  // The composite now carries THREE members; the existing members' evidence is untouched.
  const compositeRaw = readFileSync(join(wdir, 'entities', 'quality-indicators', 'indikator-2.md'), 'utf-8');
  const composite = matter(compositeRaw);
  expect(composite.data.members).toHaveLength(3);
  expect(composite.content).toContain('### Indikator 2 First Treatment Contact');
  expect(composite.content).toContain(DPD_MENTION_1);
  expect(composite.content).toContain('### Indikator 2 Surgery Within 24h');
  expect(composite.content).toContain(HOFTER_MENTION_1);
  expect(composite.content).toContain('### Indikator 2 Readmission Rate');
  expect(composite.content).toContain('genindlæggelser registreret inden for 30 dage');
  // The record's sourceMap grew.
  const record = readDecisions(workspace).decisions[0];
  expect(record.sourceMap).toEqual({
    [DPD_SOURCE]: 'indikator-2-first-treatment-contact',
    [HOFTER_SOURCE]: 'indikator-2-surgery-within-24h',
    [DAMP_SOURCE]: 'indikator-2-readmission-rate',
  });
  expect(record.from).toEqual([
    'indikator-2-first-treatment-contact',
    'indikator-2-surgery-within-24h',
    'indikator-2-readmission-rate',
  ]);
  expect(readDecisions(workspace).decisions).toHaveLength(1);
});

test('gate 25.6 (control): a new source with the SAME meaning routes deterministically — no judgment call', async () => {
  const workspace = setupWiki();
  const wdir = wikiPath(workspace);
  installDivergentEntityFixture(wdir);
  await materialize('test-wiki', {
    workspace,
    curation: true,
    ...KEEP_ALL_STUBS,
    disambiguateFn: async () => splitOutcome(dpdHofterMembers()),
  });
  // A third DPD-year source restating the palliative-contact meaning.
  installChunk(
    wdir,
    'dpd-2024-part-001',
    {
      entities: [
        {
          name: 'Indikator 2',
          type: 'quality-indicator',
          slug: 'indikator-2',
          folder: 'entities/quality-indicators',
          significance: 'Palliative treatment contact timing.',
          mentions: [
            { page: 7, context: 'Modtagne patienter med palliativ behandlingskontakt senest 10 dage — andelen målt som før.' },
          ],
        },
      ],
      relationships: [],
      claims: [],
      timeline: [],
      context: 'DPD 2024 fixture.',
    },
    { pages: '7-9', sourceFile: 'wikis/test-wiki/raw/DPD_2024.pdf' },
  );
  let calls = 0;
  const run3 = await materialize('test-wiki', {
    workspace,
    curation: true,
    ...KEEP_ALL_STUBS,
    disambiguateFn: async () => {
      calls += 1;
      return noSplitOutcome();
    },
  });
  expect(calls).toBe(0);
  expect(run3.disambiguation?.reentries).toEqual([]);
  // The sourceMap still grew (deterministically, paid for once).
  expect(readDecisions(workspace).decisions[0].sourceMap).toMatchObject({
    'wikis/test-wiki/raw/DPD_2024.pdf': 'indikator-2-first-treatment-contact',
  });
  expect(run3.compositePages[0].members).toHaveLength(2);
});

// ---------------------------------------------------------------------------
// Gate 25.7 — the splits escape hatch dissolves the composite
// ---------------------------------------------------------------------------

test('gate 25.7: listing the generic slug in splits dissolves the composite — ordinary page rebuilt, reversal logged', async () => {
  const workspace = setupWiki();
  const wdir = wikiPath(workspace);
  installDivergentEntityFixture(wdir);
  await materialize('test-wiki', {
    workspace,
    curation: true,
    ...KEEP_ALL_STUBS,
    disambiguateFn: async () => splitOutcome(dpdHofterMembers()),
  });
  const compositePath = join(wdir, 'entities', 'quality-indicators', 'indikator-2.md');
  expect(matter(readFileSync(compositePath, 'utf-8')).data.type).toBe('composite');

  // The journalist hand-edits the split escape hatch (the Phase 21/22 knob).
  const decisionsPath = curationDecisionsPath(wdir);
  const recorded = JSON.parse(readFileSync(decisionsPath, 'utf-8')) as CurationDecisionsData;
  recorded.splits = ['indikator-2'];
  writeFileSync(decisionsPath, JSON.stringify(recorded, null, 2) + '\n', 'utf-8');

  let calls = 0;
  const run2 = await materialize('test-wiki', {
    workspace,
    curation: true,
    ...KEEP_ALL_STUBS,
    disambiguateFn: async () => {
      calls += 1;
      return splitOutcome(dpdHofterMembers());
    },
  });
  // The dissolved label is NOT re-proposed by the run that dissolved it.
  expect(calls).toBe(0);
  expect(run2.disambiguation?.proposed).toEqual([]);
  expect(run2.compositePages).toEqual([]);
  // The ordinary page is rebuilt from the full aggregate — BOTH meanings' evidence.
  const ordinary = matter(readFileSync(compositePath, 'utf-8'));
  expect(ordinary.data.type).toBe('entity');
  expect(ordinary.content).toContain(DPD_MENTION_1);
  expect(ordinary.content).toContain(HOFTER_MENTION_1);
  // The reversal is logged in the curation report.
  expect(run2.curation?.splitReversals).toEqual([
    { concern: 'entities', from: ['indikator-2-first-treatment-contact', 'indikator-2-surgery-within-24h'], into: 'indikator-2', reason: 'split' },
  ]);
  const report = JSON.parse(readFileSync(curationReportPath(wdir), 'utf-8')) as Record<string, unknown>;
  expect(report.splitReversals).toEqual([
    expect.objectContaining({ into: 'indikator-2', reason: 'split' }),
  ]);
});

// ---------------------------------------------------------------------------
// Gate 25.8 — the aggregate full-suite gate
// ---------------------------------------------------------------------------

/**
 * Gate 25.8 is encoded by this file being part of the key-less suite: the
 * full `npm test` run (with `.env` stashed) plus `npx tsc --noEmit` clean is
 * the Implementer's unified-verification leg, recorded in
 * `.state/phase-25-status.json`.
 */

// ---------------------------------------------------------------------------
// Gate 25.9 — LIVE (glm-5.3-flash only, the §3 pinning rule)
// ---------------------------------------------------------------------------

/** Mirrors the client's own .env fallback so skipIf reflects the key in use. */
function loadDotEnvZaiKey(): void {
  if (process.env.ZAI_API_KEY) {
    return;
  }
  try {
    const envPath = join(process.cwd(), '.env');
    if (!existsSync(envPath)) {
      return;
    }
    for (const line of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const eq = trimmed.indexOf('=');
      if (eq === -1) {
        continue;
      }
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
        (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
      ) {
        value = value.slice(1, -1);
      }
      if (key === 'ZAI_API_KEY' && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // No .env — the gate self-skips.
  }
}
loadDotEnvZaiKey();

/** The same-register control proposal (the 25.9 second invocation). */
function sameRegisterProposal(): ProposedDisambiguation {
  return {
    slug: 'indikator-2',
    title: 'Indikator 2',
    concern: 'entities',
    sources: [
      { file: 'DPD_2024.pdf', samples: ['Indikator 2 måler andelen af patienter der opereres senest 24 timer efter ankomst.'] },
      { file: 'DPD_2025.pdf', samples: ['Andelen af patienter som opereres inden for 24 timer efter ankomst til sygehuset måles årligt.'] },
    ],
  };
}

test.skipIf(!process.env.ZAI_API_KEY)(
  'gate 25.9 (live): the real disambiguate() against glm-5.3-flash returns schema-valid JSON and logs provider zhipu / model glm-5.3-flash / callType disambiguate',
  async () => {
    // Pin the curation slot (the disambiguate routing) to zhipu/glm-5.3-flash.
    llmClient.setModelRouting({
      provider: 'anthropic',
      default: 'claude-haiku-4.5',
      extractor: null,
      synthesis: null,
      dox: null,
      crossWiki: null,
      crossWikiJudgment: null,
      curation: { provider: 'zhipu', model: 'glm-5.3-flash' },
    });
    const workspace = makeTempDir('paper-chase-g25-live-');
    const logPath = join(wikiPath(workspace), '.state', 'llm-calls.json');
    mkdirSync(dirname(logPath), { recursive: true });
    try {
      // Invocation 1: the DPD/HOFTER divergent evidence.
      const outcome = await disambiguateLabel(
        { proposal: dpdHofterProposal() },
        { agentsMd: '(No AGENTS.md provided.)', logPath },
      );
      expect(outcome.fallbacks).toEqual([]);
      expect(outcome.verdict).not.toBeNull();
      const validation = validateDisambiguationVerdict(outcome.verdict, dpdHofterProposal());
      expect(validation.valid, validation.errors.join('; ')).toBe(true);
      if (validation.verdict?.split && validation.verdict.members !== undefined) {
        // A split must carry ≥2 well-formed members (either verdict is a PASS).
        expect(validation.verdict.members.length).toBeGreaterThanOrEqual(2);
      } else {
        expect(validation.verdict?.split).toBe(false);
      }
      // The call is logged with the pinned provider/model/callType.
      const entries = readFileSync(logPath, 'utf-8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as Record<string, string>);
      expect(
        entries.some(
          (entry) => entry.provider === 'zhipu' && entry.model === 'glm-5.3-flash' && entry.callType === 'disambiguate',
        ),
      ).toBe(true);

      // Invocation 2: the same-register control evidence — also schema-valid.
      const control = await disambiguateLabel(
        { proposal: sameRegisterProposal() },
        { agentsMd: '(No AGENTS.md provided.)', logPath },
      );
      expect(control.fallbacks).toEqual([]);
      expect(control.verdict).not.toBeNull();
      expect(validateDisambiguationVerdict(control.verdict, sameRegisterProposal()).valid).toBe(true);
    } finally {
      llmClient.setModelRouting(null);
    }
  },
  480_000,
);
