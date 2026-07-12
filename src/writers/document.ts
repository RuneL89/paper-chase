import { writeFileSync } from 'fs';
import matter from 'gray-matter';
import { CLIError } from '../errors.js';
import { readCreatedTimestamp, humanizeLabel } from './preservation.js';
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
  // Ensure required deterministic fields are present even if the LLM omitted them.
  frontmatter.title = frontmatter.title ?? chunk.title;
  frontmatter.type = 'document';
  frontmatter.wiki = config.wiki.slug;
  frontmatter.tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : chunk.tags;
  frontmatter.confidence = frontmatter.confidence ?? deriveConfidence(chunk);
  frontmatter.below_min = chunk.belowMin;
  frontmatter.char_count = chunk.charCount;
  frontmatter.boundary_type = chunk.boundaryType;
  frontmatter.sources = Array.isArray(frontmatter.sources) && frontmatter.sources.length > 0
    ? frontmatter.sources
    : chunk.sources.map((source) => ({
        id: source.id,
        file: source.file,
        pages: source.pages,
        extracted: source.extracted,
        label: humanizeLabel(pathBasename(source.file)),
      }));

  return { frontmatter, body: llmContent.body };
}

function deriveConfidence(chunk: Chunk): 'high' | 'medium' | 'low' {
  if (chunk.belowMin) return 'low';
  if (chunk.boundaryType === 'section' || chunk.boundaryType === 'page') return 'high';
  return 'medium';
}

function pathBasename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}
