import { writeFileSync, readFileSync, existsSync } from 'fs';
import matter from 'gray-matter';
import type { Config } from '../config.js';
import type { PdfStructure } from '../chunking/types.js';
import type { SamplingStrategy } from '../chunking/types.js';
import type { FolderPlan, OrchestratorMemory } from '../orchestrator/types.js';
import type { LLMClient } from '../llm/client.js';
import { readCreatedTimestamp } from './preservation.js';

export interface AgentsMdContext {
  slug: string;
  title: string;
  description: string;
  structure: PdfStructure;
  samplingStrategy: SamplingStrategy;
  folderPlacements?: FolderPlan[];
  memory?: OrchestratorMemory;
}

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

export async function writeAgentsMd(
  filePath: string,
  context: AgentsMdContext,
  llmClient?: LLMClient,
): Promise<void> {
  let body = renderAgentsMdBody(context);

  if (llmClient?.isEnabled()) {
    try {
      const prompt = buildAgentsMdPrompt(context);
      const response = await llmClient.call(prompt);
      if (response.text && response.text.trim().length > 0) {
        body = sanitizeAgentsMdBody(response.text, context);
      }
    } catch {
      // Keep deterministic fallback on LLM error.
    }
  }

  const created = readCreatedTimestamp(filePath) ?? new Date().toISOString();
  const frontmatter = {
    title: `AGENTS.md — ${context.title}`,
    type: 'agents-guide',
    wiki: context.slug,
    created,
    updated: new Date().toISOString(),
  };

  writeFileSync(filePath, matter.stringify(body, frontmatter));
}

export function updateAgentsMd(
  filePath: string,
  context: Pick<AgentsMdContext, 'slug' | 'title' | 'description' | 'samplingStrategy' | 'folderPlacements' | 'memory'>,
): void {
  if (!existsSync(filePath)) {
    return;
  }
  const existing = readFileSync(filePath, 'utf-8');
  const parsed = matter(existing);
  parsed.data.updated = new Date().toISOString();
  parsed.data.title = `AGENTS.md — ${context.title}`;
  parsed.data.wiki = context.slug;

  let body = String(parsed.content);
  body = updateSamplingSection(body, context.samplingStrategy);
  if (context.folderPlacements && context.folderPlacements.length > 0) {
    body = updateFolderStructureSection(body, context.folderPlacements);
  }

  writeFileSync(filePath, matter.stringify(body, parsed.data));
}

function buildAgentsMdPrompt(context: AgentsMdContext): string {
  const folderList = context.folderPlacements
    ? context.folderPlacements.map((f) => `- ${f.folder}: ${f.description}`).join('\n')
    : '- documents/\n- sources/\n- entities/\n- topics/\n- raw/';

  const entityNames = context.memory
    ? Object.keys(context.memory.state.entities).slice(0, 20).join(', ')
    : 'none yet';

  const topicNames = context.memory
    ? Object.keys(context.memory.state.topics).slice(0, 20).join(', ')
    : 'none yet';

  return [
    'You are an expert wiki architect. Write a comprehensive AGENTS.md ingestion guide for the following wiki.',
    `Wiki slug: ${context.slug}`,
    `Wiki title: ${context.title}`,
    `Wiki description: ${context.description}`,
    `PDF structure: ${context.structure.summary}`,
    `Sampling strategy: ${context.samplingStrategy.category}`,
    `Sampling reason: ${context.samplingStrategy.reason}`,
    '',
    'Discovered folders:',
    folderList,
    '',
    'Sample entities:',
    entityNames,
    '',
    'Sample topics:',
    topicNames,
    '',
    'Write the markdown body (no YAML frontmatter) with these exact sections:',
    '## Purpose and Scope',
    '## Folder Structure',
    '## Page Types',
    '## Naming Conventions',
    '## Citation Rules',
    '## Content Rules',
    '## Special Instructions',
    '## Workflows',
    '## Lint / Quality Rules',
    '## Authority Matrix',
    '',
    'Tailor the content to the corpus. Be concise but specific. Do not include a top-level title; the frontmatter will be added by the caller.',
  ].join('\n');
}

function sanitizeAgentsMdBody(text: string, context: AgentsMdContext): string {
  // Strip any leading YAML frontmatter the LLM may have emitted.
  const withoutFrontmatter = text.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
  const body = withoutFrontmatter.trim();
  if (body.length === 0) {
    return renderAgentsMdBody(context);
  }
  return body;
}

function renderAgentsMdBody(context: AgentsMdContext): string {
  const lines: string[] = [];

  lines.push('This file is the LLM ingestion guide for the wiki.');
  lines.push('It defines the page schema, naming conventions, citation rules, and workflows.');
  lines.push('It is generated during `init` and refined during `sample` and `ingest`.');
  lines.push('');

  lines.push('## Purpose and Scope');
  lines.push('');
  lines.push(context.description || `This wiki collects and synthesizes source documents for "${context.title}".`);
  lines.push('');

  lines.push('## Folder Structure');
  lines.push('');
  if (context.folderPlacements && context.folderPlacements.length > 0) {
    for (const folder of context.folderPlacements) {
      lines.push(`- \`${folder.folder}/\` — ${folder.description}`);
    }
  } else {
    lines.push('- `raw/` — source PDFs.');
    lines.push('- `documents/` — document chunk pages.');
    lines.push('- `sources/` — source provenance pages.');
    lines.push('- `entities/` — entity pages (people, organizations, locations, products, etc.).');
    lines.push('- `topics/` — topic pages (recurring themes and concepts).');
    lines.push('- `raw/` — unparseable or scanned fragments.');
  }
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

  lines.push('## Naming Conventions');
  lines.push('');
  lines.push(`- Wiki folder: \`wikis/${context.slug}\``);
  lines.push(`- Source PDFs: \`wikis/${context.slug}/raw/<pdf-slug>.pdf\``);
  lines.push(`- Source pages: \`sources/<pdf-slug>.md\``);
  lines.push(`- Document pages: \`documents/<pdf-slug>-part-NNN.md\``);
  lines.push(`- Topic pages: \`topics/<topic-slug>.md\``);
  lines.push(`- Entity pages: \`entities/<entity-slug>.md\``);
  lines.push(`- Raw pages: \`raw/<pdf-slug>-page-NNN.md\``);
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

  lines.push('## Special Instructions');
  lines.push('');
  lines.push(`- Detected sampling strategy: **${context.samplingStrategy.category}**.`);
  lines.push(`- ${context.samplingStrategy.reason}`);
  if (context.samplingStrategy.tocSearch?.enabled) {
    lines.push(`- For large documents, search the first ${context.samplingStrategy.tocSearch.firstPages} pages for a table of contents and use it for folder planning if found.`);
  }
  if (context.samplingStrategy.readFirstFully) {
    lines.push('- Read the first document fully during sampling to establish the corpus structure.');
  }
  if (context.samplingStrategy.sampleRemaining) {
    lines.push('- During sampling, read a subset of pages from each remaining document to confirm the structure applies broadly.');
  }
  if (context.samplingStrategy.deferRestToIngest) {
    lines.push('- After the first document is sampled, process the remaining documents with the normal `ingest` command.');
  }
  if (context.structure.tables.length > 0) {
    lines.push('- Tables are preserved as markdown tables when the extraction engine can detect them.');
  }
  if (context.structure.figures.length > 0) {
    lines.push('- Figures are described in structured text when image extraction is not available.');
  }
  if (context.structure.scannedPages.length > 0) {
    lines.push('- Scanned pages are preserved as `raw` pages; OCR may be enabled in config.json.');
  }
  lines.push('');

  lines.push('## Workflows');
  lines.push('');
  lines.push('1. `init` creates the wiki folder and the initial ingestion guide.');
  lines.push('2. `sample` analyzes the corpus using the detected sampling strategy, produces the folder structure, and refines this guide.');
  lines.push('3. `ingest` processes every PDF in `raw/` and generates or updates pages, re-reading this guide at the start of each chunk.');
  lines.push('4. `status` reports source counts, generated pages, and lint warnings.');
  lines.push('');

  lines.push('## Lint / Quality Rules');
  lines.push('');
  lines.push('- YAML frontmatter must be valid and include all required fields for the page type.');
  lines.push('- Every `[^srcN]` citation in the body must map to a `sources` frontmatter entry.');
  lines.push('- Broken wikilinks are flagged in `lint/report.json`.');
  lines.push('- Scanned or unparseable pages become `raw` pages with a reason.');
  lines.push('- Before finishing a chunk, run the Critic: check for missing citations, broken links, and incomplete tables.');
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

  return lines.join('\n');
}

function updateSamplingSection(body: string, strategy: SamplingStrategy): string {
  const sectionRegex = /(## Special Instructions\n\n)([\s\S]*?)(?=\n## |$)/;
  const newSpecial = [
    '## Special Instructions',
    '',
    `- Detected sampling strategy: **${strategy.category}**.`,
    `- ${strategy.reason}`,
  ];
  if (strategy.tocSearch?.enabled) {
    newSpecial.push(`- For large documents, search the first ${strategy.tocSearch.firstPages} pages for a table of contents and use it for folder planning if found.`);
  }
  if (strategy.readFirstFully) {
    newSpecial.push('- Read the first document fully during sampling to establish the corpus structure.');
  }
  if (strategy.sampleRemaining) {
    newSpecial.push('- During sampling, read a subset of pages from each remaining document to confirm the structure applies broadly.');
  }
  if (strategy.deferRestToIngest) {
    newSpecial.push('- After the first document is sampled, process the remaining documents with the normal `ingest` command.');
  }
  newSpecial.push('');

  if (sectionRegex.test(body)) {
    return body.replace(sectionRegex, newSpecial.join('\n') + '\n');
  }
  return body + '\n' + newSpecial.join('\n');
}

function updateFolderStructureSection(body: string, folders: FolderPlan[]): string {
  const folderLines = folders.map((f) => `- \`${f.folder}/\` — ${f.description}`).join('\n');
  const newSection = ['## Folder Structure', '', folderLines, '', 'Additional folders may be proposed by the PagePlanner during sampling or ingestion.', 'New folders require a structural-change proposal and human approval.', ''];
  const sectionRegex = /(## Folder Structure\n\n)([\s\S]*?)(?=\n## |$)/;
  if (sectionRegex.test(body)) {
    return body.replace(sectionRegex, newSection.join('\n') + '\n');
  }
  return newSection.join('\n') + '\n' + body;
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
