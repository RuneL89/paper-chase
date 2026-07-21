import { resolvePdfEngine, type PdfEngine } from './engine';
import * as pdfjs from './pdf-pdfjs';
import * as opendataloader from './pdf-opendataloader';

/**
 * Phase 10: thin dispatcher over the pluggable PDF extraction engines.
 *
 * The frozen Phase 0 surface (`extractText`, `getPageCount`) keeps its exact
 * signatures and resolves the engine from `process.env.PDF_ENGINE` ONLY
 * (default pdfjs) — this module must not know about workspaces, CLI flags, or
 * settings files. Callers with richer context (CLI flag, settings) resolve
 * the engine themselves via `resolvePdfEngine` and use the additive
 * `extractDocumentPages` batch surface, or pass the flag through
 * `IngestOptions.pdfEngine`.
 *
 * With no engine configuration the pdfjs path is byte-identical to the
 * pre-Phase-10 implementation (Gate 10.1).
 */
export { resolvePdfEngine, VALID_PDF_ENGINES, type PdfEngine } from './engine';

function engineFromEnv(): PdfEngine {
  return resolvePdfEngine({ env: process.env.PDF_ENGINE });
}

/**
 * Extract plain text from a PDF (frozen Phase 0 signature).
 *
 * Pages are never split: `startPage`/`endPage` (1-based, inclusive) select a
 * whole-page range; omitting them extracts every page. Page content is joined
 * with newlines. Engine: `PDF_ENGINE` env var, default pdfjs.
 */
export async function extractText(pdfPath: string, startPage?: number, endPage?: number): Promise<string> {
  const engine = engineFromEnv();
  return engine === 'opendataloader'
    ? opendataloader.extractText(pdfPath, startPage, endPage)
    : pdfjs.extractText(pdfPath, startPage, endPage);
}

/**
 * Return the number of pages in a PDF (additive Phase 1 helper, frozen
 * surface). Both engines agree on the page count (Gate 10.3); the
 * opendataloader engine reuses the cheap pdfjs count.
 */
export async function getPageCount(pdfPath: string): Promise<number> {
  const engine = engineFromEnv();
  return engine === 'opendataloader'
    ? opendataloader.getPageCount(pdfPath)
    : pdfjs.getPageCount(pdfPath);
}

/**
 * Additive Phase 10 batch surface: extract every page's text as a 0-indexed
 * array (`result[n]` is page n+1). For 'pdfjs' this loops the pdfjs per-page
 * extraction (strings identical to per-page `extractText` calls); for
 * 'opendataloader' it uses the single-convert batch path (one JVM spawn per
 * document, cached per process). Used by ingest when an engine is explicitly
 * resolved so the per-page frozen surface never spawns a JVM per page.
 */
export async function extractDocumentPages(pdfPath: string, engine?: PdfEngine): Promise<string[]> {
  const resolved = engine ?? engineFromEnv();
  if (resolved === 'opendataloader') {
    const pages = await opendataloader.extractAllPages(pdfPath);
    return pages.slice(1);
  }
  const pageCount = await pdfjs.getPageCount(pdfPath);
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    pages.push(await pdfjs.extractText(pdfPath, pageNumber, pageNumber));
  }
  return pages;
}
