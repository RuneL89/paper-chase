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

/**
 * Phase 16 v1.0.5 (2026-08-23, user-ratified): a validator may be ASYNC — the
 * JSON-corrector wiring diagnoses a parse failure with an LLM call from inside
 * the validator/enhancer pair. Sync validators remain valid.
 */
export type ReaskValidation = { valid: boolean; errors: string[] };

/**
 * Phase 16 v1.0.5: optional enrichment of the correction block. `guidance`
 * lands as a `Diagnosed cause and fix:` section between the error list and
 * the echoed output; `echoOverride` replaces the verbatim echo (e.g. a
 * tail-only excerpt when the invalid output was truncated at the token
 * ceiling and echoing it whole would push the repair call toward the same
 * ceiling).
 */
export interface FeedbackEnhancement {
  guidance?: string | null;
  echoOverride?: string | null;
}

export interface ReaskOptions {
  /** Total attempts including the first; defaults to 3 (vision `04` §6). */
  maxAttempts?: number;
  /** Human label for logs/warnings (e.g. the chunk id or page slug). */
  label: string;
  /** Fired once per scheduled repair (a re-ask after a failed attempt). */
  onRepair?: (errors: string[]) => void;
  /**
   * Phase 16 v1.0.5: optional async hook fired after a validation failure,
   * BEFORE the correction block is composed. Receives the failed output, the
   * validator's errors, and the 1-based number of the attempt that failed.
   * A thrown error is swallowed (enhancement is advisory — it can never break
   * the loop).
   */
  feedbackEnhancer?: (
    output: unknown,
    errors: string[],
    attempt: number,
  ) => Promise<FeedbackEnhancement | null>;
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
 * block to its normal prompt; the base prompt itself is unchanged. Phase 16
 * v1.0.5: an optional enhancement inserts a `Diagnosed cause and fix:`
 * section after the error list and may replace the echoed output.
 */
export function buildCorrectionBlock(
  invalidOutput: string,
  errors: string[],
  enhancement?: FeedbackEnhancement | null,
): string {
  const errorLines = errors.map((error) => `- ${error}`).join('\n');
  const lines = [
    '=== CORRECTION REQUIRED ===',
    REASK_CORRECTION_INSTRUCTION,
    '',
    'Validation errors:',
    errorLines,
  ];
  const guidance = enhancement?.guidance?.trim();
  if (guidance) {
    lines.push('', 'Diagnosed cause and fix:', guidance);
  }
  lines.push(
    '',
    'Your previous output:',
    enhancement?.echoOverride ?? invalidOutput,
    '=== END CORRECTION ===',
  );
  return lines.join('\n');
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
  validate: (output: T) => ReaskValidation | Promise<ReaskValidation>,
  options: ReaskOptions,
): Promise<ReaskResult<T>> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  let attempts = 0;
  let lastErrors: string[] = [];
  let feedback: string | null = null;

  while (attempts < maxAttempts) {
    attempts++;
    const output = await runLlm(feedback, attempts);
    const validation = await validate(output);
    if (validation.valid) {
      return { output, attempts, lastErrors: [] };
    }
    lastErrors = validation.errors;
    if (attempts < maxAttempts) {
      repairsThisRun++;
      options.onRepair?.(validation.errors);
      // Phase 16 v1.0.5: the optional enhancer (e.g. the JSON corrector) may
      // attach a targeted diagnosis to the correction block; a throwing
      // enhancer is advisory-only and never breaks the loop.
      let enhancement: FeedbackEnhancement | null = null;
      if (options.feedbackEnhancer) {
        try {
          enhancement = await options.feedbackEnhancer(output, validation.errors, attempts);
        } catch {
          enhancement = null;
        }
      }
      feedback = buildCorrectionBlock(stringifyInvalidOutput(output), validation.errors, enhancement);
    }
  }

  return { output: null, attempts, lastErrors };
}
