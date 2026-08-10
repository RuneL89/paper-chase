import matter from 'gray-matter';
import { formatWikilink } from '../../utils/wikilinks';
import type { TopicCluster } from './topic-cluster-page';

/**
 * Phase 24 §2.4 (vision `03` §4.1/§4.2 amended 2026-08-09, `05` §9.1): the
 * Cross-Wiki DOX Writer's page builders — deterministic `cross-wiki-index`
 * contracts for `wikis/cross-wiki/index.md` (root contract describing the
 * three artifacts and how to use them) and `wikis/cross-wiki/topics/index.md`
 * (the cluster catalog). Both carry the index-page contract frontmatter
 * (`title`, `type`, `updated`, `children`) with NO `wiki` field, plus the
 * optional `entityCount`/`edgeCount` statistics; children and statistics are
 * re-imposed deterministically (gate 24.5). The prose is deterministic — the
 * contracts describe derived artifacts whose contents are already enumerated;
 * no LLM call is needed at this level.
 */

export interface CrossWikiArtifactStats {
  entityCount: number;
  edgeCount: number;
  clusterCount: number;
  /** Distinct wikis covered by the artifacts. */
  wikiCount: number;
}

/** Render `wikis/cross-wiki/index.md` — the root contract of the derived artifact set. */
export function writeCrossWikiIndexPage(stats: CrossWikiArtifactStats, updated: string): string {
  const lines: string[] = [];
  lines.push('# Cross-Wiki Discovery', '');
  lines.push(
    'This folder holds the workspace-level Cross-Wiki Discovery artifacts: a derived, read-only view across every wiki in the workspace. Nothing here merges or edits the per-wiki pages — each artifact links back to the per-wiki pages where the cited evidence lives.',
    '',
  );
  lines.push('## Artifacts', '');
  lines.push(
    `- ${formatWikilink('cross-wiki/entities', 'Cross-Wiki Entity Registry')} — ${stats.entityCount} ${stats.entityCount === 1 ? 'entity' : 'entities'} appearing in at least two wikis, with per-member context summaries.`,
  );
  lines.push(
    `- ${formatWikilink('cross-wiki/relationships', 'Cross-Wiki Relationship Graph')} — ${stats.edgeCount} ${stats.edgeCount === 1 ? 'relationship' : 'relationships'} crossing wiki boundaries or touching a cross-wiki entity, with canonical predicates.`,
  );
  lines.push(
    `- ${formatWikilink('cross-wiki/topics/index', 'Cross-Wiki Topic Clusters')} — ${stats.clusterCount} ${stats.clusterCount === 1 ? 'cluster' : 'clusters'} of related topics across wikis.`,
  );
  lines.push('');
  lines.push('## How to Use', '');
  lines.push(
    'Start at the entity registry to find the same real-world thing in several wikis, follow the relationship graph for connections that cross wiki boundaries, and read the topic clusters for themes the wikis share. Every link is path-qualified (`wiki/folder/page`) so it resolves inside the workspace vault.',
  );
  lines.push('');
  lines.push('## Statistics', '');
  lines.push(`- Cross-wiki entities: ${stats.entityCount}`);
  lines.push(`- Relationship edges: ${stats.edgeCount}`);
  lines.push(`- Topic clusters: ${stats.clusterCount}`);
  lines.push(`- Wikis covered: ${stats.wikiCount}`);
  lines.push('');

  const frontmatter: Record<string, unknown> = {
    title: 'Cross-Wiki Discovery',
    type: 'cross-wiki-index',
    updated,
    children: ['entities.md', 'relationships.md', 'topics/index.md'],
    entityCount: stats.entityCount,
    edgeCount: stats.edgeCount,
  };
  return matter.stringify(`\n${lines.join('\n')}\n`, frontmatter);
}

/**
 * Render `wikis/cross-wiki/topics/index.md` — the cluster catalog. The
 * empty-cluster safety net (phase doc §2.3): with no multi-wiki clusters the
 * index says so honestly.
 */
export function writeCrossWikiTopicsIndexPage(clusters: TopicCluster[], updated: string): string {
  const lines: string[] = [];
  lines.push('# Cross-Wiki Topic Clusters', '');
  if (clusters.length === 0) {
    lines.push(
      'No cross-wiki topic clusters found. Clusters group related topics that appear in at least two wikis; none were found in the current workspace.',
      '',
    );
  } else {
    lines.push(
      `${clusters.length} ${clusters.length === 1 ? 'cluster groups' : 'clusters group'} related topics across wikis. Cluster pages describe the grouping only — factual claims live on the linked per-wiki topic pages.`,
      '',
    );
    lines.push('## Clusters', '');
    for (const cluster of clusters) {
      const wikis = Array.from(new Set(cluster.mappedTopics.map((topic) => topic.wiki))).sort((a, b) => a.localeCompare(b));
      lines.push(
        `- ${formatWikilink(`cross-wiki/topics/${cluster.clusterId}`, cluster.title)} — ${cluster.mappedTopics.length} topics across ${wikis.length} wikis (${wikis.join(', ')}).`,
      );
    }
    lines.push('');
  }
  lines.push('## Statistics', '');
  lines.push(`- Clusters: ${clusters.length}`);
  lines.push('');

  const frontmatter: Record<string, unknown> = {
    title: 'Cross-Wiki Topic Clusters',
    type: 'cross-wiki-index',
    updated,
    children: clusters.map((cluster) => `${cluster.clusterId}.md`),
  };
  return matter.stringify(`\n${lines.join('\n')}\n`, frontmatter);
}
