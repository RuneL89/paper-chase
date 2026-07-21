/**
 * Phase 10 A/B comparison harness (LLM-free).
 *
 * Runs pdfjs and (when a JRE is present) opendataloader over every
 * test-pdfs/ab-corpus fixture plus the two golden masters and writes a
 * human-readable markdown report and a machine-readable JSON twin.
 *
 * Usage: npx tsx scripts/compare-pdf-engines.ts [--subset <names>]
 *   --subset danish-diacritics,tables   (basenames without .pdf, comma-separated)
 *   --report <path> --json <path>       (override the .state/ output paths)
 *
 * Per document the report records: expected-string presence, table fidelity
 * (markdown table shape after renderTablesAsMarkdown vs. the manifest),
 * diacritics integrity (æ/ø/å verbatim), page-boundary alignment (page counts
 * and per-page non-empty agreement), and wall time per engine (plus JVM
 * startup overhead). It ends with a data-backed keep-pdfjs/switch-default
 * RECOMMENDATION. Without Java the opendataloader columns say "skipped (no
 * JRE)" and the recommendation defaults to keeping pdfjs.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { renderTablesAsMarkdown } from '../src/extraction/markdown-tables';
import { hasJavaRuntime } from '../src/extraction/engine';
import * as pdfjs from '../src/extraction/pdf-pdfjs';
import * as opendataloader from '../src/extraction/pdf-opendataloader';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS_DIR = join(PROJECT_ROOT, 'test-pdfs', 'ab-corpus');
const DEFAULT_REPORT = join(PROJECT_ROOT, '.state', 'pdf-engine-ab-report.md');
const DEFAULT_JSON = join(PROJECT_ROOT, '.state', 'pdf-engine-ab-report.json');

interface ExpectedTable {
  name: string;
  rows: number; // header + data rows (markdown separator line excluded)
  cols: number;
}

interface FixtureManifestEntry {
  filename: string;
  sha256: string;
  pageCount: number;
  expectedStrings: string[];
  expectedTables: ExpectedTable[];
  diacritics: string[];
  notes: string;
}

interface Manifest {
  fixtures: FixtureManifestEntry[];
}

/** Golden masters are not part of the ab-corpus manifest; their known content
 * comes from the Phase 0/7 control-document definitions (same strings the
 * infrastructure tests assert). */
const GOLDEN_MASTER_ENTRIES: FixtureManifestEntry[] = [
  {
    filename: 'golden-master.pdf',
    sha256: '1e4f2cbec74a83bf8ae56f3a45035827ec405bd02989d6b38f08929b80ac339d',
    pageCount: 3,
    expectedStrings: ['John Smith', 'Acme Corp', 'March 15, 2024', '$42.5 million', 'Board Members'],
    expectedTables: [{ name: 'quarter', rows: 4, cols: 3 }],
    diacritics: [],
    notes: 'Phase 0 control document (3 pages). Quarter/Revenue/Growth table on page 2.',
  },
  {
    filename: 'golden-master-da.pdf',
    sha256: '55d040c7dea6e7b797614e602b25f9c77c8c4e8d48aeb593b56ae3b279b3dd29',
    pageCount: 2,
    expectedStrings: ['Søren Møller', 'København', 'Møbler A/S', '12,5 millioner kr.', '3,2 millioner kr.'],
    expectedTables: [],
    diacritics: ['Søren Møller', 'Åse Lindberg', 'København', 'Møbler'],
    notes: 'Phase 7 Danish control document (2 pages).',
  },
];

interface EngineResult {
  available: boolean;
  wallMs: number | null;
  fullText: string | null;
  pageTexts: string[] | null;
  pageCount: number | null;
  error: string | null;
}

interface DetectedTable {
  rows: number;
  cols: number;
}

interface DocumentReport {
  filename: string;
  path: string;
  expectedPageCount: number;
  engines: Record<'pdfjs' | 'opendataloader', EngineResult>;
  expectedStrings: Record<string, { pdfjs: boolean | null; opendataloader: boolean | null }>;
  tables: {
    expected: ExpectedTable[];
    detected: { pdfjs: DetectedTable[] | null; opendataloader: DetectedTable[] | null };
    matched: { pdfjs: boolean | null; opendataloader: boolean | null };
  };
  diacritics: { pdfjs: boolean | null; opendataloader: boolean | null; missing: { pdfjs: string[]; opendataloader: string[] } };
  pageAlignment: {
    pageCountAgree: boolean | null;
    nonEmptyAgreement: boolean | null;
  };
}

export interface ComparisonReport {
  generatedAt: string;
  javaAvailable: boolean;
  jvmStartupOverheadMs: number | null;
  totals: {
    pdfjsWallMs: number;
    opendataloaderWallMs: number | null;
    documents: number;
  };
  documents: DocumentReport[];
  recommendation: string;
}

function detectTables(renderedText: string): DetectedTable[] {
  const lines = renderedText.split('\n');
  const tables: DetectedTable[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim().startsWith('|')) {
      const block: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        block.push(lines[i]);
        i++;
      }
      // Header + separator + data rows; rows excludes the '---' separator.
      const headerCells = block[0].split('|').filter((cell) => cell.trim() !== '');
      const dataRows = block.filter((line) => !/^\s*\|[\s\-|]+\|\s*$/.test(line)).length - 1;
      tables.push({ rows: 1 + Math.max(dataRows, 0), cols: headerCells.length });
    } else {
      i++;
    }
  }
  return tables;
}

function tablesMatch(expected: ExpectedTable[], detected: DetectedTable[]): boolean {
  return expected.every((want) =>
    detected.some((got) => got.rows === want.rows && got.cols === want.cols),
  );
}

async function extractWithPdfjs(pdfPath: string): Promise<EngineResult> {
  const start = performance.now();
  try {
    const pageCount = await pdfjs.getPageCount(pdfPath);
    const pageTexts: string[] = [];
    for (let n = 1; n <= pageCount; n++) {
      pageTexts.push(await pdfjs.extractText(pdfPath, n, n));
    }
    return {
      available: true,
      wallMs: performance.now() - start,
      fullText: pageTexts.join('\n'),
      pageTexts,
      pageCount,
      error: null,
    };
  } catch (err) {
    return {
      available: false,
      wallMs: performance.now() - start,
      fullText: null,
      pageTexts: null,
      pageCount: null,
      error: (err as Error).message,
    };
  }
}

async function extractWithOpenDataLoader(pdfPath: string, javaAvailable: boolean): Promise<EngineResult> {
  if (!javaAvailable) {
    return { available: false, wallMs: null, fullText: null, pageTexts: null, pageCount: null, error: 'skipped (no JRE)' };
  }
  const start = performance.now();
  try {
    const pages = await opendataloader.extractAllPages(pdfPath);
    const pageTexts = pages.slice(1);
    return {
      available: true,
      wallMs: performance.now() - start,
      fullText: pageTexts.join('\n'),
      pageTexts,
      pageCount: pageTexts.length,
      error: null,
    };
  } catch (err) {
    return {
      available: false,
      wallMs: performance.now() - start,
      fullText: null,
      pageTexts: null,
      pageCount: null,
      error: (err as Error).message,
    };
  }
}

async function compareDocument(
  entry: FixtureManifestEntry,
  pdfPath: string,
  javaAvailable: boolean,
): Promise<DocumentReport> {
  const pdfjsResult = await extractWithPdfjs(pdfPath);
  const odlResult = await extractWithOpenDataLoader(pdfPath, javaAvailable);

  const expectedStrings: DocumentReport['expectedStrings'] = {};
  for (const marker of entry.expectedStrings) {
    expectedStrings[marker] = {
      pdfjs: pdfjsResult.fullText === null ? null : pdfjsResult.fullText.includes(marker),
      opendataloader: odlResult.fullText === null ? null : odlResult.fullText.includes(marker),
    };
  }

  const pdfjsTables =
    pdfjsResult.fullText === null ? null : detectTables(renderTablesAsMarkdown(pdfjsResult.fullText).text);
  const odlTables =
    odlResult.fullText === null ? null : detectTables(renderTablesAsMarkdown(odlResult.fullText).text);

  const diacriticMissing = (text: string | null): string[] =>
    text === null ? [] : entry.diacritics.filter((d) => !text.includes(d));
  const pdfjsDiacriticMissing = diacriticMissing(pdfjsResult.fullText);
  const odlDiacriticMissing = diacriticMissing(odlResult.fullText);

  let pageCountAgree: boolean | null = null;
  let nonEmptyAgreement: boolean | null = null;
  const pdfjsPages = pdfjsResult.pageTexts;
  const odlPages = odlResult.pageTexts;
  if (pdfjsResult.pageCount !== null && odlResult.pageCount !== null) {
    pageCountAgree = pdfjsResult.pageCount === odlResult.pageCount;
    if (pageCountAgree && pdfjsPages !== null && odlPages !== null) {
      nonEmptyAgreement = pdfjsPages.every(
        (text, i) => (text.trim().length > 0) === ((odlPages[i] ?? '').trim().length > 0),
      );
    }
  }

  return {
    filename: entry.filename,
    path: pdfPath,
    expectedPageCount: entry.pageCount,
    engines: { pdfjs: pdfjsResult, opendataloader: odlResult },
    expectedStrings,
    tables: {
      expected: entry.expectedTables,
      detected: { pdfjs: pdfjsTables, opendataloader: odlTables },
      matched: {
        pdfjs: pdfjsTables === null ? null : tablesMatch(entry.expectedTables, pdfjsTables),
        opendataloader: odlTables === null ? null : tablesMatch(entry.expectedTables, odlTables),
      },
    },
    diacritics: {
      pdfjs: pdfjsResult.fullText === null ? null : pdfjsDiacriticMissing.length === 0,
      opendataloader: odlResult.fullText === null ? null : odlDiacriticMissing.length === 0,
      missing: { pdfjs: pdfjsDiacriticMissing, opendataloader: odlDiacriticMissing },
    },
    pageAlignment: { pageCountAgree, nonEmptyAgreement },
  };
}

function mark(value: boolean | null): string {
  if (value === null) return 'n/a';
  return value ? 'PASS' : 'FAIL';
}

function buildRecommendation(report: Omit<ComparisonReport, 'recommendation'>): string {
  if (!report.javaAvailable) {
    return (
      'KEEP pdfjs as the default engine. opendataloader metrics were skipped (no JRE on PATH), ' +
      'so there is no data to support a switch; pdfjs remains the zero-dependency default.'
    );
  }
  let pdfjsFailures = 0;
  let odlFailures = 0;
  for (const doc of report.documents) {
    for (const check of Object.values(doc.expectedStrings)) {
      if (check.pdfjs === false) pdfjsFailures++;
      if (check.opendataloader === false) odlFailures++;
    }
    if (doc.tables.matched.pdfjs === false) pdfjsFailures++;
    if (doc.tables.matched.opendataloader === false) odlFailures++;
    if (doc.diacritics.pdfjs === false) pdfjsFailures++;
    if (doc.diacritics.opendataloader === false) odlFailures++;
    if (doc.pageAlignment.pageCountAgree === false || doc.pageAlignment.nonEmptyAgreement === false) {
      pdfjsFailures++;
      odlFailures++;
    }
  }
  const odlWall = report.totals.opendataloaderWallMs ?? 0;
  const speedRatio = report.totals.pdfjsWallMs > 0 ? odlWall / report.totals.pdfjsWallMs : Infinity;
  if (odlFailures === 0 && pdfjsFailures > 0 && speedRatio < 5) {
    return (
      `CONSIDER switching the default to opendataloader: it passed every content check while pdfjs ` +
      `failed ${pdfjsFailures}, at ${speedRatio.toFixed(1)}x pdfjs wall time. Requires user approval ` +
      `(phase doc §3.6) and makes Java 11+ a runtime requirement.`
    );
  }
  return (
    `KEEP pdfjs as the default engine. Content-check failures: pdfjs ${pdfjsFailures}, ` +
    `opendataloader ${odlFailures}; opendataloader wall time is ${speedRatio.toFixed(1)}x pdfjs ` +
    `(JVM startup ${report.jvmStartupOverheadMs ?? 0} ms) and it adds a hard Java 11+ runtime ` +
    `dependency. pdfjs stays the zero-dependency default; opendataloader remains opt-in.`
  );
}

function renderMarkdown(report: ComparisonReport, entries: Map<string, FixtureManifestEntry>): string {
  const lines: string[] = [];
  lines.push('# PDF Engine A/B Report (Phase 10)');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Java available: ${report.javaAvailable ? 'yes' : 'NO — opendataloader metrics skipped (no JRE on PATH)'}`);
  if (report.jvmStartupOverheadMs !== null) {
    lines.push(`JVM startup overhead: ~${Math.round(report.jvmStartupOverheadMs)} ms (first opendataloader document vs. steady-state)`);
  }
  lines.push(
    `Total wall time: pdfjs ${Math.round(report.totals.pdfjsWallMs)} ms` +
      (report.totals.opendataloaderWallMs !== null
        ? ` | opendataloader ${Math.round(report.totals.opendataloaderWallMs)} ms`
        : ' | opendataloader skipped'),
  );
  lines.push('');

  for (const doc of report.documents) {
    const entry = entries.get(doc.filename);
    lines.push(`## ${doc.filename}`);
    if (entry) {
      lines.push(`_${entry.notes}_`);
      lines.push('');
    }
    lines.push(`| Metric | pdfjs | opendataloader |`);
    lines.push(`| --- | --- | --- |`);
    const fmtMs = (result: DocumentReport['engines']['pdfjs']): string =>
      result.wallMs === null ? 'skipped (no JRE)' : `${Math.round(result.wallMs)} ms`;
    lines.push(`| Wall time | ${fmtMs(doc.engines.pdfjs)} | ${fmtMs(doc.engines.opendataloader)} |`);
    lines.push(
      `| Page count | ${doc.engines.pdfjs.pageCount ?? 'error'} | ${doc.engines.opendataloader.pageCount ?? (doc.engines.opendataloader.error === 'skipped (no JRE)' ? 'skipped (no JRE)' : 'error')} |`,
    );
    if (doc.engines.pdfjs.error) lines.push(`| pdfjs error | ${doc.engines.pdfjs.error} | |`);
    if (doc.engines.opendataloader.error && doc.engines.opendataloader.error !== 'skipped (no JRE)') {
      lines.push(`| opendataloader error | | ${doc.engines.opendataloader.error.split('\n')[0]} |`);
    }
    lines.push('');
    lines.push('Expected strings:');
    for (const [marker, check] of Object.entries(doc.expectedStrings)) {
      lines.push(`- \`${marker}\` — pdfjs: ${mark(check.pdfjs)}, opendataloader: ${mark(check.opendataloader)}`);
    }
    if (doc.tables.expected.length > 0) {
      lines.push('');
      lines.push('Table fidelity (after renderTablesAsMarkdown):');
      for (const want of doc.tables.expected) {
        lines.push(`- expected \`${want.name}\` ${want.rows}x${want.cols}`);
      }
      lines.push(`- detected pdfjs: ${JSON.stringify(doc.tables.detected.pdfjs)} — ${mark(doc.tables.matched.pdfjs)}`);
      lines.push(`- detected opendataloader: ${JSON.stringify(doc.tables.detected.opendataloader)} — ${mark(doc.tables.matched.opendataloader)}`);
    }
    lines.push('');
    lines.push(
      `Diacritics integrity: pdfjs ${mark(doc.diacritics.pdfjs)}, opendataloader ${mark(doc.diacritics.opendataloader)}` +
        (doc.diacritics.missing.pdfjs.length > 0 ? ` (pdfjs missing: ${doc.diacritics.missing.pdfjs.join(', ')})` : '') +
        (doc.diacritics.missing.opendataloader.length > 0
          ? ` (opendataloader missing: ${doc.diacritics.missing.opendataloader.join(', ')})`
          : ''),
    );
    lines.push(
      `Page alignment: counts agree ${mark(doc.pageAlignment.pageCountAgree)}, per-page non-empty agreement ${mark(doc.pageAlignment.nonEmptyAgreement)}`,
    );
    lines.push('');
  }

  lines.push('## Recommendation');
  lines.push('');
  lines.push(report.recommendation);
  lines.push('');
  return lines.join('\n');
}

export interface RunComparisonOptions {
  /** Basenames without .pdf to restrict the run (default: all corpus fixtures + golden masters). */
  subset?: string[];
  reportPath?: string;
  jsonPath?: string;
}

export async function runComparison(options: RunComparisonOptions = {}): Promise<ComparisonReport> {
  const manifest = JSON.parse(await readFile(join(CORPUS_DIR, 'manifest.json'), 'utf-8')) as Manifest;
  const corpusEntries = manifest.fixtures.map((entry) => ({
    entry,
    path: join(CORPUS_DIR, entry.filename),
  }));
  const goldenEntries = GOLDEN_MASTER_ENTRIES.map((entry) => ({
    entry,
    path: join(PROJECT_ROOT, 'test-pdfs', entry.filename),
  }));
  let docs = [...corpusEntries, ...goldenEntries];
  if (options.subset && options.subset.length > 0) {
    const wanted = new Set(options.subset);
    docs = docs.filter((doc) => wanted.has(doc.entry.filename.replace(/\.pdf$/, '')));
    if (docs.length === 0) {
      throw new Error(`--subset matched no fixtures: ${options.subset.join(', ')}`);
    }
  }

  const javaAvailable = await hasJavaRuntime();
  const documents: DocumentReport[] = [];
  for (const doc of docs) {
    documents.push(await compareDocument(doc.entry, doc.path, javaAvailable));
  }

  const odlTimes = documents
    .map((doc) => doc.engines.opendataloader.wallMs)
    .filter((ms): ms is number => ms !== null);
  let jvmStartupOverheadMs: number | null = null;
  if (odlTimes.length >= 2) {
    const steady = Math.min(...odlTimes.slice(1));
    jvmStartupOverheadMs = Math.max(odlTimes[0] - steady, 0);
  }

  const base = {
    generatedAt: new Date().toISOString(),
    javaAvailable,
    jvmStartupOverheadMs,
    totals: {
      pdfjsWallMs: documents.reduce((sum, doc) => sum + (doc.engines.pdfjs.wallMs ?? 0), 0),
      opendataloaderWallMs: javaAvailable ? odlTimes.reduce((sum, ms) => sum + ms, 0) : null,
      documents: documents.length,
    },
    documents,
  };
  const report: ComparisonReport = { ...base, recommendation: buildRecommendation(base) };

  const reportPath = options.reportPath ?? DEFAULT_REPORT;
  const jsonPath = options.jsonPath ?? DEFAULT_JSON;
  const entryMap = new Map(docs.map((doc) => [doc.entry.filename, doc.entry]));
  await mkdir(dirname(reportPath), { recursive: true });
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(reportPath, renderMarkdown(report, entryMap), 'utf-8');
  await writeFile(jsonPath, JSON.stringify(report, null, 2) + '\n', 'utf-8');
  return report;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options: RunComparisonOptions = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--subset' && args[i + 1]) {
      options.subset = args[++i].split(',').map((name) => name.trim());
    } else if (args[i] === '--report' && args[i + 1]) {
      options.reportPath = resolve(args[++i]);
    } else if (args[i] === '--json' && args[i + 1]) {
      options.jsonPath = resolve(args[++i]);
    }
  }
  const report = await runComparison(options);
  console.log(`Compared ${report.totals.documents} document(s). Java: ${report.javaAvailable}.`);
  console.log(report.recommendation);
}

// Direct-execution guard (same pattern as src/cli.ts): never run on import.
// Under `npx tsx` the script path lands in argv[2] (argv[1] is the tsx CLI
// shim), so both are compared against this module's path.
const modulePath = fileURLToPath(import.meta.url);
const isDirectExecution = [process.argv[1], process.argv[2]]
  .filter((arg): arg is string => typeof arg === 'string')
  .some((arg) => {
    const resolvedArg = resolve(arg);
    return (
      resolvedArg === modulePath ||
      (process.platform === 'win32' && resolvedArg.toLowerCase() === modulePath.toLowerCase())
    );
  });

if (!process.env.VITEST && isDirectExecution) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
