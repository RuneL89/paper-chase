import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { wikiPath } from '../workspace.js';

export interface WikiNamePage {
  slug: string;
  wikiTitle: string;
  pageTitle: string;
  fileName: string;
}

export interface CrossWikiName {
  name: string;
  type: 'entity' | 'topic';
  wikis: WikiNamePage[];
}

export interface WikiOfWikiSummary {
  slug: string;
  title: string;
  description: string;
  sourceCount: number;
  documentCount: number;
  entityCount: number;
  topicCount: number;
  rawCount: number;
}

export interface WikiOfWikiResult {
  wikis: WikiOfWikiSummary[];
  crossWikiNames: CrossWikiName[];
}

function collectMarkdownFilesRecursive(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
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

export function runWikiOfWikiAgent(
  workspace: string,
  slugSummaries: WikiOfWikiSummary[],
): WikiOfWikiResult {
  const namesByType = new Map<string, Map<string, WikiNamePage[]>>();

  for (const wiki of slugSummaries) {
    const wikiDir = path.join(workspace, 'wikis', wiki.slug);

    for (const type of ['entity', 'topic'] as const) {
      const dir = path.join(wikiDir, type === 'entity' ? 'entities' : 'topics');
      if (!existsSync(dir)) continue;

      if (!namesByType.has(type)) {
        namesByType.set(type, new Map());
      }
      const typeMap = namesByType.get(type)!;

      for (const filePath of collectMarkdownFilesRecursive(dir)) {
        const parsed = matter(readFileSync(filePath, 'utf-8'));
        const title = String(parsed.data.title ?? '');
        if (!title) continue;

        const fileName = path.relative(dir, filePath).replace(/\\/g, '/');
        const lowerName = title.toLowerCase();
        if (!typeMap.has(lowerName)) {
          typeMap.set(lowerName, []);
        }
        typeMap.get(lowerName)!.push({
          slug: wiki.slug,
          wikiTitle: wiki.title,
          pageTitle: title,
          fileName,
        });
      }
    }
  }

  const crossWikiNames: CrossWikiName[] = [];
  for (const [type, typeMap] of namesByType) {
    for (const [lowerName, pages] of typeMap) {
      if (pages.length < 2) continue;
      // De-duplicate by wiki (keep first page per wiki in case of duplicates).
      const byWiki = new Map<string, WikiNamePage>();
      for (const page of pages) {
        if (!byWiki.has(page.slug)) {
          byWiki.set(page.slug, page);
        }
      }
      const uniquePages = Array.from(byWiki.values());
      if (uniquePages.length < 2) continue;
      crossWikiNames.push({
        name: uniquePages[0].pageTitle,
        type: type as 'entity' | 'topic',
        wikis: uniquePages,
      });
    }
  }

  // Stable sort by name.
  crossWikiNames.sort((a, b) => a.name.localeCompare(b.name));

  return {
    wikis: slugSummaries,
    crossWikiNames,
  };
}
