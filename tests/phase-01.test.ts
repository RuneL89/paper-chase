import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import matter from 'gray-matter';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { init } from '../src/commands/init';
import { ingest } from '../src/commands/ingest';
import { sha256 } from '../src/utils/hash';

const GOLDEN_MASTER = 'test-pdfs/golden-master.pdf';

/**
 * Phase 1 gates (Implementation Plan/PHASE_01_raw_document_pages.md §3).
 *
 * Hermeticity deviation (preferred per the Implementer brief): instead of
 * creating `wikis/test-wiki` in the repo, every gate runs against a temp
 * workspace via the `workspace` option and the temp tree is destroyed in
 * teardown. The gate assertions themselves are verbatim from the phase doc.
 */
let workspace: string;
let wikiDir: string;

beforeAll(async () => {
  workspace = mkdtempSync(join(tmpdir(), 'llm-wiki-phase1-'));
  wikiDir = join(workspace, 'wikis', 'test-wiki');
  // Setup for gates 1.2-1.9: create the wiki, copy the golden master into
  // raw/ (never modify the golden master itself), first ingest run.
  await init('test-wiki', { workspace });
  copyFileSync(GOLDEN_MASTER, join(wikiDir, 'raw', 'golden-master.pdf'));
  await ingest('test-wiki', { workspace });
}, 60000);

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

/** Create a PDF fixture. A null entry in `pages` produces a blank page. */
async function createPdf(filePath: string, pages: Array<string[] | null>): Promise<void> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) {
    const page = doc.addPage([612, 792]);
    let y = 720;
    for (const line of lines ?? []) {
      page.drawText(line, { x: 72, y, size: 12, font });
      y -= 16;
    }
  }
  writeFileSync(filePath, await doc.save());
}

// Gate 1.1: init Creates Correct Structure
test('init creates wiki structure', async () => {
  expect(existsSync(join(wikiDir, 'raw'))).toBe(true);
  expect(existsSync(join(wikiDir, 'documents'))).toBe(true);
  expect(existsSync(join(wikiDir, 'sources'))).toBe(true);
  expect(existsSync(join(wikiDir, 'entities'))).toBe(true);
  expect(existsSync(join(wikiDir, 'topics'))).toBe(true);
  expect(existsSync(join(wikiDir, '.state'))).toBe(true);
  expect(existsSync(join(wikiDir, 'AGENTS.md'))).toBe(true);
});

// Gate 1.2: ingest Writes Document Pages
test('ingest writes document pages for each chunk', async () => {
  expect(existsSync(join(wikiDir, 'documents', 'golden-master-part-001.md'))).toBe(true);
});

// Gate 1.3: Document Page Contains All Raw Text
test('document page contains all text from PDF', async () => {
  const doc = readFileSync(join(wikiDir, 'documents', 'golden-master-part-001.md'), 'utf-8');
  expect(doc).toContain('John Smith');
  expect(doc).toContain('Acme Corp');
  expect(doc).toContain('March 15, 2024');
  expect(doc).toContain('$42.5 million');
  expect(doc).toContain('Board Members');
});

// Gate 1.4: Document Page Preserves Tables
test('document page preserves table from PDF', async () => {
  const doc = readFileSync(join(wikiDir, 'documents', 'golden-master-part-001.md'), 'utf-8');
  expect(doc).toContain('|'); // markdown table syntax
  expect(doc).toContain('Revenue'); // table header from golden master
  // Supplementary: the golden master's Revenue-by-Quarter table is rendered
  // as a real markdown table (see deviations: pdfjs collapses column
  // whitespace, so a deterministic renderer rebuilds the table).
  expect(doc).toContain('| Quarter | Revenue | Growth |');
  expect(doc).toContain('| Q1 | $9.8M | +4% |');
});

// Gate 1.5: Document Page Has Valid Frontmatter
test('document page has valid YAML frontmatter', async () => {
  const doc = readFileSync(join(wikiDir, 'documents', 'golden-master-part-001.md'), 'utf-8');
  const parsed = matter(doc);
  expect(parsed.data.type).toBe('document');
  expect(parsed.data.sources[0].file).toContain('golden-master.pdf');
  expect(parsed.data.sources[0].pages).toBe('1-3'); // golden master has 3 pages (< 5 per chunk)
  // Supplementary: full phase doc §2.2 frontmatter shape + compliance-note fields.
  expect(parsed.data.title).toBe('golden-master-part-001');
  expect(parsed.data.wiki).toBe('test-wiki');
  expect(parsed.data.updated).toBeTruthy();
  expect(parsed.data.sources[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(parsed.data.sources[0].extracted).toBeTruthy();
});

// Gate 1.6: Source Page Has Correct Hash
test('source page contains correct SHA-256', async () => {
  const source = readFileSync(join(wikiDir, 'sources', 'golden-master.md'), 'utf-8');
  const expectedHash = await sha256(GOLDEN_MASTER);
  expect(source).toContain(expectedHash);
});

// Gate 1.7: Re-Running Ingest is Idempotent
test('re-running ingest does not duplicate pages', async () => {
  await ingest('test-wiki', { workspace }); // second run
  await ingest('test-wiki', { workspace }); // third run
  const files = readdirSync(join(wikiDir, 'documents'));
  expect(files.filter((f) => f.startsWith('golden-master'))).toHaveLength(1);
});

// Gate 1.8: Re-Running Ingest is Fast for Unchanged PDFs
test('re-running ingest skips unchanged PDFs', async () => {
  const start = Date.now();
  await ingest('test-wiki', { workspace });
  expect(Date.now() - start).toBeLessThan(1000); // should be near-instant
});

// Gate 1.9: State File is Valid JSON
test('ingestion state is valid JSON', async () => {
  const state = JSON.parse(readFileSync(join(wikiDir, '.state', 'ingestion.json'), 'utf-8'));
  expect(state.sources['golden-master']).toBeDefined();
  expect(state.sources['golden-master'].hash).toBeTruthy();
  expect(state.sources['golden-master'].documentPages).toHaveLength(1);
});

// ---- Supplementary tests (trace phase doc §2.1-§2.4 and UAT expectations) ----

// §2.1: AGENTS.md is generated from the template with placeholders replaced.
test('init generates AGENTS.md with all placeholders replaced', async () => {
  await init('titled-wiki', { workspace, title: 'Titled Wiki' });
  const agents = readFileSync(join(workspace, 'wikis', 'titled-wiki', 'AGENTS.md'), 'utf-8');
  expect(agents).not.toContain('{{');
  expect(agents).not.toContain('}}');
  expect(agents).toContain('Titled Wiki');
  expect(agents).toContain('titled-wiki');
});

// §2.1: invalid slugs and existing wikis are rejected (path-safety).
test('init rejects invalid slugs and duplicate wikis', async () => {
  await expect(init('Bad Slug!', { workspace })).rejects.toThrow('Invalid wiki slug');
  await expect(init('../escape', { workspace })).rejects.toThrow('Invalid wiki slug');
  await expect(init('test-wiki', { workspace })).rejects.toThrow('already exists');
});

// §2.2: ingest requires an existing wiki.
test('ingest fails clearly when the wiki does not exist', async () => {
  await expect(ingest('missing-wiki', { workspace })).rejects.toThrow("Wiki 'missing-wiki' not found");
});

// UAT 1.5: re-running reports the skip on the progress channel.
test('re-running ingest prints "Skipping <file> (unchanged)"', async () => {
  const lines: string[] = [];
  await ingest('test-wiki', { workspace, onProgress: (line) => lines.push(line) });
  expect(lines).toContain('Skipping golden-master.pdf (unchanged)');
});

// §2.2 chunking rules: 12-page PDF with the 5-page default -> 3 chunks
// (pages 1-5, 6-10, 11-12); a page is never split; 3-digit part padding.
test('ingest chunks consecutive pages without splitting a page', async () => {
  const rawDir = join(wikiDir, 'raw');
  await createPdf(
    join(rawDir, 'twelve-pager.pdf'),
    Array.from({ length: 12 }, (_, i) => [`Report page ${i + 1}`, `Content line for page ${i + 1} here`]),
  );
  await ingest('test-wiki', { workspace });

  const documents = readdirSync(join(wikiDir, 'documents')).filter((f) => f.startsWith('twelve-pager'));
  expect(documents.sort()).toEqual(['twelve-pager-part-001.md', 'twelve-pager-part-002.md', 'twelve-pager-part-003.md']);

  const part1 = matter(readFileSync(join(wikiDir, 'documents', 'twelve-pager-part-001.md'), 'utf-8'));
  const part2 = matter(readFileSync(join(wikiDir, 'documents', 'twelve-pager-part-002.md'), 'utf-8'));
  const part3 = matter(readFileSync(join(wikiDir, 'documents', 'twelve-pager-part-003.md'), 'utf-8'));
  expect(part1.data.sources[0].pages).toBe('1-5');
  expect(part2.data.sources[0].pages).toBe('6-10');
  expect(part3.data.sources[0].pages).toBe('11-12');
  expect(part3.content).toContain('Report page 12');

  const state = JSON.parse(readFileSync(join(wikiDir, '.state', 'ingestion.json'), 'utf-8'));
  expect(state.sources['twelve-pager'].documentPages).toHaveLength(3);

  // §2.4: the source page links every document page.
  const source = readFileSync(join(wikiDir, 'sources', 'twelve-pager.md'), 'utf-8');
  expect(source).toContain('[[twelve-pager-part-001]]');
  expect(source).toContain('[[twelve-pager-part-002]]');
  expect(source).toContain('[[twelve-pager-part-003]]');
  expect(matter(source).data.pages).toBe(12);
}, 60000);

// §2.2: chunk size is configurable (fresh wiki: hash-based skipping
// intentionally ignores option changes for already-ingested PDFs).
test('chunk size is configurable via pagesPerChunk', async () => {
  await init('chunk-wiki', { workspace });
  const chunkWikiDir = join(workspace, 'wikis', 'chunk-wiki');
  await createPdf(
    join(chunkWikiDir, 'raw', 'dozen.pdf'),
    Array.from({ length: 12 }, (_, i) => [`Dozen page ${i + 1}`]),
  );
  await ingest('chunk-wiki', { workspace, pagesPerChunk: 4 });
  const state = JSON.parse(readFileSync(join(chunkWikiDir, '.state', 'ingestion.json'), 'utf-8'));
  expect(state.sources['dozen'].documentPages).toHaveLength(3); // 12 / 4 = 3
  const part1 = matter(readFileSync(join(chunkWikiDir, 'documents', 'dozen-part-001.md'), 'utf-8'));
  const part3 = matter(readFileSync(join(chunkWikiDir, 'documents', 'dozen-part-003.md'), 'utf-8'));
  expect(part1.data.sources[0].pages).toBe('1-4');
  expect(part3.data.sources[0].pages).toBe('9-12');
}, 60000);

// Idempotency with a CHANGED PDF: re-ingesting a shorter replacement removes
// stale chunk files instead of duplicating or orphaning pages.
test('re-ingesting a changed PDF rewrites its pages and removes stale chunks', async () => {
  const rawDir = join(wikiDir, 'raw');
  await createPdf(
    join(rawDir, 'changing.pdf'),
    Array.from({ length: 12 }, (_, i) => [`Changing report page ${i + 1}`]),
  );
  await ingest('test-wiki', { workspace });
  expect(
    readdirSync(join(wikiDir, 'documents')).filter((f) => f.startsWith('changing')).sort(),
  ).toEqual(['changing-part-001.md', 'changing-part-002.md', 'changing-part-003.md']);

  // Replace with a shorter PDF (different bytes -> different hash).
  await createPdf(
    join(rawDir, 'changing.pdf'),
    Array.from({ length: 7 }, (_, i) => [`Changing report v2 page ${i + 1}`]),
  );
  await ingest('test-wiki', { workspace });

  const files = readdirSync(join(wikiDir, 'documents')).filter((f) => f.startsWith('changing'));
  expect(files.sort()).toEqual(['changing-part-001.md', 'changing-part-002.md']);
  const state = JSON.parse(readFileSync(join(wikiDir, '.state', 'ingestion.json'), 'utf-8'));
  expect(state.sources['changing'].documentPages).toHaveLength(2);
  const part2 = matter(readFileSync(join(wikiDir, 'documents', 'changing-part-002.md'), 'utf-8'));
  expect(part2.data.sources[0].pages).toBe('6-7');
  expect(part2.content).toContain('Changing report v2 page 7');
}, 60000);

// §2.4: extraction warnings (a page that extracted to empty text) are
// recorded on the source page.
test('source page records warnings for pages that extract to empty text', async () => {
  const rawDir = join(wikiDir, 'raw');
  await createPdf(join(rawDir, 'scanned.pdf'), [['Scanned intro page'], null, ['Last page']]);
  await ingest('test-wiki', { workspace });

  const source = readFileSync(join(wikiDir, 'sources', 'scanned.md'), 'utf-8');
  const parsed = matter(source);
  expect(parsed.data.warnings).toContain('Page 2 extracted to empty text');
  expect(source).toContain('## Warnings');
}, 60000);
