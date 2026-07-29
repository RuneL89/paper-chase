import {
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
import { afterAll, expect, test } from 'vitest';
import matter from 'gray-matter';
import {
  curateEntities,
  curateTopics,
  validateEntityDecisions,
  type CurationOutcome,
  type EntityCurationCandidate,
  type TopicCurationCandidate,
} from '../src/agents/curation';
import {
  AUTO_APPLY_SIGNALS,
  detectPreMergePairs,
  type PreMergeCandidate,
  type ProposedPair,
} from '../src/agents/pre-merge';
import { materialize } from '../src/materializer';
import { init } from '../src/commands/init';
import {
  appendCurationDecisions,
  curationDecisionsPath,
  readCurationDecisions,
  type CurationDecisionsData,
} from '../src/state/curation-decisions';
import { curationOverridesPath } from '../src/state/curation-overrides';
import { curationReportPath, type CurationReport } from '../src/state/curation-report';
import type { ExtractorResult } from '../src/agents/extractor';

/**
 * Phase 21 gates 21.1–21.9 (curation overhaul — deterministic pre-merge,
 * confirm-deny, sticky decisions; phase doc §2.1–§2.3; canon: vision `04`
 * §3.2 Step 6, `05` §6/§7, `07` §2.3/§5; backlog B5). EVERY gate is LLM-free
 * ($0): the pre-merge engine is a pure deterministic function, the confirm-
 * deny path is exercised through the injected `callLLMFn` / `curateTopicsFn`
 * / `curateEntitiesFn` seams, and the fixtures are drawn from the REAL
 * 2026-07-28/29 merge lists (dist/wikis/rkkp-afdk + rkkp-akdb curation
 * reports — read-only reference).
 *
 * Gate 21.9 (full key-less suite: the Phase 18-20 baseline of 375 passed +
 * 14 skipped across 26 files plus these tests, zero unenumerated regressions;
 * `npx tsc --noEmit` clean) is encoded by this file being part of the suite —
 * the full-suite run itself is the Implementer's unified-verification leg
 * (recorded in `.state/phase-21-status.json`).
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
  const workspace = makeTempDir('paper-chase-g21-');
  init('test-wiki', { workspace });
  return workspace;
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/** A unit-level detection candidate (slug + title + optional aliases). */
function unitCandidate(slug: string, title?: string, aliases?: string[]): PreMergeCandidate {
  return {
    slug,
    title: title ?? titleCase(slug),
    ...(aliases !== undefined ? { aliases } : {}),
  };
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/** The pair endpoints as `from -> into` for compact assertions. */
function pairEnds(pairs: ProposedPair[]): string[] {
  return pairs.map((pair) => `${pair.from} -> ${pair.into}`);
}

/**
 * The Phase 21 person fixture (gates 21.3/21.4/21.7/21.8): the rkkp-akdb
 * pattern — `peter-olsen-svenningsen` vs `peter-svenningsen` (token
 * subsequence) plus an unrelated entity for open-discovery coverage.
 */
function peterExtraction(): ExtractorResult {
  return {
    entities: [
      {
        name: 'Peter Olsen Svenningsen',
        type: 'person',
        slug: 'peter-olsen-svenningsen',
        folder: 'entities/people',
        significance: 'The clinician (long form).',
        mentions: [
          { page: 1, context: 'Peter Olsen Svenningsen reviewed the cohort.' },
          { page: 2, context: 'Olsen Svenningsen co-authored the protocol.' },
        ],
      },
      {
        name: 'Peter Svenningsen',
        type: 'person',
        slug: 'peter-svenningsen',
        folder: 'entities/people',
        significance: 'The clinician (short form).',
        mentions: [{ page: 3, context: 'Peter Svenningsen signed the report.' }],
      },
      {
        name: 'Acme Corp',
        type: 'company',
        slug: 'acme-corp',
        folder: 'entities/companies',
        significance: 'The employer.',
        mentions: [{ page: 3, context: 'Acme Corp employed the clinicians.' }],
      },
    ],
    relationships: [
      {
        subject: 'peter-olsen-svenningsen',
        predicate: 'works-for',
        object: 'acme-corp',
        evidence: 'Peter Olsen Svenningsen works for Acme Corp',
        page: 1,
      },
    ],
    claims: [
      { text: 'Peter Svenningsen authored the protocol', type: 'authorship', entities: ['peter-svenningsen'], page: 3 },
    ],
    timeline: [],
    context: 'Phase 21 peter fixture.',
  };
}

/** The Phase 14 Odense fixture (gates 21.5/21.6 — the drop + fork patterns). */
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
        subject: 'acme-corp',
        predicate: 'audited',
        object: 'odense-2',
        evidence: 'Acme Corp audited Odense BUP in 2024',
        page: 3,
      },
    ],
    claims: [
      { text: 'Revenue was $42.5M in Q3 2024', type: 'financial', entities: ['acme-corp'], page: 2 },
      { text: 'Statistical methods were applied throughout', type: 'statistical', entities: ['acme-corp'], page: 3 },
      { text: 'The board approved the merger', type: 'governance', entities: ['odense-2'], page: 3 },
      { text: 'The audit opinion was unqualified', type: 'audits', entities: ['acme-corp', 'odense-2'], page: 3 },
    ],
    timeline: [],
    context: 'Odense clinic fixture for Phase 21.',
  };
}

/** The rkkp-afdk LPR fixture (gate 21.2 auto-apply, alias tier). */
function lprExtraction(): ExtractorResult {
  return {
    entities: [
      {
        name: 'LPR',
        type: 'organization',
        slug: 'lpr',
        folder: 'entities/organizations/registries',
        significance: 'The registry (abbreviated form).',
        mentions: [{ page: 1, context: 'LPR records every admission.' }],
      },
    ],
    relationships: [],
    claims: [],
    timeline: [],
    context: 'Phase 21 lpr fixture.',
  };
}

/** The rkkp-afdk Godstrup fixture (gate 21.2 auto-apply, transliteration tier). */
function godstrupExtraction(): ExtractorResult {
  return {
    entities: [
      {
        name: 'Regionshospitalet Godstrup',
        type: 'organization',
        slug: 'regionshospitalet-godstrup',
        folder: 'entities/organizations/hospitals',
        significance: 'The hospital (forked spelling).',
        mentions: [{ page: 1, context: 'Regionshospitalet Godstrup reported results.' }],
      },
      {
        name: 'Regionshospitalet Gødstrup',
        type: 'organization',
        slug: 'regionshospitalet-goedstrup',
        folder: 'entities/organizations/hospitals',
        significance: 'The hospital (canonical spelling).',
        mentions: [{ page: 2, context: 'Regionshospitalet Gødstrup opened in 2010.' }],
      },
    ],
    relationships: [],
    claims: [],
    timeline: [],
    context: 'Phase 21 godstrup fixture.',
  };
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

/**
 * Map of wiki-relative path -> content for every file under entities/,
 * topics/, and documents/, with `updated:` frontmatter lines stripped (the
 * phase-14 gate-14.4 byte-identity harness).
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
// Gate 21.1 — each signal family fires on its fixture pairs; ZERO false
// positives on colocated-but-distinct controls.
// ---------------------------------------------------------------------------

test('gate 21.1: transliteration fires on the Godstrup fork (da) and the typo leg catches it under en (propose tier)', () => {
  const candidates = [
    unitCandidate('regionshospitalet-godstrup', 'Regionshospitalet Godstrup'),
    unitCandidate('regionshospitalet-goedstrup', 'Regionshospitalet Gødstrup'),
  ];
  const da = detectPreMergePairs(candidates, { language: { input: 'da', output: 'da' } });
  expect(pairEnds(da.autoApply)).toEqual(['regionshospitalet-godstrup -> regionshospitalet-goedstrup']);
  expect(da.autoApply[0]?.signal).toBe('transliteration');
  expect(da.proposed).toEqual([]);

  // English has no transliteration digraphs — the AUTO tier stays silent;
  // the same fork is still caught, one tier down, by edit-distance.
  const en = detectPreMergePairs(candidates);
  expect(en.autoApply).toEqual([]);
  expect(pairEnds(en.proposed)).toEqual(['regionshospitalet-godstrup -> regionshospitalet-goedstrup']);
  expect(en.proposed[0]?.signal).toBe('edit-distance');
});

test('gate 21.1: edit-distance fires on the registry/typo pairs and rejects the modality control', () => {
  const detection = detectPreMergePairs([
    unitCandidate('landspatientregistret'),
    unitCandidate('landspatientregisteret'),
    unitCandidate('sundhedsvaesenet'),
    unitCandidate('sundhedsvaesenets'),
    // Colocated-but-distinct control: different imaging modalities.
    unitCandidate('ct-skanning'),
    unitCandidate('mr-skanning'),
  ]);
  expect(detection.autoApply).toEqual([]);
  expect(pairEnds(detection.proposed)).toEqual([
    'landspatientregistret -> landspatientregisteret',
    'sundhedsvaesenet -> sundhedsvaesenets',
  ]);
  for (const pair of detection.proposed) {
    expect(pair.signal).toBe('edit-distance');
  }
});

test('gate 21.1: alias match fires on lpr + the LPR-aliased registry page (auto tier)', () => {
  const detection = detectPreMergePairs([
    unitCandidate('lpr', 'LPR'),
    unitCandidate('landspatientregisteret', 'Landspatientregisteret', ['Landspatientregisteret', 'LPR']),
  ]);
  expect(detection.proposed).toEqual([]);
  expect(pairEnds(detection.autoApply)).toEqual(['lpr -> landspatientregisteret']);
  expect(detection.autoApply[0]?.signal).toBe('alias');
  expect(detection.autoApply[0]?.evidence).toContain("'LPR'");
});

test('gate 21.1: corpus-derived abbreviation pairs the ABBR slug with the full-name slug', () => {
  const corpus =
    'Data hentes fra Landspatientregisteret (LPR) hvert år. ' +
    'World Health Organization (WHO) anføres også, men den findes ikke som kandidat.';
  const detection = detectPreMergePairs(
    [unitCandidate('lpr', 'LPR'), unitCandidate('landspatientregisteret', 'Landspatientregisteret')],
    { language: { input: 'da', output: 'da' }, corpusText: corpus },
  );
  expect(detection.autoApply).toEqual([]);
  expect(pairEnds(detection.proposed)).toEqual(['lpr -> landspatientregisteret']);
  expect(detection.proposed[0]?.signal).toBe('abbreviation');
  expect(detection.proposed[0]?.evidence).toContain('Landspatientregisteret (LPR)');

  // Control: the abbreviation pattern without both candidates pairs nothing.
  const absent = detectPreMergePairs([unitCandidate('lpr', 'LPR')], { corpusText: corpus });
  expect(absent.proposed).toEqual([]);
  expect(absent.autoApply).toEqual([]);
});

test('gate 21.1: subsequence fires on peter-olsen-svenningsen and rejects org-unit/single-token controls', () => {
  const detection = detectPreMergePairs([
    unitCandidate('peter-olsen-svenningsen'),
    unitCandidate('peter-svenningsen'),
  ]);
  expect(detection.autoApply).toEqual([]);
  expect(pairEnds(detection.proposed)).toEqual(['peter-olsen-svenningsen -> peter-svenningsen']);
  expect(detection.proposed[0]?.signal).toBe('subsequence');
});

test('gate 21.1: initials fire on moeller-m-h / morten-moller and reject surname-only + lettered controls', () => {
  // The pair is Danish (møller → moeller/moller), so the da map canonicalizes
  // the shared surname token.
  const detection = detectPreMergePairs(
    [unitCandidate('moeller-m-h'), unitCandidate('morten-moller')],
    { language: { input: 'da', output: 'da' } },
  );
  expect(detection.autoApply).toEqual([]);
  expect(pairEnds(detection.proposed)).toEqual(['moeller-m-h -> morten-moller']);
  expect(detection.proposed[0]?.signal).toBe('initials');
});

test('gate 21.1: region name-forms fire for all 5 regions × 3 forms as CLASS-5 CLUSTER families; distinct regions never cluster', () => {
  // Phase 22 amendment (the five ratified rollup classes): region name-forms
  // no longer propose pairwise merges — each family proposes ONE class-5
  // composite cluster (same-name different-type, org↔location).
  const cores = ['hovedstaden', 'sjaelland', 'syddanmark', 'midtjylland', 'nordjylland'];
  const candidates = cores.flatMap((core) => [
    unitCandidate(core),
    unitCandidate(`${core}-region`),
    unitCandidate(`region-${core}`),
  ]);
  const detection = detectPreMergePairs(candidates, { language: { input: 'da', output: 'da' } });
  expect(detection.autoApply).toEqual([]);
  expect(detection.proposed).toEqual([]);
  // 1 cluster per core × 5 cores, all class 5 with 3 members, into = region-X.
  expect(detection.proposedClusters).toHaveLength(5);
  for (const cluster of detection.proposedClusters) {
    expect(cluster.class).toBe(5);
    expect(cluster.signal).toBe('region-form');
    expect(cluster.members).toHaveLength(3);
    expect(cluster.into).toBe(cluster.members[0]);
    expect(cluster.into.startsWith('region-')).toBe(true);
    // Every member shares the family's slug-stem.
    const stemOf = (slug: string): string => slug.replace(/^region-/, '').replace(/-region$/, '');
    expect(new Set(cluster.members.map(stemOf)).size).toBe(1);
  }
  expect(detection.proposedClusters.map((cluster) => cluster.into).sort()).toEqual(
    ['region-hovedstaden', 'region-midtjylland', 'region-nordjylland', 'region-sjaelland', 'region-syddanmark'].sort(),
  );
  // The hovedstaden family in rank order: region-X, X-region, bare X.
  const hovedstaden = detection.proposedClusters.find((cluster) => cluster.into === 'region-hovedstaden');
  expect(hovedstaden?.members).toEqual(['region-hovedstaden', 'hovedstaden-region', 'hovedstaden']);
});

test('gate 21.1: indicator number↔name fires as a CLASS-3 CLUSTER for the concept leg; the strict-identity leg stays a pair; distinct numbers never pair', () => {
  // Phase 22 amendment: the indicator number-name↔bare-concept leg proposes a
  // class-3 composite (indicator↔measured concept, 1:1); the bare-number ↔
  // same-named-form leg stays a strict-identity merge pair.
  const detection = detectPreMergePairs(
    [
      unitCandidate('indikator-2-ct-skanning', 'Indikator 2: CT-skanning'),
      unitCandidate('ct-skanning', 'CT-skanning'),
      unitCandidate('indikator-2', 'Indikator 2'),
      unitCandidate('indikator-3', 'Indikator 3'),
    ],
    { language: { input: 'da', output: 'da' } },
  );
  expect(detection.autoApply).toEqual([]);
  expect(detection.proposedClusters).toEqual([
    {
      members: ['indikator-2-ct-skanning', 'ct-skanning'],
      class: 3,
      into: 'indikator-2-ct-skanning',
      signal: 'indicator-form',
      evidence: expect.stringContaining('indicator'),
    },
  ]);
  expect(pairEnds(detection.proposed)).toEqual(['indikator-2-ct-skanning -> indikator-2']);
  expect(detection.proposed[0]?.signal).toBe('indicator-form');
});

test('gate 21.1: the domain glossary pairs translations (da survives under da output)', () => {
  const detection = detectPreMergePairs(
    [unitCandidate('echocardiography', 'Echocardiography'), unitCandidate('ekkokardiografi', 'Ekkokardiografi')],
    { language: { input: 'da', output: 'da' } },
  );
  expect(detection.autoApply).toEqual([]);
  expect(pairEnds(detection.proposed)).toEqual(['echocardiography -> ekkokardiografi']);
  expect(detection.proposed[0]?.signal).toBe('glossary');
});

test('gate 21.1: ZERO false positives on colocated-but-distinct controls', () => {
  const detection = detectPreMergePairs(
    [
      // Room vs clinic (sub-unit), city vs clinic, numbered forks, distinct
      // indicators, shared surname, lettered series, distinct modalities,
      // city vs same-named hospital.
      unitCandidate('odense-bup-auditorium'),
      unitCandidate('odense-bup'),
      unitCandidate('odense'),
      unitCandidate('odense-2'),
      unitCandidate('indikator-2'),
      unitCandidate('indikator-3'),
      unitCandidate('morten-moller'),
      unitCandidate('peter-moller'),
      unitCandidate('topic-a'),
      unitCandidate('topic-b'),
      unitCandidate('ct-skanning'),
      unitCandidate('mr-skanning'),
      unitCandidate('naestved'),
      unitCandidate('naestved-hospital'),
    ],
    { language: { input: 'da', output: 'da' } },
  );
  expect(detection.autoApply).toEqual([]);
  expect(detection.proposed).toEqual([]);
  expect(detection.vetoed).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 21.2 — the auto-apply tier is EXACTLY slug-identical-after-
// transliteration + alias-exact; everything else is proposed, never auto.
// ---------------------------------------------------------------------------

/** The mixed all-signal fixture (gates 21.2). */
function mixedCandidates(): PreMergeCandidate[] {
  return [
    unitCandidate('regionshospitalet-godstrup', 'Regionshospitalet Godstrup'),
    unitCandidate('regionshospitalet-goedstrup', 'Regionshospitalet Gødstrup'),
    unitCandidate('lpr', 'LPR'),
    unitCandidate('landspatientregisteret', 'Landspatientregisteret', ['LPR']),
    unitCandidate('landspatientregistret'),
    unitCandidate('sundhedsvaesenet'),
    unitCandidate('sundhedsvaesenets'),
    unitCandidate('peter-olsen-svenningsen'),
    unitCandidate('peter-svenningsen'),
    unitCandidate('moeller-m-h'),
    unitCandidate('morten-moller'),
    unitCandidate('indikator-2-ct-skanning'),
    unitCandidate('ct-skanning'),
    unitCandidate('echocardiography'),
    unitCandidate('ekkokardiografi'),
  ];
}

test('gate 21.2: auto-apply is exactly the transliteration + alias pairs; every other signal is propose-only', () => {
  const detection = detectPreMergePairs(mixedCandidates(), {
    language: { input: 'da', output: 'da' },
    corpusText: 'Data hentes fra Landspatientregisteret (LPR) hvert år.',
  });
  expect(pairEnds(detection.autoApply)).toEqual([
    'lpr -> landspatientregisteret',
    'regionshospitalet-godstrup -> regionshospitalet-goedstrup',
  ]);
  for (const pair of detection.autoApply) {
    expect(AUTO_APPLY_SIGNALS.has(pair.signal)).toBe(true);
  }
  expect(pairEnds(detection.proposed)).toEqual([
    'echocardiography -> ekkokardiografi',
    'landspatientregistret -> landspatientregisteret',
    'moeller-m-h -> morten-moller',
    'peter-olsen-svenningsen -> peter-svenningsen',
    'sundhedsvaesenet -> sundhedsvaesenets',
  ]);
  // Nothing outside the two near-zero-risk signals is ever auto-applied.
  for (const pair of detection.proposed) {
    expect(AUTO_APPLY_SIGNALS.has(pair.signal)).toBe(false);
  }
  // Phase 22 amendment: the indicator number↔concept leg proposes a class-3
  // composite cluster instead of a merge pair.
  expect(detection.proposedClusters).toEqual([
    {
      members: ['indikator-2-ct-skanning', 'ct-skanning'],
      class: 3,
      into: 'indikator-2-ct-skanning',
      signal: 'indicator-form',
      evidence: expect.stringContaining('indicator'),
    },
  ]);
  expect(detection.vetoed).toEqual([]);
});

test('gate 21.2: a neverMerge pair is never auto-applied (vetoed, not applied, not proposed)', () => {
  const detection = detectPreMergePairs(mixedCandidates(), {
    language: { input: 'da', output: 'da' },
    neverMerge: [
      ['lpr', 'landspatientregisteret'],
      ['regionshospitalet-godstrup', 'regionshospitalet-goedstrup'],
    ],
  });
  expect(detection.autoApply).toEqual([]);
  expect(pairEnds(detection.vetoed)).toEqual([
    'lpr -> landspatientregisteret',
    'regionshospitalet-godstrup -> regionshospitalet-goedstrup',
  ]);
  // The other signals still propose (neverMerge does not suppress proposals —
  // the deterministic validator vetoes a confirm instead, gate 21.8).
  expect(detection.proposed.length).toBeGreaterThan(0);
  expect(pairEnds(detection.proposed)).not.toContain('lpr -> landspatientregisteret');
});

test('gate 21.2 (materialize): the alias auto-apply merges lpr WITHOUT any LLM judgment', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', lprExtraction());
  // The canonical registry page exists on disk with the LPR frontmatter alias.
  mkdirSync(wikiPath(workspace, 'entities', 'organizations', 'registries'), { recursive: true });
  writeFileSync(
    wikiPath(workspace, 'entities', 'organizations', 'registries', 'landspatientregisteret.md'),
    matter.stringify('\n## Mentions\n\n- Page 1: "Landspatientregisteret tracks admissions." [^src1]\n', {
      title: 'Landspatientregisteret',
      type: 'entity',
      aliases: ['Landspatientregisteret', 'LPR'],
      wiki: 'test-wiki',
      updated: new Date().toISOString(),
    }),
    'utf-8',
  );

  const seenCandidates: string[][] = [];
  const seenPairs: ProposedPair[][] = [];
  const result = await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async (candidates, options) => {
      seenCandidates.push(candidates.map((candidate) => candidate.slug));
      seenPairs.push([...(options.proposedPairs ?? [])]);
      return keepAllOutcome();
    },
  });

  // The auto tier applied the merge: lpr never reached the model as a pair,
  // and its evidence is unioned onto the canonical page.
  expect(result.curation?.autoApplied).toEqual([
    {
      concern: 'entities',
      from: 'lpr',
      into: 'landspatientregisteret',
      signal: 'alias',
      evidence: expect.stringContaining("'LPR'"),
    },
  ]);
  expect(seenCandidates).toEqual([['landspatientregisteret']]);
  expect(seenPairs).toEqual([[]]);
  const page = readFileSync(
    wikiPath(workspace, 'entities', 'organizations', 'registries', 'landspatientregisteret.md'),
    'utf-8',
  );
  // The auto merge unioned lpr's evidence onto the canonical page (the page
  // is re-derived from the extraction set, the materialize update-mode rule).
  expect(page).toContain('LPR records every admission.');
  expect(existsSync(wikiPath(workspace, 'entities', 'organizations', 'registries', 'lpr.md'))).toBe(false);

  // The decision is recorded with its signal (sticky from the next run on).
  const decisions = readDecisions(workspace);
  expect(decisions.decisions).toEqual([
    expect.objectContaining({
      concern: 'entities',
      action: 'merge',
      from: ['lpr'],
      into: 'landspatientregisteret',
      signal: 'alias',
    }),
  ]);
  expect(decisions.decisions[0]?.runId).toBe(decisions.decisions[0]?.decidedAt);
  const report = readReport(workspace);
  expect(report.entities.autoApplied).toEqual([
    { from: 'lpr', into: 'landspatientregisteret', signal: 'alias', evidence: expect.stringContaining("'LPR'") },
  ]);
  expect(report.entities.decidedThisRun?.merges).toEqual([
    expect.objectContaining({ from: ['lpr'], into: 'landspatientregisteret', signal: 'alias' }),
  ]);
});

test('gate 21.2 (materialize): the transliteration auto-apply merges the Godstrup fork (da, no LLM judgment)', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', godstrupExtraction());

  const seenCandidates: string[][] = [];
  const result = await materialize('test-wiki', {
    workspace,
    curation: true,
    language: { input: 'da', output: 'da' },
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async (candidates) => {
      seenCandidates.push(candidates.map((candidate) => candidate.slug));
      return keepAllOutcome();
    },
  });

  expect(result.curation?.autoApplied).toEqual([
    {
      concern: 'entities',
      from: 'regionshospitalet-godstrup',
      into: 'regionshospitalet-goedstrup',
      signal: 'transliteration',
      evidence: expect.stringContaining('transliteration'),
    },
  ]);
  expect(seenCandidates).toEqual([['regionshospitalet-goedstrup']]);
  const into = result.entityPages.find((page) => page.slug === 'regionshospitalet-goedstrup');
  expect(into?.mentions.map((mention) => mention.context)).toEqual(
    expect.arrayContaining([
      'Regionshospitalet Godstrup reported results.',
      'Regionshospitalet Gødstrup opened in 2010.',
    ]),
  );
  expect(existsSync(wikiPath(workspace, 'entities', 'organizations', 'hospitals', 'regionshospitalet-godstrup.md'))).toBe(false);
  expect(readDecisions(workspace).decisions).toEqual([
    expect.objectContaining({ signal: 'transliteration', from: ['regionshospitalet-godstrup'], into: 'regionshospitalet-goedstrup' }),
  ]);
});

// ---------------------------------------------------------------------------
// Gate 21.3 — the confirm-deny path.
// ---------------------------------------------------------------------------

test('gate 21.3: the prompt carries the proposed pairs (signal + evidence); the block is stripped when empty', async () => {
  const pair: ProposedPair = {
    from: 'peter-olsen-svenningsen',
    into: 'peter-svenningsen',
    signal: 'subsequence',
    evidence: "tokens of 'peter-svenningsen' are a subsequence of 'peter-olsen-svenningsen'",
  };
  const openCandidate: EntityCurationCandidate = {
    slug: 'acme-corp',
    title: 'Acme Corp',
    type: 'company',
    folder: 'entities/companies',
    mentionCount: 1,
    significance: 'The employer.',
    sampleMentions: ['Acme Corp employed the clinicians.'],
    onDisk: false,
  };
  const prompts: string[] = [];
  const outcome = await curateEntities([openCandidate], {
    agentsMd: 'Test constitution.',
    proposedPairs: [pair],
    callLLMFn: async (prompt) => {
      prompts.push(prompt);
      return JSON.stringify({
        merge: [],
        unsure: [],
        pairs: [{ from: pair.from, into: pair.into, confirm: true, justification: 'same person' }],
      });
    },
  });

  expect(prompts).toHaveLength(1);
  expect(prompts[0]).toContain('=== PROPOSED PAIRS ===');
  expect(prompts[0]).toContain('"from": "peter-olsen-svenningsen"');
  expect(prompts[0]).toContain('"into": "peter-svenningsen"');
  expect(prompts[0]).toContain('"signal": "subsequence"');
  expect(prompts[0]).toContain('"evidence":');
  // The pair members are NOT in the open CANDIDATES block.
  const candidatesBlock = /=== CANDIDATES ===\n([\s\S]*?)\n=== END CANDIDATES ===/.exec(prompts[0])?.[1] ?? '';
  expect(candidatesBlock).toContain('acme-corp');
  expect(candidatesBlock).not.toContain('peter-olsen-svenningsen');
  expect(candidatesBlock).not.toContain('peter-svenningsen');

  // The stubbed confirm applies exactly like a model merge.
  expect(outcome.decisions?.merges).toEqual([{ from: ['peter-olsen-svenningsen'], into: 'peter-svenningsen' }]);
  expect(outcome.pairVerdicts).toEqual([
    { from: 'peter-olsen-svenningsen', into: 'peter-svenningsen', verdict: 'confirm', justification: 'same person' },
  ]);
  expect(outcome.fallbacks).toEqual([]);

  // With no proposed pairs the section is stripped byte-identically.
  const emptyPrompts: string[] = [];
  await curateEntities([openCandidate], {
    agentsMd: 'Test constitution.',
    callLLMFn: async (prompt) => {
      emptyPrompts.push(prompt);
      return JSON.stringify({ merge: [], unsure: [] });
    },
  });
  expect(emptyPrompts[0]).not.toContain('=== PROPOSED PAIRS ===');
});

test('gate 21.3: validation — confirm applies, deny keeps, unjudged denies, and pair rule violations reject', () => {
  const pairs: ProposedPair[] = [
    { from: 'alpha', into: 'beta', signal: 'subsequence', evidence: 'fixture' },
  ];
  const slugs = new Set(['alpha', 'beta', 'gamma']);

  const confirmed = validateEntityDecisions(
    JSON.stringify({ merge: [], unsure: [], pairs: [{ from: 'alpha', into: 'beta', confirm: true, justification: 'same person' }] }),
    slugs,
    [],
    pairs,
  );
  expect(confirmed.valid).toBe(true);
  expect(confirmed.decisions?.merges).toEqual([{ from: ['alpha'], into: 'beta' }]);
  expect(confirmed.decisions?.keep).toEqual(['beta', 'gamma']);
  expect(confirmed.pairVerdicts).toEqual([{ from: 'alpha', into: 'beta', verdict: 'confirm', justification: 'same person' }]);

  const denied = validateEntityDecisions(
    JSON.stringify({ merge: [], unsure: [], pairs: [{ from: 'alpha', into: 'beta', confirm: false, justification: 'different people' }] }),
    slugs,
    [],
    pairs,
  );
  expect(denied.valid).toBe(true);
  expect(denied.decisions?.merges).toEqual([]);
  expect(denied.decisions?.keep).toEqual(['alpha', 'beta', 'gamma']);
  expect(denied.pairVerdicts).toEqual([{ from: 'alpha', into: 'beta', verdict: 'deny', justification: 'different people' }]);

  const unjudged = validateEntityDecisions(JSON.stringify({ merge: [], unsure: [] }), slugs, [], pairs);
  expect(unjudged.valid).toBe(true);
  expect(unjudged.pairVerdicts).toEqual([{ from: 'alpha', into: 'beta', verdict: 'deny' }]);

  // An unproposed pair judgment is rejected.
  const unproposed = validateEntityDecisions(
    JSON.stringify({ merge: [], unsure: [], pairs: [{ from: 'alpha', into: 'gamma', confirm: true }] }),
    slugs,
    [],
    pairs,
  );
  expect(unproposed.valid).toBe(false);
  expect(unproposed.errors.join('\n')).toContain('was not proposed');

  // A proposed-pair slug in the merge bucket is rejected.
  const inBucket = validateEntityDecisions(
    JSON.stringify({ merge: [{ from: ['alpha'], into: 'gamma' }], unsure: [] }),
    slugs,
    [],
    pairs,
  );
  expect(inBucket.valid).toBe(false);
  expect(inBucket.errors.join('\n')).toContain('covered by a proposed pair');

  // A duplicated judgment is rejected.
  const duplicated = validateEntityDecisions(
    JSON.stringify({
      merge: [],
      unsure: [],
      pairs: [
        { from: 'alpha', into: 'beta', confirm: true },
        { from: 'alpha', into: 'beta', confirm: false },
      ],
    }),
    slugs,
    [],
    pairs,
  );
  expect(duplicated.valid).toBe(false);
  expect(duplicated.errors.join('\n')).toContain('judged twice');
});

test('gate 21.3 (materialize): a stubbed confirm applies IDENTICALLY to a model merge (unions, aliases, repoints, wikilinks)', async () => {
  const body =
    '\n## Extracted Text: Pages 1-3\n\n' +
    'See [[peter-olsen-svenningsen|Peter Olsen Svenningsen]] and [[peter-olsen-svenningsen]]. [^src1]\n\n' +
    '[^src1]: golden-master.pdf, pages 1-3\n';

  const seenPairs: ProposedPair[][] = [];
  const confirmStubs = {
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async (_candidates: EntityCurationCandidate[], options: { proposedPairs?: ProposedPair[] }) => {
      seenPairs.push([...(options.proposedPairs ?? [])]);
      return {
        decisions: {
          merges: [{ from: ['peter-olsen-svenningsen'], into: 'peter-svenningsen' }],
          drops: [],
          keep: ['acme-corp', 'peter-svenningsen'],
        },
        attempts: 1,
        fallbacks: [],
        vetoes: [],
        pairVerdicts: [
          { from: 'peter-olsen-svenningsen', into: 'peter-svenningsen', verdict: 'confirm' as const, justification: 'same person' },
        ],
      };
    },
  };

  const workspace = setupWiki();
  installChunk(wikiPath(workspace), 'golden-master-part-001', peterExtraction(), '1-3', body);
  const result = await materialize('test-wiki', { workspace, curation: true, ...confirmStubs });

  // Detection proposed the subsequence pair to the model.
  expect(seenPairs).toEqual([
    [
      expect.objectContaining({
        from: 'peter-olsen-svenningsen',
        into: 'peter-svenningsen',
        signal: 'subsequence',
      }),
    ],
  ]);
  expect(result.curation?.entityMerges).toEqual([{ from: ['peter-olsen-svenningsen'], into: 'peter-svenningsen' }]);

  // The merge applies exactly like a model merge: unions, aliases, repoints.
  const into = result.entityPages.find((page) => page.slug === 'peter-svenningsen');
  expect(into?.mentions).toHaveLength(3);
  expect(into?.mergedAliases).toContain('Peter Olsen Svenningsen');
  expect(into?.relationships[0]?.subject).toBe('peter-svenningsen');
  expect(into?.claims.map((claim) => claim.text)).toContain('Peter Svenningsen authored the protocol');
  expect(existsSync(wikiPath(workspace, 'entities', 'people', 'peter-olsen-svenningsen.md'))).toBe(false);

  // Wikilinks across the pre-existing document pages are rewritten.
  const documentRaw = readFileSync(wikiPath(workspace, 'documents', 'golden-master-part-001.md'), 'utf-8');
  expect(documentRaw).toContain('[[peter-svenningsen|Peter Olsen Svenningsen]]');
  expect(documentRaw).not.toContain('[[peter-olsen-svenningsen');

  // The decision is recorded with the pair's signal.
  expect(readDecisions(workspace).decisions).toEqual([
    expect.objectContaining({
      concern: 'entities',
      action: 'merge',
      from: ['peter-olsen-svenningsen'],
      into: 'peter-svenningsen',
      signal: 'subsequence',
    }),
  ]);
  const report = readReport(workspace);
  expect(report.entities.decidedThisRun?.merges).toEqual([
    expect.objectContaining({ signal: 'subsequence', evidence: expect.stringContaining('subsequence') }),
  ]);
  expect(report.entities.proposedPairs).toEqual([
    expect.objectContaining({ from: 'peter-olsen-svenningsen', into: 'peter-svenningsen', signal: 'subsequence' }),
  ]);

  // Control: the SAME merge returned as an open model decision produces a
  // byte-identical content tree (updated-stripped) — confirm ≡ model merge.
  const controlWorkspace = setupWiki();
  installChunk(wikiPath(controlWorkspace), 'golden-master-part-001', peterExtraction(), '1-3', body);
  await materialize('test-wiki', {
    workspace: controlWorkspace,
    curation: true,
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async () => ({
      decisions: {
        merges: [{ from: ['peter-olsen-svenningsen'], into: 'peter-svenningsen' }],
        drops: [],
        keep: ['acme-corp', 'peter-svenningsen'],
      },
      attempts: 1,
      fallbacks: [],
      vetoes: [],
    }),
  });
  const confirmTree = snapshotContentTree(wikiPath(workspace));
  const controlTree = snapshotContentTree(wikiPath(controlWorkspace));
  expect([...confirmTree.keys()].sort()).toEqual([...controlTree.keys()].sort());
  for (const [path, content] of confirmTree.entries()) {
    expect(controlTree.get(path), path).toBe(content);
  }
});

test('gate 21.3 (materialize): a stubbed deny leaves both pages and records the denial', async () => {
  const workspace = setupWiki();
  installChunk(wikiPath(workspace), 'golden-master-part-001', peterExtraction());
  const result = await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async () => ({
      decisions: { merges: [], drops: [], keep: ['acme-corp', 'peter-olsen-svenningsen', 'peter-svenningsen'] },
      attempts: 1,
      fallbacks: [],
      vetoes: [],
      pairVerdicts: [
        { from: 'peter-olsen-svenningsen', into: 'peter-svenningsen', verdict: 'deny' as const, justification: 'different people' },
      ],
    }),
  });

  expect(result.curation?.entityMerges).toEqual([]);
  expect(existsSync(wikiPath(workspace, 'entities', 'people', 'peter-olsen-svenningsen.md'))).toBe(true);
  expect(existsSync(wikiPath(workspace, 'entities', 'people', 'peter-svenningsen.md'))).toBe(true);
  expect(result.curation?.denials).toEqual([
    { concern: 'entities', from: 'peter-olsen-svenningsen', into: 'peter-svenningsen', justification: 'different people' },
  ]);
  const report = readReport(workspace);
  expect(report.entities.decidedThisRun?.denials).toEqual([
    { from: 'peter-olsen-svenningsen', into: 'peter-svenningsen', justification: 'different people' },
  ]);
  // A denial is NOT a decision — nothing is stuck.
  expect(readDecisions(workspace).decisions).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 21.4 — sticky pre-application: run 2's input has NO decided pairs.
// ---------------------------------------------------------------------------

test('gate 21.4: run 1 sticks the merge; run 2 pre-merges deterministically and the model sees only unstuck candidates', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', peterExtraction());

  // Run 1: the merge is decided (open model merge) and stuck.
  const run1 = await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async () => ({
      decisions: {
        merges: [{ from: ['peter-olsen-svenningsen'], into: 'peter-svenningsen' }],
        drops: [],
        keep: ['acme-corp', 'peter-svenningsen'],
      },
      attempts: 1,
      fallbacks: [],
      vetoes: [],
    }),
  });
  expect(run1.curation?.entityMerges).toHaveLength(1);
  expect(readDecisions(workspace).decisions).toHaveLength(1);

  // Run 2: the SAME extraction re-aggregates both forms, but the sticky
  // record pre-merges them before candidate construction.
  const seenCandidates: string[][] = [];
  const seenPairs: ProposedPair[][] = [];
  const run2 = await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async (candidates, options) => {
      seenCandidates.push(candidates.map((candidate) => candidate.slug));
      seenPairs.push([...(options.proposedPairs ?? [])]);
      return keepAllOutcome();
    },
  });

  // NO already-decided pair in the model's input: the merged-away slug is
  // gone from the candidates, and the pair is not re-proposed.
  expect(seenCandidates.map((slugs) => [...slugs].sort())).toEqual([['acme-corp', 'peter-svenningsen']]);
  expect(seenPairs).toEqual([[]]);
  expect(run2.curation?.fromSticky.entityMerges).toEqual([
    { from: ['peter-olsen-svenningsen'], into: 'peter-svenningsen' },
  ]);
  expect(run2.curation?.entityMerges).toEqual([]);

  // The survivor carries the unioned evidence again (re-aggregated, pre-merged).
  const into = run2.entityPages.find((page) => page.slug === 'peter-svenningsen');
  expect(into?.mentions).toHaveLength(3);
  expect(existsSync(wikiPath(workspace, 'entities', 'people', 'peter-olsen-svenningsen.md'))).toBe(false);

  // The report distinguishes fromSticky vs decidedThisRun.
  const report = readReport(workspace);
  expect(report.entities.fromSticky?.merges).toEqual([{ from: ['peter-olsen-svenningsen'], into: 'peter-svenningsen' }]);
  expect(report.entities.decidedThisRun?.merges).toEqual([]);
  expect(report.entities.merges).toEqual([]);

  // Nothing new was recorded (the keep-all run decides nothing).
  expect(readDecisions(workspace).decisions).toHaveLength(1);
});

// ---------------------------------------------------------------------------
// Gate 21.5 — sticky drops: a dropped topic never re-enters the candidates.
// ---------------------------------------------------------------------------

test('gate 21.5: a dropped topic never re-enters the candidate set; its claims stay on entity pages', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', odenseExtraction());

  // Run 1: the topic drop is decided and stuck.
  await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async () => ({
      decisions: { merges: [], drops: ['statistical'], keep: ['audits', 'financial', 'governance'] },
      attempts: 1,
      fallbacks: [],
      vetoes: [],
    }),
    curateEntitiesFn: async () => keepAllOutcome(),
  });
  expect(readDecisions(workspace).decisions).toEqual([
    expect.objectContaining({ concern: 'topics', action: 'drop', from: ['statistical'], signal: 'model' }),
  ]);
  expect(existsSync(wikiPath(workspace, 'topics', 'statistical', 'statistical.md'))).toBe(false);

  // Run 2: the extraction still produces the 'statistical' claim type, but
  // the sticky drop removes the topic BEFORE candidates are built.
  const seenTopicCandidates: string[][] = [];
  const run2 = await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async (candidates) => {
      seenTopicCandidates.push(candidates.map((candidate) => candidate.slug));
      return keepAllOutcome();
    },
    curateEntitiesFn: async () => keepAllOutcome(),
  });

  expect(seenTopicCandidates.map((slugs) => [...slugs].sort())).toEqual([['audits', 'financial', 'governance']]);
  expect(run2.curation?.fromSticky.topicDrops).toEqual(['statistical']);
  expect(run2.topicPages.map((page) => page.slug).sort()).toEqual(['audits', 'financial', 'governance']);
  expect(existsSync(wikiPath(workspace, 'topics', 'statistical', 'statistical.md'))).toBe(false);

  // Preservation contract: the dropped topic's claims stay on the entity page.
  const acmeRaw = readFileSync(wikiPath(workspace, 'entities', 'companies', 'acme-corp.md'), 'utf-8');
  expect(acmeRaw).toContain('Statistical methods were applied throughout');

  const report = readReport(workspace);
  expect(report.topics.fromSticky?.drops).toEqual(['statistical']);
  expect(report.topics.decidedThisRun?.drops).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 21.6 — oscillation impossible: a later pass that would NOT re-propose
// the pair CANNOT recreate the merged-away page.
// ---------------------------------------------------------------------------

test('gate 21.6: after a merge is stuck, a keep-all pass cannot recreate the merged-away page', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', odenseExtraction());

  // Run 1: the Odense fork merge is decided (open model merge) and stuck.
  await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async () => ({
      decisions: {
        merges: [{ from: ['odense', 'odense-2'], into: 'odense-bup' }],
        drops: [],
        keep: ['acme-corp', 'odense-bup'],
      },
      attempts: 1,
      fallbacks: [],
      vetoes: [],
    }),
  });
  expect(existsSync(wikiPath(workspace, 'entities', 'places', 'odense.md'))).toBe(false);
  expect(readDecisions(workspace).decisions).toHaveLength(2);

  // Run 2: a pass that would NOT re-propose the pair (keep-all, no detection
  // re-proposal either — the from-slugs are pre-merged before detection).
  const seenCandidates: string[][] = [];
  const run2 = await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async (candidates) => {
      seenCandidates.push(candidates.map((candidate) => candidate.slug));
      return keepAllOutcome();
    },
  });

  expect(seenCandidates.map((slugs) => [...slugs].sort())).toEqual([['acme-corp', 'odense-bup']]);
  // The merged-away pages CANNOT reappear (extraction re-aggregates, sticky pre-merges).
  expect(existsSync(wikiPath(workspace, 'entities', 'places', 'odense.md'))).toBe(false);
  expect(existsSync(wikiPath(workspace, 'entities', 'organizations', 'odense-2.md'))).toBe(false);
  const into = run2.entityPages.find((page) => page.slug === 'odense-bup');
  expect(into?.mentions).toHaveLength(4);
  // Relationship references stay repointed through the sticky pre-merge.
  const acme = run2.entityPages.find((page) => page.slug === 'acme-corp');
  expect(acme?.relationships[0]?.object).toBe('odense-bup');
  expect(run2.curation?.fromSticky.entityMerges).toEqual([{ from: ['odense', 'odense-2'], into: 'odense-bup' }]);
});

// ---------------------------------------------------------------------------
// Gate 21.7 — the split escape hatch.
// ---------------------------------------------------------------------------

test('gate 21.7: a slug in splits un-applies the recorded merge (both pages rebuilt, reversal logged, pair returns to candidates) and is consumed on re-decision', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', peterExtraction());

  // Run 1: the merge is decided and stuck.
  await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async () => ({
      decisions: {
        merges: [{ from: ['peter-olsen-svenningsen'], into: 'peter-svenningsen' }],
        drops: [],
        keep: ['acme-corp', 'peter-svenningsen'],
      },
      attempts: 1,
      fallbacks: [],
      vetoes: [],
    }),
  });
  expect(existsSync(wikiPath(workspace, 'entities', 'people', 'peter-olsen-svenningsen.md'))).toBe(false);

  // The journalist hand-edits the split escape hatch.
  const decisionsPath = curationDecisionsPath(wikiDir);
  const recorded = JSON.parse(readFileSync(decisionsPath, 'utf-8')) as CurationDecisionsData;
  recorded.splits = ['peter-olsen-svenningsen'];
  writeFileSync(decisionsPath, JSON.stringify(recorded, null, 2) + '\n', 'utf-8');

  // Run 2: the recorded merge is un-applied — both pages rebuilt, the
  // reversal logged, the pair back in the OPEN candidates (the split veto
  // holds the alias auto-tier — fed by the survivor's accumulated 'Peter
  // Olsen Svenningsen' alias — so it cannot instantly re-merge).
  const seenCandidates: string[][] = [];
  const seenPairs: ProposedPair[][] = [];
  const run2 = await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async (candidates, options) => {
      seenCandidates.push(candidates.map((candidate) => candidate.slug));
      seenPairs.push([...(options.proposedPairs ?? [])]);
      return keepAllOutcome();
    },
  });

  expect(seenCandidates.map((slugs) => [...slugs].sort())).toEqual([
    ['acme-corp', 'peter-olsen-svenningsen', 'peter-svenningsen'],
  ]);
  expect(seenPairs).toEqual([[]]);
  expect(existsSync(wikiPath(workspace, 'entities', 'people', 'peter-olsen-svenningsen.md'))).toBe(true);
  expect(existsSync(wikiPath(workspace, 'entities', 'people', 'peter-svenningsen.md'))).toBe(true);
  expect(run2.curation?.splitReversals).toEqual([
    { concern: 'entities', from: ['peter-olsen-svenningsen'], into: 'peter-svenningsen', reason: 'split' },
  ]);
  expect(run2.curation?.fromSticky.entityMerges).toEqual([]);
  // The split vetoed the alias auto-tier pair (recorded as a veto).
  expect(run2.curation?.vetoes).toEqual([
    { concern: 'entities', from: 'peter-olsen-svenningsen', into: 'peter-svenningsen' },
  ]);
  const report = readReport(workspace);
  expect(report.splitReversals).toEqual([
    { concern: 'entities', from: ['peter-olsen-svenningsen'], into: 'peter-svenningsen', reason: 'split' },
  ]);
  // The record stays on file (audit) and the split slug is NOT consumed —
  // the model re-decided nothing this run.
  const afterRun2 = readDecisions(workspace);
  expect(afterRun2.decisions).toHaveLength(1);
  expect(afterRun2.splits).toEqual(['peter-olsen-svenningsen']);

  // Run 3: the model re-merges the pair — the split slug is CONSUMED and the
  // re-decision sticks (a permanent veto belongs in curation-overrides.json).
  await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async () => ({
      decisions: {
        merges: [{ from: ['peter-olsen-svenningsen'], into: 'peter-svenningsen' }],
        drops: [],
        keep: ['acme-corp', 'peter-svenningsen'],
      },
      attempts: 1,
      fallbacks: [],
      vetoes: [],
    }),
  });
  const afterRun3 = readDecisions(workspace);
  expect(afterRun3.splits).toEqual([]);
  expect(afterRun3.decisions).toHaveLength(1);
  expect(existsSync(wikiPath(workspace, 'entities', 'people', 'peter-olsen-svenningsen.md'))).toBe(false);
});

// ---------------------------------------------------------------------------
// Gate 21.8 — neverMerge still wins over auto-apply, confirm, and sticky.
// ---------------------------------------------------------------------------

test('gate 21.8: neverMerge beats the auto-apply tier', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', godstrupExtraction());
  writeFileSync(
    curationOverridesPath(wikiDir),
    JSON.stringify({ neverMerge: [['regionshospitalet-godstrup', 'regionshospitalet-goedstrup']] }, null, 2) + '\n',
    'utf-8',
  );

  const result = await materialize('test-wiki', {
    workspace,
    curation: true,
    language: { input: 'da', output: 'da' },
    ...KEEP_ALL_STUBS,
  });

  expect(result.curation?.autoApplied).toEqual([]);
  expect(result.curation?.vetoes).toEqual([
    { concern: 'entities', from: 'regionshospitalet-godstrup', into: 'regionshospitalet-goedstrup' },
  ]);
  expect(existsSync(wikiPath(workspace, 'entities', 'organizations', 'hospitals', 'regionshospitalet-godstrup.md'))).toBe(true);
  expect(existsSync(wikiPath(workspace, 'entities', 'organizations', 'hospitals', 'regionshospitalet-goedstrup.md'))).toBe(true);
  expect(readDecisions(workspace).decisions).toEqual([]);
  const report = readReport(workspace);
  expect(report.entities.vetoes).toEqual([{ from: 'regionshospitalet-godstrup', into: 'regionshospitalet-goedstrup' }]);
});

test('gate 21.8: neverMerge beats a stubbed confirm (validation veto)', async () => {
  const pair: ProposedPair = {
    from: 'peter-olsen-svenningsen',
    into: 'peter-svenningsen',
    signal: 'subsequence',
    evidence: 'fixture',
  };
  const outcome = await curateEntities(
    [
      {
        slug: 'acme-corp',
        title: 'Acme Corp',
        type: 'company',
        folder: 'entities/companies',
        mentionCount: 1,
        significance: '',
        sampleMentions: ['Acme Corp employed the clinicians.'],
        onDisk: false,
      },
    ],
    {
      agentsMd: 'Test constitution.',
      proposedPairs: [pair],
      neverMerge: [['peter-olsen-svenningsen', 'peter-svenningsen']],
      callLLMFn: async () =>
        JSON.stringify({
          merge: [],
          unsure: [],
          pairs: [{ from: pair.from, into: pair.into, confirm: true, justification: 'same person' }],
        }),
    },
  );
  // The confirm is vetoed into keep — both slugs survive, the veto is recorded.
  expect(outcome.decisions?.merges).toEqual([]);
  expect(outcome.vetoes).toEqual([{ from: 'peter-olsen-svenningsen', into: 'peter-svenningsen' }]);
  expect(outcome.decisions?.keep).toEqual(['acme-corp', 'peter-olsen-svenningsen', 'peter-svenningsen']);
});

test('gate 21.8: neverMerge beats a sticky recorded merge (un-applied, reversal logged)', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', peterExtraction());

  // Run 1: the merge is decided and stuck.
  await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async () => ({
      decisions: {
        merges: [{ from: ['peter-olsen-svenningsen'], into: 'peter-svenningsen' }],
        drops: [],
        keep: ['acme-corp', 'peter-svenningsen'],
      },
      attempts: 1,
      fallbacks: [],
      vetoes: [],
    }),
  });
  expect(readDecisions(workspace).decisions).toHaveLength(1);

  // The journalist vetoes the pair.
  writeFileSync(
    curationOverridesPath(wikiDir),
    JSON.stringify({ neverMerge: [['peter-olsen-svenningsen', 'peter-svenningsen']] }, null, 2) + '\n',
    'utf-8',
  );

  // Run 2: neverMerge wins over the sticky record — un-applied, both pages
  // rebuilt, the reversal logged with its reason.
  const run2 = await materialize('test-wiki', { workspace, curation: true, ...KEEP_ALL_STUBS });
  expect(run2.curation?.fromSticky.entityMerges).toEqual([]);
  expect(run2.curation?.splitReversals).toEqual([
    { concern: 'entities', from: ['peter-olsen-svenningsen'], into: 'peter-svenningsen', reason: 'neverMerge' },
  ]);
  expect(existsSync(wikiPath(workspace, 'entities', 'people', 'peter-olsen-svenningsen.md'))).toBe(true);
  expect(existsSync(wikiPath(workspace, 'entities', 'people', 'peter-svenningsen.md'))).toBe(true);
});

// ---------------------------------------------------------------------------
// Supplementary: the decisions-file contract (read/create/malformed/append).
// ---------------------------------------------------------------------------

test('supplementary: the decisions file is created empty on first read; malformed content is backed up and rebuilt', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  const decisionsPath = curationDecisionsPath(wikiDir);

  expect(existsSync(decisionsPath)).toBe(false);
  const empty = await readCurationDecisions(wikiDir);
  expect(empty).toEqual({ decisions: [], splits: [] });
  expect(JSON.parse(readFileSync(decisionsPath, 'utf-8'))).toEqual({ decisions: [], splits: [] });

  // Append dedupes by record key and preserves hand-edited splits.
  const record = {
    concern: 'entities' as const,
    action: 'merge' as const,
    from: ['lpr'],
    into: 'landspatientregisteret',
    signal: 'alias',
    decidedAt: '2026-07-29T10:00:00.000Z',
    runId: '2026-07-29T10:00:00.000Z',
  };
  await appendCurationDecisions(wikiDir, [record]);
  await appendCurationDecisions(wikiDir, [record]);
  expect((await readCurationDecisions(wikiDir)).decisions).toHaveLength(1);

  // Malformed content: a console warning + empty read; the next append backs
  // the corrupt bytes up before rebuilding.
  writeFileSync(decisionsPath, '{ not json', 'utf-8');
  const malformed = await readCurationDecisions(wikiDir);
  expect(malformed).toEqual({ decisions: [], splits: [] });
  await appendCurationDecisions(wikiDir, [record]);
  expect(existsSync(join(wikiDir, '.state', 'curation-decisions.corrupt.json'))).toBe(true);
  expect((await readCurationDecisions(wikiDir)).decisions).toHaveLength(1);
});

// ---------------------------------------------------------------------------
// Supplementary: signal-aware grouping keeps proposed pairs co-located when
// bucketing (the two-round path's pairs ride the reconciliation call).
// ---------------------------------------------------------------------------

test('supplementary: bucketing never splits a proposed pair; pairs are judged in the reconciliation call', async () => {
  const candidates: TopicCurationCandidate[] = Array.from({ length: 260 }, (_, index) => ({
    slug: `topic-${String(index + 1).padStart(3, '0')}`,
    title: `Topic ${index + 1}`,
    folder: 'topics/test',
    claimCount: 1,
    sampleClaims: ['A claim.'],
    onDisk: false,
  }));
  const pair: ProposedPair = {
    from: 'topic-001',
    into: 'topic-002',
    signal: 'subsequence',
    evidence: 'fixture',
  };
  const contexts: string[] = [];
  const pairsByContext = new Map<string, string>();
  const outcome = await curateTopics(candidates, {
    agentsMd: 'Test constitution.',
    proposedPairs: [pair],
    callLLMFn: async (prompt, options) => {
      const context = options.context ?? '';
      contexts.push(context);
      pairsByContext.set(context, prompt.includes('=== PROPOSED PAIRS ===') ? 'pairs' : 'no-pairs');
      if (context.includes('reconciliation')) {
        return JSON.stringify({
          merge: [],
          drop: [],
          pairs: [{ from: pair.from, into: pair.into, confirm: true, justification: 'same theme' }],
        });
      }
      return JSON.stringify({ merge: [], drop: [] });
    },
  });

  // Round-1 buckets carry NO pairs section; the reconciliation judges them.
  const reconciliationContexts = contexts.filter((context) => context.includes('reconciliation'));
  expect(reconciliationContexts).toHaveLength(1);
  expect(pairsByContext.get(reconciliationContexts[0])).toBe('pairs');
  for (const context of contexts.filter((entry) => !entry.includes('reconciliation'))) {
    expect(pairsByContext.get(context)).toBe('no-pairs');
  }
  // The confirmed pair lands in the final decision list.
  expect(outcome.decisions?.merges).toEqual([{ from: ['topic-001'], into: 'topic-002' }]);
  expect(outcome.pairVerdicts).toEqual([
    { from: 'topic-001', into: 'topic-002', verdict: 'confirm', justification: 'same theme' },
  ]);
});
