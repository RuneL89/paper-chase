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
  ExtractedFigure,
  MultiPageObject,
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
  const fontHeight = Math.abs(item.transform[0]) || Math.abs(item.transform[3]) || 0;
  return {
    text: item.str,
    x: item.transform[4] ?? 0,
    y: item.transform[5] ?? 0,
    width: item.width,
    height: item.height,
    fontName: item.fontName,
    hasEOL: item.hasEOL,
    fontSize: fontHeight,
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

function buildPageText(items: ExtractedTextItem[]): string {
  // Group items into lines by y-coordinate, then order left-to-right, preserving
  // whitespace hints from the PDF when available.
  const lines = new Map<number, ExtractedTextItem[]>();
  for (const item of items) {
    const yKey = Math.round(item.y);
    const row = lines.get(yKey) ?? [];
    row.push(item);
    lines.set(yKey, row);
  }

  const sortedY = Array.from(lines.keys()).sort((a, b) => b - a);
  const textLines: string[] = [];

  for (const y of sortedY) {
    const rowItems = lines.get(y)!.sort((a, b) => a.x - b.x);
    const lineParts: string[] = [];
    for (const item of rowItems) {
      lineParts.push(item.text);
    }
    textLines.push(lineParts.join(' '));
  }

  return textLines.join('\n');
}

async function countImageOperators(page: any): Promise<number> {
  try {
    const ops = await page.getOperatorList();
    let imageCount = 0;
    for (const fn of ops.fnArray) {
      // pdfjs-dist operator names for images: paintImageXObject, paintImageMaskXObject, paintInlineImageXObject
      if (
        fn === pdfjs.OPS.paintImageXObject ||
        fn === pdfjs.OPS.paintImageMaskXObject ||
        fn === pdfjs.OPS.paintInlineImageXObject
      ) {
        imageCount++;
      }
    }
    return imageCount;
  } catch {
    return 0;
  }
}

function detectScanned(items: ExtractedTextItem[], text: string, _imageOpCount = 0): { isScanned: boolean; scanConfidence: ExtractedPage['scanConfidence'] } {
  const trimmedText = text.trim();
  const textLength = trimmedText.length;

  if (items.length === 0 || textLength < 10) {
    return { isScanned: true, scanConfidence: 'low' };
  }
  // Pages with very little extracted text are likely image-only or scanned.
  if (textLength < 30) {
    return { isScanned: true, scanConfidence: 'low' };
  }
  // Pages with a modest amount of text and few text items may still be
  // image-heavy (e.g., a figure with a caption), so mark medium confidence.
  if (textLength < 500 && items.length < 30) {
    return { isScanned: false, scanConfidence: 'medium' };
  }
  return { isScanned: false, scanConfidence: 'high' };
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

function extractCaption(text: string, page: number, type: 'table' | 'figure'): string | undefined {
  const patterns =
    type === 'table'
      ? [
          /Table\s+\d+[^.:\n]*[:.]\s*(.+?)(?:\n|$)/i,
          /Table\s+\d+\s+(.+?)(?:\n|$)/i,
        ]
      : [
          /Figure\s+\d+[^.:\n]*[:.]\s*(.+?)(?:\n|$)/i,
          /Fig\.\s+\d+[^.:\n]*[:.]\s*(.+?)(?:\n|$)/i,
          /Figure\s+\d+\s+(.+?)(?:\n|$)/i,
        ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1].trim().length > 0) {
      return match[1].trim();
    }
  }
  return undefined;
}

function detectFigures(pages: ExtractedPage[]): ExtractedFigure[] {
  const figures: ExtractedFigure[] = [];
  for (const page of pages) {
    const caption = extractCaption(page.text, page.physicalPage, 'figure');
    if (caption) {
      figures.push({
        page: page.physicalPage,
        logicalPage: page.logicalPage,
        description: caption,
        caption,
      });
    }
  }
  return figures;
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

    const headerRow = filteredRows[0];
    const bodyRows = filteredRows.slice(1);
    const separator = populatedColumns.map(() => '---').join(' | ');
    const markdownRows = bodyRows.map((row) => row.join(' | '));
    const markdown = [headerRow.join(' | '), separator, ...markdownRows].join('\n');

    const caption = extractCaption(page.text, page.physicalPage, 'table');

    tables.push({
      page: page.physicalPage,
      logicalPage: page.logicalPage,
      markdown,
      rows: filteredRows,
      caption,
      headerRow,
    });
  }

  return tables;
}

function detectHeadings(page: ExtractedPage): string[] {
  const headings: string[] = [];
  const items = page.items;
  if (items.length === 0) return headings;

  const fontSizes = items.map((i) => i.fontSize ?? 0).filter((s) => s > 0);
  if (fontSizes.length === 0) return headings;

  const avgSize = fontSizes.reduce((a, b) => a + b, 0) / fontSizes.length;
  const threshold = Math.max(avgSize * 1.6, 12);
  const minHeadingLength = 10;
  const maxHeadingLength = 80;
  // Reject lines that are purely numbers, currency, percentages, or table/figure captions.
  const numericOrCurrencyOnly = /^[\d\s$€£,.%-]+$/;
  const startsWithDecimal = /^\d+[.,]\d+/;
  const captionLike = /^(Table|Figure|Fig\.)\s+\d+/i;

  const lines = new Map<number, ExtractedTextItem[]>();
  for (const item of items) {
    const yKey = Math.round(item.y);
    const row = lines.get(yKey) ?? [];
    row.push(item);
    lines.set(yKey, row);
  }

  for (const row of lines.values()) {
    const sorted = row.sort((a, b) => a.x - b.x);
    const lineText = sorted.map((i) => i.text).join(' ').trim();
    if (!lineText) continue;
    const lineLength = lineText.length;
    if (lineLength < minHeadingLength || lineLength > maxHeadingLength) continue;
    if (captionLike.test(lineText)) continue;
    if (numericOrCurrencyOnly.test(lineText) || startsWithDecimal.test(lineText)) continue;
    const maxSize = Math.max(...sorted.map((i) => i.fontSize ?? 0));
    if (maxSize >= threshold && !/[.!?]$/.test(lineText)) {
      headings.push(lineText);
    }
  }

  return headings;
}

function detectLists(page: ExtractedPage): string[] {
  const lists: string[] = [];
  const bulletPattern = /^\s*[•\-\*\u2022\u25E6\u25AA]\s+/m;
  const numberedPattern = /^\s*\d+[.\)]\s+/m;
  const lines = page.text.split(/\r?\n/);
  for (const line of lines) {
    if (bulletPattern.test(line) || numberedPattern.test(line)) {
      lists.push(line.trim());
    }
  }
  return lists;
}

function detectMultiPageObjects(pages: ExtractedPage[]): MultiPageObject[] {
  const objects: MultiPageObject[] = [];

  // Detect multi-page footnotes: consecutive pages with footnote-like markers in the footer.
  let footnoteStart = 0;
  for (let i = 0; i < pages.length; i++) {
    const hasFootnote = /\b(footnote|notes|endnotes)\b/i.test(pages[i].text);
    if (hasFootnote && footnoteStart === 0) {
      footnoteStart = pages[i].physicalPage;
    } else if (!hasFootnote && footnoteStart > 0) {
      if (pages[i - 1].physicalPage > footnoteStart) {
        objects.push({
          type: 'footnote',
          startPage: footnoteStart,
          endPage: pages[i - 1].physicalPage,
          description: 'Multi-page footnote or notes section',
        });
      }
      footnoteStart = 0;
    }
  }
  if (footnoteStart > 0) {
    const lastPage = pages[pages.length - 1].physicalPage;
    if (lastPage > footnoteStart) {
      objects.push({
        type: 'footnote',
        startPage: footnoteStart,
        endPage: lastPage,
        description: 'Multi-page footnote or notes section',
      });
    }
  }

  return objects;
}

async function withConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const current = index++;
      results[current] = await tasks[current]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
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

  let pageLabels: string[] = [];
  try {
    const labels = (pdf as unknown as { getPageLabels?: () => Promise<string[]> }).getPageLabels
      ? await (pdf as unknown as { getPageLabels: () => Promise<string[]> }).getPageLabels()
      : [];
    pageLabels = labels ?? [];
  } catch {
    pageLabels = [];
  }

  // Extract pages concurrently to reduce wall-clock time for large PDFs.
  const pageTasks: (() => Promise<ExtractedPage>)[] = [];
  for (let i = 1; i <= numPages; i++) {
    pageTasks.push(async () => {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const items = textContent.items.filter(isTextItem).map(toExtractedItem);
      const sortedItems = readingOrder(items);
      const text = buildPageText(sortedItems);

      const pageLabel = pageLabels[i - 1];

      const pageObj: ExtractedPage = {
        physicalPage: i,
        logicalPage: pageLabel ? parseInt(pageLabel, 10) || i : i,
        pageLabel,
        text,
        items: sortedItems,
        isScanned: false,
        scanConfidence: 'high',
        imageOpCount: 0,
      };
      const { isScanned, scanConfidence } = detectScanned(items, text, 0);
      pageObj.isScanned = isScanned;
      pageObj.scanConfidence = scanConfidence;
      pageObj.estimatedHeadings = detectHeadings(pageObj);
      pageObj.estimatedLists = detectLists(pageObj);
      return pageObj;
    });
  }

  const pages = await withConcurrencyLimit(pageTasks, 4);
  const tables = detectTables(pages);
  const figures = detectFigures(pages);
  const multiPageObjects = detectMultiPageObjects(pages);
  const warnings: string[] = [];
  const scannedPages = pages.filter((p) => p.isScanned).map((p) => p.physicalPage);
  if (scannedPages.length > 0) {
    warnings.push(`Pages ${scannedPages.join(', ')} appear to be scanned or image-only.`);
  }
  if (multiPageObjects.length > 0) {
    for (const obj of multiPageObjects) {
      warnings.push(
        `Detected multi-page ${obj.type} on pages ${obj.startPage}-${obj.endPage}.`,
      );
    }
  }

  return {
    filePath,
    fileName: path.basename(filePath),
    sha256: sha256(filePath),
    sizeBytes: statSync(filePath).size,
    physicalPages: numPages,
    logicalPages: pageLabels.filter((l) => l && l.trim().length > 0).length || numPages,
    metadata: normalizeMetadata(metadata),
    pages,
    tables,
    figures,
    warnings,
    ingested: new Date().toISOString(),
    hasTables: tables.length > 0,
    hasFigures: figures.length > 0,
    isScanned: scannedPages.length > 0,
  };
}
