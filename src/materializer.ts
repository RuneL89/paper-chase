import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import { wikiDir, wikiRelativePath } from './utils/paths';
import { writeEntityPage, type EntityPageData } from './pages/entity-page';
import { writeTopicPage, type TopicPageData } from './pages/topic-page';
import { type DocumentPageData } from './pages/document-page';
import { saveRollingMemory, readFullRollingMemory, type RollingMemory } from './state/rolling-memory';
import { logStructuralChanges, readStructuralChanges, type StructuralChange } from './state/structural-changes';
import { logManualEditConflict } from './state/conflicts';
import type {
  ExtractorEntity,
  ExtractorRelationship,
  ExtractorClaim,
  ExtractorResult,
  ExtractorTimelineEvent,
} from './agents/extractor';

export interface MaterializeOptions {
  workspace?: string;
  /**
   * Phase 8 (phase doc §2.5): wiki-relative page path -> SHA-256 of the
   * page's content recorded at the end of the last ingestion (from
   * `.state/ingestion.json` `pageHashes`). When an existing page's current
   * content no longer matches its recorded hash, the page was manually
   * edited: the update is SKIPPED and a conflict is logged to
   * `.state/conflicts.json`. When omitted, no conflict detection runs
   * (pre-Phase-8 callers keep their behavior).
   */
  pageHashes?: Record<string, string>;
}

export interface MaterializeResult {
  /** Structured data for every entity page written. */
  entityPages: EntityPageData[];
  /** Structured data for every topic page written. */
  topicPages: TopicPageData[];
  /** Structured data for every document page written. */
  documentPages: DocumentPageData[];
  /**
   * Phase 8: wiki-relative path + SHA-256 of rendered content for every
   * entity/topic page actually written (not conflict-skipped). `ingest`
   * folds these into its working hash map between materialize calls and
   * re-hashes from disk after synthesis so the recorded hashes always
   * reflect the tool's own final writes.
   */
  writtenPages: Array<{ path: string; hash: string }>;
  /**
   * Phase 8: wiki-relative paths of pages whose update was skipped because
   * a manual edit was detected (hash mismatch). These pages are excluded
   * from `entityPages`/`topicPages` so the Synthesis Writer never
   * overwrites a journalist's edit either.
   */
  conflicts: string[];
  /**
   * Phase 8 (UAT fork-reconciliation fix, vision `03` §3.2 + `04` §3.2
   * Step 6): duplicate pages deleted because the entity's canonical folder
   * (recorded in the PREVIOUS rolling memory — "first folder assignment
   * wins" across runs) is elsewhere. Only unmodified tool writes are
   * deleted (on-disk hash still matches the recorded page hash); edited or
   * untracked duplicates are KEPT and logged as manual-edit conflicts
   * instead. `ingest` removes these paths from its working hash map and
   * logs `Removed duplicate page <path> (entity now lives at <canonical>).`.
   */
  removedDuplicates: Array<{ path: string; canonicalPath: string }>;
}

interface MaterializedEntity {
  name: string;
  type: string;
  folder: string;
  significance: string;
  disambiguation?: string;
  contexts: Set<string>;
  mentions: EntityPageData['mentions'];
  relationships: EntityPageData['relationships'];
  claims: EntityPageData['claims'];
  timeline: ExtractorTimelineEvent[];
}

interface MaterializedTopic {
  title: string;
  slug: string;
  folder: string;
  claims: TopicPageData['claims'];
}

interface ChunkSource {
  file: string;
  pages: string;
}

function sourceSlugFromChunkId(chunkId: string): string {
  // Document pages are named `<source-slug>-part-NNN.md` (phase doc §2.2).
  return chunkId.replace(/-part-\d{3}$/, '');
}

function dedupeMentions(list: EntityPageData['mentions']): EntityPageData['mentions'] {
  const seen = new Set<string>();
  return list.filter((item) => {
    const key = `${item.page}|${item.context}|${item.source}|${item.pages}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeRelationships(list: EntityPageData['relationships']): EntityPageData['relationships'] {
  const seen = new Set<string>();
  return list.filter((item) => {
    const key = `${item.subject}|${item.predicate}|${item.object}|${item.page}|${item.source}|${item.pages}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeClaims(list: EntityPageData['claims']): EntityPageData['claims'] {
  const seen = new Set<string>();
  return list.filter((item) => {
    const key = `${item.text}|${item.type}|${item.page}|${item.source}|${item.pages}|${item.entities.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeTimeline(list: ExtractorTimelineEvent[]): ExtractorTimelineEvent[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    const key = `${item.date}|${item.event}|${item.entities.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function loadChunkSource(wikiDir: string, chunkId: string): Promise<ChunkSource | null> {
  const documentPath = join(wikiDir, 'documents', `${chunkId}.md`);
  try {
    const raw = await readFile(documentPath, 'utf-8');
    const parsed = matter(raw);
    const firstSource = Array.isArray(parsed.data.sources) ? (parsed.data.sources[0] as Record<string, unknown>) : undefined;
    const file = typeof firstSource?.file === 'string' ? firstSource.file : '';
    const pages = typeof firstSource?.pages === 'string' ? firstSource.pages : '';
    return { file, pages };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

/** SHA-256 hex of a string (page content), matching the file-based utils/hash. */
function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Phase 8 (phase doc §2.5, vision `04` §3.2 Step 6): decide whether an
 * existing page may be updated. Returns 'write' for new pages and for pages
 * whose content still matches the recorded hash; 'conflict' when the on-disk
 * content was manually edited (hash mismatch) — the caller then skips the
 * update. A page that predates hash tracking (no recorded hash) is updated
 * normally and starts being tracked.
 */
async function checkPageConflict(
  pagePath: string,
  relativePath: string,
  pageHashes: Record<string, string> | undefined,
): Promise<'write' | 'conflict'> {
  if (!pageHashes || !existsSync(pagePath)) {
    return 'write';
  }
  const recorded = pageHashes[relativePath];
  if (recorded === undefined) {
    return 'write';
  }
  const current = hashContent(await readFile(pagePath, 'utf-8'));
  return current === recorded ? 'write' : 'conflict';
}

/**
 * Recursively collect every entity page under `entities/` (excluding folder
 * `index.md` contracts) as a map of page slug -> wiki-relative paths
 * (forward slashes, e.g. 'entities/people/executives/john-smith.md').
 */
async function collectEntityPageLocations(root: string, relPrefix: string, out: Map<string, string[]>): Promise<void> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const rel = relPrefix === '' ? entry.name : `${relPrefix}/${entry.name}`;
    if (entry.isDirectory()) {
      await collectEntityPageLocations(join(root, entry.name), rel, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md') && entry.name.toLowerCase() !== 'index.md') {
      const slug = entry.name.replace(/\.md$/i, '');
      const list = out.get(slug) ?? [];
      list.push(`entities/${rel}`);
      out.set(slug, list);
    }
  }
}

/**
 * Read every Extractor JSON result, aggregate entities/topics across chunks, and
 * write/update entity pages, topic pages, and rolling memory.
 *
 * This is deterministic code: no LLM calls.
 *
 * Phase 5: returns the structured data for every entity/topic page written so
 * the optional Synthesis Writer can read it without re-parsing markdown.
 */
export async function materialize(wikiSlug: string, options?: MaterializeOptions): Promise<MaterializeResult> {
  const dir = wikiDir(options?.workspace, wikiSlug);
  const extractedDir = join(dir, '.state', 'extracted');
  let extractionFiles: string[];
  try {
    extractionFiles = (await readdir(extractedDir))
      .filter((name) => name.toLowerCase().endsWith('.json'))
      .sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      extractionFiles = [];
    } else {
      throw err;
    }
  }

  const entityMap = new Map<string, MaterializedEntity>();
  const topicMap = new Map<string, MaterializedTopic>();
  const sourceSlugs = new Set<string>();
  const folderStructure = new Set<string>();
  const chunkSources: Array<{ chunkId: string; file: string; pages: string }> = [];

  // Phase 8 (UAT fork fix, vision `03` §3.2 "The first folder assignment
  // wins" — applied ACROSS runs): the folder recorded in the PREVIOUS
  // rolling memory is canonical for every entity it already knows. A later
  // extraction that re-derives a different folder for the same slug must
  // NOT move the page or rewrite the memory (vision `04` §3.2 Step 6:
  // "For existing entities, load the current page, merge new data, and
  // rewrite" — the current page lives at the canonical folder).
  const previousMemory = await readFullRollingMemory(dir);
  const canonicalFolderBySlug = new Map<string, string>();
  for (const entry of previousMemory?.entities ?? []) {
    if (entry.folder.trim().length > 0 && !canonicalFolderBySlug.has(entry.slug)) {
      canonicalFolderBySlug.set(entry.slug, entry.folder);
    }
  }

  for (const fileName of extractionFiles) {
    const chunkId = fileName.replace(/\.json$/i, '');
    const sourceSlug = sourceSlugFromChunkId(chunkId);
    sourceSlugs.add(sourceSlug);

    const chunkSource = await loadChunkSource(dir, chunkId);
    if (!chunkSource || chunkSource.file === '' || chunkSource.pages === '') {
      // If the chunk source cannot be determined, skip this extraction file
      // so that the materializer never emits pages with broken citations.
      continue;
    }
    chunkSources.push({ chunkId, file: chunkSource.file, pages: chunkSource.pages });

    const raw = await readFile(join(extractedDir, fileName), 'utf-8');
    const extracted = JSON.parse(raw) as ExtractorResult;

    // Entities
    for (const entity of extracted.entities ?? []) {
      const existing = entityMap.get(entity.slug);
      // The canonical folder comes from the previous rolling memory when the
      // slug is already known there (cross-run "first folder assignment
      // wins"); otherwise the first in-run assignment wins (vision 03 §3.2).
      const effectiveFolder = canonicalFolderBySlug.get(entity.slug) ?? existing?.folder ?? entity.folder;
      const target: MaterializedEntity = existing ?? {
        name: entity.name,
        type: entity.type,
        folder: effectiveFolder,
        significance: entity.significance ?? '',
        disambiguation: entity.disambiguation,
        contexts: new Set<string>(),
        mentions: [],
        relationships: [],
        claims: [],
        timeline: [],
      };

      if (existing) {
        // First folder assignment wins (vision 03 §3.2 "The first folder assignment wins").
        // First significance/disambiguation wins too.
      } else {
        target.name = entity.name;
        target.type = entity.type;
        target.folder = effectiveFolder;
        target.significance = entity.significance ?? '';
        target.disambiguation = entity.disambiguation;
      }

      for (const mention of entity.mentions ?? []) {
        target.mentions.push({
          page: mention.page,
          context: mention.context,
          source: chunkSource.file,
          pages: chunkSource.pages,
        });
      }

      entityMap.set(entity.slug, target);
      // Only the entity's EFFECTIVE folder is recorded — a divergent folder
      // from a later extraction is never added on this entity's account.
      folderStructure.add(target.folder);
    }

    // Relationships (attached to the subject entity)
    for (const relationship of extracted.relationships ?? []) {
      const target = entityMap.get(relationship.subject);
      if (!target) {
        // Relationship references an unknown subject; skip it.
        continue;
      }
      target.relationships.push({
        subject: relationship.subject,
        predicate: relationship.predicate,
        object: relationship.object,
        evidence: relationship.evidence,
        page: relationship.page,
        source: chunkSource.file,
        pages: chunkSource.pages,
      });
    }

    // Claims (attached to every entity in the claim, plus topic grouping)
    for (const claim of extracted.claims ?? []) {
      const topicSlug = claim.type;
      const topicFolder = `topics/${topicSlug}`;
      const existingTopic = topicMap.get(topicSlug);
      const topic: MaterializedTopic = existingTopic ?? {
        title: claim.type
          .split('-')
          .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
          .join(' '),
        slug: topicSlug,
        folder: topicFolder,
        claims: [],
      };
      if (!existingTopic) {
        topicMap.set(topicSlug, topic);
        folderStructure.add(topicFolder);
      }
      topic.claims.push({
        text: claim.text,
        type: claim.type,
        entities: claim.entities ?? [],
        page: claim.page,
        source: chunkSource.file,
        pages: chunkSource.pages,
      });

      for (const entitySlug of claim.entities ?? []) {
        const target = entityMap.get(entitySlug);
        if (target) {
          target.claims.push({
            text: claim.text,
            type: claim.type,
            entities: claim.entities ?? [],
            page: claim.page,
            source: chunkSource.file,
            pages: chunkSource.pages,
          });
        }
      }
    }

    // Timeline and context (Phase 5: attach to relevant entities)
    if (extracted.context && extracted.context.trim().length > 0) {
      for (const entity of extracted.entities ?? []) {
        const target = entityMap.get(entity.slug);
        if (target) {
          target.contexts.add(extracted.context.trim());
        }
      }
    }

    for (const event of extracted.timeline ?? []) {
      for (const entitySlug of event.entities ?? []) {
        const target = entityMap.get(entitySlug);
        if (target) {
          target.timeline.push(event);
        }
      }
    }
  }

  // Build a slug-to-title map so wikilinks can render in Obsidian's native
  // pipe form [[slug|Page Title]] instead of [[slug]]. Unknown slugs fall back
  // to the bare [[slug]] form.
  const slugToTitle: Record<string, string> = {};
  for (const [slug, entity] of entityMap.entries()) {
    slugToTitle[slug] = entity.name;
  }

  const result: MaterializeResult = { entityPages: [], topicPages: [], documentPages: [], writtenPages: [], conflicts: [], removedDuplicates: [] };

  // Write entity pages (Phase 8 update mode: existing pages are re-derived
  // from the full extraction set, which IS the merge — mentions append
  // across chunks, relationships/claims dedupe by their content keys, and
  // the Sources section accumulates every contributing source file).
  for (const [slug, entity] of entityMap.entries()) {
    const folderPath = join(dir, entity.folder);
    await mkdir(folderPath, { recursive: true });

    const significance = entity.significance.trim();
    const disambiguation = entity.disambiguation?.trim();

    const pageData: EntityPageData = {
      title: entity.name,
      slug,
      folder: entity.folder,
      type: entity.type,
      wiki: wikiSlug,
      mentions: dedupeMentions(entity.mentions),
      relationships: dedupeRelationships(entity.relationships),
      claims: dedupeClaims(entity.claims),
      slugToTitle,
      significance: significance.length > 0 ? significance : undefined,
      disambiguation: disambiguation && disambiguation.length > 0 ? disambiguation : undefined,
      context: entity.contexts.size > 0 ? Array.from(entity.contexts).join('\n\n') : undefined,
      timeline: dedupeTimeline(entity.timeline).map((event) => ({
        date: event.date,
        event: event.event,
        entities: event.entities,
      })),
    };

    // Phase 8 §2.5: never overwrite a manually-edited page. The conflict is
    // logged and the page is excluded from the result so the Synthesis
    // Writer does not overwrite it either.
    const pagePath = join(folderPath, `${slug}.md`);
    const relativePath = wikiRelativePath(entity.folder, `${slug}.md`);
    if ((await checkPageConflict(pagePath, relativePath, options?.pageHashes)) === 'conflict') {
      await logManualEditConflict(dir, relativePath);
      result.conflicts.push(relativePath);
      continue;
    }

    const rendered = writeEntityPage(pageData);
    result.entityPages.push(pageData);
    await writeFile(pagePath, rendered, 'utf-8');
    result.writtenPages.push({ path: relativePath, hash: hashContent(rendered) });
  }

  // Phase 8 (UAT fork-reconciliation fix): a page for the same slug at any
  // OTHER folder than the canonical one is a duplicate left behind by a
  // forked run. Unmodified duplicates (on-disk hash still matches the hash
  // recorded at the last ingestion) are tool writes and are DELETED, so one
  // more ingest repairs an already-forked wiki. Duplicates that were
  // manually edited (hash mismatch) or have no recorded hash are KEPT and
  // surfaced as manual-edit conflicts for the journalist to review.
  // Empty parent folders left behind are fine: the DOX Writer regenerates
  // folder contracts deterministically.
  if (entityMap.size > 0) {
    const entitiesRoot = join(dir, 'entities');
    const slugLocations = new Map<string, string[]>();
    if (existsSync(entitiesRoot)) {
      await collectEntityPageLocations(entitiesRoot, '', slugLocations);
    }
    for (const [slug, entity] of entityMap.entries()) {
      const canonicalPath = wikiRelativePath(entity.folder, `${slug}.md`);
      for (const location of slugLocations.get(slug) ?? []) {
        if (location === canonicalPath) {
          continue;
        }
        const recorded = options?.pageHashes?.[location];
        const currentHash = hashContent(await readFile(join(dir, location), 'utf-8'));
        if (recorded !== undefined && recorded === currentHash) {
          await rm(join(dir, location), { force: true });
          result.removedDuplicates.push({ path: location, canonicalPath });
        } else {
          await logManualEditConflict(
            dir,
            location,
            `Duplicate page for '${slug}' (entity now lives at ${canonicalPath}) was manually edited or has no recorded hash. Kept for review.`,
          );
        }
      }
    }
  }

  // Write topic pages
  for (const topic of topicMap.values()) {
    const folderPath = join(dir, topic.folder);
    await mkdir(folderPath, { recursive: true });

    const topicClaims = dedupeClaims(topic.claims);
    const topicEntities = Array.from(
      new Set(topicClaims.flatMap((claim) => claim.entities.map((e) => slugToTitle[e] ?? e))),
    ).sort();

    const pageData: TopicPageData = {
      title: topic.title,
      slug: topic.slug,
      folder: topic.folder,
      wiki: wikiSlug,
      claims: topicClaims,
      slugToTitle,
      entities: topicEntities,
    };

    const pagePath = join(folderPath, `${topic.slug}.md`);
    const relativePath = wikiRelativePath(topic.folder, `${topic.slug}.md`);
    if ((await checkPageConflict(pagePath, relativePath, options?.pageHashes)) === 'conflict') {
      await logManualEditConflict(dir, relativePath);
      result.conflicts.push(relativePath);
      continue;
    }

    const rendered = writeTopicPage(pageData);
    result.topicPages.push(pageData);
    await writeFile(pagePath, rendered, 'utf-8');
    result.writtenPages.push({ path: relativePath, hash: hashContent(rendered) });
  }

  // Build document page data for optional synthesis (Phase 5+)
  for (const { chunkId, file, pages } of chunkSources) {
    const extractionPath = join(extractedDir, `${chunkId}.json`);
    let extracted: ExtractorResult;
    try {
      const raw = await readFile(extractionPath, 'utf-8');
      extracted = JSON.parse(raw) as ExtractorResult;
    } catch {
      continue;
    }

    const documentPath = join(dir, 'documents', `${chunkId}.md`);
    let documentRaw: string;
    try {
      documentRaw = await readFile(documentPath, 'utf-8');
    } catch {
      continue;
    }
    const parsed = matter(documentRaw);
    const entitySlugs = new Set<string>();
    for (const entity of extracted.entities ?? []) {
      entitySlugs.add(entity.slug);
    }
    for (const claim of extracted.claims ?? []) {
      for (const slug of claim.entities ?? []) {
        entitySlugs.add(slug);
      }
    }

    result.documentPages.push({
      title: chunkId,
      slug: chunkId,
      folder: 'documents',
      wiki: wikiSlug,
      source: file,
      pages,
      extractedText: parsed.content,
      entitySlugs: Array.from(entitySlugs),
      slugToTitle,
      claims: (extracted.claims ?? []).map((claim) => ({
        text: claim.text,
        type: claim.type,
        entities: claim.entities ?? [],
        page: claim.page,
      })),
    });
  }

  // Update rolling memory
  const memory: RollingMemory = {
    entities: Array.from(entityMap.entries())
      .map(([slug, entity]) => ({
        slug,
        folder: entity.folder,
        mentionCount: entity.mentions.length,
      }))
      .sort((a, b) => a.slug.localeCompare(b.slug)),
    topics: Array.from(topicMap.values())
      .map((topic) => topic.folder.replace(/^topics\//, ''))
      .sort((a, b) => a.localeCompare(b)),
    sources: Array.from(sourceSlugs).sort((a, b) => a.localeCompare(b)),
    folderStructure: Array.from(folderStructure).sort((a, b) => a.localeCompare(b)),
  };

  // Phase 9 (vision `03` §5): log structural changes for after-the-fact human
  // review — folders and entity page types that did not exist before this run.
  // Diffed against the PREVIOUS rolling memory (folders; loaded at the top of
  // this run for the canonical-folder rule) and the additive knownPageTypes
  // tracker in the log itself (types), so a folder/type is logged exactly
  // once, the first time it appears.
  const previousFolders = new Set(previousMemory?.folderStructure ?? []);
  const { knownPageTypes } = await readStructuralChanges(dir);
  const knownTypes = new Set(knownPageTypes);
  const structuralTimestamp = new Date().toISOString();
  const structuralChanges: StructuralChange[] = [];
  const newlySeenPageTypes: string[] = [];

  for (const folder of memory.folderStructure) {
    if (previousFolders.has(folder)) {
      continue;
    }
    if (folder.startsWith('topics/')) {
      const topic = Array.from(topicMap.values()).find((t) => t.folder === folder);
      const claimEntities = topic
        ? Array.from(new Set(topic.claims.flatMap((claim) => claim.entities))).sort((a, b) => a.localeCompare(b))
        : [];
      structuralChanges.push({
        timestamp: structuralTimestamp,
        type: 'new-folder',
        path: folder,
        reason: topic
          ? `Topic page '${topic.slug}' created from claims of type '${topic.slug}'`
          : `Topic folder created from extracted claims`,
        ...(claimEntities.length > 0 ? { affectedEntities: claimEntities } : {}),
      });
    } else {
      const folderEntities = Array.from(entityMap.entries())
        .filter(([, entity]) => entity.folder === folder)
        .map(([slug]) => slug)
        .sort((a, b) => a.localeCompare(b));
      structuralChanges.push({
        timestamp: structuralTimestamp,
        type: 'new-folder',
        path: folder,
        reason: `${folderEntities.length} ${folderEntities.length === 1 ? 'entity' : 'entities'} placed in this folder`,
        ...(folderEntities.length > 0 ? { affectedEntities: folderEntities } : {}),
      });
    }
  }

  const typesSeen = new Set<string>();
  for (const entity of entityMap.values()) {
    typesSeen.add(entity.type);
  }
  for (const type of Array.from(typesSeen).sort((a, b) => a.localeCompare(b))) {
    if (knownTypes.has(type)) {
      continue;
    }
    newlySeenPageTypes.push(type);
    const typeEntities = Array.from(entityMap.entries())
      .filter(([, entity]) => entity.type === type)
      .map(([slug]) => slug)
      .sort((a, b) => a.localeCompare(b));
    structuralChanges.push({
      timestamp: structuralTimestamp,
      type: 'new-page-type',
      path: type,
      reason: `New entity page type '${type}' discovered during extraction`,
      ...(typeEntities.length > 0 ? { affectedEntities: typeEntities } : {}),
    });
  }

  await logStructuralChanges(dir, structuralChanges, newlySeenPageTypes);

  await saveRollingMemory(dir, memory);
  return result;
}
