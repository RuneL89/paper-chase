/**
 * Phase 16 v1.0.5 (2026-08-23, user-ratified): the JSON CORRECTOR — a small
 * LLM diagnostician that turns a raw JSON parse failure into a targeted
 * correction instruction for the failing agent's next attempt.
 *
 * Why: the generic Phase 12 correction block ("your output failed validation,
 * correct the listed violations") cannot teach a model WHAT broke when the
 * failure is structural — a raw control character inside a string literal, a
 * truncated unclosed object at the 32768-token ceiling, a trailing comma. The
 * 2026-08-22 rkkp-dhhd run died exactly this way (DHHD_2024 part-023: two
 * token-cap truncations then a "Bad control character in string literal" on
 * the final attempt, reasks exhausted, ingest aborted). The corrector reads
 * the parse error plus a bounded excerpt of the failing output and writes the
 * fix instruction ("remove raw control characters inside string values and
 * escape them as \n/\t …"), which `runWithFeedbackRetry` appends to the
 * correction block as a `Diagnosed cause and fix:` section.
 *
 * Contracts:
 * - ADVISORY ONLY. Any corrector-side failure (transport, 4xx, empty answer)
 *   returns null and the loop falls back to the plain correction block — the
 *   corrector can never break the pipeline it is trying to repair.
 * - Bounded evidence: the failing output is echoed to the corrector as a
 *   ±800-char window around the parse error's byte position when the error
 *   names one, as head+tail excerpts when the output was large, and in full
 *   only when it is small — the diagnosis call stays cheap regardless of how
 *   big the failing output was.
 * - Routing: `callType: 'json-corrector'` resolves through the additive
 *   `jsonCorrector` routing slot, falling back to the Default slot for legacy
 *   configs (see `resolveSlotFromRouting` in `llm/client.ts`).
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { callLLM } from './client';
import { appRoot } from '../utils/app-root';

export interface JsonDiagnosisRequest {
  /** The raw model output that failed JSON.parse (post fence-stripping). */
  rawResponse: string;
  /** The parse error message (e.g. "Bad control character in string literal in JSON at position 7292"). */
  errorMessage: string;
  /**
   * True when the provider's stop reason says the output hit the token
   * ceiling (see `isTruncationFinishReason`) — the corrector then instructs
   * the model to SHORTEN free-text fields while keeping every item, so the
   * complete JSON object fits.
   */
  truncated?: boolean;
  /** Log context base (e.g. the chunk id); the call logs as `<context>#json-diagnosis`. */
  context?: string;
  logPath?: string;
}

/** The corrector writes short instructions — a small ceiling is plenty. */
const CORRECTOR_MAX_TOKENS = 2048;
/** Advisory calls get one retry only — never stall the pipeline for a diagnosis. */
const CORRECTOR_MAX_RETRIES = 1;
/** Evidence window around a named error position (chars each side). */
const POSITION_WINDOW_CHARS = 800;
/** Head/tail excerpt size for large outputs without a named position. */
const HEAD_TAIL_CHARS = 1500;
/** Outputs at or below this size are echoed to the corrector in full. */
const FULL_ECHO_LIMIT_CHARS = 4000;
/** Tail size kept when a truncated output is echoed into the correction block. */
const TRUNCATED_ECHO_TAIL_CHARS = 4000;

/**
 * True when a provider stop reason means the output hit the token ceiling:
 * OpenAI-compatible 'length', Anthropic 'max_tokens'.
 */
export function isTruncationFinishReason(reason: string | undefined): boolean {
  return reason === 'length' || reason === 'max_tokens';
}

/** The char position named by a JSON.parse error ("... in JSON at position 7292"), or null. */
function errorPosition(errorMessage: string): number | null {
  const match = /position (\d+)/.exec(errorMessage);
  if (match === null) {
    return null;
  }
  const position = Number(match[1]);
  return Number.isInteger(position) && position >= 0 ? position : null;
}

/**
 * Build the bounded evidence excerpt handed to the corrector. Small outputs
 * are echoed whole; an output whose error names a position is echoed as a
 * window around that position; any other large output is echoed head+tail.
 * Exported for tests.
 */
export function buildDiagnosisEvidence(rawResponse: string, errorMessage: string): string {
  if (rawResponse.length <= FULL_ECHO_LIMIT_CHARS) {
    return rawResponse;
  }
  const position = errorPosition(errorMessage);
  if (position !== null) {
    const start = Math.max(0, position - POSITION_WINDOW_CHARS);
    const end = Math.min(rawResponse.length, position + POSITION_WINDOW_CHARS);
    const before = start > 0 ? `[... ${start} characters omitted before ...]\n` : '';
    const after =
      end < rawResponse.length
        ? `\n[... ${rawResponse.length - end} characters omitted after ...]`
        : '';
    return `${before}${rawResponse.slice(start, end)}${after}`;
  }
  const omitted = rawResponse.length - HEAD_TAIL_CHARS * 2;
  return `${rawResponse.slice(0, HEAD_TAIL_CHARS)}\n[... ${omitted} characters omitted ...]\n${rawResponse.slice(rawResponse.length - HEAD_TAIL_CHARS)}`;
}

/**
 * The echo of the invalid output inside the correction block when the output
 * was TRUNCATED at the token ceiling: repeating a 32k-token partial document
 * would push the repair call toward the same ceiling, so only the tail (where
 * the cut happened) is kept. Exported for tests.
 */
export function truncatedOutputEcho(rawResponse: string): string {
  if (rawResponse.length <= TRUNCATED_ECHO_TAIL_CHARS) {
    return rawResponse;
  }
  const omitted = rawResponse.length - TRUNCATED_ECHO_TAIL_CHARS;
  return `[... truncated output — ${omitted} characters omitted; the TAIL where the cut happened follows ...]\n${rawResponse.slice(rawResponse.length - TRUNCATED_ECHO_TAIL_CHARS)}`;
}

let promptTemplateCache: string | null = null;

/** Read prompts/json-corrector.prompt.txt (cached; resolved via appRoot). */
async function loadCorrectorPrompt(): Promise<string> {
  if (promptTemplateCache !== null) {
    return promptTemplateCache;
  }
  promptTemplateCache = await readFile(join(appRoot(), 'prompts', 'json-corrector.prompt.txt'), 'utf-8');
  return promptTemplateCache;
}

/** Fill `{single-brace}` slots (the house convention). */
function fillPromptSlots(template: string, values: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.split(`{${key}}`).join(value);
  }
  return result;
}

const TRUNCATION_NOTE =
  'NOTE: the provider reported that this response stopped at the output-token limit (it is TRUNCATED). Your instruction must address that first: tell the model to shorten its free-text fields (contexts, summaries, evidence wording) while keeping every item, so the complete JSON object fits.';

/**
 * Diagnose one JSON parse failure with an LLM and return the targeted
 * correction instruction for the failing agent's next attempt. Returns null
 * when the corrector itself cannot answer (any thrown error, empty output) —
 * the caller then falls back to the plain correction block.
 */
export async function diagnoseJsonParseFailure(
  request: JsonDiagnosisRequest,
): Promise<string | null> {
  try {
    const template = await loadCorrectorPrompt();
    const prompt = fillPromptSlots(template, {
      truncationNote: request.truncated === true ? TRUNCATION_NOTE : '',
      errorMessage: request.errorMessage,
      outputEvidence: buildDiagnosisEvidence(request.rawResponse, request.errorMessage),
    });
    const diagnosis = await callLLM(prompt, undefined, {
      maxTokens: CORRECTOR_MAX_TOKENS,
      maxRetries: CORRECTOR_MAX_RETRIES,
      temperature: 0,
      callType: 'json-corrector',
      context: `${request.context ?? 'json'}#json-diagnosis`,
      logPath: request.logPath,
    });
    const trimmed = diagnosis.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}
