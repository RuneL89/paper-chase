import { createHash } from 'node:crypto';
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
import { ingest } from '../src/commands/ingest';
import { init } from '../src/commands/init';
import {
  buildCitationMap,
  writeEntityPage,
  type EntityPageData,
} from '../src/pages/entity-page';
import { writeTopicPage, type TopicPageData } from '../src/pages/topic-page';
import {
  checkPreservation,
  checkTopicPreservation,
} from '../src/validation/preservation-check';
import {
  formatCitationMap,
  writeEntitySynthesis,
  writePermissiveEntitySynthesis,
  writeTopicSynthesis,
  writePermissiveTopicSynthesis,
  type SynthesisLanguage,
} from '../src/agents/synthesis';
import * as llmClient from '../src/llm/client';
import type { ChunkExtraction } from '../src/commands/extract-chunk';
import type { ExtractorResult } from '../src/agents/extractor';
import type { CurationOutcome } from '../src/agents/curation';

/**
 * Phase 18 gates 18.1–18.5 (citation numbering alignment, phase doc §3;
 * canon: vision `06` §1–§3/§7, `04` §4/§6, `07` §2.4/§5; backlog B18). EVERY
 * gate is LLM-free ($0): the citation-map slot is asserted against the
 * deterministic writers' own `## Sources` rendering, the prompt gates are
 * hash-pinned byte-confinement checks (the gate-17.6 pattern) plus filled-
 * prompt captures via a `callLLM` spy, the validator gates drive
 * checkPreservation/checkTopicPreservation directly, and gate 18.4's
 * pipeline leg runs a hermetic temp-workspace ingest with injected stubs
 * (`poolStaggerMs: 0` + the Phase 14 keep-all curation stubs, the
 * phase-15/16/17 harness pattern).
 *
 * Gate 18.5 (full key-less suite: the Phase 17 baseline plus these tests,
 * zero unenumerated regressions; `npx tsc --noEmit` clean) is the
 * ORCHESTRATOR's leg (unified verification with Phases 19/20) — this file
 * being part of the suite encodes the suite half. The one enumerated
 * pre-existing-test touch this phase requires is recorded in
 * `.state/phase-18-status.json` (phase-17 gate 17.6's reconstruction chain
 * must also remove the Phase 18 slot to reproduce the pre-Phase-17 hash).
 */

const GOLDEN_MASTER_PDF = 'test-pdfs/golden-master.pdf';
const tempDirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
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

const SOURCE_ONE = 'wikis/test-wiki/raw/source-one.pdf';
const SOURCE_TWO = 'wikis/test-wiki/raw/source-two.pdf';
const SOURCE_THREE = 'wikis/test-wiki/raw/source-three.pdf';

/**
 * The gate-18.1 entity fixture: one mention (source-one), one outgoing
 * relationship (source-one — reuses src1), one claim (source-two → src2),
 * one incoming relationship (source-three → src3). buildCitationMap order is
 * mentions → outgoing → claims → incoming (the Phase 17 contract).
 */
function richEntityData(): EntityPageData {
  return {
    title: 'John Smith',
    slug: 'john-smith',
    folder: 'entities/people',
    type: 'person',
    wiki: 'test-wiki',
    mentions: [
      { page: 1, context: 'John Smith presented the results', source: SOURCE_ONE, pages: '1-3' },
    ],
    relationships: [
      {
        subject: 'john-smith',
        predicate: 'is-ceo-of',
        object: 'acme-corp',
        evidence: 'John Smith is the CEO of Acme Corp',
        page: 1,
        source: SOURCE_ONE,
        pages: '1-3',
      },
    ],
    claims: [
      {
        text: 'Revenue was $42.5M in Q3 2024',
        type: 'financial',
        entities: ['acme-corp'],
        page: 2,
        source: SOURCE_TWO,
        pages: '4-6',
      },
    ],
    incomingRelationships: [
      {
        subject: 'acme-corp',
        predicate: 'employs',
        evidence: 'Acme Corp employs John Smith as CEO',
        page: 5,
        source: SOURCE_THREE,
        pages: '7-9',
      },
    ],
    slugToTitle: { 'john-smith': 'John Smith', 'acme-corp': 'Acme Corp' },
  };
}

const EXPECTED_ENTITY_MAP = [
  '[^src1]: source-one.pdf, pages 1-3',
  '[^src2]: source-two.pdf, pages 4-6',
  '[^src3]: source-three.pdf, pages 7-9',
].join('\n');

/**
 * The gate-18.1 topic fixture: claim order is zeta-report FIRST, then
 * alpha-report — deliberately NOT file-sorted, so the deterministic map
 * (first-appearance order, matching `writeTopicPage`) disagrees with the
 * legacy `{sources}` block's file-sorted numbering. That disagreement is the
 * topic-side misalignment this phase fixes.
 */
function richTopicData(): TopicPageData {
  return {
    title: 'Financial',
    slug: 'financial',
    folder: 'topics/financial',
    wiki: 'test-wiki',
    claims: [
      {
        text: 'Operating expenses were $12M in Q3 2024',
        type: 'financial',
        entities: ['acme-corp'],
        page: 4,
        source: 'wikis/test-wiki/raw/zeta-report.pdf',
        pages: '4-6',
      },
      {
        text: 'Revenue was $42.5M in Q3 2024',
        type: 'financial',
        entities: ['acme-corp'],
        page: 2,
        source: 'wikis/test-wiki/raw/alpha-report.pdf',
        pages: '1-3',
      },
    ],
    slugToTitle: { 'acme-corp': 'Acme Corp' },
  };
}

const EXPECTED_TOPIC_MAP = [
  '[^src1]: zeta-report.pdf, pages 4-6',
  '[^src2]: alpha-report.pdf, pages 1-3',
].join('\n');

/** Every `[^srcN]: ...` definition line in a rendered page, in order. */
function definitionLines(page: string): string[] {
  return page.split('\n').filter((line) => /^\[\^src\d+\]: /.test(line));
}

/** Capture the four filled synthesis prompts (strict/permissive × entity/topic) via a callLLM spy. */
async function captureFilledPrompts(
  entityData: EntityPageData,
  topicData: TopicPageData,
): Promise<{ entityStrict: string; entityPermissive: string; topicStrict: string; topicPermissive: string }> {
  const prompts: string[] = [];
  vi.spyOn(llmClient, 'callLLM').mockImplementation(async (prompt: string) => {
    prompts.push(prompt);
    return 'stub output';
  });
  await writeEntitySynthesis(entityData, 'TEST CONSTITUTION');
  await writePermissiveEntitySynthesis(entityData, 'TEST CONSTITUTION');
  await writeTopicSynthesis(topicData, 'TEST CONSTITUTION');
  await writePermissiveTopicSynthesis(topicData, 'TEST CONSTITUTION');
  expect(prompts).toHaveLength(4);
  return {
    entityStrict: prompts[0],
    entityPermissive: prompts[1],
    topicStrict: prompts[2],
    topicPermissive: prompts[3],
  };
}

// ---------------------------------------------------------------------------
// Gate 18.1: the citationMap slot matches buildCitationMap exactly (keys,
// order, basenames, page ranges) — cross-checked against the deterministic
// writers' own `## Sources` rendering.
// ---------------------------------------------------------------------------
test('gate 18.1: the citationMap slot matches buildCitationMap exactly for a fixture entity page and a fixture topic page', async () => {
  // Unit leg: formatCitationMap renders the map in assignment order, in the
  // exact basename + page-range form, with the documented empty form.
  const entityData = richEntityData();
  expect(formatCitationMap(buildCitationMap(entityData).citationMap)).toBe(EXPECTED_ENTITY_MAP);
  expect(formatCitationMap(new Map())).toBe('(none)');

  const topicData = richTopicData();
  const topicMap = buildCitationMap({ mentions: [], relationships: [], claims: topicData.claims }).citationMap;
  expect(formatCitationMap(topicMap)).toBe(EXPECTED_TOPIC_MAP);

  // Cross-check leg: the slot equals the DETERMINISTIC WRITERS' own
  // `## Sources` definition lines (an independent renderer over the same
  // map) — the topic writer numbers zeta src1 (claim order), never the
  // file-sorted order of the legacy {sources} block.
  expect(definitionLines(writeEntityPage(entityData)).join('\n')).toBe(EXPECTED_ENTITY_MAP);
  expect(definitionLines(writeTopicPage(topicData)).join('\n')).toBe(EXPECTED_TOPIC_MAP);

  // Filled-prompt leg: all four synthesis prompts render the map under the
  // CITATION KEYS section.
  const prompts = await captureFilledPrompts(entityData, topicData);
  for (const prompt of [prompts.entityStrict, prompts.entityPermissive]) {
    expect(prompt).toContain('=== CITATION KEYS ===\n');
    expect(prompt).toContain(`\n${EXPECTED_ENTITY_MAP}\n`);
    expect(prompt).not.toContain('{citationMap}');
  }
  for (const prompt of [prompts.topicStrict, prompts.topicPermissive]) {
    expect(prompt).toContain('=== CITATION KEYS ===\n');
    expect(prompt).toContain(`\n${EXPECTED_TOPIC_MAP}\n`);
    expect(prompt).not.toContain('{citationMap}');
    // The pre-existing {sources} block stays byte-identical (slot-additive
    // contract) — file-sorted, zeta SECOND — while the new CITATION KEYS map
    // is the authoritative first-appearance numbering.
    expect(prompt).toContain('\n- [^src1]: alpha-report.pdf, pages 1-3\n- [^src2]: zeta-report.pdf, pages 4-6\n');
  }
});

// ---------------------------------------------------------------------------
// Gate 18.2: prompt slots (phase doc §2.1; PROMPT DISCIPLINE: slot-additive
// only — every pre-existing section stays byte-identical, hash-pinned)
// ---------------------------------------------------------------------------

/** The exact Phase 18 addition, byte-for-byte (same text in all four templates). */
const CITATION_SLOT =
  '=== CITATION KEYS ===\n' +
  "The only legal citation keys for this page, with the exact source each key refers to (the page's final Sources section is rebuilt from exactly this list):\n" +
  '{citationMap}\n' +
  '\n' +
  'Every citation [^srcN] in the article MUST use exactly these keys for these sources — cite the key whose listed source and pages contain the fact. No other [^srcN] keys may appear anywhere in the output.\n' +
  '\n';

const CITATION_RULE =
  'Every citation [^srcN] in the article MUST use exactly these keys for these sources — cite the key whose listed source and pages contain the fact. No other [^srcN] keys may appear anywhere in the output.';

/**
 * SHA-256 of each synthesis template as it existed BEFORE Phase 18 (the
 * Phase 17 state of the entity prompts; the Phase 13 state of the topic
 * prompts — recorded from the working tree at implementation time;
 * recompute with `sha256sum prompts/<file>` on the pre-Phase-18 tree if a
 * later phase legitimately edits these prompts).
 */
const PRE_PHASE_18_PROMPT_SHA256: Record<string, string> = {
  'prompts/synthesis.prompt.txt': 'c2b45de7b8b0bfb2fa12cf4fa1316e8f6f10ba7120b272596d0012d6385e6a71',
  'prompts/synthesis-permissive.prompt.txt': '54039a6c6df9546c76cbd11437356f4ad145bcf75a4747fb6fe75380098a6125',
  'prompts/synthesis-topic.prompt.txt': '7f51537045d21579eea014b6ae736a861d4a68a32be69a9466648197e5c23e7c',
  'prompts/synthesis-topic-permissive.prompt.txt': '5fc7346d3ee5ab50b1c6208126b7b5831fbfc5266569b4cabce91ecd08c68abd',
};

test('gate 18.2: all four templates carry the slot and the rule; removing the slot restores byte-equality with the Phase 17 templates; the filled prompt renders the map', async () => {
  for (const path of Object.keys(PRE_PHASE_18_PROMPT_SHA256)) {
    const template = readFileSync(path, 'utf-8');

    // The slot and the rule are present, exactly once each.
    expect(template.split(CITATION_SLOT).length - 1, path).toBe(1);
    expect(template.split(CITATION_RULE).length - 1, path).toBe(1);

    // Byte-confinement: removing the slot yields EXACTLY the pre-Phase-18
    // template — every pre-existing section (the `=== LANGUAGE ===` block,
    // the Phase 17 relatedEntities slot on the entity prompts, the legacy
    // {sources} block on the topic prompts, the self-sizing block) is
    // byte-identical.
    expect(template, path).toContain('=== LANGUAGE ===\n{languageDirective}\n\n');
    if (path.includes('synthesis-topic')) {
      expect(template, path).toContain('Sources:\n{sources}\n');
    } else {
      expect(template, path).toContain('Related Entities (the only legal wikilink targets — slug — title):\n{relatedEntities}');
    }
    const reconstructed = template.split(CITATION_SLOT).join('');
    const hash = createHash('sha256').update(reconstructed, 'utf-8').digest('hex');
    expect(hash, path).toBe(PRE_PHASE_18_PROMPT_SHA256[path]);
  }

  // The filled prompts render the map and keep every pre-existing contract:
  // the en/en LANGUAGE block removal (Phase 7), the TASK section, the
  // self-sizing block, the Phase 17 relatedEntities slot (entity prompts).
  const prompts = await captureFilledPrompts(richEntityData(), richTopicData());
  for (const [label, prompt] of Object.entries(prompts)) {
    expect(prompt, label).toContain(CITATION_RULE);
    expect(prompt, label).not.toContain('{citationMap}');
    expect(prompt, label).not.toContain('{languageDirective}');
    expect(prompt, label).not.toContain('=== LANGUAGE ===');
    expect(prompt, label).toContain('Length is not a target — completeness is.');
  }
  for (const prompt of [prompts.entityStrict, prompts.entityPermissive, prompts.topicStrict]) {
    expect(prompt).toContain('=== TASK ===');
  }
  for (const prompt of [prompts.entityStrict, prompts.entityPermissive]) {
    expect(prompt).toContain('Related Entities (the only legal wikilink targets — slug — title):\n- acme-corp — Acme Corp');
    expect(prompt).toContain(`\n${EXPECTED_ENTITY_MAP}\n`);
  }
  for (const prompt of [prompts.topicStrict, prompts.topicPermissive]) {
    expect(prompt).toContain(`\n${EXPECTED_TOPIC_MAP}\n`);
  }
});

// ---------------------------------------------------------------------------
// Gate 18.3: off-map marker detection (phase doc §2.2) — an off-map marker
// fails the check with extraMarkers naming the key and the first line; an
// on-map page passes.
// ---------------------------------------------------------------------------

/** A complete on-map entity page for the rich fixture (map src1–src3). */
function completeEntityPage(data: EntityPageData): string {
  return [
    'John Smith is the CEO of Acme Corp [^src1]. Acme Corp employs John Smith as CEO [^src3].',
    '',
    '## Mentions',
    '',
    '- Page 1: "John Smith presented the results" [^src1]',
    '',
    '## Relationships',
    '',
    '- John Smith is the CEO of Acme Corp [^src1]',
    '- Acme Corp employs John Smith as CEO [^src3]',
    '',
    '## Claims',
    '',
    '- Revenue was $42.5M in Q3 2024 [^src2]',
    '',
    '## Sources',
    '',
    '[^src1]: source-one.pdf, pages 1-3',
    '[^src2]: source-two.pdf, pages 4-6',
    '[^src3]: source-three.pdf, pages 7-9',
    '',
  ].join('\n');
}

test('gate 18.3: an entity page with an off-map marker fails with extraMarkers naming the key and line; an on-map page passes', () => {
  const data = richEntityData();
  const goodPage = completeEntityPage(data);

  const onMap = checkPreservation(data, goodPage);
  expect(onMap.passed).toBe(true);
  expect(onMap.extraMarkers).toEqual([]);

  // One off-map marker (the map has src1–src3) → the check fails and names
  // the key plus the first line it appears on.
  const offMap = checkPreservation(data, `${goodPage}Revenue later grew 40% [^src9].\n`);
  expect(offMap.passed).toBe(false);
  expect(offMap.extraMarkers).toEqual(['[^src9] (first line: "Revenue later grew 40% [^src9].")']);
  // The pre-existing checks are unaffected: nothing was dropped.
  expect(offMap.droppedMentions).toEqual([]);
  expect(offMap.droppedRelationships).toEqual([]);
  expect(offMap.droppedClaims).toEqual([]);
  expect(offMap.droppedCitations).toEqual([]);

  // Dedupe + first-appearance order across multiple distinct off-map keys.
  const multi = checkPreservation(
    data,
    `${goodPage}First [^src9] here [^src9] again.\nThen [^src7].\n`,
  );
  expect(multi.passed).toBe(false);
  expect(multi.extraMarkers).toEqual([
    '[^src9] (first line: "First [^src9] here [^src9] again.")',
    '[^src7] (first line: "Then [^src7].")',
  ]);

  // An off-map key appearing ONLY in a definition line is still off-map.
  const danglingDefinition = checkPreservation(
    data,
    `${goodPage}[^src9]: invented.pdf, pages 1-2\n`,
  );
  expect(danglingDefinition.passed).toBe(false);
  expect(danglingDefinition.extraMarkers).toEqual([
    '[^src9] (first line: "[^src9]: invented.pdf, pages 1-2")',
  ]);

  // The allowed set is the deterministic keys UNION the page data's
  // pre-existing `citations` — a citation the droppedCitations rule REQUIRES
  // is never flagged as extra by the same check.
  const withLegacyCitations: EntityPageData = {
    ...data,
    citations: ['src1', 'src2', 'src3', 'src9'],
  };
  const legacy = checkPreservation(
    withLegacyCitations,
    `${goodPage}Legacy marker [^src9].\n`,
  );
  expect(legacy.extraMarkers).toEqual([]);
  expect(legacy.passed).toBe(true);
});

test('gate 18.3 (topic): a topic page with an off-map marker fails with extraMarkers naming the key and line; an on-map page passes', () => {
  const data = richTopicData();
  const goodPage = [
    'Financial topics cover revenue and expenses [^src1] [^src2].',
    '',
    '## Claims',
    '',
    '- Operating expenses were $12M in Q3 2024 [^src1]',
    '- Revenue was $42.5M in Q3 2024 [^src2]',
    '',
    '## Sources',
    '',
    '[^src1]: zeta-report.pdf, pages 4-6',
    '[^src2]: alpha-report.pdf, pages 1-3',
    '',
  ].join('\n');

  const onMap = checkTopicPreservation(data, goodPage);
  expect(onMap.passed).toBe(true);
  expect(onMap.extraMarkers).toEqual([]);

  const offMap = checkTopicPreservation(data, `${goodPage}An invented figure [^src9].\n`);
  expect(offMap.passed).toBe(false);
  expect(offMap.extraMarkers).toEqual(['[^src9] (first line: "An invented figure [^src9].")']);
  expect(offMap.droppedClaims).toEqual([]);
  expect(offMap.droppedCitations).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 18.4: the extraMarkers entries are the exact material for the reask
// correction block (checker leg), and an extraMarkers-only failure engages
// the existing Phase 12 reask loop end-to-end (pipeline leg).
// ---------------------------------------------------------------------------

test('gate 18.4: extraMarkers entries carry the exact offending marker and first line for the reask correction block', () => {
  const data = richEntityData();
  const check = checkPreservation(
    data,
    `${completeEntityPage(data)}Revenue later grew 40% [^src9].\nAlso [^src7] here.\n`,
  );
  expect(check.passed).toBe(false);

  // Each entry splices verbatim into a correction-block error line that
  // names the exact offending marker AND the first line it appeared on.
  // (The `preservationFeedbackErrors` wire in src/commands/ingest.ts is the
  // orchestrator's patch — this pins the shape it consumes.)
  const feedbackLines = check.extraMarkers.map(
    (entry) =>
      `Off-map citation marker (remove it or replace it with a key from the CITATION KEYS list): ${entry}`,
  );
  expect(feedbackLines).toEqual([
    'Off-map citation marker (remove it or replace it with a key from the CITATION KEYS list): [^src9] (first line: "Revenue later grew 40% [^src9].")',
    'Off-map citation marker (remove it or replace it with a key from the CITATION KEYS list): [^src7] (first line: "Also [^src7] here.")',
  ]);
});

// --- Pipeline leg: hermetic ingest with injected stubs (phase-17 harness) ---

/** Injected Layer 2 stub: writes the extraction JSON exactly like the real path. */
function makeExtractChunkFnStub(extraction: ExtractorResult) {
  return async (wikiDir: string, chunkId: string): Promise<ChunkExtraction> => {
    const jsonPath = join(wikiDir, '.state', 'extracted', `${chunkId}.json`);
    await mkdir(dirname(jsonPath), { recursive: true });
    await writeFile(jsonPath, JSON.stringify(extraction, null, 2) + '\n', 'utf-8');
    return { chunkId, result: extraction, jsonPath, jsonRelativePath: `.state/extracted/${chunkId}.json` };
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

test('gate 18.4 (pipeline): an extraMarkers-only preservation failure is a content defect the existing reask loop corrects', async () => {
  const workspace = makeTempDir('paper-chase-g18-4-');
  init('test-wiki', { workspace });
  mkdirSync(wikiPath(workspace, 'raw'), { recursive: true });
  copyFileSync(GOLDEN_MASTER_PDF, wikiPath(workspace, 'raw', 'golden-master.pdf'));

  // One entity, one mention, no claims → no topic pages; the deterministic
  // map is exactly src1 (golden-master.pdf | 1-3).
  const extraction: ExtractorResult = {
    entities: [
      {
        name: 'Alpha',
        type: 'person',
        slug: 'alpha',
        folder: 'entities/people',
        significance: 'The chair of Beta.',
        mentions: [{ page: 1, context: 'Alpha addressed the board' }],
      },
    ],
    relationships: [],
    claims: [],
    timeline: [],
    context: 'Phase 18 pipeline fixture.',
  };

  const cleanPage = (data: EntityPageData): string =>
    [
      `Synthesis prose for ${data.title} [^src1].`,
      '',
      ...data.mentions.map((mention) => `- Page ${mention.page}: "${mention.context}" [^src1]`),
      '',
      '## Sources',
      '',
      '[^src1]: golden-master.pdf, pages 1-3',
      '',
    ].join('\n');

  const calls: Array<{ attempt?: number; feedback?: string }> = [];
  const synthesizeEntityFn = async (
    data: EntityPageData,
    _agentsMd: string,
    _logPath: string | undefined,
    _language: SynthesisLanguage | undefined,
    feedback: string | undefined,
    attempt: number | undefined,
  ): Promise<string> => {
    calls.push({ attempt, feedback });
    if (attempt === 1) {
      // Complete except for ONE model-invented off-map marker — the check
      // fails on extraMarkers alone (nothing dropped).
      return `${cleanPage(data)}An off-map claim snuck in [^src9].\n`;
    }
    return cleanPage(data);
  };

  const result = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...CURATION_STUBS,
    extractChunkFn: makeExtractChunkFnStub(extraction),
    synthesizeEntityFn,
    synthesizeEntityPermissiveFn: async () => 'permissive stub (never called)',
    synthesizeTopicFn: async () => 'topic stub (never called)',
    synthesizeTopicPermissiveFn: async () => 'topic permissive stub (never called)',
  });

  // The off-map failure triggered the reask: exactly two strict attempts,
  // attempt 2 carrying a non-empty correction block, then success.
  expect(calls).toHaveLength(2);
  expect(calls[0]).toEqual({ attempt: 1, feedback: undefined });
  expect(calls[1].attempt).toBe(2);
  expect(typeof calls[1].feedback).toBe('string');
  expect((calls[1].feedback ?? '').length).toBeGreaterThan(0);
  expect(result.synthesized).toBe(1);
  expect(result.synthesisConflicts).toBe(0);

  // The written page is the corrected one: on-map marker only.
  const written = readFileSync(wikiPath(workspace, 'entities', 'people', 'alpha.md'), 'utf-8');
  expect(written).toContain('[^src1]: golden-master.pdf, pages 1-3');
  expect(written).not.toContain('[^src9]');

  // The repair was accounted: one feedback repair in the run metrics.
  const metrics = JSON.parse(readFileSync(wikiPath(workspace, '.state', 'metrics.json'), 'utf-8'));
  expect(metrics.feedbackRepairs).toBe(1);
});
