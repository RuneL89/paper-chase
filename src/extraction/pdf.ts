import { readFile } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// Point pdfjs at its bundled standard fonts so it does not warn about a
// missing standardFontDataUrl. Resolved relative to the installed
// pdfjs-dist package so it works regardless of the current working directory.
function resolveStandardFontDataUrl(): string | undefined {
  try {
    const pdfModulePath = fileURLToPath(import.meta.resolve('pdfjs-dist/legacy/build/pdf.mjs'));
    // <pkg>/legacy/build/pdf.mjs -> <pkg>/standard_fonts/
    return join(dirname(pdfModulePath), '..', '..', 'standard_fonts') + sep;
  } catch {
    return undefined;
  }
}

const standardFontDataUrl = resolveStandardFontDataUrl();

/**
 * Open a PDF with the shared Phase 0 loader options. Callers must
 * `await doc.destroy()` when done.
 */
async function openDocument(pdfPath: string): Promise<PDFDocumentProxy> {
  const data = new Uint8Array(await readFile(pdfPath));
  return getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0, // errors only
    ...(standardFontDataUrl ? { standardFontDataUrl } : {}),
  }).promise;
}

/**
 * Extract plain text from a PDF.
 *
 * Pages are never split: `startPage`/`endPage` (1-based, inclusive) select a
 * whole-page range; omitting them extracts every page. Line breaks are
 * preserved using each text item's `hasEOL` flag and page content is joined
 * with newlines.
 */
export async function extractText(pdfPath: string, startPage?: number, endPage?: number): Promise<string> {
  const doc = await openDocument(pdfPath);

  try {
    const first = startPage ?? 1;
    const last = Math.min(endPage ?? doc.numPages, doc.numPages);
    const pages: string[] = [];

    for (let pageNumber = first; pageNumber <= last; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      let text = '';
      for (const item of content.items) {
        if ('str' in item) {
          text += item.str;
          if (item.hasEOL) {
            text += '\n';
          }
        }
      }
      pages.push(text);
    }

    return pages.join('\n');
  } finally {
    await doc.destroy();
  }
}

/**
 * Return the number of pages in a PDF.
 *
 * Additive Phase 1 helper: the frozen Phase 0 `extractText` surface is
 * unchanged; ingestion needs the page count up front to plan page-range
 * chunks without splitting a page.
 */
export async function getPageCount(pdfPath: string): Promise<number> {
  const doc = await openDocument(pdfPath);
  try {
    return doc.numPages;
  } finally {
    await doc.destroy();
  }
}
