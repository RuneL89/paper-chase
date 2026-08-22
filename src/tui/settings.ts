import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeModelSlot, normalizeProviderValue } from '../llm/client';
import type { ModelRouting, ModelSlot, Provider } from '../llm/client';

export type { Provider } from '../llm/client';

/**
 * Phase 11 v1.5.0 (user directive 2026-07-23): API keys entered in the TUI
 * Settings screen, persisted per workspace in `.paper-chase.json`. null means
 * "not stored" (the client then falls back to the environment / .env). No
 * format validation — the API rejects bad keys at call time. SECURITY: this
 * file is gitignored and must never be committed; the TUI only ever shows the
 * source + last 4 characters.
 */
export interface ApiKeys {
  anthropic: string | null;
  openai: string | null;
  qwen: string | null;
  deepseek: string | null;
  zhipu: string | null;
}

/**
 * Custom provider header (key-value pair; the value may use `{{apiKey}}`).
 */
export interface CustomProviderHeader {
  key: string;
  value: string;
}

/**
 * Response template for a custom provider: dot/bracket JSON paths used to
 * extract the response text and token counts.
 */
export interface CustomProviderResponseTemplate {
  textPath: string;
  inputTokensPath?: string;
  outputTokensPath?: string;
}

/**
 * Model entry for a custom provider: the persisted `id` plus a display `label`
 * (label defaults to the id when omitted).
 */
export interface CustomProviderModel {
  id: string;
  label: string;
}

/**
 * Phase 11 v1.8.0: a fully configurable custom provider (OpenAI-compatible by
 * default, but with a user-defined request body template, headers, and response
 * extraction paths so it can target OpenRouter, local vLLM, Groq, Azure OpenAI,
 * etc.). The API key lives inside the provider config in `.paper-chase.json`
 * (the file is already gitignored).
 */
export interface CustomProviderConfig {
  /** Slug derived from the display name (e.g. 'openrouter'). */
  id: string;
  /** Human-readable display name (e.g. 'OpenRouter'). */
  name: string;
  /** Full POST endpoint URL (e.g. https://api.example.com/v1/chat/completions). */
  baseUrl: string;
  /** API key for this provider; null means "not set". */
  apiKey: string | null;
  /** Extra headers; values may contain `{{apiKey}}`. */
  headers: CustomProviderHeader[];
  /** JSON body template with `{{model}}`, `{{messages}}`, `{{maxTokens}}`,
   * `{{temperature}}` (optional), and `{{apiKey}}` placeholders. */
  requestTemplate: string;
  /** Dot/bracket JSON paths for response extraction. */
  responseTemplate: CustomProviderResponseTemplate;
  /** Selectable model list for this provider. */
  models: CustomProviderModel[];
}

export interface TuiSettings {
  /** Phase 5: pre-check the "Enable Synthesis" option in the ingest screen. */
  synthesis: boolean;
  /** Phase 9: pre-check the "Propose AGENTS.md Updates" option. */
  updateAgents: boolean;
/**
 * Phase 11: per-call LLM model routing. `provider` is the DEFAULT provider
 * ('anthropic' default; 'openai' and 'qwen' opt-in — v1.4.0 multi-provider
 * extension, user directive 2026-07-22; Qwen extension 2026-08-04;
 * 'deepseek' — 2026-08-17); `default` is a concrete model id for that
 * provider; the per-call-type entries are `{ provider, model }` pairs
 * (v1.9.0, user directive 2026-08-17) or null, where null means "Same as
 * default". Older config files without a `models` block — or without
 * `provider` inside it — load with the Anthropic defaults filled in, and
 * legacy per-call-type STRING entries migrate to `{ provider, model }`
 * pairs under the (legacy) global provider.
 */
  models: ModelRouting;
  /**
   * Phase 11 v1.5.0: stored API keys (see `ApiKeys`). Config files without
   * an `apiKeys` block load as { anthropic: null, openai: null, qwen: null };
   * saved configs always carry the block.
   */
  apiKeys: ApiKeys;
  /**
   * Phase 11 v1.8.0: user-defined custom providers (OpenAI-compatible by
   * default, fully configurable via base URL, API key, headers, request body
   * template, response extraction paths, and model list). Config files without
   * a `customProviders` block load as an empty array.
   */
  customProviders: CustomProviderConfig[];
}

/**
 * Phase 11 v1.4.0: the provider-aware model catalog offered by the Settings
 * dropdowns. `label` is the short display name; the persisted value is the
 * full model id. Anthropic: Haiku/Sonnet/Opus. OpenAI (lineup verified
 * against live OpenAI docs 2026-07-22 — see the compliance log): the GPT-5.6
 * family Luna/Terra/Sol. Qwen (DashScope OpenAI-compatible endpoint,
 * 2026-08-04): Qwen-Plus, Qwen 3.7 Max, Qwen 3.8 Max. DeepSeek
 * (OpenAI-compatible endpoint, 2026-08-17): DeepSeek-V4-Pro only for now
 * (user directive — more models later). Zhipu (2026-08-19, the
 * INTERNATIONAL Z.ai endpoint `https://api.z.ai/api/paas/v4`; both Flash
 * tiers added per user directive 2026-08-22): GLM-4.7-Flash (free, 1-request
 * concurrency), GLM-4.7-FlashX ($0.07/$0.40), GLM-5.2, GLM-5.3.
 */
type BuiltInProvider = 'anthropic' | 'openai' | 'qwen' | 'deepseek' | 'zhipu';

export const MODEL_CATALOG: Record<BuiltInProvider, Array<{ id: string; label: string }>> = {
  anthropic: [
    { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
    { id: 'claude-sonnet-5', label: 'Sonnet 5' },
    { id: 'claude-opus-4-8', label: 'Opus 4.8' },
    { id: '__custom__', label: 'Custom model...' },
  ],
  openai: [
    { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
    { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
    { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
    { id: '__custom__', label: 'Custom model...' },
  ],
  qwen: [
    { id: 'qwen-plus', label: 'Qwen-Plus' },
    { id: 'qwen3.7-max', label: 'Qwen 3.7 Max' },
    { id: 'qwen3.8-max', label: 'Qwen 3.8 Max' },
    { id: '__custom__', label: 'Custom model...' },
  ],
  deepseek: [
    { id: 'deepseek-v4-pro', label: 'DeepSeek-V4-Pro' },
    { id: '__custom__', label: 'Custom model...' },
  ],
  zhipu: [
    { id: 'glm-4.7-flash', label: 'GLM-4.7-Flash' },
    { id: 'glm-4.7-flashx', label: 'GLM-4.7-FlashX' },
    { id: 'glm-5.2', label: 'GLM-5.2' },
    { id: 'glm-5.3', label: 'GLM-5.3' },
    { id: '__custom__', label: 'Custom model...' },
  ],
};

/** Provider-aware default model: always the provider's cheapest tier. */
export const DEFAULT_MODEL_FOR_PROVIDER: Record<BuiltInProvider, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-5.6-luna',
  qwen: 'qwen-plus',
  deepseek: 'deepseek-v4-pro',
  zhipu: 'glm-4.7-flash',
};

/**
 * Phase 14 (phase doc §2.6, ratified mid-tier): the seeded `curation` slot per
 * provider — mid-tier judgment for merge/drop decisions. DeepSeek has a
 * single model for now, so it seeds v4-pro. Zhipu seeds GLM-5.2 as the
 * mid tier (GLM-5.3 has mandatory reasoning, so it stays the premium pick).
 */
export const CURATION_MODEL_FOR_PROVIDER: Record<BuiltInProvider, string> = {
  anthropic: 'claude-sonnet-5',
  openai: 'gpt-5.6-terra',
  qwen: 'qwen3.7-max',
  deepseek: 'deepseek-v4-pro',
  zhipu: 'glm-5.2',
};

/**
 * Slugify a display name for a custom provider id (kebab-case, no spaces).
 * If the slug already exists, append `-2`, `-3`, etc.
 */
export function slugifyCustomProviderId(name: string, existingIds: string[]): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'custom';
  let candidate = base;
  let counter = 2;
  while (existingIds.includes(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}

/**
 * Create a new custom provider with OpenAI-compatible defaults.
 */
export function createCustomProvider(name: string, existingIds: string[]): CustomProviderConfig {
  return {
    id: slugifyCustomProviderId(name, existingIds),
    name,
    baseUrl: 'https://api.example.com/v1/chat/completions',
    apiKey: null,
    headers: [
      { key: 'Authorization', value: 'Bearer {{apiKey}}' },
      { key: 'Content-Type', value: 'application/json' },
    ],
    requestTemplate:
      '{"model":"{{model}}","messages":{{messages}},"max_tokens":{{maxTokens}}}',
    responseTemplate: {
      textPath: 'choices[0].message.content',
      inputTokensPath: 'usage.prompt_tokens',
      outputTokensPath: 'usage.completion_tokens',
    },
    models: [],
  };
}

/** Find a custom provider by id (the `custom:` prefix is stripped if present). */
export function findCustomProvider(
  provider: Provider,
  customProviders: CustomProviderConfig[],
): CustomProviderConfig | undefined {
  const id = provider.startsWith('custom:') ? provider.slice(7) : provider;
  return customProviders.find((cp) => cp.id === id);
}

/** True when the provider is one of the built-in literals. */
export function isBuiltInProvider(
  provider: Provider,
): provider is 'anthropic' | 'openai' | 'qwen' | 'deepseek' | 'zhipu' {
  return (
    provider === 'anthropic' ||
    provider === 'openai' ||
    provider === 'qwen' ||
    provider === 'deepseek' ||
    provider === 'zhipu'
  );
}

/**
 * Get the model catalog for any provider. Built-in providers use the static
 * `MODEL_CATALOG`; custom providers use their configured model list.
 */
export function getModelCatalog(
  provider: Provider,
  customProviders: CustomProviderConfig[],
): Array<{ id: string; label: string }> {
  if (isBuiltInProvider(provider)) {
    return MODEL_CATALOG[provider];
  }
  const cp = findCustomProvider(provider, customProviders);
  return cp?.models ?? [];
}

/**
 * Get the default model for any provider. Built-in providers use the static
 * map; custom providers use their first configured model.
 */
export function getDefaultModelForProvider(
  provider: Provider,
  customProviders: CustomProviderConfig[],
): string {
  if (isBuiltInProvider(provider)) {
    return DEFAULT_MODEL_FOR_PROVIDER[provider];
  }
  const cp = findCustomProvider(provider, customProviders);
  return cp?.models[0]?.id ?? '';
}

/**
 * Get the mid-tier curation model for any provider. Built-in providers use the
 * static map; custom providers use their second configured model (or the first
 * when only one exists).
 */
export function getCurationModelForProvider(
  provider: Provider,
  customProviders: CustomProviderConfig[],
): string {
  if (isBuiltInProvider(provider)) {
    return CURATION_MODEL_FOR_PROVIDER[provider];
  }
  const cp = findCustomProvider(provider, customProviders);
  return cp?.models[1]?.id ?? cp?.models[0]?.id ?? '';
}

/**
 * Seed a FRESH routing table for a provider (new settings, provider addition):
 * `default` becomes the provider's cheapest model, `curation` its mid-tier
 * (Phase 14 §2.6) as a concrete `{ provider, model }` pair, and every other
 * per-call-type entry starts null ("Same as default"). Phase 11 v1.9.0: the
 * seeded pairs carry their own provider, so seeding never mixes providers.
 * For custom providers (v1.8.0), the cheapest model is the first configured
 * model and the mid-tier is the second configured model (or the first when
 * only one exists).
 */
export function seedModelsForProvider(
  provider: Provider,
  customProviders: CustomProviderConfig[] = [],
): ModelRouting {
  return {
    provider,
    default: getDefaultModelForProvider(provider, customProviders),
    extractor: null,
    synthesis: null,
    dox: null,
    // Phase 24: explicit Cross-Wiki Discovery slots start as "Same as default".
    crossWiki: null,
    crossWikiJudgment: null,
    curation: { provider, model: getCurationModelForProvider(provider, customProviders) },
  };
}

const DEFAULT_SETTINGS: TuiSettings = {
  synthesis: false,
  updateAgents: false,
  models: seedModelsForProvider('anthropic'),
  apiKeys: { anthropic: null, openai: null, qwen: null, deepseek: null, zhipu: null },
  customProviders: [],
};

/** Phase 11 rebrand: the settings file is `.paper-chase.json`. */
export function settingsPath(workspace: string): string {
  return join(workspace, '.paper-chase.json');
}

/**
 * Pre-rebrand settings file. Read-only fallback: it is only ever READ (when
 * the new file is absent), never written or deleted.
 */
export function legacySettingsPath(workspace: string): string {
  return join(workspace, '.llm-wiki-cli.json');
}

/**
 * Tolerate older config files: a missing `models` block gets the defaults,
 * and a `models` block without `provider` (pre-v1.4.0) loads as 'anthropic'.
 * Phase 11 v1.9.0: per-call-type slots normalize through the shared client
 * helper — legacy string ids migrate to `{ provider, model }` pairs under
 * the (legacy) global provider; malformed values become null. Custom
 * providers (v1.8.0) preserve their `custom:<id>` provider value and use the
 * configured model list for defaults.
 */
function normalizeModels(
  parsed: Partial<ModelRouting> | undefined,
  customProviders: CustomProviderConfig[] = [],
): ModelRouting {
  const provider: Provider = normalizeProviderValue(parsed?.provider);
  const slot = (value: unknown): ModelSlot | null => normalizeModelSlot(value, provider);
  return {
    provider,
    default:
      typeof parsed?.default === 'string' && parsed.default.length > 0
        ? parsed.default
        : getDefaultModelForProvider(provider, customProviders),
    extractor: slot(parsed?.extractor),
    synthesis: slot(parsed?.synthesis),
    dox: slot(parsed?.dox),
    // Phase 24: explicit cross-wiki slots; absent in legacy configs → null.
    crossWiki: slot(parsed?.crossWiki),
    crossWikiJudgment: slot(parsed?.crossWikiJudgment),
    // Phase 14 §2.6: absent in legacy configs → null (falls through to
    // `default` at resolve time — byte-identical legacy behavior).
    curation: slot(parsed?.curation),
  };
}

/**
 * Tolerate older config files: a missing `customProviders` block (pre-v1.8.0)
 * loads as an empty array. Malformed entries are skipped (never crash).
 */
function normalizeCustomProviders(parsed: unknown): CustomProviderConfig[] {
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter((item): item is CustomProviderConfig => {
    if (item === null || typeof item !== 'object') {
      return false;
    }
    const cp = item as Partial<CustomProviderConfig>;
    return (
      typeof cp.id === 'string' &&
      cp.id.length > 0 &&
      typeof cp.name === 'string' &&
      cp.name.length > 0 &&
      typeof cp.baseUrl === 'string' &&
      cp.baseUrl.length > 0 &&
      typeof cp.requestTemplate === 'string' &&
      cp.requestTemplate.length > 0 &&
      Array.isArray(cp.headers) &&
      Array.isArray(cp.models)
    );
  });
}

function parseSettings(raw: string): TuiSettings {
  const parsed = JSON.parse(raw) as Partial<TuiSettings>;
  const customProviders = normalizeCustomProviders(parsed.customProviders);
  return {
    synthesis: Boolean(parsed.synthesis),
    updateAgents: Boolean(parsed.updateAgents),
    models: normalizeModels(parsed.models, customProviders),
    apiKeys: normalizeApiKeys(parsed.apiKeys),
    customProviders,
  };
}

/**
 * Tolerate older config files: a missing `apiKeys` block (pre-v1.5.0) loads
 * as nulls. Non-string or empty entries load as null — never rejected (the
 * API fails loud at call time on a bad key).
 */
function normalizeApiKeys(parsed: Partial<ApiKeys> | undefined): ApiKeys {
  const concrete = (value: unknown): string | null =>
    typeof value === 'string' && value.length > 0 ? value : null;
  return {
    anthropic: concrete(parsed?.anthropic),
    openai: concrete(parsed?.openai),
    qwen: concrete(parsed?.qwen),
    deepseek: concrete(parsed?.deepseek),
    zhipu: concrete(parsed?.zhipu),
  };
}

function defaultSettings(): TuiSettings {
  return {
    ...DEFAULT_SETTINGS,
    models: { ...DEFAULT_SETTINGS.models },
    apiKeys: { ...DEFAULT_SETTINGS.apiKeys },
    customProviders: [...DEFAULT_SETTINGS.customProviders],
  };
}

/**
 * Load TUI settings from `.paper-chase.json` in the workspace root. When the
 * new file is absent, falls back to reading the legacy `.llm-wiki-cli.json`
 * (read-only — `saveSettings` always writes the new name and never deletes
 * the legacy file). Missing or malformed files fall back to the defaults so
 * the TUI never crashes on first run.
 */
export async function loadSettings(workspace: string = '.'): Promise<TuiSettings> {
  let raw: string;
  try {
    raw = await readFile(settingsPath(workspace), 'utf-8');
  } catch {
    // New file absent (or unreadable) — try the legacy pre-rebrand file.
    try {
      raw = await readFile(legacySettingsPath(workspace), 'utf-8');
    } catch {
      return defaultSettings();
    }
  }
  try {
    return parseSettings(raw);
  } catch {
    return defaultSettings();
  }
}

/** Persist TUI settings — always to `.paper-chase.json`. */
export async function saveSettings(workspace: string, settings: TuiSettings): Promise<void> {
  await mkdir(workspace, { recursive: true });
  await writeFile(settingsPath(workspace), JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}

export { DEFAULT_SETTINGS };
