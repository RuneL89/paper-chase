import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';
import { wikiDir } from './utils/paths';
import { writeEntityPage, type EntityPageData } from './pages/entity-page';
import { writeTopicPage, type TopicPageData } from './pages/topic-page';
import { saveRollingMemory, type RollingMemory } from './state/rolling-memory';
import type {
  ExtractorEntity,
  ExtractorRelationship,
  ExtractorClaim,
  ExtractorResult,
} from './agents/extractor';

export interface MaterializeOptions {
  workspace?: string;
}

interface MaterializedEntity {
  name: string;
  type: string;
  folder: string;
  mentions: EntityPageData['mentions'];
  relationships: EntityPageData['relationships'];
  claims: EntityPageData['claims'];
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

/**
 * Read every Extractor JSON result, aggregate entities/topics across chunks, and
 * write/update entity pages, topic pages, and rolling memory.
 *
 * This is deterministic code: no LLM calls.
 */
export async function materialize(wikiSlug: string, options?: MaterializeOptions): Promise<void> {
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

    const raw = await readFile(join(extractedDir, fileName), 'utf-8');
    const extracted = JSON.parse(raw) as ExtractorResult;

    // Entities
    for (const entity of extracted.entities ?? []) {
      const existing = entityMap.get(entity.slug);
      const target: MaterializedEntity = existing ?? {
        name: entity.name,
        type: entity.type,
        folder: entity.folder,
        mentions: [],
        relationships: [],
        claims: [],
      };

      if (existing) {
        // First folder assignment wins (vision 03 §3.2 "The first folder assignment wins").
      } else {
        target.name = entity.name;
        target.type = entity.type;
        target.folder = entity.folder;
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
      folderStructure.add(entity.folder);
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
  }

  // Build a slug-to-title map so wikilinks can render as [[Page Title]]
  // instead of [[slug]]. Unknown slugs fall back to the raw slug.
  const slugToTitle: Record<string, string> = {};
  for (const [slug, entity] of entityMap.entries()) {
    slugToTitle[slug] = entity.name;
  }

  // Write entity pages
  for (const [slug, entity] of entityMap.entries()) {
    const folderPath = join(dir, entity.folder);
    await mkdir(folderPath, { recursive: true });

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
    };

    await writeFile(join(folderPath, `${slug}.md`), writeEntityPage(pageData), 'utf-8');
  }

  // Write topic pages
  for (const topic of topicMap.values()) {
    const folderPath = join(dir, topic.folder);
    await mkdir(folderPath, { recursive: true });

    const pageData: TopicPageData = {
      title: topic.title,
      slug: topic.slug,
      folder: topic.folder,
      wiki: wikiSlug,
      claims: dedupeClaims(topic.claims),
      slugToTitle,
    };

    await writeFile(join(folderPath, `${topic.slug}.md`), writeTopicPage(pageData), 'utf-8');
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

  await saveRollingMemory(dir, memory);
}
