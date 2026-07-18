import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callLLM } from '../llm/client';
import type {
  EntityPageData,
  EntityPageMention,
  EntityPageRelationship,
  EntityPageClaim,
  EntityPageTimelineEvent,
} from '../pages/entity-page';
import type { TopicPageData, TopicPageClaim } from '../pages/topic-page';

const PROMPT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'prompts');
const promptCache: Record<string, string> = {};

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

export function formatRelationships(relationships: EntityPageRelationship[]): string {
  if (relationships.length === 0) {
    return '(none)';
  }
  return relationships
    .map(
      (rel) =>
        `- Subject: ${rel.subject}\n  Predicate: ${rel.predicate}\n  Object: ${rel.object}\n  Evidence: "${rel.evidence}"\n  Page: ${rel.page}\n  Source: ${rel.source}, pages ${rel.pages}`,
    )
    .join('\n');
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

function buildEntitySynthesisValues(entityData: EntityPageData): Record<string, string> {
  return {
    entityName: entityData.title,
    entityType: entityData.type,
    significance: entityData.significance ?? '(none provided)',
    disambiguation: entityData.disambiguation ?? '(none provided)',
    mentions: formatMentions(entityData.mentions),
    relationships: formatRelationships(entityData.relationships),
    claims: formatClaims(entityData.claims),
    timeline: formatTimeline(entityData.timeline),
    context: entityData.context ?? '(none provided)',
  };
}

function buildTopicSynthesisValues(topicData: TopicPageData): Record<string, string> {
  const entities = topicData.entities ??
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
  };
}

function buildSynthesisPrompt(
  values: Record<string, string>,
  agentsMd: string,
  promptFile: string,
): Promise<string> {
  return (async () => {
    const template = await loadPromptTemplate(promptFile);
    const prompt = fillPromptTemplate(template, values);
    return `${prompt}\n\n=== WIKI CONSTITUTION ===\n${agentsMd.trim().length > 0 ? agentsMd : '(No AGENTS.md provided.)'}\n\nAll citations, page structure, and writing rules above must follow this constitution.`;
  })();
}

/**
 * Write a synthesized two-layer markdown article for an entity.
 *
 * Reads the Phase 5 synthesis prompt, injects the entity data and the wiki
 * constitution, and calls the LLM. Returns the raw markdown string.
 */
export async function writeEntitySynthesis(
  entityData: EntityPageData,
  agentsMd: string,
  logPath?: string,
): Promise<string> {
  const fullPrompt = await buildSynthesisPrompt(
    buildEntitySynthesisValues(entityData),
    agentsMd,
    'synthesis.prompt.txt',
  );
  return callLLM(fullPrompt, undefined, {
    maxTokens: 8192,
    callType: 'synthesis',
    context: entityData.slug,
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
): Promise<string> {
  const fullPrompt = await buildSynthesisPrompt(
    buildEntitySynthesisValues(entityData),
    agentsMd,
    'synthesis-permissive.prompt.txt',
  );
  return callLLM(fullPrompt, undefined, {
    maxTokens: 8192,
    callType: 'permissive-synthesis',
    context: entityData.slug,
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
): Promise<string> {
  const fullPrompt = await buildSynthesisPrompt(
    buildTopicSynthesisValues(topicData),
    agentsMd,
    'synthesis-topic.prompt.txt',
  );
  return callLLM(fullPrompt, undefined, {
    maxTokens: 8192,
    callType: 'topic-synthesis',
    context: topicData.slug,
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
): Promise<string> {
  const fullPrompt = await buildSynthesisPrompt(
    buildTopicSynthesisValues(topicData),
    agentsMd,
    'synthesis-topic-permissive.prompt.txt',
  );
  return callLLM(fullPrompt, undefined, {
    maxTokens: 8192,
    callType: 'permissive-topic-synthesis',
    context: topicData.slug,
    logPath,
  });
}
