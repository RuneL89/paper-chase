import { readFileSync, existsSync, writeFileSync } from 'fs';
import path from 'path';
import { CLIError } from './errors.js';
import { wikiPath } from './workspace.js';

export interface WikiConfig {
  slug: string;
  title: string;
  description: string;
  version: string;
}

export interface SchemaConfig {
  wiki_index_md: string;
  chunking_strategy_md: string;
}

export interface ChunkingConfig {
  max_chunk_size: number;
  min_chunk_size: number;
  split_boundary: string;
  never_split: string[];
  overlap: number;
}

export interface ExtractionConfig {
  engine: string;
  ocr_enabled: boolean;
  page_range: string | null;
}

export interface OutputConfig {
  dir: string;
  page_types: string[];
}

export interface IngestionConfig {
  entity_threshold: number;
  topic_threshold: number;
  max_entities: number;
  max_topics: number;
}

export interface Config {
  wiki: WikiConfig;
  schema: SchemaConfig;
  chunking: ChunkingConfig;
  extraction: ExtractionConfig;
  output: OutputConfig;
  ingestion: IngestionConfig;
  status: string;
}

export const defaultConfig: Config = {
  wiki: {
    slug: '',
    title: '',
    description: '',
    version: '1.0',
  },
  schema: {
    wiki_index_md: 'index.md',
    chunking_strategy_md: 'chunking-strategy.md',
  },
  chunking: {
    max_chunk_size: 100000,
    min_chunk_size: 1000,
    split_boundary: 'page',
    never_split: ['table', 'figure_with_caption', 'multi_page_footnote'],
    overlap: 0,
  },
  extraction: {
    engine: 'pdfjs-dist',
    ocr_enabled: true,
    page_range: null,
  },
  output: {
    dir: 'output',
    page_types: ['index', 'source', 'document', 'topic', 'entity', 'raw'],
  },
  ingestion: {
    entity_threshold: 2,
    topic_threshold: 2,
    max_entities: 50,
    max_topics: 50,
  },
  status: 'draft',
};

export function buildConfig(
  workspace: string,
  slug: string,
  title?: string,
  description?: string,
): Config {
  let config = deepClone(defaultConfig);
  config.wiki.slug = slug;
  config.wiki.title = title ?? slugToTitle(slug);
  config.wiki.description = description ?? `Wiki for ${slug}`;
  config.wiki.version = '1.0';

  const workspaceConfigPath = path.join(workspace, '.kimi-code', 'config.json');
  if (existsSync(workspaceConfigPath)) {
    const workspaceConfig = parseJsonFile(workspaceConfigPath);
    config = mergeConfig(config, workspaceConfig);
  }

  return config;
}

export function loadConfig(workspace: string, slug: string): Config {
  if (!existsSync(workspace)) {
    throw new CLIError(`Workspace not found: ${workspace}. Please create the workspace directory first.`);
  }

  let config = deepClone(defaultConfig);

  const workspaceConfigPath = path.join(workspace, '.kimi-code', 'config.json');
  if (existsSync(workspaceConfigPath)) {
    const workspaceConfig = parseJsonFile(workspaceConfigPath);
    config = mergeConfig(config, workspaceConfig);
  }

  const wikiConfigPath = path.join(wikiPath(workspace, slug), 'config.json');
  if (existsSync(wikiConfigPath)) {
    const wikiConfig = parseJsonFile(wikiConfigPath);
    config = mergeConfig(config, wikiConfig);
  } else {
    throw new CLIError(
      `Wiki "${slug}" does not have a config.json. ` +
      `Create one by running: llm-wiki-cli sample ${slug} <path-to-pdf>`,
    );
  }

  validateConfig(config);
  return config;
}

export function saveConfig(workspace: string, slug: string, config: Config): void {
  const configPath = path.join(wikiPath(workspace, slug), 'config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

function slugToTitle(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const requiredPaths: { path: string[]; label: string }[] = [
  { path: ['wiki', 'slug'], label: 'wiki.slug' },
  { path: ['wiki', 'title'], label: 'wiki.title' },
  { path: ['wiki', 'description'], label: 'wiki.description' },
  { path: ['wiki', 'version'], label: 'wiki.version' },
  { path: ['chunking', 'max_chunk_size'], label: 'chunking.max_chunk_size' },
  { path: ['chunking', 'min_chunk_size'], label: 'chunking.min_chunk_size' },
  { path: ['chunking', 'split_boundary'], label: 'chunking.split_boundary' },
  { path: ['extraction', 'engine'], label: 'extraction.engine' },
  { path: ['output', 'dir'], label: 'output.dir' },
  { path: ['output', 'page_types'], label: 'output.page_types' },
  { path: ['status'], label: 'status' },
];
function parseJsonFile(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new CLIError(`Could not parse config file ${filePath}: ${reason}`);
  }
}

function mergeConfig(base: Config, override: unknown): Config {
  return deepMerge(base, override) as Config;
}

function deepMerge(base: unknown, override: unknown): unknown {
  if (typeof override !== 'object' || override === null) {
    return base;
  }
  if (typeof base !== 'object' || base === null) {
    return override;
  }
  if (Array.isArray(override)) {
    return override;
  }
  if (Array.isArray(base)) {
    return override;
  }
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (key in result && typeof result[key] === 'object' && result[key] !== null && typeof value === 'object' && value !== null) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function validateConfig(config: Config): void {
  const missing: string[] = [];
  for (const { path: p, label } of requiredPaths) {
    let current: unknown = config;
    for (const key of p) {
      if (current === null || typeof current !== 'object' || !(key in (current as Record<string, unknown>))) {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[key];
    }
    if (current === undefined || current === null || current === '') {
      missing.push(label);
    }
  }

  const errors: string[] = [];

  if (!Number.isInteger(config.chunking.max_chunk_size) || config.chunking.max_chunk_size <= 0) {
    errors.push('chunking.max_chunk_size must be a positive integer');
  }
  if (!Number.isInteger(config.chunking.min_chunk_size) || config.chunking.min_chunk_size < 0) {
    errors.push('chunking.min_chunk_size must be a non-negative integer');
  }
  if (config.chunking.min_chunk_size > config.chunking.max_chunk_size) {
    errors.push('chunking.min_chunk_size cannot be larger than chunking.max_chunk_size');
  }
  const allowedSplitBoundaries = ['page', 'section', 'heading', 'semantic-object', 'table', 'figure'];
  if (!allowedSplitBoundaries.includes(config.chunking.split_boundary)) {
    errors.push(`chunking.split_boundary must be one of: ${allowedSplitBoundaries.join(', ')}`);
  }
  if (!Array.isArray(config.chunking.never_split) || config.chunking.never_split.some((r) => typeof r !== 'string')) {
    errors.push('chunking.never_split must be an array of strings');
  }
  if (typeof config.chunking.overlap !== 'number' || config.chunking.overlap < 0) {
    errors.push('chunking.overlap must be a non-negative number');
  }
  if (typeof config.extraction.engine !== 'string' || config.extraction.engine.trim() === '') {
    errors.push('extraction.engine must be a non-empty string');
  }
  if (typeof config.extraction.ocr_enabled !== 'boolean') {
    errors.push('extraction.ocr_enabled must be a boolean');
  }
  if (config.extraction.page_range !== null && typeof config.extraction.page_range !== 'string') {
    errors.push('extraction.page_range must be null or a string');
  }
  if (config.extraction.page_range && !/^\d+(?:-\d+)?$/.test(config.extraction.page_range)) {
    errors.push('extraction.page_range must be a single page number or a range like "1-10"');
  }
  if (!Array.isArray(config.output.page_types) || config.output.page_types.some((t) => typeof t !== 'string')) {
    errors.push('output.page_types must be an array of strings');
  }

  if (missing.length > 0) {
    errors.push(`Missing required fields: ${missing.join(', ')}`);
  }

  if (errors.length > 0) {
    throw new CLIError(
      `Config validation failed:\n  - ${errors.join('\n  - ')}\n` +
      `Update the wiki config.json or workspace .kimi-code/config.json.`,
    );
  }
}
