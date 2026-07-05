import { writeFileSync } from 'fs';
import matter from 'gray-matter';
import type { ExtractedPage, ExtractionFailure, ExtractionResult } from '../extractor/types.js';

export function writeRawPage(
  filePath: string,
  result: ExtractionResult,
  page: ExtractedPage,
): void {
  const fragment = page.text.trim().slice(0, 500);
  const rawFragment = fragment.length > 0 ? fragment : 'No extractable text available';

  const frontmatter = {
    title: `Raw fragment: ${result.fileName}, page ${page.physicalPage}`,
    type: 'raw',
    source: result.filePath,
    pages: String(page.physicalPage),
    reason: 'Image-only or scanned page; text extraction confidence below threshold',
    raw_fragment: rawFragment,
    extracted: result.ingested,
    confidence: 'low',
  };

  const bodyLines = [
    `# Raw fragment: ${result.fileName}, page ${page.physicalPage}`,
    '',
    `**Source:** ${result.filePath}`,
    `**Page:** ${page.physicalPage}`,
    `**Reason:** ${frontmatter.reason}`,
    '',
    '## Preserved Fragment',
    '',
    page.text.trim().length > 0 ? page.text : '*No text available*',
  ];

  const content = matter.stringify(bodyLines.join('\n'), frontmatter);
  writeFileSync(filePath, content);
}

export function writeFailureRawPage(filePath: string, failure: ExtractionFailure): void {
  const frontmatter = {
    title: `Raw fragment: ${failure.fileName}`,
    type: 'raw',
    source: failure.filePath,
    pages: 'all',
    reason: failure.reason,
    raw_fragment: 'Malformed or unparseable PDF content could not be extracted.',
    extracted: failure.ingested,
    confidence: 'low',
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
