import { writeFileSync } from 'fs';
import matter from 'gray-matter';
import { readCreatedTimestamp } from './preservation.js';
import type { ExtractedPage, ExtractionFailure, ExtractionResult } from '../extractor/types.js';

export function buildDefaultRawPageBody(result: ExtractionResult, page: ExtractedPage): string {
  return [
    `# Raw fragment: ${result.fileName}, page ${page.physicalPage}`,
    '',
    `**Source:** ${result.filePath}`,
    `**Page:** ${page.physicalPage}`,
    `**Reason:** Image-only or scanned page; text extraction confidence below threshold`,
    '',
    '## Preserved Fragment',
    '',
    page.text.trim().length > 0 ? page.text : '*No text available*',
  ].join('\n');
}

export function writeRawPage(
  filePath: string,
  result: ExtractionResult,
  page: ExtractedPage,
  body: string,
  wikiSlug: string,
): void {
  const fragment = page.text.trim().slice(0, 500);
  const rawFragment = fragment.length > 0 ? fragment : 'No extractable text available';
  const now = new Date().toISOString();
  const created = readCreatedTimestamp(filePath) ?? now;

  const frontmatter = {
    title: `Raw fragment: ${result.fileName}, page ${page.physicalPage}`,
    type: 'raw',
    wiki: wikiSlug,
    source: result.filePath,
    pages: String(page.physicalPage),
    reason: 'Image-only or scanned page; text extraction confidence below threshold',
    raw_fragment: rawFragment,
    extracted: result.ingested,
    confidence: 'low',
    created,
    updated: now,
  };

  const content = matter.stringify(body, frontmatter);
  writeFileSync(filePath, content);
}

export function writeFailureRawPage(filePath: string, failure: ExtractionFailure, wikiSlug: string): void {
  const now = new Date().toISOString();
  const created = readCreatedTimestamp(filePath) ?? now;

  const frontmatter = {
    title: `Raw fragment: ${failure.fileName}`,
    type: 'raw',
    wiki: wikiSlug,
    source: failure.filePath,
    pages: 'all',
    reason: failure.reason,
    raw_fragment: 'Malformed or unparseable PDF content could not be extracted.',
    extracted: failure.ingested,
    confidence: 'low',
    created,
    updated: now,
  };

  const bodyLines = [
    `# Raw fragment: ${failure.fileName}`,
    '',
    `**Source:** ${failure.filePath}`,
    `**Reason:** ${failure.reason}`,
    `**Size:** ${failure.sizeBytes} bytes`,
    '',
    '## Preserved Fragment',
    '',
    '*Malformed or unparseable PDF content could not be extracted.*',
  ];

  const content = matter.stringify(bodyLines.join('\n'), frontmatter);
  writeFileSync(filePath, content);
}
