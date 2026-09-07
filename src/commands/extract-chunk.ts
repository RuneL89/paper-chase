import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';
import { extractChunk, type ExtractorResult } from '../agents/extractor';
import { readRollingMemory } from '../state/rolling-memory';
import type { ExtractionProvenance } from '../state/extraction-checkpoints';
import type { LanguageCode } from '../utils/language';

/**
 * Run the Extractor (Layer 2) on one document-page chunk already written by
 * Layer 1, and persist the structured JSON (phase doc §2.3; vision `04` §3.2
 * Step 5 output location `.state/extracted/<chunk-id>.json`).
 *
 * Shared by `ingest` (after writing each chunk) and the TUI Test Extractor
 * screen so both paths behave identically: the chunk text, page range, and
 * source file come from the document page itself, AGENTS.md is the wiki
 * constitution, and rolling memory is read (never written) here.
 */

export interface ChunkExtraction {
  chunkId: string;
  result: ExtractorResult;
  /** Absolute path of the written `.state/extracted/<chunk-id>.json`. */
  jsonPath: string;
  /** Wiki-relative path (forward slashes) for display. */
  jsonRelativePath: string;
}

/**
 * @param wikiDir  Absolute path of the wiki (contains documents/, AGENTS.md).
 * @param chunkId  Document page filename without `.md` (e.g. "golden-master-part-001").
 * @param language Phase 7: the run's input/output languages (default { en, en }).
 */
export async function extractDocumentChunk(
  wikiDir: string,
  chunkId: string,
  language?: { input: LanguageCode; output: LanguageCode },
): Promise<ChunkExtraction> {
  const documentPath = join(wikiDir, 'documents', `${chunkId}.md`);
  let rawPage: string;
  try {
    rawPage = await readFile(documentPath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Document chunk not found: ${documentPath}`);
    }
    throw err;
  }

  const parsed = matter(rawPage);
  const firstSource = Array.isArray(parsed.data.sources) ? (parsed.data.sources[0] as Record<string, unknown>) : undefined;
  const pageRange = typeof firstSource?.pages === 'string' ? firstSource.pages : '';
  const sourceFile = typeof firstSource?.file === 'string' ? firstSource.file : `documents/${chunkId}.md`;
  // Phase 28 (§2.1): the document page's frontmatter also carries the source
  // PDF's sha256 (written by the Layer 1 pass) — the provenance anchor of the
  // per-chunk checkpoint envelope below.
  const sourceSha256 = typeof firstSource?.sha256 === 'string' ? firstSource.sha256 : '';

  let agentsMd: string;
  try {
    agentsMd = await readFile(join(wikiDir, 'AGENTS.md'), 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Wiki constitution not found: ${join(wikiDir, 'AGENTS.md')}. Run 'init' to repair the wiki.`);
    }
    throw err;
  }

  const memory = await readRollingMemory(wikiDir);
  const result = await extractChunk(
    parsed.content.trim(),
    pageRange,
    sourceFile,
    agentsMd,
    memory.folders,
    memory.entitySlugs,
    { logPath: join(wikiDir, '.state', 'llm-calls.json'), context: chunkId, language },
  );

  const extractedDir = join(wikiDir, '.state', 'extracted');
  await mkdir(extractedDir, { recursive: true });
  const jsonPath = join(extractedDir, `${chunkId}.json`);
  // Phase 28 (vision `04` §1 Fine-grained crash resume rider, 2026-09-07):
  // persist the extraction with its `_provenance` envelope as the JSON's
  // FIRST key — source PDF sha256 + page range + source file + timestamp.
  // The envelope makes the file a self-contained per-chunk checkpoint: a
  // retried worker can validate it deterministically (no LLM) and skip the
  // Extractor call for this chunk. The Materializer and the schema validator
  // ignore the unknown root key (the `tables` additive-optional-field
  // precedent); `ChunkExtraction.result` stays the bare ExtractorResult.
  const provenance: ExtractionProvenance = {
    sha256: sourceSha256,
    pages: pageRange,
    sourceFile,
    extractedAt: new Date().toISOString(),
  };
  await writeFile(
    jsonPath,
    JSON.stringify({ _provenance: provenance, ...result }, null, 2) + '\n',
    'utf-8',
  );

  return {
    chunkId,
    result,
    jsonPath,
    jsonRelativePath: `.state/extracted/${chunkId}.json`,
  };
}
