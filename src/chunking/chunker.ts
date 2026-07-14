import path from 'path';
import type { ExtractionResult, ExtractedPage } from '../extractor/types.js';
import type { Config } from '../config.js';
import type { PdfStructure, Chunk, ChunkingStrategy, ChunkBoundary, SamplingStrategy, ChunkingStrategyHint, ChunkingPlannerFn, AnalyzeAndChunkResult } from './types.js';
import { analyzePdfStructure } from './analyzer.js';
import { createDefaultSamplingStrategy } from '../orchestrator/sampling.js';

export function buildChunkingStrategy(
  result: ExtractionResult,
  structure: PdfStructure,
  config: Config,
): ChunkingStrategy {
  const maxChunkSize = config.chunking.max_chunk_size;
  const minChunkSize = config.chunking.min_chunk_size;
  const splitBoundary = chooseSplitBoundary(structure, config);
  const overlap = config.chunking.overlap;
  const neverSplit = [...config.chunking.never_split];

  const fallback =
    'If a page is malformed or unparseable, emit a `raw` page with the original fragment and reason, then continue with the next page boundary. Scanned pages are always routed to `raw/` pages, not document chunks. Multi-page tables, figures, and footnotes are kept together in a single chunk.';

  const boundaries: ChunkBoundary[] = [];

  for (const page of result.pages) {
    const section = structure.sections.find(
      (s) => s.startPage <= page.physicalPage && s.endPage >= page.physicalPage,
    );
    const table = structure.tables.find((t) => t.page === page.physicalPage);
    const figure = structure.figures.find((f) => f.page === page.physicalPage);
    const multiPageObject = structure.multiPageObjects.find(
      (o) => o.startPage <= page.physicalPage && o.endPage >= page.physicalPage,
    );

    let type: ChunkBoundary['type'] = 'page';
    let description = `Page ${page.physicalPage}`;

    if (multiPageObject) {
      type = multiPageObject.type === 'table' || multiPageObject.type === 'figure' ? multiPageObject.type : 'section';
      description = multiPageObject.description;
    } else if (section) {
      type = 'section';
      description = `${section.title} (pages ${section.startPage}-${section.endPage})`;
    } else if (table) {
      type = 'table';
      description = table.caption
        ? `Table: ${table.caption} (page ${page.physicalPage})`
        : `Table on page ${page.physicalPage}`;
    } else if (figure) {
      type = 'figure';
      description = figure.caption
        ? `Figure: ${figure.caption} (page ${page.physicalPage})`
        : `Figure on page ${page.physicalPage}`;
    } else if (structure.headings.some((h) => h.startPage === page.physicalPage)) {
      type = 'heading';
      description = `Heading on page ${page.physicalPage}`;
    }

    boundaries.push({
      type,
      pageRange: `${page.physicalPage}-${page.physicalPage}`,
      logicalPageRange: page.pageLabel ? `${page.pageLabel}-${page.pageLabel}` : undefined,
      description,
      isScanned: page.isScanned,
      scanConfidence: page.scanConfidence,
      imageOpCount: page.imageOpCount,
      hasTable: table !== undefined,
      hasFigure: figure !== undefined,
      multiPageObject: multiPageObject?.type,
    });
  }

  const example =
    boundaries.length > 0
      ? boundaries[0]
      : {
          type: 'page' as const,
          pageRange: '1-1',
          description: 'First page of the sample document',
          isScanned: false,
          scanConfidence: 'high' as const,
          imageOpCount: 0,
          hasTable: false,
          hasFigure: false,
        };

  return {
    sha256: result.sha256,
    fileName: result.fileName,
    splitBoundary,
    maxChunkSize,
    minChunkSize,
    neverSplit,
    overlap,
    fallback,
    boundaries,
    example,
    samplingStrategy: createDefaultSamplingStrategy(result, config),
  };
}

function chooseSplitBoundary(structure: PdfStructure, config: Config): string {
  if (structure.multiPageObjects.length > 0) return 'semantic-object';
  return config.chunking.split_boundary;
}

export function buildPageRangeLabel(pages: ExtractedPage[]): string {
  if (pages.length === 0) return '';
  const start = pages[0].physicalPage;
  const end = pages[pages.length - 1].physicalPage;
  return start === end ? String(start) : `${start}-${end}`;
}

export function buildLogicalPageRangeLabel(pages: ExtractedPage[]): string | undefined {
  const labels = pages.map((p) => p.pageLabel).filter((l): l is string => Boolean(l));
  if (labels.length === 0) return undefined;
  const start = labels[0];
  const end = labels[labels.length - 1];
  return start === end ? start : `${start}-${end}`;
}

function buildCompactPageRange(pages: ExtractedPage[]): string {
  if (pages.length === 0) return '';
  const sorted = [...pages].sort((a, b) => a.physicalPage - b.physicalPage);
  const ranges: string[] = [];
  let runStart = sorted[0].physicalPage;
  let runEnd = sorted[0].physicalPage;
  for (let i = 1; i < sorted.length; i++) {
    const pageNum = sorted[i].physicalPage;
    if (pageNum === runEnd + 1) {
      runEnd = pageNum;
    } else {
      ranges.push(runStart === runEnd ? String(runStart) : `${runStart}-${runEnd}`);
      runStart = pageNum;
      runEnd = pageNum;
    }
  }
  ranges.push(runStart === runEnd ? String(runStart) : `${runStart}-${runEnd}`);
  return ranges.join(',');
}

function buildCompactLogicalPageRange(pages: ExtractedPage[]): string | undefined {
  const labels = pages.map((p) => p.pageLabel).filter((l): l is string => Boolean(l));
  if (labels.length === 0) return undefined;
  const ranges: string[] = [];
  let runStart = labels[0];
  let runEnd = labels[0];
  for (let i = 1; i < labels.length; i++) {
    const label = labels[i];
    if (label === String(Number(runEnd) + 1)) {
      runEnd = label;
    } else {
      ranges.push(runStart === runEnd ? runStart : `${runStart}-${runEnd}`);
      runStart = label;
      runEnd = label;
    }
  }
  ranges.push(runStart === runEnd ? runStart : `${runStart}-${runEnd}`);
  return ranges.join(',');
}

function findMultiPageObjectForPage(
  page: ExtractedPage,
  structure: PdfStructure,
): { type: 'table' | 'figure' | 'footnote'; endPage: number; description: string } | undefined {
  for (const obj of structure.multiPageObjects) {
    if (obj.startPage <= page.physicalPage && obj.endPage >= page.physicalPage) {
      return {
        type: obj.type,
        endPage: obj.endPage,
        description: obj.description,
      };
    }
  }
  return undefined;
}

export function findBoundaryType(
  pages: ExtractedPage[],
  result: ExtractionResult,
  structure: PdfStructure,
): Chunk['boundaryType'] {
  if (pages.length === 0) return 'page';

  // If any page in the group belongs to a multi-page object, the chunk boundary is that object type.
  for (const page of pages) {
    const mpo = findMultiPageObjectForPage(page, structure);
    if (mpo) return mpo.type === 'figure' || mpo.type === 'table' ? mpo.type : 'section';
  }

  // If the first page starts a section, use section boundary.
  const firstPage = pages[0];
  const section = structure.sections.find(
    (s) => s.startPage === firstPage.physicalPage,
  );
  if (section) return 'section';

  // If the group contains a table or figure, prefer that boundary type.
  if (pages.some((p) => result.tables.some((t) => t.page === p.physicalPage))) {
    return 'table';
  }
  if (pages.some((p) => result.figures.some((f) => f.page === p.physicalPage))) {
    return 'figure';
  }

  // If the first page contains a heading, use heading boundary.
  if (firstPage.estimatedHeadings && firstPage.estimatedHeadings.length > 0) {
    return 'heading';
  }

  return 'page';
}

export function buildChunkContent(
  pages: ExtractedPage[],
  result: ExtractionResult,
): string {
  const contentLines: string[] = [];

  for (const page of pages) {
    contentLines.push(`## Page ${page.physicalPage}`);
    if (page.pageLabel) {
      contentLines.push(`Logical page: ${page.pageLabel}`);
    }
    contentLines.push('');
    contentLines.push(page.text.trim());
    contentLines.push('');

    const tables = result.tables.filter((t) => t.page === page.physicalPage);
    for (const table of tables) {
      contentLines.push(`### Table on page ${page.physicalPage}`);
      if (table.caption) {
        contentLines.push(`**Caption:** ${table.caption}`);
      }
      contentLines.push('');
      contentLines.push(table.markdown);
      contentLines.push('');
    }

    const figures = result.figures.filter((f) => f.page === page.physicalPage);
    for (const figure of figures) {
      contentLines.push(`### Figure on page ${page.physicalPage}`);
      if (figure.caption) {
        contentLines.push(`**Caption:** ${figure.caption}`);
      }
      contentLines.push('');
      contentLines.push(figure.description);
      contentLines.push('');
    }

    if (page.estimatedLists && page.estimatedLists.length > 0) {
      contentLines.push('### Lists');
      contentLines.push('');
      for (const list of page.estimatedLists) {
        contentLines.push(list);
      }
      contentLines.push('');
    }
  }

  return contentLines.join('\n');
}

function estimatePageContentLength(
  page: ExtractedPage,
  result: ExtractionResult,
): number {
  const headerLength = 40 + (page.pageLabel ? 20 : 0);
  const tables = result.tables.filter((t) => t.page === page.physicalPage);
  const tableLength = tables.reduce((sum, t) => sum + (t.markdown?.length || 0), 0);
  const figures = result.figures.filter((f) => f.page === page.physicalPage);
  const figureLength = figures.reduce((sum, f) => sum + (f.description?.length || 0), 0);
  const listLength = (page.estimatedLists || []).reduce((sum, l) => sum + l.length, 0);
  return headerLength + page.text.length + tableLength + figureLength + listLength;
}

export function chunkPages(
  result: ExtractionResult,
  config: Config,
  structure: PdfStructure,
  strategy: ChunkingStrategy,
): { chunks: Chunk[]; warnings: string[] } {
  const chunks: Chunk[] = [];
  const groups: ExtractedPage[][] = [];
  const baseSlug = path.basename(result.filePath, path.extname(result.filePath));
  const relativeFile = result.filePath;

  let currentGroup: ExtractedPage[] = [];
  let groupIndex = 1;
  let activeMultiPageObject: { type: 'table' | 'figure' | 'footnote'; endPage: number; description: string } | undefined;
  let currentGroupLength = 0;

  function flushGroup(): void {
    if (currentGroup.length === 0) return;

    const pageRange = buildPageRangeLabel(currentGroup);
    const logicalPageRange = buildLogicalPageRangeLabel(currentGroup);
    const boundaryType = findBoundaryType(currentGroup, result, structure);
    const content = buildChunkContent(currentGroup, result);
    const charCount = content.length;
    const belowMin = charCount < config.chunking.min_chunk_size;

    const sourceId = `src${groupIndex}`;

    chunks.push({
      id: `${baseSlug}-part-${String(groupIndex).padStart(3, '0')}`,
      title: `Part ${groupIndex}: ${baseSlug}`,
      pageRange,
      logicalPageRange,
      boundaryType,
      content,
      sources: [
        {
          id: sourceId,
          file: relativeFile,
          pages: pageRange,
          logicalPages: logicalPageRange,
          extracted: result.ingested,
          sha256: result.sha256,
        },
      ],
      tags: inferTags(result, structure),
      belowMin,
      charCount,
    });

    groups.push([...currentGroup]);
    currentGroup = [];
    groupIndex++;
    activeMultiPageObject = undefined;
    currentGroupLength = 0;
  }

  for (const page of result.pages) {
    // Scanned pages are not included in document chunks; they are handled as raw pages.
    if (page.isScanned) continue;

    const pageMpo = findMultiPageObjectForPage(page, structure);
    const pageIsMpo = pageMpo !== undefined;
    const groupIsMpo = activeMultiPageObject !== undefined;
    const sameMpo =
      pageIsMpo && groupIsMpo && pageMpo.endPage === activeMultiPageObject?.endPage;

    // Flush whenever the boundary class changes (MPO vs. normal, or different MPO).
    if (currentGroup.length > 0 && !sameMpo) {
      flushGroup();
    }

    if (pageIsMpo) {
      // Start a new MPO group if we are beginning one.
      if (currentGroup.length === 0) {
        activeMultiPageObject = pageMpo;
      }
      // Enforce the configured max chunk size even for MPOs. If the MPO is too
      // large to fit, split it at page boundaries rather than creating an
      // oversized chunk.
      const pageLength = estimatePageContentLength(page, result);
      if (
        currentGroup.length > 0 &&
        currentGroupLength + pageLength > config.chunking.max_chunk_size
      ) {
        flushGroup();
        activeMultiPageObject = pageMpo;
      }
      currentGroup.push(page);
      currentGroupLength += pageLength;
      // If we have collected the whole multi-page object, flush it now.
      if (page.physicalPage === pageMpo.endPage) {
        flushGroup();
      }
    } else {
      // Normal page: group consecutive pages until the next page would exceed the
      // maximum chunk size, then flush before adding it.
      const pageLength = estimatePageContentLength(page, result);
      if (
        currentGroup.length > 0 &&
        currentGroupLength + pageLength > config.chunking.max_chunk_size
      ) {
        flushGroup();
      }
      if (currentGroup.length === 0) {
        activeMultiPageObject = undefined;
        currentGroupLength = 0;
      }
      currentGroup.push(page);
      currentGroupLength += pageLength;
    }
  }

  flushGroup();

  const { chunks: mergedChunks, warnings } = mergeIsolatedChunks(
    chunks,
    groups,
    result,
    structure,
    config,
    baseSlug,
  );

  return { chunks: mergedChunks, warnings };
}

function mergeIsolatedChunks(
  chunks: Chunk[],
  groups: ExtractedPage[][],
  result: ExtractionResult,
  structure: PdfStructure,
  config: Config,
  baseSlug: string,
): { chunks: Chunk[]; warnings: string[] } {
  const warnings: string[] = [];
  const scannedPages = result.pages.filter((p) => p.isScanned).map((p) => p.physicalPage);
  if (scannedPages.length === 0) {
    return { chunks, warnings };
  }
  const scannedPageSet = new Set(scannedPages);

  function isIsolated(groupIndex: number): boolean {
    const group = groups[groupIndex];
    if (group.length === 0) return false;
    const firstPage = group[0].physicalPage;
    const lastPage = group[group.length - 1].physicalPage;
    return (
      (firstPage > 1 && scannedPageSet.has(firstPage - 1)) ||
      (lastPage < structure.totalPages && scannedPageSet.has(lastPage + 1))
    );
  }

  function isCoverChunk(groupIndex: number): boolean {
    return structure.hasCover && groups[groupIndex].some((p) => p.physicalPage === 1);
  }

  let i = 0;
  while (i < chunks.length) {
    const chunk = chunks[i];
    const isolated = isIsolated(i);
    const cover = isCoverChunk(i);

    if (!isolated || (!cover && !chunk.belowMin)) {
      i++;
      continue;
    }

    let targetIndex = -1;
    if (i + 1 < chunks.length) {
      targetIndex = i + 1;
    } else if (i - 1 >= 0) {
      targetIndex = i - 1;
    }

    if (targetIndex === -1) {
      const reason = cover ? 'cover' : 'below-minimum';
      warnings.push(
        `Isolated ${reason} chunk ${chunk.id} (${chunk.pageRange}) has no adjacent chunk to merge with.`,
      );
      i++;
      continue;
    }

    // Merging would create a chunk that exceeds the configured max size; skip and warn.
    if (chunk.charCount + chunks[targetIndex].charCount > config.chunking.max_chunk_size) {
      const reason = cover ? 'cover' : 'below-minimum';
      warnings.push(
        `Isolated ${reason} chunk ${chunk.id} (${chunk.pageRange}) could not be merged: combined chunk would exceed max_chunk_size.`,
      );
      i++;
      continue;
    }

    const sourcePages = groups[i];
    const targetPages = groups[targetIndex];
    const mergedPages = [...sourcePages, ...targetPages].sort(
      (a, b) => a.physicalPage - b.physicalPage,
    );
    const uniquePages = mergedPages.filter(
      (p, idx, arr) => arr.findIndex((x) => x.physicalPage === p.physicalPage) === idx,
    );
    const sourcePageRange = chunk.pageRange;
    const targetChunk = chunks[targetIndex];
    const newPageRange = buildCompactPageRange(uniquePages);
    const newLogicalPageRange = buildCompactLogicalPageRange(uniquePages);
    const newContent = buildChunkContent(uniquePages, result);
    const newCharCount = newContent.length;
    const newBelowMin = newCharCount < config.chunking.min_chunk_size;

    chunks[targetIndex] = {
      ...targetChunk,
      id: targetChunk.id,
      title: targetChunk.title,
      pageRange: newPageRange,
      logicalPageRange: newLogicalPageRange,
      boundaryType: findBoundaryType(uniquePages, result, structure),
      content: newContent,
      charCount: newCharCount,
      belowMin: newBelowMin,
      sources: [
        {
          ...targetChunk.sources[0],
          pages: newPageRange,
          logicalPages: newLogicalPageRange,
        },
      ],
      tags: Array.from(new Set([...targetChunk.tags, 'scanned-gap'])),
    };
    groups[targetIndex] = uniquePages;

    const reason = cover ? 'cover page' : 'below-minimum chunk';
    warnings.push(
      `Merged isolated ${reason} pages ${sourcePageRange} into chunk ${targetChunk.id} (now ${newPageRange}) due to scanned page gap.`,
    );

    chunks.splice(i, 1);
    groups.splice(i, 1);
  }

  // Renumber chunk IDs and titles so they stay sequential after merges.
  for (let idx = 0; idx < chunks.length; idx++) {
    chunks[idx].id = `${baseSlug}-part-${String(idx + 1).padStart(3, '0')}`;
    chunks[idx].title = `Part ${idx + 1}: ${baseSlug}`;
    if (chunks[idx].sources.length > 0) {
      chunks[idx].sources[0].id = `src${idx + 1}`;
    }
  }

  return { chunks, warnings };
}

export interface AnalyzeAndChunkOptions {
  samplingStrategy?: SamplingStrategy;
  planner?: ChunkingPlannerFn;
  agentsMd?: string;
}

export async function analyzeAndChunk(
  result: ExtractionResult,
  config: Config,
  options?: AnalyzeAndChunkOptions,
): Promise<AnalyzeAndChunkResult> {
  const structure = analyzePdfStructure(result);
  const strategy = buildChunkingStrategy(result, structure, config);
  if (options?.samplingStrategy) {
    strategy.samplingStrategy = options.samplingStrategy;
  }

  let currentConfig = config;
  let previousBoundary = strategy.splitBoundary;
  const allWarnings: string[] = [];

  if (options?.planner && strategy.samplingStrategy) {
    try {
      const hint = await options.planner(
        result,
        structure,
        currentConfig,
        strategy.samplingStrategy,
        options.agentsMd,
      );
      if (isValidChunkingStrategyHint(hint)) {
        strategy.splitBoundary = hint.splitBoundary;
        previousBoundary = hint.splitBoundary;
        strategy.fallback = `${strategy.fallback} LLM strategy reason: ${hint.reason}`;
      } else {
        console.warn(
          'ChunkingPlanner returned an invalid strategy hint. Using deterministic fallback.',
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`ChunkingPlanner failed: ${message}. Using deterministic fallback.`);
    }
  }

  let { chunks, warnings } = chunkPages(result, currentConfig, structure, strategy);
  allWarnings.push(...warnings);

  // Agentic feedback loop: if any chunk is still oversized, ask the ChunkingPlanner
  // for a finer boundary subdivision and re-chunk with a reduced max_chunk_size.
  const MAX_FEEDBACK_ITERATIONS = 3;
  const SAFE_PROMPT_TOKEN_ESTIMATE = 4; // chars per token (rough).
  const SAFE_PROMPT_TOKEN_LIMIT = 12000; // ~12k token budget for chunk content.
  for (let iteration = 0; iteration < MAX_FEEDBACK_ITERATIONS; iteration++) {
    const oversized = chunks.filter(
      (c) => c.content.length / SAFE_PROMPT_TOKEN_ESTIMATE > SAFE_PROMPT_TOKEN_LIMIT,
    );
    if (oversized.length === 0) break;

    const oversizedSummary = oversized
      .map((c) => `${c.id} (${c.pageRange}, ${c.content.length} chars)`)
      .join(', ');
    const feedback =
      `The previous splitBoundary "${previousBoundary}" produced ${oversized.length} oversized chunk(s): ${oversizedSummary}. ` +
      `Suggest a finer natural boundary (e.g., page, heading, or table) so each chunk fits within a safe prompt budget. ` +
      `Do not split inside multi-page tables or figures.`;
    allWarnings.push(
      `Oversized chunk(s) detected: ${oversizedSummary}. Requesting finer split boundary from ChunkingPlanner (iteration ${iteration + 1}).`,
    );

    if (options?.planner && strategy.samplingStrategy) {
      try {
        const hint = await options.planner(
          result,
          structure,
          currentConfig,
          strategy.samplingStrategy,
          options.agentsMd,
          feedback,
        );
        if (isValidChunkingStrategyHint(hint)) {
          strategy.splitBoundary = hint.splitBoundary;
          previousBoundary = hint.splitBoundary;
          strategy.fallback = `${strategy.fallback} [feedback ${iteration + 1}] ${hint.reason}`;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`ChunkingPlanner feedback call failed: ${message}. Using deterministic fallback.`);
      }
    }

    // Reduce max_chunk_size as a deterministic backstop even if the planner does not help.
    const reducedMaxChunkSize = Math.max(
      currentConfig.chunking.min_chunk_size,
      Math.floor(currentConfig.chunking.max_chunk_size * 0.7),
    );
    currentConfig = {
      ...currentConfig,
      chunking: { ...currentConfig.chunking, max_chunk_size: reducedMaxChunkSize },
    };

    const rechunked = chunkPages(result, currentConfig, structure, strategy);
    chunks = rechunked.chunks;
    allWarnings.push(...rechunked.warnings);
  }

  const stillOversized = chunks.filter(
    (c) => c.content.length / SAFE_PROMPT_TOKEN_ESTIMATE > SAFE_PROMPT_TOKEN_LIMIT,
  );
  if (stillOversized.length > 0) {
    allWarnings.push(
      `Could not reduce ${stillOversized.length} chunk(s) below safe prompt budget after ${MAX_FEEDBACK_ITERATIONS} iterations.`,
    );
  }

  return { structure, strategy, chunks, warnings: allWarnings };
}

function isValidChunkingStrategyHint(
  output: unknown,
): output is ChunkingStrategyHint {
  const o = output as Record<string, unknown> | undefined;
  if (!o || typeof o !== 'object') return false;
  const allowed = ['page', 'section', 'heading', 'table', 'figure'];
  if (typeof o.splitBoundary !== 'string' || !allowed.includes(o.splitBoundary)) return false;
  if (typeof o.reason !== 'string') return false;
  if (!Array.isArray(o.issues)) return false;
  return true;
}

function inferTags(result: ExtractionResult, structure: PdfStructure): string[] {
  const tags: string[] = ['document'];
  if (structure.hasCover) tags.push('cover');
  if (structure.hasToc) tags.push('toc');
  if (structure.tables.length > 0) tags.push('table');
  if (structure.figures.length > 0) tags.push('figure');
  if (result.metadata.title) tags.push('sample');
  if (structure.multiPageObjects.length > 0) tags.push('multi-page-object');
  return tags;
}
