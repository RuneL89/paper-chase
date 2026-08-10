import matter from 'gray-matter';
import { formatWikilink } from '../../utils/wikilinks';

/**
 * Phase 24 Component C output (phase doc §2.3/§2.9, vision `05` §9.1): one
 * `cross-wiki-topic` page per multi-wiki topic cluster at
 * `wikis/cross-wiki/topics/<cluster-id>.md`. The frontmatter carries `title`,
 * `type`, `clusterId`, `members` (path-qualified topic slugs WITH `.md`),
 * and `updated` — NO `wiki` field and NO `sources` (cluster pages make no
 * factual claims; the evidence stays on the linked per-wiki topic pages).
 * The body is the LLM's neutral cluster description plus the deterministic
 * `## Member Topics` list and a `## Sources` section pointing back at the
 * member topic pages (never raw PDFs, no `[^srcN]` citations).
 */

export interface ClusterMappedTopic {
  wiki: string;
  /** Path-qualified topic page id relative to wikis/, without .md. */
  page: string;
  /** The topic's own title, verbatim. */
  label: string;
}

export interface TopicCluster {
  clusterId: string;
  title: string;
  /** Neutral cluster description (no factual claims). */
  description: string;
  mappedTopics: ClusterMappedTopic[];
  confidence: string;
}

function escapeYamlString(value: string): string {
  if (/[:#{}[\],&*!?|>'"%@`\n\r]/.test(value) || /^\s|\s$/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}

/** Render one cluster page (deterministic around the LLM's description). */
export function writeTopicClusterPage(cluster: TopicCluster, updated: string): string {
  const members = [...cluster.mappedTopics].sort((a, b) => a.page.localeCompare(b.page));

  const lines: string[] = [];
  lines.push(`# ${cluster.title}`, '');
  lines.push(cluster.description.trim(), '');
  lines.push('## Member Topics', '');
  for (const member of members) {
    lines.push(`- ${formatWikilink(member.page, member.label)} (${member.wiki})`);
  }
  lines.push('');
  lines.push('## Sources', '');
  lines.push(
    'This cluster page makes no factual claims. The evidence lives on the member topic pages:',
  );
  for (const member of members) {
    lines.push(`- ${formatWikilink(member.page, member.label)} (${member.wiki})`);
  }
  lines.push('');

  const frontmatter: Record<string, unknown> = {
    title: escapeYamlString(cluster.title),
    type: 'cross-wiki-topic',
    clusterId: cluster.clusterId,
    members: members.map((member) => `${member.page}.md`),
    updated,
  };
  return matter.stringify(`\n${lines.join('\n')}\n`, frontmatter);
}
