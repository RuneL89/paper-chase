import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Phase 14 (phase doc §2.7): `.state/curation-report.json` — the per-run
 * observability record for the topic & entity curation stage. Written after
 * every materialize pass in which curation ran (including keep-all fallbacks,
 * so a fallback is always visible). Shape:
 * ```json
 * {
 *   "run": "2026-07-23T10:00:00.000Z",
 *   "topics":    { "merges": [{ "from": ["a"], "into": "b" }], "drops": [], "attempts": 1, "fallbacks": [], "vetoes": [] },
 *   "entities":  { "merges": [], "drops": [], "attempts": 1, "fallbacks": [], "vetoes": [] },
 *   "manualEditSkips": [{ "page": "entities/.../x.md", "concern": "entities", "action": "merge" }],
 *   "removedPages": ["topics/foo/index.md"],
 *   "rewrittenLinks": [{ "path": "documents/chunk-1.md", "hash": "…" }]
 * }
 * ```
 */
export interface CurationReportMerge {
  from: string[];
  into: string;
}

export interface CurationReportFallback {
  /** Which call fell back: 'single', 'bucket-N', or 'reconciliation'. */
  scope: string;
  cause: 'validation-exhaustion' | 'transport-exhaustion' | 'http-4xx';
}

export interface CurationReportVeto {
  from: string;
  into: string;
}

export interface CurationReportConcern {
  merges: CurationReportMerge[];
  /** Topics only; always [] for entities (merge-only). */
  drops: string[];
  attempts: number;
  fallbacks: CurationReportFallback[];
  /** neverMerge pairs vetoed into keep. */
  vetoes: CurationReportVeto[];
}

export interface CurationReportManualEditSkip {
  /** Wiki-relative path of the manually-edited from-page that was kept. */
  page: string;
  concern: 'topics' | 'entities';
  /** The decision that was vetoed for this page. */
  action: 'merge' | 'drop';
}

export interface CurationReportRewrittenLink {
  /** Wiki-relative path of a pre-existing page whose wikilinks were rewritten. */
  path: string;
  /** sha256 of the rewritten content (folded into pageHashes by the caller). */
  hash: string;
}

export interface CurationReport {
  run: string;
  topics: CurationReportConcern;
  entities: CurationReportConcern;
  manualEditSkips: CurationReportManualEditSkip[];
  /** Existing on-disk pages deleted because their slug was merged away/dropped. */
  removedPages: string[];
  rewrittenLinks: CurationReportRewrittenLink[];
}

export function curationReportPath(wikiDir: string): string {
  return join(wikiDir, '.state', 'curation-report.json');
}

/** Write the run's curation report, creating `.state/` if needed. */
export async function writeCurationReport(wikiDir: string, report: CurationReport): Promise<void> {
  await mkdir(join(wikiDir, '.state'), { recursive: true });
  await writeFile(curationReportPath(wikiDir), JSON.stringify(report, null, 2) + '\n', 'utf-8');
}
