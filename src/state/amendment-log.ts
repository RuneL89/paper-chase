import { mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { enqueueSerializedWrite } from '../utils/serialized-writes';

/**
 * Phase 26 (§2.5, vision `04` §3.2 Step 9 amendment synthesis): the amendment
 * audit log — `.state/amendment-log.jsonl`, ONE JSON line per amendment
 * EPISODE (a page's full amendment attempt within one PDF pass: the initial
 * call plus every reask), the cost evidence the phase was built for:
 *
 * ```json
 * {
 *   "timestamp": "2026-08-27T12:00:00.000Z",
 *   "page": "entities/people/alpha.md",
 *   "pdf": "report-2024.pdf",
 *   "attempts": 1,
 *   "operations": { "add-evidence": 2, "edit-prose": 1 },
 *   "outcome": "patched",
 *   "cause": null,
 *   "outputTokens": 412
 * }
 * ```
 *
 * `outcome` is `patched` (a validated merged page was written) or
 * `fallback-full-synthesis` (reask exhaustion — `cause` names the final
 * failure class; the page was re-synthesized in full). `operations` counts
 * the op TYPES that landed (empty on a fallback). `outputTokens` is
 * best-effort: read from the last matching `.state/llm-calls.json` entry for
 * the episode's `amendment:<slug>` context (never fabricated; null when the
 * log carries nothing).
 *
 * Appends funnel through the Phase 15 serialized write queue (the
 * conflicts.ts precedent) so pool workers never interleave lines.
 */

export interface AmendmentLogRecord {
  timestamp: string;
  /** Wiki-relative page path (forward slashes). */
  page: string;
  /** The PDF whose pass triggered the amendment (file name; null on the
   * post-loop fallback-materialize invocation). */
  pdf: string | null;
  /** Total LLM attempts in the episode (1..3). */
  attempts: number;
  /** Op-type counts of the patch that landed (empty on a fallback). */
  operations: Record<string, number>;
  outcome: 'patched' | 'fallback-full-synthesis';
  /** The final failure class on a fallback; null otherwise. */
  cause: string | null;
}

export function amendmentLogPath(wikiDir: string): string {
  return join(wikiDir, '.state', 'amendment-log.jsonl');
}

/** Count the operation types of a landed patch (`{ [op]: count }`). */
export function countOperations(operations: Array<{ op: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const operation of operations) {
    counts[operation.op] = (counts[operation.op] ?? 0) + 1;
  }
  return counts;
}

/**
 * Append one episode record. `readOutputTokens` is an injectable reader so
 * the caller can pass a llm-calls.json lookup (tests inject a stub); when
 * omitted the field is null (never fabricated).
 */
export async function appendAmendmentLogRecord(
  wikiDir: string,
  record: AmendmentLogRecord,
  readOutputTokens?: () => Promise<number | null>,
): Promise<void> {
  const path = amendmentLogPath(wikiDir);
  await enqueueSerializedWrite(path, async () => {
    let outputTokens: number | null = null;
    if (readOutputTokens !== undefined) {
      try {
        outputTokens = await readOutputTokens();
      } catch {
        outputTokens = null;
      }
    }
    const line = `${JSON.stringify({ ...record, outputTokens })}\n`;
    await mkdir(join(wikiDir, '.state'), { recursive: true });
    await appendFile(path, line, 'utf-8');
  });
}
