import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * `.state/metrics.json` — Phase 8 (phase doc §5.1): a deterministic,
 * human-readable summary of what changed in the LAST ingest run. Written by
 * `ingest` at the end of every run (plus a crash-safe preliminary write
 * before the validation/DOX stages). Phase 11 (phase doc §2.6) extends the
 * shape additively with chunk/entity/relationship/claim/page/folder/
 * validation/conflict/token/wall-clock counters; the Phase 8 fields above
 * are unchanged so existing readers keep working.
 *
 * Shape:
 * ```json
 * {
 *   "run": "2026-07-16T14:30:00.000Z",
 *   "newPdfs": ["golden-master-2.pdf"],
 *   "newEntities": [{"slug": "jane-doe", "title": "Jane Doe", "folder": "entities/people/executives"}],
 *   "updatedEntities": [{"slug": "john-smith", "title": "John Smith", "addedMentions": 2}],
 *   "conflicts": 0,
 *   "totalCost": 0.03,
 *   "chunksProcessed": 3, "chunksSkipped": 0, "chunksFailed": 0,
 *   "entitiesNew": 1, "entitiesUpdated": 1,
 *   "relationshipsExtracted": 4,
 *   "claimsExtracted": 6, "claimsByType": {"financial": 6},
 *   "pagesByType": {"entity": 2, "topic": 1, "document": 3},
 *   "foldersCreated": 1,
 *   "brokenLinks": 0, "orphanedPages": 0,
 *   "conflictsManualEdit": 0, "conflictsPreservation": 0,
 *   "totalTokens": 12345,
 *   "wallClockMs": 42000,
 *   "feedbackRepairs": 0
 * }
 * ```
 */
export interface MetricsEntity {
  slug: string;
  title: string;
  folder: string;
}

export interface MetricsUpdatedEntity {
  slug: string;
  title: string;
  /** Mentions gained since the previous run (rolling-memory diff). */
  addedMentions: number;
}

export interface IngestionMetrics {
  /** ISO 8601 timestamp of the run. */
  run: string;
  /** File names of PDFs ingested for the first time in this run. */
  newPdfs: string[];
  newEntities: MetricsEntity[];
  updatedEntities: MetricsUpdatedEntity[];
  /** Conflicts logged during this run (manual edits + preservation failures). */
  conflicts: number;
  /** Total LLM cost (USD) of this run, summed from `.state/llm-calls.json`. */
  totalCost: number;
  /** Phase 11 (phase doc §2.6): document-page chunks written this run. */
  chunksProcessed: number;
  /** Phase 11: chunks not re-processed because their PDF was hash-skipped. */
  chunksSkipped: number;
  /** Phase 11: chunks whose processing failed (failures normally abort the run). */
  chunksFailed: number;
  /** Phase 11: entity counts mirroring newEntities/updatedEntities lengths. */
  entitiesNew: number;
  entitiesUpdated: number;
  /** Phase 11: relationships extracted by the Extractor this run. */
  relationshipsExtracted: number;
  /** Phase 11: claims extracted by the Extractor this run (total and by type). */
  claimsExtracted: number;
  claimsByType: Record<string, number>;
  /** Phase 11: pages created/updated this run by page type (entity/topic/document). */
  pagesByType: Record<string, number>;
  /** Phase 11: folders newly added to rolling memory this run. */
  foldersCreated: number;
  /** Phase 11: broken links / orphaned pages from the final validation pass. */
  brokenLinks: number;
  orphanedPages: number;
  /** Phase 11: this run's conflicts split by kind (from `.state/conflicts.json`). */
  conflictsManualEdit: number;
  conflictsPreservation: number;
  /** Phase 11: total LLM tokens (input + output) of this run. */
  totalTokens: number;
  /** Phase 11: wall-clock duration of the run in milliseconds. */
  wallClockMs: number;
  /**
   * Phase 12 (feedback-retry amendment, vision `04` §6): LLM calls this run
   * that were validator-feedback repairs (attempts 2+ of a reask loop, across
   * all five call sites). 0 on a clean run.
   */
  feedbackRepairs: number;
}

export function metricsPath(wikiDir: string): string {
  return join(wikiDir, '.state', 'metrics.json');
}

/** Write the run metrics, creating `.state/` if needed. */
export async function writeMetrics(wikiDir: string, metrics: IngestionMetrics): Promise<void> {
  await mkdir(join(wikiDir, '.state'), { recursive: true });
  await writeFile(metricsPath(wikiDir), JSON.stringify(metrics, null, 2) + '\n', 'utf-8');
}

/** Read the last run's metrics; null when no ingest has recorded them yet. */
export async function readMetrics(wikiDir: string): Promise<IngestionMetrics | null> {
  let raw: string;
  try {
    raw = await readFile(metricsPath(wikiDir), 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
  try {
    return JSON.parse(raw) as IngestionMetrics;
  } catch {
    return null;
  }
}

/**
 * Sum the cost and token usage of the LLM calls logged to
 * `.state/llm-calls.json` (JSON lines, one entry per call) at or after
 * `sinceIso`. Best-effort: a missing or partially malformed log yields the
 * sums of the parseable entries. Note the log covers the calls that pass a
 * `logPath` (synthesis, DOX Writer, workspace pass); the Extractor does not
 * log per-call cost.
 */
export async function sumLlmUsageSince(
  wikiDir: string,
  sinceIso: string,
): Promise<{ cost: number; inputTokens: number; outputTokens: number }> {
  let raw: string;
  try {
    raw = await readFile(join(wikiDir, '.state', 'llm-calls.json'), 'utf-8');
  } catch {
    return { cost: 0, inputTokens: 0, outputTokens: 0 };
  }
  let cost = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') {
      continue;
    }
    try {
      const entry = JSON.parse(trimmed) as {
        timestamp?: unknown;
        cost?: unknown;
        inputTokens?: unknown;
        outputTokens?: unknown;
      };
      if (typeof entry.timestamp === 'string' && entry.timestamp >= sinceIso) {
        if (typeof entry.cost === 'number') {
          cost += entry.cost;
        }
        if (typeof entry.inputTokens === 'number') {
          inputTokens += entry.inputTokens;
        }
        if (typeof entry.outputTokens === 'number') {
          outputTokens += entry.outputTokens;
        }
      }
    } catch {
      // Skip malformed lines; never let logging data break an ingest.
    }
  }
  return { cost, inputTokens, outputTokens };
}

/**
 * Sum the cost of the LLM calls logged to `.state/llm-calls.json` (JSON
 * lines, one entry per call) at or after `sinceIso`. Best-effort: a missing
 * or partially malformed log yields the sum of the parseable entries. Every
 * pipeline call passes a `logPath` in production (Extractor via
 * `extract-chunk.ts`, synthesis, DOX Writer, workspace pass), so the log
 * covers the full run.
 */
export async function sumLlmCostSince(wikiDir: string, sinceIso: string): Promise<number> {
  return (await sumLlmUsageSince(wikiDir, sinceIso)).cost;
}

/**
 * Count the LLM calls logged to `.state/llm-calls.json` (JSON lines, one
 * entry per call) at or after `sinceIso`. Best-effort: a missing or partially
 * malformed log counts only the parseable entries. Phase 12: the denominator
 * of the repair-rate warning (vision `04` §6).
 */
export async function countLlmCallsSince(wikiDir: string, sinceIso: string): Promise<number> {
  let raw: string;
  try {
    raw = await readFile(join(wikiDir, '.state', 'llm-calls.json'), 'utf-8');
  } catch {
    return 0;
  }
  let count = 0;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') {
      continue;
    }
    try {
      const entry = JSON.parse(trimmed) as { timestamp?: unknown };
      if (typeof entry.timestamp === 'string' && entry.timestamp >= sinceIso) {
        count++;
      }
    } catch {
      // Skip malformed lines; never let logging data break an ingest.
    }
  }
  return count;
}
