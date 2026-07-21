import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import matter from 'gray-matter';
import { extractText, getPageCount, extractDocumentPages } from '../src/extraction/pdf';
import * as pdfjs from '../src/extraction/pdf-pdfjs';
import * as odl from '../src/extraction/pdf-opendataloader';
import {
  resolvePdfEngine,
  hasJavaRuntime,
  resetJavaRuntimeCache,
  setJavaRuntimeOverrideForTests,
  MISSING_JAVA_MESSAGE,
} from '../src/extraction/engine';
import { renderTablesAsMarkdown } from '../src/extraction/markdown-tables';
import { init } from '../src/commands/init';
import { ingest } from '../src/commands/ingest';
import { sha256 } from '../src/utils/hash';

/**
 * Phase 10 gates (Implementation Plan/PHASE_10_pdf_engine_ab.md §4).
 *
 * All tests are LLM-free. JRE-gated tests self-skip visibly when `java` is
 * absent (shared `javaAvailable` probe + test.skipIf); on this machine Java 21
 * (Temurin) IS installed, so they run for real. opendataloader-invoking tests
 * get 120s timeouts (JVM startup is slow). Tests that touch PDF_ENGINE restore
 * the environment in afterEach.
 */
const GOLDEN_MASTER = 'test-pdfs/golden-master.pdf';
const GOLDEN_MASTER_DA = 'test-pdfs/golden-master-da.pdf';
const CORPUS_DIR = 'test-pdfs/ab-corpus';
const SNAPSHOT_DIR = 'tests/snapshots';

interface ManifestEntry {
  filename: string;
  sha256: string;
  pageCount: number;
  expectedStrings: string[];
  expectedTables: Array<{ name: string; rows: number; cols: number }>;
  diacritics: string[];
  notes: string;
}

const manifest = JSON.parse(readFileSync(join(CORPUS_DIR, 'manifest.json'), 'utf-8')) as {
  fixtures: ManifestEntry[];
};

// Shared JRE probe for the skipIf pattern (top-level await; cached per process).
const javaAvailable = await hasJavaRuntime();

const savedPdfEngine = process.env.PDF_ENGINE;

afterEach(() => {
  // Restore env + JRE probe state after every test that flips them.
  if (savedPdfEngine === undefined) {
    delete process.env.PDF_ENGINE;
  } else {
    process.env.PDF_ENGINE = savedPdfEngine;
  }
  setJavaRuntimeOverrideForTests(null);
  resetJavaRuntimeCache();
});

// ---------------------------------------------------------------------------
// Gate 10.1: Frozen Surface Preserved — with PDF_ENGINE unset, extractText and
// getPageCount on both golden masters equal the pre-refactor snapshots
// (recorded BEFORE the pdf.ts split) byte-for-byte, full document + per page.
// ---------------------------------------------------------------------------
test('gate 10.1: pdfjs engine remains the byte-identical default (golden-master.pdf)', async () => {
  delete process.env.PDF_ENGINE;
  const snapshot = readFileSync(join(SNAPSHOT_DIR, 'golden-master-pdfjs.txt'), 'utf-8');
  const pagesSnapshot = JSON.parse(
    readFileSync(join(SNAPSHOT_DIR, 'golden-master-pdfjs-pages.json'), 'utf-8'),
  ) as { pageCount: number; pages: string[] };

  expect(await extractText(GOLDEN_MASTER)).toBe(snapshot);
  expect(await getPageCount(GOLDEN_MASTER)).toBe(pagesSnapshot.pageCount);
  for (let n = 1; n <= pagesSnapshot.pageCount; n++) {
    expect(await extractText(GOLDEN_MASTER, n, n)).toBe(pagesSnapshot.pages[n - 1]);
  }
});

test('gate 10.1: pdfjs engine remains the byte-identical default (golden-master-da.pdf)', async () => {
  delete process.env.PDF_ENGINE;
  const snapshot = readFileSync(join(SNAPSHOT_DIR, 'golden-master-da-pdfjs.txt'), 'utf-8');
  const pagesSnapshot = JSON.parse(
    readFileSync(join(SNAPSHOT_DIR, 'golden-master-da-pdfjs-pages.json'), 'utf-8'),
  ) as { pageCount: number; pages: string[] };

  expect(await extractText(GOLDEN_MASTER_DA)).toBe(snapshot);
  expect(await getPageCount(GOLDEN_MASTER_DA)).toBe(pagesSnapshot.pageCount);
  for (let n = 1; n <= pagesSnapshot.pageCount; n++) {
    expect(await extractText(GOLDEN_MASTER_DA, n, n)).toBe(pagesSnapshot.pages[n - 1]);
  }
});

// ---------------------------------------------------------------------------
// Gate 10.2: Existing Extraction Gates Pass Under Both Engines — the core
// infrastructure.test.ts assertions (known golden-master strings, page-range
// isolation) plus a hermetic temp-workspace ingest asserting pages: "N-M"
// provenance, run once per engine.
// ---------------------------------------------------------------------------
function assertCoreExtractionGates(text: string, pageOne: string): void {
  // Mirror of infrastructure.test.ts Gate 0.1 (known strings).
  expect(text).toContain('John Smith');
  expect(text).toContain('Acme Corp');
  expect(text).toContain('March 15, 2024');
  expect(text).toContain('$42.5 million');
  expect(text).toContain('Board Members');
  // Mirror of Gate 0.2 (page-range isolation).
  expect(pageOne).toContain('John Smith');
  expect(pageOne).not.toContain('Board Members');
}

test('gate 10.2: core extraction assertions pass with PDF_ENGINE=pdfjs', async () => {
  process.env.PDF_ENGINE = 'pdfjs';
  assertCoreExtractionGates(await extractText(GOLDEN_MASTER), await extractText(GOLDEN_MASTER, 1, 1));
});

test.skipIf(!javaAvailable)(
  'gate 10.2: core extraction assertions pass with PDF_ENGINE=opendataloader',
  { timeout: 120000 },
  async () => {
    process.env.PDF_ENGINE = 'opendataloader';
    assertCoreExtractionGates(await extractText(GOLDEN_MASTER), await extractText(GOLDEN_MASTER, 1, 1));
  },
);

async function ingestAndAssertProvenance(engine: 'pdfjs' | 'opendataloader'): Promise<void> {
  const workspace = mkdtempSync(join(tmpdir(), `llm-wiki-phase10-${engine}-`));
  try {
    await init('test-wiki', { workspace });
    const wikiDir = join(workspace, 'wikis', 'test-wiki');
    copyFileSync(GOLDEN_MASTER, join(wikiDir, 'raw', 'golden-master.pdf'));
    process.env.PDF_ENGINE = engine;
    await ingest('test-wiki', { workspace, extract: false });
    const doc = readFileSync(join(wikiDir, 'documents', 'golden-master-part-001.md'), 'utf-8');
    const parsed = matter(doc);
    // pages: "N-M" citation provenance must hold under both engines (3-page
    // document, default 5 pages per chunk -> a single "1-3" chunk).
    expect(parsed.data.sources[0].pages).toBe('1-3');
    expect(doc).toContain('John Smith');
    expect(doc).toContain('$42.5 million');
    expect(doc).toContain('Board Members');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

test('gate 10.2: ingest provenance holds with PDF_ENGINE=pdfjs', { timeout: 60000 }, async () => {
  await ingestAndAssertProvenance('pdfjs');
});

test.skipIf(!javaAvailable)(
  'gate 10.2: ingest provenance holds with PDF_ENGINE=opendataloader',
  { timeout: 120000 },
  async () => {
    await ingestAndAssertProvenance('opendataloader');
  },
);

// ---------------------------------------------------------------------------
// Gate 10.3: Page Semantics Agree — for every corpus fixture + golden masters:
// page counts equal under both engines; per-page extractText(pdf, n, n)
// returns non-empty text for the same page set.
// ---------------------------------------------------------------------------
const ALL_DOCUMENTS: string[] = [
  ...manifest.fixtures.map((fixture) => join(CORPUS_DIR, fixture.filename)),
  GOLDEN_MASTER,
  GOLDEN_MASTER_DA,
];

test.skipIf(!javaAvailable)(
  'gate 10.3: page counts and per-page boundaries agree across engines',
  { timeout: 120000 },
  async () => {
    for (const pdfPath of ALL_DOCUMENTS) {
      const pdfjsCount = await pdfjs.getPageCount(pdfPath);
      const odlCount = await odl.getPageCount(pdfPath);
      expect(odlCount, `${pdfPath} page count`).toBe(pdfjsCount);
      for (let n = 1; n <= pdfjsCount; n++) {
        const pdfjsPage = await pdfjs.extractText(pdfPath, n, n);
        const odlPage = await odl.extractText(pdfPath, n, n);
        expect(
          odlPage.trim().length > 0,
          `${pdfPath} page ${n} non-empty agreement`,
        ).toBe(pdfjsPage.trim().length > 0);
      }
    }
  },
);

// Supplementary (batch surface): extractDocumentPages('pdfjs') is identical to
// the per-page extractText loop; ('opendataloader') matches its own per-page
// surface and needs exactly one batch conversion (cached per process).
test('gate 10.3 supplementary: extractDocumentPages matches the per-page surface', { timeout: 120000 }, async () => {
  const pageCount = await getPageCount(GOLDEN_MASTER);
  const perPage: string[] = [];
  for (let n = 1; n <= pageCount; n++) {
    perPage.push(await extractText(GOLDEN_MASTER, n, n));
  }
  expect(await extractDocumentPages(GOLDEN_MASTER, 'pdfjs')).toEqual(perPage);
  if (javaAvailable) {
    const odlBatch = await extractDocumentPages(GOLDEN_MASTER, 'opendataloader');
    expect(odlBatch.length).toBe(pageCount);
    for (let n = 1; n <= pageCount; n++) {
      expect(odlBatch[n - 1]).toBe(await odl.extractText(GOLDEN_MASTER, n, n));
    }
  }
});

// ---------------------------------------------------------------------------
// Gate 10.4: Engine Selection Precedence — CLI flag beats env beats settings
// beats default; invalid values throw listing the valid engines.
// ---------------------------------------------------------------------------
test('gate 10.4: resolvePdfEngine precedence flag > env > settings > default', () => {
  expect(resolvePdfEngine({})).toBe('pdfjs');
  expect(resolvePdfEngine({ settings: 'opendataloader' })).toBe('opendataloader');
  expect(resolvePdfEngine({ settings: 'opendataloader', env: 'pdfjs' })).toBe('pdfjs');
  expect(resolvePdfEngine({ settings: 'pdfjs', env: 'opendataloader', flag: 'pdfjs' })).toBe('pdfjs');
  expect(resolvePdfEngine({ env: 'pdfjs', flag: 'opendataloader' })).toBe('opendataloader');
  expect(() => resolvePdfEngine({ flag: 'not-an-engine' })).toThrow(
    /Unknown PDF engine 'not-an-engine'\. Valid engines: pdfjs, opendataloader\./,
  );
  expect(() => resolvePdfEngine({ env: 'OCR-please' })).toThrow(/Valid engines: pdfjs, opendataloader/);
});

// Gate 10.4 (end to end, verifier-found fix): the explicit `pdfEngine` flag
// must beat `PDF_ENGINE` through the WHOLE ingest — the pre-fix code resolved
// correctly but then routed the pdfjs branch through the env-only dispatcher,
// so `--pdf-engine pdfjs` could not override `PDF_ENGINE=opendataloader`.
// Engine-distinguishing evidence: on golden-master.pdf pdfjs renders the
// quarter table as a 4x3 markdown table (header `| Quarter | Revenue | Growth |`);
// opendataloader's blank line between header and rows breaks that detection
// (3x3) — see .state/pdf-engine-ab-report.md.
test.skipIf(!javaAvailable)(
  'gate 10.4: explicit pdfEngine flag beats PDF_ENGINE env end to end (ingest)',
  { timeout: 120000 },
  async () => {
    const run = async (env: string, flag: 'pdfjs' | 'opendataloader') => {
      const workspace = mkdtempSync(join(tmpdir(), 'llm-wiki-phase10-precedence-'));
      try {
        await init('test-wiki', { workspace });
        const wikiDir = join(workspace, 'wikis', 'test-wiki');
        copyFileSync(GOLDEN_MASTER, join(wikiDir, 'raw', 'golden-master.pdf'));
        process.env.PDF_ENGINE = env;
        const lines: string[] = [];
        await ingest('test-wiki', {
          workspace,
          extract: false,
          pdfEngine: flag,
          onProgress: (message) => lines.push(message),
        });
        const doc = readFileSync(join(wikiDir, 'documents', 'golden-master-part-001.md'), 'utf-8');
        return { doc, lines: lines.join('\n') };
      } finally {
        rmSync(workspace, { recursive: true, force: true });
      }
    };

    // env says opendataloader, flag says pdfjs -> pdfjs output must win.
    const pdfjsRun = await run('opendataloader', 'pdfjs');
    expect(pdfjsRun.lines).toContain('PDF engine: pdfjs');
    expect(pdfjsRun.doc).toContain('| Quarter | Revenue | Growth |');

    // env says pdfjs, flag says opendataloader -> opendataloader output must win.
    const odlRun = await run('pdfjs', 'opendataloader');
    expect(odlRun.lines).toContain('PDF engine: opendataloader');
    expect(odlRun.doc).not.toContain('| Quarter | Revenue | Growth |');
    expect(odlRun.doc).toContain('Quarter'); // content extracted; only the table shape differs
  },
);

// ---------------------------------------------------------------------------
// Gate 10.5: Missing-JRE Handling — explicit opendataloader selection without
// Java rejects with the documented actionable message; the default resolution
// still extracts via pdfjs fine. Java absence is simulated two ways: a PATH
// override pointing at an empty temp dir (probe level), and a test-only forced
// probe result (engine-gate level).
// ---------------------------------------------------------------------------
test('gate 10.5: explicit opendataloader without java fails with the actionable error', { timeout: 60000 }, async () => {
  const emptyBin = mkdtempSync(join(tmpdir(), 'llm-wiki-no-java-'));
  try {
    // Probe level: an empty PATH cannot resolve `java`.
    expect(await hasJavaRuntime(emptyBin)).toBe(false);
    // Engine-gate level: force the cached probe result downstream code sees.
    setJavaRuntimeOverrideForTests(false);
    expect(await hasJavaRuntime()).toBe(false);

    process.env.PDF_ENGINE = 'opendataloader';
    await expect(extractText(GOLDEN_MASTER)).rejects.toThrow(MISSING_JAVA_MESSAGE);
    // The exact documented message (no wrapper text) from the engine itself.
    await expect(odl.extractText(GOLDEN_MASTER)).rejects.toThrow(
      /^PDF engine 'opendataloader' requires Java 11\+\./,
    );

    // Default resolution (env unset) still extracts via pdfjs fine.
    delete process.env.PDF_ENGINE;
    const text = await extractText(GOLDEN_MASTER);
    expect(text).toContain('John Smith');
  } finally {
    rmSync(emptyBin, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Gate 10.6: A/B Corpus Integrity — every test-pdfs/ab-corpus/*.pdf has a
// manifest entry whose sha256 matches; both engines extract without throwing.
// ---------------------------------------------------------------------------
test('gate 10.6: every corpus fixture has a manifest entry with a matching sha256', async () => {
  const onDisk = readdirSync(CORPUS_DIR).filter((file) => file.endsWith('.pdf'));
  expect(onDisk.length).toBe(manifest.fixtures.length);
  for (const file of onDisk) {
    const entry = manifest.fixtures.find((fixture) => fixture.filename === file);
    expect(entry, `manifest entry for ${file}`).toBeDefined();
    expect(await sha256(join(CORPUS_DIR, file))).toBe(entry!.sha256);
    expect(await pdfjs.getPageCount(join(CORPUS_DIR, file))).toBe(entry!.pageCount);
  }
});

test('gate 10.6: pdfjs extracts every corpus fixture without throwing', async () => {
  for (const fixture of manifest.fixtures) {
    const text = await pdfjs.extractText(join(CORPUS_DIR, fixture.filename));
    expect(typeof text).toBe('string');
  }
});

test.skipIf(!javaAvailable)(
  'gate 10.6: opendataloader extracts every corpus fixture without throwing',
  { timeout: 120000 },
  async () => {
    for (const fixture of manifest.fixtures) {
      const text = await odl.extractText(join(CORPUS_DIR, fixture.filename));
      expect(typeof text).toBe('string');
    }
  },
);

// ---------------------------------------------------------------------------
// Gate 10.7: Comparison Harness Emits a Report — run the harness CLI on a
// 2-fixture subset into a temp output location and assert the report contains
// the expected-string, table, diacritics, page-alignment, and timing sections.
// (The harness is spawned as a subprocess: scripts/AGENTS.md forbids importing
// scripts from tests.)
// ---------------------------------------------------------------------------
test.skipIf(!javaAvailable)(
  'gate 10.7: compare-pdf-engines writes a report with all metric sections',
  { timeout: 120000 },
  async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'llm-wiki-ab-report-'));
    try {
      const reportPath = join(outDir, 'report.md');
      const jsonPath = join(outDir, 'report.json');
      const tsxCli = resolve('node_modules', 'tsx', 'dist', 'cli.mjs');
      // Strip VITEST from the child env: the harness's direct-execution guard
      // (same pattern as src/cli.ts) refuses to run when VITEST is set.
      const childEnv = { ...process.env };
      delete childEnv.VITEST;
      const exitCode = await new Promise<number>((resolvePromise, rejectPromise) => {
        const child = spawn(
          process.execPath,
          [
            tsxCli,
            'scripts/compare-pdf-engines.ts',
            '--subset',
            'tables,danish-diacritics',
            '--report',
            reportPath,
            '--json',
            jsonPath,
          ],
          { shell: false, stdio: 'ignore', env: childEnv },
        );
        child.on('error', rejectPromise);
        child.on('close', (code) => resolvePromise(code ?? 1));
      });
      expect(exitCode).toBe(0);

      const report = readFileSync(reportPath, 'utf-8');
      expect(report).toContain('Expected strings:'); // expected-string section
      expect(report).toContain('Table fidelity'); // table section (tables.pdf is in the subset)
      expect(report).toContain('Diacritics integrity:'); // diacritics section
      expect(report).toContain('Page alignment:'); // page-alignment section
      expect(report).toContain('Wall time'); // timing section
      expect(report).toContain('Recommendation');

      const json = JSON.parse(readFileSync(jsonPath, 'utf-8')) as {
        javaAvailable: boolean;
        totals: { documents: number };
        documents: Array<{ filename: string }>;
      };
      expect(json.javaAvailable).toBe(true);
      expect(json.totals.documents).toBe(2);
      expect(json.documents.map((doc) => doc.filename).sort()).toEqual([
        'danish-diacritics.pdf',
        'tables.pdf',
      ]);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  },
);

// ---------------------------------------------------------------------------
// §3.5 renderTablesAsMarkdown interplay (open question -> Option A evidence):
// the heuristic stays ON for both engines. Proof on the table corpus fixture:
// for BOTH engines every whitespace-separated token of the raw extraction
// survives rendering (the heuristic only inserts table syntax — it never
// drops or rewrites a word), and the borderless table is detected under both.
// ---------------------------------------------------------------------------
test('§3.5: renderTablesAsMarkdown preserves every word under both engines (Option A)', { timeout: 120000 }, async () => {
  const tablesPdf = join(CORPUS_DIR, 'tables.pdf');
  const outputs: Array<{ engine: string; text: string }> = [
    { engine: 'pdfjs', text: await pdfjs.extractText(tablesPdf) },
  ];
  if (javaAvailable) {
    outputs.push({ engine: 'opendataloader', text: await odl.extractText(tablesPdf) });
  }
  for (const { engine, text } of outputs) {
    const rendered = renderTablesAsMarkdown(text);
    const tokens = text.split(/\s+/).filter((token) => token.length > 0);
    for (const token of tokens) {
      expect(rendered.text, `${engine} token '${token}' preserved`).toContain(token);
    }
    // The borderless Product/Price/Stock table is a clean 3-line run under
    // both engines (pdfjs natively, opendataloader via keepLineBreaks) and is
    // rendered as a markdown table.
    expect(rendered.tablesFound, `${engine} detects the borderless table`).toBeGreaterThanOrEqual(1);
    expect(rendered.text).toContain('| Product | Price | Stock |');
  }
});
