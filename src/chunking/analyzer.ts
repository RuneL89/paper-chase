import type { ExtractionResult, ExtractedPage } from '../extractor/types.js';
import type { PdfStructure, DetectedTable, DetectedFigure, PdfSection } from './types.js';

export function analyzePdfStructure(result: ExtractionResult): PdfStructure {
  const totalPages = result.physicalPages;
  const pages = result.pages;

  const headings: PdfSection[] = [];
  const sections: PdfSection[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const heading = detectHeading(page);
    if (heading) {
      headings.push({
        title: heading,
        startPage: page.physicalPage,
        endPage: page.physicalPage,
        level: 1,
      });
      sections.push({
        title: heading,
        startPage: page.physicalPage,
        endPage: page.physicalPage,
        level: 1,
      });
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
    rows: t.rows.length,
    cols: t.rows.length > 0 ? t.rows[0].length : 0,
  }));

  const figures: DetectedFigure[] = result.figures.map((f) => ({
    page: f.page,
    description: f.description,
  }));

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
  });

  return {
    hasCover,
    hasToc,
    headings,
    sections: mergedSections,
    tables,
    figures,
    footnotePages,
    appendixPages,
    scannedPages,
    totalPages,
    textDensity,
    summary,
  };
}

function detectHeading(page: ExtractedPage): string | null {
  const lines = page.text.split(/\n|\r/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const firstLine = lines[0];
  // Treat a short first line as a heading if it is not too long and does not end mid-sentence.
  if (firstLine.length >= 3 && firstLine.length <= 80 && !/[.!?]$/.test(firstLine)) {
    return firstLine;
  }
  return null;
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
}): string {
  const parts: string[] = [];
  parts.push(`PDF contains ${details.totalPages} physical page(s).`);
  if (details.hasCover) parts.push('A cover page was detected.');
  if (details.hasToc) parts.push('A table of contents was detected.');
  if (details.headings > 0) parts.push(`${details.headings} section heading(s) were detected.`);
  if (details.tables > 0) parts.push(`${details.tables} table(s) were detected.`);
  if (details.figures > 0) parts.push(`${details.figures} figure(s) were detected.`);
  if (details.scannedPages > 0) parts.push(`${details.scannedPages} scanned page(s) were detected.`);
  return parts.join(' ');
}
