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
  lines.push(`- **Footnote pages:** ${structure.footnotePages.join(', ') || 'none'}`);
  lines.push(`- **Appendix pages:** ${structure.appendixPages.join(', ') || 'none'}`);
  lines.push(`- **Scanned pages:** ${structure.scannedPages.join(', ') || 'none'}`);
  lines.push('');

  lines.push('## Chosen Chunk Boundaries');
  lines.push('');
  lines.push(`The primary split boundary is **${strategy.splitBoundary}**. `);
  lines.push(`Chunks are built by grouping pages while respecting the maximum chunk size of ${strategy.maxChunkSize} characters. `);
  lines.push('Each chunk starts at a page boundary so that tables, figures, and captions remain intact. ');
  lines.push('When a section heading is detected, the chunk boundary may align with the heading to preserve context.');
  lines.push('');

  if (strategy.boundaries.length > 0) {
    lines.push('| Page Range | Boundary Type | Description |');
    lines.push('|------------|---------------|-------------|');
    for (const boundary of strategy.boundaries) {
      lines.push(`| ${boundary.pageRange} | ${boundary.type} | ${boundary.description} |`);
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
  lines.push(`- **Boundary type:** ${strategy.example.type}`);
  lines.push(`- **Content description:** ${strategy.example.description}`);
  lines.push('');

  writeFileSync(filePath, lines.join('\n'));
}
