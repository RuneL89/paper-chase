import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { callLLM } from '../llm/client';
import { runWithFeedbackRetry } from '../llm/reask';
import { appRoot } from '../utils/app-root';
import {
  applyLanguageDirective,
  buildLanguageDirective,
  type LanguageCode,
} from '../utils/language';
import { stripCodeFences } from './extractor';
import { SYNTHESIS_MAX_TOKENS } from './synthesis';
import {
  curationPairKey,
  isIndicatorSlug,
  regionSlugStem,
  type ProposedCluster,
  type ProposedPair,
} from './pre-merge';

/**
 * Phase 14 (phase doc §2.2; canon: vision `04` §3.2 Step 6 aggregate → curate
 * → apply → write, vision `05` §7 topic eligibility + §6 entity identity,
 * vision `07` §2.3 decision-list validation + §5 keep-all fallback; decision
 * record `Project Vision/optimizations/optimizations.md` L3 + L3e, ratified
 * 2026-07-23): the topic & entity curation agent.
 *
 * TWO per-materialize LLM calls (topics and entities — independent, awaited
 * in parallel by the materializer) return strict JSON decision lists that
 * deterministic code validates and applies:
 *   - Topics: merge duplicates (same theme, different wording/plural/form),
 *     drop non-topics (meta-descriptors of the documents' rhetoric), keep the
 *     rest.
 *   - Entities: MERGE-ONLY (never drop) under the strict-identity rule — name
 *     variants, abbreviations, translations, word-order permutations of the
 *     SAME real-world thing. The optional `unsure` bucket folds into keep
 *     (asymmetry: a false merge is far worse than a false keep).
 *
 * Phase 16 (vision `04` Step 6 + `07` §2.3, user-ratified 2026-07-25): the
 * output schema is SLIM — neither prompt lists a `keep` bucket; kept
 * candidates are the deterministic complement (input minus merges, drops,
 * and `unsure`), computed by validation code. Legacy outputs that still
 * emit `keep` are accepted only when exactly consistent, rejected when
 * contradictory. Bucketing triggers on candidate count (250) OR on the
 * decision-list size estimate approaching the output ceiling, whichever
 * comes first.
 *
 * Phase 21 (§2.2, backlog B5): the calls gain a PROPOSED PAIRS section —
 * deterministic pre-merge proposals (`src/agents/pre-merge.ts`) the model
 * CONFIRMS or DENIES with a few-words justification. Confirmed pairs join
 * the merge edges and apply exactly like model merges; denials are recorded;
 * unjudged pairs are denials. Proposed-pair slugs leave the open candidate
 * list (open discovery runs over the unproposed candidates only) and are
 * always judged in exactly ONE call (the single call, or the reconciliation
 * — signal-aware grouping replaces plain lexical-stem bucketing so a pair
 * is never split). neverMerge vetoes apply to confirmed pairs too. With no
 * proposed pairs the prompt and the behavior stay byte-identical.
 *
 * Phase 22 (§2.1, the five-class rollup amendment): the entity call gains a
 * PROPOSED CLUSTERS section — deterministic COMPOSITE proposals (class 3
 * indicator↔concept, class 5 region name-forms) judged confirm/deny via the
 * additive `"clusters"` output, which also carries OPEN cluster decisions
 * (the judgment classes 2 brand↔generic and 4 facility↔city). Deterministic
 * validation enforces the ratified rules: every member exists, class ∈ 1-5,
 * 2 ≤ members ≤ 4, class-3 exactly 2 members (one indicator + one concept),
 * class-5 same slug-stem, `into` ∈ members, neverMerge pairs veto, no member
 * in two clusters, cluster members stay out of the merge/unsure/pairs
 * buckets, and a confirmed pair never overlaps an applied cluster. Confirmed
 * clusters land in `decisions.clusters`; denials (unjudged included) are
 * recorded; topics never cluster.
 *
 * Every failure mode lands on the keep-all fallback: curation is skipped and
 * the materializer writes all candidates exactly as pre-Phase-14 (no data
 * loss; self-healing because the input includes the on-disk set). Decisions
 * are applied ALL-OR-NOTHING — validation runs on the complete list before
 * anything is applied.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** One topic as presented to the curation call (phase doc §2.2 input builder). */
export interface TopicCurationCandidate {
  slug: string;
  title: string;
  folder: string;
  claimCount: number;
  /** Up to 3 sample claims, each truncated to ~200 chars. */
  sampleClaims: string[];
  /** True when a page for this slug already exists on disk. */
  onDisk: boolean;
}

/** One entity as presented to the curation call (phase doc §2.2 input builder). */
export interface EntityCurationCandidate {
  slug: string;
  title: string;
  type: string;
  folder: string;
  mentionCount: number;
  significance: string;
  disambiguation?: string;
  /** 1-2 sample mention contexts, truncated — identity needs evidence text. */
  sampleMentions: string[];
  /** True when a page for this slug already exists on disk. */
  onDisk: boolean;
  /**
   * Phase 21 (§2.1 alias signal): frontmatter aliases (aggregate-merged
   * variant titles ∪ on-disk aliases). Omitted from the prompt JSON when
   * empty so alias-less candidates keep the pre-Phase-21 prompt bytes.
   */
  aliases?: string[];
}

export type CurationCandidate = TopicCurationCandidate | EntityCurationCandidate;

export interface CurationMergeDecision {
  from: string[];
  into: string;
}

/**
 * Phase 22 (§2.1, the five-class rollup amendment): a COMPOSITE-cluster
 * decision — 2-4 entities that are NOT the same real-world thing but
 * logically map to each other inside one of the five ratified rollup classes.
 * Their identities stay in the graph (no merge); only the PAGE is shared (the
 * composite lives at `into`'s slug). `members` carries `into` first.
 */
export interface CurationClusterDecision {
  members: string[];
  /** The ratified rollup class (1-5). */
  class: number;
  /** One of the members — the composite page takes its slug and folder. */
  into: string;
  /** The model's few-words rationale (judgment classes 2/4 especially). */
  rationale?: string;
}

/**
 * Phase 22 (§2.1/§2.2): the model's verdict on one deterministically
 * proposed cluster (class 3 indicator↔concept, class 5 region name-forms).
 * `confirm` applies the composite exactly like a model cluster; `deny` keeps
 * every member as its own page (an unjudged proposal is a denial).
 */
export interface ClusterVerdict {
  members: string[];
  class: number;
  into: string;
  verdict: 'confirm' | 'deny';
  rationale?: string;
}

/**
 * A validated, fully-collapsed decision list. Every input slug is accounted
 * for exactly once: merge.from / merge.into / drop are explicit, and `keep`
 * is the DERIVED complement (every candidate not merged away or dropped —
 * Phase 16 keep-complement; `unsure` folds in, a merge's `into` is kept by
 * surviving). Merge chains are already resolved by union-find.
 */
export interface CurationDecisions {
  merges: CurationMergeDecision[];
  /** Topics only; always [] for entities (merge-only). */
  drops: string[];
  /** Derived by validation — never model-listed (Phase 16 slim schema). */
  keep: string[];
  /**
   * Phase 22 (§2.1): validated COMPOSITE-cluster decisions (entities only —
   * confirmed deterministic proposals plus open judgment-class clusters).
   * Absent/empty on the pre-Phase-22 paths.
   */
  clusters?: CurationClusterDecision[];
}

export type TopicDecisions = CurationDecisions;
export type EntityDecisions = CurationDecisions;

export type CurationFallbackCause =
  | 'validation-exhaustion'
  | 'transport-exhaustion'
  | 'http-4xx';

export interface CurationFallback {
  /** Which call fell back: 'single', 'bucket-N', or 'reconciliation'. */
  scope: string;
  cause: CurationFallbackCause;
}

/**
 * Phase 21 (§2.2 confirm-deny): the model's verdict on one proposed pair.
 * `confirm` applies the merge exactly like a model merge; `deny` keeps both
 * (a proposed pair the model did not judge is a denial without justification).
 */
export interface PairVerdict {
  from: string;
  into: string;
  verdict: 'confirm' | 'deny';
  justification?: string;
}

export interface CurationOutcome {
  /**
   * The validated decisions; null ONLY on the single-call path's keep-all
   * fallback. The two-round path always returns a list — per-bucket and
   * reconciliation keep-all fallbacks are folded in as keep decisions and
   * recorded in `fallbacks`.
   */
  decisions: CurationDecisions | null;
  attempts: number;
  fallbacks: CurationFallback[];
  /** neverMerge pairs vetoed into keep during validation. */
  vetoes: Array<{ from: string; into: string }>;
  /**
   * Phase 21 (§2.2): the verdicts on the proposed pairs (confirm + deny).
   * Confirmed merges are already inside `decisions.merges`; denials are
   * recorded here for the report. Absent when no pairs were proposed.
   */
  pairVerdicts?: PairVerdict[];
  /**
   * Phase 22 (§2.1): the verdicts on the proposed clusters (confirm + deny).
   * Confirmed clusters are already inside `decisions.clusters`; denials are
   * recorded here for the report. Absent when no clusters were proposed.
   */
  clusterVerdicts?: ClusterVerdict[];
}

export type TopicCurationOutcome = CurationOutcome;
export type EntityCurationOutcome = CurationOutcome;

/** The transport seam's option shape (mirrors the callLLM subset curation uses). */
export interface CurationLlmCallOptions {
  maxTokens: number;
  maxRetries: number;
  callType: string;
  context?: string;
  logPath?: string;
}

export type CurationLlmFn = (prompt: string, options: CurationLlmCallOptions) => Promise<string>;

export interface CurateCallOptions {
  /** Wiki constitution appended to the prompt (matches the other agents). */
  agentsMd: string;
  /** Run language pair for the {languageDirective} fill; absent → en/en. */
  language?: { input: LanguageCode; output: LanguageCode };
  /** `.state/llm-calls.json` path — every call is logged. */
  logPath?: string;
  /** Human-curated never-merge pairs (`.state/curation-overrides.json`). */
  neverMerge?: Array<[string, string]>;
  /**
   * Phase 21 (§2.2): deterministic pre-merge proposals (from the §2.1
   * pre-merge engine) carried in the prompt's PROPOSED PAIRS section and
   * judged confirm/deny by the model. Proposed-pair slugs are NOT in the
   * candidate list (open discovery runs over the unproposed candidates only)
   * and are always co-located in ONE call — the single call, or the
   * reconciliation call on the two-round path (signal-aware grouping).
   */
  proposedPairs?: ProposedPair[];
  /**
   * Phase 22 (§2.1): deterministic CLUSTER proposals (class 3
   * indicator↔concept, class 5 region name-forms — from the §2.1 pre-merge
   * engine) carried in the entity prompt's PROPOSED CLUSTERS section and
   * judged confirm/deny via the `"clusters"` output, exactly like the pairs.
   * Proposed-cluster members are NOT in the open candidate list and are
   * always co-located in ONE call. Entities only — never passed for topics.
   */
  proposedClusters?: ProposedCluster[];
  /** Test-only transport seam (keeps every gate LLM-free). Defaults to callLLM. */
  callLLMFn?: CurationLlmFn;
}

export interface DecisionValidation {
  valid: boolean;
  errors: string[];
  decisions?: CurationDecisions;
  vetoes?: Array<{ from: string; into: string }>;
  /** Phase 21 (§2.2): the model's verdicts on the proposed pairs. */
  pairVerdicts?: PairVerdict[];
  /** Phase 22 (§2.1): the model's verdicts on the proposed clusters. */
  clusterVerdicts?: ClusterVerdict[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Phase 14 (phase doc §2.2): above this candidate count the two-round scheme
 * kicks in (deterministic lexical-stem buckets, one validated call per
 * bucket, then one global reconciliation call over the survivors). At or
 * below, one call per concern — unless the decision-list SIZE estimate says
 * otherwise (Phase 16).
 */
export const CURATION_SINGLE_CALL_LIMIT = 250;

/**
 * Phase 16 (vision `04` Step 6 decision-list sizing + `07` §2.3,
 * user-ratified 2026-07-25): the two-round scheme ALSO kicks in when the
 * estimated decision-list output approaches the output-token ceiling, even
 * below the 250-candidate count trigger — a verbose list can overflow the
 * ceiling well below 250 candidates, and truncation is a failure the reask
 * cannot repair. 75% of the 32768 ceiling (a conservative fraction).
 */
export const CURATION_SIZE_TRIGGER_TOKENS = 24_576;

/**
 * Phase 16: conservative estimate of a decision list's output size in
 * tokens. Worst case lists every candidate slug once (~slug length + 4 chars
 * of quotes/comma per slug) plus per-decision JSON scaffolding and the
 * prompt's capped justification allowance (~60 chars per candidate), at ~4
 * chars per token. An over-estimate only ever triggers the SAFE path
 * (bucketing), never a data-loss path.
 */
export function estimateDecisionListTokens(candidates: ReadonlyArray<{ slug: string }>): number {
  let chars = 0;
  for (const candidate of candidates) {
    chars += candidate.slug.length + 4 + 60;
  }
  return Math.ceil(chars / 4);
}

/** Phase 12 reask bound: 3 total attempts per curation call (vision `07` §2.3). */
const CURATION_MAX_ATTEMPTS = 3;
/** Transient transport retries INSIDE callLLM (429/5xx/network; 429/5xx → 3 total). */
const CURATION_MAX_RETRIES = 2;
/** Decision lists for ~300 topics run 5-8K output — the Phase 13 ceiling. */
const CURATION_MAX_TOKENS = SYNTHESIS_MAX_TOKENS;

const PROMPT_FILES = {
  topics: 'curation-topics.prompt.txt',
  entities: 'curation-entities.prompt.txt',
} as const;

type Concern = keyof typeof PROMPT_FILES;

const promptCache: Partial<Record<Concern, string>> = {};

async function loadPromptTemplate(kind: Concern): Promise<string> {
  const cached = promptCache[kind];
  if (cached !== undefined) {
    return cached;
  }
  const template = await readFile(join(appRoot(), 'prompts', PROMPT_FILES[kind]), 'utf-8');
  promptCache[kind] = template;
  return template;
}

function fillPromptTemplate(template: string, values: Record<string, string>): string {
  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.split(`{${key}}`).join(value);
  }
  return output;
}

// ---------------------------------------------------------------------------
// Input-builder helpers (phase doc §2.2)
// ---------------------------------------------------------------------------

/** Truncate an evidence sample to ~200 chars for the curation payload. */
export function truncateSample(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function formatCandidatesBlock(candidates: CurationCandidate[], kind: Concern): string {
  const records = candidates.map((candidate) => {
    if (kind === 'topics') {
      const topic = candidate as TopicCurationCandidate;
      return {
        slug: topic.slug,
        title: topic.title,
        folder: topic.folder,
        claimCount: topic.claimCount,
        sampleClaims: topic.sampleClaims,
        onDisk: topic.onDisk,
      };
    }
    const entity = candidate as EntityCurationCandidate;
    return {
      slug: entity.slug,
      title: entity.title,
      type: entity.type,
      folder: entity.folder,
      mentionCount: entity.mentionCount,
      significance: entity.significance,
      ...(entity.disambiguation !== undefined ? { disambiguation: entity.disambiguation } : {}),
      sampleMentions: entity.sampleMentions,
      onDisk: entity.onDisk,
      // Phase 21 (§2.1): aliases only when present — alias-less candidates
      // keep the pre-Phase-21 prompt bytes (the disambiguation precedent).
      ...(entity.aliases !== undefined && entity.aliases.length > 0 ? { aliases: entity.aliases } : {}),
    };
  });
  return JSON.stringify(records, null, 2);
}

// ---------------------------------------------------------------------------
// Phase 21 (§2.2): the PROPOSED PAIRS prompt section
// ---------------------------------------------------------------------------

/** Render the proposed pairs (signal + evidence) for the prompt section. */
export function formatProposedPairsBlock(pairs: ProposedPair[]): string {
  return JSON.stringify(
    pairs.map((pair) => ({
      from: pair.from,
      into: pair.into,
      signal: pair.signal,
      evidence: pair.evidence,
    })),
    null,
    2,
  );
}

/**
 * Remove the whole PROPOSED PAIRS section when no pairs were detected —
 * the no-pairs prompt stays byte-identical to the pre-Phase-21 template
 * (the `applyLanguageDirective` empty-block precedent, CRLF-safe).
 */
export function stripProposedPairsBlock(prompt: string): string {
  return prompt
    .split('\n=== PROPOSED PAIRS ===\n{proposedPairs}\n=== END PROPOSED PAIRS ===\n')
    .join('')
    .split('\r\n=== PROPOSED PAIRS ===\r\n{proposedPairs}\r\n=== END PROPOSED PAIRS ===\r\n')
    .join('');
}

// ---------------------------------------------------------------------------
// Phase 22 (§2.1): the PROPOSED CLUSTERS prompt section
// ---------------------------------------------------------------------------

/** Render the proposed clusters (members, class, into, signal, evidence). */
export function formatProposedClustersBlock(clusters: ProposedCluster[]): string {
  return JSON.stringify(
    clusters.map((cluster) => ({
      members: cluster.members,
      class: cluster.class,
      into: cluster.into,
      signal: cluster.signal,
      evidence: cluster.evidence,
    })),
    null,
    2,
  );
}

/**
 * Remove the whole PROPOSED CLUSTERS section when no clusters were detected —
 * the no-clusters prompt stays byte-identical to the pre-Phase-22 template
 * (the `stripProposedPairsBlock` precedent, CRLF-safe).
 */
export function stripProposedClustersBlock(prompt: string): string {
  return prompt
    .split('\n=== PROPOSED CLUSTERS ===\n{proposedClusters}\n=== END PROPOSED CLUSTERS ===\n')
    .join('')
    .split('\r\n=== PROPOSED CLUSTERS ===\r\n{proposedClusters}\r\n=== END PROPOSED CLUSTERS ===\r\n')
    .join('');
}

// ---------------------------------------------------------------------------
// Two-round scaling: deterministic lexical-stem bucketing (phase doc §2.2)
// ---------------------------------------------------------------------------

/**
 * The bucket stem of a transliterated slug (language-agnostic): lowercase,
 * trailing plural 's' stripped per segment (so "external-factor" and
 * "external-factors" share a bucket), trailing pure-digit segments dropped
 * (so "odense-2" buckets with "odense"). Bucketing only groups candidates
 * for the round-1 calls — merging remains the LLM's validated decision.
 */
export function bucketStem(slug: string): string {
  const segments = slug
    .toLowerCase()
    .split('-')
    .map((segment) => (segment.length > 3 && segment.endsWith('s') ? segment.slice(0, -1) : segment));
  while (segments.length > 1 && /^\d+$/.test(segments[segments.length - 1])) {
    segments.pop();
  }
  return segments.join('-');
}

/**
 * Bucket candidates deterministically by lexical stem: stems sorted, groups
 * packed consecutively up to `maxBucketSize` so likely duplicates share a
 * bucket (a single stem group larger than the limit is split in order).
 */
export function bucketCandidates<T extends { slug: string }>(candidates: T[], maxBucketSize: number): T[][] {
  const byStem = new Map<string, T[]>();
  for (const candidate of candidates) {
    const stem = bucketStem(candidate.slug);
    const group = byStem.get(stem) ?? [];
    group.push(candidate);
    byStem.set(stem, group);
  }
  const buckets: T[][] = [];
  let current: T[] = [];
  for (const stem of Array.from(byStem.keys()).sort()) {
    for (const candidate of byStem.get(stem) ?? []) {
      if (current.length >= maxBucketSize) {
        buckets.push(current);
        current = [];
      }
      current.push(candidate);
    }
  }
  if (current.length > 0) {
    buckets.push(current);
  }
  return buckets;
}

/**
 * Phase 16 (vision `04` Step 6): the production bucketing — the same
 * deterministic stem-ordered packing as `bucketCandidates`, but a bucket
 * closes on EITHER constraint: the 250-candidate count limit OR the
 * decision-list size estimate approaching the ceiling (so each bucket's own
 * validated call also fits its output budget). For normal slug sets the
 * count constraint binds first and the buckets are exactly the Phase 14
 * ones; pathologically verbose sets bucket earlier.
 *
 * Phase 21 (§2.2 signal-aware grouping): proposed-pair slugs are never
 * split across buckets — pair edges among the bucketed slugs form
 * union-find components that pack as units (components ordered by their
 * smallest stem, members stem-ordered inside). With no pair edges among the
 * bucketed slugs the algorithm is the byte-identical Phase 16 one. (In the
 * production flow proposed-pair members leave the open candidate list
 * entirely and are judged in one call, so they are always co-located; this
 * guard keeps any caller that passes pair members in the candidate set
 * equally safe.)
 */
function bucketCandidatesSized<T extends { slug: string }>(
  candidates: T[],
  proposedPairs: ProposedPair[] = [],
  proposedClusters: ProposedCluster[] = [],
): T[][] {
  const present = new Set(candidates.map((candidate) => candidate.slug));
  const pairEdges = proposedPairs.filter((pair) => present.has(pair.from) && present.has(pair.into));
  // Phase 22: proposed-cluster members pack as one unit too (a cluster is
  // never split across buckets) — every member pair becomes a grouping edge.
  const clusterEdges: Array<{ from: string; into: string }> = [];
  for (const cluster of proposedClusters) {
    const members = cluster.members.filter((member) => present.has(member));
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        clusterEdges.push({ from: members[i], into: members[j] });
      }
    }
  }
  const groupingEdges: Array<{ from: string; into: string }> = [...pairEdges, ...clusterEdges];
  if (groupingEdges.length === 0) {
    // Byte-identical Phase 16 algorithm.
    const byStem = new Map<string, T[]>();
    for (const candidate of candidates) {
      const stem = bucketStem(candidate.slug);
      const group = byStem.get(stem) ?? [];
      group.push(candidate);
      byStem.set(stem, group);
    }
    const buckets: T[][] = [];
    let current: T[] = [];
    for (const stem of Array.from(byStem.keys()).sort()) {
      for (const candidate of byStem.get(stem) ?? []) {
        const wouldExceedCount = current.length >= CURATION_SINGLE_CALL_LIMIT;
        const wouldExceedSize =
          current.length > 0 && estimateDecisionListTokens([...current, candidate]) >= CURATION_SIZE_TRIGGER_TOKENS;
        if (wouldExceedCount || wouldExceedSize) {
          buckets.push(current);
          current = [];
        }
        current.push(candidate);
      }
    }
    if (current.length > 0) {
      buckets.push(current);
    }
    return buckets;
  }

  // Signal-aware grouping: union-find over the pair edges; components pack
  // as units so a proposed pair is never split across buckets.
  const parent = new Map<string, string>(candidates.map((candidate) => [candidate.slug, candidate.slug]));
  const find = (slug: string): string => {
    let root = parent.get(slug) ?? slug;
    if (root !== slug) {
      root = find(root);
      parent.set(slug, root);
    }
    return root;
  };
  for (const pair of groupingEdges) {
    const rootFrom = find(pair.from);
    const rootInto = find(pair.into);
    if (rootFrom !== rootInto) {
      parent.set(rootFrom, rootInto);
    }
  }
  const components = new Map<string, T[]>();
  for (const candidate of candidates) {
    const root = find(candidate.slug);
    const group = components.get(root) ?? [];
    group.push(candidate);
    components.set(root, group);
  }
  const componentList = Array.from(components.values()).map((group) =>
    [...group].sort((a, b) => bucketStem(a.slug).localeCompare(bucketStem(b.slug)) || a.slug.localeCompare(b.slug)),
  );
  componentList.sort((a, b) => {
    const stemA = bucketStem(a[0].slug);
    const stemB = bucketStem(b[0].slug);
    return stemA.localeCompare(stemB) || a[0].slug.localeCompare(b[0].slug);
  });
  const buckets: T[][] = [];
  let current: T[] = [];
  for (const component of componentList) {
    for (const candidate of component) {
      const wouldExceedCount = current.length >= CURATION_SINGLE_CALL_LIMIT;
      const wouldExceedSize =
        current.length > 0 && estimateDecisionListTokens([...current, candidate]) >= CURATION_SIZE_TRIGGER_TOKENS;
      if (wouldExceedCount || wouldExceedSize) {
        buckets.push(current);
        current = [];
      }
      current.push(candidate);
    }
  }
  if (current.length > 0) {
    buckets.push(current);
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// Deterministic decision-list validation (phase doc §2.2, vision `07` §2.3)
// ---------------------------------------------------------------------------

interface ParsedPairJudgment {
  from: string;
  into: string;
  confirm: boolean;
  justification?: string;
}

/** Phase 22 (§2.1): one parsed `"clusters"` entry (proposal judgment or open decision). */
interface ParsedClusterEntry {
  members: string[];
  class: number;
  into: string;
  /** Required on proposal judgments; absent (or true) on open decisions. */
  confirm?: boolean;
  rationale?: string;
}

interface ParsedDecisionList {
  merge: Array<{ from: string[]; into: string }>;
  drop: string[];
  keep: string[];
  unsure: string[];
  /** Phase 21 (§2.2): confirm/deny judgments on the proposed pairs. */
  pairs: ParsedPairJudgment[];
  /** Phase 22 (§2.1): cluster judgments (proposals) + open cluster decisions. */
  clusters: ParsedClusterEntry[];
}

/** Union-find over merge edges with path compression (chain resolution). */
class UnionFind {
  private readonly parent = new Map<string, string>();

  find(slug: string): string {
    let root = this.parent.get(slug);
    if (root === undefined) {
      this.parent.set(slug, slug);
      return slug;
    }
    if (root !== slug) {
      root = this.find(root);
      this.parent.set(slug, root);
    }
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      this.parent.set(rootA, rootB);
    }
  }
}

function pairKey(a: string, b: string): string {
  return curationPairKey(a, b);
}

/** Phase 21 (§2.2): justifications are capped ("a few words") deterministically. */
const PAIR_JUSTIFICATION_MAX_CHARS = 120;

function parseDecisionList(rawText: string, kind: Concern): { parsed?: ParsedDecisionList; errors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(stripCodeFences(rawText));
  } catch (err) {
    return { errors: [`output is not valid JSON (${(err as Error).message}) — return only the JSON object`] };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { errors: ['output must be a single JSON object with "merge", "drop" (topics), "unsure" (entities) buckets — kept candidates are derived automatically'] };
  }
  const obj = raw as Record<string, unknown>;
  const errors: string[] = [];

  const merge: Array<{ from: string[]; into: string }> = [];
  if (!Array.isArray(obj.merge)) {
    errors.push('"merge" must be an array of { "from": [slugs], "into": slug } entries');
  } else {
    obj.merge.forEach((entry, index) => {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        errors.push(`merge[${index}] must be an object { "from": [slugs], "into": slug }`);
        return;
      }
      const record = entry as Record<string, unknown>;
      if (
        !Array.isArray(record.from) ||
        record.from.length === 0 ||
        !record.from.every((slug) => typeof slug === 'string' && slug.length > 0)
      ) {
        errors.push(`merge[${index}].from must be a non-empty array of slugs`);
        return;
      }
      if (typeof record.into !== 'string' || record.into.length === 0) {
        errors.push(`merge[${index}].into must be a slug string`);
        return;
      }
      merge.push({ from: [...new Set(record.from as string[])], into: record.into });
    });
  }

  const stringBucket = (name: string, required: boolean): string[] => {
    const value = obj[name];
    if (value === undefined && !required) {
      return [];
    }
    if (!Array.isArray(value) || !value.every((slug) => typeof slug === 'string' && slug.length > 0)) {
      errors.push(`"${name}" must be an array of slugs`);
      return [];
    }
    return [...new Set(value as string[])];
  };

  const drop = kind === 'topics' ? stringBucket('drop', true) : [];
  if (kind === 'entities' && Array.isArray(obj.drop) && obj.drop.length > 0) {
    errors.push('entity curation is merge-only — the "drop" bucket is not allowed; move those slugs to "keep" or "unsure"');
  }
  // Phase 16 (keep-complement): the "keep" bucket is OPTIONAL — the slim
  // schema omits it entirely and kept candidates are derived; a legacy
  // output that still lists it is validated for consistency below.
  const keep = stringBucket('keep', false);
  const unsure = stringBucket('unsure', false);

  // Phase 21 (§2.2 confirm-deny): the optional "pairs" array — one entry per
  // judged proposed pair { from, into, confirm, justification? }.
  const pairs: ParsedPairJudgment[] = [];
  if (obj.pairs !== undefined) {
    if (!Array.isArray(obj.pairs)) {
      errors.push('"pairs" must be an array of { "from": slug, "into": slug, "confirm": boolean, "justification"?: string } entries');
    } else {
      obj.pairs.forEach((entry, index) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
          errors.push(`pairs[${index}] must be an object { "from": slug, "into": slug, "confirm": boolean }`);
          return;
        }
        const record = entry as Record<string, unknown>;
        if (typeof record.from !== 'string' || record.from.length === 0) {
          errors.push(`pairs[${index}].from must be a slug string`);
          return;
        }
        if (typeof record.into !== 'string' || record.into.length === 0) {
          errors.push(`pairs[${index}].into must be a slug string`);
          return;
        }
        if (typeof record.confirm !== 'boolean') {
          errors.push(`pairs[${index}].confirm must be true or false`);
          return;
        }
        const justification =
          typeof record.justification === 'string' && record.justification.trim().length > 0
            ? record.justification.trim().slice(0, PAIR_JUSTIFICATION_MAX_CHARS)
            : undefined;
        pairs.push({
          from: record.from,
          into: record.into,
          confirm: record.confirm,
          ...(justification !== undefined ? { justification } : {}),
        });
      });
    }
  }

  // Phase 22 (§2.1): the optional "clusters" array — one entry per judged
  // proposed cluster { members, class, into, confirm, rationale? } or per
  // open cluster decision { members, class, into, rationale? }.
  const clusters: ParsedClusterEntry[] = [];
  if (obj.clusters !== undefined) {
    if (!Array.isArray(obj.clusters)) {
      errors.push('"clusters" must be an array of { "members": [slugs], "class": 1-5, "into": slug, "confirm"?: boolean, "rationale"?: string } entries');
    } else if (kind === 'topics' && obj.clusters.length > 0) {
      errors.push('topic curation does not cluster — the "clusters" output is entities-only (return "clusters": [])');
    } else {
      obj.clusters.forEach((entry, index) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
          errors.push(`clusters[${index}] must be an object { "members": [slugs], "class": 1-5, "into": slug }`);
          return;
        }
        const record = entry as Record<string, unknown>;
        if (
          !Array.isArray(record.members) ||
          record.members.length === 0 ||
          !record.members.every((slug) => typeof slug === 'string' && slug.length > 0)
        ) {
          errors.push(`clusters[${index}].members must be a non-empty array of slugs`);
          return;
        }
        if (typeof record.class !== 'number' || !Number.isInteger(record.class)) {
          errors.push(`clusters[${index}].class must be an integer (1-5)`);
          return;
        }
        if (typeof record.into !== 'string' || record.into.length === 0) {
          errors.push(`clusters[${index}].into must be a slug string`);
          return;
        }
        if (record.confirm !== undefined && typeof record.confirm !== 'boolean') {
          errors.push(`clusters[${index}].confirm must be true or false when present`);
          return;
        }
        const rationale =
          typeof record.rationale === 'string' && record.rationale.trim().length > 0
            ? record.rationale.trim().slice(0, PAIR_JUSTIFICATION_MAX_CHARS)
            : undefined;
        clusters.push({
          members: [...new Set(record.members as string[])],
          class: record.class,
          into: record.into,
          ...(record.confirm !== undefined ? { confirm: record.confirm } : {}),
          ...(rationale !== undefined ? { rationale } : {}),
        });
      });
    }
  }

  if (errors.length > 0) {
    return { errors };
  }
  return { parsed: { merge, drop, keep, unsure, pairs, clusters }, errors: [] };
}

/**
 * Validate a raw curation response against the candidate set. The rule
 * classes (phase doc §2.2 / gate 14.1; Phase 16 keep-complement): unknown
 * slug; slug in two buckets; legacy-'keep' contradiction; `into` dropped or
 * merged-away (a chain with no unique survivor); self-merge. Kept candidates
 * are DERIVED (input minus merges/drops/unsure), so omission is never an
 * error — a legacy 'keep' list is accepted only when exactly consistent.
 * Chains (A→B, B→C) are NOT rejected — union-find collapses them to their
 * canonical survivor first (gate 14.2). neverMerge pairs are vetoed into
 * keep before collapsing, so the pair is validated like any other entry
 * (phase doc §2.7).
 *
 * Phase 21 (§2.2 confirm-deny): the optional `proposedPairs` are judged via
 * the output's `pairs` array. Every judgment must copy a proposed pair's
 * `from`/`into` EXACTLY (unproposed judgments and duplicates are rejected);
 * proposed-pair slugs may NOT also appear in the merge/drop/keep/unsure
 * buckets (they are judged in "pairs" only); a confirmed pair joins the
 * merge edges (neverMerge vetoes apply to it too, gate 21.8); a denied or
 * unjudged pair keeps both slugs (they land in the derived keep).
 */
function validateDecisionList(
  rawText: string,
  candidateSlugs: ReadonlySet<string>,
  neverMerge: Array<[string, string]>,
  kind: Concern,
  proposedPairs: ProposedPair[] = [],
  proposedClusters: ProposedCluster[] = [],
): DecisionValidation {
  const { parsed, errors: parseErrors } = parseDecisionList(rawText, kind);
  if (!parsed) {
    return { valid: false, errors: parseErrors };
  }
  const errors: string[] = [];
  const vetoPairs = new Set(neverMerge.map(([a, b]) => pairKey(a, b)));

  // Phase 21 (§2.2): pair judgments must reference actually-proposed pairs,
  // exactly once each; proposed-pair slugs are off-limits for the buckets.
  const proposedKeys = new Set(proposedPairs.map((pair) => `${pair.from} ${pair.into}`));
  const pairMembers = new Set<string>();
  for (const pair of proposedPairs) {
    pairMembers.add(pair.from);
    pairMembers.add(pair.into);
  }
  const judgedKeys = new Set<string>();
  for (const judgment of parsed.pairs) {
    const key = `${judgment.from} ${judgment.into}`;
    if (judgment.from === judgment.into) {
      errors.push(`self-merge in pair judgment ${JSON.stringify(judgment)} — a slug cannot merge into itself`);
      continue;
    }
    if (!proposedKeys.has(key)) {
      errors.push(
        `pair judgment '${judgment.from}' -> '${judgment.into}' was not proposed — judge only the pairs listed in PROPOSED PAIRS`,
      );
      continue;
    }
    if (judgedKeys.has(key)) {
      errors.push(`pair '${judgment.from}' -> '${judgment.into}' was judged twice — each proposed pair is judged at most once`);
      continue;
    }
    judgedKeys.add(key);
  }
  for (const entry of parsed.merge) {
    for (const slug of [...entry.from, entry.into]) {
      if (pairMembers.has(slug)) {
        errors.push(`slug '${slug}' is covered by a proposed pair — judge it in "pairs", not in the merge bucket`);
      }
    }
  }
  for (const bucket of ['drop', 'keep', 'unsure'] as const) {
    for (const slug of parsed[bucket]) {
      if (pairMembers.has(slug)) {
        errors.push(`slug '${slug}' is covered by a proposed pair — judge it in "pairs", not in the ${bucket} bucket`);
      }
    }
  }

  // ------------------------------------------------------------------
  // Phase 22 (§2.1): CLUSTER entries — classify each as a judgment of a
  // deterministically proposed cluster (member set must match a proposal
  // exactly, class/into copied, judged at most once) or an OPEN decision
  // (judgment classes 2/4, full class-rule validation). Proposed-cluster
  // members are off-limits for the merge/drop/keep/unsure buckets and for
  // open clusters (judge them via their proposal entry); the applied set
  // (confirmed proposals + open decisions) must be member-disjoint and
  // disjoint from every confirmed pair.
  // ------------------------------------------------------------------
  const clusterLabel = (members: string[]): string => `[${[...members].sort().join(' ')}]`;
  const proposalByMemberSet = new Map<string, ProposedCluster>();
  const proposedClusterMembers = new Set<string>();
  for (const cluster of proposedClusters) {
    proposalByMemberSet.set(clusterLabel(cluster.members), cluster);
    for (const member of cluster.members) {
      proposedClusterMembers.add(member);
    }
  }
  const judgedProposalKeys = new Set<string>();
  const appliedClusters: CurationClusterDecision[] = [];
  for (const entry of parsed.clusters) {
    const key = clusterLabel(entry.members);
    const proposal = proposalByMemberSet.get(key);
    if (proposal !== undefined) {
      if (judgedProposalKeys.has(key)) {
        errors.push(`cluster ${key} was judged twice — each proposed cluster is judged at most once`);
        continue;
      }
      judgedProposalKeys.add(key);
      if (entry.confirm === undefined) {
        errors.push(`cluster judgment ${key} must carry "confirm": true or false`);
        continue;
      }
      if (entry.class !== proposal.class) {
        errors.push(`cluster judgment ${key} has class ${entry.class} but the proposal is class ${proposal.class} — copy the proposal exactly`);
        continue;
      }
      if (entry.into !== proposal.into) {
        errors.push(`cluster judgment ${key} has into '${entry.into}' but the proposal's into is '${proposal.into}' — copy the proposal exactly`);
        continue;
      }
      if (entry.confirm) {
        appliedClusters.push({
          members: [...proposal.members],
          class: proposal.class,
          into: proposal.into,
          ...(entry.rationale !== undefined ? { rationale: entry.rationale } : {}),
        });
      }
      continue;
    }
    if (entry.confirm === false) {
      errors.push(`cluster ${key} was not proposed and cannot be denied — omit a cluster you do not want`);
      continue;
    }
    if (!entry.members.includes(entry.into)) {
      errors.push(`cluster ${key} into '${entry.into}' must be one of its members — the composite page takes a member's slug`);
      continue;
    }
    appliedClusters.push({
      // Deterministic member order — `into` first, the rest sorted — so the
      // composite (title, fingerprint) is byte-identical when the sticky
      // record re-derives the member set on later runs.
      members: [entry.into, ...entry.members.filter((member) => member !== entry.into).sort()],
      class: entry.class,
      into: entry.into,
      ...(entry.rationale !== undefined ? { rationale: entry.rationale } : {}),
    });
  }

  // Semantic rules over the applied clusters (gate 22.1's exact error lists).
  for (const cluster of appliedClusters) {
    const label = clusterLabel(cluster.members);
    if (cluster.class < 1 || cluster.class > 5) {
      errors.push(`cluster ${label} has class ${cluster.class} — the class must be 1-5 (the five ratified rollup classes)`);
    }
    if (cluster.members.length < 2 || cluster.members.length > 4) {
      errors.push(`cluster ${label} has ${cluster.members.length} members — a composite page takes 2-4 members`);
    }
    if (!cluster.members.includes(cluster.into)) {
      errors.push(`cluster ${label} into '${cluster.into}' must be one of its members — the composite page takes a member's slug`);
    }
    if (cluster.class === 3) {
      if (cluster.members.length !== 2) {
        errors.push(`class-3 cluster ${label} has ${cluster.members.length} members — indicator↔measured concept is 1:1 only (exactly 2 members)`);
      } else {
        const indicators = cluster.members.filter((member) => isIndicatorSlug(member));
        if (indicators.length !== 1) {
          errors.push(`class-3 cluster ${label} needs exactly one indicator slug (indikator-N[-name]) and one concept slug — got ${indicators.length} indicator slugs`);
        }
      }
    }
    if (cluster.class === 5) {
      const stems = Array.from(new Set(cluster.members.map((member) => regionSlugStem(member)))).sort();
      if (stems.length !== 1) {
        errors.push(`class-5 cluster ${label} members must share the same slug-stem — got stems [${stems.join(', ')}]`);
      }
    }
    for (const slug of cluster.members) {
      if (!candidateSlugs.has(slug)) {
        errors.push(`unknown slug '${slug}' in cluster ${label}`);
      }
      if (proposedClusterMembers.has(slug) && !judgedProposalKeys.has(label)) {
        errors.push(`slug '${slug}' is covered by a proposed cluster — judge it in the "clusters" entry for that proposal, not in a new cluster`);
      }
      if (pairMembers.has(slug) && !judgedProposalKeys.has(label)) {
        errors.push(`slug '${slug}' is covered by a proposed pair — judge it in "pairs", not in a cluster`);
      }
    }
    if (!candidateSlugs.has(cluster.into)) {
      errors.push(`unknown slug '${cluster.into}' in cluster ${label} into`);
    }
    for (let i = 0; i < cluster.members.length; i++) {
      for (let j = i + 1; j < cluster.members.length; j++) {
        if (vetoPairs.has(pairKey(cluster.members[i], cluster.members[j]))) {
          errors.push(
            `cluster ${label} contains the neverMerge pair '${cluster.members[i]}' + '${cluster.members[j]}' — the human veto stands; drop the cluster`,
          );
        }
      }
    }
  }
  // Double membership across the applied set.
  const clusterMemberHolder = new Map<string, string>();
  for (const cluster of appliedClusters) {
    for (const member of cluster.members) {
      const holder = clusterMemberHolder.get(member);
      if (holder !== undefined) {
        errors.push(`slug '${member}' appears in two clusters (${holder} and ${clusterLabel(cluster.members)}) — a member belongs to exactly one cluster`);
      } else {
        clusterMemberHolder.set(member, clusterLabel(cluster.members));
      }
    }
  }
  const appliedClusterMembers = new Set(appliedClusters.flatMap((cluster) => cluster.members));
  // Cluster members stay out of the merge/drop/keep/unsure buckets.
  for (const entry of parsed.merge) {
    for (const slug of [...entry.from, entry.into]) {
      if (proposedClusterMembers.has(slug)) {
        errors.push(`slug '${slug}' is covered by a proposed cluster — judge it in "clusters", not in the merge bucket`);
      } else if (appliedClusterMembers.has(slug)) {
        errors.push(`slug '${slug}' is decided by a cluster — it must not also appear in the merge bucket`);
      }
    }
  }
  for (const bucket of ['drop', 'keep', 'unsure'] as const) {
    for (const slug of parsed[bucket]) {
      if (proposedClusterMembers.has(slug)) {
        errors.push(`slug '${slug}' is covered by a proposed cluster — judge it in "clusters", not in the ${bucket} bucket`);
      } else if (appliedClusterMembers.has(slug)) {
        errors.push(`slug '${slug}' is decided by a cluster — it must not also appear in the ${bucket} bucket`);
      }
    }
  }
  // A confirmed pair and an applied cluster never share a slug.
  for (const judgment of parsed.pairs) {
    if (!judgment.confirm) {
      continue;
    }
    if (appliedClusterMembers.has(judgment.from) || appliedClusterMembers.has(judgment.into)) {
      errors.push(
        `the confirmed pair '${judgment.from}' -> '${judgment.into}' overlaps a cluster — decide the slug in exactly one place (pair OR cluster)`,
      );
    }
  }

  // Rule: every slug mentioned exists in the input set.
  for (const entry of parsed.merge) {
    for (const from of entry.from) {
      if (!candidateSlugs.has(from)) {
        errors.push(`unknown slug '${from}' in merge entry ${JSON.stringify(entry)}`);
      }
    }
    if (!candidateSlugs.has(entry.into)) {
      errors.push(`unknown slug '${entry.into}' in merge entry ${JSON.stringify(entry)}`);
    }
  }
  for (const slug of parsed.drop) {
    if (!candidateSlugs.has(slug)) {
      errors.push(`unknown slug '${slug}' in "drop"`);
    }
  }
  for (const slug of parsed.keep) {
    if (!candidateSlugs.has(slug)) {
      errors.push(`unknown slug '${slug}' in "keep"`);
    }
  }
  for (const slug of parsed.unsure) {
    if (!candidateSlugs.has(slug)) {
      errors.push(`unknown slug '${slug}' in "unsure"`);
    }
  }
  for (const judgment of parsed.pairs) {
    if (!candidateSlugs.has(judgment.from)) {
      errors.push(`unknown slug '${judgment.from}' in pair judgment`);
    }
    if (!candidateSlugs.has(judgment.into)) {
      errors.push(`unknown slug '${judgment.into}' in pair judgment`);
    }
  }

  // Rule: no self-merges.
  for (const entry of parsed.merge) {
    if (entry.from.includes(entry.into)) {
      errors.push(`self-merge ${JSON.stringify(entry)} — a slug cannot merge into itself`);
    }
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // neverMerge vetoes (phase doc §2.7): remove vetoed edges before collapsing;
  // with the edge gone, both slugs land in the derived keep automatically.
  // Phase 21: confirmed pair edges take the same veto path (gate 21.8).
  const edges: Array<{ from: string; into: string }> = [];
  const vetoes: Array<{ from: string; into: string }> = [];
  for (const entry of parsed.merge) {
    for (const from of entry.from) {
      if (vetoPairs.has(pairKey(from, entry.into))) {
        vetoes.push({ from, into: entry.into });
      } else {
        edges.push({ from, into: entry.into });
      }
    }
  }
  const confirmedJudgments = parsed.pairs.filter((judgment) => judgment.confirm);
  for (const judgment of confirmedJudgments) {
    if (vetoPairs.has(pairKey(judgment.from, judgment.into))) {
      vetoes.push({ from: judgment.from, into: judgment.into });
    } else {
      edges.push({ from: judgment.from, into: judgment.into });
    }
  }

  // Phase 21 (§2.2): verdict bookkeeping — every proposed pair is accounted
  // for: judged confirm/deny, or unjudged (a denial without justification).
  const pairVerdicts: PairVerdict[] = [];
  for (const pair of proposedPairs) {
    const judgment = parsed.pairs.find((entry) => entry.from === pair.from && entry.into === pair.into);
    if (judgment === undefined) {
      pairVerdicts.push({ from: pair.from, into: pair.into, verdict: 'deny' });
    } else {
      pairVerdicts.push({
        from: pair.from,
        into: pair.into,
        verdict: judgment.confirm ? 'confirm' : 'deny',
        ...(judgment.justification !== undefined ? { justification: judgment.justification } : {}),
      });
    }
  }

  // Phase 22 (§2.1): cluster verdict bookkeeping — every proposed cluster is
  // accounted for: judged confirm/deny, or unjudged (a denial).
  const clusterVerdicts: ClusterVerdict[] = [];
  for (const proposal of proposedClusters) {
    const key = [...proposal.members].sort().join(' ');
    const judgment = parsed.clusters.find((entry) => [...entry.members].sort().join(' ') === key);
    const confirmed = judgment?.confirm === true;
    clusterVerdicts.push({
      members: [...proposal.members],
      class: proposal.class,
      into: proposal.into,
      verdict: confirmed ? 'confirm' : 'deny',
      ...(judgment?.rationale !== undefined ? { rationale: judgment.rationale } : {}),
    });
  }

  // Union-find chain resolution: components collapse to their canonical
  // survivor — the member used as `into` but never as `from`.
  const unionFind = new UnionFind();
  for (const edge of edges) {
    unionFind.union(edge.from, edge.into);
  }
  const components = new Map<string, Set<string>>();
  for (const edge of edges) {
    for (const slug of [edge.from, edge.into]) {
      const root = unionFind.find(slug);
      const members = components.get(root) ?? new Set<string>();
      members.add(slug);
      components.set(root, members);
    }
  }
  const merges: CurationMergeDecision[] = [];
  for (const members of components.values()) {
    const roots = [...members].filter(
      (member) => edges.some((edge) => edge.into === member) && !edges.some((edge) => edge.from === member),
    );
    if (roots.length !== 1) {
      errors.push(
        `merge instructions among [${[...members].sort().join(', ')}] have no unique survivor — ` +
          `every merge chain must converge on one 'into' that is itself kept (not merged away)`,
      );
      continue;
    }
    const into = roots[0];
    merges.push({ from: [...members].filter((member) => member !== into).sort(), into });
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Bucket accounting: a slug listed in TWO places is still rejected
  // (post-collapse merge membership plus the raw drop/unsure/keep buckets).
  // Phase 16 (keep-complement): OMISSION is no longer an error — every
  // candidate not listed anywhere is kept automatically (the derived keep),
  // so the old missing-from-every-bucket class exists only as a legacy-keep
  // contradiction, checked below.
  const membership = new Map<string, Set<string>>();
  const addMembership = (slug: string, bucket: string): void => {
    const buckets = membership.get(slug) ?? new Set<string>();
    buckets.add(bucket);
    membership.set(slug, buckets);
  };
  for (const merge of merges) {
    for (const from of merge.from) {
      addMembership(from, 'merge.from');
    }
    addMembership(merge.into, 'merge.into');
  }
  for (const slug of parsed.drop) {
    addMembership(slug, 'drop');
  }
  for (const slug of parsed.keep) {
    addMembership(slug, 'keep');
  }
  for (const slug of parsed.unsure) {
    addMembership(slug, 'unsure');
  }
  for (const [slug, buckets] of membership) {
    if (buckets.size > 1) {
      errors.push(
        `slug '${slug}' appears in multiple buckets (${[...buckets].sort().join(', ')}) — every candidate ` +
          `must appear in exactly one place; a merge's 'into' must not also appear in keep/drop/unsure`,
      );
    }
  }

  // Rule: every `into` is itself kept (not dropped; merged-away is impossible
  // post-collapse — chains already resolved).
  for (const merge of merges) {
    if (parsed.drop.includes(merge.into)) {
      errors.push(`merge target '${merge.into}' is dropped — every 'into' must be kept`);
    }
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Phase 16 (vision `04` Step 6 + `07` §2.3, user-ratified 2026-07-25): the
  // kept set is DERIVED — every candidate not merged away and not dropped
  // (a merge's 'into' is kept by surviving; 'unsure' folds into keep). A
  // legacy output that still emits a 'keep' list is accepted only when the
  // list is EXACTLY consistent with the raw buckets (every candidate the
  // model did not merge away, target a merge, drop, or mark unsure) and is
  // rejected as contradictory otherwise.
  if (parsed.keep.length > 0) {
    const rawFrom = new Set(parsed.merge.flatMap((entry) => entry.from));
    const rawInto = new Set(parsed.merge.map((entry) => entry.into));
    const expectedKeep = new Set<string>();
    for (const slug of candidateSlugs) {
      if (
        !rawFrom.has(slug) &&
        !rawInto.has(slug) &&
        !parsed.drop.includes(slug) &&
        !parsed.unsure.includes(slug) &&
        // Phase 22: a clustered slug is decided — it is not part of the keep set.
        !appliedClusterMembers.has(slug)
      ) {
        expectedKeep.add(slug);
      }
    }
    const emitted = new Set(parsed.keep);
    const missing = [...expectedKeep].filter((slug) => !emitted.has(slug)).sort();
    const unexpected = [...emitted].filter((slug) => !expectedKeep.has(slug)).sort();
    if (missing.length > 0 || unexpected.length > 0) {
      const parts: string[] = [];
      if (missing.length > 0) {
        parts.push(`kept by the other buckets but not listed: ${missing.join(', ')}`);
      }
      if (unexpected.length > 0) {
        parts.push(`listed but accounted for elsewhere: ${unexpected.join(', ')}`);
      }
      return {
        valid: false,
        errors: [
          `the 'keep' list contradicts the merge/drop/unsure buckets (${parts.join('; ')}) — ` +
            `kept candidates are derived automatically; omit 'keep' entirely`,
        ],
      };
    }
  }

  const mergedAway = new Set(merges.flatMap((merge) => merge.from));
  const droppedSet = new Set(parsed.drop);
  const keep: string[] = [];
  for (const slug of candidateSlugs) {
    // Phase 22: clustered slugs are decided (the composite page covers them).
    if (!mergedAway.has(slug) && !droppedSet.has(slug) && !appliedClusterMembers.has(slug)) {
      keep.push(slug);
    }
  }
  keep.sort((a, b) => a.localeCompare(b));
  return {
    valid: true,
    errors: [],
    decisions: {
      merges,
      drops: parsed.drop,
      keep,
      // Phase 22 (§2.1): emitted only when non-empty — pre-Phase-22 decision
      // shapes stay byte-identical.
      ...(appliedClusters.length > 0 ? { clusters: appliedClusters } : {}),
    },
    vetoes,
    ...(proposedPairs.length > 0 ? { pairVerdicts } : {}),
    ...(proposedClusters.length > 0 ? { clusterVerdicts } : {}),
  };
}

/** Validate a topic curation response (exported for the gate-14.1/14.2 tests). */
export function validateTopicDecisions(
  rawText: string,
  candidateSlugs: ReadonlySet<string>,
  neverMerge: Array<[string, string]> = [],
  proposedPairs: ProposedPair[] = [],
): DecisionValidation {
  return validateDecisionList(rawText, candidateSlugs, neverMerge, 'topics', proposedPairs);
}

/** Validate an entity curation response (exported for the gate-14.1/14.2/22.1 tests). */
export function validateEntityDecisions(
  rawText: string,
  candidateSlugs: ReadonlySet<string>,
  neverMerge: Array<[string, string]> = [],
  proposedPairs: ProposedPair[] = [],
  proposedClusters: ProposedCluster[] = [],
): DecisionValidation {
  return validateDecisionList(rawText, candidateSlugs, neverMerge, 'entities', proposedPairs, proposedClusters);
}

// ---------------------------------------------------------------------------
// The curation calls (phase doc §2.2)
// ---------------------------------------------------------------------------

function classifyFallbackCause(err: unknown): CurationFallbackCause {
  const message = err instanceof Error ? err.message : String(err);
  const http = /HTTP (\d{3})/.exec(message);
  // Mirror callLLM's own transient class (429/5xx/network): a 429 that burned
  // through its bounded transport retries is transient exhaustion, not a
  // deterministic 4xx (which is never retried).
  if (http !== null && Number(http[1]) >= 400 && Number(http[1]) < 500 && Number(http[1]) !== 429) {
    return 'http-4xx';
  }
  return 'transport-exhaustion';
}

interface SingleCallResult {
  decisions: CurationDecisions | null;
  attempts: number;
  fallback: CurationFallback | null;
  vetoes: Array<{ from: string; into: string }>;
  /** Phase 21 (§2.2): the model's verdicts on the proposed pairs of this call. */
  pairVerdicts: PairVerdict[];
  /** Phase 22 (§2.1): the model's verdicts on the proposed clusters of this call. */
  clusterVerdicts: ClusterVerdict[];
}

/**
 * One validated curation call over one candidate set: prompt → LLM →
 * deterministic validation, re-asked ≤3 times via the Phase 12
 * runWithFeedbackRetry with the exact offending entries fed back. Exhaustion
 * and every thrown transport error land on the keep-all fallback (decisions
 * null) — the caller writes the candidates as pre-Phase-14.
 *
 * Phase 21 (§2.2): `proposedPairs` (deterministic pre-merge proposals) fill
 * the prompt's PROPOSED PAIRS section (removed byte-identically when empty)
 * and extend the validation candidate set — proposed-pair slugs are judged
 * in the "pairs" output only, never in the buckets.
 */
async function curateSingleCall(
  kind: Concern,
  candidates: CurationCandidate[],
  options: CurateCallOptions,
  scope: string,
  proposedPairs: ProposedPair[] = [],
  proposedClusters: ProposedCluster[] = [],
): Promise<SingleCallResult> {
  const template = await loadPromptTemplate(kind);
  let withoutEmptyBlocks =
    proposedPairs.length === 0 ? stripProposedPairsBlock(template) : template;
  if (proposedClusters.length === 0) {
    withoutEmptyBlocks = stripProposedClustersBlock(withoutEmptyBlocks);
  }
  const filled = fillPromptTemplate(withoutEmptyBlocks, {
    agentsMd: options.agentsMd.trim().length > 0 ? options.agentsMd : '(No AGENTS.md provided.)',
    candidates: formatCandidatesBlock(candidates, kind),
    proposedPairs: formatProposedPairsBlock(proposedPairs),
    proposedClusters: formatProposedClustersBlock(proposedClusters),
  });
  const basePrompt = applyLanguageDirective(
    filled,
    buildLanguageDirective('curation', options.language?.input ?? 'en', options.language?.output ?? 'en'),
  );
  const candidateSlugs = new Set(candidates.map((candidate) => candidate.slug));
  for (const pair of proposedPairs) {
    candidateSlugs.add(pair.from);
    candidateSlugs.add(pair.into);
  }
  for (const cluster of proposedClusters) {
    for (const member of cluster.members) {
      candidateSlugs.add(member);
    }
  }
  const llm: CurationLlmFn =
    options.callLLMFn ?? ((prompt, callOptions) => callLLM(prompt, undefined, callOptions));

  let attemptsMade = 0;
  // The latest validation result, pushed from inside the validate closure.
  // An array (not a scalar let) because TS narrows closure-assigned scalars to
  // `never` at the post-await reads.
  const validations: DecisionValidation[] = [];
  let thrown: unknown;
  let outcome: Awaited<ReturnType<typeof runWithFeedbackRetry<string>>> | null = null;
  try {
    outcome = await runWithFeedbackRetry<string>(
      (feedback, attempt) => {
        attemptsMade = attempt;
        return llm(feedback === null ? basePrompt : `${basePrompt}\n\n${feedback}`, {
          maxTokens: CURATION_MAX_TOKENS,
          maxRetries: CURATION_MAX_RETRIES,
          callType: 'curation',
          context: attempt > 1 ? `${scope}#attempt${attempt}` : scope,
          logPath: options.logPath,
        });
      },
      (text) => {
        const validation: DecisionValidation = validateDecisionList(
          text,
          candidateSlugs,
          options.neverMerge ?? [],
          kind,
          proposedPairs,
          proposedClusters,
        );
        validations.push(validation);
        return { valid: validation.valid, errors: validation.errors };
      },
      { label: scope, maxAttempts: CURATION_MAX_ATTEMPTS },
    );
  } catch (err) {
    thrown = err;
  }

  if (outcome === null) {
    // HTTP 4xx throws immediately inside callLLM (zero transport retries, zero
    // reasks); transient exhaustion throws after the bounded retries. Both land
    // on the keep-all fallback with their cause recorded (phase doc §2.2).
    return {
      decisions: null,
      attempts: Math.max(attemptsMade, 1),
      fallback: { scope, cause: classifyFallbackCause(thrown) },
      vetoes: [],
      pairVerdicts: [],
      clusterVerdicts: [],
    };
  }
  if (outcome.output === null) {
    return {
      decisions: null,
      attempts: outcome.attempts,
      fallback: { scope, cause: 'validation-exhaustion' },
      vetoes: [],
      pairVerdicts: [],
      clusterVerdicts: [],
    };
  }
  const captured = validations[validations.length - 1];
  return {
    decisions: captured?.decisions ?? null,
    attempts: outcome.attempts,
    fallback: null,
    vetoes: captured?.vetoes ?? [],
    pairVerdicts: captured?.pairVerdicts ?? [],
    clusterVerdicts: captured?.clusterVerdicts ?? [],
  };
}

/**
 * Apply decision lists LOGICALLY to compute the survivor candidate set for
 * the reconciliation round: merged-away and dropped slugs leave the set;
 * survivors of a merge carry the unioned counts and evidence samples so
 * round 2 judges the same information.
 */
function computeSurvivors(
  candidates: CurationCandidate[],
  decisionLists: CurationDecisions[],
  kind: Concern,
): CurationCandidate[] {
  const bySlug = new Map(candidates.map((candidate) => [candidate.slug, candidate]));
  const absorbedInto = new Map<string, string>();
  const dropped = new Set<string>();
  const clustered = new Set<string>();
  for (const decisions of decisionLists) {
    for (const merge of decisions.merges) {
      for (const from of merge.from) {
        absorbedInto.set(from, merge.into);
      }
    }
    for (const slug of decisions.drops) {
      dropped.add(slug);
    }
    // Phase 22 (§2.1): clustered members are decided — they leave the
    // reconciliation round's candidate set (the composite covers them).
    for (const cluster of decisions.clusters ?? []) {
      for (const member of cluster.members) {
        clustered.add(member);
      }
    }
  }
  const survivors: CurationCandidate[] = [];
  for (const candidate of candidates) {
    if (absorbedInto.has(candidate.slug) || dropped.has(candidate.slug) || clustered.has(candidate.slug)) {
      continue;
    }
    const absorbed = [...absorbedInto.entries()]
      .filter(([, into]) => into === candidate.slug)
      .map(([from]) => bySlug.get(from))
      .filter((entry): entry is CurationCandidate => entry !== undefined);
    if (absorbed.length === 0) {
      survivors.push(candidate);
      continue;
    }
    if (kind === 'topics') {
      const base = candidate as TopicCurationCandidate;
      const merged: TopicCurationCandidate = {
        ...base,
        claimCount: absorbed.reduce((count, entry) => count + (entry as TopicCurationCandidate).claimCount, base.claimCount),
        sampleClaims: [
          ...base.sampleClaims,
          ...absorbed.flatMap((entry) => (entry as TopicCurationCandidate).sampleClaims),
        ].slice(0, 3),
        onDisk: base.onDisk || absorbed.some((entry) => entry.onDisk),
      };
      survivors.push(merged);
    } else {
      const base = candidate as EntityCurationCandidate;
      const merged: EntityCurationCandidate = {
        ...base,
        mentionCount: absorbed.reduce((count, entry) => count + (entry as EntityCurationCandidate).mentionCount, base.mentionCount),
        sampleMentions: [
          ...base.sampleMentions,
          ...absorbed.flatMap((entry) => (entry as EntityCurationCandidate).sampleMentions),
        ].slice(0, 2),
        onDisk: base.onDisk || absorbed.some((entry) => entry.onDisk),
      };
      survivors.push(merged);
    }
  }
  return survivors;
}

/**
 * Compose the round-1 lists (original slugs) and the round-2 list (survivor
 * slugs — always original slugs too, since an `into` is always an input
 * slug) into ONE final decision list over the original candidate set.
 * Union-find collapses cross-round chains; a dropped canonical takes its
 * whole component with it (the unioned topic/entity is discarded as one).
 * The composite satisfies every validation invariant by construction.
 */
function composeDecisions(
  candidates: CurationCandidate[],
  roundOne: CurationDecisions[],
  roundTwo: CurationDecisions | null,
): CurationDecisions {
  const edges: Array<{ from: string; into: string }> = [];
  const dropped = new Set<string>();
  const clustered = new Set<string>();
  const clusters: CurationClusterDecision[] = [];
  for (const decisions of roundOne) {
    for (const merge of decisions.merges) {
      for (const from of merge.from) {
        edges.push({ from, into: merge.into });
      }
    }
    for (const slug of decisions.drops) {
      dropped.add(slug);
    }
    for (const cluster of decisions.clusters ?? []) {
      clusters.push(cluster);
      for (const member of cluster.members) {
        clustered.add(member);
      }
    }
  }
  if (roundTwo !== null) {
    for (const merge of roundTwo.merges) {
      for (const from of merge.from) {
        edges.push({ from, into: merge.into });
      }
    }
    for (const slug of roundTwo.drops) {
      dropped.add(slug);
    }
    for (const cluster of roundTwo.clusters ?? []) {
      clusters.push(cluster);
      for (const member of cluster.members) {
        clustered.add(member);
      }
    }
  }

  const unionFind = new UnionFind();
  for (const edge of edges) {
    unionFind.union(edge.from, edge.into);
  }
  const components = new Map<string, Set<string>>();
  for (const edge of edges) {
    for (const slug of [edge.from, edge.into]) {
      const root = unionFind.find(slug);
      const members = components.get(root) ?? new Set<string>();
      members.add(slug);
      components.set(root, members);
    }
  }

  const merges: CurationMergeDecision[] = [];
  const mergedAway = new Set<string>();
  for (const members of components.values()) {
    const roots = [...members].filter(
      (member) => edges.some((edge) => edge.into === member) && !edges.some((edge) => edge.from === member),
    );
    // Both rounds were validated, so every component has a unique survivor;
    // a defensive fallthrough keeps the component kept when it somehow does not.
    if (roots.length !== 1) {
      continue;
    }
    const into = roots[0];
    if (dropped.has(into)) {
      for (const member of members) {
        dropped.add(member);
      }
      continue;
    }
    const from = [...members].filter((member) => member !== into).sort();
    merges.push({ from, into });
    for (const slug of from) {
      mergedAway.add(slug);
    }
  }

  const keep: string[] = [];
  for (const candidate of candidates) {
    if (!mergedAway.has(candidate.slug) && !dropped.has(candidate.slug) && !clustered.has(candidate.slug)) {
      keep.push(candidate.slug);
    }
  }
  return {
    merges,
    drops: [...dropped].sort(),
    keep: keep.sort(),
    // Phase 22 (§2.1): round-1 clusters plus the reconciliation's clusters —
    // cross-round double membership is impossible by construction (clustered
    // members leave the survivor set).
    ...(clusters.length > 0 ? { clusters } : {}),
  };
}

/**
 * Curate one concern (topics or entities) with the two-round scaling scheme
 * (phase doc §2.2; Phase 16 sizing): at or below CURATION_SINGLE_CALL_LIMIT
 * AND below the CURATION_SIZE_TRIGGER_TOKENS estimate, one validated call;
 * past EITHER trigger, deterministic lexical-stem buckets with one validated
 * call per bucket and a single reconciliation call over the survivors. Each
 * call is independently validated with its own keep-all fallback — a bucket
 * or reconciliation failure keeps that scope's candidates and leaves the
 * other rounds' results intact, so every round strictly shrinks (or holds)
 * the set.
 *
 * Phase 21 (§2.2): the `options.proposedPairs` (deterministic pre-merge
 * proposals) are judged in exactly ONE call — the single call, or the
 * reconciliation call on the two-round path (signal-aware grouping: a
 * proposed pair is never split across buckets, and the round-1 buckets carry
 * no pairs section at all). An empty open-candidate set with proposed pairs
 * still makes its call (the pairs must be judged).
 */
async function curateWithScaling(
  kind: Concern,
  candidates: CurationCandidate[],
  options: CurateCallOptions,
): Promise<CurationOutcome> {
  const proposedPairs = options.proposedPairs ?? [];
  const proposedClusters = options.proposedClusters ?? [];
  if (candidates.length === 0 && proposedPairs.length === 0 && proposedClusters.length === 0) {
    return { decisions: { merges: [], drops: [], keep: [] }, attempts: 0, fallbacks: [], vetoes: [], pairVerdicts: [] };
  }
  // Phase 16 (vision `04` Step 6): the size trigger fires alongside the
  // count trigger — a verbose decision list can approach the output ceiling
  // well below 250 candidates, and truncation is a failure the reask cannot
  // repair.
  const overCount = candidates.length > CURATION_SINGLE_CALL_LIMIT;
  const overSize = estimateDecisionListTokens(candidates) >= CURATION_SIZE_TRIGGER_TOKENS;
  if (!overCount && !overSize) {
    const single = await curateSingleCall(kind, candidates, options, `curation-${kind}`, proposedPairs, proposedClusters);
    return {
      decisions: single.decisions,
      attempts: single.attempts,
      fallbacks: single.fallback !== null ? [single.fallback] : [],
      vetoes: single.vetoes,
      ...(proposedPairs.length > 0 ? { pairVerdicts: single.pairVerdicts } : {}),
      ...(proposedClusters.length > 0 ? { clusterVerdicts: single.clusterVerdicts } : {}),
    };
  }

  // Round 1: one validated call per deterministic lexical-stem bucket
  // (buckets close on the count limit OR the size estimate, whichever binds;
  // Phase 21 signal-aware grouping never splits a proposed pair across
  // buckets; Phase 22 never splits a proposed cluster either). The round-1
  // calls carry NO proposed pairs/clusters — proposals are judged in the
  // reconciliation call below.
  const buckets = bucketCandidatesSized(candidates, proposedPairs, proposedClusters);
  const roundOne: CurationDecisions[] = [];
  const fallbacks: CurationFallback[] = [];
  const vetoes: Array<{ from: string; into: string }> = [];
  let attempts = 0;
  for (let index = 0; index < buckets.length; index++) {
    const result = await curateSingleCall(kind, buckets[index], options, `curation-${kind}-bucket-${index + 1}`);
    attempts += result.attempts;
    vetoes.push(...result.vetoes);
    if (result.fallback !== null) {
      fallbacks.push(result.fallback);
    }
    // A failed bucket keeps all of its candidates (per-scope keep-all).
    roundOne.push(
      result.decisions ?? { merges: [], drops: [], keep: buckets[index].map((candidate) => candidate.slug) },
    );
  }

  // Round 2: one reconciliation call over all survivors (global view catches
  // cross-bucket duplicates; translation variants reconcile here). Phase 21:
  // the proposed pairs ride this call — judged exactly once, always
  // co-located. Phase 22: the proposed clusters ride it the same way.
  const survivors = computeSurvivors(candidates, roundOne, kind);
  const reconciliation = await curateSingleCall(kind, survivors, options, `curation-${kind}-reconciliation`, proposedPairs, proposedClusters);
  attempts += reconciliation.attempts;
  vetoes.push(...reconciliation.vetoes);
  if (reconciliation.fallback !== null) {
    fallbacks.push(reconciliation.fallback);
  }

  return {
    decisions: composeDecisions(candidates, roundOne, reconciliation.decisions),
    attempts,
    fallbacks,
    vetoes,
    ...(proposedPairs.length > 0 ? { pairVerdicts: reconciliation.pairVerdicts } : {}),
    ...(proposedClusters.length > 0 ? { clusterVerdicts: reconciliation.clusterVerdicts } : {}),
  };
}

/**
 * Curate the topic set (phase doc §2.2): merge same-theme duplicates, drop
 * non-topics, keep the rest. On the single-call path a null `decisions` in
 * the outcome is the keep-all fallback — write every candidate uncurated.
 */
export async function curateTopics(
  candidates: TopicCurationCandidate[],
  options: CurateCallOptions,
): Promise<TopicCurationOutcome> {
  return curateWithScaling('topics', candidates, options);
}

/**
 * Curate the entity set (phase doc §2.2): MERGE-ONLY under strict identity;
 * the `unsure` bucket folds into keep. Same fallback semantics as topics.
 */
export async function curateEntities(
  candidates: EntityCurationCandidate[],
  options: CurateCallOptions,
): Promise<EntityCurationOutcome> {
  return curateWithScaling('entities', candidates, options);
}
