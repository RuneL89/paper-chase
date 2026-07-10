import { existsSync, renameSync } from 'fs';
import path from 'path';
import { loadConfig } from '../config.js';
import { discoverWikis } from '../workspace.js';
import { CLIError } from '../errors.js';
import { applyProposal } from '../orchestrator/proposals.js';
import { runReingest } from '../ingestion/reingest.js';
import { loadState, statePath } from '../ingestion/state.js';
import { buildRunLog, writeRunLog } from '../log.js';

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
    const outputDir = path.join(wikiDir, config.output.dir);
    const state = loadState(statePath(wikiDir, config.output.dir));
    const hierarchy: Record<string, import('../orchestrator/types.js').FolderPlan> = {};
    const previous = state.memory?.state?.folderHierarchy || {};
    for (const folder of Object.values(previous)) {
      hierarchy[folder.folder] = folder;
    }

    // Apply folder renames/moves before the reingest pass so existing pages follow
    // the new folder directory and state paths stay consistent.
    if (proposal.renamedFolders && proposal.renamedFolders.length > 0) {
      for (const rename of proposal.renamedFolders) {
        const oldDir = path.join(outputDir, rename.from);
        const newDir = path.join(outputDir, rename.to);
        if (existsSync(oldDir)) {
          renameSync(oldDir, newDir);
        }

        const oldPrefix = `${rename.from}/`;
        const newPrefix = `${rename.to}/`;
        for (const sourceState of Object.values(state.sources)) {
          sourceState.documentPages = sourceState.documentPages.map((p) =>
            p.startsWith(oldPrefix) ? newPrefix + p.slice(oldPrefix.length) : p,
          );
          sourceState.rawPages = sourceState.rawPages.map((p) =>
            p.startsWith(oldPrefix) ? newPrefix + p.slice(oldPrefix.length) : p,
          );
        }
        for (const [pagePath, pageState] of Object.entries(state.pages || {})) {
          if (pagePath.startsWith(oldPrefix) || pageState.folder === rename.from) {
            const newPagePath = pagePath.startsWith(oldPrefix)
              ? newPrefix + pagePath.slice(oldPrefix.length)
              : pagePath;
            if (newPagePath !== pagePath) {
              state.pages![newPagePath] = { ...pageState, folder: rename.to };
              delete state.pages![pagePath];
            } else {
              pageState.folder = rename.to;
            }
          }
        }
        delete hierarchy[rename.from];
        hierarchy[rename.to] = {
          folder: rename.to,
          title: rename.title,
          description: rename.description,
          pageTypes: rename.pageTypes,
          children: rename.children,
        };
        state.memory!.state.folderHierarchy[rename.to] = hierarchy[rename.to];
        delete state.memory!.state.folderHierarchy[rename.from];
      }
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
  } else {
    console.log(`Proposal rejected for wiki "${slug}".`);
    const log = buildRunLog('apply-proposal', workspace, {
      wikiSlugs: [slug],
      sourceFiles: [],
      warnings: [`Proposal rejected: ${proposal.reason}`],
      errors: [],
      status: 'failed',
      proposal: proposal.type,
    });
    writeRunLog(workspace, log);
  }
  return 0;
}
