import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * `.state/metrics.json` — Phase 8 (phase doc §5.1): a deterministic,
 * human-readable summary of what changed in the LAST ingest run. Written by
 * `ingest` at the end of every run; read by the TUI compounding-log screen
 * together with `.state/conflicts.json`.
 *
 * Shape:
 * ```json
 * {
 *   "run": "2026-07-16T14:30:00.000Z",
 *   "newPdfs": ["golden-master-2.pdf"],
 *   "newEntities": [{"slug": "jane-doe", "title": "Jane Doe", "folder": "entities/people/executives"}],
 *   "updatedEntities": [{"slug": "john-smith", "title": "John Smith", "addedMentions": 2}],
 *   "conflicts": 0,
 *   "totalCost": 0.03
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
 * Sum the cost of the LLM calls logged to `.state/llm-calls.json` (JSON
 * lines, one entry per call) at or after `sinceIso`. Best-effort: a missing
 * or partially malformed log yields the sum of the parseable entries. Note
 * the log covers the calls that pass a `logPath` (synthesis, DOX Writer,
 * workspace pass); the Extractor does not log per-call cost.
 */
export async function sumLlmCostSince(wikiDir: string, sinceIso: string): Promise<number> {
  let raw: string;
  try {
    raw = await readFile(join(wikiDir, '.state', 'llm-calls.json'), 'utf-8');
  } catch {
    return 0;
  }
  let total = 0;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') {
      continue;
    }
    try {
      const entry = JSON.parse(trimmed) as { timestamp?: unknown; cost?: unknown };
      if (typeof entry.timestamp === 'string' && entry.timestamp >= sinceIso && typeof entry.cost === 'number') {
        total += entry.cost;
      }
    } catch {
      // Skip malformed lines; never let logging data break an ingest.
    }
  }
  return total;
}
