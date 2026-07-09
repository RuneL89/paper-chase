import { readdirSync, readFileSync, statSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { Config } from '../config.js';
import { wikiPath } from '../workspace.js';

export interface LintIssue {
  type: 'broken-wikilink' | 'invalid-citation' | 'missing-frontmatter';
  file: string;
  message: string;
}

export interface LintResult {
  issues: LintIssue[];
  brokenLinks: number;
  invalidCitations: number;
  missingFrontmatter: number;
}

const REQUIRED_FRONTMATTER: Record<string, string[]> = {
  index: ['title', 'type', 'updated', 'wiki', 'created', 'sources'],
  document: ['title', 'type', 'tags', 'sources', 'confidence', 'wiki', 'created'],
  source: ['title', 'type', 'file', 'logical_pages', 'physical_pages', 'sha256', 'ingested', 'warnings', 'wiki', 'created'],
  topic: ['title', 'type', 'tags', 'related', 'wiki', 'created'],
  entity: ['title', 'type', 'tags', 'mentions', 'wiki', 'created'],
  raw: ['title', 'type', 'source', 'reason', 'raw_fragment', 'wiki', 'created'],
};

export function lintWiki(workspace: string, slug: string, config: Config): LintResult {
  const wikiDir = wikiPath(workspace, slug);
  const contentFolders = ['documents', 'sources', 'topics', 'entities', 'raw'];
  const issues: LintIssue[] = [];

  const titleMap = buildTitleMap(wikiDir, contentFolders);
  const files = collectMarkdownFiles(wikiDir, contentFolders);

  for (const file of files) {
    const relativeFile = path.relative(wikiDir, file);
    const content = readFileSync(file, 'utf-8');
    const parsed = matter(content);

    issues.push(...checkFrontmatter(relativeFile, parsed.data));
    issues.push(...checkCitations(relativeFile, parsed.content, parsed.data));
    issues.push(...checkWikilinks(relativeFile, parsed.content, titleMap));
  }

  return summarize(issues);
}

export function writeLintReport(workspace: string, slug: string, config: Config, result: LintResult): string {
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
  const contentFolders = ['documents', 'sources', 'topics', 'entities', 'raw'];
  const titleMap = buildTitleMap(wikiDir, contentFolders);
  const titles = Array.from(titleMap.keys());

  for (const file of collectMarkdownFiles(wikiDir, contentFolders)) {
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

function checkCitations(file: string, content: string, data: Record<string, unknown>): LintIssue[] {
  const issues: LintIssue[] = [];
  const inlineCitations = content.match(/\[\^src\d+\]/g) ?? [];
  const sources = Array.isArray(data.sources) ? (data.sources as Record<string, unknown>[]) : [];
  const sourceIds = new Set(sources.map((s) => String(s.id ?? '')));

  for (const citation of inlineCitations) {
    const id = citation.match(/src\d+/)?.[0] ?? '';
    if (!sourceIds.has(id)) {
      issues.push({
        type: 'invalid-citation',
        file,
        message: `Inline citation ${citation} has no matching source entry`,
      });
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

function summarize(issues: LintIssue[]): LintResult {
  return {
    issues,
    brokenLinks: issues.filter((i) => i.type === 'broken-wikilink').length,
    invalidCitations: issues.filter((i) => i.type === 'invalid-citation').length,
    missingFrontmatter: issues.filter((i) => i.type === 'missing-frontmatter').length,
  };
}
