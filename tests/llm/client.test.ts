import { describe, it, expect } from 'vitest';
import { LLMClient, createLLMClient } from '../../src/llm/client.js';
import { DEFAULT_LLM_CONFIG } from '../../src/llm/types.js';

function mockFetch(responses: { ok: boolean; status: number; json: unknown; retryAfter?: string }[]): typeof fetch {
  let callIndex = 0;
  return (async () => {
    const response = responses[callIndex] ?? { ok: true, status: 200, json: {} };
    callIndex += 1;
    return {
      ok: response.ok,
      status: response.status,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'retry-after' ? response.retryAfter ?? null : null),
      },
      text: async () => 'error',
      json: async () => response.json,
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe('LLM client test provider', () => {
  it('TAC-001: test provider returns deterministic text without network calls', async () => {
    const client = new LLMClient({
      ...DEFAULT_LLM_CONFIG,
      enabled: true,
      provider: 'test',
      model: 'test',
    });

    const response = await client.call('Hello, test provider.');
    expect(response.text).toBe('This is a test LLM response.');
    expect(response.provider).toBe('test');
    expect(response.model).toBe('test');
  });

  it('TAC-002: disabled client throws a CLIError', async () => {
    const client = new LLMClient({
      ...DEFAULT_LLM_CONFIG,
      enabled: false,
    });

    await expect(client.call('Hello?')).rejects.toThrow('LLM is not configured or enabled');
  });

  it('TAC-003: rejects non-string prompts', async () => {
    const client = new LLMClient({
      ...DEFAULT_LLM_CONFIG,
      enabled: true,
      provider: 'test',
    });

    await expect(client.call(Buffer.from('pdf') as unknown as string)).rejects.toThrow(
      'LLM prompts must be strings',
    );
  });

  it('TAC-005: retries a failing remote call up to maxRetries', async () => {
    const fetchFn = mockFetch([
      { ok: false, status: 500, json: {} },
      { ok: false, status: 500, json: {} },
      {
        ok: true,
        status: 200,
        json: {
          choices: [{ message: { content: 'success after retries' } }],
          usage: { total_tokens: 10 },
        },
      },
    ]);

    const client = new LLMClient(
      {
        ...DEFAULT_LLM_CONFIG,
        enabled: true,
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'test-key',
        maxRetries: 3,
        baseDelay: 1,
      },
      fetchFn,
    );

    const response = await client.call('Retry me.');
    expect(response.text).toBe('success after retries');
  });

  it('TAC-006: throws after exhausting retries', async () => {
    const fetchFn = mockFetch([
      { ok: false, status: 500, json: {} },
      { ok: false, status: 500, json: {} },
      { ok: false, status: 500, json: {} },
      { ok: false, status: 500, json: {} },
    ]);

    const client = new LLMClient(
      {
        ...DEFAULT_LLM_CONFIG,
        enabled: true,
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'test-key',
        maxRetries: 2,
        baseDelay: 1,
      },
      fetchFn,
    );

    await expect(client.call('Always fail.')).rejects.toThrow('LLM request failed: 500 error');
  });
});
