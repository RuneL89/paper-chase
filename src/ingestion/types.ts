import type { EntityMention } from '../entities/index.js';
import type { ExtractionResult, ExtractionFailure } from '../extractor/types.js';
import type { Chunk } from '../chunking/types.js';
import type { StructuralProposal, PageUpdate } from '../orchestrator/types.js';
import type { DocumentPageLink } from '../writers/source.js';

export interface IngestionResult {
  sourceFiles: number;
  sourceFilePaths: string[];
  documentPages: number;
  rawPages: number;
  entityPages: number;
  topicPages: number;
  warnings: string[];
  errors: string[];
  changed: string[];
  added: string[];
  removed: string[];
  chunkBoundaries: { source: string; boundary: string; pageRange: string }[];
  lintIssues: number;
  skippedUpdates?: string[];
  proposals?: StructuralProposal[];
  folderIndexes?: string[];
}

export interface ProcessedSource {
  relativeFile: string;
  fileName: string;
  baseSlug: string;
  sha256: string;
  mtime: number;
  outcome: ExtractionResult | ExtractionFailure;
  chunks?: Chunk[];
  documentPageIds?: string[];
  rawPageIds?: string[];
  sourcePageId: string;
  entities: Record<string, number>;
  entityTypes?: Record<string, EntityMention['type']>;
  topics: Record<string, number>;
  pageUpdates?: PageUpdate[];
  documentLinks?: DocumentPageLink[];
}
