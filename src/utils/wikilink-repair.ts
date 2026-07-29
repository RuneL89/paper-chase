import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildSlugUniverseForDir,
  resolveWikilinkTarget,
  type SlugUniverse,
} from '../validation/link-checker';
import { readIngestionState, writeIngestionState } from '../state/ingestion-state';
import { readWikiLanguage } from '../state/language';
import { sha256 } from './hash';
import { slugify } from './slug';
import { parseWikilinkTarget } from './wikilinks';

/**
 * Phase 20 (B20, phase doc §2; canon: vision `02` §2 "no page is an island",
 * `07` §2.5 broken-wikilink reporting, `05` §2 aliases as a lookup aid).
 *
 * The model writes wikilinks to slugs that ALMOST exist (`[[indikator-2]]`
 * for `indikator-2-ekkokardiografi`); the link checker reports them and
 * nobody repairs them. This module is the deterministic, conservative repair
 * pass — only UNAMBIGUOUS fixes, never a guess:
 *
 * For each wikilink whose target does not resolve under the checker's exact
 * semantics (path-form first, then basename-slug — the shared
 * `resolveWikilinkTarget` from `validation/link-checker.ts`, so repair and
 * validation can never drift):
 *
 * 1. UNIQUE-PREFIX MATCH: exactly one page slug in the wiki starts with the
 *    slugified target -> repair to the full slug (`indikator-2` ->
 *    `indikator-2-ekkokardiografi`).
 * 2. UNIQUE ALIAS MATCH: exactly one page whose frontmatter `aliases`
 *    slugifies to the target -> repair to that page's slug. Aliases are
 *    slugified with the universe's `language` (the wiki's last INPUT
 *    language — vision `04` §9.3: slugs are transliterated with the input
 *    language's map), so a Danish alias `... måling` matches the model's
 *    slug-form target `...-maaling`; an absent language is the byte-identical
 *    English path.
 * 3. OTHERWISE (zero or multiple matches): the link is left broken and
 *    reported with the candidate list (prefix + alias candidates, sorted).
 *
 * Only the target segment is rewritten — display text, whitespace, and every
 * other byte of the page are untouched, and a page with nothing repairable is
 * returned byte-identical. Index pages and `sources/`/`documents/` paths are
 * out of scope (their links are DOX/deterministic concerns): the pure
 * function repairs whatever markdown it is given, and the SCOPE filter
 * (`isRepairableContentPage`) is applied by the remediation core and the
 * ingest seam.
 *
 * ORCHESTRATOR SEAM CONTRACT (`src/commands/ingest.ts` synthesis write
 * points — the orchestrator owns the wiring):
 *
 * ```ts
 * const universe = await buildSlugUniverse(wikiSlug, workspace, { language: inputLanguage });
 * // ^ once per run, with the run's resolved INPUT language (vision `04` §9.3)
 * const { markdown, repairs, unrepairable } = repairWikilinksInMarkdown(pageMarkdown, universe);
 * // compose `markdown` with the frontmatter/Sources enforcers; log per page:
 * //   repairs:      `Wikilink repair: [[from|Display]] -> [[to|Display]] (prefix|alias)`
 * //   unrepairable: `Wikilink unrepairable: [[from]] (candidates: a, b | none)`
 * ```
 *
 * Apply at the four entity/topic synthesis write points ONLY (alongside the
 * Phase 17 enforcers), never to index/sources/documents pages. The universe
 * is page-set state: repairing links never adds or removes pages, so one
 * universe per run stays valid across every page it is applied to.
 */

export type WikilinkRepairRule = 'prefix' | 'alias';

export interface WikilinkRepair {
  /** The original resolution target (pre-pipe segment, trimmed). */
  from: string;
  /** The full slug the link now points at. */
  to: string;
  /** The link's display text when it was pipe form (preserved byte-for-byte). */
  display?: string;
  /** Which rule repaired the link. */
  rule: WikilinkRepairRule;
}

export interface UnrepairableWikilink {
  /** The unresolvable target, left in place. */
  from: string;
  /** The link's display text when it was pipe form. */
  display?: string;
  /**
   * Candidate page slugs — the sorted, deduplicated union of the prefix and
   * alias matches. Empty when nothing matched at all; two or more when the
   * target was ambiguous (never guessed).
   */
  candidates: string[];
}

export interface WikilinkRepairResult {
  /** The page with every unambiguous repair applied; byte-identical input when nothing was repaired. */
  markdown: string;
  repairs: WikilinkRepair[];
  unrepairable: UnrepairableWikilink[];
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

/**
 * The pure repair pass (phase doc §2.2). Scans every `[[...]]` in `markdown`,
 * and for each target that does NOT resolve against `universe` tries the
 * unique-prefix rule, then the unique-alias rule. Repaired links keep their
 * display text and surrounding whitespace byte-for-byte; zero/ambiguous
 * matches are left in place and reported. Pure and synchronous — the caller
 * builds the universe once per wiki (`buildSlugUniverse` /
 * `buildSlugUniverseForDir`) and applies this to each entity/topic page.
 */
export function repairWikilinksInMarkdown(markdown: string, universe: SlugUniverse): WikilinkRepairResult {
  const repairs: WikilinkRepair[] = [];
  const unrepairable: UnrepairableWikilink[] = [];

  // Distinct page slugs in walk order — the prefix-match candidate space
  // ("exactly one page slug in the wiki starts with the target").
  const pageSlugs: string[] = [];
  const seenSlugs = new Set<string>();
  for (const page of universe.pages) {
    if (!seenSlugs.has(page.slug)) {
      seenSlugs.add(page.slug);
      pageSlugs.push(page.slug);
    }
  }

  const repaired = markdown.replace(/\[\[([^\[\]]+)\]\]/g, (whole, inner: string) => {
    const { target, display } = parseWikilinkTarget(inner);
    if (target.length === 0 || resolveWikilinkTarget(universe, target)) {
      return whole;
    }
    const targetSlug = slugify(target);
    const prefixCandidates =
      targetSlug.length > 0 ? pageSlugs.filter((slug) => slug.startsWith(targetSlug)) : [];
    const aliasCandidates =
      targetSlug.length > 0
        ? uniqueSorted(
            universe.pages
              .filter((page) =>
                page.aliases.some((alias) => slugify(alias, universe.language) === targetSlug),
              )
              .map((page) => page.slug),
          )
        : [];

    let to: string | undefined;
    let rule: WikilinkRepairRule | undefined;
    if (prefixCandidates.length === 1) {
      to = prefixCandidates[0];
      rule = 'prefix';
    } else if (aliasCandidates.length === 1) {
      to = aliasCandidates[0];
      rule = 'alias';
    }

    if (to === undefined || rule === undefined) {
      unrepairable.push({
        from: target,
        ...(display !== undefined ? { display } : {}),
        candidates: uniqueSorted([...prefixCandidates, ...aliasCandidates]),
      });
      return whole;
    }

    repairs.push({ from: target, to, ...(display !== undefined ? { display } : {}), rule });

    // Splice ONLY the target segment: the display text (everything from the
    // first `|` on) and any whitespace around the target are preserved
    // byte-for-byte.
    const pipeIndex = inner.indexOf('|');
    const targetSegment = pipeIndex === -1 ? inner : inner.slice(0, pipeIndex);
    const leading = /^\s*/.exec(targetSegment)?.[0] ?? '';
    const trailing = /\s*$/.exec(targetSegment)?.[0] ?? '';
    const newInner =
      pipeIndex === -1
        ? `${leading}${to}${trailing}`
        : `${leading}${to}${trailing}${inner.slice(pipeIndex)}`;
    return `[[${newInner}]]`;
  });

  return { markdown: repaired, repairs, unrepairable };
}

/**
 * The remediation scope filter (phase doc §2.1/§2.3): entity/topic content
 * pages only — `index.md` pages and `sources/`/`documents/` paths are out of
 * scope (their links are DOX/deterministic concerns). Matches the checker's
 * island-detection scope.
 */
export function isRepairableContentPage(page: { wikiRelative: string }): boolean {
  const rel = page.wikiRelative;
  if (!rel.startsWith('entities/') && !rel.startsWith('topics/')) {
    return false;
  }
  return !rel.endsWith('index.md');
}

export interface WikiWikilinkRepairReport {
  wikiSlug: string;
  dry: boolean;
  /** Every applied repair, one entry per link occurrence, with the wiki-relative page path. */
  repaired: Array<WikilinkRepair & { page: string }>;
  /** Every link left broken, with the wiki-relative page path and the candidate list. */
  unrepairable: Array<UnrepairableWikilink & { page: string }>;
  /** In-scope pages whose content did not change. */
  unchangedPages: number;
  /** Wiki-relative paths of the pages whose content changed (written in real mode; would-be-written under `--dry`). */
  modifiedPages: string[];
  /** `.state/ingestion.json` pageHashes entries re-converged (0 under `--dry`). */
  pageHashesUpdated: number;
}

/**
 * The one-time remediation core (phase doc §2.3): applies
 * `repairWikilinksInMarkdown` to every entity/topic content page of one wiki,
 * rewrites the changed pages, and re-converges `.state/ingestion.json`
 * `pageHashes` for every modified page (SHA-256 of the new on-disk content —
 * the same re-hash-from-disk semantics as the ingest's post-synthesis pass,
 * so the next ingest sees tool-written content, not B19-class false "manual
 * edit" flags). Unmodified pages' hash entries are untouched. With
 * `options.dry`, nothing is written — the report describes what WOULD happen.
 */
export async function repairWikilinksInWiki(
  wikiDir: string,
  wikiSlug: string,
  options: { dry?: boolean } = {},
): Promise<WikiWikilinkRepairReport> {
  const dry = options.dry === true;
  // The alias rule slugifies with the wiki's last input language (the map the
  // wiki's slugs — and the model's near-miss paraphrases of them — were
  // produced with); absent language state is the English default.
  const { lastInputLanguage } = await readWikiLanguage(wikiDir);
  const universe = await buildSlugUniverseForDir(wikiDir, wikiSlug, { language: lastInputLanguage });
  const report: WikiWikilinkRepairReport = {
    wikiSlug,
    dry,
    repaired: [],
    unrepairable: [],
    unchangedPages: 0,
    modifiedPages: [],
    pageHashesUpdated: 0,
  };

  for (const page of universe.pages) {
    if (!isRepairableContentPage(page)) {
      continue;
    }
    const content = await readFile(page.absolute, 'utf-8');
    const result = repairWikilinksInMarkdown(content, universe);
    for (const repair of result.repairs) {
      report.repaired.push({ page: page.wikiRelative, ...repair });
    }
    for (const item of result.unrepairable) {
      report.unrepairable.push({ page: page.wikiRelative, ...item });
    }
    if (result.markdown === content) {
      report.unchangedPages++;
      continue;
    }
    report.modifiedPages.push(page.wikiRelative);
    if (!dry) {
      await writeFile(page.absolute, result.markdown, 'utf-8');
    }
  }

  // Hash re-convergence (the B19 guard): record the post-repair disk hash for
  // every modified page so the next ingest does not flag the tool's own
  // rewrites as manual edits.
  if (!dry && report.modifiedPages.length > 0) {
    const state = await readIngestionState(wikiDir);
    const pageHashes = { ...(state.pageHashes ?? {}) };
    for (const rel of report.modifiedPages) {
      pageHashes[rel] = await sha256(join(wikiDir, rel));
    }
    state.pageHashes = pageHashes;
    await writeIngestionState(wikiDir, state);
    report.pageHashesUpdated = report.modifiedPages.length;
  }

  return report;
}

function renderLink(target: string, display: string | undefined): string {
  return display !== undefined ? `[[${target}|${display}]]` : `[[${target}]]`;
}

/**
 * The per-wiki report (phase doc §2.3): repairs as `old -> new`, the
 * unrepairable links with their candidate lists, and the unchanged count.
 */
export function formatWikiRepairReport(report: WikiWikilinkRepairReport): string {
  const lines: string[] = [];
  lines.push(`Wiki ${report.wikiSlug}:`);
  if (report.repaired.length === 0) {
    lines.push('  Repaired: none');
  } else {
    lines.push(`  Repaired ${report.repaired.length} link(s) across ${report.modifiedPages.length} page(s):`);
    for (const repair of report.repaired) {
      lines.push(
        `    ${repair.page}: ${renderLink(repair.from, repair.display)} -> ${renderLink(repair.to, repair.display)} (${repair.rule})`,
      );
    }
  }
  if (report.unrepairable.length === 0) {
    lines.push('  Unrepairable: none');
  } else {
    lines.push(`  Unrepairable ${report.unrepairable.length} link(s) (left unchanged):`);
    for (const item of report.unrepairable) {
      const candidates =
        item.candidates.length > 0 ? `candidates: ${item.candidates.join(', ')}` : 'no candidates';
      lines.push(`    ${item.page}: ${renderLink(item.from, item.display)} (${candidates})`);
    }
  }
  lines.push(`  Unchanged pages: ${report.unchangedPages}`);
  if (report.dry) {
    lines.push('  (dry run — no files written)');
  } else if (report.pageHashesUpdated > 0) {
    lines.push(`  pageHashes re-converged: ${report.pageHashesUpdated} page(s)`);
  }
  return lines.join('\n');
}
