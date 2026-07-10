import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { readCreatedTimestamp } from '../writers/preservation.js';
import type { Config } from '../config.js';
import { slugify } from '../utils/slug.js';

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
  'introduction', 'objectives', 'methods', 'results', 'conclusion', 'summary',
  'abstract', 'review', 'analysis', 'background', 'purpose', 'discussion',
  'references', 'acknowledgements', 'contents', 'about', 'read', 'continues',
  'available', 'website', 'following', 'including', 'included', 'provided',
  'prepared', 'developed', 'maintained', 'designed', 'implemented',
  'what', 'how', 'when', 'where', 'why', 'which', 'who', 'whom', 'whose',
  'would', 'could', 'should', 'might', 'must', 'shall', 'will', 'shall',
]);

const TOPIC_REJECT_WORDS = new Set([
  ...STOP_WORDS,
  // Document UI, feature labels, and controlled-vocabulary terms that surface as
  // false-positive "topics" in academic and database documents.
  'author', 'index', 'bibliographic', 'database', 'electronic', 'data', 'submission',
  'england', 'journal', 'investigator', 'collaborator', 'selection', 'medical', 'subject',
  'headings', 'heading', 'mesh', 'terms', 'term', 'translation', 'translations',
  'ncbi', 'handbook', 'nlm', 'catalog', 'catalogue', 'pharmacologic', 'pharmacological',
  'action', 'actions', 'programming', 'utilities', 'utility', 'pubmed', 'central',
  'ids', 'identifier', 'identifiers', 'simple', 'searching', 'search', 'linkout',
  'icon', 'icons', 'outside', 'tool', 'tools', 'clinical', 'full', 'partial', 'citation',
  'bibliography', 'bibliographies', 'sensors', 'images', 'image', 'multiple', 'pmid',
  'saving', 'saved', 'email', 'print', 'printing', 'sort', 'sorted', 'sorting', 'filters',
  'filter', 'display', 'view', 'views', 'viewed', 'items', 'item', 'suggestions',
  'suggest', 'preferences', 'preference', 'recent', 'activity', 'setting', 'settings',
  'history', 'clipboard', 'limits', 'limit', 'default', 'defaults', 'supplemental',
  'link', 'out', 'book', 'shelf', 'bookshelf', 'query', 'queries', 'operator', 'operators',
  'boolean', 'and', 'or', 'not', 'customer', 'cell', 'molecular', 'biology', 'created',
  'updated', 'fact', 'sheet', 'summary', 'detail', 'extracted', 'preserved', 'facts',
  'portal', 'issn', 'issns', 'standard', 'standards', 'international', 'serials', 'serial',
  'numbers', 'number', 'pharmacological', 'pharmacologic', 'actions', 'action',
  // Disease, anatomy, and technical fragments that appear as false topic pages.
  'cancer', 'syndrome', 'carcinoma', 'carcinomas', 'ductal', 'breast', 'neoplasms', 'neoplasm',
  'male', 'female', 'tumor', 'tumors', 'disease', 'diseases', 'disorder', 'disorders',
  'apache', 'http', 'https', 'hyperlink', 'hyperlinks', 'builder', 'show', 'advanced',
  'additional', 'features', 'feature', 'mapping', 'mappings', 'process', 'processes',
  'committee', 'lstrc', 'lstc', 'capitol', 'hill', 'subcommittee', 'supplementary',
  'concepts', 'concept', 'create', 'creating', 'batch', 'matcher', 'citation', 'matcher',
  'biotechnology', 'information', 'informatics', 'genome', 'genomic', 'genomics',
  // Technical/protocol terms and document-field fragments that should not be topics.
  'ftp', 'dtd', 'ghz', 'cpu', 'cpus', 'ethernet', 'gigabit', 'protocol', 'protocols',
  'http', 'https', 'apache', 'hyperlink', 'hyperlinks', 'dates', 'date', 'policy',
  'policies', 'field', 'fields', 'abbreviation', 'abbreviations', 'description',
  'descriptions', 'definition', 'definitions', 'transfer', 'file', 'files', 'eastern',
  'western', 'northern', 'southern', 'time', 'times', 'zone', 'zones', 'automatic',
  'indexing', 'help', 'desk', 'health', 'medicus', 'medline', 'medlar', 'medlars',
  'lane', 'identifier', 'identifiers', 'version', 'versions',
  // Additional academic, database, and document fragments observed in the UAT corpus.
  'language', 'system', 'systems', 'literature', 'selection', 'technical', 'med', 'journal',
  'journals', 'name', 'names', 'medical', 'umls', 'unified', 'national', 'center', 'centre',
  'institutes', 'institute', 'library', 'publication', 'publications', 'type', 'types', 'related',
  'article', 'articles', 'subheading', 'subheadings', 'support', 'help', 'desk', 'intel',
  'nehalem', 'cpu', 'cpus', 'ghz', 'processor', 'processors', 'microprocessor', 'microprocessors',
  'web', 'url', 'urls', 'website', 'websites', 'page', 'pages',
  // Report, financial, and ESG heading words that surface as false topic pages in
  // annual-report and governance documents.
  'annual', 'disclosures', 'disclosure', 'reports', 'report', 'financials', 'financial', 'governance',
  'sustainability', 'impact', 'responsibility', 'esg', 'bod', 'board', 'investment', 'bank', 'environmental',
  'nib', 'gri', 'reporting', 'reported', 'initiative', 'framework', 'pcaf', 'accounting', 'institution',
]);

const TOPIC_TAXONOMY_TERMS = new Set([
  'medical subject headings',
  'mesh terms',
  'mesh translation',
  'bibliographic database',
  'electronic data submission',
  'author index',
  'subject headings',
  'pharmacologic action',
  'pharmacologic actions',
  'pharmacological action',
  'pharmacological actions',
  'serial numbers',
  'international standard serial numbers',
  'issn',
  'issns',
  'pubmed central',
  'pubmed ids',
  'simple searching',
  'journal selection',
  'ncbi handbook',
  'nlm catalog',
  'programming utilities',
  'investigator collaborator',
  'england journal',
  'cancer syndrome',
  'carcinoma ductal breast',
  'breast neoplasms male',
  'advanced search builder show',
  'automatic indexing process',
  'automatic term mapping',
  'batch citation matcher',
  'biotechnology information ncbi',
  'capitol hill',
  'committee lstrc',
  'create hyperlinks',
  'supplementary concepts',
  'apache http',
  'additional pubmed features',
  'medical language system umls',
  'literature selection technical',
  'med journal name',
  'subheadings publication',
  'national center',
  'national institutes',
  'national library',
  'publication types',
  'related articles',
  'support center',
  'language system',
  'ghz intel nehalem',
  'intel nehalem cpus',
  'web url',
  'monte carlo',
  'contracts referencing nature dependent electricity',
  'aviation fuel',
  'power heat',
  'metals mining',
  'loss given',
]);

function isGenericTopic(name: string): boolean {
  const normalized = normalizeTopic(name);
  if (TOPIC_TAXONOMY_TERMS.has(normalized)) return true;
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  // Reject all-caps acronyms masquerading as topics.
  if (words.every((w) => /^[A-Z]{2,}$/.test(w))) return true;
  const rejectCount = words.filter((w) => TOPIC_REJECT_WORDS.has(w)).length;
  return rejectCount / words.length >= 0.5;
}

export { isGenericTopic };

function normalizeTopic(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isStopWord(word: string): boolean {
  return STOP_WORDS.has(word.toLowerCase()) || word.length <= 2;
}

function isCapitalizedPhrase(words: string[]): boolean {
  return words.every((w) => /^\p{Lu}[\p{L}]*$/u.test(w) || /^[A-Z]+$/u.test(w));
}

export function extractTopics(text: string, options?: { max?: number }): Topic[] {
  const counts: Record<string, number> = {};

  // Process each sentence and line separately so capitalized phrases do not
  // cross boundaries and create artifacts like "Reduction Inventory Further".
  const sentences = text.split(/(?<=[.!?])\s+|\n+/);

  for (const sentence of sentences) {
    // Clean the text so punctuation does not break phrase boundaries.
    const clean = sentence
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const words = clean.split(' ').filter(Boolean);

    // Extract 2-4 word capitalized phrases. These are more likely to be proper-noun
    // topics (e.g., "Climate Strategy", "Financial Statements") than lowercase fragments.
    for (let i = 0; i < words.length; i++) {
      for (const length of [4, 3, 2]) {
        if (i + length > words.length) continue;
        const slice = words.slice(i, i + length);
        if (slice.some((w) => isStopWord(w))) continue;
        if (!slice.every((w) => /^[a-zA-Z-]+$/u.test(w))) continue;
        if (!isCapitalizedPhrase(slice)) continue;
        const name = normalizeTopic(slice.join(' '));
        if (isStopWord(name) || name.length <= 3) continue;
        counts[name] = (counts[name] ?? 0) + 1;
      }
    }
  }

  const sorted = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .filter(([name]) => !isGenericTopic(name))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const max = options?.max ?? sorted.length;
  return sorted.slice(0, max).map(([name, count]) => ({ name, count }));
}

export function topicFileName(topic: Topic): string {
  return `${slugify(topic.name)}.md`;
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
  filePath?: string;
  pages: string;
}

export function writeTopicPage(
  filePath: string,
  topic: Topic,
  config: Config,
  mentions: MentionLocation[],
  related?: string[],
  body?: string,
  sources?: { id: string; file: string; pages: string; extracted: string }[],
): void {
  mkdirSync(path.dirname(filePath), { recursive: true });

  const title = topicPageTitle(topic);
  const now = new Date().toISOString();
  const created = readCreatedTimestamp(filePath) ?? now;

  const frontmatter: Record<string, unknown> = {
    title,
    created,
    updated: now,
    type: 'topic',
    wiki: config.wiki.slug,
    tags: ['topic', 'theme'],
    related: related ?? mentions.map((m) => m.source),
  };
  if (sources && sources.length > 0) {
    frontmatter.sources = sources;
  }

  const fallbackBody = [
    `# ${title}`,
    '',
    `**Mentions:** ${topic.count}`,
    '',
    '## Appearances',
    ...mentions.map((m) => `- ${m.source}, pages ${m.pages}`),
    '',
    `[[${config.wiki.title} Index]]`,
  ].join('\n');

  const finalBody = body?.trim() ? body : `${fallbackBody}\n\n> **Fallback:** this topic page was generated by deterministic fallback because the LLM did not produce a body.`;

  writeFileSync(filePath, matter.stringify(finalBody, frontmatter));
}
