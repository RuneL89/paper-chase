import { readFile } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

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
 * Extract plain text from a PDF.
 *
 * Pages are never split: `startPage`/`endPage` (1-based, inclusive) select a
 * whole-page range; omitting them extracts every page. Line breaks are
 * preserved using each text item's `hasEOL` flag and page content is joined
 * with newlines.
 */
export async function extractText(pdfPath: string, startPage?: number, endPage?: number): Promise<string> {
  const data = new Uint8Array(await readFile(pdfPath));
  const doc = await getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0, // errors only
    ...(standardFontDataUrl ? { standardFontDataUrl } : {}),
  }).promise;

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
