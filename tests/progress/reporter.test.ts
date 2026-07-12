import { describe, it, expect } from 'vitest';
import { createCollectingReporter } from '../../src/progress/collecting-reporter.js';
import type { ProgressEvent } from '../../src/progress/types.js';

describe('CollectingReporter', () => {
  it('records step start and end events', async () => {
    const reporter = createCollectingReporter();
    await reporter.step('test-step', 'Test step', async () => {
      await Promise.resolve();
      return 'done';
    });

    const events = reporter.getEvents();
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('step-start');
    expect(events[0]).toMatchObject({
      step: 'test-step',
      label: 'Test step',
    });
    expect(events[1].type).toBe('step-end');
    expect(events[1]).toMatchObject({ step: 'test-step' });
    expect((events[1] as { durationMs?: number }).durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records source start and end events', async () => {
    const reporter = createCollectingReporter();
    await reporter.source('report.pdf', 1, 3, async () => 'ok');

    const events = reporter.getEvents();
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: 'source-start', source: 'report.pdf', index: 1, total: 3 });
    expect(events[1]).toMatchObject({ type: 'source-end', source: 'report.pdf', status: 'success' });
  });

  it('records failed source as failure', async () => {
    const reporter = createCollectingReporter();
    await expect(
      reporter.source('bad.pdf', 1, 1, async () => {
        throw new Error('extraction failed');
      }),
    ).rejects.toThrow('extraction failed');

    const events = reporter.getEvents();
    const endEvent = events.find((e) => e.type === 'source-end');
    expect(endEvent).toMatchObject({ type: 'source-end', source: 'bad.pdf', status: 'failure' });
  });

  it('records LLM call events', async () => {
    const reporter = createCollectingReporter();
    await reporter.llmCall(
      'structure-analyst',
      'llm-1',
      'kimi',
      'k2.7-code',
      1234,
      'Summarize structure',
      async () => ({
        estimatedTokens: 1234,
        estimatedCost: 0.001,
        status: 'success' as const,
      }),
    );

    const events = reporter.getEvents();
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: 'llm-call-start',
      id: 'llm-1',
      agent: 'structure-analyst',
      provider: 'kimi',
      model: 'k2.7-code',
      estimatedTokens: 1234,
      promptSummary: 'Summarize structure',
    });
    expect(events[1]).toMatchObject({
      type: 'llm-call-end',
      id: 'llm-1',
      status: 'success',
      estimatedTokens: 1234,
      estimatedCost: 0.001,
    });
  });

  it('records warning and error events', () => {
    const reporter = createCollectingReporter();
    reporter.warning('Low quality output');
    reporter.error('Extraction failed');

    const events = reporter.getEvents();
    expect(events[0]).toMatchObject({ type: 'warning', message: 'Low quality output' });
    expect(events[1]).toMatchObject({ type: 'error', message: 'Extraction failed' });
  });

  it('records critic issues and proposals', () => {
    const reporter = createCollectingReporter();
    reporter.criticIssues([
      { severity: 'high', message: 'Missing citation' },
      { severity: 'medium', message: 'Weak link' },
    ]);
    reporter.proposal('new-folder', 'Add a timeline folder', true);

    const events = reporter.getEvents();
    const criticEvent = events.find((e) => e.type === 'critic-issues') as {
      count: number;
      issues: { severity: string; message: string }[];
    };
    expect(criticEvent.count).toBe(2);
    expect(criticEvent.issues).toHaveLength(2);

    const proposalEvent = events.find((e) => e.type === 'proposal') as {
      proposalType: string;
      reason: string;
      approved: boolean;
    };
    expect(proposalEvent).toMatchObject({
      proposalType: 'new-folder',
      reason: 'Add a timeline folder',
      approved: true,
    });
  });

  it('records chunk progress', () => {
    const reporter = createCollectingReporter();
    reporter.chunkProgress('report.pdf', 'chunk-1', 2, 5);

    const events = reporter.getEvents();
    expect(events[0]).toMatchObject({
      type: 'chunk-progress',
      source: 'report.pdf',
      chunkId: 'chunk-1',
      current: 2,
      total: 5,
    });
  });

  it('records status and summary', () => {
    const reporter = createCollectingReporter();
    reporter.status('Processing 3 sources');
    reporter.summary({ sourceFiles: 3 });

    const events = reporter.getEvents();
    expect(events[0]).toMatchObject({ type: 'status', message: 'Processing 3 sources' });
    expect(events[1]).toMatchObject({ type: 'summary', data: { sourceFiles: 3 } });
  });

  it('clears recorded events', () => {
    const reporter = createCollectingReporter();
    reporter.status('first');
    reporter.clear();
    expect(reporter.getEvents()).toHaveLength(0);
  });
});

describe('NoOpReporter', () => {
  it('does not throw when emitting events', async () => {
    const { NoOpReporter } = await import('../../src/progress/types.js');
    const reporter = new NoOpReporter();
    expect(() => {
      reporter.emit({ type: 'status', timestamp: Date.now(), message: 'test' } as ProgressEvent);
      reporter.status('status');
      reporter.warning('warning');
      reporter.error('error');
      reporter.criticIssues([]);
      reporter.proposal('type', 'reason', true);
      reporter.chunkProgress('s', 'c', 1, 2);
      reporter.retry('id', 'agent', 1, 'error');
      reporter.summary({});
    }).not.toThrow();
  });

  it('passes through step functions', async () => {
    const { NoOpReporter } = await import('../../src/progress/types.js');
    const reporter = new NoOpReporter();
    const result = await reporter.step('s', 'l', async () => 'value');
    expect(result).toBe('value');
  });
});
