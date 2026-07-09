import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { readCreatedTimestamp } from './preservation.js';
import type { Config } from '../config.js';
import type { CrossWikiName } from '../orchestrator/wiki-of-wiki.js';

export interface SourcePageInfo {
  fileName: string;
  filePath: string;
  title: string;
  physicalPages: number;
  logicalPages: number;
  warnings: string[];
}

export interface DocumentPageInfo {
  fileName: string;
  title: string;
  sourceFile: string;
  sourcePageTitle: string;
  pageRange: string;
}

export interface RawPageInfo {
  fileName: string;
  title: string;
  sourceFile: string;
}

export interface FolderIndexRef {
  folder: string;
  title: string;
}

export function writeSkeletonWikiIndex(filePath: string, config: Config): void {
  mkdirSync(path.dirname(filePath), { recursive: true });

  const now = new Date().toISOString();
  const frontmatter = {
    title: config.wiki.title,
    type: 'index',
    wiki: config.wiki.slug,
    created: now,
    updated: now,
    children: [] as string[],
  };

  const lines: string[] = [
    `# ${config.wiki.title}`,
    '',
    config.wiki.description || `Wiki for ${config.wiki.title}.`,
    '',
    '## Scope',
    '',
    config.wiki.description || 'Scope will be refined during sampling.',
    '',
    '## Catalog',
    '',
    '- No folders or pages have been generated yet.',
    '',
    '## Navigation',
    '',
    '- Add PDFs to `raw/` and run `sample` to populate the wiki.',
    '',
    '## Contract',
    '',
    '- Page types: `document`, `source`, `topic`, `entity`, `raw`.',
    '- Citation format: `[^srcN]` mapped to `sources` frontmatter.',
    '- Naming convention: `<slug>-part-NNN.md` for document chunks, `<entity-slug>.md` for entities.',
    '',
  ];

  writeFileSync(filePath, matter.stringify(lines.join('\n'), frontmatter));
}

export function writeWikiIndex(
  filePath: string,
  config: Config,
  sources: SourcePageInfo[],
  documents: DocumentPageInfo[],
  entities: string[],
  topics: string[],
  rawPages: RawPageInfo[],
  stats: { warnings: number; errors: number },
  folderPlacements: FolderIndexRef[] = [],
): void {
  mkdirSync(path.dirname(filePath), { recursive: true });

  const title = `${config.wiki.title} Index`;
  const now = new Date().toISOString();
  const created = readCreatedTimestamp(filePath) ?? now;
  const frontmatter = {
    title,
    created,
    updated: now,
    type: 'index',
    wiki: config.wiki.slug,
    sources: sources.map((s) => s.filePath),
    children: folderPlacements.map((f) => `${f.folder}/index.md`),
  };

  const lines: string[] = [
    `# ${title}`,
    '',
    config.wiki.description,
    '',
    `**Sources:** ${sources.length}`,
    `**Document pages:** ${documents.length}`,
    `**Entity pages:** ${entities.length}`,
    `**Topic pages:** ${topics.length}`,
    `**Raw pages:** ${rawPages.length}`,
    `**Warnings:** ${stats.warnings}`,
    `**Errors:** ${stats.errors}`,
    '',
    '## Folders',
    '',
    ...(folderPlacements.length > 0
      ? folderPlacements.map((f) => `- [[${f.title}]] — ${f.folder}/index.md`)
      : ['- No folder indexes generated.']),
    '',
    '## Sources',
    '',
    ...sources.map((s) => `- [[${s.title}]] — ${s.fileName} (${s.physicalPages} pages)`),
    '',
    '## Document Pages',
    '',
    ...documents.map((d) =>
      `- [[${d.title}]] — source: [[${d.sourcePageTitle}]], pages ${d.pageRange}`
    ),
    '',
    '## Entities',
    '',
    ...(entities.length > 0
      ? entities.map((e) => `- [[${e}]]`)
      : ['- No entity pages generated.']),
    '',
    '## Topics',
    '',
    ...(topics.length > 0
      ? topics.map((t) => `- [[${t}]]`)
      : ['- No topic pages generated.']),
    '',
    '## Raw Pages',
    '',
    ...(rawPages.length > 0
      ? rawPages.map((r) => `- [[${r.title}]] — ${r.sourceFile}`)
      : ['- No raw pages generated.']),
    '',
  ];

  writeFileSync(filePath, matter.stringify(lines.join('\n'), frontmatter));
}

export function writeIndexOfIndexes(
  workspace: string,
  wikis: {
    slug: string;
    title: string;
    description: string;
    sourceCount: number;
    documentCount: number;
    entityCount: number;
    topicCount: number;
    rawCount: number;
  }[],
  crossWikiNames: CrossWikiName[] = [],
): void {
  const filePath = path.join(workspace, 'index-of-indexes.md');
  const now = new Date().toISOString();
  const created = readCreatedTimestamp(filePath) ?? now;
  const frontmatter = {
    title: 'Index of Indexes',
    created,
    updated: now,
    type: 'index',
    wiki: 'workspace',
    children: wikis.map((w) => `wikis/${w.slug}/index.md`),
  };

  const totalSources = wikis.reduce((sum, w) => sum + w.sourceCount, 0);
  const totalDocuments = wikis.reduce((sum, w) => sum + w.documentCount, 0);
  const totalEntities = wikis.reduce((sum, w) => sum + w.entityCount, 0);
  const totalTopics = wikis.reduce((sum, w) => sum + w.topicCount, 0);
  const totalRaw = wikis.reduce((sum, w) => sum + w.rawCount, 0);
  const totalGeneratedPages = totalDocuments + totalEntities + totalTopics + totalRaw;

  const lines: string[] = [
    '# Index of Indexes',
    '',
    'Top-level roadmap for the wiki workspace.',
    '',
    `**Wikis:** ${wikis.length}`,
    `**Sources:** ${totalSources}`,
    `**Document pages:** ${totalDocuments}`,
    `**Entity pages:** ${totalEntities}`,
    `**Topic pages:** ${totalTopics}`,
    `**Raw pages:** ${totalRaw}`,
    `**Total generated pages:** ${totalGeneratedPages}`,
    `**Last updated:** ${new Date().toISOString()}`,
    '',
    '## Wikis',
    '',
    ...wikis.map((w) =>
      `- [[${w.title} Index]] (${w.slug}) — ${w.sourceCount} sources, ${w.documentCount + w.entityCount + w.topicCount + w.rawCount} generated pages — ${w.description}`
    ),
    '',
    '## Overview',
    '',
    'This workspace contains the following wiki collections:',
    '',
    ...wikis.map((w) => `- **${w.title}**: ${w.description}`),
    '',
    '## Cross-Wiki Names',
    '',
    ...(crossWikiNames.length > 0
      ? crossWikiNames.map((n) => {
          const wikiLinks = n.wikis.map((w) => `[[${w.wikiTitle} Index]]`).join(', ');
          return `- **${n.name}** (${n.type}) — appears in ${wikiLinks}`;
        })
      : ['- No entity or topic names appear in more than one wiki.']),
    '',
  ];

  writeFileSync(filePath, matter.stringify(lines.join('\n'), frontmatter));
}
