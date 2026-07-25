import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { callLLM } from '../llm/client';
import { runWithFeedbackRetry } from '../llm/reask';
import { slugify } from '../utils/slug';
import { appRoot } from '../utils/app-root';
import {
  applyLanguageDirective,
  buildLanguageDirective,
  type LanguageCode,
} from '../utils/language';
import { validateExtractorResult } from '../validation/extractor-schema';

/**
 * The Extractor (Layer 2, phase doc §2.2) — the ONLY LLM call in the core
 * pipeline (vision `04` §1). One call per chunk: reads the raw chunk text plus
 * the wiki constitution and rolling memory, returns structured JSON.
 *
 * Schema per phase doc §2.2 EXTENDED per the 2026-07-17 12:00 compliance-log
 * noted adaptation 1 (gates 2.9-2.12): `timeline`, `context`, per-entity
 * `significance`, optional per-entity `disambiguation`.
 */

export interface ExtractorMention {
  page: number;
  context: string;
}

export interface ExtractorEntity {
  name: string;
  type: string;
  slug: string;
  folder: string;
  significance: string;
  disambiguation?: string;
  mentions: ExtractorMention[];
}

export interface ExtractorRelationship {
  subject: string;
  predicate: string;
  object: string;
  evidence: string;
  page: number;
}

export interface ExtractorClaim {
  text: string;
  type: string;
  entities: string[];
  page: number;
}

export interface ExtractorTimelineEvent {
  date: string;
  event: string;
  entities: string[];
}

export interface ExtractorResult {
  entities: ExtractorEntity[];
  relationships: ExtractorRelationship[];
  claims: ExtractorClaim[];
  timeline: ExtractorTimelineEvent[];
  context: string;
}

/**
 * Typed extraction failure (phase doc §2.2 error handling; vision `04` §6
 * exhaustion rule: after the feedback-retry loop is exhausted the chunk is
 * rejected and the ingest aborts — fail loud, unchanged). Carries the raw LLM
 * response when the output was not valid JSON, and/or the schema issue list
 * when validation failed.
 */
export class ExtractorError extends Error {
  readonly rawResponse?: string;
  readonly issues?: string[];

  constructor(message: string, options: { rawResponse?: string; issues?: string[] } = {}) {
    super(message);
    this.name = 'ExtractorError';
    this.rawResponse = options.rawResponse;
    this.issues = options.issues;
  }
}

// Richer JSON needs more headroom than the frozen 1024-token default, and
// deterministic output (temperature 0) makes slugs/folders stable across runs
// (noted adaptation 5; additive CallLLMOptions, defaults unchanged for all
// other callers). maxRetries (Phase 7 v1.1.0 amendment): transient transport
// failures get up to 3 total attempts inside callLLM. Phase 12 (feedback-retry
// amendment, user-ratified 2026-07-23; vision `04` §6 / `07` §5): invalid JSON
// and schema violations are content defects re-asked with the validator's
// exact errors fed back, up to 3 total attempts; HTTP 4xx is never retried.
// The ceiling is a safety cap, never a length controller: raised 16384 →
// 32768 on 2026-07-24 (user-ratified) after a dense chunk's extraction JSON
// structurally exceeded 16384 — the reask cannot repair truncation, only the
// ceiling can (vision `04` §6 output-token ceilings note).
const EXTRACTION_MAX_TOKENS = 32768;
const EXTRACTION_TEMPERATURE = 0;
const EXTRACTION_MAX_RETRIES = 2;
const EXTRACTION_MAX_ATTEMPTS = 3;

let promptTemplateCache: string | null = null;

/** Read prompts/extractor.prompt.txt (cached; resolved relative to this module). */
async function loadPromptTemplate(): Promise<string> {
  if (promptTemplateCache !== null) {
    return promptTemplateCache;
  }
  const promptPath = join(appRoot(), 'prompts', 'extractor.prompt.txt');
  promptTemplateCache = await readFile(promptPath, 'utf-8');
  return promptTemplateCache;
}

/** Replace every {placeholder} occurrence in the template. */
function fillPromptTemplate(template: string, values: Record<string, string>): string {
  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.split(`{${key}}`).join(value);
  }
  return output;
}

/**
 * Strip a leading markdown code fence if the model added one despite the
 * prompt asking for raw JSON. The model is inconsistent: some chunks return
 * bare JSON, others wrap it in ```json ... ```. We handle the common variants:
 *   - ```json\n{...}\n```
 *   - ```\n{...}\n```
 *   - ```json{...}```
 *   - fenced JSON followed by trailing model commentary
 * Exported for tests.
 */
export function stripCodeFences(text: string): string {
  let normalized = text.trim().replace(/\r\n/g, '\n');
  if (!normalized.startsWith('```')) {
    return normalized;
  }

  // Skip the opening fence (and optional language tag) to get to the content.
  const firstNewline = normalized.indexOf('\n');
  let content: string;
  if (firstNewline === -1) {
    // No newline at all; inline fence like ```json{...}``` or ```{...}```
    content = normalized.replace(/^```[a-zA-Z]*/, '');
  } else {
    content = normalized.slice(firstNewline + 1);
  }

  // Find the first line that is exactly a closing fence (with optional
  // surrounding whitespace), then drop everything from that line onward.
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '```') {
      return lines.slice(0, i).join('\n').trim();
    }
  }

  // No closing fence found; strip a trailing ``` if present and return the rest.
  return content.replace(/```\s*$/, '').trim();
}

async function debugWriteRawResponse(rawResponse: string): Promise<void> {
  try {
    const debugDir = join(appRoot(), '.state');
    await mkdir(debugDir, { recursive: true });
    await writeFile(
      join(debugDir, 'debug-extractor-raw.txt'),
      rawResponse,
      'utf-8',
    );
  } catch {
    // Best-effort debug write; do not obscure the real error.
  }
}

/**
 * Parse the LLM response as JSON, tolerating a wrapping code fence.
 * Throws ExtractorError carrying the raw response on invalid JSON.
 * Exported for tests.
 */
export function parseExtractorJson(rawResponse: string): unknown {
  const candidate = stripCodeFences(rawResponse);
  try {
    return JSON.parse(candidate);
  } catch (err) {
    void debugWriteRawResponse(rawResponse);
    throw new ExtractorError(
      `Extractor returned invalid JSON: ${(err as Error).message}`,
      { rawResponse },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deterministic slug normalization (noted adaptation 5): every entity slug
 * and every slug reference (relationship subject/object, claim/timeline
 * entity lists) passes through slugify() after parsing, BEFORE validation.
 * This is what makes gate 2.3 (deterministic slugs) robust regardless of
 * model casing/spacing choices. Mutates the parsed object defensively.
 * Exported for tests.
 *
 * Phase 7: the optional `language` is the ingest run's INPUT language; its
 * transliteration map runs before slugifying so LLM-provided slugs like
 * `søren-møller` normalize to `soeren-moeller` (vision `04` §9.3). Omitted or
 * 'en' keeps the byte-identical pre-Phase-7 behavior. UAT 7.2 extension:
 * `entity.folder` segments and `claim.type` (the topic slug source) are
 * normalized too — the folder taxonomy and topic folders must be
 * transliterated kebab-case (vision `05` §2.1); ASCII kebab-case values pass
 * through unchanged.
 */
export function normalizeExtractorSlugs(data: unknown, language?: LanguageCode): void {
  if (!isRecord(data)) {
    return;
  }
  if (Array.isArray(data.entities)) {
    for (const entity of data.entities) {
      if (!isRecord(entity)) {
        continue;
      }
      if (typeof entity.slug === 'string') {
        entity.slug = slugify(entity.slug, language);
      }
      // Folder taxonomy follows the output language, transliterated to
      // kebab-case (vision `05` §2.1): a Danish folder like
      // 'entities/companies/Møbler' must land on disk as
      // 'entities/companies/moebler', never with a raw ø. Each segment is
      // normalized independently so the entities//topics structure survives.
      if (typeof entity.folder === 'string') {
        entity.folder = entity.folder
          .split('/')
          .map((segment) => slugify(segment, language))
          .join('/');
      }
    }
  }
  if (Array.isArray(data.relationships)) {
    for (const relationship of data.relationships) {
      if (!isRecord(relationship)) {
        continue;
      }
      if (typeof relationship.subject === 'string') {
        relationship.subject = slugify(relationship.subject, language);
      }
      if (typeof relationship.object === 'string') {
        relationship.object = slugify(relationship.object, language);
      }
    }
  }
  const normalizeSlugArray = (value: unknown): void => {
    if (!Array.isArray(value)) {
      return;
    }
    for (let index = 0; index < value.length; index++) {
      if (typeof value[index] === 'string') {
        value[index] = slugify(value[index], language);
      }
    }
  };
  if (Array.isArray(data.claims)) {
    for (const claim of data.claims) {
      if (isRecord(claim)) {
        normalizeSlugArray(claim.entities);
        // claim.type doubles as the topic slug (materializer uses it
        // verbatim), so it gets the same transliteration treatment — a Danish
        // type like 'Økonomi' must become topic slug 'oekonomi'.
        if (typeof claim.type === 'string') {
          claim.type = slugify(claim.type, language);
        }
      }
    }
  }
  if (Array.isArray(data.timeline)) {
    for (const event of data.timeline) {
      if (isRecord(event)) {
        normalizeSlugArray(event.entities);
      }
    }
  }
}

/**
 * Run the Extractor on one chunk (phase doc §2.2): load the prompt, inject
 * the wiki context, then run the Phase 12 feedback-retry loop (vision `04`
 * §6, user-ratified 2026-07-23): attempt 1 is byte-identical to the
 * pre-Phase-12 call; when the parse or schema validation fails, the invalid
 * output plus the validator's exact error list is appended to the SAME prompt
 * as a clearly delimited correction block and re-asked, up to
 * EXTRACTION_MAX_ATTEMPTS total attempts. Every attempt is logged via the
 * existing logPath with context `<chunkId>` (attempt 1) or
 * `<chunkId>#attempt<N>` (repairs). HTTP 4xx propagates immediately (never
 * retried). Exhaustion throws the same ExtractorError shape as before
 * Phase 12 — fail-loud abort, unchanged.
 */
export async function extractChunk(
  chunkText: string,
  pageRange: string,
  sourceFile: string,
  agentsMd: string,
  existingFolders: string[],
  existingEntities: string[],
  options?: {
    logPath?: string;
    context?: string;
    /**
     * Phase 7 (vision `04` §9): the ingest run's input language and the wiki's
     * output language. Absent → { en, en } → empty language directive and
     * byte-identical slug normalization.
     */
    language?: { input: LanguageCode; output: LanguageCode };
  },
): Promise<ExtractorResult> {
  const input = options?.language?.input ?? 'en';
  const output = options?.language?.output ?? 'en';
  const template = await loadPromptTemplate();
  const filled = fillPromptTemplate(template, {
    agentsMd: agentsMd.trim().length > 0 ? agentsMd : '(No AGENTS.md provided.)',
    existingFolders:
      existingFolders.length > 0 ? existingFolders.join(', ') : '(none yet — this is the first chunk of the wiki)',
    existingEntities:
      existingEntities.length > 0 ? existingEntities.join(', ') : '(none yet — this is the first chunk of the wiki)',
    sourceFile,
    pageRange,
    chunkText: chunkText.trim().length > 0 ? chunkText : '(this chunk contains no extractable text)',
  });
  const prompt = applyLanguageDirective(
    filled,
    buildLanguageDirective('extractor', input, output),
  );

  // The last failure's full detail, captured by the validate closure so an
  // exhausted loop can re-throw exactly the pre-Phase-12 error shape.
  type ExtractorFailure =
    | { kind: 'parse'; message: string; raw: string }
    | { kind: 'schema'; issues: string[]; raw: string };
  let parsedSuccess: ExtractorResult | null = null;
  let lastFailure: ExtractorFailure | null = null;

  const outcome = await runWithFeedbackRetry<string>(
    (feedback, attempt) =>
      callLLM(feedback === null ? prompt : `${prompt}\n\n${feedback}`, undefined, {
        maxTokens: EXTRACTION_MAX_TOKENS,
        temperature: EXTRACTION_TEMPERATURE,
        maxRetries: EXTRACTION_MAX_RETRIES,
        callType: 'extractor',
        context:
          attempt === 1
            ? options?.context
            : `${options?.context ?? 'chunk'}#attempt${attempt}`,
        logPath: options?.logPath,
      }),
    (rawResponse) => {
      let parsed: unknown;
      try {
        parsed = parseExtractorJson(rawResponse);
      } catch (err) {
        const error = err as ExtractorError;
        lastFailure = { kind: 'parse', message: error.message, raw: rawResponse };
        return { valid: false, errors: [error.message] };
      }
      normalizeExtractorSlugs(parsed, input);
      const validation = validateExtractorResult(parsed, pageRange);
      if (!validation.valid) {
        lastFailure = { kind: 'schema', issues: validation.issues, raw: rawResponse };
        return { valid: false, errors: validation.issues };
      }
      parsedSuccess = parsed as ExtractorResult;
      return { valid: true, errors: [] };
    },
    { maxAttempts: EXTRACTION_MAX_ATTEMPTS, label: options?.context ?? 'extractor chunk' },
  );

  if (outcome.output === null || parsedSuccess === null) {
    // Exhaustion (vision `04` §6): reject the chunk with the same thrown
    // error shape as before Phase 12 — the ingest aborts fail-loud. The
    // closure-captured failure detail is typed loosely because the closure
    // assignment is opaque to TS narrowing at this point in the control flow.
    const failure = lastFailure as ExtractorFailure | null;
    if (failure !== null && failure.kind === 'schema') {
      throw new ExtractorError(
        `Extractor output failed schema validation: ${failure.issues.join('; ')}`,
        { issues: failure.issues, rawResponse: failure.raw },
      );
    }
    const parseFailure: ExtractorFailure =
      failure ?? { kind: 'parse', message: 'Extractor returned no output', raw: '' };
    throw new ExtractorError(parseFailure.message, { rawResponse: parseFailure.raw });
  }

  return parsedSuccess;
}
