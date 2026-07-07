import { writeFileSync } from 'fs';
import type { PdfStructure, ChunkingStrategy } from './types.js';

export function writeChunkingStrategy(
  filePath: string,
  structure: PdfStructure,
  strategy: ChunkingStrategy,
): void {
  const lines: string[] = [];

  lines.push('# Chunking Strategy');
  lines.push('');

  lines.push('## Source Provenance');
  lines.push('');
  lines.push(`- **File name:** ${strategy.fileName}`);
  lines.push(`- **SHA-256:** ${strategy.sha256}`);
  lines.push('');

  lines.push('## Discovered PDF Structure');
  lines.push('');
  lines.push(structure.summary);
  lines.push('');
  lines.push(`- **Total pages:** ${structure.totalPages}`);
  lines.push(`- **Cover detected:** ${structure.hasCover ? 'yes' : 'no'}`);
  lines.push(`- **Table of contents detected:** ${structure.hasToc ? 'yes' : 'no'}`);
  lines.push(`- **Section headings detected:** ${structure.headings.length}`);
  lines.push(`- **Tables detected:** ${structure.tables.length}`);
  lines.push(`- **Figures detected:** ${structure.figures.length}`);
  lines.push(`- **Multi-page objects detected:** ${structure.multiPageObjects.length}`);
  if (structure.multiPageObjects.length > 0) {
    for (const obj of structure.multiPageObjects) {
      lines.push(`  - ${obj.type} on pages ${obj.startPage}-${obj.endPage}: ${obj.description}`);
    }
  }
  lines.push(`- **Footnote pages:** ${structure.footnotePages.join(', ') || 'none'}`);
  lines.push(`- **Appendix pages:** ${structure.appendixPages.join(', ') || 'none'}`);
  lines.push(`- **Scanned pages:** ${structure.scannedPages.join(', ') || 'none'}`);
  lines.push('');

  lines.push('## Chosen Chunk Boundaries');
  lines.push('');
  lines.push(`The primary split boundary is **${strategy.splitBoundary}**. `);
  lines.push(`Each chunk starts at a page boundary so that pages, tables, figures, and captions remain intact. `);
  lines.push(`Pages are grouped only when required to preserve a multi-page object (table, figure, or footnote). `);
  lines.push(`The maximum chunk size is ${strategy.maxChunkSize} characters; a single page is never split even if it exceeds this limit. `);
  lines.push('When a section heading or table/figure is detected, the chunk boundary is labeled accordingly for traceability. ');
  lines.push('');

  if (strategy.boundaries.length > 0) {
    lines.push('| Physical Page | Logical Page | Boundary Type | Scanned | Confidence | Image Ops | Table | Figure | Multi-Page Object | Description |');
    lines.push('|---------------|--------------|---------------|---------|------------|-----------|-------|--------|-------------------|-------------|');
    for (const boundary of strategy.boundaries) {
      const physicalRange = boundary.pageRange;
      const logicalRange = boundary.logicalPageRange ?? '—';
      const type = boundary.type;
      const scanned = boundary.isScanned ? 'yes' : 'no';
      const confidence = boundary.scanConfidence;
      const imageOps = String(boundary.imageOpCount);
      const table = boundary.hasTable ? 'yes' : 'no';
      const figure = boundary.hasFigure ? 'yes' : 'no';
      const mpo = boundary.multiPageObject ?? '—';
      const description = boundary.description;
      lines.push(`| ${physicalRange} | ${logicalRange} | ${type} | ${scanned} | ${confidence} | ${imageOps} | ${table} | ${figure} | ${mpo} | ${description} |`);
    }
    lines.push('');
  }

  lines.push('## Never-Split Rules');
  lines.push('');
  lines.push('The following content types must never be split across arbitrary byte or character offsets:');
  lines.push('');
  for (const rule of strategy.neverSplit) {
    lines.push(`- ${rule}`);
  }
  lines.push('');

  lines.push('## Chunk Size Policy');
  lines.push('');
  lines.push(`- **Maximum chunk size:** ${strategy.maxChunkSize} characters`);
  lines.push(`- **Minimum chunk size:** ${strategy.minChunkSize} characters`);
  lines.push(`- **Overlap:** ${strategy.overlap} characters`);
  lines.push(`- **Preferred chunk size:** one page per chunk, except when a multi-page object forces grouping.`);
  lines.push('');
  lines.push('Any chunk whose extracted content falls below the minimum size is flagged in its YAML frontmatter (`below_min: true`) rather than discarded.');
  lines.push('');

  lines.push('## Fallback Rule for Malformed Pages');
  lines.push('');
  lines.push(strategy.fallback);
  lines.push('');

  lines.push('## Concrete Chunk Example');
  lines.push('');
  lines.push(`- **Page range:** ${strategy.example.pageRange}`);
  if (strategy.example.logicalPageRange) {
    lines.push(`- **Logical page range:** ${strategy.example.logicalPageRange}`);
  }
  lines.push(`- **Boundary type:** ${strategy.example.type}`);
  lines.push(`- **Content description:** ${strategy.example.description}`);
  lines.push('');

  writeFileSync(filePath, lines.join('\n'));
}
