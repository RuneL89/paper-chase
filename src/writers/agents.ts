import { writeFileSync } from 'fs';
import type { PdfStructure } from '../chunking/types.js';

export function writeAgentsMd(
  filePath: string,
  slug: string,
  structure: PdfStructure,
): void {
  const lines: string[] = [];

  lines.push(`# AGENTS.md — ${slug}`);
  lines.push('');
  lines.push('This file defines the page schema, naming conventions, and citation rules for this wiki. ');
  lines.push('It is generated during sample ingestion and may be edited later to reflect wiki-specific conventions.');
  lines.push('');

  lines.push('## Page Types');
  lines.push('');
  lines.push('This wiki uses the following page types:');
  lines.push('');
  lines.push('| Type | Purpose | Required frontmatter | Optional frontmatter |');
  lines.push('|------|---------|----------------------|----------------------|');
  lines.push('| `index` | Wiki-level roadmap | `title`, `type`, `updated`, `wiki`, `sources` | `created`, `confidence` |');
  lines.push('| `document` | A chunk or full PDF page | `title`, `type`, `tags`, `sources`, `confidence` | `created`, `updated`, `wiki`, `below_min`, `char_count`, `boundary_type` |');
  lines.push('| `source` | Catalog page for one raw PDF | `title`, `type`, `file`, `ingested`, `warnings` | `created`, `updated`, `wiki`, `confidence`, `sha256`, `metadata`, `size_bytes`, `logical_pages`, `physical_pages` |');
  lines.push('| `topic` | A recurring theme or concept | `title`, `type`, `tags`, `related` | `created`, `updated`, `wiki`, `sources`, `confidence` |');
  lines.push('| `entity` | A person, organization, product, or location | `title`, `type`, `tags`, `mentions` | `created`, `updated`, `wiki`, `sources`, `confidence` |');
  lines.push('| `raw` | Failed or malformed extraction fragment | `title`, `type`, `source`, `reason`, `raw_fragment` | `created`, `updated`, `pages`, `confidence`, `extracted` |');
  lines.push('');

  lines.push('## Tag Taxonomy');
  lines.push('');
  lines.push('Common tags for this wiki:');
  lines.push('');
  const tags = collectTags(structure);
  for (const tag of tags) {
    lines.push(`- ${tag}`);
  }
  lines.push('');

  lines.push('## Naming Conventions');
  lines.push('');
  lines.push('- Wiki folder: `wikis/' + slug + '`');
  lines.push('- Source PDFs: `wikis/' + slug + '/raw/<pdf-slug>.pdf`');
  lines.push('- Source pages: `output/sources/<pdf-slug>.md`');
  lines.push('- Document pages: `output/documents/<pdf-slug>-part-NNN.md`');
  lines.push('- Topic pages: `output/topics/<topic-slug>.md`');
  lines.push('- Entity pages: `output/entities/<entity-slug>.md`');
  lines.push('- Raw pages: `output/raw/<pdf-slug>-page-NNN.md`');
  lines.push('');

  lines.push('## Citation Format');
  lines.push('');
  lines.push('Document pages use inline footnote citations of the form `[^srcN]`. ');
  lines.push('Each `[^srcN]` maps to a `sources` entry in the YAML frontmatter containing:');
  lines.push('');
  lines.push('- `file`: relative path to the source PDF from the workspace root');
  lines.push('- `pages`: logical page range (e.g., `1-12` or `7`)');
  lines.push('- `extracted`: ISO 8601 timestamp of the extraction run');
  lines.push('');
  lines.push('Example:');
  lines.push('');
  lines.push('```yaml');
  lines.push('sources:');
  lines.push('  - id: src1');
  lines.push('    file: wikis/' + slug + '/raw/sample.pdf');
  lines.push('    pages: 1-5');
  lines.push('    extracted: 2026-07-04T12:00:00Z');
  lines.push('```');
  lines.push('');

  lines.push('## Malformed / Unparseable Pages');
  lines.push('');
  lines.push('When a page cannot be parsed cleanly, the system writes a `raw` page with:');
  lines.push('');
  lines.push('- `type: raw`');
  lines.push('- `source`: path to the originating PDF');
  lines.push('- `pages`: affected page number(s)');
  lines.push('- `reason`: human-readable reason for the failure');
  lines.push('- `confidence: low`');
  lines.push('- The original fragment preserved as text or an image reference');
  lines.push('');
  lines.push('The failure is surfaced in the wiki-level index and the source page.');
  lines.push('');

  lines.push('## Wiki-Specific Conventions');
  lines.push('');
  if (structure.tables.length > 0) {
    lines.push('- Tables are preserved as markdown tables when the extraction engine can detect them.');
  }
  if (structure.figures.length > 0) {
    lines.push('- Figures are described in structured text when image extraction is not available.');
  }
  if (structure.scannedPages.length > 0) {
    lines.push('- Scanned pages are preserved as `raw` pages; OCR may be enabled in config.json.');
  }
  lines.push('- Document pages should not summarize or omit extracted text unless the source is duplicated.');
  lines.push('');

  writeFileSync(filePath, lines.join('\n'));
}

function collectTags(structure: PdfStructure): string[] {
  const tags = new Set<string>();
  tags.add('document');
  tags.add('source');
  if (structure.hasCover) tags.add('cover');
  if (structure.hasToc) tags.add('toc');
  if (structure.tables.length > 0) tags.add('table');
  if (structure.figures.length > 0) tags.add('figure');
  if (structure.scannedPages.length > 0) tags.add('scanned');
  if (structure.appendixPages.length > 0) tags.add('appendix');
  return Array.from(tags).sort();
}
