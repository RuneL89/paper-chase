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
  defaultFolderPlacements,
} from './agents.js';
import { writeWikiIndexContract, writeFolderIndexContract, type WikiIndexData } from './contracts.js';
import { validatePagePlan } from './validation.js';
import type { OrchestratorMemory, FolderPlan, CriticReview, PagePlan } from './types.js';

export interface StructuralProposal {
  type: 'new-folder' | 'restructure';
  reason: string;
  currentFolders: string[];
  proposedFolders: string[];
}

export interface IngestOrchestratorResult {
  memory: OrchestratorMemory;
  folderPlacements: FolderPlan[];
  pages: PagePlan[];
  critic: CriticReview;
  proposals: StructuralProposal[];
}

export async function runIngestOrchestrator(
  workspace: string,
  slug: string,
  config: Config,
  result: ExtractionResult,
  chunks: Chunk[],
  llmClient: LLMClient,
  previousMemory?: OrchestratorMemory,
): Promise<IngestOrchestratorResult> {
  const structure = structureAnalyst(result, chunks);
  const { entities } = entityExtractor(result, chunks);
  const { relationships } = relationshipExtractor(result, entities);
  const evidence = evidenceCollector(result, chunks);

  let plannerOutput;
  try {
    plannerOutput = await pagePlanner(result, structure, entities, evidence, llmClient);
  } catch (error) {
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

  const writerOutput = chunkWriter(plannerOutput.pages);
  const criticReview = critic(result, plannerOutput.pages, folderPlacements);
  const validationReview = validatePagePlan(plannerOutput.pages, folderPlacements);
  const combinedIssues = [...criticReview.issues, ...validationReview.issues];
  const combinedCritic: CriticReview = {
    issues: combinedIssues,
    confidence: combinedIssues.length === 0 ? 'high' : 'low',
  };

  const memory = previousMemory
    ? mergeMemory(previousMemory, result, chunks)
    : createInitialMemory(result, chunks);
  updateMemory(memory, entities, relationships, folderPlacements);

  const proposals = detectStructuralProposals(
    previousMemory?.state.folderHierarchy ?? {},
    folderPlacements,
  );

  return {
    memory,
    folderPlacements,
    pages: plannerOutput.pages,
    critic: combinedCritic,
    proposals,
  };
}

export function writeIngestContracts(
  workspace: string,
  slug: string,
  config: Config,
  memory: OrchestratorMemory,
  folderPlacements: FolderPlan[],
  sourceCount: number,
  documentCount: number,
  rawCount: number,
  warnings: string[],
): string[] {
  const wikiDir = path.join(workspace, 'wikis', slug);
  const wikiIndexPath = path.join(wikiDir, 'index.md');

  const indexData: WikiIndexData = {
    slug,
    title: config.wiki.title,
    description: config.wiki.description,
    scope: memory.rollingSummary,
    sourceCount,
    documentCount,
    entityCount: Object.keys(memory.state.entities).length,
    topicCount: Object.keys(memory.state.topics).length,
    rawCount,
    folders: folderPlacements,
    warnings,
  };

  writeWikiIndexContract(wikiIndexPath, indexData, config);

  const folderIndexes: string[] = [];
  for (const folder of folderPlacements) {
    const folderIndexPath = path.join(wikiDir, folder.folder, 'index.md');
    writeFolderIndexContract(folderIndexPath, folder, indexData, memory);
    folderIndexes.push(folderIndexPath);
  }

  return folderIndexes;
}

function mergeMemory(
  previous: OrchestratorMemory,
  result: ExtractionResult,
  chunks: Chunk[],
): OrchestratorMemory {
  const merged: OrchestratorMemory = {
    rollingSummary: previous.rollingSummary + `\nProcessing ${result.fileName} (${result.physicalPages} pages, ${chunks.length} chunks).`,
    state: {
      document: {
        title: previous.state.document.title || result.metadata.title || result.fileName,
        totalPages: Math.max(previous.state.document.totalPages, result.physicalPages),
        currentChunk: previous.state.document.currentChunk + chunks.length,
        boundaryType: previous.state.document.boundaryType,
      },
      entities: { ...previous.state.entities },
      topics: { ...previous.state.topics },
      relationships: [...previous.state.relationships],
      sources: { ...previous.state.sources },
      folderHierarchy: { ...previous.state.folderHierarchy },
      rawFragments: [...previous.state.rawFragments],
    },
  };

  merged.state.sources[result.filePath] = {
    sha256: result.sha256,
    logicalPages: String(result.logicalPages),
    physicalPages: result.physicalPages,
    warnings: result.warnings,
  };

  for (const page of result.pages) {
    if (page.isScanned) {
      merged.state.rawFragments.push({
        source: result.filePath,
        pages: String(page.physicalPage),
        reason: 'Scanned or image-only page',
        fragment: page.text.slice(0, 200),
      });
    }
  }

  return merged;
}

function detectStructuralProposals(
  previousHierarchy: Record<string, FolderPlan>,
  currentPlacements: FolderPlan[],
): StructuralProposal[] {
  const previousFolders = new Set(Object.keys(previousHierarchy));
  const currentFolders = new Set(currentPlacements.map((f) => f.folder));
  const addedFolders = currentPlacements.filter((f) => !previousFolders.has(f.folder));

  if (previousFolders.size === 0 || addedFolders.length === 0) {
    return [];
  }

  return [
    {
      type: 'new-folder',
      reason: `New corpus content requires additional folders: ${addedFolders.map((f) => f.title).join(', ')}.`,
      currentFolders: Array.from(previousFolders),
      proposedFolders: Array.from(currentFolders),
    },
  ];
}
