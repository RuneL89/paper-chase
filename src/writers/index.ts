import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
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

export function writeWikiIndex(
  filePath: string,
  config: Config,
  sources: SourcePageInfo[],
  documents: DocumentPageInfo[],
  entities: string[],
  topics: string[],
  rawPages: RawPageInfo[],
  stats: { warnings: number; errors: number },
): void {
  mkdirSync(path.dirname(filePath), { recursive: true });

  const title = `${config.wiki.title} Index`;
  const frontmatter = {
    title,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    type: 'index',
    wiki: config.wiki.slug,
    sources: sources.map((s) => s.filePath),
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
  const frontmatter = {
    title: 'Index of Indexes',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    type: 'index',
    wikis: wikis.map((w) => w.slug),
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
