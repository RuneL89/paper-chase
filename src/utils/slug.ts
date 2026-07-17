/**
 * Slug helpers for wikis and sources.
 *
 * Wiki slugs are user-provided and validated (lowercase kebab-case, per the
 * template's folder naming rules). Source slugs are derived from PDF file
 * names, so they are slugified defensively instead of rejected.
 */

/** Lowercase kebab-case, must start with a letter or digit. */
export function isValidWikiSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(slug);
}

/**
 * Convert an arbitrary name to lowercase kebab-case: lowercase, every run of
 * non-alphanumeric characters becomes a single '-', edges trimmed.
 */
export function slugify(name: string): string {
  return name
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
