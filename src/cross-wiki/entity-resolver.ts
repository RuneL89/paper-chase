import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  writeEntityRegistryPage,
  type RegistryEntry,
  type RegistryMember,
} from '../pages/cross-wiki/entity-registry-page';
import {
  CROSS_WIKI_MAX_TOKENS,
  runCrossWikiJsonCall,
  type CrossWikiLanguage,
} from './llm';
import {
  writeCrossWikiState,
  writeProposedCrossWikiMatches,
} from './state';
import type { EntitySummary } from './entity-context-summarizer';
import type { ScannedEntityPage } from './workspace-scan';

/**
 * Phase 24 Component A (phase doc §2.1, user decisions 2026-08-09 #3/#9/#13):
 * the Cross-Wiki Entity Resolver.
 *
 * - EXACT tier (deterministic, $0): union-find over pages sharing an
 *   identical title or alias string (case-insensitive) — clusters spanning
 *   ≥2 distinct wikis go straight to the registry.
 * - FUZZY tier (batched cheap LLM, one call per ambiguity cluster): the model
 *   partitions each cluster into match / no-match / uncertain. Match groups
 *   spanning ≥2 wikis join the registry; no-match is discarded; uncertain
 *   escalates.
 * - UNCERTAIN-REVIEW sub-step (one batched mid-tier call): re-judges the
 *   uncertain groups with full summaries and provenance. Only match verdicts
 *   join the registry; the remaining uncertain groups are isolated in
 *   `.state/proposed-cross-wiki-matches.json` (human review) and
 *   `.state/cross-wiki/entity-match-candidates.json` (downstream agent,
 *   marked uncertain/unapproved) — never in `entities.md`.
 *
 * Outputs: `wikis/cross-wiki/entities.md`,
 * `.state/cross-wiki/entity-registry.json` (JSON mirror),
 * `.state/proposed-cross-wiki-matches.json`,
 * `.state/cross-wiki/entity-match-candidates.json`. Single-wiki entities are
 * excluded everywhere. With no cross-wiki entities an honest empty report is
 * written.
 */

export interface UncertainMember {
  wiki: string;
  slug: string;
  path: string;
  title: string;
}

export interface UncertainMatch {
  members: UncertainMember[];
  reason: string;
  /** 'fuzzy' = the cheap model's uncertainty; 'review' = still uncertain after the mid-tier review. */
  source: 'fuzzy' | 'review';
}

export interface EntityResolutionResult {
  entries: RegistryEntry[];
  uncertain: UncertainMatch[];
  stats: {
    exactClusters: number;
    candidateClusters: number;
    fuzzyMatches: number;
    reviewMatches: number;
  };
}

/** Test-only seams (the `writeDoxIndexFn` precedent): return the raw model JSON. */
export interface ResolveEntitiesOptions {
  workspace?: string;
  language?: CrossWikiLanguage;
  logPath?: string;
  /** Per-cluster fuzzy matcher (default: the real cheap-LLM call). */
  matchEntitiesFn?: (cluster: AmbiguityCluster, feedback: string | undefined, attempt: number) => Promise<string>;
  /** Batched uncertain review (default: the real mid-tier call over all groups). */
  reviewUncertainFn?: (groups: UncertainMatch[], feedback: string | undefined, attempt: number) => Promise<string>;
  onProgress?: (message: string) => void;
}

/** One fuzzy-tier ambiguity cluster (path-qualified ids + display data). */
export interface AmbiguityCluster {
  members: Array<{
    id: string;
    wiki: string;
    slug: string;
    title: string;
    type: string;
    aliases: string[];
    summary: string;
    sources: string[];
  }>;
}

// ---------------------------------------------------------------------------
// Exact tier (deterministic)
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Small union-find over page indexes. */
class UnionFind {
  private parent: number[];
  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }
  find(x: number): number {
    let root = x;
    while (this.parent[root] !== root) {
      root = this.parent[root];
    }
    while (this.parent[x] !== root) {
      const next = this.parent[x];
      this.parent[x] = root;
      x = next;
    }
    return root;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) {
      this.parent[rb] = ra;
    }
  }
}

function distinctWikis(pages: ScannedEntityPage[]): string[] {
  return Array.from(new Set(pages.map((page) => page.wiki))).sort((a, b) => a.localeCompare(b));
}

function pickCanonicalTitle(pages: ScannedEntityPage[]): string {
  const counts = new Map<string, { count: number; title: string }>();
  for (const page of pages) {
    const key = normalizeName(page.title);
    const entry = counts.get(key) ?? { count: 0, title: page.title };
    entry.count++;
    // Prefer the shortest display form within one normalized spelling.
    if (page.title.length < entry.title.length) {
      entry.title = page.title;
    }
    counts.set(key, entry);
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))[0].title;
}

function collectAliases(pages: ScannedEntityPage[], canonicalTitle: string): string[] {
  const seen = new Set<string>([normalizeName(canonicalTitle)]);
  const aliases: string[] = [];
  for (const page of pages) {
    for (const name of [page.title, ...page.aliases]) {
      const key = normalizeName(name);
      if (key.length > 0 && !seen.has(key)) {
        seen.add(key);
        aliases.push(name);
      }
    }
  }
  return aliases.sort((a, b) => a.localeCompare(b));
}

function toRegistryEntry(
  pages: ScannedEntityPage[],
  summaries: Record<string, EntitySummary>,
  match: RegistryEntry['match'],
  canonicalTitleOverride?: string,
  aliasesOverride?: string[],
): RegistryEntry {
  const sorted = [...pages].sort((a, b) => a.id.localeCompare(b.id));
  const canonicalTitle = canonicalTitleOverride ?? pickCanonicalTitle(sorted);
  return {
    canonicalTitle,
    aliases: aliasesOverride ?? collectAliases(sorted, canonicalTitle),
    wikis: distinctWikis(sorted),
    members: sorted.map((page) => ({
      wiki: page.wiki,
      slug: page.slug,
      path: page.id,
      title: page.title,
      type: page.entityType,
      summary: summaries[page.id]?.summary ?? '',
    })),
    match,
  };
}

// ---------------------------------------------------------------------------
// Fuzzy candidate generation (deterministic)
// ---------------------------------------------------------------------------

function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[] = Array.from({ length: cols }, (_, j) => j);
  for (let i = 1; i < rows; i++) {
    let previous = dp[0];
    dp[0] = i;
    for (let j = 1; j < cols; j++) {
      const temp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = temp;
    }
  }
  return dp[cols - 1];
}

function titleTokens(title: string): Set<string> {
  return new Set(
    normalizeName(title)
      .split(' ')
      .map((token) => token.replace(/[^a-z0-9æøåäöüß]/g, ''))
      .filter((token) => token.length >= 4),
  );
}

/** True when two pages from different wikis are worth an LLM identity judgment. */
function isFuzzyCandidate(a: ScannedEntityPage, b: ScannedEntityPage): boolean {
  if (a.slug === b.slug) {
    return true;
  }
  if (Math.min(a.slug.length, b.slug.length) >= 6 && editDistance(a.slug, b.slug) <= 2) {
    return true;
  }
  const aTokens = titleTokens(a.title);
  const bTokens = titleTokens(b.title);
  if (aTokens.size > 0 && bTokens.size > 0) {
    const [smaller, larger] = aTokens.size <= bTokens.size ? [aTokens, bTokens] : [bTokens, aTokens];
    if (Array.from(smaller).every((token) => larger.has(token))) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// LLM output shapes + validation
// ---------------------------------------------------------------------------

interface FuzzyOutput {
  matches: Array<{ members: string[]; canonicalTitle: string; aliases: string[] }>;
  noMatch: string[];
  uncertain: Array<{ members: string[]; reason: string }>;
}

function validateFuzzyOutput(data: unknown, clusterIds: Set<string>): { valid: boolean; errors: string[]; value?: FuzzyOutput } {
  const errors: string[] = [];
  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['output is not a JSON object'] };
  }
  const record = data as Record<string, unknown>;
  const matches = record.matches;
  const noMatch = record.noMatch;
  const uncertain = record.uncertain;
  if (!Array.isArray(matches) || !Array.isArray(noMatch) || !Array.isArray(uncertain)) {
    return { valid: false, errors: ['output must carry "matches", "noMatch", and "uncertain" arrays'] };
  }
  const seen = new Set<string>();
  const checkId = (id: unknown, where: string): id is string => {
    if (typeof id !== 'string' || !clusterIds.has(id)) {
      errors.push(`${where}: unknown candidate id "${String(id)}"`);
      return false;
    }
    if (seen.has(id)) {
      errors.push(`${where}: candidate id "${id}" listed twice`);
      return false;
    }
    seen.add(id);
    return true;
  };
  const cleanMatches: FuzzyOutput['matches'] = [];
  for (const [index, group] of matches.entries()) {
    if (typeof group !== 'object' || group === null) {
      errors.push(`matches[${index}]: not an object`);
      continue;
    }
    const g = group as Record<string, unknown>;
    if (!Array.isArray(g.members) || g.members.length < 2) {
      errors.push(`matches[${index}]: "members" must list at least two candidate ids`);
      continue;
    }
    if (typeof g.canonicalTitle !== 'string' || g.canonicalTitle.trim().length === 0) {
      errors.push(`matches[${index}]: missing "canonicalTitle"`);
      continue;
    }
    const members = g.members.filter((id) => checkId(id, `matches[${index}]`));
    const aliases = Array.isArray(g.aliases) ? g.aliases.filter((a): a is string => typeof a === 'string') : [];
    cleanMatches.push({ members, canonicalTitle: g.canonicalTitle.trim(), aliases });
  }
  const cleanNoMatch: string[] = [];
  for (const id of noMatch) {
    if (checkId(id, 'noMatch')) {
      cleanNoMatch.push(id);
    }
  }
  const cleanUncertain: FuzzyOutput['uncertain'] = [];
  for (const [index, group] of uncertain.entries()) {
    if (typeof group !== 'object' || group === null || !Array.isArray((group as Record<string, unknown>).members)) {
      errors.push(`uncertain[${index}]: not an object with a "members" list`);
      continue;
    }
    const g = group as Record<string, unknown>;
    const members = (g.members as unknown[]).filter((id) => checkId(id, `uncertain[${index}]`));
    if (members.length < 2) {
      errors.push(`uncertain[${index}]: "members" must list at least two candidate ids`);
      continue;
    }
    cleanUncertain.push({ members, reason: typeof g.reason === 'string' ? g.reason : '' });
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, errors: [], value: { matches: cleanMatches, noMatch: cleanNoMatch, uncertain: cleanUncertain } };
}

interface ReviewOutput {
  reviews: Array<{
    members: string[];
    verdict: 'match' | 'no-match' | 'uncertain';
    canonicalTitle?: string;
    aliases?: string[];
    reason?: string;
  }>;
}

function groupKey(members: string[]): string {
  return [...members].sort((a, b) => a.localeCompare(b)).join('|');
}

function validateReviewOutput(
  data: unknown,
  groups: UncertainMatch[],
): { valid: boolean; errors: string[]; value?: ReviewOutput } {
  const errors: string[] = [];
  if (typeof data !== 'object' || data === null || !Array.isArray((data as Record<string, unknown>).reviews)) {
    return { valid: false, errors: ['output must be an object with a "reviews" array'] };
  }
  const expected = new Map(groups.map((group) => [groupKey(group.members.map((member) => member.path)), group]));
  const seen = new Set<string>();
  const reviews: ReviewOutput['reviews'] = [];
  for (const [index, review] of ((data as Record<string, unknown>).reviews as unknown[]).entries()) {
    if (typeof review !== 'object' || review === null) {
      errors.push(`reviews[${index}]: not an object`);
      continue;
    }
    const r = review as Record<string, unknown>;
    if (!Array.isArray(r.members) || !r.members.every((m) => typeof m === 'string')) {
      errors.push(`reviews[${index}]: "members" must be a list of candidate ids`);
      continue;
    }
    const key = groupKey(r.members as string[]);
    if (!expected.has(key)) {
      errors.push(`reviews[${index}]: members do not match any uncertain group under review`);
      continue;
    }
    if (seen.has(key)) {
      errors.push(`reviews[${index}]: the same group is reviewed twice`);
      continue;
    }
    seen.add(key);
    const verdict = r.verdict;
    if (verdict !== 'match' && verdict !== 'no-match' && verdict !== 'uncertain') {
      errors.push(`reviews[${index}]: verdict must be "match", "no-match", or "uncertain"`);
      continue;
    }
    if (verdict === 'match' && (typeof r.canonicalTitle !== 'string' || r.canonicalTitle.trim().length === 0)) {
      errors.push(`reviews[${index}]: a "match" verdict requires a non-empty "canonicalTitle"`);
      continue;
    }
    reviews.push({
      members: r.members as string[],
      verdict,
      ...(typeof r.canonicalTitle === 'string' ? { canonicalTitle: r.canonicalTitle.trim() } : {}),
      ...(Array.isArray(r.aliases) ? { aliases: r.aliases.filter((a): a is string => typeof a === 'string') } : {}),
      ...(typeof r.reason === 'string' ? { reason: r.reason } : {}),
    });
  }
  for (const key of expected.keys()) {
    if (!seen.has(key)) {
      errors.push(`an uncertain group was not reviewed: ${key}`);
    }
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, errors: [], value: { reviews } };
}

// ---------------------------------------------------------------------------
// Default LLM calls
// ---------------------------------------------------------------------------

function formatCandidateLine(member: AmbiguityCluster['members'][number]): string {
  return JSON.stringify({
    id: member.id,
    wiki: member.wiki,
    title: member.title,
    type: member.type,
    aliases: member.aliases,
    summary: member.summary,
  });
}

function formatReviewGroup(group: UncertainMatch, summaries: Record<string, EntitySummary>): string {
  const members = group.members.map((member) =>
    JSON.stringify({
      id: member.path,
      wiki: member.wiki,
      title: member.title,
      summary: summaries[member.path]?.summary ?? '',
      sources: summaries[member.path]?.sources ?? [],
    }),
  );
  return `Group (reason uncertain: ${group.reason || 'not recorded'}):\n${members.join('\n')}`;
}

// ---------------------------------------------------------------------------
// The resolver
// ---------------------------------------------------------------------------

/**
 * Resolve cross-wiki entity identities over the workspace's entity pages and
 * write all four Component A artifacts. LLM failures degrade to the
 * deterministic tiers with warnings — the pass never aborts an ingest.
 */
export async function resolveEntities(
  pages: ScannedEntityPage[],
  summaries: Record<string, EntitySummary>,
  options: ResolveEntitiesOptions = {},
): Promise<EntityResolutionResult> {
  const workspace = options.workspace ?? '.';
  const progress = options.onProgress ?? (() => {});

  // --- Exact tier: union pages sharing an identical title/alias string. ---
  const uf = new UnionFind(pages.length);
  const byNameKey = new Map<string, number>();
  pages.forEach((page, index) => {
    for (const name of [page.title, ...page.aliases]) {
      const key = normalizeName(name);
      if (key.length === 0) {
        continue;
      }
      const existing = byNameKey.get(key);
      if (existing === undefined) {
        byNameKey.set(key, index);
      } else {
        uf.union(existing, index);
      }
    }
  });
  const exactGroups = new Map<number, number[]>();
  pages.forEach((_, index) => {
    const root = uf.find(index);
    exactGroups.set(root, [...(exactGroups.get(root) ?? []), index]);
  });
  const entries: RegistryEntry[] = [];
  const exactMatched = new Set<number>();
  for (const group of exactGroups.values()) {
    const groupPages = group.map((index) => pages[index]);
    if (distinctWikis(groupPages).length >= 2) {
      entries.push(toRegistryEntry(groupPages, summaries, 'exact'));
      for (const index of group) {
        exactMatched.add(index);
      }
    }
  }
  const exactClusters = entries.length;

  // --- Fuzzy tier: deterministic candidate clusters, one cheap call each. ---
  const remaining = pages.map((page, index) => ({ page, index })).filter(({ index }) => !exactMatched.has(index));
  const candidateUf = new UnionFind(remaining.length);
  for (let i = 0; i < remaining.length; i++) {
    for (let j = i + 1; j < remaining.length; j++) {
      if (remaining[i].page.wiki !== remaining[j].page.wiki && isFuzzyCandidate(remaining[i].page, remaining[j].page)) {
        candidateUf.union(i, j);
      }
    }
  }
  const candidateGroups = new Map<number, number[]>();
  remaining.forEach((_, index) => {
    const root = candidateUf.find(index);
    candidateGroups.set(root, [...(candidateGroups.get(root) ?? []), index]);
  });
  const clusters: AmbiguityCluster[] = [];
  for (const group of candidateGroups.values()) {
    if (group.length < 2) {
      continue;
    }
    const groupPages = group.map((index) => remaining[index].page);
    if (distinctWikis(groupPages).length < 2) {
      continue;
    }
    clusters.push({
      members: groupPages
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((page) => ({
          id: page.id,
          wiki: page.wiki,
          slug: page.slug,
          title: page.title,
          type: page.entityType,
          aliases: page.aliases,
          summary: summaries[page.id]?.summary ?? '',
          sources: summaries[page.id]?.sources ?? [],
        })),
    });
  }
  clusters.sort((a, b) => a.members[0].id.localeCompare(b.members[0].id));

  const byId = new Map(pages.map((page) => [page.id, page]));
  const uncertain: UncertainMatch[] = [];
  let fuzzyMatches = 0;
  for (const cluster of clusters) {
    const clusterIds = new Set(cluster.members.map((member) => member.id));
    let outcome;
    try {
      outcome = await runCrossWikiJsonCall<FuzzyOutput>({
        promptFile: 'cross-wiki-entity-match.prompt.txt',
        slots: { candidates: cluster.members.map(formatCandidateLine).join('\n') },
        callType: 'cross-wiki-entity-match',
        context: `cross-wiki entity match (${cluster.members.length} candidates)`,
        maxTokens: CROSS_WIKI_MAX_TOKENS,
        language: options.language,
        logPath: options.logPath,
        label: `cross-wiki entity match (${cluster.members.length} candidates)`,
        validate: (data) => validateFuzzyOutput(data, clusterIds),
        callLLMFn: options.matchEntitiesFn
          ? (feedback, attempt) => options.matchEntitiesFn!(cluster, feedback, attempt)
          : undefined,
      });
    } catch (err) {
      progress(
        `Warning: cross-wiki entity match failed for a ${cluster.members.length}-candidate cluster (${(err as Error).message}); the cluster is held for human review.`,
      );
      outcome = null;
    }
    if (outcome === null || outcome.output === null) {
      // LLM unavailable or validation exhausted: hold the whole cluster as uncertain.
      uncertain.push({
        members: cluster.members.map((member) => ({ wiki: member.wiki, slug: member.slug, path: member.id, title: member.title })),
        reason: 'automated matching unavailable',
        source: 'fuzzy',
      });
      continue;
    }
    for (const group of outcome.output.matches) {
      const groupPages = group.members.map((id) => byId.get(id)).filter((page): page is ScannedEntityPage => page !== undefined);
      if (distinctWikis(groupPages).length >= 2) {
        entries.push(toRegistryEntry(groupPages, summaries, 'fuzzy', group.canonicalTitle, group.aliases));
        fuzzyMatches++;
      }
    }
    for (const group of outcome.output.uncertain) {
      const groupPages = group.members.map((id) => byId.get(id)).filter((page): page is ScannedEntityPage => page !== undefined);
      if (distinctWikis(groupPages).length >= 2) {
        uncertain.push({
          members: groupPages.map((page) => ({ wiki: page.wiki, slug: page.slug, path: page.id, title: page.title })),
          reason: group.reason,
          source: 'fuzzy',
        });
      }
    }
  }

  // --- Uncertain-review sub-step: one batched mid-tier call over all groups. ---
  let reviewMatches = 0;
  let remainingUncertain = uncertain;
  if (uncertain.length > 0) {
    let outcome;
    try {
      outcome = await runCrossWikiJsonCall<ReviewOutput>({
        promptFile: 'cross-wiki-entity-uncertain-review.prompt.txt',
        slots: { groups: uncertain.map((group) => formatReviewGroup(group, summaries)).join('\n\n') },
        callType: 'cross-wiki-uncertain-review',
        context: `cross-wiki uncertain review (${uncertain.length} groups)`,
        maxTokens: CROSS_WIKI_MAX_TOKENS,
        language: options.language,
        logPath: options.logPath,
        label: `cross-wiki uncertain review (${uncertain.length} groups)`,
        validate: (data) => validateReviewOutput(data, uncertain),
        callLLMFn: options.reviewUncertainFn
          ? (feedback, attempt) => options.reviewUncertainFn!(uncertain, feedback, attempt)
          : undefined,
      });
    } catch (err) {
      progress(
        `Warning: cross-wiki uncertain review failed (${(err as Error).message}); ${uncertain.length} group(s) held for human review.`,
      );
      outcome = null;
    }
    if (outcome !== null && outcome.output !== null) {
      remainingUncertain = [];
      for (const review of outcome.output.reviews) {
        const groupPages = review.members
          .map((id) => byId.get(id))
          .filter((page): page is ScannedEntityPage => page !== undefined);
        if (review.verdict === 'match' && distinctWikis(groupPages).length >= 2) {
          entries.push(toRegistryEntry(groupPages, summaries, 'review', review.canonicalTitle, review.aliases));
          reviewMatches++;
        } else if (review.verdict === 'uncertain') {
          const original = uncertain.find((group) => groupKey(group.members.map((m) => m.path)) === groupKey(review.members));
          remainingUncertain.push({
            members: groupPages.map((page) => ({ wiki: page.wiki, slug: page.slug, path: page.id, title: page.title })),
            reason: review.reason ?? original?.reason ?? '',
            source: 'review',
          });
        }
        // 'no-match' verdicts are discarded.
      }
    }
  }

  // --- Outputs (deterministic order). ---
  entries.sort((a, b) => a.canonicalTitle.localeCompare(b.canonicalTitle));
  remainingUncertain.sort((a, b) => groupKey(a.members.map((m) => m.path)).localeCompare(groupKey(b.members.map((m) => m.path))));

  const crossWikiDir = join(workspace, 'wikis', 'cross-wiki');
  await mkdir(crossWikiDir, { recursive: true });
  const updated = new Date().toISOString();
  await writeFile(join(crossWikiDir, 'entities.md'), writeEntityRegistryPage(entries, updated), 'utf-8');
  await writeCrossWikiState(workspace, 'entity-registry.json', { generated: updated, entities: entries });
  await writeProposedCrossWikiMatches(workspace, {
    generated: updated,
    proposals: remainingUncertain.map((group) => ({ ...group, status: 'uncertain' as const })),
  });
  await writeCrossWikiState(workspace, 'entity-match-candidates.json', {
    generated: updated,
    candidates: remainingUncertain.map((group) => ({
      members: group.members,
      verdict: 'uncertain' as const,
      approved: false,
      source: group.source,
      reason: group.reason,
    })),
  });

  return {
    entries,
    uncertain: remainingUncertain,
    stats: { exactClusters, candidateClusters: clusters.length, fuzzyMatches, reviewMatches },
  };
}
