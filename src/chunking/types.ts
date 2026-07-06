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
}

export interface ChunkingStrategy {
  splitBoundary: string;
  maxChunkSize: number;
  minChunkSize: number;
  neverSplit: string[];
  overlap: number;
  fallback: string;
  boundaries: ChunkBoundary[];
  example: ChunkBoundary;
}

export interface ChunkSource {
  id: string;
  file: string;
  pages: string;
  logicalPages?: string;
  extracted: string;
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
