import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { slugify } from './utils/slug';
import { wikiDir } from './utils/paths';
import { callLLM } from './llm/client';

export interface DoxIndexPageInfo {
  /** File name (e.g. 'john-smith.md'), or '<sub>/index.md' for the root's folder entries. */
  name: string;
  /** Page title from frontmatter ('' when unknown). */
  title: string;
  /** Wikilink text used in the deterministic catalog. */
  linkText: string;
}

/**
 * Everything the DOX Writer's LLM needs to write one folder's `index.md`
 * (phase doc §3.1 "Input to the LLM for each folder"). All deterministic
 * ground truth (children, statistics) is pre-computed so the LLM cannot
 * hallucinate files or counts; `writeDoxContracts` re-imposes both over the
 * LLM output before writing the file.
 */
export interface DoxIndexContext {
  wikiSlug: string;
  /** Folder path relative to the wiki root ('' for the root). */
  folderPath: string;
  /** Human label for logs: the folder path or '(root)'. */
  contextLabel: string;
  /** True for the wiki root index. */
  isRoot: boolean;
  /** Deterministic index title (title-cased folder name or wiki slug). */
  title: string;
  /** Exact children list that deterministic code writes into frontmatter. */
  children: string[];
  /** Names of direct sub-folders. */
  subFolderNames: string[];
  /** Direct content pages (index.md excluded); for the root, the top-folder index entries. */
  pages: DoxIndexPageInfo[];
  /** Exact statistics lines (without the '- ' prefix). */
  statistics: string[];
  /**
   * Full markdown of every page in the folder; for the root, the freshly
   * written top-folder index pages (keeps the prompt bounded).
   */
  pageContents: Array<{ name: string; title: string; content: string }>;
  /** Title of the parent folder ('' for the root). */
  parentTitle: string;
  /** Titles of sibling folders (empty for the root). */
  siblingTitles: string[];
  /** The wiki's AGENTS.md constitution ('' when absent). */
  agentsMd: string;
  /** Raw `.state/rolling-memory.json` text ('' when absent). */
  rollingMemory: string;
  /** JSON-lines LLM call log path (defaults to the wiki's `.state/llm-calls.json`). */
  logPath?: string;
}

export interface WriteDoxOptions {
  workspace?: string;
  /**
   * Phase 6: when true, write each `index.md` body with the LLM (one call per
   * folder plus the wiki root) so descriptions reflect the real page content.
   * Deterministic code always re-imposes the frontmatter and the Statistics
   * section over the LLM output, and any LLM failure (missing API key, network
   * error, unparseable output) falls back to the deterministic contract for
   * that folder. Defaults to false: the library default stays deterministic
   * and LLM-free.
   */
  doxLlm?: boolean;
  /**
   * Injectable DOX index writer (test-only). Defaults to the real LLM
   * implementation; tests inject a stub to exercise `doxLlm` without an API key.
   */
  writeDoxIndexFn?: (context: DoxIndexContext) => Promise<string>;
  /** Override for the JSON-lines LLM call log path (defaults to `<wiki>/.state/llm-calls.json`). */
  logPath?: string;
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

const PROMPT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'prompts');
const DOX_PROMPT_FILE = 'dox-writer.prompt.txt';
/**
 * Max output tokens for one DOX Writer call. Index pages are small contracts
 * (frontmatter + a handful of sections), so 2048 is generous headroom.
 */
const DOX_WRITER_MAX_TOKENS = 2048;

let cachedDoxPrompt: string | undefined;

async function loadDoxPromptTemplate(): Promise<string> {
  if (cachedDoxPrompt !== undefined) {
    return cachedDoxPrompt;
  }
  const template = await readFile(join(PROMPT_DIR, DOX_PROMPT_FILE), 'utf-8');
  cachedDoxPrompt = template;
  return template;
}

function fillPromptTemplate(template: string, values: Record<string, string>): string {
  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.split(`{${key}}`).join(value);
  }
  return output;
}

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

async function readTextIfExists(absolutePath: string): Promise<string> {
  try {
    return await readFile(absolutePath, 'utf-8');
  } catch {
    return '';
  }
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

/**
 * Exact statistics lines (without the '- ' prefix). These are deterministic
 * ground truth: they appear verbatim in the deterministic body and are
 * re-imposed over the LLM's `## Statistics` section in LLM mode.
 */
function buildStatisticsLines(folder: FolderNode): string[] {
  if (folder.relativePath === '') {
    const sources = findSubFolder(folder, 'sources') ?? emptyFolder();
    const documents = findSubFolder(folder, 'documents') ?? emptyFolder();
    const entities = findSubFolder(folder, 'entities') ?? emptyFolder();
    const topics = findSubFolder(folder, 'topics') ?? emptyFolder();
    return [
      `Sources: ${countContentFiles(sources)}`,
      `Document pages: ${countContentFiles(documents)}`,
      `Entity pages: ${countContentFiles(entities)}`,
      `Topic pages: ${countContentFiles(topics)}`,
    ];
  }
  const pageCount = folder.files.filter((file) => file.name.toLowerCase() !== 'index.md').length;
  const subFolderCount = folder.subFolders.length;
  const sourceCount = folder.relativePath === 'sources' || folder.relativePath.startsWith('sources/')
    ? pageCount
    : 0;
  return [`Pages: ${pageCount}`, `Sub-folders: ${subFolderCount}`, `Sources: ${sourceCount}`];
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
  for (const stat of buildStatisticsLines(folder)) {
    lines.push(`- ${stat}`);
  }
  lines.push('');

  return lines.join('\n');
}

/** Strip a single wrapping ```markdown fence if the model added one. */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const match = /^```(?:markdown|md|yaml)?\s*\n([\s\S]*?)\n?```\s*$/i.exec(trimmed);
  return match ? match[1] : text;
}

function hasRequiredSections(body: string, isRoot: boolean): boolean {
  if (!/^#\s+\S/m.test(body)) {
    return false;
  }
  if (!/^##\s+statistics\b/im.test(body)) {
    return false;
  }
  if (isRoot) {
    return /^##\s+start here\b/im.test(body);
  }
  return /^##\s+pages\b/im.test(body) && /^##\s+navigation\b/im.test(body);
}

/**
 * Replace the content of the `## Statistics` section (up to the next level-2
 * heading or end of file) with the deterministic statistics lines. Returns
 * null when no Statistics section exists.
 */
function replaceStatisticsSection(body: string, statistics: string[]): string | null {
  const lines = body.split('\n');
  const headingIndex = lines.findIndex((line) => /^##\s+statistics\s*$/i.test(line.trim()));
  if (headingIndex === -1) {
    return null;
  }
  let endIndex = lines.length;
  for (let i = headingIndex + 1; i < lines.length; i++) {
    if (/^##\s+\S/.test(lines[i])) {
      endIndex = i;
      break;
    }
  }
  const statsBlock = ['', ...statistics.map((stat) => `- ${stat}`), ''];
  const next = [...lines.slice(0, headingIndex + 1), ...statsBlock, ...lines.slice(endIndex)];
  return next.join('\n');
}

/**
 * Deterministic enforcement over the LLM output (vision `03` §6): the LLM's
 * frontmatter is discarded entirely (the caller writes the deterministic one)
 * and its `## Statistics` section is replaced with the deterministic counts,
 * so the model cannot hallucinate files or counts. The LLM's title heading,
 * description prose, catalog, and navigation are preserved. Returns null when
 * the output is unparseable or missing required sections — the caller then
 * falls back to the deterministic body for that folder.
 */
function enforceLlmBody(llmOutput: string, isRoot: boolean, statistics: string[]): string | null {
  let body: string;
  try {
    body = matter(stripCodeFences(llmOutput)).content;
  } catch {
    return null;
  }
  const trimmed = body.trim();
  if (!hasRequiredSections(trimmed, isRoot)) {
    return null;
  }
  const replaced = replaceStatisticsSection(trimmed, statistics);
  if (replaced === null) {
    return null;
  }
  return `${replaced.replace(/\s+$/, '')}\n`;
}

async function buildDoxIndexContext(
  dir: string,
  wikiSlug: string,
  folder: FolderNode,
  parentFolder: FolderNode | null,
  info: { title: string; children: string[]; statistics: string[]; contextLabel: string },
  options: WriteDoxOptions,
): Promise<DoxIndexContext> {
  const isRoot = folder.relativePath === '';
  const subFolderNames = folder.subFolders.map((sub) => sub.name);

  const pages: DoxIndexPageInfo[] = [];
  const pageContents: Array<{ name: string; title: string; content: string }> = [];

  if (isRoot) {
    // Root context: the freshly-written top-folder index pages (written before
    // the root because the LLM path processes folders post-order) instead of
    // every page in the wiki — this keeps the prompt bounded.
    for (const sub of folder.subFolders) {
      const name = `${sub.name}/index.md`;
      const content = await readTextIfExists(join(dir, sub.name, 'index.md'));
      let title = titleCase(sub.name);
      if (content.length > 0) {
        try {
          const parsed = matter(content);
          if (typeof parsed.data.title === 'string' && parsed.data.title.trim().length > 0) {
            title = parsed.data.title.trim();
          }
        } catch {
          // Keep the title-cased folder name.
        }
        pageContents.push({ name, title, content });
      }
      pages.push({ name, title, linkText: title });
    }
  } else {
    const contentFiles = folder.files.filter((file) => file.name.toLowerCase() !== 'index.md');
    for (const file of contentFiles) {
      pages.push({ name: file.name, title: file.title, linkText: file.linkText });
      const content = await readTextIfExists(join(dir, file.relativePath));
      if (content.length > 0) {
        pageContents.push({ name: file.name, title: file.title, content });
      }
    }
  }

  const agentsMd = await readTextIfExists(join(dir, 'AGENTS.md'));
  const rollingMemory = await readTextIfExists(join(dir, '.state', 'rolling-memory.json'));

  const parentTitle = isRoot
    ? ''
    : parentFolder && parentFolder.relativePath !== ''
      ? titleCase(parentFolder.name)
      : titleCase(wikiSlug);
  const siblingTitles = parentFolder
    ? parentFolder.subFolders.filter((sibling) => sibling.name !== folder.name).map((sibling) => titleCase(sibling.name))
    : [];

  return {
    wikiSlug,
    folderPath: folder.relativePath,
    contextLabel: info.contextLabel,
    isRoot,
    title: info.title,
    children: info.children,
    subFolderNames,
    pages,
    statistics: info.statistics,
    pageContents,
    parentTitle,
    siblingTitles,
    agentsMd,
    rollingMemory,
    logPath: options.logPath ?? join(dir, '.state', 'llm-calls.json'),
  };
}

/**
 * Default LLM implementation: render `prompts/dox-writer.prompt.txt` with the
 * folder context and call the LLM. Returns the raw markdown the model wrote.
 */
async function writeDoxIndexWithLlm(context: DoxIndexContext): Promise<string> {
  const template = await loadDoxPromptTemplate();
  const prompt = fillPromptTemplate(template, {
    wikiSlug: context.wikiSlug,
    folderPath: context.contextLabel,
    folderTitle: context.title,
    children:
      context.children.length > 0
        ? context.children.map((child) => `- ${child}`).join('\n')
        : '(none)',
    subFolders:
      context.subFolderNames.length > 0
        ? context.subFolderNames.map((name) => `- ${name}`).join('\n')
        : '(none)',
    pages:
      context.pages.length > 0
        ? context.pages.map((page) => `- ${page.name}${page.title ? ` — ${page.title}` : ''}`).join('\n')
        : '(none — this folder contains only sub-folders)',
    navigation: context.isRoot
      ? 'This is the wiki root; there is no parent or sibling folder. Do not include a ## Navigation section.'
      : `Parent: ${context.parentTitle}\nSiblings: ${context.siblingTitles.length > 0 ? context.siblingTitles.join(', ') : '(none)'}`,
    statistics: context.statistics.map((stat) => `- ${stat}`).join('\n'),
    pageContents:
      context.pageContents.length > 0
        ? context.pageContents
            .map((page) => `--- ${page.name} (${page.title || 'untitled'}) ---\n${page.content}`)
            .join('\n\n')
        : '(no page content available)',
    agentsMd: context.agentsMd.trim().length > 0 ? context.agentsMd : '(No AGENTS.md provided.)',
    rollingMemory:
      context.rollingMemory.trim().length > 0 ? context.rollingMemory : '(No rolling memory yet.)',
  });
  return callLLM(prompt, undefined, {
    maxTokens: DOX_WRITER_MAX_TOKENS,
    callType: 'dox-writer',
    context: context.contextLabel,
    logPath: context.logPath,
  });
}

async function writeFolderIndexLlm(
  wikiSlug: string,
  folder: FolderNode,
  parentFolder: FolderNode | null,
  options: WriteDoxOptions,
): Promise<void> {
  const dir = wikiDir(options.workspace, wikiSlug);
  const absoluteFolderPath = join(dir, folder.relativePath);

  const title = folder.relativePath === '' ? titleCase(wikiSlug) : titleCase(folder.name);
  const now = new Date().toISOString();
  const children = buildChildrenList(folder);
  const statistics = buildStatisticsLines(folder);
  const deterministicBody = buildFolderBody(wikiSlug, folder, parentFolder);
  const contextLabel = folder.relativePath === '' ? '(root)' : folder.relativePath;

  const context = await buildDoxIndexContext(
    dir,
    wikiSlug,
    folder,
    parentFolder,
    { title, children, statistics, contextLabel },
    options,
  );

  let body = deterministicBody;
  const runLlm = options.writeDoxIndexFn ?? writeDoxIndexWithLlm;
  try {
    const llmOutput = await runLlm(context);
    const enforced = enforceLlmBody(llmOutput, folder.relativePath === '', statistics);
    if (enforced === null) {
      console.warn(
        `DOX Writer: LLM output for ${contextLabel} was unparseable or missing required sections; writing the deterministic contract instead.`,
      );
    } else {
      body = enforced;
    }
  } catch (err) {
    console.warn(
      `DOX Writer: LLM call failed for ${contextLabel} (${(err as Error).message}); writing the deterministic contract instead.`,
    );
  }

  // Frontmatter is ALWAYS the deterministically-computed one — the LLM's
  // frontmatter is never trusted (vision `03` §6).
  const frontmatter = {
    title,
    type: 'index',
    wiki: wikiSlug,
    updated: now,
    children,
  };

  await writeFile(join(absoluteFolderPath, 'index.md'), matter.stringify(body, frontmatter), 'utf-8');
}

async function writeFolderIndex(
  wikiSlug: string,
  folder: FolderNode,
  parentFolder: FolderNode | null,
  options: WriteDoxOptions,
): Promise<void> {
  const hasContent = folder.files.length > 0 || folder.subFolders.length > 0;
  if (!hasContent) {
    return;
  }

  if (options.doxLlm) {
    // Post-order: write sub-folder contracts first so parents — especially the
    // wiki root — can read the fresh child index pages as context.
    for (const subFolder of folder.subFolders) {
      await writeFolderIndex(wikiSlug, subFolder, folder, options);
    }
    await writeFolderIndexLlm(wikiSlug, folder, parentFolder, options);
    return;
  }

  const dir = wikiDir(options.workspace, wikiSlug);
  const absoluteFolderPath = join(dir, folder.relativePath);

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
 * Scan the completed wiki tree and write `index.md` navigation contracts for
 * every folder and the wiki root.
 *
 * This is the DOX Writer (Layer 5). With the default options it is fully
 * deterministic and makes no LLM calls. With `doxLlm: true` an LLM writes each
 * contract's prose from the real page contents, the wiki's AGENTS.md, and the
 * rolling memory — while deterministic code always re-imposes the frontmatter
 * (title, type, wiki, updated, children) and the Statistics section, and any
 * LLM failure falls back to the deterministic contract for that folder.
 *
 * It never creates folders, moves pages, writes content pages, or decides the
 * taxonomy; it only describes the existing structure (vision `03` §6).
 */
export async function writeDoxContracts(wikiSlug: string, options?: WriteDoxOptions): Promise<void> {
  const dir = wikiDir(options?.workspace, wikiSlug);
  const root = await scanFolder(dir, '');
  await writeFolderIndex(wikiSlug, root, null, options ?? {});
}
