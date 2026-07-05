import path from 'path';
import type { ExtractionResult, ExtractedPage } from '../extractor/types.js';
import type { Config } from '../config.js';
import type { PdfStructure, Chunk, ChunkingStrategy } from './types.js';
import { analyzePdfStructure } from './analyzer.js';

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
    'If a page is malformed or unparseable, emit a `raw` page with the original fragment and reason, then continue with the next page boundary.';

  const boundaries: { type: 'page' | 'section' | 'table' | 'figure' | 'heading'; pageRange: string; description: string }[] =
    [];

  for (let i = 0; i < result.pages.length; i++) {
    const page = result.pages[i];
    const section = structure.sections.find((s) => s.startPage <= page.physicalPage && s.endPage >= page.physicalPage);
    const hasTable = structure.tables.some((t) => t.page === page.physicalPage);
    const hasFigure = structure.figures.some((f) => f.page === page.physicalPage);

    let type: 'page' | 'section' | 'table' | 'figure' | 'heading' = 'page';
    let description = `Page ${page.physicalPage}`;

    if (section) {
      type = 'section';
      description = `${section.title} (pages ${section.startPage}-${section.endPage})`;
    } else if (hasTable) {
      type = 'table';
      description = `Table on page ${page.physicalPage}`;
    } else if (hasFigure) {
      type = 'figure';
      description = `Figure on page ${page.physicalPage}`;
    } else if (structure.headings.some((h) => h.startPage === page.physicalPage)) {
      type = 'heading';
      description = `Heading on page ${page.physicalPage}`;
    }

    boundaries.push({
      type,
      pageRange: `${page.physicalPage}-${page.physicalPage}`,
      description,
    });
  }

  const example =
    boundaries.length > 0
      ? boundaries[0]
      : { type: 'page' as const, pageRange: '1-1', description: 'First page of the sample document' };

  return {
    splitBoundary,
    maxChunkSize,
    minChunkSize,
    neverSplit,
    overlap,
    fallback,
    boundaries,
    example,
  };
}

function chooseSplitBoundary(structure: PdfStructure, config: Config): string {
  if (structure.tables.length > 0) return 'page';
  if (structure.headings.length > 3) return 'section';
  return config.chunking.split_boundary;
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
  let currentChars = 0;
  let groupIndex = 1;

  function flushGroup(): void {
    if (currentGroup.length === 0) return;

    const startPage = currentGroup[0].physicalPage;
    const endPage = currentGroup[currentGroup.length - 1].physicalPage;
    const pageRange = startPage === endPage ? String(startPage) : `${startPage}-${endPage}`;

    const contentLines: string[] = [];
    for (const page of currentGroup) {
      contentLines.push(`## Page ${page.physicalPage}`);
      contentLines.push('');
      contentLines.push(page.text.trim());
      contentLines.push('');

      const tables = result.tables.filter((t) => t.page === page.physicalPage);
      for (const table of tables) {
        contentLines.push(`### Table on page ${page.physicalPage}`);
        contentLines.push('');
        contentLines.push(table.markdown);
        contentLines.push('');
      }

      const figures = result.figures.filter((f) => f.page === page.physicalPage);
      for (const figure of figures) {
        contentLines.push(`### Figure on page ${page.physicalPage}`);
        contentLines.push('');
        contentLines.push(figure.description);
        contentLines.push('');
      }
    }

    const content = contentLines.join('\n');
    const charCount = content.length;
    const belowMin = charCount < config.chunking.min_chunk_size;

    const sourceId = `src${groupIndex}`;

    chunks.push({
      id: `${baseSlug}-part-${String(groupIndex).padStart(3, '0')}`,
      title: `Part ${groupIndex}: ${baseSlug}`,
      pageRange,
      boundaryType: 'page',
      content,
      sources: [
        {
          id: sourceId,
          file: relativeFile,
          pages: pageRange,
          extracted: result.ingested,
        },
      ],
      tags: inferTags(result, structure),
      belowMin,
      charCount,
    });

    currentGroup = [];
    currentChars = 0;
    groupIndex++;
  }

  for (const page of result.pages) {
    // Scanned pages are not included in document chunks; they are handled as raw pages.
    if (page.isScanned) continue;

    // Start a new chunk if adding this page would exceed the max chunk size and the current group is non-empty.
    if (currentChars + page.text.length > config.chunking.max_chunk_size && currentGroup.length > 0) {
      flushGroup();
    }

    currentGroup.push(page);
    currentChars += page.text.length;
  }

  flushGroup();

  return chunks;
}

export function analyzeAndChunk(result: ExtractionResult, config: Config): {
  structure: PdfStructure;
  strategy: ChunkingStrategy;
  chunks: Chunk[];
} {
  const structure = analyzePdfStructure(result);
  const strategy = buildChunkingStrategy(result, structure, config);
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
  return tags;
}
