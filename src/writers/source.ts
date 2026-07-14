import { writeFileSync } from 'fs';
import matter from 'gray-matter';
import { readCreatedTimestamp, humanizeLabel } from './preservation.js';
import type { ExtractionResult } from '../extractor/types.js';

export interface DocumentPageLink {
  title: string;
  pageRange: string;
}

export interface RawPageLink {
  title: string;
  physicalPage: number;
}

export function buildDefaultSourcePageBody(
  result: ExtractionResult,
  documentLinks: DocumentPageLink[] = [],
  rawLinks: RawPageLink[] = [],
): string {
  const documentLines = documentLinks.length
    ? documentLinks.map((d) => `- [[${d.title}]] — pages ${d.pageRange}`)
    : ['- No document pages generated.'];

  const rawLines = rawLinks.length
    ? rawLinks.map((r) => `- [[${r.title}]] — page ${r.physicalPage}`)
    : ['- No raw pages generated.'];

  return [
    `# Source: ${result.fileName}`,
    '',
    `**File:** ${result.filePath}`,
    `**Filename:** ${result.fileName}`,
    `**Pages:** ${result.logicalPages} logical / ${result.physicalPages} physical`,
    `**Tables:** ${result.hasTables ? 'yes' : 'no'}`,
    `**Figures:** ${result.hasFigures ? 'yes' : 'no'}`,
    `**Scanned:** ${result.isScanned ? 'yes' : 'no'}`,
    `**Size:** ${result.sizeBytes} bytes`,
    '',
    '## Document Pages',
    ...documentLines,
    '',
    '## Raw Pages',
    ...rawLines,
  ].join('\n');
}

export function writeSourcePage(
  filePath: string,
  result: ExtractionResult,
  body: string,
  wikiSlug: string,
): void {
  // Strip undefined metadata fields so gray-matter can serialize cleanly.
  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(result.metadata)) {
    if (value !== undefined && value !== null) {
      metadata[key] = String(value);
    }
  }

  const now = new Date().toISOString();
  const created = readCreatedTimestamp(filePath) ?? now;

  const frontmatter: Record<string, unknown> = {
    title: `Source: ${result.fileName}`,
    type: 'source',
    wiki: wikiSlug,
    file: result.filePath,
    label: humanizeLabel(result.fileName),
    sha256: result.sha256,
    pages: result.physicalPages,
    has_tables: result.hasTables,
    has_figures: result.hasFigures,
    is_scanned: result.isScanned,
    size_bytes: result.sizeBytes,
    metadata,
    ingested: result.ingested,
    warnings: result.warnings,
    created,
    updated: now,
  };

  const content = matter.stringify(body, frontmatter);
  writeFileSync(filePath, content);
}
