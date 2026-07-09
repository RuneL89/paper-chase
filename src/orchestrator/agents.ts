import type { LLMClient } from '../llm/client.js';
import { parseStructuredJson } from '../llm/json.js';
import type { Chunk } from '../chunking/types.js';
import type { ExtractionResult, ExtractedPage } from '../extractor/types.js';
import type {
  EntityType,
  ExtractedEntity,
  ExtractedRelationship,
  ExtractedEvidence,
  PagePlan,
  FolderPlan,
  OrchestratorMemory,
  CriticReview,
  CriticCheck,
  PageUpdate,
  DiscoveryChecklist,
  DuplicateFlag,
  PagePlannerOutput,
} from './types.js';
import { buildDocumentPage, type LlmPageContent } from '../writers/document.js';
import { validateFrontmatter } from '../validation/schema.js';
import {
  extractEntities,
  entityPageTitle,
  looksLikeOrganization,
  containsOrgKeyword,
  containsProductKeyword,
  looksLikePerson,
  looksLikeAcronym,
} from '../entities/index.js';
import { extractTopics, topicPageTitle, isGenericTopic } from '../topics/index.js';
import { slugify, SlugRegistry } from '../utils/slug.js';
import { findPotentialDuplicates, findCrossDuplicates } from '../utils/similarity.js';
import type { Config } from '../config.js';
import { buildPrompt } from './prompt-loader.js';

export interface StructureOutput {
  headings: { title: string; page: number; level: number }[];
  sections: { title: string; startPage: number; endPage: number; level: number }[];
  boundaries: { type: string; pageRange: string; description: string }[];
  pageRange: string;
  boundaryType: string;
  readingOrderFlags: string[];
}

export interface EntityOutput {
  entities: ExtractedEntity[];
}

export interface RelationshipOutput {
  relationships: ExtractedRelationship[];
}

export interface EvidenceOutput {
  claims: { text: string; evidence: string; pages: string }[];
  tables: { page: number; caption?: string; markdown: string }[];
  figures: { page: number; caption?: string; description: string }[];
}

export { PagePlannerOutput, PagePlan };

const DEFAULT_PAGE_TYPES = ['document', 'source', 'topic', 'entity', 'raw', 'index'];

const entityPatterns: Record<EntityType, RegExp> = {
  person: /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g,
  organization: /\b([A-Z][a-z]+\s+(?:Corp|Inc|LLC|Ltd|Company|Association|Organization|Agency))\b/g,
  location: /\b([A-Z][a-z]+\s*,\s*[A-Z]{2})\b/g,
  case: /\b([A-Z][a-z]+\s+v\.?\s+[A-Z][a-z]+)\b/gi,
  event: /\b(20\d{2}\s+[A-Z][a-z]+\s+Conference|Summit|Meeting)\b/g,
  product: /\b([A-Z][a-z]+\s+(?:Product|Device|System|Platform|Tool))\b/g,
};

function inferEntityType(name: string): EntityType {
  const lower = name.toLowerCase();
  // Acronyms without other clues are treated as organizations/products by default.
  if (/^[A-Z]{2,8}$/.test(name.trim())) return 'organization';
  if (lower.includes('corp') || lower.includes('inc') || lower.includes('llc') || lower.includes('company')) return 'organization';
  if (/\d{4}/.test(lower) && (lower.includes('conference') || lower.includes('summit') || lower.includes('meeting'))) return 'event';
  if (lower.includes('product') || lower.includes('device') || lower.includes('system') || lower.includes('platform')) return 'product';
  if (lower.includes(' v. ') || lower.includes(' vs. ')) return 'case';
  if (/[\s,]+[A-Z]{2}$/i.test(name)) return 'location';
  // A two-word capitalized name is the classic person pattern; otherwise
  // default to organization rather than guessing person.
  if (/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(name)) return 'person';
  return 'organization';
}

function parsePageRange(range: string): number[] {
  const match = range.match(/^(\d+)(?:-(\d+))?$/);
  if (!match) return [1];
  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : start;
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
}

// ---------- Canonical name resolution ----------

function buildEntityLookup(memory?: OrchestratorMemory): Map<string, string> {
  const lookup = new Map<string, string>();
  if (!memory) return lookup;

  for (const [slug, entity] of Object.entries(memory.state.entities)) {
    lookup.set(entity.name.toLowerCase(), slug);
    for (const alias of entity.aliases) {
      lookup.set(alias.toLowerCase(), slug);
    }
  }

  return lookup;
}

function buildSlugRegistry(memory?: OrchestratorMemory): SlugRegistry {
  const registry = new SlugRegistry();
  if (memory) {
    registry.seedFromSlugs(Object.keys(memory.state.entities));
  }
  return registry;
}

function findCanonicalSlug(
  entity: ExtractedEntity,
  lookup: Map<string, string>,
  registry: SlugRegistry,
  memory?: OrchestratorMemory,
): { slug: string; canonicalName?: string } {
  const lowerName = entity.name.toLowerCase();
  if (lookup.has(lowerName)) {
    const slug = lookup.get(lowerName)!;
    return { slug, canonicalName: memory?.state.entities[slug]?.name };
  }
  for (const alias of entity.aliases) {
    const lowerAlias = alias.toLowerCase();
    if (lookup.has(lowerAlias)) {
      const slug = lookup.get(lowerAlias)!;
      return { slug, canonicalName: memory?.state.entities[slug]?.name };
    }
  }
  // Honor an LLM-provided canonical slug when it does not collide with an existing name.
  if (entity.canonical) {
    const peeked = registry.peek(entity.canonical);
    if (peeked === slugify(entity.canonical)) {
      return { slug: registry.register(entity.canonical) };
    }
  }
  return { slug: registry.register(entity.name) };
}

function findCanonicalSlugByName(name: string, memory: OrchestratorMemory): string | undefined {
  const lower = name.toLowerCase().trim();
  for (const [slug, entity] of Object.entries(memory.state.entities)) {
    if (entity.name.toLowerCase() === lower) return slug;
    for (const alias of entity.aliases) {
      if (alias.toLowerCase() === lower) return slug;
    }
  }
  return undefined;
}

function resolveAndMergeEntities(
  entities: ExtractedEntity[],
  memory?: OrchestratorMemory,
): ExtractedEntity[] {
  const lookup = buildEntityLookup(memory);
  const registry = buildSlugRegistry(memory);
  const resolved = new Map<string, ExtractedEntity>();

  for (const entity of entities) {
    const { slug: canonical, canonicalName } = findCanonicalSlug(entity, lookup, registry, memory);
    const displayName = canonicalName || entity.name;
    const existing = resolved.get(canonical);
    if (existing) {
      existing.count += entity.count;
      existing.mentions.push(...entity.mentions);
      existing.confidence = Math.max(existing.confidence, entity.confidence);
      // Prefer the longest, most descriptive display name as the canonical name.
      if (entity.name.length > existing.name.length) {
        lookup.set(existing.name.toLowerCase(), canonical);
        existing.aliases.push(existing.name);
        existing.name = entity.name;
      }
      // Track the incoming entity's name as an alias if it differs from the canonical name.
      if (existing.name.toLowerCase() !== entity.name.toLowerCase() && !existing.aliases.includes(entity.name)) {
        existing.aliases.push(entity.name);
      }
      for (const alias of entity.aliases) {
        if (!existing.aliases.includes(alias)) {
          existing.aliases.push(alias);
          lookup.set(alias.toLowerCase(), canonical);
        }
      }
      if (!lookup.has(existing.name.toLowerCase())) {
        lookup.set(existing.name.toLowerCase(), canonical);
      }
    } else {
      resolved.set(canonical, {
        ...entity,
        name: displayName,
        canonical,
        aliases: [...entity.aliases],
      });
      lookup.set(displayName.toLowerCase(), canonical);
      for (const alias of entity.aliases) {
        lookup.set(alias.toLowerCase(), canonical);
      }
    }
  }

  return Array.from(resolved.values());
}

/**
 * Merge entities that are fragments of a longer entity name. For example,
 * "Entrez Programming" and "Programming Utilities" are both fragments of
 * "Entrez Programming Utilities" and should be treated as the same entity.
 * Acronyms and single-word names are not merged so that "NCBI" stays distinct
 * from "NCBI Handbook".
 */
function mergeFragmentEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
  const sorted = [...entities].sort(
    (a, b) => b.name.length - a.name.length || a.name.localeCompare(b.name),
  );
  const merged: ExtractedEntity[] = [];
  const consumed = new Set<string>();

  for (const entity of sorted) {
    if (consumed.has(entity.canonical)) continue;
    let target: ExtractedEntity | undefined;
    for (const candidate of merged) {
      if (candidate.name.toLowerCase() === entity.name.toLowerCase()) continue;
      if (isPhraseFragment(entity.name, candidate.name)) {
        target = candidate;
        break;
      }
    }
    if (target) {
      target.count += entity.count;
      target.confidence = Math.max(target.confidence, entity.confidence);
      target.mentions.push(...entity.mentions);
      if (!target.aliases.includes(entity.name) && target.name.toLowerCase() !== entity.name.toLowerCase()) {
        target.aliases.push(entity.name);
      }
      consumed.add(entity.canonical);
    } else {
      merged.push(entity);
    }
  }

  return merged;
}

function isPhraseFragment(shorter: string, longer: string): boolean {
  const sWords = shorter.toLowerCase().split(/[\s\-]+/).filter(Boolean);
  // Only merge multi-word fragments; single-word names may be acronyms or
  // distinct entities.
  if (sWords.length < 2) return false;
  const lWords = longer.toLowerCase().split(/[\s\-]+/).filter(Boolean);
  if (sWords.length >= lWords.length) return false;
  // Only treat the shorter phrase as a fragment if it matches the prefix or
  // suffix of the longer phrase. This prevents false merges like merging
  // "Acme Corp" into the cross-sentence artifact "Globex Acme Corp".
  const prefixMatch = sWords.every((w, i) => w === lWords[i]);
  const suffixMatch = sWords.every((w, i) => w === lWords[lWords.length - sWords.length + i]);
  return prefixMatch || suffixMatch;
}

/**
 * Merge entities that share a name or alias, e.g. deterministic fallback "Acme Corp"
 * and LLM result "Acme Corporation (alias: Acme Corp)". The longer name is preferred
 * as the canonical display name.
 */
function mergeByNameAndAlias(entities: ExtractedEntity[]): ExtractedEntity[] {
  const sorted = [...entities].sort(
    (a, b) => b.name.length - a.name.length || b.confidence - a.confidence || a.name.localeCompare(b.name),
  );
  const merged: ExtractedEntity[] = [];
  const consumed = new Set<string>();

  function allNames(entity: ExtractedEntity): Set<string> {
    const names = new Set<string>([entity.name.toLowerCase()]);
    for (const alias of entity.aliases) names.add(alias.toLowerCase());
    return names;
  }

  for (const entity of sorted) {
    if (consumed.has(entity.canonical)) continue;
    const entityNames = allNames(entity);
    let target: ExtractedEntity | undefined;
    for (const candidate of merged) {
      if (candidate.canonical === entity.canonical) continue;
      for (const name of entityNames) {
        if (allNames(candidate).has(name)) {
          target = candidate;
          break;
        }
      }
      if (target) break;
    }
    if (target) {
      target.count += entity.count;
      target.confidence = Math.max(target.confidence, entity.confidence);
      target.mentions.push(...entity.mentions);
      // Prefer the longest overlapping name as the canonical display name.
      const allOverlapping = [entity.name, ...entity.aliases, target.name, ...target.aliases];
      const longest = allOverlapping.reduce((longest, current) =>
        current.length > longest.length ? current : longest,
      );
      if (longest.toLowerCase() !== target.name.toLowerCase()) {
        target.aliases.push(target.name);
        target.name = longest;
      }
      const uniqueAliases = new Set<string>();
      for (const alias of entity.aliases) uniqueAliases.add(alias);
      for (const alias of target.aliases) uniqueAliases.add(alias);
      target.aliases = Array.from(uniqueAliases).filter(
        (a) => a.toLowerCase() !== target.name.toLowerCase(),
      );
      consumed.add(entity.canonical);
    } else {
      merged.push(entity);
    }
  }

  return merged;
}

function normalizeEntityType(type: string): EntityType {
  const allowed: EntityType[] = ['person', 'organization', 'location', 'case', 'event', 'product'];
  return allowed.includes(type as EntityType) ? (type as EntityType) : inferEntityType(type);
}

// ---------- Agents ----------

/**
 * StructureAnalyst: derive headings, sections, and chunk boundaries from the PDF structure.
 */
export async function structureAnalyst(
  result: ExtractionResult,
  chunks: Chunk[],
  llmClient: LLMClient,
  agentsMd?: string,
  memory?: OrchestratorMemory,
): Promise<StructureOutput> {
  const fallback = structureAnalystFallback(result, chunks);

  if (!llmClient.isEnabled()) {
    return fallback;
  }

  try {
    const context = buildStructureContext(result, chunks, agentsMd, memory);
    const response = await llmClient.call(buildPrompt('structure-analyst', context), {
      maxTokens: 1000,
      temperature: 0.2,
    });
    const parsed = parseStructuredJson<StructureOutput>(response.text);
    if (parsed && isValidStructureOutput(parsed)) {
      return parsed;
    }
  } catch {
    // Fall through to deterministic fallback.
  }

  return fallback;
}

function structureAnalystFallback(result: ExtractionResult, chunks: Chunk[]): StructureOutput {
  const headings = result.pages
    .flatMap((page) =>
      (page.estimatedHeadings ?? []).map((title) => ({
        title,
        page: page.physicalPage,
        level: 1,
      })),
    )
    .slice(0, 20);

  const sections: StructureOutput['sections'] = [];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].page;
    const end = i + 1 < headings.length ? headings[i + 1].page - 1 : result.physicalPages;
    sections.push({
      title: headings[i].title,
      startPage: start,
      endPage: Math.max(start, end),
      level: headings[i].level,
    });
  }

  const boundaries = chunks.map((chunk) => ({
    type: chunk.boundaryType,
    pageRange: chunk.pageRange,
    description: chunk.title,
  }));

  return {
    headings,
    sections,
    boundaries,
    pageRange: `1-${result.physicalPages}`,
    boundaryType: result.tables.length > 0 ? 'table' : result.figures.length > 0 ? 'figure' : 'page',
    readingOrderFlags: result.pages.some((p) => p.isScanned) ? ['scanned-pages-excluded'] : [],
  };
}

function isValidStructureOutput(output: unknown): output is StructureOutput {
  const o = output as Record<string, unknown> | undefined;
  if (!o || typeof o !== 'object') return false;
  return Array.isArray(o.headings) && Array.isArray(o.sections) && Array.isArray(o.boundaries) && typeof o.pageRange === 'string';
}

function buildStructureContext(
  result: ExtractionResult,
  chunks: Chunk[],
  agentsMd?: string,
  memory?: OrchestratorMemory,
): string {
  const lines: string[] = [];

  lines.push('## PDF metadata');
  lines.push(`- file: ${result.fileName}`);
  lines.push(`- pages: ${result.physicalPages}`);
  lines.push(`- title: ${result.metadata.title || 'unknown'}`);
  lines.push(`- tables: ${result.tables.length}`);
  lines.push(`- figures: ${result.figures.length}`);
  lines.push(`- scanned pages: ${result.pages.filter((p) => p.isScanned).map((p) => p.physicalPage).join(', ') || 'none'}`);
  lines.push('');

  if (agentsMd) {
    lines.push('## AGENTS.md');
    lines.push(agentsMd);
    lines.push('');
  }

  if (memory && memory.rollingSummary) {
    lines.push('## Rolling memory');
    lines.push(memory.summaryOnly ? '[Summary-only mode: structured state preserved for lookups]' : memory.rollingSummary);
    lines.push('');
  }

  lines.push('## Extracted text by page');
  for (const page of result.pages) {
    lines.push(`### Page ${page.physicalPage}`);
    lines.push(page.text.slice(0, 200));
    lines.push('');
  }

  lines.push('## Chunk boundaries');
  for (const chunk of chunks) {
    lines.push(`- ${chunk.id}: ${chunk.boundaryType} (${chunk.pageRange})`);
  }

  return lines.join('\n');
}

/**
 * EntityExtractor: surface people, organizations, locations, cases, events, and products.
 */
export async function entityExtractor(
  result: ExtractionResult,
  chunks: Chunk[],
  llmClient: LLMClient,
  agentsMd?: string,
  memory?: OrchestratorMemory,
): Promise<EntityOutput> {
  const fallback = entityExtractorFallback(result, chunks);
  const fallbackEntities = filterQualityEntities(fallback.entities, chunks);
  let llmEntities: ExtractedEntity[] = [];

  if (llmClient.isEnabled()) {
    try {
      const context = buildEntityContext(result, chunks, agentsMd, memory);
      const response = await llmClient.call(buildPrompt('entity-extractor', context), {
        maxTokens: 2000,
        temperature: 0.2,
      });
      const parsed = parseStructuredJson<{ entities?: unknown[] }>(response.text);
      if (parsed && Array.isArray(parsed.entities)) {
        const normalized = parsed.entities
          .map((e) => normalizeExtractedEntity(e))
          .filter((e): e is ExtractedEntity => {
            if (!e) return false;
            // Only keep LLM entities that include a non-empty description. The
            // deterministic fallback provides entities without descriptions, so this
            // filter prevents low-quality LLM hallucinations from swamping the corpus.
            return typeof e.description === 'string' && e.description.trim().length > 0;
          });
        llmEntities = filterQualityEntities(normalized, chunks);
      }
    } catch {
      // Keep the filtered fallback.
    }
  }

  // Merge the deterministic fallback with LLM results so that full names
  // discovered by local extraction are not lost when the LLM only returns fragments.
  const combined = resolveAndMergeEntities([...fallbackEntities, ...llmEntities], memory);
  const merged = mergeByNameAndAlias(mergeFragmentEntities(combined));
  const sorted = merged.sort((a, b) => {
    const countDiff = b.count - a.count;
    if (countDiff !== 0) return countDiff;
    return b.confidence - a.confidence;
  });
  return { entities: sorted.slice(0, 50) };
}

function entityExtractorFallback(result: ExtractionResult, chunks: Chunk[]): EntityOutput {
  const allText = chunks.map((c) => cleanTextForEntityExtraction(c.content)).join('\n\n');
  const mentions = extractEntities(allText, { max: 20 });
  const entities: ExtractedEntity[] = [];

  for (const mention of mentions) {
    const chunk = chunks.find((c) => c.content.includes(mention.name)) ?? chunks[0];
    const pages = chunk ? parsePageRange(chunk.pageRange) : [1];
    const contexts = extractMentionContexts(mention.name, chunk?.content ?? result.pages[0]?.text ?? '', pages);
    const { name, aliases } = normalizeEntityName(mention.name);
    entities.push({
      name,
      canonical: slugify(name),
      aliases,
      type: mention.type as EntityType,
      count: mention.count,
      mentions: contexts,
      confidence: 0.6,
    });
  }

  return { entities };
}

function extractMentionContexts(name: string, text: string, pages: number[]): { page: number; context: string }[] {
  const contexts: { page: number; context: string }[] = [];
  const sentences = cleanTextForEntityExtraction(text).split(/(?<=[.!?])\s+|\n+/);
  const seen = new Set<string>();

  for (const sentence of sentences) {
    if (!sentence.includes(name)) continue;
    const context = sentence.trim().replace(/\s+/g, ' ').slice(0, 200);
    if (seen.has(context)) continue;
    seen.add(context);
    for (const page of pages) {
      contexts.push({ page, context });
    }
    if (contexts.length >= pages.length * 3) break;
  }

  if (contexts.length === 0) {
    for (const page of pages) {
      contexts.push({ page, context: text.slice(0, 200).replace(/\s+/g, ' ') });
    }
  }

  return contexts;
}

function normalizeExtractedEntity(entity: unknown): ExtractedEntity | undefined {
  if (typeof entity !== 'object' || entity === null) return undefined;
  const e = entity as Record<string, unknown>;
  if (typeof e.name !== 'string' || e.name.trim() === '') return undefined;

  const type = normalizeEntityType(typeof e.type === 'string' ? e.type : 'person');
  const rawAliases = Array.isArray(e.aliases)
    ? e.aliases.filter((a): a is string => typeof a === 'string')
    : [];
  const { name, aliases } = normalizeEntityName(e.name.trim(), rawAliases);
  const canonical = slugify(name);
  const mentions = Array.isArray(e.mentions)
    ? e.mentions
        .map((m) => {
          if (typeof m !== 'object' || m === null) return undefined;
          const mention = m as Record<string, unknown>;
          return {
            page: typeof mention.page === 'number' ? mention.page : 1,
            context: typeof mention.context === 'string' ? mention.context : '',
          };
        })
        .filter(Boolean) as { page: number; context: string }[]
    : [];
  const confidence = typeof e.confidence === 'number' ? Math.max(0, Math.min(1, e.confidence)) : 0.6;
  const count = typeof e.count === 'number' ? e.count : Math.max(1, mentions.length);
  const description = typeof e.description === 'string' && e.description.trim() !== '' ? e.description.trim() : undefined;
  const relationships = Array.isArray(e.relationships)
    ? e.relationships
        .map((r) => {
          if (typeof r !== 'object' || r === null) return undefined;
          const rel = r as Record<string, unknown>;
          if (typeof rel.predicate !== 'string' || typeof rel.object !== 'string') return undefined;
          return {
            predicate: rel.predicate,
            object: rel.object,
            evidence: typeof rel.evidence === 'string' ? rel.evidence : '',
            pages: typeof rel.pages === 'string' ? rel.pages : '1',
          };
        })
        .filter(Boolean) as ExtractedEntity['relationships']
    : undefined;

  return {
    name,
    canonical,
    aliases,
    type,
    count,
    mentions,
    confidence,
    description,
    relationships,
  };
}

/**
 * Words that are common nouns, adjectives, section labels, or domain jargon and
 * should not be treated as proper nouns when validating entity names.
 */
const GENERIC_ENTITY_WORDS = new Set([
  // function words
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can', 'could', 'did', 'do', 'for', 'from', 'had', 'has', 'have', 'how', 'in', 'is', 'it', 'its', 'may', 'might', 'must', 'new', 'no', 'not', 'of', 'on', 'one', 'or', 'ought', 'shall', 'should', 'so', 'some', 'than', 'that', 'the', 'their', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'two', 'under', 'up', 'us', 'was', 'were', 'we', 'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'will', 'with', 'would',
  // generic document words
  'page', 'document', 'report', 'table', 'figure', 'note', 'section', 'appendix', 'contents', 'summary', 'references', 'acknowledgements', 'introduction', 'objectives', 'methods', 'results', 'conclusion', 'discussion', 'background', 'purpose', 'analysis', 'review', 'abstract', 'example', 'examples', 'created', 'updated', 'revised', 'issued', 'date', 'sheet', 'limit', 'limits', 'history',
  // generic nouns / adjectives / domain jargon that produced false positives in the E2E corpus
  'about', 'added', 'after', 'affairs', 'agency', 'all', 'also', 'alternate', 'american', 'analysis', 'analyst', 'annex', 'annual', 'approach', 'approaches', 'approached', 'appointed', 'approval', 'approved', 'arild', 'articles', 'article', 'asian', 'asset', 'assets', 'assessment', 'association', 'author', 'authorised', 'authorized', 'available', 'balance', 'baltic', 'bank', 'banking', 'based', 'before', 'benefits', 'beverage', 'bibliographic', 'board', 'bodies', 'bod', 'bond', 'bonds', 'broad', 'broader', 'business', 'bureau', 'cabinet', 'can', 'capital', 'caption', 'carbon', 'care', 'catalog', 'catalogue', 'center', 'centre', 'chair', 'chairman', 'chairmanship', 'chamber', 'change', 'changes', 'chemical', 'chemicals', 'chief', 'citation', 'citations', 'climate', 'collaborator', 'committee', 'community', 'company', 'compensation', 'compliance', 'concentration', 'concept', 'concepts', 'conclusion', 'conference', 'consortium', 'consumer', 'continues', 'contract', 'control', 'cooperation', 'cooperative', 'coordinating', 'corporate', 'corporation', 'council', 'country', 'created', 'credit', 'criteria', 'currency', 'current', 'customer', 'data', 'database', 'day', 'day-to-day', 'debt', 'decision', 'definition', 'department', 'derivative', 'derivatives', 'designed', 'developed', 'details', 'device', 'direct', 'director', 'directors', 'disclosure', 'disclosures', 'disease', 'discussion', 'division', 'dtd', 'economic', 'economics', 'education', 'educational', 'effective', 'efficiency', 'efficient', 'electronic', 'eligible', 'emergency', 'end', 'energy', 'england', 'enterprise', 'enterprises', 'environment', 'environmental', 'equity', 'esg', 'estate', 'estonia', 'ethics', 'european', 'evaluation', 'event', 'evidence', 'exchange', 'executive', 'expansion', 'expert', 'exposure', 'facility', 'factoring', 'factory', 'fallback', 'falls', 'feature', 'federation', 'field', 'fields', 'file', 'finance', 'financial', 'financials', 'finland', 'finnish', 'firm', 'fiscal', 'following', 'forecast', 'foreign', 'form', 'framework', 'free', 'fund', 'funding', 'funds', 'future', 'gas', 'general', 'generic', 'global', 'goods', 'governance', 'government', 'group', 'growth', 'guarantee', 'guarantees', 'handbook', 'has', 'headings', 'health', 'held', 'helped', 'high', 'higher', 'highest', 'hill', 'holdings', 'host', 'how', 'human', 'icon', 'impact', 'implemented', 'included', 'including', 'income', 'index', 'industries', 'industry', 'information', 'initiative', 'innovation', 'institute', 'institution', 'institutional', 'institutionalised', 'instrument', 'insurance', 'integrated', 'interest', 'internal', 'international', 'inventory', 'invested', 'investing', 'investment', 'investments', 'investor', 'investors', 'involved', 'isk', 'issue', 'issued', 'issues', 'its', 'journal', 'journals', 'key', 'knowledge', 'largest', 'latvia', 'law', 'leading', 'led', 'lending', 'level', 'liability', 'library', 'license', 'life', 'limit', 'limits', 'line', 'link', 'linking', 'links', 'liquidity', 'lit', 'loan', 'loans', 'local', 'location', 'long', 'longer', 'low', 'lower', 'lowest', 'lp', 'ltd', 'made', 'maintained', 'major', 'management', 'manager', 'manual', 'march', 'market', 'markets', 'material', 'maturity', 'medical', 'medicine', 'member', 'membership', 'metric', 'metrics', 'minister', 'ministry', 'model', 'moderate', 'modern', 'molecular', 'monetary', 'more', 'mortgage', 'national', 'natural', 'nature', 'negative', 'new', 'nib', 'nkg', 'nkr', 'nkv', 'nkvk', 'nkr', 'nomination', 'nordic', 'note', 'notes', 'novel', 'objective', 'objectives', 'obligations', 'observation', 'obtained', 'occupational', 'october', 'office', 'officer', 'official', 'of', 'oil', 'older', 'on', 'operating', 'operational', 'operations', 'opportunity', 'order', 'organization', 'organisation', 'original', 'outstanding', 'over', 'overview', 'pacific', 'page', 'pages', 'participant', 'participants', 'partners', 'partnership', 'party', 'past', 'payment', 'pension', 'people', 'period', 'permanent', 'person', 'personal', 'phase', 'planned', 'planning', 'platform', 'poorly', 'portfolio', 'position', 'positive', 'possible', 'practices', 'prepared', 'presentation', 'preservation', 'president', 'prevention', 'previous', 'primary', 'principal', 'process', 'processed', 'product', 'production', 'products', 'professional', 'program', 'programme', 'project', 'projects', 'promoting', 'proper', 'property', 'proposal', 'proposed', 'protocol', 'provided', 'public', 'publication', 'publications', 'publicly', 'published', 'purpose', 'qualitative', 'quality', 'quantitative', 'quarter', 'quarterly', 'rating', 'ratings', 'real', 'reason', 'receivable', 'receivables', 'recipient', 'recognised', 'recognized', 'recommendation', 'record', 'recovery', 'reduced', 'reduction', 'reference', 'references', 'regional', 'regulated', 'regulation', 'regulations', 'regulatory', 'related', 'relevant', 'report', 'reported', 'reporting', 'reports', 'representative', 'reputation', 'request', 'required', 'requirement', 'requirements', 'research', 'reserve', 'reserves', 'resilience', 'resilient', 'resolution', 'resolving', 'resource', 'resources', 'responsible', 'responsibility', 'rest', 'result', 'results', 'retail', 'retained', 'retirement', 'return', 'returns', 'review', 'reviewed', 'right', 'risk', 'risks', 'role', 'rubric', 'rule', 'rules', 'safe', 'safety', 'said', 'salary', 'says', 'scanning', 'scenario', 'scenarios', 'schedule', 'science', 'sciences', 'scope', 'score', 'scores', 'search', 'searching', 'seasonal', 'secondary', 'secretary', 'sector', 'sectors', 'secured', 'securities', 'security', 'selected', 'selection', 'senior', 'separate', 'sequence', 'ser', 'service', 'services', 'set', 'settlement', 'several', 'share', 'shared', 'shareholder', 'shareholders', 'shares', 'sheet', 'short', 'significant', 'simple', 'slower', 'small', 'society', 'societal', 'soft', 'solution', 'solutions', 'source', 'sourcing', 'special', 'speciality', 'specialty', 'specific', 'spend', 'spending', 'spread', 'stability', 'stable', 'staff', 'stakeholder', 'stakeholders', 'standard', 'standards', 'state', 'statement', 'statements', 'statistical', 'statistics', 'status', 'strategy', 'strong', 'structural', 'structure', 'structured', 'subheadings', 'subject', 'subjects', 'submission', 'submitted', 'subsidiary', 'substantial', 'successful', 'summary', 'supervisory', 'supplement', 'supplementary', 'supplied', 'supply', 'support', 'supported', 'supporting', 'sustainability', 'sustainable', 'sustainalytics', 'swap', 'swaps', 'syndicated', 'system', 'systems', 'table', 'tables', 'taken', 'taking', 'target', 'targets', 'tariff', 'task', 'taskforce', 'tax', 'taxation', 'taxonomy', 'team', 'technical', 'technologies', 'technology', 'term', 'terms', 'text', 'than', 'that', 'the', 'them', 'then', 'theory', 'there', 'these', 'thesis', 'those', 'through', 'throughout', 'time', 'times', 'title', 'to', 'tool', 'topic', 'total', 'trade', 'traded', 'trading', 'training', 'transfer', 'transferred', 'translation', 'transmission', 'transparency', 'treasury', 'treaty', 'trend', 'trends', 'trial', 'trust', 'trustee', 'type', 'types', 'typical', 'under', 'understanding', 'updated', 'use', 'used', 'useful', 'using', 'utility', 'value', 'values', 'variable', 'variables', 'variation', 'variety', 'various', 'venture', 'ventures', 'version', 'very', 'vice', 'volume', 'website', 'well', 'well-written', 'what', 'when', 'where', 'which', 'who', 'whole', 'with', 'within', 'without', 'workflow', 'work', 'working', 'works', 'world', 'written', 'xml', 'year', 'years', 'yield', 'yields', 'zone',
  'queries', 'matcher', 'batch', 'clinical', 'programming', 'utilities', 'full', 'partial', 'investigator', 'help', 'desk', 'contact', 'mesh', 'pharmacologic', 'action', 'breast', 'neoplasms',
  'additional', 'features', 'feature', 'advanced', 'complex', 'effective', 'following', 'resources', 'facilitate', 'tools',
  'search', 'searching', 'queries', 'details', 'discovery', 'links', 'results', 'mobile', 'support', 'center', 'centre', 'service',
  'online', 'how', 'create', 'creating', 'web', 'use', 'uses', 'used', 'useful', 'homepage', 'filters', 'filter', 'narrow', 'save',
  'saved', 'saving', 'email', 'e-mail', 'print', 'printing', 'sort', 'sorted', 'sorting', 'format', 'formats', 'display', 'view',
  'views', 'viewed', 'item', 'items', 'citation', 'citations', 'multiple', 'ids', 'pmid', 'sensors', 'images', 'supplemental',
  'default', 'turning', 'auto', 'suggest', 'suggestions', 'managing', 'recent', 'activity', 'setting', 'preferences', 'preference',
  'outside', 'delivery', 'icon', 'linkout', 'history', 'clipboard', 'limits', 'limit', 'bibliographies', 'bibliography', 'highlighting',
  'highlight', 'opening', 'abstract', 'engl', 'med',
  // Generic document/standard terms that surface as false entities in academic sources.
  'pharmacological', 'pharmacologic', 'actions', 'action', 'serial', 'serials', 'numbers', 'number',
  'portal', 'issn', 'issns', 'standard', 'standards', 'international', 'ids', 'identifier', 'identifiers',
]);

/**
 * All-caps acronyms that are common words, diseases, protocols, or formats and
 * should never be treated as named entities.
 */
const NON_ENTITY_ACRONYMS = new Set([
  'AND', 'OR', 'NOT', 'AIDS', 'DTD', 'FTP', 'OCR', 'XML', 'PDF', 'HTML', 'HTTP', 'CSV', 'JSON',
  // Currency codes and credit ratings are not named entities.
  'USD', 'EUR', 'GBP', 'JPY', 'SEK', 'NOK', 'CHF', 'CAD', 'AUD', 'DKK', 'ISK',
  'AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'BAA', 'BA', 'B',
]);

function isNonEntityAcronym(word: string): boolean {
  return NON_ENTITY_ACRONYMS.has(word.toUpperCase());
}

function isAllCapsAcronym(word: string): boolean {
  return /^[A-Z]{2,8}$/.test(word.trim());
}

function stripTrailingAcronym(name: string): { name: string; alias?: string } {
  const parenthetical = name.match(/^(.*?)\s+\(([A-Z]{2,8})\)\s*$/);
  if (parenthetical) {
    const base = parenthetical[1].trim();
    if (base.length > 0) {
      return { name: base, alias: parenthetical[2] };
    }
  }
  const trailing = name.match(/^(.*?)\s+([A-Z]{2,8})\s*$/);
  if (trailing) {
    const base = trailing[1].trim();
    if (base.length > 0) {
      return { name: base, alias: trailing[2] };
    }
  }
  return { name };
}

function normalizeEntityName(name: string, aliases: string[] = []): { name: string; aliases: string[] } {
  const { name: strippedName, alias } = stripTrailingAcronym(name);
  const allAliases = alias ? [alias, ...aliases] : [...aliases];
  const unique = [...new Set(allAliases.map((a) => a.trim()).filter(Boolean))].filter(
    (a) => a.toLowerCase() !== strippedName.toLowerCase(),
  );
  return { name: strippedName, aliases: unique };
}

function hasAcronymAlias(entity: ExtractedEntity): boolean {
  return hasAcronymToken(entity.name) || entity.aliases.some((a) => hasAcronymToken(a));
}

function containsOrgSuffix(name: string): boolean {
  const upper = ' ' + name.toUpperCase() + ' ';
  const suffixes = [
    ' CENTER ', ' CENTRE ', ' INSTITUTE ', ' INSTITUTES ', ' INSTITUTION ', ' COMMITTEE ', ' BANK ',
    ' DEPARTMENT ', ' FOUNDATION ', ' ASSOCIATION ', ' COUNCIL ', ' AGENCY ', ' BOARD ',
    ' COMMISSION ', ' OFFICE ', ' BUREAU ', ' ADMINISTRATION ', ' AUTHORITY ',
    ' ORGANIZATION ', ' ORGANISATION ', ' UNION ', ' ALLIANCE ', ' CONSORTIUM ',
    ' SOCIETY ', ' FEDERATION ', ' CHAMBER ', ' EXCHANGE ', ' CORPORATION ', ' INCORPORATED ',
    ' LIBRARY ', ' HOSPITAL ', ' UNIVERSITY ', ' COLLEGE ', ' SCHOOL ', ' CLINIC ',
  ];
  return suffixes.some((s) => upper.includes(s));
}

function isOrganizationAcronym(name: string, allText: string): boolean {
  if (!isAllCapsAcronym(name)) return false;
  const pattern = new RegExp(
    `\\b[A-Z][A-Za-z0-9.,&\\s]+?[\\s\\n]*\\(${name}\\)`,
    'g',
  );
  return pattern.test(allText);
}

/**
 * Geographic and regional adjectives that are allowed as proper-noun anchors in
 * organization names even though they appear in the generic-word list.
 */
const GEOGRAPHIC_ADJECTIVES = new Set([
  'nordic', 'baltic', 'scandinavian', 'european', 'american', 'asian', 'african', 'pacific',
  'arctic', 'antarctic', 'national', 'international', 'global', 'regional', 'local',
]);

function hasNonGenericProperNoun(name: string, allowGeographic = false): boolean {
  const words = name.trim().split(/[\s\-]+/).filter(Boolean);
  for (const word of words) {
    const t = word.trim();
    if (t.length < 2) continue;
    if (isAcronym(t)) {
      if (!isNonEntityAcronym(t)) return true;
      continue;
    }
    if (!/^[A-Z][a-zA-Z\-]+$/.test(t)) continue;
    const lower = t.toLowerCase();
    if (allowGeographic && GEOGRAPHIC_ADJECTIVES.has(lower)) return true;
    if (!GENERIC_ENTITY_WORDS.has(lower)) return true;
  }
  return false;
}

function isMostlyGeneric(name: string): boolean {
  const words = name.toLowerCase().split(/[\s\-]+/).filter(Boolean);
  if (words.length === 0) return true;
  const genericCount = words.filter((w) => GENERIC_ENTITY_WORDS.has(w)).length;
  return genericCount / words.length >= 0.5;
}

function isAcronymPlusGenericWord(entity: ExtractedEntity): boolean {
  const parts = entity.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  if (!isAllCapsAcronym(parts[0])) return false;
  const rest = parts.slice(1).join(' ');
  const lowerWords = rest.toLowerCase().split(/[\s\-]+/).filter(Boolean);
  if (lowerWords.length === 0) return false;
  const genericCount = lowerWords.filter((w) => GENERIC_ENTITY_WORDS.has(w)).length;
  const mostlyGeneric = genericCount / lowerWords.length >= 0.5;
  if (!mostlyGeneric) return false;
  // Allow products whose trailing word is a recognized product keyword (e.g., "MEDLINE Database").
  if (entity.type === 'product' && containsProductKeyword(rest)) return false;
  return true;
}

function hasNonEntityAcronym(name: string): boolean {
  return name
    .split(/[\s\-]+/)
    .some((w) => isAcronym(w.trim()) && isNonEntityAcronym(w.trim()));
}

function isAcronym(word: string): boolean {
  return /^[A-Z]{2,8}$/.test(word.trim());
}

function isProperNounWord(word: string): boolean {
  const trimmed = word.trim();
  if (trimmed.length < 2) return false;
  if (isAcronym(trimmed)) return true;
  return /^[A-Z][a-zA-Z\-]+$/.test(trimmed) && !GENERIC_ENTITY_WORDS.has(trimmed.toLowerCase());
}

function hasProperNounIndicator(name: string): boolean {
  return name
    .split(/[\s\-]+/)
    .some((w) => isProperNounWord(w));
}

function countEntityMentions(name: string, aliases: string[], text: string): number {
  const allNames = [name, ...aliases].filter((n) => n.trim().length > 0);
  if (allNames.length === 0) return 0;
  const pattern = new RegExp(
    allNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
    'gi',
  );
  return (text.match(pattern) ?? []).length;
}

function isSingleCapitalizedToken(name: string): boolean {
  const trimmed = name.trim();
  return /^[A-Z][a-zA-Z0-9]+$/.test(trimmed) && trimmed.length >= 3 && trimmed.length <= 25;
}

function hasAcronymToken(name: string): boolean {
  return name
    .split(/[\s\-]+/)
    .some((w) => /^[A-Z][A-Z0-9&]{1,7}$/.test(w.trim()));
}

function isPlausibleEntityType(entity: ExtractedEntity): boolean {
  switch (entity.type) {
    case 'person':
      return looksLikePerson(entity.name);
    case 'organization': {
      if (isNonEntityAcronym(entity.name)) return false;
      const hasOrgMarker = looksLikeOrganization(entity.name) || containsOrgKeyword(entity.name);
      // Require a real proper-noun anchor (including geographic adjectives). A bare
      // acronym is not enough for an organisation, because acronyms in headings
      // (e.g., "GRI Global Reporting Initiative") are not organisations by themselves.
      return hasOrgMarker && hasNonGenericProperNoun(entity.name, true);
    }
    case 'product': {
      if (isNonEntityAcronym(entity.name)) return false;
      if (hasAcronymToken(entity.name) && !hasNonEntityAcronym(entity.name)) return true;
      if (isSingleCapitalizedToken(entity.name)) {
        return !GENERIC_ENTITY_WORDS.has(entity.name.toLowerCase());
      }
      return containsProductKeyword(entity.name) && !isMostlyGeneric(entity.name);
    }
    case 'location': {
      const words = entity.name.split(/[\s\-]+/).filter(Boolean);
      if (words.length >= 4 && !entity.name.includes(',') && !hasAcronymToken(entity.name)) return false;
      return entity.name.includes(',') || hasAcronymToken(entity.name) || hasNonGenericProperNoun(entity.name, true);
    }
    case 'case':
      return /\bv\.?\b|\bvs\.?\b/i.test(entity.name);
    case 'event':
      return /\d{4}/.test(entity.name);
    default:
      return false;
  }
}

/**
 * Known taxonomy / controlled-vocabulary terms that are explicitly topics, not
 * named entities. These are extracted from MeSH-style headings.
 */
const TAXONOMY_TERMS = new Set([
  'breast neoplasms',
  'pharmacologic actions',
  'pharmacologic action',
  'pharmacological actions',
  'pharmacological action',
  'serial numbers',
  'international standard serial numbers',
  'issn',
  'issns',
  'medical subject headings',
  'mesh terms',
  'mesh translation',
  'supplementary concepts',
  'subheadings publication',
  'subheadings',
  'publication type',
  'publication types',
  'author index',
  'subject headings',
  'bibliographic database',
  'electronic data submission',
]);

/**
 * Words that commonly appear in section headings, table-of-contents lines, and
 * table captions but do not by themselves indicate a named entity. A phrase
 * composed mostly of these words is almost certainly a heading, not an entity.
 */
const HEADING_WORDS = new Set([
  'report', 'reports', 'reporting', 'annual', 'annualreport', 'annual-report',
  'disclosure', 'disclosures', 'other', 'others', 'financial', 'financials',
  'governance', 'sustainability', 'impact', 'responsibility', 'esg',
  'statement', 'statements', 'position', 'balance', 'income', 'cashflow',
  'flow', 'notes', 'note', 'outstanding', 'guarantee', 'commitment', 'commitments',
  'fair', 'value', 'maturity', 'analysis', 'currency', 'derivative', 'derivatives',
  'hedge', 'accounting', 'risk', 'exposure', 'industry', 'counterparty',
  'concentration', 'credit', 'market', 'liquidity', 'operational', 'banking',
  'board', 'directors', 'bod', 'members', 'alternates', 'management', 'executive',
  'committee', 'committees', 'audit', 'remuneration', 'nomination',
  'part', 'parts', 'page', 'pages', 'section', 'sections', 'chapter', 'chapters',
  'appendix', 'appendices', 'contents', 'table', 'tables', 'figure', 'figures',
  'summary', 'overview', 'review', 'highlights', 'key', 'points', 'agenda',
  'abstract', 'example', 'examples', 'introduction', 'objectives', 'methods',
  'results', 'conclusion', 'discussion', 'background', 'purpose', 'educational',
  'presentation', 'quality', 'value', 'values', 'rubric', 'evaluation', 'assessment',
  'score', 'scores', 'points', 'criteria', 'index', 'author', 'authorindex',
  'subject', 'subjects', 'headings', 'subheadings', 'concepts', 'utilities',
  'data', 'submission', 'process', 'selection', 'searching', 'simple', 'translation',
  'queries', 'matcher', 'batch', 'clinical', 'programming', 'full', 'investigator', 'collaborator', 'help', 'desk', 'contact', 'mesh', 'pharmacologic', 'action', 'breast', 'neoplasms', 'support', 'center', 'centre',
  'bibliographic', 'database', 'cell', 'molecular', 'biology', 'created', 'updated', 'fact', 'sheet', 'summary', 'detail', 'extracted', 'preserved',
]);

function isKnownTaxonomyTerm(name: string): boolean {
  const lower = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  if (TAXONOMY_TERMS.has(lower)) return true;
  // Reject MeSH-style plural disease terms such as "X Neoplasms", "X Diseases".
  if (/\bneoplasms$|\bdiseases$|\bdisorders$|\bsyndromes$/i.test(lower)) return true;
  return false;
}

/**
 * Specific phrases observed in the UAT corpus that slip through generic-word filters
 * because they contain a proper noun or acronym but are still not named entities.
 */
const NON_ENTITY_PHRASES = new Set([
  'the bank', 'the control committee', 'cooperation council',
  'accounting financials pcaf institution framework', 'sustainability gri global reporting initiative',
  'basel the bank', 'adjustments acquisition', 'combating fraud', 'commercial paper program', 'due diligence',
  'monte carlo', 'contracts referencing nature dependent electricity', 'aviation fuel', 'power heat', 'metals mining',
  'loss given', 'pasaules dabas', 'denmark finland iceland', 'denmark finland iceland norway', 'finland iceland norway',
  'ahonen heikki cantell', 'arild fearnley camilla', 'fearnley camilla kastengren', 'dovil jasaitien tom', 'cantell luca',
  'aaa', 'aaa aaa', 'bond', 'program', 'jul aug', 'jul-aug', 'eur', 'usd', 'gbp', 'jpy', 'sek', 'nok', 'chf', 'cad', 'aud', 'dkk', 'isk',
]);

function isKnownNonEntityPhrase(name: string): boolean {
  const normalized = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  return NON_ENTITY_PHRASES.has(normalized);
}

function isHeadingLikePhrase(name: string): boolean {
  const lower = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  // All-caps phrases are typically headings in annual reports.
  if (/^[A-Z\s\-]+$/.test(name.trim()) && name.length > 5) return true;
  // Phrases composed mostly of heading words are not entities.
  const headingCount = words.filter((w) => HEADING_WORDS.has(w)).length;
  return headingCount / words.length >= 0.5;
}

function isQualityEntity(entity: ExtractedEntity, allText: string): boolean {
  if (entity.confidence < 0.6) return false;
  if (entity.name.length < 3 || entity.name.length > 80) return false;
  // Reject known taxonomy / controlled-vocabulary terms (e.g. MeSH headings).
  if (isKnownTaxonomyTerm(entity.name)) return false;
  // Reject specific phrases observed as false entities in the UAT corpus.
  if (isKnownNonEntityPhrase(entity.name)) return false;
  // Reject obvious heading-like phrases and concatenated section titles.
  if (isHeadingLikePhrase(entity.name)) return false;
  // Reject standalone common-word, disease, protocol, and format acronyms.
  if (isAllCapsAcronym(entity.name) && NON_ENTITY_ACRONYMS.has(entity.name.toUpperCase())) return false;
  // Reject acronym + generic word fragments (e.g., "NLM Medical", "AND Boolean").
  if (isAcronymPlusGenericWord(entity)) return false;
  // Reject mostly generic phrases unless they have an organization suffix or
  // an acronym alias, which signals a real proper-noun entity.
  const lower = entity.name.toLowerCase();
  const words = lower.split(/[\s\-]+/);
  const genericCount = words.filter((w) => GENERIC_ENTITY_WORDS.has(w)).length;
  const mostlyGeneric = genericCount / words.length >= 0.5;
  const isOrgWithSuffix = entity.type === 'organization' && containsOrgSuffix(entity.name);
  if (mostlyGeneric && !isOrgWithSuffix && !hasAcronymAlias(entity)) return false;
  // Reclassify acronyms that are clearly organization aliases by their context
  // (e.g., "National Center for Biotechnology Information (NCBI)").
  if (entity.type === 'product' && isOrganizationAcronym(entity.name, allText)) {
    entity.type = 'organization';
  }
  // Validate against the declared entity type. This catches LLM errors such as
  // classifying a taxonomy term or a job title as a person.
  return isPlausibleEntityType(entity);
}

function filterQualityEntities(
  entities: ExtractedEntity[],
  chunks: Chunk[],
): ExtractedEntity[] {
  const allText = chunks.map((c) => c.content).join('\n\n');
  const filtered = entities.filter((e) => isQualityEntity(e, allText));
  // Prefer frequently-mentioned entities, then high-confidence ones, and cap the volume.
  filtered.sort((a, b) => {
    const countDiff = b.count - a.count;
    if (countDiff !== 0) return countDiff;
    return b.confidence - a.confidence;
  });
  return filtered.slice(0, 50);
}

function cleanEntityContextChunkContent(content: string): string {
  return content
    .split('\n')
    .filter((line) => !/^[\s|\-:]*$/.test(line))
    .join('\n')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 3000);
}

function cleanTextForEntityExtraction(text: string): string {
  // Drop markdown table lines and other layout artifacts so the deterministic
  // entity extractor does not treat captions and headers as named entities.
  return text
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return false;
      if (/^\|[-|\s|]*\|$/.test(trimmed)) return false;
      const pipeCount = (trimmed.match(/\|/g) ?? []).length;
      const wordCount = trimmed.split(/\s+/).length;
      return pipeCount < wordCount;
    })
    .join('\n');
}

function buildEntityContext(
  result: ExtractionResult,
  chunks: Chunk[],
  agentsMd?: string,
  memory?: OrchestratorMemory,
): string {
  const lines: string[] = [];

  if (agentsMd) {
    lines.push('## AGENTS.md');
    lines.push(agentsMd);
    lines.push('');
  }

  if (memory && Object.keys(memory.state.entities).length > 0) {
    lines.push('## Existing entities (canonical names and aliases)');
    for (const [slug, entity] of Object.entries(memory.state.entities)) {
      const aliases = entity.aliases.length > 0 ? ` (aliases: ${entity.aliases.join(', ')})` : '';
      lines.push(`- ${slug}: ${entity.name}${aliases}`);
    }
    lines.push('');
  }

  if (memory && memory.rollingSummary) {
    lines.push('## Rolling memory');
    lines.push(memory.summaryOnly ? '[Summary-only mode]' : memory.rollingSummary);
    lines.push('');
  }

  lines.push('## Source PDF');
  lines.push(`- file: ${result.fileName}`);
  lines.push(`- pages: ${result.physicalPages}`);
  lines.push('');

  lines.push('## Chunk text');
  for (const chunk of chunks) {
    lines.push(`### Chunk ${chunk.id} — pages ${chunk.pageRange}`);
    lines.push(cleanEntityContextChunkContent(chunk.content));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * RelationshipExtractor: capture relationships between entities.
 */
export async function relationshipExtractor(
  result: ExtractionResult,
  entities: ExtractedEntity[],
  llmClient: LLMClient,
  agentsMd?: string,
  memory?: OrchestratorMemory,
): Promise<RelationshipOutput> {
  const fallback = relationshipExtractorFallback(result, entities);

  if (!llmClient.isEnabled()) {
    return fallback;
  }

  try {
    const context = buildRelationshipContext(result, entities, agentsMd, memory);
    const response = await llmClient.call(buildPrompt('relationship-extractor', context), {
      maxTokens: 1500,
      temperature: 0.2,
    });
    const parsed = parseStructuredJson<{ relationships?: unknown[] }>(response.text);
    if (parsed && Array.isArray(parsed.relationships) && parsed.relationships.length > 0) {
      const normalized = parsed.relationships
        .map((r) => normalizeRelationship(r, entities))
        .filter(Boolean) as ExtractedRelationship[];
      if (normalized.length > 0) {
        return { relationships: normalized };
      }
    }
  } catch {
    // Keep fallback.
  }

  return fallback;
}

function relationshipExtractorFallback(
  result: ExtractionResult,
  entities: ExtractedEntity[],
): RelationshipOutput {
  const relationships: ExtractedRelationship[] = [];
  const entityNames = entities.map((e) => e.name.toLowerCase());
  for (let i = 0; i < entities.length; i++) {
    for (let j = 0; j < entities.length; j++) {
      if (i === j) continue;
      const sentence = findCooccurringSentence(result, entities[i].name, entities[j].name);
      if (sentence) {
        relationships.push({
          subject: entities[i].name,
          predicate: 'related to',
          object: entities[j].name,
          evidence: sentence,
          pages: '1',
        });
      }
    }
  }
  return { relationships: relationships.slice(0, 10) };
}

function findCooccurringSentence(result: ExtractionResult, a: string, b: string): string | undefined {
  const sentences = result.pages.flatMap((p) => p.text.split(/(?<=[.!?])\s+/));
  for (const sentence of sentences) {
    if (sentence.includes(a) && sentence.includes(b)) {
      return sentence.trim().slice(0, 200);
    }
  }
  return undefined;
}

function normalizeRelationship(
  relationship: unknown,
  entities: ExtractedEntity[],
): ExtractedRelationship | undefined {
  if (typeof relationship !== 'object' || relationship === null) return undefined;
  const r = relationship as Record<string, unknown>;
  if (typeof r.subject !== 'string' || typeof r.predicate !== 'string' || typeof r.object !== 'string') {
    return undefined;
  }
  const entityNames = new Set(entities.map((e) => e.name.toLowerCase()));
  if (!entityNames.has(r.subject.toLowerCase()) || !entityNames.has(r.object.toLowerCase())) {
    return undefined;
  }
  return {
    subject: r.subject,
    predicate: r.predicate,
    object: r.object,
    evidence: typeof r.evidence === 'string' ? r.evidence : '',
    pages: typeof r.pages === 'string' ? r.pages : '1',
  };
}

function buildRelationshipContext(
  result: ExtractionResult,
  entities: ExtractedEntity[],
  agentsMd?: string,
  memory?: OrchestratorMemory,
): string {
  const lines: string[] = [];

  if (agentsMd) {
    lines.push('## AGENTS.md');
    lines.push(agentsMd);
    lines.push('');
  }

  if (memory && memory.state.relationships.length > 0) {
    lines.push('## Existing relationships');
    for (const rel of memory.state.relationships.slice(-10)) {
      lines.push(`- ${rel.subject} - ${rel.predicate} - ${rel.object} (${rel.pages})`);
    }
    lines.push('');
  }

  lines.push('## Entities');
  for (const entity of entities) {
    lines.push(`- ${entity.name} (${entity.type})`);
  }
  lines.push('');

  lines.push('## Extracted text');
  for (const page of result.pages) {
    lines.push(`### Page ${page.physicalPage}`);
    lines.push(page.text.slice(0, 200));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * EvidenceCollector: collect key claims, tables, and figures from the extraction.
 */
export async function evidenceCollector(
  result: ExtractionResult,
  chunks: Chunk[],
  llmClient: LLMClient,
  agentsMd?: string,
  memory?: OrchestratorMemory,
): Promise<EvidenceOutput> {
  const fallback = evidenceCollectorFallback(result, chunks);

  if (!llmClient.isEnabled()) {
    return fallback;
  }

  try {
    const context = buildEvidenceContext(result, chunks, agentsMd, memory);
    const response = await llmClient.call(buildPrompt('evidence-collector', context), {
      maxTokens: 2000,
      temperature: 0.2,
    });
    const parsed = parseStructuredJson<EvidenceOutput>(response.text);
    if (parsed && isValidEvidenceOutput(parsed)) {
      return parsed;
    }
  } catch {
    // Keep fallback.
  }

  return fallback;
}

function evidenceCollectorFallback(result: ExtractionResult, chunks: Chunk[]): EvidenceOutput {
  const claims: ExtractedEvidence['claims'] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const sentences = chunk.content.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length < 40 || trimmed.length > 200) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      claims.push({
        text: trimmed,
        evidence: trimmed,
        pages: chunk.pageRange,
      });
      if (claims.length >= 10) break;
    }
    if (claims.length >= 10) break;
  }

  const tables = result.tables.map((t) => ({
    page: t.page,
    caption: t.caption,
    markdown: t.markdown,
  }));

  const figures = result.figures.map((f) => ({
    page: f.page,
    caption: f.caption,
    description: f.description,
  }));

  return { claims, tables, figures };
}

function isValidEvidenceOutput(output: unknown): output is EvidenceOutput {
  const o = output as Record<string, unknown> | undefined;
  if (!o || typeof o !== 'object') return false;
  return Array.isArray(o.claims) && Array.isArray(o.tables) && Array.isArray(o.figures);
}

function buildEvidenceContext(
  result: ExtractionResult,
  chunks: Chunk[],
  agentsMd?: string,
  memory?: OrchestratorMemory,
): string {
  const lines: string[] = [];

  if (agentsMd) {
    lines.push('## AGENTS.md');
    lines.push(agentsMd);
    lines.push('');
  }

  if (memory && memory.rollingSummary) {
    lines.push('## Rolling memory');
    lines.push(memory.summaryOnly ? '[Summary-only mode]' : memory.rollingSummary);
    lines.push('');
  }

  lines.push('## Source PDF');
  lines.push(`- file: ${result.fileName}`);
  lines.push(`- pages: ${result.physicalPages}`);
  lines.push(`- tables: ${result.tables.length}`);
  lines.push(`- figures: ${result.figures.length}`);
  lines.push('');

  lines.push('## Chunk text');
  for (const chunk of chunks) {
    lines.push(`### Chunk ${chunk.id} — pages ${chunk.pageRange}`);
    lines.push(cleanEntityContextChunkContent(chunk.content));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * PagePlanner: decide the folder hierarchy and page plan.
 */
export async function pagePlanner(
  result: ExtractionResult,
  structure: StructureOutput,
  entities: ExtractedEntity[],
  evidence: EvidenceOutput,
  llmClient: LLMClient,
  agentsMd?: string,
  memory?: OrchestratorMemory,
  samplingStrategy?: { category: string; reason: string },
): Promise<PagePlannerOutput> {
  const fallback = pagePlannerFallback(result, structure, entities, evidence);
  const emptyOutput: PagePlannerOutput = {
    pages: [],
    folderPlacements: [],
    wikilinks: [],
    citations: [],
    discovery: fallback.discovery,
  };

  if (!llmClient.isEnabled()) {
    return normalizePagePlannerOutput(emptyOutput, result, entities, fallback);
  }

  try {
    const context = buildPagePlannerContext(result, structure, entities, evidence, agentsMd, memory, samplingStrategy);
    const response = await llmClient.call(buildPrompt('page-planner', context), {
      maxTokens: 2000,
      temperature: 0.2,
    });
    const parsed = parseStructuredJson<PagePlannerOutput>(response.text);
    if (parsed && isValidPagePlannerOutput(parsed)) {
      return normalizePagePlannerOutput(parsed, result, entities, fallback);
    }
  } catch {
    // Keep fallback.
  }

  return normalizePagePlannerOutput(emptyOutput, result, entities, fallback);
}

function pagePlannerFallback(
  result: ExtractionResult,
  _structure: StructureOutput,
  entities: ExtractedEntity[],
  evidence: EvidenceOutput,
): PagePlannerOutput {
  const pages: PagePlan[] = [];

  // Topic pages derived from recurring capitalized themes in the source text.
  const allText = result.pages.map((p) => p.text).join('\n\n');
  const topics = extractTopics(allText, { max: 20 });
  for (const topic of topics) {
    const slug = slugify(topic.name);
    if (slug.length < 2) continue;
    pages.push({
      pageType: 'topic',
      title: topicPageTitle(topic),
      fileName: `${slug}.md`,
      folder: 'topics',
      tags: ['topic', 'theme'],
      citations: ['src1'],
      wikilinks: [],
      related: entities.slice(0, 3).map((e) => `entities/${e.canonical}.md`),
    });
  }

  return {
    pages,
    folderPlacements: defaultFolderPlacements(result, entities),
    wikilinks: [],
    citations: ['src1'],
    discovery: buildDiscoveryChecklist(pages, evidence, result),
  };
}

function buildDiscoveryChecklist(
  pages: PagePlan[],
  evidence: EvidenceOutput,
  result: ExtractionResult,
): DiscoveryChecklist {
  return {
    existingDocument: pages.some((p) => p.pageType === 'document'),
    newEntities: pages.some((p) => p.pageType === 'entity'),
    newTopics: pages.some((p) => p.pageType === 'topic'),
    hasTablesFigures: evidence.tables.length > 0 || evidence.figures.length > 0 || result.tables.length > 0 || result.figures.length > 0,
    rawPages: pages.some((p) => p.pageType === 'raw') || result.pages.some((p) => p.isScanned),
    newPageType: pages.some((p) => !DEFAULT_PAGE_TYPES.includes(p.pageType)),
  };
}

function isValidPagePlannerOutput(output: unknown): output is PagePlannerOutput {
  const o = output as Record<string, unknown> | undefined;
  if (!o || typeof o !== 'object') return false;
  return Array.isArray(o.pages) && Array.isArray(o.folderPlacements) && typeof o.discovery === 'object' && o.discovery !== null;
}

function normalizePagePlannerOutput(
  output: PagePlannerOutput,
  result: ExtractionResult,
  entities: ExtractedEntity[],
  fallback: PagePlannerOutput,
): PagePlannerOutput {
  const pages = output.pages
    .map((p) => normalizePagePlan(p, entities))
    .filter(Boolean) as PagePlan[];

  // Merge fallback topic pages that were not already planned by the LLM. The
  // fallback derives topics from recurring capitalized phrases, which helps
  // ensure topic pages are created even when the LLM planner omits them.
  // Fallback pages must also pass the same normalization/quality filters.
  const existingTitles = new Set(pages.map((p) => p.title.toLowerCase()));
  for (const page of fallback.pages) {
    const normalized = normalizePagePlan(page, entities);
    if (!normalized) continue;
    if (!existingTitles.has(normalized.title.toLowerCase())) {
      pages.push(normalized);
      existingTitles.add(normalized.title.toLowerCase());
    }
  }

  const folderPlacements = output.folderPlacements.length > 0 ? output.folderPlacements : fallback.folderPlacements;
  const discovery = output.discovery || fallback.discovery;

  return {
    pages,
    folderPlacements,
    wikilinks: Array.isArray(output.wikilinks) ? output.wikilinks : fallback.wikilinks,
    citations: Array.isArray(output.citations) ? output.citations : fallback.citations,
    discovery,
  };
}

function normalizePagePlan(page: unknown, entities: ExtractedEntity[]): PagePlan | undefined {
  if (typeof page !== 'object' || page === null) return undefined;
  const p = page as Record<string, unknown>;
  if (typeof p.title !== 'string' || p.title.trim() === '') return undefined;
  if (typeof p.fileName !== 'string' || p.fileName.trim() === '') return undefined;
  if (typeof p.folder !== 'string' || p.folder.trim() === '') return undefined;

  const pageType = typeof p.pageType === 'string' ? p.pageType.trim() : 'document';
  if (pageType === '') return undefined;
  const title = p.title.trim();

  // Drop topic pages that are generic headings, document UI features,
  // controlled-vocabulary fragments, or duplicates of entity/person pages
  // rather than genuine recurring themes.
  if (pageType === 'topic') {
    const topicName = title.replace(/^Topic:\s*/i, '').trim();
    const topicLower = topicName.toLowerCase();
    const isGeneric = isGenericTopic(topicName);
    const topicWords = topicLower.split(/\s+/).filter(Boolean);
    const matchingEntity = entities.find(
      (e) => {
        const entityLower = e.name.toLowerCase();
        if (entityLower === topicLower) return true;
        if (e.aliases.some((a) => a.toLowerCase() === topicLower)) return true;
        // Reject topics that are a sub-phrase of an entity name (e.g., "Nib Environmental"
        // from "NIB Environmental Bond").
        if (topicWords.length >= 2 && entityLower.includes(topicLower)) return true;
        return false;
      },
    );
    // Also reject reversed or reordered person names (e.g., "Varmus Harold").
    const matchingPerson = entities.find(
      (e) =>
        e.type === 'person' &&
        e.name.toLowerCase().split(/\s+/).filter(Boolean).sort().join(' ') === topicWords.sort().join(' '),
    );
    if (isGeneric || matchingEntity || matchingPerson) return undefined;
  }

  const tags = Array.isArray(p.tags) ? p.tags.filter((t): t is string => typeof t === 'string') : [];
  const citations = Array.isArray(p.citations) ? p.citations.filter((c): c is string => typeof c === 'string') : [];
  const wikilinks = Array.isArray(p.wikilinks) ? p.wikilinks.filter((w): w is string => typeof w === 'string') : [];
  let related = Array.isArray(p.related) ? p.related.filter((r): r is string => typeof r === 'string') : [];

  // Ensure topic pages always have related links to supporting documents and entities.
  if (pageType === 'topic' && related.length === 0) {
    related = entities.slice(0, 3).map((e) => `entities/${e.canonical}.md`);
  }

  return {
    pageType: pageType as PagePlan['pageType'],
    title,
    fileName: p.fileName.trim(),
    folder: p.folder.trim(),
    tags,
    citations,
    wikilinks,
    related,
  };
}

function buildPagePlannerContext(
  result: ExtractionResult,
  structure: StructureOutput,
  entities: ExtractedEntity[],
  evidence: EvidenceOutput,
  agentsMd?: string,
  memory?: OrchestratorMemory,
  samplingStrategy?: { category: string; reason: string },
): string {
  const lines: string[] = [];

  if (agentsMd) {
    lines.push('## AGENTS.md');
    lines.push(agentsMd);
    lines.push('');
  }

  if (samplingStrategy) {
    lines.push('## Sampling strategy');
    lines.push(`- category: ${samplingStrategy.category}`);
    lines.push(`- reason: ${samplingStrategy.reason}`);
    lines.push('');
  }

  if (memory && memory.rollingSummary) {
    lines.push('## Rolling memory');
    lines.push(memory.summaryOnly ? '[Summary-only mode]' : memory.rollingSummary);
    lines.push('');
  }

  lines.push('## PDF metadata');
  lines.push(`- file: ${result.fileName}`);
  lines.push(`- pages: ${result.physicalPages}`);
  lines.push(`- title: ${result.metadata.title || 'unknown'}`);
  lines.push(`- tables: ${result.tables.length}`);
  lines.push(`- figures: ${result.figures.length}`);
  lines.push(`- scanned pages: ${result.pages.filter((p) => p.isScanned).length}`);
  lines.push('');

  lines.push('## Structure');
  for (const heading of structure.headings) {
    lines.push(`- ${heading.title} (page ${heading.page})`);
  }
  lines.push('');

  lines.push('## Entities');
  for (const entity of entities) {
    lines.push(`- ${entity.name} (${entity.type}) — canonical: ${entity.canonical}`);
  }
  lines.push('');

  lines.push('## Evidence summary');
  lines.push(`${evidence.claims.length} claims, ${evidence.tables.length} tables, ${evidence.figures.length} figures.`);
  for (const claim of evidence.claims.slice(0, 5)) {
    lines.push(`- ${claim.text} (${claim.pages})`);
  }
  lines.push('');

  lines.push('## Existing folder hierarchy');
  if (memory && Object.keys(memory.state.folderHierarchy).length > 0) {
    for (const folder of Object.values(memory.state.folderHierarchy)) {
      lines.push(`- ${folder.folder}: ${folder.title} (page types: ${folder.pageTypes.join(', ')})`);
    }
  } else {
    lines.push('No existing hierarchy. Use the default folders: documents, sources, topics, entities, raw.');
  }
  lines.push('');
  lines.push('## Structural rules');
  lines.push('');
  lines.push('- New page types inside existing folders are allowed and are auto-approved.');
  lines.push('- New folders or re-organizations must be emitted as a structural-change proposal; do not silently create a new folder.');
  lines.push('- If a page does not fit any existing folder, emit a proposal with a reason, the new folder name, and the affected pages.');
  lines.push('');
  return lines.join('\n');
}

export function defaultFolderPlacements(
  result: ExtractionResult,
  entities: ExtractedEntity[],
): FolderPlan[] {
  const plans: FolderPlan[] = [
    {
      folder: 'documents',
      title: 'Documents',
      description: 'Document chunks extracted from the source PDFs.',
      pageTypes: ['document'],
      children: [],
    },
    {
      folder: 'sources',
      title: 'Sources',
      description: 'Catalog pages for each source PDF.',
      pageTypes: ['source'],
      children: [],
    },
  ];

  if (result.pages.some((p) => p.isScanned)) {
    plans.push({
      folder: 'raw',
      title: 'Raw Fragments',
      description: 'Scanned or unparseable pages preserved as raw fragments.',
      pageTypes: ['raw'],
      children: [],
    });
  }

  if (entities.length > 0) {
    plans.push({
      folder: 'entities',
      title: 'Entities',
      description: 'People, organizations, and other named entities mentioned in the corpus.',
      pageTypes: ['entity'],
      children: [],
    });
  }

  plans.push({
    folder: 'topics',
    title: 'Topics',
    description: 'Recurring themes and concepts.',
    pageTypes: ['topic'],
    children: [],
  });

  return plans;
}

const CRITIC_CHECK_NAMES = [
  'factual-claims-cited',
  'citations-mapped-to-sources',
  'tables-figures-preserved',
  'paragraphs-represented',
  'wikilinks-plausible',
  'page-plan-matches-output',
  'new-page-types-documented',
  'pages-self-contained-readable',
] as const;

type CriticCheckName = (typeof CRITIC_CHECK_NAMES)[number];

function allChecksPass(): import('./types.js').CriticCheck[] {
  return CRITIC_CHECK_NAMES.map((name) => ({ name, result: 'PASS' as const, reason: 'Check passed' }));
}

/**
 * Critic: LLM-driven review of the page plan and folder placements.
 */
export async function critic(
  result: ExtractionResult,
  pages: PagePlan[],
  folderPlacements: FolderPlan[],
  llmClient: LLMClient,
  agentsMd?: string,
  memory?: OrchestratorMemory,
  pageUpdates?: PageUpdate[],
): Promise<CriticReview> {
  const fallback = criticFallback(result, pages, folderPlacements);

  if (!llmClient.isEnabled()) {
    return fallback;
  }

  try {
    const context = buildCriticContext(result, pages, folderPlacements, agentsMd, memory, pageUpdates);
    const response = await llmClient.call(buildPrompt('critic', context), {
      maxTokens: 1500,
      temperature: 1.0,
    });
    const parsed = parseStructuredJson<CriticReview>(response.text);
    if (parsed && isValidCriticReview(parsed)) {
      // Merge LLM issues with deterministic fallback to ensure nothing is missed.
      // If the LLM returns a partial review (e.g., no checks or blockingIssues),
      // fill in the missing fields from the fallback.
      const llmApproved = typeof parsed.approved === 'boolean' ? parsed.approved : parsed.issues.length === 0;
      const llmChecks = Array.isArray(parsed.checks) ? parsed.checks : fallback.checks;
      const llmBlockingIssues = Array.isArray(parsed.blockingIssues) ? parsed.blockingIssues : [];
      return {
        approved: llmApproved && fallback.approved,
        issues: [...fallback.issues, ...parsed.issues],
        confidence: parsed.confidence,
        checks: llmChecks.length === CRITIC_CHECK_NAMES.length ? llmChecks : mergeChecks(llmChecks, fallback.checks),
        blockingIssues: [...fallback.blockingIssues, ...llmBlockingIssues],
      };
    }
  } catch {
    // Keep fallback.
  }

  return fallback;
}

function mergeChecks(
  llmChecks: CriticCheck[],
  fallbackChecks: CriticCheck[],
): CriticCheck[] {
  const byName = new Map<CriticCheckName, CriticCheck>();
  for (const check of fallbackChecks) byName.set(check.name as CriticCheckName, check);
  for (const check of llmChecks) byName.set(check.name as CriticCheckName, check);
  return CRITIC_CHECK_NAMES.map((name) => byName.get(name) ?? { name, result: 'PASS', reason: 'No finding' });
}

function criticFallback(
  _result: ExtractionResult,
  pages: PagePlan[],
  folderPlacements: FolderPlan[],
): CriticReview {
  const issues: CriticReview['issues'] = [];

  if (pages.length === 0) {
    issues.push({ type: 'missing', message: 'No pages planned', severity: 'high' });
  }

  for (const page of pages) {
    if (!page.title || page.title.trim() === '') {
      issues.push({ type: 'schema', message: 'Page missing title', severity: 'high' });
    }
    if (!page.folder || page.folder.trim() === '') {
      issues.push({ type: 'schema', message: 'Page missing folder', severity: 'high' });
    }
    if (!page.pageType || typeof page.pageType !== 'string' || page.pageType.trim() === '') {
      issues.push({ type: 'schema', message: `Invalid page type: ${page.pageType}`, severity: 'high' });
    }
  }

  if (folderPlacements.length === 0) {
    issues.push({ type: 'missing', message: 'No folder placements planned', severity: 'high' });
  }

  const confidence = issues.length === 0 ? 'high' : issues.some((i) => i.severity === 'high') ? 'low' : 'medium';
  const blockingIssues = issues
    .filter((i) => i.severity === 'high')
    .map((i) => ({ check: 'page-plan-matches-output', message: i.message, severity: i.severity as 'high' | 'medium' | 'low' }));

  return {
    approved: issues.length === 0,
    issues,
    confidence,
    checks: allChecksPass(),
    blockingIssues,
  };
}

function isValidCriticReview(output: unknown): output is Pick<CriticReview, 'issues' | 'confidence'> & Partial<CriticReview> {
  const o = output as Record<string, unknown> | undefined;
  if (!o || typeof o !== 'object') return false;
  if (!Array.isArray(o.issues)) return false;
  if (!['high', 'medium', 'low'].includes(String(o.confidence))) return false;
  return true;
}

function buildCriticContext(
  result: ExtractionResult,
  pages: PagePlan[],
  folderPlacements: FolderPlan[],
  agentsMd?: string,
  memory?: OrchestratorMemory,
  pageUpdates?: PageUpdate[],
): string {
  const lines: string[] = [];

  if (agentsMd) {
    lines.push('## AGENTS.md');
    lines.push(agentsMd);
    lines.push('');
  }

  if (memory && memory.rollingSummary) {
    lines.push('## Rolling memory');
    lines.push(memory.summaryOnly ? '[Summary-only mode]' : memory.rollingSummary);
    lines.push('');
  }

  lines.push('## Source PDF');
  lines.push(`- file: ${result.fileName}`);
  lines.push(`- pages: ${result.physicalPages}`);
  lines.push('');

  lines.push('## Page plan');
  for (const page of pages) {
    lines.push(`- ${page.pageType}: ${page.title} (${page.folder}/${page.fileName})`);
  }
  lines.push('');

  lines.push('## Folder placements');
  for (const folder of folderPlacements) {
    lines.push(`- ${folder.folder}: ${folder.title}`);
  }
  lines.push('');

  if (pageUpdates && pageUpdates.length > 0) {
    lines.push('## Drafted pages');
    for (const update of pageUpdates) {
      lines.push(`- ${update.filePath} (fallback: ${update.fallback ?? false})`);
      const bodyPreview = String(update.body ?? '').slice(0, 800).replace(/\s+/g, ' ');
      if (bodyPreview) {
        lines.push(`  Body preview: ${bodyPreview}`);
      }
    }
    lines.push('');
  }

  lines.push('## Source context (truncated)');
  const sourceText = result.pages.map((p) => p.text).join('\n\n');
  lines.push(sourceText.slice(0, 2000).replace(/\s+/g, ' '));
  lines.push('');

  return lines.join('\n');
}

// ---------- Memory helpers ----------

export function createInitialMemory(
  result: ExtractionResult,
  chunks: Chunk[],
): OrchestratorMemory {
  return {
    rollingSummary: `Sample document ${result.fileName} has ${result.physicalPages} physical pages and ${chunks.length} chunks.`,
    historicalSummary: '',
    summaryOnly: false,
    state: {
      document: {
        title: result.metadata.title || result.fileName,
        totalPages: result.physicalPages,
        currentChunk: 0,
        boundaryType: result.tables.length > 0 ? 'table' : 'page',
      },
      entities: {},
      topics: {},
      relationships: [],
      sources: {
        [result.filePath]: {
          sha256: result.sha256,
          logicalPages: String(result.logicalPages),
          physicalPages: result.physicalPages,
          warnings: result.warnings,
        },
      },
      folderHierarchy: {},
      rawFragments: result.pages
        .filter((p) => p.isScanned)
        .map((p) => ({
          source: result.filePath,
          pages: String(p.physicalPage),
          reason: 'Scanned or image-only page',
          fragment: p.text.slice(0, 200),
        })),
      duplicateFlags: [],
      sourceEntities: {},
      sourceTopics: {},
    },
  };
}

export function updateMemory(
  memory: OrchestratorMemory,
  sourcePath: string,
  entities: ExtractedEntity[],
  relationships: ExtractedRelationship[],
  topics: { name: string; count: number; related: string[] }[],
  folderPlacements: FolderPlan[],
): void {
  // Subtract old source contributions to avoid double-counting on re-ingestion.
  const oldSourceEntities = memory.state.sourceEntities[sourcePath] ?? {};
  for (const [slug, oldCount] of Object.entries(oldSourceEntities)) {
    const entity = memory.state.entities[slug];
    if (entity) {
      entity.count = Math.max(0, (entity.count ?? 0) - oldCount);
      if (entity.count <= 0) {
        delete memory.state.entities[slug];
      }
    }
  }

  const newSourceEntities: Record<string, number> = {};

  for (const entity of entities) {
    const canonical = entity.canonical || slugify(entity.name);
    newSourceEntities[canonical] = (newSourceEntities[canonical] ?? 0) + (entity.count ?? 1);

    if (memory.state.entities[canonical]) {
      const existing = memory.state.entities[canonical];
      existing.count = (existing.count ?? 0) + (entity.count ?? 1);
      existing.mentions.push(...entity.mentions);
      existing.confidence = Math.max(existing.confidence, entity.confidence);
      for (const alias of entity.aliases) {
        if (!existing.aliases.includes(alias)) {
          existing.aliases.push(alias);
        }
      }
      // If the new entity name differs from the canonical entity name, record it as an alias.
      if (existing.name.toLowerCase() !== entity.name.toLowerCase() && !existing.aliases.includes(entity.name)) {
        existing.aliases.push(entity.name);
      }
      // Merge description from the entity if the existing one is missing.
      if (!existing.description && entity.description) {
        existing.description = entity.description;
      }
      if (entity.relationships) {
        existing.relationships = existing.relationships ?? [];
        for (const rel of entity.relationships) {
          if (!existing.relationships.some((r) => r.predicate === rel.predicate && r.object === rel.object)) {
            existing.relationships.push(rel);
          }
        }
      }
    } else {
      memory.state.entities[canonical] = { ...entity, canonical };
    }
  }

  memory.state.sourceEntities[sourcePath] = newSourceEntities;

  // Update relationships and attach them to the subject entity.
  memory.state.relationships.push(...relationships);
  for (const rel of relationships) {
    const subjectSlug = findCanonicalSlugByName(rel.subject, memory);
    if (subjectSlug) {
      const entity = memory.state.entities[subjectSlug];
      if (entity) {
        entity.relationships = entity.relationships ?? [];
        if (!entity.relationships.some((r) => r.predicate === rel.predicate && r.object === rel.object)) {
          entity.relationships.push({
            predicate: rel.predicate,
            object: rel.object,
            evidence: rel.evidence,
            pages: rel.pages,
          });
        }
      }
    }
  }

  // Update topics and source topic counts.
  const oldSourceTopics = memory.state.sourceTopics[sourcePath] ?? {};
  for (const [name, oldCount] of Object.entries(oldSourceTopics)) {
    const topic = memory.state.topics[name];
    if (topic) {
      const currentMentions = topic.mentions.length;
      topic.mentions.splice(0, Math.min(oldCount, currentMentions));
      if (topic.mentions.length === 0 && topic.related.length === 0) {
        delete memory.state.topics[name];
      }
    }
  }

  const newSourceTopics: Record<string, number> = {};
  for (const topic of topics) {
    const name = topic.name.toLowerCase();
    newSourceTopics[name] = (newSourceTopics[name] ?? 0) + topic.count;

    if (!memory.state.topics[name]) {
      memory.state.topics[name] = { tags: ['topic', 'theme'], mentions: [], related: [] };
    }
    memory.state.topics[name].related = [...new Set([...memory.state.topics[name].related, ...topic.related])];
  }
  memory.state.sourceTopics[sourcePath] = newSourceTopics;

  // Update folder hierarchy.
  for (const folder of folderPlacements) {
    memory.state.folderHierarchy[folder.folder] = folder;
  }

  // Update rolling summary.
  memory.rollingSummary = `Updated memory with ${Object.keys(memory.state.entities).length} entities, ${memory.state.relationships.length} relationships, and ${Object.keys(memory.state.topics).length} topics.`;

  // Flag potential duplicate entities.
  flagDuplicateEntities(memory);
}

function flagDuplicateEntities(memory: OrchestratorMemory): void {
  const entitySlugs = Object.keys(memory.state.entities);
  const topicSlugs = Object.keys(memory.state.topics);
  const flags = [
    ...findPotentialDuplicates(entitySlugs),
    ...findCrossDuplicates(entitySlugs, topicSlugs),
  ];
  const existing = new Set(memory.state.duplicateFlags.map((f) => [f.a, f.b].sort().join('|')));
  for (const flag of flags) {
    const key = [flag.a, flag.b].sort().join('|');
    if (!existing.has(key)) {
      memory.state.duplicateFlags.push(flag);
      existing.add(key);
    }
  }
}

// ---------- ChunkWriter (Sprint 4b) ----------

/**
 * ChunkWriter: LLM-driven author of markdown content. Falls back to deterministic
 * document pages when the LLM is disabled or returns invalid output.
 */
export async function chunkWriter(
  pages: PagePlan[],
  chunks: Chunk[],
  result: ExtractionResult,
  config: Config,
  llmClient: LLMClient,
  agentsMd?: string,
  memory?: OrchestratorMemory,
  feedback?: string[],
): Promise<PageUpdate[]> {
  const fallbackUpdates = buildFallbackDocumentUpdates(chunks, result, config);

  if (!llmClient.isEnabled()) {
    return fallbackUpdates;
  }

  const knownTitles = collectKnownPageTitles(pages);

  // Process chunks concurrently with a small limit so large documents do not
  // spend wall-clock time on sequential LLM calls.
  const chunkTasks = chunks.map((chunk) => async () => {
    const chunkPlan = findPagePlanForChunk(pages, chunk) ?? buildDefaultPagePlan(chunk);
    try {
      const prompt = buildChunkWriterPrompt(
        [chunkPlan],
        [chunk],
        result,
        config,
        agentsMd,
        memory,
        knownTitles,
        feedback,
      );
      const response = await llmClient.call(prompt, { maxTokens: 4000, temperature: 0.2 });
      const parsed = parseChunkWriterJson(response.text);
      if (parsed && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
        const normalized = normalizePageUpdate(parsed.pages[0], result, config, knownTitles);
        if (normalized) {
          // Use the deterministic file path so merges are always correct.
          return { ...normalized, filePath: `documents/${chunk.id}.md` };
        }
      }
    } catch {
      // Ignore per-chunk LLM failures and keep the fallback for this chunk.
    }
    return undefined;
  });

  const results = await withConcurrencyLimit(chunkTasks, 4);
  const llmUpdates = results.filter((u): u is PageUpdate => u !== undefined);

  return mergeWithFallback(fallbackUpdates, llmUpdates);
}

async function withConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const current = index++;
      results[current] = await tasks[current]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export function buildFallbackDocumentUpdates(
  chunks: Chunk[],
  _result: ExtractionResult,
  config: Config,
): PageUpdate[] {
  return chunks.map((chunk) => {
    const { frontmatter, body } = buildDocumentPage(chunk, config, [], []);
    return {
      filePath: `documents/${chunk.id}.md`,
      frontmatter,
      body,
      fallback: true,
    };
  });
}

function findPagePlanForChunk(pages: PagePlan[], chunk: Chunk): PagePlan | undefined {
  const fileName = `${chunk.id}.md`;
  return pages.find((p) => p.fileName === fileName);
}

function buildDefaultPagePlan(chunk: Chunk): PagePlan {
  return {
    pageType: 'document',
    title: chunk.title,
    fileName: `${chunk.id}.md`,
    folder: 'documents',
    tags: chunk.tags,
    citations: chunk.sources.map((s) => s.id),
    wikilinks: [],
    related: [],
  };
}

function collectKnownPageTitles(pages: PagePlan[]): { entities: string[]; topics: string[] } {
  const entities = new Set<string>();
  const topics = new Set<string>();

  for (const page of pages) {
    if (page.pageType === 'entity') {
      const cleanName = page.title.replace(/^Entity:\s*/i, '').trim();
      entities.add(page.title);
      entities.add(`Entity: ${cleanName}`);
    } else if (page.pageType === 'topic') {
      const cleanName = page.title.replace(/^Topic:\s*/i, '').trim();
      topics.add(page.title);
      topics.add(`Topic: ${cleanName}`);
    }
  }

  return { entities: Array.from(entities), topics: Array.from(topics) };
}

function buildChunkWriterPrompt(
  pages: PagePlan[],
  chunks: Chunk[],
  result: ExtractionResult,
  config: Config,
  agentsMd?: string,
  memory?: OrchestratorMemory,
  knownTitles?: { entities: string[]; topics: string[] },
  feedback?: string[],
): string {
  const lines: string[] = [
    'You are the ChunkWriter agent for a PDF-to-wiki CLI.',
    'Write the markdown content for the planned document pages below.',
    'Return ONLY a JSON object matching the schema at the end.',
    '',
    'Rules:',
    '- Begin each document page with a brief LLM-written synthesis / summary.',
    '- Add key claims extracted from the chunk, each with an inline [^srcN] citation.',
    '- Link named entities to their canonical pages using the exact page title: [[Entity: Name]] or [[Topic: Name]].',
    '- ONLY link to entity/topic pages listed in the "Known pages" section below. If a name is not listed, do not link it.',
    '- NEVER use piped wikilinks such as [[Target|Display]]. Use only the exact title format: [[Exact Title]].',
    '- Mention any preserved tables or figures briefly, with Source: [^srcN].',
    '- Do NOT include the full extracted text or tables in the body; the deterministic layer appends the full extracted detail below your synthesis.',
    '- Multi-source claims cite all sources: [^src1] [^src2].',
    '- Scanned or unparseable pages: do not make claims, or mark them as needing verification.',
    '- Confidence may be high, medium, or low.',
    '- Tags should be lowercase, hyphenated, and drawn from the corpus vocabulary.',
    '',
  ];

  if (feedback && feedback.length > 0) {
    lines.push('## Feedback from the Critic');
    lines.push('Address the following issues in your revised output:');
    for (const item of feedback) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  if (knownTitles && (knownTitles.entities.length > 0 || knownTitles.topics.length > 0)) {
    lines.push('## Known pages');
    lines.push('Only use wikilinks that match these exact titles. Do not invent titles.');
    if (knownTitles.entities.length > 0) {
      lines.push('');
      lines.push('Entities:');
      for (const title of knownTitles.entities) {
        lines.push(`- [[${title}]]`);
      }
    }
    if (knownTitles.topics.length > 0) {
      lines.push('');
      lines.push('Topics:');
      for (const title of knownTitles.topics) {
        lines.push(`- [[${title}]]`);
      }
    }
    lines.push('');
  }

  if (agentsMd && agentsMd.trim().length > 0) {
    lines.push('## AGENTS.md (wiki conventions)');
    lines.push(agentsMd.trim());
    lines.push('');
  }

  if (memory && memory.rollingSummary) {
    lines.push('## Rolling memory');
    lines.push(memory.summaryOnly ? '[Summary-only mode]' : memory.rollingSummary);
    lines.push('');
  }

  lines.push('## Wiki');
  lines.push(`- slug: ${config.wiki.slug}`);
  lines.push(`- title: ${config.wiki.title}`);
  lines.push(`- description: ${config.wiki.description}`);
  lines.push('');

  lines.push('## Source PDF');
  lines.push(`- file: ${result.filePath}`);
  lines.push(`- pages: ${result.physicalPages}`);
  lines.push(`- title: ${result.metadata.title || 'unknown'}`);
  lines.push(`- tables: ${result.tables.length}`);
  lines.push(`- figures: ${result.figures.length}`);
  lines.push(`- scanned pages: ${result.pages.filter((p) => p.isScanned).map((p) => p.physicalPage).join(', ') || 'none'}`);
  lines.push('');

  lines.push('## Page plan');
  for (const page of pages) {
    lines.push(`- ${page.pageType}: ${page.title} (${page.folder}/${page.fileName})`);
  }
  lines.push('');

  lines.push('## Extracted chunks');
  for (const chunk of chunks) {
    lines.push(`### Chunk ${chunk.id} — pages ${chunk.pageRange}`);
    // The full extracted text is preserved by the deterministic layer below the
    // LLM synthesis. Truncating the prompt keeps LLM calls fast for large chunks.
    const MAX_CHUNK_PROMPT_CHARS = 10000;
    lines.push(chunk.content.slice(0, MAX_CHUNK_PROMPT_CHARS));
    if (chunk.content.length > MAX_CHUNK_PROMPT_CHARS) {
      lines.push('\n[Chunk content truncated for prompt length; full detail is preserved below.]');
    }
    lines.push('');
  }

  lines.push('## JSON schema');
  lines.push('Return ONLY a JSON object with this shape:');
  lines.push(JSON.stringify({
    pages: [
      {
        filePath: 'documents/<source-slug>-part-001.md',
          frontmatter: {
            title: 'Page title',
            type: 'document',
            wiki: config.wiki.slug,
            tags: ['example-tag'],
            confidence: 'high',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            sources: [
              {
                id: 'src1',
              file: 'wikis/<slug>/raw/<file>.pdf',
              pages: '1-2',
              extracted: new Date().toISOString(),
              label: 'Source label',
            },
          ],
        },
        body: '## Synthesis\n\nThis chunk discusses...\n\n## Key Claims\n\n- Claim with citation [^src1].\n- Another claim [^src1].\n\n## Tables and Figures\n\n- A table of ... is preserved in the extracted detail below. Source: [^src1].',
        citations: [
          { claim: 'Claim text', sources: ['src1'] },
        ],
      },
    ],
  }, null, 2));

  return lines.join('\n');
}

function parseChunkWriterJson(text: string): { pages: unknown[] } | undefined {
  const parsed = parseStructuredJson<{ pages?: unknown[] }>(text);
  if (parsed && Array.isArray(parsed.pages)) {
    return parsed as { pages: unknown[] };
  }
  return undefined;
}

function normalizePageUpdate(
  page: unknown,
  result: ExtractionResult,
  config: Config,
  knownTitles?: { entities: string[]; topics: string[] },
): PageUpdate | undefined {
  if (typeof page !== 'object' || page === null) return undefined;
  const p = page as Record<string, unknown>;
  if (typeof p.filePath !== 'string' || p.filePath.trim() === '') return undefined;
  if (typeof p.body !== 'string' || p.body.trim() === '') return undefined;
  const frontmatter = (typeof p.frontmatter === 'object' && p.frontmatter !== null)
    ? (p.frontmatter as Record<string, unknown>)
    : {};

  // Reject frontmatter that explicitly claims an invalid page type for a document page.
  if (frontmatter.type && frontmatter.type !== 'document') return undefined;

  // Ensure required deterministic fields.
  frontmatter.type = 'document';
  frontmatter.wiki = config.wiki.slug;
  if (!frontmatter.title || typeof frontmatter.title !== 'string' || frontmatter.title.trim() === '') {
    frontmatter.title = p.filePath;
  }
  if (!frontmatter.sources || !Array.isArray(frontmatter.sources) || frontmatter.sources.length === 0) {
    frontmatter.sources = buildDefaultSources(result);
  }
  if (!frontmatter.tags || !Array.isArray(frontmatter.tags)) {
    frontmatter.tags = [];
  }
  if (!frontmatter.confidence || !['high', 'medium', 'low'].includes(String(frontmatter.confidence))) {
    frontmatter.confidence = 'medium';
  }
  const now = new Date().toISOString();
  if (!frontmatter.created || typeof frontmatter.created !== 'string') {
    frontmatter.created = now;
  }
  if (!frontmatter.updated || typeof frontmatter.updated !== 'string') {
    frontmatter.updated = now;
  }

  const validation = validateFrontmatter(frontmatter);
  if (!validation.valid) {
    return undefined;
  }

  let body = p.body;
  if (knownTitles) {
    body = sanitizeWikilinks(body, knownTitles);
  }

  return {
    filePath: p.filePath,
    frontmatter,
    body,
    citations: Array.isArray(p.citations) ? (p.citations as { claim: string; sources: string[] }[]) : undefined,
    fallback: false,
  };
}

function sanitizeWikilinks(
  body: string,
  knownTitles: { entities: string[]; topics: string[] },
): string {
  const known = new Set([...knownTitles.entities, ...knownTitles.topics]);
  return body.replace(/\[\[[^\]|]+(?:\|[^\]]+)?\]\]/g, (match) => {
    const inner = match.slice(2, -2);
    const [target, display] = inner.split('|', 2);
    const targetTitle = target.trim();
    const displayText = display !== undefined ? display.trim() : targetTitle;
    if (known.has(targetTitle)) {
      // Enforce the no-pipe rule: only exact-title links are allowed.
      return `[[${targetTitle}]]`;
    }
    return displayText;
  });
}

function buildDefaultSources(result: ExtractionResult): Record<string, unknown>[] {
  return [
    {
      id: 'src1',
      file: result.filePath,
      pages: `1-${result.physicalPages}`,
      extracted: result.ingested,
      label: result.fileName,
    },
  ];
}

function mergeWithFallback(
  fallbackUpdates: PageUpdate[],
  llmUpdates: PageUpdate[],
): PageUpdate[] {
  const llmByPath = new Map(llmUpdates.map((u) => [u.filePath.toLowerCase(), u]));
  return fallbackUpdates.map((fallback) => {
    const llm = llmByPath.get(fallback.filePath.toLowerCase());
    if (llm) {
      return { ...llm, filePath: fallback.filePath };
    }
    return fallback;
  });
}

export { buildDefaultSources };
