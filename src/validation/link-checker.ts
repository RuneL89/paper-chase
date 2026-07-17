import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { slugify } from '../utils/slug';

export interface LinkCheckResult {
  broken: Array<{ page: string; link: string }>;
  orphaned: string[]; // pages with no incoming links (excluding index and source pages)
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
 * A wikilink `[[Page Title]]` is converted to a slug and matched against the
 * slugs of all `.md` files in the wiki (any folder). A page is orphaned if it
 * has no incoming links and is not `index.md` or a `sources/*.md` page.
 */
export async function checkLinks(wikiSlug: string, workspace: string = '.'): Promise<LinkCheckResult> {
  const dir = join(workspace, 'wikis', wikiSlug);
  const pages = await findMarkdownFiles(dir, workspace, wikiSlug);

  const slugToPage = new Map<string, MarkdownFile>();
  for (const page of pages) {
    // If two pages share the same slug, the first one wins; this is a rare
    // situation and the link checker reports the duplicate as resolved.
    if (!slugToPage.has(page.slug)) {
      slugToPage.set(page.slug, page);
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
  for (const page of pages) {
    incoming[page.relative] = 0;
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
      const linkText = match[1].trim();
      const target = slugToPage.get(slugify(linkText));
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

  return {
    broken,
    orphaned,
    totalLinks,
    totalPages: pages.length,
  };
}
