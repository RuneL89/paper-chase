import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Phase 14 (phase doc §2.7 + gate 14.11): `.state/curation-overrides.json` —
 * the human-editable escape hatch for curation decisions. Shape:
 * ```json
 * { "neverMerge": [["slug-a", "slug-b"]] }
 * ```
 * A listed pair is forced into keep during decision-list validation even when
 * the LLM says merge (validated like any other entry, so the pair still
 * appears in exactly one bucket). The tool NEVER edits this file — it only
 * creates it empty when absent. A malformed file is ignored with a console
 * warning (never crashes the run).
 */
export interface CurationOverrides {
  neverMerge: Array<[string, string]>;
}

export function curationOverridesPath(wikiDir: string): string {
  return join(wikiDir, '.state', 'curation-overrides.json');
}

/**
 * Read the curation overrides. Absent file → created with `{ "neverMerge": [] }`
 * and the empty set returned. Malformed JSON or a malformed `neverMerge` shape
 * → warning + empty set (the run proceeds with no overrides).
 */
export async function readCurationOverrides(wikiDir: string): Promise<CurationOverrides> {
  const path = curationOverridesPath(wikiDir);
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      await mkdir(join(wikiDir, '.state'), { recursive: true });
      await writeFile(path, JSON.stringify({ neverMerge: [] }, null, 2) + '\n', 'utf-8');
      return { neverMerge: [] };
    }
    throw err;
  }
  try {
    const parsed = JSON.parse(raw) as { neverMerge?: unknown };
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      Array.isArray(parsed.neverMerge) &&
      parsed.neverMerge.every(
        (pair) =>
          Array.isArray(pair) &&
          pair.length === 2 &&
          pair.every((slug) => typeof slug === 'string' && slug.length > 0),
      )
    ) {
      return { neverMerge: parsed.neverMerge as Array<[string, string]> };
    }
    console.warn(
      `Warning: .state/curation-overrides.json has a malformed "neverMerge" shape — ignoring overrides for this run.`,
    );
    return { neverMerge: [] };
  } catch {
    console.warn(
      `Warning: .state/curation-overrides.json is not valid JSON — ignoring overrides for this run.`,
    );
    return { neverMerge: [] };
  }
}
