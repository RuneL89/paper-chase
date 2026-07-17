import React, { useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { LoadingSpinner } from './components/spinner';
import { ErrorBox } from './components/error-box';
import { SuccessBox } from './components/success-box';
import { useWikiList } from './hooks/use-wiki-list';
import { useWikiDetails } from './hooks/use-wiki-details';
import { ingest } from '../commands/ingest';
import type { ScreenProps } from './init-screen';

export interface IngestScreenProps extends ScreenProps {
  /** Workspace directory containing wikis/ (used by tests; default '.'). */
  workspace?: string;
  /**
   * Passed through to ingest() (Phase 2, additive): run the Layer 2 Extractor
   * on each new chunk. Defaults to true; tests pass false to stay LLM-free.
   */
  extract?: boolean;
  /**
   * Phase 4: called after a successful ingest so the app can navigate to the
   * validation report for the wiki that was just ingested.
   */
  onViewReport?: (wiki: string) => void;
  /**
   * Injectable ingestion implementation (test-only). Defaults to the real
   * ingest command; tests can inject a stub to avoid disk I/O / LLM calls.
   */
  ingestFn?: (slug: string, options: Record<string, unknown>) => Promise<unknown>;
}

type IngestStatus = 'idle' | 'running' | 'success' | 'error';

const MAX_PROGRESS_LINES = 8;

function formatTimestamp(iso: string | null): string {
  return iso ? iso.slice(0, 16).replace('T', ' ') : 'never';
}

/**
 * Ingest PDFs screen (phase doc §5.2): lists existing wikis, shows the PDF
 * count in raw/ and the last ingest timestamp for the selected wiki, and
 * runs ingest() with a spinner and live progress lines
 * ("Extracting text...", "Chunk X/Y...", "Done!").
 */
export function IngestScreen({
  onBack,
  onResult,
  onViewReport,
  workspace = '.',
  extract = true,
  ingestFn,
}: IngestScreenProps) {
  const { isRawModeSupported } = useStdin();
  const wikis = useWikiList(workspace);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedWiki = wikis.length > 0 ? wikis[Math.min(selectedIndex, wikis.length - 1)] : undefined;
  const [refreshKey, setRefreshKey] = useState(0);
  const details = useWikiDetails(workspace, selectedWiki, refreshKey);
  const [status, setStatus] = useState<IngestStatus>('idle');
  const [progressLines, setProgressLines] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  const runIngest = async (wiki: string) => {
    setStatus('running');
    setProgressLines([]);
    try {
      const run = ingestFn ?? ingest;
      const result = (await run(wiki, {
        workspace,
        extract,
        onProgress: (line: string) => setProgressLines((prev) => [...prev, line].slice(-MAX_PROGRESS_LINES)),
      })) as { ingested: unknown[]; skipped: unknown[] };
      const summary = `Ingest complete: ${result.ingested.length} ingested, ${result.skipped.length} skipped.`;
      setStatus('success');
      setMessage(summary);
      onResult?.(summary);
      setRefreshKey((key) => key + 1);
      onViewReport?.(wiki);
    } catch (err) {
      const errorMessage = (err as Error).message;
      setStatus('error');
      setMessage(errorMessage);
      onResult?.(`Error: ${errorMessage}`);
    }
  };

  useInput(
    (_input, key) => {
      if (status === 'running') {
        return;
      }
      if (key.escape) {
        onBack();
        return;
      }
      if (status === 'success' || status === 'error') {
        if (key.return) {
          onBack();
        }
        return;
      }
      if (wikis.length === 0) {
        return;
      }
      if (key.upArrow) {
        setSelectedIndex((selectedIndex + wikis.length - 1) % wikis.length);
        return;
      }
      if (key.downArrow) {
        setSelectedIndex((selectedIndex + 1) % wikis.length);
        return;
      }
      if (key.return && selectedWiki) {
        void runIngest(selectedWiki);
      }
    },
    { isActive: isRawModeSupported === true },
  );

  return (
    <Box flexDirection="column">
      <Header />
      <Text bold>Ingest PDFs</Text>
      {wikis.length === 0 ? (
        <Text dimColor>No wikis found in {workspace}/wikis. Create one first (init).</Text>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Text>Select Wiki:</Text>
          {isRawModeSupported ? (
            wikis.map((wiki, index) => (
              <Text key={wiki} color={index === selectedIndex ? 'cyan' : undefined}>
                {index === selectedIndex ? '> ' : '  '}
                {wiki}
              </Text>
            ))
          ) : (
            // Non-TTY fallback (piped output, test runner): interactive
            // selection requires raw mode, so list wikis statically instead
            // of crashing (same contract as menu.tsx).
            wikis.map((wiki) => <Text key={wiki}> {wiki}</Text>)
          )}
          <Box flexDirection="column" marginTop={1}>
            <Text>PDFs in raw/: {details.pdfCount === null ? '...' : `${details.pdfCount} file(s)`}</Text>
            <Text>Last ingest: {formatTimestamp(details.lastIngest)}</Text>
          </Box>
        </Box>
      )}
      {status === 'running' && <LoadingSpinner label="Running ingest..." />}
      {progressLines.map((line, index) => (
        <Text key={index} dimColor={status === 'running'}>
          {line}
        </Text>
      ))}
      {status === 'success' && <SuccessBox message={message} />}
      {status === 'error' && <ErrorBox message={message} />}
      <Footer helpText="Up/Down: select wiki | Enter: run ingest | Press Escape to go back" />
    </Box>
  );
}
