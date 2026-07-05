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
  index: ['title', 'type', 'updated', 'wiki', 'sources'],
  document: ['title', 'type', 'tags', 'sources', 'confidence'],
  source: ['title', 'type', 'file', 'ingested', 'warnings'],
  topic: ['title', 'type', 'tags', 'related'],
  entity: ['title', 'type', 'tags', 'mentions'],
  raw: ['title', 'type', 'source', 'reason', 'raw_fragment'],
};

export function lintWiki(workspace: string, slug: string, config: Config): LintResult {
  const wikiDir = wikiPath(workspace, slug);
  const outputDir = path.join(wikiDir, config.output.dir);
  const issues: LintIssue[] = [];

  if (!existsSync(outputDir)) {
    return { issues, brokenLinks: 0, invalidCitations: 0, missingFrontmatter: 0 };
  }

  const titleMap = buildTitleMap(outputDir);
  const files = collectMarkdownFiles(outputDir);

  for (const file of files) {
    const relativeFile = path.relative(outputDir, file);
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

function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const st = statSync(fullPath);
    if (st.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
    } else if (entry.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

function buildTitleMap(outputDir: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const file of collectMarkdownFiles(outputDir)) {
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
  const wikilinks = content.match(/\[\[([^\]]+)\]\]/g) ?? [];

  for (const link of wikilinks) {
    const title = link.slice(2, -2);
    if (!titleMap.has(title)) {
      issues.push({
        type: 'broken-wikilink',
        file,
        message: `Broken wikilink "${title}" does not match any page title`,
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
