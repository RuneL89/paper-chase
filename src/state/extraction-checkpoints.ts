import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ExtractorResult } from '../agents/extractor';
import { validateExtractorResult } from '../validation/extractor-schema';

/**
 * Phase 28 (vision `04` §1 Fine-grained crash resume rider, user-ratified
 * 2026-09-07): per-chunk extraction checkpoints. Every extraction JSON
 * (`state/extracted/<chunk-id>.json`) carries an additive OPTIONAL
 * `_provenance` envelope as its first key — the source PDF's sha256, the
 * chunk's page range, the source file, and the extraction timestamp — so the
 * file is a self-contained checkpoint: one atomic write per chunk, and a
 * retried worker can decide WITHOUT an LLM call whether the stored extraction
 * is still valid data for the current PDF.
 *
 * A valid on-disk extraction is DATA, not skipped work: the guard below is the
 * ONE helper behind both the check and the skip (they can never drift). Any
 * failure — unparseable JSON, absent envelope (legacy pre-Phase-28 files),
 * envelope mismatch, or a deterministic schema-validation failure — returns
 * null and the chunk is conservatively re-extracted. Data is never skipped.
 */
export interface ExtractionProvenance {
  /** SHA-256 of the source PDF the chunk was extracted from. */
  sha256: string;
  /** The chunk's page range, e.g. "1-5". */
  pages: string;
  /** The source file path recorded on the document page. */
  sourceFile: string;
  /** ISO 8601 timestamp of the extraction. */
  extractedAt: string;
}

/** The `_provenance` envelope key written first into every extraction JSON. */
export const PROVENANCE_KEY = '_provenance';

/**
 * Read `.state/extracted/<chunkId>.json` and return the stored extraction —
 * envelope included, the shape the Materializer also reads — ONLY when it is
 * a valid checkpoint for `expect`:
 *
 * 1. the file parses as a JSON object;
 * 2. it carries a `_provenance` envelope whose `sha256` === `expect.sha256`
 *    AND `pages` === `expect.pages`;
 * 3. the existing deterministic Extractor validator
 *    (`validateExtractorResult(parsed, expect.pages)` — the reask loop's own
 *    validator, no LLM) passes.
 *
 * ANY failure → null (re-extract). ENOENT → null; every other I/O error
 * propagates (the ingestion-state house style — a real I/O problem must be
 * loud, not silently recomputed).
 */
export async function readValidExtraction(
  wikiDir: string,
  chunkId: string,
  expect: { sha256: string; pages: string },
): Promise<ExtractorResult | null> {
  const path = join(wikiDir, '.state', 'extracted', `${chunkId}.json`);
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null; // corrupt JSON — conservative re-extract, never a throw.
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  // Legacy envelope-less files (pre-Phase-28) fail conservatively.
  const envelope = (parsed as Record<string, unknown>)[PROVENANCE_KEY];
  if (typeof envelope !== 'object' || envelope === null || Array.isArray(envelope)) {
    return null;
  }
  const provenance = envelope as Record<string, unknown>;
  if (provenance.sha256 !== expect.sha256 || provenance.pages !== expect.pages) {
    return null;
  }

  // The validator ignores the unknown `_provenance` root key (the `tables`
  // additive-optional-field precedent).
  if (!validateExtractorResult(parsed, expect.pages).valid) {
    return null;
  }

  return parsed as ExtractorResult;
}

/**
 * Phase 28 (§2.1 changed-PDF stale cleanup): read a stored extraction JSON's
 * envelope sha256, tolerating ANY failure (absent file, corrupt JSON, missing
 * envelope) — the caller deletes on anything but an exact match, so the
 * conservative default is "no envelope".
 */
export async function readExtractionProvenanceSha256(
  wikiDir: string,
  chunkId: string,
): Promise<string | null> {
  const path = join(wikiDir, '.state', 'extracted', `${chunkId}.json`);
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const envelope = parsed[PROVENANCE_KEY];
    if (typeof envelope !== 'object' || envelope === null) {
      return null;
    }
    const sha = (envelope as Record<string, unknown>).sha256;
    return typeof sha === 'string' ? sha : null;
  } catch {
    return null;
  }
}
