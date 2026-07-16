import { existsSync } from 'fs';
import path from 'path';
import { loadConfig } from '../config.js';
import { discoverWikis } from '../workspace.js';
import { CLIError } from '../errors.js';
import { applyProposal } from '../orchestrator/proposals.js';
import { runReingest } from '../ingestion/reingest.js';
import { loadState, saveState, statePath } from '../ingestion/state.js';
import { buildRunLog, writeRunLog } from '../log.js';

export async function applyProposalCommand(
  workspace: string,
  slug: string,
  proposalFile: string,
): Promise<number> {
  if (!slug || !proposalFile) {
    throw new CLIError(
      'Please provide a wiki slug and a proposal file. ' +
        'Example: llm-wiki-cli apply-proposal acme 2026-07-09T12-00-00-000Z-acme-structural-change.md',
    );
  }

  discoverWikis(workspace);
  const config = loadConfig(workspace, slug);

  let proposalPath = proposalFile;
  if (!existsSync(proposalPath)) {
    const candidate = path.join(workspace, '.kimi-code', 'proposals', proposalFile);
    if (existsSync(candidate)) {
      proposalPath = candidate;
    } else {
      throw new CLIError(`Proposal file not found: ${proposalFile}`);
    }
  }

  const wikiDir = path.join(workspace, 'wikis', slug);
  const stateFile = statePath(wikiDir);
  const state = loadState(stateFile);
  const memory = state.memory || {
    rollingSummary: '',
    historicalSummary: '',
    summaryOnly: false,
    state: {
      document: { title: '', totalPages: 0, currentChunk: 0, boundaryType: 'page' },
      entities: {},
      topics: {},
      relationships: [],
      sources: {},
      folderHierarchy: {},
      entityTaxonomy: { subFolders: [], assignments: {} },
      rawFragments: [],
      duplicateFlags: [],
      sourceEntities: {},
      sourceTopics: {},
    },
  };

  const { proposal } = applyProposal(workspace, slug, proposalPath, config, state, memory);

  state.memory = memory;
  saveState(stateFile, state);

  const hierarchy = { ...memory.state.folderHierarchy };
  const reingestResult = await runReingest(workspace, slug, config, hierarchy);

  console.log(`Structural change applied for wiki "${slug}".`);
  if (reingestResult.affectedPages.length > 0) {
    console.log(`  Re-ingested ${reingestResult.affectedPages.length - reingestResult.skippedPages.length} affected page(s).`);
    if (reingestResult.pagesMoved.length > 0) {
      console.log(`  Moved: ${reingestResult.pagesMoved.join(', ')}`);
    }
    if (reingestResult.pagesDeleted.length > 0) {
      console.log(`  Deleted: ${reingestResult.pagesDeleted.join(', ')}`);
    }
  }
  if (reingestResult.manualEditWarnings.length > 0) {
    console.log(`  Warnings: ${reingestResult.manualEditWarnings.length}`);
    for (const warning of reingestResult.manualEditWarnings) {
      console.log(`    - ${warning}`);
    }
  }

  const status = reingestResult.manualEditWarnings.length > 0 ? 'partial' : 'success';
  const log = buildRunLog('apply-proposal', workspace, {
    wikiSlugs: [slug],
    sourceFiles: reingestResult.affectedPages,
    pagesGenerated: [
      { type: 'document', count: reingestResult.affectedPages.length - reingestResult.skippedPages.length },
    ],
    warnings: reingestResult.manualEditWarnings,
    errors: [],
    status,
    proposal: proposal.type,
  });
  writeRunLog(workspace, log);

  return 0;
}
