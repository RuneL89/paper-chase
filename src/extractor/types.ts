export interface ExtractedTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
  hasEOL?: boolean;
}

export interface ExtractedPage {
  physicalPage: number;
  logicalPage: number;
  text: string;
  items: ExtractedTextItem[];
  isScanned: boolean;
  scanConfidence: 'low' | 'medium' | 'high';
}

export interface ExtractedTable {
  page: number;
  markdown: string;
  rows: string[][];
}

export interface ExtractedFigure {
  page: number;
  description: string;
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
