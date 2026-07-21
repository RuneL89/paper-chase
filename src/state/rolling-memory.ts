import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Rolling memory reader for `.state/rolling-memory.json` (vision `04` §5).
 *
 * Phase 2 only READS rolling memory (loaded before each chunk extraction so
 * the Extractor can reuse existing folders/entities). Creating and updating
 * the file is the Materializer's job (Phase 3, per `04` §5 "updated after
 * the Materializer finishes") — this module never writes.
 *
 * Vision `04` §5 shape:
 * ```json
 * {
 *   "entities": [{"slug": "john-smith", "folder": "entities/people/executives", "mentionCount": 3}],
 *   "topics": ["financial/revenue-recognition"],
 *   "sources": ["annual-report-2023"],
 *   "folderStructure": ["entities/people/executives", "entities/companies/offshore"]
 * }
 * ```
 */

export interface RollingMemorySummary {
  /** Folder paths from `folderStructure` (empty when the file is absent). */
  folders: string[];
  /** Entity slugs from `entities[].slug` (empty when the file is absent). */
  entitySlugs: string[];
}

export interface RollingMemory {
  entities: Array<{ slug: string; folder: string; mentionCount: number }>;
  topics: string[];
  sources: string[];
  folderStructure: string[];
}

export function rollingMemoryPath(wikiDir: string): string {
  return join(wikiDir, '.state', 'rolling-memory.json');
}

/**
 * Load the rolling-memory summary for the Extractor. Absence is normal on a
 * young wiki and yields empty lists (first-run behavior, phase doc §2.3).
 * Malformed JSON throws a descriptive error (same contract as
 * ingestion-state.ts) so a corrupt file is never silently ignored.
 */
export async function readRollingMemory(wikiDir: string): Promise<RollingMemorySummary> {
  const path = rollingMemoryPath(wikiDir);
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { folders: [], entitySlugs: [] };
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Rolling memory file is not valid JSON: ${path}`);
  }

  const record = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as {
    folderStructure?: unknown;
    entities?: unknown;
  };

  const folders = Array.isArray(record.folderStructure)
    ? record.folderStructure.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const entitySlugs = Array.isArray(record.entities)
    ? record.entities
        .map((entry) => (typeof entry === 'object' && entry !== null ? (entry as { slug?: unknown }).slug : undefined))
        .filter((slug): slug is string => typeof slug === 'string')
    : [];

  return { folders, entitySlugs };
}

/**
 * Persist rolling memory to `.state/rolling-memory.json` (vision `04` §5).
 *
 * The Materializer (Phase 3) is the only caller; Phase 2 and earlier only read
 * this file. Writing is additive and does not change the read-only contract.
 */
export async function saveRollingMemory(wikiDir: string, memory: RollingMemory): Promise<void> {
  const path = rollingMemoryPath(wikiDir);
  await mkdir(join(wikiDir, '.state'), { recursive: true });
  await writeFile(path, JSON.stringify(memory, null, 2) + '\n', 'utf-8');
}

/**
 * Phase 8 (phase doc §2.4): read the FULL rolling memory (including
 * `mentionCount` per entity), returning null when the file does not exist
 * yet. Used to diff memory before/after an ingest run so the compounding
 * metrics know which entities are new and which gained mentions. Malformed
 * JSON throws, same contract as `readRollingMemory`.
 */
export async function readFullRollingMemory(wikiDir: string): Promise<RollingMemory | null> {
  const path = rollingMemoryPath(wikiDir);
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Rolling memory file is not valid JSON: ${path}`);
  }

  const record = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Partial<RollingMemory>;
  return {
    entities: Array.isArray(record.entities)
      ? record.entities
          .map((entry) => entry as { slug?: unknown; folder?: unknown; mentionCount?: unknown })
          .filter((entry) => typeof entry.slug === 'string')
          .map((entry) => ({
            slug: entry.slug as string,
            folder: typeof entry.folder === 'string' ? entry.folder : '',
            mentionCount: typeof entry.mentionCount === 'number' ? entry.mentionCount : 0,
          }))
      : [],
    topics: Array.isArray(record.topics) ? record.topics.filter((t): t is string => typeof t === 'string') : [],
    sources: Array.isArray(record.sources) ? record.sources.filter((s): s is string => typeof s === 'string') : [],
    folderStructure: Array.isArray(record.folderStructure)
      ? record.folderStructure.filter((f): f is string => typeof f === 'string')
      : [],
  };
}
