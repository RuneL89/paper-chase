import { loadConfig } from '../config.js';
import { discoverWikis } from '../workspace.js';
import { CLIError } from '../errors.js';
import { runIngestion } from '../ingestion/engine.js';

export async function ingestCommand(workspace: string, slug: string, resume = false, autoApproveProposals = false): Promise<number> {
  if (!slug) {
    throw new CLIError(
      'Please provide a wiki slug. Example: llm-wiki-cli ingest acme',
    );
  }

  discoverWikis(workspace);
  const config = loadConfig(workspace, slug);

  if (config.status !== 'ready') {
    console.warn(
      `Wiki "${slug}" is not ready (status: ${config.status}). Run sample first.`,
    );
  }

  console.log(`Starting full ingestion for wiki "${slug}"${resume ? ' (resuming)' : ''}…`);
  const result = await runIngestion(workspace, slug, config, resume, autoApproveProposals);
  printSummary(slug, result);
  return 0;
}

function printSummary(slug: string, result: { sourceFiles: number; documentPages: number; rawPages: number; entityPages: number; topicPages: number; warnings: string[]; errors: string[]; added: string[]; changed: string[]; removed: string[]; proposals?: { type: string; reason: string; currentFolders: string[]; proposedFolders: string[] }[] }): void {
  console.log(`Full ingestion complete for wiki "${slug}".`);
  console.log(`  Source files processed: ${result.sourceFiles}`);
  console.log(`  Document pages: ${result.documentPages}`);
  console.log(`  Raw pages: ${result.rawPages}`);
  console.log(`  Entity pages: ${result.entityPages}`);
  console.log(`  Topic pages: ${result.topicPages}`);
  if (result.added.length > 0) {
    console.log(`  Added: ${result.added.map((f) => f.split('/').pop()).join(', ')}`);
  }
  if (result.changed.length > 0) {
    console.log(`  Changed: ${result.changed.map((f) => f.split('/').pop()).join(', ')}`);
  }
  if (result.removed.length > 0) {
    console.log(`  Removed: ${result.removed.map((f) => f.split('/').pop()).join(', ')}`);
  }
  if (result.proposals && result.proposals.length > 0) {
    console.log(`  Structural proposals: ${result.proposals.length}`);
    for (const proposal of result.proposals) {
      console.log(`    - ${proposal.type}: ${proposal.reason}`);
    }
  }
  if (result.warnings.length > 0) {
    console.log(`  Warnings: ${result.warnings.length}`);
    for (const warning of result.warnings) {
      console.log(`    - ${warning}`);
    }
  }
  if (result.errors.length > 0) {
    console.log(`  Errors: ${result.errors.length}`);
    for (const error of result.errors) {
      console.log(`    - ${error}`);
    }
  }
  console.log('');
  console.log('You can now browse the wiki index, sources, and linked pages.');
}
