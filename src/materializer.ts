import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import { wikiDir, wikiRelativePath } from './utils/paths';
import { writeEntityPage, isSparseEntity, type EntityPageData, type EntityPageIncomingRelationship } from './pages/entity-page';
import { writeTopicPage, type TopicPageData } from './pages/topic-page';
import { type DocumentPageData } from './pages/document-page';
import { saveRollingMemory, readFullRollingMemory, type RollingMemory } from './state/rolling-memory';
import { logStructuralChanges, readStructuralChanges, type StructuralChange } from './state/structural-changes';
import { logManualEditConflict } from './state/conflicts';
import { readCurationOverrides } from './state/curation-overrides';
import { writeCurationReport } from './state/curation-report';
import { isSkipEligible, pageDataHash, readSynthesisState, synthesisPagePath } from './state/synthesis-state';
import {
  curateEntities,
  curateTopics,
  truncateSample,
  type CurateCallOptions,
  type CurationFallbackCause,
  type CurationMergeDecision,
  type EntityCurationCandidate,
  type EntityCurationOutcome,
  type TopicCurationCandidate,
  type TopicCurationOutcome,
} from './agents/curation';
import { rewriteWikilinkTargets, type WikilinkRewrite } from './utils/wikilinks';
import type { LanguageCode } from './utils/language';
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
  /**
   * Phase 14 (phase doc §2.4): run the topic & entity curation stage between
   * aggregation and page writes (aggregate → curate → apply → write). Follows
   * the synthesis enablement — the caller passes the ingest run's `synthesis`
   * flag. Absent/false (or no extraction data, or nothing to curate) keeps
   * materialize() byte-identical to pre-Phase-14.
   */
  curation?: boolean;
  /** Phase 14: the run's language pair, forwarded to the curation prompts. */
  language?: { input: LanguageCode; output: LanguageCode };
  /**
   * Phase 14 test seams (the `writeDoxIndexFn` precedent): injected curation
   * implementations keep every gate LLM-free. Default to the real calls.
   */
  curateTopicsFn?: (candidates: TopicCurationCandidate[], options: CurateCallOptions) => Promise<TopicCurationOutcome>;
  curateEntitiesFn?: (candidates: EntityCurationCandidate[], options: CurateCallOptions) => Promise<EntityCurationOutcome>;
}

/**
 * Phase 14 (phase doc §2.4/§2.7): the curation stage's per-materialize
 * summary, present on MaterializeResult only when the stage ran.
 */
export interface CurationSummary {
  ran: true;
  /** Applied (post manual-edit veto) decision lists. */
  topicMerges: CurationMergeDecision[];
  topicDrops: string[];
  entityMerges: CurationMergeDecision[];
  /** Keep-all fallback events across both concerns (console-warned too). */
  fallbacks: Array<{ concern: 'topics' | 'entities'; scope: string; cause: CurationFallbackCause }>;
  attempts: { topics: number; entities: number };
  /** neverMerge pairs vetoed into keep during validation. */
  vetoes: Array<{ concern: 'topics' | 'entities'; from: string; into: string }>;
  /** Manually-edited/untracked from-pages kept out of a merge/drop. */
  manualEditSkips: Array<{ page: string; concern: 'topics' | 'entities'; action: 'merge' | 'drop' }>;
  /** On-disk pages deleted because their slug was merged away/dropped. */
  removedPages: string[];
  /** Pre-existing pages whose wikilinks were rewritten to canonical slugs. */
  rewrittenLinks: Array<{ path: string; hash: string }>;
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
   * Phase 16 (vision `04` Step 9 synthesis resume): entity/topic pages that
   * were NOT rewritten because a skip-eligible `.state/synthesis-state.json`
   * record (strict/permissive pass with a matching aggregate fingerprint)
   * covers them — the finished synthesized page is preserved byte-for-byte.
   * The pages still appear in `entityPages`/`topicPages` (the ingest skip
   * rule needs their data); the hash is the page's current on-disk content
   * hash so the recorded page hashes converge to truth. Empty when no
   * synthesis records exist — the byte-identical pre-Phase-16 path.
   */
  preservedPages: Array<{ path: string; hash: string }>;
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
  /**
   * Phase 14 (phase doc §2.4): curation stage summary — applied merges/drops,
   * fallback events, manual-edit skips, deletions, rewritten links. Absent
   * when curation did not run (disabled, no extraction data, or no
   * candidates), which is the byte-identical pre-Phase-14 path.
   */
  curation?: CurationSummary;
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
  /** Phase 17 (B10): relationships naming this entity as the OBJECT. */
  incomingRelationships: EntityPageIncomingRelationship[];
  claims: EntityPageData['claims'];
  timeline: ExtractorTimelineEvent[];
  /** Phase 14 (phase doc §2.3): variant titles accumulated by curation merges. */
  aliases: string[];
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

/**
 * Phase 17 (B10): the incoming mirror of `dedupeRelationships` — the object
 * side carries no `object` field (it is the page's own entity), so the key
 * drops it. Same evidence-insensitive semantics as the outgoing dedupe.
 */
function dedupeIncomingRelationships(list: EntityPageIncomingRelationship[]): EntityPageIncomingRelationship[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    const key = `${item.subject}|${item.predicate}|${item.page}|${item.source}|${item.pages}`;
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

// ---------------------------------------------------------------------------
// Phase 14 curation stage helpers (phase doc §2.2–§2.5)
// ---------------------------------------------------------------------------

/** Genericized page-location walk for the curation on-disk scans. */
async function collectSectionPageLocations(
  root: string,
  section: 'entities' | 'topics',
  relPrefix: string,
  out: Map<string, string[]>,
): Promise<void> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const rel = relPrefix === '' ? entry.name : `${relPrefix}/${entry.name}`;
    if (entry.isDirectory()) {
      await collectSectionPageLocations(join(root, entry.name), section, rel, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md') && entry.name.toLowerCase() !== 'index.md') {
      const slug = entry.name.replace(/\.md$/i, '');
      const list = out.get(slug) ?? [];
      list.push(`${section}/${rel}`);
      out.set(slug, list);
    }
  }
}

/** All content pages (.md, not index.md) under a section, as wiki-relative paths. */
async function collectContentPagePaths(root: string, section: string, relPrefix: string, out: string[]): Promise<void> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const rel = relPrefix === '' ? entry.name : `${relPrefix}/${entry.name}`;
    if (entry.isDirectory()) {
      await collectContentPagePaths(join(root, entry.name), section, rel, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md') && entry.name.toLowerCase() !== 'index.md') {
      out.push(`${section}/${rel}`);
    }
  }
}

/** Bullet lines of a `## <section>` body (up to the next `## ` heading). */
function extractSectionBullets(content: string, section: string): string[] {
  const bullets: string[] = [];
  let inSection = false;
  for (const line of content.split('\n')) {
    if (/^##\s+/.test(line)) {
      inSection = line.trim() === `## ${section}`;
      continue;
    }
    if (inSection && line.startsWith('- ')) {
      bullets.push(line.slice(2).trim());
    }
  }
  return bullets;
}

/** `- Page 3: "context" [^src1]` -> `context` (falls back to the raw bullet). */
function extractMentionContext(bullet: string): string {
  const match = /^Page \d+:\s+"(.*)"\s*(?:\[\^src\d+\])?$/.exec(bullet);
  return (match?.[1] ?? bullet).trim();
}

function stripCitationMarkers(text: string): string {
  return text.replace(/\[\^src\d+\]/g, '').trim();
}

/** The aggregation's topic-title rule, factored for the candidate builders. */
function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

interface OnDiskEntityMeta {
  locations: string[];
  folder: string;
  title: string;
  type: string;
  mentionCount: number;
  mentionSamples: string[];
}

interface OnDiskTopicMeta {
  locations: string[];
  folder: string;
  title: string;
  claimCount: number;
  claimSamples: string[];
}

function folderOfLocation(relPath: string): string {
  return relPath.split('/').slice(0, -1).join('/');
}

/**
 * Read the curation-relevant metadata of an on-disk entity page (frontmatter
 * title/tags + Mentions-section samples). Best-effort: unparseable pages
 * contribute locations only.
 */
async function readOnDiskEntityMeta(dir: string, locations: string[]): Promise<OnDiskEntityMeta> {
  const meta: OnDiskEntityMeta = {
    locations,
    folder: folderOfLocation(locations[0]),
    title: '',
    type: 'unknown',
    mentionCount: 0,
    mentionSamples: [],
  };
  try {
    const parsed = matter(await readFile(join(dir, locations[0]), 'utf-8'));
    if (typeof parsed.data.title === 'string') {
      meta.title = parsed.data.title;
    }
    const tags = Array.isArray(parsed.data.tags)
      ? parsed.data.tags.filter((tag): tag is string => typeof tag === 'string')
      : [];
    if (tags.length > 0) {
      meta.type = tags[0];
    }
    const bullets = extractSectionBullets(parsed.content, 'Mentions');
    meta.mentionCount = bullets.length;
    meta.mentionSamples = bullets.slice(0, 2).map(extractMentionContext);
  } catch {
    // Unreadable/unparseable page — locations alone still drive deletions.
  }
  return meta;
}

/** Read the curation-relevant metadata of an on-disk topic page. */
async function readOnDiskTopicMeta(dir: string, locations: string[]): Promise<OnDiskTopicMeta> {
  const meta: OnDiskTopicMeta = {
    locations,
    folder: folderOfLocation(locations[0]),
    title: '',
    claimCount: 0,
    claimSamples: [],
  };
  try {
    const parsed = matter(await readFile(join(dir, locations[0]), 'utf-8'));
    if (typeof parsed.data.title === 'string') {
      meta.title = parsed.data.title;
    }
    const bullets = extractSectionBullets(parsed.content, 'Claims');
    meta.claimCount = bullets.length;
    meta.claimSamples = bullets.slice(0, 3).map(stripCitationMarkers);
  } catch {
    // Unreadable/unparseable page — locations alone still drive deletions.
  }
  return meta;
}

/**
 * Build the topic curation input (phase doc §2.2): every aggregated candidate
 * AND every on-disk-only topic (the self-healing property — update runs
 * re-curate the full set).
 */
function buildTopicCandidates(
  topicMap: Map<string, MaterializedTopic>,
  onDiskTopics: Map<string, OnDiskTopicMeta>,
): TopicCurationCandidate[] {
  const candidates: TopicCurationCandidate[] = [];
  for (const topic of topicMap.values()) {
    const claims = dedupeClaims(topic.claims);
    candidates.push({
      slug: topic.slug,
      title: topic.title,
      folder: topic.folder,
      claimCount: claims.length,
      sampleClaims: claims.slice(0, 3).map((claim) => truncateSample(claim.text)),
      onDisk: onDiskTopics.has(topic.slug),
    });
  }
  for (const [slug, meta] of Array.from(onDiskTopics.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    if (topicMap.has(slug)) {
      continue;
    }
    candidates.push({
      slug,
      title: meta.title !== '' ? meta.title : titleCaseSlug(slug),
      folder: meta.folder,
      claimCount: meta.claimCount,
      sampleClaims: meta.claimSamples.map((sample) => truncateSample(sample)),
      onDisk: true,
    });
  }
  return candidates;
}

/** Build the entity curation input (phase doc §2.2), same on-disk union rule. */
function buildEntityCandidates(
  entityMap: Map<string, MaterializedEntity>,
  onDiskEntities: Map<string, OnDiskEntityMeta>,
): EntityCurationCandidate[] {
  const candidates: EntityCurationCandidate[] = [];
  for (const [slug, entity] of entityMap.entries()) {
    const mentions = dedupeMentions(entity.mentions);
    candidates.push({
      slug,
      title: entity.name,
      type: entity.type,
      folder: entity.folder,
      mentionCount: mentions.length,
      significance: entity.significance,
      disambiguation: entity.disambiguation,
      sampleMentions: mentions.slice(0, 2).map((mention) => truncateSample(mention.context)),
      onDisk: onDiskEntities.has(slug),
    });
  }
  for (const [slug, meta] of Array.from(onDiskEntities.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    if (entityMap.has(slug)) {
      continue;
    }
    candidates.push({
      slug,
      title: meta.title !== '' ? meta.title : titleCaseSlug(slug),
      type: meta.type,
      folder: meta.folder,
      mentionCount: meta.mentionCount,
      significance: '',
      sampleMentions: meta.mentionSamples.map((sample) => truncateSample(sample)),
      onDisk: true,
    });
  }
  return candidates;
}

/**
 * A folder is removable when it contains only `index.md` contracts (the DOX
 * Writer regenerates them deterministically) and removable subfolders.
 */
async function folderIsRemovable(path: string): Promise<boolean> {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!(await folderIsRemovable(join(path, entry.name)))) {
        return false;
      }
    } else if (!(entry.isFile() && entry.name.toLowerCase() === 'index.md')) {
      return false;
    }
  }
  return true;
}

/**
 * Phase 14 (phase doc §2.5 + gate 14.9): delete the now-empty folder chain
 * left behind by a deleted page, walking up from the page's folder to (but
 * never including) the section root (`entities/` / `topics/`).
 */
async function pruneEmptyFolderChain(sectionRoot: string, startFolder: string): Promise<void> {
  let current = startFolder;
  while (current !== sectionRoot && current.startsWith(sectionRoot)) {
    if (!(await folderIsRemovable(current))) {
      break;
    }
    await rm(current, { recursive: true, force: true });
    current = dirname(current);
  }
}

const EMPTY_OUTCOME: { merges: CurationMergeDecision[]; drops: string[]; keep: string[] } = {
  merges: [],
  drops: [],
  keep: [],
};

function emptyCurationOutcome(): TopicCurationOutcome & EntityCurationOutcome {
  return { decisions: { ...EMPTY_OUTCOME }, attempts: 0, fallbacks: [], vetoes: [] };
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
        incomingRelationships: [],
        claims: [],
        timeline: [],
        aliases: [],
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

    // Phase 17 (B10, vision `02` §4.3 B "relationships must be
    // bidirectional"): mirror the subject-attach loop — attach an INCOMING
    // record to the OBJECT entity's page data so the object page tells its
    // side of the story. Same skip-on-unknown guard; a self-loop attaches
    // ONCE, as outgoing only (the claims multi-attach at ~707 is the
    // precedent). Curation slug remaps (below) run before page assembly, so
    // incoming records carry canonical slugs.
    for (const relationship of extracted.relationships ?? []) {
      if (relationship.object === relationship.subject) {
        continue;
      }
      const target = entityMap.get(relationship.object);
      if (!target) {
        // Relationship references an unknown object; skip it.
        continue;
      }
      target.incomingRelationships.push({
        subject: relationship.subject,
        predicate: relationship.predicate,
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

  // ------------------------------------------------------------------
  // Phase 14 (phase doc §2.2–§2.5, vision `04` §3.2 Step 6): CURATE.
  // Aggregation is complete in memory; before any page write, the two
  // curation calls (topics + entities, in parallel) return validated
  // decision lists that are applied deterministically below. Skipped
  // transparently unless the caller enabled it (the ingest run's synthesis
  // flag) AND extraction data exists AND there is at least one candidate —
  // every skip path is byte-identical to pre-Phase-14 (gate 14.14).
  // ------------------------------------------------------------------
  const entitySlugRemap = new Map<string, string>();
  const mergeRewrites = new Map<string, WikilinkRewrite>();
  let curationSummary: CurationSummary | null = null;
  let topicOutcome: TopicCurationOutcome | null = null;
  let entityOutcome: EntityCurationOutcome | null = null;

  if (options?.curation === true && extractionFiles.length > 0) {
    // On-disk scans: the input includes the existing sets so update runs
    // re-curate everything (self-healing after a fallback).
    const entityLocations = new Map<string, string[]>();
    const entitiesRoot = join(dir, 'entities');
    if (existsSync(entitiesRoot)) {
      await collectSectionPageLocations(entitiesRoot, 'entities', '', entityLocations);
    }
    const topicLocations = new Map<string, string[]>();
    const topicsRoot = join(dir, 'topics');
    if (existsSync(topicsRoot)) {
      await collectSectionPageLocations(topicsRoot, 'topics', '', topicLocations);
    }
    const onDiskEntities = new Map<string, OnDiskEntityMeta>();
    for (const [slug, locations] of entityLocations.entries()) {
      onDiskEntities.set(slug, await readOnDiskEntityMeta(dir, locations));
    }
    const onDiskTopics = new Map<string, OnDiskTopicMeta>();
    for (const [slug, locations] of topicLocations.entries()) {
      onDiskTopics.set(slug, await readOnDiskTopicMeta(dir, locations));
    }

    const topicCandidates = buildTopicCandidates(topicMap, onDiskTopics);
    const entityCandidates = buildEntityCandidates(entityMap, onDiskEntities);

    if (topicCandidates.length + entityCandidates.length > 0) {
      const overrides = await readCurationOverrides(dir);
      let agentsMd = '';
      try {
        agentsMd = await readFile(join(dir, 'AGENTS.md'), 'utf-8');
      } catch {
        // Best-effort — the prompt carries a placeholder when absent.
      }
      const callOptions: CurateCallOptions = {
        agentsMd,
        language: options?.language,
        logPath: join(dir, '.state', 'llm-calls.json'),
        neverMerge: overrides.neverMerge,
      };
      const topicsFn = options?.curateTopicsFn ?? curateTopics;
      const entitiesFn = options?.curateEntitiesFn ?? curateEntities;
      [topicOutcome, entityOutcome] = await Promise.all([
        topicCandidates.length > 0
          ? topicsFn(topicCandidates, callOptions)
          : Promise.resolve<TopicCurationOutcome>(emptyCurationOutcome()),
        entityCandidates.length > 0
          ? entitiesFn(entityCandidates, callOptions)
          : Promise.resolve<EntityCurationOutcome>(emptyCurationOutcome()),
      ]);

      for (const fallback of topicOutcome.fallbacks) {
        console.warn(
          `Warning: topic curation keep-all fallback at ${fallback.scope} (${fallback.cause}) — all topic candidates written as-is.`,
        );
      }
      for (const fallback of entityOutcome.fallbacks) {
        console.warn(
          `Warning: entity curation keep-all fallback at ${fallback.scope} (${fallback.cause}) — all entity candidates written as-is.`,
        );
      }

      // Keep-all fallback: a null decision list means write every candidate
      // exactly as pre-Phase-14 (the empty-applied list below).
      const topicDecisions = topicOutcome.decisions ?? {
        ...EMPTY_OUTCOME,
        keep: topicCandidates.map((candidate) => candidate.slug),
      };
      const entityDecisions = entityOutcome.decisions ?? {
        ...EMPTY_OUTCOME,
        keep: entityCandidates.map((candidate) => candidate.slug),
      };

      curationSummary = {
        ran: true,
        topicMerges: [],
        topicDrops: [],
        entityMerges: [],
        fallbacks: [
          ...topicOutcome.fallbacks.map((f) => ({ concern: 'topics' as const, scope: f.scope, cause: f.cause })),
          ...entityOutcome.fallbacks.map((f) => ({ concern: 'entities' as const, scope: f.scope, cause: f.cause })),
        ],
        attempts: { topics: topicOutcome.attempts, entities: entityOutcome.attempts },
        vetoes: [
          ...topicOutcome.vetoes.map((v) => ({ concern: 'topics' as const, from: v.from, into: v.into })),
          ...entityOutcome.vetoes.map((v) => ({ concern: 'entities' as const, from: v.from, into: v.into })),
        ],
        manualEditSkips: [],
        removedPages: [],
        rewrittenLinks: [],
      };

      // Manual-edit veto filter (phase doc §2.5): a from-page whose on-disk
      // content no longer matches its recorded hash — or that has no recorded
      // hash (the fork-reconciliation precedent treats untracked pages as
      // manual edits) — is SKIPPED, logged as a conflict, and its decision is
      // vetoed; the slug is treated as keep for the rest of the application.
      const pageHashes = options?.pageHashes;
      const isVetoedLocation = async (relPath: string): Promise<boolean> => {
        if (!pageHashes) {
          return false;
        }
        const absolute = join(dir, relPath);
        if (!existsSync(absolute)) {
          return false;
        }
        const recorded = pageHashes[relPath];
        if (recorded === undefined) {
          return true;
        }
        return hashContent(await readFile(absolute, 'utf-8')) !== recorded;
      };
      const summary = curationSummary;
      const filterMerges = async (
        merges: CurationMergeDecision[],
        locations: Map<string, string[]>,
        concern: 'topics' | 'entities',
        intoLabel: string,
      ): Promise<CurationMergeDecision[]> => {
        const filtered: CurationMergeDecision[] = [];
        for (const merge of merges) {
          const keptFrom: string[] = [];
          for (const from of merge.from) {
            let vetoed = false;
            for (const location of locations.get(from) ?? []) {
              if (await isVetoedLocation(location)) {
                vetoed = true;
                await logManualEditConflict(
                  dir,
                  location,
                  `Curation ${concern} merge of '${from}' into '${merge.into}' (${intoLabel}) skipped: page was manually edited or has no recorded hash. Kept for review.`,
                );
                summary.manualEditSkips.push({ page: location, concern, action: 'merge' });
              }
            }
            if (!vetoed) {
              keptFrom.push(from);
            }
          }
          if (keptFrom.length > 0) {
            filtered.push({ from: keptFrom, into: merge.into });
          }
        }
        return filtered;
      };
      const filterDrops = async (
        drops: string[],
        locations: Map<string, string[]>,
      ): Promise<string[]> => {
        const filtered: string[] = [];
        for (const slug of drops) {
          let vetoed = false;
          for (const location of locations.get(slug) ?? []) {
            if (await isVetoedLocation(location)) {
              vetoed = true;
              await logManualEditConflict(
                dir,
                location,
                `Curation topic drop of '${slug}' skipped: page was manually edited or has no recorded hash. Kept for review.`,
              );
              summary.manualEditSkips.push({ page: location, concern: 'topics', action: 'drop' });
            }
          }
          if (!vetoed) {
            filtered.push(slug);
          }
        }
        return filtered;
      };

      const appliedEntityMerges = await filterMerges(entityDecisions.merges, entityLocations, 'entities', 'entity');
      const appliedTopicMerges = await filterMerges(topicDecisions.merges, topicLocations, 'topics', 'topic');
      const appliedTopicDrops = await filterDrops(topicDecisions.drops, topicLocations);

      // ---- APPLY (phase doc §2.3, deterministic, all-or-nothing per the
      // validated lists) ----
      const entityTitleBySlug = new Map(entityCandidates.map((candidate) => [candidate.slug, candidate.title]));
      for (const merge of appliedEntityMerges) {
        let intoEntity = entityMap.get(merge.into);
        if (!intoEntity) {
          // An on-disk-only merge target gets a synthesized aggregate so the
          // survivor page is (re-)written with the unioned content.
          const candidate = entityCandidates.find((entry) => entry.slug === merge.into);
          intoEntity = {
            name: candidate?.title ?? titleCaseSlug(merge.into),
            type: candidate?.type ?? 'unknown',
            folder: candidate?.folder ?? 'entities',
            significance: candidate?.significance ?? '',
            disambiguation: candidate?.disambiguation,
            contexts: new Set<string>(),
            mentions: [],
            relationships: [],
            incomingRelationships: [],
            claims: [],
            timeline: [],
            aliases: [],
          };
          entityMap.set(merge.into, intoEntity);
        }
        for (const from of merge.from) {
          const fromEntity = entityMap.get(from);
          if (fromEntity) {
            // Union everything; the write loops dedupe by the existing keys.
            intoEntity.mentions.push(...fromEntity.mentions);
            intoEntity.relationships.push(...fromEntity.relationships);
            // Phase 17 (B10): incoming records union too — the survivor
            // inherits every relationship that named a merged-away fork.
            intoEntity.incomingRelationships.push(...fromEntity.incomingRelationships);
            intoEntity.claims.push(...fromEntity.claims);
            intoEntity.timeline.push(...fromEntity.timeline);
            for (const context of fromEntity.contexts) {
              intoEntity.contexts.add(context);
            }
            intoEntity.aliases.push(...fromEntity.aliases);
            entityMap.delete(from);
          }
          // Every merged variant title becomes an alias of the canonical page.
          const variantTitle = fromEntity?.name ?? entityTitleBySlug.get(from) ?? titleCaseSlug(from);
          intoEntity.aliases.push(variantTitle);
          entitySlugRemap.set(from, merge.into);
          mergeRewrites.set(from, { into: merge.into, fromTitle: variantTitle });
        }
        intoEntity.aliases = Array.from(new Set(intoEntity.aliases));
      }

      for (const merge of appliedTopicMerges) {
        let intoTopic = topicMap.get(merge.into);
        if (!intoTopic) {
          const candidate = topicCandidates.find((entry) => entry.slug === merge.into);
          intoTopic = {
            title: candidate?.title ?? titleCaseSlug(merge.into),
            slug: merge.into,
            folder: candidate?.folder ?? `topics/${merge.into}`,
            claims: [],
          };
          topicMap.set(merge.into, intoTopic);
        }
        for (const from of merge.from) {
          const fromTopic = topicMap.get(from);
          if (fromTopic) {
            // Union claims; identical claim TEXTS are deduped (phase doc
            // §2.3 — the same claim filed under two duplicate topic types is
            // one claim in the merged topic; the write-time composite-key
            // dedupe cannot catch it because the type field differs).
            const knownTexts = new Set(intoTopic.claims.map((claim) => claim.text));
            for (const claim of fromTopic.claims) {
              if (!knownTexts.has(claim.text)) {
                knownTexts.add(claim.text);
                intoTopic.claims.push(claim);
              }
            }
            topicMap.delete(from);
          }
          // Merged topic pages are deleted below, so links pointing at them
          // are repointed exactly like entity links (§2.3: the rewrite pass
          // covers from-slug/into-slug of BOTH concerns across all content
          // pages). Structured-reference remapping stays entity-only.
          const fromTitle =
            fromTopic?.title
            ?? topicCandidates.find((entry) => entry.slug === from)?.title
            ?? titleCaseSlug(from);
          mergeRewrites.set(from, { into: merge.into, fromTitle });
        }
      }
      for (const drop of appliedTopicDrops) {
        // The claims themselves stay on their entity/document pages
        // (preservation contract); only the topic grouping is discarded.
        topicMap.delete(drop);
      }

      // Repoint every structured reference to a merged-away entity slug:
      // relationship subject/object across ALL entities, claim entity lists,
      // timeline event entity lists (self-loops kept — the union is literal).
      if (entitySlugRemap.size > 0) {
        const remapList = (slugs: string[]): string[] =>
          Array.from(new Set(slugs.map((slug) => entitySlugRemap.get(slug) ?? slug)));
        for (const entity of entityMap.values()) {
          for (const relationship of entity.relationships) {
            relationship.subject = entitySlugRemap.get(relationship.subject) ?? relationship.subject;
            relationship.object = entitySlugRemap.get(relationship.object) ?? relationship.object;
          }
          // Phase 17 (B10): incoming records' subjects remap the same way,
          // so the object page's side of a relationship also carries the
          // canonical slug (the record's object is the entity itself).
          for (const relationship of entity.incomingRelationships) {
            relationship.subject = entitySlugRemap.get(relationship.subject) ?? relationship.subject;
          }
          for (const claim of entity.claims) {
            claim.entities = remapList(claim.entities);
          }
          entity.timeline = entity.timeline.map((event) => ({ ...event, entities: remapList(event.entities) }));
        }
        for (const topic of topicMap.values()) {
          for (const claim of topic.claims) {
            claim.entities = remapList(claim.entities);
          }
        }
      }

      // Update-mode deletions (phase doc §2.5): every on-disk page of a
      // merged-away or dropped slug is deleted deterministically, with the
      // now-empty folder chain (the veto filter already kept edited/untracked
      // pages out of the applied lists, so only tool-written pages land here).
      const deletions: string[] = [];
      for (const merge of appliedEntityMerges) {
        for (const from of merge.from) {
          deletions.push(...(entityLocations.get(from) ?? []));
        }
      }
      for (const merge of appliedTopicMerges) {
        for (const from of merge.from) {
          deletions.push(...(topicLocations.get(from) ?? []));
        }
      }
      for (const drop of appliedTopicDrops) {
        deletions.push(...(topicLocations.get(drop) ?? []));
      }
      for (const location of deletions) {
        const absolute = join(dir, location);
        if (!existsSync(absolute)) {
          continue;
        }
        await rm(absolute, { force: true });
        curationSummary.removedPages.push(location);
        await pruneEmptyFolderChain(join(dir, location.split('/')[0]), dirname(absolute));
      }

      // The curated maps define the folder structure from here on (rolling
      // memory + structural changes diff); identical to the aggregated set
      // when nothing merged/dropped, so the OFF path stays byte-identical.
      folderStructure.clear();
      for (const entity of entityMap.values()) {
        folderStructure.add(entity.folder);
      }
      for (const topic of topicMap.values()) {
        folderStructure.add(topic.folder);
      }

      curationSummary.entityMerges = appliedEntityMerges;
      curationSummary.topicMerges = appliedTopicMerges;
      curationSummary.topicDrops = appliedTopicDrops;
    }
  }

  // Build a slug-to-title map so wikilinks can render in Obsidian's native
  // pipe form [[slug|Page Title]] instead of [[slug]]. Unknown slugs fall back
  // to the bare [[slug]] form. Built AFTER curation so it reflects the
  // curated set (merged-away slugs are gone; survivors render canonically).
  const slugToTitle: Record<string, string> = {};
  for (const [slug, entity] of entityMap.entries()) {
    slugToTitle[slug] = entity.name;
  }

  const result: MaterializeResult = { entityPages: [], topicPages: [], documentPages: [], writtenPages: [], preservedPages: [], conflicts: [], removedDuplicates: [] };

  // Phase 16 (vision `04` Step 9): the synthesis completion memory. A page
  // with a skip-eligible record (strict/permissive pass whose dataHash still
  // matches the current aggregate fingerprint) is PRESERVED byte-for-byte —
  // never rewritten — so an already-paid synthesized page is never clobbered,
  // even by a run without synthesis. With no records on disk (pre-Phase-16
  // wikis, synthesis never run) the map is empty and every check below falls
  // through to the byte-identical pre-Phase-16 path.
  const synthesisRecords = (await readSynthesisState(dir)).pages;
  const resumeLanguage = options?.language ?? { input: 'en' as LanguageCode, output: 'en' as LanguageCode };

  // Write entity pages (Phase 8 update mode: existing pages are re-derived
  // from the full extraction set, which IS the merge — mentions append
  // across chunks, relationships/claims dedupe by their content keys, and
  // the Sources section accumulates every contributing source file).
  for (const [slug, entity] of entityMap.entries()) {
    const folderPath = join(dir, entity.folder);
    await mkdir(folderPath, { recursive: true });

    const significance = entity.significance.trim();
    const disambiguation = entity.disambiguation?.trim();

    const mentions = dedupeMentions(entity.mentions);
    const relationships = dedupeRelationships(entity.relationships);
    const claims = dedupeClaims(entity.claims);
    // Phase 17 (B10): the incoming mirror, deduped by the same content-key
    // rule as the outgoing side. A curation merge can collapse a
    // relationship's subject AND object into this same entity (both fork
    // pages merged here): the record then exists in BOTH lists and would
    // render twice — drop the incoming copy so the self-loop renders ONCE,
    // as outgoing (the extraction-time rule, preserved across merges).
    const incomingRelationships = dedupeIncomingRelationships(entity.incomingRelationships).filter(
      (incoming) =>
        !relationships.some(
          (rel) =>
            rel.subject === incoming.subject &&
            rel.object === slug &&
            rel.predicate === incoming.predicate &&
            rel.page === incoming.page &&
            rel.source === incoming.source &&
            rel.pages === incoming.pages,
        ),
    );

    const pageData: EntityPageData = {
      title: entity.name,
      slug,
      folder: entity.folder,
      type: entity.type,
      wiki: wikiSlug,
      mentions,
      relationships,
      claims,
      slugToTitle,
      significance: significance.length > 0 ? significance : undefined,
      disambiguation: disambiguation && disambiguation.length > 0 ? disambiguation : undefined,
      context: entity.contexts.size > 0 ? Array.from(entity.contexts).join('\n\n') : undefined,
      timeline: dedupeTimeline(entity.timeline).map((event) => ({
        date: event.date,
        event: event.event,
        entities: event.entities,
      })),
      // Phase 13 (vision `02` §4.8): the sparse flag, computed once from the
      // final deduped aggregate via the single shared rule. Phase 17
      // (ratified 2026-07-28): the rule reads the OUTGOING relationships
      // only — incoming relationships do not clear sparse.
      sparse: isSparseEntity({ mentions, relationships, claims }),
      // Phase 14 (phase doc §2.3): curation-merged variant titles land in the
      // page's frontmatter aliases (vision `05` §2).
      mergedAliases: entity.aliases.length > 0 ? entity.aliases : undefined,
      // Phase 17 (B10): omitted when empty so the Phase 16 aggregate
      // fingerprint of a page with no incoming edges is unchanged from
      // pre-Phase-17 (skip-eligible pages stay byte-stable).
      incomingRelationships: incomingRelationships.length > 0 ? incomingRelationships : undefined,
    };

    // Phase 8 §2.5: never overwrite a manually-edited page. The conflict is
    // logged and the page is excluded from the result so the Synthesis
    // Writer does not overwrite it either.
    const pagePath = join(folderPath, `${slug}.md`);
    const relativePath = synthesisPagePath(pageData);
    // Phase 16 (vision `04` Step 9): a skip-eligible synthesis record whose
    // fingerprint matches the current aggregate means this page's synthesis
    // is already paid for — preserve the finished page byte-for-byte (checked
    // BEFORE the manual-edit conflict path: preservation never overwrites
    // anything, so a human edit to such a page is kept too). The page still
    // lands in entityPages so the ingest skip rule sees it.
    const synthesisRecord = synthesisRecords[relativePath];
    if (
      isSkipEligible(synthesisRecord) &&
      synthesisRecord.dataHash === pageDataHash(pageData, resumeLanguage) &&
      existsSync(pagePath)
    ) {
      result.entityPages.push(pageData);
      result.preservedPages.push({ path: relativePath, hash: hashContent(await readFile(pagePath, 'utf-8')) });
      continue;
    }
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
    const relativePath = synthesisPagePath(pageData);
    // Phase 16 (vision `04` Step 9): same synthesis-resume preservation as
    // the entity loop above — a skip-eligible record with a matching
    // fingerprint preserves the finished topic page byte-for-byte.
    const synthesisRecord = synthesisRecords[relativePath];
    if (
      isSkipEligible(synthesisRecord) &&
      synthesisRecord.dataHash === pageDataHash(pageData, resumeLanguage) &&
      existsSync(pagePath)
    ) {
      result.topicPages.push(pageData);
      result.preservedPages.push({ path: relativePath, hash: hashContent(await readFile(pagePath, 'utf-8')) });
      continue;
    }
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

  // Phase 14 (phase doc §2.3 + gate 14.7): exact-segment wikilink rewrite
  // across ALL pre-existing content pages (entity, topic, document — not DOX
  // indexes, which regenerate every run). Freshly-written pages are skipped
  // (rendered from the curated aggregate, already canonical); conflict-skipped
  // pages DO get their links rewritten (the manual-edit conflict entry
  // stands). Matching is by exact target segment only, so prefix collisions
  // (`[[odense]]` vs `[[odense-bup-auditorium|X]]`) are safe.
  if (curationSummary !== null && mergeRewrites.size > 0) {
    const writtenSet = new Set(result.writtenPages.map((page) => page.path));
    const contentPages: string[] = [];
    for (const section of ['entities', 'topics', 'documents']) {
      const sectionRoot = join(dir, section);
      if (existsSync(sectionRoot)) {
        await collectContentPagePaths(sectionRoot, section, '', contentPages);
      }
    }
    for (const relPath of contentPages.sort((a, b) => a.localeCompare(b))) {
      if (writtenSet.has(relPath)) {
        continue;
      }
      const absolute = join(dir, relPath);
      const original = await readFile(absolute, 'utf-8');
      const rewritten = rewriteWikilinkTargets(original, mergeRewrites);
      if (rewritten === original) {
        continue;
      }
      await writeFile(absolute, rewritten, 'utf-8');
      curationSummary.rewrittenLinks.push({ path: relPath, hash: hashContent(rewritten) });
    }
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
    // Phase 14: entity references in the synthesis input point at canonical
    // slugs when curation merged pages (identity map when curation was off).
    const remapSlug = (slug: string): string => entitySlugRemap.get(slug) ?? slug;
    const entitySlugs = new Set<string>();
    for (const entity of extracted.entities ?? []) {
      entitySlugs.add(remapSlug(entity.slug));
    }
    for (const claim of extracted.claims ?? []) {
      for (const slug of claim.entities ?? []) {
        entitySlugs.add(remapSlug(slug));
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
        entities: Array.from(new Set((claim.entities ?? []).map(remapSlug))),
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

  // Phase 14 (phase doc §2.7): the per-run curation report — applied
  // merges/drops, manual-edit skips, fallback events with cause, attempt
  // counts, deletions, rewritten links. Written only when the stage ran;
  // rolling memory above already reflects the curated set (written AFTER
  // curation, vision `04` Step 6 item 5).
  if (curationSummary !== null) {
    result.curation = curationSummary;
    await writeCurationReport(dir, {
      run: new Date().toISOString(),
      topics: {
        merges: curationSummary.topicMerges,
        drops: curationSummary.topicDrops,
        attempts: curationSummary.attempts.topics,
        fallbacks: (topicOutcome?.fallbacks ?? []).map((f) => ({ scope: f.scope, cause: f.cause })),
        vetoes: (topicOutcome?.vetoes ?? []).map((v) => ({ from: v.from, into: v.into })),
      },
      entities: {
        merges: curationSummary.entityMerges,
        drops: [],
        attempts: curationSummary.attempts.entities,
        fallbacks: (entityOutcome?.fallbacks ?? []).map((f) => ({ scope: f.scope, cause: f.cause })),
        vetoes: (entityOutcome?.vetoes ?? []).map((v) => ({ from: v.from, into: v.into })),
      },
      manualEditSkips: curationSummary.manualEditSkips,
      removedPages: curationSummary.removedPages,
      rewrittenLinks: curationSummary.rewrittenLinks,
    });
  }

  return result;
}
