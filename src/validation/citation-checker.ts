import { access, readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

export interface CitationCheckResult {
  invalid: Array<{ page: string; citation: string }>;
  missingSource: Array<{ page: string; citation: string }>;
  totalCitations: number;
}

interface ContentPage {
  absolute: string;
  relative: string;
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
      out.push({ absolute, relative: relative(workspace, absolute).replace(/\\/g, '/') });
    }
  }
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---[\s\S]*?---/m, '');
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
  let totalCitations = 0;

  const citationPattern = /\[\^src(\d+)\]/g;
  const definitionPattern = /\[\^src(\d+)\]:\s*(.+)/g;

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
  }

  return { invalid, missingSource, totalCitations };
}
