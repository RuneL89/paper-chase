import { readdirSync, readFileSync, statSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { Config } from '../config.js';
import { wikiPath } from '../workspace.js';
import { loadState, statePath, findSourceForPage, hashFile, fileChanged } from '../ingestion/state.js';
import { findPotentialDuplicates } from '../utils/similarity.js';

export interface LintIssue {
  type: 'broken-wikilink' | 'invalid-citation' | 'missing-frontmatter' | 'orphaned-page' | 'stale-page' | 'duplicate-entity' | 'missing-source-file';
  file: string;
  message: string;
}

export interface LintReport {
  timestamp: string;
  total_pages: number;
  pages_by_type: Record<string, number>;
  errors: number;
  warnings: number;
  broken_links: number;
  orphaned_pages: number;
  citation_issues: number;
  duplicate_entities_flagged: number;
  stale_pages: number;
  missing_source_files: number;
  issues: LintIssue[];
}

// Backward-compatible alias used by earlier sprint tests.
export type LintResult = LintReport;

const REQUIRED_FRONTMATTER: Record<string, string[]> = {
  index: ['title', 'type', 'updated', 'wiki', 'created', 'sources'],
  document: ['title', 'type', 'tags', 'sources', 'confidence', 'wiki', 'created'],
  source: ['title', 'type', 'file', 'logical_pages', 'physical_pages', 'sha256', 'ingested', 'warnings', 'wiki', 'created'],
  topic: ['title', 'type', 'tags', 'related', 'wiki', 'created'],
  entity: ['title', 'type', 'tags', 'mentions', 'wiki', 'created'],
  raw: ['title', 'type', 'source', 'reason', 'raw_fragment', 'wiki', 'created'],
};

const CONTENT_FOLDERS = ['documents', 'sources', 'topics', 'entities', 'raw'];

export function lintWiki(workspace: string, slug: string, config: Config): LintReport {
  const wikiDir = wikiPath(workspace, slug);
  const stateFile = statePath(wikiDir, config.output.dir);
  const state = existsSync(stateFile) ? loadState(stateFile) : undefined;

  const issues: LintIssue[] = [];
  const titleMap = buildTitleMap(wikiDir, CONTENT_FOLDERS);
  const files = collectMarkdownFiles(wikiDir, CONTENT_FOLDERS);
  const pagesByType: Record<string, number> = {};

  for (const file of files) {
    const relativeFile = path.relative(wikiDir, file).replace(/\\/g, '/');
    const content = readFileSync(file, 'utf-8');
    const parsed = matter(content);
    const pageType = String(parsed.data.type ?? 'unknown');
    pagesByType[pageType] = (pagesByType[pageType] ?? 0) + 1;

    issues.push(...checkFrontmatter(relativeFile, parsed.data));
    issues.push(...checkCitations(relativeFile, parsed.content, parsed.data, wikiDir));
    issues.push(...checkWikilinks(relativeFile, parsed.content, titleMap));
  }

  issues.push(...checkOrphanedPages(wikiDir, CONTENT_FOLDERS, titleMap));
  issues.push(...checkStalePages(wikiDir, config.output.dir, CONTENT_FOLDERS, state));
  issues.push(...checkDuplicateEntities(wikiDir, CONTENT_FOLDERS));

  return summarizeReport(issues, files.length, pagesByType);
}

export function writeLintReport(workspace: string, slug: string, config: Config, result: LintReport): string {
  const wikiDir = wikiPath(workspace, slug);
  const lintDir = path.join(wikiDir, config.output.dir, 'lint');
  mkdirSync(lintDir, { recursive: true });
  const reportPath = path.join(lintDir, 'report.json');
  writeFileSync(reportPath, JSON.stringify(result, null, 2) + '\n');

  // Backward-compatible unresolved-link report for Sprint 3 tests.
  const wikilinksPath = path.join(lintDir, 'wikilinks.json');
  writeFileSync(
    wikilinksPath,
    JSON.stringify({ issues: result.issues.filter((i) => i.type === 'broken-wikilink') }, null, 2) + '\n',
  );
  return reportPath;
}

/**
 * Repair wikilinks in a wiki after all pages have been written. Any link whose
 * target does not match an existing page title is either:
 *   - rewritten to the longest matching title if the target is a prefix/suffix
 *     fragment of an existing title (e.g. [[Topic: Data Submission]] ->
 *     [[Topic: Electronic Data Submission]]); or
 *   - converted to plain text if no matching title can be found.
 *
 * This guarantees that the deterministic lint pass sees no broken wikilinks,
 * even when the LLM invents a slightly shorter name than the actual page title.
 */
export function repairWikilinks(workspace: string, slug: string, config: Config): void {
  const wikiDir = wikiPath(workspace, slug);
  const titleMap = buildTitleMap(wikiDir, CONTENT_FOLDERS);
  const titles = Array.from(titleMap.keys());

  for (const file of collectMarkdownFiles(wikiDir, CONTENT_FOLDERS)) {
    const content = readFileSync(file, 'utf-8');
    const parsed = matter(content);
    const repaired = repairContentWikilinks(parsed.content, titles);
    if (repaired !== parsed.content) {
      writeFileSync(file, matter.stringify(repaired, parsed.data));
    }
  }
}

function repairContentWikilinks(content: string, titles: string[]): string {
  const titleSet = new Set(titles.map((t) => t.toLowerCase()));
  const titleWords = titles.map((t) => t.toLowerCase().split(/[\s\-]+/).filter(Boolean));

  return content.replace(/\[\[[^\]|]+(?:\|[^\]]+)?\]\]/g, (match) => {
    const inner = match.slice(2, -2);
    const [targetPart, displayPart] = inner.split('|', 2);
    const target = targetPart.trim();
    const display = displayPart !== undefined ? displayPart.trim() : target;

    if (titleSet.has(target.toLowerCase())) {
      // Enforce the no-pipe rule: exact-title links only.
      return `[[${target}]]`;
    }

    const targetWords = target.toLowerCase().split(/[\s\-]+/).filter(Boolean);
    if (targetWords.length >= 2) {
      let bestMatch: string | undefined;
      for (let i = 0; i < titles.length; i++) {
        const words = titleWords[i];
        if (targetWords.length >= words.length) continue;
        const prefix = targetWords.every((w, idx) => w === words[idx]);
        const suffix = targetWords.every(
          (w, idx) => w === words[words.length - targetWords.length + idx],
        );
        if (prefix || suffix) {
          if (!bestMatch || titles[i].length > bestMatch.length) {
            bestMatch = titles[i];
          }
        }
      }
      if (bestMatch) {
        return `[[${bestMatch}]]`;
      }
    }

    // Unknown target and no fragment match: strip the brackets to plain text.
    return display;
  });
}

function collectMarkdownFiles(wikiDir: string, contentFolders: string[]): string[] {
  const files: string[] = [];
  for (const folder of contentFolders) {
    const fullDir = path.join(wikiDir, folder);
    if (!existsSync(fullDir)) continue;
    for (const entry of readdirSync(fullDir)) {
      const fullPath = path.join(fullDir, entry);
      const st = statSync(fullPath);
      if (st.isDirectory()) {
        files.push(...collectMarkdownFilesRecursive(fullPath));
      } else if (entry.endsWith('.md') && entry !== 'index.md') {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function collectMarkdownFilesRecursive(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const st = statSync(fullPath);
    if (st.isDirectory()) {
      files.push(...collectMarkdownFilesRecursive(fullPath));
    } else if (entry.endsWith('.md') && entry !== 'index.md') {
      files.push(fullPath);
    }
  }
  return files;
}

function buildTitleMap(wikiDir: string, contentFolders: string[]): Map<string, string> {
  const map = new Map<string, string>();
  // Include the wiki-level index so links to it (e.g., [[Wiki Title Index]]) resolve.
  const wikiIndexPath = path.join(wikiDir, 'index.md');
  if (existsSync(wikiIndexPath)) {
    try {
      const parsed = matter(readFileSync(wikiIndexPath, 'utf-8'));
      if (parsed.data.title) {
        map.set(String(parsed.data.title), wikiIndexPath);
      }
    } catch {
      // Ignore malformed wiki-level index.
    }
  }
  for (const file of collectMarkdownFiles(wikiDir, contentFolders)) {
    try {
      const parsed = matter(readFileSync(file, 'utf-8'));
      if (parsed.data.title) {
        map.set(String(parsed.data.title), file);
      }
    } catch {
      // Ignore malformed files.
    }
  }
  return map;
}

function checkFrontmatter(file: string, data: Record<string, unknown>): LintIssue[] {
  const issues: LintIssue[] = [];
  const type = String(data.type ?? '');
  const required = REQUIRED_FRONTMATTER[type] ?? [];

  for (const field of required) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      issues.push({
        type: 'missing-frontmatter',
        file,
        message: `Missing required frontmatter field "${field}" for type "${type}"`,
      });
    }
  }

  return issues;
}

function checkCitations(file: string, content: string, data: Record<string, unknown>, wikiDir: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const inlineCitations = content.match(/\[\^src\d+\]/g) ?? [];
  const sources = Array.isArray(data.sources) ? (data.sources as Record<string, unknown>[]) : [];
  const sourceIds = new Set<string>();
  const sourceById = new Map<string, Record<string, unknown>>();

  for (const source of sources) {
    const id = String(source.id ?? '');
    if (id) {
      sourceIds.add(id);
      sourceById.set(id, source);
    }
  }

  for (const citation of inlineCitations) {
    const id = citation.match(/src\d+/)?.[0] ?? '';
    if (!sourceIds.has(id)) {
      issues.push({
        type: 'invalid-citation',
        file,
        message: `Inline citation ${citation} has no matching source entry`,
      });
      continue;
    }
    const source = sourceById.get(id);
    const sourceFile = typeof source?.file === 'string' ? source.file : '';
    if (sourceFile) {
      const absolutePath = path.resolve(wikiDir, sourceFile);
      if (!existsSync(absolutePath)) {
        issues.push({
          type: 'missing-source-file',
          file,
          message: `Source file for citation ${citation} does not exist: ${sourceFile}`,
        });
      }
    }
  }

  return issues;
}

function checkWikilinks(file: string, content: string, titleMap: Map<string, string>): LintIssue[] {
  const issues: LintIssue[] = [];
  const wikilinks = content.match(/\[\[[^\]]+\]\]/g) ?? [];

  for (const link of wikilinks) {
    const inner = link.slice(2, -2);
    const target = inner.split('|', 2)[0].trim();
    if (!titleMap.has(target)) {
      issues.push({
        type: 'broken-wikilink',
        file,
        message: `Broken wikilink "${target}" does not match any page title`,
      });
    }
  }

  return issues;
}

function checkOrphanedPages(wikiDir: string, contentFolders: string[], titleMap: Map<string, string>): LintIssue[] {
  const issues: LintIssue[] = [];
  const allLinks = new Set<string>();

  for (const file of collectMarkdownFiles(wikiDir, contentFolders)) {
    const content = readFileSync(file, 'utf-8');
    const parsed = matter(content);
    const wikilinks = parsed.content.match(/\[\[[^\]]+\]\]/g) ?? [];
    for (const link of wikilinks) {
      const target = link.slice(2, -2).split('|', 2)[0].trim();
      allLinks.add(target.toLowerCase());
    }
  }

  for (const [title, file] of titleMap) {
    const parsed = matter(readFileSync(file, 'utf-8'));
    const type = String(parsed.data.type ?? '');
    // Index and source pages are allowed to be entry points without incoming links.
    if (type === 'index' || type === 'source') continue;
    if (!allLinks.has(title.toLowerCase())) {
      const relativeFile = path.relative(wikiDir, file).replace(/\\/g, '/');
      issues.push({
        type: 'orphaned-page',
        file: relativeFile,
        message: `Page "${title}" has no incoming wikilinks`,
      });
    }
  }

  return issues;
}

function checkStalePages(
  wikiDir: string,
  outputDirName: string,
  contentFolders: string[],
  state?: { sources?: Record<string, { sha256: string }> },
): LintIssue[] {
  const issues: LintIssue[] = [];
  if (!state || !state.sources) return issues;

  const outputDir = path.join(wikiDir, outputDirName);

  for (const file of collectMarkdownFiles(wikiDir, contentFolders)) {
    const relativeFile = path.relative(wikiDir, file).replace(/\\/g, '/');
    const sourceInfo = findSourceForPage(state as any, relativeFile);
    if (!sourceInfo) continue;

    const sourcePath = sourceInfo.sourcePath;
    const rawFilePath = path.resolve(wikiDir, sourcePath);
    if (!existsSync(rawFilePath)) {
      issues.push({
        type: 'stale-page',
        file: relativeFile,
        message: `Page source PDF no longer exists: ${sourcePath}`,
      });
      continue;
    }

    const currentHash = hashFile(rawFilePath);
    if (fileChanged(state as any, sourcePath, currentHash, 0)) {
      issues.push({
        type: 'stale-page',
        file: relativeFile,
        message: `Page may be stale because source PDF has changed: ${sourcePath}`,
      });
    }
  }

  return issues;
}

function checkDuplicateEntities(wikiDir: string, contentFolders: string[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const entitySlugs: string[] = [];
  const entityFileBySlug = new Map<string, string>();

  const entitiesDir = path.join(wikiDir, 'entities');
  if (!existsSync(entitiesDir)) return issues;

  for (const file of collectMarkdownFilesRecursive(entitiesDir)) {
    const parsed = matter(readFileSync(file, 'utf-8'));
    const slug = path.basename(file, '.md');
    const title = String(parsed.data.title ?? slug);
    entitySlugs.push(slug);
    entityFileBySlug.set(slug, title);
  }

  const duplicates = findPotentialDuplicates(entitySlugs);
  for (const dup of duplicates) {
    const titleA = entityFileBySlug.get(dup.a) ?? dup.a;
    const titleB = entityFileBySlug.get(dup.b) ?? dup.b;
    issues.push({
      type: 'duplicate-entity',
      file: 'entities',
      message: `Potential duplicate entities: "${titleA}" and "${titleB}" (${dup.reason})`,
    });
  }

  return issues;
}

function summarizeReport(issues: LintIssue[], totalPages: number, pagesByType: Record<string, number>): LintReport {
  const brokenLinks = issues.filter((i) => i.type === 'broken-wikilink').length;
  const invalidCitations = issues.filter((i) => i.type === 'invalid-citation').length;
  const missingSourceFiles = issues.filter((i) => i.type === 'missing-source-file').length;
  const citationIssues = invalidCitations + missingSourceFiles;
  const orphaned = issues.filter((i) => i.type === 'orphaned-page').length;
  const stale = issues.filter((i) => i.type === 'stale-page').length;
  const duplicates = issues.filter((i) => i.type === 'duplicate-entity').length;
  const missingFrontmatter = issues.filter((i) => i.type === 'missing-frontmatter').length;

  // Errors are blocking schema/citation issues; warnings are quality/structural issues.
  const errors = missingFrontmatter + invalidCitations + missingSourceFiles;
  const warnings = issues.length - errors;

  return {
    timestamp: new Date().toISOString(),
    total_pages: totalPages,
    pages_by_type: pagesByType,
    errors,
    warnings,
    broken_links: brokenLinks,
    orphaned_pages: orphaned,
    citation_issues: citationIssues,
    duplicate_entities_flagged: duplicates,
    stale_pages: stale,
    missing_source_files: missingSourceFiles,
    issues,
  };
}

export { buildTitleMap, collectMarkdownFiles };
