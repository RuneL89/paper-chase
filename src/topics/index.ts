import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { Config } from '../config.js';

export interface Topic {
  name: string;
  count: number;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'was', 'were',
  'been', 'have', 'has', 'had', 'will', 'would', 'could', 'should', 'page',
  'document', 'report', 'table', 'figure', 'note', 'section', 'appendix',
  'see', 'also', 'below', 'above', 'each', 'other', 'these', 'those', 'such',
  'than', 'also', 'more', 'some', 'about', 'into', 'over', 'after', 'before',
  'during', 'under', 'between', 'through', 'their', 'there', 'they', 'them',
  'said', 'says', 'say', 'one', 'two', 'may', 'can', 'not', 'all', 'any',
  'but', 'new', 'its', 'per', 'by', 'as', 'at', 'an', 'be', 'to', 'of', 'in',
  'is', 'it', 'on', 'or', 'if', 'no', 'so', 'up', 'we', 'us', 'do', 'did',
  'plans', 'reported', 'involved', 'helped', 'led', 'acquired', 'smaller',
]);

function normalizeTopic(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isStopWord(word: string): boolean {
  return STOP_WORDS.has(word.toLowerCase()) || word.length <= 2;
}

export function extractTopics(text: string, options?: { max?: number }): Topic[] {
  const counts: Record<string, number> = {};

  // Clean the text so punctuation does not break phrase boundaries.
  const clean = text
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = clean.split(' ').filter(Boolean);

  // Extract 2-3 word noun phrases. A simple heuristic: any sequence of
  // lowercase alphabetic words (or a single leading capitalized word) that
  // does not contain a stop word.
  for (let i = 0; i < words.length; i++) {
    for (const length of [3, 2]) {
      if (i + length > words.length) continue;
      const slice = words.slice(i, i + length);
      if (slice.some((w) => isStopWord(w))) continue;
      if (!slice.every((w) => /^[a-zA-Z]+$/.test(w))) continue;
      const name = normalizeTopic(slice.join(' '));
      counts[name] = (counts[name] ?? 0) + 1;
    }
  }

  const sorted = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const max = options?.max ?? sorted.length;
  return sorted.slice(0, max).map(([name, count]) => ({ name, count }));
}

export function topicFileName(topic: Topic): string {
  return topic.name.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.md';
}

export function topicPageTitle(topic: Topic): string {
  const display = topic.name
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return `Topic: ${display}`;
}

export interface MentionLocation {
  source: string;
  pages: string;
}

export function writeTopicPage(
  filePath: string,
  topic: Topic,
  config: Config,
  mentions: MentionLocation[],
): void {
  mkdirSync(path.dirname(filePath), { recursive: true });

  const title = topicPageTitle(topic);
  const frontmatter = {
    title,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    type: 'topic',
    wiki: config.wiki.slug,
    tags: ['topic', 'theme'],
    related: mentions.map((m) => m.source),
  };

  const bodyLines = [
    `# ${title}`,
    '',
    `**Mentions:** ${topic.count}`,
    '',
    '## Appearances',
    ...mentions.map((m) => `- ${m.source}, pages ${m.pages}`),
    '',
    `[[${config.wiki.title} Index]]`,
  ];

  writeFileSync(filePath, matter.stringify(bodyLines.join('\n'), frontmatter));
}
