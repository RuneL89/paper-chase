import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';
import { extractChunk, type ExtractorResult } from '../agents/extractor';
import { readRollingMemory } from '../state/rolling-memory';

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
 */
export async function extractDocumentChunk(wikiDir: string, chunkId: string): Promise<ChunkExtraction> {
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
    { logPath: join(wikiDir, '.state', 'llm-calls.json'), context: chunkId },
  );

  const extractedDir = join(wikiDir, '.state', 'extracted');
  await mkdir(extractedDir, { recursive: true });
  const jsonPath = join(extractedDir, `${chunkId}.json`);
  await writeFile(jsonPath, JSON.stringify(result, null, 2) + '\n', 'utf-8');

  return {
    chunkId,
    result,
    jsonPath,
    jsonRelativePath: `.state/extracted/${chunkId}.json`,
  };
}
