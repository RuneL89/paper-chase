import type { Config } from '../config.js';
import type { Chunk } from '../chunking/types.js';
import type { ExtractionResult } from '../extractor/types.js';
import type { CriticReview, PagePlan, FolderPlan } from './types.js';

function buildCriticReview(
  issues: CriticReview['issues'],
  confidence: CriticReview['confidence'],
): CriticReview {
  const blockingIssues = issues
    .filter((i) => i.severity === 'high')
    .map((i) => ({ check: 'validation', message: i.message, severity: i.severity }));
  return {
    approved: issues.length === 0,
    issues,
    confidence,
    checks: [{ name: 'validation', result: 'PASS', reason: 'Deterministic validation completed' }],
    blockingIssues,
  };
}

export function validatePagePlan(
  pages: PagePlan[],
  folderPlacements: FolderPlan[],
): CriticReview {
  const issues: CriticReview['issues'] = [];
  const validFolders = new Set(folderPlacements.map((f) => f.folder));
  const validPageTypes = ['document', 'source', 'topic', 'entity', 'raw', 'index'];

  for (const page of pages) {
    if (!page.title || page.title.trim() === '') {
      issues.push({ type: 'schema', message: 'Page missing title', severity: 'high' });
    }
    if (!page.folder || !validFolders.has(page.folder)) {
      issues.push({
        type: 'schema',
        message: `Page ${page.title} references unknown folder: ${page.folder}`,
        severity: 'high',
      });
    }
    if (!validPageTypes.includes(page.pageType)) {
      issues.push({ type: 'schema', message: `Invalid page type: ${page.pageType}`, severity: 'high' });
    }
  }

  if (folderPlacements.length === 0) {
    issues.push({ type: 'missing', message: 'No folder placements defined', severity: 'high' });
  }

  const confidence = issues.length === 0 ? 'high' : issues.some((i) => i.severity === 'high') ? 'low' : 'medium';
  return buildCriticReview(issues, confidence);
}

export function validateChunkSources(
  chunks: Chunk[],
  result: ExtractionResult,
): CriticReview {
  const issues: CriticReview['issues'] = [];

  for (const chunk of chunks) {
    for (const source of chunk.sources) {
      if (!source.file || source.file.trim() === '') {
        issues.push({
          type: 'citation',
          message: `Chunk ${chunk.id} has a source without a file`,
          severity: 'high',
        });
      }
      if (!source.pages || source.pages.trim() === '') {
        issues.push({
          type: 'citation',
          message: `Chunk ${chunk.id} has a source without a page range`,
          severity: 'high',
        });
      }
    }
  }

  return buildCriticReview(issues, issues.length === 0 ? 'high' : 'low');
}

export function validateConfig(config: Config): CriticReview {
  const issues: CriticReview['issues'] = [];

  if (!config.wiki.slug || config.wiki.slug.trim() === '') {
    issues.push({ type: 'schema', message: 'Wiki slug is missing', severity: 'high' });
  }
  if (!config.wiki.title || config.wiki.title.trim() === '') {
    issues.push({ type: 'schema', message: 'Wiki title is missing', severity: 'medium' });
  }
  if (config.chunking.min_chunk_size > config.chunking.max_chunk_size) {
    issues.push({ type: 'schema', message: 'min_chunk_size > max_chunk_size', severity: 'high' });
  }

  return buildCriticReview(issues, issues.length === 0 ? 'high' : 'medium');
}
