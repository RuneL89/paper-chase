import { loadConfig } from '../config.js';
import { discoverWikis } from '../workspace.js';
import { CLIError } from '../errors.js';
import { runIngestion } from '../ingestion/engine.js';
import { buildRunLog, writeRunLog } from '../log.js';
import { createLLMClient } from '../llm/client.js';

import type { ProgressReporter } from '../progress/types.js';

export async function ingestCommand(workspace: string, slug: string, resume = false, reporter?: ProgressReporter): Promise<number> {
  if (!slug) {
    throw new CLIError(
      'Please provide a wiki slug. Example: llm-wiki-cli ingest acme',
    );
  }

  discoverWikis(workspace);
  const config = loadConfig(workspace, slug);

  const llmClient = createLLMClient(workspace, undefined, reporter);
  if (!llmClient.isEnabled()) {
    throw new CLIError(
      'LLM is not configured or enabled. Configure an LLM with "llm-wiki-cli configure-llm" or set provider to "test".',
    );
  }

  if (config.status !== 'ready') {
    console.warn(
      `Wiki "${slug}" is not ready (status: ${config.status}). Run sample first.`,
    );
  }

  console.log(`Starting full ingestion for wiki "${slug}"${resume ? ' (resuming)' : ''}…`);
  const result = await runIngestion(workspace, slug, config, resume, reporter);
  printSummary(slug, result);

  const status =
    result.errors.length > 0 ? 'failed' : result.warnings.length > 0 ? 'partial' : 'success';

  const log = buildRunLog('ingest', workspace, {
    wikiSlugs: [slug],
    sourceFiles: result.sourceFilePaths,
    chunkBoundaries: result.chunkBoundaries,
    pagesGenerated: [
      { type: 'document', count: result.documentPages },
      { type: 'raw', count: result.rawPages },
      { type: 'entity', count: result.entityPages },
      { type: 'topic', count: result.topicPages },
    ],
    warnings: result.warnings,
    errors: result.errors,
    status,
    lintIssues: result.lintIssues,
    added: result.added,
    changed: result.changed,
    removed: result.removed,
  });
  writeRunLog(workspace, log);

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
