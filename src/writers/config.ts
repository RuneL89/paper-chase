import type { Config } from '../config.js';
import { saveConfig } from '../config.js';
import type { PdfStructure, ChunkingStrategy } from '../chunking/types.js';

export function writeWikiConfig(
  workspace: string,
  slug: string,
  config: Config,
  structure: PdfStructure,
  strategy: ChunkingStrategy,
): void {
  const wikiConfig: Config = {
    ...config,
    wiki: {
      ...config.wiki,
      slug,
      title: config.wiki.title || slugToTitle(slug),
      description: config.wiki.description || `Wiki for ${slug}`,
    },
    chunking: {
      ...config.chunking,
      max_chunk_size: strategy.maxChunkSize,
      min_chunk_size: strategy.minChunkSize,
      split_boundary: strategy.splitBoundary,
      never_split: strategy.neverSplit,
      overlap: strategy.overlap,
    },
    extraction: {
      ...config.extraction,
      ocr_enabled: structure.scannedPages.length > 0 ? true : config.extraction.ocr_enabled,
    },
    output: {
      ...config.output,
      page_types: ['index', 'source', 'document', 'topic', 'entity', 'raw'],
    },
    status: 'ready',
  };

  saveConfig(workspace, slug, wikiConfig);
}

function slugToTitle(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
