import { writeFileSync } from 'fs';
import type { Config } from '../config.js';
import type { PdfStructure } from '../chunking/types.js';

export function writeSkeletonAgentsMd(
  filePath: string,
  config: Config,
): void {
  const lines: string[] = [];

  const frontmatter = {
    title: `AGENTS.md — ${config.wiki.title}`,
    type: 'agents-guide',
    wiki: config.wiki.slug,
    updated: new Date().toISOString(),
  };

  lines.push('---');
  lines.push(`title: "${frontmatter.title}"`);
  lines.push(`type: "${frontmatter.type}"`);
  lines.push(`wiki: "${frontmatter.wiki}"`);
  lines.push(`updated: "${frontmatter.updated}"`);
  lines.push('---');
  lines.push('');

  lines.push(`# AGENTS.md — ${config.wiki.title}`);
  lines.push('');
  lines.push('This file is the LLM ingestion guide for the wiki.');
  lines.push('It defines the page schema, naming conventions, citation rules, and workflows.');
  lines.push('It is generated during `init` and refined during `sample` and `ingest`.');
  lines.push('');

  lines.push('## Purpose and Scope');
  lines.push('');
  lines.push(config.wiki.description || `This wiki collects and synthesizes source documents for "${config.wiki.title}".`);
  lines.push('');

  lines.push('## Folder Structure');
  lines.push('');
  lines.push('The wiki uses the following default folders:');
  lines.push('');
  lines.push('- `raw/` — source PDFs.');
  lines.push('- `documents/` — document chunk pages.');
  lines.push('- `sources/` — source provenance pages.');
  lines.push('- `entities/` — entity pages (people, organizations, locations, products, etc.).');
  lines.push('- `topics/` — topic pages (recurring themes and concepts).');
  lines.push('- `raw/` — unparseable or scanned fragments.');
  lines.push('');
  lines.push('Additional folders may be proposed by the PagePlanner during sampling or ingestion.');
  lines.push('New folders require a structural-change proposal and human approval.');
  lines.push('');

  lines.push('## Page Types');
  lines.push('');
  lines.push('This wiki uses the following default page types:');
  lines.push('');
  lines.push('| Type | Purpose | Required frontmatter |');
  lines.push('|------|---------|----------------------|');
  lines.push('| `index` | Wiki-level or folder-level contract | `title`, `type`, `updated`, `wiki` |');
  lines.push('| `document` | A chunk or full PDF page | `title`, `type`, `tags`, `sources`, `confidence` |');
  lines.push('| `source` | Catalog page for one raw PDF | `title`, `type`, `file`, `ingested`, `warnings` |');
  lines.push('| `topic` | Recurring theme or concept | `title`, `type`, `tags`, `related` |');
  lines.push('| `entity` | Person, organization, product, or location | `title`, `type`, `tags`, `mentions` |');
  lines.push('| `raw` | Failed or malformed extraction fragment | `title`, `type`, `source`, `reason`, `raw_fragment` |');
  lines.push('');
  lines.push('New page types may be introduced inside existing folders without a structural proposal.');
  lines.push('');

  lines.push('## Citation Rules');
  lines.push('');
  lines.push('Document pages use inline footnote citations of the form `[^srcN]`.');
  lines.push('Each `[^srcN]` maps to a `sources` entry in the YAML frontmatter containing:');
  lines.push('');
  lines.push('- `file`: relative path to the source PDF from the workspace root');
  lines.push('- `pages`: logical page range (e.g., `1-12` or `7`)');
  lines.push('- `extracted`: ISO 8601 timestamp of the extraction run');
  lines.push('');
  lines.push('Multi-source claims cite all relevant sources: `[^src1] [^src2]`.');
  lines.push('Table captions include a citation (`Source: [^src1]`).');
  lines.push('Claims from scanned pages are either omitted or marked as needing verification.');
  lines.push('');

  lines.push('## Content Rules');
  lines.push('');
  lines.push('- The LLM writes all markdown content; deterministic code only extracts, validates, and orchestrates.');
  lines.push('- No extracted page, table, figure, or named entity may be silently dropped.');
  lines.push('- Preserve extracted text, tables, and figure descriptions in the document body.');
  lines.push('- Place LLM-written synthesis at the top of document pages, followed by preserved detail.');
  lines.push('- Use wikilinks (`[[Page Title]]`) to connect related pages.');
  lines.push('');

  lines.push('## Workflows');
  lines.push('');
  lines.push('1. `init` creates the wiki folder and this skeleton guide.');
  lines.push('2. `sample` analyzes a representative PDF and populates the chunking strategy and initial folder structure.');
  lines.push('3. `ingest` processes every PDF in `raw/` and generates or updates pages.');
  lines.push('4. `status` reports source counts, generated pages, and lint warnings.');
  lines.push('');

  lines.push('## Lint / Quality Rules');
  lines.push('');
  lines.push('- YAML frontmatter must be valid and include all required fields for the page type.');
  lines.push('- Every `[^srcN]` citation in the body must map to a `sources` frontmatter entry.');
  lines.push('- Broken wikilinks are flagged in `lint/report.json`.');
  lines.push('- Scanned or unparseable pages become `raw` pages with a reason.');
  lines.push('');

  lines.push('## Authority Matrix');
  lines.push('');
  lines.push('| Role | Authority |');
  lines.push('|------|-----------|');
  lines.push('| User (human) | High-level purpose, PDF curation, structural approval, when to run commands. |');
  lines.push('| LLM Orchestrator | Folder structure, page content, entities, links, citations, new page types. |');
  lines.push('| Local deterministic code | Extraction, hashing, validation, orchestration, file I/O. |');
  lines.push('| Critic | Whether LLM output is good enough to commit. |');
  lines.push('');
  lines.push('No deterministic code may draft or mutate markdown bodies; no LLM agent may compute hashes or manage file I/O directly.');
  lines.push('');

  writeFileSync(filePath, lines.join('\n'));
}

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
  lines.push('- Source pages: `sources/<pdf-slug>.md`');
  lines.push('- Document pages: `documents/<pdf-slug>-part-NNN.md`');
  lines.push('- Topic pages: `topics/<topic-slug>.md`');
  lines.push('- Entity pages: `entities/<entity-slug>.md`');
  lines.push('- Raw pages: `raw/<pdf-slug>-page-NNN.md`');
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
