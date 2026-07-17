import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';
import { slugify } from './utils/slug';
import { wikiDir } from './utils/paths';

export interface WriteDoxOptions {
  workspace?: string;
}

interface FileNode {
  name: string;
  relativePath: string;
  title: string;
  linkText: string;
}

interface FolderNode {
  name: string;
  relativePath: string;
  files: FileNode[];
  subFolders: FolderNode[];
}

const EXCLUDED_FOLDERS = new Set(['.state', 'raw']);

function titleCase(name: string): string {
  return name
    .split('-')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function folderDescription(name: string): string {
  return `This folder contains pages and sub-folders related to ${name.replace(/-/g, ' ')}.`;
}

async function readPageTitle(absolutePath: string): Promise<string> {
  try {
    const content = await readFile(absolutePath, 'utf-8');
    const parsed = matter(content);
    if (typeof parsed.data.title === 'string' && parsed.data.title.trim().length > 0) {
      return parsed.data.title.trim();
    }
  } catch {
    // Fall back to the file name if the file cannot be read or has no title.
  }
  return '';
}

async function scanFolder(wikiDirPath: string, relativePath: string): Promise<FolderNode> {
  const absolutePath = join(wikiDirPath, relativePath);
  const entries = await readdir(absolutePath, { withFileTypes: true });

  const subFolders: FolderNode[] = [];
  const files: FileNode[] = [];

  for (const entry of entries) {
    if (entry.name === '.gitkeep') {
      continue;
    }
    if (entry.isDirectory()) {
      if (EXCLUDED_FOLDERS.has(entry.name)) {
        continue;
      }
      const childRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      subFolders.push(await scanFolder(wikiDirPath, childRelativePath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      const childRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      const title = await readPageTitle(join(wikiDirPath, childRelativePath));
      const fileSlug = entry.name.replace(/\.md$/i, '');
      const linkText = slugify(title) === fileSlug ? title : fileSlug;
      files.push({ name: entry.name, relativePath: childRelativePath, title, linkText });
    }
  }

  subFolders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return {
    name: relativePath ? relativePath.split('/').pop()! : '',
    relativePath,
    files,
    subFolders,
  };
}

function countContentFiles(folder: FolderNode): number {
  let count = folder.files.filter((file) => file.name.toLowerCase() !== 'index.md').length;
  for (const subFolder of folder.subFolders) {
    count += countContentFiles(subFolder);
  }
  return count;
}

function findSubFolder(folder: FolderNode, relativePath: string): FolderNode | undefined {
  if (folder.relativePath === relativePath) {
    return folder;
  }
  for (const subFolder of folder.subFolders) {
    const found = findSubFolder(subFolder, relativePath);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function emptyFolder(): FolderNode {
  return { name: '', relativePath: '', files: [], subFolders: [] };
}

function buildChildrenList(folder: FolderNode): string[] {
  if (folder.relativePath === '') {
    return ['entities/index.md', 'topics/index.md', 'documents/index.md', 'sources/index.md'];
  }
  const children: string[] = [];
  for (const subFolder of folder.subFolders) {
    children.push(`${subFolder.name}/index.md`);
  }
  for (const file of folder.files) {
    children.push(file.name);
  }
  return children;
}

function buildFolderBody(
  wikiSlug: string,
  folder: FolderNode,
  parentFolder: FolderNode | null,
): string {
  const title = folder.relativePath === '' ? titleCase(wikiSlug) : titleCase(folder.name);
  const description =
    folder.relativePath === ''
      ? 'A citation-backed wiki generated from the ingested PDF corpus.'
      : folderDescription(folder.name);

  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(description);
  lines.push('');

  if (folder.relativePath === '') {
    lines.push('## Start Here');
    lines.push('');
    lines.push('- [[Entities]] — Browse named entities (people, companies, organizations)');
    lines.push('- [[Topics]] — Browse themes and concepts across the corpus');
    lines.push('- [[Documents]] — Raw extracted chunks from source PDFs');
    lines.push('- [[Sources]] — Provenance records for each PDF');
    lines.push('');
  } else {
    lines.push('## Pages');
    lines.push('');
    const contentFiles = folder.files.filter((file) => file.name.toLowerCase() !== 'index.md');
    if (contentFiles.length === 0) {
      lines.push('- No pages in this folder.');
    } else {
      for (const file of contentFiles) {
        const display = file.title && file.title !== file.linkText ? ` — ${file.title}` : '';
        lines.push(`- [[${file.linkText}]]${display}`);
      }
    }
    lines.push('');

    lines.push('## Navigation');
    lines.push('');
    if (parentFolder && parentFolder.relativePath !== '') {
      const parentName = parentFolder.name;
      lines.push(`- Parent: [[${titleCase(parentName)}]]`);
    } else {
      lines.push(`- Parent: [[${titleCase(wikiSlug)}]]`);
    }
    if (parentFolder) {
      for (const sibling of parentFolder.subFolders) {
        if (sibling.name !== folder.name) {
          lines.push(`- Sibling: [[${titleCase(sibling.name)}]]`);
        }
      }
    }
    lines.push('');
  }

  lines.push('## Statistics');
  lines.push('');
  if (folder.relativePath === '') {
    const sources = findSubFolder(folder, 'sources') ?? emptyFolder();
    const documents = findSubFolder(folder, 'documents') ?? emptyFolder();
    const entities = findSubFolder(folder, 'entities') ?? emptyFolder();
    const topics = findSubFolder(folder, 'topics') ?? emptyFolder();
    lines.push(`- Sources: ${countContentFiles(sources)}`);
    lines.push(`- Document pages: ${countContentFiles(documents)}`);
    lines.push(`- Entity pages: ${countContentFiles(entities)}`);
    lines.push(`- Topic pages: ${countContentFiles(topics)}`);
  } else {
    const pageCount = folder.files.filter((file) => file.name.toLowerCase() !== 'index.md').length;
    const subFolderCount = folder.subFolders.length;
    const sourceCount = folder.relativePath === 'sources' || folder.relativePath.startsWith('sources/')
      ? pageCount
      : 0;
    lines.push(`- Pages: ${pageCount}`);
    lines.push(`- Sub-folders: ${subFolderCount}`);
    lines.push(`- Sources: ${sourceCount}`);
  }
  lines.push('');

  return lines.join('\n');
}

async function writeFolderIndex(
  wikiSlug: string,
  folder: FolderNode,
  parentFolder: FolderNode | null,
  options: WriteDoxOptions,
): Promise<void> {
  const dir = wikiDir(options.workspace, wikiSlug);
  const absoluteFolderPath = join(dir, folder.relativePath);

  const hasContent = folder.files.length > 0 || folder.subFolders.length > 0;
  if (!hasContent) {
    return;
  }

  const title = folder.relativePath === '' ? titleCase(wikiSlug) : titleCase(folder.name);
  const now = new Date().toISOString();
  const children = buildChildrenList(folder);
  const body = buildFolderBody(wikiSlug, folder, parentFolder);

  const frontmatter = {
    title,
    type: 'index',
    wiki: wikiSlug,
    updated: now,
    children,
  };

  await writeFile(join(absoluteFolderPath, 'index.md'), matter.stringify(body, frontmatter), 'utf-8');

  for (const subFolder of folder.subFolders) {
    await writeFolderIndex(wikiSlug, subFolder, folder, options);
  }
}

/**
 * Scan the completed wiki tree and write deterministic `index.md` navigation
 * contracts for every folder and the wiki root.
 *
 * This is the DOX Writer (Layer 4). It does not create folders, move pages,
 * write content pages, or call the LLM. It only describes the existing
 * structure.
 */
export async function writeDoxContracts(wikiSlug: string, options?: WriteDoxOptions): Promise<void> {
  const dir = wikiDir(options?.workspace, wikiSlug);
  const root = await scanFolder(dir, '');
  await writeFolderIndex(wikiSlug, root, null, options ?? {});
}
