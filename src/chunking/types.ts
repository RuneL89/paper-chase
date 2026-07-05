export interface PdfSection {
  title: string;
  startPage: number;
  endPage: number;
  level: number;
}

export interface DetectedTable {
  page: number;
  rows: number;
  cols: number;
}

export interface DetectedFigure {
  page: number;
  description: string;
}

export interface PdfStructure {
  hasCover: boolean;
  hasToc: boolean;
  headings: PdfSection[];
  sections: PdfSection[];
  tables: DetectedTable[];
  figures: DetectedFigure[];
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

export interface Chunk {
  id: string;
  title: string;
  pageRange: string;
  boundaryType: string;
  content: string;
  sources: { id: string; file: string; pages: string; extracted: string }[];
  tags: string[];
  belowMin: boolean;
  charCount: number;
}
