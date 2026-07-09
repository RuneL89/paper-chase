import path from 'path';
import type { ExtractionResult, ExtractedPage } from '../extractor/types.js';
import type { Config } from '../config.js';
import type { PdfStructure, Chunk, ChunkingStrategy, ChunkBoundary, SamplingStrategy } from './types.js';
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

function buildPageRangeLabel(pages: ExtractedPage[]): string {
  if (pages.length === 0) return '';
  const start = pages[0].physicalPage;
  const end = pages[pages.length - 1].physicalPage;
  return start === end ? String(start) : `${start}-${end}`;
}

function buildLogicalPageRangeLabel(pages: ExtractedPage[]): string | undefined {
  const labels = pages.map((p) => p.pageLabel).filter((l): l is string => Boolean(l));
  if (labels.length === 0) return undefined;
  const start = labels[0];
  const end = labels[labels.length - 1];
  return start === end ? start : `${start}-${end}`;
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

function findBoundaryType(
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

function buildChunkContent(
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
): Chunk[] {
  const chunks: Chunk[] = [];
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
      currentGroup.push(page);
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

  return chunks;
}

export function analyzeAndChunk(
  result: ExtractionResult,
  config: Config,
  samplingStrategy?: SamplingStrategy,
): {
  structure: PdfStructure;
  strategy: ChunkingStrategy;
  chunks: Chunk[];
} {
  const structure = analyzePdfStructure(result);
  const strategy = buildChunkingStrategy(result, structure, config);
  if (samplingStrategy) {
    strategy.samplingStrategy = samplingStrategy;
  }
  const chunks = chunkPages(result, config, structure);
  return { structure, strategy, chunks };
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
