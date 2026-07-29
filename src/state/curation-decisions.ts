import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Phase 21 (phase doc §2.3; canon: vision `04` §3.2 Step 6; backlog B5):
 * `.state/curation-decisions.json` — the STICKY identity-decision record.
 * Every applied curation merge/drop (and, from Phase 22, cluster) is recorded
 * here so later runs NEVER re-litigate it:
 * ```json
 * {
 *   "decisions": [
 *     { "concern": "entities", "action": "merge", "from": ["lpr"],
 *       "into": "landspatientregisteret", "signal": "alias",
 *       "decidedAt": "2026-07-29T10:00:00.000Z", "runId": "2026-07-29T10:00:00.000Z" }
 *   ],
 *   "splits": []
 * }
 * ```
 * - `concern`: 'topics' | 'entities'; `action`: 'merge' | 'drop' | 'cluster'.
 * - `from`: the merged-away/dropped slugs; `into`: the surviving slug (absent
 *   for drops). For a Phase 22 `cluster` record, `into` is the composite
 *   page's slug and `from` lists the OTHER members — `members` re-derives as
 *   `[into, ...from]` — and the optional `class` (1-5, the ratified rollup
 *   class) + `rationale` carry the cluster metadata. `signal`: the
 *   deterministic signal that proposed it
 *   ('transliteration' | 'alias' | 'abbreviation' | 'edit-distance' |
 *   'subsequence' | 'initials' | 'region-form' | 'indicator-form' |
 *   'glossary') or 'model' for open-discovery merges. `decidedAt`/`runId` are
 *   the applying run's timestamps (runId is the curation report's `run`).
 * - Before candidate construction the record is PRE-APPLIED deterministically
 *   (union-find seeded from merges; drops removed), so the model judges only
 *   unstuck candidates.
 * - SPLIT ESCAPE HATCH: a hand-edited `splits: [slug]` list — a recorded
 *   merge/cluster whose `into` or any `from` appears there is un-applied at
 *   the next materialize (union-find reversed, both pages rebuilt, the
 *   reversal logged), and the pair returns to the candidates. The split slug
 *   stays listed until the pair is re-decided: recording a NEW decision
 *   touching it CONSUMES the slug (the tool removes it from `splits`) — for a
 *   PERMANENT veto use `curation-overrides.json` `neverMerge` instead.
 *
 * The tool creates the file empty on first read (the journalist discovers the
 * `splits` knob); a malformed file is backed up to
 * `curation-decisions.corrupt.json` once and rebuilt (never crashes the run).
 */

export type CurationDecisionAction = 'merge' | 'drop' | 'cluster';

export interface CurationDecisionRecord {
  concern: 'topics' | 'entities';
  action: CurationDecisionAction;
  from: string[];
  /** The surviving slug — absent for drops. */
  into?: string;
  /** The deterministic signal that proposed the decision, or 'model'. */
  signal: string;
  decidedAt: string;
  runId: string;
  /**
   * Phase 22 (§2.1): the ratified rollup class (1-5) of a `cluster` record —
   * `members` re-derive as `[into, ...from]`. Absent on merge/drop records.
   */
  class?: number;
  /** Phase 22 (§2.1): the model's few-words rationale for a cluster, when given. */
  rationale?: string;
}

export interface CurationDecisionsData {
  decisions: CurationDecisionRecord[];
  /** Hand-edited escape hatch — slugs whose recorded merges un-apply. */
  splits: string[];
}

export function curationDecisionsPath(wikiDir: string): string {
  return join(wikiDir, '.state', 'curation-decisions.json');
}

function isValidRecord(entry: unknown): entry is CurationDecisionRecord {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    return false;
  }
  const record = entry as Record<string, unknown>;
  return (
    (record.concern === 'topics' || record.concern === 'entities') &&
    (record.action === 'merge' || record.action === 'drop' || record.action === 'cluster') &&
    Array.isArray(record.from) &&
    record.from.every((slug) => typeof slug === 'string' && slug.length > 0) &&
    (record.into === undefined || (typeof record.into === 'string' && record.into.length > 0)) &&
    typeof record.signal === 'string' &&
    typeof record.decidedAt === 'string' &&
    typeof record.runId === 'string' &&
    // Phase 22 (§2.1): optional cluster metadata.
    (record.class === undefined ||
      (typeof record.class === 'number' && Number.isInteger(record.class) && record.class >= 1 && record.class <= 5)) &&
    (record.rationale === undefined || typeof record.rationale === 'string')
  );
}

function parseDecisions(raw: string): CurationDecisionsData | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      Array.isArray(parsed.decisions) &&
      parsed.decisions.every(isValidRecord) &&
      (parsed.splits === undefined ||
        (Array.isArray(parsed.splits) && parsed.splits.every((slug) => typeof slug === 'string' && slug.length > 0)))
    ) {
      return {
        decisions: parsed.decisions as CurationDecisionRecord[],
        splits: (parsed.splits as string[] | undefined) ?? [],
      };
    }
    return null;
  } catch {
    return null;
  }
}

const EMPTY_DECISIONS: CurationDecisionsData = { decisions: [], splits: [] };

/**
 * Read the decisions record. Absent file → created with
 * `{ "decisions": [], "splits": [] }` and the empty record returned (the
 * journalist discovers the `splits` knob, the curation-overrides precedent).
 * Malformed JSON or a malformed shape → console warning + empty record (the
 * run proceeds; the corrupt content is backed up on the next append).
 */
export async function readCurationDecisions(wikiDir: string): Promise<CurationDecisionsData> {
  const path = curationDecisionsPath(wikiDir);
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      await mkdir(join(wikiDir, '.state'), { recursive: true });
      await writeFile(path, JSON.stringify(EMPTY_DECISIONS, null, 2) + '\n', 'utf-8');
      return { decisions: [], splits: [] };
    }
    throw err;
  }
  const parsed = parseDecisions(raw);
  if (parsed === null) {
    console.warn(
      `Warning: .state/curation-decisions.json is malformed — ignoring the sticky record for this run (a fresh file is written on the next applied decision; the corrupt content is backed up).`,
    );
    return { decisions: [], splits: [] };
  }
  return parsed;
}

function recordKey(record: Pick<CurationDecisionRecord, 'concern' | 'action' | 'from' | 'into'>): string {
  return `${record.concern}|${record.action}|${[...record.from].sort().join(',')}|${record.into ?? ''}`;
}

/**
 * Append newly-applied decisions (deduped against the record by
 * concern/action/from-set/into, so the per-PDF materialize calls of one
 * ingest never double-record) and CONSUME split slugs: any `splits` entry
 * touching a new record's `into` or `from` is removed — the reversal served
 * its purpose and the re-decision sticks (a permanent veto belongs in
 * `curation-overrides.json` `neverMerge`). Existing `splits` entries are
 * otherwise preserved byte-for-byte (the tool never edits the hand-maintained
 * list beyond consumption). A malformed on-disk file is backed up to
 * `curation-decisions.corrupt.json` before a fresh record is written.
 */
export async function appendCurationDecisions(wikiDir: string, newRecords: CurationDecisionRecord[]): Promise<void> {
  const path = curationDecisionsPath(wikiDir);
  let base: CurationDecisionsData = { decisions: [], splits: [] };
  let raw: string | null = null;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }
  if (raw !== null) {
    const parsed = parseDecisions(raw);
    if (parsed === null) {
      await mkdir(join(wikiDir, '.state'), { recursive: true });
      await writeFile(curationDecisionsPath(wikiDir).replace('curation-decisions.json', 'curation-decisions.corrupt.json'), raw, 'utf-8');
      console.warn(
        `Warning: .state/curation-decisions.json was malformed — backed up to curation-decisions.corrupt.json and rebuilt fresh.`,
      );
    } else {
      base = parsed;
    }
  }

  const known = new Set(base.decisions.map(recordKey));
  const appended: CurationDecisionRecord[] = [];
  for (const record of newRecords) {
    const key = recordKey(record);
    if (known.has(key)) {
      continue;
    }
    known.add(key);
    appended.push(record);
  }

  // Split consumption keys off the NEWLY APPLIED set (not just the appended
  // set): re-deciding a pair that was split un-applies-then-consumes even
  // when the resulting record duplicates the pre-split one (otherwise the
  // split would keep reversing the re-merge — oscillation).
  const touched = new Set<string>();
  for (const record of newRecords) {
    for (const slug of record.from) {
      touched.add(slug);
    }
    if (record.into !== undefined) {
      touched.add(record.into);
    }
  }
  const splits = base.splits.filter((slug) => !touched.has(slug));

  await mkdir(join(wikiDir, '.state'), { recursive: true });
  await writeFile(
    path,
    JSON.stringify({ decisions: [...base.decisions, ...appended], splits }, null, 2) + '\n',
    'utf-8',
  );
}
