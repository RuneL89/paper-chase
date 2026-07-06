import type { LLMClient } from '../llm/client.js';
import type { Chunk } from '../chunking/types.js';
import type { ExtractionResult, ExtractedPage } from '../extractor/types.js';
import type {
  EntityType,
  ExtractedEntity,
  ExtractedRelationship,
  ExtractedEvidence,
  PagePlan,
  FolderPlan,
  OrchestratorMemory,
  CriticReview,
} from './types.js';

export interface StructureOutput {
  headings: { title: string; page: number; level: number }[];
  sections: { title: string; startPage: number; endPage: number; level: number }[];
  boundaries: { type: string; pageRange: string; description: string }[];
  pageRange: string;
  boundaryType: string;
  readingOrderFlags: string[];
}

export interface EntityOutput {
  entities: ExtractedEntity[];
}

export interface RelationshipOutput {
  relationships: ExtractedRelationship[];
}

export interface EvidenceOutput {
  claims: { text: string; evidence: string; pages: string }[];
  tables: { page: number; caption?: string; markdown: string }[];
  figures: { page: number; caption?: string; description: string }[];
}

export interface PagePlannerOutput {
  pages: PagePlan[];
  folderPlacements: FolderPlan[];
  wikilinks: string[];
  citations: string[];
}

export interface ChunkWriterOutput {
  files: Record<string, string>;
}

/**
 * StructureAnalyst: derive a clean structural view from the existing extraction.
 */
export function structureAnalyst(
  result: ExtractionResult,
  chunks: Chunk[],
): StructureOutput {
  const headings = result.pages
    .flatMap((page) =>
      (page.estimatedHeadings ?? []).map((title) => ({
        title,
        page: page.physicalPage,
        level: 1,
      })),
    )
    .slice(0, 20);

  const sections: StructureOutput['sections'] = [];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].page;
    const end = i + 1 < headings.length ? headings[i + 1].page - 1 : result.physicalPages;
    sections.push({
      title: headings[i].title,
      startPage: start,
      endPage: Math.max(start, end),
      level: headings[i].level,
    });
  }

  const boundaries = chunks.map((chunk) => ({
    type: chunk.boundaryType,
    pageRange: chunk.pageRange,
    description: chunk.title,
  }));

  return {
    headings,
    sections,
    boundaries,
    pageRange: `1-${result.physicalPages}`,
    boundaryType: result.tables.length > 0 ? 'table' : result.figures.length > 0 ? 'figure' : 'page',
    readingOrderFlags: result.pages.some((p) => p.isScanned) ? ['scanned-pages-excluded'] : [],
  };
}

const entityPatterns: Record<EntityType, RegExp> = {
  person: /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g,
  organization: /\b([A-Z][a-z]+\s+(?:Corp|Inc|LLC|Ltd|Company|Association|Organization|Agency))\b/g,
  location: /\b([A-Z][a-z]+\s*,\s*[A-Z]{2})\b/g,
  case: /\b([A-Z][a-z]+\s+v\.?\s+[A-Z][a-z]+)\b/gi,
  event: /\b(20\d{2}\s+[A-Z][a-z]+\s+Conference|Summit|Meeting)\b/g,
  product: /\b([A-Z][a-z]+\s+(?:Product|Device|System|Platform|Tool))\b/g,
};

function inferEntityType(name: string): EntityType {
  const lower = name.toLowerCase();
  if (lower.includes('corp') || lower.includes('inc') || lower.includes('llc') || lower.includes('company')) return 'organization';
  if (/\d{4}/.test(lower) && (lower.includes('conference') || lower.includes('summit') || lower.includes('meeting'))) return 'event';
  if (lower.includes('product') || lower.includes('device') || lower.includes('system') || lower.includes('platform')) return 'product';
  if (lower.includes(' v. ') || lower.includes(' vs. ')) return 'case';
  if (/,\s*[a-z]{2}/i.test(name)) return 'location';
  return 'person';
}

/**
 * EntityExtractor: surface people, organizations, locations, cases, events, and products.
 */
export function entityExtractor(
  result: ExtractionResult,
  chunks: Chunk[],
): EntityOutput {
  const seen = new Set<string>();
  const entities: ExtractedEntity[] = [];

  for (const chunk of chunks) {
    for (const [type, pattern] of Object.entries(entityPatterns)) {
      const matches = chunk.content.matchAll(pattern);
      for (const match of matches) {
        const name = match[1].trim();
        if (name.length < 3 || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        entities.push({
          name,
          type: inferEntityType(name),
          mentions: parsePageRange(chunk.pageRange).map((page) => ({
            page,
            context: chunk.content.slice(0, 200).replace(/\s+/g, ' '),
          })),
          confidence: 0.6,
        });
      }
    }
  }

  return { entities: entities.slice(0, 20) };
}

/**
 * RelationshipExtractor: capture simple relationships between entities.
 */
export function relationshipExtractor(
  result: ExtractionResult,
  entities: ExtractedEntity[],
): RelationshipOutput {
  const relationships: ExtractedRelationship[] = [];
  const entityNames = entities.map((e) => e.name.toLowerCase());
  for (let i = 0; i < entities.length; i++) {
    for (let j = 0; j < entities.length; j++) {
      if (i === j) continue;
      const sentence = findCooccurringSentence(result, entities[i].name, entities[j].name);
      if (sentence) {
        relationships.push({
          subject: entities[i].name,
          predicate: 'related to',
          object: entities[j].name,
          evidence: sentence,
          pages: '1',
        });
      }
    }
  }
  return { relationships: relationships.slice(0, 10) };
}

function findCooccurringSentence(result: ExtractionResult, a: string, b: string): string | undefined {
  const sentences = result.pages.flatMap((p) => p.text.split(/(?<=[.!?])\s+/));
  for (const sentence of sentences) {
    if (sentence.includes(a) && sentence.includes(b)) {
      return sentence.trim().slice(0, 200);
    }
  }
  return undefined;
}

/**
 * EvidenceCollector: collect key claims, tables, and figures from the extraction.
 */
export function evidenceCollector(
  result: ExtractionResult,
  chunks: Chunk[],
): EvidenceOutput {
  const claims: ExtractedEvidence['claims'] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const sentences = chunk.content.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length < 40 || trimmed.length > 200) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      claims.push({
        text: trimmed,
        evidence: trimmed,
        pages: chunk.pageRange,
      });
      if (claims.length >= 10) break;
    }
    if (claims.length >= 10) break;
  }

  const tables = result.tables.map((t) => ({
    page: t.page,
    caption: t.caption,
    markdown: t.markdown,
  }));

  const figures = result.figures.map((f) => ({
    page: f.page,
    caption: f.caption,
    description: f.description,
  }));

  return { claims, tables, figures };
}

/**
 * PagePlanner: decide the folder hierarchy and page plan.
 * For Sprint 7, the planner uses an LLM prompt to propose a wiki structure.
 */
export async function pagePlanner(
  result: ExtractionResult,
  structure: StructureOutput,
  entities: ExtractedEntity[],
  evidence: EvidenceOutput,
  llmClient: LLMClient,
): Promise<PagePlannerOutput> {
  const prompt = buildPagePlannerPrompt(result, structure, entities, evidence);
  const response = await llmClient.call(prompt, { maxTokens: 800, temperature: 0.2 });

  const output = parseLLMJson<PagePlannerOutput>(response.text) ?? {
    pages: [],
    folderPlacements: defaultFolderPlacements(result, entities),
    wikilinks: [],
    citations: [],
  };

  if (!output.folderPlacements || output.folderPlacements.length === 0) {
    output.folderPlacements = defaultFolderPlacements(result, entities);
  }

  return output;
}

function buildPagePlannerPrompt(
  result: ExtractionResult,
  structure: StructureOutput,
  entities: ExtractedEntity[],
  evidence: EvidenceOutput,
): string {
  return [
    'You are the PagePlanner agent for a PDF-to-wiki CLI.',
    'Given the PDF metadata and structure below, propose a folder hierarchy and page plan.',
    'Return ONLY a JSON object with this shape:',
    JSON.stringify({
      pages: [
        {
          pageType: 'document | source | topic | entity | raw | index',
          title: 'Page title',
          fileName: 'kebab-case-filename.md',
          folder: 'documents',
          tags: ['tag'],
          citations: ['src1'],
          wikilinks: ['Related Page'],
        },
      ],
      folderPlacements: [
        {
          folder: 'documents',
          title: 'Documents',
          description: 'Why this folder exists',
          pageTypes: ['document'],
          children: [],
        },
      ],
      wikilinks: ['Related Page'],
      citations: ['src1'],
    }),
    '',
    'PDF metadata:',
    `File: ${result.fileName}`,
    `Pages: ${result.physicalPages}`,
    `Title: ${result.metadata.title || 'unknown'}`,
    `Tables: ${result.tables.length}`,
    `Figures: ${result.figures.length}`,
    `Scanned pages: ${result.pages.filter((p) => p.isScanned).length}`,
    '',
    'Detected headings:',
    ...structure.headings.map((h) => `- ${h.title} (page ${h.page})`),
    '',
    'Detected entities:',
    ...entities.map((e) => `- ${e.name} (${e.type})`),
    '',
    'Evidence summary:',
    `${evidence.claims.length} claims, ${evidence.tables.length} tables, ${evidence.figures.length} figures.`,
  ].join('\n');
}

export function defaultFolderPlacements(
  result: ExtractionResult,
  entities: ExtractedEntity[],
): FolderPlan[] {
  const plans: FolderPlan[] = [
    {
      folder: 'documents',
      title: 'Documents',
      description: 'Document chunks extracted from the source PDFs.',
      pageTypes: ['document'],
      children: [],
    },
    {
      folder: 'sources',
      title: 'Sources',
      description: 'Catalog pages for each source PDF.',
      pageTypes: ['source'],
      children: [],
    },
  ];

  if (result.pages.some((p) => p.isScanned)) {
    plans.push({
      folder: 'raw',
      title: 'Raw Fragments',
      description: 'Scanned or unparseable pages preserved as raw fragments.',
      pageTypes: ['raw'],
      children: [],
    });
  }

  if (entities.length > 0) {
    plans.push({
      folder: 'entities',
      title: 'Entities',
      description: 'People, organizations, and other named entities mentioned in the corpus.',
      pageTypes: ['entity'],
      children: [],
    });
  }

  plans.push({
    folder: 'topics',
    title: 'Topics',
    description: 'Recurring themes and concepts.',
    pageTypes: ['topic'],
    children: [],
  });

  return plans;
}

/**
 * ChunkWriter: materialize the planned pages. For Sprint 7, this is handled by the
 * existing writers in `src/writers/`. The orchestrator returns the plan; the command
 * materializes the files.
 */
export function chunkWriter(pages: PagePlan[]): ChunkWriterOutput {
  const files: Record<string, string> = {};
  for (const page of pages) {
    files[page.fileName] = page.title;
  }
  return { files };
}

/**
 * Critic: deterministic review of the page plan and folder placements.
 */
export function critic(
  result: ExtractionResult,
  pages: PagePlan[],
  folderPlacements: FolderPlan[],
): CriticReview {
  const issues: CriticReview['issues'] = [];

  if (pages.length === 0) {
    issues.push({ type: 'missing', message: 'No pages planned', severity: 'high' });
  }

  for (const page of pages) {
    if (!page.title || page.title.trim() === '') {
      issues.push({ type: 'schema', message: 'Page missing title', severity: 'high' });
    }
    if (!page.folder || page.folder.trim() === '') {
      issues.push({ type: 'schema', message: 'Page missing folder', severity: 'high' });
    }
  }

  const allowedPageTypes = ['document', 'source', 'topic', 'entity', 'raw', 'index'];
  for (const page of pages) {
    if (!allowedPageTypes.includes(page.pageType)) {
      issues.push({ type: 'schema', message: `Invalid page type: ${page.pageType}`, severity: 'high' });
    }
  }

  if (folderPlacements.length === 0) {
    issues.push({ type: 'missing', message: 'No folder placements planned', severity: 'high' });
  }

  const confidence = issues.length === 0 ? 'high' : issues.some((i) => i.severity === 'high') ? 'low' : 'medium';
  return { issues, confidence };
}

function parsePageRange(range: string): number[] {
  const match = range.match(/^(\d+)(?:-(\d+))?$/);
  if (!match) return [1];
  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : start;
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
}

function parseLLMJson<T>(text: string): T | undefined {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return undefined;
  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    return undefined;
  }
}

export function createInitialMemory(
  result: ExtractionResult,
  chunks: Chunk[],
): OrchestratorMemory {
  return {
    rollingSummary: `Sample document ${result.fileName} has ${result.physicalPages} physical pages and ${chunks.length} chunks.`,
    state: {
      document: {
        title: result.metadata.title || result.fileName,
        totalPages: result.physicalPages,
        currentChunk: 0,
        boundaryType: result.tables.length > 0 ? 'table' : 'page',
      },
      entities: {},
      topics: {},
      relationships: [],
      sources: {
        [result.filePath]: {
          sha256: result.sha256,
          logicalPages: String(result.logicalPages),
          physicalPages: result.physicalPages,
          warnings: result.warnings,
        },
      },
      folderHierarchy: {},
      rawFragments: result.pages
        .filter((p) => p.isScanned)
        .map((p) => ({
          source: result.filePath,
          pages: String(p.physicalPage),
          reason: 'Scanned or image-only page',
          fragment: p.text.slice(0, 200),
        })),
    },
  };
}

export function updateMemory(
  memory: OrchestratorMemory,
  entities: ExtractedEntity[],
  relationships: ExtractedRelationship[],
  folderPlacements: FolderPlan[],
): void {
  for (const entity of entities) {
    const key = entity.name.toLowerCase();
    memory.state.entities[key] = entity;
  }
  memory.state.relationships.push(...relationships);
  for (const folder of folderPlacements) {
    memory.state.folderHierarchy[folder.folder] = folder;
  }
  memory.rollingSummary = `Updated memory with ${Object.keys(memory.state.entities).length} entities and ${memory.state.relationships.length} relationships.`;
}
