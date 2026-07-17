import matter from 'gray-matter';

/**
 * Source reference attached to a mention, relationship, or claim. The `file`
 * field is the workspace-relative path (forward slashes) so generated pages
 * are byte-identical on every platform; the `pages` field is the chunk's page
 * range (e.g. "1-3").
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
}

function sourceKey(file: string, pages: string): string {
  return `${file}|${pages}`;
}

function sourceFileName(file: string): string {
  return file.split('/').pop() ?? file;
}

function formatWikilink(slug: string, slugToTitle: Record<string, string>): string {
  return `[[${slugToTitle[slug] ?? slug}]]`;
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
 * Render an entity page as a markdown string with YAML frontmatter.
 *
 * Citation numbering (`src1`, `src2`, ...) is sequential within the page. Each
 * distinct source + page-range pair gets one citation index; items that share
 * the same source and page range reuse the same `[^srcN]` key.
 */
export function writeEntityPage(data: EntityPageData): string {
  const updated = new Date().toISOString();
  const tags = [data.type].filter((tag, index, arr) => arr.indexOf(tag) === index);

  const citationMap = new Map<string, number>();
  const sourceDefinitions: Map<string, { file: string; pages: string; index: number }> = new Map();
  let nextCitation = 1;

  function getCitation(file: string, pages: string): string {
    const key = sourceKey(file, pages);
    let index = citationMap.get(key);
    if (index === undefined) {
      index = nextCitation++;
      citationMap.set(key, index);
      sourceDefinitions.set(key, { file, pages, index });
    }
    return `[^src${index}]`;
  }

  const lines: string[] = [];

  // Mentions
  if (data.mentions.length > 0) {
    lines.push('## Mentions', '');
    for (const mention of data.mentions) {
      const citation = getCitation(mention.source, mention.pages);
      lines.push(`- Page ${mention.page}: "${stripCitations(mention.context)}" ${citation}`);
    }
    lines.push('');
  }

  // Relationships
  if (data.relationships.length > 0) {
    lines.push('## Relationships', '');
    for (const rel of data.relationships) {
      const citation = getCitation(rel.source, rel.pages);
      const predicateReadable = rel.predicate
        .split('-')
        .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
        .join(' ');
      lines.push(`- ${formatWikilink(rel.object, data.slugToTitle)} — ${predicateReadable} ${citation}`);
    }
    lines.push('');
  }

  // Claims
  if (data.claims.length > 0) {
    lines.push('## Claims', '');
    for (const claim of data.claims) {
      const citation = getCitation(claim.source, claim.pages);
      const entityLinks = claim.entities.map((e) => formatWikilink(e, data.slugToTitle)).join(', ');
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

  const frontmatter: Record<string, unknown> = {
    title: escapeYamlString(data.title),
    type: 'entity',
    wiki: data.wiki,
    updated,
    sources: frontmatterSources,
    tags,
  };

  const body = `\n${lines.join('\n')}\n`;
  return matter.stringify(body, frontmatter);
}

export { titleCaseClaimType };
