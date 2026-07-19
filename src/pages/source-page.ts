import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';
import { aliasesForTitle } from '../utils/aliases';
import { wikiRelativePath } from '../utils/paths';

/**
 * Deterministic `source` page writer (phase doc §2.4).
 *
 * A source page is the provenance anchor for one ingested PDF: frontmatter
 * with title/type/wiki/file/sha256/pages/ingested/updated/warnings, a field
 * table, and `[[wikilinks]]` to every document page derived from the PDF.
 * Frontmatter is serialized with gray-matter (js-yaml) so the YAML is always
 * valid.
 */
export interface SourcePageData {
  /** Wiki slug (e.g. 'acme-reports'). */
  wiki: string;
  /** PDF file name (e.g. 'annual-report-2024.pdf'). */
  fileName: string;
  /** Workspace-relative PDF path with forward slashes (e.g. 'wikis/acme/raw/annual-report-2024.pdf'). */
  filePath: string;
  /** Source slug (e.g. 'annual-report-2024'); determines the page file name. */
  sourceSlug: string;
  sha256: string;
  /** Total page count of the PDF. */
  pageCount: number;
  /** ISO 8601 timestamp of first ingestion. */
  ingested: string;
  /** ISO 8601 timestamp of this (re)write. */
  updated: string;
  /** Extraction warnings (e.g. 'Page 2 extracted to empty text'). */
  warnings: string[];
  /** Wiki-relative document page paths (e.g. 'documents/annual-report-2024-part-001.md'). */
  documentPages: string[];
}

/** Render the full source page (frontmatter + body) as a string. */
export function renderSourcePage(data: SourcePageData): string {
  const title = `Source: ${data.fileName}`;
  // Obsidian-resolvable title alias (UAT 6.3 fix): the title always differs
  // from the source slug, so source pages always carry the alias.
  const aliases = aliasesForTitle(title, data.sourceSlug);
  const frontmatter = {
    title,
    type: 'source',
    ...(aliases ? { aliases } : {}),
    wiki: data.wiki,
    file: data.filePath,
    sha256: data.sha256,
    pages: data.pageCount,
    ingested: data.ingested,
    updated: data.updated,
    warnings: data.warnings,
  };

  const lines: string[] = [
    `# Source: ${data.fileName}`,
    '',
    '| Field | Value |',
    '|---|---|',
    `| File | \`${data.filePath}\` |`,
    `| Pages | ${data.pageCount} |`,
    `| SHA-256 | \`${data.sha256}\` |`,
    `| Ingested | ${data.ingested.slice(0, 10)} |`,
    '',
    '## Document Pages',
    '',
  ];

  for (const pagePath of data.documentPages) {
    const pageSlug = pagePath.replace(/^documents\//, '').replace(/\.md$/, '');
    lines.push(`- [[${pageSlug}]]`);
  }

  if (data.warnings.length > 0) {
    lines.push('', '## Warnings', '');
    for (const warning of data.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  const body = `\n${lines.join('\n')}\n`;
  return matter.stringify(body, frontmatter);
}

/**
 * Write `sources/<source-slug>.md` inside the wiki directory. Returns the
 * wiki-relative path ('sources/<source-slug>.md').
 */
export async function writeSourcePage(wikiDir: string, data: SourcePageData): Promise<string> {
  const relativePath = wikiRelativePath('sources', `${data.sourceSlug}.md`);
  await mkdir(join(wikiDir, 'sources'), { recursive: true });
  await writeFile(join(wikiDir, relativePath), renderSourcePage(data), 'utf-8');
  return relativePath;
}
