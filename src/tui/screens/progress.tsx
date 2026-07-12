import React, { useEffect, useState, useRef } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { ProgressEvent } from '../../progress/types.js';
import { createCollectingReporter } from '../../progress/collecting-reporter.js';
import { sampleCommand } from '../../commands/sample.js';
import { ingestCommand } from '../../commands/ingest.js';
import { Panel } from '../components/panel.js';
import { ProgressBar } from '../components/progress-bar.js';

interface ProgressScreenProps {
  workspace: string;
  operation: { type: 'sample' | 'ingest'; slug: string; pdfPath?: string };
  onComplete: (slug: string, summary: string, failed?: boolean) => void;
  onCancel: () => void;
}

interface LlmCall {
  id: string;
  agent: string;
  provider: string;
  model: string;
  estimatedTokens: number;
  estimatedCost: number;
  status: string;
  promptSummary: string;
  error?: string;
}

export function ProgressScreen({
  workspace,
  operation,
  onComplete,
  onCancel,
}: ProgressScreenProps): React.ReactElement {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [currentStep, setCurrentStep] = useState<string | undefined>(undefined);
  const [sourceProgress, setSourceProgress] = useState({ current: 0, total: 0, source: '' });
  const [chunkProgress, setChunkProgress] = useState({ current: 0, total: 0, source: '' });
  const [llmCalls, setLlmCalls] = useState<LlmCall[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [criticIssues, setCriticIssues] = useState<{ severity: string; message: string }[]>([]);
  const [done, setDone] = useState(false);
  const reporterRef = useRef(createCollectingReporter());
  const lastCountRef = useRef(0);
  const completedRef = useRef(false);

  useEffect(() => {
    const reporter = reporterRef.current;

    const interval = setInterval(() => {
      const allEvents = reporter.getEvents();
      if (allEvents.length === lastCountRef.current) {
        return;
      }
      lastCountRef.current = allEvents.length;
      setEvents([...allEvents]);

      const latestStep = allEvents
        .filter((e) => e.type === 'step-start')
        .pop();
      if (latestStep) {
        setCurrentStep(`${(latestStep as { step: string; label: string }).label}`);
      }

      const latestSource = allEvents
        .filter((e) => e.type === 'source-start')
        .pop();
      if (latestSource) {
        setSourceProgress({
          current: (latestSource as { index: number }).index,
          total: (latestSource as { total: number }).total,
          source: (latestSource as { source: string }).source,
        });
      }

      const latestChunk = allEvents
        .filter((e) => e.type === 'chunk-progress')
        .pop();
      if (latestChunk) {
        setChunkProgress({
          current: (latestChunk as { current: number }).current,
          total: (latestChunk as { total: number }).total,
          source: (latestChunk as { source: string }).source,
        });
      }

      const callMap = new Map<string, LlmCall>();
      for (const e of allEvents) {
        if (e.type === 'llm-call-start') {
          callMap.set(e.id, {
            id: e.id,
            agent: e.agent,
            provider: e.provider,
            model: e.model,
            estimatedTokens: e.estimatedTokens,
            estimatedCost: 0,
            status: 'running',
            promptSummary: e.promptSummary,
          });
        } else if (e.type === 'llm-call-end') {
          const existing = callMap.get(e.id);
          if (existing) {
            existing.status = e.status;
            existing.estimatedTokens = e.estimatedTokens;
            existing.estimatedCost = e.estimatedCost;
            existing.error = e.error;
          } else {
            callMap.set(e.id, {
              id: e.id,
              agent: 'unknown',
              provider: e.provider,
              model: e.model,
              estimatedTokens: e.estimatedTokens,
              estimatedCost: e.estimatedCost,
              status: e.status,
              promptSummary: '',
              error: e.error,
            });
          }
        }
      }
      setLlmCalls(Array.from(callMap.values()).slice(-10));

      setWarnings(allEvents.filter((e) => e.type === 'warning').map((e) => (e as { message: string }).message));
      setErrors(allEvents.filter((e) => e.type === 'error').map((e) => (e as { message: string }).message));

      const issues: { severity: string; message: string }[] = [];
      for (const e of allEvents) {
        if (e.type === 'critic-issues') {
          issues.push(...(e as { issues: { severity: string; message: string }[] }).issues);
        }
      }
      setCriticIssues(issues);
    }, 100);

    async function run(): Promise<void> {
      if (completedRef.current) {
        return;
      }
      try {
        if (operation.type === 'sample') {
          await sampleCommand(workspace, operation.slug, operation.pdfPath, reporter);
        } else {
          await ingestCommand(workspace, operation.slug, false, false, reporter);
        }
        completedRef.current = true;
        setDone(true);
        onComplete(operation.slug, 'Operation completed successfully.', false);
      } catch (err) {
        completedRef.current = true;
        const message = err instanceof Error ? err.message : String(err);
        setErrors((prev) => [...prev, message]);
        setDone(true);
        onComplete(operation.slug, `Operation failed: ${message}`, true);
      }
    }

    run();

    return () => clearInterval(interval);
  }, [operation, workspace]);

  return (
    <Box flexDirection="column" height="100%" gap={1}>
      <Box flexDirection="row" gap={1} height="60%">
        <Panel title="Operation" flexGrow={1}>
          <Box flexDirection="column" gap={1}>
            <Box flexDirection="row" gap={1}>
              {done ? <Text color="green">✓</Text> : <Spinner type="dots" />}
              <Text>{operation.type === 'sample' ? 'Sampling' : 'Ingesting'} {operation.slug}</Text>
            </Box>
            {currentStep && <Text dimColor>Current step: {currentStep}</Text>}
            {sourceProgress.total > 0 && (
              <ProgressBar
                current={sourceProgress.current}
                total={sourceProgress.total}
                label={`Source ${sourceProgress.current}/${sourceProgress.total}`}
              />
            )}
            {chunkProgress.total > 0 && (
              <ProgressBar
                current={chunkProgress.current}
                total={chunkProgress.total}
                label={`Chunk ${chunkProgress.current}/${chunkProgress.total}`}
              />
            )}
          </Box>
        </Panel>

        <Panel title="LLM Calls" flexGrow={2}>
          <Box flexDirection="column" gap={1}>
            {llmCalls.length === 0 ? (
              <Text dimColor>No LLM calls yet</Text>
            ) : (
              llmCalls.map((call) => (
                <Box key={call.id} flexDirection="column" gap={0}>
                  <Box flexDirection="row" gap={1}>
                    <Text bold>{call.agent}</Text>
                    <Text color={call.status === 'success' ? 'green' : call.status === 'error' ? 'red' : 'yellow'}>
                      {call.status}
                    </Text>
                    <Text dimColor>{call.provider}/{call.model}</Text>
                  </Box>
                  <Text dimColor>{call.promptSummary}</Text>
                  <Text dimColor>Tokens: {call.estimatedTokens} • Cost: ${call.estimatedCost.toFixed(6)}</Text>
                  {call.error && <Text color="red">{call.error}</Text>}
                </Box>
              ))
            )}
          </Box>
        </Panel>
      </Box>

      <Panel title="Issues" height={6}>
        <Box flexDirection="column" gap={0}>
          {warnings.length === 0 && errors.length === 0 && criticIssues.length === 0 && (
            <Text dimColor>No issues yet</Text>
          )}
          {warnings.map((w, i) => (
            <Text key={`w-${i}`} color="yellow">⚠ {w}</Text>
          ))}
          {criticIssues.map((issue, i) => (
            <Text key={`c-${i}`} color={issue.severity === 'high' ? 'red' : issue.severity === 'medium' ? 'yellow' : 'cyan'}>
              Critic [{issue.severity}]: {issue.message}
            </Text>
          ))}
          {errors.map((e, i) => (
            <Text key={`e-${i}`} color="red">✗ {e}</Text>
          ))}
        </Box>
      </Panel>
    </Box>
  );
}
