import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { slugify } from '../utils/slug';
import { parseWikilinkTarget } from '../utils/wikilinks';

export interface LinkCheckResult {
  broken: Array<{ page: string; link: string }>;
  orphaned: string[]; // pages with no incoming links (excluding index and source pages)
  /**
   * Phase 17 (B12b, vision `02` §2 "no page is an island" + `07` §2.5):
   * entity/topic pages with ZERO outgoing wikilinks — unreachable by
   * following links. Exemptions match the orphan rule (`index.md`,
   * `sources/*.md`) plus `documents/*.md` (raw chunk text legitimately
   * carries no links); only `entities/` and `topics/` pages are in scope.
   */
  islands: string[];
  totalLinks: number;
  totalPages: number;
}

interface MarkdownFile {
  absolute: string;
  relative: string; // workspace-relative, forward slashes
  slug: string;
  wikiRelative: string; // path relative to the wiki root, e.g. 'entities/...'
}

async function findMarkdownFiles(dir: string, workspace: string, wikiSlug: string): Promise<MarkdownFile[]> {
  const result: MarkdownFile[] = [];
  await walk(dir, dir, workspace, wikiSlug, result);
  return result;
}

async function walk(root: string, current: string, workspace: string, wikiSlug: string, out: MarkdownFile[]): Promise<void> {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.state') {
      continue;
    }
    const absolute = join(current, entry.name);
    if (entry.isDirectory()) {
      await walk(root, absolute, workspace, wikiSlug, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      const rel = relative(workspace, absolute).replace(/\\/g, '/');
      const wikiRel = relative(root, absolute).replace(/\\/g, '/');
      // The wiki constitution (AGENTS.md) is not a content page; skip it.
      if (wikiRel === 'AGENTS.md') {
        continue;
      }
      const basename = entry.name.replace(/\.md$/i, '');
      out.push({ absolute, relative: rel, slug: slugify(basename), wikiRelative: wikiRel });
    }
  }
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---[\s\S]*?---/m, '');
}

/**
 * Check every wikilink in a wiki for broken targets and orphaned pages.
 *
 * Resolution semantics (pipe-aware since the 2026-07-20 user-directed change;
 * compliance-log entry [2026-07-20 00:15]):
 *
 * 1. The link's inner text is split on the FIRST `|` — the part before it is
 *    the resolution target, the rest is display text and ignored for
 *    resolution (`[[board-of-directors|Board of Directors]]` resolves via
 *    `board-of-directors`).
 * 2. The target is first matched against the exact vault-relative path of a
 *    page (without the `.md` extension, which may also be present on the
 *    target): `[[entities/index|Entities]]` -> `entities/index.md`,
 *    `[[index|Wiki Title]]` -> the wiki-root `index.md`.
 * 3. Failing that, the target is slugified and matched against the slugs of
 *    all `.md` files' basenames (case-insensitive), which also keeps every
 *    legacy bare form resolvable: `[[Board of Directors]]`, `[[slug]]`, and
 *    the folder-index (`[[People]]`) / wiki-root (`[[Wiki Slug]]`) fallbacks.
 *
 * A page is orphaned if it has no incoming links and is not `index.md` or a
 * `sources/*.md` page.
 */
export async function checkLinks(wikiSlug: string, workspace: string = '.'): Promise<LinkCheckResult> {
  const dir = join(workspace, 'wikis', wikiSlug);
  const pages = await findMarkdownFiles(dir, workspace, wikiSlug);

  const slugToPage = new Map<string, MarkdownFile>();
  // Exact vault-relative path (without `.md`) -> page. Pipe-form folder-index
  // and root links (`[[entities/index|Entities]]`, `[[index|Wiki Title]]`)
  // resolve here before any slug fallback, so they are immune to the
  // many-files-share-basename-`index` collision in the slug map.
  const pathToPage = new Map<string, MarkdownFile>();
  for (const page of pages) {
    // If two pages share the same slug, the first one wins; this is a rare
    // situation and the link checker reports the duplicate as resolved.
    if (!slugToPage.has(page.slug)) {
      slugToPage.set(page.slug, page);
    }
    const pathKey = page.wikiRelative.replace(/\.md$/i, '');
    if (!pathToPage.has(pathKey)) {
      pathToPage.set(pathKey, page);
    }
  }

  // Folder indexes are navigable as [[Folder Name]] (e.g. [[People]] resolves
  // to entities/people/index.md). Map each folder slug to its index page so
  // DOX navigation links resolve without requiring a duplicate .md file.
  for (const page of pages) {
    if (page.wikiRelative.toLowerCase().endsWith('/index.md')) {
      const folderSlug = page.wikiRelative.replace(/\/index\.md$/i, '').split('/').pop() ?? '';
      if (folderSlug && !slugToPage.has(folderSlug)) {
        slugToPage.set(folderSlug, page);
      }
    } else if (page.wikiRelative.toLowerCase() === 'index.md') {
      // The wiki root index is navigable as [[Wiki Title]] / [[Wiki Slug]].
      if (!slugToPage.has(wikiSlug)) {
        slugToPage.set(wikiSlug, page);
      }
    }
  }

  const incoming: Record<string, number> = {};
  const outgoing: Record<string, number> = {};
  for (const page of pages) {
    incoming[page.relative] = 0;
    outgoing[page.relative] = 0;
  }

  const broken: Array<{ page: string; link: string }> = [];
  let totalLinks = 0;

  const linkPattern = /\[\[([^\]]+)\]\]/g;
  for (const page of pages) {
    const content = await readFile(page.absolute, 'utf-8');
    const body = stripFrontmatter(content);
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(body)) !== null) {
      totalLinks++;
      // Phase 17 (B12b): every wikilink occurrence counts as outgoing for
      // the island tally, resolvable or not.
      outgoing[page.relative]++;
      const linkText = match[1].trim();
      // Pipe form: only the part before the first `|` is the resolution
      // target; the display text is ignored. A trailing `.md` on the target
      // is tolerated (Obsidian accepts both path forms).
      const { target: linkTarget } = parseWikilinkTarget(linkText);
      const pathKey = linkTarget.replace(/\.md$/i, '');
      const target = pathToPage.get(pathKey) ?? slugToPage.get(slugify(linkTarget));
      if (target) {
        incoming[target.relative]++;
      } else {
        broken.push({ page: page.relative, link: linkText });
      }
    }
  }

  const orphaned = pages
    .map((page) => page.relative)
    .filter((path) => {
      if (path.endsWith('index.md')) return false;
      // sources/*.md are excluded from orphan detection.
      if (path.startsWith(`wikis/${wikiSlug}/sources/`)) return false;
      return incoming[path] === 0;
    });

  // Phase 17 (B12b, vision `02` §2 + `07` §2.5): island detection — an
  // entity/topic page with zero OUTGOING wikilinks. Same exemptions as the
  // orphan rule (`index.md`, `sources/*.md`) plus `documents/*.md`; scoped
  // to entities/ and topics/ pages, so the sources/documents exemptions are
  // subsumed by the scope but documented for parity with the orphan rule.
  // Detection only — same reporting posture as orphans.
  const islands = pages
    .filter((page) => {
      if (!page.wikiRelative.startsWith('entities/') && !page.wikiRelative.startsWith('topics/')) {
        return false;
      }
      if (page.wikiRelative.endsWith('index.md')) {
        return false;
      }
      return outgoing[page.relative] === 0;
    })
    .map((page) => page.relative);

  return {
    broken,
    orphaned,
    islands,
    totalLinks,
    totalPages: pages.length,
  };
}
