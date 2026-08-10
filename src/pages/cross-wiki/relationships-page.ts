import matter from 'gray-matter';
import { formatWikilink } from '../../utils/wikilinks';

/**
 * Phase 24 Component B output (phase doc §2.2/§2.9, vision `05` §9.1): the
 * cross-wiki relationship graph page `wikis/cross-wiki/relationships.md` — a
 * `cross-wiki-index` page carrying a markdown table of the included edges
 * (subject in the entity registry, or subject/object in different wikis),
 * with CANONICAL predicates (Component F). One row per edge; the JSON mirror
 * `.state/cross-wiki/relationship-graph.json` carries the same rows
 * deterministically (gate 24.2: mirror matches the table).
 */

export interface GraphEntityRef {
  wiki: string;
  slug: string;
  /** Path-qualified page id relative to wikis/, without .md ('' when the entity has no known page). */
  path: string;
  title: string;
}

export interface GraphEdge {
  subject: GraphEntityRef;
  /** Canonical predicate (post Component F). */
  predicate: string;
  object: GraphEntityRef;
  /** Verbatim evidence ('' when the rendered line carried none). */
  evidence: string;
  /** The wiki whose page carried this relationship. */
  sourceWiki: string;
}

function tableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/** A ref renders as a path-qualified wikilink when its page is known, plain text otherwise. */
function refLink(ref: GraphEntityRef): string {
  if (ref.path === '') {
    return tableCell(ref.title);
  }
  return formatWikilink(ref.path, ref.title);
}

/**
 * Render `wikis/cross-wiki/relationships.md`. Rows are sorted by subject
 * path, predicate, then object path — byte-deterministic for a given edge
 * set. The empty form is an honest report.
 */
export function writeRelationshipsPage(edges: GraphEdge[], updated: string): string {
  const sorted = [...edges].sort(
    (a, b) =>
      a.subject.path.localeCompare(b.subject.path) ||
      a.predicate.localeCompare(b.predicate) ||
      a.object.path.localeCompare(b.object.path),
  );

  const lines: string[] = [];
  lines.push('# Cross-Wiki Relationship Graph', '');
  if (sorted.length === 0) {
    lines.push(
      'No cross-wiki relationships found. This graph lists relationships whose subject appears in the cross-wiki entity registry or whose subject and object live in different wikis; none were found in the current workspace.',
      '',
    );
  } else {
    lines.push(
      `${sorted.length} ${sorted.length === 1 ? 'relationship crosses' : 'relationships cross'} wiki boundaries or touch a cross-wiki entity. Predicates are canonicalized across wikis. This is a derived, read-only index: follow the page links for the cited evidence on each wiki's own page.`,
      '',
    );
    lines.push('| Subject | Predicate | Object | Evidence |', '| --- | --- | --- | --- |');
    for (const edge of sorted) {
      lines.push(
        `| ${refLink(edge.subject)} | ${tableCell(edge.predicate)} | ${refLink(edge.object)} | ${tableCell(edge.evidence)} |`,
      );
    }
    lines.push('');
  }

  const frontmatter: Record<string, unknown> = {
    title: 'Cross-Wiki Relationship Graph',
    type: 'cross-wiki-index',
    updated,
    children: [],
    edgeCount: sorted.length,
  };
  return matter.stringify(`\n${lines.join('\n')}\n`, frontmatter);
}
