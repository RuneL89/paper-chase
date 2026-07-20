import { existsSync, readFileSync } from 'node:fs';
import { mkdir, appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { resolve } from 'node:path';
import { request } from 'undici';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Price table in USD per million tokens (MTok).
 * Claude Haiku 4.5: $1/MTok input, $5/MTok output.
 * Both can be overridden via ANTHROPIC_INPUT_PRICE_PER_MTOK and
 * ANTHROPIC_OUTPUT_PRICE_PER_MTOK. Unknown models fall back to the
 * Haiku 4.5 prices.
 */
const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  default: { input: 1, output: 5 },
};

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

interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: AnthropicUsage;
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
}

/** True for transient transport failures worth retrying (429/5xx, network). */
function isTransientStatus(statusCode: number): boolean {
  return statusCode === 429 || statusCode >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

interface LlmCallLogEntry {
  timestamp: string;
  callType?: string;
  context?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

async function appendLlmCallLog(logPath: string | undefined, entry: LlmCallLogEntry): Promise<void> {
  if (!logPath) {
    return;
  }
  try {
    await mkdir(dirname(logPath), { recursive: true });
    await appendFile(logPath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch {
    // Best-effort logging; do not let a write failure break the LLM call.
  }
}

/**
 * Call the Anthropic Messages API with a single user prompt (and optional
 * system prompt). Logs `LLM Call | Tokens: {input}/{output} | Cost: ${amount}`
 * for every call. Returns the raw response text.
 *
 * Retry policy (Phase 7 v1.1.0 amendment, vision `04` §6 / `07` §5): with
 * `options.maxRetries > 0`, transient transport failures (HTTP 429/5xx,
 * network errors) are retried with linear backoff up to that many EXTRA
 * attempts; deterministic failures (HTTP 4xx, including auth errors) always
 * throw immediately. With the default `maxRetries: 0` the behavior is the
 * frozen pre-amendment one: any failure throws on the first attempt.
 */
export async function callLLM(prompt: string, system?: string, options: CallLLMOptions = {}): Promise<string> {
  loadEnvFile();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Export it in your environment or add it to a .env file in the project root.',
    );
  }

  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;

  const requestBody: Record<string, unknown> = {
    model,
    max_tokens: options.maxTokens ?? 1024,
    messages: [{ role: 'user', content: prompt }],
  };
  if (system) {
    requestBody.system = system;
  }
  if (options.temperature !== undefined) {
    requestBody.temperature = options.temperature;
  }

  const maxAttempts = 1 + Math.max(0, options.maxRetries ?? 0);
  let statusCode = 0;
  let json: (AnthropicResponse & { error?: { message?: string } }) | undefined;
  let lastTransportError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    statusCode = 0;
    json = undefined;
    lastTransportError = undefined;
    try {
      const response = await request(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(requestBody),
      });
      statusCode = response.statusCode;
      json = (await response.body.json()) as AnthropicResponse & { error?: { message?: string } };
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
      await sleep(1000 * attempt);
    }
  }

  if (lastTransportError !== undefined) {
    throw new Error(`Anthropic API transport error after ${maxAttempts} attempt(s): ${lastTransportError.message}`);
  }

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`Anthropic API error (HTTP ${statusCode}): ${JSON.stringify(json)}`);
  }

  const text = (json?.content ?? [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('');

  const inputTokens = json?.usage?.input_tokens ?? 0;
  const outputTokens = json?.usage?.output_tokens ?? 0;
  const prices = PRICE_PER_MTOK[model] ?? PRICE_PER_MTOK.default;
  const inputPrice = Number(process.env.ANTHROPIC_INPUT_PRICE_PER_MTOK ?? prices.input);
  const outputPrice = Number(process.env.ANTHROPIC_OUTPUT_PRICE_PER_MTOK ?? prices.output);
  const cost = (inputTokens * inputPrice + outputTokens * outputPrice) / 1_000_000;

  console.log(`LLM Call | Tokens: ${inputTokens}/${outputTokens} | Cost: $${cost.toFixed(4)}`);

  await appendLlmCallLog(options.logPath, {
    timestamp: new Date().toISOString(),
    callType: options.callType,
    context: options.context,
    model,
    inputTokens,
    outputTokens,
    cost,
  });

  return text;
}
