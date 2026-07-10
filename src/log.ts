import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import type { LLMCallRecord } from './llm/types.js';

export interface ChunkBoundaryRecord {
  source: string;
  boundary: string;
  pageRange: string;
}

export interface PageCountRecord {
  type: string;
  count: number;
}

export interface RunLog {
  command: string;
  timestamp: string;
  workspace: string;
  wikiSlugs: string[];
  sourceFiles: string[];
  chunkBoundaries: ChunkBoundaryRecord[];
  pagesGenerated: PageCountRecord[];
  warnings: string[];
  errors: string[];
  status: string;
  cliVersion: string;
  configVersions: Record<string, string>;
  llmCalls: LLMCallRecord[];
  lintIssues?: number;
  samplingStrategy?: {
    category: string;
    reason: string;
  };
  llmProvider?: string;
  llmModel?: string;
  llmTokens?: number;
  added?: string[];
  changed?: string[];
  removed?: string[];
  proposal?: string;
}

export function writeRunLog(workspace: string, log: RunLog): string {
  const now = new Date();
  const dateStamp = now.toISOString().replace(/:/g, '-').replace('T', '_').split('.')[0];
  const fileName = `${dateStamp}_${log.command}.json`;
  const logDir = path.join(workspace, '.kimi-code', 'logs');
  mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, fileName);
  writeFileSync(logPath, JSON.stringify(log, null, 2) + '\n');
  return logPath;
}

export function buildRunLog(
  command: string,
  workspace: string,
  options: {
    wikiSlugs?: string[];
    sourceFiles?: string[];
    chunkBoundaries?: ChunkBoundaryRecord[];
    pagesGenerated?: PageCountRecord[];
    warnings?: string[];
    errors?: string[];
    status?: 'success' | 'partial' | 'failed';
    cliVersion?: string;
    configVersions?: Record<string, string>;
    llmCalls?: LLMCallRecord[];
    lintIssues?: number;
    samplingStrategy?: {
      category: string;
      reason: string;
    };
    llmProvider?: string;
    llmModel?: string;
    llmTokens?: number;
    added?: string[];
    changed?: string[];
    removed?: string[];
    proposal?: string;
  } = {},
): RunLog {
  return {
    command,
    timestamp: new Date().toISOString(),
    workspace,
    wikiSlugs: options.wikiSlugs ?? [],
    sourceFiles: options.sourceFiles ?? [],
    chunkBoundaries: options.chunkBoundaries ?? [],
    pagesGenerated: options.pagesGenerated ?? [],
    warnings: options.warnings ?? [],
    errors: options.errors ?? [],
    status: options.status ?? 'success',
    cliVersion: options.cliVersion ?? '0.0.1',
    configVersions: options.configVersions ?? {},
    llmCalls: options.llmCalls ?? [],
    lintIssues: options.lintIssues,
    samplingStrategy: options.samplingStrategy,
    llmProvider: options.llmProvider,
    llmModel: options.llmModel,
    llmTokens: options.llmTokens,
    added: options.added,
    changed: options.changed,
    removed: options.removed,
    proposal: options.proposal,
  };
}
