import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { LanguageCode } from '../utils/language';

/**
 * Per-wiki language state (Phase 7; vision `04` §9.1), persisted as
 * `wikis/<slug>/.state/language.json`. Follows the existing `.state/` module
 * pattern (state/rolling-memory.ts): an absent file is normal (pre-Phase-7
 * wikis) and yields the English defaults; malformed JSON throws descriptively.
 *
 * - `outputLanguage` — the wiki's prose language, chosen at init; Layer 1
 *   synthesis and index.md descriptions are written in it.
 * - `lastInputLanguage` — the input language of the most recent ingest run;
 *   used to pre-select the TUI selector and to detect slug-forking risk when
 *   a run's input language differs (vision `04` §9.3).
 */

export interface WikiLanguageState {
  outputLanguage: LanguageCode;
  lastInputLanguage: LanguageCode;
}

export const DEFAULT_WIKI_LANGUAGE: WikiLanguageState = {
  outputLanguage: 'en',
  lastInputLanguage: 'en',
};

export function wikiLanguagePath(wikiDir: string): string {
  return join(wikiDir, '.state', 'language.json');
}

function isLanguageCode(value: unknown): value is LanguageCode {
  return (
    typeof value === 'string' &&
    ['en', 'da', 'de', 'fr', 'es', 'no', 'sv'].includes(value)
  );
}

/**
 * Load the wiki's language state. Absence yields `{ en, en }` (the pre-Phase-7
 * default). Unknown codes in an existing file fall back to 'en' per field so a
 * hand-edited file never crashes an ingest; malformed JSON throws.
 */
export async function readWikiLanguage(wikiDir: string): Promise<WikiLanguageState> {
  const path = wikiLanguagePath(wikiDir);
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ...DEFAULT_WIKI_LANGUAGE };
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Wiki language file is not valid JSON: ${path}`);
  }

  const record = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as {
    outputLanguage?: unknown;
    lastInputLanguage?: unknown;
  };

  return {
    outputLanguage: isLanguageCode(record.outputLanguage) ? record.outputLanguage : 'en',
    lastInputLanguage: isLanguageCode(record.lastInputLanguage) ? record.lastInputLanguage : 'en',
  };
}

/** Persist the wiki's language state (creates `.state/` when needed). */
export async function writeWikiLanguage(wikiDir: string, state: WikiLanguageState): Promise<void> {
  const path = wikiLanguagePath(wikiDir);
  await mkdir(join(wikiDir, '.state'), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}
