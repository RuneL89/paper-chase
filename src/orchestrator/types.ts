export type EntityType = 'person' | 'organization' | 'location' | 'case' | 'event' | 'product';

export interface ExtractedEntity {
  name: string;
  canonical: string;
  aliases: string[];
  type: EntityType;
  count: number;
  mentions: { page: number; context: string }[];
  confidence: number;
  description?: string;
  relationships?: { predicate: string; object: string; evidence: string; pages: string }[];
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
  pageType: string;
  title: string;
  fileName: string;
  folder: string;
  tags: string[];
  citations: string[];
  wikilinks: string[];
  related: string[];
}

export interface FolderPlan {
  folder: string;
  title: string;
  description: string;
  pageTypes: string[];
  children: string[];
}

export interface DiscoveryChecklist {
  existingDocument: boolean;
  newEntities: boolean;
  newTopics: boolean;
  hasTablesFigures: boolean;
  rawPages: boolean;
  newPageType: boolean;
}

export interface DuplicateFlag {
  a: string;
  b: string;
  reason: 'levenshtein' | 'slug';
}

export interface OrchestratorMemory {
  rollingSummary: string;
  historicalSummary: string;
  summaryOnly: boolean;
  state: {
    document: {
      title: string;
      totalPages: number;
      currentChunk: number;
      boundaryType: string;
    };
    entities: Record<string, ExtractedEntity>;
    topics: Record<string, { tags: string[]; mentions: { page: number; context: string }[]; related: string[] }>;
    relationships: ExtractedRelationship[];
    sources: Record<string, { sha256: string; logicalPages: string; physicalPages: number; warnings: string[] }>;
    folderHierarchy: Record<string, FolderPlan>;
    rawFragments: { source: string; pages: string; reason: string; fragment: string }[];
    duplicateFlags: DuplicateFlag[];
    sourceEntities: Record<string, Record<string, number>>;
    sourceTopics: Record<string, Record<string, number>>;
  };
}

export interface CriticCheck {
  name: string;
  result: 'PASS' | 'FAIL';
  reason?: string;
}

export interface CriticReview {
  /** True when the Critic approves the output; false when it is blocked. */
  approved: boolean;
  issues: { type: 'citation' | 'hallucination' | 'schema' | 'link' | 'missing'; message: string; severity: 'low' | 'medium' | 'high' }[];
  confidence: 'high' | 'medium' | 'low';
  /** Full checklist of items the Critic evaluated. */
  checks: CriticCheck[];
  /** Issues that block committing the chunk. */
  blockingIssues: { check: string; message: string; severity: 'low' | 'medium' | 'high' }[];
}

export interface PageUpdate {
  filePath: string;
  frontmatter: Record<string, unknown>;
  body: string;
  citations?: { claim: string; sources: string[] }[];
  fallback?: boolean;
}

export interface StructuralProposal {
  type: 'new-folder' | 'restructure';
  reason: string;
  currentFolders: string[];
  proposedFolders: string[];
  newFolderPlans: FolderPlan[];
  /** Set to true when the proposal is approved and applied during an ingest run. */
  applied?: boolean;
}

export interface OrchestratorResult {
  wikiIndexPath: string;
  folderIndexes: string[];
  memory: OrchestratorMemory;
  critic: CriticReview;
  pages?: PagePlan[];
}

export interface IngestOrchestratorResult {
  memory: OrchestratorMemory;
  folderPlacements: FolderPlan[];
  pages: PagePlan[];
  pageUpdates?: PageUpdate[];
  critic: CriticReview;
  proposals: StructuralProposal[];
  extractedEntities: ExtractedEntity[];
  extractedTopics: { name: string; count: number; related: string[] }[];
}

export interface PagePlannerOutput {
  pages: PagePlan[];
  folderPlacements: FolderPlan[];
  wikilinks: string[];
  citations: string[];
  discovery: DiscoveryChecklist;
}
