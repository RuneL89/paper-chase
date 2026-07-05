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
  agents_md: string;
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
    agents_md: 'AGENTS.md',
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

  if (missing.length > 0) {
    throw new CLIError(
      `Config is missing required fields: ${missing.join(', ')}. ` +
      `Update the wiki config.json or workspace .kimi-code/config.json.`,
    );
  }
}
