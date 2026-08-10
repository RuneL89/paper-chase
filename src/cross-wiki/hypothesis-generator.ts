import { CROSS_WIKI_MAX_TOKENS, runCrossWikiJsonCall, type CrossWikiLanguage } from './llm';
import type { EntitySummary } from './entity-context-summarizer';
import type { RegistryEntry } from '../pages/cross-wiki/entity-registry-page';
import type { GraphEdge } from '../pages/cross-wiki/relationships-page';
import type { TopicCluster } from '../pages/cross-wiki/topic-cluster-page';
import { writeCrossWikiState } from './state';

/**
 * Phase 24 Component G (phase doc §2.7, user decisions 2026-08-09 #10/#11):
 * the Cross-Wiki Hypothesis Signal Generator. ONE batched mid-tier LLM call
 * per "signal batch" — a connected subgraph of the normalized relationship
 * graph that contains at least one cross-wiki entity and spans at least two
 * distinct wikis — returning RANKED, STRUCTURED hypothesis signals (never
 * narrative articles, never new factual claims). Written ONLY to
 * `.state/cross-wiki/proposed-signals.json` — never published as wiki pages.
 */

export interface HypothesisSignal {
  summary: string;
  type: string;
  confidence: 'high' | 'medium' | 'low';
  entities: string[];
  wikis: string[];
  evidence: Array<{ wiki: string; relationship?: string; topicCluster?: string }>;
}

export type GenerateSignalsFn = (
  batch: SignalBatch,
  feedback: string | undefined,
  attempt: number,
) => Promise<string>;

export interface GenerateSignalsOptions {
  workspace?: string;
  language?: CrossWikiLanguage;
  logPath?: string;
  generateSignalsFn?: GenerateSignalsFn;
  onProgress?: (message: string) => void;
}

/** One connected cross-wiki subgraph (the unit of one batched mid-tier call). */
export interface SignalBatch {
  entities: RegistryEntry[];
  relationships: GraphEdge[];
  topicClusters: TopicCluster[];
}

interface HypothesisOutput {
  hypotheses: HypothesisSignal[];
}

const CONFIDENCES = new Set(['high', 'medium', 'low']);

function validateHypothesisOutput(
  data: unknown,
  batchWikis: Set<string>,
): { valid: boolean; errors: string[]; value?: HypothesisOutput } {
  const errors: string[] = [];
  if (typeof data !== 'object' || data === null || !Array.isArray((data as Record<string, unknown>).hypotheses)) {
    return { valid: false, errors: ['output must be an object with a "hypotheses" array'] };
  }
  const hypotheses: HypothesisSignal[] = [];
  for (const [index, hypothesis] of ((data as Record<string, unknown>).hypotheses as unknown[]).entries()) {
    if (typeof hypothesis !== 'object' || hypothesis === null) {
      errors.push(`hypotheses[${index}]: not an object`);
      continue;
    }
    const h = hypothesis as Record<string, unknown>;
    if (typeof h.summary !== 'string' || h.summary.trim().length === 0) {
      errors.push(`hypotheses[${index}]: missing "summary"`);
      continue;
    }
    if (typeof h.type !== 'string' || h.type.trim().length === 0) {
      errors.push(`hypotheses[${index}]: missing "type"`);
      continue;
    }
    if (typeof h.confidence !== 'string' || !CONFIDENCES.has(h.confidence)) {
      errors.push(`hypotheses[${index}]: confidence must be "high", "medium", or "low"`);
      continue;
    }
    if (!Array.isArray(h.entities) || h.entities.length === 0 || !h.entities.every((e) => typeof e === 'string')) {
      errors.push(`hypotheses[${index}]: "entities" must be a non-empty list of slugs`);
      continue;
    }
    if (!Array.isArray(h.wikis) || h.wikis.length === 0 || !h.wikis.every((w) => typeof w === 'string')) {
      errors.push(`hypotheses[${index}]: "wikis" must be a non-empty list of wiki slugs`);
      continue;
    }
    // Grounding check (phase doc §2.7 constraint): every cited wiki must be a
    // wiki of this batch — a signal may not point outside the source artifacts.
    const badWiki = (h.wikis as string[]).find((wiki) => !batchWikis.has(wiki));
    if (badWiki !== undefined) {
      errors.push(`hypotheses[${index}]: wiki "${badWiki}" is not part of this subgraph`);
      continue;
    }
    const evidence: HypothesisSignal['evidence'] = [];
    let evidenceOk = true;
    if (!Array.isArray(h.evidence) || h.evidence.length === 0) {
      errors.push(`hypotheses[${index}]: "evidence" must be a non-empty list`);
      continue;
    }
    for (const entry of h.evidence as unknown[]) {
      if (typeof entry !== 'object' || entry === null || typeof (entry as Record<string, unknown>).wiki !== 'string') {
        errors.push(`hypotheses[${index}]: an evidence entry lacks a "wiki"`);
        evidenceOk = false;
        continue;
      }
      const e = entry as Record<string, unknown>;
      if (!batchWikis.has(e.wiki as string)) {
        errors.push(`hypotheses[${index}]: evidence wiki "${e.wiki}" is not part of this subgraph`);
        evidenceOk = false;
        continue;
      }
      evidence.push({
        wiki: e.wiki as string,
        ...(typeof e.relationship === 'string' ? { relationship: e.relationship } : {}),
        ...(typeof e.topicCluster === 'string' ? { topicCluster: e.topicCluster } : {}),
      });
    }
    if (!evidenceOk) {
      continue;
    }
    hypotheses.push({
      summary: h.summary.trim(),
      type: h.type.trim(),
      confidence: h.confidence as HypothesisSignal['confidence'],
      entities: (h.entities as string[]).slice(),
      wikis: (h.wikis as string[]).slice(),
      evidence,
    });
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, errors: [], value: { hypotheses } };
}

/**
 * Partition the relationship graph into connected cross-wiki subgraphs
 * (union-find over entity refs; edges connect their subject and object). A
 * batch qualifies when it contains ≥1 registry entity and spans ≥2 wikis.
 */
export function buildSignalBatches(registry: RegistryEntry[], edges: GraphEdge[], clusters: TopicCluster[]): SignalBatch[] {
  const nodeKey = (wiki: string, slug: string): string => `${wiki}/${slug}`;
  const parent = new Map<string, string>();
  const find = (key: string): string => {
    let root = key;
    while (parent.get(root) !== root) {
      root = parent.get(root) as string;
    }
    let current = key;
    while (parent.get(current) !== root) {
      const next = parent.get(current) as string;
      parent.set(current, root);
      current = next;
    }
    return root;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) {
      parent.set(rb, ra);
    }
  };
  const nodeWikis = new Map<string, string>();

  for (const edge of edges) {
    const subject = nodeKey(edge.subject.wiki, edge.subject.slug);
    if (!parent.has(subject)) {
      parent.set(subject, subject);
      nodeWikis.set(subject, edge.subject.wiki);
    }
    if (edge.object.wiki !== '') {
      const object = nodeKey(edge.object.wiki, edge.object.slug);
      if (!parent.has(object)) {
        parent.set(object, object);
        nodeWikis.set(object, edge.object.wiki);
      }
      union(subject, object);
    }
  }

  const componentEdges = new Map<string, GraphEdge[]>();
  const componentNodes = new Map<string, Set<string>>();
  for (const edge of edges) {
    const root = find(nodeKey(edge.subject.wiki, edge.subject.slug));
    componentEdges.set(root, [...(componentEdges.get(root) ?? []), edge]);
    const nodes = componentNodes.get(root) ?? new Set<string>();
    nodes.add(nodeKey(edge.subject.wiki, edge.subject.slug));
    if (edge.object.wiki !== '') {
      nodes.add(nodeKey(edge.object.wiki, edge.object.slug));
    }
    componentNodes.set(root, nodes);
  }

  const batches: SignalBatch[] = [];
  for (const [root, nodes] of componentNodes.entries()) {
    const entities = registry.filter((entry) =>
      entry.members.some((member) => nodes.has(nodeKey(member.wiki, member.slug))),
    );
    const wikis = new Set<string>();
    for (const node of nodes) {
      wikis.add(node.split('/')[0]);
    }
    if (entities.length === 0 || wikis.size < 2) {
      continue;
    }
    batches.push({
      entities,
      relationships: componentEdges.get(root) ?? [],
      topicClusters: clusters.filter((cluster) => cluster.mappedTopics.some((topic) => wikis.has(topic.wiki))),
    });
  }
  return batches.sort((a, b) => b.relationships.length - a.relationships.length);
}

function formatBatch(batch: SignalBatch, summaries: Record<string, EntitySummary>): { entities: string; relationships: string; topicClusters: string } {
  const entities = batch.entities
    .map((entry) =>
      JSON.stringify({
        canonicalTitle: entry.canonicalTitle,
        aliases: entry.aliases,
        members: entry.members.map((member) => ({
          wiki: member.wiki,
          slug: member.slug,
          summary: member.summary !== '' ? member.summary : summaries[member.path]?.summary ?? '',
        })),
      }),
    )
    .join('\n');
  const relationships = batch.relationships
    .map((edge) =>
      JSON.stringify({
        wiki: edge.sourceWiki,
        relationship: `${edge.subject.slug} → ${edge.predicate} → ${edge.object.slug}`,
        subjectWiki: edge.subject.wiki,
        objectWiki: edge.object.wiki,
      }),
    )
    .join('\n');
  const topicClusters = batch.topicClusters
    .map((cluster) =>
      JSON.stringify({
        clusterId: cluster.clusterId,
        title: cluster.title,
        wikis: Array.from(new Set(cluster.mappedTopics.map((topic) => topic.wiki))),
      }),
    )
    .join('\n');
  return {
    entities: entities || '(none)',
    relationships: relationships || '(none)',
    topicClusters: topicClusters || '(none)',
  };
}

/**
 * Generate hypothesis signals over the connected cross-wiki subgraphs and
 * write `.state/cross-wiki/proposed-signals.json`. A failed batch is skipped
 * with a warning — never aborts the pass. No qualifying subgraphs → an empty
 * signals file (deterministic).
 */
export async function generateHypothesisSignals(
  registry: RegistryEntry[],
  edges: GraphEdge[],
  clusters: TopicCluster[],
  summaries: Record<string, EntitySummary>,
  options: GenerateSignalsOptions = {},
): Promise<HypothesisSignal[]> {
  const workspace = options.workspace ?? '.';
  const batches = buildSignalBatches(registry, edges, clusters);
  const hypotheses: HypothesisSignal[] = [];

  for (const [index, batch] of batches.entries()) {
    const batchWikis = new Set<string>();
    for (const entry of batch.entities) {
      for (const member of entry.members) {
        batchWikis.add(member.wiki);
      }
    }
    for (const edge of batch.relationships) {
      batchWikis.add(edge.subject.wiki);
      if (edge.object.wiki !== '') {
        batchWikis.add(edge.object.wiki);
      }
    }
    const slots = formatBatch(batch, summaries);
    try {
      const outcome = await runCrossWikiJsonCall<HypothesisOutput>({
        promptFile: 'cross-wiki-hypothesis.prompt.txt',
        slots,
        callType: 'cross-wiki-hypothesis',
        context: `cross-wiki hypothesis signals (batch ${index + 1}/${batches.length})`,
        maxTokens: CROSS_WIKI_MAX_TOKENS,
        language: options.language,
        logPath: options.logPath,
        label: `cross-wiki hypothesis signals (batch ${index + 1})`,
        validate: (data) => validateHypothesisOutput(data, batchWikis),
        callLLMFn: options.generateSignalsFn
          ? (feedback, attempt) => options.generateSignalsFn!(batch, feedback, attempt)
          : undefined,
      });
      if (outcome.output !== null) {
        hypotheses.push(...outcome.output.hypotheses);
      }
    } catch (err) {
      options.onProgress?.(
        `Warning: cross-wiki hypothesis generation failed for batch ${index + 1} (${(err as Error).message}); the batch is skipped.`,
      );
    }
  }

  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  hypotheses.sort((a, b) => rank[a.confidence] - rank[b.confidence] || a.summary.localeCompare(b.summary));
  await writeCrossWikiState(options.workspace, 'proposed-signals.json', {
    generated: new Date().toISOString(),
    hypotheses,
  });
  return hypotheses;
}
