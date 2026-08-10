import { CROSS_WIKI_MAX_TOKENS, runCrossWikiJsonCall, type CrossWikiLanguage } from './llm';
import { writeCrossWikiState } from './state';

/**
 * Phase 24 Component F (phase doc §2.6, user decision 2026-08-09 #8): the
 * Relationship Predicate Normalizer. ONE batched cheap LLM call clusters the
 * semantically identical relationship predicate strings found across all
 * wikis into canonical forms, written to `.state/cross-wiki/predicate-map.json`
 * as an array of `{ canonical, variants }` groups. Component B rewrites every
 * relationship edge to its canonical predicate so a downstream agent can query
 * one form and find every equivalent edge.
 *
 * Fallback: any failure (LLM error, validation exhaustion) yields the
 * IDENTITY map (every predicate its own canonical) with a warning — the graph
 * is still written, the pass never aborts.
 */

export interface PredicateGroup {
  canonical: string;
  variants: string[];
}

export type NormalizePredicatesFn = (predicates: string[], feedback: string | undefined, attempt: number) => Promise<string>;

export interface NormalizePredicatesOptions {
  workspace?: string;
  language?: CrossWikiLanguage;
  logPath?: string;
  normalizePredicatesFn?: NormalizePredicatesFn;
  onProgress?: (message: string) => void;
}

function validatePredicateMap(
  data: unknown,
  predicates: string[],
): { valid: boolean; errors: string[]; value?: PredicateGroup[] } {
  const errors: string[] = [];
  if (typeof data !== 'object' || data === null || !Array.isArray((data as Record<string, unknown>).groups)) {
    return { valid: false, errors: ['output must be an object with a "groups" array'] };
  }
  const input = new Set(predicates);
  const seen = new Set<string>();
  const groups: PredicateGroup[] = [];
  for (const [index, group] of ((data as Record<string, unknown>).groups as unknown[]).entries()) {
    if (typeof group !== 'object' || group === null) {
      errors.push(`groups[${index}]: not an object`);
      continue;
    }
    const g = group as Record<string, unknown>;
    if (typeof g.canonical !== 'string' || g.canonical.trim().length === 0) {
      errors.push(`groups[${index}]: missing "canonical"`);
      continue;
    }
    if (!Array.isArray(g.variants) || g.variants.length === 0 || !g.variants.every((v) => typeof v === 'string')) {
      errors.push(`groups[${index}]: "variants" must be a non-empty list of strings`);
      continue;
    }
    const variants = (g.variants as string[]).map((variant) => variant.trim());
    for (const variant of variants) {
      if (!input.has(variant)) {
        errors.push(`groups[${index}]: unknown predicate "${variant}"`);
      } else if (seen.has(variant)) {
        errors.push(`groups[${index}]: predicate "${variant}" listed in two groups`);
      } else {
        seen.add(variant);
      }
    }
    if (!variants.includes(g.canonical)) {
      errors.push(`groups[${index}]: canonical "${g.canonical}" is not one of its variants`);
    }
    groups.push({ canonical: g.canonical.trim(), variants });
  }
  for (const predicate of predicates) {
    if (!seen.has(predicate)) {
      errors.push(`predicate "${predicate}" is missing from every group`);
    }
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, errors: [], value: groups };
}

/**
 * Canonicalize the supplied predicate strings and write
 * `.state/cross-wiki/predicate-map.json`. Returns the groups (identity map on
 * any failure). An empty input writes an empty map without an LLM call.
 */
export async function normalizePredicates(
  predicates: string[],
  options: NormalizePredicatesOptions = {},
): Promise<PredicateGroup[]> {
  const workspace = options.workspace ?? '.';
  const unique = Array.from(new Set(predicates)).sort((a, b) => a.localeCompare(b));
  let groups: PredicateGroup[] | null = null;

  if (unique.length > 0) {
    try {
      const outcome = await runCrossWikiJsonCall<PredicateGroup[]>({
        promptFile: 'cross-wiki-predicate-normalize.prompt.txt',
        slots: { predicates: unique.map((predicate) => `- ${predicate}`).join('\n') },
        callType: 'cross-wiki-predicate-normalize',
        context: `cross-wiki predicate normalize (${unique.length} predicates)`,
        maxTokens: CROSS_WIKI_MAX_TOKENS,
        language: options.language,
        logPath: options.logPath,
        label: `cross-wiki predicate normalize (${unique.length} predicates)`,
        validate: (data) => validatePredicateMap(data, unique),
        callLLMFn: options.normalizePredicatesFn
          ? (feedback, attempt) => options.normalizePredicatesFn!(unique, feedback, attempt)
          : undefined,
      });
      groups = outcome.output;
    } catch (err) {
      options.onProgress?.(
        `Warning: cross-wiki predicate normalization failed (${(err as Error).message}); using the identity predicate map.`,
      );
      groups = null;
    }
    if (groups === null) {
      options.onProgress?.('Warning: cross-wiki predicate normalization unavailable; using the identity predicate map.');
    }
  }

  const result = groups ?? unique.map((predicate) => ({ canonical: predicate, variants: [predicate] }));
  await writeCrossWikiState(workspace, 'predicate-map.json', result);
  return result;
}

/** Build the variant → canonical lookup from a predicate map. */
export function predicateLookup(groups: PredicateGroup[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const group of groups) {
    for (const variant of group.variants) {
      lookup.set(variant, group.canonical);
    }
  }
  return lookup;
}
