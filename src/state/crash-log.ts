import { mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { enqueueSerializedWrite } from '../utils/serialized-writes';

/**
 * Phase 27 (vision `04` §1 Worker-process isolation amendment,
 * user-ratified 2026-09-02): the worker-crash audit log —
 * `.state/crash-log.jsonl`, ONE JSON line per worker death AND per
 * auto-retry attempt, so a months-long run's crash history is auditable
 * after the fact (the 2026-09-02 rkkp post-mortem had NO crash evidence —
 * the console window closed and stderr evaporated).
 *
 * ```json
 * {
 *   "timestamp": "2026-09-02T18:55:00.000Z",
 *   "pdf": "CPOP_2025.pdf",
 *   "phase": "pdf",
 *   "exitCode": 1,
 *   "stderrTail": "Error: ...",
 *   "attempt": 2,
 *   "autoRetried": true
 * }
 * ```
 *
 * `phase` is `'pdf'` (a per-PDF worker) or `'finalize'` (the deferred-tail
 * worker). `attempt` is the 1-based attempt number that died;
 * `autoRetried` records whether the conductor launched another attempt
 * automatically (the 3-retry cap) as opposed to stopping for the user.
 * Appends funnel through the Phase 15 serialized write queue (the
 * conflicts.ts precedent) so nothing ever interleaves.
 */

/** The most stderr lines kept in a crash record (bounded by design). */
export const CRASH_LOG_STDERR_TAIL_LINES = 25;

export interface CrashLogRecord {
  timestamp: string;
  /** The PDF file name for a per-PDF worker; null for the finalize worker. */
  pdf: string | null;
  phase: 'pdf' | 'finalize';
  exitCode: number | null;
  /** Last lines of the worker's captured stderr (bounded above; '' when none). */
  stderrTail: string;
  /** 1-based attempt number that died (1 = first try, 2..4 = auto-retries). */
  attempt: number;
  /** True when the conductor automatically launched another attempt. */
  autoRetried: boolean;
}

export function crashLogPath(wikiDir: string): string {
  return join(wikiDir, '.state', 'crash-log.jsonl');
}

/** Keep only the last N lines of a captured stderr buffer (never unbounded). */
export function tailLines(text: string, maxLines: number): string {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  return lines.slice(Math.max(0, lines.length - maxLines)).join('\n');
}

/** Append one crash record (serialized queue; mkdir on demand). */
export async function appendCrashLogRecord(wikiDir: string, record: CrashLogRecord): Promise<void> {
  const path = crashLogPath(wikiDir);
  await enqueueSerializedWrite(path, async () => {
    await mkdir(join(wikiDir, '.state'), { recursive: true });
    await appendFile(path, `${JSON.stringify(record)}\n`, 'utf-8');
  });
}
