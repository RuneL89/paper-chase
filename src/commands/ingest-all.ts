import { loadConfig } from '../config.js';
import { discoverWikis } from '../workspace.js';
import { runIngestion } from '../ingestion/engine.js';
import type { IngestionResult } from '../ingestion/types.js';
import { summarizeWiki } from '../orchestrator/ingest.js';
import { buildRunLog, writeRunLog } from '../log.js';
import { writeIndexOfIndexes } from '../writers/index.js';
import { runWikiOfWikiAgent, type WikiOfWikiSummary } from '../orchestrator/wiki-of-wiki.js';

export async function ingestAllCommand(workspace: string): Promise<number> {
  const wikis = discoverWikis(workspace);
  const results: Record<string, IngestionResult> = {};
  const errors: string[] = [];
  const configVersions: Record<string, string> = {};

  for (const slug of wikis) {
    try {
      const config = loadConfig(workspace, slug);
      configVersions[slug] = config.wiki.version;
      console.log(`Starting full ingestion for wiki "${slug}"…`);
      const result = await runIngestion(workspace, slug, config, false);
      results[slug] = result;
      printWikiSummary(slug, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Wiki "${slug}" failed: ${message}`);
      console.error(`Failed to ingest wiki "${slug}": ${message}`);
    }
  }

  // Ensure the top-level index-of-indexes reflects the latest state with cross-wiki names.
  const wikiSummaries: WikiOfWikiSummary[] = wikis.map((s) => summarizeWiki(workspace, s));
  const wikiOfWikiResult = runWikiOfWikiAgent(workspace, wikiSummaries);
  writeIndexOfIndexes(workspace, wikiOfWikiResult.wikis, wikiOfWikiResult.crossWikiNames);

  writeIngestAllLog(workspace, wikis, results, errors, configVersions);

  console.log(`Ingest-all complete for ${wikis.length} wiki(s).`);
  return errors.length === 0 ? 0 : 1;
}

function printWikiSummary(slug: string, result: IngestionResult): void {
  console.log(`  ${slug}: ${result.sourceFiles} source(s), ${result.documentPages} document page(s), ${result.entityPages} entity page(s), ${result.topicPages} topic page(s), ${result.rawPages} raw page(s).`);
  if (result.warnings.length > 0) {
    console.log(`    Warnings: ${result.warnings.length}`);
  }
  if (result.errors.length > 0) {
    console.log(`    Errors: ${result.errors.length}`);
  }
}

function writeIngestAllLog(
  workspace: string,
  wikis: string[],
  results: Record<string, IngestionResult>,
  errors: string[],
  configVersions: Record<string, string>,
): void {
  const sourceFiles: string[] = [];
  const chunkBoundaries: { source: string; boundary: string; pageRange: string }[] = [];
  const pagesGenerated: { type: string; count: number }[] = [];
  const warnings: string[] = [];

  for (const [slug, result] of Object.entries(results)) {
    sourceFiles.push(...result.sourceFilePaths);
    chunkBoundaries.push(...result.chunkBoundaries);
    pagesGenerated.push(
      { type: `documents:${slug}`, count: result.documentPages },
      { type: `raw:${slug}`, count: result.rawPages },
      { type: `entities:${slug}`, count: result.entityPages },
      { type: `topics:${slug}`, count: result.topicPages },
    );
    warnings.push(...result.warnings);
  }

  const log = buildRunLog('ingest-all', workspace, {
    wikiSlugs: wikis,
    sourceFiles,
    chunkBoundaries,
    pagesGenerated,
    warnings,
    errors,
    status: errors.length === 0 ? 'success' : 'partial',
    configVersions,
  });
  writeRunLog(workspace, log);
}
