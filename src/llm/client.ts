import { readFileSync, existsSync } from 'fs';
import path from 'path';
import {
  type LLMConfig,
  type LLMCallOptions,
  type LLMResponse,
  type LLMCallRecord,
  DEFAULT_LLM_CONFIG,
  estimateCost,
  estimateTokens,
} from './types.js';

export type { LLMConfig, LLMCallRecord, LLMResponse, LLMCallOptions };

export function loadLLMConfig(workspace: string): LLMConfig {
  const configPath = path.join(workspace, '.kimi-code', 'config.json');
  if (!existsSync(configPath)) {
    return { ...DEFAULT_LLM_CONFIG };
  }

  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    const llm = parsed.llm as Record<string, unknown> | undefined;
    if (!llm || llm.enabled === false) {
      return { ...DEFAULT_LLM_CONFIG };
    }

    const provider = String(llm.provider ?? 'test');
    if (!isKnownProvider(provider)) {
      return { ...DEFAULT_LLM_CONFIG };
    }

    return {
      provider,
      model: String(llm.model ?? 'unknown'),
      apiKey: llm.apiKey ? String(llm.apiKey) : undefined,
      baseUrl: llm.baseUrl ? String(llm.baseUrl) : undefined,
      enabled: true,
      maxRetries: typeof llm.maxRetries === 'number' ? llm.maxRetries : DEFAULT_LLM_CONFIG.maxRetries,
      baseDelay: typeof llm.baseDelay === 'number' ? llm.baseDelay : DEFAULT_LLM_CONFIG.baseDelay,
      concurrency: typeof llm.concurrency === 'number' ? llm.concurrency : DEFAULT_LLM_CONFIG.concurrency,
      maxRollingMemoryTokens: typeof llm.maxRollingMemoryTokens === 'number' ? llm.maxRollingMemoryTokens : DEFAULT_LLM_CONFIG.maxRollingMemoryTokens,
    };
  } catch {
    return { ...DEFAULT_LLM_CONFIG };
  }
}

function isKnownProvider(value: string): value is LLMConfig['provider'] {
  return ['openai', 'anthropic', 'openai-compatible', 'kimi', 'test'].includes(value);
}

export class LLMClient {
  private config: LLMConfig;
  private fetchFn: typeof fetch;

  constructor(config: LLMConfig, fetchFn?: typeof fetch) {
    this.config = config;
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  /**
   * Returns true when the LLM is configured and enabled.
   * When false, callers should fall back to local-only processing.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Sends a text prompt to the configured LLM provider.
   * Only text prompts are accepted; raw PDF buffers are rejected.
   */
  async call(prompt: string, options?: LLMCallOptions): Promise<LLMResponse> {
    if (typeof prompt !== 'string') {
      throw new Error(
        'LLM prompts must be strings. Raw PDFs or binary data must never be transmitted to a remote LLM.',
      );
    }

    if (!this.config.enabled) {
      return this.fallbackResponse(prompt);
    }

    const maxTokens = options?.maxTokens ?? 1024;
    const temperature = options?.temperature ?? 0.2;
    const verbose = options?.verbose ?? false;

    if (this.config.provider === 'test') {
      return this.mockResponse(prompt, maxTokens);
    }

    return this.remoteCall(prompt, maxTokens, temperature, verbose);
  }

  private fallbackResponse(prompt: string): LLMResponse {
    const tokens = estimateTokens(prompt);
    return {
      provider: 'local',
      model: 'none',
      text: 'LLM not configured; local-only processing was used.',
      estimatedTokens: tokens,
      estimatedCost: 0,
    };
  }

  private mockResponse(prompt: string, maxTokens: number): LLMResponse {
    const tokens = estimateTokens(prompt) + maxTokens;
    return {
      provider: this.config.provider,
      model: this.config.model,
      text: 'This is a test LLM response.',
      estimatedTokens: tokens,
      estimatedCost: estimateCost(this.config.provider, this.config.model, tokens),
    };
  }

  private async remoteCall(
    prompt: string,
    maxTokens: number,
    temperature: number,
    verbose: boolean,
  ): Promise<LLMResponse> {
    const maxRetries = this.config.maxRetries ?? 3;
    const baseDelay = this.config.baseDelay ?? 1000;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.providerCall(prompt, maxTokens, temperature, verbose);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === maxRetries) {
          break;
        }
        const delay = this.calculateDelay(attempt, baseDelay, undefined);
        await this.sleep(delay);
      }
    }

    throw lastError ?? new Error('LLM remote call failed after retries');
  }

  private async providerCall(
    prompt: string,
    maxTokens: number,
    temperature: number,
    verbose: boolean,
  ): Promise<LLMResponse> {
    const estimatedTokens = estimateTokens(prompt) + maxTokens;

    if (this.config.provider === 'anthropic') {
      return this.anthropicCall(prompt, maxTokens, temperature, estimatedTokens, verbose);
    }

    if (this.config.provider === 'kimi') {
      return this.kimiCall(prompt, maxTokens, temperature, estimatedTokens, verbose);
    }

    return this.openaiCompatibleCall(prompt, maxTokens, temperature, estimatedTokens, verbose);
  }

  private calculateDelay(attempt: number, baseDelay: number, retryAfter: number | undefined): number {
    if (retryAfter !== undefined && retryAfter > 0) {
      return retryAfter * 1000;
    }
    const exponential = baseDelay * 2 ** attempt;
    const jitter = Math.random() * exponential;
    return Math.min(exponential + jitter, 30000); // cap at 30 seconds
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async openaiCompatibleCall(
    prompt: string,
    maxTokens: number,
    temperature: number,
    estimatedTokens: number,
    verbose: boolean,
  ): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl ?? 'https://api.openai.com/v1';
    const url = `${baseUrl}/chat/completions`;

    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { total_tokens?: number };
    };
    if (verbose) {
      console.log('[LLM verbose] Raw response:', JSON.stringify(data, null, 2));
    }
    const text = data.choices?.[0]?.message?.content ?? '';
    const tokens = data.usage?.total_tokens ?? estimatedTokens;

    return {
      provider: this.config.provider,
      model: this.config.model,
      text,
      estimatedTokens: tokens,
      estimatedCost: estimateCost(this.config.provider, this.config.model, tokens),
    };
  }

  private async anthropicCall(
    prompt: string,
    maxTokens: number,
    temperature: number,
    estimatedTokens: number,
    verbose: boolean,
  ): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl ?? 'https://api.anthropic.com/v1';
    const url = `${baseUrl}/messages`;

    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as {
      content?: { type?: string; text?: string }[];
      usage?: {
        input_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
        output_tokens?: number;
      };
    };
    if (verbose) {
      console.log('[LLM verbose] Raw response:', JSON.stringify(data, null, 2));
    }
    const text =
      data.content?.find((block) => block.type === 'text')?.text ??
      data.content?.[0]?.text ??
      '';
    const inputTokens = data.usage?.input_tokens ?? 0;
    const cacheCreationTokens = data.usage?.cache_creation_input_tokens ?? 0;
    const cacheReadTokens = data.usage?.cache_read_input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    const tokens =
      inputTokens + cacheCreationTokens + cacheReadTokens + outputTokens || estimatedTokens;

    return {
      provider: this.config.provider,
      model: this.config.model,
      text,
      estimatedTokens: tokens,
      estimatedCost: estimateCost(this.config.provider, this.config.model, tokens),
    };
  }

  private async kimiCall(
    prompt: string,
    maxTokens: number,
    temperature: number,
    estimatedTokens: number,
    verbose: boolean,
  ): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl ?? 'https://api.kimi.com/coding';
    const url = `${baseUrl}/v1/messages`;

    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as {
      content?: { type?: string; text?: string }[];
      usage?: {
        input_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
        output_tokens?: number;
      };
    };
    if (verbose) {
      console.log('[LLM verbose] Raw response:', JSON.stringify(data, null, 2));
    }
    const text =
      data.content?.find((block) => block.type === 'text')?.text ??
      data.content?.[0]?.text ??
      '';
    const inputTokens = data.usage?.input_tokens ?? 0;
    const cacheCreationTokens = data.usage?.cache_creation_input_tokens ?? 0;
    const cacheReadTokens = data.usage?.cache_read_input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    const tokens =
      inputTokens + cacheCreationTokens + cacheReadTokens + outputTokens || estimatedTokens;

    return {
      provider: this.config.provider,
      model: this.config.model,
      text,
      estimatedTokens: tokens,
      estimatedCost: estimateCost(this.config.provider, this.config.model, tokens),
    };
  }

  toRecord(response: LLMResponse): LLMCallRecord {
    return {
      provider: response.provider,
      model: response.model,
      estimatedTokens: response.estimatedTokens,
      estimatedCost: response.estimatedCost,
    };
  }
}

export function createLLMClient(workspace: string, fetchFn?: typeof fetch): LLMClient {
  return new LLMClient(loadLLMConfig(workspace), fetchFn);
}

export { estimateCost, estimateTokens };
