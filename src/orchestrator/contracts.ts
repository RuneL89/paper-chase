import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { readCreatedTimestamp } from '../writers/preservation.js';
import type { Config } from '../config.js';
import type { FolderPlan, OrchestratorMemory } from './types.js';

export interface WikiIndexData {
  slug: string;
  title: string;
  description: string;
  scope: string;
  sourceCount: number;
  documentCount: number;
  entityCount: number;
  topicCount: number;
  rawCount: number;
  folders: FolderPlan[];
  warnings: string[];
}

export function writeWikiIndexContract(
  filePath: string,
  data: WikiIndexData,
  config: Config,
): void {
  mkdirSync(path.dirname(filePath), { recursive: true });

  const title = `${data.title} Index`;
  const children = data.folders.map((f) => `${f.folder}/index.md`);
  const now = new Date().toISOString();
  const created = readCreatedTimestamp(filePath) ?? now;

  const frontmatter = {
    title,
    type: 'index',
    wiki: data.slug,
    created,
    updated: now,
    children,
  };

  const lines = [
    `# ${title}`,
    '',
    '## Scope',
    '',
    data.description,
    '',
    '## Catalog',
    '',
    ...data.folders.map((f) => `- [[${f.title}]] — ${f.folder}/index.md`),
    '',
    '## Navigation',
    '',
    '- Start with document pages in [[documents]] to read the corpus.',
    '- See [[sources]] for the PDF catalog and provenance.',
    data.entityCount > 0 ? '- See [[entities]] for people, organizations, and other named entities.' : '',
    data.topicCount > 0 ? '- See [[topics]] for recurring themes and concepts.' : '',
    data.rawCount > 0 ? '- See [[raw]] for scanned or unparseable fragments.' : '',
    '',
    '## Contract',
    '',
    '- Page types: `document`, `source`, `topic`, `entity`, `raw`.',
    '- Citation format: `[^srcN]` mapped to `sources` frontmatter.',
    '- Naming convention: `<slug>-part-NNN.md` for document chunks, `<entity-slug>.md` for entities.',
    '- Every generated page must include `wiki: <slug>` and a `created` timestamp.',
    '',
    '## Statistics',
    '',
    `- Sources: ${data.sourceCount}`,
    `- Document pages: ${data.documentCount}`,
    `- Entity pages: ${data.entityCount}`,
    `- Topic pages: ${data.topicCount}`,
    `- Raw pages: ${data.rawCount}`,
    data.warnings.length > 0 ? `\n## Warnings\n\n${data.warnings.map((w) => `- ${w}`).join('\n')}` : '',
  ].filter(Boolean);

  writeFileSync(filePath, matter.stringify(lines.join('\n'), frontmatter));
}

export function writeFolderIndexContract(
  filePath: string,
  folder: FolderPlan,
  data: WikiIndexData,
  memory: OrchestratorMemory,
  folderPages: Record<string, string[]> = {},
): void {
  mkdirSync(path.dirname(filePath), { recursive: true });

  const parent = '../index.md';
  const children = folder.children.map((c) => `${c}/index.md`);
  const now = new Date().toISOString();
  const created = readCreatedTimestamp(filePath) ?? now;

  const frontmatter: Record<string, unknown> = {
    title: folder.title,
    type: 'index',
    wiki: data.slug,
    created,
    updated: now,
  };
  if (parent) frontmatter.parent = parent;
  if (children.length > 0) frontmatter.children = children;

  const siblingFolders = data.folders
    .filter((f) => f.folder !== folder.folder)
    .map((f) => `- [[${f.title}]] — ${f.folder}/index.md`);

  const pages = folderPages[folder.folder] ?? [];
  const catalogLines =
    pages.length > 0
      ? pages.map((p) => `- ${p}`)
      : ['- No pages in this folder yet.'];

  const namingConvention = getNamingConvention(folder.folder);

  const lines = [
    `# ${folder.title}`,
    '',
    '## Purpose',
    '',
    folder.description,
    '',
    '## Page Types',
    '',
    ...folder.pageTypes.map((t) => `- \`${t}\``),
    '',
    '## Naming Convention',
    '',
    namingConvention,
    '',
    '## Links to Other Folders',
    '',
    `- Parent: [[${data.title} Index]]`,
    ...(siblingFolders.length > 0 ? siblingFolders : ['- No sibling folders.']),
    '',
    '## Folder-Specific Rules',
    '',
    '- Every page must include `wiki: <slug>` and a `created` timestamp in its frontmatter.',
    '- Citation format is `[^srcN]` mapped to `sources` frontmatter.',
    '- Pages are linked to related entities, topics, and source pages via `[[...]]` wikilinks.',
    '',
    '## Catalog',
    '',
    ...catalogLines,
  ];

  writeFileSync(filePath, matter.stringify(lines.join('\n'), frontmatter));
}

function getNamingConvention(folder: string): string {
  switch (folder) {
    case 'documents':
      return '`<source-slug>-part-NNN.md` for each document chunk.';
    case 'sources':
      return '`<source-slug>.md` for each source PDF catalog page.';
    case 'entities':
      return '`<subfolder>/<entity-slug>.md` inside typed entity sub-folders.';
    case 'topics':
      return '`<topic-slug>.md` for each recurring theme.';
    case 'raw':
      return '`<source-slug>-page-NNN.md` for scanned pages, or `<source-slug>.md` for malformed files.';
  }
  if (folder.startsWith('entities/')) {
    return '`<entity-slug>.md` for each named entity in this group.';
  }
  return '`<slug>.md` for pages in this folder.';
}
