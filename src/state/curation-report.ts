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
 * Phase 21 (§2.1–§2.3) additive fields (all optional so pre-Phase-21 reports
 * stay readable): per-concern `fromSticky` (merges/drops pre-applied from
 * `.state/curation-decisions.json`), `decidedThisRun` (merges with their
 * signal + evidence, drops, and pair `denials`), `proposedPairs` (the
 * confirm-deny list the model saw), `autoApplied` (the no-LLM tier), and a
 * top-level `splitReversals` (records un-applied by the `splits` escape
 * hatch or a neverMerge veto). The legacy `merges`/`drops` fields keep
 * their exact pre-Phase-21 shape (decided-this-run, no signal fields).
 */
export interface CurationReportMerge {
  from: string[];
  into: string;
}

/** Phase 21: a decided-this-run merge with its provenance. */
export interface CurationReportMergeDetail {
  from: string[];
  into: string;
  /** The deterministic signal that proposed it, or 'model' for open discovery. */
  signal: string;
  evidence?: string;
}

/** Phase 21 (§2.2): a proposed pair the model denied (or left unjudged). */
export interface CurationReportDenial {
  from: string;
  into: string;
  justification?: string;
}

/** Phase 21 (§2.1/§2.2): a deterministic pair with signal + evidence. */
export interface CurationReportPair {
  from: string;
  into: string;
  signal: string;
  evidence: string;
}

/**
 * Phase 22 (§2.1): a composite-cluster entry in the report — sticky
 * pre-applied, decided this run (with provenance), or proposed (with
 * evidence). `members` carries `into` first.
 */
export interface CurationReportCluster {
  members: string[];
  class: number;
  into: string;
  signal?: string;
  evidence?: string;
  rationale?: string;
}

/** Phase 22 (§2.1): a proposed cluster the model denied (or left unjudged). */
export interface CurationReportClusterDenial {
  members: string[];
  class: number;
  into: string;
  rationale?: string;
}

/** Phase 21 (§2.3): sticky decisions pre-applied before candidate construction. */
export interface CurationReportStickySet {
  merges: CurationReportMerge[];
  drops: string[];
  /** Phase 22 (§2.1): sticky cluster records pre-applied this run. */
  clusters?: CurationReportCluster[];
}

/** Phase 21: the decisions taken THIS run (auto + confirmed + open model). */
export interface CurationReportDecidedSet {
  merges: CurationReportMergeDetail[];
  drops: string[];
  denials: CurationReportDenial[];
  /** Phase 22 (§2.1): composite clusters decided + applied this run. */
  clusters?: CurationReportCluster[];
  /** Phase 22 (§2.1): proposed clusters the model denied. */
  clusterDenials?: CurationReportClusterDenial[];
}

/** Phase 21 (§2.3): a recorded decision un-applied this run. */
export interface CurationReportSplitReversal {
  concern: 'topics' | 'entities';
  from: string[];
  into?: string;
  reason: 'split' | 'neverMerge';
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
  /** neverMerge pairs vetoed into keep (incl. Phase 21 auto-tier vetoes). */
  vetoes: CurationReportVeto[];
  /** Phase 21 (§2.3): sticky merges/drops pre-applied from the decisions record. */
  fromSticky?: CurationReportStickySet;
  /** Phase 21: this run's decisions with provenance + the pair denials. */
  decidedThisRun?: CurationReportDecidedSet;
  /** Phase 21 (§2.2): the proposed pairs the model was asked to judge. */
  proposedPairs?: CurationReportPair[];
  /** Phase 21 (§2.1): pairs applied with no LLM call (near-zero-risk signals). */
  autoApplied?: CurationReportPair[];
  /** Phase 22 (§2.1): the proposed clusters the model was asked to judge. */
  proposedClusters?: CurationReportCluster[];
}

export interface CurationReportManualEditSkip {
  /** Wiki-relative path of the manually-edited from-page that was kept. */
  page: string;
  concern: 'topics' | 'entities';
  /** The decision that was vetoed for this page. */
  action: 'merge' | 'drop' | 'cluster';
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
  /** Phase 21 (§2.3): recorded decisions un-applied this run (splits / neverMerge). */
  splitReversals?: CurationReportSplitReversal[];
}

export function curationReportPath(wikiDir: string): string {
  return join(wikiDir, '.state', 'curation-report.json');
}

/** Write the run's curation report, creating `.state/` if needed. */
export async function writeCurationReport(wikiDir: string, report: CurationReport): Promise<void> {
  await mkdir(join(wikiDir, '.state'), { recursive: true });
  await writeFile(curationReportPath(wikiDir), JSON.stringify(report, null, 2) + '\n', 'utf-8');
}
