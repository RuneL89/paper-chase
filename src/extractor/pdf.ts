import { createHash } from 'crypto';
import { readFileSync, statSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';
import type {
  ExtractedPage,
  ExtractedTable,
  ExtractedTextItem,
  ExtractionResult,
  PdfMetadata,
} from './types.js';

// pdfjs-dist v4 legacy build runs without a worker in Node.js.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const require = createRequire(import.meta.url);
const PDFJS_DIST_DIR = path.dirname(require.resolve('pdfjs-dist/package.json'));
const STANDARD_FONT_DATA_URL =
  pathToFileURL(path.join(PDFJS_DIST_DIR, 'standard_fonts')).href + '/';

interface PdfjsTextItem {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
  hasEOL: boolean;
}

function isTextItem(item: unknown): item is PdfjsTextItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    'str' in item &&
    typeof (item as Record<string, unknown>).str === 'string'
  );
}

function toExtractedItem(item: PdfjsTextItem): ExtractedTextItem {
  return {
    text: item.str,
    x: item.transform[4] ?? 0,
    y: item.transform[5] ?? 0,
    width: item.width,
    height: item.height,
    fontName: item.fontName,
    hasEOL: item.hasEOL,
  };
}

function readingOrder(items: ExtractedTextItem[]): ExtractedTextItem[] {
  return [...items].sort((a, b) => {
    // Top-to-bottom first, then left-to-right.
    const yDelta = b.y - a.y;
    if (Math.abs(yDelta) > 3) return yDelta;
    return a.x - b.x;
  });
}

function detectScanned(items: ExtractedTextItem[], text: string): boolean {
  // A page with no text items or very little text is likely image-only/scanned.
  return items.length === 0 || text.trim().length < 10;
}

function normalizeMetadata(metadata: unknown): PdfMetadata {
  const typed = metadata as { info?: Record<string, unknown> } | undefined;
  const info = typed?.info ?? {};
  return {
    title: typeof info.Title === 'string' ? info.Title : undefined,
    author: typeof info.Author === 'string' ? info.Author : undefined,
    subject: typeof info.Subject === 'string' ? info.Subject : undefined,
    creationDate:
      typeof info.CreationDate === 'string' ? info.CreationDate : undefined,
  };
}

function sha256(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function roundCoordinate(value: number, precision = 1): number {
  return Math.round(value / precision) * precision;
}

function detectTables(pages: ExtractedPage[]): ExtractedTable[] {
  const tables: ExtractedTable[] = [];

  for (const page of pages) {
    if (page.items.length < 4) continue;

    // Group items by approximate row (y coordinate).
    const rows = new Map<number, ExtractedTextItem[]>();
    for (const item of page.items) {
      const yKey = roundCoordinate(item.y, 2);
      const row = rows.get(yKey) ?? [];
      row.push(item);
      rows.set(yKey, row);
    }

    const sortedRows = Array.from(rows.entries())
      .map(([y, items]) => ({ y, items: items.sort((a, b) => a.x - b.x) }))
      .sort((a, b) => b.y - a.y);

    if (sortedRows.length < 2) continue;

    // Collect x-coordinates of items across all rows to infer columns.
    const xPositions = new Set<number>();
    for (const row of sortedRows) {
      for (const item of row.items) {
        xPositions.add(roundCoordinate(item.x, 5));
      }
    }

    if (xPositions.size < 2) continue;

    const columns = Array.from(xPositions).sort((a, b) => a - b);
    const rowsData: string[][] = [];

    for (const row of sortedRows) {
      const rowCells: string[] = new Array(columns.length).fill('');
      for (const item of row.items) {
        const x = roundCoordinate(item.x, 5);
        const colIndex = columns.indexOf(x);
        if (colIndex >= 0) {
          rowCells[colIndex] = item.text.trim();
        }
      }
      rowsData.push(rowCells);
    }

    // Drop empty rows.
    const nonEmptyRows = rowsData.filter((row) =>
      row.some((cell) => cell.length > 0),
    );
    if (nonEmptyRows.length < 2) continue;

    // Drop columns that are empty in every row to avoid spurious columns.
    const populatedColumns = columns
      .map((x, index) => ({
        x,
        index,
        populated: nonEmptyRows.some((row) => row[index].length > 0),
      }))
      .filter((col) => col.populated)
      .map((col) => col.index);

    if (populatedColumns.length < 2) continue;

    const filteredRows = nonEmptyRows.map((row) =>
      populatedColumns.map((index) => row[index]),
    );

    const emptyHeader = populatedColumns.map(() => '').join(' | ');
    const separator = populatedColumns.map(() => '---').join(' | ');
    const markdownRows = filteredRows.map((row) => row.join(' | '));
    const markdown = [emptyHeader, separator, ...markdownRows].join('\n');

    tables.push({ page: page.physicalPage, markdown, rows: filteredRows });
  }

  return tables;
}

export async function extractPdf(filePath: string): Promise<ExtractionResult> {
  const data = new Uint8Array(readFileSync(filePath));
  const pdf = await pdfjs.getDocument({
    data,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    useSystemFonts: true,
  }).promise;
  const metadata = await pdf.getMetadata();
  const numPages = pdf.numPages;

  const pages: ExtractedPage[] = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items.filter(isTextItem).map(toExtractedItem);
    const sortedItems = readingOrder(items);
    const text = sortedItems.map((item) => item.text).join('');
    const isScanned = detectScanned(items, text);

    pages.push({
      physicalPage: i,
      logicalPage: i,
      text,
      items: sortedItems,
      isScanned,
      scanConfidence: isScanned ? 'low' : 'high',
    });
  }

  const tables = detectTables(pages);
  const warnings: string[] = [];
  const scannedPages = pages.filter((p) => p.isScanned).map((p) => p.physicalPage);
  if (scannedPages.length > 0) {
    warnings.push(`Pages ${scannedPages.join(', ')} appear to be scanned or image-only.`);
  }

  return {
    filePath,
    fileName: path.basename(filePath),
    sha256: sha256(filePath),
    sizeBytes: statSync(filePath).size,
    physicalPages: numPages,
    logicalPages: numPages,
    metadata: normalizeMetadata(metadata),
    pages,
    tables,
    figures: [],
    warnings,
    ingested: new Date().toISOString(),
  };
}
