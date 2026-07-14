import path from 'path';
import { existsSync, readdirSync } from 'fs';
import type { LLMClient } from '../llm/client.js';
import type { Config } from '../config.js';
import type { Chunk } from '../chunking/types.js';
import type { ExtractionResult } from '../extractor/types.js';
import { CLIError } from '../errors.js';
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
  mergeEntityTaxonomy,
  entityCritic,
  applyEntityAudit,
} from './agents.js';
import { writeDocumentPage } from '../writers/document.js';
import { writeWikiIndexContract, writeFolderIndexContract, type WikiIndexData } from './contracts.js';
import { validatePagePlan } from './validation.js';
import {
  syncFolderPageTypes,
} from './proposals.js';
import { readAgentsMd } from './ingest.js';
import type { ProgressReporter } from '../progress/types.js';
import { NoOpReporter } from '../progress/types.js';
import type { OrchestratorResult, CriticReview, FolderPlan, PagePlan } from './types.js';

export async function runSampleOrchestrator(
  workspace: string,
  slug: string,
  config: Config,
  result: ExtractionResult,
  chunks: Chunk[],
  llmClient: LLMClient,
  samplingStrategy?: { category: string; reason: string },
  reporter?: ProgressReporter,
): Promise<OrchestratorResult> {
  const progress = reporter ?? new NoOpReporter();
  // Step 1: StructureAnalyst
  const structure = await progress.step(
    'structure-analyst',
    'Analyzing document structure',
    () => structureAnalyst(result, chunks, llmClient),
  );

  // Step 2: EntityExtractor
  const { entities: rawEntities } = await progress.step(
    'entity-extractor',
    'Extracting entities',
    () => entityExtractor(result, chunks, llmClient),
  );

  // Step 2b: EntityCritic audits the extracted entity list.
  const audit = await progress.step(
    'entity-critic',
    'Auditing extracted entities',
    () => entityCritic(rawEntities, result, llmClient),
  );
  const entities = applyEntityAudit(rawEntities, audit);

  // Step 3: RelationshipExtractor
  const { relationships } = await progress.step(
    'relationship-extractor',
    'Extracting relationships',
    () => relationshipExtractor(result, entities, llmClient),
  );

  // Step 4: EvidenceCollector
  const evidence = await progress.step(
    'evidence-collector',
    'Collecting evidence',
    () => evidenceCollector(result, chunks, llmClient),
  );

  // Step 5: PagePlanner (LLM-only; aborts on invalid or empty output)
  // Pass the wiki's ingestion guide and initial rolling memory so the plan
  // respects existing conventions and discovered state.
  const agentsMd = readAgentsMd(workspace, slug);
  const initialMemory = createInitialMemory(result, chunks);
  const plannerOutput = await progress.step(
    'page-planner',
    'Planning wiki pages',
    () => pagePlanner(
      result,
      structure,
      entities,
      evidence,
      llmClient,
      agentsMd,
      initialMemory,
      samplingStrategy,
    ),
  );

  if (plannerOutput.folderPlacements.length === 0) {
    throw new CLIError('PagePlanner returned no folder placements.');
  }

  const folderPlacements = plannerOutput.folderPlacements;

  syncFolderPageTypes(folderPlacements, plannerOutput.pages);

  // Rolling memory
  const memory = initialMemory;
  const extractedTopics = extractTopicsFromPagePlans(plannerOutput.pages);
  updateMemory(
    memory,
    result.filePath,
    entities,
    relationships,
    extractedTopics,
    folderPlacements,
    plannerOutput.entityTaxonomy,
  );

  // Step 6: ChunkWriter — LLM authors every document page before the Critic reviews them.
  const pageUpdates = await progress.step(
    'chunk-writer',
    'Writing document chunks',
    () => chunkWriter(
      plannerOutput.pages,
      chunks,
      result,
      config,
      llmClient,
      agentsMd,
      memory,
    ),
  );

  // Step 7: Critic (LLM-driven) reviews the drafted pages, not just the plan.
  const criticReview = await progress.step(
    'critic',
    'Reviewing drafted pages',
    () => critic(result, plannerOutput.pages, folderPlacements, llmClient, agentsMd, memory, pageUpdates),
  );
  if (criticReview.issues.length > 0) {
    progress.criticIssues(criticReview.issues);
  }
  const validationReview = validatePagePlan(plannerOutput.pages, folderPlacements);
  const combinedIssues = [...criticReview.issues, ...validationReview.issues];
  const combinedCritic: CriticReview = {
    approved: combinedIssues.length === 0,
    issues: combinedIssues,
    confidence: combinedIssues.length === 0 ? 'high' : 'low',
    checks: criticReview.checks,
    blockingIssues: criticReview.blockingIssues,
  };

  // Write index contracts
  const wikiDir = path.join(workspace, 'wikis', slug);
  const wikiIndexPath = path.join(wikiDir, 'index.md');

  // Reflect entity sub-folders in the entities folder plan.
  const entitySubFolders = memory.state.entityTaxonomy.subFolders;
  const entityFolderPlan = folderPlacements.find((f) => f.folder === 'entities');
  if (entityFolderPlan) {
    entityFolderPlan.children = entitySubFolders.map((s) => s.slug);
  }

  const folderPages = collectFolderPages(wikiDir, folderPlacements);
  if (entityFolderPlan) {
    folderPages['entities'] = entitySubFolders.map((s) => `${s.slug}/index.md`);
  }
  for (const sub of entitySubFolders) {
    const fullDir = path.join(wikiDir, 'entities', sub.slug);
    if (existsSync(fullDir)) {
      folderPages[`entities/${sub.slug}`] = readdirSync(fullDir)
        .filter((f) => f.endsWith('.md') && f !== 'index.md')
        .sort();
    }
  }

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
    writeFolderIndexContract(folderIndexPath, folder, indexData, memory, folderPages);
    folderIndexes.push(folderIndexPath);
  }

  // Write each entity sub-folder index as a DOX child contract.
  for (const sub of entitySubFolders) {
    const subFolderPlan: FolderPlan = {
      folder: `entities/${sub.slug}`,
      title: sub.title,
      description: sub.description,
      pageTypes: ['entity'],
      children: [],
    };
    const subIndexPath = path.join(wikiDir, 'entities', sub.slug, 'index.md');
    writeFolderIndexContract(subIndexPath, subFolderPlan, indexData, memory, folderPages);
    folderIndexes.push(subIndexPath);
  }

  return {
    wikiIndexPath,
    folderIndexes,
    memory,
    critic: combinedCritic,
    pages: plannerOutput.pages,
    pageUpdates,
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

function collectFolderPages(
  wikiDir: string,
  folderPlacements: FolderPlan[],
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const folder of folderPlacements) {
    const fullDir = path.join(wikiDir, folder.folder);
    if (!existsSync(fullDir)) continue;
    const entries = readdirSync(fullDir)
      .filter((f) => f.endsWith('.md') && f !== 'index.md')
      .sort();
    result[folder.folder] = entries;
  }
  return result;
}
