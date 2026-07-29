import { getLanguage, type LanguageCode } from '../utils/language';
import { slugify } from '../utils/slug';

/**
 * Phase 21 (phase doc §2.1; canon: vision `04` §3.2 Step 6 + `05` §6; backlog
 * B5; evidence: the 2026-07-28/29 curation reports in dist/wikis/rkkp-* —
 * ~70% of observed merges match deterministic patterns): the DETERMINISTIC
 * pre-merge signal engine. Six signal families scan the curation candidate
 * set and return proposed pairs `{ from, into, signal, evidence }`:
 *
 *   1. transliteration/typo — slugs equal after collapsing the input
 *      language's transliteration digraphs (oe/ae/aa → o/a/a), or edit
 *      distance ≤ 2 on long slugs (typo variants).
 *   2. alias match — one candidate's title is EXACTLY one of another's
 *      frontmatter aliases (and the alias slugifies to the candidate's slug).
 *   3. corpus-derived abbreviations — the `Full Name (ABBR)` parenthesized
 *      pattern mined from the chunk text, with the ABBR's letters a
 *      subsequence of the full name's letters.
 *   4. subsequence/initials — one candidate's tokens (≥2) are a subsequence
 *      of the other's with only name-part extras (never an org-unit word or a
 *      pure digit), or the two share a significant token with the remaining
 *      tokens aligned as initials (moeller-m-h ↔ morten-moller).
 *   5. formulaic families — region name-forms (X, X-region, region-X) and
 *      indicator number↔name (indikator-N-*) regex families. Phase 22 (§2.1,
 *      the five-class rollup amendment): these two families no longer propose
 *      merges — region name-form families (one core, 2-4 forms) propose
 *      CLASS-5 clusters and indicator number-name↔bare-concept pairs propose
 *      CLASS-3 clusters (`proposedClusters`); only the strict-identity
 *      indicator legs (bare number ↔ same-named form, same-name duplicates)
 *      stay merge pairs.
 *   6. a small checked-in da↔en domain glossary (corpus clinical/registry
 *      terms); translations pair.
 *
 * TWO CONFIDENCE TIERS (phase doc §2.1 + gate 21.2): AUTO-APPLY is exactly
 * the two near-zero-risk signals — slug-identical-after-transliteration AND
 * alias-exact. EVERYTHING else is PROPOSE-only (the §2.2 confirm-deny call
 * judges it). neverMerge pairs are never auto-applied (returned in `vetoed`
 * for the report); proposed pairs keep neverMerge pairs so the deterministic
 * validator's veto path stays exercised (gate 21.8).
 *
 * Precision contract (gate 21.1): ZERO false positives on colocated-but-
 * distinct controls — the subsequence family requires ≥2 tokens on the
 * shorter side and rejects org-unit/digit extras (odense ⊆ odense-bup,
 * odense ⊆ odense-2 never fire), the initials family requires an actual
 * single-letter alignment (morten-moller ✗ peter-moller), the edit-distance
 * family rejects digit-only differences (indikator-2 ✗ indikator-3), and the
 * indicator family never pairs two numbered-name forms with different names.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PreMergeSignal =
  | 'transliteration'
  | 'alias'
  | 'abbreviation'
  | 'edit-distance'
  | 'subsequence'
  | 'initials'
  | 'region-form'
  | 'indicator-form'
  | 'glossary';

/** The two near-zero-risk signals that make a pair AUTO-APPLY (gate 21.2). */
export const AUTO_APPLY_SIGNALS: ReadonlySet<PreMergeSignal> = new Set(['transliteration', 'alias']);

export interface PreMergeCandidate {
  slug: string;
  title: string;
  /** Frontmatter aliases (aggregate-merged variant titles ∪ on-disk aliases). */
  aliases?: string[];
}

export interface ProposedPair {
  from: string;
  into: string;
  signal: PreMergeSignal;
  evidence: string;
}

/**
 * Phase 22 (§2.1): a deterministic COMPOSITE-cluster proposal from one of the
 * two formulaic families. `members` carries 2-4 slugs (the whole region
 * name-form family, or the indicator+concept pair) with `into` first (the
 * composite page takes its slug); `class` is the ratified rollup class (5 for
 * region name-forms, 3 for indicator↔concept).
 */
export interface ProposedCluster {
  members: string[];
  class: 3 | 5;
  into: string;
  signal: PreMergeSignal;
  evidence: string;
}

export interface PreMergeDetection {
  /** Transliteration + alias pairs (minus neverMerge vetoes) — no LLM needed. */
  autoApply: ProposedPair[];
  /** Everything else — judged by the §2.2 confirm-deny call. */
  proposed: ProposedPair[];
  /** Auto-tier pairs suppressed by a neverMerge veto (reported, never applied). */
  vetoed: ProposedPair[];
  /**
   * Phase 22 (§2.1, the five-class rollup amendment): DETERMINISTIC CLUSTER
   * proposals — the two formulaic families no longer propose MERGES (an
   * identity collapse the amendment forbids for these shapes) but COMPOSITES:
   * region name-form families → class 5 (same-name different-type), indicator
   * number-name↔bare-concept pairs → class 3 (indicator↔measured concept,
   * 1:1). Judged confirm/deny by the §2.2 call exactly like pairs.
   */
  proposedClusters: ProposedCluster[];
}

export interface PreMergeOptions {
  /** Run language pair; absent → en/en (transliteration signal silent). */
  language?: { input: LanguageCode; output: LanguageCode };
  /** Concatenated chunk text for the corpus-abbreviation signal. */
  corpusText?: string;
  /** Human never-merge pairs (`.state/curation-overrides.json`). */
  neverMerge?: Array<[string, string]>;
  /**
   * Slugs whose pairs must never AUTO-APPLY (the `splits` escape hatch — a
   * split survivor's accumulated aliases would otherwise re-merge the pair
   * instantly through the alias tier). Auto-tier pairs touching a veto slug
   * move to `vetoed`; propose-tier pairs are unaffected (the pair returns to
   * the candidates and the model may re-decide).
   */
  vetoSlugs?: string[];
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Symmetric pair key for dedupe and neverMerge matching (curation house style). */
export function curationPairKey(a: string, b: string): string {
  return [a, b].sort().join(' ');
}

interface RawEdge {
  a: string;
  b: string;
  from: string;
  into: string;
  signal: PreMergeSignal;
  evidence: string;
}

/** Levenshtein edit distance (full-string, dynamic programming). */
function editDistance(a: string, b: string): number {
  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) {
    previous[j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j++) {
      previous[j] = current[j];
    }
  }
  return previous[b.length];
}

/**
 * Collapse the input language's transliteration digraphs to their base
 * letters (da/no: oe→o, ae→a, aa→a; de: ue→u, oe→o, ae→a, ss→s; sv/en/fr/es:
 * no multi-char mappings, so no collapse). Built from the language map itself
 * so the collapse can never drift from the slugify-time transliteration.
 */
function transliterationCanonical(slug: string, language: LanguageCode): string {
  const map = getLanguage(language).transliteration;
  const collapses = Object.values(map)
    .filter((value) => value.length > 1)
    .map((value) => [value, value[0]] as const)
    .sort((x, y) => y[0].length - x[0].length);
  let out = slug;
  for (const [from, to] of collapses) {
    out = out.split(from).join(to);
  }
  return out;
}

/** Does the slug still carry one of the language's transliteration digraphs? */
function carriesDigraph(slug: string, language: LanguageCode): boolean {
  const map = getLanguage(language).transliteration;
  return Object.values(map).some((value) => value.length > 1 && slug.includes(value));
}

// ---------------------------------------------------------------------------
// Signal family 1a: transliteration-identical (AUTO tier)
// ---------------------------------------------------------------------------

function transliterationEdges(
  candidates: PreMergeCandidate[],
  language: LanguageCode,
): RawEdge[] {
  const edges: RawEdge[] = [];
  const canonical = new Map<string, string>();
  for (const candidate of candidates) {
    canonical.set(candidate.slug, transliterationCanonical(candidate.slug, language));
  }
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      if (a.slug.length < 6 || b.slug.length < 6) {
        continue;
      }
      if (a.slug === b.slug || canonical.get(a.slug) !== canonical.get(b.slug)) {
        continue;
      }
      // The properly transliterated form (still carrying a digraph) survives.
      const aDigraph = carriesDigraph(a.slug, language);
      const bDigraph = carriesDigraph(b.slug, language);
      let into = b;
      let from = a;
      if (aDigraph !== bDigraph) {
        into = aDigraph ? a : b;
        from = aDigraph ? b : a;
      } else if (a.slug.localeCompare(b.slug) <= 0) {
        into = a;
        from = b;
      }
      edges.push({
        a: a.slug,
        b: b.slug,
        from: from.slug,
        into: into.slug,
        signal: 'transliteration',
        evidence: `slugs identical after ${getLanguage(language).name} transliteration collapse ('${from.slug}' ≡ '${into.slug}')`,
      });
    }
  }
  return edges;
}

// ---------------------------------------------------------------------------
// Signal family 1b: edit-distance ≤ 2 on long slugs (typo variants, PROPOSE)
// ---------------------------------------------------------------------------

/** Length of the two strings' longest common prefix. */
function commonPrefixLength(a: string, b: string): number {
  let index = 0;
  while (index < a.length && index < b.length && a[index] === b[index]) {
    index += 1;
  }
  return index;
}

function editDistanceEdges(candidates: PreMergeCandidate[]): RawEdge[] {
  const edges: RawEdge[] = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      const minLength = Math.min(a.slug.length, b.slug.length);
      // Long slugs only — a short-slug near-miss is a distinct thing too often.
      if (minLength < 10) {
        continue;
      }
      const distance = editDistance(a.slug, b.slug);
      if (distance === 0 || distance > 2) {
        continue;
      }
      // Digit-only differences are numbered variants, not typos
      // (indikator-2 ✗ indikator-3).
      if (a.slug.replace(/[0-9]/g, '') === b.slug.replace(/[0-9]/g, '')) {
        continue;
      }
      // A high-overlap prefix is required — a wholly-different leading token
      // is a different thing (ct-skanning ✗ mr-skanning), never a typo.
      if (commonPrefixLength(a.slug, b.slug) * 2 < minLength) {
        continue;
      }
      // The longer (more complete) spelling survives; ties break lexically.
      let into = a.slug.length >= b.slug.length ? a : b;
      let from = into === a ? b : a;
      if (a.slug.length === b.slug.length && a.slug.localeCompare(b.slug) <= 0) {
        into = a;
        from = b;
      }
      edges.push({
        a: a.slug,
        b: b.slug,
        from: from.slug,
        into: into.slug,
        signal: 'edit-distance',
        evidence: `slugs '${from.slug}' and '${into.slug}' are edit distance ${distance} apart (typo variant)`,
      });
    }
  }
  return edges;
}

// ---------------------------------------------------------------------------
// Signal family 2: exact alias match (AUTO tier)
// ---------------------------------------------------------------------------

function aliasEdges(candidates: PreMergeCandidate[], language: LanguageCode): RawEdge[] {
  const edges: RawEdge[] = [];
  for (const variant of candidates) {
    const title = variant.title.trim().toLowerCase();
    if (title.length < 2) {
      continue;
    }
    for (const holder of candidates) {
      if (holder.slug === variant.slug) {
        continue;
      }
      const match = (holder.aliases ?? []).find((alias) => {
        const trimmed = alias.trim();
        return (
          trimmed.length >= 2 &&
          trimmed.toLowerCase() === title &&
          slugify(trimmed, language) === variant.slug
        );
      });
      if (match !== undefined) {
        edges.push({
          a: variant.slug,
          b: holder.slug,
          from: variant.slug,
          into: holder.slug,
          signal: 'alias',
          evidence: `title '${variant.title}' is an exact frontmatter alias of '${holder.slug}'`,
        });
      }
    }
  }
  return edges;
}

// ---------------------------------------------------------------------------
// Signal family 3: corpus-derived abbreviations — `Full Name (ABBR)`
// ---------------------------------------------------------------------------

/**
 * The full name of a `Full Name (ABBR)` introduction: 1-6 words, the first
 * capitalized, continuations capitalized or one of the small connector words
 * (for/i/og/af/the/of/and/…). The capitalization bound keeps leading prose
 * words out of the match ("Data hentes fra Landspatientregisteret (LPR)"
 * yields 'Landspatientregisteret', never 'Data hentes fra …').
 */
const ABBREVIATION_PATTERN =
  /([A-ZÆØÅÄÖÜ][A-Za-zÆØÅæøåÄÖÜäöüé-]*(?:(?:\s+[A-ZÆØÅÄÖÜ][A-Za-zÆØÅæøåÄÖÜäöüé-]*)|(?:\s+(?:for|i|og|af|de|den|det|the|of|and|in|und|der|dem))){0,5})\s*\(([A-ZÆØÅÄÖÜ]{2,8})\)/g;

/** Is the abbreviation's letter sequence a subsequence of the full name's? */
function abbreviationMatchesName(abbr: string, fullName: string): boolean {
  const letters = fullName.toLowerCase().replace(/[^a-zæøåäöüé]/g, '');
  let index = 0;
  for (const char of letters) {
    if (char === abbr[index]) {
      index += 1;
      if (index === abbr.length) {
        return true;
      }
    }
  }
  return false;
}

function abbreviationEdges(
  candidates: PreMergeCandidate[],
  language: LanguageCode,
  corpusText: string,
): RawEdge[] {
  const bySlug = new Map(candidates.map((candidate) => [candidate.slug, candidate]));
  const edges: RawEdge[] = [];
  const seen = new Set<string>();
  for (const match of corpusText.matchAll(ABBREVIATION_PATTERN)) {
    const fullName = match[1].trim();
    const abbr = match[2];
    const abbrSlug = slugify(abbr, language);
    const fullSlug = slugify(fullName, language);
    if (abbrSlug.length < 2 || abbrSlug === fullSlug || seen.has(`${abbrSlug} ${fullSlug}`)) {
      continue;
    }
    if (!bySlug.has(abbrSlug) || !bySlug.has(fullSlug)) {
      continue;
    }
    if (!abbreviationMatchesName(abbr.toLowerCase(), fullName)) {
      continue;
    }
    seen.add(`${abbrSlug} ${fullSlug}`);
    edges.push({
      a: abbrSlug,
      b: fullSlug,
      from: abbrSlug,
      into: fullSlug,
      signal: 'abbreviation',
      evidence: `corpus text introduces '${fullName} (${abbr})'`,
    });
  }
  return edges;
}

// ---------------------------------------------------------------------------
// Signal family 4a: token subsequence (PROPOSE tier)
// ---------------------------------------------------------------------------

/**
 * Org-unit words that make an extra token identity-bearing: a longer name
 * carrying one of these is a sub-unit, not a name variant (the
 * colocated-but-distinct guard — odense-bup-auditorium ✗ odense-bup,
 * naestved-hospital ✗ naestved).
 */
const ORG_UNIT_TOKENS = new Set([
  'auditorium', 'afdeling', 'afdelingen', 'department', 'ward', 'klinik', 'klinikken',
  'clinic', 'ambulatorium', 'ambulatoriet', 'hospital', 'hospitaler', 'sygehus', 'sygehuse',
  'institut', 'institute', 'institution', 'center', 'centre', 'universitet', 'university',
  'skole', 'school', 'laboratorium', 'laboratory', 'lab', 'sektion', 'section', 'unit',
  'enhed', 'team', 'selskab', 'company', 'division', 'afsnit',
]);

function subsequenceEdges(candidates: PreMergeCandidate[]): RawEdge[] {
  const edges: RawEdge[] = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = 0; j < candidates.length; j++) {
      if (i === j) {
        continue;
      }
      const shorter = candidates[i];
      const longer = candidates[j];
      const shortTokens = shorter.slug.split('-');
      const longTokens = longer.slug.split('-');
      // ≥2 tokens on the shorter side: single-token absorption (a city into a
      // same-named clinic) is the classic colocated-but-distinct false hit.
      if (shortTokens.length < 2 || shortTokens.length >= longTokens.length) {
        continue;
      }
      const matched: number[] = [];
      let cursor = 0;
      for (let index = 0; index < longTokens.length && cursor < shortTokens.length; index++) {
        if (longTokens[index] === shortTokens[cursor]) {
          matched.push(index);
          cursor += 1;
        }
      }
      if (cursor < shortTokens.length) {
        continue;
      }
      const extras = longTokens.filter((_, index) => !matched.includes(index));
      if (extras.some((token) => ORG_UNIT_TOKENS.has(token) || /^\d+$/.test(token))) {
        continue;
      }
      edges.push({
        a: shorter.slug,
        b: longer.slug,
        from: longer.slug,
        into: shorter.slug,
        signal: 'subsequence',
        evidence: `tokens of '${shorter.slug}' are a subsequence of '${longer.slug}' (name parts [${extras.join(', ')}] dropped)`,
      });
    }
  }
  return edges;
}

// ---------------------------------------------------------------------------
// Signal family 4b: initials alignment (PROPOSE tier)
// ---------------------------------------------------------------------------

function initialsEdges(candidates: PreMergeCandidate[], language: LanguageCode): RawEdge[] {
  const edges: RawEdge[] = [];
  const canonical = new Map<string, string[]>();
  for (const candidate of candidates) {
    canonical.set(
      candidate.slug,
      candidate.slug.split('-').map((token) => transliterationCanonical(token, language)),
    );
  }
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      const tokensA = canonical.get(a.slug) ?? [];
      const tokensB = canonical.get(b.slug) ?? [];
      const shared = tokensA.filter((token) => token.length >= 3 && tokensB.includes(token));
      if (shared.length === 0) {
        continue;
      }
      const restA = tokensA.filter((token) => !shared.includes(token));
      const restB = tokensB.filter((token) => !shared.includes(token));
      // Initials are LETTERS only — a pure-digit token is a numbered fork
      // (odense-2, indikator-2), never an initial (control guard).
      const isInitial = (token: string): boolean => token.length === 1 && /[a-z]/.test(token);
      const singlesA = restA.filter(isInitial);
      const singlesB = restB.filter(isInitial);
      // An actual initial must be present on at least one side (a shared
      // surname alone never merges two different people).
      if (singlesA.length === 0 && singlesB.length === 0) {
        continue;
      }
      const sideAligns = (rest: string[], otherSingles: string[]): boolean =>
        rest.every((token) => isInitial(token) || otherSingles.includes(token[0]));
      if (!sideAligns(restA, singlesB) || !sideAligns(restB, singlesA)) {
        continue;
      }
      // A real name-token must align with an initial on at least one side
      // (moeller-m-h ↔ morten-moller) — two sides carrying only DIFFERING
      // single letters are a lettered series (topic-a ✗ topic-b), never a
      // name variant.
      const nameTokenAligns =
        restA.some((token) => !isInitial(token) && singlesB.includes(token[0])) ||
        restB.some((token) => !isInitial(token) && singlesA.includes(token[0]));
      if (!nameTokenAligns) {
        continue;
      }
      const into = a.slug.split('-').length <= b.slug.split('-').length ? a : b;
      const from = into === a ? b : a;
      edges.push({
        a: a.slug,
        b: b.slug,
        from: from.slug,
        into: into.slug,
        signal: 'initials',
        evidence: `shared token '${shared[0]}' with initials aligned (${singlesA.concat(singlesB).sort().join(', ')})`,
      });
    }
  }
  return edges;
}

// ---------------------------------------------------------------------------
// Signal family 5a: region name-forms (X, X-region, region-X) — Phase 22:
// CLASS-5 CLUSTER proposals, one per name-form family (no longer merge pairs)
// ---------------------------------------------------------------------------

interface RegionForm {
  core: string;
  form: 'bare' | 'prefix' | 'suffix';
}

function regionFormOf(slug: string): RegionForm {
  if (slug.startsWith('region-') && slug.length > 'region-'.length) {
    return { core: slug.slice('region-'.length), form: 'prefix' };
  }
  if (slug.endsWith('-region') && slug.length > '-region'.length) {
    return { core: slug.slice(0, slug.length - '-region'.length), form: 'suffix' };
  }
  return { core: slug, form: 'bare' };
}

const REGION_FORM_RANK: Record<RegionForm['form'], number> = { prefix: 0, suffix: 1, bare: 2 };

/**
 * Phase 22 (§2.1, class-5 same-name different-type): the slug-stem of a
 * region name-form — exported for the curation validator's class-5 rule.
 */
export function regionSlugStem(slug: string): string {
  return regionFormOf(slug).core;
}

/**
 * Group the candidates into region name-form families (one core, ≥2 forms).
 * A family of 2-4 forms proposes ONE class-5 cluster (into = the best-ranked
 * form: region-X, then X-region, then bare X); a family larger than the
 * ratified member cap (4) proposes NOTHING — a partial cluster is never
 * silently emitted.
 */
function regionClusterProposals(candidates: PreMergeCandidate[]): ProposedCluster[] {
  const byCore = new Map<string, Array<{ slug: string; rank: number }>>();
  for (const candidate of candidates) {
    const form = regionFormOf(candidate.slug);
    if (form.core.length < 3 || form.core.includes('region')) {
      continue;
    }
    const group = byCore.get(form.core) ?? [];
    group.push({ slug: candidate.slug, rank: REGION_FORM_RANK[form.form] });
    byCore.set(form.core, group);
  }
  const proposals: ProposedCluster[] = [];
  for (const [core, group] of byCore.entries()) {
    if (group.length < 2 || group.length > 4) {
      continue;
    }
    const members = group
      .sort((a, b) => a.rank - b.rank || a.slug.localeCompare(b.slug))
      .map((entry) => entry.slug);
    proposals.push({
      members,
      class: 5,
      into: members[0],
      signal: 'region-form',
      evidence: `region name-form family (core '${core}', ${members.length} forms)`,
    });
  }
  return proposals;
}

// ---------------------------------------------------------------------------
// Signal family 5b: indicator number↔name (indikator-N-*) — Phase 22: the
// number-name↔bare-concept leg proposes CLASS-3 CLUSTERS; only the
// strict-identity legs (bare number ↔ same-named form, duplicates) stay pairs
// ---------------------------------------------------------------------------

const INDICATOR_PATTERN = /^(?:indikator|indicator)-(\d+)(?:-(.+))?$/;

/**
 * Phase 22 (§2.1, class-3 indicator↔measured-concept): is the slug an
 * indicator form (indikator-N or indikator-N-name)? Exported for the curation
 * validator's class-3 rule.
 */
export function isIndicatorSlug(slug: string): boolean {
  return INDICATOR_PATTERN.test(slug);
}

function indicatorEdges(candidates: PreMergeCandidate[]): { edges: RawEdge[]; clusters: ProposedCluster[] } {
  const edges: RawEdge[] = [];
  const clusters: ProposedCluster[] = [];
  const parsed = new Map<string, { number: string; name?: string } | null>();
  for (const candidate of candidates) {
    const match = INDICATOR_PATTERN.exec(candidate.slug);
    parsed.set(
      candidate.slug,
      match === null ? null : { number: match[1], ...(match[2] !== undefined ? { name: match[2] } : {}) },
    );
  }
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      const infoA = parsed.get(a.slug);
      const infoB = parsed.get(b.slug);
      if (infoA == null && infoB == null) {
        continue;
      }
      let from: PreMergeCandidate | null = null;
      let into: PreMergeCandidate | null = null;
      if (infoA != null && infoB != null) {
        if (infoA.number !== infoB.number) {
          continue;
        }
        if (infoA.name === undefined && infoB.name !== undefined) {
          into = a; // the bare number form survives
          from = b;
        } else if (infoB.name === undefined && infoA.name !== undefined) {
          into = b;
          from = a;
        } else if (infoA.name === infoB.name) {
          // Same number, same name — a plain duplicate.
          into = a.slug.localeCompare(b.slug) <= 0 ? a : b;
          from = into === a ? b : a;
        } else {
          continue; // same number, different names: never guessed (control class)
        }
      } else {
        // One indicator form, one bare-name candidate: the bare name must be
        // exactly the indicator's name part.
        const indicatorSide = infoA != null ? { info: infoA, candidate: a } : { info: infoB!, candidate: b };
        const nameSide = infoA != null ? b : a;
        if (indicatorSide.info.name === undefined || indicatorSide.info.name !== nameSide.slug) {
          continue;
        }
        // Phase 22 (§2.1, class 3 indicator↔measured concept, 1:1 only): this
        // pair is NOT a strict-identity merge — it proposes a composite.
        clusters.push({
          members: [indicatorSide.candidate.slug, nameSide.slug],
          class: 3,
          into: indicatorSide.candidate.slug,
          signal: 'indicator-form',
          evidence: `indicator number↔name family ('${a.slug}' ↔ '${b.slug}')`,
        });
        continue;
      }
      edges.push({
        a: a.slug,
        b: b.slug,
        from: from.slug,
        into: into.slug,
        signal: 'indicator-form',
        evidence: `indicator number↔name family ('${a.slug}' ↔ '${b.slug}')`,
      });
    }
  }
  return { edges, clusters };
}

// ---------------------------------------------------------------------------
// Signal family 6: checked-in da↔en domain glossary
// ---------------------------------------------------------------------------

interface GlossaryTerm {
  term: string;
  lang: LanguageCode;
}

/**
 * Corpus-domain (clinical/registry) da↔en glossary. Small and deliberately
 * scoped to term classes the observed corpora fork on: symptoms, procedures,
 * registries, measurements. Entries match a candidate by slug (slugified in
 * the entry's own language) or by exact case-insensitive title.
 */
const DOMAIN_GLOSSARY: GlossaryTerm[][] = [
  [{ term: 'echocardiography', lang: 'en' }, { term: 'ekkokardiografi', lang: 'da' }],
  [{ term: 'ischemic stroke', lang: 'en' }, { term: 'iskæmisk apopleksi', lang: 'da' }],
  [{ term: 'intracranial hemorrhage', lang: 'en' }, { term: 'intrakraniel blødning', lang: 'da' }],
  [{ term: 'serious bleeding', lang: 'en' }, { term: 'alvorlig blødning', lang: 'da' }],
  [{ term: 'major bleeding', lang: 'en' }, { term: 'stor blødning', lang: 'da' }],
  [{ term: 'bleeding', lang: 'en' }, { term: 'blødning', lang: 'da' }],
  [{ term: 'health clusters', lang: 'en' }, { term: 'sundhedsklynger', lang: 'da' }],
  [{ term: 'patient education', lang: 'en' }, { term: 'patientuddannelse', lang: 'da' }],
  [{ term: 'anticoagulation therapy', lang: 'en' }, { term: 'antikoagulationsbehandling', lang: 'da' }],
  [{ term: 'ct scan', lang: 'en' }, { term: 'ct-skanning', lang: 'da' }],
  [{ term: 'mri scan', lang: 'en' }, { term: 'mr-skanning', lang: 'da' }],
  [{ term: 'mortality', lang: 'en' }, { term: 'mortalitet', lang: 'da' }],
  [{ term: 'readmission', lang: 'en' }, { term: 'genindlæggelse', lang: 'da' }],
  [{ term: 'quality indicator', lang: 'en' }, { term: 'kvalitetsindikator', lang: 'da' }],
  [{ term: 'national patient registry', lang: 'en' }, { term: 'landspatientregisteret', lang: 'da' }],
  [{ term: 'thyroid stimulating hormone', lang: 'en' }, { term: 'thyreoideastimulerende hormon', lang: 'da' }],
  [{ term: 'creatinine', lang: 'en' }, { term: 'kreatinin', lang: 'da' }],
  [{ term: 'hemoglobin', lang: 'en' }, { term: 'hæmoglobin', lang: 'da' }],
  [{ term: 'heart failure', lang: 'en' }, { term: 'hjertesvigt', lang: 'da' }],
  [{ term: 'stroke', lang: 'en' }, { term: 'apopleksi', lang: 'da' }],
  [{ term: 'surgery', lang: 'en' }, { term: 'kirurgi', lang: 'da' }],
  [{ term: 'anesthesia', lang: 'en' }, { term: 'anæstesi', lang: 'da' }],
  [{ term: 'rehabilitation', lang: 'en' }, { term: 'genoptræning', lang: 'da' }],
  [{ term: 'general practitioner', lang: 'en' }, { term: 'almen læge', lang: 'da' }],
  [{ term: 'emergency department', lang: 'en' }, { term: 'akutafdelingen', lang: 'da' }],
  [{ term: 'outpatient clinic', lang: 'en' }, { term: 'ambulatorium', lang: 'da' }],
  [{ term: 'quality registry', lang: 'en' }, { term: 'kvalitetsdatabase', lang: 'da' }],
  [{ term: 'atrial fibrillation', lang: 'en' }, { term: 'atrieflimren', lang: 'da' }],
  [{ term: 'diabetes', lang: 'en' }, { term: 'sukkersyge', lang: 'da' }],
  [{ term: 'renal function', lang: 'en' }, { term: 'nyrefunktion', lang: 'da' }],
];

function glossaryEdges(
  candidates: PreMergeCandidate[],
  output: LanguageCode,
): RawEdge[] {
  const edges: RawEdge[] = [];
  // candidate slug -> (group index, matched term) — first match wins.
  const matched = new Map<string, { group: number; term: GlossaryTerm }>();
  for (const candidate of candidates) {
    for (let group = 0; group < DOMAIN_GLOSSARY.length; group++) {
      const hit = DOMAIN_GLOSSARY[group].find(
        (entry) =>
          slugify(entry.term, entry.lang) === candidate.slug ||
          entry.term.toLowerCase() === candidate.title.trim().toLowerCase(),
      );
      if (hit !== undefined) {
        matched.set(candidate.slug, { group, term: hit });
        break;
      }
    }
  }
  const slugs = Array.from(matched.keys());
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const slugA = slugs[i];
      const slugB = slugs[j];
      const matchA = matched.get(slugA)!;
      const matchB = matched.get(slugB)!;
      if (matchA.group !== matchB.group || matchA.term === matchB.term) {
        continue;
      }
      const candidateA = candidates.find((candidate) => candidate.slug === slugA)!;
      const candidateB = candidates.find((candidate) => candidate.slug === slugB)!;
      let into = candidateA;
      let from = candidateB;
      if (matchA.term.lang !== matchB.term.lang) {
        into = matchA.term.lang === output ? candidateA : candidateB;
        from = into === candidateA ? candidateB : candidateA;
      } else if (candidateB.slug.length > candidateA.slug.length) {
        into = candidateB;
        from = candidateA;
      }
      edges.push({
        a: slugA,
        b: slugB,
        from: from.slug,
        into: into.slug,
        signal: 'glossary',
        evidence: `domain glossary: '${matchA.term.term}' ↔ '${matchB.term.term}'`,
      });
    }
  }
  return edges;
}

// ---------------------------------------------------------------------------
// The detection entry point
// ---------------------------------------------------------------------------

/**
 * Detect pre-merge pairs over one concern's candidates. Deterministic, pure,
 * LLM-free. The six families run in precision order; duplicate pairs keep the
 * highest-precision signal. Output lists are sorted for byte-stable reports.
 *
 * Phase 22 (§2.1): the two formulaic families produce CLUSTER proposals
 * (region name-form families → class 5; indicator number-name↔bare-concept →
 * class 3) instead of merge pairs. A merge edge whose endpoints both fall
 * inside one proposed cluster's member set is dropped (the pair is judged as
 * a cluster, never double-covered); a cluster proposal containing a
 * neverMerge pair is vetoed whole (recorded in `vetoed`, never proposed).
 */
export function detectPreMergePairs(
  candidates: PreMergeCandidate[],
  options?: PreMergeOptions,
): PreMergeDetection {
  const input = options?.language?.input ?? 'en';
  const output = options?.language?.output ?? 'en';

  const indicator = indicatorEdges(candidates);
  const clusterProposals: ProposedCluster[] = [
    ...regionClusterProposals(candidates),
    ...indicator.clusters,
  ];

  // Precision order: the auto-tier signals first, then corpus evidence, then
  // the formulaic strict-identity legs (more specific than generic token
  // overlap — an indikator-N-* pair must record as indicator-form, not
  // subsequence), then the name-part signals, then the glossary.
  const edges: RawEdge[] = [
    ...transliterationEdges(candidates, input),
    ...aliasEdges(candidates, input),
    ...(options?.corpusText !== undefined && options.corpusText.length > 0
      ? abbreviationEdges(candidates, input, options.corpusText)
      : []),
    ...editDistanceEdges(candidates),
    ...indicator.edges,
    ...subsequenceEdges(candidates),
    ...initialsEdges(candidates, input),
    ...glossaryEdges(candidates, output),
  ];

  // A pair wholly inside a proposed cluster's member set is judged as the
  // cluster, never as a merge pair (no double coverage).
  const clusterPairKeys = new Set<string>();
  for (const cluster of clusterProposals) {
    for (let i = 0; i < cluster.members.length; i++) {
      for (let j = i + 1; j < cluster.members.length; j++) {
        clusterPairKeys.add(curationPairKey(cluster.members[i], cluster.members[j]));
      }
    }
  }

  // Dedupe by unordered pair: first (highest-precision) signal wins.
  const byPair = new Map<string, RawEdge>();
  for (const edge of edges) {
    if (edge.from === edge.into) {
      continue;
    }
    const key = curationPairKey(edge.a, edge.b);
    if (clusterPairKeys.has(key)) {
      continue;
    }
    if (!byPair.has(key)) {
      byPair.set(key, edge);
    }
  }

  const vetoPairs = new Set((options?.neverMerge ?? []).map(([a, b]) => curationPairKey(a, b)));
  const vetoSlugs = new Set(options?.vetoSlugs ?? []);
  const autoApply: ProposedPair[] = [];
  const proposed: ProposedPair[] = [];
  const vetoed: ProposedPair[] = [];
  for (const edge of byPair.values()) {
    const pair: ProposedPair = { from: edge.from, into: edge.into, signal: edge.signal, evidence: edge.evidence };
    if (AUTO_APPLY_SIGNALS.has(edge.signal)) {
      // neverMerge (and the splits escape hatch) beat auto-apply (gates
      // 21.7/21.8) — recorded, never applied.
      if (
        vetoPairs.has(curationPairKey(edge.from, edge.into)) ||
        vetoSlugs.has(edge.from) ||
        vetoSlugs.has(edge.into)
      ) {
        vetoed.push(pair);
      } else {
        autoApply.push(pair);
      }
    } else {
      proposed.push(pair);
    }
  }

  // Phase 22: a neverMerge pair inside a cluster proposal vetoes the WHOLE
  // proposal (never a partial cluster) — recorded pair-shaped in `vetoed`.
  const proposedClusters: ProposedCluster[] = [];
  for (const cluster of clusterProposals) {
    const vetoedPair = cluster.members.flatMap((a, i) =>
      cluster.members.slice(i + 1).filter((b) => vetoPairs.has(curationPairKey(a, b))),
    );
    if (vetoedPair.length > 0) {
      vetoed.push({
        from: vetoedPair[0],
        into: cluster.into,
        signal: cluster.signal,
        evidence: cluster.evidence,
      });
      continue;
    }
    proposedClusters.push(cluster);
  }

  const byEndpoints = (x: ProposedPair, y: ProposedPair): number =>
    x.from.localeCompare(y.from) || x.into.localeCompare(y.into);
  autoApply.sort(byEndpoints);
  proposed.sort(byEndpoints);
  vetoed.sort(byEndpoints);
  proposedClusters.sort(
    (x, y) => x.into.localeCompare(y.into) || x.members.join(' ').localeCompare(y.members.join(' ')),
  );
  return { autoApply, proposed, vetoed, proposedClusters };
}
