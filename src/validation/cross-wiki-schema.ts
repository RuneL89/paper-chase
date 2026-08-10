import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import matter from 'gray-matter';

/**
 * Phase 24 (phase doc §2.9, vision `05` §9.1 + `07` §2.6): schema validation
 * for the workspace-level cross-wiki artifacts under `wikis/cross-wiki/`.
 * The per-wiki `validateSchema` walks ONE wiki's tree, so the cross-wiki
 * folder has its own validator with the two derived page types:
 *
 * - `cross-wiki-index` — requires `title`, `type`, `updated`, `children`
 *   (list; empty allowed); optional `entityCount`/`edgeCount`.
 * - `cross-wiki-topic` — requires `title`, `type`, `updated`, `clusterId`,
 *   `members` (list of path-qualified topic slugs `<wiki>/topics/<path>.md`).
 *
 * Both types are workspace-level: a `wiki` field is FORBIDDEN on them.
 */

export interface CrossWikiSchemaResult {
  invalid: Array<{ page: string; issue: string }>;
  totalPages: number;
}

const CROSS_WIKI_TYPES = new Set(['cross-wiki-index', 'cross-wiki-topic']);

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

async function walk(dir: string, root: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(absolute, root, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      out.push(relative(root, absolute).replace(/\\/g, '/'));
    }
  }
}

/**
 * Validate the frontmatter of every page under `wikis/cross-wiki/`
 * (workspace-relative page paths in the report). An absent folder yields an
 * empty, valid result.
 */
export async function validateCrossWikiSchema(workspace: string = '.'): Promise<CrossWikiSchemaResult> {
  const root = join(workspace, 'wikis', 'cross-wiki');
  const files: string[] = [];
  await walk(root, root, files);
  const invalid: Array<{ page: string; issue: string }> = [];

  for (const rel of files.sort((a, b) => a.localeCompare(b))) {
    const page = `wikis/cross-wiki/${rel}`;
    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(await readFile(join(root, rel), 'utf-8'));
    } catch (err) {
      invalid.push({ page, issue: `Invalid YAML frontmatter: ${(err as Error).message}` });
      continue;
    }
    const data = parsed.data as Record<string, unknown>;

    if (typeof data.title !== 'string' || data.title.trim().length === 0) {
      invalid.push({ page, issue: 'Missing or invalid required field: title' });
    }
    if (typeof data.type !== 'string' || data.type.length === 0) {
      invalid.push({ page, issue: 'Missing required field: type' });
    } else if (!CROSS_WIKI_TYPES.has(data.type)) {
      invalid.push({ page, issue: `Unknown cross-wiki page type: ${data.type}` });
    } else if (data.type === 'cross-wiki-index') {
      if (!Array.isArray(data.children)) {
        invalid.push({ page, issue: 'type cross-wiki-index requires a "children" list' });
      }
    } else if (data.type === 'cross-wiki-topic') {
      if (typeof data.clusterId !== 'string' || data.clusterId.trim().length === 0) {
        invalid.push({ page, issue: 'type cross-wiki-topic requires a "clusterId" field' });
      }
      if (
        !Array.isArray(data.members) ||
        data.members.length === 0 ||
        !data.members.every(
          (member) => typeof member === 'string' && /^[^/]+\/topics\/.+\.md$/.test(member),
        )
      ) {
        invalid.push({
          page,
          issue: 'type cross-wiki-topic requires a "members" list of path-qualified topic slugs (<wiki>/topics/<path>.md)',
        });
      }
    }
    if (data.wiki !== undefined) {
      invalid.push({ page, issue: 'cross-wiki pages must not carry a "wiki" field (workspace-level artifact)' });
    }
    if (!isValidIsoTimestamp(data.updated)) {
      invalid.push({ page, issue: 'Missing or invalid required field: updated (expected ISO 8601 timestamp)' });
    }
  }

  return { invalid, totalPages: files.length };
}
