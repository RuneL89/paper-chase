import { existsSync } from 'fs';
import path from 'path';
import { loadConfig } from '../config.js';
import { discoverWikis } from '../workspace.js';
import { CLIError } from '../errors.js';
import { applyProposal } from '../orchestrator/proposals.js';
import { runReingest } from '../ingestion/reingest.js';
import { loadState, statePath } from '../ingestion/state.js';

export interface ApplyProposalOptions {
  skipManualEdits?: boolean;
}

export async function applyProposalCommand(
  workspace: string,
  slug: string,
  proposalFile: string,
  options: ApplyProposalOptions = {},
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

  const { proposal, approved } = applyProposal(workspace, slug, proposalPath, config);

  if (approved) {
    const wikiDir = path.join(workspace, 'wikis', slug);
    const state = loadState(statePath(wikiDir, config.output.dir));
    const hierarchy: Record<string, import('../orchestrator/types.js').FolderPlan> = {};
    const previous = state.memory?.state?.folderHierarchy || {};
    for (const folder of Object.values(previous)) {
      hierarchy[folder.folder] = folder;
    }
    for (const folder of proposal.newFolderPlans) {
      hierarchy[folder.folder] = folder;
    }

    const reingestResult = await runReingest(workspace, slug, config, hierarchy, {
      skipManualEdits: options.skipManualEdits,
    });

    console.log(`Proposal applied for wiki "${slug}".`);
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
  } else {
    console.log(`Proposal rejected for wiki "${slug}".`);
  }
  return 0;
}
