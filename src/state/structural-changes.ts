import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Structural change log for `.state/proposals/structural-changes.json`
 * (vision `03` §5, Phase 9).
 *
 * When the Extractor/Materializer create a new folder under `entities/` or
 * `topics/`, or a new page type appears, the change is appended here for
 * after-the-fact human review (vision `01` §5: structural change review is
 * human, after-the-fact). The AGENTS.md Updater (Phase 9) reads this log to
 * propose constitution updates.
 *
 * Vision `03` §5 shape:
 * ```json
 * {
 *   "changes": [
 *     {
 *       "timestamp": "2026-07-16T10:00:00Z",
 *       "type": "new-folder",
 *       "path": "entities/companies/offshore",
 *       "reason": "47 offshore entities identified in Panama Papers chunk 12",
 *       "affectedEntities": ["acme-bvi", "shell-corp-ltd"]
 *     }
 *   ]
 * }
 * ```
 *
 * Additive extension (compliance-log [2026-07-21 12:00], item 3): a top-level
 * `knownPageTypes` array tracks the Extractor entity types already seen (and
 * already logged), so only genuinely new page types produce `new-page-type`
 * entries. The `changes` array keeps the exact vision shape.
 */

export type StructuralChangeType = 'new-folder' | 'new-page-type' | 'entity-reclassification';

export interface StructuralChange {
  timestamp: string;
  type: StructuralChangeType;
  /** Folder path (new-folder) or page type name (new-page-type). */
  path: string;
  reason: string;
  affectedEntities?: string[];
}

export interface StructuralChangeLog {
  changes: StructuralChange[];
  /** Additive Phase 9 extension: entity types already seen/logged. */
  knownPageTypes: string[];
}

export function structuralChangesPath(wikiDir: string): string {
  return join(wikiDir, '.state', 'proposals', 'structural-changes.json');
}

/**
 * Read the structural change log. Absence is normal on a young wiki and
 * yields an empty log (same first-run contract as rolling-memory.ts);
 * malformed JSON throws a descriptive error so a corrupt proposals file is
 * never silently ignored.
 */
export async function readStructuralChanges(wikiDir: string): Promise<StructuralChangeLog> {
  const path = structuralChangesPath(wikiDir);
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { changes: [], knownPageTypes: [] };
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Structural changes file is not valid JSON: ${path}`);
  }

  const record = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as {
    changes?: unknown;
    knownPageTypes?: unknown;
  };

  const changes = Array.isArray(record.changes)
    ? record.changes.filter(
        (entry): entry is StructuralChange =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as StructuralChange).type === 'string' &&
          typeof (entry as StructuralChange).path === 'string',
      )
    : [];
  const knownPageTypes = Array.isArray(record.knownPageTypes)
    ? record.knownPageTypes.filter((entry): entry is string => typeof entry === 'string')
    : [];

  return { changes, knownPageTypes };
}

/**
 * Append structural changes to the log (vision `03` §5). Creates
 * `.state/proposals/` on first use. `newlySeenPageTypes` are merged into the
 * additive `knownPageTypes` tracker; passing none keeps the tracker as-is.
 * A no-op call (no changes, no new types) never writes the file.
 */
export async function logStructuralChanges(
  wikiDir: string,
  changes: StructuralChange[],
  newlySeenPageTypes: string[] = [],
): Promise<void> {
  if (changes.length === 0 && newlySeenPageTypes.length === 0) {
    return;
  }
  const log = await readStructuralChanges(wikiDir);
  log.changes.push(...changes);
  const known = new Set(log.knownPageTypes);
  for (const type of newlySeenPageTypes) {
    known.add(type);
  }
  log.knownPageTypes = Array.from(known).sort((a, b) => a.localeCompare(b));
  const path = structuralChangesPath(wikiDir);
  await mkdir(join(wikiDir, '.state', 'proposals'), { recursive: true });
  await writeFile(path, JSON.stringify(log, null, 2) + '\n', 'utf-8');
}
