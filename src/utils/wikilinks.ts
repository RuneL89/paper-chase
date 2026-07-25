/**
 * Obsidian-native wikilink forms (user directive 2026-07-20, compliance-log
 * entry [2026-07-20 00:15]: "research how obsidian creates these references
 * and make sure this is how the links are created").
 *
 * Obsidian's own link-creation form is target-plus-display:
 * `[[<file-name-or-path>|<Display>]]`. When the display text is identical to
 * the target, Obsidian emits the bare form `[[target]]` instead. This module
 * is the single home for both directions:
 *
 * - `formatWikilink(target, display?)` — build a link the way Obsidian does.
 * - `parseWikilinkTarget(inner)` — split a link's inner text on the FIRST `|`
 *   (targets in our wikis never contain spaces or pipes — they are slugs or
 *   slug paths — so the first pipe unambiguously separates target from display).
 *
 * Link conventions used across the CLI (see `.state/phase-6-status.json`):
 *
 * - Content page: `[[<basename-without-.md>|<Title>]]` (basename only, no
 *   folder path), e.g. `[[board-of-directors|Board of Directors]]`.
 * - Folder index: `[[<folder-path>/index|<Title>]]` (path required — many
 *   files share the basename `index`), e.g. `[[entities/index|Entities]]`.
 * - Wiki root index: `[[index|<Wiki Title>]]`, e.g. `[[index|Coca Cola Wiki]]`.
 * - Bare `[[secretary]]` when the display text equals the target exactly.
 */

/**
 * Build a wikilink in Obsidian's native form: `[[target|display]]`, or the
 * bare form `[[target]]` when no display text is given or the display text
 * equals the target exactly (Obsidian's own behavior when display == target).
 *
 * @param target  The resolution target: a file basename without `.md` for
 *                content pages, `<folder-path>/index` for folder indexes, or
 *                `index` for the wiki root.
 * @param display Optional display text (usually the page/folder title).
 */
export function formatWikilink(target: string, display?: string): string {
  const trimmedTarget = target.trim();
  const trimmedDisplay = display?.trim();
  if (!trimmedDisplay || trimmedDisplay === trimmedTarget) {
    return `[[${trimmedTarget}]]`;
  }
  return `[[${trimmedTarget}|${trimmedDisplay}]]`;
}

/**
 * Parse the inner text of a `[[...]]` wikilink into its resolution target and
 * optional display text, splitting on the FIRST `|` (the display text may
 * itself contain pipes; the target never does in our wikis).
 *
 * - `parseWikilinkTarget('john-smith|John Smith')` -> `{ target: 'john-smith', display: 'John Smith' }`
 * - `parseWikilinkTarget('Acme Corp')`             -> `{ target: 'Acme Corp' }`
 * - `parseWikilinkTarget('a|b|c')`                 -> `{ target: 'a', display: 'b|c' }`
 */
export function parseWikilinkTarget(inner: string): { target: string; display?: string } {
  const pipeIndex = inner.indexOf('|');
  if (pipeIndex === -1) {
    return { target: inner.trim() };
  }
  const target = inner.slice(0, pipeIndex).trim();
  const display = inner.slice(pipeIndex + 1).trim();
  return display.length > 0 ? { target, display } : { target };
}

/**
 * Phase 14 (phase doc §2.3, vision `04` §3.2 Step 6): the rewrite applied to a
 * wikilink whose target was merged away by curation.
 */
export interface WikilinkRewrite {
  /** The canonical (surviving) slug the link now points at. */
  into: string;
  /**
   * The merged-away page's title — used as the display text when the original
   * link was the bare form `[[from]]`, so the visible text of the link does
   * not change: `[[from]]` → `[[into|From Title]]`.
   */
  fromTitle: string;
}

/**
 * Phase 14 (phase doc §2.3 + gate 14.7): exact-segment wikilink rewrite across
 * a page's markdown. Every link whose FULL target segment equals a merged-away
 * slug is repointed to the canonical slug; the display text is preserved
 * (`[[from|Display]]` → `[[into|Display]]`), and the bare form gains the
 * merged page's title as its display (`[[from]]` → `[[into|From Title]]`).
 *
 * Matching is by exact target segment ONLY — never a substring — so prefix
 * collisions are safe: rewriting `[[odense]]` leaves
 * `[[odense-bup-auditorium|X]]` and `[[odense-2]]` untouched. Frontmatter and
 * citation markers contain no `[[...]]` spans in our pages and are untouched.
 */
export function rewriteWikilinkTargets(
  markdown: string,
  rewrites: ReadonlyMap<string, WikilinkRewrite>,
): string {
  if (rewrites.size === 0) {
    return markdown;
  }
  return markdown.replace(/\[\[([^\[\]]+)\]\]/g, (whole, inner: string) => {
    const { target, display } = parseWikilinkTarget(inner);
    const rewrite = rewrites.get(target);
    if (!rewrite) {
      return whole;
    }
    return formatWikilink(rewrite.into, display ?? rewrite.fromTitle);
  });
}
