import {
  existsSync,
  copyFileSync,
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
  curateEntities,
  validateEntityDecisions,
  type CurationOutcome,
  type EntityCurationCandidate,
} from '../src/agents/curation';
import {
  detectPreMergePairs,
  type PreMergeCandidate,
  type ProposedCluster,
  type ProposedPair,
} from '../src/agents/pre-merge';
import { materialize } from '../src/materializer';
import { init } from '../src/commands/init';
import { ingest, type IngestOptions } from '../src/commands/ingest';
import type { ChunkExtraction } from '../src/commands/extract-chunk';
import { readSynthesisReport } from '../src/state/synthesis-report';
import { readConflicts } from '../src/state/conflicts';
import type { EntityPageData } from '../src/pages/entity-page';
import type { TopicPageData } from '../src/pages/topic-page';
import {
  curationDecisionsPath,
  readCurationDecisions,
  appendCurationDecisions,
  type CurationDecisionsData,
} from '../src/state/curation-decisions';
import { curationOverridesPath } from '../src/state/curation-overrides';
import { curationReportPath, type CurationReport } from '../src/state/curation-report';
import { pageDataHash } from '../src/state/synthesis-state';
import { checkCompositePreservation } from '../src/validation/preservation-check';
import { checkLinks } from '../src/validation/link-checker';
import { validateSchema } from '../src/validation/schema-validator';
import { writeCompositePage, type CompositePageData } from '../src/pages/composite-page';
import { writeCompositeSynthesis } from '../src/agents/synthesis';
import { writeDoxContracts } from '../src/dox-writer';
import * as llmClient from '../src/llm/client';
import { appRoot } from '../src/utils/app-root';
import type { ExtractorResult } from '../src/agents/extractor';

/**
 * Phase 22 gates 22.1–22.9 (composite pages — Option C; phase doc §2.1–§2.4;
 * canon: the five-class rollup amendment, vision `02` §4.6 / `05` §6 amended
 * 2026-07-29 user-ratified; `07` §2.3–§2.6/§5; backlog B22). EVERY gate is
 * LLM-free ($0): cluster proposals come from the pure deterministic pre-merge
 * engine, the confirm-deny/cluster path is exercised through the injected
 * `callLLMFn` / `curateEntitiesFn` seams, and synthesis runs through a
 * `callLLM` spy. Fixtures mirror the ratified classes' observed shapes
 * (indikator-N↔concept class 3, region-X org/location class 5).
 *
 * Gate 22.9 (full key-less suite: the Phase 21 baseline of 402 passed + 14
 * skipped across 27 files plus these tests, zero unenumerated regressions;
 * `npx tsc --noEmit` clean) is encoded by this file being part of the suite —
 * the full-suite run itself is the Implementer's unified-verification leg
 * (recorded in `.state/phase-22-status.json`).
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
  const workspace = makeTempDir('paper-chase-g22-');
  init('test-wiki', { workspace });
  return workspace;
}

/** Install one chunk's document page + extraction JSON (phase-14 harness). */
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

function readDecisions(workspace: string): CurationDecisionsData {
  return JSON.parse(readFileSync(curationDecisionsPath(wikiPath(workspace)), 'utf-8')) as CurationDecisionsData;
}

function readReport(workspace: string): CurationReport {
  return JSON.parse(readFileSync(curationReportPath(wikiPath(workspace)), 'utf-8')) as CurationReport;
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function unitCandidate(slug: string, title?: string, aliases?: string[]): PreMergeCandidate {
  return {
    slug,
    title: title ?? titleCase(slug),
    ...(aliases !== undefined ? { aliases } : {}),
  };
}

function entityCandidate(slug: string): EntityCurationCandidate {
  return {
    slug,
    title: titleCase(slug),
    type: 'organization',
    folder: 'entities/organizations',
    mentionCount: 1,
    significance: '',
    sampleMentions: [`${titleCase(slug)} was mentioned.`],
    onDisk: false,
  };
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const INDICATOR_SLUG = 'indikator-1-antibiotikabehandling';
const CONCEPT_SLUG = 'antibiotikabehandling';

/** The class-3 indicator↔concept fixture (gates 22.2/22.8). */
function indicatorExtraction(): ExtractorResult {
  return {
    entities: [
      {
        name: 'Indikator 1: Antibiotikabehandling',
        type: 'quality-indicator',
        slug: INDICATOR_SLUG,
        folder: 'entities/quality-indicators',
        significance: 'The antibiotic-treatment indicator.',
        mentions: [{ page: 1, context: 'Indikator 1 måler antibiotikabehandling.' }],
      },
      {
        name: 'Antibiotikabehandling',
        type: 'concept',
        slug: CONCEPT_SLUG,
        folder: 'entities/concepts',
        significance: 'The measured treatment concept.',
        mentions: [
          { page: 1, context: 'Antibiotikabehandling gives ved behandling af infektion.' },
          { page: 2, context: 'Antibiotikabehandling dokumenteres i journalen.' },
        ],
      },
      {
        name: 'Acme Corp',
        type: 'company',
        slug: 'acme-corp',
        folder: 'entities/companies',
        significance: 'The auditor.',
        mentions: [{ page: 3, context: 'Acme Corp audited the program.' }],
      },
    ],
    relationships: [
      {
        subject: INDICATOR_SLUG,
        predicate: 'measures',
        object: CONCEPT_SLUG,
        evidence: 'Indikator 1 måler antibiotikabehandling',
        page: 1,
      },
      {
        subject: 'acme-corp',
        predicate: 'audited',
        object: CONCEPT_SLUG,
        evidence: 'Acme Corp audited the antibiotic treatment',
        page: 3,
      },
    ],
    claims: [
      { text: 'Antibiotikabehandling was completed in 92% of cases', type: 'quality', entities: [CONCEPT_SLUG], page: 2 },
    ],
    timeline: [],
    context: 'Phase 22 indicator fixture.',
  };
}

/** The class-5 region org/location fixture (gates 22.6/22.7). */
function regionExtraction(): ExtractorResult {
  return {
    entities: [
      {
        name: 'Region Hovedstaden',
        type: 'organization',
        slug: 'region-hovedstaden',
        folder: 'entities/organizations/regions',
        significance: 'The regional health authority.',
        mentions: [{ page: 1, context: 'Region Hovedstaden driver hospitalerne i regionen.' }],
      },
      {
        name: 'Hovedstaden',
        type: 'location',
        slug: 'hovedstaden',
        folder: 'entities/locations',
        significance: 'The capital region of Denmark.',
        mentions: [{ page: 2, context: 'Hovedstaden er den mest folkerige region.' }],
      },
    ],
    relationships: [
      {
        subject: 'region-hovedstaden',
        predicate: 'covers',
        object: 'hovedstaden',
        evidence: 'Region Hovedstaden covers the capital area',
        page: 1,
      },
    ],
    claims: [],
    timeline: [],
    context: 'Phase 22 region fixture.',
  };
}

/** A hand-built CompositePageData mirroring the materializer's assembly (gates 22.3–22.5, 22.8). */
function compositeFixture(): CompositePageData {
  return {
    title: 'Indikator 1: Antibiotikabehandling — Antibiotikabehandling',
    slug: INDICATOR_SLUG,
    folder: 'entities/quality-indicators',
    wiki: 'test-wiki',
    class: 3,
    members: [
      {
        slug: INDICATOR_SLUG,
        title: 'Indikator 1: Antibiotikabehandling',
        type: 'quality-indicator',
        role: 'indicator',
        significance: 'The antibiotic-treatment indicator.',
      },
      {
        slug: CONCEPT_SLUG,
        title: 'Antibiotikabehandling',
        type: 'concept',
        role: 'concept',
        significance: 'The measured treatment concept.',
      },
    ],
    memberEvidence: [
      {
        slug: INDICATOR_SLUG,
        mentions: [
          { page: 1, context: 'Indikator 1 måler antibiotikabehandling.', source: 'wikis/test-wiki/raw/golden-master.pdf', pages: '1-3' },
        ],
        relationships: [
          {
            subject: INDICATOR_SLUG,
            predicate: 'measures',
            object: CONCEPT_SLUG,
            evidence: 'Indikator 1 måler antibiotikabehandling',
            page: 1,
            source: 'wikis/test-wiki/raw/golden-master.pdf',
            pages: '1-3',
          },
        ],
        incomingRelationships: [],
        claims: [],
        timeline: [],
        contexts: ['Phase 22 indicator fixture.'],
      },
      {
        slug: CONCEPT_SLUG,
        mentions: [
          { page: 1, context: 'Antibiotikabehandling gives ved behandling af infektion.', source: 'wikis/test-wiki/raw/golden-master.pdf', pages: '1-3' },
          { page: 2, context: 'Antibiotikabehandling dokumenteres i journalen.', source: 'wikis/test-wiki/raw/golden-master.pdf', pages: '1-3' },
        ],
        relationships: [],
        incomingRelationships: [
          {
            subject: 'acme-corp',
            predicate: 'audited',
            evidence: 'Acme Corp audited the antibiotic treatment',
            page: 3,
            source: 'wikis/test-wiki/raw/golden-master.pdf',
            pages: '1-3',
          },
        ],
        claims: [
          {
            text: 'Antibiotikabehandling was completed in 92% of cases',
            type: 'quality',
            entities: [CONCEPT_SLUG],
            page: 2,
            source: 'wikis/test-wiki/raw/golden-master.pdf',
            pages: '1-3',
          },
        ],
        timeline: [],
        contexts: [],
      },
    ],
    slugToTitle: {
      [INDICATOR_SLUG]: 'Indikator 1: Antibiotikabehandling — Antibiotikabehandling',
      [CONCEPT_SLUG]: 'Antibiotikabehandling',
      'acme-corp': 'Acme Corp',
    },
    aliases: ['Indikator 1: Antibiotikabehandling', 'Antibiotikabehandling'],
    context: 'Phase 22 indicator fixture.',
  };
}

// ---------------------------------------------------------------------------
// Gate 22.1 — cluster validation: accepts in-class clusters; rejects
// out-of-class, over-cap, double-membership, and neverMerge-vetoed clusters
// with exact error lists. Proposals are judged confirm/deny.
// ---------------------------------------------------------------------------

test('gate 22.1: validation accepts a class-3 indicator+concept pair and a class-5 same-stem pair', () => {
  const class3 = validateEntityDecisions(
    JSON.stringify({
      merge: [],
      unsure: [],
      clusters: [{ members: ['indikator-1', 'antibiotikabehandling'], class: 3, into: 'indikator-1' }],
    }),
    new Set(['indikator-1', 'antibiotikabehandling', 'acme-corp']),
  );
  expect(class3.valid).toBe(true);
  expect(class3.errors).toEqual([]);
  expect(class3.decisions?.clusters).toEqual([
    { members: ['indikator-1', 'antibiotikabehandling'], class: 3, into: 'indikator-1' },
  ]);
  // Cluster members are decided — the derived keep holds only the third slug.
  expect(class3.decisions?.keep).toEqual(['acme-corp']);

  const class5 = validateEntityDecisions(
    JSON.stringify({
      merge: [],
      unsure: [],
      clusters: [{ members: ['hovedstaden', 'region-hovedstaden'], class: 5, into: 'region-hovedstaden' }],
    }),
    new Set(['region-hovedstaden', 'hovedstaden', 'acme-corp']),
  );
  expect(class5.valid).toBe(true);
  expect(class5.decisions?.clusters).toEqual([
    // Member order is normalized: into first, the rest sorted.
    { members: ['region-hovedstaden', 'hovedstaden'], class: 5, into: 'region-hovedstaden' },
  ]);
});

test('gate 22.1: validation rejects out-of-class clusters with exact errors', () => {
  // Class 3 with two non-indicator slugs.
  const twoConcepts = validateEntityDecisions(
    JSON.stringify({
      merge: [],
      unsure: [],
      clusters: [{ members: ['antibiotikabehandling', 'acme-corp'], class: 3, into: 'acme-corp' }],
    }),
    new Set(['antibiotikabehandling', 'acme-corp']),
  );
  expect(twoConcepts.valid).toBe(false);
  expect(twoConcepts.errors.join('\n')).toContain('needs exactly one indicator slug');

  // Class 3 with 3 members (1:1 only).
  const threeWay = validateEntityDecisions(
    JSON.stringify({
      merge: [],
      unsure: [],
      clusters: [{ members: ['indikator-1', 'antibiotikabehandling', 'acme-corp'], class: 3, into: 'indikator-1' }],
    }),
    new Set(['indikator-1', 'antibiotikabehandling', 'acme-corp']),
  );
  expect(threeWay.valid).toBe(false);
  expect(threeWay.errors.join('\n')).toContain('1:1 only');

  // Class 5 with different stems.
  const stems = validateEntityDecisions(
    JSON.stringify({
      merge: [],
      unsure: [],
      clusters: [{ members: ['region-hovedstaden', 'region-sjaelland'], class: 5, into: 'region-hovedstaden' }],
    }),
    new Set(['region-hovedstaden', 'region-sjaelland']),
  );
  expect(stems.valid).toBe(false);
  expect(stems.errors.join('\n')).toContain('must share the same slug-stem');

  // A class outside 1-5.
  const outOfRange = validateEntityDecisions(
    JSON.stringify({
      merge: [],
      unsure: [],
      clusters: [{ members: ['alpha', 'beta'], class: 6, into: 'alpha' }],
    }),
    new Set(['alpha', 'beta']),
  );
  expect(outOfRange.valid).toBe(false);
  expect(outOfRange.errors.join('\n')).toContain('must be 1-5');

  // into not a member.
  const intoOutside = validateEntityDecisions(
    JSON.stringify({
      merge: [],
      unsure: [],
      clusters: [{ members: ['alpha', 'beta'], class: 2, into: 'gamma' }],
    }),
    new Set(['alpha', 'beta', 'gamma']),
  );
  expect(intoOutside.valid).toBe(false);
  expect(intoOutside.errors.join('\n')).toContain("into 'gamma' must be one of its members");

  // Unknown member.
  const unknown = validateEntityDecisions(
    JSON.stringify({
      merge: [],
      unsure: [],
      clusters: [{ members: ['alpha', 'ghost'], class: 2, into: 'alpha' }],
    }),
    new Set(['alpha', 'beta']),
  );
  expect(unknown.valid).toBe(false);
  expect(unknown.errors.join('\n')).toContain("unknown slug 'ghost'");
});

test('gate 22.1: validation rejects over-cap and under-cap clusters with exact errors', () => {
  const overCap = validateEntityDecisions(
    JSON.stringify({
      merge: [],
      unsure: [],
      clusters: [{ members: ['a1', 'a2', 'a3', 'a4', 'a5'], class: 2, into: 'a1' }],
    }),
    new Set(['a1', 'a2', 'a3', 'a4', 'a5']),
  );
  expect(overCap.valid).toBe(false);
  expect(overCap.errors.join('\n')).toContain('takes 2-4 members');

  const underCap = validateEntityDecisions(
    JSON.stringify({
      merge: [],
      unsure: [],
      clusters: [{ members: ['a1'], class: 2, into: 'a1' }],
    }),
    new Set(['a1', 'a2']),
  );
  expect(underCap.valid).toBe(false);
  expect(underCap.errors.join('\n')).toContain('takes 2-4 members');
});

test('gate 22.1: validation rejects double membership, bucket overlap, pair overlap, and neverMerge-vetoed clusters', () => {
  // A member in two clusters.
  const double = validateEntityDecisions(
    JSON.stringify({
      merge: [],
      unsure: [],
      clusters: [
        { members: ['alpha', 'beta'], class: 2, into: 'alpha' },
        { members: ['beta', 'gamma'], class: 4, into: 'beta' },
      ],
    }),
    new Set(['alpha', 'beta', 'gamma']),
  );
  expect(double.valid).toBe(false);
  expect(double.errors.join('\n')).toContain("slug 'beta' appears in two clusters");

  // A clustered slug in the merge bucket.
  const inMerge = validateEntityDecisions(
    JSON.stringify({
      merge: [{ from: ['beta'], into: 'gamma' }],
      unsure: [],
      clusters: [{ members: ['alpha', 'beta'], class: 2, into: 'alpha' }],
    }),
    new Set(['alpha', 'beta', 'gamma']),
  );
  expect(inMerge.valid).toBe(false);
  expect(inMerge.errors.join('\n')).toContain("slug 'beta' is decided by a cluster");

  // A confirmed pair overlapping an applied cluster.
  const pairOverlap = validateEntityDecisions(
    JSON.stringify({
      merge: [],
      unsure: [],
      pairs: [{ from: 'alpha', into: 'gamma', confirm: true }],
      clusters: [{ members: ['alpha', 'beta'], class: 2, into: 'alpha' }],
    }),
    new Set(['alpha', 'beta', 'gamma']),
    [],
    [{ from: 'alpha', into: 'gamma', signal: 'subsequence', evidence: 'fixture' }],
  );
  expect(pairOverlap.valid).toBe(false);
  expect(pairOverlap.errors.join('\n')).toContain('overlaps a cluster');

  // A neverMerge pair inside a cluster.
  const vetoed = validateEntityDecisions(
    JSON.stringify({
      merge: [],
      unsure: [],
      clusters: [{ members: ['alpha', 'beta'], class: 2, into: 'alpha' }],
    }),
    new Set(['alpha', 'beta']),
    [['alpha', 'beta']],
  );
  expect(vetoed.valid).toBe(false);
  expect(vetoed.errors.join('\n')).toContain("contains the neverMerge pair 'alpha' + 'beta'");
});

test('gate 22.1: proposed clusters are judged confirm/deny; unjudged denies; duplicates and mismatched copies reject', () => {
  const proposals: ProposedCluster[] = [
    {
      members: ['indikator-1-antibiotikabehandling', 'antibiotikabehandling'],
      class: 3,
      into: 'indikator-1-antibiotikabehandling',
      signal: 'indicator-form',
      evidence: 'fixture',
    },
  ];
  const slugs = new Set(['indikator-1-antibiotikabehandling', 'antibiotikabehandling', 'acme-corp']);

  const confirmed = validateEntityDecisions(
    JSON.stringify({
      merge: [],
      unsure: [],
      clusters: [
        {
          members: ['indikator-1-antibiotikabehandling', 'antibiotikabehandling'],
          class: 3,
          into: 'indikator-1-antibiotikabehandling',
          confirm: true,
          rationale: 'the indicator measures the concept',
        },
      ],
    }),
    slugs,
    [],
    [],
    proposals,
  );
  expect(confirmed.valid).toBe(true);
  expect(confirmed.decisions?.clusters).toEqual([
    {
      members: ['indikator-1-antibiotikabehandling', 'antibiotikabehandling'],
      class: 3,
      into: 'indikator-1-antibiotikabehandling',
      rationale: 'the indicator measures the concept',
    },
  ]);
  expect(confirmed.clusterVerdicts?.[0]?.verdict).toBe('confirm');

  const denied = validateEntityDecisions(
    JSON.stringify({
      merge: [],
      unsure: [],
      clusters: [
        {
          members: ['indikator-1-antibiotikabehandling', 'antibiotikabehandling'],
          class: 3,
          into: 'indikator-1-antibiotikabehandling',
          confirm: false,
          rationale: 'keep them apart',
        },
      ],
    }),
    slugs,
    [],
    [],
    proposals,
  );
  expect(denied.valid).toBe(true);
  expect(denied.decisions?.clusters).toBeUndefined();
  expect(denied.decisions?.keep).toEqual(['acme-corp', 'antibiotikabehandling', 'indikator-1-antibiotikabehandling']);
  expect(denied.clusterVerdicts).toEqual([
    {
      members: ['indikator-1-antibiotikabehandling', 'antibiotikabehandling'],
      class: 3,
      into: 'indikator-1-antibiotikabehandling',
      verdict: 'deny',
      rationale: 'keep them apart',
    },
  ]);

  // Unjudged = denied.
  const unjudged = validateEntityDecisions(JSON.stringify({ merge: [], unsure: [] }), slugs, [], [], proposals);
  expect(unjudged.valid).toBe(true);
  expect(unjudged.clusterVerdicts?.[0]?.verdict).toBe('deny');

  // A mismatched copy (wrong class) rejects.
  const mismatched = validateEntityDecisions(
    JSON.stringify({
      merge: [],
      unsure: [],
      clusters: [
        { members: ['indikator-1-antibiotikabehandling', 'antibiotikabehandling'], class: 5, into: 'indikator-1-antibiotikabehandling', confirm: true },
      ],
    }),
    slugs,
    [],
    [],
    proposals,
  );
  expect(mismatched.valid).toBe(false);
  expect(mismatched.errors.join('\n')).toContain('copy the proposal exactly');

  // A duplicated judgment rejects.
  const duplicated = validateEntityDecisions(
    JSON.stringify({
      merge: [],
      unsure: [],
      clusters: [
        { members: ['indikator-1-antibiotikabehandling', 'antibiotikabehandling'], class: 3, into: 'indikator-1-antibiotikabehandling', confirm: true },
        { members: ['indikator-1-antibiotikabehandling', 'antibiotikabehandling'], class: 3, into: 'indikator-1-antibiotikabehandling', confirm: false },
      ],
    }),
    slugs,
    [],
    [],
    proposals,
  );
  expect(duplicated.valid).toBe(false);
  expect(duplicated.errors.join('\n')).toContain('judged twice');
});

test('gate 22.1: an out-of-class/over-cap cluster is a validation error that re-asks with the exact error list', async () => {
  const prompts: string[] = [];
  const outcome = await curateEntities(
    ['a1', 'a2', 'a3', 'a4', 'a5'].map(entityCandidate),
    {
      agentsMd: 'Test constitution.',
      callLLMFn: async (prompt) => {
        prompts.push(prompt);
        if (prompts.length === 1) {
          return JSON.stringify({
            merge: [],
            unsure: [],
            clusters: [{ members: ['a1', 'a2', 'a3', 'a4', 'a5'], class: 2, into: 'a1' }],
          });
        }
        return JSON.stringify({
          merge: [],
          unsure: [],
          clusters: [{ members: ['a1', 'a2'], class: 2, into: 'a1', rationale: 'brand and generic' }],
        });
      },
    },
  );
  expect(outcome.attempts).toBe(2);
  expect(outcome.fallbacks).toEqual([]);
  // The reask carried the exact over-cap error back for correction.
  expect(prompts[1]).toContain('=== CORRECTION REQUIRED ===');
  expect(prompts[1]).toContain('takes 2-4 members');
  expect(outcome.decisions?.clusters).toEqual([
    { members: ['a1', 'a2'], class: 2, into: 'a1', rationale: 'brand and generic' },
  ]);
});

test('gate 22.1: deterministic detection reroutes region name-forms to ONE class-5 family cluster and indicator number↔concept to a class-3 cluster', () => {
  // Region family of 3 forms → ONE class-5 cluster (never pairwise merges).
  const regions = detectPreMergePairs(
    [unitCandidate('hovedstaden'), unitCandidate('hovedstaden-region'), unitCandidate('region-hovedstaden')],
    { language: { input: 'da', output: 'da' } },
  );
  expect(regions.proposed).toEqual([]);
  expect(regions.proposedClusters).toEqual([
    {
      members: ['region-hovedstaden', 'hovedstaden-region', 'hovedstaden'],
      class: 5,
      into: 'region-hovedstaden',
      signal: 'region-form',
      evidence: expect.stringContaining("core 'hovedstaden'"),
    },
  ]);

  // A family beyond the member cap proposes NOTHING (never a partial cluster).
  const overCap = detectPreMergePairs(
    ['a', 'a-region', 'region-a', 'region-of-a', 'a-of-region'].map((slug) => unitCandidate(slug)),
  );
  expect(overCap.proposedClusters.filter((cluster) => cluster.class === 5)).toEqual([]);

  // Indicator case-1 (number-name ↔ bare concept) → class-3 cluster; case-2
  // (bare number ↔ same-named form) stays a merge pair.
  const indicators = detectPreMergePairs(
    [unitCandidate('indikator-2-ct-skanning'), unitCandidate('ct-skanning'), unitCandidate('indikator-2')],
    { language: { input: 'da', output: 'da' } },
  );
  expect(indicators.proposedClusters).toEqual([
    {
      members: ['indikator-2-ct-skanning', 'ct-skanning'],
      class: 3,
      into: 'indikator-2-ct-skanning',
      signal: 'indicator-form',
      evidence: expect.stringContaining('indicator'),
    },
  ]);
  expect(indicators.proposed).toEqual([
    {
      from: 'indikator-2-ct-skanning',
      into: 'indikator-2',
      signal: 'indicator-form',
      evidence: expect.stringContaining('indicator'),
    },
  ]);

  // A neverMerge pair inside a region family vetoes the whole proposal.
  const vetoed = detectPreMergePairs([unitCandidate('hovedstaden'), unitCandidate('region-hovedstaden')], {
    language: { input: 'da', output: 'da' },
    neverMerge: [['hovedstaden', 'region-hovedstaden']],
  });
  expect(vetoed.proposedClusters).toEqual([]);
  expect(vetoed.vetoed).toEqual([
    { from: 'hovedstaden', into: 'region-hovedstaden', signal: 'region-form', evidence: expect.stringContaining('region') },
  ]);
});

// ---------------------------------------------------------------------------
// Gate 22.2 — assembly: the composite carries the unioned member-tagged
// evidence; NO member pages; member-targeted wikilinks rewritten; aliases union.
// ---------------------------------------------------------------------------

test('gate 22.2: assembly — composite page with member-tagged unioned evidence, zero member pages, member links rewritten, aliases union', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  const body =
    '\n## Extracted Text: Pages 1-3\n\n' +
    'See [[antibiotikabehandling]] and [[indikator-1-antibiotikabehandling|Indikator 1]]. [^src1]\n\n' +
    '[^src1]: golden-master.pdf, pages 1-3\n';
  installChunk(wikiDir, 'golden-master-part-001', indicatorExtraction(), '1-3', body);

  const seenClusters: ProposedCluster[][] = [];
  const result = await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async (_candidates, options) => {
      seenClusters.push([...(options.proposedClusters ?? [])]);
      return {
        decisions: {
          merges: [],
          drops: [],
          keep: ['acme-corp'],
          clusters: [
            {
              members: [INDICATOR_SLUG, CONCEPT_SLUG],
              class: 3,
              into: INDICATOR_SLUG,
              rationale: 'the indicator measures the concept',
            },
          ],
        },
        attempts: 1,
        fallbacks: [],
        vetoes: [],
        clusterVerdicts: [
          {
            members: [INDICATOR_SLUG, CONCEPT_SLUG],
            class: 3,
            into: INDICATOR_SLUG,
            verdict: 'confirm' as const,
            rationale: 'the indicator measures the concept',
          },
        ],
      };
    },
  });

  // The deterministic engine proposed the class-3 cluster to the model.
  expect(seenClusters).toEqual([
    [
      {
        members: [INDICATOR_SLUG, CONCEPT_SLUG],
        class: 3,
        into: INDICATOR_SLUG,
        signal: 'indicator-form',
        evidence: expect.stringContaining('indicator'),
      },
    ],
  ]);

  // The composite exists at the `into` slug with the unioned member-tagged
  // evidence; the member pages do NOT exist as entity pages.
  const compositePath = wikiPath(workspace, 'entities', 'quality-indicators', `${INDICATOR_SLUG}.md`);
  expect(existsSync(compositePath)).toBe(true);
  expect(existsSync(wikiPath(workspace, 'entities', 'concepts', `${CONCEPT_SLUG}.md`))).toBe(false);
  const compositeRaw = readFileSync(compositePath, 'utf-8');
  const compositeParsed = matter(compositeRaw);
  expect(compositeParsed.data.type).toBe('composite');
  expect(compositeParsed.data.class).toBe(3);
  // Every member's evidence is present, member-tagged.
  expect(compositeRaw).toContain('### Indikator 1: Antibiotikabehandling');
  expect(compositeRaw).toContain('### Antibiotikabehandling');
  expect(compositeRaw).toContain('Indikator 1 måler antibiotikabehandling.');
  expect(compositeRaw).toContain('Antibiotikabehandling gives ved behandling af infektion.');
  expect(compositeRaw).toContain('Antibiotikabehandling was completed in 92% of cases');
  // The aliases union carries every member title (the names still find the page).
  expect(compositeParsed.data.aliases).toEqual(
    expect.arrayContaining(['Indikator 1: Antibiotikabehandling', 'Antibiotikabehandling']),
  );

  // Structured data carries the unioned, member-tagged evidence.
  expect(result.compositePages).toHaveLength(1);
  const composite = result.compositePages[0];
  expect(composite.members.map((member) => member.slug)).toEqual([INDICATOR_SLUG, CONCEPT_SLUG]);
  expect(composite.members.map((member) => member.role)).toEqual(['indicator', 'concept']);
  expect(composite.memberEvidence[0]?.mentions).toHaveLength(1);
  expect(composite.memberEvidence[1]?.mentions).toHaveLength(2);
  expect(composite.memberEvidence[1]?.claims).toHaveLength(1);
  // The non-into member's page is gone from the entity set.
  expect(result.entityPages.map((page) => page.slug)).toEqual(['acme-corp']);

  // The third entity's member-targeted reference was remapped to the composite.
  const acmeRaw = readFileSync(wikiPath(workspace, 'entities', 'companies', 'acme-corp.md'), 'utf-8');
  expect(acmeRaw).toContain(`[[${INDICATOR_SLUG}|`);
  expect(acmeRaw).not.toContain(`[[${CONCEPT_SLUG}`);

  // The pre-existing document page's member-targeted wikilinks were rewritten
  // (the bare form gains the member's title as display).
  const documentRaw = readFileSync(wikiPath(workspace, 'documents', 'golden-master-part-001.md'), 'utf-8');
  expect(documentRaw).toContain(`[[${INDICATOR_SLUG}|Antibiotikabehandling]]`);
  expect(documentRaw).not.toContain(`[[${CONCEPT_SLUG}]]`);
  expect(result.curation?.rewrittenLinks).toEqual([
    expect.objectContaining({ path: 'documents/golden-master-part-001.md' }),
  ]);

  // The decision is recorded with its class and signal (sticky from the next run).
  expect(readDecisions(workspace).decisions).toEqual([
    expect.objectContaining({
      concern: 'entities',
      action: 'cluster',
      from: [CONCEPT_SLUG],
      into: INDICATOR_SLUG,
      signal: 'indicator-form',
      class: 3,
      rationale: 'the indicator measures the concept',
    }),
  ]);
  const report = readReport(workspace);
  expect(report.entities.decidedThisRun?.clusters).toEqual([
    expect.objectContaining({ class: 3, into: INDICATOR_SLUG, signal: 'indicator-form' }),
  ]);

  // Every wikilink in the wiki resolves (composite = normal content page).
  const links = await checkLinks('test-wiki', workspace);
  expect(links.broken).toEqual([]);

  // The schema validator accepts the composite page.
  const schema = await validateSchema('test-wiki', workspace);
  expect(schema.invalid).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 22.3 — the deterministic shell.
// ---------------------------------------------------------------------------

test('gate 22.3: the shell renders the members block, per-member evidence groups, basename Sources, and complete frontmatter', () => {
  const rendered = writeCompositePage(compositeFixture());
  const parsed = matter(rendered);

  // Frontmatter complete.
  expect(parsed.data.type).toBe('composite');
  expect(parsed.data.class).toBe(3);
  expect(parsed.data.members).toHaveLength(2);
  expect(parsed.data.members[0]).toMatchObject({
    slug: INDICATOR_SLUG,
    title: 'Indikator 1: Antibiotikabehandling',
    type: 'quality-indicator',
    role: 'indicator',
    significance: 'The antibiotic-treatment indicator.',
  });
  expect(parsed.data.members[1]).toMatchObject({ slug: CONCEPT_SLUG, type: 'concept', role: 'concept' });
  expect(parsed.data.aliases).toEqual(
    expect.arrayContaining(['Indikator 1: Antibiotikabehandling', 'Antibiotikabehandling']),
  );
  expect(typeof parsed.data.updated).toBe('string');
  expect(Number.isNaN(Date.parse(parsed.data.updated))).toBe(false);
  expect(parsed.data.wiki).toBe('test-wiki');
  expect(parsed.data.sources).toEqual([{ file: 'wikis/test-wiki/raw/golden-master.pdf', pages: '1-3' }]);
  expect(parsed.data.tags).toEqual(['quality-indicator', 'concept']);
  // Sparse never applies.
  expect('sparse' in parsed.data).toBe(false);

  // The Members block: name, type, role, significance per member.
  expect(parsed.content).toContain('## Members');
  expect(parsed.content).toContain(
    `- **Indikator 1: Antibiotikabehandling** (\`${INDICATOR_SLUG}\`) — quality-indicator · indicator — The antibiotic-treatment indicator.`,
  );
  expect(parsed.content).toContain(
    `- **Antibiotikabehandling** (\`${CONCEPT_SLUG}\`) — concept · concept — The measured treatment concept.`,
  );

  // Per-member evidence groups.
  const mentionsSection = /## Mentions\n([\s\S]*?)\n## /.exec(`${parsed.content}\n## `)?.[1] ?? '';
  expect(mentionsSection).toContain('### Indikator 1: Antibiotikabehandling');
  expect(mentionsSection).toContain('### Antibiotikabehandling');
  expect(mentionsSection.indexOf('### Indikator 1: Antibiotikabehandling')).toBeLessThan(
    mentionsSection.indexOf('### Antibiotikabehandling'),
  );

  // The intra-cluster relationship renders ONCE, as the plain member title
  // (fellow members are not wikilink targets); the external incoming record
  // links outward.
  const relationshipsSection = /## Relationships\n([\s\S]*?)\n## /.exec(`${parsed.content}\n## `)?.[1] ?? '';
  expect(relationshipsSection).toContain('- Antibiotikabehandling — Measures [^src1]');
  expect(relationshipsSection).not.toContain(`[[${CONCEPT_SLUG}`);
  expect(relationshipsSection).toContain(
    '- [[acme-corp|Acme Corp]] — Audited (incoming) — "Acme Corp audited the antibiotic treatment" [^src1]',
  );
  expect((relationshipsSection.match(/Measures/g) ?? []).length).toBe(1);

  // Basename Sources definitions.
  expect(parsed.content).toContain('## Sources');
  expect(parsed.content).toContain('[^src1]: golden-master.pdf, pages 1-3');
});

// ---------------------------------------------------------------------------
// Gate 22.4 — synthesis values + the two prompts slot-additive against the
// Phase 18 baselines.
// ---------------------------------------------------------------------------

test('gate 22.4: synthesis values carry both members’ slots + relatedEntities + citationMap (filled prompt)', async () => {
  const spy = vi.spyOn(llmClient, 'callLLM').mockResolvedValue('# Composite article');
  try {
    await writeCompositeSynthesis(compositeFixture(), 'Test constitution.', undefined, { input: 'en', output: 'en' });
    expect(spy).toHaveBeenCalledTimes(1);
    const prompt = spy.mock.calls[0]?.[0] as string;

    // Both members' slots.
    expect(prompt).toContain(`- Indikator 1: Antibiotikabehandling (slug: ${INDICATOR_SLUG})`);
    expect(prompt).toContain('Role: indicator');
    expect(prompt).toContain(`- Antibiotikabehandling (slug: ${CONCEPT_SLUG})`);
    expect(prompt).toContain('Role: concept');
    expect(prompt).toContain('Significance: The antibiotic-treatment indicator.');
    // Both members' evidence.
    expect(prompt).toContain(`### Indikator 1: Antibiotikabehandling (${INDICATOR_SLUG})`);
    expect(prompt).toContain(`### Antibiotikabehandling (${CONCEPT_SLUG})`);
    expect(prompt).toContain('Indikator 1 måler antibiotikabehandling.');
    expect(prompt).toContain('Antibiotikabehandling gives ved behandling af infektion.');
    expect(prompt).toContain('Acme Corp audited the antibiotic treatment');
    // relatedEntities: the external link target only — fellow members excluded.
    expect(prompt).toContain('- acme-corp — Acme Corp');
    expect(prompt).not.toContain(`- ${CONCEPT_SLUG} —`);
    // citationMap: the deterministic union map.
    expect(prompt).toContain('=== CITATION KEYS ===');
    expect(prompt).toContain('[^src1]: golden-master.pdf, pages 1-3');
    // The Phase 7 LANGUAGE block is removed for en/en.
    expect(prompt).not.toContain('=== LANGUAGE ===');
    // The wiki constitution rides along.
    expect(prompt).toContain('=== WIKI CONSTITUTION ===');
    expect(prompt).toContain('Test constitution.');
  } finally {
    spy.mockRestore();
  }
});

test('gate 22.4: the two composite prompts are slot-additive against their Phase 18 baselines', () => {
  const promptDir = join(appRoot(), 'prompts');
  const strict = readFileSync(join(promptDir, 'composite.prompt.txt'), 'utf-8');
  const permissive = readFileSync(join(promptDir, 'composite-permissive.prompt.txt'), 'utf-8');
  const baseline = readFileSync(join(promptDir, 'synthesis.prompt.txt'), 'utf-8');
  const baselinePermissive = readFileSync(join(promptDir, 'synthesis-permissive.prompt.txt'), 'utf-8');

  for (const prompt of [strict, permissive]) {
    // Phase 7 slot.
    expect(prompt).toContain('=== LANGUAGE ===\n{languageDirective}');
    // Composite data slots.
    expect(prompt).toContain('=== COMPOSITE DATA ===');
    expect(prompt).toContain('{compositeTitle}');
    expect(prompt).toContain('{compositeClass}');
    expect(prompt).toContain('Members:\n{members}');
    expect(prompt).toContain('Evidence by member:\n{memberEvidence}');
    expect(prompt).toContain('Chunk Context:\n{context}');
    // Phase 17 slot + rule (byte-identical to the Phase 18 baselines).
    expect(prompt).toContain('Related Entities (the only legal wikilink targets — slug — title):\n{relatedEntities}');
    // Phase 18 slot + rule.
    expect(prompt).toContain('=== CITATION KEYS ===');
    expect(prompt).toContain('{citationMap}');
  }

  // The Phase 17 wikilink rule and Phase 18 citation-keys rule are byte-equal
  // to the entity baselines (slot-additive discipline).
  const wikilinkRule =
    'Use Obsidian-native wikilinks for related entities: [[<entity-slug>|<Page Title>]] — the target MUST come from the Related Entities list above (the entity\'s slug), the display text is its title (e.g. [[acme-corp|Acme Corp]]). When Layer 1 names an entity from that list, link it on first mention. Use the bare form [[name]] only when the display text is identical to the target.';
  const citationRule =
    'Every citation [^srcN] in the article MUST use exactly these keys for these sources — cite the key whose listed source and pages contain the fact. No other [^srcN] keys may appear anywhere in the output.';
  expect(baseline).toContain(wikilinkRule);
  expect(baseline).toContain(citationRule);
  expect(strict).toContain(wikilinkRule);
  expect(strict).toContain(citationRule);
  expect(permissive).toContain(wikilinkRule);
  expect(permissive).toContain(citationRule);
  // The composite variants keep the baselines' strict/permissive framing.
  expect(strict).toContain('The article must have two layers:');
  expect(baselinePermissive).toContain('**hybrid format**');
  expect(permissive).toContain('**hybrid format**');
});

// ---------------------------------------------------------------------------
// Gate 22.5 — preservation over the unioned evidence, per member.
// ---------------------------------------------------------------------------

test('gate 22.5: preservation fails when any member’s evidence is dropped; passes when complete', () => {
  const fixture = compositeFixture();
  const complete = writeCompositePage(fixture);
  const passed = checkCompositePreservation(fixture, complete);
  expect(passed.passed).toBe(true);
  expect(passed.droppedMentions).toEqual([]);
  expect(passed.droppedRelationships).toEqual([]);
  expect(passed.droppedClaims).toEqual([]);
  expect(passed.droppedCitations).toEqual([]);
  expect(passed.extraMarkers).toEqual([]);

  // Member A's mention dropped.
  const missingA = checkCompositePreservation(fixture, complete.replace('Indikator 1 måler antibiotikabehandling.', 'Indikator 1.'));
  expect(missingA.passed).toBe(false);
  expect(missingA.droppedMentions).toEqual(['Indikator 1 måler antibiotikabehandling.']);

  // Member B's claim dropped.
  const missingB = checkCompositePreservation(
    fixture,
    complete.replace('Antibiotikabehandling was completed in 92% of cases', 'The rate was high'),
  );
  expect(missingB.passed).toBe(false);
  expect(missingB.droppedClaims).toEqual(['Antibiotikabehandling was completed in 92% of cases']);

  // Member B's incoming evidence dropped.
  const missingIncoming = checkCompositePreservation(
    fixture,
    complete.replace('Acme Corp audited the antibiotic treatment', 'an audit'),
  );
  expect(missingIncoming.passed).toBe(false);
  expect(missingIncoming.droppedRelationships).toEqual(['Acme Corp audited the antibiotic treatment']);

  // An off-map marker is a content defect.
  const offMap = checkCompositePreservation(fixture, `${complete}\nExtra claim [^src9].\n`);
  expect(offMap.passed).toBe(false);
  expect(offMap.extraMarkers).toHaveLength(1);
  expect(offMap.extraMarkers[0]).toContain('[^src9]');
});

// ---------------------------------------------------------------------------
// Gate 22.6 — sticky re-application: a recorded cluster rebuilds the
// composite deterministically with ZERO member pages and no curation call.
// ---------------------------------------------------------------------------

test('gate 22.6: sticky re-application — run 2 rebuilds the composite deterministically with zero member pages and no curation call for the members', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', regionExtraction());

  // Run 1: the class-5 cluster is decided (confirmed deterministic proposal) and stuck.
  const run1 = await materialize('test-wiki', {
    workspace,
    curation: true,
    language: { input: 'da', output: 'da' },
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async () => ({
      decisions: {
        merges: [],
        drops: [],
        keep: [],
        clusters: [{ members: ['region-hovedstaden', 'hovedstaden'], class: 5, into: 'region-hovedstaden', rationale: 'org and its namesake region' }],
      },
      attempts: 1,
      fallbacks: [],
      vetoes: [],
    }),
  });
  expect(run1.compositePages).toHaveLength(1);
  expect(readDecisions(workspace).decisions).toEqual([
    expect.objectContaining({
      concern: 'entities',
      action: 'cluster',
      from: ['hovedstaden'],
      into: 'region-hovedstaden',
      class: 5,
      signal: 'region-form',
    }),
  ]);
  const compositePath = wikiPath(workspace, 'entities', 'organizations', 'regions', 'region-hovedstaden.md');
  expect(matter(readFileSync(compositePath, 'utf-8')).data.type).toBe('composite');
  expect(existsSync(wikiPath(workspace, 'entities', 'locations', 'hovedstaden.md'))).toBe(false);

  // Run 2: the SAME extraction re-aggregates both members, but the sticky
  // record rebuilds the composite before candidates — NO curation call at all.
  let entityCalls = 0;
  const run2 = await materialize('test-wiki', {
    workspace,
    curation: true,
    language: { input: 'da', output: 'da' },
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async () => {
      entityCalls += 1;
      return keepAllOutcome();
    },
  });

  expect(entityCalls).toBe(0);
  expect(run2.compositePages).toHaveLength(1);
  expect(run2.entityPages).toEqual([]);
  expect(run2.curation?.fromSticky.entityClusters).toEqual([
    expect.objectContaining({ class: 5, into: 'region-hovedstaden', signal: 'region-form' }),
  ]);
  expect(run2.curation?.entityClusters).toEqual([]);
  // ZERO member pages: the composite holds the into path; the location page
  // was never recreated.
  expect(matter(readFileSync(compositePath, 'utf-8')).data.type).toBe('composite');
  expect(existsSync(wikiPath(workspace, 'entities', 'locations', 'hovedstaden.md'))).toBe(false);
  // The composite still carries both members' evidence.
  const compositeRaw = readFileSync(compositePath, 'utf-8');
  expect(compositeRaw).toContain('Region Hovedstaden driver hospitalerne i regionen.');
  expect(compositeRaw).toContain('Hovedstaden er den mest folkerige region.');

  const report = readReport(workspace);
  expect(report.entities.fromSticky?.clusters).toEqual([
    expect.objectContaining({ class: 5, into: 'region-hovedstaden' }),
  ]);
  expect(report.entities.decidedThisRun?.clusters).toEqual([]);
  // Nothing new was recorded.
  expect(readDecisions(workspace).decisions).toHaveLength(1);
});

// ---------------------------------------------------------------------------
// Gate 22.7 — the split escape hatch dissolves the cluster.
// ---------------------------------------------------------------------------

test('gate 22.7: a slug in splits dissolves the cluster (member pages rebuilt, composite removed, reversal logged)', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', regionExtraction());

  // Run 1: the cluster is decided and stuck.
  await materialize('test-wiki', {
    workspace,
    curation: true,
    language: { input: 'da', output: 'da' },
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async () => ({
      decisions: {
        merges: [],
        drops: [],
        keep: [],
        clusters: [{ members: ['region-hovedstaden', 'hovedstaden'], class: 5, into: 'region-hovedstaden' }],
      },
      attempts: 1,
      fallbacks: [],
      vetoes: [],
    }),
  });
  const compositePath = wikiPath(workspace, 'entities', 'organizations', 'regions', 'region-hovedstaden.md');
  expect(matter(readFileSync(compositePath, 'utf-8')).data.type).toBe('composite');

  // The journalist hand-edits the split escape hatch.
  const decisionsPath = curationDecisionsPath(wikiDir);
  const recorded = JSON.parse(readFileSync(decisionsPath, 'utf-8')) as CurationDecisionsData;
  recorded.splits = ['hovedstaden'];
  writeFileSync(decisionsPath, JSON.stringify(recorded, null, 2) + '\n', 'utf-8');

  // Run 2: the cluster is un-applied — BOTH member pages rebuilt as entity
  // pages, the composite page REMOVED, the reversal logged. The members are
  // back in the curation input: detection re-proposes the region family as a
  // class-5 cluster (the members leave the OPEN list, judged only in
  // "clusters"); the keep-all stub confirms nothing, so no cluster applies.
  const seenCandidates: string[][] = [];
  const seenClusters: ProposedCluster[][] = [];
  const run2 = await materialize('test-wiki', {
    workspace,
    curation: true,
    language: { input: 'da', output: 'da' },
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async (candidates, options) => {
      seenCandidates.push(candidates.map((candidate) => candidate.slug));
      seenClusters.push([...(options.proposedClusters ?? [])]);
      return keepAllOutcome();
    },
  });

  expect(seenCandidates).toEqual([[]]);
  expect(seenClusters).toEqual([
    [
      expect.objectContaining({
        members: ['region-hovedstaden', 'hovedstaden'],
        class: 5,
        into: 'region-hovedstaden',
        signal: 'region-form',
      }),
    ],
  ]);
  expect(run2.compositePages).toEqual([]);
  expect(run2.curation?.splitReversals).toEqual([
    { concern: 'entities', from: ['hovedstaden'], into: 'region-hovedstaden', reason: 'split' },
  ]);
  expect(run2.curation?.fromSticky.entityClusters).toEqual([]);

  // Member pages rebuilt as ENTITY pages at their folders; the composite is gone.
  const intoRaw = readFileSync(compositePath, 'utf-8');
  expect(matter(intoRaw).data.type).toBe('entity');
  expect(matter(intoRaw).data.class).toBeUndefined();
  const memberPath = wikiPath(workspace, 'entities', 'locations', 'hovedstaden.md');
  expect(existsSync(memberPath)).toBe(true);
  expect(matter(readFileSync(memberPath, 'utf-8')).data.type).toBe('entity');
  expect(intoRaw).toContain('Region Hovedstaden driver hospitalerne i regionen.');

  const report = readReport(workspace);
  expect(report.splitReversals).toEqual([
    { concern: 'entities', from: ['hovedstaden'], into: 'region-hovedstaden', reason: 'split' },
  ]);
  // The split slug is NOT consumed — no new decision touched it.
  const afterRun2 = readDecisions(workspace);
  expect(afterRun2.splits).toEqual(['hovedstaden']);
  expect(afterRun2.decisions).toHaveLength(1);

  // The schema validator is clean on the rebuilt pages.
  const schema = await validateSchema('test-wiki', workspace);
  expect(schema.invalid).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 22.8 — the fingerprint: member-set changes flip it; unrelated pages
// never touch it (resume byte-stability for unaffected composites).
// ---------------------------------------------------------------------------

test('gate 22.8: the composite fingerprint ignores unrelated pages and flips on a member-set change', () => {
  const language = { input: 'en' as const, output: 'en' as const };
  const base = compositeFixture();
  const baseHash = pageDataHash(base, language);

  // An unrelated-page change (global slugToTitle context) does NOT flip it.
  const unrelated: CompositePageData = {
    ...base,
    slugToTitle: { ...base.slugToTitle, 'brand-new-entity': 'Brand New Entity' },
  };
  expect(pageDataHash(unrelated, language)).toBe(baseHash);

  // A member-set change flips it exactly once.
  const memberAdded: CompositePageData = {
    ...base,
    title: 'Indikator 1: Antibiotikabehandling — Antibiotikabehandling — Acme Corp',
    members: [
      ...base.members,
      { slug: 'acme-corp', title: 'Acme Corp', type: 'company', role: 'concept' },
    ],
    memberEvidence: [
      ...base.memberEvidence,
      { slug: 'acme-corp', mentions: [], relationships: [], incomingRelationships: [], claims: [], timeline: [], contexts: [] },
    ],
  };
  expect(pageDataHash(memberAdded, language)).not.toBe(baseHash);

  // A member's evidence change flips it too.
  const evidenceChanged: CompositePageData = {
    ...base,
    memberEvidence: [
      base.memberEvidence[0],
      {
        ...base.memberEvidence[1],
        mentions: [
          ...base.memberEvidence[1].mentions,
          { page: 4, context: 'A new mention.', source: 'wikis/test-wiki/raw/golden-master.pdf', pages: '1-3' },
        ],
      },
    ],
  };
  expect(pageDataHash(evidenceChanged, language)).not.toBe(baseHash);
});

test('gate 22.8 (materialize): an unrelated page change preserves the composite byte-for-byte (resume contract)', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', indicatorExtraction());

  const clusterStubs = {
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async () => ({
      decisions: {
        merges: [],
        drops: [],
        keep: ['acme-corp'],
        clusters: [{ members: [INDICATOR_SLUG, CONCEPT_SLUG], class: 3, into: INDICATOR_SLUG }],
      },
      attempts: 1,
      fallbacks: [],
      vetoes: [],
    }),
  };
  const run1 = await materialize('test-wiki', { workspace, curation: true, ...clusterStubs });
  expect(run1.compositePages).toHaveLength(1);
  const compositePath = wikiPath(workspace, 'entities', 'quality-indicators', `${INDICATOR_SLUG}.md`);
  const run1Bytes = readFileSync(compositePath, 'utf-8');

  // Seed a skip-eligible synthesis record for the composite (the page's
  // synthesis is "already paid for").
  const language = { input: 'en' as const, output: 'en' as const };
  writeFileSync(
    join(wikiDir, '.state', 'synthesis-state.json'),
    JSON.stringify(
      {
        pages: {
          [`entities/quality-indicators/${INDICATOR_SLUG}.md`]: {
            mode: 'strict-synthesis',
            dataHash: pageDataHash(run1.compositePages[0], language),
            synthesizedAt: new Date().toISOString(),
          },
        },
      },
      null,
      2,
    ) + '\n',
    'utf-8',
  );

  // Run 2: the UNRELATED entity gains a mention; the cluster's extraction is
  // unchanged. The composite is preserved byte-for-byte.
  const changedExtraction = indicatorExtraction();
  changedExtraction.entities[2].mentions.push({ page: 4, context: 'Acme Corp filed the follow-up.' });
  installChunk(wikiDir, 'golden-master-part-001', changedExtraction);
  const run2 = await materialize('test-wiki', { workspace, curation: true, ...KEEP_ALL_STUBS });

  expect(run2.preservedPages.map((page) => page.path)).toContain(`entities/quality-indicators/${INDICATOR_SLUG}.md`);
  expect(run2.writtenPages.map((page) => page.path)).not.toContain(`entities/quality-indicators/${INDICATOR_SLUG}.md`);
  expect(readFileSync(compositePath, 'utf-8')).toBe(run1Bytes);
  // The unrelated page WAS rewritten (its aggregate changed).
  expect(run2.writtenPages.map((page) => page.path)).toContain('entities/companies/acme-corp.md');
  // The member-set is unchanged — the composite still appears in the result data.
  expect(run2.compositePages).toHaveLength(1);
});

// ---------------------------------------------------------------------------
// Supplementary: schema validator, DOX catalog line, decisions-file round-trip.
// ---------------------------------------------------------------------------

test('supplementary: the schema validator requires members (2-4) + class for type composite', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  mkdirSync(wikiPath(workspace, 'entities', 'quality-indicators'), { recursive: true });
  const writeComposite = (frontmatter: Record<string, unknown>): void => {
    writeFileSync(
      wikiPath(workspace, 'entities', 'quality-indicators', 'indikator-1.md'),
      matter.stringify('\nBody.\n', frontmatter),
      'utf-8',
    );
  };

  // A valid composite passes.
  writeComposite({
    title: 'Indikator 1 — Antibiotikabehandling',
    type: 'composite',
    class: 3,
    members: [
      { slug: 'indikator-1', title: 'Indikator 1' },
      { slug: 'antibiotikabehandling', title: 'Antibiotikabehandling' },
    ],
    updated: new Date().toISOString(),
  });
  let schema = await validateSchema('test-wiki', workspace);
  expect(schema.invalid).toEqual([]);

  // Missing members.
  writeComposite({ title: 'X', type: 'composite', class: 3, updated: new Date().toISOString() });
  schema = await validateSchema('test-wiki', workspace);
  expect(schema.invalid.map((entry) => entry.issue).join('\n')).toContain('members');

  // A single member.
  writeComposite({
    title: 'X',
    type: 'composite',
    class: 3,
    members: [{ slug: 'indikator-1' }],
    updated: new Date().toISOString(),
  });
  schema = await validateSchema('test-wiki', workspace);
  expect(schema.invalid.map((entry) => entry.issue).join('\n')).toContain('2-4');

  // A bad class.
  writeComposite({
    title: 'X',
    type: 'composite',
    class: 9,
    members: [{ slug: 'indikator-1' }, { slug: 'antibiotikabehandling' }],
    updated: new Date().toISOString(),
  });
  schema = await validateSchema('test-wiki', workspace);
  expect(schema.invalid.map((entry) => entry.issue).join('\n')).toContain('class');

  // The composite is a KNOWN type (no "Unknown page type" flag anywhere).
  expect(schema.invalid.every((entry) => !entry.issue.startsWith('Unknown page type'))).toBe(true);
  expect(wikiDir.length).toBeGreaterThan(0);
});

test('supplementary: DOX folder indexes catalog composites with member names in the catalog line', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', indicatorExtraction());
  await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async () => ({
      decisions: {
        merges: [],
        drops: [],
        keep: ['acme-corp'],
        clusters: [{ members: [INDICATOR_SLUG, CONCEPT_SLUG], class: 3, into: INDICATOR_SLUG }],
      },
      attempts: 1,
      fallbacks: [],
      vetoes: [],
    }),
  });

  await writeDoxContracts('test-wiki', { workspace });
  const folderIndex = readFileSync(
    wikiPath(workspace, 'entities', 'quality-indicators', 'index.md'),
    'utf-8',
  );
  // The catalog line carries the composite's on-disk title (the writer house
  // style JSON-quotes YAML-sensitive titles, exactly like the entity writer).
  const compositeTitle = matter(
    readFileSync(wikiPath(workspace, 'entities', 'quality-indicators', `${INDICATOR_SLUG}.md`), 'utf-8'),
  ).data.title as string;
  expect(folderIndex).toContain(`[[${INDICATOR_SLUG}|${compositeTitle}]]`);
  // …and the member names explicitly (the composite suffix).
  expect(folderIndex).toContain('— composite of Indikator 1: Antibiotikabehandling, Antibiotikabehandling');
});

test('supplementary: cluster records round-trip through the decisions file (class + rationale; split consumption covers the into)', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  const record = {
    concern: 'entities' as const,
    action: 'cluster' as const,
    from: ['antibiotikabehandling'],
    into: 'indikator-1-antibiotikabehandling',
    signal: 'indicator-form',
    class: 3,
    rationale: 'the indicator measures the concept',
    decidedAt: '2026-07-29T10:00:00.000Z',
    runId: '2026-07-29T10:00:00.000Z',
  };
  await appendCurationDecisions(wikiDir, [record]);
  await appendCurationDecisions(wikiDir, [record]); // deduped by record key
  const read = await readCurationDecisions(wikiDir);
  expect(read.decisions).toHaveLength(1);
  expect(read.decisions[0]).toMatchObject({ action: 'cluster', class: 3, rationale: 'the indicator measures the concept' });

  // A new decision touching a split slug CONSUMES it — the `into` counts too.
  writeFileSync(
    curationDecisionsPath(wikiDir),
    JSON.stringify({ decisions: read.decisions, splits: ['indikator-1-antibiotikabehandling'] }, null, 2) + '\n',
    'utf-8',
  );
  await appendCurationDecisions(wikiDir, [record]);
  expect((await readCurationDecisions(wikiDir)).splits).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 22.10 — the ingest synthesis stage is wired for composites: composite
// pages flow through their own strict → permissive → structured-template
// chain (the Phase 12 reask loop, the Phase 15 pool, the Phase 16 checkpoint),
// with the composite write-point enforcers composed. A skip-eligible
// composite on run 2 makes zero LLM calls and stays byte-stable.
// ---------------------------------------------------------------------------

const GOLDEN_MASTER_PDF = 'test-pdfs/golden-master.pdf';

/** Init a wiki and copy the golden master into raw/ (the phase-15/16 harness). */
function setupWikiWithPdf(): string {
  const workspace = makeTempDir('paper-chase-g22-10-');
  const wikiDir = wikiPath(workspace);
  mkdirSync(join(wikiDir, 'raw'), { recursive: true });
  copyFileSync(GOLDEN_MASTER_PDF, join(wikiDir, 'raw', 'golden-master.pdf'));
  return workspace;
}

/** Injected Layer 2 stub: writes the extraction JSON exactly like the real path. */
function makeExtractChunkFnStub(extraction: ExtractorResult) {
  return async (wikiDir: string, chunkId: string): Promise<ChunkExtraction> => {
    const jsonPath = join(wikiDir, '.state', 'extracted', `${chunkId}.json`);
    mkdirSync(dirname(jsonPath), { recursive: true });
    writeFileSync(jsonPath, JSON.stringify(extraction, null, 2) + '\n', 'utf-8');
    return {
      chunkId,
      result: extraction,
      jsonPath,
      jsonRelativePath: `.state/extracted/${chunkId}.json`,
    };
  };
}

/** Preservation-passing synthesized entity page (the phase-15/16 harness shape). */
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

/**
 * Preservation-passing RICH composite article: one Layer 1 story weaving both
 * members, plus every member's evidence verbatim and the union citation keys.
 */
function passingCompositePage(data: CompositePageData): string {
  const lines = [
    `# ${data.title}`,
    '',
    `One rich article weaving ${data.members.map((member) => member.title).join(' and ')} into a single story [^src1].`,
    '',
    '## Mentions',
    '',
  ];
  for (const group of data.memberEvidence) {
    for (const mention of group.mentions) {
      lines.push(`- Page ${mention.page}: "${mention.context}" [^src1]`);
    }
  }
  lines.push('## Relationships', '');
  for (const group of data.memberEvidence) {
    for (const rel of group.relationships) {
      lines.push(`- ${rel.evidence} [^src1]`);
    }
    for (const rel of group.incomingRelationships) {
      lines.push(`- ${rel.evidence} [^src1]`);
    }
  }
  lines.push('## Claims', '');
  for (const group of data.memberEvidence) {
    for (const claim of group.claims) {
      lines.push(`- ${claim.text} [^src1]`);
    }
  }
  lines.push('', '[^src1]: golden-master.pdf, pages 1-3', '');
  return lines.join('\n');
}

/** A composite page that drops member B's claim (always fails preservation). */
function failingCompositePage(data: CompositePageData): string {
  const complete = passingCompositePage(data);
  const dropped = data.memberEvidence[1]?.claims[0]?.text ?? '';
  return complete.replace(`- ${dropped} [^src1]`, '- the rate was high [^src1]');
}

/** The shared gate-22.10 ingest options: the cluster curation stub + the entity/topic passers. */
function gate2210Options(
  compositeStubs: Pick<IngestOptions, 'synthesizeCompositeFn' | 'synthesizeCompositePermissiveFn'>,
) {
  return {
    poolStaggerMs: 0,
    extractChunkFn: makeExtractChunkFnStub(indicatorExtraction()),
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async () => ({
      decisions: {
        merges: [],
        drops: [],
        keep: ['acme-corp'],
        clusters: [{ members: [INDICATOR_SLUG, CONCEPT_SLUG], class: 3, into: INDICATOR_SLUG }],
      },
      attempts: 1,
      fallbacks: [],
      vetoes: [],
    }),
    synthesizeEntityFn: async (data: EntityPageData) => passingEntityPage(data),
    synthesizeEntityPermissiveFn: async (data: EntityPageData) => passingEntityPage(data),
    synthesizeTopicFn: async (data: TopicPageData) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data: TopicPageData) => passingTopicPage(data),
    ...compositeStubs,
  };
}

test('gate 22.10: strict composite synthesis replaces the shell with the rich article (enforcers composed, report finalMode strict-synthesis)', async () => {
  const workspace = setupWikiWithPdf();
  let compositeCalls = 0;
  const result = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    ...gate2210Options({
      synthesizeCompositeFn: async (data) => {
        compositeCalls += 1;
        return passingCompositePage(data);
      },
      synthesizeCompositePermissiveFn: async (data) => passingCompositePage(data),
    }),
  });

  expect(result.synthesisRan).toBe(true);
  expect(compositeCalls).toBe(1);
  expect(result.synthesizedComposites).toBe(1);
  expect(result.synthesizedCompositesPermissive ?? 0).toBe(0);
  expect(result.compositeConflicts ?? 0).toBe(0);

  // The shell is REPLACED by the rich article: the Layer 1 prose is present,
  // and the deterministic enforcers re-imposed the complete composite
  // frontmatter + basename Sources over the model's output.
  const compositeRaw = readFileSync(
    wikiPath(workspace, 'entities', 'quality-indicators', `${INDICATOR_SLUG}.md`),
    'utf-8',
  );
  expect(compositeRaw).toContain('One rich article weaving Indikator 1: Antibiotikabehandling and Antibiotikabehandling');
  const parsed = matter(compositeRaw);
  expect(parsed.data.type).toBe('composite');
  expect(parsed.data.class).toBe(3);
  expect(parsed.data.members).toHaveLength(2);
  expect(parsed.data.aliases).toEqual(
    expect.arrayContaining(['Indikator 1: Antibiotikabehandling', 'Antibiotikabehandling']),
  );
  expect(parsed.data.sources).toEqual([{ file: 'wikis/test-wiki/raw/golden-master.pdf', pages: '1-3' }]);
  expect('sparse' in parsed.data).toBe(false);
  expect(compositeRaw).toContain('## Sources');
  expect(compositeRaw).toContain('[^src1]: golden-master.pdf, pages 1-3');
  // Every member's evidence survived on the page (preservation).
  expect(compositeRaw).toContain('Indikator 1 måler antibiotikabehandling.');
  expect(compositeRaw).toContain('Antibiotikabehandling gives ved behandling af infektion.');
  expect(compositeRaw).toContain('Antibiotikabehandling was completed in 92% of cases');

  // The report records the composite stage in the existing vocabulary.
  const report = await readSynthesisReport(wikiPath(workspace));
  const compositeEntry = report.entries.find((entry) => entry.pageType === 'composite');
  expect(compositeEntry).toMatchObject({
    pageType: 'composite',
    slug: INDICATOR_SLUG,
    strict: { attempted: true, passed: true, attempts: 1 },
    finalMode: 'strict-synthesis',
  });
});

test('gate 22.10: strict preservation failure re-asks then falls to the permissive pass', async () => {
  const workspace = setupWikiWithPdf();
  const strictFeedbacks: Array<string | undefined> = [];
  let permissiveCalls = 0;
  const result = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    ...gate2210Options({
      synthesizeCompositeFn: async (data, _agentsMd, _logPath, _language, feedback) => {
        strictFeedbacks.push(feedback);
        return failingCompositePage(data);
      },
      synthesizeCompositePermissiveFn: async (data) => {
        permissiveCalls += 1;
        return passingCompositePage(data);
      },
    }),
  });

  // The strict mode exhausted its bounded reask (3 attempts, attempts 2+
  // carrying the exact dropped claim back), then the permissive mode passed.
  expect(strictFeedbacks).toHaveLength(3);
  expect(strictFeedbacks[0]).toBeUndefined();
  expect(strictFeedbacks[1]).toContain('=== CORRECTION REQUIRED ===');
  expect(strictFeedbacks[1]).toContain('Antibiotikabehandling was completed in 92% of cases');
  expect(permissiveCalls).toBe(1);
  expect(result.synthesizedCompositesPermissive).toBe(1);

  const compositeRaw = readFileSync(
    wikiPath(workspace, 'entities', 'quality-indicators', `${INDICATOR_SLUG}.md`),
    'utf-8',
  );
  expect(compositeRaw).toContain('One rich article weaving');
  const report = await readSynthesisReport(wikiPath(workspace));
  const compositeEntry = report.entries.find((entry) => entry.pageType === 'composite');
  expect(compositeEntry).toMatchObject({
    strict: { attempted: true, passed: false, attempts: 3 },
    permissive: { attempted: true, passed: true, attempts: 1 },
    finalMode: 'permissive-synthesis',
  });
});

test('gate 22.10: double failure keeps the deterministic shell (finalMode structured-template, conflict logged)', async () => {
  const workspace = setupWikiWithPdf();
  const result = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    ...gate2210Options({
      synthesizeCompositeFn: async (data) => failingCompositePage(data),
      synthesizeCompositePermissiveFn: async (data) => failingCompositePage(data),
    }),
  });

  expect(result.compositeConflicts).toBe(1);
  expect(result.synthesizedComposites ?? 0).toBe(0);
  expect(result.synthesizedCompositesPermissive ?? 0).toBe(0);

  // The deterministic SHELL is kept on disk (its ## Members signature).
  const compositeRaw = readFileSync(
    wikiPath(workspace, 'entities', 'quality-indicators', `${INDICATOR_SLUG}.md`),
    'utf-8',
  );
  expect(compositeRaw).toContain('## Members');
  expect(compositeRaw).toContain('- **Indikator 1: Antibiotikabehandling**');
  expect(compositeRaw).not.toContain('One rich article weaving');
  expect(matter(compositeRaw).data.type).toBe('composite');

  const report = await readSynthesisReport(wikiPath(workspace));
  const compositeEntry = report.entries.find((entry) => entry.pageType === 'composite');
  expect(compositeEntry).toMatchObject({
    strict: { attempted: true, passed: false, attempts: 3 },
    permissive: { attempted: true, passed: false, attempts: 3 },
    finalMode: 'structured-template',
  });
  const conflicts = await readConflicts(wikiPath(workspace));
  expect(
    conflicts.conflicts.some(
      (entry) => 'pageType' in entry && entry.pageType === 'composite' && entry.slug === INDICATOR_SLUG,
    ),
  ).toBe(true);
});

test('gate 22.10: run 2 with unchanged data makes ZERO composite LLM calls and keeps the page byte-identical (resume)', async () => {
  const workspace = setupWikiWithPdf();
  let compositeCalls = 0;
  const compositeStub = async (data: CompositePageData): Promise<string> => {
    compositeCalls += 1;
    return passingCompositePage(data);
  };
  await ingest('test-wiki', {
    workspace,
    synthesis: true,
    ...gate2210Options({
      synthesizeCompositeFn: compositeStub,
      synthesizeCompositePermissiveFn: compositeStub,
    }),
  });
  expect(compositeCalls).toBe(1);
  const compositePath = wikiPath(workspace, 'entities', 'quality-indicators', `${INDICATOR_SLUG}.md`);
  const run1Bytes = readFileSync(compositePath, 'utf-8');

  // Run 2: the PDF is hash-skipped, materialize re-runs, the sticky cluster
  // re-applies, and the skip-eligible record suppresses every LLM call.
  let entityCalls = 0;
  let topicCalls = 0;
  const run2 = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    ...gate2210Options({
      synthesizeCompositeFn: compositeStub,
      synthesizeCompositePermissiveFn: compositeStub,
    }),
    synthesizeEntityFn: async (data) => {
      entityCalls += 1;
      return passingEntityPage(data);
    },
    synthesizeTopicFn: async (data) => {
      topicCalls += 1;
      return passingTopicPage(data);
    },
  });

  expect(compositeCalls).toBe(1); // no run-2 composite call
  expect(entityCalls).toBe(0);
  expect(topicCalls).toBe(0);
  expect(run2.synthesisCompositesSkipped).toBe(1);
  expect(readFileSync(compositePath, 'utf-8')).toBe(run1Bytes);

  // The skipped composite contributes a reconstructed report entry.
  const report = await readSynthesisReport(wikiPath(workspace));
  const compositeEntries = report.entries.filter((entry) => entry.pageType === 'composite');
  expect(compositeEntries).toHaveLength(2);
  expect(compositeEntries[1]).toMatchObject({ finalMode: 'strict-synthesis' });
});
