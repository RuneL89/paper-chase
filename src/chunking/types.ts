export interface PdfSection {
  title: string;
  startPage: number;
  endPage: number;
  level: number;
}

export interface DetectedTable {
  page: number;
  logicalPage?: number;
  rows: number;
  cols: number;
  caption?: string;
}

export interface DetectedFigure {
  page: number;
  logicalPage?: number;
  description: string;
  caption?: string;
}

export interface MultiPageObject {
  type: 'table' | 'figure' | 'footnote';
  startPage: number;
  endPage: number;
  description: string;
}

export interface PdfStructure {
  hasCover: boolean;
  hasToc: boolean;
  headings: PdfSection[];
  sections: PdfSection[];
  tables: DetectedTable[];
  figures: DetectedFigure[];
  multiPageObjects: MultiPageObject[];
  footnotePages: number[];
  appendixPages: number[];
  scannedPages: number[];
  totalPages: number;
  textDensity: number;
  summary: string;
}

export interface ChunkBoundary {
  type: 'page' | 'section' | 'table' | 'figure' | 'heading';
  pageRange: string;
  logicalPageRange?: string;
  description: string;
  isScanned: boolean;
  scanConfidence: 'low' | 'medium' | 'high';
  imageOpCount: number;
  hasTable: boolean;
  hasFigure: boolean;
  multiPageObject?: 'table' | 'figure' | 'footnote';
}

export interface ChunkingStrategy {
  sha256: string;
  fileName: string;
  splitBoundary: string;
  maxChunkSize: number;
  minChunkSize: number;
  neverSplit: string[];
  overlap: number;
  fallback: string;
  boundaries: ChunkBoundary[];
  example: ChunkBoundary;
  samplingStrategy: SamplingStrategy;
}

export interface CorpusFileInfo {
  fileName: string;
  pageCount: number;
  metadata: Record<string, unknown>;
}

export interface SamplingGroup {
  name: string;
  files: string[];
  category: SamplingCategory;
  reason: string;
}

export type SamplingCategory =
  | 'single-very-large'
  | 'similar-manageable'
  | 'similar-large'
  | 'mixed-corpus';

export interface SamplingStrategy {
  category: SamplingCategory;
  largePageThreshold: number;
  pageBudget: number;
  reason: string;
  tocSearch?: {
    enabled: boolean;
    firstPages: number;
  };
  readFirstFully?: boolean;
  sampleRemaining?: boolean;
  deferRestToIngest?: boolean;
  groups?: SamplingGroup[];
}

export interface ChunkSource {
  id: string;
  file: string;
  pages: string;
  logicalPages?: string;
  extracted: string;
  sha256: string;
}

export interface Chunk {
  id: string;
  title: string;
  pageRange: string;
  logicalPageRange?: string;
  boundaryType: 'page' | 'section' | 'table' | 'figure' | 'heading';
  content: string;
  sources: ChunkSource[];
  tags: string[];
  belowMin: boolean;
  charCount: number;
}
