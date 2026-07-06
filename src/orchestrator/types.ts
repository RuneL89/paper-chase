export type EntityType = 'person' | 'organization' | 'location' | 'case' | 'event' | 'product';

export interface ExtractedEntity {
  name: string;
  type: EntityType;
  mentions: { page: number; context: string }[];
  confidence: number;
}

export interface ExtractedRelationship {
  subject: string;
  predicate: string;
  object: string;
  evidence: string;
  pages: string;
}

export interface ExtractedClaim {
  text: string;
  evidence: string;
  pages: string;
}

export interface ExtractedEvidence {
  claims: ExtractedClaim[];
  tables: { page: number; caption?: string; markdown: string }[];
  figures: { page: number; caption?: string; description: string }[];
}

export interface PagePlan {
  pageType: 'document' | 'source' | 'topic' | 'entity' | 'raw' | 'index';
  title: string;
  fileName: string;
  folder: string;
  tags: string[];
  citations: string[];
  wikilinks: string[];
}

export interface FolderPlan {
  folder: string;
  title: string;
  description: string;
  pageTypes: string[];
  children: string[];
}

export interface OrchestratorMemory {
  rollingSummary: string;
  state: {
    document: {
      title: string;
      totalPages: number;
      currentChunk: number;
      boundaryType: string;
    };
    entities: Record<string, ExtractedEntity>;
    topics: Record<string, { tags: string[]; mentions: { page: number; context: string }[] }>;
    relationships: ExtractedRelationship[];
    sources: Record<string, { sha256: string; logicalPages: string; physicalPages: number; warnings: string[] }>;
    folderHierarchy: Record<string, FolderPlan>;
    rawFragments: { source: string; pages: string; reason: string; fragment: string }[];
  };
}

export interface CriticReview {
  issues: { type: 'citation' | 'hallucination' | 'schema' | 'link' | 'missing'; message: string; severity: 'low' | 'medium' | 'high' }[];
  confidence: 'high' | 'medium' | 'low';
}

export interface OrchestratorResult {
  wikiIndexPath: string;
  folderIndexes: string[];
  memory: OrchestratorMemory;
  critic: CriticReview;
}
