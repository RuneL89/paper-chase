import matter from 'gray-matter';
import { combinedAliases } from '../utils/aliases';
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

/**
 * Phase 17 (B10, vision `02` §4.3 B): a relationship where THIS entity is
 * the object — attached to the object entity's page data by the
 * Materializer's mirror pass so both pages tell both sides of the story.
 * Carries no `object` field: the object is the page's own entity.
 */
export interface EntityPageIncomingRelationship {
  subject: string;
  predicate: string;
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
  /**
   * Phase 13 (vision `02` §4.8 + `05` §2): the sparse flag, computed by the
   * Materializer via `isSparseEntity` so downstream consumers (the ingest
   * synthesis-replacement path) see it without recomputing. `writeEntityPage`
   * always derives the flag from the aggregate via the same rule, so callers
   * that omit it still get correct frontmatter.
   */
  sparse?: boolean;
  /**
   * Phase 14 (phase doc §2.3, vision `05` §2): every variant title accumulated
   * by curation merges into this canonical entity. Unioned into the page's
   * frontmatter `aliases` by `writeEntityPage` (via `combinedAliases`) so
   * `[[Variant Title]]` links resolve to the surviving page.
   */
  mergedAliases?: string[];
  /**
   * Phase 17 (B10, vision `02` §4.3 B): relationships where THIS entity is
   * the object, attached by the Materializer's mirror pass. Rendered in
   * `## Relationships` with the `(incoming)` marker and the verbatim
   * evidence. The sparse rule does NOT read this array (design decision
   * ratified 2026-07-28: incoming relationships do not clear `sparse` —
   * sparse signals the page's own evidence depth). Omitted (undefined) when
   * empty so the Phase 16 aggregate fingerprint of a page with no incoming
   * edges is unchanged from pre-Phase-17.
   */
  incomingRelationships?: EntityPageIncomingRelationship[];
}

/**
 * Phase 13 (vision `02` §4.8 + `05` §2, user-ratified 2026-07-23): the
 * deterministic sparse-page rule. An entity page is sparse when its aggregate
 * has at most two mentions AND no claims AND no relationships. The flag is
 * derived from the aggregate only — never by the LLM. Entity pages are
 * re-derived from the full extraction set every run (Phase 8 update mode), so
 * the flag is recomputed correctly on every ingest: a stub that gains mentions
 * loses the flag automatically.
 */
export function isSparseEntity(
  data: Pick<EntityPageData, 'mentions' | 'relationships' | 'claims'>,
): boolean {
  return data.mentions.length <= 2 && data.relationships.length === 0 && data.claims.length === 0;
}

/**
 * Deterministic sparse-flag enforcement over a fully-rendered entity page
 * (Phase 13; the UAT 6.3 `enforceAliasesInMarkdown` precedent): re-imposes
 * `sparse: true` when the entity is sparse and REMOVES any `sparse` field
 * when it is not — the LLM's frontmatter is never trusted for the flag.
 * Pages without a frontmatter block, or with unparseable frontmatter, are
 * returned unchanged (the schema validator already flags those; this helper
 * never invents a frontmatter block).
 */
export function enforceSparseInMarkdown(markdown: string, sparse: boolean): string {
  if (!/^---[ \t]*\r?\n/.test(markdown)) {
    return markdown;
  }
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(markdown);
  } catch {
    return markdown;
  }
  if (sparse) {
    parsed.data.sparse = true;
  } else {
    delete parsed.data.sparse;
  }
  return matter.stringify(parsed.content, parsed.data);
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

/** `is-ceo-of` → `Is Ceo Of` — the relationship line's predicate form. */
function readablePredicate(predicate: string): string {
  return predicate
    .split('-')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/**
 * Build the citation map used by `writeEntityPage` and the preservation check.
 * Returns a map from source key (`file|pages`) to the assigned `srcN` index,
 * and the list of citation keys in order. Phase 17: incoming relationships
 * contribute their sources AFTER mentions/outgoing/claims, so a page with no
 * incoming edges keeps its pre-Phase-17 key numbering byte-identically.
 */
export function buildCitationMap(data: Pick<EntityPageData, 'mentions' | 'relationships' | 'claims' | 'incomingRelationships'>): {
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
  for (const rel of data.incomingRelationships ?? []) {
    assignKey(rel.source, rel.pages);
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
 * Aggregate the frontmatter `sources` list from the page data: one entry per
 * source file with the unique page ranges joined (sorted). Phase 17: incoming
 * relationships contribute their sources too, so the list covers every
 * citation the page can carry (vision `06` §2-§3).
 */
function buildEntityFrontmatterSources(
  data: Pick<EntityPageData, 'mentions' | 'relationships' | 'claims' | 'incomingRelationships'>,
): Array<{ file: string; pages: string }> {
  const sourceRanges = new Map<string, Set<string>>();
  const add = (file: string, pages: string): void => {
    const set = sourceRanges.get(file) ?? new Set<string>();
    set.add(pages);
    sourceRanges.set(file, set);
  };
  for (const mention of data.mentions) {
    add(mention.source, mention.pages);
  }
  for (const rel of data.relationships) {
    add(rel.source, rel.pages);
  }
  for (const claim of data.claims) {
    add(claim.source, claim.pages);
  }
  for (const rel of data.incomingRelationships ?? []) {
    add(rel.source, rel.pages);
  }
  return Array.from(sourceRanges.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, pagesSet]) => ({
      file,
      pages: Array.from(pagesSet).sort((x, y) => x.localeCompare(y)).join(', '),
    }));
}

/**
 * The complete deterministic entity-page frontmatter (vision `05` §2), shared
 * by `writeEntityPage` and the Phase 17 `enforceFrontmatterInMarkdown`
 * re-imposition: title, type, aliases (combinedAliases incl. curation-merged
 * variant titles), sparse (outgoing-only scope), wiki, updated, the full
 * aggregated sources, and tags — in the writer's field order.
 */
function buildEntityFrontmatter(data: EntityPageData, updated: string): Record<string, unknown> {
  const tags = [data.type].filter((tag, index, arr) => arr.indexOf(tag) === index);
  const aliases = combinedAliases(data.title, data.slug, data.mergedAliases);
  return {
    title: escapeYamlString(data.title),
    type: 'entity',
    ...(aliases ? { aliases } : {}),
    // Phase 13 (vision `02` §4.8): sparse flag after aliases, before sources;
    // emitted only when true — never `sparse: false`.
    ...(isSparseEntity(data) ? { sparse: true } : {}),
    wiki: data.wiki,
    updated,
    sources: buildEntityFrontmatterSources(data),
    tags,
  };
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

  // Relationships (both directions — Phase 17, B10, vision `02` §4.3 B):
  // outgoing lines first (unchanged format), then incoming lines with the
  // `(incoming)` marker and the evidence quote verbatim.
  const incoming = data.incomingRelationships ?? [];
  if (data.relationships.length > 0 || incoming.length > 0) {
    lines.push('## Relationships', '');
    for (const rel of data.relationships) {
      const citation = getCitation(citationMap, rel.source, rel.pages);
      lines.push(`- ${entityWikilink(rel.object, data.slugToTitle)} — ${readablePredicate(rel.predicate)} ${citation}`);
    }
    for (const rel of incoming) {
      const citation = getCitation(citationMap, rel.source, rel.pages);
      lines.push(
        `- ${entityWikilink(rel.subject, data.slugToTitle)} — ${readablePredicate(rel.predicate)} (incoming) — "${rel.evidence}" ${citation}`,
      );
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

  const body = `\n${lines.join('\n')}\n`;
  return matter.stringify(body, buildEntityFrontmatter(data, updated));
}

export { titleCaseClaimType };

/**
 * Phase 17 (B1 Defect B + B2, vision `05` §2 + `06` §2-§3): deterministic
 * frontmatter re-imposition over a synthesized (LLM-written) entity page.
 * Builds the COMPLETE frontmatter from the deterministic page data — title,
 * type, aliases (`combinedAliases`, curation-merged variant titles included),
 * `sparse` (`isSparseEntity`, outgoing-relationships scope), wiki, `updated`
 * (the REAL write time — B2's fix), the full aggregated `sources` list, and
 * tags — and writes it OVER the model's frontmatter: model-invented fields
 * are dropped. When the model omitted the frontmatter block entirely it is
 * CREATED, ending the "never invents a frontmatter block" no-op class of the
 * aliases/sparse enforcers; the body is preserved byte-for-byte. A page whose
 * model frontmatter is unparseable is returned unchanged (the schema
 * validator already flags it).
 */
export function enforceFrontmatterInMarkdown(markdown: string, pageData: EntityPageData): string {
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
  return matter.stringify(body, buildEntityFrontmatter(pageData, new Date().toISOString()));
}

/**
 * Phase 17 (B1 Defect A, vision `06` §7): deterministic `## Sources`
 * definition normalization over a synthesized page. The definitions are
 * rebuilt from the page's deterministic citation map (`buildCitationMap`) in
 * basename + page-range form — the form the citation checker resolves and
 * `06` §7's example shows — replacing whatever the model wrote (the run-5
 * defect: LLM-chosen full-workspace-path definitions the checker cannot
 * resolve). In-prose `[^srcN]` markers stay byte-identical. An existing
 * `## Sources` section is replaced up to the next `##` heading (or end of
 * page); a missing one is appended at the end. With an empty citation map
 * the page is returned unchanged.
 */
export function enforceSourcesSectionInMarkdown(markdown: string, citationMap: Map<string, number>): string {
  const definitions = Array.from(citationMap.entries())
    .map(([key, index]) => ({ key, index }))
    .sort((a, b) => a.index - b.index)
    .map(({ key, index }) => {
      const [file, pages] = key.split('|');
      return `[^src${index}]: ${sourceFileName(file)}, pages ${pages}`;
    });
  if (definitions.length === 0) {
    return markdown;
  }
  const section = ['## Sources', '', ...definitions, ''].join('\n');
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => /^## Sources[ \t\r]*$/.test(line));
  if (start === -1) {
    const base = markdown.endsWith('\n') ? markdown.slice(0, -1) : markdown;
    return `${base}\n\n${section}`;
  }
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++) {
    if (/^## /.test(lines[index])) {
      end = index;
      break;
    }
  }
  return [...lines.slice(0, start), section, ...lines.slice(end)].join('\n');
}
