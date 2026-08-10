import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { callLLM } from '../llm/client';
import { runWithFeedbackRetry } from '../llm/reask';
import { appRoot } from '../utils/app-root';
import {
  applyLanguageDirective,
  buildLanguageDirective,
  type LanguageCode,
} from '../utils/language';

/**
 * Phase 24 (phase doc §2): the shared LLM plumbing for the Cross-Wiki
 * Discovery components. One prompt loader (cached, resolved via `appRoot()`),
 * one `{single-brace}` slot filler (the house convention), one fence-tolerant
 * JSON parser, and one JSON-call-with-feedback-retry wrapper so every
 * cross-wiki call site inherits the bounded-retry/reask policy (vision `04`
 * §6: content-defect failures re-asked ≤3 total attempts with the validator's
 * exact errors fed back; thrown errors — HTTP 4xx, exhausted transient
 * retries — propagate, never quality-retried).
 *
 * Model routing (the 2026-07-23 guidance + Phase 24 explicit slots): cheap-tier
 * calls (context summaries, fuzzy match, predicate normalization, topic
 * clustering, relevance probe) use call types that fall through to the routing
 * `crossWiki` slot (Default fallback for legacy configs); mid-tier calls
 * (uncertain review, hypothesis signals) use the `cross-wiki-uncertain-review`
 * / `cross-wiki-hypothesis` call types that map to the `crossWikiJudgment` slot
 * (Synthesis fallback for legacy configs) — see `resolveModelFromRouting` in
 * `src/llm/client.ts`.
 */

export interface CrossWikiLanguage {
  input: LanguageCode;
  output: LanguageCode;
}

/** Small outputs (context summaries, relevance probe). */
export const CROSS_WIKI_SMALL_MAX_TOKENS = 2048;
/** Structured outputs (match verdicts, predicate map, clusters, signals). */
export const CROSS_WIKI_MAX_TOKENS = 8192;
/** Feedback-retry ceiling (vision `04` §6: 3 total attempts). */
export const CROSS_WIKI_MAX_ATTEMPTS = 3;

const promptCache: Record<string, string | undefined> = {};

async function loadPrompt(fileName: string): Promise<string> {
  const cached = promptCache[fileName];
  if (cached !== undefined) {
    return cached;
  }
  const template = await readFile(join(appRoot(), 'prompts', fileName), 'utf-8');
  promptCache[fileName] = template;
  return template;
}

/** Fill `{single-brace}` slots; unknown slots are left untouched (house convention). */
export function fillPromptSlots(template: string, values: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.split(`{${key}}`).join(value);
  }
  return result;
}

/**
 * Render a cross-wiki prompt: fill the slots, then apply the run's language
 * directive (the `=== LANGUAGE ===` block is removed byte-identically for
 * en/en — the Phase 7 `applyLanguageDirective` contract).
 */
export async function renderCrossWikiPrompt(
  fileName: string,
  slots: Record<string, string>,
  language?: CrossWikiLanguage,
): Promise<string> {
  const template = await loadPrompt(fileName);
  const filled = fillPromptSlots(template, slots);
  const directive = language
    ? buildLanguageDirective('cross-wiki', language.input, language.output)
    : '';
  return applyLanguageDirective(filled, directive);
}

/** Fence-tolerant JSON parse (the Extractor precedent): strips ``` fences before JSON.parse. */
export function parseJsonResponse(raw: string): unknown {
  let text = raw.trim();
  const fenceMatch = /^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n?```$/.exec(text);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }
  return JSON.parse(text);
}

export interface CrossWikiJsonCallArgs<T> {
  /** Prompt file in prompts/ (used only by the default LLM implementation). */
  promptFile: string;
  /** Slot values for the prompt template. */
  slots: Record<string, string>;
  /** Routing call type (cheap types fall to default; mid-tier types per client.ts). */
  callType: string;
  /** Log context (e.g. 'cross-wiki match cluster alpha/x+beta/y'). */
  context: string;
  maxTokens: number;
  language?: CrossWikiLanguage;
  logPath?: string;
  /** Human label for repair warnings. */
  label: string;
  /**
   * Deterministic output validation: returns the typed value when valid,
   * otherwise the exact error list fed back into the correction block.
   */
  validate: (data: unknown) => { valid: boolean; errors: string[]; value?: T };
  /**
   * Test-only injection (the `writeDoxIndexFn` precedent): replaces the LLM
   * call and returns the raw model output. Parsing and validation still run.
   */
  callLLMFn?: (feedback: string | undefined, attempt: number) => Promise<string>;
}

export interface CrossWikiJsonCallResult<T> {
  /** The validated value; null on validation exhaustion (caller's fallback applies). */
  output: T | null;
  attempts: number;
  lastErrors: string[];
}

/**
 * Run one structured cross-wiki LLM call through the feedback-retry loop.
 * Attempt 1 sends the plain filled prompt (byte-identical for stubs that
 * ignore feedback); attempts 2+ append the correction block. THROWN errors
 * propagate to the caller (each component catches ONCE and applies its
 * deterministic fallback — the cross-wiki pass never aborts an ingest).
 */
export async function runCrossWikiJsonCall<T>(args: CrossWikiJsonCallArgs<T>): Promise<CrossWikiJsonCallResult<T>> {
  const prompt = args.callLLMFn === undefined
    ? await renderCrossWikiPrompt(args.promptFile, args.slots, args.language)
    : undefined;
  const runLlm = async (feedback: string | null, attempt: number): Promise<string> => {
    if (args.callLLMFn !== undefined) {
      return args.callLLMFn(feedback ?? undefined, attempt);
    }
    const base = prompt as string;
    return callLLM(feedback === null ? base : `${base}\n\n${feedback}`, undefined, {
      maxTokens: args.maxTokens,
      maxRetries: 2,
      callType: args.callType,
      context: attempt > 1 ? `${args.context}#attempt${attempt}` : args.context,
      logPath: args.logPath,
    });
  };
  let parsedValue: T | null = null;
  const outcome = await runWithFeedbackRetry<string>(
    runLlm,
    (raw) => {
      let data: unknown;
      try {
        data = parseJsonResponse(raw);
      } catch (err) {
        return { valid: false, errors: [`Invalid JSON: ${(err as Error).message}`] };
      }
      const validation = args.validate(data);
      if (validation.valid) {
        parsedValue = validation.value ?? null;
        return { valid: true, errors: [] };
      }
      return { valid: false, errors: validation.errors };
    },
    { maxAttempts: CROSS_WIKI_MAX_ATTEMPTS, label: args.label },
  );
  return { output: parsedValue, attempts: outcome.attempts, lastErrors: outcome.lastErrors };
}
