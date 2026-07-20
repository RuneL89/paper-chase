/**
 * Slug helpers for wikis and sources.
 *
 * Wiki slugs are user-provided and validated (lowercase kebab-case, per the
 * template's folder naming rules). Source slugs are derived from PDF file
 * names, so they are slugified defensively instead of rejected.
 */

import { transliterate, type LanguageCode } from './language';

/** Lowercase kebab-case, must start with a letter or digit. */
export function isValidWikiSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(slug);
}

/**
 * Convert an arbitrary name to lowercase kebab-case: lowercase, every run of
 * non-alphanumeric characters becomes a single '-', edges trimmed.
 *
 * Phase 7 (vision `04` §9.3): when an input `language` is given (and is not
 * English), the name is transliterated with that language's map FIRST so
 * non-ASCII characters survive meaningfully ('Søren' → 'soeren', not 's-ren').
 * When `language` is omitted or 'en', the function runs exactly the original
 * ASCII-only path — byte-identical output (the Phase 0 surface freeze and
 * every pre-Phase-7 test depend on this).
 */
export function slugify(name: string, language?: LanguageCode): string {
  const source = language && language !== 'en' ? transliterate(name, language) : name;
  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Derive the source slug for a PDF file name: strip the .pdf extension and
 * slugify the basename ('Annual Report 2024.pdf' -> 'annual-report-2024').
 */
export function sourceSlugForFile(fileName: string): string {
  const base = fileName.replace(/\.pdf$/i, '');
  return slugify(base);
}
