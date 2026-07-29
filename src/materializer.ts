import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import { wikiDir, wikiRelativePath } from './utils/paths';
import { writeEntityPage, isSparseEntity, type EntityPageData, type EntityPageIncomingRelationship } from './pages/entity-page';
import {
  writeCompositePage,
  type CompositeMember,
  type CompositeMemberEvidence,
  type CompositePageData,
} from './pages/composite-page';
import { writeTopicPage, type TopicPageData } from './pages/topic-page';
import {
  writeComparisonPage,
  type ComparisonBridgeEntry,
  type ComparisonPageData,
  type ComparisonTableSection,
} from './pages/comparison-page';
import { type DocumentPageData } from './pages/document-page';
import { saveRollingMemory, readFullRollingMemory, type RollingMemory } from './state/rolling-memory';
import { logStructuralChanges, readStructuralChanges, type StructuralChange } from './state/structural-changes';
import { logManualEditConflict } from './state/conflicts';
import { readCurationOverrides } from './state/curation-overrides';
import { writeCurationReport } from './state/curation-report';
import {
  appendCurationDecisions,
  readCurationDecisions,
  type CurationDecisionRecord,
} from './state/curation-decisions';
import { isSkipEligible, pageDataHash, readSynthesisState, synthesisPagePath } from './state/synthesis-state';
import {
  curateEntities,
  curateTopics,
  truncateSample,
  type CurateCallOptions,
  type CurationClusterDecision,
  type CurationFallbackCause,
  type CurationMergeDecision,
  type EntityCurationCandidate,
  type EntityCurationOutcome,
  type TopicCurationCandidate,
  type TopicCurationOutcome,
} from './agents/curation';
import {
  curationPairKey,
  detectPreMergePairs,
  isIndicatorSlug,
  type ProposedCluster,
  type ProposedPair,
} from './agents/pre-merge';
import { rewriteWikilinkTargets, type WikilinkRewrite } from './utils/wikilinks';
import { slugify } from './utils/slug';
import type { LanguageCode } from './utils/language';
import type {
  ExtractorEntity,
  ExtractorRelationship,
  ExtractorClaim,
  ExtractorResult,
  ExtractorTable,
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
 * Phase 22 (§2.1–§2.2): an applied composite-cluster decision with its
 * provenance (the deterministic signal that proposed it, or 'model').
 */
export interface AppliedCluster {
  members: string[];
  class: number;
  into: string;
  signal: string;
  rationale?: string;
}

/**
 * Phase 14 (phase doc §2.4/§2.7): the curation stage's per-materialize
 * summary, present on MaterializeResult only when the stage ran.
 */
export interface CurationSummary {
  ran: true;
  /** Applied (post manual-edit veto) decision lists — decided THIS run. */
  topicMerges: CurationMergeDecision[];
  topicDrops: string[];
  entityMerges: CurationMergeDecision[];
  /** Phase 22 (§2.1): composite clusters decided + applied THIS run. */
  entityClusters: AppliedCluster[];
  /** Keep-all fallback events across both concerns (console-warned too). */
  fallbacks: Array<{ concern: 'topics' | 'entities'; scope: string; cause: CurationFallbackCause }>;
  attempts: { topics: number; entities: number };
  /** neverMerge pairs vetoed into keep during validation (incl. auto-apply vetoes). */
  vetoes: Array<{ concern: 'topics' | 'entities'; from: string; into: string }>;
  /** Manually-edited/untracked from-pages kept out of a merge/drop/cluster. */
  manualEditSkips: Array<{ page: string; concern: 'topics' | 'entities'; action: 'merge' | 'drop' | 'cluster' }>;
  /** On-disk pages deleted because their slug was merged away/dropped/clustered. */
  removedPages: string[];
  /** Pre-existing pages whose wikilinks were rewritten to canonical slugs. */
  rewrittenLinks: Array<{ path: string; hash: string }>;
  /**
   * Phase 21 (§2.3): sticky merges/drops PRE-APPLIED deterministically
   * before candidate construction (union-find seeded from
   * `.state/curation-decisions.json`; drops removed) — the model only judged
   * the unstuck candidates.
   */
  fromSticky: {
    topicMerges: CurationMergeDecision[];
    topicDrops: string[];
    entityMerges: CurationMergeDecision[];
    /** Phase 22 (§2.1): sticky cluster records pre-applied this run. */
    entityClusters: AppliedCluster[];
  };
  /** Phase 21 (§2.1): auto-applied deterministic pairs (near-zero-risk signals, no LLM). */
  autoApplied: Array<{ concern: 'topics' | 'entities'; from: string; into: string; signal: string; evidence: string }>;
  /** Phase 21 (§2.2): the proposed pairs the model was asked to confirm/deny. */
  proposedPairs: Array<{ concern: 'topics' | 'entities'; from: string; into: string; signal: string; evidence: string }>;
  /** Phase 22 (§2.1): the proposed clusters the model was asked to confirm/deny (entities only). */
  proposedClusters: Array<{ members: string[]; class: number; into: string; signal: string; evidence: string }>;
  /** Phase 21 (§2.2): proposed pairs the model denied (or left unjudged). */
  denials: Array<{ concern: 'topics' | 'entities'; from: string; into: string; justification?: string }>;
  /** Phase 22 (§2.1): proposed clusters the model denied (or left unjudged). */
  clusterDenials: Array<{ members: string[]; class: number; into: string; rationale?: string }>;
  /**
   * Phase 21 (§2.3): recorded decisions UN-APPLIED this run — the `splits`
   * escape hatch (hand-edited) and neverMerge vetoes of sticky records.
   */
  splitReversals: Array<{ concern: 'topics' | 'entities'; from: string[]; into?: string; reason: 'split' | 'neverMerge' }>;
}

export interface MaterializeResult {
  /** Structured data for every entity page written. */
  entityPages: EntityPageData[];
  /**
   * Phase 22 (§2.2): structured data for every COMPOSITE page written
   * (member pages are never written — their evidence lives here, member-
   * tagged). Empty on the pre-Phase-22 paths.
   */
  compositePages: CompositePageData[];
  /** Structured data for every topic page written. */
  topicPages: TopicPageData[];
  /**
   * Phase 23 (§2.2, backlog B21): structured data for every COMPARISON page
   * written — one per comparison-table subject, each source's table preserved
   * verbatim in its own dated section. Empty when no extraction emitted
   * tables (the byte-identical pre-Phase-23 path).
   */
  comparisonPages: ComparisonPageData[];
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
   * Phase 19 (phase doc §2.3, backlog B19): pages whose recorded hash was
   * STALE but whose on-disk content byte-matches the deterministic render of
   * the current aggregate — provably tool-written (a human edit cannot
   * reproduce the render). The guard CONVERGED instead of false-flagging:
   * the update proceeded (the page is in `writtenPages`, so the caller's
   * fold records the disk hash) and a convergence note was logged on the
   * console — never a conflict, never an entry in `.state/conflicts.json`.
   */
  convergedPages: string[];
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
 *
 * Phase 19 (phase doc §2.3, backlog B19 — safe convergence): when the guard
 * detects disk ≠ recorded, the disk content is first compared against
 * `rendered`, the deterministic render of the CURRENT aggregate. A
 * byte-identical match proves the page is tool-written (a human edit cannot
 * reproduce the render byte-for-byte): the verdict is 'converge' — the
 * caller proceeds with the update and records the disk hash, logging a
 * convergence note rather than a conflict. Any other mismatch stays
 * 'conflict' exactly as before: human-edit protection is NOT weakened.
 */
async function checkPageConflict(
  pagePath: string,
  relativePath: string,
  pageHashes: Record<string, string> | undefined,
  rendered: string,
): Promise<'write' | 'converge' | 'conflict'> {
  if (!pageHashes || !existsSync(pagePath)) {
    return 'write';
  }
  const recorded = pageHashes[relativePath];
  if (recorded === undefined) {
    return 'write';
  }
  const current = hashContent(await readFile(pagePath, 'utf-8'));
  if (current === recorded) {
    return 'write';
  }
  return current === hashContent(rendered) ? 'converge' : 'conflict';
}

/**
 * Phase 19 (phase doc §2.3): the convergence note — logged for every page
 * the guard converges (disk == deterministic render, stale recorded hash).
 * Deliberately NOT a conflicts.json entry: this is the tool repairing its
 * own bookkeeping, not a journalist conflict.
 */
function logHashConvergence(relativePath: string): void {
  console.log(
    `Converged stale page hash for ${relativePath} (on-disk content matches the deterministic render; recording the disk hash — not a manual edit).`,
  );
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
  /** Phase 21 (§2.1 alias signal): the page's frontmatter aliases. */
  aliases: string[];
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
    aliases: [],
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
    // Phase 21 (§2.1): frontmatter aliases feed the alias-match pre-merge signal.
    if (Array.isArray(parsed.data.aliases)) {
      meta.aliases = parsed.data.aliases.filter((alias): alias is string => typeof alias === 'string');
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
  excludeSlugs?: ReadonlySet<string>,
): EntityCurationCandidate[] {
  const candidates: EntityCurationCandidate[] = [];
  for (const [slug, entity] of entityMap.entries()) {
    if (excludeSlugs?.has(slug)) {
      continue;
    }
    const mentions = dedupeMentions(entity.mentions);
    // Phase 21 (§2.1): aliases = sticky/curation-accumulated variant titles ∪
    // the on-disk page's frontmatter aliases (deduped, order-stable).
    const aliases = Array.from(new Set([...entity.aliases, ...(onDiskEntities.get(slug)?.aliases ?? [])]));
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
      ...(aliases.length > 0 ? { aliases } : {}),
    });
  }
  for (const [slug, meta] of Array.from(onDiskEntities.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    if (entityMap.has(slug) || excludeSlugs?.has(slug)) {
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
      ...(meta.aliases.length > 0 ? { aliases: meta.aliases } : {}),
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
 * Phase 21 (§2.3): collapse the active sticky merge records for one concern
 * through union-find into canonical merge decisions. Chains (A→B recorded in
 * one run, B→C in a later run) resolve to the unique survivor — the recorded
 * `into` that is never a `from`. A hand-corrupted record set with no unique
 * survivor falls back to the lexicographically last member (deterministic;
 * the validator's own chain rules make this unreachable for tool-written
 * records).
 */
function collapseStickyMerges(
  records: CurationDecisionRecord[],
  concern: 'topics' | 'entities',
): CurationMergeDecision[] {
  const edges: Array<{ from: string; into: string }> = [];
  for (const record of records) {
    if (record.concern !== concern || record.action !== 'merge' || record.into === undefined) {
      continue;
    }
    for (const from of record.from) {
      if (from !== record.into) {
        edges.push({ from, into: record.into });
      }
    }
  }
  if (edges.length === 0) {
    return [];
  }
  const parent = new Map<string, string>();
  const find = (slug: string): string => {
    let root = parent.get(slug) ?? slug;
    if (root !== slug) {
      root = find(root);
      parent.set(slug, root);
    } else {
      parent.set(slug, slug);
    }
    return root;
  };
  for (const edge of edges) {
    const rootFrom = find(edge.from);
    const rootInto = find(edge.into);
    if (rootFrom !== rootInto) {
      parent.set(rootFrom, rootInto);
    }
  }
  const components = new Map<string, Set<string>>();
  for (const edge of edges) {
    for (const slug of [edge.from, edge.into]) {
      const root = find(slug);
      const members = components.get(root) ?? new Set<string>();
      members.add(slug);
      components.set(root, members);
    }
  }
  const merges: CurationMergeDecision[] = [];
  for (const members of components.values()) {
    const survivors = [...members].filter(
      (member) => edges.some((edge) => edge.into === member) && !edges.some((edge) => edge.from === member),
    );
    const into = survivors.length === 1 ? survivors[0] : [...members].sort().reverse()[0];
    merges.push({ from: [...members].filter((member) => member !== into).sort(), into });
  }
  merges.sort((a, b) => a.into.localeCompare(b.into));
  return merges;
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
  /**
   * Phase 23 (§2.1–§2.2): every extracted comparison table with its chunk's
   * source provenance, collected during aggregation and assembled into
   * comparison pages AFTER curation (the subject-entity identity must resolve
   * through the canonical, post-remap slug set).
   */
  const rawTables: Array<{ table: ExtractorTable; source: string; pages: string }> = [];

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

    // Phase 23 (§2.1): comparison tables ride their chunk's source
    // provenance; assembly happens after curation below.
    for (const table of extracted.tables ?? []) {
      rawTables.push({ table, source: chunkSource.file, pages: chunkSource.pages });
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
  /**
   * Phase 22 (§2.2): the active composite clusters, keyed by the `into`
   * slug. Members are PULLED OUT of `entityMap` (their pages are never
   * written) and pooled here, member-tagged; the composite page is written
   * at the `into` member's folder/slug.
   */
  const clusterMap = new Map<string, { decision: AppliedCluster; members: Array<{ slug: string; aggregate: MaterializedEntity }> }>();
  let curationSummary: CurationSummary | null = null;
  let topicOutcome: TopicCurationOutcome | null = null;
  let entityOutcome: EntityCurationOutcome | null = null;
  /** Phase 21 (§2.3): one timestamp per curation stage — the report's `run` and the decisions' `runId`. */
  let curationRunTimestamp: string | null = null;

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

    // ------------------------------------------------------------------
    // Phase 21 (§2.3): STICKY PRE-APPLICATION. Before any candidate is
    // built, the recorded decisions in `.state/curation-decisions.json`
    // are applied deterministically — union-find seeded from merges, drops
    // removed — so the curation calls below judge ONLY unstuck candidates
    // (new extractions, undecided pairs; the merged-away page can never
    // reappear, gate 21.6). A hand-edited `splits: [slug]` entry un-applies
    // its record (the pair returns to candidates, the reversal is logged);
    // a neverMerge veto un-applies it too (gate 21.8).
    // ------------------------------------------------------------------
    const runTimestamp = new Date().toISOString();
    curationRunTimestamp = runTimestamp;
    const overrides = await readCurationOverrides(dir);
    const decisionsData = await readCurationDecisions(dir);
    const splitSlugs = new Set(decisionsData.splits);
    const neverMergeSet = new Set(overrides.neverMerge.map(([a, b]) => curationPairKey(a, b)));

    const splitReversals: Array<{
      concern: 'topics' | 'entities';
      from: string[];
      into?: string;
      reason: 'split' | 'neverMerge';
    }> = [];
    const activeRecords: CurationDecisionRecord[] = [];
    // Phase 22 (§2.2/gate 22.7): the reversed cluster records — their
    // composite pages are deleted below (member pages rebuilt) when the
    // on-disk page at the `into` path IS a composite (frontmatter check).
    const reversedClusterIntos = new Set<string>();
    for (const record of decisionsData.decisions) {
      const involved = record.into !== undefined ? [record.into, ...record.from] : [...record.from];
      if (involved.some((slug) => splitSlugs.has(slug))) {
        splitReversals.push({ concern: record.concern, from: record.from, into: record.into, reason: 'split' });
        if (record.action === 'cluster' && record.into !== undefined) {
          reversedClusterIntos.add(record.into);
        }
        continue;
      }
      if (
        record.action === 'merge' &&
        record.into !== undefined &&
        record.from.some((from) => neverMergeSet.has(curationPairKey(from, record.into as string)))
      ) {
        splitReversals.push({ concern: record.concern, from: record.from, into: record.into, reason: 'neverMerge' });
        continue;
      }
      // Phase 22 (§2.1): a neverMerge pair inside a sticky cluster record
      // un-applies the whole composite (the human veto beats the record).
      if (record.action === 'cluster' && record.into !== undefined) {
        const members = [record.into, ...record.from];
        const vetoed = members.some((a, i) =>
          members.slice(i + 1).some((b) => neverMergeSet.has(curationPairKey(a, b))),
        );
        if (vetoed) {
          splitReversals.push({ concern: record.concern, from: record.from, into: record.into, reason: 'neverMerge' });
          reversedClusterIntos.add(record.into);
          continue;
        }
      }
      activeRecords.push(record);
    }
    const stickyTopicMergesAll = collapseStickyMerges(activeRecords, 'topics');
    const stickyEntityMergesAll = collapseStickyMerges(activeRecords, 'entities');
    const stickyTopicDropsAll = activeRecords
      .filter((record) => record.concern === 'topics' && record.action === 'drop')
      .flatMap((record) => record.from);
    // Phase 22 (§2.1): sticky CLUSTER records — members re-derive as
    // [into, ...from]; the composite is rebuilt deterministically every run.
    const stickyEntityClustersAll: AppliedCluster[] = activeRecords
      .filter((record) => record.concern === 'entities' && record.action === 'cluster' && record.into !== undefined)
      .map((record) => ({
        members: [record.into as string, ...record.from],
        class: record.class ?? 1,
        into: record.into as string,
        signal: record.signal,
        ...(record.rationale !== undefined ? { rationale: record.rationale } : {}),
      }));

    // Phase 21 widened guard: the stage runs when there are candidates
    // (aggregate ∪ on-disk, exactly the pre-Phase-21 rule) OR sticky work to
    // pre-apply (a sticky-only run still deletes pages and writes a report).
    const hasCurationWork =
      entityMap.size + topicMap.size + onDiskEntities.size + onDiskTopics.size > 0 ||
      stickyTopicMergesAll.length + stickyEntityMergesAll.length + stickyTopicDropsAll.length +
        stickyEntityClustersAll.length > 0;

    if (hasCurationWork) {
      let agentsMd = '';
      try {
        agentsMd = await readFile(join(dir, 'AGENTS.md'), 'utf-8');
      } catch {
        // Best-effort — the prompt carries a placeholder when absent.
      }

      curationSummary = {
        ran: true,
        topicMerges: [],
        topicDrops: [],
        entityMerges: [],
        entityClusters: [],
        fallbacks: [],
        attempts: { topics: 0, entities: 0 },
        vetoes: [],
        manualEditSkips: [],
        removedPages: [],
        rewrittenLinks: [],
        fromSticky: { topicMerges: [], topicDrops: [], entityMerges: [], entityClusters: [] },
        autoApplied: [],
        proposedPairs: [],
        proposedClusters: [],
        denials: [],
        clusterDenials: [],
        splitReversals,
      };
      const summary = curationSummary;

      // Manual-edit veto filter (phase doc §2.5): a from-page whose on-disk
      // content no longer matches its recorded hash — or that has no recorded
      // hash (the fork-reconciliation precedent treats untracked pages as
      // manual edits) — is SKIPPED, logged as a conflict, and its decision is
      // vetoed; the slug is treated as keep for the rest of the application.
      // Shared by every Phase 21 tier (sticky, auto-apply, model).
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
      const filterMerges = async (
        merges: CurationMergeDecision[],
        locations: Map<string, string[]>,
        concern: 'topics' | 'entities',
        intoLabel: string,
        reasonLabel?: string,
      ): Promise<CurationMergeDecision[]> => {
        const reason = reasonLabel ?? `Curation ${concern} merge`;
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
                  `${reason} of '${from}' into '${merge.into}' (${intoLabel}) skipped: page was manually edited or has no recorded hash. Kept for review.`,
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
        reasonLabel = 'Curation topic drop',
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
                `${reasonLabel} of '${slug}' skipped: page was manually edited or has no recorded hash. Kept for review.`,
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

      // Phase 22 (§2.1): the manual-edit veto for clusters is ALL-OR-NOTHING —
      // a manually-edited/untracked MEMBER page vetoes the whole composite
      // (partial absorption is never meaningful), exactly the merge veto's
      // posture (logged as a conflict, members treated as keep this run).
      const filterClusters = async (
        clusters: AppliedCluster[],
        locations: Map<string, string[]>,
        reasonLabel: string,
      ): Promise<AppliedCluster[]> => {
        const filtered: AppliedCluster[] = [];
        for (const cluster of clusters) {
          let vetoed = false;
          for (const member of cluster.members) {
            for (const location of locations.get(member) ?? []) {
              if (await isVetoedLocation(location)) {
                vetoed = true;
                await logManualEditConflict(
                  dir,
                  location,
                  `${reasonLabel} of '${member}' into composite '${cluster.into}' skipped: page was manually edited or has no recorded hash. Kept for review.`,
                );
                summary.manualEditSkips.push({ page: location, concern: 'entities', action: 'cluster' });
              }
            }
          }
          if (!vetoed) {
            filtered.push(cluster);
          }
        }
        return filtered;
      };

      // The merge-application closures — ONE implementation shared by the
      // sticky pre-application, the auto-apply tier, and the model tier.
      const entityTitleOf = (slug: string): string =>
        entityMap.get(slug)?.name ?? onDiskEntities.get(slug)?.title ?? titleCaseSlug(slug);
      const applyEntityMergeToMaps = (merge: CurationMergeDecision): void => {
        let intoEntity = entityMap.get(merge.into);
        if (!intoEntity) {
          // An on-disk-only merge target gets a synthesized aggregate so the
          // survivor page is (re-)written with the unioned content.
          const onDisk = onDiskEntities.get(merge.into);
          intoEntity = {
            name: entityTitleOf(merge.into),
            type: onDisk?.type ?? 'unknown',
            folder: onDisk?.folder ?? 'entities',
            significance: '',
            disambiguation: undefined,
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
          const variantTitle = fromEntity?.name ?? entityTitleOf(from);
          intoEntity.aliases.push(variantTitle);
          entitySlugRemap.set(from, merge.into);
          mergeRewrites.set(from, { into: merge.into, fromTitle: variantTitle });
        }
        intoEntity.aliases = Array.from(new Set(intoEntity.aliases));
      };
      const topicTitleOf = (slug: string): string =>
        topicMap.get(slug)?.title ?? onDiskTopics.get(slug)?.title ?? titleCaseSlug(slug);
      const applyTopicMergeToMaps = (merge: CurationMergeDecision): void => {
        let intoTopic = topicMap.get(merge.into);
        if (!intoTopic) {
          intoTopic = {
            title: topicTitleOf(merge.into),
            slug: merge.into,
            folder: onDiskTopics.get(merge.into)?.folder ?? `topics/${merge.into}`,
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
          const fromTitle = fromTopic?.title ?? topicTitleOf(from);
          mergeRewrites.set(from, { into: merge.into, fromTitle });
        }
      };

      // Phase 22 (§2.2): apply ONE cluster — pull every member out of
      // entityMap (member pages are NEVER written), pool the member-tagged
      // aggregates for the composite, and repoint every structured reference
      // and pre-existing wikilink from a member slug to the composite slug
      // (the merge machinery's remap/rewrite passes, shared). The composite
      // keeps the `into` member's slug and folder. A member missing from the
      // aggregate (on-disk-only or fully absent this run) contributes an
      // empty evidence group — the cluster contract is sticky.
      const applyEntityClusterToMaps = (cluster: AppliedCluster): void => {
        if (clusterMap.has(cluster.into)) {
          // Defensive no-op: this `into` is already pooled (the sticky
          // pre-application ran first). Re-applying would re-pull the members
          // from a now-empty entityMap and CLOBBER the full evidence with
          // empty on-disk-meta aggregates. Production never reaches this
          // (cluster members leave the candidate set, so a decided cluster
          // can never duplicate a sticky one); the guard protects the seams.
          return;
        }
        const memberAggregates: Array<{ slug: string; aggregate: MaterializedEntity }> = [];
        for (const slug of cluster.members) {
          let aggregate = entityMap.get(slug);
          if (!aggregate) {
            const onDisk = onDiskEntities.get(slug);
            aggregate = {
              name: entityTitleOf(slug),
              type: onDisk?.type ?? 'unknown',
              folder: onDisk?.folder ?? 'entities',
              significance: '',
              disambiguation: undefined,
              contexts: new Set<string>(),
              mentions: [],
              relationships: [],
              incomingRelationships: [],
              claims: [],
              timeline: [],
              aliases: [],
            };
          }
          entityMap.delete(slug);
          memberAggregates.push({ slug, aggregate });
        }
        clusterMap.set(cluster.into, { decision: cluster, members: memberAggregates });
        for (const slug of cluster.members) {
          if (slug === cluster.into) {
            continue;
          }
          entitySlugRemap.set(slug, cluster.into);
          mergeRewrites.set(slug, { into: cluster.into, fromTitle: entityTitleOf(slug) });
        }
      };

      // ---- STICKY PRE-APPLICATION (§2.3) ----
      const stickyEntityMerges = await filterMerges(
        stickyEntityMergesAll,
        entityLocations,
        'entities',
        'entity',
        'Curation entities sticky merge',
      );
      const stickyTopicMerges = await filterMerges(
        stickyTopicMergesAll,
        topicLocations,
        'topics',
        'topic',
        'Curation topics sticky merge',
      );
      const stickyTopicDrops = await filterDrops(stickyTopicDropsAll, topicLocations, 'Curation topic sticky drop');
      for (const merge of stickyEntityMerges) {
        applyEntityMergeToMaps(merge);
      }
      for (const merge of stickyTopicMerges) {
        applyTopicMergeToMaps(merge);
      }
      for (const drop of stickyTopicDrops) {
        // The claims themselves stay on their entity/document pages
        // (preservation contract); only the topic grouping is discarded.
        topicMap.delete(drop);
      }
      // ---- Phase 22 (§2.1): STICKY CLUSTER PRE-APPLICATION ----
      // Recorded clusters rebuild their composites deterministically BEFORE
      // candidates are built, so cluster members never re-enter the model's
      // input (gate 22.6 — thin member pages can never oscillate back).
      const stickyEntityClusters = await filterClusters(
        stickyEntityClustersAll,
        entityLocations,
        'Curation entities sticky cluster',
      );
      for (const cluster of stickyEntityClusters) {
        applyEntityClusterToMaps(cluster);
      }
      const clusteredMemberSlugs = new Set<string>();
      for (const cluster of stickyEntityClusters) {
        for (const member of cluster.members) {
          clusteredMemberSlugs.add(member);
        }
      }
      summary.fromSticky = {
        topicMerges: stickyTopicMerges,
        topicDrops: stickyTopicDrops,
        entityMerges: stickyEntityMerges,
        entityClusters: stickyEntityClusters,
      };

      // Candidates are built AFTER the sticky pre-application, so the model
      // only ever judges unstuck candidates (gate 21.4). Phase 22: cluster
      // members (and the composite's `into`) are excluded the same way.
      let topicCandidates = buildTopicCandidates(topicMap, onDiskTopics);
      let entityCandidates = buildEntityCandidates(entityMap, onDiskEntities, clusteredMemberSlugs);

      // ---- Phase 21 (§2.1): DETERMINISTIC PRE-MERGE SIGNALS ----
      // The corpus text feeds the `Full Name (ABBR)` abbreviation mining.
      const corpusParts: string[] = [];
      for (const fileName of extractionFiles) {
        const chunkId = fileName.replace(/\.json$/i, '');
        try {
          corpusParts.push(matter(await readFile(join(dir, 'documents', `${chunkId}.md`), 'utf-8')).content);
        } catch {
          // A missing document page only shrinks the abbreviation evidence.
        }
      }
      const corpusText = corpusParts.join('\n');
      const detectionOptions = {
        language: options?.language,
        corpusText,
        neverMerge: overrides.neverMerge,
        // The splits escape hatch also vetoes the auto tier: a split
        // survivor's accumulated aliases would otherwise re-merge the pair
        // instantly through the alias signal (gate 21.7).
        vetoSlugs: [...splitSlugs],
      };
      const topicDetection = detectPreMergePairs(topicCandidates, detectionOptions);
      const entityDetection = detectPreMergePairs(entityCandidates, detectionOptions);

      // AUTO-APPLY tier (§2.1): slug-identical-after-transliteration +
      // alias-exact pairs apply with NO LLM call (gate 21.2). neverMerge
      // vetoes were already filtered by detection (recorded below); the
      // manual-edit veto guards the from-pages like any other merge.
      const autoApplied: Array<{
        concern: 'topics' | 'entities';
        from: string;
        into: string;
        signal: string;
        evidence: string;
      }> = [];
      const autoApplyPairs = async (
        concern: 'topics' | 'entities',
        pairs: ProposedPair[],
        locations: Map<string, string[]>,
      ): Promise<void> => {
        for (const pair of pairs) {
          let vetoed = false;
          for (const location of locations.get(pair.from) ?? []) {
            if (await isVetoedLocation(location)) {
              vetoed = true;
              await logManualEditConflict(
                dir,
                location,
                `Curation ${concern} auto-merge of '${pair.from}' into '${pair.into}' (${pair.signal}) skipped: page was manually edited or has no recorded hash. Kept for review.`,
              );
              summary.manualEditSkips.push({ page: location, concern, action: 'merge' });
            }
          }
          if (vetoed) {
            continue;
          }
          if (concern === 'topics') {
            applyTopicMergeToMaps({ from: [pair.from], into: pair.into });
          } else {
            applyEntityMergeToMaps({ from: [pair.from], into: pair.into });
          }
          autoApplied.push({
            concern,
            from: pair.from,
            into: pair.into,
            signal: pair.signal,
            evidence: pair.evidence,
          });
        }
      };
      await autoApplyPairs('topics', topicDetection.autoApply, topicLocations);
      await autoApplyPairs('entities', entityDetection.autoApply, entityLocations);
      summary.autoApplied = autoApplied;
      // neverMerge vetoes of auto-tier pairs (gate 21.8 — never applied).
      summary.vetoes.push(
        ...topicDetection.vetoed.map((pair) => ({ concern: 'topics' as const, from: pair.from, into: pair.into })),
        ...entityDetection.vetoed.map((pair) => ({ concern: 'entities' as const, from: pair.from, into: pair.into })),
      );

      // Auto-apply changed the maps — rebuild the candidates so the
      // merged-away slugs vanish and the survivors carry the unioned data.
      if (autoApplied.length > 0) {
        topicCandidates = buildTopicCandidates(topicMap, onDiskTopics);
        entityCandidates = buildEntityCandidates(entityMap, onDiskEntities, clusteredMemberSlugs);
      }

      // ---- Phase 21 (§2.2): PROPOSED PAIRS + residual open discovery ----
      // Proposed-pair members leave the open candidate list: the model
      // confirms/denies them in the pairs output, and open discovery runs
      // over the unproposed candidates only (smaller input, fewer buckets).
      // Phase 22 (§2.1): proposed-cluster members leave it the same way —
      // judged confirm/deny in the clusters output (entities only).
      const topicCandidateSlugs = new Set(topicCandidates.map((candidate) => candidate.slug));
      const entityCandidateSlugs = new Set(entityCandidates.map((candidate) => candidate.slug));
      const proposedTopicPairs = topicDetection.proposed.filter(
        (pair) => topicCandidateSlugs.has(pair.from) && topicCandidateSlugs.has(pair.into),
      );
      const proposedEntityPairs = entityDetection.proposed.filter(
        (pair) => entityCandidateSlugs.has(pair.from) && entityCandidateSlugs.has(pair.into),
      );
      const proposedEntityClusters = entityDetection.proposedClusters.filter((cluster) =>
        cluster.members.every((member) => entityCandidateSlugs.has(member)),
      );
      summary.proposedPairs = [
        ...proposedTopicPairs.map((pair) => ({ concern: 'topics' as const, ...pair })),
        ...proposedEntityPairs.map((pair) => ({ concern: 'entities' as const, ...pair })),
      ];
      summary.proposedClusters = proposedEntityClusters.map((cluster) => ({
        members: cluster.members,
        class: cluster.class,
        into: cluster.into,
        signal: cluster.signal,
        evidence: cluster.evidence,
      }));
      const topicPairMembers = new Set(proposedTopicPairs.flatMap((pair) => [pair.from, pair.into]));
      const entityPairMembers = new Set(proposedEntityPairs.flatMap((pair) => [pair.from, pair.into]));
      const entityClusterProposalMembers = new Set(proposedEntityClusters.flatMap((cluster) => cluster.members));
      const openTopicCandidates = topicCandidates.filter((candidate) => !topicPairMembers.has(candidate.slug));
      const openEntityCandidates = entityCandidates.filter(
        (candidate) => !entityPairMembers.has(candidate.slug) && !entityClusterProposalMembers.has(candidate.slug),
      );

      const callOptions: CurateCallOptions = {
        agentsMd,
        language: options?.language,
        logPath: join(dir, '.state', 'llm-calls.json'),
        neverMerge: overrides.neverMerge,
      };
      const topicsFn = options?.curateTopicsFn ?? curateTopics;
      const entitiesFn = options?.curateEntitiesFn ?? curateEntities;
      [topicOutcome, entityOutcome] = await Promise.all([
        openTopicCandidates.length + proposedTopicPairs.length > 0
          ? topicsFn(openTopicCandidates, { ...callOptions, proposedPairs: proposedTopicPairs })
          : Promise.resolve<TopicCurationOutcome>(emptyCurationOutcome()),
        openEntityCandidates.length + proposedEntityPairs.length + proposedEntityClusters.length > 0
          ? entitiesFn(openEntityCandidates, {
              ...callOptions,
              proposedPairs: proposedEntityPairs,
              proposedClusters: proposedEntityClusters,
            })
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

      summary.fallbacks = [
        ...topicOutcome.fallbacks.map((f) => ({ concern: 'topics' as const, scope: f.scope, cause: f.cause })),
        ...entityOutcome.fallbacks.map((f) => ({ concern: 'entities' as const, scope: f.scope, cause: f.cause })),
      ];
      summary.attempts = { topics: topicOutcome.attempts, entities: entityOutcome.attempts };
      summary.vetoes.push(
        ...topicOutcome.vetoes.map((v) => ({ concern: 'topics' as const, from: v.from, into: v.into })),
        ...entityOutcome.vetoes.map((v) => ({ concern: 'entities' as const, from: v.from, into: v.into })),
      );
      // Phase 21 (§2.2): denials are recorded for audit (both pages stay).
      summary.denials = [
        ...(topicOutcome.pairVerdicts ?? [])
          .filter((verdict) => verdict.verdict === 'deny')
          .map((verdict) => ({
            concern: 'topics' as const,
            from: verdict.from,
            into: verdict.into,
            ...(verdict.justification !== undefined ? { justification: verdict.justification } : {}),
          })),
        ...(entityOutcome.pairVerdicts ?? [])
          .filter((verdict) => verdict.verdict === 'deny')
          .map((verdict) => ({
            concern: 'entities' as const,
            from: verdict.from,
            into: verdict.into,
            ...(verdict.justification !== undefined ? { justification: verdict.justification } : {}),
          })),
      ];
      // Phase 22 (§2.1): cluster denials are recorded the same way (every
      // member keeps its own page).
      summary.clusterDenials = (entityOutcome.clusterVerdicts ?? [])
        .filter((verdict) => verdict.verdict === 'deny')
        .map((verdict) => ({
          members: verdict.members,
          class: verdict.class,
          into: verdict.into,
          ...(verdict.rationale !== undefined ? { rationale: verdict.rationale } : {}),
        }));

      const appliedEntityMerges = await filterMerges(entityDecisions.merges, entityLocations, 'entities', 'entity');
      const appliedTopicMerges = await filterMerges(topicDecisions.merges, topicLocations, 'topics', 'topic');
      const appliedTopicDrops = await filterDrops(topicDecisions.drops, topicLocations);

      // ---- APPLY (phase doc §2.3, deterministic, all-or-nothing per the
      // validated lists) — the same closures the sticky/auto tiers used. ----
      for (const merge of appliedEntityMerges) {
        applyEntityMergeToMaps(merge);
      }
      for (const merge of appliedTopicMerges) {
        applyTopicMergeToMaps(merge);
      }
      for (const drop of appliedTopicDrops) {
        // The claims themselves stay on their entity/document pages
        // (preservation contract); only the topic grouping is discarded.
        topicMap.delete(drop);
      }

      // ---- Phase 22 (§2.1): APPLY CLUSTERS (deterministic, post-veto) ----
      // Confirmed deterministic proposals carry their signal; open
      // judgment-class clusters record as 'model'. The composite pools the
      // members' evidence; member pages are never written.
      const clusterProposalByMemberSet = new Map(
        proposedEntityClusters.map((cluster) => [[...cluster.members].sort().join(' '), cluster] as const),
      );
      const decidedEntityClusters: AppliedCluster[] = (entityDecisions.clusters ?? []).map(
        (cluster: CurationClusterDecision) => {
          const proposal = clusterProposalByMemberSet.get([...cluster.members].sort().join(' '));
          return {
            members: cluster.members,
            class: cluster.class,
            into: cluster.into,
            signal: proposal?.signal ?? 'model',
            ...(cluster.rationale !== undefined ? { rationale: cluster.rationale } : {}),
          };
        },
      );
      const appliedEntityClusters = await filterClusters(decidedEntityClusters, entityLocations, 'Curation entities cluster');
      for (const cluster of appliedEntityClusters) {
        applyEntityClusterToMaps(cluster);
        for (const member of cluster.members) {
          clusteredMemberSlugs.add(member);
        }
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
      // pages out of the applied lists, so only tool-written pages land
      // here). Phase 21: sticky + auto-applied merges delete identically.
      // Phase 22 (§2.2): cluster MEMBER pages (every member except `into` —
      // the composite takes over its path) delete identically; a reversed
      // cluster's composite page at the `into` path is deleted only when it
      // IS a composite page (frontmatter check — never a hand-maintained one).
      const deletions = new Set<string>();
      for (const merge of [...stickyEntityMerges, ...appliedEntityMerges]) {
        for (const from of merge.from) {
          for (const location of entityLocations.get(from) ?? []) {
            deletions.add(location);
          }
        }
      }
      for (const merge of [...stickyTopicMerges, ...appliedTopicMerges]) {
        for (const from of merge.from) {
          for (const location of topicLocations.get(from) ?? []) {
            deletions.add(location);
          }
        }
      }
      for (const drop of [...stickyTopicDrops, ...appliedTopicDrops]) {
        for (const location of topicLocations.get(drop) ?? []) {
          deletions.add(location);
        }
      }
      for (const entry of autoApplied) {
        const locations = entry.concern === 'topics' ? topicLocations : entityLocations;
        for (const location of locations.get(entry.from) ?? []) {
          deletions.add(location);
        }
      }
      for (const cluster of [...stickyEntityClusters, ...appliedEntityClusters]) {
        for (const member of cluster.members) {
          if (member === cluster.into) {
            continue;
          }
          for (const location of entityLocations.get(member) ?? []) {
            deletions.add(location);
          }
        }
      }
      for (const into of reversedClusterIntos) {
        for (const location of entityLocations.get(into) ?? []) {
          try {
            const parsed = matter(await readFile(join(dir, location), 'utf-8'));
            if (parsed.data.type === 'composite') {
              deletions.add(location);
            }
          } catch {
            // Unreadable page — never deleted on this path.
          }
        }
      }
      for (const location of deletions) {
        const absolute = join(dir, location);
        if (!existsSync(absolute)) {
          continue;
        }
        await rm(absolute, { force: true });
        summary.removedPages.push(location);
        await pruneEmptyFolderChain(join(dir, location.split('/')[0]), dirname(absolute));
      }

      // The curated maps define the folder structure from here on (rolling
      // memory + structural changes diff); identical to the aggregated set
      // when nothing merged/dropped, so the OFF path stays byte-identical.
      // Phase 22: composite folders (the `into` members' folders) included.
      folderStructure.clear();
      for (const entity of entityMap.values()) {
        folderStructure.add(entity.folder);
      }
      for (const topic of topicMap.values()) {
        folderStructure.add(topic.folder);
      }
      for (const composite of clusterMap.values()) {
        const intoAggregate = composite.members.find((member) => member.slug === composite.decision.into);
        if (intoAggregate) {
          folderStructure.add(intoAggregate.aggregate.folder);
        }
      }

      summary.entityMerges = appliedEntityMerges;
      summary.topicMerges = appliedTopicMerges;
      summary.topicDrops = appliedTopicDrops;
      summary.entityClusters = appliedEntityClusters;

      // ---- Phase 21 (§2.3): STICKY RECORDING. Every applied decision of
      // this run lands in `.state/curation-decisions.json` (auto tier with
      // its signal, confirmed pairs with theirs, open model merges and drops
      // as 'model') — later runs pre-apply them deterministically. Split
      // slugs touching a new record are consumed (appendCurationDecisions).
      // ------------------------------------------------------------------
      const newRecords: CurationDecisionRecord[] = [];
      for (const entry of autoApplied) {
        newRecords.push({
          concern: entry.concern,
          action: 'merge',
          from: [entry.from],
          into: entry.into,
          signal: entry.signal,
          decidedAt: runTimestamp,
          runId: runTimestamp,
        });
      }
      const topicPairByEdge = new Map(proposedTopicPairs.map((pair) => [`${pair.from} ${pair.into}`, pair]));
      for (const merge of appliedTopicMerges) {
        for (const from of merge.from) {
          const pair = topicPairByEdge.get(`${from} ${merge.into}`);
          newRecords.push({
            concern: 'topics',
            action: 'merge',
            from: [from],
            into: merge.into,
            signal: pair?.signal ?? 'model',
            decidedAt: runTimestamp,
            runId: runTimestamp,
          });
        }
      }
      for (const drop of appliedTopicDrops) {
        newRecords.push({
          concern: 'topics',
          action: 'drop',
          from: [drop],
          signal: 'model',
          decidedAt: runTimestamp,
          runId: runTimestamp,
        });
      }
      const entityPairByEdge = new Map(proposedEntityPairs.map((pair) => [`${pair.from} ${pair.into}`, pair]));
      for (const merge of appliedEntityMerges) {
        for (const from of merge.from) {
          const pair = entityPairByEdge.get(`${from} ${merge.into}`);
          newRecords.push({
            concern: 'entities',
            action: 'merge',
            from: [from],
            into: merge.into,
            signal: pair?.signal ?? 'model',
            decidedAt: runTimestamp,
            runId: runTimestamp,
          });
        }
      }
      // Phase 22 (§2.1): every applied cluster is recorded (`action:
      // 'cluster'`, from = the members other than `into`, class + rationale
      // carried) and pre-applied deterministically from the next run on.
      for (const cluster of appliedEntityClusters) {
        newRecords.push({
          concern: 'entities',
          action: 'cluster',
          from: cluster.members.filter((member) => member !== cluster.into).sort(),
          into: cluster.into,
          signal: cluster.signal,
          class: cluster.class,
          ...(cluster.rationale !== undefined ? { rationale: cluster.rationale } : {}),
          decidedAt: runTimestamp,
          runId: runTimestamp,
        });
      }
      if (newRecords.length > 0) {
        await appendCurationDecisions(dir, newRecords);
      }
    }
  }

  // Build a slug-to-title map so wikilinks can render in Obsidian's native
  // pipe form [[slug|Page Title]] instead of [[slug]]. Unknown slugs fall back
  // to the bare [[slug]] form. Built AFTER curation so it reflects the
  // curated set (merged-away slugs are gone; survivors render canonically).
  // Phase 22: composites render under their `into` slug with the composite
  // title (member titles joined ' — '); member slugs are remapped to it.
  const slugToTitle: Record<string, string> = {};
  for (const [slug, entity] of entityMap.entries()) {
    slugToTitle[slug] = entity.name;
  }
  for (const composite of clusterMap.values()) {
    slugToTitle[composite.decision.into] = composite.members
      .map((member) => member.aggregate.name)
      .join(' — ');
  }

  // ------------------------------------------------------------------
  // Phase 23 (§2.2, backlog B21): COMPARISON page assembly. One page per
  // comparison-table SUBJECT: identity = the canonical subject-entity slug
  // when resolvable through the curated aggregate (renamed/renumbered tables
  // reconcile onto ONE page through the entity's canonical identity — the
  // corpus's 2023→2024 indicator renumbering pattern), the normalized-title
  // slug only as fallback (never the drifting title alone). Cross-PDF
  // structural drift is NEVER force-merged: each source's table keeps its own
  // dated section, preserved verbatim as that source printed it.
  // ------------------------------------------------------------------
  interface ComparisonAggregate {
    title: string;
    slug: string;
    subject: string;
    sections: ComparisonTableSection[];
    seenKeys: Set<string>;
    tableEntities: Set<string>;
    captions: string[];
  }
  const comparisonMap = new Map<string, ComparisonAggregate>();
  const remapTableSlug = (slug: string): string => entitySlugRemap.get(slug) ?? slug;
  for (const { table, source, pages } of rawTables) {
    const tableTitle = table.title.trim();
    if (tableTitle === '' || table.markdown.trim() === '') {
      // Defensive: the schema validator rejects these; an old/hand-written
      // extraction file could still carry one — never emit a broken page.
      continue;
    }
    const rawSubject = typeof table.subject === 'string' ? table.subject.trim() : '';
    const resolvedSubject = rawSubject !== '' ? remapTableSlug(rawSubject) : '';
    const known = resolvedSubject !== '' && slugToTitle[resolvedSubject] !== undefined;
    const key = known ? resolvedSubject : slugify(tableTitle, options?.language?.input);
    if (key === '') {
      continue;
    }
    const section: ComparisonTableSection = {
      source,
      pages,
      page: table.page,
      tableTitle,
      rowDimension: table.rowDimension?.trim() ?? '',
      colDimension: table.colDimension?.trim() ?? '',
      entities: Array.from(new Set((table.entities ?? []).map(remapTableSlug))),
      markdown: table.markdown,
      summary: table.summary?.trim() ?? '',
    };
    const dedupeKey = `${source}|${table.page}|${tableTitle}|${table.markdown}`;
    const existing = comparisonMap.get(key);
    if (existing) {
      if (!existing.seenKeys.has(dedupeKey)) {
        existing.seenKeys.add(dedupeKey);
        existing.sections.push(section);
      }
      for (const entitySlug of section.entities) {
        existing.tableEntities.add(entitySlug);
      }
      if (!existing.captions.includes(tableTitle)) {
        existing.captions.push(tableTitle);
      }
    } else {
      comparisonMap.set(key, {
        title: known ? slugToTitle[resolvedSubject] : tableTitle,
        slug: key,
        subject: known ? resolvedSubject : key,
        sections: [section],
        seenKeys: new Set([dedupeKey]),
        tableEntities: new Set(section.entities),
        captions: [tableTitle],
      });
    }
  }
  // Dated sections in deterministic order (source, then page).
  for (const aggregate of comparisonMap.values()) {
    aggregate.sections.sort((a, b) => a.source.localeCompare(b.source) || a.page - b.page);
  }
  if (comparisonMap.size > 0) {
    // The ratified top-level folder (`03` §3.1 extended) joins the folder
    // structure so rolling memory and the structural-change diff see it —
    // added AFTER the curation stage's folderStructure rebuild above.
    folderStructure.add('comparisons');
  }

  const result: MaterializeResult = { entityPages: [], compositePages: [], topicPages: [], comparisonPages: [], documentPages: [], writtenPages: [], preservedPages: [], conflicts: [], convergedPages: [], removedDuplicates: [] };

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
    // Rendered BEFORE the conflict check so the Phase 19 (§2.3) safe
    // convergence can compare the on-disk content against the deterministic
    // render of the current aggregate: a stale recorded hash with a
    // byte-identical disk page is the tool's own bookkeeping leak, not a
    // human edit — converge (proceed with the update, record the disk hash,
    // log a convergence note) instead of false-flagging.
    const rendered = writeEntityPage(pageData);
    const verdict = await checkPageConflict(pagePath, relativePath, options?.pageHashes, rendered);
    if (verdict === 'conflict') {
      await logManualEditConflict(dir, relativePath);
      result.conflicts.push(relativePath);
      continue;
    }
    if (verdict === 'converge') {
      logHashConvergence(relativePath);
      result.convergedPages.push(relativePath);
    }

    result.entityPages.push(pageData);
    await writeFile(pagePath, rendered, 'utf-8');
    result.writtenPages.push({ path: relativePath, hash: hashContent(rendered) });
  }

  // Phase 22 (§2.2): write the COMPOSITE pages — one per active cluster, at
  // the `into` member's folder/slug. Member pages were never written (they
  // were pulled out of entityMap above); every evidence item keeps its
  // member association in the per-member groups. Same Phase 16 preservation
  // and Phase 8/19 conflict/convergence postures as the entity loop.
  for (const composite of clusterMap.values()) {
    const { decision, members } = composite;
    const intoAggregate = members.find((member) => member.slug === decision.into)?.aggregate;
    const folder = intoAggregate?.folder ?? 'entities';
    const memberSlugs = new Set(members.map((member) => member.slug));

    const memberDatas: CompositeMember[] = members.map(({ slug, aggregate }) => ({
      slug,
      title: aggregate.name,
      type: aggregate.type,
      // The class-3 role descriptor; other classes rely on the entity type.
      ...(decision.class === 3 ? { role: isIndicatorSlug(slug) ? 'indicator' : 'concept' } : {}),
      ...(aggregate.significance.trim().length > 0 ? { significance: aggregate.significance.trim() } : {}),
      ...(aggregate.disambiguation !== undefined && aggregate.disambiguation.trim().length > 0
        ? { disambiguation: aggregate.disambiguation.trim() }
        : {}),
      ...(aggregate.aliases.length > 0 ? { aliases: Array.from(new Set(aggregate.aliases)) } : {}),
    }));

    const memberEvidence: CompositeMemberEvidence[] = members.map(({ slug, aggregate }) => {
      const relationships = dedupeRelationships(aggregate.relationships);
      // Intra-cluster mirror dedupe (the entity-loop self-loop rule): when a
      // relationship's subject AND object are both members, the record exists
      // as outgoing in the subject's group AND incoming here — drop the
      // incoming copy so the loop renders ONCE, as outgoing.
      const incomingRelationships = dedupeIncomingRelationships(aggregate.incomingRelationships).filter(
        (incoming) =>
          !members.some(
            (other) =>
              other.slug !== slug &&
              dedupeRelationships(other.aggregate.relationships).some(
                (rel) =>
                  rel.subject === incoming.subject &&
                  rel.object === slug &&
                  rel.predicate === incoming.predicate &&
                  rel.page === incoming.page &&
                  rel.source === incoming.source &&
                  rel.pages === incoming.pages,
              ),
          ),
      );
      return {
        slug,
        mentions: dedupeMentions(aggregate.mentions),
        relationships,
        incomingRelationships,
        claims: dedupeClaims(aggregate.claims),
        timeline: dedupeTimeline(aggregate.timeline),
        contexts: Array.from(aggregate.contexts),
      };
    });

    const aliasExtras = Array.from(
      new Set([
        ...members.map((member) => member.aggregate.name),
        ...members.flatMap((member) => member.aggregate.aliases),
      ]),
    );
    const contexts = Array.from(new Set(members.flatMap((member) => member.aggregate.contexts)));

    const compositeData: CompositePageData = {
      title: members.map((member) => member.aggregate.name).join(' — '),
      slug: decision.into,
      folder,
      wiki: wikiSlug,
      class: decision.class,
      members: memberDatas,
      memberEvidence,
      slugToTitle,
      ...(aliasExtras.length > 0 ? { aliases: aliasExtras } : {}),
      ...(contexts.length > 0 ? { context: contexts.join('\n\n') } : {}),
    };

    const folderPath = join(dir, folder);
    await mkdir(folderPath, { recursive: true });
    const pagePath = join(folderPath, `${decision.into}.md`);
    const relativePath = synthesisPagePath(compositeData);
    // Phase 16 (vision `04` Step 9): the resume contract — a skip-eligible
    // record whose fingerprint matches the { members, unioned evidence,
    // language } hash preserves the finished composite byte-for-byte.
    const synthesisRecord = synthesisRecords[relativePath];
    if (
      isSkipEligible(synthesisRecord) &&
      synthesisRecord.dataHash === pageDataHash(compositeData, resumeLanguage) &&
      existsSync(pagePath)
    ) {
      result.compositePages.push(compositeData);
      result.preservedPages.push({ path: relativePath, hash: hashContent(await readFile(pagePath, 'utf-8')) });
      continue;
    }
    const rendered = writeCompositePage(compositeData);
    const verdict = await checkPageConflict(pagePath, relativePath, options?.pageHashes, rendered);
    if (verdict === 'conflict') {
      await logManualEditConflict(dir, relativePath);
      result.conflicts.push(relativePath);
      continue;
    }
    if (verdict === 'converge') {
      logHashConvergence(relativePath);
      result.convergedPages.push(relativePath);
    }

    result.compositePages.push(compositeData);
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
    // Same Phase 19 (§2.3) safe convergence as the entity loop above: the
    // render is computed before the conflict check so a stale recorded hash
    // over a provably-tool-written page converges instead of false-flagging.
    const rendered = writeTopicPage(pageData);
    const verdict = await checkPageConflict(pagePath, relativePath, options?.pageHashes, rendered);
    if (verdict === 'conflict') {
      await logManualEditConflict(dir, relativePath);
      result.conflicts.push(relativePath);
      continue;
    }
    if (verdict === 'converge') {
      logHashConvergence(relativePath);
      result.convergedPages.push(relativePath);
    }

    result.topicPages.push(pageData);
    await writeFile(pagePath, rendered, 'utf-8');
    result.writtenPages.push({ path: relativePath, hash: hashContent(rendered) });
  }

  // Phase 23 (§2.2): write the COMPARISON pages — one per comparison-table
  // subject, at `comparisons/<slug>.md`. The bridge is computed here from the
  // CURATED topic claims: exactly the claims sharing the table's entities
  // (claim.entities ∩ table entities, deterministic), linking out to the live
  // topic/entity pages where free-text comparisons already live. Same
  // Phase 16 resume preservation and Phase 8/19 conflict/convergence
  // postures as the entity/topic/composite loops.
  for (const aggregate of comparisonMap.values()) {
    const bridge: ComparisonBridgeEntry[] = [];
    const seenBridgeClaims = new Set<string>();
    for (const topic of topicMap.values()) {
      for (const claim of topic.claims) {
        const shared = Array.from(new Set(claim.entities.filter((slug) => aggregate.tableEntities.has(slug))));
        if (shared.length === 0) {
          continue;
        }
        const bridgeKey = `${claim.text}|${claim.type}|${claim.source}|${claim.pages}`;
        if (seenBridgeClaims.has(bridgeKey)) {
          continue;
        }
        seenBridgeClaims.add(bridgeKey);
        bridge.push({
          text: claim.text,
          topicSlug: claim.type,
          entities: shared,
          source: claim.source,
          pages: claim.pages,
        });
      }
    }

    const pageData: ComparisonPageData = {
      title: aggregate.title,
      slug: aggregate.slug,
      folder: 'comparisons',
      wiki: wikiSlug,
      subject: aggregate.subject,
      tables: aggregate.sections,
      bridge,
      slugToTitle,
      // Drift aliases: every distinct caption any source gave this table —
      // a renamed/renumbered table's old titles still find the ONE page.
      aliases: aggregate.captions.length > 0 ? aggregate.captions : undefined,
    };

    const folderPath = join(dir, 'comparisons');
    await mkdir(folderPath, { recursive: true });
    const pagePath = join(folderPath, `${aggregate.slug}.md`);
    const relativePath = synthesisPagePath(pageData);
    // Phase 16 (vision `04` Step 9): the resume contract — a skip-eligible
    // record whose fingerprint matches the current aggregate preserves the
    // finished comparison page byte-for-byte.
    const synthesisRecord = synthesisRecords[relativePath];
    if (
      isSkipEligible(synthesisRecord) &&
      synthesisRecord.dataHash === pageDataHash(pageData, resumeLanguage) &&
      existsSync(pagePath)
    ) {
      result.comparisonPages.push(pageData);
      result.preservedPages.push({ path: relativePath, hash: hashContent(await readFile(pagePath, 'utf-8')) });
      continue;
    }
    const rendered = writeComparisonPage(pageData);
    const verdict = await checkPageConflict(pagePath, relativePath, options?.pageHashes, rendered);
    if (verdict === 'conflict') {
      await logManualEditConflict(dir, relativePath);
      result.conflicts.push(relativePath);
      continue;
    }
    if (verdict === 'converge') {
      logHashConvergence(relativePath);
      result.convergedPages.push(relativePath);
    }

    result.comparisonPages.push(pageData);
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
    // Phase 23: comparison pages join the rewrite scope — a resume-preserved
    // comparison page's entity links repoint to canonical slugs like any
    // other pre-existing content page (freshly-written ones are skipped).
    for (const section of ['entities', 'topics', 'documents', 'comparisons']) {
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
    entities: [
      ...Array.from(entityMap.entries()).map(([slug, entity]) => ({
        slug,
        folder: entity.folder,
        mentionCount: entity.mentions.length,
      })),
      // Phase 22 (§2.2): composites are tracked at their `into` slug (the
      // canonical-folder rule keeps covering them); member slugs are absent
      // while clustered — extraction re-aggregates them every run and the
      // sticky record re-clusters them before candidates.
      ...Array.from(clusterMap.values()).map((composite) => {
        const intoAggregate = composite.members.find((member) => member.slug === composite.decision.into)?.aggregate;
        return {
          slug: composite.decision.into,
          folder: intoAggregate?.folder ?? 'entities',
          mentionCount: composite.members.reduce((count, member) => count + member.aggregate.mentions.length, 0),
        };
      }),
    ].sort((a, b) => a.slug.localeCompare(b.slug)),
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
    if (folder === 'comparisons') {
      // Phase 23 (§2.2): the ratified top-level folder is logged with the
      // comparison-page count and the tables' entities (the entity-folder
      // branch below would misreport it — comparison pages live outside
      // entityMap).
      const tableEntities = Array.from(
        new Set(
          Array.from(comparisonMap.values()).flatMap((aggregate) =>
            aggregate.sections.flatMap((section) => section.entities),
          ),
        ),
      ).sort((a, b) => a.localeCompare(b));
      structuralChanges.push({
        timestamp: structuralTimestamp,
        type: 'new-folder',
        path: folder,
        reason: `${comparisonMap.size} comparison ${comparisonMap.size === 1 ? 'page' : 'pages'} created from extracted comparison tables`,
        ...(tableEntities.length > 0 ? { affectedEntities: tableEntities } : {}),
      });
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
  // curation, vision `04` Step 6 item 5). Phase 21 (§2.1–§2.3): the report
  // distinguishes fromSticky vs decidedThisRun (with per-merge provenance)
  // and records proposed pairs, the no-LLM auto tier, denials, and split
  // reversals — all additive fields over the frozen legacy shape.
  if (curationSummary !== null) {
    result.curation = curationSummary;
    const reportRun = curationRunTimestamp ?? new Date().toISOString();
    const decidedMerges = (
      concern: 'topics' | 'entities',
      merges: CurationMergeDecision[],
    ): Array<{ from: string[]; into: string; signal: string; evidence?: string }> => {
      const details: Array<{ from: string[]; into: string; signal: string; evidence?: string }> = [];
      for (const entry of curationSummary.autoApplied.filter((auto) => auto.concern === concern)) {
        details.push({ from: [entry.from], into: entry.into, signal: entry.signal, evidence: entry.evidence });
      }
      const pairsByEdge = new Map(
        curationSummary.proposedPairs
          .filter((pair) => pair.concern === concern)
          .map((pair) => [`${pair.from} ${pair.into}`, pair]),
      );
      for (const merge of merges) {
        const edgePairs = merge.from.map((from) => pairsByEdge.get(`${from} ${merge.into}`));
        const allFromPairs =
          edgePairs.length > 0 &&
          edgePairs.every((pair) => pair !== undefined && pair.signal === edgePairs[0]?.signal);
        details.push({
          from: merge.from,
          into: merge.into,
          signal: allFromPairs ? (edgePairs[0]?.signal ?? 'model') : 'model',
          ...(allFromPairs && edgePairs[0] !== undefined ? { evidence: edgePairs[0].evidence } : {}),
        });
      }
      return details;
    };
    await writeCurationReport(dir, {
      run: reportRun,
      topics: {
        merges: curationSummary.topicMerges,
        drops: curationSummary.topicDrops,
        attempts: curationSummary.attempts.topics,
        fallbacks: (topicOutcome?.fallbacks ?? []).map((f) => ({ scope: f.scope, cause: f.cause })),
        // Summary vetoes cover validation vetoes AND Phase 21 auto-tier vetoes.
        vetoes: curationSummary.vetoes
          .filter((veto) => veto.concern === 'topics')
          .map((veto) => ({ from: veto.from, into: veto.into })),
        fromSticky: { merges: curationSummary.fromSticky.topicMerges, drops: curationSummary.fromSticky.topicDrops },
        decidedThisRun: {
          merges: decidedMerges('topics', curationSummary.topicMerges),
          drops: curationSummary.topicDrops,
          denials: curationSummary.denials
            .filter((denial) => denial.concern === 'topics')
            .map((denial) => ({
              from: denial.from,
              into: denial.into,
              ...(denial.justification !== undefined ? { justification: denial.justification } : {}),
            })),
        },
        proposedPairs: curationSummary.proposedPairs
          .filter((pair) => pair.concern === 'topics')
          .map((pair) => ({ from: pair.from, into: pair.into, signal: pair.signal, evidence: pair.evidence })),
        autoApplied: curationSummary.autoApplied
          .filter((pair) => pair.concern === 'topics')
          .map((pair) => ({ from: pair.from, into: pair.into, signal: pair.signal, evidence: pair.evidence })),
      },
      entities: {
        merges: curationSummary.entityMerges,
        drops: [],
        attempts: curationSummary.attempts.entities,
        fallbacks: (entityOutcome?.fallbacks ?? []).map((f) => ({ scope: f.scope, cause: f.cause })),
        // Summary vetoes cover validation vetoes AND Phase 21 auto-tier vetoes.
        vetoes: curationSummary.vetoes
          .filter((veto) => veto.concern === 'entities')
          .map((veto) => ({ from: veto.from, into: veto.into })),
        fromSticky: {
          merges: curationSummary.fromSticky.entityMerges,
          drops: [],
          // Phase 22 (§2.1): sticky cluster records pre-applied this run.
          clusters: curationSummary.fromSticky.entityClusters.map((cluster) => ({
            members: cluster.members,
            class: cluster.class,
            into: cluster.into,
            signal: cluster.signal,
            ...(cluster.rationale !== undefined ? { rationale: cluster.rationale } : {}),
          })),
        },
        decidedThisRun: {
          merges: decidedMerges('entities', curationSummary.entityMerges),
          drops: [],
          denials: curationSummary.denials
            .filter((denial) => denial.concern === 'entities')
            .map((denial) => ({
              from: denial.from,
              into: denial.into,
              ...(denial.justification !== undefined ? { justification: denial.justification } : {}),
            })),
          // Phase 22 (§2.1): clusters decided this run (with provenance) +
          // the proposed clusters the model denied.
          clusters: curationSummary.entityClusters.map((cluster) => ({
            members: cluster.members,
            class: cluster.class,
            into: cluster.into,
            signal: cluster.signal,
            ...(cluster.rationale !== undefined ? { rationale: cluster.rationale } : {}),
          })),
          clusterDenials: curationSummary.clusterDenials.map((denial) => ({
            members: denial.members,
            class: denial.class,
            into: denial.into,
            ...(denial.rationale !== undefined ? { rationale: denial.rationale } : {}),
          })),
        },
        proposedPairs: curationSummary.proposedPairs
          .filter((pair) => pair.concern === 'entities')
          .map((pair) => ({ from: pair.from, into: pair.into, signal: pair.signal, evidence: pair.evidence })),
        autoApplied: curationSummary.autoApplied
          .filter((pair) => pair.concern === 'entities')
          .map((pair) => ({ from: pair.from, into: pair.into, signal: pair.signal, evidence: pair.evidence })),
        // Phase 22 (§2.1): the proposed clusters the model was asked to judge.
        proposedClusters: curationSummary.proposedClusters.map((cluster) => ({
          members: cluster.members,
          class: cluster.class,
          into: cluster.into,
          signal: cluster.signal,
          evidence: cluster.evidence,
        })),
      },
      manualEditSkips: curationSummary.manualEditSkips,
      removedPages: curationSummary.removedPages,
      rewrittenLinks: curationSummary.rewrittenLinks,
      splitReversals: curationSummary.splitReversals,
    });
  }

  return result;
}
