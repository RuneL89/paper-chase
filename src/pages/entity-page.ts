import matter from 'gray-matter';
import { aliasesForTitle } from '../utils/aliases';
import { formatWikilink } from '../utils/wikilinks';

/**
 * Source reference attached to a mention, relationship, or claim. The `file`
 * field is the workspace-relative path (forward slashes) so generated pages are
 * byte-identical on every platform; the `pages` field is the chunk's page range
 * (e.g. "1-3").
 */
export interface PageSourceRef {
  file: string;
  pages: string;
}

export interface EntityPageMention {
  page: number;
  context: string;
  source: string;
  pages: string;
}

export interface EntityPageRelationship {
  subject: string;
  predicate: string;
  object: string;
  evidence: string;
  page: number;
  source: string;
  pages: string;
}

export interface EntityPageClaim {
  text: string;
  type: string;
  entities: string[];
  page: number;
  source: string;
  pages: string;
}

export interface EntityPageTimelineEvent {
  date: string;
  event: string;
  entities: string[];
}

export interface EntityPageData {
  title: string;
  slug: string;
  folder: string;
  type: string;
  wiki: string;
  mentions: EntityPageMention[];
  relationships: EntityPageRelationship[];
  claims: EntityPageClaim[];
  slugToTitle: Record<string, string>;
  /** Phase 5: significance statement from the Extractor. */
  significance?: string;
  /** Phase 5: optional disambiguation note from the Extractor. */
  disambiguation?: string;
  /** Phase 5: broader corpus context from the Extractor. */
  context?: string;
  /** Phase 5: timeline events involving this entity. */
  timeline?: EntityPageTimelineEvent[];
  /**
   * Phase 5: citation keys (e.g. "src1") already present in the structured
   * page. Used by the preservation check to ensure synthesis does not drop
   * existing citations.
   */
  citations?: string[];
}

function sourceKey(file: string, pages: string): string {
  return `${file}|${pages}`;
}

function sourceFileName(file: string): string {
  return file.split('/').pop() ?? file;
}

/**
 * Render a wikilink to another entity in Obsidian's native pipe form
 * (user directive 2026-07-20): `[[<slug>|<Title>]]` for known slugs, the bare
 * `[[slug]]` fallback for unknown slugs so the link is not lost, and the bare
 * form when the title equals the slug exactly.
 */
function entityWikilink(slug: string, slugToTitle: Record<string, string>): string {
  return formatWikilink(slug, slugToTitle[slug]);
}

/** Strip any pre-existing `[^srcN]` citations from text before adding our own. */
function stripCitations(text: string): string {
  return text.replace(/\[\^src\d+\]/g, '').trim();
}

function escapeYamlString(value: string): string {
  // Quote the value if it contains YAML-sensitive characters or starts/ends with whitespace.
  if (/[:#{}[\],&*!?|>'"%@`\n\r]/.test(value) || /^\s|\s$/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}

function titleCaseClaimType(type: string): string {
  return type
    .split('-')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/**
 * Build the citation map used by `writeEntityPage` and the preservation check.
 * Returns a map from source key (`file|pages`) to the assigned `srcN` index,
 * and the list of citation keys in order.
 */
export function buildCitationMap(data: Pick<EntityPageData, 'mentions' | 'relationships' | 'claims'>): {
  citationMap: Map<string, number>;
  keys: string[];
} {
  const citationMap = new Map<string, number>();
  const keys: string[] = [];
  let nextCitation = 1;

  function assignKey(file: string, pages: string): void {
    const key = sourceKey(file, pages);
    if (citationMap.has(key)) {
      return;
    }
    const index = nextCitation++;
    citationMap.set(key, index);
    keys.push(`src${index}`);
  }

  for (const mention of data.mentions) {
    assignKey(mention.source, mention.pages);
  }
  for (const rel of data.relationships) {
    assignKey(rel.source, rel.pages);
  }
  for (const claim of data.claims) {
    assignKey(claim.source, claim.pages);
  }

  return { citationMap, keys };
}

function getCitation(citationMap: Map<string, number>, file: string, pages: string): string {
  const index = citationMap.get(sourceKey(file, pages));
  if (index === undefined) {
    throw new Error(`Citation map missing entry for ${file} pages ${pages}.`);
  }
  return `[^src${index}]`;
}

/**
 * Render an entity page as a markdown string with YAML frontmatter.
 *
 * Citation numbering (`src1`, `src2`, ...) is sequential within the page. Each
 * distinct source + page-range pair gets one citation index; items that share
 * the same source and page range reuse the same `[^srcN]` key.
 */
export function writeEntityPage(data: EntityPageData): string {
  const updated = new Date().toISOString();
  const tags = [data.type].filter((tag, index, arr) => arr.indexOf(tag) === index);

  const { citationMap } = buildCitationMap(data);
  const sourceDefinitions: Map<string, { file: string; pages: string; index: number }> = new Map();
  for (const [key, index] of citationMap.entries()) {
    sourceDefinitions.set(key, { file: key.split('|')[0], pages: key.split('|')[1], index });
  }

  const lines: string[] = [];

  // Mentions
  if (data.mentions.length > 0) {
    lines.push('## Mentions', '');
    for (const mention of data.mentions) {
      const citation = getCitation(citationMap, mention.source, mention.pages);
      lines.push(`- Page ${mention.page}: "${stripCitations(mention.context)}" ${citation}`);
    }
    lines.push('');
  }

  // Relationships
  if (data.relationships.length > 0) {
    lines.push('## Relationships', '');
    for (const rel of data.relationships) {
      const citation = getCitation(citationMap, rel.source, rel.pages);
      const predicateReadable = rel.predicate
        .split('-')
        .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
        .join(' ');
      lines.push(`- ${entityWikilink(rel.object, data.slugToTitle)} — ${predicateReadable} ${citation}`);
    }
    lines.push('');
  }

  // Claims
  if (data.claims.length > 0) {
    lines.push('## Claims', '');
    for (const claim of data.claims) {
      const citation = getCitation(citationMap, claim.source, claim.pages);
      const entityLinks = claim.entities.map((e) => entityWikilink(e, data.slugToTitle)).join(', ');
      lines.push(`- ${stripCitations(claim.text)} ${citation}${entityLinks ? ` (${entityLinks})` : ''}`);
    }
    lines.push('');
  }

  // Sources
  const definitionEntries = Array.from(sourceDefinitions.values()).sort((a, b) => a.index - b.index);
  if (definitionEntries.length > 0) {
    lines.push('## Sources', '');
    for (const entry of definitionEntries) {
      lines.push(`[^src${entry.index}]: ${sourceFileName(entry.file)}, pages ${entry.pages}`);
    }
    lines.push('');
  }

  // Aggregate frontmatter sources by file, joining unique page ranges.
  const sourceRanges = new Map<string, Set<string>>();
  for (const mention of data.mentions) {
    const set = sourceRanges.get(mention.source) ?? new Set<string>();
    set.add(mention.pages);
    sourceRanges.set(mention.source, set);
  }
  for (const rel of data.relationships) {
    const set = sourceRanges.get(rel.source) ?? new Set<string>();
    set.add(rel.pages);
    sourceRanges.set(rel.source, set);
  }
  for (const claim of data.claims) {
    const set = sourceRanges.get(claim.source) ?? new Set<string>();
    set.add(claim.pages);
    sourceRanges.set(claim.source, set);
  }
  const frontmatterSources = Array.from(sourceRanges.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, pagesSet]) => ({
      file,
      pages: Array.from(pagesSet).sort((x, y) => x.localeCompare(y)).join(', '),
    }));

  // Obsidian-resolvable title alias (UAT 6.3 fix): raw title, js-yaml escapes
  // it; omitted when the title matches the file slug case-insensitively.
  const aliases = aliasesForTitle(data.title, data.slug);
  const frontmatter: Record<string, unknown> = {
    title: escapeYamlString(data.title),
    type: 'entity',
    ...(aliases ? { aliases } : {}),
    wiki: data.wiki,
    updated,
    sources: frontmatterSources,
    tags,
  };

  const body = `\n${lines.join('\n')}\n`;
  return matter.stringify(body, frontmatter);
}

export { titleCaseClaimType };
