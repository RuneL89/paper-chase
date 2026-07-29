import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { callLLM } from '../llm/client';
import { appRoot } from '../utils/app-root';
import {
  applyLanguageDirective,
  buildLanguageDirective,
  type LanguageCode,
} from '../utils/language';
import {
  buildCitationMap,
  type EntityPageData,
  type EntityPageMention,
  type EntityPageRelationship,
  type EntityPageIncomingRelationship,
  type EntityPageClaim,
  type EntityPageTimelineEvent,
} from '../pages/entity-page';
import {
  buildCompositeCitationMap,
  type CompositeMember,
  type CompositePageData,
} from '../pages/composite-page';
import {
  buildComparisonCitationMap,
  type ComparisonPageData,
  type ComparisonTableSection,
} from '../pages/comparison-page';
import type { TopicPageData, TopicPageClaim } from '../pages/topic-page';

const PROMPT_DIR = join(appRoot(), 'prompts');
const promptCache: Record<string, string> = {};

/**
 * Phase 13 (output-token ceilings, vision `04` §6 + `07` §5, user-ratified
 * 2026-07-23): the shared synthesis-family output-token SAFETY CEILING, sized
 * above the largest legitimate output. It is never a length controller — the
 * model does not see the value, so a low ceiling yields truncated output,
 * never shorter output. No per-language split (ratified).
 * Phase 14 (phase doc §2.2): exported — the curation agent reuses this
 * ceiling for its decision lists (~300 topics run 5-8K output).
 */
export const SYNTHESIS_MAX_TOKENS = 32768;

async function loadPromptTemplate(fileName: string): Promise<string> {
  if (promptCache[fileName]) {
    return promptCache[fileName];
  }
  const promptPath = join(PROMPT_DIR, fileName);
  const template = await readFile(promptPath, 'utf-8');
  promptCache[fileName] = template;
  return template;
}

function fillPromptTemplate(template: string, values: Record<string, string>): string {
  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.split(`{${key}}`).join(value);
  }
  return output;
}

export function formatMentions(mentions: EntityPageMention[]): string {
  if (mentions.length === 0) {
    return '(none)';
  }
  return mentions
    .map(
      (mention) =>
        `- Page ${mention.page}: "${mention.context}" (source: ${mention.source}, pages ${mention.pages})`,
    )
    .join('\n');
}

export function formatRelationships(
  relationships: EntityPageRelationship[],
  incomingRelationships?: EntityPageIncomingRelationship[],
): string {
  const outgoing = relationships.map(
    (rel) =>
      `- Subject: ${rel.subject}\n  Predicate: ${rel.predicate}\n  Object: ${rel.object}\n  Evidence: "${rel.evidence}"\n  Page: ${rel.page}\n  Source: ${rel.source}, pages ${rel.pages}`,
  );
  // Phase 17 (B10, vision `02` §4.3 B): the incoming direction is presented
  // alongside the outgoing one with clear direction labels, so the model
  // knows this entity is the OBJECT of those relationships (and may say so
  // in Layer 1 when the evidence supports it). With no incoming records the
  // output is byte-identical to pre-Phase-17.
  const incoming = (incomingRelationships ?? []).map(
    (rel) =>
      `- Subject: ${rel.subject}\n  Predicate: ${rel.predicate}\n  Object: (this entity)\n  Evidence: "${rel.evidence}"\n  Page: ${rel.page}\n  Source: ${rel.source}, pages ${rel.pages}`,
  );
  if (outgoing.length === 0 && incoming.length === 0) {
    return '(none)';
  }
  if (incoming.length === 0) {
    return outgoing.join('\n');
  }
  if (outgoing.length === 0) {
    return `Incoming (this entity is the OBJECT of these relationships):\n${incoming.join('\n')}`;
  }
  return `Outgoing (this entity is the SUBJECT of these relationships):\n${outgoing.join('\n')}\n\nIncoming (this entity is the OBJECT of these relationships):\n${incoming.join('\n')}`;
}

export function formatClaims(
  claims: Array<{
    text: string;
    type: string;
    entities: string[];
    page: number;
    source: string;
    pages: string;
  }>,
): string {
  if (claims.length === 0) {
    return '(none)';
  }
  return claims
    .map((claim) => {
      const entityList = claim.entities.length > 0 ? ` (${claim.entities.join(', ')})` : '';
      return `- ${claim.text}${entityList}\n  Type: ${claim.type}\n  Page: ${claim.page}\n  Source: ${claim.source}, pages ${claim.pages}`;
    })
    .join('\n');
}

export function formatTimeline(timeline: EntityPageTimelineEvent[] | undefined): string {
  if (!timeline || timeline.length === 0) {
    return '(none)';
  }
  return timeline
    .map((event) => {
      const entityList = event.entities.length > 0 ? ` (${event.entities.join(', ')})` : '';
      return `- ${event.date}: ${event.event}${entityList}`;
    })
    .join('\n');
}

export function formatTopicEntities(entities: string[]): string {
  if (entities.length === 0) {
    return '(none)';
  }
  return entities.map((entity) => `- ${entity}`).join('\n');
}

/**
 * Phase 17 (B12a, vision `02` §2 + §4.2 C): one legal wikilink target for
 * the entity synthesis prompts.
 */
export interface RelatedEntity {
  slug: string;
  title: string;
}

/**
 * Phase 17 (B12a, vision `02` §2): the deterministic, deduplicated, sorted
 * `{slug, title}` list an entity page may legally link to — every
 * relationship subject and object (both directions) plus every co-entity in
 * the page's claims, minus the page itself. Titles come from the page's
 * `slugToTitle` map (an unknown slug falls back to the slug itself).
 */
export function buildRelatedEntities(entityData: EntityPageData): RelatedEntity[] {
  const slugs = new Set<string>();
  const add = (slug: string): void => {
    if (slug !== entityData.slug) {
      slugs.add(slug);
    }
  };
  for (const rel of entityData.relationships) {
    add(rel.subject);
    add(rel.object);
  }
  for (const rel of entityData.incomingRelationships ?? []) {
    add(rel.subject);
  }
  for (const claim of entityData.claims) {
    for (const entitySlug of claim.entities) {
      add(entitySlug);
    }
  }
  return Array.from(slugs)
    .sort((a, b) => a.localeCompare(b))
    .map((slug) => ({ slug, title: entityData.slugToTitle[slug] ?? slug }));
}

/**
 * The `relatedEntities` prompt slot: one `- <slug> — <Title>` line per legal
 * link target; the documented empty form is `(none)`.
 */
export function formatRelatedEntities(entities: RelatedEntity[]): string {
  if (entities.length === 0) {
    return '(none)';
  }
  return entities.map((entity) => `- ${entity.slug} — ${entity.title}`).join('\n');
}

export function formatTopicSources(
  sources: Array<{ file: string; pages: string; label?: string }>,
): string {
  if (sources.length === 0) {
    return '(none)';
  }
  return sources
    .map((source, index) => {
      const label = source.label ?? source.file.split('/').pop() ?? source.file;
      return `- [^src${index + 1}]: ${label}, pages ${source.pages}`;
    })
    .join('\n');
}

/** Basename of a workspace-relative source path (mirrors pages/entity-page.ts). */
function sourceFileName(file: string): string {
  return file.split('/').pop() ?? file;
}

/**
 * Phase 18 (B18, vision `06` §2/§7): the `citationMap` prompt slot — the
 * page's DETERMINISTIC citation map rendered exactly like the deterministic
 * `## Sources` rebuild (`[^srcN]: <basename>, pages <range>` lines in
 * assignment order), so the model's in-prose markers use the same keys the
 * written page's definitions will carry. The documented empty form is
 * `(none)`.
 */
export function formatCitationMap(citationMap: Map<string, number>): string {
  if (citationMap.size === 0) {
    return '(none)';
  }
  return Array.from(citationMap.entries())
    .map(([key, index]) => ({ key, index }))
    .sort((a, b) => a.index - b.index)
    .map(({ key, index }) => {
      const [file, pages] = key.split('|');
      return `[^src${index}]: ${sourceFileName(file)}, pages ${pages}`;
    })
    .join('\n');
}

function buildEntitySynthesisValues(entityData: EntityPageData): Record<string, string> {
  return {
    entityName: entityData.title,
    entityType: entityData.type,
    significance: entityData.significance ?? '(none provided)',
    disambiguation: entityData.disambiguation ?? '(none provided)',
    mentions: formatMentions(entityData.mentions),
    relationships: formatRelationships(entityData.relationships, entityData.incomingRelationships),
    claims: formatClaims(entityData.claims),
    timeline: formatTimeline(entityData.timeline),
    context: entityData.context ?? '(none provided)',
    // Phase 17 (B12a): the legal wikilink targets — the prompts' wikilink
    // rule requires targets to come from this list.
    relatedEntities: formatRelatedEntities(buildRelatedEntities(entityData)),
    // Phase 18 (B18): the deterministic citation map — the prompts' CITATION
    // KEYS rule requires in-prose markers to use exactly these keys, matching
    // the written page's rebuilt `## Sources` definitions.
    citationMap: formatCitationMap(buildCitationMap(entityData).citationMap),
  };
}

// ---------------------------------------------------------------------------
// Phase 22 (§2.3, the five-class rollup amendment): composite synthesis values
// ---------------------------------------------------------------------------

/**
 * The `members` prompt slot: one block per member (title, slug, type, the
 * class-derived role when present, significance, optional disambiguation and
 * aliases) — the composite's identity card.
 */
export function formatCompositeMembers(members: CompositeMember[]): string {
  return members
    .map((member) => {
      const lines = [`- ${member.title} (slug: ${member.slug})`, `  Type: ${member.type}`];
      if (member.role !== undefined) {
        lines.push(`  Role: ${member.role}`);
      }
      lines.push(`  Significance: ${member.significance ?? '(none provided)'}`);
      if (member.disambiguation !== undefined) {
        lines.push(`  Disambiguation: ${member.disambiguation}`);
      }
      if (member.aliases !== undefined && member.aliases.length > 0) {
        lines.push(`  Also known as: ${member.aliases.join(', ')}`);
      }
      return lines.join('\n');
    })
    .join('\n');
}

/**
 * The `memberEvidence` prompt slot: every member's evidence in the standard
 * Layer 2 shapes (mentions, relationships both directions, claims, timeline),
 * grouped per member with a `### <Title> (slug)` heading — Layer 2 of the
 * written page preserves every item verbatim, per member.
 */
export function formatCompositeMemberEvidence(data: CompositePageData): string {
  const titleOf = (slug: string): string =>
    data.members.find((member) => member.slug === slug)?.title ?? data.slugToTitle[slug] ?? slug;
  return data.memberEvidence
    .map((group) =>
      [
        `### ${titleOf(group.slug)} (${group.slug})`,
        '',
        'Mentions:',
        formatMentions(group.mentions),
        '',
        'Relationships:',
        formatRelationships(group.relationships, group.incomingRelationships),
        '',
        'Claims:',
        formatClaims(group.claims),
        '',
        'Timeline:',
        formatTimeline(group.timeline),
      ].join('\n'),
    )
    .join('\n\n');
}

/**
 * Phase 22 (the Phase 17 `buildRelatedEntities` rule, cluster-wide): the
 * deterministic, deduplicated, sorted `{slug, title}` list a composite page
 * may legally link to — every relationship subject/object (both directions)
 * and every claim co-entity across ALL members' evidence, minus the composite
 * itself and its own members (they are on the page, not link targets).
 */
export function buildCompositeRelatedEntities(compositeData: CompositePageData): RelatedEntity[] {
  const memberSlugs = new Set(compositeData.members.map((member) => member.slug));
  const slugs = new Set<string>();
  const add = (slug: string): void => {
    if (slug !== compositeData.slug && !memberSlugs.has(slug)) {
      slugs.add(slug);
    }
  };
  for (const group of compositeData.memberEvidence) {
    for (const rel of group.relationships) {
      add(rel.subject);
      add(rel.object);
    }
    for (const rel of group.incomingRelationships) {
      add(rel.subject);
    }
    for (const claim of group.claims) {
      for (const entitySlug of claim.entities) {
        add(entitySlug);
      }
    }
  }
  return Array.from(slugs)
    .sort((a, b) => a.localeCompare(b))
    .map((slug) => ({ slug, title: compositeData.slugToTitle[slug] ?? slug }));
}

function buildCompositeSynthesisValues(compositeData: CompositePageData): Record<string, string> {
  return {
    compositeTitle: compositeData.title,
    compositeClass: String(compositeData.class),
    members: formatCompositeMembers(compositeData.members),
    memberEvidence: formatCompositeMemberEvidence(compositeData),
    context: compositeData.context ?? '(none provided)',
    // Phase 17 (B12a): the legal wikilink targets — the prompts' wikilink
    // rule requires targets to come from this list.
    relatedEntities: formatRelatedEntities(buildCompositeRelatedEntities(compositeData)),
    // Phase 18 (B18): the deterministic citation map over the UNIONED member
    // evidence — the CITATION KEYS rule's authoritative keys.
    citationMap: formatCitationMap(buildCompositeCitationMap(compositeData).citationMap),
  };
}

function buildTopicSynthesisValues(topicData: TopicPageData): Record<string, string> {  const entities = topicData.entities ??
    Array.from(
      new Set(
        topicData.claims.flatMap((claim) =>
          claim.entities.map((slug) => topicData.slugToTitle[slug] ?? slug),
        ),
      ),
    ).sort();

  const sourceMap = new Map<string, { file: string; pages: string }>();
  for (const claim of topicData.claims) {
    const key = `${claim.source}|${claim.pages}`;
    if (!sourceMap.has(key)) {
      sourceMap.set(key, { file: claim.source, pages: claim.pages });
    }
  }
  const sources = Array.from(sourceMap.values()).sort((a, b) => a.file.localeCompare(b.file));

  return {
    topicName: topicData.title,
    entities: formatTopicEntities(entities),
    claims: formatClaims(topicData.claims),
    sources: formatTopicSources(sources),
    context: topicData.context ?? '(none provided)',
    // Phase 18 (B18): the deterministic citation map over the topic's claims
    // (first-appearance order, matching writeTopicPage and the write points'
    // `## Sources` rebuild) — the CITATION KEYS rule's authoritative keys.
    citationMap: formatCitationMap(
      buildCitationMap({ mentions: [], relationships: [], claims: topicData.claims }).citationMap,
    ),
  };
}

// ---------------------------------------------------------------------------
// Phase 23 (§2.3, backlog B21 — comparison-table articles): comparison values
// ---------------------------------------------------------------------------

/**
 * The `tables` prompt slot: one dated block per source table — its exact
 * `## Table: <source>, p. <page>` heading, dimensions line, the
 * extractor-reconstructed markdown (row labels and values the PDF's own),
 * the section's entity slugs, and its summary — so the model can analyze
 * ACROSS the sections and reproduce each section exactly once in Layer 2.
 */
export function formatComparisonTables(tables: ComparisonTableSection[]): string {
  return tables
    .map((table) => {
      const lines = [`## Table: ${sourceFileName(table.source)}, p. ${table.page}`, ''];
      if (table.rowDimension !== '' || table.colDimension !== '') {
        lines.push(
          `Rows compare: ${table.rowDimension !== '' ? table.rowDimension : '(not recorded)'} · Columns show: ${table.colDimension !== '' ? table.colDimension : '(not recorded)'}`,
          '',
        );
      }
      lines.push(table.markdown, '');
      if (table.entities.length > 0) {
        lines.push(`Entities: ${table.entities.join(', ')}`, '');
      }
      lines.push(`Summary: ${table.summary !== '' ? table.summary : '(not recorded)'}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

/**
 * Phase 23 (the Phase 17 `buildRelatedEntities` rule): the deterministic,
 * deduplicated, sorted `{slug, title}` list a comparison page may legally
 * link to — every entity appearing in any table section plus every shared
 * entity on the prose-bridge claims, minus the page's own subject (it is on
 * the page, not a link target).
 */
export function buildComparisonRelatedEntities(comparisonData: ComparisonPageData): RelatedEntity[] {
  const slugs = new Set<string>();
  const add = (slug: string): void => {
    if (slug !== comparisonData.slug) {
      slugs.add(slug);
    }
  };
  for (const table of comparisonData.tables) {
    for (const entitySlug of table.entities) {
      add(entitySlug);
    }
  }
  for (const entry of comparisonData.bridge) {
    for (const entitySlug of entry.entities) {
      add(entitySlug);
    }
  }
  return Array.from(slugs)
    .sort((a, b) => a.localeCompare(b))
    .map((slug) => ({ slug, title: comparisonData.slugToTitle[slug] ?? slug }));
}

function buildComparisonSynthesisValues(comparisonData: ComparisonPageData): Record<string, string> {
  return {
    comparisonTitle: comparisonData.title,
    tables: formatComparisonTables(comparisonData.tables),
    // Phase 17 (B12a): the legal wikilink targets — the prompt's wikilink
    // rule requires targets to come from this list.
    relatedEntities: formatRelatedEntities(buildComparisonRelatedEntities(comparisonData)),
    // Phase 18 (B18): the deterministic citation map over the dated table
    // sections and the bridge claims — the CITATION KEYS rule's authoritative
    // keys, matching the written page's rebuilt `## Sources` definitions.
    citationMap: formatCitationMap(buildComparisonCitationMap(comparisonData).citationMap),
  };
}

/** Phase 7: the run's input/output languages (vision `04` §9); absent → en/en. */
export interface SynthesisLanguage {
  input: LanguageCode;
  output: LanguageCode;
}

function buildSynthesisPrompt(
  values: Record<string, string>,
  agentsMd: string,
  promptFile: string,
  language?: SynthesisLanguage,
): Promise<string> {
  return (async () => {
    const template = await loadPromptTemplate(promptFile);
    const filled = fillPromptTemplate(template, values);
    const prompt = applyLanguageDirective(
      filled,
      buildLanguageDirective('synthesis', language?.input ?? 'en', language?.output ?? 'en'),
    );
    return `${prompt}\n\n=== WIKI CONSTITUTION ===\n${agentsMd.trim().length > 0 ? agentsMd : '(No AGENTS.md provided.)'}\n\nAll citations, page structure, and writing rules above must follow this constitution.`;
  })();
}

/**
 * Write a synthesized two-layer markdown article for an entity.
 *
 * Reads the Phase 5 synthesis prompt, injects the entity data and the wiki
 * constitution, and calls the LLM. Returns the raw markdown string.
 *
 * Phase 12 (feedback-retry amendment, vision `04` §6): the optional trailing
 * `feedback` carries the composed correction block from the preservation
 * check's exact dropped items; when present it is appended to the prompt as a
 * clearly delimited trailing section. When absent the prompt is byte-identical
 * to the pre-Phase-12 prompt. `attempt` numbers the llm-calls.json context
 * (`<slug>#attempt<N>`) on repairs.
 */
export async function writeEntitySynthesis(
  entityData: EntityPageData,
  agentsMd: string,
  logPath?: string,
  language?: SynthesisLanguage,
  feedback?: string,
  attempt?: number,
): Promise<string> {
  const fullPrompt = await buildSynthesisPrompt(
    buildEntitySynthesisValues(entityData),
    agentsMd,
    'synthesis.prompt.txt',
    language,
  );
  return callLLM(feedback === undefined ? fullPrompt : `${fullPrompt}\n\n${feedback}`, undefined, {
    maxTokens: SYNTHESIS_MAX_TOKENS,
    maxRetries: 2,
    callType: 'synthesis',
    context: attempt !== undefined && attempt > 1 ? `${entityData.slug}#attempt${attempt}` : entityData.slug,
    logPath,
  });
}

/**
 * Write a permissive hybrid synthesis for a dense entity.
 *
 * The LLM is allowed to summarize in Layer 1, but must preserve the exact
 * mention contexts, relationship evidence, and claim text in Layer 2. This is
 * used as a fallback when strict synthesis fails the preservation check.
 */
export async function writePermissiveEntitySynthesis(
  entityData: EntityPageData,
  agentsMd: string,
  logPath?: string,
  language?: SynthesisLanguage,
  feedback?: string,
  attempt?: number,
): Promise<string> {
  const fullPrompt = await buildSynthesisPrompt(
    buildEntitySynthesisValues(entityData),
    agentsMd,
    'synthesis-permissive.prompt.txt',
    language,
  );
  return callLLM(feedback === undefined ? fullPrompt : `${fullPrompt}\n\n${feedback}`, undefined, {
    maxTokens: SYNTHESIS_MAX_TOKENS,
    maxRetries: 2,
    callType: 'permissive-synthesis',
    context: attempt !== undefined && attempt > 1 ? `${entityData.slug}#attempt${attempt}` : entityData.slug,
    logPath,
  });
}

/**
 * Write a synthesized two-layer markdown article for a topic.
 */
export async function writeTopicSynthesis(
  topicData: TopicPageData,
  agentsMd: string,
  logPath?: string,
  language?: SynthesisLanguage,
  feedback?: string,
  attempt?: number,
): Promise<string> {
  const fullPrompt = await buildSynthesisPrompt(
    buildTopicSynthesisValues(topicData),
    agentsMd,
    'synthesis-topic.prompt.txt',
    language,
  );
  return callLLM(feedback === undefined ? fullPrompt : `${fullPrompt}\n\n${feedback}`, undefined, {
    maxTokens: SYNTHESIS_MAX_TOKENS,
    maxRetries: 2,
    callType: 'topic-synthesis',
    context: attempt !== undefined && attempt > 1 ? `${topicData.slug}#attempt${attempt}` : topicData.slug,
    logPath,
  });
}

/**
 * Write a permissive hybrid synthesis for a dense topic.
 */
export async function writePermissiveTopicSynthesis(
  topicData: TopicPageData,
  agentsMd: string,
  logPath?: string,
  language?: SynthesisLanguage,
  feedback?: string,
  attempt?: number,
): Promise<string> {
  const fullPrompt = await buildSynthesisPrompt(
    buildTopicSynthesisValues(topicData),
    agentsMd,
    'synthesis-topic-permissive.prompt.txt',
    language,
  );
  return callLLM(feedback === undefined ? fullPrompt : `${fullPrompt}\n\n${feedback}`, undefined, {
    maxTokens: SYNTHESIS_MAX_TOKENS,
    maxRetries: 2,
    callType: 'permissive-topic-synthesis',
    context: attempt !== undefined && attempt > 1 ? `${topicData.slug}#attempt${attempt}` : topicData.slug,
    logPath,
  });
}

/**
 * Phase 22 (§2.3, the five-class rollup amendment): write a synthesized
 * two-layer markdown article for a COMPOSITE page. Layer 1 is ONE rich
 * article weaving the members into a single story; Layer 2 preserves every
 * member's evidence verbatim, grouped per member. Same prompt-builder,
 * ceiling, retry, and logging contract as the entity writer. `sparse` never
 * applies (composites are rich by construction).
 */
export async function writeCompositeSynthesis(
  compositeData: CompositePageData,
  agentsMd: string,
  logPath?: string,
  language?: SynthesisLanguage,
  feedback?: string,
  attempt?: number,
): Promise<string> {
  const fullPrompt = await buildSynthesisPrompt(
    buildCompositeSynthesisValues(compositeData),
    agentsMd,
    'composite.prompt.txt',
    language,
  );
  return callLLM(feedback === undefined ? fullPrompt : `${fullPrompt}\n\n${feedback}`, undefined, {
    maxTokens: SYNTHESIS_MAX_TOKENS,
    maxRetries: 2,
    callType: 'synthesis',
    context: attempt !== undefined && attempt > 1 ? `${compositeData.slug}#attempt${attempt}` : compositeData.slug,
    logPath,
  });
}

/**
 * Phase 22 (§2.3): the permissive composite fallback — Layer 1 may summarize,
 * Layer 2 preserves every member's evidence verbatim per member.
 */
export async function writePermissiveCompositeSynthesis(
  compositeData: CompositePageData,
  agentsMd: string,
  logPath?: string,
  language?: SynthesisLanguage,
  feedback?: string,
  attempt?: number,
): Promise<string> {
  const fullPrompt = await buildSynthesisPrompt(
    buildCompositeSynthesisValues(compositeData),
    agentsMd,
    'composite-permissive.prompt.txt',
    language,
  );
  return callLLM(feedback === undefined ? fullPrompt : `${fullPrompt}\n\n${feedback}`, undefined, {
    maxTokens: SYNTHESIS_MAX_TOKENS,
    maxRetries: 2,
    callType: 'permissive-synthesis',
    context: attempt !== undefined && attempt > 1 ? `${compositeData.slug}#attempt${attempt}` : compositeData.slug,
    logPath,
  });
}

/**
 * Phase 23 (§2.3, backlog B21): write a synthesized two-layer markdown
 * article for a COMPARISON page. Layer 1 is the generic comparison analysis
 * (leaders and trailers, targets met and missed, trends ACROSS the dated
 * table sections, outliers — never corpus-specific); Layer 2 reproduces each
 * dated table section exactly once with every row label and value intact.
 * Same prompt-builder, ceiling, retry, and logging contract as the other
 * writers. `sparse` never applies.
 */
export async function writeComparisonSynthesis(
  comparisonData: ComparisonPageData,
  agentsMd: string,
  logPath?: string,
  language?: SynthesisLanguage,
  feedback?: string,
  attempt?: number,
): Promise<string> {
  const fullPrompt = await buildSynthesisPrompt(
    buildComparisonSynthesisValues(comparisonData),
    agentsMd,
    'comparison.prompt.txt',
    language,
  );
  return callLLM(feedback === undefined ? fullPrompt : `${fullPrompt}\n\n${feedback}`, undefined, {
    maxTokens: SYNTHESIS_MAX_TOKENS,
    maxRetries: 2,
    callType: 'synthesis',
    context: attempt !== undefined && attempt > 1 ? `${comparisonData.slug}#attempt${attempt}` : comparisonData.slug,
    logPath,
  });
}

/**
 * Phase 23 (§2.3): the permissive comparison fallback. The phase doc's file
 * list sanctions ONE comparison prompt — its Layer-2 contract is already the
 * row-value preservation contract, so the permissive leg reuses
 * `comparison.prompt.txt` (a second bounded-retry round with the same
 * values; the permissive/strict distinction for comparisons is how many
 * retry rounds run before the deterministic shell is kept). Distinct
 * `permissive-synthesis` callType keeps the report/routing vocabulary.
 */
export async function writePermissiveComparisonSynthesis(
  comparisonData: ComparisonPageData,
  agentsMd: string,
  logPath?: string,
  language?: SynthesisLanguage,
  feedback?: string,
  attempt?: number,
): Promise<string> {
  const fullPrompt = await buildSynthesisPrompt(
    buildComparisonSynthesisValues(comparisonData),
    agentsMd,
    'comparison.prompt.txt',
    language,
  );
  return callLLM(feedback === undefined ? fullPrompt : `${fullPrompt}\n\n${feedback}`, undefined, {
    maxTokens: SYNTHESIS_MAX_TOKENS,
    maxRetries: 2,
    callType: 'permissive-synthesis',
    context: attempt !== undefined && attempt > 1 ? `${comparisonData.slug}#attempt${attempt}` : comparisonData.slug,
    logPath,
  });
}
