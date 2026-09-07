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

/** Phase 28 (§2.4): the worker's per-call LLM cost lines — filtered OUT of the tail before the last-N cut. */
const LLM_COST_LINE_PATTERN = /^LLM Call \| /;

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
  /**
   * Phase 28 (§2.4, vision `04` §1 rider 2026-09-07): the fatal EVENT's
   * error message — the caught exception the worker reported on stdout.
   * Absent when the worker died without a terminal event (hard crash).
   */
  fatalError?: string;
  /** Phase 28 (§2.4): the fatal event's stack trace, when the worker sent one. */
  fatalStack?: string;
}

export function crashLogPath(wikiDir: string): string {
  return join(wikiDir, '.state', 'crash-log.jsonl');
}

/**
 * Keep only the last N lines of a captured stderr buffer (never unbounded).
 * Phase 28 (§2.4): `LLM Call | Tokens … | Cost …` cost lines are filtered OUT
 * BEFORE the last-N cut — with the cost noise gone, the 25-line budget holds
 * real signal (the 2026-09-04/05 production records' tails were pure cost
 * lines and the crash causes stayed undiagnosed).
 */
export function tailLines(text: string, maxLines: number): string {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .filter((line) => !LLM_COST_LINE_PATTERN.test(line));
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
