import matter from 'gray-matter';
import { combinedAliases } from '../utils/aliases';
import { formatWikilink } from '../utils/wikilinks';
import {
  buildCitationMap,
  type EntityPageClaim,
  type EntityPageIncomingRelationship,
  type EntityPageMention,
  type EntityPageRelationship,
  type EntityPageTimelineEvent,
} from './entity-page';

/**
 * Phase 22 (phase doc §2.2–§2.3; canon: the five-class rollup amendment —
 * vision `02` §4.6 / `05` §6 amended 2026-07-29, user-ratified; backlog B22):
 * the COMPOSITE page kind. A composite pools 2-4 logically-mapped entities
 * (one of the five ratified rollup classes) into ONE rich article while
 * keeping every member's identity in the graph: member pages are NOT
 * written, member-targeted wikilinks resolve to the composite, and every
 * evidence item keeps its member association from extraction (the Layer 2
 * sections group per member).
 *
 * `type: composite` pages carry the members block + the ratified `class` in
 * frontmatter (the schema validator requires both), the union of all member
 * titles in `aliases` (Obsidian search still finds the members), and the
 * aggregated `sources` over the unioned evidence. The `sparse` flag NEVER
 * applies (composites are rich by construction). The Phase 16 resume
 * fingerprint over this data (`pageDataHash`, `slugToTitle` excluded) is a
 * hash over { members, unioned evidence, language } — member-set changes
 * flip it exactly once; unrelated pages never touch it.
 */

export interface CompositeMember {
  slug: string;
  title: string;
  type: string;
  /** Class-derived descriptor (class 3: 'indicator' | 'concept'); omitted otherwise. */
  role?: string;
  significance?: string;
  disambiguation?: string;
  /** The member's accumulated variant titles (curation merges). */
  aliases?: string[];
}

/**
 * One member's evidence, verbatim from its extraction aggregate — every item
 * keeps its member association (phase doc §2.2: "every item keeps its member
 * association from extraction").
 */
export interface CompositeMemberEvidence {
  slug: string;
  mentions: EntityPageMention[];
  relationships: EntityPageRelationship[];
  incomingRelationships: EntityPageIncomingRelationship[];
  claims: EntityPageClaim[];
  timeline: EntityPageTimelineEvent[];
  contexts: string[];
}

export interface CompositePageData {
  /** Member titles joined ' — ' (e.g. `Indikator 1 — Antibiotikabehandling`). */
  title: string;
  /** The `into` member's slug — the composite takes over its page path. */
  slug: string;
  /** The `into` member's folder. */
  folder: string;
  wiki: string;
  /** The ratified rollup class (1-5). */
  class: number;
  members: CompositeMember[];
  /** Same order as `members` — group i is member i's evidence. */
  memberEvidence: CompositeMemberEvidence[];
  slugToTitle: Record<string, string>;
  /**
   * Every member title plus the members' accumulated variant titles — unioned
   * into the frontmatter `aliases` (the members' names still find the page).
   */
  aliases?: string[];
  /** Unioned chunk contexts (synthesis input). */
  context?: string;
}

function sourceKey(file: string, pages: string): string {
  return `${file}|${pages}`;
}

function sourceFileName(file: string): string {
  return file.split('/').pop() ?? file;
}

function escapeYamlString(value: string): string {
  if (/[:#{}[\],&*!?|>'"%@`\n\r]/.test(value) || /^\s|\s$/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}

function stripCitations(text: string): string {
  return text.replace(/\[\^src\d+\]/g, '').trim();
}

function readablePredicate(predicate: string): string {
  return predicate
    .split('-')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/**
 * The page's citation map over the UNIONED member evidence (mentions,
 * relationships, claims, incoming — the entity-page order, concatenated in
 * member order): one `srcN` per distinct source + page-range pair. Shared by
 * the writer, the preservation check, and the synthesis `citationMap` slot so
 * the three can never drift apart.
 */
export function buildCompositeCitationMap(
  data: Pick<CompositePageData, 'memberEvidence'>,
): { citationMap: Map<string, number>; keys: string[] } {
  const mentions: EntityPageMention[] = [];
  const relationships: EntityPageRelationship[] = [];
  const claims: EntityPageClaim[] = [];
  const incomingRelationships: EntityPageIncomingRelationship[] = [];
  for (const group of data.memberEvidence) {
    mentions.push(...group.mentions);
    relationships.push(...group.relationships);
    claims.push(...group.claims);
    incomingRelationships.push(...group.incomingRelationships);
  }
  return buildCitationMap({ mentions, relationships, claims, incomingRelationships });
}

/**
 * Aggregate the frontmatter `sources` list over the unioned evidence: one
 * entry per source file with the unique page ranges joined (sorted).
 */
function buildCompositeFrontmatterSources(
  data: Pick<CompositePageData, 'memberEvidence'>,
): Array<{ file: string; pages: string }> {
  const sourceRanges = new Map<string, Set<string>>();
  const add = (file: string, pages: string): void => {
    const set = sourceRanges.get(file) ?? new Set<string>();
    set.add(pages);
    sourceRanges.set(file, set);
  };
  for (const group of data.memberEvidence) {
    for (const mention of group.mentions) {
      add(mention.source, mention.pages);
    }
    for (const rel of group.relationships) {
      add(rel.source, rel.pages);
    }
    for (const claim of group.claims) {
      add(claim.source, claim.pages);
    }
    for (const rel of group.incomingRelationships) {
      add(rel.source, rel.pages);
    }
  }
  return Array.from(sourceRanges.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, pagesSet]) => ({
      file,
      pages: Array.from(pagesSet).sort((x, y) => x.localeCompare(y)).join(', '),
    }));
}

/**
 * The complete deterministic composite-page frontmatter (vision `05` §2 +
 * phase doc §2.3), shared by `writeCompositePage` and the
 * `enforceCompositeFrontmatterInMarkdown` re-imposition: title,
 * `type: composite`, the ratified `class`, the members block (slug, title,
 * type, optional role/significance/disambiguation/aliases), the aliases union
 * (every member title + variant titles), wiki, real `updated`, the full
 * aggregated sources, and the member-type tags — in this field order.
 * `sparse` is NEVER emitted (composites are rich by construction).
 */
function buildCompositeFrontmatter(data: CompositePageData, updated: string): Record<string, unknown> {
  const tags = data.members
    .map((member) => member.type)
    .filter((tag, index, arr) => tag.trim().length > 0 && arr.indexOf(tag) === index);
  const aliases = combinedAliases(data.title, data.slug, data.aliases);
  return {
    title: escapeYamlString(data.title),
    type: 'composite',
    class: data.class,
    members: data.members.map((member) => ({
      slug: member.slug,
      title: member.title,
      type: member.type,
      ...(member.role !== undefined ? { role: member.role } : {}),
      ...(member.significance !== undefined ? { significance: member.significance } : {}),
      ...(member.disambiguation !== undefined ? { disambiguation: member.disambiguation } : {}),
      ...(member.aliases !== undefined && member.aliases.length > 0 ? { aliases: member.aliases } : {}),
    })),
    ...(aliases ? { aliases } : {}),
    wiki: data.wiki,
    updated,
    sources: buildCompositeFrontmatterSources(data),
    tags,
  };
}

/**
 * Link rendering inside a composite page: an EXTERNAL slug renders the
 * standard Obsidian pipe form; a FELLOW MEMBER renders as its plain title
 * (member pages do not exist — a self-link to the composite would be noise).
 */
function compositeWikilink(
  slug: string,
  memberSlugs: ReadonlySet<string>,
  slugToTitle: Record<string, string>,
): string {
  if (memberSlugs.has(slug)) {
    return slugToTitle[slug] ?? slug;
  }
  return formatWikilink(slug, slugToTitle[slug]);
}

/**
 * Render a composite page as a markdown string with YAML frontmatter (phase
 * doc §2.3 — the deterministic shell): the `## Members` block (each member's
 * name, type, role, significance), then the standard Layer 2 sections with
 * the evidence grouped per member (`### <Member Title>` subheadings), then
 * `## Sources` in basename form. Citation numbering is the unioned
 * `buildCompositeCitationMap` order.
 */
export function writeCompositePage(data: CompositePageData): string {
  const updated = new Date().toISOString();

  const { citationMap } = buildCompositeCitationMap(data);
  const getCitation = (file: string, pages: string): string => {
    const index = citationMap.get(sourceKey(file, pages));
    if (index === undefined) {
      throw new Error(`Citation map missing entry for ${file} pages ${pages}.`);
    }
    return `[^src${index}]`;
  };
  const memberSlugs = new Set(data.members.map((member) => member.slug));
  const titleOf = (slug: string): string =>
    data.members.find((member) => member.slug === slug)?.title ?? data.slugToTitle[slug] ?? slug;

  const lines: string[] = [];

  // Members block (phase doc §2.3: name, type, role, significance per member).
  lines.push('## Members', '');
  for (const member of data.members) {
    let line = `- **${member.title}** (\`${member.slug}\`) — ${member.type}`;
    if (member.role !== undefined) {
      line += ` · ${member.role}`;
    }
    if (member.significance !== undefined) {
      line += ` — ${member.significance}`;
    }
    if (member.disambiguation !== undefined) {
      line += ` — ${member.disambiguation}`;
    }
    lines.push(line);
  }
  lines.push('');

  // Layer 2: the standard sections, evidence grouped per member.
  if (data.memberEvidence.some((group) => group.mentions.length > 0)) {
    lines.push('## Mentions', '');
    for (const group of data.memberEvidence) {
      if (group.mentions.length === 0) {
        continue;
      }
      lines.push(`### ${titleOf(group.slug)}`, '');
      for (const mention of group.mentions) {
        lines.push(`- Page ${mention.page}: "${stripCitations(mention.context)}" ${getCitation(mention.source, mention.pages)}`);
      }
      lines.push('');
    }
  }

  if (data.memberEvidence.some((group) => group.relationships.length > 0 || group.incomingRelationships.length > 0)) {
    lines.push('## Relationships', '');
    for (const group of data.memberEvidence) {
      if (group.relationships.length === 0 && group.incomingRelationships.length === 0) {
        continue;
      }
      lines.push(`### ${titleOf(group.slug)}`, '');
      for (const rel of group.relationships) {
        lines.push(
          `- ${compositeWikilink(rel.object, memberSlugs, data.slugToTitle)} — ${readablePredicate(rel.predicate)} ${getCitation(rel.source, rel.pages)}`,
        );
      }
      for (const rel of group.incomingRelationships) {
        lines.push(
          `- ${compositeWikilink(rel.subject, memberSlugs, data.slugToTitle)} — ${readablePredicate(rel.predicate)} (incoming) — "${rel.evidence}" ${getCitation(rel.source, rel.pages)}`,
        );
      }
      lines.push('');
    }
  }

  if (data.memberEvidence.some((group) => group.claims.length > 0)) {
    lines.push('## Claims', '');
    for (const group of data.memberEvidence) {
      if (group.claims.length === 0) {
        continue;
      }
      lines.push(`### ${titleOf(group.slug)}`, '');
      for (const claim of group.claims) {
        const entityLinks = claim.entities
          .map((slug) => compositeWikilink(slug, memberSlugs, data.slugToTitle))
          .join(', ');
        lines.push(`- ${stripCitations(claim.text)} ${getCitation(claim.source, claim.pages)}${entityLinks ? ` (${entityLinks})` : ''}`);
      }
      lines.push('');
    }
  }

  // Sources (basename form — the citation checker resolves these).
  const definitionEntries = Array.from(citationMap.entries())
    .map(([key, index]) => ({ key, index }))
    .sort((a, b) => a.index - b.index);
  if (definitionEntries.length > 0) {
    lines.push('## Sources', '');
    for (const { key, index } of definitionEntries) {
      const [file, pages] = key.split('|');
      lines.push(`[^src${index}]: ${sourceFileName(file)}, pages ${pages}`);
    }
    lines.push('');
  }

  const body = `\n${lines.join('\n')}\n`;
  return matter.stringify(body, buildCompositeFrontmatter(data, updated));
}

/**
 * Phase 22 (the Phase 17 `enforceFrontmatterInMarkdown` precedent):
 * deterministic frontmatter re-imposition over a synthesized (LLM-written)
 * composite page — the COMPLETE frontmatter built from the page data (title,
 * `type: composite`, class, members block, aliases union, wiki, real
 * `updated`, aggregated sources, tags) written OVER the model's frontmatter,
 * CREATED when the model omitted the block entirely. The body is preserved
 * byte-for-byte; a page with unparseable model frontmatter is returned
 * unchanged (the schema validator already flags it).
 */
export function enforceCompositeFrontmatterInMarkdown(markdown: string, pageData: CompositePageData): string {
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
  return matter.stringify(body, buildCompositeFrontmatter(pageData, new Date().toISOString()));
}
