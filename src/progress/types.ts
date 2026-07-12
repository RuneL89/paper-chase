export interface ProgressEventBase {
  timestamp: number;
}

export interface StepStartEvent extends ProgressEventBase {
  type: 'step-start';
  step: string;
  label: string;
  meta?: Record<string, unknown>;
}

export interface StepEndEvent extends ProgressEventBase {
  type: 'step-end';
  step: string;
  durationMs?: number;
}

export interface LlmCallStartEvent extends ProgressEventBase {
  type: 'llm-call-start';
  id: string;
  agent: string;
  provider: string;
  model: string;
  estimatedTokens: number;
  promptSummary: string;
}

export interface LlmCallEndEvent extends ProgressEventBase {
  type: 'llm-call-end';
  id: string;
  provider: string;
  model: string;
  estimatedTokens: number;
  estimatedCost: number;
  status: 'success' | 'error';
  error?: string;
}

export interface LlmCallRetryEvent extends ProgressEventBase {
  type: 'llm-call-retry';
  id: string;
  agent: string;
  attempt: number;
  error: string;
}

export interface SourceStartEvent extends ProgressEventBase {
  type: 'source-start';
  source: string;
  index: number;
  total: number;
}

export interface SourceEndEvent extends ProgressEventBase {
  type: 'source-end';
  source: string;
  status: 'success' | 'failure';
}

export interface ChunkProgressEvent extends ProgressEventBase {
  type: 'chunk-progress';
  source: string;
  chunkId: string;
  current: number;
  total: number;
}

export interface CriticIssuesEvent extends ProgressEventBase {
  type: 'critic-issues';
  count: number;
  issues: { severity: 'low' | 'medium' | 'high'; message: string }[];
}

export interface ProposalEvent extends ProgressEventBase {
  type: 'proposal';
  proposalType: string;
  reason: string;
  approved: boolean;
}

export interface WarningEvent extends ProgressEventBase {
  type: 'warning';
  message: string;
}

export interface ErrorEvent extends ProgressEventBase {
  type: 'error';
  message: string;
}

export interface SummaryEvent extends ProgressEventBase {
  type: 'summary';
  data: Record<string, unknown>;
}

export interface StatusEvent extends ProgressEventBase {
  type: 'status';
  message: string;
}

export type ProgressEvent =
  | StepStartEvent
  | StepEndEvent
  | LlmCallStartEvent
  | LlmCallEndEvent
  | LlmCallRetryEvent
  | SourceStartEvent
  | SourceEndEvent
  | ChunkProgressEvent
  | CriticIssuesEvent
  | ProposalEvent
  | WarningEvent
  | ErrorEvent
  | SummaryEvent
  | StatusEvent;

export interface ProgressReporter {
  emit(event: ProgressEvent): void;
  step<T>(step: string, label: string, fn: () => Promise<T>, meta?: Record<string, unknown>): Promise<T>;
  source<T>(source: string, index: number, total: number, fn: () => Promise<T>): Promise<T>;
  llmCall<T>(
    agent: string,
    id: string,
    provider: string,
    model: string,
    estimatedTokens: number,
    promptSummary: string,
    fn: () => Promise<{ estimatedTokens: number; estimatedCost: number; status: 'success' | 'error'; error?: string }>,
  ): Promise<void>;
  status(message: string): void;
  warning(message: string): void;
  error(message: string): void;
  summary(data: Record<string, unknown>): void;
  criticIssues(issues: { severity: 'low' | 'medium' | 'high'; message: string }[]): void;
  proposal(proposalType: string, reason: string, approved: boolean): void;
  chunkProgress(source: string, chunkId: string, current: number, total: number): void;
  retry(id: string, agent: string, attempt: number, error: string): void;
}

export class NoOpReporter implements ProgressReporter {
  emit(_event: ProgressEvent): void {}
  async step<T>(_step: string, _label: string, fn: () => Promise<T>): Promise<T> {
    return fn();
  }
  async source<T>(_source: string, _index: number, _total: number, fn: () => Promise<T>): Promise<T> {
    return fn();
  }
  async llmCall(
    _agent: string,
    _id: string,
    _provider: string,
    _model: string,
    _estimatedTokens: number,
    _promptSummary: string,
    fn: () => Promise<{ estimatedTokens: number; estimatedCost: number; status: 'success' | 'error'; error?: string }>,
  ): Promise<void> {
    await fn();
  }
  status(_message: string): void {}
  warning(_message: string): void {}
  error(_message: string): void {}
  summary(_data: Record<string, unknown>): void {}
  criticIssues(_issues: { severity: 'low' | 'medium' | 'high'; message: string }[]): void {}
  proposal(_proposalType: string, _reason: string, _approved: boolean): void {}
  chunkProgress(_source: string, _chunkId: string, _current: number, _total: number): void {}
  retry(_id: string, _agent: string, _attempt: number, _error: string): void {}
}
