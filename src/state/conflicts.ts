import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { enqueueSerializedWrite } from '../utils/serialized-writes';
import type {
  PreservationCheckResult,
  TopicPreservationCheckResult,
} from '../validation/preservation-check';

export type AnyPreservationCheckResult =
  | PreservationCheckResult
  | TopicPreservationCheckResult;

export interface ConflictEntry {
  /** ISO 8601 timestamp when the conflict was detected. */
  timestamp: string;
  /** Page type whose synthesis failed preservation. */
  pageType: 'entity' | 'topic';
  /** Page slug whose synthesis failed preservation. */
  slug: string;
  /** Which parts of the original data were dropped. */
  dropped: {
    mentions?: string[];
    relationships?: string[];
    claims?: string[];
    citations: string[];
    text?: boolean;
  };
}

/**
 * Phase 8 (phase doc §2.5): a manually-edited page whose update was skipped.
 * The JSON shape is fixed by the phase doc exactly:
 * ```json
 * {
 *   "timestamp": "2026-07-16T10:00:00Z",
 *   "type": "manual-edit",
 *   "page": "entities/people/executives/john-smith.md",
 *   "reason": "Page was manually edited since last ingestion. Skipping update."
 * }
 * ```
 */
export interface ManualEditConflictEntry {
  timestamp: string;
  type: 'manual-edit';
  /** Wiki-relative path (forward slashes) of the skipped page. */
  page: string;
  reason: string;
}

export interface ConflictsState {
  conflicts: Array<ConflictEntry | ManualEditConflictEntry>;
}

function conflictsPath(wikiDir: string): string {
  return join(wikiDir, '.state', 'conflicts.json');
}

async function readConflicts(wikiDir: string): Promise<ConflictsState> {
  try {
    const raw = await readFile(conflictsPath(wikiDir), 'utf-8');
    const parsed = JSON.parse(raw) as ConflictsState;
    if (Array.isArray(parsed.conflicts)) {
      return parsed;
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }
  return { conflicts: [] };
}

async function writeConflicts(wikiDir: string, state: ConflictsState): Promise<void> {
  await mkdir(join(wikiDir, '.state'), { recursive: true });
  await writeFile(conflictsPath(wikiDir), JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

/**
 * Log a preservation-check failure to `.state/conflicts.json`.
 *
 * Conflicts are appended; the file is created if it does not exist.
 * Phase 15 (vision `04` §1): the read-modify-write runs inside the shared
 * per-path serialized write queue so pool workers appending conflicts
 * concurrently never lose or interleave entries.
 */
export async function logConflict(
  wikiDir: string,
  slug: string,
  check: AnyPreservationCheckResult,
  pageType: 'entity' | 'topic',
): Promise<void> {
  await enqueueSerializedWrite(conflictsPath(wikiDir), async () => {
    const state = await readConflicts(wikiDir);
    const entry: ConflictEntry = {
      timestamp: new Date().toISOString(),
      pageType,
      slug,
      dropped: {
        citations: [],
      },
    };

    if ('droppedMentions' in check) {
      entry.dropped.mentions = check.droppedMentions;
      entry.dropped.relationships = check.droppedRelationships;
      entry.dropped.claims = check.droppedClaims;
      entry.dropped.citations = check.droppedCitations;
    } else if ('droppedClaims' in check) {
      entry.dropped.claims = check.droppedClaims;
      entry.dropped.citations = check.droppedCitations;
    }

    state.conflicts.push(entry);
    await writeConflicts(wikiDir, state);
  });
}

/**
 * Phase 8 (phase doc §2.5): log a manual-edit conflict. The Materializer
 * calls this when a page's on-disk content no longer matches the hash
 * recorded at the last ingestion; the update is skipped so the journalist's
 * edit is never overwritten. The file is created if it does not exist.
 * The optional `reason` overrides the default message (used by the
 * fork-reconciliation pass when a manually-edited DUPLICATE page is kept).
 */
export async function logManualEditConflict(wikiDir: string, page: string, reason?: string): Promise<void> {
  await enqueueSerializedWrite(conflictsPath(wikiDir), async () => {
    const state = await readConflicts(wikiDir);
    state.conflicts.push({
      timestamp: new Date().toISOString(),
      type: 'manual-edit',
      page,
      reason: reason ?? 'Page was manually edited since last ingestion. Skipping update.',
    });
    await writeConflicts(wikiDir, state);
  });
}

export { readConflicts, writeConflicts };
