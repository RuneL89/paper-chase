import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { callLLM, type LlmResponseMeta } from '../llm/client';
import { runWithFeedbackRetry } from '../llm/reask';
import {
  diagnoseJsonParseFailure,
  isTruncationFinishReason,
  truncatedOutputEcho,
} from '../llm/json-corrector';
import { appRoot } from '../utils/app-root';
import {
  applyLanguageDirective,
  buildLanguageDirective,
  type LanguageCode,
} from '../utils/language';
import { stripCodeFences } from './extractor';
import { isBareGenericLabelSlug, type ProposedDisambiguation } from './pre-merge';

/**
 * Phase 25 (phase doc §2.2; canon: vision `04` §3.2 Step 6b item 2, `02`
 * §4.6 class 6, `05` §6 class 6 + §7 same-label rule; backlog B23; evidence:
 * `Indikator 2` in DPD_2025.pdf = first specialised-palliative treatment
 * contact within 10 days while in HOFTER_2025.pdf = surgery within 24 hours
 * of arrival — one generic label, two registries, two unrelated clinical
 * meanings that today collapse onto one conflated page): the DISAMBIGUATION
 * judgment agent. ONE lightweight LLM call per flagged generic-label slug (the
 * deterministic detector in the Materializer proposes — `src/agents/pre-merge.ts`
 * + `src/materializer.ts`; this agent confirms or denies, the Phase 21/22
 * "deterministic code proposes; the LLM confirms" pattern).
 *
 * Input: the slug, its title, and 2-3 verbatim sample claims/significance per
 * source file. Output (strict JSON, fence-tolerant, schema-validated):
 * `{ "split": false }` (same meaning — keep one ordinary page) OR
 * `{ "split": true, "reason": "...", "members": [{ "slug", "title", "sources" }] }`
 * — one member per distinct meaning; member slugs are meaning-derived or
 * register-derived, never a bare renumbering; every evidence source file maps
 * to exactly one member; 2-4 members (the Phase 22 cap).
 *
 * Routing: `callType: 'disambiguate'` rides the CURATION slot (fallback
 * Default) — deliberately no new Settings row. House rules (the `curation.ts`
 * pattern): invalid output re-asks ≤3 total attempts via `runWithFeedbackRetry`
 * with the validator's exact errors (a JSON parse failure additionally fires
 * the Phase 16 v1.0.5 JSON corrector, real transport only); exhaustion,
 * transport errors, and HTTP 4xx land on the KEEP-ONE-PAGE fallback —
 * `{ verdict: null }`, the label stays one ordinary page, the caller logs and
 * never throws (self-healing next run).
 *
 * RE-ENTRY (§2.3): when the label is already split (a sticky record exists)
 * and a NEW source file appears whose evidence diverges from every mapped
 * member, the request carries `existingMembers` — the judgment is then scoped
 * to placing the new source(s): existing members must be re-stated with their
 * existing sources UNCHANGED (validated deterministically), and each new
 * source joins one member or founds one new member.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** One distinct meaning of a generic label — the per-meaning identity. */
export interface DisambiguationMember {
  slug: string;
  title: string;
  /** The source files whose evidence belongs to this meaning. */
  sources: string[];
}

export interface DisambiguationVerdict {
  split: boolean;
  /** Few words, present on a split. */
  reason?: string;
  /** Present iff split — one member per distinct meaning. */
  members?: DisambiguationMember[];
}

export type DisambiguationFallbackCause =
  | 'validation-exhaustion'
  | 'transport-exhaustion'
  | 'http-4xx';

export interface DisambiguationOutcome {
  /**
   * The validated verdict; null ONLY on the keep-one-page fallback
   * (exhaustion/transport/4xx) — the label stays one ordinary page.
   */
  verdict: DisambiguationVerdict | null;
  attempts: number;
  fallbacks: Array<{ cause: DisambiguationFallbackCause }>;
}

export interface DisambiguationRequest {
  /** The flagged label: slug, title, per-source samples (ALL sources). */
  proposal: ProposedDisambiguation;
  /**
   * Present on RE-ENTRY only (the label is already split; a new source needs
   * placing): the fixed existing members — the judgment may not alter them.
   */
  existingMembers?: DisambiguationMember[];
}

export interface DisambiguationCallOptions {
  /** Wiki constitution appended to the prompt (matches the other agents). */
  agentsMd: string;
  /** Run language pair for the {languageDirective} fill; absent → en/en. */
  language?: { input: LanguageCode; output: LanguageCode };
  /** `.state/llm-calls.json` path — every call is logged. */
  logPath?: string;
  /** Test-only transport seam (keeps every gate LLM-free). Defaults to callLLM. */
  callLLMFn?: DisambiguationLlmFn;
}

/** The transport seam's option shape (mirrors the curation subset). */
export interface DisambiguationLlmCallOptions {
  maxTokens: number;
  maxRetries: number;
  callType: string;
  context?: string;
  logPath?: string;
  /** Phase 16 v1.0.5: response-metadata tap (finish reason) for the corrector. */
  onResponseMeta?: (meta: LlmResponseMeta) => void;
}

export type DisambiguationLlmFn = (
  prompt: string,
  options: DisambiguationLlmCallOptions,
) => Promise<string>;

export interface DisambiguationValidation {
  valid: boolean;
  errors: string[];
  verdict?: DisambiguationVerdict;
}

// ---------------------------------------------------------------------------
// Constants + prompt loading (the curation.ts pattern)
// ---------------------------------------------------------------------------

const PROMPT_FILE = 'disambiguation.prompt.txt';

/** Phase 12 reask bound: 3 total attempts per judgment (the curation rule). */
const DISAMBIGUATION_MAX_ATTEMPTS = 3;
/** Transient transport retries INSIDE callLLM (429/5xx/network). */
const DISAMBIGUATION_MAX_RETRIES = 2;
/**
 * Output ceiling. The judgment JSON itself is tiny (~0.2-0.5k tokens), but the
 * phase doc §3 pin (glm-5.3-flash) is a REASONING model — hidden reasoning
 * tokens are billed as output and precede any content, so the ceiling always
 * leaves reasoning headroom; a content-empty + length-finish response means
 * the cap was too small, not that the model failed.
 */
export const DISAMBIGUATION_MAX_TOKENS = 4096;

let promptTemplate: string | null = null;

async function loadPromptTemplate(): Promise<string> {
  if (promptTemplate !== null) {
    return promptTemplate;
  }
  promptTemplate = await readFile(join(appRoot(), 'prompts', PROMPT_FILE), 'utf-8');
  return promptTemplate;
}

function fillPromptTemplate(template: string, values: Record<string, string>): string {
  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.split(`{${key}}`).join(value);
  }
  return output;
}

/** Render the per-source evidence block (the prompt's `{evidence}` slot). */
function formatEvidenceBlock(proposal: ProposedDisambiguation): string {
  return JSON.stringify(
    proposal.sources.map((source) => ({ file: source.file, samples: source.samples })),
    null,
    2,
  );
}

/** Render the re-entry rules + existing members (the `{reEntryRules}` slot). */
function formatReEntryRules(existingMembers: DisambiguationMember[]): string {
  return [
    'This label is ALREADY split — the split itself is fixed. Judge ONLY where the NEW source files (sources not yet claimed by any member) belong:',
    '- Re-state every existing member EXACTLY as listed, with its existing "sources" UNCHANGED — existing members are never altered, merged, or dropped.',
    '- Assign each new source file to exactly one member: an existing member when its evidence matches that meaning, or ONE new member when it is a distinct new meaning (2-4 members total).',
    '- New member slugs follow the member rules above.',
    '',
    'Existing members:',
    JSON.stringify(
      existingMembers.map((member) => ({ slug: member.slug, title: member.title, sources: member.sources })),
      null,
      2,
    ),
  ].join('\n');
}

/**
 * Remove the whole RE-ENTRY section on a fresh judgment (no existing members)
 * — the fresh prompt stays free of re-entry rules (the
 * `stripProposedPairsBlock` precedent, CRLF-safe).
 */
export function stripReEntryBlock(prompt: string): string {
  return prompt
    .split('\n=== RE-ENTRY ===\n{reEntryRules}\n=== END RE-ENTRY ===\n')
    .join('')
    .split('\r\n=== RE-ENTRY ===\r\n{reEntryRules}\r\n=== END RE-ENTRY ===\r\n')
    .join('');
}

// ---------------------------------------------------------------------------
// Deterministic verdict validation (gate 25.2)
// ---------------------------------------------------------------------------

const KEBAB_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function memberLabel(index: number, slug: unknown): string {
  return typeof slug === 'string' && slug.length > 0 ? `members[${index}] ("${slug}")` : `members[${index}]`;
}

/**
 * Validate one disambiguation verdict against the proposal: shape (split
 * boolean; on a split: 2-4 members, each with a kebab slug ≠ the label slug
 * and never a bare renumbering, a title, a non-empty source list drawn from
 * the proposal's files) and coverage (every proposal source file maps to
 * EXACTLY ONE member — none unmapped, none on two). Every rejection NAMES the
 * offending member so the reask correction block points at it.
 *
 * Source echoes are NORMALIZED: a member "sources" entry is valid when it
 * exactly equals a proposal source file OR equals that file's BASENAME (the
 * live-model form — glm-5.3-flash echoes "DPD_2025.pdf" against the
 * proposal's "wikis/test-wiki/raw/DPD_2025.pdf"); the normalized verdict
 * carries the canonical full-path form so sticky sourceMaps and later routing
 * are unchanged. The re-entry variant shares this check through this
 * function (existing members' sources compare on canonical paths).
 */
export function validateDisambiguationVerdict(
  verdict: unknown,
  proposal: ProposedDisambiguation,
): DisambiguationValidation {
  if (typeof verdict !== 'object' || verdict === null || Array.isArray(verdict)) {
    return { valid: false, errors: ['output must be a single JSON object'] };
  }
  const raw = verdict as Record<string, unknown>;
  if (typeof raw.split !== 'boolean') {
    return { valid: false, errors: ['missing or invalid required field: split (boolean)'] };
  }
  if (!raw.split) {
    return { valid: true, errors: [], verdict: { split: false } };
  }
  const errors: string[] = [];
  if (!Array.isArray(raw.members)) {
    return { valid: false, errors: ['split requires a "members" array'] };
  }
  const members = raw.members;
  if (members.length < 2 || members.length > 4) {
    errors.push(`split requires 2-4 members (got ${members.length})`);
  }
  const proposalFiles = new Set(proposal.sources.map((source) => source.file));
  // Live-gate fix (2026-08-27, diagnosed on the real glm-5.3-flash): models
  // echo member "sources" as BASENAMES ("DPD_2025.pdf") even when the
  // proposal carries full workspace paths — normalize a basename echo to the
  // canonical full-path form (the Phase 17 B1 citation-checker precedent:
  // the basename and the full-path form of one file are the same file). All
  // evidence files of one wiki live in the same `wikis/<slug>/raw/` folder,
  // so a basename names exactly one proposal file; an ambiguous basename
  // (two proposal files sharing it) is deliberately NOT normalized, and an
  // echo matching no proposal file by either form keeps the existing error.
  const proposalFileByBasename = new Map<string, string>();
  const basenameCounts = new Map<string, number>();
  for (const file of proposalFiles) {
    const base = file.split('/').pop() ?? file;
    basenameCounts.set(base, (basenameCounts.get(base) ?? 0) + 1);
  }
  for (const file of proposalFiles) {
    const base = file.split('/').pop() ?? file;
    if (basenameCounts.get(base) === 1) {
      proposalFileByBasename.set(base, file);
    }
  }
  const canonicalSourceEcho = (echoed: string): string | null => {
    if (proposalFiles.has(echoed)) {
      return echoed;
    }
    const canonical = proposalFileByBasename.get(echoed.split('/').pop() ?? echoed);
    return canonical ?? null;
  };
  const seenSlugs = new Set<string>();
  const normalized: DisambiguationMember[] = [];
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    if (typeof member !== 'object' || member === null || Array.isArray(member)) {
      errors.push(`members[${i}]: must be an object`);
      continue;
    }
    const entry = member as Record<string, unknown>;
    const label = memberLabel(i, entry.slug);
    if (typeof entry.slug !== 'string' || entry.slug.length === 0 || !KEBAB_SLUG_PATTERN.test(entry.slug)) {
      errors.push(`${label}: "slug" must be a non-empty lowercase kebab-case slug`);
    } else if (isBareGenericLabelSlug(entry.slug)) {
      errors.push(
        `${label}: a bare renumbering of a generic label is not a member slug — derive it from the meaning or the source register`,
      );
    } else if (entry.slug === proposal.slug) {
      errors.push(`${label}: must differ from the label's own slug`);
    } else if (seenSlugs.has(entry.slug)) {
      errors.push(`${label}: duplicate member slug "${entry.slug}"`);
    }
    if (typeof entry.title !== 'string' || entry.title.trim().length === 0) {
      errors.push(`${label}: "title" must be a non-empty string`);
    }
    if (
      !Array.isArray(entry.sources) ||
      entry.sources.length === 0 ||
      !entry.sources.every((file) => typeof file === 'string' && file.length > 0)
    ) {
      errors.push(`${label}: "sources" must be a non-empty list of source files`);
    }
    if (typeof entry.slug === 'string') {
      seenSlugs.add(entry.slug);
      const echoedSources = Array.isArray(entry.sources)
        ? entry.sources.filter((file): file is string => typeof file === 'string')
        : [];
      const canonicalSources: string[] = [];
      for (const file of echoedSources) {
        const canonical = canonicalSourceEcho(file);
        if (canonical === null) {
          errors.push(`${label}: source "${file}" is not one of the label's source files`);
          continue;
        }
        // One member naming the same file twice (full path + basename) is one
        // source — dedupe to the canonical form.
        if (!canonicalSources.includes(canonical)) {
          canonicalSources.push(canonical);
        }
      }
      normalized.push({
        slug: entry.slug,
        title: typeof entry.title === 'string' ? entry.title.trim() : '',
        sources: canonicalSources,
      });
    }
  }
  // Coverage: every proposal source file maps to exactly one member.
  const fileToMembers = new Map<string, string[]>();
  for (const member of normalized) {
    for (const file of member.sources) {
      const holders = fileToMembers.get(file) ?? [];
      holders.push(member.slug);
      fileToMembers.set(file, holders);
    }
  }
  for (const source of proposal.sources) {
    const holders = fileToMembers.get(source.file) ?? [];
    if (holders.length === 0) {
      errors.push(`source "${source.file}" is not mapped to any member`);
    } else if (holders.length > 1) {
      errors.push(`source "${source.file}" is mapped to two members ("${holders[0]}", "${holders[1]}")`);
    }
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return {
    valid: true,
    errors: [],
    verdict: {
      split: true,
      ...(typeof raw.reason === 'string' && raw.reason.trim().length > 0
        ? { reason: raw.reason.trim() }
        : {}),
      members: normalized,
    },
  };
}

/**
 * Validate a RE-ENTRY verdict (an already-split label; a new source needs
 * placing): the full shape/coverage validation over ALL sources, PLUS the
 * fixed-membership rules — every existing member appears exactly once with
 * its existing sources UNCHANGED (gate 25.6: existing members and their
 * evidence are untouched; only the new source's mapping moves).
 */
export function validateDisambiguationReentry(
  verdict: unknown,
  request: DisambiguationRequest & { existingMembers: DisambiguationMember[] },
): DisambiguationValidation {
  const shape = validateDisambiguationVerdict(verdict, request.proposal);
  if (!shape.valid || shape.verdict === undefined || !shape.verdict.split) {
    if (shape.valid && shape.verdict?.split === false) {
      return {
        valid: false,
        errors: ['the label is already split — "split" must be true and the members list must place the new source(s)'],
      };
    }
    return shape;
  }
  const errors: string[] = [];
  const memberBySlug = new Map((shape.verdict.members ?? []).map((member) => [member.slug, member]));
  for (const existing of request.existingMembers) {
    const member = memberBySlug.get(existing.slug);
    if (member === undefined) {
      errors.push(`existing member "${existing.slug}" is missing from the members list`);
      continue;
    }
    const sameSources =
      member.sources.length === existing.sources.length &&
      existing.sources.every((file) => member.sources.includes(file));
    if (!sameSources) {
      errors.push(
        `existing member "${existing.slug}" must keep exactly its existing sources [${existing.sources
          .map((file) => `"${file}"`)
          .join(', ')}] — sources are never re-assigned on re-entry`,
      );
    }
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return shape;
}

/**
 * Fence-tolerant parse of the raw LLM text into a verdict object (the
 * `parseDecisionList` pattern): strips code fences, JSON.parses, and returns
 * the exact parse error line on failure.
 */
export function parseDisambiguationVerdict(rawText: string): { verdict?: unknown; errors: string[] } {
  const candidate = stripCodeFences(rawText);
  try {
    return { verdict: JSON.parse(candidate) as unknown, errors: [] };
  } catch (err) {
    return { errors: [`output is not valid JSON (${(err as Error).message})`] };
  }
}

// ---------------------------------------------------------------------------
// The judgment call
// ---------------------------------------------------------------------------

function classifyFallbackCause(err: unknown): DisambiguationFallbackCause {
  const message = err instanceof Error ? err.message : String(err);
  const http = /HTTP (\d{3})/.exec(message);
  if (http !== null && Number(http[1]) >= 400 && Number(http[1]) < 500 && Number(http[1]) !== 429) {
    return 'http-4xx';
  }
  return 'transport-exhaustion';
}

/**
 * One validated disambiguation judgment over one flagged label: prompt → LLM →
 * deterministic validation, re-asked ≤3 times via `runWithFeedbackRetry` with
 * the exact offending entries fed back. Exhaustion and every thrown transport
 * error land on the keep-one-page fallback (`verdict: null`) — the caller
 * keeps the label as one ordinary page and never throws.
 */
export async function disambiguateLabel(
  request: DisambiguationRequest,
  options: DisambiguationCallOptions,
): Promise<DisambiguationOutcome> {
  const reentry = request.existingMembers ?? [];
  const isReentry = reentry.length > 0;
  let template = await loadPromptTemplate();
  if (!isReentry) {
    template = stripReEntryBlock(template);
  }
  const filled = fillPromptTemplate(template, {
    agentsMd: options.agentsMd.trim().length > 0 ? options.agentsMd : '(No AGENTS.md provided.)',
    slug: request.proposal.slug,
    title: request.proposal.title,
    evidence: formatEvidenceBlock(request.proposal),
    reEntryRules: isReentry ? formatReEntryRules(reentry) : '',
  });
  const basePrompt = applyLanguageDirective(
    filled,
    buildLanguageDirective('curation', options.language?.input ?? 'en', options.language?.output ?? 'en'),
  );
  const context = `disambiguate:${request.proposal.slug}`;
  const llm: DisambiguationLlmFn =
    options.callLLMFn ?? ((prompt, callOptions) => callLLM(prompt, undefined, callOptions));

  let attemptsMade = 0;
  const validations: DisambiguationValidation[] = [];
  // Phase 16 v1.0.5: parse-failure tracking for the JSON corrector (the
  // `curateSingleCall` pattern — the exact parse error line, the provider's
  // stop reason, and an enhancer that rides the REAL transport only; an
  // injected callLLMFn owns the whole LLM surface, corrector included).
  let lastParseError: string | null = null;
  let lastFinishReason: string | undefined;
  let thrown: unknown;
  let outcome: Awaited<ReturnType<typeof runWithFeedbackRetry<string>>> | null = null;
  try {
    outcome = await runWithFeedbackRetry<string>(
      (feedback, attempt) => {
        attemptsMade = attempt;
        return llm(feedback === null ? basePrompt : `${basePrompt}\n\n${feedback}`, {
          maxTokens: DISAMBIGUATION_MAX_TOKENS,
          maxRetries: DISAMBIGUATION_MAX_RETRIES,
          callType: 'disambiguate',
          context: attempt > 1 ? `${context}#attempt${attempt}` : context,
          logPath: options.logPath,
          onResponseMeta: (meta) => {
            lastFinishReason = meta.finishReason;
          },
        });
      },
      (text) => {
        const parsed = parseDisambiguationVerdict(text);
        if (parsed.verdict === undefined) {
          validations.push({ valid: false, errors: parsed.errors });
          lastParseError = parsed.errors[0] ?? null;
          return { valid: false, errors: parsed.errors };
        }
        const validation = isReentry
          ? validateDisambiguationReentry(parsed.verdict, {
              proposal: request.proposal,
              existingMembers: reentry,
            })
          : validateDisambiguationVerdict(parsed.verdict, request.proposal);
        validations.push(validation);
        lastParseError =
          validation.errors.find((error) => error.startsWith('output is not valid JSON')) ?? null;
        return { valid: validation.valid, errors: validation.errors };
      },
      {
        label: context,
        maxAttempts: DISAMBIGUATION_MAX_ATTEMPTS,
        feedbackEnhancer:
          options.callLLMFn === undefined
            ? async (output) => {
                if (lastParseError === null || typeof output !== 'string') {
                  return null;
                }
                const truncated = isTruncationFinishReason(lastFinishReason);
                const guidance = await diagnoseJsonParseFailure({
                  rawResponse: output,
                  errorMessage: lastParseError,
                  truncated,
                  context,
                  logPath: options.logPath,
                });
                return {
                  guidance,
                  echoOverride: truncated ? truncatedOutputEcho(output) : null,
                };
              }
            : undefined,
      },
    );
  } catch (err) {
    thrown = err;
  }

  if (outcome === null) {
    // HTTP 4xx throws immediately inside callLLM; transient exhaustion throws
    // after the bounded retries. Both land on the keep-one-page fallback.
    return {
      verdict: null,
      attempts: Math.max(attemptsMade, 1),
      fallbacks: [{ cause: classifyFallbackCause(thrown) }],
    };
  }
  if (outcome.output === null) {
    return {
      verdict: null,
      attempts: outcome.attempts,
      fallbacks: [{ cause: 'validation-exhaustion' }],
    };
  }
  const captured = validations[validations.length - 1];
  return {
    verdict: captured?.verdict ?? null,
    attempts: outcome.attempts,
    fallbacks: [],
  };
}
