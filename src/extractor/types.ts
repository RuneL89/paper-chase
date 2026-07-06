export interface ExtractedTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
  hasEOL?: boolean;
  fontSize?: number;
}

export interface ExtractedPage {
  physicalPage: number;
  logicalPage: number;
  pageLabel?: string;
  text: string;
  items: ExtractedTextItem[];
  isScanned: boolean;
  scanConfidence: 'low' | 'medium' | 'high';
  imageOpCount: number;
  estimatedHeadings?: string[];
  estimatedLists?: string[];
}

export interface ExtractedTable {
  page: number;
  logicalPage?: number;
  markdown: string;
  rows: string[][];
  caption?: string;
  headerRow?: string[];
}

export interface ExtractedFigure {
  page: number;
  logicalPage?: number;
  description: string;
  caption?: string;
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creationDate?: string;
  [key: string]: unknown;
}

export interface ExtractionResult {
  filePath: string;
  fileName: string;
  sha256: string;
  sizeBytes: number;
  physicalPages: number;
  logicalPages: number;
  metadata: PdfMetadata;
  pages: ExtractedPage[];
  tables: ExtractedTable[];
  figures: ExtractedFigure[];
  warnings: string[];
  ingested: string;
  hasTables: boolean;
  hasFigures: boolean;
  isScanned: boolean;
}

export interface ExtractionFailure {
  filePath: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  reason: string;
  ingested: string;
}

export type ExtractionOutcome = ExtractionResult | ExtractionFailure;

export function isExtractionFailure(outcome: ExtractionOutcome): outcome is ExtractionFailure {
  return 'reason' in outcome;
}

export interface MultiPageObject {
  type: 'table' | 'figure' | 'footnote';
  startPage: number;
  endPage: number;
  description: string;
}
