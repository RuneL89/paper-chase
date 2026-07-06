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
import type { OrchestratorResult, CriticReview, FolderPlan } from './types.js';

export async function runSampleOrchestrator(
  workspace: string,
  slug: string,
  config: Config,
  result: ExtractionResult,
  chunks: Chunk[],
  llmClient: LLMClient,
): Promise<OrchestratorResult> {
  // Step 1: StructureAnalyst
  const structure = structureAnalyst(result, chunks);

  // Step 2: EntityExtractor
  const { entities } = entityExtractor(result, chunks);

  // Step 3: RelationshipExtractor
  const { relationships } = relationshipExtractor(result, entities);

  // Step 4: EvidenceCollector
  const evidence = evidenceCollector(result, chunks);

  // Step 5: PagePlanner (uses LLM when enabled; falls back to deterministic defaults)
  let plannerOutput;
  try {
    plannerOutput = await pagePlanner(result, structure, entities, evidence, llmClient);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    plannerOutput = {
      pages: [],
      folderPlacements: defaultFolderPlacements(result, entities),
      wikilinks: [],
      citations: [],
    };
  }

  const folderPlacements = plannerOutput.folderPlacements.length > 0
    ? plannerOutput.folderPlacements
    : defaultFolderPlacements(result, entities);

  // Step 6: ChunkWriter (produces the page plan; existing writers materialize files)
  const writerOutput = chunkWriter(plannerOutput.pages);

  // Step 7: Critic (deterministic validation of the plan)
  const criticReview = critic(result, plannerOutput.pages, folderPlacements);
  const validationReview = validatePagePlan(plannerOutput.pages, folderPlacements);
  const combinedIssues = [...criticReview.issues, ...validationReview.issues];
  const combinedCritic: CriticReview = {
    issues: combinedIssues,
    confidence: combinedIssues.length === 0 ? 'high' : 'low',
  };

  // Rolling memory
  const memory = createInitialMemory(result, chunks);
  updateMemory(memory, entities, relationships, folderPlacements);

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
    topicCount: 0,
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
