import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callLLM } from '../llm/client';
import { slugify } from '../utils/slug';
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
 * "The system does not retry"). Carries the raw LLM response when the output
 * was not valid JSON, and/or the schema issue list when validation failed.
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
// other callers).
const EXTRACTION_MAX_TOKENS = 4096;
const EXTRACTION_TEMPERATURE = 0;

let promptTemplateCache: string | null = null;

/** Read prompts/extractor.prompt.txt (cached; resolved relative to this module). */
async function loadPromptTemplate(): Promise<string> {
  if (promptTemplateCache !== null) {
    return promptTemplateCache;
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const promptPath = join(here, '..', '..', 'prompts', 'extractor.prompt.txt');
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
 * Strip a single leading/trailing markdown code fence if the model added one
 * despite the prompt asking for raw JSON. Exported for tests.
 */
export function stripCodeFences(text: string): string {
  let trimmed = text.trim();
  const fenceMatch = /^```[a-zA-Z]*\r?\n/.exec(trimmed);
  if (fenceMatch) {
    trimmed = trimmed.slice(fenceMatch[0].length);
    if (trimmed.endsWith('```')) {
      trimmed = trimmed.slice(0, trimmed.length - 3);
    }
  }
  return trimmed.trim();
}

/**
 * Parse the LLM response as JSON, tolerating one wrapping code fence.
 * Throws ExtractorError carrying the raw response on invalid JSON.
 * Exported for tests.
 */
export function parseExtractorJson(rawResponse: string): unknown {
  const candidate = stripCodeFences(rawResponse);
  try {
    return JSON.parse(candidate);
  } catch (err) {
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
 */
export function normalizeExtractorSlugs(data: unknown): void {
  if (!isRecord(data)) {
    return;
  }
  if (Array.isArray(data.entities)) {
    for (const entity of data.entities) {
      if (isRecord(entity) && typeof entity.slug === 'string') {
        entity.slug = slugify(entity.slug);
      }
    }
  }
  if (Array.isArray(data.relationships)) {
    for (const relationship of data.relationships) {
      if (!isRecord(relationship)) {
        continue;
      }
      if (typeof relationship.subject === 'string') {
        relationship.subject = slugify(relationship.subject);
      }
      if (typeof relationship.object === 'string') {
        relationship.object = slugify(relationship.object);
      }
    }
  }
  const normalizeSlugArray = (value: unknown): void => {
    if (!Array.isArray(value)) {
      return;
    }
    for (let index = 0; index < value.length; index++) {
      if (typeof value[index] === 'string') {
        value[index] = slugify(value[index]);
      }
    }
  };
  if (Array.isArray(data.claims)) {
    for (const claim of data.claims) {
      if (isRecord(claim)) {
        normalizeSlugArray(claim.entities);
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
 * the wiki context, one LLM call, parse JSON, normalize slugs, validate
 * against the schema. No retry — a failure throws ExtractorError and the user
 * fixes the prompt or the chunk and re-runs.
 */
export async function extractChunk(
  chunkText: string,
  pageRange: string,
  sourceFile: string,
  agentsMd: string,
  existingFolders: string[],
  existingEntities: string[],
): Promise<ExtractorResult> {
  const template = await loadPromptTemplate();
  const prompt = fillPromptTemplate(template, {
    agentsMd: agentsMd.trim().length > 0 ? agentsMd : '(No AGENTS.md provided.)',
    existingFolders:
      existingFolders.length > 0 ? existingFolders.join(', ') : '(none yet — this is the first chunk of the wiki)',
    existingEntities:
      existingEntities.length > 0 ? existingEntities.join(', ') : '(none yet — this is the first chunk of the wiki)',
    sourceFile,
    pageRange,
    chunkText: chunkText.trim().length > 0 ? chunkText : '(this chunk contains no extractable text)',
  });

  const rawResponse = await callLLM(prompt, undefined, {
    maxTokens: EXTRACTION_MAX_TOKENS,
    temperature: EXTRACTION_TEMPERATURE,
  });

  const parsed = parseExtractorJson(rawResponse);
  normalizeExtractorSlugs(parsed);

  const validation = validateExtractorResult(parsed, pageRange);
  if (!validation.valid) {
    throw new ExtractorError(
      `Extractor output failed schema validation: ${validation.issues.join('; ')}`,
      { issues: validation.issues, rawResponse },
    );
  }

  return parsed as ExtractorResult;
}
