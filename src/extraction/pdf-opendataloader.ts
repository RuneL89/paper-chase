import { stat } from 'node:fs/promises';
import { convert } from '@opendataloader/pdf';
import { getPageCount as getPdfjsPageCount } from './pdf-pdfjs';
import { hasJavaRuntime, MISSING_JAVA_MESSAGE } from './engine';

/**
 * Phase 10: opendataloader-pdf extraction engine (strictly opt-in).
 *
 * The Node SDK wraps a bundled Java CLI (`java -jar opendataloader-pdf-cli.jar`),
 * so a JRE (Java 11+) on PATH is a hard requirement. Every public function
 * probes for Java first and throws the documented actionable error when it is
 * missing — selecting this engine without a JRE must never crash or hang.
 *
 * Performance decision (phase doc §3.4, open question 1): ONE `convert()` call
 * per document, split into per-page strings via `textPageSeparator` with
 * `%page-number%`. The frozen per-page surface (`extractText(pdf, n, n)`)
 * delegates to a per-process cache of that batch result so ingest never spawns
 * a JVM per page.
 *
 * Page counting (open question 3): pdfjs is reused — it is cheap, pure JS, and
 * introduces no second JVM spawn; the batch output is validated against it.
 */

const PAGE_MARKER = '<<<OPENDATALOADER-PAGE-%page-number%>>>';
const PAGE_SEPARATOR = `\n${PAGE_MARKER}\n`;
// The CLI echoes the separator literally with the page number substituted.
const PAGE_SPLIT_RE = /\n<<<OPENDATALOADER-PAGE-(\d+)>>>\n/g;

interface CacheEntry {
  key: string;
  pages: Promise<string[]>;
}

/** Per-process batch cache: one JVM spawn per (path, mtimeMs, size). */
const batchCache = new Map<string, CacheEntry>();

async function cacheKeyFor(pdfPath: string): Promise<string> {
  const info = await stat(pdfPath);
  return `${info.mtimeMs}:${info.size}`;
}

/**
 * Extract every page of a PDF in a single opendataloader `convert()` call.
 * Returns a 1-indexed array (`pages[n]` is page n's text; index 0 is unused).
 */
export async function extractAllPages(pdfPath: string): Promise<string[]> {
  // The JRE gate runs BEFORE the cache lookup: an explicit opendataloader
  // selection without Java must fail with the actionable error every time,
  // never silently succeed from a cache populated when Java was present.
  if (!(await hasJavaRuntime())) {
    throw new Error(MISSING_JAVA_MESSAGE);
  }
  const key = await cacheKeyFor(pdfPath);
  const cached = batchCache.get(pdfPath);
  if (cached && cached.key === key) {
    return cached.pages;
  }
  const pages = runBatch(pdfPath);
  // Evict failures so a transient error (e.g. a JVM hiccup) can be retried.
  pages.catch(() => {
    if (batchCache.get(pdfPath)?.pages === pages) {
      batchCache.delete(pdfPath);
    }
  });
  batchCache.set(pdfPath, { key, pages });
  return pages;
}

async function runBatch(pdfPath: string): Promise<string[]> {
  let stdout: string;
  try {
    stdout = await convert(pdfPath, {
      format: 'text',
      toStdout: true,
      quiet: true,
      // Keep per-line breaks so the output stays line-oriented like the pdfjs
      // engine (the renderTablesAsMarkdown heuristic and chunk prose were
      // built around line breaks; opendataloader's default joins lines into
      // paragraphs). All other options stay at SDK defaults (§3.2 scope).
      keepLineBreaks: true,
      textPageSeparator: PAGE_SEPARATOR,
    });
  } catch (err) {
    throw new Error(
      `opendataloader-pdf failed to extract '${pdfPath}': ${(err as Error).message}`,
    );
  }

  // Split stdout on the page markers into a 1-indexed page-number -> text map.
  const byPage = new Map<number, string>();
  const matches = [...stdout.matchAll(PAGE_SPLIT_RE)];
  for (let i = 0; i < matches.length; i++) {
    const pageNumber = Number(matches[i][1]);
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : stdout.length;
    byPage.set(pageNumber, stdout.slice(start, end));
  }

  if (byPage.size === 0) {
    throw new Error(
      `opendataloader-pdf produced no page markers for '${pdfPath}' — unexpected CLI output.`,
    );
  }

  const expectedCount = await getPdfjsPageCount(pdfPath);
  if (byPage.size !== expectedCount) {
    throw new Error(
      `opendataloader-pdf page-count mismatch for '${pdfPath}': got ${byPage.size} page(s), ` +
        `pdfjs reports ${expectedCount}. Page fidelity is required for citation provenance.`,
    );
  }

  const pages: string[] = new Array<string>(expectedCount + 1).fill('');
  for (const [pageNumber, text] of byPage) {
    pages[pageNumber] = text;
  }
  return pages;
}

/**
 * Extract plain text from a PDF with the opendataloader engine.
 *
 * Mirrors the pdfjs semantics exactly: pages are never split; `startPage`/
 * `endPage` (1-based, inclusive) select a whole-page range; omitting them
 * extracts every page; `endPage` clamps to the page count; pages join with
 * `'\n'`.
 */
export async function extractText(pdfPath: string, startPage?: number, endPage?: number): Promise<string> {
  const pages = await extractAllPages(pdfPath);
  const pageCount = pages.length - 1;
  const first = startPage ?? 1;
  const last = Math.min(endPage ?? pageCount, pageCount);
  const selected: string[] = [];
  for (let pageNumber = first; pageNumber <= last; pageNumber++) {
    selected.push(pages[pageNumber]);
  }
  return selected.join('\n');
}

/**
 * Page counting reuses the pdfjs implementation (cheap, pure JS, no JVM
 * spawn); the batch extraction validates its page count against this value.
 */
export async function getPageCount(pdfPath: string): Promise<number> {
  return getPdfjsPageCount(pdfPath);
}

/** Test-only: clear the per-process batch cache. */
export function resetOpenDataLoaderCache(): void {
  batchCache.clear();
}
