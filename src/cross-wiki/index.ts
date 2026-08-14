import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { updateWorkspaceCrossWikiSection } from '../dox-writer';
import {
  writeCrossWikiIndexPage,
  writeCrossWikiTopicsIndexPage,
} from '../pages/cross-wiki/cross-wiki-index-page';
import { checkCrossWikiLinks } from '../validation/link-checker';
import { validateCrossWikiSchema } from '../validation/cross-wiki-schema';
import {
  summarizeEntities,
  type EntitySummary,
  type SummarizeEntityFn,
} from './entity-context-summarizer';
import {
  resolveEntities,
  type EntityResolutionResult,
  type ResolveEntitiesOptions,
} from './entity-resolver';
import {
  generateHypothesisSignals,
  type GenerateSignalsFn,
} from './hypothesis-generator';
import { normalizePredicates, type NormalizePredicatesFn } from './predicate-normalizer';
import { buildRelationshipGraph } from './relationship-graph';
import {
  computeRunFingerprint,
  preflightDecision,
  relevanceProbe,
  writeRunFingerprint,
  type PreflightDecision,
  type RelevanceProbeFn,
} from './run-control';
import { clusterTopics, type ClusterTopicsFn } from './topic-clusterer';
import {
  firstParagraphOf,
  listWorkspaceWikis,
  scanEntityPages,
  scanTopicPages,
  CROSS_WIKI_FOLDER,
} from './workspace-scan';
import type { LanguageCode } from '../utils/language';
import { readFile } from 'node:fs/promises';
import matter from 'gray-matter';

/**
 * Phase 24 (phase doc §2.8, vision `04` §3.2 Step 10 amended 2026-08-09): the
 * Cross-Wiki Discovery pass — the workspace-level, post-DOX orchestrator for
 * Components A–G plus the run-control preflight and the Cross-Wiki DOX
 * Writer. It runs INSIDE ingest after Layer 5 (per-wiki DOX contracts and the
 * workspace index) and before the AGENTS.md Updater, only when the workspace
 * holds ≥2 wikis.
 *
 * Contract (phase doc §6): additive, read-only derived view — per-wiki
 * content pages are NEVER edited; failures are logged and do NOT abort the
 * ingest; uncertain matches are held for human review.
 */
export interface CrossWikiPassOptions {
  /** Workspace directory containing wikis/; defaults to '.'. */
  workspace?: string;
  /** The wiki whose ingest triggered this pass (log context + probe language). */
  wikiSlug: string;
  /** The run's language pair (drives the `{languageDirective}` fills). */
  language?: { input: LanguageCode; output: LanguageCode };
  /** JSON-lines LLM call log path (defaults to the triggering wiki's log). */
  logPath?: string;
  onProgress?: (message: string) => void;
  /**
   * Phase 24 (user-ratified extension 2026-08-14): bypass the deterministic
   * preflight and optional relevance probe. When true, Components A–G run as
   * long as the workspace holds ≥2 wikis. The fingerprint is still recorded at
   * the end so the next normal run can skip. Useful for curators who update
   * wikis one at a time and want fresh cross-wiki artifacts without deleting
   * `.state/cross-wiki/run-fingerprint.json`.
   */
  forceCrossWiki?: boolean;
  // Test-only seams (the `writeDoxIndexFn` precedent) — one per LLM component:
  summarizeEntityFn?: SummarizeEntityFn;
  matchEntitiesFn?: ResolveEntitiesOptions['matchEntitiesFn'];
  reviewUncertainFn?: ResolveEntitiesOptions['reviewUncertainFn'];
  normalizePredicatesFn?: NormalizePredicatesFn;
  clusterTopicsFn?: ClusterTopicsFn;
  generateSignalsFn?: GenerateSignalsFn;
  relevanceProbeFn?: RelevanceProbeFn;
}

export interface CrossWikiPassResult {
  /** True when the full pass ran (Components A–G + the DOX pass). */
  ran: boolean;
  /** 'completed' | skip/error reason. */
  reason: string;
  entities?: number;
  edges?: number;
  clusters?: number;
  signals?: number;
  uncertain?: number;
  error?: string;
}

/** Read a changed page's title + first paragraph for the relevance probe. */
async function changedPageSummary(workspace: string, path: string): Promise<{ path: string; title: string; summary: string }> {
  try {
    const parsed = matter(await readFile(join(workspace, 'wikis', path), 'utf-8'));
    const data = parsed.data as Record<string, unknown>;
    return {
      path,
      title: typeof data.title === 'string' ? data.title : path,
      summary: firstParagraphOf(parsed.content),
    };
  } catch {
    return { path, title: path, summary: '' };
  }
}

/**
 * Run the Cross-Wiki Discovery pass over a workspace. All LLM components are
 * injectable so every gate stays LLM-free ($0); the default implementations
 * make the real calls through the routing table (cheap slot for context
 * summaries, fuzzy match, predicate normalization, topic clustering, and the
 * relevance probe; mid-tier for uncertain review and hypothesis signals).
 */
export async function runCrossWikiPass(options: CrossWikiPassOptions): Promise<CrossWikiPassResult> {
  const workspace = options.workspace ?? '.';
  const progress = options.onProgress ?? (() => {});

  // --- Deterministic pre-flight (phase doc §2.8 step 1). ---
  const fingerprint = await computeRunFingerprint(workspace);
  let decision = await preflightDecision(workspace, fingerprint);
  const workspaceWikis = await listWorkspaceWikis(workspace);
  if (options.forceCrossWiki === true && workspaceWikis.length >= 2) {
    // Phase 24 user-ratified extension (2026-08-14): bypass the deterministic
    // preflight and the optional relevance probe. The fingerprint is still
    // recorded at the end so the next normal run can skip.
    decision = { action: 'run', reason: 'forced' };
    progress('Cross-wiki discovery: forced by user — running full pass.');
  }
  if (decision.action === 'skip') {
    return { ran: false, reason: decision.reason };
  }
  if (decision.action === 'probe') {
    // Step 2: the optional cheap-LLM relevance probe for single-wiki changes.
    try {
      const changes = await Promise.all(decision.changedPages.map((path) => changedPageSummary(workspace, path)));
      const relevant = await relevanceProbe(changes, {
        language: options.language,
        logPath: options.logPath,
        relevanceProbeFn: options.relevanceProbeFn,
      });
      if (!relevant) {
        await writeRunFingerprint(workspace, fingerprint);
        progress('Cross-wiki discovery: changes are local (relevance probe) — full pass skipped.');
        return { ran: false, reason: 'probe-not-relevant' };
      }
    } catch (err) {
      // Probe failure fails OPEN (the full pass runs; it stays fault-tolerant).
      progress(`Warning: cross-wiki relevance probe failed (${(err as Error).message}); running the full pass.`);
    }
  }

  // --- Component E: entity context summaries (every entity page). ---
  const wikis = await listWorkspaceWikis(workspace);
  const entityPages = [];
  const topicPages = [];
  for (const wiki of wikis) {
    entityPages.push(...(await scanEntityPages(workspace, wiki)));
    topicPages.push(...(await scanTopicPages(workspace, wiki)));
  }

  let summaries: Record<string, EntitySummary> = {};
  try {
    summaries = await summarizeEntities(entityPages, {
      workspace,
      language: options.language,
      logPath: options.logPath,
      summarizeEntityFn: options.summarizeEntityFn,
      onProgress: progress,
    });
  } catch (err) {
    progress(`Warning: cross-wiki entity summaries failed (${(err as Error).message}); continuing without summaries.`);
  }

  // --- Component A: entity resolution (exact → fuzzy → uncertain review). ---
  let resolution: EntityResolutionResult;
  try {
    resolution = await resolveEntities(entityPages, summaries, {
      workspace,
      language: options.language,
      logPath: options.logPath,
      matchEntitiesFn: options.matchEntitiesFn,
      reviewUncertainFn: options.reviewUncertainFn,
      onProgress: progress,
    });
  } catch (err) {
    progress(`Warning: cross-wiki entity resolution failed (${(err as Error).message}); writing an empty registry.`);
    resolution = { entries: [], uncertain: [], stats: { exactClusters: 0, candidateClusters: 0, fuzzyMatches: 0, reviewMatches: 0 } };
  }

  // --- Component F: predicate normalization. ---
  const predicates = entityPages.flatMap((page) => page.relationships.map((rel) => rel.predicate));
  const predicateGroups = await normalizePredicates(predicates, {
    workspace,
    language: options.language,
    logPath: options.logPath,
    normalizePredicatesFn: options.normalizePredicatesFn,
    onProgress: progress,
  });

  // --- Component B: relationship graph (no LLM). ---
  const edges = await buildRelationshipGraph(entityPages, resolution.entries, predicateGroups, { workspace });

  // --- Component C: topic clustering. ---
  const clusters = await clusterTopics(topicPages, {
    workspace,
    language: options.language,
    logPath: options.logPath,
    clusterTopicsFn: options.clusterTopicsFn,
    onProgress: progress,
  });

  // --- Component G: hypothesis signals. ---
  const signals = await generateHypothesisSignals(resolution.entries, edges, clusters, summaries, {
    workspace,
    language: options.language,
    logPath: options.logPath,
    generateSignalsFn: options.generateSignalsFn,
    onProgress: progress,
  });

  // --- Cross-Wiki DOX Writer (phase doc §2.4): deterministic contracts. ---
  const crossWikiDir = join(workspace, 'wikis', CROSS_WIKI_FOLDER);
  await mkdir(join(crossWikiDir, 'topics'), { recursive: true });
  const updated = new Date().toISOString();
  const artifactWikis = new Set<string>();
  for (const entry of resolution.entries) {
    for (const member of entry.members) {
      artifactWikis.add(member.wiki);
    }
  }
  for (const edge of edges) {
    artifactWikis.add(edge.subject.wiki);
    if (edge.object.wiki !== '') {
      artifactWikis.add(edge.object.wiki);
    }
  }
  for (const cluster of clusters) {
    for (const topic of cluster.mappedTopics) {
      artifactWikis.add(topic.wiki);
    }
  }
  await writeFile(
    join(crossWikiDir, 'index.md'),
    writeCrossWikiIndexPage(
      {
        entityCount: resolution.entries.length,
        edgeCount: edges.length,
        clusterCount: clusters.length,
        wikiCount: artifactWikis.size,
      },
      updated,
    ),
    'utf-8',
  );
  await writeFile(
    join(crossWikiDir, 'topics', 'index.md'),
    writeCrossWikiTopicsIndexPage(clusters, updated),
    'utf-8',
  );
  await updateWorkspaceCrossWikiSection(workspace);

  // --- Run-control bookkeeping + best-effort artifact validation. ---
  await writeRunFingerprint(workspace, fingerprint);
  try {
    const schema = await validateCrossWikiSchema(workspace);
    for (const invalid of schema.invalid) {
      progress(`Warning: cross-wiki schema violation in ${invalid.page}: ${invalid.issue}`);
    }
    const links = await checkCrossWikiLinks(workspace);
    for (const broken of links.broken) {
      progress(`Warning: broken cross-wiki link in ${broken.page}: [[${broken.link}]]`);
    }
  } catch {
    // Validation is best-effort; it never fails the pass.
  }

  return {
    ran: true,
    reason: decision.action === 'run' ? decision.reason : 'probe-relevant',
    entities: resolution.entries.length,
    edges: edges.length,
    clusters: clusters.length,
    signals: signals.length,
    uncertain: resolution.uncertain.length,
  };
}
