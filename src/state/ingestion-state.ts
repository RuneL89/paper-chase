import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * `.state/ingestion.json` — tracks which source PDFs have been ingested so
 * re-runs can skip unchanged files (phase doc §2.3).
 *
 * Shape (exactly):
 * ```json
 * {
 *   "sources": {
 *     "annual-report-2024": {
 *       "hash": "a1b2c3...",
 *       "documentPages": ["documents/annual-report-2024-part-001.md"],
 *       "ingestedAt": "2026-07-16T10:00:00Z"
 *     }
 *   }
 * }
 * ```
 */
export interface SourceIngestionState {
  hash: string;
  /** Wiki-relative paths (forward slashes) of the generated document pages. */
  documentPages: string[];
  /** ISO 8601 timestamp of the first successful ingestion of this source. */
  ingestedAt: string;
}

export interface IngestionState {
  sources: Record<string, SourceIngestionState>;
}

export function emptyIngestionState(): IngestionState {
  return { sources: {} };
}

export function ingestionStatePath(wikiDir: string): string {
  return join(wikiDir, '.state', 'ingestion.json');
}

/**
 * Read `wikis/<slug>/.state/ingestion.json`. Returns an empty state when the
 * file does not exist yet; throws a descriptive error on malformed JSON.
 */
export async function readIngestionState(wikiDir: string): Promise<IngestionState> {
  const path = ingestionStatePath(wikiDir);
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return emptyIngestionState();
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Ingestion state file is not valid JSON: ${path}`);
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as IngestionState).sources !== 'object' ||
    (parsed as IngestionState).sources === null
  ) {
    throw new Error(`Ingestion state file has an unexpected shape (missing "sources"): ${path}`);
  }

  return parsed as IngestionState;
}

/** Write the ingestion state, creating `.state/` if needed. */
export async function writeIngestionState(wikiDir: string, state: IngestionState): Promise<void> {
  await mkdir(join(wikiDir, '.state'), { recursive: true });
  await writeFile(ingestionStatePath(wikiDir), JSON.stringify(state, null, 2) + '\n', 'utf-8');
}
