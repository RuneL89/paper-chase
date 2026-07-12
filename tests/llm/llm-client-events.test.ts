import { describe, it, expect } from 'vitest';
import { LLMClient } from '../../src/llm/client.js';
import { CollectingReporter } from '../../src/progress/collecting-reporter.js';
import { DEFAULT_LLM_CONFIG } from '../../src/llm/types.js';

describe('LLMClient progress events', () => {
  it('emits llm-call-start and llm-call-end for a test provider call', async () => {
    const reporter = new CollectingReporter();
    const client = new LLMClient(
      {
        ...DEFAULT_LLM_CONFIG,
        enabled: true,
        provider: 'test',
        model: 'test',
      },
      undefined,
      reporter,
    );

    await client.call('You are the StructureAnalyst agent. Analyze this.');

    const events = reporter.getEvents();
    const start = events.find((e) => e.type === 'llm-call-start');
    const end = events.find((e) => e.type === 'llm-call-end');

    expect(start).toBeDefined();
    expect(end).toBeDefined();
    expect(start?.type).toBe('llm-call-start');
    expect(start?.agent).toBe('StructureAnalyst');
    expect(start?.provider).toBe('test');
    expect(start?.model).toBe('test');
    expect(end?.status).toBe('success');
  });

  it('emits error status when the LLM is disabled', async () => {
    const reporter = new CollectingReporter();
    const client = new LLMClient(
      {
        ...DEFAULT_LLM_CONFIG,
        enabled: false,
      },
      undefined,
      reporter,
    );

    await expect(client.call('Hello?')).rejects.toThrow('LLM is not configured or enabled');

    const end = reporter.getEvents().find((e) => e.type === 'llm-call-end');
    expect(end?.status).toBe('error');
  });

  it('emits retry events when a remote call fails and retries', async () => {
    const fetchFn = (async () => ({
      ok: false,
      status: 500,
      headers: { get: () => null },
      text: async () => 'error',
      json: async () => ({}),
    } as unknown as Response)) as unknown as typeof fetch;

    const reporter = new CollectingReporter();
    const client = new LLMClient(
      {
        ...DEFAULT_LLM_CONFIG,
        enabled: true,
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'test-key',
        maxRetries: 1,
        baseDelay: 1,
      },
      fetchFn,
      reporter,
    );

    await expect(client.call('Fail once.')).rejects.toThrow();

    const retries = reporter.getEvents().filter((e) => e.type === 'llm-call-retry');
    expect(retries.length).toBeGreaterThan(0);
    expect(retries[0].attempt).toBe(1);
  });
});
