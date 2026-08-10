import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import matter from 'gray-matter';

/**
 * Phase 24 (phase doc §2, vision `03` §3.1/§4.1 amended 2026-08-09): the shared
 * workspace scanner for the Cross-Wiki Discovery pass. Reads the per-wiki
 * entity/topic pages (frontmatter + Layer 1 first paragraph + the rendered
 * `## Relationships` lines) of every wiki in the workspace.
 *
 * Membership rule: a wiki is a subdirectory of `wikis/` with a root
 * `index.md` (the same rule as the workspace index — init alone does not make
 * a wiki). The derived `cross-wiki/` folder is NEVER a wiki.
 */

/** The derived-artifact folder name; excluded from every wiki enumeration. */
export const CROSS_WIKI_FOLDER = 'cross-wiki';

export interface ScannedRelationship {
  /** 'outgoing': the page's entity is the subject; 'incoming': it is the object. */
  direction: 'outgoing' | 'incoming';
  /** The OTHER party's slug (the wikilink target basename). */
  otherSlug: string;
  /** The other party's display title when the link carried one. */
  otherTitle?: string;
  /** Kebab-case predicate (recovered from the rendered readable form). */
  predicate: string;
  /** Verbatim evidence quote when the line carried one ('' otherwise). */
  evidence: string;
}

export interface ScannedEntityPage {
  /** Wiki slug (directory under wikis/). */
  wiki: string;
  /** Page basename without .md (the entity slug). */
  slug: string;
  /** Path-qualified id relative to wikis/, without .md (e.g. 'acme/entities/people/john-smith'). */
  id: string;
  /** Wiki-relative page path WITH .md (e.g. 'entities/people/john-smith.md'). */
  wikiRelative: string;
  title: string;
  /** Entity type (first frontmatter tag; '' when absent). */
  entityType: string;
  aliases: string[];
  /** Frontmatter sources ({file, pages}). */
  sources: Array<{ file: string; pages: string }>;
  /** First prose paragraph of the body (Layer 1; '' when none). */
  firstParagraph: string;
  relationships: ScannedRelationship[];
}

export interface ScannedTopicPage {
  wiki: string;
  slug: string;
  /** Path-qualified id relative to wikis/, without .md (e.g. 'acme/topics/financial/fraud'). */
  id: string;
  /** Wiki-relative page path WITH .md. */
  wikiRelative: string;
  title: string;
  aliases: string[];
  firstParagraph: string;
}

/**
 * List the workspace's wikis: subdirectories of `wikis/` with a root
 * `index.md`, excluding the derived cross-wiki folder. Sorted by slug.
 */
export async function listWorkspaceWikis(workspace: string = '.'): Promise<string[]> {
  const wikisRoot = join(workspace, 'wikis');
  let entries;
  try {
    entries = await readdir(wikisRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const wikis: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === CROSS_WIKI_FOLDER) {
      continue;
    }
    try {
      await readFile(join(wikisRoot, entry.name, 'index.md'), 'utf-8');
      wikis.push(entry.name);
    } catch {
      // No root index.md — init-only wikis are not workspace members yet.
    }
  }
  return wikis.sort((a, b) => a.localeCompare(b));
}

async function walkMarkdown(dir: string, root: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkMarkdown(absolute, root, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      // Folder index.md files are DOX contracts, not content pages.
      if (entry.name.toLowerCase() === 'index.md') {
        continue;
      }
      out.push(relative(root, absolute).replace(/\\/g, '/'));
    }
  }
}

/** The first prose paragraph of a page body: skips headings, lists, and blank lines. */
export function firstParagraphOf(body: string): string {
  for (const block of body.split(/\r?\n\r?\n/)) {
    const trimmed = block.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.startsWith('#') || trimmed.startsWith('- ') || trimmed.startsWith('|') || trimmed.startsWith('[^')) {
      continue;
    }
    return trimmed.replace(/\r?\n/g, ' ');
  }
  return '';
}

/** `Is Ceo Of` → `is-ceo-of` — inverse of the entity page's readablePredicate. */
function kebabPredicate(readable: string): string {
  return readable
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const LINK_RE = /\[\[([^\]]+)\]\]/;

/**
 * Parse the rendered `## Relationships` lines of an entity page. Both the
 * deterministic template and synthesis-preserved Layer 2 sections use the same
 * line forms:
 *   outgoing: `- [[object-slug|Object Title]] — Readable Predicate [^srcN]`
 *             (synthesized pages may add ` — "evidence"` before the citation)
 *   incoming: `- [[subject-slug|Subject Title]] — Readable Predicate (incoming) — "evidence" [^srcN]`
 */
export function parseRelationshipLines(body: string): ScannedRelationship[] {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => /^## Relationships[ \t\r]*$/.test(line));
  if (start === -1) {
    return [];
  }
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++) {
    if (/^## /.test(lines[index])) {
      end = index;
      break;
    }
  }
  const relationships: ScannedRelationship[] = [];
  for (let index = start + 1; index < end; index++) {
    const line = lines[index].trim();
    if (!line.startsWith('- ')) {
      continue;
    }
    const linkMatch = LINK_RE.exec(line);
    if (!linkMatch) {
      continue;
    }
    const inner = linkMatch[1];
    const pipeIndex = inner.indexOf('|');
    const target = (pipeIndex === -1 ? inner : inner.slice(0, pipeIndex)).trim();
    const display = pipeIndex === -1 ? undefined : inner.slice(pipeIndex + 1).trim();
    const incoming = / \(incoming\)/.test(line);
    const evidenceMatch = / — "([^"]*)"/.exec(line);
    // The predicate sits between the first em-dash after the link and the
    // citation / (incoming) marker / evidence segment.
    const afterLink = line.slice(linkMatch.index + linkMatch[0].length);
    const predicateMatch = /^ — ([^—[\]]+?)(?: \(incoming\))?(?: — "[^"]*")?(?: \[\^src\d+\])?\s*$/.exec(afterLink);
    if (!predicateMatch) {
      continue;
    }
    const predicate = kebabPredicate(predicateMatch[1]);
    if (predicate.length === 0) {
      continue;
    }
    relationships.push({
      direction: incoming ? 'incoming' : 'outgoing',
      otherSlug: target,
      ...(display !== undefined && display.length > 0 ? { otherTitle: display } : {}),
      predicate,
      evidence: evidenceMatch ? evidenceMatch[1] : '',
    });
  }
  return relationships;
}

function frontmatterAliases(data: Record<string, unknown>): string[] {
  const aliases = data.aliases;
  if (typeof aliases === 'string') {
    return [aliases];
  }
  if (Array.isArray(aliases)) {
    return aliases.filter((alias): alias is string => typeof alias === 'string');
  }
  return [];
}

function frontmatterSources(data: Record<string, unknown>): Array<{ file: string; pages: string }> {
  const sources = data.sources;
  if (!Array.isArray(sources)) {
    return [];
  }
  const result: Array<{ file: string; pages: string }> = [];
  for (const entry of sources) {
    if (typeof entry === 'object' && entry !== null) {
      const record = entry as Record<string, unknown>;
      if (typeof record.file === 'string' && typeof record.pages === 'string') {
        result.push({ file: record.file, pages: record.pages });
      }
    }
  }
  return result;
}

/** Scan every `type: entity` page of one wiki (composite pages excluded — they are rollups). */
export async function scanEntityPages(workspace: string, wiki: string): Promise<ScannedEntityPage[]> {
  const wikiRoot = join(workspace, 'wikis', wiki);
  const entitiesRoot = join(wikiRoot, 'entities');
  const files: string[] = [];
  await walkMarkdown(entitiesRoot, entitiesRoot, files);
  const pages: ScannedEntityPage[] = [];
  for (const rel of files.sort((a, b) => a.localeCompare(b))) {
    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(await readFile(join(entitiesRoot, rel), 'utf-8'));
    } catch {
      continue;
    }
    const data = parsed.data as Record<string, unknown>;
    if (data.type !== 'entity') {
      continue;
    }
    const slug = (rel.split('/').pop() ?? rel).replace(/\.md$/i, '');
    const tags = Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === 'string') : [];
    pages.push({
      wiki,
      slug,
      id: `${wiki}/entities/${rel.replace(/\.md$/i, '')}`,
      wikiRelative: `entities/${rel}`,
      title: typeof data.title === 'string' ? data.title : slug,
      entityType: tags[0] ?? '',
      aliases: frontmatterAliases(data),
      sources: frontmatterSources(data),
      firstParagraph: firstParagraphOf(parsed.content),
      relationships: parseRelationshipLines(parsed.content),
    });
  }
  return pages;
}

/** Scan every `type: topic` page of one wiki. */
export async function scanTopicPages(workspace: string, wiki: string): Promise<ScannedTopicPage[]> {
  const wikiRoot = join(workspace, 'wikis', wiki);
  const topicsRoot = join(wikiRoot, 'topics');
  const files: string[] = [];
  await walkMarkdown(topicsRoot, topicsRoot, files);
  const pages: ScannedTopicPage[] = [];
  for (const rel of files.sort((a, b) => a.localeCompare(b))) {
    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(await readFile(join(topicsRoot, rel), 'utf-8'));
    } catch {
      continue;
    }
    const data = parsed.data as Record<string, unknown>;
    if (data.type !== 'topic') {
      continue;
    }
    const slug = (rel.split('/').pop() ?? rel).replace(/\.md$/i, '');
    pages.push({
      wiki,
      slug,
      id: `${wiki}/topics/${rel.replace(/\.md$/i, '')}`,
      wikiRelative: `topics/${rel}`,
      title: typeof data.title === 'string' ? data.title : slug,
      aliases: frontmatterAliases(data),
      firstParagraph: firstParagraphOf(parsed.content),
    });
  }
  return pages;
}
