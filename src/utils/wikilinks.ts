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
