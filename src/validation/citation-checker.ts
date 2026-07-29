import { access, readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import matter from 'gray-matter';

export interface CitationCheckResult {
  invalid: Array<{ page: string; citation: string }>;
  missingSource: Array<{ page: string; citation: string }>;
  /**
   * Phase 17 (§2.6, vision `07` §2.5): distinct body `[^srcN]` keys on
   * entity/topic pages whose definition's source file is NOT covered by the
   * page's frontmatter `sources` list. Report-only, same posture as
   * `missingSource` — meaningful now that the Phase 17 frontmatter
   * re-imposition guarantees a complete deterministic map on new pages.
   */
  missingFrontmatterSource: Array<{ page: string; citation: string }>;
  totalCitations: number;
}

interface ContentPage {
  absolute: string;
  relative: string;
  wikiRelative: string;
}

async function findContentPages(wikiSlug: string, workspace: string): Promise<ContentPage[]> {
  const dir = join(workspace, 'wikis', wikiSlug);
  const pages: ContentPage[] = [];
  await walk(dir, dir, workspace, pages);
  return pages;
}

async function walk(root: string, current: string, workspace: string, out: ContentPage[]): Promise<void> {
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
      out.push({ absolute, relative: relative(workspace, absolute).replace(/\\/g, '/'), wikiRelative: wikiRel });
    }
  }
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---[\s\S]*?---/m, '');
}

/**
 * Phase 17 (§2.6): the set of source-file BASENAMES in a page's frontmatter
 * `sources` list. Absent or unparseable frontmatter yields an empty set (no
 * key is covered); non-list/non-string entries are ignored.
 */
function frontmatterSourceFiles(content: string): Set<string> {
  const files = new Set<string>();
  try {
    const parsed = matter(content);
    const sources = (parsed.data as Record<string, unknown>).sources;
    if (Array.isArray(sources)) {
      for (const entry of sources) {
        const file = (entry as Record<string, unknown> | null)?.file;
        if (typeof file === 'string' && file.trim().length > 0) {
          files.add(file.split('/').pop() ?? file);
        }
      }
    }
  } catch {
    // Unparseable frontmatter — no coverage (the schema validator flags it).
  }
  return files;
}

/**
 * Parse the source filename from a citation definition line.
 *
 * Definitions written by the Materializer look like:
 *   [^src1]: golden-master.pdf, pages 1-3
 * The filename is the text before the first comma, trimmed.
 */
function parseSourceFilename(definition: string): string | undefined {
  const firstComma = definition.indexOf(',');
  const raw = firstComma >= 0 ? definition.slice(0, firstComma) : definition;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Check every footnote-style citation in a wiki for a matching definition and
 * a source PDF that exists in `raw/`.
 *
 * Scans every content page (all `.md` files except `index.md`). For each
 * `[^srcN]` marker, it requires a `[^srcN]:` definition in the same page and a
 * file named in the definition to exist under `wikis/<slug>/raw/`.
 */
export async function checkCitations(wikiSlug: string, workspace: string = '.'): Promise<CitationCheckResult> {
  const pages = await findContentPages(wikiSlug, workspace);
  const invalid: Array<{ page: string; citation: string }> = [];
  const missingSource: Array<{ page: string; citation: string }> = [];
  const missingFrontmatterSource: Array<{ page: string; citation: string }> = [];
  let totalCitations = 0;

  const citationPattern = /\[\^src(\d+)\]/g;
  const definitionPattern = /\[\^src(\d+)\]:\s*(.+)/g;
  // Phase 17 (§2.6): in-prose markers only — definition lines are excluded
  // by the `(?!:)` lookahead.
  const markerPattern = /\[\^src(\d+)\](?!:)/g;

  for (const page of pages) {
    if (page.relative.endsWith('index.md')) {
      continue;
    }

    const content = await readFile(page.absolute, 'utf-8');
    const body = stripFrontmatter(content);

    const definitions = new Map<string, string>();
    let defMatch: RegExpExecArray | null;
    while ((defMatch = definitionPattern.exec(body)) !== null) {
      const key = `src${defMatch[1]}`;
      const text = defMatch[2].trim();
      definitions.set(key, text);
    }

    const seen = new Set<string>();
    let citeMatch: RegExpExecArray | null;
    while ((citeMatch = citationPattern.exec(body)) !== null) {
      const key = `src${citeMatch[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      totalCitations++;

      const definition = definitions.get(key);
      if (!definition) {
        invalid.push({ page: page.relative, citation: `[^${key}]` });
        continue;
      }

      const fileName = parseSourceFilename(definition);
      if (!fileName) {
        invalid.push({ page: page.relative, citation: `[^${key}]` });
        continue;
      }

      const sourcePath = join(workspace, 'wikis', wikiSlug, 'raw', fileName);
      try {
        await access(sourcePath);
      } catch {
        missingSource.push({ page: page.relative, citation: `[^${key}]` });
      }
    }

    // Phase 17 (§2.6, vision `07` §2.5): citation consistency — every
    // distinct in-prose `[^srcN]` key on an entity/topic page must be
    // covered by the page's frontmatter `sources`: the key's definition
    // names a source file (basename) that appears in the frontmatter list
    // (whose `file` entries are matched by basename too — the frontmatter
    // carries workspace-relative paths, the definitions carry basenames).
    if (page.wikiRelative.startsWith('entities/') || page.wikiRelative.startsWith('topics/')) {
      const frontmatterFiles = frontmatterSourceFiles(content);
      const markerKeys = new Set<string>();
      let markerMatch: RegExpExecArray | null;
      while ((markerMatch = markerPattern.exec(body)) !== null) {
        markerKeys.add(`src${markerMatch[1]}`);
      }
      for (const key of markerKeys) {
        const definition = definitions.get(key);
        const fileName = definition ? parseSourceFilename(definition) : undefined;
        if (!fileName || !frontmatterFiles.has(fileName)) {
          missingFrontmatterSource.push({ page: page.relative, citation: `[^${key}]` });
        }
      }
    }
  }

  return { invalid, missingSource, missingFrontmatterSource, totalCitations };
}
