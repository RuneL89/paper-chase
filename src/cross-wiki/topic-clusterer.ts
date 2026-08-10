import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { writeTopicClusterPage, type TopicCluster } from '../pages/cross-wiki/topic-cluster-page';
import { slugify } from '../utils/slug';
import { CROSS_WIKI_MAX_TOKENS, runCrossWikiJsonCall, type CrossWikiLanguage } from './llm';
import { writeCrossWikiState } from './state';
import type { ScannedTopicPage } from './workspace-scan';

/**
 * Phase 24 Component C (phase doc §2.3, user decisions 2026-08-09 #4/#5/#6):
 * semantic topic clustering across wikis. ONE batched cheap LLM call over
 * every topic page's title, aliases, and first paragraph returns the cluster
 * assignments (cross-language comparisons included); only clusters spanning
 * ≥2 distinct wikis are kept. The same call produces each kept cluster's
 * neutral description (no factual claims — the cluster-page prompt's binding
 * rule), so the page bodies need no second round of calls.
 *
 * Outputs: `wikis/cross-wiki/topics/<cluster-id>.md` per cluster and
 * `.state/cross-wiki/topic-clusters.json` (the JSON mirror with the richer
 * `mappedTopics` array). `topics/index.md` is written by the Cross-Wiki DOX
 * pass (phase doc §2.4). Stale cluster pages from earlier runs are removed.
 */

export type ClusterTopicsFn = (
  topics: ScannedTopicPage[],
  feedback: string | undefined,
  attempt: number,
) => Promise<string>;

export interface ClusterTopicsOptions {
  workspace?: string;
  language?: CrossWikiLanguage;
  logPath?: string;
  clusterTopicsFn?: ClusterTopicsFn;
  onProgress?: (message: string) => void;
}

interface ClusterOutput {
  clusters: Array<{
    clusterId: string;
    title: string;
    description: string;
    mappedTopics: Array<{ id: string; label: string }>;
    confidence: string;
  }>;
}

function validateClusterOutput(
  data: unknown,
  candidates: Map<string, ScannedTopicPage>,
): { valid: boolean; errors: string[]; value?: ClusterOutput } {
  const errors: string[] = [];
  if (typeof data !== 'object' || data === null || !Array.isArray((data as Record<string, unknown>).clusters)) {
    return { valid: false, errors: ['output must be an object with a "clusters" array'] };
  }
  const assigned = new Set<string>();
  const clusters: ClusterOutput['clusters'] = [];
  for (const [index, cluster] of ((data as Record<string, unknown>).clusters as unknown[]).entries()) {
    if (typeof cluster !== 'object' || cluster === null) {
      errors.push(`clusters[${index}]: not an object`);
      continue;
    }
    const c = cluster as Record<string, unknown>;
    if (typeof c.title !== 'string' || c.title.trim().length === 0) {
      errors.push(`clusters[${index}]: missing "title"`);
      continue;
    }
    if (!Array.isArray(c.mappedTopics) || c.mappedTopics.length < 2) {
      errors.push(`clusters[${index}]: "mappedTopics" must map at least two topics`);
      continue;
    }
    const mappedTopics: Array<{ id: string; label: string }> = [];
    let ok = true;
    for (const mapped of c.mappedTopics as unknown[]) {
      if (typeof mapped !== 'object' || mapped === null) {
        errors.push(`clusters[${index}]: a mapped topic is not an object`);
        ok = false;
        continue;
      }
      const m = mapped as Record<string, unknown>;
      if (typeof m.id !== 'string' || !candidates.has(m.id)) {
        errors.push(`clusters[${index}]: unknown topic id "${String(m.id)}"`);
        ok = false;
        continue;
      }
      if (assigned.has(m.id)) {
        errors.push(`clusters[${index}]: topic "${m.id}" is mapped into two clusters`);
        ok = false;
        continue;
      }
      assigned.add(m.id);
      mappedTopics.push({ id: m.id, label: typeof m.label === 'string' && m.label.trim().length > 0 ? m.label : candidates.get(m.id)!.title });
    }
    if (!ok) {
      continue;
    }
    clusters.push({
      clusterId: typeof c.clusterId === 'string' && c.clusterId.trim().length > 0 ? c.clusterId.trim() : c.title.trim(),
      title: c.title.trim(),
      description: typeof c.description === 'string' ? c.description.trim() : '',
      mappedTopics,
      confidence: typeof c.confidence === 'string' ? c.confidence : 'medium',
    });
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, errors: [], value: { clusters } };
}

function formatTopicCandidate(page: ScannedTopicPage): string {
  return JSON.stringify({
    id: page.id,
    wiki: page.wiki,
    title: page.title,
    aliases: page.aliases,
    summary: page.firstParagraph,
  });
}

/**
 * Cluster the workspace's topic pages and write the cluster pages plus the
 * JSON mirror. Any LLM failure yields zero clusters (the DOX pass still
 * writes an honest empty `topics/index.md`) — the pass never aborts.
 */
export async function clusterTopics(
  pages: ScannedTopicPage[],
  options: ClusterTopicsOptions = {},
): Promise<TopicCluster[]> {
  const workspace = options.workspace ?? '.';
  const topicsDir = join(workspace, 'wikis', 'cross-wiki', 'topics');
  await mkdir(topicsDir, { recursive: true });

  const candidates = new Map(pages.map((page) => [page.id, page]));
  let kept: TopicCluster[] = [];

  if (pages.length > 0) {
    let outcome;
    try {
      outcome = await runCrossWikiJsonCall<ClusterOutput>({
        promptFile: 'cross-wiki-topic-cluster.prompt.txt',
        slots: { topics: pages.map(formatTopicCandidate).join('\n') },
        callType: 'cross-wiki-topic-cluster',
        context: `cross-wiki topic cluster (${pages.length} topics)`,
        maxTokens: CROSS_WIKI_MAX_TOKENS,
        language: options.language,
        logPath: options.logPath,
        label: `cross-wiki topic cluster (${pages.length} topics)`,
        validate: (data) => validateClusterOutput(data, candidates),
        callLLMFn: options.clusterTopicsFn
          ? (feedback, attempt) => options.clusterTopicsFn!(pages, feedback, attempt)
          : undefined,
      });
    } catch (err) {
      options.onProgress?.(
        `Warning: cross-wiki topic clustering failed (${(err as Error).message}); no cluster pages are written this run.`,
      );
      outcome = null;
    }
    if (outcome !== null && outcome.output !== null) {
      const usedIds = new Set<string>();
      for (const cluster of outcome.output.clusters) {
        const wikis = Array.from(new Set(cluster.mappedTopics.map((mapped) => candidates.get(mapped.id)!.wiki)));
        if (wikis.length < 2) {
          continue; // Single-wiki clusters are excluded (phase doc §2.3).
        }
        const baseId = slugify(cluster.clusterId) || 'cluster';
        let clusterId = baseId;
        let suffix = 2;
        while (usedIds.has(clusterId)) {
          clusterId = `${baseId}-${suffix}`;
          suffix++;
        }
        usedIds.add(clusterId);
        kept.push({
          clusterId,
          title: cluster.title,
          description: cluster.description,
          mappedTopics: cluster.mappedTopics
            .map((mapped) => {
              const candidate = candidates.get(mapped.id)!;
              return { wiki: candidate.wiki, page: candidate.id, label: mapped.label };
            })
            .sort((a, b) => a.page.localeCompare(b.page)),
          confidence: cluster.confidence,
        });
      }
    }
  }

  kept.sort((a, b) => a.clusterId.localeCompare(b.clusterId));

  // Remove stale cluster pages from earlier runs, then write the fresh set.
  for (const entry of await readdir(topicsDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'index.md') {
      if (!kept.some((cluster) => `${cluster.clusterId}.md` === entry.name)) {
        await rm(join(topicsDir, entry.name));
      }
    }
  }
  const updated = new Date().toISOString();
  for (const cluster of kept) {
    await writeFile(join(topicsDir, `${cluster.clusterId}.md`), writeTopicClusterPage(cluster, updated), 'utf-8');
  }
  await writeCrossWikiState(workspace, 'topic-clusters.json', { generated: updated, clusters: kept });
  return kept;
}
