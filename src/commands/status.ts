import { readdirSync, statSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import { discoverWikis, wikiPath } from '../workspace.js';
import { buildRunLog, writeRunLog } from '../log.js';

interface WikiStatus {
  slug: string;
  title: string;
  description: string;
  sourceCount: number;
  documentCount: number;
  entityCount: number;
  topicCount: number;
  rawCount: number;
  totalGeneratedPages: number;
  lastRun: string;
  warnings: string[];
}

export async function statusCommand(workspace: string): Promise<number> {
  const wikis = discoverWikis(workspace);
  const statuses: WikiStatus[] = [];

  for (const slug of wikis) {
    statuses.push(gatherWikiStatus(workspace, slug));
  }

  printStatus(statuses);
  writeStatusLog(workspace, wikis, statuses);
  return 0;
}

function gatherWikiStatus(workspace: string, slug: string): WikiStatus {
  const wikiDir = wikiPath(workspace, slug);
  const configPath = path.join(wikiDir, 'config.json');
  let title = slug;
  let description = '';
  if (existsSync(configPath)) {
    try {
      const parsed = JSON.parse(readFileSync(configPath, 'utf-8'));
      title = parsed.wiki?.title || slug;
      description = parsed.wiki?.description || '';
    } catch {
      // Ignore config parse errors.
    }
  }

  const rawDir = path.join(wikiDir, 'raw');
  const sourceCount = existsSync(rawDir)
    ? readdirSync(rawDir).filter((f) => f.toLowerCase().endsWith('.pdf')).length
    : 0;

  const outputDir = path.join(wikiDir, 'output');
  const documentCount = countMarkdownFiles(outputDir, 'documents');
  const entityCount = countMarkdownFiles(outputDir, 'entities');
  const topicCount = countMarkdownFiles(outputDir, 'topics');
  const rawCount = countMarkdownFiles(outputDir, 'raw');
  const totalGeneratedPages = documentCount + entityCount + topicCount + rawCount;

  const statePath = path.join(outputDir, '.state', 'ingest-state.json');
  let lastRun = 'never';
  if (existsSync(statePath)) {
    try {
      const parsed = JSON.parse(readFileSync(statePath, 'utf-8'));
      if (parsed.lastRun) lastRun = parsed.lastRun;
    } catch {
      // Ignore state parse errors.
    }
  }

  const warnings: string[] = [];
  const lintPath = path.join(outputDir, 'lint', 'report.json');
  if (existsSync(lintPath)) {
    try {
      const report = JSON.parse(readFileSync(lintPath, 'utf-8')) as {
        issues?: { type: string; file: string; message: string }[];
      };
      for (const issue of report.issues || []) {
        warnings.push(`[${issue.type}] ${issue.file}: ${issue.message}`);
      }
    } catch {
      // Ignore lint parse errors.
    }
  }

  return {
    slug,
    title,
    description,
    sourceCount,
    documentCount,
    entityCount,
    topicCount,
    rawCount,
    totalGeneratedPages,
    lastRun,
    warnings,
  };
}

function countMarkdownFiles(dir: string, subdir: string): number {
  const fullDir = path.join(dir, subdir);
  if (!existsSync(fullDir)) return 0;
  return readdirSync(fullDir).filter(
    (f) => f.endsWith('.md') && statSync(path.join(fullDir, f)).isFile(),
  ).length;
}

function printStatus(statuses: WikiStatus[]): void {
  if (statuses.length === 0) {
    console.log('No wikis found in this workspace.');
    return;
  }

  console.log(`Discovered ${statuses.length} wiki(s) in this workspace:`);
  console.log('');

  for (const s of statuses) {
    console.log(`Wiki: ${s.title} (${s.slug})`);
    console.log(`  Description: ${s.description || 'No description'}`);
    console.log(`  Sources: ${s.sourceCount}`);
    console.log(`  Generated pages: ${s.totalGeneratedPages} (${s.documentCount} documents, ${s.entityCount} entities, ${s.topicCount} topics, ${s.rawCount} raw)`);
    console.log(`  Last ingestion: ${s.lastRun}`);
    if (s.warnings.length > 0) {
      console.log(`  Warnings: ${s.warnings.length}`);
      for (const warning of s.warnings) {
        console.log(`    - ${warning}`);
      }
    }
    console.log('');
  }
}

function writeStatusLog(workspace: string, wikis: string[], statuses: WikiStatus[]): void {
  const sourceFiles: string[] = [];
  for (const s of statuses) {
    const rawDir = path.join(wikiPath(workspace, s.slug), 'raw');
    if (existsSync(rawDir)) {
      for (const file of readdirSync(rawDir)) {
        if (file.toLowerCase().endsWith('.pdf')) {
          sourceFiles.push(`wikis/${s.slug}/raw/${file}`);
        }
      }
    }
  }

  const warnings: string[] = [];
  for (const s of statuses) {
    warnings.push(...s.warnings);
  }

  const log = buildRunLog('status', workspace, {
    wikiSlugs: wikis,
    sourceFiles,
    pagesGenerated: statuses.map((s) => ({ type: s.slug, count: s.totalGeneratedPages })),
    warnings,
    errors: [],
    status: 'success',
  });
  writeRunLog(workspace, log);
}
