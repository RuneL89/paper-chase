import matter from 'gray-matter';
import { formatWikilink } from '../../utils/wikilinks';

/**
 * Phase 24 Component A output (phase doc §2.1/§2.9, vision `05` §9.1): the
 * cross-wiki entity registry page `wikis/cross-wiki/entities.md` — a
 * `cross-wiki-index` page carrying a markdown table of every entity that
 * appears in ≥2 wikis. One row per MEMBER: canonical title, wiki,
 * path-qualified page link, entity type, aliases, and the per-member context
 * summary (Component E). The JSON mirror
 * `.state/cross-wiki/entity-registry.json` carries the same rows
 * deterministically (gate 24.1: mirror matches the table).
 *
 * No `wiki` field (workspace-level artifact); no `sources` (the registry
 * makes no factual claims — evidence lives on the linked per-wiki pages).
 */

export interface RegistryMember {
  wiki: string;
  /** Entity slug (page basename). */
  slug: string;
  /** Path-qualified page id relative to wikis/, without .md. */
  path: string;
  title: string;
  type: string;
  /** Per-member context summary ('' when unavailable). */
  summary: string;
}

export interface RegistryEntry {
  canonicalTitle: string;
  aliases: string[];
  /** Distinct wikis, sorted. */
  wikis: string[];
  /** Members sorted by path. */
  members: RegistryMember[];
  /** How the cluster was formed. */
  match: 'exact' | 'fuzzy' | 'review';
}

function tableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/**
 * The registry's frontmatter `children`: every member page, path-qualified
 * with `.md` (the index-page contract, vision `05` §3.1), sorted.
 */
export function registryChildren(entries: RegistryEntry[]): string[] {
  const children: string[] = [];
  for (const entry of entries) {
    for (const member of entry.members) {
      children.push(`${member.path}.md`);
    }
  }
  return children.sort((a, b) => a.localeCompare(b));
}

/**
 * Render `wikis/cross-wiki/entities.md`. Rows are sorted by canonical title,
 * then member path — byte-deterministic for a given registry. The empty form
 * is an honest report (phase doc §2.1 safety net).
 */
export function writeEntityRegistryPage(entries: RegistryEntry[], updated: string): string {
  const sorted = [...entries].sort((a, b) => a.canonicalTitle.localeCompare(b.canonicalTitle));
  const entityCount = sorted.length;

  const lines: string[] = [];
  lines.push('# Cross-Wiki Entity Registry', '');
  if (entityCount === 0) {
    lines.push(
      'No cross-wiki entities found. This registry lists entities that appear in at least two wikis in the workspace; none were found in the current workspace.',
      '',
    );
  } else {
    lines.push(
      `${entityCount} ${entityCount === 1 ? 'entity appears' : 'entities appear'} in at least two wikis in this workspace. This is a derived, read-only index: follow the page links for the cited evidence on each wiki's own page.`,
      '',
    );
    lines.push(
      '| Entity | Wiki | Page | Type | Aliases | Summary |',
      '| --- | --- | --- | --- | --- | --- |',
    );
    for (const entry of sorted) {
      for (const member of entry.members) {
        lines.push(
          `| ${tableCell(entry.canonicalTitle)} | ${member.wiki} | ${formatWikilink(member.path, member.title)} | ${tableCell(member.type)} | ${tableCell(entry.aliases.join('; '))} | ${tableCell(member.summary)} |`,
        );
      }
    }
    lines.push('');
  }

  const frontmatter: Record<string, unknown> = {
    title: 'Cross-Wiki Entity Registry',
    type: 'cross-wiki-index',
    updated,
    children: registryChildren(sorted),
    entityCount,
  };
  return matter.stringify(`\n${lines.join('\n')}\n`, frontmatter);
}
