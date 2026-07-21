import React, { useEffect, useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { LoadingSpinner } from './components/spinner';
import { ErrorBox } from './components/error-box';
import { useWikiList } from './hooks/use-wiki-list';
import { readMetrics, type IngestionMetrics } from '../state/metrics';
import { readConflicts, type ConflictsState } from '../state/conflicts';
import { wikiDir } from '../utils/paths';
import type { ScreenProps } from './init-screen';

export interface CompoundingLogScreenProps extends ScreenProps {
  /** Workspace directory containing wikis/ (used by tests; default '.'). */
  workspace?: string;
  /** If provided, the log for this wiki is shown automatically. */
  wiki?: string;
  /**
   * Injectable metrics/conflicts readers (test-only). Default to the real
   * state modules; tests inject stubs to avoid depending on disk contents.
   */
  readMetricsFn?: (wikiDir: string) => Promise<IngestionMetrics | null>;
  readConflictsFn?: (wikiDir: string) => Promise<ConflictsState>;
}

type LogStatus = 'idle' | 'loading' | 'done' | 'error';

const LOG_VIEWPORT_LINES = 12;
const LOG_LINE_STEP = 3;

function formatRunTimestamp(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ');
}

/**
 * Ingestion Log screen (Phase 8, phase doc §5.1): shows what changed in the
 * last ingest run for a wiki — run timestamp, new PDFs, new entities,
 * updated entities (with mention deltas), conflicts logged, and total LLM
 * cost — read deterministically from `.state/metrics.json` and
 * `.state/conflicts.json`. Long logs scroll with Up/Down; Escape goes back.
 *
 * Ink 7 conventions (src/AGENTS.md): useInput is gated on raw-mode support,
 * a static fallback renders without a TTY, Escape returns to the menu.
 */
export function CompoundingLogScreen({
  onBack,
  onResult,
  workspace = '.',
  wiki: initialWiki,
  readMetricsFn,
  readConflictsFn,
}: CompoundingLogScreenProps) {
  const { isRawModeSupported } = useStdin();
  const wikis = useWikiList(workspace);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedWiki = wikis.length > 0 ? wikis[Math.min(selectedIndex, wikis.length - 1)] : undefined;
  const [activeWiki, setActiveWiki] = useState(initialWiki);
  const [status, setStatus] = useState<LogStatus>('idle');
  const [metrics, setMetrics] = useState<IngestionMetrics | null>(null);
  const [conflicts, setConflicts] = useState<ConflictsState>({ conflicts: [] });
  const [errorMessage, setErrorMessage] = useState('');
  const [scrollOffset, setScrollOffset] = useState(0);

  const loadMetrics = readMetricsFn ?? readMetrics;
  const loadConflicts = readConflictsFn ?? readConflicts;

  const loadLog = async (slug: string) => {
    setStatus('loading');
    setMetrics(null);
    setErrorMessage('');
    setScrollOffset(0);
    try {
      const dir = wikiDir(workspace, slug);
      const [loadedMetrics, loadedConflicts] = await Promise.all([loadMetrics(dir), loadConflicts(dir)]);
      setMetrics(loadedMetrics);
      setConflicts(loadedConflicts);
      setStatus('done');
      onResult?.(
        loadedMetrics
          ? `Ingestion log for ${slug}: ${loadedMetrics.newEntities.length} new, ${loadedMetrics.updatedEntities.length} updated, ${loadedMetrics.conflicts} conflict(s).`
          : `No ingestion runs recorded for ${slug} yet.`,
      );
    } catch (err) {
      const message = (err as Error).message;
      setErrorMessage(message);
      setStatus('error');
      onResult?.(`Error: ${message}`);
    }
  };

  useEffect(() => {
    if (initialWiki && wikis.length > 0) {
      if (wikis.includes(initialWiki)) {
        setActiveWiki(initialWiki);
      }
    }
  }, [initialWiki, wikis]);

  useEffect(() => {
    if (activeWiki) {
      void loadLog(activeWiki);
    }
  }, [activeWiki]); // eslint-disable-line react-hooks/exhaustive-deps

  const logLines: string[] = [];
  if (metrics) {
    logLines.push(`Run: ${formatRunTimestamp(metrics.run)}`);
    logLines.push('');
    logLines.push(`New PDFs: ${metrics.newPdfs.length}`);
    for (const file of metrics.newPdfs) {
      logLines.push(`- ${file}`);
    }
    logLines.push('');
    logLines.push(`New Entities: ${metrics.newEntities.length}`);
    for (const entity of metrics.newEntities) {
      logLines.push(`- ${entity.title} (${entity.folder})`);
    }
    logLines.push('');
    logLines.push(`Updated Entities: ${metrics.updatedEntities.length}`);
    for (const entity of metrics.updatedEntities) {
      logLines.push(`- ${entity.title} (+${entity.addedMentions} mentions)`);
    }
    logLines.push('');
    logLines.push(`Conflicts: ${metrics.conflicts}`);
    for (const conflict of conflicts.conflicts) {
      if ('type' in conflict && conflict.type === 'manual-edit') {
        logLines.push(`- manual-edit: ${conflict.page}`);
      } else if ('pageType' in conflict) {
        logLines.push(`- preservation: ${conflict.pageType} ${conflict.slug}`);
      }
    }
    logLines.push('');
    logLines.push(`Total Cost: $${metrics.totalCost.toFixed(4)}`);
  }

  const maxScroll = Math.max(0, logLines.length - LOG_VIEWPORT_LINES);

  useInput(
    (_input, key) => {
      if (status === 'loading') {
        return;
      }
      if (key.escape) {
        onBack();
        return;
      }
      if (status === 'done' || status === 'error') {
        if (key.upArrow) {
          setScrollOffset((offset) => Math.max(0, offset - LOG_LINE_STEP));
        } else if (key.downArrow) {
          setScrollOffset((offset) => Math.min(maxScroll, offset + LOG_LINE_STEP));
        }
        return;
      }
      if (status === 'idle' && selectedWiki) {
        if (key.upArrow) {
          setSelectedIndex((idx) => (idx + wikis.length - 1) % wikis.length);
        } else if (key.downArrow) {
          setSelectedIndex((idx) => (idx + 1) % wikis.length);
        } else if (key.return) {
          setActiveWiki(selectedWiki);
        }
      }
    },
    { isActive: isRawModeSupported === true },
  );

  const visibleLines = logLines.slice(scrollOffset, scrollOffset + LOG_VIEWPORT_LINES);

  return (
    <Box flexDirection="column" minHeight={12}>
      <Header />
      <Text bold>Ingestion Log</Text>
      {activeWiki ? (
        <Text>Wiki: {activeWiki}</Text>
      ) : wikis.length === 0 ? (
        <Text dimColor>No wikis found in {workspace}/wikis.</Text>
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
        </Box>
      )}
      {status === 'loading' && <LoadingSpinner label="Loading ingestion log..." />}
      {status === 'error' && <ErrorBox message={errorMessage} />}
      {status === 'done' && !metrics && (
        <Text dimColor>No ingestion runs recorded yet. Run ingest first.</Text>
      )}
      {status === 'done' && metrics && (
        <Box flexDirection="column" marginTop={1}>
          {visibleLines.map((line, index) => (
            <Text key={index}>{line}</Text>
          ))}
          {logLines.length > LOG_VIEWPORT_LINES && (
            <Text dimColor>
              (showing {scrollOffset + 1}-{Math.min(scrollOffset + LOG_VIEWPORT_LINES, logLines.length)} of {logLines.length})
            </Text>
          )}
        </Box>
      )}
      <Footer
        helpText={
          activeWiki
            ? 'Up/Down: scroll | Escape: back'
            : 'Up/Down: select wiki | Enter: view log | Escape: back'
        }
      />
    </Box>
  );
}
