import { readFileSync, existsSync } from 'fs';
import matter from 'gray-matter';

/**
 * Reads an existing markdown file and returns its `created` frontmatter
 * timestamp if it is a valid ISO 8601 string. Returns undefined otherwise.
 */
export function readCreatedTimestamp(filePath: string): string | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }
  try {
    const parsed = matter(readFileSync(filePath, 'utf-8'));
    const created = parsed.data.created;
    if (created instanceof Date) {
      return created.toISOString();
    }
    if (typeof created === 'string' && !Number.isNaN(new Date(created).getTime())) {
      return created;
    }
  } catch {
    // Ignore malformed files.
  }
  return undefined;
}

/**
 * Converts a filename into a human-readable label.
 * Example: `annual-report-2024.pdf` -> `"Annual Report 2024"`
 */
export function humanizeLabel(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, '');
  return stem
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ');
}
