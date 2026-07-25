import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { enqueueSerializedWrite } from '../utils/serialized-writes';
import type { EntityPageData } from '../pages/entity-page';
import type { TopicPageData } from '../pages/topic-page';
import type { LanguageCode } from '../utils/language';

/**
 * Phase 16 (vision `04` Step 9 synthesis resume, user-ratified 2026-07-25):
 * `.state/synthesis-state.json` — the content-addressed completion memory of
 * the Synthesis Writer. Every page that finishes a synthesis stage (pass OR
 * fallback) is recorded with a fingerprint of the aggregate data it was
 * synthesized from:
 *
 * ```json
 * {
 *   "pages": {
 *     "entities/people/john-smith.md": {
 *       "mode": "strict-synthesis",
 *       "dataHash": "sha256...",
 *       "synthesizedAt": "2026-07-25T10:00:00.000Z"
 *     }
 *   }
 * }
 * ```
 *
 * Skip rule: a `strict-synthesis`/`permissive-synthesis` record whose
 * dataHash matches the page's current aggregate fingerprint means the page
 * is already paid for — the synthesis stage skips the LLM call and the
 * Materializer preserves the finished page byte-for-byte. Template-fallback
 * records (`structured-template`, `transport-fallback`) are NOT skip-eligible:
 * those pages are retried on the next run. Any aggregate change (new
 * evidence, a curation merge) changes the fingerprint, so the page is
 * rewritten and re-synthesized normally.
 */

/** The report finalMode vocabulary, reused so one mode names one outcome. */
export type SynthesisPageMode =
  | 'strict-synthesis'
  | 'permissive-synthesis'
  | 'structured-template'
  | 'transport-fallback';

export interface SynthesisPageRecord {
  mode: SynthesisPageMode;
  /** pageDataHash of the aggregate the page was last synthesized/templated from. */
  dataHash: string;
  /** ISO 8601 timestamp of that synthesis-stage completion. */
  synthesizedAt: string;
}

export interface SynthesisState {
  pages: Record<string, SynthesisPageRecord>;
}

export function emptySynthesisState(): SynthesisState {
  return { pages: {} };
}

export function synthesisStatePath(wikiDir: string): string {
  return join(wikiDir, '.state', 'synthesis-state.json');
}

/**
 * Read `.state/synthesis-state.json`. Absent file → empty state (pre-Phase-16
 * wikis); malformed JSON or wrong shape → descriptive throw (the
 * `readIngestionState` house style).
 */
export async function readSynthesisState(wikiDir: string): Promise<SynthesisState> {
  const path = synthesisStatePath(wikiDir);
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return emptySynthesisState();
    }
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Synthesis state file is not valid JSON: ${path}`);
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as SynthesisState).pages !== 'object' ||
    (parsed as SynthesisState).pages === null
  ) {
    throw new Error(`Synthesis state file has an unexpected shape (missing "pages"): ${path}`);
  }
  return parsed as SynthesisState;
}

/**
 * True when a record makes its page skip-eligible: only pages that PASSED
 * synthesis (strict or permissive) are skipped on later runs; template
 * fallbacks are always retried.
 */
export function isSkipEligible(record: SynthesisPageRecord | undefined): record is SynthesisPageRecord {
  return record !== undefined && (record.mode === 'strict-synthesis' || record.mode === 'permissive-synthesis');
}

/** Wiki-relative page path for a page-data aggregate (forward slashes). */
export function synthesisPagePath(pageData: EntityPageData | TopicPageData): string {
  return `${pageData.folder}/${pageData.slug}.md`;
}

/**
 * Stable JSON stringification: object keys sorted recursively, arrays in
 * order, `undefined` object values dropped (JSON semantics). Two aggregates
 * with identical content stringify identically regardless of key insertion
 * order, so the fingerprint depends on content only.
 */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`);
  return `{${entries.join(',')}}`;
}

/**
 * The resume fingerprint (vision `04` Step 9): SHA-256 over the page's
 * canonical aggregate input — the entity/topic structured data (title and
 * folder included) plus the run's language pair. `slugToTitle` is EXCLUDED:
 * it is global cross-page context (every other page's title), not this page's
 * aggregate — including it would re-synthesize every page whenever any
 * unrelated page appears or renames. Any change to the page's own aggregate
 * (new evidence, a curation merge/alias, a folder move, a language switch)
 * changes the hash. One helper behind both the Materializer's preservation
 * check and the ingest skip rule so the two can never drift apart.
 */
export function pageDataHash(
  pageData: EntityPageData | TopicPageData,
  language: { input: LanguageCode; output: LanguageCode },
): string {
  const { slugToTitle: _globalContext, ...aggregate } = pageData;
  const canonical = canonicalJson({ aggregate, language: { input: language.input, output: language.output } });
  return createHash('sha256').update(canonical, 'utf-8').digest('hex');
}

/**
 * Append/update one page's record, funneled through the Phase 15 serialized
 * write queue (the synthesis pool's workers checkpoint concurrently).
 * Read-modify-write per page as it completes (vision `04` Step 11: per-page
 * records are written as pages complete, so an abort costs only the pages
 * still in flight). Stale entries — records whose page file no longer exists
 * on disk — are pruned at write time, and page keys are written in sorted
 * order so the file is deterministic regardless of pool completion order.
 */
export async function recordSynthesisPage(
  wikiDir: string,
  pagePath: string,
  record: SynthesisPageRecord,
): Promise<void> {
  const path = synthesisStatePath(wikiDir);
  await enqueueSerializedWrite(path, async () => {
    const state = await readSynthesisState(wikiDir);
    for (const existingPath of Object.keys(state.pages)) {
      if (!existsSync(join(wikiDir, existingPath))) {
        delete state.pages[existingPath];
      }
    }
    state.pages[pagePath] = record;
    const sorted: Record<string, SynthesisPageRecord> = {};
    for (const key of Object.keys(state.pages).sort((a, b) => a.localeCompare(b))) {
      sorted[key] = state.pages[key];
    }
    await mkdir(join(wikiDir, '.state'), { recursive: true });
    await writeFile(path, JSON.stringify({ pages: sorted }, null, 2) + '\n', 'utf-8');
  });
}
