import matter from 'gray-matter';

/**
 * Obsidian-resolvable wikilink aliases (UAT 6.3 fix; user decision 2026-07-19,
 * Option A in `.state/compliance-log.md` entry [2026-07-19 02:30]; vision
 * `05_page_types_specification.md` §2 optional field `aliases`).
 *
 * Obsidian resolves `[[Page Title]]` wikilinks only by path, file basename
 * (case-insensitive), or frontmatter `aliases:` — it does not read frontmatter
 * titles. Every page writer therefore adds `aliases: [<title>]` to the
 * frontmatter when the page title differs from the file basename (without
 * `.md`), compared case-insensitively, and omits the field otherwise:
 *
 * - `secretary.md` titled "Secretary"                -> no alias (case-insensitive match)
 * - `governance-structure.md` titled "Governance Structure" -> aliases: [Governance Structure]
 * - `entities/index.md` titled "Entities"            -> aliases: [Entities] (basename is always `index`)
 * - document chunk pages (title == chunkId == basename) -> no alias
 */

/**
 * Compute the `aliases` frontmatter value for a page: `[title]` when the title
 * differs from the file basename (case-insensitive), `undefined` otherwise.
 *
 * @param title    The page's frontmatter title.
 * @param fileSlug The page's file basename without the `.md` extension
 *                 (e.g. the entity slug, the source slug, or `index`).
 */
export function aliasesForTitle(title: string, fileSlug: string): string[] | undefined {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed.toLowerCase() === fileSlug.toLowerCase() ? undefined : [trimmed];
}

/**
 * Phase 14 (phase doc §2.3, vision `05` §2): an entity page's full alias set —
 * the title-vs-basename base alias from `aliasesForTitle` plus every variant
 * title accumulated by curation merges (so `[[Odense BUP]]` resolves to the
 * canonical `odense-bup-auditorium` page after the forked pages merged into
 * it). Extras are trimmed; empties, the basename itself (case-insensitive),
 * the title itself, and exact duplicates are skipped.
 */
export function combinedAliases(title: string, fileSlug: string, extraAliases?: string[]): string[] | undefined {
  const base = aliasesForTitle(title, fileSlug) ?? [];
  if (!extraAliases || extraAliases.length === 0) {
    return base.length > 0 ? base : undefined;
  }
  const seen = new Set(base.map((alias) => alias.toLowerCase()));
  const combined = [...base];
  for (const extra of extraAliases) {
    const trimmed = extra.trim();
    if (
      trimmed.length === 0 ||
      trimmed.toLowerCase() === fileSlug.toLowerCase() ||
      trimmed.toLowerCase() === title.trim().toLowerCase() ||
      seen.has(trimmed.toLowerCase())
    ) {
      continue;
    }
    seen.add(trimmed.toLowerCase());
    combined.push(trimmed);
  }
  return combined.length > 0 ? combined : undefined;
}

/**
 * Deterministic alias enforcement over a fully-rendered markdown page (used
 * for LLM-written synthesis output, whose frontmatter is model-generated):
 * parse the page's frontmatter and set or remove the `aliases` field per
 * `combinedAliases` (Phase 14: curation-merged variant titles included), then
 * re-serialize. Pages without a frontmatter block, or with unparseable
 * frontmatter, are returned unchanged (the schema validator already flags
 * those; this helper never invents a frontmatter block).
 */
export function enforceAliasesInMarkdown(
  markdown: string,
  title: string,
  fileSlug: string,
  extraAliases?: string[],
): string {
  if (!/^---[ \t]*\r?\n/.test(markdown)) {
    return markdown;
  }
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(markdown);
  } catch {
    return markdown;
  }
  const aliases = combinedAliases(title, fileSlug, extraAliases);
  if (aliases) {
    parsed.data.aliases = aliases;
  } else {
    delete parsed.data.aliases;
  }
  return matter.stringify(parsed.content, parsed.data);
}
