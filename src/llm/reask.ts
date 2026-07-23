/**
 * Phase 12 (feedback-retry / "reask" amendment, user-ratified 2026-07-23;
 * vision `04` §6 four-class retry policy, `07` §5 + §2.1/§2.2): ONE shared
 * loop for every content-defect retry in the pipeline.
 *
 * The four failure classes after the amendment:
 *   - Deterministic failures (HTTP 4xx) — NEVER retried. `callLLM` throws
 *     them and this helper lets every exception from `runLlm` propagate
 *     immediately; the loop is never entered for them.
 *   - Content-defect failures (invalid Extractor JSON, schema violations) and
 *     quality failures (preservation drops, unparseable/section-missing
 *     DOX/workspace/updater output) — retried HERE with the validator's exact
 *     error list fed back as a correction block, up to 3 total attempts.
 *   - Transient transport failures (429/5xx/network) — retried inside
 *     `callLLM` with backoff (unchanged; the helper composes above it).
 *
 * Attempt 1 always calls `runLlm(null)` so every site's first prompt is
 * byte-identical to its pre-Phase-12 prompt. On a validation failure the
 * `onRepair` hook fires (repair-rate accounting, vision `04` §6) and the next
 * attempt receives the composed correction block (the invalid output + the
 * validator's exact errors + the correct-only-the-violations instruction).
 * Exhaustion returns `{ output: null }` — the caller's existing fail-loud
 * (Extractor abort) or deterministic-fallback path handles it unchanged.
 *
 * Repair accounting: a module-level per-run counter accumulates every
 * scheduled repair across all five call sites. `ingest()` resets it with
 * `beginReaskRun()` at run start and reads it with `reaskRepairs()` for
 * `metrics.feedbackRepairs` and the prompt-quality warning.
 */

export interface ReaskResult<T> {
  /** The first output that passed validation; null only on exhaustion. */
  output: T | null;
  /** Total attempts made (1..maxAttempts). */
  attempts: number;
  /** Validator errors from the final failed attempt ([] on success). */
  lastErrors: string[];
}

export interface ReaskOptions {
  /** Total attempts including the first; defaults to 3 (vision `04` §6). */
  maxAttempts?: number;
  /** Human label for logs/warnings (e.g. the chunk id or page slug). */
  label: string;
  /** Fired once per scheduled repair (a re-ask after a failed attempt). */
  onRepair?: (errors: string[]) => void;
}

/**
 * The correction instruction prepended to every feedback block (vision `04`
 * §6: "asked to correct only the listed violations and return the complete
 * corrected output" — full JSON for the Extractor, full page for Synthesis,
 * full contract for DOX/workspace, full constitution for the Updater).
 */
export const REASK_CORRECTION_INSTRUCTION =
  'Your previous output failed deterministic validation. Correct ONLY the listed violations and return the complete corrected output.';

/**
 * Compose the feedback block handed to `runLlm` on attempts 2+: a clearly
 * delimited section carrying the correction instruction, the validator's
 * exact error list, and the invalid output verbatim. The site appends this
 * block to its normal prompt; the base prompt itself is unchanged.
 */
export function buildCorrectionBlock(invalidOutput: string, errors: string[]): string {
  const errorLines = errors.map((error) => `- ${error}`).join('\n');
  return [
    '=== CORRECTION REQUIRED ===',
    REASK_CORRECTION_INSTRUCTION,
    '',
    'Validation errors:',
    errorLines,
    '',
    'Your previous output:',
    invalidOutput,
    '=== END CORRECTION ===',
  ].join('\n');
}

/** Stringify a failed attempt's output for the correction block. */
function stringifyInvalidOutput(output: unknown): string {
  return typeof output === 'string' ? output : JSON.stringify(output, null, 2);
}

// ---------------------------------------------------------------------------
// Per-run repair accounting (vision `04` §6 repair-rate warning). Module-level
// by design: the five call sites are threaded through ingest() at very
// different depths, and a run-scoped counter that ingest resets/reads keeps
// the accounting exact without changing any of their signatures.
// ---------------------------------------------------------------------------

let repairsThisRun = 0;

/** Reset the per-run feedback-repair counter (called by `ingest()` at run start). */
export function beginReaskRun(): void {
  repairsThisRun = 0;
}

/** The number of validator-feedback repairs scheduled since `beginReaskRun()`. */
export function reaskRepairs(): number {
  return repairsThisRun;
}

/**
 * Run `runLlm` through the feedback-retry loop.
 *
 * Attempt 1 calls `runLlm(null)`; after a validation failure the next attempt
 * calls `runLlm(feedback)` with the composed correction block. `runLlm` also
 * receives the 1-based attempt number as an optional second argument so call
 * sites can number their log contexts (`<context>#attempt<N>`); closures that
 * only declare `(feedback)` remain valid.
 *
 * Exceptions from `runLlm` (HTTP 4xx, exhausted transient retries, any thrown
 * error) PROPAGATE immediately — the helper never catches, retries, or
 * swallows them (vision `04` §6: 4xx is never retried; transient retry lives
 * inside `callLLM`).
 */
export async function runWithFeedbackRetry<T>(
  runLlm: (feedback: string | null, attempt: number) => Promise<T>,
  validate: (output: T) => { valid: boolean; errors: string[] },
  options: ReaskOptions,
): Promise<ReaskResult<T>> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  let attempts = 0;
  let lastErrors: string[] = [];
  let feedback: string | null = null;

  while (attempts < maxAttempts) {
    attempts++;
    const output = await runLlm(feedback, attempts);
    const validation = validate(output);
    if (validation.valid) {
      return { output, attempts, lastErrors: [] };
    }
    lastErrors = validation.errors;
    if (attempts < maxAttempts) {
      repairsThisRun++;
      options.onRepair?.(validation.errors);
      feedback = buildCorrectionBlock(stringifyInvalidOutput(output), validation.errors);
    }
  }

  return { output: null, attempts, lastErrors };
}
