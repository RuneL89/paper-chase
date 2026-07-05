export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'openai-compatible' | 'kimi' | 'test';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface LLMCallRecord {
  provider: string;
  model: string;
  estimatedTokens: number;
  estimatedCost: number;
}

export interface LLMCallOptions {
  maxTokens?: number;
  temperature?: number;
  verbose?: boolean;
}

export interface LLMResponse {
  provider: string;
  model: string;
  text: string;
  estimatedTokens: number;
  estimatedCost: number;
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'test',
  model: 'local',
  enabled: false,
};

export function estimateCost(provider: string, model: string, tokens: number): number {
  // Simplified cost model for MVP: record a small estimated cost per 1k tokens.
  // These are placeholder rates; they are never used for billing.
  const rates: Record<string, number> = {
    'openai:gpt-4': 0.03,
    'openai:gpt-4o': 0.005,
    'openai:gpt-3.5-turbo': 0.0005,
    'anthropic:claude-3-opus': 0.015,
    'anthropic:claude-3-sonnet': 0.003,
    'anthropic:claude-3-haiku': 0.00025,
    'kimi:k2.7-code': 0.0005,
    'kimi:kimi-k2-0711-preview': 0.0005,
  };
  const rate = rates[`${provider}:${model}`] ?? 0.001;
  return Number(((tokens / 1000) * rate).toFixed(6));
}

export function estimateTokens(text: string): number {
  // Simple word-based approximation; actual token counts depend on the tokenizer.
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.35);
}
