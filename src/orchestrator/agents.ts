import type { LLMClient } from '../llm/client.js';
import { parseStructuredJson } from '../llm/json.js';
import { CLIError } from '../errors.js';
import type { Chunk, ChunkingStrategyHint, PdfStructure, SamplingStrategy } from '../chunking/types.js';
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
  EntityAudit,
  EntityTaxonomy,
  EntitySubFolder,
} from './types.js';
import { validateFrontmatter } from '../validation/schema.js';
import {
  type EntityMention,
  type MentionLocation as EntityMentionLocation,
  buildTypeBasedTaxonomy,
  resolveEntitySubFolder,
  entityFilePath,
} from '../entities/index.js';
import { extractTopics, topicPageTitle, isGenericTopic, type Topic, type MentionLocation as TopicMentionLocation } from '../topics/index.js';
import { slugify, SlugRegistry } from '../utils/slug.js';
import { findPotentialDuplicates, findCrossDuplicates } from '../utils/similarity.js';
import type { Config } from '../config.js';
import { buildPrompt } from './prompt-loader.js';
import { buildDefaultSourcePageBody } from '../writers/source.js';
import { buildDefaultRawPageBody } from '../writers/raw.js';
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

export interface SourcePageWriterOutput {
  body: string;
}

export interface RawPageWriterOutput {
  body: string;
}

export { PagePlannerOutput, PagePlan };

// ---------- LLM call helper with one JSON repair attempt ----------

async function callAgentWithRepair<T>(
  agent: string,
  prompt: string,
  llmClient: LLMClient,
  maxTokens: number,
  temperature: number,
  parse: (text: string) => T | undefined,
  extraOptions?: Record<string, unknown>,
): Promise<T> {
  // Every agent routed through this helper returns structured JSON, so
  // provider thinking is disabled (Kimi only) to keep the whole max_tokens
  // budget available for the reply; thinking-starvation otherwise yields
  // empty or truncated JSON.
  const callOptions = { maxTokens, temperature, ...structuredOutputOptions(llmClient), ...(extraOptions ?? {}) };
  const response = await llmClient.call(prompt, callOptions);
  const parsed = parse(response.text);
  if (parsed !== undefined) {
    return parsed;
  }

  const degenerationNote = hasDegenerateTail(response.text)
    ? ' Your previous response degenerated into an endlessly repeated filler pattern (such as empty table cells "| | |") and was cut off. Do NOT transcribe empty cells or repeat filler; omit empty cells and rows entirely and continue with real content.'
    : '';
  const repairPrompt = `${prompt}\n\n---\n\nYour previous response could not be parsed as valid JSON.${degenerationNote} Please return ONLY a single valid JSON object matching the requested schema, with no markdown fences, no explanatory text, and no trailing commas. Do not include any other text.`;
  const repairResponse = await llmClient.call(repairPrompt, callOptions);
  const repaired = parse(repairResponse.text);
  if (repaired !== undefined) {
    return repaired;
  }

  throw new CLIError(
    `${agent} returned invalid or unparseable output after one repair attempt. ` +
      `First response: ${describeUnparseableResponse(response.text)} ` +
      `Repaired response: ${describeUnparseableResponse(repairResponse.text)}`,
  );
}

/**
 * Provider-specific options for large structured-output calls. On Kimi,
 * thinking tokens draw from the same max_tokens budget as the reply, which can
 * starve or truncate a long JSON response; disabling thinking keeps the whole
 * budget for the reply. Other providers need no override.
 */
export function structuredOutputOptions(llmClient: LLMClient): Record<string, unknown> {
  const provider = typeof llmClient.provider === 'function' ? llmClient.provider() : undefined;
  return provider === 'kimi' ? { thinking: { type: 'disabled' as const } } : {};
}

/**
 * Detects a degenerate repeated-filler tail (e.g., an unbroken run of empty
 * markdown table cells) in a failed LLM response so the repair prompt can name
 * the pathology explicitly.
 */
function hasDegenerateTail(text: string): boolean {
  const tail = text.slice(-600);
  if (tail.length < 200) return false;
  const filler = (tail.match(/[|\s-]/g) ?? []).length;
  return filler / tail.length > 0.9;
}

/**
 * Diagnostic summary of an unparseable LLM response (length + head/tail
 * snippets) so parse failures can be root-caused from the error message
 * without extra instrumentation. Wiki content and API keys never appear here;
 * the snippets are from the LLM's own reply.
 */
function describeUnparseableResponse(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return '(empty response text)';
  }
  const head = trimmed.slice(0, 300).replace(/\s+/g, ' ');
  const tail = trimmed.length > 600 ? trimmed.slice(-300).replace(/\s+/g, ' ') : '';
  return `[${trimmed.length} chars] head="${head}"${tail ? ` tail="${tail}"` : ''}`;
}

// ---------- Canonical name resolution ----------

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
 * Merge entities that share a name or alias, e.g. LLM-extracted "Acme Corp"
 * and "Acme Corporation (alias: Acme Corp)". The longer name is preferred
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
  if (!llmClient.isEnabled()) {
    throw new CLIError('LLM is required for structure analysis.');
  }

  const context = buildStructureContext(result, chunks, agentsMd, memory);
  const parsed = await callAgentWithRepair<StructureOutput>(
    'StructureAnalyst',
    buildPrompt('structure-analyst', context),
    llmClient,
    8500,
    0.2,
    (text) => {
      const p = parseStructuredJson<StructureOutput>(text);
      return p && isValidStructureOutput(p) ? p : undefined;
    },
  );
  return parsed;
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
  if (!llmClient.isEnabled()) {
    throw new CLIError('LLM is required for entity extraction.');
  }

  const context = buildEntityContext(result, chunks, agentsMd, memory);
  const parsed = await callAgentWithRepair<{ entities?: unknown[] }>(
    'EntityExtractor',
    buildPrompt('entity-extractor', context),
    llmClient,
    8500,
    0.2,
    (text) => {
      const p = parseStructuredJson<{ entities?: unknown[] }>(text);
      return p && Array.isArray(p.entities) ? p : undefined;
    },
  );

  const normalized = (parsed.entities || [])
    .map((e) => normalizeExtractedEntity(e))
    .filter((e): e is ExtractedEntity => {
      if (!e) return false;
      // Only keep LLM entities that include a non-empty description.
      return typeof e.description === 'string' && e.description.trim().length > 0;
    });
  const llmEntities = normalized.sort((a, b) => {
    const countDiff = b.count - a.count;
    if (countDiff !== 0) return countDiff;
    return b.confidence - a.confidence;
  }).slice(0, 50);

  if (llmEntities.length === 0) {
    return { entities: [] };
  }

  const combined = resolveAndMergeEntities(llmEntities, memory);
  const merged = mergeByNameAndAlias(mergeFragmentEntities(combined));
  const sorted = merged.sort((a, b) => {
    const countDiff = b.count - a.count;
    if (countDiff !== 0) return countDiff;
    return b.confidence - a.confidence;
  });
  return { entities: sorted.slice(0, 50) };
}

/**
 * EntityCritic: LLM-driven review of extracted entities.
 */
export async function entityCritic(
  entities: ExtractedEntity[],
  result: ExtractionResult,
  llmClient: LLMClient,
  agentsMd?: string,
): Promise<EntityAudit> {
  if (!llmClient.isEnabled()) {
    throw new CLIError('LLM is required for entity critic review.');
  }
  if (entities.length === 0) {
    return { approvedEntities: [], rejectedEntities: [], issues: [] };
  }

  const context = buildEntityCriticContext(entities, result, agentsMd);
  return callAgentWithRepair<EntityAudit>(
    'EntityCritic',
    buildPrompt('entity-critic', context),
    llmClient,
    8500,
    0.2,
    parseEntityAuditJson,
  );
}

function parseEntityAuditJson(text: string): EntityAudit | undefined {
  const parsed = parseStructuredJson<EntityAudit>(text);
  if (!parsed || typeof parsed !== 'object') return undefined;
  // The prompt declares `issues` optional; default it rather than rejecting
  // prompt-compliant output.
  const normalized: EntityAudit = {
    approvedEntities: (parsed as EntityAudit).approvedEntities,
    rejectedEntities: (parsed as EntityAudit).rejectedEntities ?? [],
    issues: (parsed as EntityAudit).issues ?? [],
  };
  return isValidEntityAudit(normalized) ? normalized : undefined;
}

function isValidEntityAudit(audit: unknown): audit is EntityAudit {
  const a = audit as Record<string, unknown> | undefined;
  if (!a || typeof a !== 'object') return false;
  if (!Array.isArray(a.approvedEntities)) return false;
  if (!Array.isArray(a.rejectedEntities)) return false;
  if (!Array.isArray(a.issues)) return false;
  for (const item of a.rejectedEntities) {
    if (typeof item !== 'object' || item === null) return false;
    const r = item as Record<string, unknown>;
    if (typeof r.name !== 'string' || typeof r.reason !== 'string') return false;
  }
  for (const item of a.issues) {
    if (typeof item !== 'object' || item === null) return false;
    const i = item as Record<string, unknown>;
    if (typeof i.type !== 'string' || typeof i.message !== 'string') return false;
    if (!['low', 'medium', 'high'].includes(String(i.severity))) return false;
  }
  return true;
}
function buildEntityCriticContext(
  entities: ExtractedEntity[],
  result: ExtractionResult,
  agentsMd?: string,
): string {
  const lines: string[] = [];
  if (agentsMd) {
    lines.push('## AGENTS.md');
    lines.push(agentsMd);
    lines.push('');
  }
  lines.push('## Source PDF');
  lines.push(`- file: ${result.fileName}`);
  lines.push(`- pages: ${result.physicalPages}`);
  lines.push('');
  lines.push('## Extracted text by page');
  for (const page of result.pages) {
    lines.push(`### Page ${page.physicalPage}`);
    lines.push(page.text.slice(0, 500));
    lines.push('');
  }
  lines.push('## Candidate entities');
  for (const entity of entities) {
    lines.push(`- ${entity.name} (${entity.type}) — description: ${entity.description ?? '(none)'}`);
  }
  return lines.join('\n');
}

/**
 * Apply an EntityAudit to a list of entities, keeping only approved names.
 */
export function applyEntityAudit(entities: ExtractedEntity[], audit: EntityAudit): ExtractedEntity[] {
  const approved = new Set(audit.approvedEntities.map((n) => n.trim()));
  return entities.filter((e) => approved.has(e.name.trim()));
}

/**
 * ChunkingPlanner: LLM-driven advice for how the deterministic chunker should
 * split this document. The final boundaries are still produced by the local
 * deterministic chunker; this agent only recommends a splitBoundary.
 */
export async function chunkingPlanner(
  result: ExtractionResult,
  structure: PdfStructure,
  config: Config,
  samplingStrategy: SamplingStrategy,
  llmClient: LLMClient,
  agentsMd?: string,
  feedback?: string,
): Promise<ChunkingStrategyHint> {
  if (!llmClient.isEnabled()) {
    throw new CLIError('LLM is required for chunking planning.');
  }

  const context = buildChunkingPlannerContext(result, structure, samplingStrategy, config, agentsMd, feedback);
  const prompt = buildPrompt('chunking-planner', context);
  // The lightweight model / disabled-thinking override only exists on Kimi;
  // passing it to other providers would request a nonexistent model.
  const kimiOptions = llmClient.provider() === 'kimi'
    ? { model: 'k2.6', thinking: { type: 'disabled' as const } }
    : {};

  const parse = (text: string): ChunkingStrategyHint | undefined => {
    const parsed = parseStructuredJson<ChunkingStrategyHint>(text);
    return parsed && isValidChunkingStrategyHint(parsed) ? parsed : undefined;
  };

  const callOptions = { maxTokens: 2048, ...kimiOptions };
  const response = await llmClient.call(prompt, callOptions);
  const parsed = parse(response.text);
  if (parsed !== undefined) {
    return parsed;
  }

  const repairPrompt = `${prompt}\n\n---\n\nYour previous response could not be parsed. Return ONLY a single valid JSON object matching the requested schema, with no markdown fences and no explanatory text.`;
  const repairResponse = await llmClient.call(repairPrompt, callOptions);
  const repaired = parse(repairResponse.text);
  if (repaired !== undefined) {
    return repaired;
  }

  throw new CLIError('ChunkingPlanner returned invalid or unparseable output after one repair attempt.');
}

function isValidChunkingStrategyHint(output: unknown): output is ChunkingStrategyHint {
  const o = output as Record<string, unknown> | undefined;
  if (!o || typeof o !== 'object') return false;
  const allowed: Array<ChunkingStrategyHint['splitBoundary']> = ['page', 'section', 'heading', 'table', 'figure'];
  if (typeof o.splitBoundary !== 'string' || !allowed.includes(o.splitBoundary as ChunkingStrategyHint['splitBoundary'])) return false;
  if (typeof o.reason !== 'string') return false;
  if (!Array.isArray(o.issues)) return false;
  return true;
}

function buildChunkingPlannerContext(
  result: ExtractionResult,
  structure: PdfStructure,
  samplingStrategy: SamplingStrategy,
  config: Config,
  agentsMd?: string,
  feedback?: string,
): string {
  const lines: string[] = [];

  if (agentsMd) {
    lines.push('## AGENTS.md');
    lines.push(agentsMd);
    lines.push('');
  }

  if (feedback && feedback.trim().length > 0) {
    lines.push('## Feedback from previous chunking attempt');
    lines.push(feedback);
    lines.push('');
  }

  lines.push('## PDF metadata');
  lines.push(`- file: ${result.fileName}`);
  lines.push(`- physical pages: ${result.physicalPages}`);
  lines.push(`- logical pages: ${result.logicalPages}`);
  lines.push(`- title: ${result.metadata.title || 'unknown'}`);
  lines.push(`- total tables: ${result.tables.length}`);
  lines.push(`- total figures: ${result.figures.length}`);
  lines.push('');

  lines.push('## Sampling strategy');
  lines.push(`- category: ${samplingStrategy.category}`);
  lines.push(`- reason: ${samplingStrategy.reason}`);
  if (samplingStrategy.tocSearch) {
    lines.push(`- TOC search: first ${samplingStrategy.tocSearch.firstPages} pages`);
  }
  lines.push('');

  lines.push('## Detected structure');
  lines.push(`- has cover: ${structure.hasCover}`);
  lines.push(`- has TOC: ${structure.hasToc}`);
  lines.push(`- headings: ${structure.headings.length}`);
  lines.push(`- tables: ${structure.tables.length}`);
  lines.push(`- figures: ${structure.figures.length}`);
  lines.push(`- multi-page objects: ${structure.multiPageObjects.length}`);
  if (structure.multiPageObjects.length > 0) {
    for (const mpo of structure.multiPageObjects) {
      lines.push(`  - ${mpo.type} pages ${mpo.startPage}-${mpo.endPage}: ${mpo.description}`);
    }
  }
  lines.push(`- scanned pages: ${structure.scannedPages.join(', ') || 'none'}`);
  lines.push(`- appendix pages: ${structure.appendixPages.join(', ') || 'none'}`);
  lines.push('');

  lines.push('## Chunking constraints');
  lines.push(`- max_chunk_size: ${config.chunking.max_chunk_size} characters`);
  lines.push(`- min_chunk_size: ${config.chunking.min_chunk_size} characters`);
  lines.push(`- never_split: ${config.chunking.never_split.join(', ')}`);
  lines.push(`- overlap: ${config.chunking.overlap}`);
  lines.push('');

  return lines.join('\n');
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

function cleanEntityContextChunkContent(content: string): string {
  return content
    .split('\n')
    .filter((line) => !/^[\s|\-:]*$/.test(line))
    .join('\n')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 3000);
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
  if (!llmClient.isEnabled()) {
    throw new CLIError('LLM is required for relationship extraction.');
  }

  const context = buildRelationshipContext(result, entities, agentsMd, memory);
  const parsed = await callAgentWithRepair<{ relationships?: unknown[] }>(
    'RelationshipExtractor',
    buildPrompt('relationship-extractor', context),
    llmClient,
    8500,
    0.2,
    (text) => {
      const p = parseStructuredJson<{ relationships?: unknown[] }>(text);
      return p && Array.isArray(p.relationships) ? p : undefined;
    },
  );

  const normalized = (parsed.relationships || [])
    .map((r) => normalizeRelationship(r, entities))
    .filter(Boolean) as ExtractedRelationship[];
  return { relationships: normalized };
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
  chunk?: Chunk,
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
  if (chunk) {
    lines.push(`### Chunk ${chunk.id} — pages ${chunk.pageRange}`);
    lines.push(chunk.content.slice(0, 4000));
    lines.push('');
  } else {
    for (const page of result.pages) {
      lines.push(`### Page ${page.physicalPage}`);
      lines.push(page.text.slice(0, 200));
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * RelationshipExtractor variant that runs on a single chunk, using the accumulated
 * global entity list so relationships between entities from distant parts of the same
 * source can be surfaced.
 */
export async function relationshipExtractorForChunk(
  result: ExtractionResult,
  chunk: Chunk,
  entities: ExtractedEntity[],
  llmClient: LLMClient,
  agentsMd?: string,
  memory?: OrchestratorMemory,
): Promise<RelationshipOutput> {
  if (!llmClient.isEnabled()) {
    throw new CLIError('LLM is required for relationship extraction.');
  }

  // Combine chunk entities with the already-known global entities so the LLM can
  // spot relationships that mention entities from other chunks.
  const knownEntityNames = new Set(entities.map((e) => e.name.toLowerCase()));
  if (memory) {
    for (const entity of Object.values(memory.state.entities)) {
      knownEntityNames.add(entity.name.toLowerCase());
      for (const alias of entity.aliases) {
        knownEntityNames.add(alias.toLowerCase());
      }
    }
  }
  const combinedEntities = [
    ...entities,
    ...Object.values(memory?.state.entities ?? {}).filter(
      (e) => !knownEntityNames.has(e.name.toLowerCase()),
    ),
  ];

  const context = buildRelationshipContext(result, combinedEntities, agentsMd, memory, chunk);
  const parsed = await callAgentWithRepair<{ relationships?: unknown[] }>(
    'RelationshipExtractor',
    buildPrompt('relationship-extractor', context),
    llmClient,
    8500,
    0.2,
    (text) => {
      const p = parseStructuredJson<{ relationships?: unknown[] }>(text);
      return p && Array.isArray(p.relationships) ? p : undefined;
    },
  );

  const normalized = (parsed.relationships || [])
    .map((r) => normalizeRelationship(r, combinedEntities))
    .filter(Boolean) as ExtractedRelationship[];
  return { relationships: normalized };
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
  if (!llmClient.isEnabled()) {
    throw new CLIError('LLM is required for evidence collection.');
  }

  const context = buildEvidenceContext(result, chunks, agentsMd, memory);
  const parsed = await callAgentWithRepair<EvidenceOutput>(
    'EvidenceCollector',
    buildPrompt('evidence-collector', context),
    llmClient,
    16000,
    0.2,
    (text) => {
      const p = parseStructuredJson<EvidenceOutput>(text);
      return p && isValidEvidenceOutput(p) ? p : undefined;
    },
  );
  return parsed;
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
  chunks?: Chunk[],
): Promise<PagePlannerOutput> {
  if (!llmClient.isEnabled()) {
    throw new CLIError('LLM is required for page planning.');
  }

  const parse = (text: string): PagePlannerOutput | undefined => {
    const p = parseStructuredJson<PagePlannerOutput>(text);
    return p && isValidPagePlannerOutput(p) ? p : undefined;
  };

  const context = buildPagePlannerContext(result, structure, entities, evidence, agentsMd, memory, samplingStrategy, chunks);
  const parsed = await callAgentWithRepair<PagePlannerOutput>(
    'PagePlanner',
    buildPrompt('page-planner', context),
    llmClient,
    16000,
    0.2,
    parse,
  );
  let normalized = normalizePagePlannerOutput(parsed, result, entities);

  // Semantic plan validation: the plan must list the wiki's folders and cover
  // every chunk with a document page. A plan failing these checks is invalid
  // LLM output — retry once with a stricter repair prompt naming the problems,
  // then abort. Never substitute a deterministic default plan.
  let problems = collectPlanProblems(normalized, chunks);
  if (problems.length > 0) {
    const repairContext = [
      context,
      '',
      '## Repair feedback',
      'Your previous plan was rejected for the following reasons. Fix ALL of them and return the corrected full JSON plan:',
      ...problems.map((p) => `- ${p}`),
    ].join('\n');
    const repaired = await callAgentWithRepair<PagePlannerOutput>(
      'PagePlanner',
      buildPrompt('page-planner', repairContext),
      llmClient,
      16000,
      0.2,
      parse,
    );
    normalized = normalizePagePlannerOutput(repaired, result, entities);
    problems = collectPlanProblems(normalized, chunks);
    if (problems.length > 0) {
      throw new CLIError(`PagePlanner output was still invalid after one repair attempt: ${problems.join('; ')}`);
    }
  }

  return normalized;
}

function collectPlanProblems(plan: PagePlannerOutput, chunks?: Chunk[]): string[] {
  const problems: string[] = [];
  if (plan.folderPlacements.length === 0) {
    problems.push(
      'folderPlacements is empty. List EVERY folder the wiki uses in folderPlacements — including the defaults (documents, sources, topics, entities, raw) — each with folder, title, description, pageTypes, and children.',
    );
  }
  for (const chunk of findChunksWithoutPlans(plan.pages, chunks)) {
    problems.push(
      `No document page was planned for chunk ${chunk.id} (pages ${chunk.pageRange}). Plan one with fileName exactly "${chunk.id}.md" in the "documents" folder.`,
    );
  }
  return problems;
}

function findChunksWithoutPlans(pages: PagePlan[], chunks?: Chunk[]): Chunk[] {
  if (!chunks || chunks.length === 0) return [];
  return chunks.filter((chunk) => !pages.some((p) => p.fileName === `${chunk.id}.md`));
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
): PagePlannerOutput {
  const taxonomy = normalizeEntityTaxonomy(output.entityTaxonomy, entities);

  const pages = output.pages
    .map((p) => normalizePagePlan(p, entities, taxonomy))
    .filter(Boolean) as PagePlan[];

  const folderPlacements = Array.isArray(output.folderPlacements) ? output.folderPlacements : [];

  return {
    pages,
    folderPlacements,
    entityTaxonomy: taxonomy,
    wikilinks: Array.isArray(output.wikilinks) ? output.wikilinks : [],
    citations: Array.isArray(output.citations) ? output.citations : [],
    discovery: output.discovery,
  };
}

function normalizeEntityTaxonomy(
  taxonomy: unknown,
  entities: ExtractedEntity[],
): EntityTaxonomy {
  const fallback = buildTypeBasedTaxonomy(entities);
  if (!taxonomy || typeof taxonomy !== 'object') {
    return fallback;
  }
  const t = taxonomy as Record<string, unknown>;
  const rawSubFolders = Array.isArray(t.subFolders) ? t.subFolders : [];
  const rawAssignments = t.assignments && typeof t.assignments === 'object' ? (t.assignments as Record<string, unknown>) : {};

  const subFolders: EntitySubFolder[] = [];
  for (const raw of rawSubFolders) {
    if (typeof raw !== 'object' || raw === null) continue;
    const s = raw as Record<string, unknown>;
    const slug = typeof s.slug === 'string' ? slugify(s.slug) : '';
    const title = typeof s.title === 'string' ? s.title.trim() : slug;
    const description = typeof s.description === 'string' ? s.description.trim() : '';
    if (!slug) continue;
    if (!subFolders.some((f) => f.slug === slug)) {
      subFolders.push({ slug, title, description });
    }
  }

  const assignments: Record<string, string> = {};
  for (const [entitySlug, folderSlug] of Object.entries(rawAssignments)) {
    const canonical = slugify(entitySlug);
    const folder = typeof folderSlug === 'string' ? slugify(folderSlug) : '';
    if (!canonical || !folder) continue;
    assignments[canonical] = folder;
    if (!subFolders.some((f) => f.slug === folder)) {
      subFolders.push({ slug: folder, title: folder, description: `${folder} entities.` });
    }
  }

  // Ensure every known entity has an assignment, falling back to its type.
  for (const entity of entities) {
    const canonical = entity.canonical || slugify(entity.name);
    if (!assignments[canonical]) {
      const folder = resolveEntitySubFolder(entity, { subFolders, assignments });
      assignments[canonical] = folder;
    }
  }

  // If the LLM returned no usable sub-folders at all, use the type-based fallback.
  if (subFolders.length === 0) {
    return fallback;
  }

  return { subFolders, assignments };
}

function normalizePagePlan(page: unknown, _entities: ExtractedEntity[], _taxonomy: EntityTaxonomy): PagePlan | undefined {
  if (typeof page !== 'object' || page === null) return undefined;
  const p = page as Record<string, unknown>;
  if (typeof p.title !== 'string' || p.title.trim() === '') return undefined;
  if (typeof p.fileName !== 'string' || p.fileName.trim() === '') return undefined;
  if (typeof p.folder !== 'string' || p.folder.trim() === '') return undefined;

  const pageType = typeof p.pageType === 'string' ? p.pageType.trim() : 'document';
  if (pageType === '') return undefined;
  const title = p.title.trim();

  // The LLM PagePlanner is the sole authority over which pages exist (vision
  // 02 §4, 04 §4.4.5). Deterministic code validates structure only; quality
  // objections (generic topics, entity duplicates) belong to the Critic loop,
  // not silent deterministic filtering.
  const tags = Array.isArray(p.tags) ? p.tags.filter((t): t is string => typeof t === 'string') : [];
  const citations = Array.isArray(p.citations) ? p.citations.filter((c): c is string => typeof c === 'string') : [];
  const wikilinks = Array.isArray(p.wikilinks) ? p.wikilinks.filter((w): w is string => typeof w === 'string') : [];
  // `related` is LLM-authored plan metadata; never fabricate it deterministically.
  const related = Array.isArray(p.related) ? p.related.filter((r): r is string => typeof r === 'string') : [];

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
  chunks?: Chunk[],
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

  if (chunks && chunks.length > 0) {
    lines.push('## Chunks to plan');
    lines.push('Plan at least one document page for EACH chunk below.');
    lines.push('The document page fileName MUST be exactly the chunk id plus ".md" (shown per chunk) and its folder MUST be "documents".');
    for (const chunk of chunks) {
      lines.push(`- chunk id: ${chunk.id} — pages ${chunk.pageRange} — title: ${chunk.title} — required fileName: "${chunk.id}.md"`);
    }
    lines.push('');
  }

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
    lines.push('No existing hierarchy yet. Start from the default folders: documents, sources, topics, entities, raw.');
    lines.push('IMPORTANT: you must still list EVERY folder the wiki uses (including these defaults) in the `folderPlacements` array of your JSON output; an empty folderPlacements is invalid.');
  }
  lines.push('');

  lines.push('## Existing entity taxonomy');
  if (memory && memory.state.entityTaxonomy && memory.state.entityTaxonomy.subFolders.length > 0) {
    for (const sub of memory.state.entityTaxonomy.subFolders) {
      lines.push(`- ${sub.slug}: ${sub.title} — ${sub.description}`);
    }
  } else {
    lines.push('No existing entity taxonomy. Propose a custom set of sub-folders for the entities/ folder.');
  }
  lines.push('');

  lines.push('## Structural rules');
  lines.push('');
  lines.push('- New page types inside existing folders are allowed; document them in the folder-level index.md contract.');
  lines.push('- You have sole authority over the folder structure. To create a new folder or reorganize the wiki, include the new or changed folder in `folderPlacements` with a clear title and description.');
  lines.push('- Structural changes are applied autonomously and recorded in a structural-change log for after-the-fact human review; no approval is needed.');
  lines.push('- If a page does not fit any existing folder, add the folder it needs to `folderPlacements` and place the page there.');
  lines.push('');
  lines.push('## Entity taxonomy rules');
  lines.push('');
  lines.push('The entities/ folder is split into sub-folders. Propose a small taxonomy that fits the corpus.');
  lines.push('Each sub-folder has a slug, a title, and a short description.');
  lines.push('Every entity must be assigned to exactly one sub-folder by its canonical slug.');
  lines.push('Prefer the existing taxonomy above; only introduce new sub-folders for genuinely new groups.');
  lines.push('Return the taxonomy in the `entityTaxonomy` field of the JSON output.');
  lines.push('');
  return lines.join('\n');
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
  chunk?: Chunk,
  config?: Config,
): Promise<CriticReview> {
  if (!llmClient.isEnabled()) {
    throw new CLIError('LLM is required for critic review.');
  }

  const context = buildCriticContext(result, pages, folderPlacements, agentsMd, memory, pageUpdates, chunk, config);
  const parsed = await callAgentWithRepair<CriticReview>(
    'Critic',
    buildPrompt('critic', context),
    llmClient,
    8500,
    0.2,
    (text) => {
      const p = parseStructuredJson<CriticReview>(text);
      if (!p || !isValidCriticReview(p)) return undefined;
      return {
        approved: typeof p.approved === 'boolean' ? p.approved : p.issues.length === 0,
        issues: Array.isArray(p.issues) ? p.issues : [],
        confidence: p.confidence,
        checks: Array.isArray(p.checks) ? p.checks : [],
        blockingIssues: Array.isArray(p.blockingIssues) ? p.blockingIssues : [],
      };
    },
  );
  return parsed;
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
  chunk?: Chunk,
  config?: Config,
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
    // The known-title list must match the one the ChunkWriter was given —
    // including the source page and wiki index titles the writer is
    // explicitly instructed to link — or the Critic flags mandated links as
    // invented and the retry loop can never converge.
    const knownTitles = collectKnownPageTitles(pages);
    knownTitles.sources.push(`Source: ${result.fileName}`);
    if (config) {
      knownTitles.indexes.push(`${config.wiki.title} Index`);
    }
    // Vision 07 §4: the Critic must receive the FULL markdown pages produced
    // by the ChunkWriter (frontmatter and body). Reviewing a truncated preview
    // makes every completeness check a false negative.
    lines.push('## Drafted pages (full content)');
    for (const update of pageUpdates) {
      lines.push(`### ${update.filePath}`);
      lines.push('Frontmatter:');
      lines.push('```json');
      lines.push(JSON.stringify(update.frontmatter ?? {}, null, 2));
      lines.push('```');
      lines.push('Body:');
      lines.push('```markdown');
      lines.push(String(update.body ?? ''));
      lines.push('```');
      const unknown = findUnknownWikilinks(String(update.body ?? ''), knownTitles);
      if (unknown.length > 0) {
        lines.push(`Wikilinks not matching known pages: ${unknown.join(', ')}`);
      }
      lines.push('');
    }
    lines.push('## Known page titles');
    lines.push('Only the following exact titles are valid wikilink targets for this review:');
    for (const title of [...knownTitles.entities, ...knownTitles.topics, ...knownTitles.sources, ...knownTitles.indexes]) {
      lines.push(`- [[${title}]]`);
    }
    lines.push('');
  }

  // Vision 07 §4: the Critic receives the extracted input for the chunk under
  // review so completeness can actually be judged.
  if (chunk) {
    lines.push(`## Extracted input for chunk ${chunk.id} (pages ${chunk.pageRange})`);
    lines.push(chunk.content);
    lines.push('');
  } else {
    lines.push('## Source context (truncated)');
    const sourceText = result.pages.map((p) => p.text).join('\n\n');
    lines.push(sourceText.slice(0, 8000).replace(/\s+/g, ' '));
    lines.push('');
  }

  return lines.join('\n');
}

function findUnknownWikilinks(
  body: string,
  knownTitles: { entities: string[]; topics: string[]; sources: string[]; indexes: string[] },
): string[] {
  const known = new Set([
    ...knownTitles.entities,
    ...knownTitles.topics,
    ...knownTitles.sources,
    ...knownTitles.indexes,
  ]);
  const unknown = new Set<string>();
  body.replace(/\[\[[^\]|]+(?:\|[^\]]+)?\]\]/g, (match) => {
    const inner = match.slice(2, -2);
    const [target] = inner.split('|', 2);
    const targetTitle = target.trim();
    if (!known.has(targetTitle)) {
      unknown.add(targetTitle);
    }
    return match;
  });
  return Array.from(unknown);
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
      entityTaxonomy: { subFolders: [], assignments: {} },
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
  entityTaxonomy?: EntityTaxonomy,
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

  // Update entity taxonomy if a new one was proposed.
  if (entityTaxonomy) {
    mergeEntityTaxonomy(memory, entityTaxonomy);
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

export function mergeEntityTaxonomy(
  memory: OrchestratorMemory,
  incoming: EntityTaxonomy,
): void {
  const existing = memory.state.entityTaxonomy;
  for (const sub of incoming.subFolders) {
    if (!existing.subFolders.some((f) => f.slug === sub.slug)) {
      existing.subFolders.push(sub);
    }
  }
  for (const [canonical, folder] of Object.entries(incoming.assignments)) {
    if (!existing.assignments[canonical]) {
      existing.assignments[canonical] = folder;
    }
  }
}

/**
 * Subtract the contributions of a previous ingestion of the same source before
 * reprocessing it chunk-by-chunk. This keeps memory counts consistent when a
 * source is re-ingested or resumed.
 */
export function prepareMemoryForSource(memory: OrchestratorMemory, sourcePath: string): void {
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
  memory.state.sourceEntities[sourcePath] = {};

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
  memory.state.sourceTopics[sourcePath] = {};
}

function relationshipKey(rel: ExtractedRelationship): string {
  return `${rel.subject.toLowerCase()}|${rel.predicate.toLowerCase()}|${rel.object.toLowerCase()}|${rel.pages}`;
}

/**
 * Incrementally update rolling memory with a single chunk's entities, relationships,
 * and topics. This makes earlier chunks visible to relationship extraction for later
 * chunks of the same source.
 */
export function updateMemoryForChunk(
  memory: OrchestratorMemory,
  sourcePath: string,
  entities: ExtractedEntity[],
  relationships: ExtractedRelationship[],
  topics: { name: string; count: number; related: string[] }[],
): void {
  const sourceEntities = memory.state.sourceEntities[sourcePath] ?? {};
  const knownRelationshipKeys = new Set(memory.state.relationships.map(relationshipKey));

  for (const entity of entities) {
    const canonical = entity.canonical || slugify(entity.name);
    sourceEntities[canonical] = (sourceEntities[canonical] ?? 0) + (entity.count ?? 1);

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
      if (existing.name.toLowerCase() !== entity.name.toLowerCase() && !existing.aliases.includes(entity.name)) {
        existing.aliases.push(entity.name);
      }
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
  memory.state.sourceEntities[sourcePath] = sourceEntities;

  for (const rel of relationships) {
    const key = relationshipKey(rel);
    if (!knownRelationshipKeys.has(key)) {
      memory.state.relationships.push(rel);
      knownRelationshipKeys.add(key);
    }

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

  const sourceTopics = memory.state.sourceTopics[sourcePath] ?? {};
  for (const topic of topics) {
    const name = topic.name.toLowerCase();
    sourceTopics[name] = (sourceTopics[name] ?? 0) + topic.count;

    if (!memory.state.topics[name]) {
      memory.state.topics[name] = { tags: ['topic', 'theme'], mentions: [], related: [] };
    }
    memory.state.topics[name].related = [...new Set([...memory.state.topics[name].related, ...topic.related])];
  }
  memory.state.sourceTopics[sourcePath] = sourceTopics;

  memory.rollingSummary = `Updated memory with ${Object.keys(memory.state.entities).length} entities, ${memory.state.relationships.length} relationships, and ${Object.keys(memory.state.topics).length} topics.`;

  flagDuplicateEntities(memory);
}

// ---------- ChunkWriter (Sprint 4b) ----------

/**
 * ChunkWriter: LLM-driven author of markdown content.
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
  if (!llmClient.isEnabled()) {
    throw new CLIError('LLM is required for chunk writing.');
  }

  const chunkTasks = chunks.map((chunk) => async () =>
    chunkWriterForChunk(pages, chunk, result, config, llmClient, agentsMd, memory, feedback),
  );

  return withConcurrencyLimit(chunkTasks, 4);
}

/**
 * ChunkWriter variant for a single chunk. Used by the per-chunk incremental
 * materializer so each chunk is written immediately after it is processed.
 */
export async function chunkWriterForChunk(
  pages: PagePlan[],
  chunk: Chunk,
  result: ExtractionResult,
  config: Config,
  llmClient: LLMClient,
  agentsMd?: string,
  memory?: OrchestratorMemory,
  feedback?: string[],
): Promise<PageUpdate> {
  if (!llmClient.isEnabled()) {
    throw new CLIError('LLM is required for chunk writing.');
  }

  const knownTitles = collectKnownPageTitles(pages);
  knownTitles.sources.push(`Source: ${result.fileName}`);
  knownTitles.indexes.push(`${config.wiki.title} Index`);

  // The LLM PagePlanner is the sole planner of pages; plan completeness for
  // every chunk is validated (with one repair retry) at planning time, so a
  // missing plan here is a defect rather than a condition to paper over with a
  // deterministic default plan.
  const chunkPlan = findPagePlanForChunk(pages, chunk);
  if (!chunkPlan) {
    throw new CLIError(`PagePlanner did not plan a document page for chunk ${chunk.id} ("documents/${chunk.id}.md").`);
  }
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
  // The ChunkWriter's reply embeds the chunk's full preserved extracted detail
  // in a JSON body, so its output budget must comfortably exceed the maximum
  // chunk size. On Kimi, thinking tokens draw from the same budget and can
  // starve or truncate the JSON, so thinking is disabled for this
  // structured-output call.
  // Temperature 0.6: greedy sampling (0.2) is prone to degenerate repetition
  // loops when transcribing wide tables; a moderate temperature breaks the
  // low-entropy attractor while the Critic and deterministic checks gate
  // quality.
  let parsed = await callAgentWithRepair<{ pages: unknown[] }>(
    'ChunkWriter',
    prompt,
    llmClient,
    32000,
    0.6,
    parseChunkWriterJson,
    structuredOutputOptions(llmClient),
  );
  if (!parsed.pages.length) {
    throw new CLIError('ChunkWriter returned invalid output.');
  }

  try {
    const normalized = normalizePageUpdate(parsed.pages[0], result, config, knownTitles);
    return { ...enforceSourceProvenance(normalized, chunk, result), filePath: `documents/${chunk.id}.md` };
  } catch (validationError) {
    const validationMessage = validationError instanceof CLIError ? validationError.message : String(validationError);
    const repairPrompt = `${prompt}\n\n---\n\nYour previous response failed validation: ${validationMessage}. Please fix the issues and return ONLY a valid JSON object matching the requested schema. Required frontmatter fields must be authored by the LLM and must not be omitted.`;
    const repairResponse = await llmClient.call(repairPrompt, { maxTokens: 32000, temperature: 0.6, ...structuredOutputOptions(llmClient) });
    const repaired = parseChunkWriterJson(repairResponse.text);
    if (!repaired || !repaired.pages.length) {
      throw new CLIError(`ChunkWriter returned invalid page output after one repair attempt: ${validationMessage}`);
    }
    const normalized = normalizePageUpdate(repaired.pages[0], result, config, knownTitles);
    return { ...enforceSourceProvenance(normalized, chunk, result), filePath: `documents/${chunk.id}.md` };
  }
}

/**
 * Deterministic provenance enforcement for document-page sources entries.
 *
 * The authority matrix assigns extraction, hashing, and file I/O to
 * deterministic code: the LLM cannot know the true on-disk path or hash of the
 * chunk's source PDF (it only ever sees extracted text), so those values are
 * set from the extractor's ground truth. The LLM remains the sole author of
 * the citations themselves — which claims carry which [^srcN] markers and the
 * page sub-ranges they refer to.
 */
function enforceSourceProvenance(update: PageUpdate, chunk: Chunk, result: ExtractionResult): PageUpdate {
  const trueFile = chunk.sources[0]?.file ?? result.filePath;
  const trueSha = chunk.sources[0]?.sha256 ?? result.sha256;
  const sources = Array.isArray(update.frontmatter.sources)
    ? (update.frontmatter.sources as Record<string, unknown>[]).map((entry) => ({
        ...entry,
        file: trueFile,
        ...(trueSha ? { sha256: trueSha } : {}),
      }))
    : update.frontmatter.sources;
  return { ...update, frontmatter: { ...update.frontmatter, sources } };
}

/**
 * SourcePageWriter: LLM-driven author of source catalog page bodies.
 */
export async function sourcePageWriter(
  result: ExtractionResult,
  documentLinks: { title: string; pageRange: string }[],
  rawLinks: { title: string; physicalPage: number }[],
  config: Config,
  llmClient: LLMClient,
  agentsMd?: string,
  memory?: OrchestratorMemory,
): Promise<SourcePageWriterOutput> {
  if (!llmClient.isEnabled()) {
    return { body: buildDefaultSourcePageBody(result, documentLinks, rawLinks) };
  }

  const context = buildSourcePageWriterContext(result, documentLinks, rawLinks, config, agentsMd, memory);
  const parsed = await callAgentWithRepair<{ body: string }>(
    'SourcePageWriter',
    buildPrompt('source-page-writer', context),
    llmClient,
    4000,
    0.2,
    (text) => {
      const p = parseStructuredJson<{ body?: string }>(text);
      return p && typeof p.body === 'string' ? (p as { body: string }) : undefined;
    },
  );
  return { body: parsed.body };
}

function buildSourcePageWriterContext(
  result: ExtractionResult,
  documentLinks: { title: string; pageRange: string }[],
  rawLinks: { title: string; physicalPage: number }[],
  config: Config,
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
  lines.push(`- file: ${result.filePath}`);
  lines.push(`- filename: ${result.fileName}`);
  lines.push(`- pages: ${result.logicalPages} logical / ${result.physicalPages} physical`);
  lines.push(`- tables: ${result.hasTables ? 'yes' : 'no'}`);
  lines.push(`- figures: ${result.hasFigures ? 'yes' : 'no'}`);
  lines.push(`- scanned: ${result.isScanned ? 'yes' : 'no'}`);
  lines.push(`- size: ${result.sizeBytes} bytes`);
  lines.push(`- ingested: ${result.ingested}`);
  lines.push('');

  lines.push('## Document pages');
  for (const link of documentLinks) {
    lines.push(`- [[${link.title}]] — pages ${link.pageRange}`);
  }
  if (documentLinks.length === 0) {
    lines.push('- No document pages generated.');
  }
  lines.push('');

  lines.push('## Raw pages');
  for (const link of rawLinks) {
    lines.push(`- [[${link.title}]] — page ${link.physicalPage}`);
  }
  if (rawLinks.length === 0) {
    lines.push('- No raw pages generated.');
  }
  lines.push('');

  lines.push('## Wiki');
  lines.push(`- slug: ${config.wiki.slug}`);
  lines.push(`- title: ${config.wiki.title}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * RawPageWriter: LLM-driven author of raw page bodies for scanned/unparseable pages.
 */
export async function rawPageWriter(
  result: ExtractionResult,
  page: ExtractedPage,
  config: Config,
  llmClient: LLMClient,
  agentsMd?: string,
  memory?: OrchestratorMemory,
): Promise<RawPageWriterOutput> {
  if (!llmClient.isEnabled()) {
    return { body: buildDefaultRawPageBody(result, page) };
  }

  const context = buildRawPageWriterContext(result, page, config, agentsMd, memory);
  const parsed = await callAgentWithRepair<{ body: string }>(
    'RawPageWriter',
    buildPrompt('raw-page-writer', context),
    llmClient,
    4000,
    0.2,
    (text) => {
      const p = parseStructuredJson<{ body?: string }>(text);
      return p && typeof p.body === 'string' ? (p as { body: string }) : undefined;
    },
  );
  return { body: parsed.body };
}

function buildRawPageWriterContext(
  result: ExtractionResult,
  page: ExtractedPage,
  config: Config,
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
  lines.push(`- file: ${result.filePath}`);
  lines.push(`- filename: ${result.fileName}`);
  lines.push('');

  lines.push(`## Page ${page.physicalPage}`);
  lines.push(`- reason: Image-only or scanned page; text extraction confidence below threshold`);
  lines.push(`- extracted text:`);
  lines.push(page.text.trim().length > 0 ? page.text : '*No text available*');
  lines.push('');

  lines.push('## Wiki');
  lines.push(`- slug: ${config.wiki.slug}`);
  lines.push(`- title: ${config.wiki.title}`);
  lines.push('');

  return lines.join('\n');
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

function findPagePlanForChunk(pages: PagePlan[], chunk: Chunk): PagePlan | undefined {
  const fileName = `${chunk.id}.md`;
  return pages.find((p) => p.fileName === fileName);
}

function collectKnownPageTitles(pages: PagePlan[]): { entities: string[]; topics: string[]; sources: string[]; indexes: string[] } {
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

  return { entities: Array.from(entities), topics: Array.from(topics), sources: [], indexes: [] };
}

function buildChunkWriterPrompt(
  pages: PagePlan[],
  chunks: Chunk[],
  result: ExtractionResult,
  config: Config,
  agentsMd?: string,
  memory?: OrchestratorMemory,
  knownTitles?: { entities: string[]; topics: string[]; sources: string[]; indexes: string[] },
  feedback?: string[],
): string {
  const lines: string[] = [
    'You are the ChunkWriter agent for a PDF-to-wiki CLI.',
    'Write the markdown content for the planned document pages below.',
    'Return ONLY a JSON object matching the schema at the end.',
    '',
    'Rules:',
    '- Begin each document page with a brief LLM-written synthesis / summary. Every factual statement in the synthesis must carry an inline [^srcN] citation.',
    '- The frontmatter `title` must exactly match the page plan title shown in the "Page plan" section.',
    '- Add key claims extracted from the chunk, each with an inline [^srcN] citation.',
    '- Link named entities to their canonical pages using the exact page title: [[Entity: Name]] or [[Topic: Name]].',
    '- ONLY link to entity/topic pages listed in the "Known pages" section below. If a name or concept is not in that list, write it as plain text WITHOUT brackets — never invent a wikilink for it.',
    '- Wikilink format: [[Exact Title]] or, when you need different display text, [[Exact Title|display text]]. The part BEFORE the pipe must be an exact title from the Known pages list.',
    '- Before returning, scan your body once more: every [[...]] target (the text before any pipe) must exactly match a Known pages title.',
    '- Mention any preserved tables or figures briefly in the synthesis area, with Source: [^srcN].',
    '- Preserve the original extracted text by including it in a "## Preserved Extracted Detail" section at the end of the body: copy the chunk text VERBATIM, exactly as supplied (organized under per-page headings is fine).',
    '- In Preserved Extracted Detail, do NOT convert the extracted text into markdown pipe tables — copy tabular text verbatim as plain text. This preserves every row and value by construction.',
    '- You MAY additionally render a small, simple table (fewer than 8 columns) as a clean markdown table in the synthesis area when it aids readability, but wide or noisy tables must stay verbatim-only.',
    '- NEVER emit runs of empty table cells, empty rows, or repeated separator cells (like "| | | |" or "--- | --- | ---"). If you notice yourself repeating any pattern, stop immediately and continue with the next real content.',
    '- Multi-source claims cite all sources: [^src1] [^src2].',
    '- Scanned or unparseable pages: do not make claims, or mark them as needing verification.',
    '- Confidence may be high, medium, or low.',
    '- Tags should be lowercase, hyphenated, and drawn from the corpus vocabulary.',
    '',
    'Required frontmatter fields (omitting ANY of these causes your output to be rejected):',
    '- title: non-empty string.',
    '- type: exactly "document".',
    '- wiki: the wiki slug shown below.',
    '- tags: non-empty array of lowercase strings.',
    '- confidence: exactly one of "high", "medium", "low".',
    '- created and updated: ISO 8601 timestamps.',
    '- sources: non-empty array; EVERY entry must include "id", "file", and "pages". The "file" value MUST be copied VERBATIM from the "- file:" line of the "## Source PDF" section below — never invent, shorten, or re-slug the path.',
    '- The "id" values (src1, src2, ...) are the join keys for inline [^srcN] citations: every [^srcN] marker in the body MUST match a sources entry with id "srcN".',
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

  if (
    knownTitles &&
    (knownTitles.entities.length > 0 ||
      knownTitles.topics.length > 0 ||
      knownTitles.sources.length > 0 ||
      knownTitles.indexes.length > 0)
  ) {
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
    if (knownTitles.sources.length > 0) {
      lines.push('');
      lines.push('Sources:');
      for (const title of knownTitles.sources) {
        lines.push(`- [[${title}]]`);
      }
    }
    if (knownTitles.indexes.length > 0) {
      lines.push('');
      lines.push('Wiki indexes:');
      for (const title of knownTitles.indexes) {
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
    lines.push(chunk.content);
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
  knownTitles?: { entities: string[]; topics: string[]; sources: string[]; indexes: string[] },
): PageUpdate {
  if (typeof page !== 'object' || page === null) {
    throw new CLIError('ChunkWriter page is not an object.');
  }
  const p = page as Record<string, unknown>;
  if (typeof p.filePath !== 'string' || p.filePath.trim() === '') {
    throw new CLIError('ChunkWriter page missing or invalid filePath.');
  }
  if (typeof p.body !== 'string' || p.body.trim() === '') {
    throw new CLIError('ChunkWriter page missing or invalid body.');
  }
  const frontmatter = (typeof p.frontmatter === 'object' && p.frontmatter !== null)
    ? (p.frontmatter as Record<string, unknown>)
    : {};

  // Reject frontmatter that explicitly claims an invalid page type for a document page.
  if (frontmatter.type && frontmatter.type !== 'document') {
    throw new CLIError(`ChunkWriter page has invalid type: ${String(frontmatter.type)}`);
  }

  // Required fields must be authored by the LLM; do not fall back to deterministic values.
  const validation = validateFrontmatter(frontmatter);
  if (!validation.valid) {
    const issues = validation.issues.map((i) => `${i.field}: ${i.message}`).join('; ');
    throw new CLIError(`ChunkWriter page failed frontmatter validation: ${issues}`);
  }

  // Citation integrity joins [^srcN] markers to sources entries by id; an entry
  // without an id silently breaks every citation on the page.
  if (Array.isArray(frontmatter.sources)) {
    for (let i = 0; i < frontmatter.sources.length; i++) {
      const entry = frontmatter.sources[i] as Record<string, unknown>;
      if (typeof entry?.id !== 'string' || entry.id.trim() === '') {
        throw new CLIError(`ChunkWriter page sources entry ${i + 1} is missing the required "id" (e.g., "src1").`);
      }
    }
  }

  return {
    filePath: p.filePath,
    frontmatter,
    body: p.body,
    citations: Array.isArray(p.citations) ? (p.citations as { claim: string; sources: string[] }[]) : undefined,
  };
}

function formatMentionSources(
  mentions: { source: string; filePath?: string; pages: string }[],
): string[] {
  const seen = new Map<string, string>();
  for (const mention of mentions) {
    if (!mention.filePath) continue;
    if (seen.has(mention.filePath)) {
      const existing = seen.get(mention.filePath)!;
      seen.set(mention.filePath, `${existing}, ${mention.pages}`);
    } else {
      seen.set(mention.filePath, mention.pages);
    }
  }
  let index = 0;
  const lines: string[] = [];
  for (const [file, pages] of seen) {
    lines.push(`  - src${++index}: ${file}, pages ${pages}`);
  }
  return lines;
}

export interface EntityTopicPageOutput {
  entities: { name: string; body: string; tags: string[] }[];
  topics: { name: string; body: string; tags: string[]; related: string[] }[];
}

export interface EntityTopicPageInputEntity {
  name: string;
  type: EntityMention['type'];
  count: number;
  mentions: EntityMentionLocation[];
  description?: string;
  relationships?: EntityMention['relationships'];
  /** If provided, the LLM must preserve all existing information while updating. */
  existingBody?: string;
  /** Optional explicit source list; if omitted, sources are derived from mentions. */
  sources?: { id: string; file: string; pages: string; extracted: string }[];
}

export interface EntityTopicPageInputTopic {
  name: string;
  count: number;
  mentions: TopicMentionLocation[];
  related: string[];
  /** If provided, the LLM must preserve all existing information while updating. */
  existingBody?: string;
  /** Optional explicit source list; if omitted, sources are derived from mentions. */
  sources?: { id: string; file: string; pages: string; extracted: string }[];
}

export async function entityTopicPageWriter(
  entities: EntityTopicPageInputEntity[],
  topics: EntityTopicPageInputTopic[],
  config: Config,
  llmClient: LLMClient,
  agentsMd?: string,
  memory?: OrchestratorMemory,
  knownEntities?: EntityTopicPageInputEntity[],
  knownTopics?: EntityTopicPageInputTopic[],
  feedback?: string,
): Promise<EntityTopicPageOutput> {
  if (!llmClient.isEnabled()) {
    throw new CLIError('LLM is required for entity and topic page writing.');
  }
  if (entities.length === 0 && topics.length === 0) {
    return { entities: [], topics: [] };
  }

  const prompt = buildEntityTopicWriterPrompt(
    entities,
    topics,
    config,
    agentsMd,
    memory,
    knownEntities,
    knownTopics,
    feedback,
  );
  // Update-mode rewrites must return every existing body plus new evidence for
  // a whole batch of pages, so the output budget mirrors the ChunkWriter's,
  // and provider thinking is likewise disabled for this structured output.
  const parsed = await callAgentWithRepair<EntityTopicPageOutput>(
    'EntityTopicPageWriter',
    prompt,
    llmClient,
    32000,
    0.2,
    parseEntityTopicWriterJson,
    structuredOutputOptions(llmClient),
  );
  if (parsed.entities.length === 0 && parsed.topics.length === 0) {
    throw new CLIError('EntityTopicPageWriter returned invalid or empty output.');
  }
  return parsed;
}
function buildEntityTopicWriterPrompt(
  entities: EntityTopicPageInputEntity[],
  topics: EntityTopicPageInputTopic[],
  config: Config,
  agentsMd?: string,
  _memory?: OrchestratorMemory,
  knownEntities?: EntityTopicPageInputEntity[],
  knownTopics?: EntityTopicPageInputTopic[],
  feedback?: string,
): string {
  const lines: string[] = [
    'You are the EntityTopicPageWriter agent for a PDF-to-wiki CLI.',
    'Write LLM-authored markdown bodies for the entity and topic pages below.',
    'Return ONLY a JSON object matching the schema at the end.',
    '',
    'Rules for entity pages:',
    '- Start with a brief synthesis of what the entity is and why it matters in the corpus.',
    '- Include a Description section if a description is provided.',
    '- Include a Relationships section if relationships are provided; otherwise omit it.',
    '- Include an Appearances section listing the source files and page ranges where the entity occurs.',
    '- Cite sources using inline [^srcN] markers that match the source entries shown below each entity/topic.',
    '- Use the exact source id (src1, src2, etc.) provided in the source list.',
    '- Link to other entity pages using [[Entity: Name]] and topic pages using [[Topic: Name]].',
    '- Only link to names that appear in the "Known entities" or "Known topics" lists below, using the EXACT titles as shown there (including capitalization).',
    '- End with a link to the wiki index: [[' + config.wiki.title + ' Index]].',
    '',
    'Rules for topic pages:',
    '- Start with a brief synthesis of the topic and its significance in the corpus.',
    '- Include an Appearances section listing the source files and page ranges where the topic occurs.',
    '- Include a Related section if related topics/entities are provided; otherwise omit it.',
    '- Cite sources using inline [^srcN] markers matching the source entries shown below each topic.',
    '- Use the exact source id (src1, src2, etc.) provided in the source list.',
    '- End with a link to the wiki index: [[' + config.wiki.title + ' Index]].',
    '',
    'Update mode (when an existing body is provided):',
    '- The existing body is shown verbatim under each entity/topic.',
    '- Preserve every existing fact, citation, section, sentence, and detail.',
    '- Add the new information from the supplied data to the relevant sections.',
    '- You may rephrase for coherence, but you must NOT remove any existing information, not even a minor detail.',
    '- If the existing body already contains an Appearances, Relationships, or Related section, extend it with the new data rather than replacing it.',
    '',
    'Format requirements:',
    '- The body must be valid markdown.',
    '- Do NOT wrap the body in a markdown code block inside the JSON string.',
    '- Keep the body concise but informative; do not invent facts not supported by the supplied data.',
    '',
    'Frontmatter fields you must author (omitting these causes your output to be rejected):',
    '- tags (entities AND topics): 3-6 lowercase, hyphenated, corpus-specific tags describing the role or theme (e.g., ["board-member", "governance", "audit-committee"]). Never use generic filler like "entity", "topic", or "theme".',
    '- related (topics only): a list of related page titles or relative paths drawn from the known entities/topics and supplied related data. May be empty ONLY if nothing related exists.',
    '',
    'JSON schema:',
    '{',
    '  "entities": [',
    '    { "name": "Exact Entity Name", "body": "# Entity: ...\\n\\n...", "tags": ["corpus-specific-tag"] }',
    '  ],',
    '  "topics": [',
    '    { "name": "Exact Topic Name", "body": "# Topic: ...\\n\\n...", "tags": ["corpus-specific-tag"], "related": ["Entity: Name"] }',
    '  ]',
    '}',
    '',
  ];

  if (feedback && feedback.trim().length > 0) {
    lines.push('## Feedback from previous attempt');
    lines.push('Address the following issue in your revised output:');
    lines.push(feedback);
    lines.push('');
  }

  if (agentsMd) {
    lines.push('## Wiki ingestion guide (AGENTS.md)');
    lines.push(agentsMd);
    lines.push('');
  }

  const knownEntityList = knownEntities ?? entities;
  const knownTopicList = knownTopics ?? topics;

  if (knownEntityList.length > 0) {
    lines.push('## Known entities');
    for (const entity of knownEntityList) {
      lines.push(`- Entity: ${entity.name} (${entity.type}, mentions: ${entity.count})`);
    }
    lines.push('');
  }

  if (knownTopicList.length > 0) {
    lines.push('## Known topics');
    for (const topic of knownTopicList) {
      // Present the exact page title (title-cased) so wikilinks written from
      // this list resolve against the real topic pages.
      lines.push(`- ${topicPageTitle({ name: topic.name, count: topic.count })} (mentions: ${topic.count})`);
    }
    lines.push('');
  }

  if (entities.length > 0) {
    lines.push('## Entity data');
    for (const entity of entities) {
      lines.push(`### Entity: ${entity.name}`);
      lines.push(`- type: ${entity.type}`);
      lines.push(`- mentions: ${entity.count}`);
      lines.push(`- description: ${entity.description || '(none)'}`);
      if (entity.existingBody) {
        lines.push('- existing body (preserve all of this, including every citation and wikilink):');
        lines.push('  ```markdown');
        for (const line of entity.existingBody.split('\n')) {
          lines.push(`  ${line}`);
        }
        lines.push('  ```');
      }
      if (entity.relationships && entity.relationships.length > 0) {
        lines.push('- relationships:');
        for (const rel of entity.relationships) {
          lines.push(`  - ${entity.name} ${rel.predicate} ${rel.object} — ${rel.evidence} (${rel.pages})`);
        }
      }
      lines.push('- appearances:');
      for (const m of entity.mentions) {
        lines.push(`  - ${m.source}, pages ${m.pages}`);
      }
      const entitySourceLines = entity.sources
        ? formatExplicitSources(entity.sources)
        : formatMentionSources(entity.mentions);
      if (entitySourceLines.length > 0) {
        lines.push('- sources (preserve existing ids; use them exactly in citations):');
        lines.push(...entitySourceLines);
      }
      lines.push('');
    }
  }

  if (topics.length > 0) {
    lines.push('## Topic data');
    for (const topic of topics) {
      lines.push(`### Topic: ${topic.name}`);
      lines.push(`- mentions: ${topic.count}`);
      lines.push(`- related: ${topic.related.join(', ') || '(none)'}`);
      if (topic.existingBody) {
        lines.push('- existing body (preserve all of this, including every citation and wikilink):');
        lines.push('  ```markdown');
        for (const line of topic.existingBody.split('\n')) {
          lines.push(`  ${line}`);
        }
        lines.push('  ```');
      }
      lines.push('- appearances:');
      for (const m of topic.mentions) {
        lines.push(`  - ${m.source}, pages ${m.pages}`);
      }
      const topicSourceLines = topic.sources
        ? formatExplicitSources(topic.sources)
        : formatMentionSources(topic.mentions);
      if (topicSourceLines.length > 0) {
        lines.push('- sources (preserve existing ids; use them exactly in citations):');
        lines.push(...topicSourceLines);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function formatExplicitSources(
  sources: { id: string; file: string; pages: string; extracted: string }[],
): string[] {
  return sources.map((s) => `  - ${s.id}: ${s.file}, pages ${s.pages}`);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function parseEntityTopicWriterJson(text: string): EntityTopicPageOutput | undefined {
  const parsed = parseStructuredJson(text) as Partial<EntityTopicPageOutput>;
  if (!parsed) return undefined;
  const entities = Array.isArray(parsed.entities) ? parsed.entities : [];
  const topics = Array.isArray(parsed.topics) ? parsed.topics : [];
  // Entries without LLM-authored tags (and, for topics, a related list) are
  // invalid: the downstream completeness check treats them as missing pages
  // and triggers the stricter repair prompt. Deterministic code never
  // fabricates these frontmatter fields.
  return {
    entities: entities
      .filter(
        (e: Record<string, unknown>) =>
          typeof e.name === 'string' &&
          typeof e.body === 'string' &&
          isStringArray(e.tags) &&
          (e.tags as string[]).length > 0,
      )
      .map((e: Record<string, unknown>) => ({
        name: e.name as string,
        body: e.body as string,
        tags: e.tags as string[],
      })),
    topics: topics
      .filter(
        (t: Record<string, unknown>) =>
          typeof t.name === 'string' &&
          typeof t.body === 'string' &&
          isStringArray(t.tags) &&
          (t.tags as string[]).length > 0 &&
          isStringArray(t.related),
      )
      .map((t: Record<string, unknown>) => ({
        name: t.name as string,
        body: t.body as string,
        tags: t.tags as string[],
        related: t.related as string[],
      })),
  };
}
