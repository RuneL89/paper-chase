import { mkdirSync, existsSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import { CLIError } from '../errors.js';
import { wikiPath } from '../workspace.js';
import { buildConfig, saveConfig } from '../config.js';
import { prompt } from '../prompt.js';
import { buildRunLog, writeRunLog } from '../log.js';
import { writeSkeletonAgentsMd } from '../writers/agents.js';
import { writeSkeletonWikiIndex } from '../writers/index.js';

export interface InitOptions {
  workspace: string;
  slug: string;
  title?: string;
  description?: string;
  force?: boolean;
}

export async function initCommand(options: InitOptions): Promise<number> {
  const { workspace, slug } = options;
  let { title, description } = options;

  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new CLIError(
      `Invalid wiki slug "${slug}". Slugs must be lowercase letters, numbers, and hyphens only.`,
    );
  }

  const wikiDir = wikiPath(workspace, slug);
  const configPath = path.join(wikiDir, 'config.json');

  if (existsSync(configPath) && !options.force) {
    throw new CLIError(
      `Wiki "${slug}" already exists. Use --force to re-initialize, or choose a different slug.`,
    );
  }

  if (!title) {
    title = await prompt('Wiki title', slugToTitle(slug));
  }

  if (!description) {
    description = await prompt('Wiki description', `Wiki for ${title}`);
  }

  // Re-initialize: remove the existing wiki folder if it exists and force is set.
  if (existsSync(wikiDir) && options.force) {
    rmSync(wikiDir, { recursive: true, force: true });
  }

  const config = buildConfig(workspace, slug, title, description);
  config.status = 'initialized';

  mkdirSync(wikiDir, { recursive: true });
  mkdirSync(path.join(wikiDir, 'raw'), { recursive: true });

  saveConfig(workspace, slug, config);
  writeSkeletonWikiIndex(path.join(wikiDir, 'index.md'), config);
  writeSkeletonAgentsMd(path.join(wikiDir, 'AGENTS.md'), config);
  writeChunkingStrategyStub(path.join(wikiDir, 'chunking-strategy.md'));

  console.log(`Initialized wiki "${slug}" at ${wikiDir}`);
  console.log(`  Title: ${title}`);
  console.log(`  Status: initialized`);
  console.log('Next steps:');
  console.log(`  1. Add PDFs to wikis/${slug}/raw/`);
  console.log(`  2. Run: llm-wiki-cli sample ${slug} wikis/${slug}/raw/<pdf>`);
  console.log(`  3. Run: llm-wiki-cli ingest ${slug}`);

  writeInitRunLog(workspace, slug);
  return 0;
}

function slugToTitle(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function writeChunkingStrategyStub(filePath: string): void {
  const lines = [
    '# Chunking Strategy',
    '',
    'This file documents the chunking strategy for the wiki.',
    'It will be populated when `sample` is run.',
    '',
  ];
  writeFileSync(filePath, lines.join('\n'));
}

function writeInitRunLog(workspace: string, slug: string): void {
  const log = buildRunLog('init', workspace, {
    wikiSlugs: [slug],
    pagesGenerated: [{ type: 'index', count: 1 }],
    warnings: [],
    errors: [],
    status: 'success',
  });
  writeRunLog(workspace, log);
}
