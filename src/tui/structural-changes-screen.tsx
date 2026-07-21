import React, { useEffect, useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { LoadingSpinner } from './components/spinner';
import { ErrorBox } from './components/error-box';
import { useWikiList } from './hooks/use-wiki-list';
import { wikiDir } from '../utils/paths';
import { readStructuralChanges, type StructuralChange } from '../state/structural-changes';
import type { ScreenProps } from './init-screen';

export interface StructuralChangesScreenProps extends ScreenProps {
  /** Workspace directory containing wikis/ (used by tests; default '.'). */
  workspace?: string;
  /** If provided, the log loads automatically for this wiki. */
  wiki?: string;
}

type LogStatus = 'idle' | 'loading' | 'ready' | 'error';

const LOG_VIEWPORT_LINES = 12;
const LOG_LINE_STEP = 4;

function formatChange(change: StructuralChange): string[] {
  const timestamp = change.timestamp.slice(0, 16).replace('T', ' ');
  const label = change.type === 'new-folder' ? 'New folder' : change.type === 'new-page-type' ? 'New page type' : 'Reclassification';
  const lines = [`${timestamp}  ${label}: ${change.path}`, `  Reason: ${change.reason}`];
  if (change.affectedEntities && change.affectedEntities.length > 0) {
    lines.push(`  Entities: ${change.affectedEntities.join(', ')}`);
  }
  return lines;
}

/**
 * Structural Changes screen (Phase 9, phase doc §5.2): shows the structural
 * change log (`.state/proposals/structural-changes.json`, vision `03` §5) —
 * every new folder and page type discovered during ingestion, with
 * timestamps and reasons, for after-the-fact human review.
 *
 * Ink 7 conventions (src/AGENTS.md): useInput is gated on raw-mode support,
 * a static fallback renders without a TTY, Escape returns to the menu.
 */
export function StructuralChangesScreen({ onBack, workspace = '.', wiki: initialWiki }: StructuralChangesScreenProps) {
  const { isRawModeSupported } = useStdin();
  const wikis = useWikiList(workspace);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedWiki = wikis.length > 0 ? wikis[Math.min(selectedIndex, wikis.length - 1)] : undefined;
  const [activeWiki, setActiveWiki] = useState(initialWiki);
  const [status, setStatus] = useState<LogStatus>('idle');
  const [changes, setChanges] = useState<StructuralChange[]>([]);
  const [message, setMessage] = useState('');
  const [scrollOffset, setScrollOffset] = useState(0);

  const load = async (slug: string) => {
    setStatus('loading');
    setMessage('');
    setScrollOffset(0);
    try {
      const log = await readStructuralChanges(wikiDir(workspace, slug));
      setChanges(log.changes);
      setStatus('ready');
    } catch (err) {
      setMessage((err as Error).message);
      setStatus('error');
    }
  };

  useEffect(() => {
    if (initialWiki && wikis.length > 0 && wikis.includes(initialWiki)) {
      setActiveWiki(initialWiki);
    }
  }, [initialWiki, wikis]);

  useEffect(() => {
    if (activeWiki) {
      void load(activeWiki);
    }
  }, [activeWiki]); // eslint-disable-line react-hooks/exhaustive-deps

  const logLines: string[] = [];
  for (const change of changes) {
    logLines.push(...formatChange(change), '');
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
      if (status === 'ready' || status === 'error') {
        if (key.upArrow) {
          setScrollOffset((offset) => Math.max(0, offset - LOG_LINE_STEP));
        } else if (key.downArrow) {
          setScrollOffset((offset) => Math.min(maxScroll, offset + LOG_LINE_STEP));
        } else if (key.return) {
          onBack();
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

  return (
    <Box flexDirection="column" minHeight={12}>
      <Header />
      <Text bold>Structural Changes</Text>
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
            wikis.map((wiki) => <Text key={wiki}> {wiki}</Text>)
          )}
        </Box>
      )}
      {status === 'loading' && <LoadingSpinner label="Loading structural changes..." />}
      {status === 'error' && <ErrorBox message={message} />}
      {status === 'ready' && changes.length === 0 && (
        <Text dimColor>No structural changes logged for this wiki yet. They appear after an ingest creates new folders or page types.</Text>
      )}
      {status === 'ready' && changes.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {logLines.slice(scrollOffset, scrollOffset + LOG_VIEWPORT_LINES).map((line, index) => (
            <Text key={index} dimColor={line.startsWith('  ')}>
              {line}
            </Text>
          ))}
          {logLines.length > LOG_VIEWPORT_LINES && (
            <Text dimColor>
              (showing {scrollOffset + 1}-{Math.min(scrollOffset + LOG_VIEWPORT_LINES, logLines.length)} of {logLines.length})
            </Text>
          )}
        </Box>
      )}
      <Footer helpText={activeWiki ? 'Up/Down: scroll | Escape: back' : 'Up/Down: select wiki | Enter: view log | Escape: back'} />
    </Box>
  );
}
