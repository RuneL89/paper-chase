import { callLLM } from '../llm/client';
import { runWithFeedbackRetry } from '../llm/reask';
import {
  CROSS_WIKI_MAX_ATTEMPTS,
  CROSS_WIKI_SMALL_MAX_TOKENS,
  renderCrossWikiPrompt,
  type CrossWikiLanguage,
} from './llm';
import { writeCrossWikiState } from './state';
import type { ScannedEntityPage } from './workspace-scan';

/**
 * Phase 24 Component E (phase doc §2.5, user decision 2026-08-09 #7/#14): the
 * Entity Context Summarizer. ONE cheap LLM call per entity page in the
 * workspace — every entity, not just cross-wiki candidates — producing a 1-2
 * sentence summary of who/what the entity is and its primary role(s). Stored
 * in `.state/cross-wiki/entity-summaries.json` keyed by path-qualified entity
 * slug; consumed by Component A's fuzzy matcher and uncertain-review sub-step
 * and mirrored per member in the entity registry JSON.
 *
 * A failed call (after the bounded retries) falls back to a deterministic
 * summary built from the page's own first paragraph — the pass never aborts.
 */

export interface EntitySummaryInput {
  /** Path-qualified entity id (e.g. 'acme/entities/people/john-smith'). */
  id: string;
  wiki: string;
  title: string;
  entityType: string;
  aliases: string[];
  firstParagraph: string;
  /** Key relationships rendered as 'subject — predicate — object' lines. */
  relationships: string[];
}

export interface EntitySummary {
  title: string;
  summary: string;
  type: string;
  /** '<source basename> pages <range>' entries from the page's frontmatter sources. */
  sources: string[];
}

/** Test-only seam (the `writeDoxIndexFn` precedent): returns the summary text. */
export type SummarizeEntityFn = (input: EntitySummaryInput, feedback?: string, attempt?: number) => Promise<string>;

export interface SummarizeEntitiesOptions {
  workspace?: string;
  language?: CrossWikiLanguage;
  logPath?: string;
  summarizeEntityFn?: SummarizeEntityFn;
  onProgress?: (message: string) => void;
}

function sourceLabel(file: string, pages: string): string {
  return `${file.split('/').pop() ?? file} pages ${pages}`;
}

/** Deterministic fallback summary: the first sentence of the page's own first paragraph. */
function deterministicSummary(page: ScannedEntityPage): string {
  const paragraph = page.firstParagraph.trim();
  if (paragraph.length === 0) {
    return page.entityType !== '' ? `${page.title} (${page.entityType}).` : `${page.title}.`;
  }
  const sentenceEnd = paragraph.search(/(?<=[.!?])\s/);
  const first = sentenceEnd === -1 ? paragraph : paragraph.slice(0, sentenceEnd);
  return first.length > 400 ? `${first.slice(0, 397)}...` : first;
}

function relationshipLine(page: ScannedEntityPage, rel: ScannedEntityPage['relationships'][number]): string {
  const other = rel.otherTitle ?? rel.otherSlug;
  return rel.direction === 'outgoing'
    ? `${page.title} — ${rel.predicate} — ${other}`
    : `${other} — ${rel.predicate} — ${page.title}`;
}

/** Default LLM implementation: one cheap call per entity page. */
async function summarizeEntityWithLlm(
  input: EntitySummaryInput,
  language: CrossWikiLanguage | undefined,
  logPath: string | undefined,
  feedback?: string,
  attempt?: number,
): Promise<string> {
  const prompt = await renderCrossWikiPrompt(
    'cross-wiki-entity-context.prompt.txt',
    {
      entityWiki: input.wiki,
      entityTitle: input.title,
      entityType: input.entityType !== '' ? input.entityType : '(not recorded)',
      entityAliases: input.aliases.length > 0 ? input.aliases.join('; ') : '(none)',
      firstParagraph: input.firstParagraph !== '' ? input.firstParagraph : '(no prose on the page)',
      relationships: input.relationships.length > 0 ? input.relationships.join('\n') : '(none)',
    },
    language,
  );
  return callLLM(feedback === undefined ? prompt : `${prompt}\n\n${feedback}`, undefined, {
    maxTokens: CROSS_WIKI_SMALL_MAX_TOKENS,
    maxRetries: 2,
    callType: 'cross-wiki-entity-context',
    context:
      attempt !== undefined && attempt > 1
        ? `cross-wiki entity context ${input.id}#attempt${attempt}`
        : `cross-wiki entity context ${input.id}`,
    logPath,
  });
}

/**
 * Summarize every supplied entity page and write
 * `.state/cross-wiki/entity-summaries.json`, keyed by path-qualified entity
 * slug (sorted). Per-page failures fall back to a deterministic summary with
 * a warning — the pass never aborts (phase doc §6 contract).
 */
export async function summarizeEntities(
  pages: ScannedEntityPage[],
  options: SummarizeEntitiesOptions = {},
): Promise<Record<string, EntitySummary>> {
  const summaries: Record<string, EntitySummary> = {};
  for (const page of pages) {
    const input: EntitySummaryInput = {
      id: page.id,
      wiki: page.wiki,
      title: page.title,
      entityType: page.entityType,
      aliases: page.aliases,
      firstParagraph: page.firstParagraph,
      relationships: page.relationships.slice(0, 5).map((rel) => relationshipLine(page, rel)),
    };
    const runLlm = options.summarizeEntityFn
      ? (feedback: string | null, attempt: number) => options.summarizeEntityFn!(input, feedback ?? undefined, attempt)
      : (feedback: string | null, attempt: number) =>
          summarizeEntityWithLlm(input, options.language, options.logPath, feedback ?? undefined, attempt);
    let summary: string | null = null;
    try {
      const outcome = await runWithFeedbackRetry<string>(
        runLlm,
        (raw) => {
          const text = raw.trim();
          return text.length > 0
            ? { valid: true, errors: [] }
            : { valid: false, errors: ['the summary was empty; return 1-2 sentences of plain text'] };
        },
        { maxAttempts: CROSS_WIKI_MAX_ATTEMPTS, label: `cross-wiki entity context ${page.id}` },
      );
      summary = outcome.output !== null ? outcome.output.trim() : null;
    } catch (err) {
      options.onProgress?.(
        `Warning: cross-wiki entity summary failed for ${page.id} (${(err as Error).message}); using the deterministic summary.`,
      );
    }
    if (summary === null) {
      summary = deterministicSummary(page);
    }
    summaries[page.id] = {
      title: page.title,
      summary,
      type: page.entityType,
      sources: page.sources.map((source) => sourceLabel(source.file, source.pages)),
    };
  }
  const sorted = Object.fromEntries(
    Object.entries(summaries).sort(([a], [b]) => a.localeCompare(b)),
  );
  await writeCrossWikiState(options.workspace, 'entity-summaries.json', sorted);
  return sorted;
}
