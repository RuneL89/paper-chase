import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { aliasesForTitle } from './utils/aliases';
import { formatWikilink, parseWikilinkTarget } from './utils/wikilinks';
import { slugify } from './utils/slug';
import { wikiDir } from './utils/paths';
import { callLLM } from './llm/client';
import {
  applyLanguageDirective,
  buildLanguageDirective,
  type LanguageCode,
} from './utils/language';

export interface DoxIndexPageInfo {
  /** File name (e.g. 'john-smith.md'). */
  name: string;
  /** Page title from frontmatter ('' when unknown). */
  title: string;
  /**
   * Exact wikilink form used in the deterministic catalog, e.g.
   * `[[john-smith|John Smith]]` (Obsidian-native pipe form; bare when the
   * title is unknown or equals the file basename).
   */
  linkText: string;
}

/**
 * A direct child folder's freshly-written `index.md`, supplied to the parent
 * folder's LLM call so parents synthesize their children's contracts
 * (bottom-up summary-of-summaries; user-directed 2026-07-19 refinement).
 */
export interface DoxChildIndexInfo {
  /** Child index path relative to the wiki root (e.g. 'entities/people/index.md'). */
  path: string;
  /** Child folder title (from the child index frontmatter; title-cased folder name as fallback). */
  title: string;
  /**
   * Exact wikilink form that resolves to the child folder's index, e.g.
   * `[[entities/people/index|People]]` (path required: many files share the
   * basename `index`).
   */
  linkText: string;
  /** Full markdown of the child's index.md as written earlier in the same run. */
  content: string;
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
  /** Direct content pages (index.md and the root's AGENTS.md excluded). */
  pages: DoxIndexPageInfo[];
  /** Exact statistics lines (without the '- ' prefix). */
  statistics: string[];
  /**
   * Freshly-written `index.md` contracts of every direct child folder (the
   * root's are the top-folder indexes), written earlier in the same run
   * because folders are processed deepest-first post-order. Parents
   * synthesize these into their own description instead of re-reading every
   * descendant page.
   */
  childIndexes: DoxChildIndexInfo[];
  /**
   * Full markdown of every direct content page in the folder (empty for
   * folders without direct pages; the root's child contracts are in
   * `childIndexes`, keeping the prompt bounded).
   */
  pageContents: Array<{ name: string; title: string; content: string }>;
  /** Title of the parent folder ('' for the root). */
  parentTitle: string;
  /** Titles of sibling folders (empty for the root). */
  siblingTitles: string[];
  /**
   * Exact wikilink form for the parent folder, e.g.
   * `[[entities/index|Entities]]`, or `[[index|Test Wiki]]` when the parent
   * is the wiki root ('' for the root itself, which has no parent).
   */
  parentLinkText: string;
  /** Exact wikilink forms for sibling folders (empty for the root). */
  siblingLinkTexts: string[];
  /** The wiki's AGENTS.md constitution ('' when absent). */
  agentsMd: string;
  /** Raw `.state/rolling-memory.json` text ('' when absent). */
  rollingMemory: string;
  /** JSON-lines LLM call log path (defaults to the wiki's `.state/llm-calls.json`). */
  logPath?: string;
  /**
   * Phase 7 (vision `04` §9): the run's input language and the wiki's output
   * language. Drives the `{languageDirective}` prompt fill; absent → en/en →
   * empty directive (byte-identical prompt).
   */
  language?: { input: LanguageCode; output: LanguageCode };
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
  /**
   * Phase 7 (vision `04` §9): the run's input/output languages, threaded into
   * the LLM prompt's `{languageDirective}`. Deterministic mode is unaffected.
   */
  language?: { input: LanguageCode; output: LanguageCode };
}

interface FileNode {
  name: string;
  relativePath: string;
  title: string;
  /** Exact wikilink form (with brackets) used in catalogs and repair. */
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
      // Obsidian-native pipe form (user directive 2026-07-20): content pages
      // link by basename only; index pages link by their folder path because
      // many files share the basename `index`.
      const target = fileSlug.toLowerCase() === 'index' ? childRelativePath.replace(/\.md$/i, '') : fileSlug;
      const linkText = formatWikilink(target, title || undefined);
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

/** Wikilink form for a folder's index page: `[[<folder-path>/index|<Title>]]`. */
function folderIndexLink(folder: FolderNode): string {
  return formatWikilink(`${folder.relativePath}/index`, titleCase(folder.name));
}

/** Wikilink form for the wiki-root index page: `[[index|<Wiki Title>]]`. */
function rootIndexLink(wikiSlug: string): string {
  return formatWikilink('index', titleCase(wikiSlug));
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
    lines.push('- [[entities/index|Entities]] — Browse named entities (people, companies, organizations)');
    lines.push('- [[topics/index|Topics]] — Browse themes and concepts across the corpus');
    lines.push('- [[documents/index|Documents]] — Raw extracted chunks from source PDFs');
    lines.push('- [[sources/index|Sources]] — Provenance records for each PDF');
    lines.push('');
  } else {
    lines.push('## Pages');
    lines.push('');
    const contentFiles = folder.files.filter((file) => file.name.toLowerCase() !== 'index.md');
    if (contentFiles.length === 0 && folder.subFolders.length === 0) {
      lines.push('- No pages in this folder.');
    } else {
      // Sub-folders are catalogued alongside pages (2026-07-19 refinement):
      // a folder with sub-folders but no direct pages still catalogs its child
      // folders here instead of emitting "No pages in this folder.".
      for (const subFolder of folder.subFolders) {
        lines.push(`- ${folderIndexLink(subFolder)}`);
      }
      for (const file of contentFiles) {
        lines.push(`- ${file.linkText}`);
      }
    }
    lines.push('');

    lines.push('## Navigation');
    lines.push('');
    if (parentFolder && parentFolder.relativePath !== '') {
      lines.push(`- Parent: ${folderIndexLink(parentFolder)}`);
    } else {
      lines.push(`- Parent: ${rootIndexLink(wikiSlug)}`);
    }
    if (parentFolder) {
      for (const sibling of parentFolder.subFolders) {
        if (sibling.name !== folder.name) {
          lines.push(`- Sibling: ${folderIndexLink(sibling)}`);
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

function hasRequiredSections(body: string, level: DoxIndexLevel): boolean {
  if (!/^#\s+\S/m.test(body)) {
    return false;
  }
  if (!/^##\s+statistics\b/im.test(body)) {
    return false;
  }
  if (level === 'root') {
    return /^##\s+start here\b/im.test(body);
  }
  if (level === 'workspace') {
    return /^##\s+wikis\b/im.test(body);
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
 * The three levels of the DOX index hierarchy (vision `05` §3.3): folder and
 * wiki-root indexes inside one wiki, and the workspace-level
 * `wikis/index-of-indexes.md` above them. All three are written by the DOX
 * Writer in one bottom-up chain (2026-07-20 amendment).
 */
type DoxIndexLevel = 'folder' | 'root' | 'workspace';

/**
 * Phase 7 v1.1.0 (bounded retry amendment, vision `04` §6 / `07` §5): total
 * attempts per DOX LLM target before the deterministic contract is written.
 * Language-agnostic — applies to every folder, root, and workspace pass.
 */
const DOX_MAX_ATTEMPTS = 3;

/**
 * Run one DOX LLM target (folder, root, or workspace) with bounded retry:
 * up to DOX_MAX_ATTEMPTS total attempts on quality failures — the call
 * throwing, or the output being unparseable/missing required sections.
 * Returns the enforced LLM body (frontmatter discarded, statistics
 * re-imposed; wikilink repair happens at the call site), or null when every
 * attempt failed and the caller must write the deterministic contract.
 */
async function runDoxLlmWithRetries(
  runLlm: () => Promise<string>,
  level: DoxIndexLevel,
  statistics: string[],
  contextLabel: string,
): Promise<string | null> {
  for (let attempt = 1; attempt <= DOX_MAX_ATTEMPTS; attempt++) {
    try {
      const llmOutput = await runLlm();
      const enforced = enforceLlmBody(llmOutput, level, statistics);
      if (enforced !== null) {
        return enforced;
      }
      if (attempt < DOX_MAX_ATTEMPTS) {
        console.warn(
          `DOX Writer: LLM output for ${contextLabel} was unparseable or missing required sections (attempt ${attempt}/${DOX_MAX_ATTEMPTS}); retrying.`,
        );
      } else {
        console.warn(
          `DOX Writer: LLM output for ${contextLabel} was unparseable or missing required sections after ${DOX_MAX_ATTEMPTS} attempts; writing the deterministic contract instead.`,
        );
      }
    } catch (err) {
      if (attempt < DOX_MAX_ATTEMPTS) {
        console.warn(
          `DOX Writer: LLM call failed for ${contextLabel} (${(err as Error).message}) (attempt ${attempt}/${DOX_MAX_ATTEMPTS}); retrying.`,
        );
      } else {
        console.warn(
          `DOX Writer: LLM call failed for ${contextLabel} (${(err as Error).message}) after ${DOX_MAX_ATTEMPTS} attempts; writing the deterministic contract instead.`,
        );
      }
    }
  }
  return null;
}

/**
 * Deterministic enforcement over the LLM output (vision `03` §6): the LLM's
 * frontmatter is discarded entirely (the caller writes the deterministic one)
 * and its `## Statistics` section is replaced with the deterministic counts,
 * so the model cannot hallucinate files or counts. The LLM's title heading,
 * description prose, catalog, and navigation are preserved. Returns null when
 * the output is unparseable or missing required sections — the caller then
 * falls back to the deterministic body for that level.
 */
function enforceLlmBody(llmOutput: string, level: DoxIndexLevel, statistics: string[]): string | null {
  let body: string;
  try {
    body = matter(stripCodeFences(llmOutput)).content;
  } catch {
    return null;
  }
  const trimmed = body.trim();
  if (!hasRequiredSections(trimmed, level)) {
    return null;
  }
  const replaced = replaceStatisticsSection(trimmed, statistics);
  if (replaced === null) {
    return null;
  }
  return `${replaced.replace(/\s+$/, '')}\n`;
}

/**
 * Wiki-wide wikilink resolution data. This MIRRORS the resolution semantics
 * of `src/validation/link-checker.ts` (pipe-form parsing: exact vault-relative
 * path first — without `.md` — then the slugified-basename map, with the
 * folder-index and wiki-root fallbacks; root `AGENTS.md` excluded) so the DOX
 * Writer can test a link exactly the way the final validation pass will. The
 * link checker's map-building is internal and disk-driven, so the logic is
 * duplicated here against the already-scanned folder tree (duplication noted
 * in `.state/phase-6-status.json`).
 */
interface CanonicalLink {
  /** Exact wikilink form (with brackets), e.g. `[[john-smith|John Smith]]`. */
  form: string;
  /** The resolution target inside `form` (before any `|`). */
  target: string;
}

interface WikiLinkIndex {
  /** Vault-relative path without `.md` (exact case) -> canonical link. */
  byPath: Map<string, CanonicalLink>;
  /**
   * Slugified basename / folder name / wiki slug -> canonical link (first
   * wins, mirroring the link checker's duplicate-slug rule). Keeps legacy
   * bare forms (`[[Page Title]]`, `[[Folder Name]]`, `[[Wiki Slug]]`)
   * resolvable.
   */
  bySlug: Map<string, CanonicalLink>;
  /** Lower-cased page title -> content pages carrying that title (for unique-match repair). */
  titleToFiles: Map<string, FileNode[]>;
}

function buildWikiLinkIndex(root: FolderNode, wikiSlug: string): WikiLinkIndex {
  const byPath = new Map<string, CanonicalLink>();
  const bySlug = new Map<string, CanonicalLink>();
  const titleToFiles = new Map<string, FileNode[]>();

  const registerSlug = (slug: string, link: CanonicalLink): void => {
    if (!bySlug.has(slug)) {
      bySlug.set(slug, link);
    }
  };

  const walk = (folder: FolderNode, isRootFolder: boolean): void => {
    // Mirrors writeFolderIndex: a folder only gets an index.md — and the link
    // checker only gets a folder-index fallback — when it has content. The
    // index pages being written THIS run are registered up front so links to
    // them resolve even before they exist on disk.
    const hasContent = folder.files.length > 0 || folder.subFolders.length > 0;

    if (isRootFolder && hasContent) {
      // The wiki-root index is navigable as [[index|<Wiki Title>]] (path) and
      // [[Wiki Slug]] / [[Wiki Title]] (slug fallback).
      const rootLink: CanonicalLink = { form: rootIndexLink(wikiSlug), target: 'index' };
      byPath.set('index', rootLink);
      registerSlug(wikiSlug, rootLink);
      registerSlug('index', rootLink);
    } else if (hasContent) {
      const folderLink: CanonicalLink = {
        form: folderIndexLink(folder),
        target: `${folder.relativePath}/index`,
      };
      byPath.set(`${folder.relativePath}/index`, folderLink);
      registerSlug(slugify(folder.name), folderLink);
    }

    for (const file of folder.files) {
      // The link checker skips the wiki constitution at the root.
      if (isRootFolder && file.name === 'AGENTS.md') {
        continue;
      }
      const fileSlug = file.name.replace(/\.md$/i, '');
      const link: CanonicalLink = { form: file.linkText, target: fileSlug };
      byPath.set(file.relativePath.replace(/\.md$/i, ''), link);
      registerSlug(slugify(fileSlug), link);
      if (file.name.toLowerCase() !== 'index.md' && file.title.length > 0) {
        const key = file.title.toLowerCase();
        const list = titleToFiles.get(key) ?? [];
        list.push(file);
        titleToFiles.set(key, list);
      }
    }
    for (const subFolder of folder.subFolders) {
      walk(subFolder, false);
    }
  };
  walk(root, true);

  return { byPath, bySlug, titleToFiles };
}

/**
 * Resolve a wikilink target exactly the way the updated link checker does:
 * exact vault-relative path (`.md` suffix tolerated) first, then the
 * slugified-basename/folder/wiki-slug map.
 */
function resolveCanonicalLink(target: string, linkIndex: WikiLinkIndex): CanonicalLink | undefined {
  const pathKey = target.replace(/\.md$/i, '');
  return linkIndex.byPath.get(pathKey) ?? linkIndex.bySlug.get(slugify(target));
}

/**
 * Deterministic wikilink safeguard (2026-07-19 refinement; pipe-form rework
 * per the 2026-07-20 user directive): test every `[[...]]` link in the LLM
 * body with the same semantics as the final link validation and repair the
 * unresolvable ones —
 *   (a) pipe form `[[target|display]]`: only the part before the FIRST `|` is
 *       resolved; when it resolves, the link is kept verbatim (the LLM's
 *       display text is its own choice);
 *   (b) a resolvable bare legacy link (`[[Page Title]]`, `[[slug]]`,
 *       `[[Folder Name]]`) is NORMALIZED to the canonical pipe form of the
 *       target the link checker resolves it to (unambiguous — same resolution
 *       order as the checker), e.g. `[[John Smith]]` -> `[[john-smith|John
 *       Smith]]`; already-canonical links are kept as-is;
 *   (c) an unresolvable link that uniquely matches (case-insensitive) a page
 *       title in the wiki is rewritten to that page's canonical pipe form;
 *   (d) anything else is de-linked — brackets stripped, display text kept.
 * Targets are never invented. Returns the repaired body and the repair count.
 */
function repairWikilinks(body: string, linkIndex: WikiLinkIndex): { body: string; repaired: number } {
  let repaired = 0;
  const result = body.replace(/\[\[([^\]]+)\]\]/g, (whole: string, innerRaw: string) => {
    const inner = innerRaw.trim();
    const { target, display } = parseWikilinkTarget(inner);
    const canonical = target.length > 0 ? resolveCanonicalLink(target, linkIndex) : undefined;
    if (canonical) {
      if (display !== undefined || canonical.form === whole) {
        // Pipe form with a resolvable target, or already the canonical form.
        return whole;
      }
      // (b) Normalize a resolvable bare legacy link to the canonical pipe form.
      repaired++;
      return canonical.form;
    }
    // (c) Unique title match -> the page's canonical pipe form.
    const matches = target.length > 0 ? (linkIndex.titleToFiles.get(target.toLowerCase()) ?? []) : [];
    if (matches.length === 1) {
      repaired++;
      return matches[0].linkText;
    }
    // (d) De-link: brackets stripped, display text (or target) kept.
    repaired++;
    return display ?? (target || inner);
  });
  return { body: result, repaired };
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

  // Direct content pages of this folder (index.md excluded; the wiki
  // constitution at the root is not a content page).
  const pages: DoxIndexPageInfo[] = [];
  const pageContents: Array<{ name: string; title: string; content: string }> = [];
  const contentFiles = folder.files.filter(
    (file) => file.name.toLowerCase() !== 'index.md' && !(isRoot && file.name === 'AGENTS.md'),
  );
  for (const file of contentFiles) {
    pages.push({ name: file.name, title: file.title, linkText: file.linkText });
    const content = await readTextIfExists(join(dir, file.relativePath));
    if (content.length > 0) {
      pageContents.push({ name: file.name, title: file.title, content });
    }
  }

  // Bottom-up synthesis: every folder with child folders — the root included —
  // receives the freshly-written index.md of each direct child folder. Folders
  // are processed deepest-first post-order, so these files always reflect the
  // current run (for the root these are the top-folder indexes, which keeps
  // the prompt bounded instead of reading every page in the wiki).
  const childIndexes: DoxChildIndexInfo[] = [];
  for (const sub of folder.subFolders) {
    const content = await readTextIfExists(join(dir, sub.relativePath, 'index.md'));
    if (content.length === 0) {
      continue;
    }
    let title = titleCase(sub.name);
    try {
      const parsed = matter(content);
      if (typeof parsed.data.title === 'string' && parsed.data.title.trim().length > 0) {
        title = parsed.data.title.trim();
      }
    } catch {
      // Keep the title-cased folder name.
    }
    childIndexes.push({
      path: `${sub.relativePath}/index.md`,
      title,
      linkText: folderIndexLink(sub),
      content,
    });
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
  const parentLinkText = isRoot
    ? ''
    : parentFolder && parentFolder.relativePath !== ''
      ? folderIndexLink(parentFolder)
      : rootIndexLink(wikiSlug);
  const siblingLinkTexts = parentFolder
    ? parentFolder.subFolders.filter((sibling) => sibling.name !== folder.name).map((sibling) => folderIndexLink(sibling))
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
    childIndexes,
    pageContents,
    parentTitle,
    siblingTitles,
    parentLinkText,
    siblingLinkTexts,
    agentsMd,
    rollingMemory,
    logPath: options.logPath ?? join(dir, '.state', 'llm-calls.json'),
    language: options.language,
  };
}

/**
 * Default LLM implementation: render `prompts/dox-writer.prompt.txt` with the
 * folder context and call the LLM. Returns the raw markdown the model wrote.
 */
async function writeDoxIndexWithLlm(context: DoxIndexContext): Promise<string> {
  const template = await loadDoxPromptTemplate();

  // Exact resolvable link forms for every catalog/navigation target, in
  // Obsidian's native pipe form (user directive 2026-07-20): content pages
  // link as [[<basename>|<Title>]], folder indexes as [[<path>/index|<Title>]],
  // and the wiki root as [[index|<Wiki Title>]]. The LLM is instructed to use
  // these forms verbatim — they are the only ones guaranteed to resolve both
  // in Obsidian and under the link checker's semantics.
  const childFolderLink = (name: string): string =>
    formatWikilink(`${context.folderPath ? `${context.folderPath}/` : ''}${name}/index`, titleCase(name));
  const linkTargetLines: string[] = [];
  for (const page of context.pages) {
    linkTargetLines.push(
      `- page ${page.name} — title "${page.title || 'untitled'}" — link as ${page.linkText}`,
    );
  }
  for (const name of context.subFolderNames) {
    linkTargetLines.push(`- sub-folder ${name}/ — link as ${childFolderLink(name)}`);
  }
  if (!context.isRoot) {
    linkTargetLines.push(`- parent folder — link as ${context.parentLinkText}`);
    for (const siblingLink of context.siblingLinkTexts) {
      linkTargetLines.push(`- sibling folder — link as ${siblingLink}`);
    }
  }

  const filledPrompt = fillPromptTemplate(template, {
    wikiSlug: context.wikiSlug,
    folderPath: context.contextLabel,
    folderTitle: context.title,
    children:
      context.children.length > 0
        ? context.children.map((child) => `- ${child}`).join('\n')
        : '(none)',
    subFolders:
      context.subFolderNames.length > 0
        ? context.subFolderNames.map((name) => `- ${name}/ — link as ${childFolderLink(name)}`).join('\n')
        : '(none)',
    pages:
      context.pages.length > 0
        ? context.pages
            .map((page) => `- ${page.name} — title "${page.title || 'untitled'}" — link as ${page.linkText}`)
            .join('\n')
        : '(none — this folder contains only sub-folders)',
    childIndexes:
      context.childIndexes.length > 0
        ? context.childIndexes
            .map((child) => `--- ${child.path} (link as ${child.linkText}) ---\n${child.content}`)
            .join('\n\n')
        : '(none — this folder has no sub-folders)',
    navigation: context.isRoot
      ? 'This is the wiki root; there is no parent or sibling folder. Do not include a ## Navigation section.'
      : `Parent: ${context.parentTitle}\nSiblings: ${context.siblingTitles.length > 0 ? context.siblingTitles.join(', ') : '(none)'}`,
    linkTargets: linkTargetLines.length > 0 ? linkTargetLines.join('\n') : '(no link targets)',
    statistics: context.statistics.map((stat) => `- ${stat}`).join('\n'),
    pageContents:
      context.pageContents.length > 0
        ? context.pageContents
            .map((page) => `--- ${page.name} (${page.title || 'untitled'}) ---\n${page.content}`)
            .join('\n\n')
        : '(no direct page content in this folder — synthesize from the child folder indexes above)',
    agentsMd: context.agentsMd.trim().length > 0 ? context.agentsMd : '(No AGENTS.md provided.)',
    rollingMemory:
      context.rollingMemory.trim().length > 0 ? context.rollingMemory : '(No rolling memory yet.)',
  });
  // Phase 7: fill the {languageDirective} placeholder (removes the whole
  // LANGUAGE block when both languages are English → byte-identical prompt).
  const prompt = applyLanguageDirective(
    filledPrompt,
    buildLanguageDirective('dox', context.language?.input ?? 'en', context.language?.output ?? 'en'),
  );
  return callLLM(prompt, undefined, {
    maxTokens: DOX_WRITER_MAX_TOKENS,
    maxRetries: 2,
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
  linkIndex: WikiLinkIndex | undefined,
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
  // Phase 7 v1.1.0: bounded retry (≤3 attempts) on quality failures before
  // the deterministic fallback; deterministic enforcement (frontmatter,
  // statistics) and the wikilink safeguard are unchanged.
  const enforced = await runDoxLlmWithRetries(
    () => runLlm(context),
    folder.relativePath === '' ? 'root' : 'folder',
    statistics,
    contextLabel,
  );
  if (enforced !== null) {
    if (linkIndex) {
      // Deterministic wikilink safeguard: repair or de-link any LLM wikilink
      // that the final link validation would report as broken.
      const repair = repairWikilinks(enforced, linkIndex);
      body = repair.body;
      if (repair.repaired > 0) {
        console.warn(
          `DOX Writer: repaired ${repair.repaired} unresolvable wikilink(s) in ${contextLabel}.`,
        );
      }
    } else {
      body = enforced;
    }
  }

  // Frontmatter is ALWAYS the deterministically-computed one — the LLM's
  // frontmatter is never trusted (vision `03` §6). The alias (UAT 6.3 fix)
  // makes the folder/wiki title resolvable as an Obsidian wikilink target
  // (the basename of every index page is `index`).
  const aliases = aliasesForTitle(title, 'index');
  const frontmatter = {
    title,
    type: 'index',
    ...(aliases ? { aliases } : {}),
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
  linkIndex?: WikiLinkIndex,
): Promise<void> {
  const hasContent = folder.files.length > 0 || folder.subFolders.length > 0;
  if (!hasContent) {
    return;
  }

  if (options.doxLlm) {
    // Post-order (deepest-first at every level): write sub-folder contracts
    // first so every parent — including the wiki root — reads the fresh child
    // index pages as its synthesis context.
    for (const subFolder of folder.subFolders) {
      await writeFolderIndex(wikiSlug, subFolder, folder, options, linkIndex);
    }
    await writeFolderIndexLlm(wikiSlug, folder, parentFolder, options, linkIndex);
    return;
  }

  const dir = wikiDir(options.workspace, wikiSlug);
  const absoluteFolderPath = join(dir, folder.relativePath);

  const title = folder.relativePath === '' ? titleCase(wikiSlug) : titleCase(folder.name);
  const now = new Date().toISOString();
  const children = buildChildrenList(folder);
  const body = buildFolderBody(wikiSlug, folder, parentFolder);

  const aliases = aliasesForTitle(title, 'index');
  const frontmatter = {
    title,
    type: 'index',
    ...(aliases ? { aliases } : {}),
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
 * contract's prose from the real page contents, the freshly-written child
 * folder indexes (bottom-up summary-of-summaries), the wiki's AGENTS.md, and
 * the rolling memory — while deterministic code always re-imposes the
 * frontmatter (title, type, wiki, updated, children) and the Statistics
 * section, repairs or de-links any wikilink the final validation would not
 * resolve, and any LLM failure falls back to the deterministic contract for
 * that folder.
 *
 * It never creates folders, moves pages, writes content pages, or decides the
 * taxonomy; it only describes the existing structure (vision `03` §6).
 */
export async function writeDoxContracts(wikiSlug: string, options?: WriteDoxOptions): Promise<void> {
  const dir = wikiDir(options?.workspace, wikiSlug);
  const root = await scanFolder(dir, '');
  const opts = options ?? {};
  // The wiki-wide link index mirrors the final link validation's resolution
  // semantics and powers the LLM-mode wikilink safeguard.
  const linkIndex = opts.doxLlm ? buildWikiLinkIndex(root, wikiSlug) : undefined;
  await writeFolderIndex(wikiSlug, root, null, opts, linkIndex);
}

// ---------------------------------------------------------------------------
// Workspace pass (2026-07-20 user-ratified amendment): the workspace-level
// `wikis/index-of-indexes.md`, written like any other parent index in the
// same bottom-up flow. The ingest run writes folder indexes deepest-first,
// then the wiki root index, then THIS pass — so the workspace pass's only
// content input is the set of freshly-written wiki root index.md contracts
// (summary-of-summaries); it never reads the content pages inside the wikis.
// Deterministic code supplies and re-imposes the children list, statistics,
// and frontmatter, and any LLM failure falls back to the deterministic
// contract — exactly as for per-folder indexes (vision `03` §6).
// ---------------------------------------------------------------------------

/** One wiki's freshly-written root index.md, supplied to the workspace LLM call. */
export interface DoxWorkspaceWikiInfo {
  /** Wiki slug (directory name inside wikis/). */
  slug: string;
  /** Wiki title from the root index frontmatter (title-cased slug as fallback). */
  title: string;
  /** Exact wikilink form, e.g. `[[acme-reports/index|Acme Reports]]` (path required). */
  linkText: string;
  /** Root index path relative to wikis/ (always `<slug>/index.md`). */
  indexPath: string;
  /** Full markdown of the wiki's root index.md as written earlier in the same run. */
  content: string;
}

/** Everything the workspace LLM call needs to write `index-of-indexes.md`. */
export interface DoxWorkspaceIndexContext {
  /** Human label for logs: always '(workspace)'. */
  contextLabel: string;
  /** Deterministic index title ('Index of Indexes'). */
  title: string;
  /** Exact children list that deterministic code writes into frontmatter. */
  children: string[];
  /** Every wiki in the workspace, with its freshly-written root contract. */
  wikis: DoxWorkspaceWikiInfo[];
  /** Exact statistics lines (without the '- ' prefix). */
  statistics: string[];
  /** Output language of the triggering ingest; all prose is written in it. */
  outputLanguage: string;
  /** JSON-lines LLM call log path (defaults to the triggering wiki's log). */
  logPath?: string;
}

export interface WriteWorkspaceIndexOptions {
  workspace?: string;
  /**
   * When true, write the workspace index body with the LLM (one call per
   * ingest) so the description synthesizes the wiki root contracts.
   * Deterministic code always re-imposes the frontmatter and the Statistics
   * section, and any LLM failure falls back to the deterministic contract.
   * Defaults to false, mirroring writeDoxContracts.
   */
  doxLlm?: boolean;
  /** Injectable workspace index writer (test-only). Defaults to the real LLM implementation. */
  writeWorkspaceIndexFn?: (context: DoxWorkspaceIndexContext) => Promise<string>;
  /**
   * Output language of the triggering ingest (vision `04` §9). Defaults to
   * 'English' until Phase 7 lands per-wiki language config.
   */
  outputLanguage?: string;
  /** Override for the JSON-lines LLM call log path (defaults to the triggering wiki's log). */
  logPath?: string;
}

const WORKSPACE_INDEX_FILE = 'index-of-indexes.md';
const WORKSPACE_INDEX_TITLE = 'Index of Indexes';
const DOX_WORKSPACE_PROMPT_FILE = 'dox-writer-workspace.prompt.txt';

let cachedWorkspacePrompt: string | undefined;

async function loadWorkspacePromptTemplate(): Promise<string> {
  if (cachedWorkspacePrompt !== undefined) {
    return cachedWorkspacePrompt;
  }
  const template = await readFile(join(PROMPT_DIR, DOX_WORKSPACE_PROMPT_FILE), 'utf-8');
  cachedWorkspacePrompt = template;
  return template;
}

/** Wikilink form for a wiki's root index inside the wikis/ vault: `[[<slug>/index|<Title>]]`. */
function wikiRootIndexLink(slug: string, title: string): string {
  return formatWikilink(`${slug}/index`, title);
}

/** Deterministic workspace body — the fallback contract and the doxLlm:false output. */
function buildWorkspaceBody(wikis: DoxWorkspaceWikiInfo[], statistics: string[]): string {
  const lines: string[] = [];
  lines.push(`# ${WORKSPACE_INDEX_TITLE}`);
  lines.push('');
  lines.push(
    wikis.length === 1
      ? 'This workspace holds one citation-backed wiki generated from an ingested PDF corpus.'
      : `This workspace holds ${wikis.length} citation-backed wikis, each generated from its own ingested PDF corpus.`,
  );
  lines.push('');
  lines.push('## Wikis');
  lines.push('');
  for (const wiki of wikis) {
    lines.push(`- ${wiki.linkText}`);
  }
  lines.push('');
  lines.push('## Statistics');
  lines.push('');
  for (const stat of statistics) {
    lines.push(`- ${stat}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Workspace link index for the wikilink safeguard: canonical targets are the
 * wiki root indexes (`<slug>/index`), registered by path and by slugified
 * wiki slug and title so bare legacy forms (`[[acme-reports]]`,
 * `[[Acme Reports]]`) normalize to the canonical pipe form and anything
 * invented is de-linked. Same resolution semantics as buildWikiLinkIndex.
 */
function buildWorkspaceLinkIndex(wikis: DoxWorkspaceWikiInfo[]): WikiLinkIndex {
  const byPath = new Map<string, CanonicalLink>();
  const bySlug = new Map<string, CanonicalLink>();
  const registerSlug = (slug: string, link: CanonicalLink): void => {
    if (!bySlug.has(slug)) {
      bySlug.set(slug, link);
    }
  };
  for (const wiki of wikis) {
    const link: CanonicalLink = { form: wiki.linkText, target: `${wiki.slug}/index` };
    byPath.set(`${wiki.slug}/index`, link);
    registerSlug(slugify(wiki.slug), link);
    registerSlug(slugify(wiki.title), link);
  }
  return { byPath, bySlug, titleToFiles: new Map() };
}

/** Default LLM implementation: render the workspace prompt and call the LLM. */
async function writeWorkspaceIndexWithLlm(context: DoxWorkspaceIndexContext): Promise<string> {
  const template = await loadWorkspacePromptTemplate();
  const prompt = fillPromptTemplate(template, {
    indexTitle: context.title,
    outputLanguage: context.outputLanguage,
    children: context.children.map((child) => `- ${child}`).join('\n'),
    wikis: context.wikis
      .map((wiki) => `- wiki ${wiki.slug}/ — title "${wiki.title}" — link as ${wiki.linkText}`)
      .join('\n'),
    childIndexes: context.wikis
      .map((wiki) => `--- ${wiki.indexPath} (link as ${wiki.linkText}) ---\n${wiki.content}`)
      .join('\n\n'),
    linkTargets: context.wikis.map((wiki) => `- wiki ${wiki.slug}/ — link as ${wiki.linkText}`).join('\n'),
    statistics: context.statistics.map((stat) => `- ${stat}`).join('\n'),
  });
  return callLLM(prompt, undefined, {
    maxTokens: DOX_WRITER_MAX_TOKENS,
    maxRetries: 2,
    callType: 'dox-writer',
    context: context.contextLabel,
    logPath: context.logPath,
  });
}

/**
 * Regenerate `wikis/index-of-indexes.md` from every wiki's root index.md.
 *
 * Runs at the end of every ingest, after the triggering wiki's own contracts
 * have been written — the topmost parent in the bottom-up chain (folder
 * indexes -> wiki root index -> workspace index). A wiki only appears once it
 * has a root `index.md` (init alone does not create one); when no wiki has
 * one yet, nothing is written.
 */
export async function writeWorkspaceIndex(options?: WriteWorkspaceIndexOptions): Promise<void> {
  const wikisRoot = join(options?.workspace ?? '.', 'wikis');

  let entries;
  try {
    entries = await readdir(wikisRoot, { withFileTypes: true });
  } catch {
    return; // No wikis/ folder yet — nothing to index.
  }

  // Every wiki with a root index.md is a child of the workspace index. The
  // ingested wiki's contract was written earlier in the same run; other
  // wikis' contracts are current on disk from their own ingests.
  const wikis: DoxWorkspaceWikiInfo[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const indexPath = join(wikisRoot, entry.name, 'index.md');
    const content = await readTextIfExists(indexPath);
    if (content.length === 0) {
      continue;
    }
    let title = titleCase(entry.name);
    try {
      const parsed = matter(content);
      if (typeof parsed.data.title === 'string' && parsed.data.title.trim().length > 0) {
        title = parsed.data.title.trim();
      }
    } catch {
      // Keep the title-cased slug.
    }
    wikis.push({
      slug: entry.name,
      title,
      linkText: wikiRootIndexLink(entry.name, title),
      indexPath: `${entry.name}/index.md`,
      content,
    });
  }
  wikis.sort((a, b) => a.slug.localeCompare(b.slug));
  if (wikis.length === 0) {
    return;
  }

  // Deterministic ground truth: wiki count plus corpus totals, computed by
  // scanning each wiki tree with the same semantics as the wiki-root stats.
  let sources = 0;
  let documents = 0;
  let entities = 0;
  let topics = 0;
  for (const wiki of wikis) {
    const tree = await scanFolder(join(wikisRoot, wiki.slug), '');
    sources += countContentFiles(findSubFolder(tree, 'sources') ?? emptyFolder());
    documents += countContentFiles(findSubFolder(tree, 'documents') ?? emptyFolder());
    entities += countContentFiles(findSubFolder(tree, 'entities') ?? emptyFolder());
    topics += countContentFiles(findSubFolder(tree, 'topics') ?? emptyFolder());
  }
  const statistics = [
    `Wikis: ${wikis.length}`,
    `Sources: ${sources}`,
    `Document pages: ${documents}`,
    `Entity pages: ${entities}`,
    `Topic pages: ${topics}`,
  ];
  const children = wikis.map((wiki) => wiki.indexPath);

  let body = buildWorkspaceBody(wikis, statistics);
  if (options?.doxLlm) {
    const context: DoxWorkspaceIndexContext = {
      contextLabel: '(workspace)',
      title: WORKSPACE_INDEX_TITLE,
      children,
      wikis,
      statistics,
      outputLanguage: options.outputLanguage ?? 'English',
      logPath: options.logPath,
    };
    const runLlm = options.writeWorkspaceIndexFn ?? writeWorkspaceIndexWithLlm;
    // Phase 7 v1.1.0: same bounded retry as the per-folder path.
    const enforced = await runDoxLlmWithRetries(
      () => runLlm(context),
      'workspace',
      statistics,
      '(workspace)',
    );
    if (enforced !== null) {
      const repair = repairWikilinks(enforced, buildWorkspaceLinkIndex(wikis));
      body = repair.body;
      if (repair.repaired > 0) {
        console.warn(`DOX Writer: repaired ${repair.repaired} unresolvable wikilink(s) in (workspace).`);
      }
    }
  }

  // Frontmatter is ALWAYS the deterministically-computed one — same rule as
  // per-folder indexes. No `wiki` field: this contract governs the whole
  // workspace (vision `03` §4.2 / `05` §3.4).
  const aliases = aliasesForTitle(WORKSPACE_INDEX_TITLE, WORKSPACE_INDEX_FILE.replace(/\.md$/, ''));
  const frontmatter = {
    title: WORKSPACE_INDEX_TITLE,
    type: 'index',
    ...(aliases ? { aliases } : {}),
    updated: new Date().toISOString(),
    children,
  };

  await writeFile(join(wikisRoot, WORKSPACE_INDEX_FILE), matter.stringify(body, frontmatter), 'utf-8');
}
