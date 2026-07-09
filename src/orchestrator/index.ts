import path from 'path';
import type { LLMClient } from '../llm/client.js';
import type { Config } from '../config.js';
import type { Chunk } from '../chunking/types.js';
import type { ExtractionResult } from '../extractor/types.js';
import {
  structureAnalyst,
  entityExtractor,
  relationshipExtractor,
  evidenceCollector,
  pagePlanner,
  chunkWriter,
  critic,
  createInitialMemory,
  updateMemory,
} from './agents.js';
import { writeWikiIndexContract, writeFolderIndexContract, type WikiIndexData } from './contracts.js';
import { validatePagePlan } from './validation.js';
import type { OrchestratorResult, CriticReview, FolderPlan, PagePlan } from './types.js';

export async function runSampleOrchestrator(
  workspace: string,
  slug: string,
  config: Config,
  result: ExtractionResult,
  chunks: Chunk[],
  llmClient: LLMClient,
  samplingStrategy?: { category: string; reason: string },
): Promise<OrchestratorResult> {
  // Step 1: StructureAnalyst
  const structure = await structureAnalyst(result, chunks, llmClient);

  // Step 2: EntityExtractor
  const { entities } = await entityExtractor(result, chunks, llmClient);

  // Step 3: RelationshipExtractor
  const { relationships } = await relationshipExtractor(result, entities, llmClient);

  // Step 4: EvidenceCollector
  const evidence = await evidenceCollector(result, chunks, llmClient);

  // Step 5: PagePlanner (uses LLM when enabled; falls back to deterministic defaults)
  let plannerOutput;
  try {
    plannerOutput = await pagePlanner(
      result,
      structure,
      entities,
      evidence,
      llmClient,
      undefined,
      undefined,
      samplingStrategy,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    plannerOutput = {
      pages: [],
      folderPlacements: defaultFolderPlacements(result, entities),
      wikilinks: [],
      citations: [],
      discovery: {
        existingDocument: false,
        newEntities: false,
        newTopics: false,
        hasTablesFigures: false,
        rawPages: false,
        newPageType: false,
      },
    };
  }

  const folderPlacements = plannerOutput.folderPlacements.length > 0
    ? plannerOutput.folderPlacements
    : defaultFolderPlacements(result, entities);

  // Step 7: Critic (LLM-driven with deterministic fallback)
  const criticReview = await critic(result, plannerOutput.pages, folderPlacements, llmClient);
  const validationReview = validatePagePlan(plannerOutput.pages, folderPlacements);
  const combinedIssues = [...criticReview.issues, ...validationReview.issues];
  const combinedCritic: CriticReview = {
    issues: combinedIssues,
    confidence: combinedIssues.length === 0 ? 'high' : 'low',
  };

  // Rolling memory
  const memory = createInitialMemory(result, chunks);
  const extractedTopics = extractTopicsFromPagePlans(plannerOutput.pages);
  updateMemory(memory, result.filePath, entities, relationships, extractedTopics, folderPlacements);

  // Write index contracts
  const wikiDir = path.join(workspace, 'wikis', slug);
  const wikiIndexPath = path.join(wikiDir, 'index.md');

  const indexData: WikiIndexData = {
    slug,
    title: config.wiki.title,
    description: config.wiki.description,
    scope: memory.rollingSummary,
    sourceCount: 1,
    documentCount: chunks.length,
    entityCount: entities.length,
    topicCount: extractedTopics.length,
    rawCount: result.pages.filter((p) => p.isScanned).length,
    folders: folderPlacements,
    warnings: result.warnings,
  };

  writeWikiIndexContract(wikiIndexPath, indexData, config);

  const folderIndexes: string[] = [];
  for (const folder of folderPlacements) {
    const folderIndexPath = path.join(wikiDir, folder.folder, 'index.md');
    writeFolderIndexContract(folderIndexPath, folder, indexData, memory);
    folderIndexes.push(folderIndexPath);
  }

  return {
    wikiIndexPath,
    folderIndexes,
    memory,
    critic: combinedCritic,
  };
}

function extractTopicsFromPagePlans(
  pages: PagePlan[],
): { name: string; count: number; related: string[] }[] {
  const topics = new Map<string, { name: string; count: number; related: Set<string> }>();
  for (const page of pages) {
    if (page.pageType !== 'topic') continue;
    const name = topicNameFromPagePlan(page);
    const existing = topics.get(name);
    if (existing) {
      existing.count += 1;
      for (const r of page.related) existing.related.add(r);
    } else {
      topics.set(name, { name, count: 1, related: new Set(page.related) });
    }
  }
  return Array.from(topics.values()).map((t) => ({ ...t, related: Array.from(t.related) }));
}

function topicNameFromPagePlan(page: PagePlan): string {
  const lower = page.title.toLowerCase();
  if (lower.startsWith('topic:')) {
    return lower.slice(6).trim();
  }
  return lower.trim();
}

function defaultFolderPlacements(
  result: ExtractionResult,
  entities: { type: string }[],
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
