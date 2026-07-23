import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { appRoot, isPackaged } from '../utils/app-root';

// Point pdfjs at its bundled standard fonts so it does not warn about a
// missing standardFontDataUrl. Resolved relative to the installed
// pdfjs-dist package so it works regardless of the current working directory;
// inside the packaged exe the fonts are a pkg snapshot asset (package.json
// "pkg.assets") under the application root.
function resolveStandardFontDataUrl(): string | undefined {
  if (isPackaged()) {
    return join(appRoot(), 'node_modules', 'pdfjs-dist', 'standard_fonts') + sep;
  }
  try {
    const pdfModulePath = fileURLToPath(import.meta.resolve('pdfjs-dist/legacy/build/pdf.mjs'));
    // <pkg>/legacy/build/pdf.mjs -> <pkg>/standard_fonts/
    return join(dirname(pdfModulePath), '..', '..', 'standard_fonts') + sep;
  } catch {
    // CJS bundle without pkg (node dist/chase.cjs): import.meta is empty.
    const bundled = join(appRoot(), 'node_modules', 'pdfjs-dist', 'standard_fonts') + sep;
    return existsSync(bundled) ? bundled : undefined;
  }
}

const standardFontDataUrl = resolveStandardFontDataUrl();

/**
 * The pdf.js fake worker normally loads its worker module with a dynamic
 * import(), which pkg's packaged context does not support ("A dynamic import
 * callback was not specified."). pdf.js skips that import entirely when
 * globalThis.pdfjsWorker.WorkerMessageHandler is already present, so the
 * packaged exe materializes the self-contained CJS worker build (snapshot
 * asset dist/pdf.worker.cjs) to the real filesystem once and require()s it —
 * executing it registers the global. Dev and tests keep pdf.js's default
 * node_modules resolution untouched.
 */
function configurePackagedWorker(): void {
  if (!isPackaged()) {
    return;
  }
  try {
    const targetDir = join(tmpdir(), 'paper-chase');
    const target = join(targetDir, 'pdf.worker.cjs');
    if (!existsSync(target)) {
      mkdirSync(targetDir, { recursive: true });
      copyFileSync(join(appRoot(), 'dist', 'pdf.worker.cjs'), target);
    }
    const req = createRequire(import.meta.url || process.argv[1]);
    const worker = req(target) as { WorkerMessageHandler?: unknown };
    const g = globalThis as { pdfjsWorker?: { WorkerMessageHandler?: unknown } };
    if (!g.pdfjsWorker?.WorkerMessageHandler && worker.WorkerMessageHandler) {
      g.pdfjsWorker = { WorkerMessageHandler: worker.WorkerMessageHandler };
    }
  } catch {
    // Leave the default; getDocument will surface a descriptive error.
  }
}

configurePackagedWorker();

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
