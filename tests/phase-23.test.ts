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
  extractChunk,
  normalizeExtractorSlugs,
  type ExtractorResult,
  type ExtractorTable,
} from '../src/agents/extractor';
import { validateExtractorResult } from '../src/validation/extractor-schema';
import { materialize } from '../src/materializer';
import { init } from '../src/commands/init';
import { ingest, type IngestOptions } from '../src/commands/ingest';
import type { ChunkExtraction } from '../src/commands/extract-chunk';
import { readSynthesisReport } from '../src/state/synthesis-report';
import { readConflicts } from '../src/state/conflicts';
import { buildCitationMap, type EntityPageData } from '../src/pages/entity-page';
import type { TopicPageData } from '../src/pages/topic-page';
import {
  buildComparisonCitationMap,
  comparisonRowValues,
  enforceComparisonBridgeInMarkdown,
  writeComparisonPage,
  type ComparisonPageData,
} from '../src/pages/comparison-page';
import { checkComparisonPreservation } from '../src/validation/preservation-check';
import {
  buildComparisonRelatedEntities,
  writeComparisonSynthesis,
} from '../src/agents/synthesis';
import { validateWiki } from '../src/validation';
import { checkLinks } from '../src/validation/link-checker';
import { writeDoxContracts } from '../src/dox-writer';
import { writeSourcePage } from '../src/pages/source-page';
import * as llmClient from '../src/llm/client';
import { appRoot } from '../src/utils/app-root';
import type { CurationOutcome } from '../src/agents/curation';

/**
 * Phase 23 gates 23.1–23.7 + 23.6b (comparison-table articles, backlog B21;
 * phase doc §2.1–§2.4; canon: vision `05` §9, `03` §3.1 extended with
 * `comparisons/`, `02` §3, `06` §1-§3, `07` §2.1/§5). EVERY gate is LLM-free
 * ($0): the extractor schema, page assembly, shell, preservation, and bridge
 * are deterministic; synthesis runs through injected stubs and a `callLLM`
 * spy. Fixtures mirror the observed RKKP indicator-table shape (region rows
 * × performance/flag/CI/year columns — `dist/wikis/rkkp-afdk` evidence,
 * read-only), incl. the 2023→2024 indicator-renumbering DRIFT pattern.
 *
 * Gate 23.7 (full key-less suite: the Phase 22 baseline of 425 passed + 14
 * skipped across 28 files plus these tests, zero unenumerated regressions;
 * `npx tsc --noEmit` clean) is encoded by this file being part of the suite —
 * the full-suite run itself is the Implementer's unified-verification leg
 * (recorded in `.state/phase-23-status.json`).
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
  const workspace = makeTempDir('paper-chase-g23-');
  init('test-wiki', { workspace });
  return workspace;
}

/** Install one chunk's document page + extraction JSON (the phase-14/22 harness, source-parametrized). */
function installChunk(
  wikiDir: string,
  chunkId: string,
  extraction: ExtractorResult,
  pages: string,
  sourceFile: string,
  body?: string,
): void {
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

// ---------------------------------------------------------------------------
// Shared fixtures (the RKKP indicator-table shape: region rows × flag/count/
// percent/CI/year columns; the 2024 source drifts caption + columns — the
// corpus's observed indicator-renumbering pattern).
// ---------------------------------------------------------------------------

const SUBJECT_SLUG = 'indikator-2-ekkokardiografi';
const SUBJECT_TITLE = 'Indikator 2: Ekkokardiografi';
const DRIFT_TITLE = 'Indikator 2.1: Ekkokardiografi (three-year view)';

const TABLE_MD_2023 = [
  '| Area | Target met | Count | 2022/23 (%) | 95% CI | 2021/22 (%) |',
  '| --- | --- | --- | --- | --- | --- |',
  '| Danmark | Nej | 12.876 / 16.252 | 79,2 | 78,6-79,8 | 76,8 |',
  '| Hovedstaden | Nej | 3.062 / 4.316 | 70,9 | 69,6-72,3 | 67,8 |',
  '| Syddanmark | Ja | 3.107 / 3.782 | 82,2 | 80,9-83,4 | 77,3 |',
].join('\n');

const TABLE_MD_2024 = [
  '| Area | Target met | Count | 2023/24 (%) | 2022/23 (%) | 2021/22 (%) |',
  '| --- | --- | --- | --- | --- | --- |',
  '| Danmark | Ja | 13.100 / 16.400 | 80,1 | 79,2 | 76,8 |',
  '| Hovedstaden | Nej | 3.200 / 4.500 | 71,4 | 70,9 | 67,8 |',
  '| Syddanmark | Ja | 3.300 / 3.900 | 83,0 | 82,2 | 77,3 |',
].join('\n');

function baseEntities(): ExtractorResult['entities'] {
  return [
    {
      name: SUBJECT_TITLE,
      type: 'quality-measure',
      slug: SUBJECT_SLUG,
      folder: 'entities/quality-measures',
      significance: 'The echocardiography measure.',
      mentions: [{ page: 16, context: 'Indikator 2: Andel af patienter med ekkokardiografi' }],
    },
    {
      name: 'Danmark',
      type: 'location',
      slug: 'danmark',
      folder: 'entities/locations',
      significance: 'The national level.',
      mentions: [{ page: 16, context: 'Danmark Nej 12.876 / 16.252' }],
    },
    {
      name: 'Hovedstaden',
      type: 'location',
      slug: 'hovedstaden',
      folder: 'entities/locations',
      significance: 'A region below target.',
      mentions: [{ page: 16, context: 'Hovedstaden Nej 3.062 / 4.316' }],
    },
    {
      name: 'Syddanmark',
      type: 'location',
      slug: 'syddanmark',
      folder: 'entities/locations',
      significance: 'A region meeting the target.',
      mentions: [{ page: 16, context: 'Syddanmark Ja 3.107 / 3.782' }],
    },
  ];
}

function table2023(title = SUBJECT_TITLE): ExtractorTable {
  return {
    subject: SUBJECT_SLUG,
    title,
    page: 16,
    rowDimension: 'regions',
    colDimension: 'performance per year',
    entities: [SUBJECT_SLUG, 'danmark', 'hovedstaden', 'syddanmark'],
    markdown: TABLE_MD_2023,
    summary: 'Regions compared on echocardiography performance in 2022/23.',
  };
}

function table2024(title = SUBJECT_TITLE): ExtractorTable {
  return {
    subject: SUBJECT_SLUG,
    title,
    page: 15,
    rowDimension: 'regions',
    colDimension: 'performance across three years',
    entities: [SUBJECT_SLUG, 'danmark', 'hovedstaden', 'syddanmark'],
    markdown: TABLE_MD_2024,
    summary: 'Regions compared on echocardiography performance across three years.',
  };
}

/** The 2023 chunk (one table, one prose claim sharing table entities, one unrelated claim). */
function tableExtraction2023(duplicateTable = false): ExtractorResult {
  return {
    entities: baseEntities(),
    relationships: [],
    claims: [
      {
        text: 'Syddanmark opfyldte standarden med 82,2 % i 2022/23',
        type: 'performance',
        entities: ['syddanmark', SUBJECT_SLUG],
        page: 17,
      },
      { text: 'Noter steg i 2023 ifølge rapporten', type: 'governance', entities: [], page: 18 },
    ],
    timeline: [],
    tables: duplicateTable ? [table2023(), table2023()] : [table2023()],
    context: 'The 2023 annual report measures echocardiography performance.',
  };
}

/** The 2024 chunk (the DRIFT table: same subject, new caption + a third year column). */
function tableExtraction2024(title = SUBJECT_TITLE): ExtractorResult {
  return {
    entities: baseEntities(),
    relationships: [],
    claims: [
      {
        text: 'Hovedstaden missed the target again in 2023/24 with 71,4 %',
        type: 'performance',
        entities: ['hovedstaden'],
        page: 15,
      },
    ],
    timeline: [],
    tables: [table2024(title)],
    context: 'The 2024 annual report re-measures echocardiography performance.',
  };
}

/** A hand-built ComparisonPageData mirroring the materializer's assembly (gates 23.3–23.5). */
function comparisonFixture(): ComparisonPageData {
  return {
    title: SUBJECT_TITLE,
    slug: SUBJECT_SLUG,
    folder: 'comparisons',
    wiki: 'test-wiki',
    subject: SUBJECT_SLUG,
    tables: [
      {
        source: 'wikis/test-wiki/raw/report-2023.pdf',
        pages: '16-20',
        page: 16,
        tableTitle: SUBJECT_TITLE,
        rowDimension: 'regions',
        colDimension: 'performance per year',
        entities: [SUBJECT_SLUG, 'danmark', 'hovedstaden', 'syddanmark', 'odense'],
        markdown: TABLE_MD_2023,
        summary: 'Regions compared on echocardiography performance in 2022/23.',
      },
      {
        source: 'wikis/test-wiki/raw/report-2024.pdf',
        pages: '15-19',
        page: 15,
        tableTitle: DRIFT_TITLE,
        rowDimension: 'regions',
        colDimension: 'performance across three years',
        entities: [SUBJECT_SLUG, 'danmark'],
        markdown: TABLE_MD_2024,
        summary: 'Regions compared on echocardiography performance across three years.',
      },
    ],
    bridge: [
      {
        text: 'Syddanmark opfyldte standarden med 82,2 % i 2022/23',
        topicSlug: 'performance',
        entities: ['syddanmark', SUBJECT_SLUG],
        source: 'wikis/test-wiki/raw/report-2023.pdf',
        pages: '16-20',
      },
    ],
    slugToTitle: {
      [SUBJECT_SLUG]: SUBJECT_TITLE,
      danmark: 'Danmark',
      hovedstaden: 'Hovedstaden',
      syddanmark: 'Syddanmark',
    },
    aliases: [SUBJECT_TITLE, DRIFT_TITLE],
  };
}

// ---------------------------------------------------------------------------
// Gate 23.1 — the extractor schema accepts a well-formed `tables` array and
// rejects missing title/page/empty markdown; off-range pages rejected;
// unknown entity slugs warn but pass.
// ---------------------------------------------------------------------------

function validExtractionWithTables(): Record<string, unknown> {
  return {
    entities: [
      {
        name: 'Danmark',
        type: 'location',
        slug: 'danmark',
        folder: 'entities/locations',
        significance: 'The national level.',
        mentions: [{ page: 16, context: 'Danmark Nej 12.876' }],
      },
    ],
    relationships: [],
    claims: [],
    timeline: [],
    context: 'A chunk with a comparison table.',
    tables: [
      {
        subject: SUBJECT_SLUG,
        title: SUBJECT_TITLE,
        page: 16,
        rowDimension: 'regions',
        colDimension: 'performance per year',
        entities: ['danmark'],
        markdown: TABLE_MD_2023,
        summary: 'Regions compared.',
      },
    ],
  };
}

test('gate 23.1: a well-formed tables array validates clean (no issues, no warnings)', () => {
  const validation = validateExtractorResult(validExtractionWithTables(), '16-20');
  expect(validation.valid).toBe(true);
  expect(validation.issues).toEqual([]);
  expect(validation.warnings).toEqual([]);
});

test('gate 23.1: missing title, missing page, and empty markdown are rejected with exact issues', () => {
  const missingTitle = validExtractionWithTables();
  delete (missingTitle.tables as Record<string, unknown>[])[0].title;
  const titleValidation = validateExtractorResult(missingTitle, '16-20');
  expect(titleValidation.valid).toBe(false);
  expect(titleValidation.issues).toContain('tables[0]: title must be a non-empty string');

  const missingPage = validExtractionWithTables();
  delete (missingPage.tables as Record<string, unknown>[])[0].page;
  const pageValidation = validateExtractorResult(missingPage, '16-20');
  expect(pageValidation.valid).toBe(false);
  expect(pageValidation.issues.some((issue) => issue.startsWith('tables[0]: page must be a number'))).toBe(true);

  const emptyMarkdown = validExtractionWithTables();
  (emptyMarkdown.tables as Record<string, unknown>[])[0].markdown = '   ';
  const markdownValidation = validateExtractorResult(emptyMarkdown, '16-20');
  expect(markdownValidation.valid).toBe(false);
  expect(markdownValidation.issues).toContain('tables[0]: markdown must be a non-empty string');
});

test('gate 23.1: off-range table pages are rejected', () => {
  const offRange = validExtractionWithTables();
  (offRange.tables as Record<string, unknown>[])[0].page = 21;
  const validation = validateExtractorResult(offRange, '16-20');
  expect(validation.valid).toBe(false);
  expect(validation.issues).toContain('tables[0]: page 21 is outside the chunk page range 16-20');
});

test('gate 23.1: unknown entity slugs in a table warn but pass', () => {
  const unknown = validExtractionWithTables();
  (unknown.tables as Record<string, unknown>[])[0].entities = ['danmark', 'odense'];
  const validation = validateExtractorResult(unknown, '16-20');
  expect(validation.valid).toBe(true);
  expect(validation.issues).toEqual([]);
  expect(validation.warnings).toHaveLength(1);
  expect(validation.warnings[0]).toContain('odense');
  expect(validation.warnings[0]).toContain('tables[0].entities[1]');
});

test('gate 23.1: an absent tables array stays valid (pre-Phase-23 JSON); a non-array tables field is rejected', () => {
  const absent = validExtractionWithTables();
  delete absent.tables;
  expect(validateExtractorResult(absent, '16-20').valid).toBe(true);

  const nonArray = validExtractionWithTables();
  nonArray.tables = 'nope';
  const validation = validateExtractorResult(nonArray, '16-20');
  expect(validation.valid).toBe(false);
  expect(validation.issues).toContain('tables: must be an array');
});

test('gate 23.1: slug normalization covers the table subject and its entity references (input-language transliteration)', () => {
  const data = { tables: [{ subject: 'Søren Møller', entities: ['København', 'Århus'] }] };
  normalizeExtractorSlugs(data, 'da');
  expect(data.tables[0].subject).toBe('soeren-moeller');
  expect(data.tables[0].entities).toEqual(['koebenhavn', 'aarhus']);

  // Omitted language keeps the byte-identical pre-Phase-7 behavior.
  const englishData = { tables: [{ subject: 'Søren Møller', entities: ['København'] }] };
  normalizeExtractorSlugs(englishData);
  expect(englishData.tables[0].subject).toBe('s-ren-m-ller');
});

test('gate 23.1: the extractor agent fills a model-omitted tables array with [] (pass-through, LLM-free)', async () => {
  const spy = vi.spyOn(llmClient, 'callLLM').mockResolvedValue(
    JSON.stringify({ entities: [], relationships: [], claims: [], timeline: [], context: 'nothing here' }),
  );
  try {
    const result = await extractChunk('some chunk text', '1-3', 'wikis/test-wiki/raw/report-2023.pdf', '', [], []);
    expect(result.tables).toEqual([]);
  } finally {
    spy.mockRestore();
  }
});

// ---------------------------------------------------------------------------
// Gate 23.2 — assembly: one page per subject entity. (a) the same table title
// from two sources accumulates as two dated sections on ONE page; (b) the
// DRIFT fixture (same subject, different title + columns) still lands on ONE
// page via the canonical subject slug; no page for an empty tables array.
// ---------------------------------------------------------------------------

test('gate 23.2: the same table title from two sources accumulates as two dated sections on ONE page', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  // The duplicate table inside the 2023 chunk dedupes away.
  installChunk(wikiDir, 'report-2023-part-001', tableExtraction2023(true), '16-20', 'wikis/test-wiki/raw/report-2023.pdf');
  installChunk(wikiDir, 'report-2024-part-001', tableExtraction2024(), '15-19', 'wikis/test-wiki/raw/report-2024.pdf');

  const result = await materialize('test-wiki', { workspace });

  expect(result.comparisonPages).toHaveLength(1);
  const page = result.comparisonPages[0];
  expect(page.slug).toBe(SUBJECT_SLUG);
  expect(page.folder).toBe('comparisons');
  expect(page.title).toBe(SUBJECT_TITLE);
  expect(page.tables.map((table) => `${table.source}#${table.page}`)).toEqual([
    'wikis/test-wiki/raw/report-2023.pdf#16',
    'wikis/test-wiki/raw/report-2024.pdf#15',
  ]);
  const raw = readFileSync(wikiPath(workspace, 'comparisons', `${SUBJECT_SLUG}.md`), 'utf-8');
  expect(raw).toContain('## Table: report-2023.pdf, p. 16');
  expect(raw).toContain('## Table: report-2024.pdf, p. 15');
});

test('gate 23.2: DRIFT — same subject, different title and different columns across sources still lands on ONE page via the canonical subject slug', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'report-2023-part-001', tableExtraction2023(), '16-20', 'wikis/test-wiki/raw/report-2023.pdf');
  installChunk(wikiDir, 'report-2024-part-001', tableExtraction2024(DRIFT_TITLE), '15-19', 'wikis/test-wiki/raw/report-2024.pdf');

  const result = await materialize('test-wiki', { workspace });

  // ONE page, keyed on the canonical subject slug — never on the drifting title.
  expect(result.comparisonPages).toHaveLength(1);
  const page = result.comparisonPages[0];
  expect(page.slug).toBe(SUBJECT_SLUG);
  expect(page.tables.map((table) => table.tableTitle)).toEqual([SUBJECT_TITLE, DRIFT_TITLE]);

  const raw = readFileSync(wikiPath(workspace, 'comparisons', `${SUBJECT_SLUG}.md`), 'utf-8');
  // Cross-PDF structural drift is EMBRACED, never force-merged: each source's
  // columns survive verbatim in its own dated section.
  expect(raw).toContain('| 2022/23 (%) | 95% CI | 2021/22 (%) |');
  expect(raw).toContain('| 2023/24 (%) | 2022/23 (%) | 2021/22 (%) |');
  // The drift captions union into the aliases so both titles find the page.
  const parsed = matter(raw);
  expect(parsed.data.aliases).toEqual(expect.arrayContaining([SUBJECT_TITLE, DRIFT_TITLE]));
});

test('gate 23.2: a renamed subject reconciles onto ONE page through the canonical entity identity (curation remap)', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'report-2023-part-001', tableExtraction2023(), '16-20', 'wikis/test-wiki/raw/report-2023.pdf');
  // The 2024 extraction names the subject by its OLD slug (the renumbering pattern).
  const renamed: ExtractorResult = {
    ...tableExtraction2024(DRIFT_TITLE),
    entities: [
      {
        name: 'Indikator 2',
        type: 'quality-measure',
        slug: 'indikator-2',
        folder: 'entities/quality-measures',
        significance: 'The renumbered measure.',
        mentions: [{ page: 15, context: 'Indikator 2 (renumbered)' }],
      },
      ...baseEntities().slice(1),
    ],
    tables: [{ ...table2024(DRIFT_TITLE), subject: 'indikator-2' }],
  };
  installChunk(wikiDir, 'report-2024-part-001', renamed, '15-19', 'wikis/test-wiki/raw/report-2024.pdf');

  const result = await materialize('test-wiki', {
    workspace,
    curation: true,
    curateTopicsFn: KEEP_ALL_STUBS.curateTopicsFn,
    curateEntitiesFn: async () => ({
      decisions: { merges: [{ from: ['indikator-2'], into: SUBJECT_SLUG }], drops: [], keep: [] },
      attempts: 1,
      fallbacks: [],
      vetoes: [],
    }),
  });

  // The old subject slug reconciles through the merge onto the canonical page.
  expect(result.comparisonPages).toHaveLength(1);
  expect(result.comparisonPages[0].slug).toBe(SUBJECT_SLUG);
  expect(result.comparisonPages[0].tables).toHaveLength(2);
});

test('gate 23.2: an unresolvable subject falls back to the normalized-title slug', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  const fallback: ExtractorResult = {
    entities: baseEntities().slice(1),
    relationships: [],
    claims: [],
    timeline: [],
    tables: [
      {
        subject: 'ukendt-målestok',
        title: 'Cost Per Region 2023',
        page: 16,
        rowDimension: 'regions',
        colDimension: 'cost per year',
        entities: ['danmark'],
        markdown: '| Region | 2023 |\n| --- | --- |\n| Danmark | 42,5 |',
        summary: 'Cost compared per region.',
      },
    ],
    context: 'A cost table with an unextracted subject.',
  };
  installChunk(wikiDir, 'report-2023-part-001', fallback, '16-20', 'wikis/test-wiki/raw/report-2023.pdf');

  const result = await materialize('test-wiki', { workspace });

  expect(result.comparisonPages).toHaveLength(1);
  const page = result.comparisonPages[0];
  expect(page.slug).toBe('cost-per-region-2023');
  expect(page.title).toBe('Cost Per Region 2023');
  expect(existsSync(wikiPath(workspace, 'comparisons', 'cost-per-region-2023.md'))).toBe(true);
});

test('gate 23.2: no page is created for a chunk with an empty (or absent) tables array', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  const emptyTables: ExtractorResult = {
    entities: baseEntities(),
    relationships: [],
    claims: [],
    timeline: [],
    tables: [],
    context: 'No tables here.',
  };
  installChunk(wikiDir, 'report-2023-part-001', emptyTables, '16-20', 'wikis/test-wiki/raw/report-2023.pdf');
  // Pre-Phase-23 shape: the tables field is absent entirely.
  const absentTables = { ...emptyTables } as Record<string, unknown>;
  delete absentTables.tables;
  installChunk(wikiDir, 'report-2024-part-001', absentTables as unknown as ExtractorResult, '15-19', 'wikis/test-wiki/raw/report-2024.pdf');

  const result = await materialize('test-wiki', { workspace });

  expect(result.comparisonPages).toEqual([]);
  expect(existsSync(wikiPath(workspace, 'comparisons'))).toBe(false);
});

// ---------------------------------------------------------------------------
// Gate 23.3 — the deterministic shell preserves the table markdown
// byte-for-byte inside its section; frontmatter complete; `## Sources`
// basename-form and citation-map consistent.
// ---------------------------------------------------------------------------

test('gate 23.3: the shell preserves each table verbatim and carries complete frontmatter + consistent Sources', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-29T12:00:00.000Z'));
  try {
    const data = comparisonFixture();
    const raw = writeComparisonPage(data);
    const parsed = matter(raw);

    // The table markdown is preserved byte-for-byte inside its dated section.
    expect(raw).toContain(TABLE_MD_2023);
    expect(raw).toContain(TABLE_MD_2024);
    const firstSection = raw.indexOf('## Table: report-2023.pdf, p. 16');
    const secondSection = raw.indexOf('## Table: report-2024.pdf, p. 15');
    expect(firstSection).toBeGreaterThanOrEqual(0);
    expect(secondSection).toBeGreaterThan(firstSection);
    expect(raw.slice(firstSection, secondSection)).toContain(TABLE_MD_2023);

    // Complete frontmatter: type, title, real updated, aggregated sources, aliases.
    expect(parsed.data.type).toBe('comparison');
    // The writer house style JSON-quotes YAML-sensitive titles (the entity/
    // composite precedent) — the on-disk title carries the subject title.
    expect(String(parsed.data.title)).toContain(SUBJECT_TITLE);
    const updated = parsed.data.updated;
    const updatedIso = updated instanceof Date ? updated.toISOString() : String(updated);
    expect(updatedIso).toBe('2026-07-29T12:00:00.000Z');
    expect(parsed.data.sources).toEqual([
      { file: 'wikis/test-wiki/raw/report-2023.pdf', pages: '16, 16-20' },
      { file: 'wikis/test-wiki/raw/report-2024.pdf', pages: '15' },
    ]);
    expect(parsed.data.aliases).toEqual(expect.arrayContaining([SUBJECT_TITLE, DRIFT_TITLE]));
    expect('sparse' in parsed.data).toBe(false);

    // Per-table entity links: known slugs pipe-form, the page's own subject
    // plain (never a self-link), unknown slugs plain (never a broken link).
    expect(raw).toContain('[[danmark|Danmark]]');
    expect(raw).not.toContain(`[[${SUBJECT_SLUG}`);
    expect(raw).not.toContain('[[odense');
    expect(raw).toContain('odense');

    // `## Sources` in basename form, consistent with the citation map.
    const { citationMap } = buildComparisonCitationMap(data);
    const expectedLines = Array.from(citationMap.entries())
      .map(([key, index]) => ({ key, index }))
      .sort((a, b) => a.index - b.index)
      .map(({ key, index }) => {
        const [file, pages] = key.split('|');
        return `[^src${index}]: ${file.split('/').pop()}, pages ${pages}`;
      });
    expect(expectedLines).toEqual([
      '[^src1]: report-2023.pdf, pages 16',
      '[^src2]: report-2024.pdf, pages 15',
      '[^src3]: report-2023.pdf, pages 16-20',
    ]);
    for (const line of expectedLines) {
      expect(raw).toContain(line);
    }
    // The sections carry their own citations.
    expect(raw).toContain('Summary: Regions compared on echocardiography performance in 2022/23. [^src1]');
    expect(raw).toContain('Summary: Regions compared on echocardiography performance across three years. [^src2]');
  } finally {
    vi.useRealTimers();
  }
});

// ---------------------------------------------------------------------------
// Gate 23.4 — synthesis values carry the table sections, entities,
// relatedEntities, citationMap; the prompt is slot-additive and generic (no
// RKKP/registry-specific words).
// ---------------------------------------------------------------------------

test('gate 23.4: the comparison prompt is slot-additive and generic (no corpus-specific vocabulary)', () => {
  const prompt = readFileSync(join(appRoot(), 'prompts', 'comparison.prompt.txt'), 'utf-8');
  // Phase 7 {languageDirective} block + the comparison slots + Phase 17 + Phase 18.
  expect(prompt).toContain('=== LANGUAGE ===\n{languageDirective}');
  expect(prompt).toContain('{comparisonTitle}');
  expect(prompt).toContain('{tables}');
  expect(prompt).toContain('{relatedEntities}');
  expect(prompt).toContain('=== CITATION KEYS ===');
  expect(prompt).toContain('{citationMap}');
  // The Phase 17 wikilink rule and the Phase 18 citation-keys rule are the
  // byte-equal baseline sentences (slot-additive discipline).
  const entityBaseline = readFileSync(join(appRoot(), 'prompts', 'synthesis.prompt.txt'), 'utf-8');
  const wikilinkRule =
    "- Use Obsidian-native wikilinks for related entities: [[<entity-slug>|<Page Title>]] — the target MUST come from the Related Entities list above (the entity's slug), the display text is its title (e.g. [[acme-corp|Acme Corp]]). When Layer 1 names an entity from that list, link it on first mention. Use the bare form [[name]] only when the display text is identical to the target.";
  expect(entityBaseline).toContain(wikilinkRule);
  expect(prompt).toContain(wikilinkRule);
  const citationRule =
    'Every citation [^srcN] in the article MUST use exactly these keys for these sources — cite the key whose listed source and pages contain the fact. No other [^srcN] keys may appear anywhere in the output.';
  expect(entityBaseline).toContain(citationRule);
  expect(prompt).toContain(citationRule);
  // Generic: no RKKP/registry/corpus-specific words anywhere in the prompt.
  const lower = prompt.toLowerCase();
  for (const word of ['rkkp', 'registr', 'indicator', 'hospital', 'atrieflimren', 'ekkokardiografi', 'danmark', 'region']) {
    expect(lower, `prompt must not contain "${word}"`).not.toContain(word);
  }
});

test('gate 23.4: buildComparisonRelatedEntities is the deduplicated sorted union minus the subject itself', () => {
  expect(buildComparisonRelatedEntities(comparisonFixture())).toEqual([
    { slug: 'danmark', title: 'Danmark' },
    { slug: 'hovedstaden', title: 'Hovedstaden' },
    { slug: 'odense', title: 'odense' },
    { slug: 'syddanmark', title: 'Syddanmark' },
  ]);
});

test('gate 23.4: synthesis values carry the table sections, entities, relatedEntities, citationMap (callLLM spy)', async () => {
  const spy = vi.spyOn(llmClient, 'callLLM').mockResolvedValue('# comparison article');
  try {
    await writeComparisonSynthesis(comparisonFixture(), '(test constitution)');
    expect(spy).toHaveBeenCalledTimes(1);
    const prompt = spy.mock.calls[0][0] as unknown as string;
    expect(prompt).toContain(`Subject: ${SUBJECT_TITLE}`);
    // The dated table sections ride the {tables} slot, markdown included.
    expect(prompt).toContain('## Table: report-2023.pdf, p. 16');
    expect(prompt).toContain('## Table: report-2024.pdf, p. 15');
    expect(prompt).toContain(TABLE_MD_2023);
    expect(prompt).toContain(TABLE_MD_2024);
    expect(prompt).toContain('Rows compare: regions · Columns show: performance per year');
    // relatedEntities: table + bridge entities, minus the subject itself.
    expect(prompt).toContain('- danmark — Danmark');
    expect(prompt).toContain('- hovedstaden — Hovedstaden');
    expect(prompt).toContain('- syddanmark — Syddanmark');
    expect(prompt).not.toContain(`- ${SUBJECT_SLUG} —`);
    // citationMap: the deterministic map, basename form, assignment order.
    expect(prompt).toContain('[^src1]: report-2023.pdf, pages 16');
    expect(prompt).toContain('[^src2]: report-2024.pdf, pages 15');
    expect(prompt).toContain('[^src3]: report-2023.pdf, pages 16-20');
    // en/en: the LANGUAGE block is removed byte-identically.
    expect(prompt).not.toContain('=== LANGUAGE ===');
    // The wiki constitution is appended by the agent.
    expect(prompt).toContain('(test constitution)');
  } finally {
    spy.mockRestore();
  }
});

// ---------------------------------------------------------------------------
// Gate 23.5 — ROW-VALUE preservation: a section missing a row's key value
// (or with an altered number) fails as a content defect; a reformatted-but-
// value-complete section passes.
// ---------------------------------------------------------------------------

test('gate 23.5: comparisonRowValues parses header/separator away and keeps every row subject + number', () => {
  const rows = comparisonRowValues(TABLE_MD_2023);
  expect(rows.map((row) => row.subject)).toEqual(['Danmark', 'Hovedstaden', 'Syddanmark']);
  expect(rows[0].numbers).toEqual(['12.876', '16.252', '79,2', '78,6', '79,8', '76,8']);
  expect(rows[2].numbers).toEqual(['3.107', '3.782', '82,2', '80,9', '83,4', '77,3']);
});

test('gate 23.5: the deterministic shell passes row-value preservation', () => {
  const data = comparisonFixture();
  const check = checkComparisonPreservation(data, writeComparisonPage(data));
  expect(check.passed).toBe(true);
  expect(check.droppedRowValues).toEqual([]);
  expect(check.droppedCitations).toEqual([]);
  expect(check.extraMarkers).toEqual([]);
});

test('gate 23.5: a section missing a row fails as a content defect naming the row', () => {
  const data = comparisonFixture();
  const broken = writeComparisonPage(data).replace('| Syddanmark | Ja | 3.107 / 3.782 | 82,2 | 80,9-83,4 | 77,3 |\n', '');
  const check = checkComparisonPreservation(data, broken);
  expect(check.passed).toBe(false);
  expect(check.droppedRowValues.some((value) => value.includes('row "Syddanmark"'))).toBe(true);
});

test('gate 23.5: an altered number fails as a content defect naming the exact original value', () => {
  const data = comparisonFixture();
  const broken = writeComparisonPage(data).replace('82,2', '82,9');
  const check = checkComparisonPreservation(data, broken);
  expect(check.passed).toBe(false);
  expect(check.droppedRowValues).toContain('report-2023.pdf, p. 16 row "Syddanmark": value "82,2"');
});

test('gate 23.5: a reformatted-but-value-complete section passes (structure is the extractor\'s, values the PDF\'s)', () => {
  const data = comparisonFixture();
  const reformatted = [
    `# ${SUBJECT_TITLE}`,
    '',
    'Layer 1: Syddanmark leads at 82,2 while Hovedstaden trails at 70,9 [^src1].',
    '',
    '## Table: report-2023.pdf, p. 16',
    '',
    '|Area|Target met|Count|2022/23 (%)|95% CI|2021/22 (%)|',
    '|---|---|---|---|---|---|',
    '|Danmark|Nej|12.876 / 16.252|79,2|78,6-79,8|76,8|',
    '|Hovedstaden|Nej|3.062 / 4.316|70,9|69,6-72,3|67,8|',
    '|Syddanmark|Ja|3.107 / 3.782|82,2|80,9-83,4|77,3|',
    '',
    '## Table: report-2024.pdf, p. 15',
    '',
    TABLE_MD_2024,
    '',
    '## Related comparisons in prose',
    '',
    '- "Syddanmark opfyldte standarden med 82,2 % i 2022/23" — see [[performance|Performance]] ([[syddanmark|Syddanmark]]) [^src3]',
    '',
    '## Sources',
    '',
    '[^src1]: report-2023.pdf, pages 16',
    '[^src2]: report-2024.pdf, pages 15',
    '[^src3]: report-2023.pdf, pages 16-20',
    '',
  ].join('\n');
  expect(checkComparisonPreservation(data, reformatted).passed).toBe(true);
});

test('gate 23.5: dropped citations and off-map markers fail (entity/composite parity)', () => {
  const data = comparisonFixture();
  const shell = writeComparisonPage(data);
  // Drop the src2 in-prose marker AND its definition line (the definition
  // alone keeps the key present — the entity/composite semantics).
  const dropped = checkComparisonPreservation(
    data,
    shell.replace(' [^src2]', '').replace('[^src2]: report-2024.pdf, pages 15\n', ''),
  );
  expect(dropped.passed).toBe(false);
  expect(dropped.droppedCitations).toContain('[^src2]');

  const offMap = checkComparisonPreservation(data, `${shell}\nOff-map claim [^src9].\n`);
  expect(offMap.passed).toBe(false);
  expect(offMap.extraMarkers.some((marker) => marker.startsWith('[^src9]'))).toBe(true);
});

// ---------------------------------------------------------------------------
// Gate 23.6b — the deterministic `## Related comparisons in prose` bridge:
// exactly the claims sharing the table's entities, with links to their
// topic/entity pages, honest empty form when none exist.
// ---------------------------------------------------------------------------

test('gate 23.6b: the bridge lists exactly the claims sharing the table entities, with topic/entity links', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'report-2023-part-001', tableExtraction2023(), '16-20', 'wikis/test-wiki/raw/report-2023.pdf');

  const result = await materialize('test-wiki', { workspace });

  expect(result.comparisonPages).toHaveLength(1);
  const page = result.comparisonPages[0];
  // Exactly the sharing claim — the entity-less governance claim is excluded.
  expect(page.bridge).toHaveLength(1);
  expect(page.bridge[0]).toMatchObject({
    text: 'Syddanmark opfyldte standarden med 82,2 % i 2022/23',
    topicSlug: 'performance',
    entities: ['syddanmark', SUBJECT_SLUG],
  });

  const raw = readFileSync(wikiPath(workspace, 'comparisons', `${SUBJECT_SLUG}.md`), 'utf-8');
  expect(raw).toContain('## Related comparisons in prose');
  expect(raw).toContain('"Syddanmark opfyldte standarden med 82,2 % i 2022/23" — see [[performance|Performance]]');
  expect(raw).toContain('[[syddanmark|Syddanmark]]');
  expect(raw).not.toContain('Noter steg');
});

test('gate 23.6b: the bridge is empty-form honest when no prose claim shares the table entities', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  const noClaims: ExtractorResult = {
    entities: baseEntities(),
    relationships: [],
    claims: [],
    timeline: [],
    tables: [table2023()],
    context: 'A table with no prose comparisons.',
  };
  installChunk(wikiDir, 'report-2023-part-001', noClaims, '16-20', 'wikis/test-wiki/raw/report-2023.pdf');

  const result = await materialize('test-wiki', { workspace });

  expect(result.comparisonPages[0].bridge).toEqual([]);
  const raw = readFileSync(wikiPath(workspace, 'comparisons', `${SUBJECT_SLUG}.md`), 'utf-8');
  expect(raw).toContain('## Related comparisons in prose');
  expect(raw).toContain("- No prose claims in the corpus reference this comparison's subjects yet.");
});

test('gate 23.6b: the bridge enforcer re-imposes the deterministic section over model output', () => {
  const data = comparisonFixture();
  // Vandalized: the section is missing entirely — it is inserted before ## Sources.
  const missing = `# ${SUBJECT_TITLE}\n\n## Table: report-2023.pdf, p. 16\n\n${TABLE_MD_2023}\n\n## Sources\n\n[^src1]: report-2023.pdf, pages 16\n`;
  const restored = enforceComparisonBridgeInMarkdown(missing, data);
  expect(restored).toContain('## Related comparisons in prose');
  expect(restored.indexOf('## Related comparisons in prose')).toBeLessThan(restored.indexOf('## Sources'));
  expect(restored).toContain('"Syddanmark opfyldte standarden med 82,2 % i 2022/23" — see [[performance|Performance]]');

  // Vandalized: fabricated content — replaced up to the next ## heading.
  const fabricated = `# ${SUBJECT_TITLE}\n\n## Related comparisons in prose\n\n- a made-up link\n\n## Sources\n`;
  const replaced = enforceComparisonBridgeInMarkdown(fabricated, data);
  expect(replaced).not.toContain('made-up');
  expect(replaced).toContain('"Syddanmark opfyldte standarden med 82,2 % i 2022/23"');
});

// ---------------------------------------------------------------------------
// Gate 23.6 — validators + DOX: comparison pages resolve in the link checker
// as content pages; `comparisons/index.md` appears in the wiki root's
// children.
// ---------------------------------------------------------------------------

test('gate 23.6: comparison pages resolve as content pages and comparisons/index.md joins the wiki root children', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'report-2023-part-001', tableExtraction2023(), '16-20', 'wikis/test-wiki/raw/report-2023.pdf');
  installChunk(wikiDir, 'report-2024-part-001', tableExtraction2024(DRIFT_TITLE), '15-19', 'wikis/test-wiki/raw/report-2024.pdf');
  // Raw placeholders for the citation checker + deterministic source pages.
  mkdirSync(join(wikiDir, 'raw'), { recursive: true });
  writeFileSync(join(wikiDir, 'raw', 'report-2023.pdf'), 'fake pdf 2023');
  writeFileSync(join(wikiDir, 'raw', 'report-2024.pdf'), 'fake pdf 2024');
  const now = new Date().toISOString();
  await writeSourcePage(wikiDir, {
    wiki: 'test-wiki',
    fileName: 'report-2023.pdf',
    filePath: 'wikis/test-wiki/raw/report-2023.pdf',
    sourceSlug: 'report-2023',
    sha256: 'a'.repeat(64),
    pageCount: 20,
    ingested: now,
    updated: now,
    warnings: [],
    documentPages: ['documents/report-2023-part-001.md'],
  });
  await writeSourcePage(wikiDir, {
    wiki: 'test-wiki',
    fileName: 'report-2024.pdf',
    filePath: 'wikis/test-wiki/raw/report-2024.pdf',
    sourceSlug: 'report-2024',
    sha256: 'b'.repeat(64),
    pageCount: 19,
    ingested: now,
    updated: now,
    warnings: [],
    documentPages: ['documents/report-2024-part-001.md'],
  });

  await materialize('test-wiki', { workspace });
  await writeDoxContracts('test-wiki', { workspace });

  // comparisons/index.md exists and catalogs the page by its on-disk title
  // (the writer house style JSON-quotes YAML-sensitive titles — the
  // phase-22 composite precedent: derive the expectation from disk).
  const onDiskTitle = matter(
    readFileSync(wikiPath(workspace, 'comparisons', `${SUBJECT_SLUG}.md`), 'utf-8'),
  ).data.title as string;
  const comparisonsIndex = readFileSync(wikiPath(workspace, 'comparisons', 'index.md'), 'utf-8');
  expect(comparisonsIndex).toContain(`[[${SUBJECT_SLUG}|${onDiskTitle}]]`);
  // The wiki root's deterministic children re-imposition includes it, and the
  // root catalogs it with its comparison-page statistic.
  const rootRaw = readFileSync(wikiPath(workspace, 'index.md'), 'utf-8');
  const rootParsed = matter(rootRaw);
  expect(rootParsed.data.children).toContain('comparisons/index.md');
  expect(rootRaw).toContain('- [[comparisons/index|Comparisons]]');
  expect(rootRaw).toContain('- Comparison pages: 1');

  // The full validation pass treats comparison pages as content pages.
  const summary = await validateWiki('test-wiki', workspace);
  expect(summary.links.broken).toEqual([]);
  expect(summary.schema.invalid).toEqual([]);
  const comparisonRelative = `wikis/test-wiki/comparisons/${SUBJECT_SLUG}.md`;
  expect(summary.links.orphaned).not.toContain(comparisonRelative);
  expect(summary.links.islands).not.toContain(comparisonRelative);
  expect(summary.citations.invalid).toEqual([]);
  expect(summary.citations.missingSource).toEqual([]);
});

test('gate 23.6: island scope — a comparison page with zero outgoing links is an island; one with links is not', async () => {
  const workspace = setupWiki();
  const wikiDir = wikiPath(workspace);
  mkdirSync(join(wikiDir, 'comparisons'), { recursive: true });
  const updated = new Date().toISOString();
  writeFileSync(
    join(wikiDir, 'comparisons', 'bare.md'),
    matter.stringify('\nA comparison page with no links at all.\n', { title: 'Bare', type: 'comparison', updated }),
    'utf-8',
  );
  writeFileSync(
    join(wikiDir, 'comparisons', 'linked.md'),
    matter.stringify('\nSee [[bare|Bare]].\n', { title: 'Linked', type: 'comparison', updated }),
    'utf-8',
  );

  const links = await checkLinks('test-wiki', workspace);
  expect(links.islands).toContain('wikis/test-wiki/comparisons/bare.md');
  expect(links.islands).not.toContain('wikis/test-wiki/comparisons/linked.md');
});

// ---------------------------------------------------------------------------
// Gate 23.4/23.5 (ingest level) — the comparison synthesis stage mirrors the
// 22.10 composite stage: strict → permissive → shell, the Phase 12 reask loop
// with the row-value feedback, the pool, the per-page checkpoint + resume,
// report entries with pageType 'comparison'.
// ---------------------------------------------------------------------------

const GOLDEN_MASTER_PDF = 'test-pdfs/golden-master.pdf';

/** Init a wiki and copy the golden master into raw/ under both report names. */
function setupWikiWithPdfs(): string {
  const workspace = makeTempDir('paper-chase-g23-ingest-');
  const wikiDir = wikiPath(workspace);
  mkdirSync(join(wikiDir, 'raw'), { recursive: true });
  copyFileSync(GOLDEN_MASTER_PDF, join(wikiDir, 'raw', 'report-2023.pdf'));
  copyFileSync(GOLDEN_MASTER_PDF, join(wikiDir, 'raw', 'report-2024.pdf'));
  return workspace;
}

/** Injected Layer 2 stub keyed by chunk id: writes the extraction JSON exactly like the real path. */
function makeExtractChunkFnStub(byChunk: Record<string, ExtractorResult>) {
  return async (wikiDir: string, chunkId: string): Promise<ChunkExtraction> => {
    const extraction = byChunk[chunkId];
    if (!extraction) {
      throw new Error(`unexpected chunk ${chunkId}`);
    }
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

/** Preservation-passing synthesized entity page (covers every evidence item + every citation key). */
function passingEntityPage(data: EntityPageData): string {
  const { keys } = buildCitationMap(data);
  const markers = keys.map((key) => `[^${key}]`).join(' ');
  return [
    `Synthesis prose for ${data.title}. ${markers}`,
    '',
    ...data.mentions.map((mention) => `- Page ${mention.page}: "${mention.context}"`),
    ...data.relationships.map((relationship) => `- ${relationship.evidence}`),
    ...data.claims.map((claim) => `- ${claim.text}`),
    '',
    '## Sources',
    '',
    ...keys.map((key) => `[^${key}]: placeholder, pages 1-3`),
    '',
  ].join('\n');
}

/** Preservation-passing synthesized topic page. */
function passingTopicPage(data: TopicPageData): string {
  const { keys } = buildCitationMap({ mentions: [], relationships: [], claims: data.claims });
  const markers = keys.map((key) => `[^${key}]`).join(' ');
  return [
    `Topic synthesis for ${data.title}. ${markers}`,
    '',
    ...data.claims.map((claim) => `- ${claim.text}`),
    '',
    '## Sources',
    '',
    ...keys.map((key) => `[^${key}]: placeholder, pages 1-3`),
    '',
  ].join('\n');
}

/**
 * Preservation-passing comparison article: a Layer 1 analysis plus every
 * dated table section verbatim under its exact heading (the bridge section
 * is deliberately OMITTED — the write-point enforcer must rebuild it).
 */
function passingComparisonPage(data: ComparisonPageData): string {
  const { keys } = buildComparisonCitationMap(data);
  const markers = keys.map((key) => `[^${key}]`).join(' ');
  const parts = [
    `# ${data.title}`,
    '',
    `Layer 1 analysis: leaders and trailers across the dated sections. ${markers}`,
    '',
  ];
  for (const table of data.tables) {
    const file = table.source.split('/').pop() ?? table.source;
    parts.push(`## Table: ${file}, p. ${table.page}`, '', table.markdown, '');
  }
  parts.push('## Sources', '', ...keys.map((key) => `[^${key}]: placeholder, pages x`), '');
  return parts.join('\n');
}

/** A comparison page that ALTERS one row value in the 2023 section (always fails row-value preservation). */
function failingComparisonPage(data: ComparisonPageData): string {
  return passingComparisonPage(data).replace('82,2', '82,9');
}

/** The shared ingest-level options: both extraction stubs + keep-all curation + passing entity/topic stubs. */
function gate23IngestOptions(
  comparisonStubs: Pick<IngestOptions, 'synthesizeComparisonFn' | 'synthesizeComparisonPermissiveFn'>,
): IngestOptions {
  return {
    poolStaggerMs: 0,
    extractChunkFn: makeExtractChunkFnStub({
      'report-2023-part-001': tableExtraction2023(),
      'report-2024-part-001': tableExtraction2024(DRIFT_TITLE),
    }),
    ...KEEP_ALL_STUBS,
    synthesizeEntityFn: async (data: EntityPageData) => passingEntityPage(data),
    synthesizeEntityPermissiveFn: async (data: EntityPageData) => passingEntityPage(data),
    synthesizeTopicFn: async (data: TopicPageData) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data: TopicPageData) => passingTopicPage(data),
    // Phase 26 (per-PDF amendment): PDF 2's pass finds same-shape pages with
    // non-empty deltas and routes them to the Amendment Writer. The
    // comparison's delta is exactly PDF 2's dated table section (added as a
    // new section); every other page's new items are already verbatim in the
    // passing stubs' full-aggregate render, so an empty patch degrades to the
    // same full-synthesis fallback the pre-Phase-26 pipeline took.
    amendmentFn: async (request) =>
      JSON.stringify({
        operations:
          request.pageKind === 'comparison'
            ? [{ op: 'add-section', heading: '## Table: report-2024.pdf, p. 15', body: TABLE_MD_2024 }]
            : [],
      }),
    ...comparisonStubs,
  };
}

test('gate 23.4 (stage): strict comparison synthesis replaces the shell with the rich article (enforcers composed, report pageType comparison)', async () => {
  const workspace = setupWikiWithPdfs();
  let comparisonCalls = 0;
  const result = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    ...gate23IngestOptions({
      synthesizeComparisonFn: async (data) => {
        comparisonCalls += 1;
        return passingComparisonPage(data);
      },
      synthesizeComparisonPermissiveFn: async (data) => passingComparisonPage(data),
    }),
  });

  expect(result.synthesisRan).toBe(true);
  expect(comparisonCalls).toBe(1);
  expect(result.synthesizedComparisons).toBe(1);
  expect(result.synthesizedComparisonsPermissive ?? 0).toBe(0);
  expect(result.comparisonConflicts ?? 0).toBe(0);

  const raw = readFileSync(wikiPath(workspace, 'comparisons', `${SUBJECT_SLUG}.md`), 'utf-8');
  // The rich article replaced the shell; every row value survived.
  expect(raw).toContain('Layer 1 analysis: leaders and trailers across the dated sections.');
  expect(raw).toContain('| Syddanmark | Ja | 3.107 / 3.782 | 82,2 | 80,9-83,4 | 77,3 |');
  const parsed = matter(raw);
  expect(parsed.data.type).toBe('comparison');
  // The house style JSON-quotes the YAML-sensitive title (entity/composite precedent).
  expect(String(parsed.data.title)).toContain(SUBJECT_TITLE);
  expect(parsed.data.aliases).toEqual(expect.arrayContaining([SUBJECT_TITLE, DRIFT_TITLE]));
  expect(parsed.data.sources).toEqual([
    { file: 'wikis/test-wiki/raw/report-2023.pdf', pages: '1-3, 16' },
    { file: 'wikis/test-wiki/raw/report-2024.pdf', pages: '1-3, 15' },
  ]);
  expect('sparse' in parsed.data).toBe(false);
  // The model omitted the bridge — the enforcer rebuilt it deterministically.
  expect(raw).toContain('## Related comparisons in prose');
  expect(raw).toContain('"Syddanmark opfyldte standarden med 82,2 % i 2022/23" — see [[performance|Performance]]');
  expect(raw).toContain('"Hovedstaden missed the target again in 2023/24 with 71,4 %" — see [[performance|Performance]]');
  // `## Sources` rebuilt in basename form (the model's placeholders are gone).
  expect(raw).toContain('[^src1]: report-2023.pdf, pages 16');
  expect(raw).toContain('[^src2]: report-2024.pdf, pages 15');
  expect(raw).not.toContain('placeholder, pages x');

  const report = await readSynthesisReport(wikiPath(workspace));
  const entry = report.entries.find((item) => item.pageType === 'comparison');
  expect(entry).toMatchObject({
    pageType: 'comparison',
    slug: SUBJECT_SLUG,
    strict: { attempted: true, passed: true, attempts: 1 },
    finalMode: 'strict-synthesis',
  });
});

test('gate 23.5 (stage): a row-value defect re-asks with the exact dropped value, then the permissive pass wins', async () => {
  const workspace = setupWikiWithPdfs();
  const strictFeedbacks: Array<string | undefined> = [];
  let permissiveCalls = 0;
  const result = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    ...gate23IngestOptions({
      synthesizeComparisonFn: async (data, _agentsMd, _logPath, _language, feedback) => {
        strictFeedbacks.push(feedback);
        return failingComparisonPage(data);
      },
      synthesizeComparisonPermissiveFn: async (data) => {
        permissiveCalls += 1;
        return passingComparisonPage(data);
      },
    }),
  });

  // The strict mode exhausted its bounded reask (3 attempts; attempts 2+
  // carry the exact altered value back), then the permissive mode passed.
  expect(strictFeedbacks).toHaveLength(3);
  expect(strictFeedbacks[0]).toBeUndefined();
  expect(strictFeedbacks[1]).toContain('=== CORRECTION REQUIRED ===');
  expect(strictFeedbacks[1]).toContain('Dropped table row value (restore this exact value): report-2023.pdf, p. 16 row "Syddanmark": value "82,2"');
  expect(permissiveCalls).toBe(1);
  expect(result.synthesizedComparisonsPermissive).toBe(1);

  const report = await readSynthesisReport(wikiPath(workspace));
  const entry = report.entries.find((item) => item.pageType === 'comparison');
  expect(entry).toMatchObject({
    strict: { attempted: true, passed: false, attempts: 3 },
    permissive: { attempted: true, passed: true, attempts: 1 },
    finalMode: 'permissive-synthesis',
  });
});

test('gate 23.5 (stage): double failure keeps the deterministic shell (finalMode structured-template, conflict logged)', async () => {
  const workspace = setupWikiWithPdfs();
  const result = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    ...gate23IngestOptions({
      synthesizeComparisonFn: async (data) => failingComparisonPage(data),
      synthesizeComparisonPermissiveFn: async (data) => failingComparisonPage(data),
    }),
  });

  // Phase 26 (per-PDF passes): the template-fallback comparison is retried in
  // BOTH PDFs' passes (the Phase 16 template-retry semantic under the loop),
  // so the conflict is logged once per pass.
  expect(result.comparisonConflicts).toBe(2);
  expect(result.synthesizedComparisons ?? 0).toBe(0);
  expect(result.synthesizedComparisonsPermissive ?? 0).toBe(0);

  // The deterministic SHELL is kept on disk — both dated sections verbatim.
  const raw = readFileSync(wikiPath(workspace, 'comparisons', `${SUBJECT_SLUG}.md`), 'utf-8');
  expect(raw).toContain('## Table: report-2023.pdf, p. 16');
  expect(raw).toContain(TABLE_MD_2023);
  expect(raw).toContain(TABLE_MD_2024);
  expect(raw).not.toContain('Layer 1 analysis');
  expect(matter(raw).data.type).toBe('comparison');

  const report = await readSynthesisReport(wikiPath(workspace));
  const entries = report.entries.filter((item) => item.pageType === 'comparison');
  const entry = entries[entries.length - 1];
  expect(entry).toMatchObject({
    strict: { attempted: true, passed: false, attempts: 3 },
    permissive: { attempted: true, passed: false, attempts: 3 },
    finalMode: 'structured-template',
  });
  const conflicts = await readConflicts(wikiPath(workspace));
  expect(
    conflicts.conflicts.some(
      (item) => 'pageType' in item && item.pageType === 'comparison' && item.slug === SUBJECT_SLUG,
    ),
  ).toBe(true);
});

test('gate 23.4 (stage): run 2 with unchanged data makes ZERO comparison LLM calls and keeps the page byte-identical (resume)', async () => {
  const workspace = setupWikiWithPdfs();
  let comparisonCalls = 0;
  const comparisonStub = async (data: ComparisonPageData): Promise<string> => {
    comparisonCalls += 1;
    return passingComparisonPage(data);
  };
  await ingest('test-wiki', {
    workspace,
    synthesis: true,
    ...gate23IngestOptions({
      synthesizeComparisonFn: comparisonStub,
      synthesizeComparisonPermissiveFn: comparisonStub,
    }),
  });
  expect(comparisonCalls).toBe(1);
  const comparisonPath = wikiPath(workspace, 'comparisons', `${SUBJECT_SLUG}.md`);
  const run1Bytes = readFileSync(comparisonPath, 'utf-8');

  // Run 2: the PDFs are hash-skipped, materialize re-runs, and the
  // skip-eligible comparison record suppresses every LLM call.
  let entityCalls = 0;
  let topicCalls = 0;
  const run2 = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    ...gate23IngestOptions({
      synthesizeComparisonFn: comparisonStub,
      synthesizeComparisonPermissiveFn: comparisonStub,
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

  expect(comparisonCalls).toBe(1); // no run-2 comparison call
  expect(entityCalls).toBe(0);
  expect(topicCalls).toBe(0);
  expect(run2.synthesisComparisonsSkipped).toBe(1);
  expect(readFileSync(comparisonPath, 'utf-8')).toBe(run1Bytes);

  // The skipped comparison contributes a reconstructed report entry (the
  // PDF-2 pass PATCH-amended it under Phase 26, so both run-1 entries and the
  // run-2 reconstructed entry replay the patch-amended mode).
  const report = await readSynthesisReport(wikiPath(workspace));
  const comparisonEntries = report.entries.filter((item) => item.pageType === 'comparison');
  expect(comparisonEntries).toHaveLength(3);
  expect(comparisonEntries[1]).toMatchObject({ finalMode: 'patch-amended' });
  expect(comparisonEntries[2]).toMatchObject({ finalMode: 'patch-amended' });
});
