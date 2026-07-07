import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
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

  const frontmatter = {
    title,
    type: 'index',
    wiki: data.slug,
    updated: new Date().toISOString(),
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
): void {
  mkdirSync(path.dirname(filePath), { recursive: true });

  const parent = '../index.md';
  const children = folder.children.map((c) => `${c}/index.md`);

  const frontmatter: Record<string, unknown> = {
    title: folder.title,
    type: 'index',
    wiki: data.slug,
    updated: new Date().toISOString(),
  };
  if (parent) frontmatter.parent = parent;
  if (children.length > 0) frontmatter.children = children;

  const lines = [
    `# ${folder.title}`,
    '',
    '## Catalog',
    '',
    `This folder contains ${folder.pageTypes.join(', ')} pages.`,
    '',
    '## Navigation',
    '',
    `- Parent: [[${data.title} Index]]`,
    '',
    '## Contract',
    '',
    `- Page types in this folder: ${folder.pageTypes.join(', ')}.`,
    '- Citation format: `[^srcN]` mapped to `sources` frontmatter.',
    folder.description,
  ];

  writeFileSync(filePath, matter.stringify(lines.join('\n'), frontmatter));
}
