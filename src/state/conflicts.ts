import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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

export interface ConflictsState {
  conflicts: ConflictEntry[];
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
 */
export async function logConflict(
  wikiDir: string,
  slug: string,
  check: AnyPreservationCheckResult,
  pageType: 'entity' | 'topic',
): Promise<void> {
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
}

export { readConflicts, writeConflicts };
