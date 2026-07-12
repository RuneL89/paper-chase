import type {
  ProgressEvent,
  ProgressReporter,
  StepStartEvent,
  StepEndEvent,
  LlmCallStartEvent,
  LlmCallEndEvent,
  LlmCallRetryEvent,
  SourceStartEvent,
  SourceEndEvent,
  ChunkProgressEvent,
  CriticIssuesEvent,
  ProposalEvent,
  WarningEvent,
  ErrorEvent,
  SummaryEvent,
  StatusEvent,
} from './types.js';

export class CollectingReporter implements ProgressReporter {
  private events: ProgressEvent[] = [];

  getEvents(): readonly ProgressEvent[] {
    return this.events;
  }

  clear(): void {
    this.events = [];
  }

  emit(event: ProgressEvent): void {
    this.events.push(event);
  }

  async step<T>(
    step: string,
    label: string,
    fn: () => Promise<T>,
    meta?: Record<string, unknown>,
  ): Promise<T> {
    const start: StepStartEvent = {
      type: 'step-start',
      timestamp: Date.now(),
      step,
      label,
      meta,
    };
    this.emit(start);
    const startTime = Date.now();
    try {
      const result = await fn();
      const end: StepEndEvent = {
        type: 'step-end',
        timestamp: Date.now(),
        step,
        durationMs: Date.now() - startTime,
      };
      this.emit(end);
      return result;
    } catch (error) {
      const end: StepEndEvent = {
        type: 'step-end',
        timestamp: Date.now(),
        step,
        durationMs: Date.now() - startTime,
      };
      this.emit(end);
      throw error;
    }
  }

  async source<T>(
    source: string,
    index: number,
    total: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const start: SourceStartEvent = {
      type: 'source-start',
      timestamp: Date.now(),
      source,
      index,
      total,
    };
    this.emit(start);
    try {
      const result = await fn();
      const end: SourceEndEvent = {
        type: 'source-end',
        timestamp: Date.now(),
        source,
        status: 'success',
      };
      this.emit(end);
      return result;
    } catch (error) {
      const end: SourceEndEvent = {
        type: 'source-end',
        timestamp: Date.now(),
        source,
        status: 'failure',
      };
      this.emit(end);
      throw error;
    }
  }

  async llmCall(
    agent: string,
    id: string,
    provider: string,
    model: string,
    estimatedTokens: number,
    promptSummary: string,
    fn: () => Promise<{ estimatedTokens: number; estimatedCost: number; status: 'success' | 'error'; error?: string }>,
  ): Promise<void> {
    const start: LlmCallStartEvent = {
      type: 'llm-call-start',
      timestamp: Date.now(),
      id,
      agent,
      provider,
      model,
      estimatedTokens,
      promptSummary,
    };
    this.emit(start);
    const result = await fn();
    const end: LlmCallEndEvent = {
      type: 'llm-call-end',
      timestamp: Date.now(),
      id,
      provider,
      model,
      estimatedTokens: result.estimatedTokens,
      estimatedCost: result.estimatedCost,
      status: result.status,
      error: result.error,
    };
    this.emit(end);
  }

  status(message: string): void {
    const event: StatusEvent = {
      type: 'status',
      timestamp: Date.now(),
      message,
    };
    this.emit(event);
  }

  warning(message: string): void {
    const event: WarningEvent = {
      type: 'warning',
      timestamp: Date.now(),
      message,
    };
    this.emit(event);
  }

  error(message: string): void {
    const event: ErrorEvent = {
      type: 'error',
      timestamp: Date.now(),
      message,
    };
    this.emit(event);
  }

  summary(data: Record<string, unknown>): void {
    const event: SummaryEvent = {
      type: 'summary',
      timestamp: Date.now(),
      data,
    };
    this.emit(event);
  }

  criticIssues(issues: { severity: 'low' | 'medium' | 'high'; message: string }[]): void {
    const event: CriticIssuesEvent = {
      type: 'critic-issues',
      timestamp: Date.now(),
      count: issues.length,
      issues,
    };
    this.emit(event);
  }

  proposal(proposalType: string, reason: string, approved: boolean): void {
    const event: ProposalEvent = {
      type: 'proposal',
      timestamp: Date.now(),
      proposalType,
      reason,
      approved,
    };
    this.emit(event);
  }

  chunkProgress(source: string, chunkId: string, current: number, total: number): void {
    const event: ChunkProgressEvent = {
      type: 'chunk-progress',
      timestamp: Date.now(),
      source,
      chunkId,
      current,
      total,
    };
    this.emit(event);
  }

  retry(id: string, agent: string, attempt: number, error: string): void {
    const event: LlmCallRetryEvent = {
      type: 'llm-call-retry',
      timestamp: Date.now(),
      id,
      agent,
      attempt,
      error,
    };
    this.emit(event);
  }
}

export function createCollectingReporter(): CollectingReporter {
  return new CollectingReporter();
}
