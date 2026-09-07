import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { enqueueSerializedWrite } from '../utils/serialized-writes';
import { sha256 } from '../utils/hash';
import type { MaterializeResult } from '../materializer';

/**
 * Phase 28 (vision `04` §1 Fine-grained crash resume rider, user-ratified
 * 2026-09-07): `.state/pdf-progress.json` — the per-PDF stage markers for the
 * IN-FLIGHT PDF of a crashed worker. One entry per source slug:
 *
 * ```json
 * {
 *   "report-2025": {
 *     "hash": "<pdf sha256>",
 *     "chunksExtracted": 7,
 *     "totalChunks": 7,
 *     "extractedSetHash": "<sha256 over .state/extracted/*.json>",
 *     "stages": {
 *       "extraction": true,
 *       "materialize": true,
 *       "curation": true,
 *       "synthesis": { "stage": "topics", "done": ["entities/...md"], "queue": ["topics/...md"] }
 *     },
 *     "updatedAt": "2026-09-07T09:00:00.000Z"
 *   }
 * }
 * ```
 *
 * In-run scaffolding ONLY: the per-PDF `ingestion.json` record (vision `04`
 * Step 11) and the per-page `synthesis-state.json` records (Step 9) remain
 * THE durable skip law; the entry is REMOVED the moment its PDF's own
 * checkpoint lands (the record makes it redundant). All writes funnel through
 * the Phase 15 serialized write queue (the recordSynthesisPage house
 * pattern).
 */

/** The synthesis journal's stage cursor — the four stages in run order, then done. */
export type SynthesisJournalStage = 'entities' | 'topics' | 'composites' | 'comparisons' | 'done';

/**
 * Phase 28 (§2.3): the in-flight synthesis journal — an EXPLICIT cursor over
 * the PDF's synthesis stages. OBSERVER ONLY: it records what `partitionStage`
 * already computed and what the per-page records already checkpointed; it
 * must never force a skip the records contradict (a fingerprint-mismatched
 * page re-synthesizes despite a done-entry — the records are the law).
 */
export interface SynthesisJournal {
  stage: SynthesisJournalStage;
  /** Wiki-relative page paths completed under this journal (cumulative across attempts). */
  done: string[];
  /** The current stage's still-to-run page paths (partitionStage's toRun list). */
  queue: string[];
}

export interface PdfProgressStages {
  extraction: boolean;
  materialize: boolean;
  curation: boolean;
  /** Phase 28 (§2.3): present once this PDF's synthesis entry initialized the journal. */
  synthesis?: SynthesisJournal;
}

export interface PdfProgressEntry {
  hash: string;
  chunksExtracted: number;
  totalChunks: number;
  extractedSetHash: string;
  stages: PdfProgressStages;
  updatedAt: string;
}

export type PdfProgressState = Record<string, PdfProgressEntry>;

/** The subset of {@link PdfProgressEntry} a caller may patch (stages merge shallowly). */
export interface PdfProgressPatch {
  hash?: string;
  chunksExtracted?: number;
  totalChunks?: number;
  extractedSetHash?: string;
  stages?: Partial<PdfProgressStages>;
}

function emptyEntry(): PdfProgressEntry {
  return {
    hash: '',
    chunksExtracted: 0,
    totalChunks: 0,
    extractedSetHash: '',
    stages: { extraction: false, materialize: false, curation: false },
    updatedAt: new Date().toISOString(),
  };
}

export function pdfProgressPath(wikiDir: string): string {
  return join(wikiDir, '.state', 'pdf-progress.json');
}

/**
 * Read `.state/pdf-progress.json`. Absent file → empty state; malformed JSON
 * or wrong shape → descriptive throw (the `readIngestionState` house style).
 */
export async function readPdfProgress(wikiDir: string): Promise<PdfProgressState> {
  const path = pdfProgressPath(wikiDir);
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`PDF progress file is not valid JSON: ${path}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`PDF progress file has an unexpected shape (expected an object keyed by source slug): ${path}`);
  }
  return parsed as PdfProgressState;
}

/** Write the state with entries in sorted key order (deterministic bytes). */
async function writeSortedPdfProgress(wikiDir: string, state: PdfProgressState): Promise<string> {
  const path = pdfProgressPath(wikiDir);
  const sorted: PdfProgressState = {};
  for (const key of Object.keys(state).sort((a, b) => a.localeCompare(b))) {
    sorted[key] = state[key];
  }
  await mkdir(join(wikiDir, '.state'), { recursive: true });
  await writeFile(path, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');
  return path;
}

/**
 * Create/update one source slug's entry (read-modify-write through the
 * serialized queue). `stages` merges shallowly so a caller can set one flag
 * without clobbering the others.
 */
export async function updatePdfProgress(
  wikiDir: string,
  sourceSlug: string,
  patch: PdfProgressPatch,
): Promise<void> {
  await enqueueSerializedWrite(pdfProgressPath(wikiDir), async () => {
    const state = await readPdfProgress(wikiDir);
    const existing = state[sourceSlug] ?? emptyEntry();
    const entry: PdfProgressEntry = {
      ...existing,
      ...(patch.hash !== undefined ? { hash: patch.hash } : {}),
      ...(patch.chunksExtracted !== undefined ? { chunksExtracted: patch.chunksExtracted } : {}),
      ...(patch.totalChunks !== undefined ? { totalChunks: patch.totalChunks } : {}),
      ...(patch.extractedSetHash !== undefined ? { extractedSetHash: patch.extractedSetHash } : {}),
      ...(patch.stages !== undefined ? { stages: { ...existing.stages, ...patch.stages } } : {}),
      updatedAt: new Date().toISOString(),
    };
    if (entry.stages.synthesis === undefined) {
      delete entry.stages.synthesis;
    }
    state[sourceSlug] = entry;
    await writeSortedPdfProgress(wikiDir, state);
  });
}

/**
 * Remove one source slug's entry (and its materialize-restore cache file).
 * When the last entry is gone the state file itself is DELETED — the file is
 * in-run scaffolding, and a healthy run must leave the exact pre-Phase-28
 * `.state` tree behind (byte-identity law).
 */
export async function removePdfProgressEntry(wikiDir: string, sourceSlug: string): Promise<void> {
  const path = pdfProgressPath(wikiDir);
  await enqueueSerializedWrite(path, async () => {
    let state: PdfProgressState;
    try {
      state = await readPdfProgress(wikiDir);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw err;
    }
    if (!(sourceSlug in state)) {
      return;
    }
    delete state[sourceSlug];
    if (Object.keys(state).length === 0) {
      await rm(path, { force: true });
    } else {
      await writeSortedPdfProgress(wikiDir, state);
    }
  });
  await rm(materializeCachePath(wikiDir, sourceSlug), { force: true });
  // Phase 28 (§2.1 first-run identity, gate 28.3): a healthy run must leave
  // the exact pre-Phase-28 `.state` tree behind — drop the cache DIRECTORY
  // too when this PDF's cache was its last content (non-recursive rm refuses
  // directories on this runtime — ERR_FS_EISDIR — so the emptiness check
  // gates a safe recursive removal; a non-empty dir means another PDF's
  // cache still lives there and stays).
  try {
    const cacheDir = join(wikiDir, '.state', 'pdf-progress');
    const remaining = await readdir(cacheDir);
    if (remaining.length === 0) {
      await rm(cacheDir, { recursive: true, force: true });
    }
  } catch {
    // absent already, or raced away — best-effort scaffolding cleanup.
  }
}

/**
 * Phase 28 (§2.2): `extractedSetHash` — sha256 over the sorted list of every
 * `.state/extracted/*.json` (basename + per-file sha256, one line each). This
 * is materialize's actual input: an unchanged set means the crashed attempt's
 * materialize output is still valid for this PDF; any change re-runs it.
 */
export async function computeExtractedSetHash(wikiDir: string): Promise<string> {
  const extractedDir = join(wikiDir, '.state', 'extracted');
  let files: string[];
  try {
    files = (await readdir(extractedDir))
      .filter((name) => name.toLowerCase().endsWith('.json'))
      .sort((a, b) => a.localeCompare(b));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      files = [];
    } else {
      throw err;
    }
  }
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(`${file}:${await sha256(join(extractedDir, file))}\n`);
  }
  return hash.digest('hex');
}

// ---------------------------------------------------------------------------
// Materialize-restore cache (Phase 28 §2.2, implementation companion).
//
// A materialize SKIP must still hand the synthesis stages their page
// aggregates — `runSynthesisStages` consumes `MaterializeResult`
// (entityPages/topicPages/compositePages/comparisonPages, the curation
// summary). The crashed attempt's full result is therefore cached beside the
// progress entry when `stages.materialize` is recorded, and restored on the
// skip path — restoring EXACTLY the aggregates the deterministic materialize
// computed from the pinned (extractedSetHash-matching) input set. The cache
// file is written BEFORE the entry records the marker, so a crash between the
// two degrades to a conservative re-materialize, never a bogus restore.
// ---------------------------------------------------------------------------

export function materializeCachePath(wikiDir: string, sourceSlug: string): string {
  return join(wikiDir, '.state', 'pdf-progress', `${sourceSlug}.json`);
}

/** Cache the crashed-attempt materialize result for a later skip-restore. */
export async function saveMaterializeCache(
  wikiDir: string,
  sourceSlug: string,
  result: MaterializeResult,
): Promise<void> {
  const path = materializeCachePath(wikiDir, sourceSlug);
  await enqueueSerializedWrite(path, async () => {
    await mkdir(join(wikiDir, '.state', 'pdf-progress'), { recursive: true });
    await writeFile(path, JSON.stringify(result, null, 2) + '\n', 'utf-8');
  });
}

/** Load the cached materialize result; null when absent or corrupt (forces a real materialize). */
export async function loadMaterializeCache(
  wikiDir: string,
  sourceSlug: string,
): Promise<MaterializeResult | null> {
  const path = materializeCachePath(wikiDir, sourceSlug);
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
  try {
    const parsed = JSON.parse(raw) as MaterializeResult;
    if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.entityPages)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Synthesis journal operations (Phase 28 §2.3). Best-effort BY DESIGN: the
// journal is the cursor/OBSERVER — the per-page synthesis records are the
// durable law — so a journal write failure must never break a synthesis run
// (it degrades to a stale cursor, never to a skipped or doubled page).
// ---------------------------------------------------------------------------

/**
 * One in-queue journal mutation (the read AND the write live inside the same
 * serialized task so concurrent pool-page appends can never interleave).
 * No-ops when the entry is absent — the journal never creates scaffolding the
 * per-PDF loop did not already set up.
 */
async function mutateSynthesisJournal(
  wikiDir: string,
  sourceSlug: string,
  mutate: (journal: SynthesisJournal) => SynthesisJournal,
): Promise<void> {
  await enqueueSerializedWrite(pdfProgressPath(wikiDir), async () => {
    const state = await readPdfProgress(wikiDir);
    const entry = state[sourceSlug];
    if (entry === undefined) {
      return; // no in-flight entry (e.g. the entry already checkpointed away).
    }
    const existing = entry.stages.synthesis ?? { stage: 'entities' as SynthesisJournalStage, done: [], queue: [] };
    entry.stages.synthesis = mutate(existing);
    entry.updatedAt = new Date().toISOString();
    await writeSortedPdfProgress(wikiDir, state);
  });
}

/** Begin a stage under the journal: set the cursor + this stage's toRun queue, keep `done` (a resume continues the crashed attempt's cumulative list). */
export async function beginSynthesisJournalStage(
  wikiDir: string,
  sourceSlug: string,
  stage: SynthesisJournalStage,
  queue: string[],
): Promise<void> {
  try {
    await mutateSynthesisJournal(wikiDir, sourceSlug, (journal) => ({
      stage,
      done: journal.done,
      queue,
    }));
  } catch (err) {
    console.warn(`Warning: could not update the synthesis journal for ${sourceSlug}: ${(err as Error).message}`);
  }
}

/** Append one completed page path to the journal (deduped; called AFTER the page's record write). */
export async function appendSynthesisJournalDone(
  wikiDir: string,
  sourceSlug: string,
  pagePath: string,
): Promise<void> {
  try {
    await mutateSynthesisJournal(wikiDir, sourceSlug, (journal) => ({
      stage: journal.stage,
      done: journal.done.includes(pagePath) ? journal.done : [...journal.done, pagePath],
      queue: journal.queue.filter((path) => path !== pagePath),
    }));
  } catch (err) {
    console.warn(`Warning: could not update the synthesis journal for ${sourceSlug}: ${(err as Error).message}`);
  }
}

/** Close the journal: stage 'done', empty queue (the PDF's checkpoint removes the entry next). */
export async function completeSynthesisJournal(wikiDir: string, sourceSlug: string): Promise<void> {
  try {
    await mutateSynthesisJournal(wikiDir, sourceSlug, (journal) => ({
      stage: 'done',
      done: journal.done,
      queue: [],
    }));
  } catch (err) {
    console.warn(`Warning: could not close the synthesis journal for ${sourceSlug}: ${(err as Error).message}`);
  }
}
