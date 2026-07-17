import { join } from 'node:path';

/**
 * Absolute/relative filesystem path of a wiki inside a workspace.
 * `workspace` defaults to the current directory ('.').
 */
export function wikiDir(workspace: string | undefined, slug: string): string {
  return join(workspace ?? '.', 'wikis', slug);
}

/**
 * Workspace-relative path of a source PDF, always with forward slashes so
 * generated pages are byte-identical on every platform
 * (e.g. 'wikis/acme/raw/report.pdf').
 */
export function sourcePdfPath(slug: string, fileName: string): string {
  return `wikis/${slug}/raw/${fileName}`;
}

/**
 * Wiki-relative path of a generated page (documents/ or sources/), always
 * with forward slashes (e.g. 'documents/report-part-001.md').
 */
export function wikiRelativePath(folder: string, fileName: string): string {
  return `${folder}/${fileName}`;
}
