import { writeFileSync, mkdirSync, existsSync, readFileSync, renameSync, rmSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { CLIError } from '../errors.js';
import { readCreatedTimestamp } from '../writers/preservation.js';
import type { Config } from '../config.js';
import { SlugRegistry, slugify } from '../utils/slug.js';
import type { EntityTaxonomy } from '../orchestrator/types.js';

export interface EntityMention {
  name: string;
  type: 'person' | 'organization' | 'product' | 'location' | 'case' | 'event';
  count: number;
  description?: string;
  relationships?: { predicate: string; object: string; evidence: string; pages: string }[];
}

const ORG_SUFFIXES = [
  'Inc', 'Incorporated', 'LLC', 'Ltd', 'Limited', 'Corp', 'Corporation',
  'Company', 'Co', 'PLC', 'GmbH', 'S.A.', 'SA', 'B.V.', 'BV',
  'Holdings', 'Group', 'Partners', 'Associates', 'LLP', 'LP',
  'Center', 'Centre', 'Institute', 'Institution', 'Committee', 'Bank',
  'Department', 'Foundation', 'Association', 'Council', 'Agency', 'Board',
  'Commission', 'Office', 'Bureau', 'Administration', 'Authority',
  'Organization', 'Organisation', 'Union', 'Alliance', 'Consortium',
  'Society', 'Federation', 'Chamber', 'Exchange', 'Market',
  'Investment', 'Investments', 'Capital', 'Ventures', 'Trust', 'Fund',
  'Management', 'Services', 'Solutions', 'Technologies', 'Systems',
  'Enterprises', 'Industries', 'International', 'National', 'Global',
  'Nordic', 'Baltic', 'European', 'American', 'Asian', 'Pacific',
];

const PRODUCT_KEYWORDS = [
  'Inventory', 'Product', 'Device', 'System', 'Platform', 'Tool',
  'Database', 'Software', 'Application', 'Framework', 'Model', 'API',
  'Bond', 'Loan', 'Lease', 'Facility', 'Program', 'Project', 'Initiative',
  'Standard', 'Metric', 'Instrument',
];

const HEADING_WORDS = new Set([
  'report', 'reports', 'reporting', 'annual', 'annualreport',
  'disclosure', 'disclosures', 'other', 'financial', 'financials',
  'governance', 'sustainability', 'impact', 'responsibility', 'esg',
  'statement', 'statements', 'position', 'balance', 'income', 'cashflow',
  'flow', 'notes', 'note', 'outstanding', 'guarantee', 'commitment', 'commitments',
  'fair', 'value', 'maturity', 'analysis', 'currency', 'derivative', 'derivatives',
  'hedge', 'accounting', 'risk', 'exposure', 'industry', 'counterparty',
  'concentration', 'credit', 'market', 'liquidity', 'operational', 'banking',
  'board', 'directors', 'bod', 'members', 'alternates', 'management', 'executive',
  'committee', 'committees', 'audit', 'remuneration', 'nomination',
  'part', 'parts', 'page', 'pages', 'section', 'sections', 'chapter', 'chapters',
  'appendix', 'appendices', 'contents', 'table', 'tables', 'figure', 'figures',
  'summary', 'overview', 'review', 'highlights', 'key', 'points', 'agenda',
  'abstract', 'example', 'examples', 'introduction', 'objectives', 'methods',
  'results', 'conclusion', 'discussion', 'background', 'purpose', 'educational',
  'presentation', 'quality', 'value', 'values', 'rubric', 'evaluation', 'assessment',
  'score', 'scores', 'points', 'criteria', 'index', 'author', 'authorindex',
  'subject', 'subjects', 'headings', 'subheadings', 'concepts', 'utilities',
  'data', 'submission', 'process', 'selection', 'searching', 'simple', 'translation',
  'additional', 'features', 'feature', 'advanced', 'complex', 'effective', 'following', 'available',
  'resources', 'facilitate', 'tools', 'search', 'queries', 'details', 'discovery', 'links', 'results',
  'mobile', 'support', 'center', 'centre', 'help', 'desk', 'contact', 'online', 'how', 'create', 'creating', 'web',
  'using', 'use', 'uses', 'used', 'useful', 'homepage', 'filters', 'filter', 'narrow', 'save', 'saved', 'saving',
  'email', 'e-mail', 'print', 'printing', 'sort', 'sorted', 'sorting', 'format', 'formats', 'display', 'view', 'views',
  'viewed', 'item', 'items', 'citation', 'citations', 'matcher', 'batch', 'multiple', 'ids', 'pmid', 'sensors', 'images',
  'supplemental', 'default', 'turning', 'auto', 'suggest', 'suggestions', 'managing', 'recent', 'activity', 'setting',
  'preferences', 'preference', 'outside', 'document', 'delivery', 'services', 'icon', 'linkout', 'history', 'clipboard',
  'limits', 'limit', 'bibliographies', 'bibliography', 'highlighting', 'highlight', 'opening', 'abstract',
  'report', 'disclosures', 'disclosure', 'financials', 'financial', 'sustainability',
  'governance', 'impact', 'bod', 'board', 'notes', 'note', 'part', 'parts',
  // PubMed / academic document heading and caption words that produce false-positive entities.
  'bibliographic', 'database', 'cell', 'molecular', 'biology', 'created', 'updated', 'fact', 'sheet',
  'summary', 'detail', 'extracted', 'preserved', 'customer', 'medical', 'journal', 'england', 'catalog',
  'handbook', 'boolean', 'automatic', 'indexing', 'process',
]);

function isHeadingLikePhrase(name: string): boolean {
  const lower = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  // All-caps phrases are typically headings in annual reports.
  if (/^[A-Z\s\-]+$/.test(name.trim()) && name.length > 5) return true;
  // Phrases composed mostly of heading words are not entities.
  const headingCount = words.filter((w) => HEADING_WORDS.has(w)).length;
  return headingCount / words.length >= 0.5;
}

const PERSON_PREFIXES = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof'];

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'was', 'were',
  'been', 'have', 'has', 'had', 'will', 'would', 'could', 'should', 'page',
  'document', 'report', 'table', 'figure', 'note', 'section', 'appendix',
  'quarterly', 'annual', 'fiscal', 'financial', 'total', 'each', 'other',
  'these', 'those', 'such', 'than', 'also', 'more', 'some', 'about', 'into',
  'over', 'after', 'before', 'during', 'under', 'between', 'through', 'their',
  'introduction', 'objectives', 'methods', 'results', 'conclusion', 'summary',
  'abstract', 'review', 'analysis', 'background', 'purpose', 'discussion',
  'references', 'acknowledgements', 'appendix', 'contents', 'about', 'read',
  'continues', 'available', 'website', 'following', 'including', 'included',
  'provided', 'prepared', 'developed', 'maintained', 'designed', 'implemented',
]);

export function looksLikeOrganization(name: string): boolean {
  const upper = name.toUpperCase();
  return ORG_SUFFIXES.some((suffix) => {
    const s = suffix.toUpperCase();
    return upper.endsWith(' ' + s) || upper.endsWith(' ' + s + '.') || upper.includes(' ' + s + ' ') || upper.includes(' ' + s + ' ');
  });
}

export function containsOrgKeyword(name: string): boolean {
  const upper = name.toUpperCase();
  const orgKeywords = [
    ' CENTER ', ' CENTRE ', ' INSTITUTE ', ' INSTITUTES ', ' INSTITUTION ', ' COMMITTEE ', ' BANK ',
    ' DEPARTMENT ', ' FOUNDATION ', ' ASSOCIATION ', ' COUNCIL ', ' AGENCY ', ' BOARD ',
    ' COMMISSION ', ' OFFICE ', ' BUREAU ', ' ADMINISTRATION ', ' AUTHORITY ',
    ' ORGANIZATION ', ' ORGANISATION ', ' UNION ', ' ALLIANCE ', ' CONSORTIUM ',
    ' SOCIETY ', ' FEDERATION ', ' CHAMBER ', ' EXCHANGE ', ' CORPORATION ', ' INCORPORATED ',
    ' LIBRARY ', ' MEDICINE ', ' INFORMATION ', ' DATABASE ',
  ];
  return orgKeywords.some((kw) => upper.includes(kw));
}

export function containsProductKeyword(name: string): boolean {
  const upper = ' ' + name.toUpperCase() + ' ';
  return PRODUCT_KEYWORDS.some((kw) => upper.includes(' ' + kw.toUpperCase() + ' '));
}

const NON_PERSON_WORDS = new Set([
  'support', 'center', 'centre', 'help', 'desk', 'link', 'contact', 'queries', 'matcher',
  'citation', 'batch', 'clinical', 'full', 'partial', 'investigator', 'collaborator',
  'programming', 'utilities', 'utility', 'data', 'submission', 'selection', 'searching',
  'simple', 'translation', 'england', 'journal', 'medical', 'subject', 'headings', 'bibliographic',
  'database', 'mesh', 'terms', 'pharmacologic', 'action', 'breast', 'neoplasms', 'author', 'index',
  'catalog', 'handbook', 'document', 'type', 'definition', 'file', 'files', 'electronic', 'online',
  'available', 'documentation', 'systems', 'services', 'page', 'figure', 'table', 'note', 'notes',
  'summary', 'overview', 'background', 'purpose', 'methods', 'results', 'conclusion', 'discussion',
  'introduction', 'review', 'analysis', 'assessment', 'evaluation', 'value', 'values', 'quality',
  'presentation', 'educational', 'example', 'examples', 'abstract', 'contents', 'references',
  'acknowledgements', 'appendix', 'report', 'reports', 'reporting', 'annual', 'fiscal', 'financial',
  'financials', 'statement', 'statements', 'disclosure', 'disclosures', 'governance', 'sustainability',
  'impact', 'responsibility', 'esg', 'risk', 'risks', 'exposure', 'market', 'markets', 'industry',
  'industries', 'sector', 'sectors', 'country', 'countries', 'region', 'regions', 'company', 'companies',
  'corporation', 'incorporated', 'limited', 'group', 'groups', 'association', 'committee', 'council',
  'board', 'department', 'division', 'office', 'bureau', 'agency', 'commission', 'authority',
  'administration', 'organization', 'organisation', 'institution', 'institute', 'society', 'union',
  'alliance', 'consortium', 'federation', 'chamber', 'exchange', 'fund', 'funds', 'trust', 'bank',
  'banking', 'investment', 'investments', 'capital', 'asset', 'assets', 'liability', 'liabilities',
  'loan', 'loans', 'lease', 'bond', 'bonds', 'portfolio', 'treasury', 'management', 'manager',
  'executive', 'officer', 'director', 'chairman', 'chair', 'chief', 'president', 'vice', 'head',
  'leader', 'supervisor', 'staff', 'employee', 'employees', 'worker', 'workers', 'member', 'members',
  'participant', 'participants', 'user', 'users', 'client', 'clients', 'customer', 'customers',
  'patient', 'patients', 'subject', 'subjects', 'student', 'students', 'teacher', 'teachers',
  'professor', 'instructor', 'researcher', 'researchers', 'scientist', 'scientists', 'clinician',
  'physician', 'doctor', 'nurse', 'therapist', 'analyst', 'analysts', 'specialist', 'specialists',
  'expert', 'experts', 'professional', 'professionals', 'representative', 'representatives', 'agent',
  'agents', 'associate', 'associates', 'partner', 'partners', 'owner', 'owners', 'founder', 'founders',
  'sponsor', 'sponsors', 'funder', 'funders', 'donor', 'donors', 'stakeholder', 'stakeholders',
  'shareholder', 'shareholders', 'investor', 'investors', 'publisher', 'publishers', 'editor',
  'editors', 'writer', 'writers', 'reviewer', 'reviewers', 'consultant', 'consultants', 'advisor',
  'advisors', 'auditor', 'auditors', 'operator', 'operators', 'technician', 'technicians', 'engineer',
  'engineers', 'developer', 'developers', 'programmer', 'programmers', 'designer', 'designers',
  'additional', 'features', 'feature', 'simple', 'advanced', 'complex', 'effective', 'following', 'available',
  'resources', 'facilitate', 'tools', 'search', 'searching', 'queries', 'details', 'discovery', 'links', 'results',
  'mobile', 'support', 'center', 'centre', 'help', 'desk', 'contact', 'online', 'how', 'create', 'creating', 'web',
  'using', 'use', 'uses', 'used', 'useful', 'homepage', 'filters', 'filter', 'narrow', 'save', 'saved', 'saving',
  'email', 'e-mail', 'print', 'printing', 'sort', 'sorted', 'sorting', 'format', 'formats', 'display', 'view', 'views',
  'viewed', 'item', 'items', 'citation', 'citations', 'matcher', 'batch', 'multiple', 'ids', 'pmid', 'sensors', 'images',
  'supplemental', 'default', 'turning', 'auto', 'suggest', 'suggestions', 'managing', 'recent', 'activity', 'setting',
  'preferences', 'preference', 'outside', 'document', 'delivery', 'services', 'icon', 'linkout', 'history', 'clipboard',
  'limits', 'limit', 'bibliographies', 'bibliography', 'highlighting', 'highlight', 'opening', 'abstract', 'engl', 'med',
  // Domain jargon and common nouns that produce false-positive person names in PubMed-style documents.
  'the', 'and', 'or', 'not', 'boolean', 'cell', 'automatic', 'indexing', 'process', 'customer',
  'medical', 'data', 'submission', 'programming', 'utilities', 'simple', 'searching', 'translation',
  'pharmacologic', 'action', 'breast', 'neoplasms', 'author', 'index', 'catalog', 'handbook',
  'electronic', 'journal', 'england', 'mesh', 'terms', 'ids', 'pubmed', 'central', 'service',
  'delivery', 'filters', 'results', 'links', 'citation', 'bibliography', 'abstract', 'query',
  'queries', 'operator', 'operators', 'clinical', 'full', 'partial', 'investigator', 'collaborator',
  'book', 'shelf', 'bookshelf', 'history', 'clipboard', 'limits', 'display', 'format', 'item',
  'items', 'outside', 'preference', 'recent', 'activity', 'setting', 'suggestions', 'suggest', 'auto',
  'turning', 'default', 'supplemental', 'sensors', 'images', 'multiple', 'pmid', 'save', 'saved',
  'narrow', 'create', 'creating', 'web', 'how', 'online', 'homepage', 'useful', 'use', 'used',
  'uses', 'mobile', 'support', 'help', 'desk', 'contact', 'center', 'centre', 'search', 'searching',
  'details', 'discovery', 'facilitate', 'resources', 'additional', 'features', 'feature', 'advanced',
  'complex', 'effective', 'following', 'available', 'created', 'updated', 'fact', 'sheet', 'summary',
  'detail', 'extracted', 'preserved', 'molecular', 'biology', 'bibliographic', 'database', 'national',
  'library', 'institutes', 'institute', 'institutions', 'health', 'medicine', 'information',
  'biotechnology', 'genetics', 'publisher', 'publishers', 'article', 'articles', 'citation', 'citations',
  'reference', 'references', 'link', 'out', 'linkout', 'full', 'text', 'abstracts', 'books',
  // Hallucinated or domain-derived false person names seen in PubMed-style documents.
  'builder', 'show', 'cancer', 'syndrome', 'carcinoma', 'carcinomas', 'ductal', 'dates', 'policy',
  'fourteen', 'portal', 'gigabit', 'ethernet', 'intel', 'nehalem', 'genome', 'genomic', 'genomics',
  'biomedical', 'informatics', 'literature', 'citation', 'biotechnology', 'division', 'operations',
  'computing', 'computer', 'computers', 'server', 'servers', 'network', 'networks', 'processor',
  'processors', 'chip', 'chips', 'microprocessor', 'microprocessors', 'architecture', 'architectures',
  // Calendar months and financial/annual-report terms that produce false-positive person names.
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  'credit', 'spread', 'basis', 'point', 'points', 'ratio', 'ratios', 'funding', 'liquidity', 'coverage',
  'stable', 'net', 'gross', 'yield', 'yields', 'return', 'returns', 'equity', 'debt', 'bonds', 'portfolios',
  'portfolio', 'exposure', 'margin', 'profit', 'profits', 'revenue', 'income', 'expense', 'expenses', 'cost', 'costs',
  'earnings', 'earning', 'price', 'prices', 'volume', 'volumes', 'rate', 'rates', 'indices', 'stocks', 'shares',
  'future', 'futures', 'swap', 'swaps', 'option', 'options', 'forward', 'forwards', 'repo', 'repos', 'repurchase',
  'agreement', 'agreements', 'master', 'global', 'contract', 'contracts', 'nature', 'dependent', 'electricity',
  'aviation', 'fuel', 'power', 'heat', 'metal', 'metals', 'mining', 'environmental', 'establishing', 'loss', 'given',
  'default', 'defaults', 'probability', 'probabilities', 'maturity', 'maturities', 'duration', 'durations',
  'convexity', 'volatility', 'var', 'shortfall', 'stress', 'stresses', 'scenario', 'scenarios', 'simulation', 'simulations',
  'model', 'models', 'forecast', 'forecasts', 'budget', 'budgets', 'allocation', 'allocations', 'benchmark', 'benchmarks',
  'performance', 'tracking', 'error', 'alpha', 'beta', 'gamma', 'delta', 'rho', 'theta', 'vega', 'curve', 'curves', 'tenor',
  'tenors', 'date', 'dates', 'quarter', 'quarters', 'period', 'periods', 'fiscal', 'year', 'years', 'month', 'months', 'week',
  'weeks', 'annual', 'quarterly', 'monthly', 'weekly', 'daily', 'yearly', 'usd', 'eur', 'gbp', 'jpy', 'sek', 'nok', 'chf',
  'cad', 'aud', 'dkk', 'isk', 'aaa', 'bbb', 'baa', 'pasaules', 'dabas',
]);

export function looksLikePerson(name: string): boolean {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return false;

  // Reject four-word names that are actually two consecutive "First Last" names
  // merged together, which is common in tables and lists of board members.
  if (parts.length === 4) {
    const firstHalf = parts.slice(0, 2).join(' ');
    const secondHalf = parts.slice(2).join(' ');
    if (looksLikePerson(firstHalf) && looksLikePerson(secondHalf)) return false;
  }

  const firstName = parts[0].replace(/[.,]/g, '');
  const lastName = parts[parts.length - 1].replace(/[.,]/g, '');

  if (PERSON_PREFIXES.includes(firstName)) return false;
  if (isStopWord(firstName) || isStopWord(lastName)) return false;

  // Reject names built from common nouns, job titles, stop words, product/feature words,
  // or any standalone acronym. Every word in a person name must look like a proper name.
  for (const part of parts) {
    const cleaned = part.replace(/[.,]/g, '').toLowerCase();
    if (cleaned.length === 0) continue;
    if (isStopWord(cleaned)) return false;
    if (NON_PERSON_WORDS.has(cleaned)) return false;
    // Person names are not acronyms.
    if (/^[A-Z]{2,}$/.test(part.trim())) return false;
  }

  // Allow Unicode letters (e.g., Līga, Kļaviņa).
  return /^\p{Lu}[\p{Ll}]+$/u.test(firstName) && /^\p{Lu}[\p{Ll}]+$/u.test(lastName);
}

export function looksLikeAcronym(name: string): boolean {
  return /^[A-Z]{2,8}$/.test(name.trim());
}

function isStopWord(name: string): boolean {
  const lower = name.toLowerCase();
  if (STOP_WORDS.has(lower)) return true;
  if (lower.length <= 2) return true;
  return false;
}

function isCapitalizedPhrase(words: string[]): boolean {
  return words.every((w) => /^\p{Lu}[\p{L}\p{M}0-9&-]*$/u.test(w) || /^[A-Z]+$/u.test(w));
}

function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

export function extractEntities(text: string, options?: { max?: number }): EntityMention[] {
  const counts = new Map<string, { type: EntityMention['type']; count: number }>();

  function increment(name: string, type: EntityMention['type']): void {
    name = normalizeName(name);
    if (isStopWord(name)) return;
    if (name.length < 3) return;
    if (isHeadingLikePhrase(name)) return;
    const existing = counts.get(name);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(name, { type, count: 1 });
    }
  }

  // Process each sentence (and line) separately so capitalized phrases do not
  // cross sentence boundaries, line breaks, or PDF headers and create artifacts
  // like "Doc A Acme Corp" or "Globex Acme Corp".
  const sentences = text.split(/(?<=[.!?])\s+|\n+/);

  for (const sentence of sentences) {
    // Clean text into a uniform space-separated form.
    const clean = sentence
      .replace(/[^\w\s\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const words = clean.split(' ').filter(Boolean);

    // Track which word positions have already been consumed by a longer org phrase.
    const used = new Set<number>();
    const CONNECTIVES = ['of', 'for', 'the', 'in', 'on', 'with', 'by', '&'];
    function isCapitalizedWord(word: string): boolean {
      return /^[A-Z][a-zA-Z0-9\-]*$/.test(word) || /^[A-Z]+$/.test(word);
    }

    // First pass: capture full organisation phrases that include lowercase connectives
    // (e.g., "National Center for Biotechnology Information"). This prevents the
    // shorter fragments "National Center" or "Biotechnology Information" from being
    // extracted as separate entities.
    for (let i = 0; i < words.length; i++) {
      if (!isCapitalizedWord(words[i])) continue;
      let j = i;
      let lastCap = i;
      while (j < words.length) {
        if (isCapitalizedWord(words[j])) {
          lastCap = j;
          j++;
        } else if (
          j + 1 < words.length &&
          CONNECTIVES.includes(words[j].toLowerCase()) &&
          isCapitalizedWord(words[j + 1])
        ) {
          j += 2;
        } else {
          break;
        }
      }
      // Require at least two words and a maximum of eight to avoid runaway matches.
      if (lastCap - i + 1 < 2 || lastCap - i + 1 > 8) continue;
      const phrase = words.slice(i, lastCap + 1).join(' ');
      if (containsOrgKeyword(phrase) || looksLikeOrganization(phrase)) {
        increment(phrase, 'organization');
        for (let k = i; k <= lastCap; k++) used.add(k);
        i = lastCap;
      }
    }

    // Scan multi-word capitalized phrases (2-5 words) for persons, products, and any
    // organisations not captured above. Skip positions already consumed by the
    // connective-aware org pass so that fragments are not re-extracted.
    for (let i = 0; i < words.length; i++) {
      if (used.has(i)) continue;
      for (const length of [5, 4, 3, 2]) {
        if (i + length > words.length) continue;
        if (used.has(i + length - 1)) continue;
        const slice = words.slice(i, i + length);
        if (!isCapitalizedPhrase(slice)) continue;
        const name = slice.join(' ');
        if (looksLikeOrganization(name) || containsOrgKeyword(name)) {
          increment(name, 'organization');
        } else if (looksLikePerson(name)) {
          increment(name, 'person');
        } else if (containsProductKeyword(name)) {
          increment(name, 'product');
        } else if (looksLikeAcronym(slice[0]) && length === 2) {
          // Treat acronym + keyword as product if it looks like one (e.g., "NCBI Database").
          increment(name, 'product');
        }
      }
    }

    // Person pattern: First Last or First Middle Last with Unicode support.
    const personPattern = /\b(\p{Lu}[\p{Ll}]+(?:\s+\p{Lu}[\p{Ll}]+){1,3})\b/gu;
    for (const match of sentence.match(personPattern) ?? []) {
      const name = normalizeName(match);
      if (isStopWord(name) || counts.has(name)) continue;
      if (looksLikePerson(name)) {
        increment(match, 'person');
      }
    }

    // Product / acronym pattern.
    const acronymPattern = /\b([A-Z]{2,8}(?:\s+\d+)?)\b/g;
    for (const match of sentence.match(acronymPattern) ?? []) {
      const name = normalizeName(match);
      if (isStopWord(name) || counts.has(name)) continue;
      increment(match, 'product');
    }

    // Location pattern: simple city/state or city/country pairings.
    const locationPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}),?\s+[A-Z]{2}\b/g;
    for (const match of sentence.match(locationPattern) ?? []) {
      const name = normalizeName(match.replace(/,\\s+[A-Z]{2}$/, '').trim());
      if (isStopWord(name) || counts.has(name)) continue;
      increment(match, 'location');
    }
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
  return `${slugify(entity.name)}.md`;
}

export function entityFileNameWithRegistry(entity: EntityMention, registry: SlugRegistry): string {
  const disambiguated = registry.register(entity.name);
  return `${disambiguated}.md`;
}

export function entityPageTitle(entity: EntityMention): string {
  return `Entity: ${entity.name}`;
}

// ---------- Entity taxonomy helpers ----------

const TYPE_TO_SUBFOLDER: Record<EntityMention['type'], string> = {
  person: 'people',
  organization: 'organizations',
  location: 'locations',
  case: 'cases',
  event: 'events',
  product: 'products',
};

const TYPE_TO_TITLE: Record<EntityMention['type'], string> = {
  person: 'People',
  organization: 'Organizations',
  location: 'Locations',
  case: 'Cases',
  event: 'Events',
  product: 'Products',
};

export function buildTypeBasedTaxonomy(entities: EntityMention[]): EntityTaxonomy {
  const taxonomy: EntityTaxonomy = { subFolders: [], assignments: {} };
  for (const entity of entities) {
    const subFolder = TYPE_TO_SUBFOLDER[entity.type];
    const title = TYPE_TO_TITLE[entity.type];
    if (!taxonomy.subFolders.some((f) => f.slug === subFolder)) {
      taxonomy.subFolders.push({ slug: subFolder, title, description: `${title} mentioned in the corpus.` });
    }
    taxonomy.assignments[slugify(entity.name)] = subFolder;
  }
  return taxonomy;
}

export function resolveEntitySubFolder(entity: EntityMention, taxonomy: EntityTaxonomy): string {
  const canonical = slugify(entity.name);
  const assigned = taxonomy.assignments[canonical];
  if (assigned) return assigned;

  const fallback = TYPE_TO_SUBFOLDER[entity.type] ?? 'other';
  const title = TYPE_TO_TITLE[entity.type] ?? 'Other Entities';
  if (!taxonomy.subFolders.some((f) => f.slug === fallback)) {
    taxonomy.subFolders.push({ slug: fallback, title, description: `${title} mentioned in the corpus.` });
  }
  taxonomy.assignments[canonical] = fallback;
  return fallback;
}

export function entityFilePath(entity: EntityMention, taxonomy: EntityTaxonomy): string {
  const subFolder = resolveEntitySubFolder(entity, taxonomy);
  return path.posix.join('entities', subFolder, `${slugify(entity.name)}.md`);
}

export function entityFilePathWithRegistry(
  entity: EntityMention,
  taxonomy: EntityTaxonomy,
  registry: SlugRegistry,
): string {
  const subFolder = resolveEntitySubFolder(entity, taxonomy);
  return path.posix.join('entities', subFolder, `${registry.register(entity.name)}.md`);
}

export function migrateLegacyEntityPage(
  outputDir: string,
  entity: EntityMention,
  taxonomy: EntityTaxonomy,
): { filePath: string; existingBody?: string } {
  const newRelativePath = entityFilePath(entity, taxonomy);
  const newFilePath = path.join(outputDir, newRelativePath);
  if (existsSync(newFilePath)) {
    return { filePath: newFilePath };
  }

  const legacyRelativePath = path.posix.join('entities', `${slugify(entity.name)}.md`);
  const legacyFilePath = path.join(outputDir, legacyRelativePath);
  if (existsSync(legacyFilePath)) {
    mkdirSync(path.dirname(newFilePath), { recursive: true });
    renameSync(legacyFilePath, newFilePath);
    const content = readFileSync(newFilePath, 'utf-8');
    const parsed = matter(content);
    return { filePath: newFilePath, existingBody: parsed.content };
  }

  return { filePath: newFilePath };
}

export function removeLegacyEntityPage(outputDir: string, entity: EntityMention): void {
  const legacyRelativePath = path.posix.join('entities', `${slugify(entity.name)}.md`);
  const legacyFilePath = path.join(outputDir, legacyRelativePath);
  if (existsSync(legacyFilePath)) {
    rmSync(legacyFilePath);
  }
}

export interface MentionLocation {
  source: string;
  filePath?: string;
  pages: string;
}

export interface EntityWriteOptions {
  description?: string;
  relationships?: { predicate: string; object: string; evidence: string; pages: string }[];
  sources?: { id: string; file: string; pages: string; extracted: string }[];
  /** LLM-authored corpus-specific tags. Required; deterministic code never fabricates tags. */
  tags?: string[];
}

export function writeEntityPage(
  filePath: string,
  entity: EntityMention,
  config: Config,
  mentions: MentionLocation[],
  options?: EntityWriteOptions,
  body?: string,
): void {
  mkdirSync(path.dirname(filePath), { recursive: true });

  const title = entityPageTitle(entity);
  const now = new Date().toISOString();
  const created = readCreatedTimestamp(filePath) ?? now;

  if (!body || body.trim().length === 0) {
    throw new CLIError('LLM body is required to write an entity page.');
  }
  // Tags are synthesized page frontmatter (vision 05 §6.1); the LLM is their
  // sole author. Deterministic code must not substitute e.g. [type, 'entity'].
  if (!options?.tags || options.tags.length === 0) {
    throw new CLIError('LLM-authored tags are required to write an entity page.');
  }

  const frontmatter: Record<string, unknown> = {
    title,
    created,
    updated: now,
    type: 'entity',
    wiki: config.wiki.slug,
    tags: options.tags,
    mentions: entity.count,
  };
  if (options?.sources && options.sources.length > 0) {
    frontmatter.sources = options.sources;
  }

  writeFileSync(filePath, matter.stringify(body, frontmatter));
}
