import matter from 'gray-matter';
import { aliasesForTitle } from '../utils/aliases';
import { formatWikilink } from '../utils/wikilinks';
import { enforceSourcesSectionInMarkdown } from './entity-page';

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
  /** Phase 5: related entity titles (derived from claims) for topic synthesis. */
  entities?: string[];
  /** Phase 5: broader corpus context for topic synthesis. */
  context?: string;
}

function sourceKey(file: string, pages: string): string {
  return `${file}|${pages}`;
}

function sourceFileName(file: string): string {
  return file.split('/').pop() ?? file;
}

/**
 * Render a wikilink to an entity in Obsidian's native pipe form (user
 * directive 2026-07-20): `[[<slug>|<Title>]]` for known slugs, the bare
 * `[[slug]]` fallback for unknown slugs so the link is not lost.
 */
function entityWikilink(slug: string, slugToTitle: Record<string, string>): string {
  return formatWikilink(slug, slugToTitle[slug]);
}

function stripCitations(text: string): string {
  return text.replace(/\[\^src\d+\]/g, '').trim();
}

/**
 * Aggregate the frontmatter `sources` list from the topic data: one entry
 * per source file with the unique page ranges joined (sorted).
 */
function buildTopicFrontmatterSources(
  data: Pick<TopicPageData, 'claims'>,
): Array<{ file: string; pages: string }> {
  const sourceRanges = new Map<string, Set<string>>();
  for (const claim of data.claims) {
    const set = sourceRanges.get(claim.source) ?? new Set<string>();
    set.add(claim.pages);
    sourceRanges.set(claim.source, set);
  }
  return Array.from(sourceRanges.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, pagesSet]) => ({
      file,
      pages: Array.from(pagesSet).sort((x, y) => x.localeCompare(y)).join(', '),
    }));
}

/**
 * The complete deterministic topic-page frontmatter (vision `05` §2), shared
 * by `writeTopicPage` and the Phase 17 `enforceTopicFrontmatterInMarkdown`
 * re-imposition: title, type, aliases, wiki, updated, the full aggregated
 * sources, and tags — in the writer's field order. Topic pages never carry
 * `sparse` (entity-only rule, vision `02` §4.8).
 */
function buildTopicFrontmatter(data: TopicPageData, updated: string): Record<string, unknown> {
  const tags = [data.slug].filter((tag, index, arr) => arr.indexOf(tag) === index);
  const aliases = aliasesForTitle(data.title, data.slug);
  return {
    title: data.title,
    type: 'topic',
    ...(aliases ? { aliases } : {}),
    wiki: data.wiki,
    updated,
    sources: buildTopicFrontmatterSources(data),
    tags,
  };
}

/**
 * Render a topic page as a markdown string with YAML frontmatter.
 *
 * Topic pages are grouped by claim type. The first-pass topic slug is the claim
 * type itself, so a `financial` claim produces `topics/financial/financial.md`.
 */
export function writeTopicPage(data: TopicPageData): string {
  const updated = new Date().toISOString();

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
      const entityLinks = claim.entities.map((e) => entityWikilink(e, data.slugToTitle)).join(', ');
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

  const body = `\n${lines.join('\n')}\n`;
  return matter.stringify(body, buildTopicFrontmatter(data, updated));
}

/**
 * Phase 17 (B1 Defect B + B2, vision `05` §2 + `06` §2-§3): the topic-page
 * equivalent of `enforceFrontmatterInMarkdown` — the complete deterministic
 * frontmatter (title, type, aliases, wiki, real-write-time `updated`, the
 * full aggregated `sources`, tags) written OVER the model's frontmatter
 * (model-invented fields dropped), CREATED when the model omitted the block
 * entirely. The body is preserved byte-for-byte; a page with unparseable
 * model frontmatter is returned unchanged (the schema validator flags it).
 */
export function enforceTopicFrontmatterInMarkdown(markdown: string, pageData: TopicPageData): string {
  let body = markdown;
  if (/^---[ \t]*\r?\n/.test(markdown)) {
    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(markdown);
    } catch {
      return markdown;
    }
    body = parsed.content;
  }
  return matter.stringify(body, buildTopicFrontmatter(pageData, new Date().toISOString()));
}

/**
 * Phase 17 (B1 Defect A, vision `06` §7): the topic-page `## Sources`
 * definition normalization — the shared implementation lives with the entity
 * enforcer in `pages/entity-page.ts` (basename + page-range definitions
 * rebuilt from the page's deterministic citation map; in-prose markers
 * byte-identical).
 */
export function enforceTopicSourcesSectionInMarkdown(markdown: string, citationMap: Map<string, number>): string {
  return enforceSourcesSectionInMarkdown(markdown, citationMap);
}
