import { writeFileSync } from 'fs';
import matter from 'gray-matter';
import type { Chunk } from '../chunking/types.js';
import type { Config } from '../config.js';

export function writeDocumentPage(
  filePath: string,
  chunk: Chunk,
  config: Config,
  entityTitles: string[] = [],
  topicTitles: string[] = [],
): void {
  const confidence = deriveConfidence(chunk);
  const source = chunk.sources[0];
  const sourceFileName = source?.file ? pathBasename(source.file) : '';
  const sourceTitle = sourceFileName ? `Source: ${sourceFileName}` : '';
  const indexTitle = `${config.wiki.title} Index`;

  const frontmatter = {
    title: chunk.title,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    type: 'document',
    wiki: config.wiki.slug,
    tags: chunk.tags,
    confidence,
    below_min: chunk.belowMin,
    char_count: chunk.charCount,
    boundary_type: chunk.boundaryType,
    sources: chunk.sources.map((source) => ({
      id: source.id,
      file: source.file,
      pages: source.pages,
      extracted: source.extracted,
    })),
  };

  const sourceCitations: string[] = chunk.sources.map((source) => {
    return `- [^${source.id}]: ${source.file}, pages ${source.pages}`;
  });

  const wikilinks: string[] = [indexTitle];
  if (sourceTitle) {
    wikilinks.push(sourceTitle);
  }

  // Add resolved entity/topic links whose content appears in the chunk.
  const contentLower = chunk.content.toLowerCase();
  for (const title of entityTitles.sort((a, b) => b.length - a.length)) {
    const name = title.replace(/^Entity: /, '').toLowerCase();
    if (contentLower.includes(name)) {
      wikilinks.push(title);
    }
  }
  for (const title of topicTitles.sort((a, b) => b.length - a.length)) {
    const name = title.replace(/^Topic: /, '').toLowerCase();
    if (contentLower.includes(name)) {
      wikilinks.push(title);
    }
  }

  const bodyLines = [
    `# ${chunk.title}`,
    '',
    `**Page range:** ${chunk.pageRange}`,
    `**Boundary type:** ${chunk.boundaryType}`,
    '',
    chunk.content,
    '',
    '## Citations',
    '',
    ...sourceCitations,
    '',
    '## Related',
    '',
    ...wikilinks.map((link) => `- [[${link}]]`),
  ];

  const content = matter.stringify(bodyLines.join('\n'), frontmatter);
  writeFileSync(filePath, content);
}

function deriveConfidence(chunk: Chunk): 'high' | 'medium' | 'low' {
  if (chunk.belowMin) return 'low';
  if (chunk.boundaryType === 'section' || chunk.boundaryType === 'page') return 'high';
  return 'medium';
}

function pathBasename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}
