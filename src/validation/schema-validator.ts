import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import matter from 'gray-matter';

export interface SchemaCheckResult {
  invalid: Array<{ page: string; issue: string }>;
  totalPages: number;
}

interface Page {
  absolute: string;
  relative: string;
}

const KNOWN_TYPES = new Set([
  'entity',
  'topic',
  'document',
  'source',
  'raw',
  'index',
  'composite',
  'comparison',
  // Phase 24 (vision `05` §9.1): the workspace-level derived types. They live
  // under `wikis/cross-wiki/` (validated by `cross-wiki-schema.ts`), but the
  // taxonomy knows them so a stray copy inside a wiki is checked by the same
  // field rules instead of passing as an undocumented custom type.
  'cross-wiki-index',
  'cross-wiki-topic',
]);

async function findPages(wikiSlug: string, workspace: string): Promise<Page[]> {
  const dir = join(workspace, 'wikis', wikiSlug);
  const pages: Page[] = [];
  await walk(dir, dir, workspace, pages);
  return pages;
}

async function walk(root: string, current: string, workspace: string, out: Page[]): Promise<void> {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.state') {
      continue;
    }
    const absolute = join(current, entry.name);
    if (entry.isDirectory()) {
      await walk(root, absolute, workspace, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      const wikiRel = relative(root, absolute).replace(/\\/g, '/');
      // The wiki constitution (AGENTS.md) is not a content page; skip it.
      if (wikiRel === 'AGENTS.md') {
        continue;
      }
      out.push({ absolute, relative: relative(workspace, absolute).replace(/\\/g, '/') });
    }
  }
}

function isValidIsoTimestamp(value: unknown): boolean {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }
  if (typeof value !== 'string') {
    return false;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return false;
  }
  try {
    return new Date(parsed).toISOString() === value;
  } catch {
    return false;
  }
}

/**
 * Validate YAML frontmatter on every `.md` file in the wiki.
 *
 * Required fields: `title`, `type`, `updated`.
 * `type` must be one of the known built-in page types or listed in the wiki's
 * `index.md` (Phase 5) as a custom type.
 * `updated` must be a valid ISO 8601 timestamp.
 */
export async function validateSchema(wikiSlug: string, workspace: string = '.'): Promise<SchemaCheckResult> {
  const pages = await findPages(wikiSlug, workspace);
  const invalid: Array<{ page: string; issue: string }> = [];

  for (const page of pages) {
    const content = await readFile(page.absolute, 'utf-8');
    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(content);
    } catch (err) {
      invalid.push({ page: page.relative, issue: `Invalid YAML frontmatter: ${(err as Error).message}` });
      continue;
    }

    const data = parsed.data as Record<string, unknown>;

    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      invalid.push({ page: page.relative, issue: 'Missing or invalid required field: title' });
    }

    if (!data.type || typeof data.type !== 'string') {
      invalid.push({ page: page.relative, issue: 'Missing required field: type' });
    } else if (!KNOWN_TYPES.has(data.type)) {
      // Custom types are allowed if they are documented in index.md.
      // Phase 5 will create index.md; until then, unknown types are flagged.
      invalid.push({ page: page.relative, issue: `Unknown page type: ${data.type}` });
    } else if (data.type === 'composite') {
      // Phase 22 (§2.4, the five-class rollup amendment): a composite page
      // must carry its members block (2-4 entries, each with a slug) and the
      // ratified rollup class (integer 1-5).
      const members = data.members;
      if (
        !Array.isArray(members) ||
        members.length < 2 ||
        members.length > 4 ||
        !members.every(
          (member) =>
            typeof member === 'object' &&
            member !== null &&
            typeof (member as Record<string, unknown>).slug === 'string' &&
            ((member as Record<string, unknown>).slug as string).length > 0,
        )
      ) {
        invalid.push({
          page: page.relative,
          issue: 'type composite requires a "members" list of 2-4 entries (each with a slug)',
        });
      }
      const rollupClass = data.class;
      if (typeof rollupClass !== 'number' || !Number.isInteger(rollupClass) || rollupClass < 1 || rollupClass > 5) {
        invalid.push({ page: page.relative, issue: 'type composite requires a "class" field (integer 1-5)' });
      }
    } else if (data.type === 'cross-wiki-index') {
      // Phase 24 (vision `05` §9.1): children list required; entityCount/
      // edgeCount optional; no `wiki` field (workspace-level artifact).
      if (!Array.isArray(data.children)) {
        invalid.push({ page: page.relative, issue: 'type cross-wiki-index requires a "children" list' });
      }
      if (data.wiki !== undefined) {
        invalid.push({ page: page.relative, issue: 'cross-wiki pages must not carry a "wiki" field' });
      }
    } else if (data.type === 'cross-wiki-topic') {
      if (typeof data.clusterId !== 'string' || data.clusterId.trim().length === 0) {
        invalid.push({ page: page.relative, issue: 'type cross-wiki-topic requires a "clusterId" field' });
      }
      if (
        !Array.isArray(data.members) ||
        data.members.length === 0 ||
        !data.members.every((member) => typeof member === 'string' && member.length > 0)
      ) {
        invalid.push({ page: page.relative, issue: 'type cross-wiki-topic requires a "members" list of path-qualified topic slugs' });
      }
      if (data.wiki !== undefined) {
        invalid.push({ page: page.relative, issue: 'cross-wiki pages must not carry a "wiki" field' });
      }
    }

    if (!isValidIsoTimestamp(data.updated)) {
      invalid.push({ page: page.relative, issue: 'Missing or invalid required field: updated (expected ISO 8601 timestamp)' });
    }
  }

  return { invalid, totalPages: pages.length };
}
