import { writeFileSync } from 'fs';
import matter from 'gray-matter';
import { CLIError } from '../errors.js';
import { readCreatedTimestamp } from './preservation.js';
import type { Chunk } from '../chunking/types.js';
import type { Config } from '../config.js';

export interface LlmPageContent {
  frontmatter: Record<string, unknown>;
  body: string;
}

export function writeDocumentPage(
  filePath: string,
  chunk: Chunk,
  config: Config,
  llmContent?: LlmPageContent,
  _entityTitles: string[] = [],
  _topicTitles: string[] = [],
): void {
  if (!llmContent) {
    throw new CLIError('LLM content is required to write a document page.');
  }

  const content = mergeLlmContentWithChunk(llmContent, chunk, config);

  const now = new Date().toISOString();
  const created = readCreatedTimestamp(filePath) ?? (content.frontmatter.created as string | undefined) ?? now;
  content.frontmatter.created = created;
  content.frontmatter.updated = now;

  const full = matter.stringify(content.body, content.frontmatter);
  writeFileSync(filePath, full);
}

function mergeLlmContentWithChunk(
  llmContent: LlmPageContent,
  chunk: Chunk,
  config: Config,
): LlmPageContent {
  const frontmatter = { ...llmContent.frontmatter };

  // Required fields must be authored by the LLM; do not fall back to chunk values.
  if (typeof frontmatter.title !== 'string' || frontmatter.title.trim() === '') {
    throw new CLIError('LLM-authored document page missing required frontmatter field: title');
  }
  if (!Array.isArray(frontmatter.sources) || frontmatter.sources.length === 0) {
    throw new CLIError('LLM-authored document page missing required frontmatter field: sources');
  }
  if (!Array.isArray(frontmatter.tags)) {
    throw new CLIError('LLM-authored document page missing required frontmatter field: tags');
  }
  if (!['high', 'medium', 'low'].includes(String(frontmatter.confidence))) {
    throw new CLIError('LLM-authored document page missing or invalid frontmatter field: confidence');
  }

  // Deterministic fields are supplied by the orchestration layer.
  frontmatter.type = 'document';
  frontmatter.wiki = config.wiki.slug;
  frontmatter.below_min = chunk.belowMin;
  frontmatter.char_count = chunk.charCount;
  frontmatter.boundary_type = chunk.boundaryType;

  return { frontmatter, body: llmContent.body };
}
