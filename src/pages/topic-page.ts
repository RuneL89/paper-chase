import matter from 'gray-matter';

export interface TopicPageClaim {
  text: string;
  type: string;
  entities: string[];
  page: number;
  source: string;
  pages: string;
}

export interface TopicPageData {
  title: string;
  slug: string;
  folder: string;
  wiki: string;
  claims: TopicPageClaim[];
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

function stripCitations(text: string): string {
  return text.replace(/\[\^src\d+\]/g, '').trim();
}

/**
 * Render a topic page as a markdown string with YAML frontmatter.
 *
 * Topic pages are grouped by claim type. The first-pass topic slug is the claim
 * type itself, so a `financial` claim produces `topics/financial/financial.md`.
 */
export function writeTopicPage(data: TopicPageData): string {
  const updated = new Date().toISOString();
  const tags = [data.slug].filter((tag, index, arr) => arr.indexOf(tag) === index);

  const citationMap = new Map<string, number>();
  const sourceDefinitions: Map<
    string,
    { file: string; pages: string; index: number }
  > = new Map();
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

  if (data.claims.length > 0) {
    lines.push('## Claims', '');
    for (const claim of data.claims) {
      const citation = getCitation(claim.source, claim.pages);
      const entityLinks = claim.entities.map((e) => formatWikilink(e, data.slugToTitle)).join(', ');
      lines.push(`- ${stripCitations(claim.text)} ${citation}${entityLinks ? ` (${entityLinks})` : ''}`);
    }
    lines.push('');
  }

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
    title: data.title,
    type: 'topic',
    wiki: data.wiki,
    updated,
    sources: frontmatterSources,
    tags,
  };

  const body = `\n${lines.join('\n')}\n`;
  return matter.stringify(body, frontmatter);
}
