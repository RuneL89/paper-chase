import { existsSync } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';
import { extractText, getPageCount } from '../extraction/pdf';
import { renderTablesAsMarkdown } from '../extraction/markdown-tables';
import { sha256 } from '../utils/hash';
import { sourceSlugForFile } from '../utils/slug';
import { sourcePdfPath, wikiDir, wikiRelativePath } from '../utils/paths';
import { readIngestionState, writeIngestionState } from '../state/ingestion-state';
import { writeSourcePage } from '../pages/source-page';

export interface IngestOptions {
  /** Workspace directory containing wikis/; defaults to '.'. */
  workspace?: string;
  /** Pages per document-page chunk; defaults to 5. A page is never split. */
  pagesPerChunk?: number;
  /** Progress callback (CLI prints these lines; the TUI renders them). */
  onProgress?: (message: string) => void;
}

export interface IngestedSource {
  source: string;
  file: string;
  pageCount: number;
  documentPages: string[];
  warnings: string[];
  tablesFound: number;
}

export interface IngestResult {
  wiki: string;
  wikiDir: string;
  ingested: IngestedSource[];
  /** Source slugs skipped because their SHA-256 is unchanged. */
  skipped: string[];
}

const DEFAULT_PAGES_PER_CHUNK = 5;

/**
 * Ingest every PDF in `wikis/<slug>/raw/` into raw document pages
 * (phase doc §2.2, Layer 1 only — no LLM).
 *
 * For each PDF: SHA-256 hash, skip when unchanged (`.state/ingestion.json`),
 * extract text page-by-page with the frozen Phase 0 `extractText`, chunk
 * consecutive whole pages (default 5 per chunk), render detected plaintext
 * tables as markdown tables, and write `documents/<source>-part-NNN.md` with
 * YAML frontmatter (gray-matter). Then refresh the deterministic source page
 * and the ingestion state. Re-running is idempotent: unchanged PDFs are
 * skipped and changed PDFs rewrite (never duplicate) their pages.
 */
export async function ingest(slug: string, options: IngestOptions = {}): Promise<IngestResult> {
  const pagesPerChunk = options.pagesPerChunk ?? DEFAULT_PAGES_PER_CHUNK;
  if (!Number.isInteger(pagesPerChunk) || pagesPerChunk < 1) {
    throw new Error(`pagesPerChunk must be a positive integer, got ${pagesPerChunk}.`);
  }

  const dir = wikiDir(options.workspace, slug);
  if (!existsSync(dir)) {
    throw new Error(`Wiki '${slug}' not found at ${dir}. Run 'init ${slug}' first.`);
  }
  const rawDir = join(dir, 'raw');
  if (!existsSync(rawDir)) {
    throw new Error(`Wiki '${slug}' has no raw/ directory. Run 'init ${slug}' to repair it.`);
  }

  const progress = options.onProgress ?? (() => {});
  const pdfFiles = (await readdir(rawDir))
    .filter((file) => file.toLowerCase().endsWith('.pdf'))
    .sort();

  const result: IngestResult = { wiki: slug, wikiDir: dir, ingested: [], skipped: [] };

  if (pdfFiles.length === 0) {
    progress(`No PDFs found in wikis/${slug}/raw/.`);
    return result;
  }

  const state = await readIngestionState(dir);
  const now = new Date().toISOString();

  for (const fileName of pdfFiles) {
    const pdfPath = join(rawDir, fileName);
    const sourceSlug = sourceSlugForFile(fileName);
    const hash = await sha256(pdfPath);
    const existing = state.sources[sourceSlug];

    if (existing && existing.hash === hash) {
      progress(`Skipping ${fileName} (unchanged)`);
      result.skipped.push(sourceSlug);
      continue;
    }

    progress(`Extracting text from ${fileName}...`);
    const pageCount = await getPageCount(pdfPath);
    const pageTexts: string[] = [];
    const warnings: string[] = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const pageText = await extractText(pdfPath, pageNumber, pageNumber);
      if (pageText.trim().length === 0) {
        warnings.push(`Page ${pageNumber} extracted to empty text`);
      }
      pageTexts.push(pageText);
    }

    const chunkCount = Math.max(1, Math.ceil(pageCount / pagesPerChunk));

    // Re-ingesting a changed PDF: remove its previous document pages first so
    // a shorter PDF never leaves stale part-NNN files behind (idempotency).
    for (const oldPage of existing?.documentPages ?? []) {
      await rm(join(dir, oldPage), { force: true });
    }

    const documentPages: string[] = [];
    let tablesFound = 0;
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
      const startPage = chunkIndex * pagesPerChunk + 1;
      const endPage = Math.min((chunkIndex + 1) * pagesPerChunk, pageCount);
      progress(`Chunk ${chunkIndex + 1}/${chunkCount} (pages ${startPage}-${endPage})`);

      const rawChunkText = pageTexts.slice(startPage - 1, endPage).join('\n');
      const rendered = renderTablesAsMarkdown(rawChunkText);
      tablesFound += rendered.tablesFound;

      const part = String(chunkIndex + 1).padStart(3, '0');
      const docFileName = `${sourceSlug}-part-${part}.md`;
      const frontmatter = {
        title: `${sourceSlug}-part-${part}`,
        type: 'document',
        wiki: slug,
        sources: [
          {
            file: sourcePdfPath(slug, fileName),
            pages: `${startPage}-${endPage}`,
            extracted: now,
            sha256: hash,
          },
        ],
        updated: now,
      };
      const body = `\n## Extracted Text: Pages ${startPage}-${endPage}\n\n${rendered.text}\n`;

      await mkdir(join(dir, 'documents'), { recursive: true });
      await writeFile(join(dir, 'documents', docFileName), matter.stringify(body, frontmatter), 'utf-8');
      documentPages.push(wikiRelativePath('documents', docFileName));
    }

    await writeSourcePage(dir, {
      wiki: slug,
      fileName,
      filePath: sourcePdfPath(slug, fileName),
      sourceSlug,
      sha256: hash,
      pageCount,
      ingested: existing?.ingestedAt ?? now,
      updated: now,
      warnings,
      documentPages,
    });

    state.sources[sourceSlug] = { hash, documentPages, ingestedAt: now };
    progress(`Ingested ${fileName} -> ${documentPages.length} document page(s)`);
    result.ingested.push({
      source: sourceSlug,
      file: fileName,
      pageCount,
      documentPages,
      warnings,
      tablesFound,
    });
  }

  await writeIngestionState(dir, state);
  progress('Done!');
  return result;
}
