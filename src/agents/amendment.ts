import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { callLLM } from '../llm/client';
import { appRoot } from '../utils/app-root';
import {
  applyLanguageDirective,
  buildLanguageDirective,
  type LanguageCode,
} from '../utils/language';
import { buildCitationMap, type EntityPageData } from '../pages/entity-page';
import { buildCompositeCitationMap, type CompositePageData } from '../pages/composite-page';
import { buildComparisonCitationMap, type ComparisonPageData } from '../pages/comparison-page';
import type { TopicPageData } from '../pages/topic-page';
import {
  SYNTHESIS_MAX_TOKENS,
  formatRelatedEntities,
  buildRelatedEntities,
  buildCompositeRelatedEntities,
  buildComparisonRelatedEntities,
  type RelatedEntity,
} from './synthesis';
import type { NewEvidenceDelta } from '../materializer';

/**
 * Phase 26 (§2.3; canon: vision `04` §1 per-PDF loop + §3.2 Step 9 amendment
 * synthesis + §4 amendment mode; `07` §3 patched-page preservation): the
 * AMENDMENT WRITER — the synthesis family's second mode. When a PDF's new
 * evidence changes an existing page's aggregate AND that page already carries
 * a successful synthesis, the page is NOT re-emitted in full: this writer
 * receives (a) the existing page content and (b) ONLY the new-evidence delta,
 * and emits a structured PATCH (`src/llm/patch.ts` parses/validates/applies
 * it). The LLM performs the semantic diff — deciding what is new, what is
 * already covered, and what contradicts existing text — because deterministic
 * text-diff cannot (near-synonymous restatements must be recognized as
 * duplicates, not additions).
 *
 * Routing: `callType: 'synthesis-amend'` resolved through the existing
 * SYNTHESIS slot (NO new Settings row); maxTokens stays the synthesis ceiling
 * (a safety cap, never a controller); temperature 0 (a mechanical diff-and-
 * patch task). Trailing `feedback`/`attempt` params exactly like the
 * synthesis writers — the reask loop lives in the caller (`ingest`), which
 * validates parse → patch schema → anchors → apply → merged-page
 * preservation, feeding the validator's exact errors back.
 *
 * Test seams: the ingest-level `amendmentFn` option replaces this whole
 * writer (the `synthesizeEntityFn` precedent); the agent-level
 * `options.callLLMFn` replaces only the transport (the disambiguation
 * precedent) — every phase-26 gate except the live 26.11 is LLM-free.
 */

/** The page kinds the Amendment Writer serves (mirrors the synthesis stages). */
export type AmendmentPageKind = 'entity' | 'topic' | 'composite' | 'comparison';

export interface AmendmentRequest {
  pageKind: AmendmentPageKind;
  pageTitle: string;
  pageSlug: string;
  /** The page's pre-materialize SYNTHESIZED content (frontmatter + body). */
  pageContent: string;
  /** The formatted new-evidence delta — every item verbatim, WITH its [^srcN] marker. */
  newEvidence: string;
  /** The exact legal citation keys (formatted lines; the full deterministic map). */
  citationKeys: string;
  /** The legal wikilink targets (formatted `slug — title` lines). */
  relatedEntities: string;
}

export interface AmendmentCallOptions {
  /** Wiki constitution appended to the prompt (matches the other agents). */
  agentsMd: string;
  /** Run language pair for the {languageDirective} fill; absent → en/en. */
  language?: { input: LanguageCode; output: LanguageCode };
  /** `.state/llm-calls.json` path — every call is logged. */
  logPath?: string;
  /**
   * Test-only transport seam (the disambiguation `callLLMFn` precedent):
   * replaces only the LLM call, keeping the prompt construction and the
   * reask loop live. Defaults to callLLM.
   */
  callLLMFn?: (
    prompt: string,
    options: {
      maxTokens: number;
      temperature: number;
      maxRetries: number;
      callType: string;
      context?: string;
      logPath?: string;
    },
  ) => Promise<string>;
}

const PROMPT_FILE = 'amendment.prompt.txt';

let promptTemplate: string | null = null;

async function loadPromptTemplate(): Promise<string> {
  if (promptTemplate !== null) {
    return promptTemplate;
  }
  promptTemplate = await readFile(join(appRoot(), 'prompts', PROMPT_FILE), 'utf-8');
  return promptTemplate;
}

function fillPromptTemplate(template: string, values: Record<string, string>): string {
  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.split(`{${key}}`).join(value);
  }
  return output;
}

// ---------------------------------------------------------------------------
// Request building (deterministic formatting of the delta + citation keys)
// ---------------------------------------------------------------------------

type CitationMapLike = Map<string, number>;

/** `[^srcN]` for a source+pages pair from the page's deterministic map. */
function markerFor(map: CitationMapLike, source: string, pages: string): string {
  const index = map.get(`${source}|${pages}`);
  return index === undefined ? '' : `[^src${index}]`;
}

/** The `citationKeys` prompt slot: the map rendered like the synthesis slots. */
function formatCitationKeys(map: CitationMapLike): string {
  if (map.size === 0) {
    return '(none)';
  }
  return Array.from(map.entries())
    .map(([key, index]) => ({ key, index }))
    .sort((a, b) => a.index - b.index)
    .map(({ key, index }) => {
      const [file, pages] = key.split('|');
      const base = file.split('/').pop() ?? file;
      return `[^src${index}]: ${base}, pages ${pages}`;
    })
    .join('\n');
}

function formatNewMentions(
  delta: NewEvidenceDelta,
  map: CitationMapLike,
  out: string[],
): void {
  if (delta.mentions.length === 0) {
    return;
  }
  out.push('New mentions:');
  for (const mention of delta.mentions) {
    out.push(`- Page ${mention.page}: "${mention.context}" ${markerFor(map, mention.source, mention.pages)}`);
  }
  out.push('');
}

function formatNewRelationships(
  delta: NewEvidenceDelta,
  map: CitationMapLike,
  out: string[],
): void {
  if (delta.relationships.length > 0) {
    out.push('New relationships (this entity is the SUBJECT):');
    for (const rel of delta.relationships) {
      out.push(
        `- ${rel.subject} — ${rel.predicate} — ${rel.object}: "${rel.evidence}" ${markerFor(map, rel.source, rel.pages)}`,
      );
    }
    out.push('');
  }
  if (delta.incomingRelationships.length > 0) {
    out.push('New relationships (this entity is the OBJECT):');
    for (const rel of delta.incomingRelationships) {
      out.push(
        `- ${rel.subject} — ${rel.predicate} (incoming): "${rel.evidence}" ${markerFor(map, rel.source, rel.pages)}`,
      );
    }
    out.push('');
  }
}

function formatNewClaims(delta: NewEvidenceDelta, map: CitationMapLike, out: string[]): void {
  if (delta.claims.length === 0) {
    return;
  }
  out.push('New claims:');
  for (const claim of delta.claims) {
    const entities = claim.entities.length > 0 ? ` (${claim.entities.join(', ')})` : '';
    out.push(`- ${claim.text}${entities} ${markerFor(map, claim.source, claim.pages)}`);
  }
  out.push('');
}

function formatNewTimeline(delta: NewEvidenceDelta, out: string[]): void {
  if (delta.timeline.length === 0) {
    return;
  }
  out.push('New timeline events:');
  for (const event of delta.timeline) {
    const entities = event.entities.length > 0 ? ` (${event.entities.join(', ')})` : '';
    out.push(`- ${event.date}: ${event.event}${entities}`);
  }
  out.push('');
}

/**
 * Build the Amendment Writer request for one page: the delta formatted with
 * its citation markers, the deterministic citation keys (the FULL map — old
 * and new keys alike: the merged `## Sources` section is rebuilt from it,
 * and a `flag-contradiction` cites the OLDER side's key too), and the legal
 * wikilink targets.
 */
export function buildAmendmentRequest(args: {
  pageData: EntityPageData | TopicPageData | CompositePageData | ComparisonPageData;
  delta: NewEvidenceDelta;
  pageContent: string;
}): AmendmentRequest {
  const { pageData, delta, pageContent } = args;
  const out: string[] = [];
  let citationMap: CitationMapLike;
  let related: RelatedEntity[];
  if (delta.kind === 'composite') {
    const composite = pageData as CompositePageData;
    citationMap = buildCompositeCitationMap(composite).citationMap;
    related = buildCompositeRelatedEntities(composite);
    for (const member of delta.members) {
      const count =
        member.mentions.length +
        member.relationships.length +
        member.incomingRelationships.length +
        member.claims.length +
        member.timeline.length;
      if (count === 0) {
        continue;
      }
      out.push(`### New evidence for member: ${member.title} (${member.slug})`, '');
      formatNewMentions(
        {
          ...delta,
          mentions: member.mentions,
          relationships: member.relationships,
          incomingRelationships: member.incomingRelationships,
          claims: member.claims,
          timeline: member.timeline,
        },
        citationMap,
        out,
      );
      formatNewRelationships(
        {
          ...delta,
          mentions: [],
          relationships: member.relationships,
          incomingRelationships: member.incomingRelationships,
          claims: [],
          timeline: [],
        },
        citationMap,
        out,
      );
      formatNewClaims(
        { ...delta, claims: member.claims, mentions: [], relationships: [], incomingRelationships: [], timeline: [] },
        citationMap,
        out,
      );
      formatNewTimeline(
        { ...delta, timeline: member.timeline, mentions: [], relationships: [], incomingRelationships: [], claims: [] },
        out,
      );
    }
  } else if (delta.kind === 'comparison') {
    const comparison = pageData as ComparisonPageData;
    citationMap = buildComparisonCitationMap(comparison).citationMap;
    related = buildComparisonRelatedEntities(comparison);
    if (delta.tables.length > 0) {
      out.push('New dated table sections (reproduce each verbatim under its exact heading):');
      for (const table of delta.tables) {
        const base = table.source.split('/').pop() ?? table.source;
        out.push(
          `## Table: ${base}, p. ${table.page}`,
          '',
          table.markdown,
          `Summary: ${table.summary !== '' ? table.summary : '(not recorded)'} ${markerFor(citationMap, table.source, String(table.page))}`,
          '',
        );
      }
    }
    if (delta.bridge.length > 0) {
      out.push('New prose-bridge entries (claims sharing the table entities):');
      for (const entry of delta.bridge) {
        out.push(`- ${entry.text} (topic: ${entry.topicSlug}) ${markerFor(citationMap, entry.source, entry.pages)}`);
      }
      out.push('');
    }
  } else if (delta.kind === 'entity') {
    const entity = pageData as EntityPageData;
    citationMap = buildCitationMap(entity).citationMap;
    related = buildRelatedEntities(entity);
    formatNewMentions(delta, citationMap, out);
    formatNewRelationships(delta, citationMap, out);
    formatNewClaims(delta, citationMap, out);
    formatNewTimeline(delta, out);
  } else {
    const topic = pageData as TopicPageData;
    citationMap = buildCitationMap({ mentions: [], relationships: [], claims: topic.claims }).citationMap;
    related = [];
    formatNewClaims(delta, citationMap, out);
  }
  return {
    pageKind: delta.kind,
    pageTitle: pageData.title,
    pageSlug: pageData.slug,
    pageContent,
    newEvidence: out.join('\n').trim(),
    citationKeys: formatCitationKeys(citationMap),
    relatedEntities: formatRelatedEntities(related),
  };
}

// ---------------------------------------------------------------------------
// The writer call
// ---------------------------------------------------------------------------

/**
 * Emit a structured patch for one page: prompt (existing page + new evidence
 * + citation keys + related entities + the wiki constitution + the Phase 7
 * language directive) → LLM (`callType: 'synthesis-amend'`, synthesis slot,
 * temperature 0) → the raw patch JSON text. Validation, application, and the
 * merged-page preservation check live in the caller. Signature mirrors the
 * synthesis writers (trailing `feedback`/`attempt`); the transport seam
 * rides as the trailing `callLLMFn` (the disambiguation precedent).
 */
export async function writeAmendment(
  request: AmendmentRequest,
  agentsMd: string,
  logPath?: string,
  language?: { input: LanguageCode; output: LanguageCode },
  feedback?: string,
  attempt?: number,
  callLLMFn?: AmendmentCallOptions['callLLMFn'],
): Promise<string> {
  const template = await loadPromptTemplate();
  const filled = fillPromptTemplate(template, {
    pageKind: request.pageKind,
    pageTitle: request.pageTitle,
    pageSlug: request.pageSlug,
    pageContent: request.pageContent,
    newEvidence: request.newEvidence,
    citationKeys: request.citationKeys,
    relatedEntities: request.relatedEntities,
    agentsMd: agentsMd.trim().length > 0 ? agentsMd : '(No AGENTS.md provided.)',
  });
  const prompt = applyLanguageDirective(
    filled,
    buildLanguageDirective('synthesis', language?.input ?? 'en', language?.output ?? 'en'),
  );
  const fullPrompt = `${prompt}\n\n=== WIKI CONSTITUTION ===\n${agentsMd.trim().length > 0 ? agentsMd : '(No AGENTS.md provided.)'}\n\nAll citation, page structure, and writing rules above must follow this constitution.`;
  const callOptions = {
    maxTokens: SYNTHESIS_MAX_TOKENS,
    temperature: 0,
    maxRetries: 2,
    callType: 'synthesis-amend',
    context:
      attempt !== undefined && attempt > 1
        ? `amendment:${request.pageSlug}#attempt${attempt}`
        : `amendment:${request.pageSlug}`,
    logPath,
  };
  if (callLLMFn !== undefined) {
    return callLLMFn(
      feedback === undefined ? fullPrompt : `${fullPrompt}\n\n${feedback}`,
      callOptions,
    );
  }
  return callLLM(feedback === undefined ? fullPrompt : `${fullPrompt}\n\n${feedback}`, undefined, callOptions);
}
