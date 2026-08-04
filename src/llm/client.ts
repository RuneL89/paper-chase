import { existsSync, readFileSync } from 'node:fs';
import { mkdir, appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { resolve } from 'node:path';
import { request } from 'undici';
import { enqueueSerializedWrite } from '../utils/serialized-writes';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const QWEN_API_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Supported LLM providers (Phase 11 v1.4.0 multi-provider extension, user
 * directive 2026-07-22; Qwen extension 2026-08-04; custom providers v1.8.0).
 * Built-in literals: 'anthropic' (default), 'openai', 'qwen'.
 * Custom providers use the `custom:${id}` form where `id` is the slugified
 * custom provider name stored in `.paper-chase.json`.
 */
export type Provider = 'anthropic' | 'openai' | 'qwen' | `custom:${string}`;

/**
 * Price table in USD per million tokens (MTok).
 * Claude Haiku 4.5: $1/MTok input, $5/MTok output.
 * Claude Sonnet 5: $3/MTok input, $15/MTok output (Phase 11 model routing).
 * Claude Opus 4.8: $5/MTok input, $25/MTok output (Phase 11 model routing;
 * Opus 4.5-era pricing, best-known — override via env if Anthropic revises).
 * GPT-5.6 Luna: $1/$6; GPT-5.6 Terra: $2.50/$15; GPT-5.6 Sol: $5/$30
 * (Phase 11 v1.4.0 OpenAI lineup, verified against live OpenAI docs
 * 2026-07-22 — see the compliance log).
 * Qwen (DashScope) prices are PLACEHOLDER (TODO: replace with the exact
 * per-MTok values from your DashScope console when available).
 * Anthropic prices can be overridden via ANTHROPIC_INPUT_PRICE_PER_MTOK and
 * ANTHROPIC_OUTPUT_PRICE_PER_MTOK. Unknown models fall back to the
 * Haiku 4.5 prices.
 */
const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'gpt-5.6-luna': { input: 1, output: 6 },
  'gpt-5.6-terra': { input: 2.5, output: 15 },
  'gpt-5.6-sol': { input: 5, output: 30 },
  // TODO(Qwen pricing): update from the DashScope console once known.
  'qwen-plus': { input: 0.5, output: 1 },
  'qwen3.7-max': { input: 2, output: 5 },
  'qwen3.8-max': { input: 3, output: 6 },
  default: { input: 1, output: 5 },
};

/**
 * Phase 11: per-call LLM model routing table (persisted in
 * `.paper-chase.json` under `models`). `default` is a concrete model id;
 * each call-type entry is a concrete model id or null ("use default").
 * Phase 11 v1.4.0: `provider` selects the API the routed calls go to;
 * absent means 'anthropic' so legacy callers and legacy config files keep
 * byte-identical behavior.
 * Phase 11 v1.5.0: `apiKeys` carries the Settings-stored API keys (persisted
 * in `.paper-chase.json` under its own top-level `apiKeys` block and threaded
 * in at the single integration point — `ingest()`). A stored key wins over
 * the environment for its provider; absent entries normalize to null.
 * Phase 14 (phase doc §2.6): additive `curation` slot for the topic & entity
 * curation calls — absent in legacy configs and normalized to null by
 * `setModelRouting`, exactly like the v1.5.0 `apiKeys` addition (legacy
 * resolution byte-identical).
 */
export interface ModelRouting {
  provider?: Provider;
  default: string;
  extractor: string | null;
  synthesis: string | null;
  dox: string | null;
  /** Phase 14: curation call-type slot (null = "use default"). */
  curation?: string | null;
  apiKeys?: {
    anthropic?: string | null;
    openai?: string | null;
    qwen?: string | null;
  };
  /** Phase 11 v1.8.0: custom provider configs (OpenAI-compatible by default,
   * fully configurable). Used by `resolveApiKey`, `buildCustomProviderRequest`,
   * and `parseCustomProviderResponse`. */
  customProviders?: import('../tui/settings').CustomProviderConfig[];
}

/** Call types that route to the Synthesis Writer model. */
const SYNTHESIS_CALL_TYPES = new Set([
  'synthesis',
  'permissive-synthesis',
  'topic-synthesis',
  'permissive-topic-synthesis',
]);

let modelRouting: ModelRouting | null = null;

/**
 * Set the process-wide model routing table (called once per ingest run from
 * the workspace TUI settings). Pass null to clear routing (tests). A routing
 * without `provider` (legacy callers) is stored as 'anthropic'; a routing
 * without `apiKeys` (pre-v1.5.0 callers) normalizes both stored keys to null
 * so the environment fallback decides.
 */
export function setModelRouting(routing: ModelRouting | null): void {
  modelRouting =
    routing === null
      ? null
      : {
          ...routing,
          provider: routing.provider ?? 'anthropic',
          // Phase 14 §2.6: absent (legacy configs) normalizes to null so the
          // curation call falls through to `default` — byte-identical.
          curation:
            typeof routing.curation === 'string' && routing.curation.length > 0 ? routing.curation : null,
          apiKeys: {
            anthropic: normalizeStoredKey(routing.apiKeys?.anthropic),
            openai: normalizeStoredKey(routing.apiKeys?.openai),
            qwen: normalizeStoredKey(routing.apiKeys?.qwen),
          },
        };
}

/** A stored key is a non-empty string; anything else is "not stored". */
function normalizeStoredKey(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Resolve the provider for one LLM call. The provider only ever comes from
 * the routing table; with no routing set the provider is 'anthropic' (the
 * pre-extension behavior). There is deliberately no OPENAI_MODEL env
 * fallback: `ANTHROPIC_MODEL` stays anthropic-scoped and OpenAI models are
 * configured exclusively through the Settings screen / `.paper-chase.json`.
 */
export function resolveProvider(): Provider {
  return modelRouting?.provider ?? 'anthropic';
}

/**
 * Resolve the model for one LLM call. Order: explicit per-call override →
 * routing table by callType ('extractor' → extractor, the four synthesis
 * call types → synthesis, 'dox-writer' → dox, 'curation' → curation,
 * everything else → default; a null routing entry means "use default") →
 * routing default → ANTHROPIC_MODEL env var → DEFAULT_MODEL. With no routing
 * set the behavior is byte-identical to the pre-Phase-11 client: env var,
 * then DEFAULT_MODEL.
 */
/**
 * Pure model resolution for a given routing table. Used by `resolveModel`
 * (which reads the module-level routing) and by the TUI test-connection
 * helper (which passes the settings table explicitly).
 */
export function resolveModelFromRouting(
  routing: ModelRouting,
  callType?: string,
  override?: string,
): string {
  if (override) {
    return override;
  }
  if (callType === 'extractor' && routing.extractor !== null) {
    return routing.extractor;
  }
  if (callType !== undefined && SYNTHESIS_CALL_TYPES.has(callType) && routing.synthesis !== null) {
    return routing.synthesis;
  }
  if (callType === 'dox-writer' && routing.dox !== null) {
    return routing.dox;
  }
  // Phase 14 §2.6: 'curation' → routing.curation → default when null.
  if (callType === 'curation' && routing.curation != null) {
    return routing.curation;
  }
  return routing.default;
}

export function resolveModel(callType?: string, override?: string): string {
  if (override) {
    return override;
  }
  if (modelRouting !== null) {
    return resolveModelFromRouting(modelRouting, callType, override);
  }
  return process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
}

let envFileLoaded = false;

/**
 * Minimal .env fallback parser (no dotenv dependency). Reads `.env` from the
 * project root (process.cwd()) and sets any keys not already present in
 * process.env. Supports comments (#), blank lines, and optional quotes.
 */
function loadEnvFile(): void {
  if (envFileLoaded) {
    return;
  }
  envFileLoaded = true;

  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

/**
 * Phase 11 v1.5.0: resolve the API key for one provider. Order: (1) the
 * Settings-stored key carried by the routing config, (2) the environment
 * (`process.env.ANTHROPIC_API_KEY` / `OPENAI_API_KEY` — the `.env` fallback
 * loader populates process.env first). Returns null when neither exists.
 */
function resolveApiKey(provider: Provider): string | null {
  if (provider.startsWith('custom:')) {
    const id = provider.slice(7);
    const cp = modelRouting?.customProviders?.find((c) => c.id === id);
    return cp?.apiKey ?? null;
  }
  return resolveApiKeyForProvider(
    provider as 'anthropic' | 'openai' | 'qwen',
    modelRouting?.apiKeys?.[provider as 'anthropic' | 'openai' | 'qwen'] ?? null,
  );
}

/**
 * Resolve the full API key for a provider from an optional stored key, the
 * environment, and the `.env` fallback. Used by `resolveApiKey` (which reads
 * the module-level routing) and by the TUI test-connection helper (which
 * passes the Settings-stored key explicitly).
 */
export function resolveApiKeyForTest(
  provider: Provider,
  storedKey?: string | null,
  customProviders?: import('../tui/settings').CustomProviderConfig[],
): string | null {
  if (provider.startsWith('custom:')) {
    const id = provider.slice(7);
    const cp = customProviders?.find((c) => c.id === id);
    return cp?.apiKey ?? null;
  }
  return resolveApiKeyForProvider(provider, storedKey ?? null);
}

function resolveApiKeyForProvider(provider: Provider, storedKey: string | null): string | null {
  const stored = normalizeStoredKey(storedKey);
  if (stored !== null) {
    return stored;
  }
  const envKey =
    provider === 'openai'
      ? process.env.OPENAI_API_KEY
      : provider === 'qwen'
        ? process.env.DASHSCOPE_API_KEY
        : process.env.ANTHROPIC_API_KEY;
  return envKey ?? null;
}

/** Source of a resolved API key, for the Settings screen's masked display. */
export interface ApiKeyStatus {
  source: 'stored' | 'environment' | 'none';
  /** Last 4 characters of the RESOLVED key (stored wins); null when none. */
  last4: string | null;
}

/**
 * Phase 11 v1.5.0: report where a provider's key would come from WITHOUT ever
 * exposing more than its last 4 characters. Triggers the same one-time `.env`
 * fallback load as `callLLM` before checking the environment. `storedKey` is
 * the Settings-stored key the caller already holds (e.g. from the loaded
 * TUI settings) — it wins over the environment, matching `resolveApiKey`.
 */
export function getApiKeyStatus(provider: Provider, storedKey?: string | null): ApiKeyStatus {
  loadEnvFile();
  const stored = normalizeStoredKey(storedKey);
  if (stored !== null) {
    return { source: 'stored', last4: stored.slice(-4) };
  }
  if (provider.startsWith('custom:')) {
    // Custom providers have no env fallback; the key lives in the provider config.
    return { source: 'none', last4: null };
  }
  const envKey =
    provider === 'openai'
      ? process.env.OPENAI_API_KEY
      : provider === 'qwen'
        ? process.env.DASHSCOPE_API_KEY
        : process.env.ANTHROPIC_API_KEY;
  if (envKey) {
    return { source: 'environment', last4: envKey.slice(-4) };
  }
  return { source: 'none', last4: null };
}

interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: AnthropicUsage;
}

interface OpenAIUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: OpenAIUsage;
}

/** Provider-specific request shape built before the shared transport loop. */
interface ProviderRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/** Normalized response data parsed per provider after a successful call. */
interface ParsedProviderResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Anthropic Messages API request — the byte-identical pre-extension shape:
 * `max_tokens`, a single user message, optional top-level `system`, optional
 * `temperature` (only when the caller provides one).
 */
function buildAnthropicRequest(
  model: string,
  prompt: string,
  system: string | undefined,
  options: CallLLMOptions,
  apiKey: string,
): ProviderRequest {
  const body: Record<string, unknown> = {
    model,
    max_tokens: options.maxTokens ?? 1024,
    messages: [{ role: 'user', content: prompt }],
  };
  if (system) {
    body.system = system;
  }
  if (options.temperature !== undefined) {
    body.temperature = options.temperature;
  }
  return {
    url: ANTHROPIC_API_URL,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body,
  };
}

/**
 * OpenAI Chat Completions request (shape verified against live OpenAI docs
 * 2026-07-22 — see the compliance log): `max_completion_tokens` (the legacy
 * `max_tokens` is deprecated and never sent), the system prompt as a leading
 * `role: 'system'` message. `options.temperature` is intentionally IGNORED:
 * the GPT-5.6 reasoning models reject a custom temperature, so the field is
 * never sent for this provider.
 * Qwen (DashScope OpenAI-compatible endpoint) uses the same request shape.
 */
function buildOpenAIRequest(
  model: string,
  prompt: string,
  system: string | undefined,
  options: CallLLMOptions,
  apiKey: string,
  baseUrl: string = OPENAI_API_URL,
  maxTokensField: 'max_completion_tokens' | 'max_tokens' = 'max_completion_tokens',
): ProviderRequest {
  const messages: Array<{ role: string; content: string }> = [];
  if (system) {
    messages.push({ role: 'system', content: system });
  }
  messages.push({ role: 'user', content: prompt });
  return {
    url: baseUrl,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: {
      model,
      [maxTokensField]: options.maxTokens ?? 1024,
      messages,
    },
  };
}

function parseAnthropicResponse(json: (AnthropicResponse & OpenAIResponse) | undefined): ParsedProviderResponse {
  const text = (json?.content ?? [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('');
  return {
    text,
    inputTokens: json?.usage?.input_tokens ?? 0,
    outputTokens: json?.usage?.output_tokens ?? 0,
  };
}

function parseOpenAIResponse(json: (AnthropicResponse & OpenAIResponse) | undefined): ParsedProviderResponse {
  const content = json?.choices?.[0]?.message?.content;
  return {
    text: typeof content === 'string' ? content : '',
    inputTokens: json?.usage?.prompt_tokens ?? 0,
    outputTokens: json?.usage?.completion_tokens ?? 0,
  };
}

/**
 * Fill a JSON template with placeholder values. Supported placeholders:
 * `{{model}}`, `{{messages}}` (a JSON array string), `{{maxTokens}}`,
 * `{{temperature}}` (replaced with the value or `null` when omitted), and
 * `{{apiKey}}`.
 */
function fillTemplate(template: string, values: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = values[key];
    if (value === undefined || value === null) {
      return key === 'temperature' ? 'null' : '';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    return value;
  });
}

/**
 * Extract a value from a JSON object using a simple dot/bracket path
 * (e.g., `choices[0].message.content`, `usage.prompt_tokens`). Returns
 * `undefined` when the path does not exist.
 */
function getPath(obj: unknown, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Build a custom provider request from its config. The request body is the
 * filled JSON template; the headers are the configured headers with
 * `{{apiKey}}` filled. The URL is the configured base URL (used as-is — the
 * user can include any path).
 */
function buildCustomProviderRequest(
  config: import('../tui/settings').CustomProviderConfig,
  model: string,
  prompt: string,
  system: string | undefined,
  options: CallLLMOptions,
  apiKey: string,
): ProviderRequest {
  const messages: Array<{ role: string; content: string }> = [];
  if (system) {
    messages.push({ role: 'system', content: system });
  }
  messages.push({ role: 'user', content: prompt });

  const bodyStr = fillTemplate(config.requestTemplate, {
    model,
    messages: JSON.stringify(messages),
    maxTokens: options.maxTokens ?? 1024,
    temperature: options.temperature,
    apiKey,
  });

  const body = JSON.parse(bodyStr) as Record<string, unknown>;

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  for (const h of config.headers) {
    headers[h.key] = fillTemplate(h.value, { apiKey });
  }

  return { url: config.baseUrl, headers, body };
}

/**
 * Parse a custom provider response using its configured response template.
 * The paths are dot/bracket JSON paths (e.g., `choices[0].message.content`).
 */
function parseCustomProviderResponse(
  json: unknown,
  responseTemplate: import('../tui/settings').CustomProviderResponseTemplate,
): ParsedProviderResponse {
  return {
    text: (getPath(json, responseTemplate.textPath) as string | undefined) ?? '',
    inputTokens: (getPath(json, responseTemplate.inputTokensPath ?? '') as number | undefined) ?? 0,
    outputTokens: (getPath(json, responseTemplate.outputTokensPath ?? '') as number | undefined) ?? 0,
  };
}

/**
 * Additive per-call options (Phase 2, noted adaptation 5 in the 2026-07-17
 * 12:00 compliance-log entry). Defaults preserve the frozen Phase 0 behavior
 * exactly: 1024 max_tokens and no temperature field in the request.
 */
export interface CallLLMOptions {
  /** Max output tokens for the request; defaults to 1024. */
  maxTokens?: number;
  /** Sampling temperature; omitted from the request unless provided. */
  temperature?: number;
  /**
   * Optional label describing the caller (e.g., 'extractor', 'synthesis',
   * 'permissive-synthesis'). Used only in the LLM call log.
   */
  callType?: string;
  /**
   * Optional caller-provided context string (e.g., entity slug, chunk ID) to
   * tie the LLM call to a specific item in the pipeline. Used only in the log.
   */
  context?: string;
  /**
   * Optional path to a JSON-lines file where each LLM call is appended.
   * If provided, a summary record is written after a successful call.
   */
  logPath?: string;
  /**
   * Phase 7 v1.1.0 amendment (user-ratified 2026-07-20; vision `04` §6,
   * `07` §5): max EXTRA attempts on transient transport failures (HTTP
   * 429/5xx, network errors). Deterministic failures (HTTP 4xx) always throw
   * immediately. Default 0 — the frozen pre-amendment no-retry behavior —
   * so every existing caller is unchanged unless it opts in.
   */
  maxRetries?: number;
  /**
   * Phase 11: explicit per-call model override. Wins over the routing table,
   * the ANTHROPIC_MODEL env var, and DEFAULT_MODEL (see `resolveModel`).
   */
  model?: string;
}

/** True for transient transport failures worth retrying (429/5xx, network). */
function isTransientStatus(statusCode: number): boolean {
  return statusCode === 429 || statusCode >= 500;
}

/**
 * Phase 16 (vision `04` §1 pool transport tuning, user-ratified 2026-07-25):
 * calls whose output ceiling reaches this many tokens are large-output calls
 * and get the generous LARGE_CALL_HEADERS_TIMEOUT_MS headers timeout; smaller
 * calls keep undici's default headers timeout unchanged.
 */
export const LARGE_CALL_MAX_TOKENS = 32768;

/** Phase 16: headers timeout for large-output calls (600 seconds). */
export const LARGE_CALL_HEADERS_TIMEOUT_MS = 600_000;

/**
 * Phase 16 (vision `04` §1): the backoff between transport retries is
 * exponential — 5s, 15s, 45s, ... (5s x 3^(retry-1)) — instead of the old
 * linear 1s/2s/3s. Identical attempt counts and error classes; only the wait
 * changes. `retry` is the 1-based index of the wait (the wait after attempt 1
 * is retry 1). Exported so tests assert the sequence without wall-clock
 * sleeping.
 */
export function transportRetryDelayMs(retry: number): number {
  return 5000 * 3 ** (Math.max(1, retry) - 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

/**
 * The sleeper used between transport retries. Module-level and replaceable
 * ONLY so tests can observe the backoff sequence without real waiting —
 * production code never touches this (the `setModelRouting(null)` test-hook
 * precedent).
 */
let transportRetrySleeper: (ms: number) => Promise<void> = sleep;

/** Test hook: replace the transport-retry sleeper; null restores the real one. */
export function setTransportRetrySleeper(sleeper: ((ms: number) => Promise<void>) | null): void {
  transportRetrySleeper = sleeper ?? sleep;
}

/**
 * Phase 16 (vision `04` §6 per-page transport fallback): classify a THROWN
 * callLLM error as an exhausted transient transport failure (HTTP 429/5xx or
 * network/timeout after the bounded retries) — the ONLY error class the
 * per-page synthesis fallback may catch. HTTP 4xx (never retried, thrown
 * immediately) and every non-transport error classify false and still abort.
 * Matches the two error shapes this module throws, for both providers:
 * '<Provider> API transport error after N attempt(s): ...' (network/timeout)
 * and '<Provider> API error (HTTP <status>): ...' (429/5xx after retries).
 */
export function isTransientTransportError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (/API transport error after \d+ attempt\(s\)/.test(error.message)) {
    return true;
  }
  const match = /API error \(HTTP (\d+)\)/.exec(error.message);
  return match !== null && isTransientStatus(Number(match[1]));
}

interface LlmCallLogEntry {
  timestamp: string;
  callType?: string;
  context?: string;
  /** Phase 11 v1.4.0: additive provider field ('anthropic' | 'openai' | 'qwen'). */
  provider: Provider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  // SECURITY (Phase 11 v1.5.0): NEVER add API-key material to this entry —
  // no key, no Authorization header, no token field beyond the two token
  // COUNT fields above. Keys travel only in the request auth header.
}

async function appendLlmCallLog(logPath: string | undefined, entry: LlmCallLogEntry): Promise<void> {
  if (!logPath) {
    return;
  }
  // Phase 15 (vision `04` §1): with the synthesis pool's 4 workers, concurrent
  // appends race — funnel every append through the per-path serialized write
  // queue so each JSONL line lands whole, ordered by completion, never torn.
  await enqueueSerializedWrite(logPath, async () => {
    try {
      await mkdir(dirname(logPath), { recursive: true });
      await appendFile(logPath, JSON.stringify(entry) + '\n', 'utf-8');
    } catch {
      // Best-effort logging; do not let a write failure break the LLM call.
    }
  });
}

/**
 * Call the configured LLM provider (Anthropic Messages API or OpenAI Chat
 * Completions API — Phase 11 v1.4.0) with a single user prompt (and optional
 * system prompt). Logs `LLM Call | Tokens: {input}/{output} | Cost: ${amount}`
 * for every call. Returns the raw response text.
 *
 * Retry policy (Phase 7 v1.1.0 amendment, vision `04` §6 / `07` §5): with
 * `options.maxRetries > 0`, transient transport failures (HTTP 429/5xx,
 * network errors) are retried up to that many EXTRA attempts; deterministic
 * failures (HTTP 4xx, including auth errors) always throw immediately. With
 * the default `maxRetries: 0` the behavior is the frozen pre-amendment one:
 * any failure throws on the first attempt. The policy is identical for both
 * providers. Phase 16 (vision `04` §1): the wait between retries is the
 * exponential `transportRetryDelayMs` sequence (5s/15s/45s — was linear), and
 * large-output calls (`maxTokens >= LARGE_CALL_MAX_TOKENS`) carry the 600s
 * `LARGE_CALL_HEADERS_TIMEOUT_MS` headers timeout while smaller calls keep
 * undici's default.
 */
export async function callLLM(prompt: string, system?: string, options: CallLLMOptions = {}): Promise<string> {
  loadEnvFile();

  const provider = resolveProvider();
  const apiKey = resolveApiKey(provider);
  if (!apiKey) {
    const keyName = provider.startsWith('custom:')
      ? `Custom provider API key (${provider.slice(7)})`
      : provider === 'openai'
        ? 'OPENAI_API_KEY'
        : provider === 'qwen'
          ? 'DASHSCOPE_API_KEY'
          : 'ANTHROPIC_API_KEY';
    throw new Error(
      `${keyName} is not set. Add it in Settings, export it in your environment, or add it to a .env file in the project root.`,
    );
  }

  const model = resolveModel(options.callType, options.model);
  const providerName = provider.startsWith('custom:')
    ? modelRouting?.customProviders?.find((c) => c.id === provider.slice(7))?.name ?? provider
    : provider === 'openai'
      ? 'OpenAI'
      : provider === 'qwen'
        ? 'Qwen'
        : 'Anthropic';

  let providerRequest: ProviderRequest;
  if (provider.startsWith('custom:')) {
    const config = modelRouting?.customProviders?.find((c) => c.id === provider.slice(7));
    if (!config) {
      throw new Error(`Custom provider '${provider.slice(7)}' not found in settings.`);
    }
    providerRequest = buildCustomProviderRequest(config, model, prompt, system, options, apiKey);
  } else if (provider === 'openai' || provider === 'qwen') {
    providerRequest = buildOpenAIRequest(
      model,
      prompt,
      system,
      options,
      apiKey,
      provider === 'qwen' ? QWEN_API_URL : OPENAI_API_URL,
    );
  } else {
    providerRequest = buildAnthropicRequest(model, prompt, system, options, apiKey);
  }

  const maxAttempts = 1 + Math.max(0, options.maxRetries ?? 0);
  // Phase 16 (vision `04` §1): large-output calls (synthesis family,
  // Extractor) stream long responses — give them a generous 600s headers
  // timeout; smaller calls keep undici's default (no option passed).
  const largeCall = (options.maxTokens ?? 1024) >= LARGE_CALL_MAX_TOKENS;
  let statusCode = 0;
  let json: (AnthropicResponse & OpenAIResponse & { error?: { message?: string } }) | undefined;
  let lastTransportError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    statusCode = 0;
    json = undefined;
    lastTransportError = undefined;
    try {
      const response = await request(providerRequest.url, {
        method: 'POST',
        headers: providerRequest.headers,
        body: JSON.stringify(providerRequest.body),
        ...(largeCall ? { headersTimeout: LARGE_CALL_HEADERS_TIMEOUT_MS } : {}),
      });
      statusCode = response.statusCode;
      json = (await response.body.json()) as AnthropicResponse &
        OpenAIResponse & { error?: { message?: string } };
    } catch (err) {
      // Network/transport failure (DNS, socket, timeout) — transient class.
      lastTransportError = err as Error;
    }

    const transient =
      lastTransportError !== undefined || (statusCode !== 0 && isTransientStatus(statusCode));
    if (!transient) {
      break; // Success or deterministic failure — handle below, never retry.
    }
    if (attempt < maxAttempts) {
      const reason =
        lastTransportError?.message ?? `HTTP ${statusCode}`;
      console.warn(
        `LLM Call | Transient failure (${reason}), retrying (attempt ${attempt + 1}/${maxAttempts})...`,
      );
      // Phase 16 (vision `04` §1): exponential backoff (5s/15s/45s) replaces
      // the old linear 1s*attempt wait; attempt counts unchanged.
      await transportRetrySleeper(transportRetryDelayMs(attempt));
    }
  }

  if (lastTransportError !== undefined) {
    throw new Error(`${providerName} API transport error after ${maxAttempts} attempt(s): ${lastTransportError.message}`);
  }

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`${providerName} API error (HTTP ${statusCode}): ${JSON.stringify(json)}`);
  }

  let parsed: ParsedProviderResponse;
  if (provider.startsWith('custom:')) {
    const config = modelRouting?.customProviders?.find((c) => c.id === provider.slice(7));
    parsed = parseCustomProviderResponse(json, config?.responseTemplate ?? { textPath: '' });
  } else if (provider === 'openai' || provider === 'qwen') {
    parsed = parseOpenAIResponse(json);
  } else {
    parsed = parseAnthropicResponse(json);
  }
  const inputTokens = parsed.inputTokens;
  const outputTokens = parsed.outputTokens;
  const prices = PRICE_PER_MTOK[model] ?? PRICE_PER_MTOK.default;
  const inputPrice = Number(process.env.ANTHROPIC_INPUT_PRICE_PER_MTOK ?? prices.input);
  const outputPrice = Number(process.env.ANTHROPIC_OUTPUT_PRICE_PER_MTOK ?? prices.output);
  const cost = (inputTokens * inputPrice + outputTokens * outputPrice) / 1_000_000;

  console.log(`LLM Call | Tokens: ${inputTokens}/${outputTokens} | Cost: $${cost.toFixed(4)}`);

  await appendLlmCallLog(options.logPath, {
    timestamp: new Date().toISOString(),
    callType: options.callType,
    context: options.context,
    provider,
    model,
    inputTokens,
    outputTokens,
    cost,
  });

  return parsed.text;
}

/**
 * Test whether a provider + API key + model can return a response. Sends a
 * tiny, cheap request using the same provider-specific request builders as
 * production, with `maxTokens: 1` and a minimal prompt. Does NOT use the
 * module-level model routing, does NOT retry, does NOT log to
 * `llm-calls.json`, and does NOT charge against the run's cost metrics.
 *
 * Returns `{ ok: true, message }` on a 2xx response with text, otherwise
 * `{ ok: false, message }` with the HTTP status + API error message or a
 * network/timeout description.
 */
export async function testModelConnection(
  provider: Provider,
  model: string,
  apiKey: string,
  customProviders?: import('../tui/settings').CustomProviderConfig[],
): Promise<{ ok: boolean; message: string }> {
  const providerName = provider.startsWith('custom:')
    ? customProviders?.find((c) => c.id === provider.slice(7))?.name ?? provider
    : provider === 'openai'
      ? 'OpenAI'
      : provider === 'qwen'
        ? 'Qwen'
        : 'Anthropic';

  let providerRequest: ProviderRequest;
  if (provider.startsWith('custom:')) {
    const config = customProviders?.find((c) => c.id === provider.slice(7));
    if (!config) {
      return { ok: false, message: `Custom provider '${provider.slice(7)}' not found in settings.` };
    }
    providerRequest = buildCustomProviderRequest(config, model, 'hi', undefined, { maxTokens: 1 }, apiKey);
  } else if (provider === 'openai' || provider === 'qwen') {
    providerRequest = buildOpenAIRequest(
      model,
      'hi',
      undefined,
      { maxTokens: 1 },
      apiKey,
      provider === 'qwen' ? QWEN_API_URL : OPENAI_API_URL,
      provider === 'qwen' ? 'max_tokens' : 'max_completion_tokens',
    );
  } else {
    providerRequest = buildAnthropicRequest(model, 'hi', undefined, { maxTokens: 1 }, apiKey);
  }

  let statusCode = 0;
  let json: (AnthropicResponse & OpenAIResponse & { error?: { message?: string } }) | undefined;
  let lastTransportError: Error | undefined;

  try {
    const response = await request(providerRequest.url, {
      method: 'POST',
      headers: providerRequest.headers,
      body: JSON.stringify(providerRequest.body),
      headersTimeout: 30_000,
    });
    statusCode = response.statusCode;
    json = (await response.body.json()) as AnthropicResponse &
      OpenAIResponse & { error?: { message?: string } };
  } catch (err) {
    lastTransportError = err as Error;
  }

  if (lastTransportError !== undefined) {
    return { ok: false, message: `${providerName} API transport error: ${lastTransportError.message}` };
  }

  if (statusCode < 200 || statusCode >= 300) {
    const apiMessage = json?.error?.message ?? JSON.stringify(json);
    return { ok: false, message: `${providerName} API error (HTTP ${statusCode}): ${apiMessage}` };
  }

  let parsed: ParsedProviderResponse;
  if (provider.startsWith('custom:')) {
    const config = customProviders?.find((c) => c.id === provider.slice(7));
    parsed = parseCustomProviderResponse(json, config?.responseTemplate ?? { textPath: '' });
  } else if (provider === 'openai' || provider === 'qwen') {
    parsed = parseOpenAIResponse(json);
  } else {
    parsed = parseAnthropicResponse(json);
  }
  if (parsed.text.length === 0) {
    return { ok: false, message: `${providerName} API returned an empty response.` };
  }
  return { ok: true, message: `Connected — ${providerName} model responded.` };
}
