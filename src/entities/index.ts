import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { Config } from '../config.js';

export interface EntityMention {
  name: string;
  type: 'person' | 'organization' | 'product' | 'location';
  count: number;
}

const ORG_SUFFIXES = [
  'Inc', 'Incorporated', 'LLC', 'Ltd', 'Limited', 'Corp', 'Corporation',
  'Company', 'Co', 'PLC', 'GmbH', 'S.A.', 'SA', 'B.V.', 'BV',
  'Holdings', 'Group', 'Partners', 'Associates',
];

const PERSON_PREFIXES = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof'];

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'was', 'were',
  'been', 'have', 'has', 'had', 'will', 'would', 'could', 'should', 'page',
  'document', 'report', 'table', 'figure', 'note', 'section', 'appendix',
  'quarterly', 'annual', 'fiscal', 'financial', 'total', 'each', 'other',
  'these', 'those', 'such', 'than', 'also', 'more', 'some', 'about', 'into',
  'over', 'after', 'before', 'during', 'under', 'between', 'through', 'their',
]);

function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

function looksLikeOrganization(name: string): boolean {
  const upper = name.toUpperCase();
  return ORG_SUFFIXES.some((suffix) => {
    const s = suffix.toUpperCase();
    return upper.endsWith(' ' + s) || upper.endsWith(' ' + s + '.');
  });
}

function looksLikePerson(name: string): boolean {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return false;

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];

  // Strip prefixes.
  const first = PERSON_PREFIXES.includes(firstName.replace('.', '')) ? false : true;
  if (!first) return false;

  return (
    /^[A-Z][a-z]+$/.test(firstName) &&
    /^[A-Z][a-z]+$/.test(lastName)
  );
}

function looksLikeAcronym(name: string): boolean {
  return /^[A-Z]{2,6}$/.test(name);
}

function isStopWord(name: string): boolean {
  const lower = name.toLowerCase();
  if (STOP_WORDS.has(lower)) return true;
  if (lower.length <= 2) return true;
  return false;
}

export function extractEntities(text: string, options?: { max?: number }): EntityMention[] {
  const counts = new Map<string, { type: EntityMention['type']; count: number }>();

  function increment(name: string, type: EntityMention['type']): void {
    name = normalizeName(name);
    if (isStopWord(name)) return;
    const existing = counts.get(name);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(name, { type, count: 1 });
    }
  }

  // Organization pattern: capitalized words ending in an organizational suffix.
  const orgPattern = new RegExp(
    `(?:[A-Z][A-Za-z0-9&]*(?:\\s+|$)){1,4}(?:${ORG_SUFFIXES.map(escapeRegex).join('|')})\\b`,
    'g',
  );
  for (const match of text.match(orgPattern) ?? []) {
    increment(match, 'organization');
  }

  // Person pattern: First Last or First Middle Last.
  const personPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g;
  for (const match of text.match(personPattern) ?? []) {
    const name = normalizeName(match);
    if (isStopWord(name) || counts.has(name)) continue;
    if (looksLikePerson(name)) {
      increment(match, 'person');
    }
  }

  // Product / acronym pattern.
  const acronymPattern = /\b([A-Z]{2,6}(?:\s+\d+)?)\b/g;
  for (const match of text.match(acronymPattern) ?? []) {
    const name = normalizeName(match);
    if (isStopWord(name) || counts.has(name)) continue;
    increment(match, 'product');
  }

  // Location pattern: simple city/state pairings.
  const locationPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}),?\s+[A-Z]{2}\b/g;
  for (const match of text.match(locationPattern) ?? []) {
    const name = normalizeName(match.replace(/,\s+[A-Z]{2}$/, '').trim());
    if (isStopWord(name) || counts.has(name)) continue;
    increment(match, 'location');
  }

  const sorted = Array.from(counts.entries())
    .filter(([, value]) => value.count > 0)
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]));

  const max = options?.max ?? sorted.length;
  return sorted.slice(0, max).map(([name, value]) => ({
    name,
    type: value.type,
    count: value.count,
  }));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function entityFileName(entity: EntityMention): string {
  return entity.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') + '.md';
}

export function entityPageTitle(entity: EntityMention): string {
  return `Entity: ${entity.name}`;
}

export interface MentionLocation {
  source: string;
  pages: string;
}

export function writeEntityPage(
  filePath: string,
  entity: EntityMention,
  config: Config,
  mentions: MentionLocation[],
): void {
  mkdirSync(path.dirname(filePath), { recursive: true });

  const title = entityPageTitle(entity);
  const frontmatter = {
    title,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    type: 'entity',
    wiki: config.wiki.slug,
    tags: [entity.type, 'entity'],
    mentions: mentions.length,
  };

  const bodyLines = [
    `# ${title}`,
    '',
    `**Type:** ${entity.type}`,
    `**Mentions:** ${entity.count}`,
    '',
    '## Appearances',
    ...mentions.map((m) => `- ${m.source}, pages ${m.pages}`),
    '',
    `[[${config.wiki.title} Index]]`,
  ];

  writeFileSync(filePath, matter.stringify(bodyLines.join('\n'), frontmatter));
}
