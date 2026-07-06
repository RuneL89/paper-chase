import type { ExtractionResult, ExtractedPage } from '../extractor/types.js';
import type { PdfStructure, DetectedTable, DetectedFigure, PdfSection, MultiPageObject } from './types.js';

export function analyzePdfStructure(result: ExtractionResult): PdfStructure {
  const totalPages = result.physicalPages;
  const pages = result.pages;

  const headings: PdfSection[] = [];
  const sections: PdfSection[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageHeadings = detectHeadingsOnPage(page);
    for (const heading of pageHeadings) {
      const section: PdfSection = {
        title: heading,
        startPage: page.physicalPage,
        endPage: page.physicalPage,
        level: inferHeadingLevel(heading, page),
      };
      headings.push(section);
      sections.push(section);
    }
  }

  // Merge adjacent single-page sections into broader sections if possible.
  const mergedSections = mergeSections(sections);

  const hasCover = detectCover(pages);
  const hasToc = detectToc(pages);
  const footnotePages = detectFootnotePages(pages);
  const appendixPages = detectAppendixPages(pages);
  const scannedPages = pages.filter((p) => p.isScanned).map((p) => p.physicalPage);

  const tables: DetectedTable[] = result.tables.map((t) => ({
    page: t.page,
    logicalPage: t.logicalPage,
    rows: t.rows.length,
    cols: t.rows.length > 0 ? t.rows[0].length : 0,
    caption: t.caption,
  }));

  const figures: DetectedFigure[] = result.figures.map((f) => ({
    page: f.page,
    logicalPage: f.logicalPage,
    description: f.description,
    caption: f.caption,
  }));

  const multiPageObjects = detectMultiPageObjects(pages, tables, figures);

  const textDensity =
    pages.reduce((sum, p) => sum + p.text.length, 0) / Math.max(totalPages, 1);

  const summary = buildSummary({
    hasCover,
    hasToc,
    totalPages,
    headings: headings.length,
    tables: tables.length,
    figures: figures.length,
    scannedPages: scannedPages.length,
    multiPageObjects: multiPageObjects.length,
  });

  return {
    hasCover,
    hasToc,
    headings,
    sections: mergedSections,
    tables,
    figures,
    multiPageObjects,
    footnotePages,
    appendixPages,
    scannedPages,
    totalPages,
    textDensity,
    summary,
  };
}

function detectHeadingsOnPage(page: ExtractedPage): string[] {
  return page.estimatedHeadings ?? [];
}

function inferHeadingLevel(heading: string, page: ExtractedPage): number {
  const items = page.items;
  if (items.length === 0) return 1;
  const headingItems = items.filter((i) => heading.includes(i.text));
  if (headingItems.length === 0) return 1;
  const maxSize = Math.max(...headingItems.map((i) => i.fontSize ?? 0));
  if (maxSize >= 20) return 1;
  if (maxSize >= 14) return 2;
  return 3;
}

function detectCover(pages: ExtractedPage[]): boolean {
  if (pages.length === 0) return false;
  const firstPage = pages[0];
  const lineCount = firstPage.text.split(/\n|\r/).filter((l) => l.trim().length > 0).length;
  return lineCount <= 8 && firstPage.text.length < 800;
}

function detectToc(pages: ExtractedPage[]): boolean {
  for (const page of pages.slice(0, 3)) {
    const text = page.text.toLowerCase();
    if (text.includes('table of contents') || text.includes('contents')) {
      return true;
    }
  }
  return false;
}

function detectFootnotePages(pages: ExtractedPage[]): number[] {
  const found: number[] = [];
  for (const page of pages) {
    if (/\b(footnote|notes|endnotes)\b/i.test(page.text)) {
      found.push(page.physicalPage);
    }
  }
  return found;
}

function detectAppendixPages(pages: ExtractedPage[]): number[] {
  const found: number[] = [];
  for (const page of pages) {
    if (/\bappendix\b/i.test(page.text)) {
      found.push(page.physicalPage);
    }
  }
  return found;
}

function detectMultiPageObjects(
  pages: ExtractedPage[],
  tables: DetectedTable[],
  figures: DetectedFigure[],
): MultiPageObject[] {
  const objects: MultiPageObject[] = [];

  // Multi-page footnotes: consecutive pages with footnote/notes sections.
  let footnoteStart = 0;
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const hasFootnote = /\b(footnote|notes|endnotes)\b/i.test(page.text);
    if (hasFootnote && footnoteStart === 0) {
      footnoteStart = page.physicalPage;
    } else if (!hasFootnote && footnoteStart > 0) {
      if (page.physicalPage - 1 > footnoteStart) {
        objects.push({
          type: 'footnote',
          startPage: footnoteStart,
          endPage: page.physicalPage - 1,
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

  // Multi-page tables: tables with same caption or column count on consecutive pages.
  for (let i = 0; i < tables.length - 1; i++) {
    const current = tables[i];
    const next = tables[i + 1];
    if (next.page === current.page + 1 && next.cols === current.cols) {
      objects.push({
        type: 'table',
        startPage: current.page,
        endPage: next.page,
        description: current.caption
          ? `Multi-page table: ${current.caption}`
          : 'Multi-page table spanning consecutive pages',
      });
    }
  }

  // Multi-page figures: figure captions that reference "continued" or similar.
  for (const figure of figures) {
    if (!figure.caption) continue;
    const continuationMatch = figure.caption.match(/\(continued\)|continued|cont\./i);
    if (continuationMatch) {
      // Heuristic: the preceding page likely contains the start of the figure.
      const startPage = Math.max(1, figure.page - 1);
      if (startPage < figure.page) {
        objects.push({
          type: 'figure',
          startPage,
          endPage: figure.page,
          description: `Multi-page figure: ${figure.caption}`,
        });
      }
    }
  }

  return objects;
}

function mergeSections(sections: PdfSection[]): PdfSection[] {
  if (sections.length === 0) return [];
  const merged: PdfSection[] = [];
  let current: PdfSection = { ...sections[0] };

  for (let i = 1; i < sections.length; i++) {
    const next = sections[i];
    if (next.startPage === current.endPage + 1) {
      current.endPage = next.endPage;
      current.title = `${current.title} / ${next.title}`;
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  return merged;
}

function buildSummary(details: {
  hasCover: boolean;
  hasToc: boolean;
  totalPages: number;
  headings: number;
  tables: number;
  figures: number;
  scannedPages: number;
  multiPageObjects: number;
}): string {
  const parts: string[] = [];
  parts.push(`PDF contains ${details.totalPages} physical page(s).`);
  if (details.hasCover) parts.push('A cover page was detected.');
  if (details.hasToc) parts.push('A table of contents was detected.');
  if (details.headings > 0) parts.push(`${details.headings} section heading(s) were detected.`);
  if (details.tables > 0) parts.push(`${details.tables} table(s) were detected.`);
  if (details.figures > 0) parts.push(`${details.figures} figure(s) were detected.`);
  if (details.scannedPages > 0) parts.push(`${details.scannedPages} scanned page(s) were detected.`);
  if (details.multiPageObjects > 0) {
    parts.push(`${details.multiPageObjects} multi-page object(s) (table, figure, or footnote) were detected.`);
  }
  return parts.join(' ');
}
