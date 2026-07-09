import type { ExtractionResult } from '../extractor/types.js';
import type { Config } from '../config.js';
import type {
  CorpusFileInfo,
  SamplingCategory,
  SamplingStrategy,
  SamplingGroup,
} from '../chunking/types.js';

export type { CorpusFileInfo } from '../chunking/types.js';

export function classifyCorpus(
  sampledResult: ExtractionResult,
  otherFiles: CorpusFileInfo[],
  config: Config,
): SamplingStrategy {
  const threshold = config.sampling?.large_page_threshold ?? 500;
  const pageBudget = config.sampling?.strategy_page_budget ?? 50;
  const similarityKeys = config.sampling?.similarity_metadata_keys ?? ['title', 'author'];
  const allFiles = [
    { fileName: sampledResult.fileName, pageCount: sampledResult.physicalPages, metadata: sampledResult.metadata },
    ...otherFiles,
  ];

  // Single PDF case.
  if (allFiles.length === 1) {
    const file = allFiles[0];
    if (file.pageCount > threshold) {
      return {
        category: 'single-very-large',
        largePageThreshold: threshold,
        pageBudget,
        reason: `Only one PDF was found and it has ${file.pageCount} pages, exceeding the large-page threshold of ${threshold}. The sample will search for a TOC in the first ${pageBudget} pages; if none is found, the document will be read fully in chunks.`,
        tocSearch: {
          enabled: true,
          firstPages: pageBudget,
        },
      };
    }
    return {
      category: 'similar-manageable',
      largePageThreshold: threshold,
      pageBudget,
      reason: `Only one PDF was found with ${file.pageCount} pages, which is below the large-page threshold of ${threshold}. The sample will read this document fully to establish the ingestion strategy.`,
      readFirstFully: true,
      sampleRemaining: false,
    };
  }

  // Multiple PDFs: determine if all are large, all manageable, or mixed.
  const largeFiles = allFiles.filter((f) => f.pageCount > threshold);
  const manageableFiles = allFiles.filter((f) => f.pageCount <= threshold);
  const allSimilar = areFilesSimilar(allFiles, similarityKeys);

  if (largeFiles.length === allFiles.length && allSimilar) {
    return {
      category: 'similar-large',
      largePageThreshold: threshold,
      pageBudget,
      reason: `All ${allFiles.length} PDFs are large (> ${threshold} pages) and appear similar in metadata. The first document will be read fully to create the strategy; remaining documents will be processed with normal ingest.`,
      readFirstFully: true,
      deferRestToIngest: true,
    };
  }

  if (manageableFiles.length === allFiles.length && allSimilar) {
    return {
      category: 'similar-manageable',
      largePageThreshold: threshold,
      pageBudget,
      reason: `All ${allFiles.length} PDFs are below the large-page threshold (${threshold} pages) and appear similar. The first document will be read fully; a subset of pages from each remaining document will be sampled to confirm the structure.`,
      readFirstFully: true,
      sampleRemaining: true,
    };
  }

  // Mixed corpus: group by size and metadata similarity.
  const groups = buildMixedGroups(allFiles, threshold, config);
  return {
    category: 'mixed-corpus',
    largePageThreshold: threshold,
    pageBudget,
    reason: `The corpus contains documents with different size profiles or metadata. Documents were classified into ${groups.length} sub-group(s), each with its own sampling strategy.`,
    groups,
  };
}

export function createDefaultSamplingStrategy(
  result: ExtractionResult,
  config: Config,
): SamplingStrategy {
  const threshold = config.sampling?.large_page_threshold ?? 500;
  const pageBudget = config.sampling?.strategy_page_budget ?? 50;
  if (result.physicalPages > threshold) {
    return {
      category: 'single-very-large',
      largePageThreshold: threshold,
      pageBudget,
      reason: `PDF has ${result.physicalPages} pages, exceeding the large-page threshold of ${threshold}.`,
      tocSearch: {
        enabled: true,
        firstPages: pageBudget,
      },
    };
  }
  return {
    category: 'similar-manageable',
    largePageThreshold: threshold,
    pageBudget,
    reason: `PDF has ${result.physicalPages} pages, below the large-page threshold of ${threshold}.`,
    readFirstFully: true,
    sampleRemaining: false,
  };
}

function areFilesSimilar(files: CorpusFileInfo[], keys: string[]): boolean {
  if (files.length < 2) return true;
  const first = files[0];
  for (let i = 1; i < files.length; i++) {
    if (!filesShareSimilarity(first, files[i], keys)) {
      return false;
    }
  }
  return true;
}

function filesShareSimilarity(
  a: CorpusFileInfo,
  b: CorpusFileInfo,
  keys: string[],
): boolean {
  // Compare author/title/subject keywords if available.
  for (const key of keys) {
    const aVal = a.metadata[key];
    const bVal = b.metadata[key];
    if (aVal && bVal && typeof aVal === 'string' && typeof bVal === 'string') {
      if (!shareToken(aVal, bVal)) {
        return false;
      }
    }
  }
  // Compare file name stems for annual-report-like collections.
  const aStem = normalizeStem(a.fileName);
  const bStem = normalizeStem(b.fileName);
  if (aStem && bStem && aStem === bStem) {
    return true;
  }
  return true;
}

function normalizeStem(fileName: string): string | undefined {
  const base = fileName.replace(/\.pdf$/i, '').toLowerCase();
  // Remove trailing year-like tokens to group annual reports.
  const withoutYear = base.replace(/[-_\s]?(?:19|20)\d{2}$/, '').trim();
  if (withoutYear && withoutYear !== base) return withoutYear;
  return base;
}

function shareToken(a: string, b: string): boolean {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  for (const token of aTokens) {
    if (bTokens.has(token)) return true;
  }
  return false;
}

function tokenize(value: string): Set<string> {
  const tokens = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
  return new Set(tokens);
}

function buildMixedGroups(
  files: CorpusFileInfo[],
  threshold: number,
  config: Config,
): SamplingGroup[] {
  const large: CorpusFileInfo[] = [];
  const manageable: CorpusFileInfo[] = [];
  for (const file of files) {
    if (file.pageCount > threshold) {
      large.push(file);
    } else {
      manageable.push(file);
    }
  }
  const groups: SamplingGroup[] = [];
  if (large.length > 0) {
    const category: SamplingCategory =
      large.length === 1 ? 'single-very-large' : 'similar-large';
    groups.push({
      name: 'Large documents',
      files: large.map((f) => f.fileName),
      category,
      reason: `These ${large.length} document(s) exceed the ${threshold}-page threshold.`,
    });
  }
  if (manageable.length > 0) {
    const category: SamplingCategory =
      manageable.length === 1 ? 'similar-manageable' : 'similar-manageable';
    groups.push({
      name: 'Manageable documents',
      files: manageable.map((f) => f.fileName),
      category,
      reason: `These ${manageable.length} document(s) are at or below the ${threshold}-page threshold.`,
    });
  }
  return groups;
}
