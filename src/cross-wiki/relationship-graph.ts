import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { writeRelationshipsPage, type GraphEdge } from '../pages/cross-wiki/relationships-page';
import type { RegistryEntry } from '../pages/cross-wiki/entity-registry-page';
import { predicateLookup, type PredicateGroup } from './predicate-normalizer';
import { writeCrossWikiState } from './state';
import type { ScannedEntityPage } from './workspace-scan';

/**
 * Phase 24 Component B (phase doc §2.2): the workspace-level relationship
 * graph. Parses the rendered `## Relationships` lines of every entity page
 * (both directions), rewrites every predicate to its CANONICAL form via
 * Component F's predicate map, and keeps an edge when:
 *
 *   - the subject entity appears in the cross-wiki entity registry, OR
 *   - the subject wiki and object wiki differ.
 *
 * Intra-wiki-only edges whose subject is not cross-wiki are omitted to keep
 * the artifact bounded. NO LLM calls in this component.
 *
 * Outputs: `wikis/cross-wiki/relationships.md` (markdown table) and
 * `.state/cross-wiki/relationship-graph.json` (JSON mirror).
 */

export interface BuildRelationshipGraphOptions {
  workspace?: string;
}

interface FlatRelationship {
  /** Subject wiki when known from the page that carried the relationship ('' = resolve). */
  subjectWiki: string;
  subjectSlug: string;
  subjectTitle?: string;
  predicate: string;
  /** Object wiki when known ('' = resolve). */
  objectWiki: string;
  objectSlug: string;
  objectTitle?: string;
  evidence: string;
  /** The wiki whose page carried this relationship. */
  sourceWiki: string;
}

/** Flatten both relationship directions of every page into subject-first form. */
function flattenRelationships(pages: ScannedEntityPage[]): FlatRelationship[] {
  const flat: FlatRelationship[] = [];
  for (const page of pages) {
    for (const rel of page.relationships) {
      if (rel.direction === 'outgoing') {
        flat.push({
          subjectWiki: page.wiki,
          subjectSlug: page.slug,
          subjectTitle: page.title,
          predicate: rel.predicate,
          objectWiki: '',
          objectSlug: rel.otherSlug,
          ...(rel.otherTitle !== undefined ? { objectTitle: rel.otherTitle } : {}),
          evidence: rel.evidence,
          sourceWiki: page.wiki,
        });
      } else {
        flat.push({
          subjectWiki: '',
          subjectSlug: rel.otherSlug,
          ...(rel.otherTitle !== undefined ? { subjectTitle: rel.otherTitle } : {}),
          predicate: rel.predicate,
          objectWiki: page.wiki,
          objectSlug: page.slug,
          objectTitle: page.title,
          evidence: rel.evidence,
          sourceWiki: page.wiki,
        });
      }
    }
  }
  return flat;
}

/**
 * Build the graph, write both artifacts, and return the edges (canonical
 * predicates applied, deduped, deterministically sorted).
 */
export async function buildRelationshipGraph(
  pages: ScannedEntityPage[],
  registry: RegistryEntry[],
  predicateGroups: PredicateGroup[],
  options: BuildRelationshipGraphOptions = {},
): Promise<GraphEdge[]> {
  const workspace = options.workspace ?? '.';
  const canonical = predicateLookup(predicateGroups);

  // Page location index: slug -> wikis that carry an entity page with that slug.
  const slugToWikis = new Map<string, Map<string, ScannedEntityPage>>();
  for (const page of pages) {
    const wikis = slugToWikis.get(page.slug) ?? new Map<string, ScannedEntityPage>();
    wikis.set(page.wiki, page);
    slugToWikis.set(page.slug, wikis);
  }

  // Registry membership by (wiki, slug).
  const registryMembers = new Set<string>();
  for (const entry of registry) {
    for (const member of entry.members) {
      registryMembers.add(`${member.wiki}/${member.slug}`);
    }
  }

  const flat = flattenRelationships(pages);
  const seen = new Set<string>();
  const edges: GraphEdge[] = [];
  // Resolve an endpoint's wiki: the PREFERRED wiki when it carries the page
  // (known endpoints always do; a page's own relationships prefer the local
  // wiki), otherwise the unique wiki carrying it, otherwise null (no known
  // page — the edge then counts as intra-wiki unless the subject is in the
  // registry).
  const resolveWiki = (slug: string, preferred: string): string | null => {
    const wikis = slugToWikis.get(slug);
    if (wikis === undefined) {
      return null; // No page for this slug anywhere in the workspace.
    }
    if (preferred !== '' && wikis.has(preferred)) {
      return preferred;
    }
    return wikis.size === 1 ? Array.from(wikis.keys())[0] : null;
  };
  for (const rel of flat) {
    const predicate = canonical.get(rel.predicate) ?? rel.predicate;
    // Unresolved endpoints prefer the source wiki (a page's own relationships
    // reference local entities first); a single-carrier slug resolves to it.
    const subjectWiki = resolveWiki(rel.subjectSlug, rel.subjectWiki !== '' ? rel.subjectWiki : rel.sourceWiki);
    const objectWiki = resolveWiki(rel.objectSlug, rel.objectWiki !== '' ? rel.objectWiki : rel.sourceWiki);
    if (subjectWiki === null) {
      continue; // Subject page unknown anywhere — nothing to link or classify.
    }
    const subjectInRegistry = registryMembers.has(`${subjectWiki}/${rel.subjectSlug}`);
    if (!subjectInRegistry && (objectWiki === null || objectWiki === subjectWiki)) {
      continue; // Intra-wiki-only edge with a non-cross-wiki subject: omitted.
    }
    const subjectPage = slugToWikis.get(rel.subjectSlug)?.get(subjectWiki);
    const objectPage = objectWiki !== null ? slugToWikis.get(rel.objectSlug)?.get(objectWiki) : undefined;
    const edge: GraphEdge = {
      subject: {
        wiki: subjectWiki,
        slug: rel.subjectSlug,
        path: subjectPage?.id ?? '',
        title: subjectPage?.title ?? rel.subjectTitle ?? rel.subjectSlug,
      },
      predicate,
      object: {
        wiki: objectWiki ?? '',
        slug: rel.objectSlug,
        path: objectPage?.id ?? '',
        title: objectPage?.title ?? rel.objectTitle ?? rel.objectSlug,
      },
      evidence: rel.evidence,
      sourceWiki: rel.sourceWiki,
    };
    const key = `${edge.subject.wiki}/${edge.subject.slug}|${edge.predicate}|${edge.object.wiki}/${edge.object.slug}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    edges.push(edge);
  }

  edges.sort(
    (a, b) =>
      `${a.subject.wiki}/${a.subject.slug}`.localeCompare(`${b.subject.wiki}/${b.subject.slug}`) ||
      a.predicate.localeCompare(b.predicate) ||
      `${a.object.wiki}/${a.object.slug}`.localeCompare(`${b.object.wiki}/${b.object.slug}`),
  );

  const crossWikiDir = join(workspace, 'wikis', 'cross-wiki');
  await mkdir(crossWikiDir, { recursive: true });
  const updated = new Date().toISOString();
  await writeFile(join(crossWikiDir, 'relationships.md'), writeRelationshipsPage(edges, updated), 'utf-8');
  await writeCrossWikiState(workspace, 'relationship-graph.json', { generated: updated, edges });
  return edges;
}
