import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ModelRouting, Provider } from '../llm/client';

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
}

export interface TuiSettings {
  /** Phase 5: pre-check the "Enable Synthesis" option in the ingest screen. */
  synthesis: boolean;
  /** Phase 9: pre-check the "Propose AGENTS.md Updates" option. */
  updateAgents: boolean;
  /**
   * Phase 11: per-call LLM model routing. `provider` selects the API
   * ('anthropic' default, 'openai' opt-in — v1.4.0 multi-provider extension,
   * user directive 2026-07-22); `default` is a concrete model id for the
   * current provider; the per-call-type entries are either a concrete model
   * id or null, where null means "Same as default". Older config files
   * without a `models` block — or without `provider` inside it — load with
   * the Anthropic defaults filled in.
   */
  models: ModelRouting;
  /**
   * Phase 11 v1.5.0: stored API keys (see `ApiKeys`). Config files without
   * an `apiKeys` block load as { anthropic: null, openai: null }; saved
   * configs always carry the block.
   */
  apiKeys: ApiKeys;
}

/**
 * Phase 11 v1.4.0: the provider-aware model catalog offered by the Settings
 * dropdowns. `label` is the short display name; the persisted value is the
 * full model id. Anthropic: Haiku/Sonnet/Opus. OpenAI (lineup verified
 * against live OpenAI docs 2026-07-22 — see the compliance log): the GPT-5.6
 * family Luna/Terra/Sol.
 */
export const MODEL_CATALOG: Record<Provider, Array<{ id: string; label: string }>> = {
  anthropic: [
    { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
    { id: 'claude-sonnet-5', label: 'Sonnet 5' },
    { id: 'claude-opus-4-8', label: 'Opus 4.8' },
  ],
  openai: [
    { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
    { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
    { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
  ],
};

/** Provider-aware default model: always the provider's cheapest tier. */
export const DEFAULT_MODEL_FOR_PROVIDER: Record<Provider, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-5.6-luna',
};

/**
 * Phase 14 (phase doc §2.6, ratified mid-tier): the seeded `curation` slot per
 * provider — mid-tier judgment for merge/drop decisions.
 */
export const CURATION_MODEL_FOR_PROVIDER: Record<Provider, string> = {
  anthropic: 'claude-sonnet-5',
  openai: 'gpt-5.6-terra',
};

/**
 * Re-seed the five model slots for a provider switch (Settings screen):
 * `default` becomes the new provider's cheapest model, `curation` its
 * mid-tier (Phase 14 §2.6), and every other per-call-type entry resets to
 * null ("Same as default"), so stale cross-provider model ids can never
 * persist in `.paper-chase.json`.
 */
export function seedModelsForProvider(provider: Provider): ModelRouting {
  return {
    provider,
    default: DEFAULT_MODEL_FOR_PROVIDER[provider],
    extractor: null,
    synthesis: null,
    dox: null,
    curation: CURATION_MODEL_FOR_PROVIDER[provider],
  };
}

const DEFAULT_SETTINGS: TuiSettings = {
  synthesis: false,
  updateAgents: false,
  models: seedModelsForProvider('anthropic'),
  apiKeys: { anthropic: null, openai: null },
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
 */
function normalizeModels(parsed: Partial<ModelRouting> | undefined): ModelRouting {
  const concrete = (value: unknown): string | null =>
    typeof value === 'string' && value.length > 0 ? value : null;
  const provider: Provider = parsed?.provider === 'openai' ? 'openai' : 'anthropic';
  return {
    provider,
    default:
      typeof parsed?.default === 'string' && parsed.default.length > 0
        ? parsed.default
        : DEFAULT_MODEL_FOR_PROVIDER[provider],
    extractor: concrete(parsed?.extractor),
    synthesis: concrete(parsed?.synthesis),
    dox: concrete(parsed?.dox),
    // Phase 14 §2.6: absent in legacy configs → null (falls through to
    // `default` at resolve time — byte-identical legacy behavior).
    curation: concrete(parsed?.curation),
  };
}

function parseSettings(raw: string): TuiSettings {
  const parsed = JSON.parse(raw) as Partial<TuiSettings>;
  return {
    synthesis: Boolean(parsed.synthesis),
    updateAgents: Boolean(parsed.updateAgents),
    models: normalizeModels(parsed.models),
    apiKeys: normalizeApiKeys(parsed.apiKeys),
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
  };
}

function defaultSettings(): TuiSettings {
  return {
    ...DEFAULT_SETTINGS,
    models: { ...DEFAULT_SETTINGS.models },
    apiKeys: { ...DEFAULT_SETTINGS.apiKeys },
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
