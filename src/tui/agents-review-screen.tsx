import React, { useEffect, useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { copyFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { LoadingSpinner } from './components/spinner';
import { ErrorBox } from './components/error-box';
import { SuccessBox } from './components/success-box';
import { useWikiList } from './hooks/use-wiki-list';
import { wikiDir } from '../utils/paths';
import { diffLines, diffHunks, type LineDiff } from '../utils/line-diff';
import { readStructuralChanges, type StructuralChangeLog } from '../state/structural-changes';
import type { ScreenProps } from './init-screen';

export interface AgentsReviewScreenProps extends ScreenProps {
  /** Workspace directory containing wikis/ (used by tests; default '.'). */
  workspace?: string;
  /** If provided, the review loads automatically for this wiki. */
  wiki?: string;
}

type ReviewStatus = 'idle' | 'loading' | 'ready' | 'diff' | 'done' | 'error';

const COMPACT_DIFF_LINES = 5;
const FULL_DIFF_LINES = 12;
const DIFF_LINE_STEP = 4;

/**
 * Review AGENTS.md Updates screen — restored in Phase 11 v1.6.0 (user
 * directive 2026-07-23) from the Phase 9 implementation, adapted as a
 * FLOW-ONLY screen: it is NOT a main-menu item (the menu stays at exactly
 * five items, gate 11.3) and is reachable ONLY from the post-ingest
 * shortcut (the Ingest screen's `p` key when an ingest proposed AGENTS.md
 * updates). The screen shows the proposed constitution updates (new
 * folders, new page types) and an inline diff between the current AGENTS.md
 * and `.state/proposed-agents.md`.
 *
 * v1.6.0 semantics: Accept copies the proposal over AGENTS.md; Reject is a
 * NO-OP — nothing on the filesystem changes, the proposal file is KEPT for
 * later manual review (this supersedes the 2026-07-21 reject-deletes
 * preference). The updater itself never overwrites AGENTS.md — applying is
 * always an explicit human decision (vision `01` §5).
 *
 * Ink 7 conventions (src/AGENTS.md): useInput is gated on raw-mode support,
 * a static fallback renders without a TTY, Escape returns to the menu.
 */
export function AgentsReviewScreen({ onBack, onResult, workspace = '.', wiki: initialWiki }: AgentsReviewScreenProps) {
  const { isRawModeSupported } = useStdin();
  const wikis = useWikiList(workspace);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedWiki = wikis.length > 0 ? wikis[Math.min(selectedIndex, wikis.length - 1)] : undefined;
  const [activeWiki, setActiveWiki] = useState(initialWiki);
  const [status, setStatus] = useState<ReviewStatus>('idle');
  const [current, setCurrent] = useState('');
  const [proposal, setProposal] = useState<string | null>(null);
  const [structural, setStructural] = useState<StructuralChangeLog>({ changes: [], knownPageTypes: [] });
  const [diff, setDiff] = useState<LineDiff | null>(null);
  const [message, setMessage] = useState('');
  const [scrollOffset, setScrollOffset] = useState(0);

  const load = async (slug: string) => {
    setStatus('loading');
    setMessage('');
    setScrollOffset(0);
    try {
      const dir = wikiDir(workspace, slug);
      const currentText = await readFile(join(dir, 'AGENTS.md'), 'utf-8');
      let proposalText: string | null;
      try {
        proposalText = await readFile(join(dir, '.state', 'proposed-agents.md'), 'utf-8');
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          proposalText = null;
        } else {
          throw err;
        }
      }
      const structuralLog = await readStructuralChanges(dir);
      setCurrent(currentText);
      setProposal(proposalText);
      setStructural(structuralLog);
      setDiff(proposalText !== null ? diffLines(currentText, proposalText) : null);
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

  const accept = async () => {
    if (!activeWiki || proposal === null) {
      return;
    }
    try {
      const dir = wikiDir(workspace, activeWiki);
      await copyFile(join(dir, '.state', 'proposed-agents.md'), join(dir, 'AGENTS.md'));
      const resultMessage = `Accepted proposed AGENTS.md updates for ${activeWiki}.`;
      setMessage(resultMessage);
      setStatus('done');
      onResult?.(resultMessage);
    } catch (err) {
      setMessage((err as Error).message);
      setStatus('error');
    }
  };

  const reject = async () => {
    if (!activeWiki) {
      return;
    }
    try {
      // Phase 11 v1.6.0 (user directive 2026-07-23): Reject is a NO-OP —
      // AGENTS.md is untouched AND the proposal file stays on disk for
      // later manual review (supersedes the 2026-07-21 reject-deletes
      // preference). Nothing to do but report.
      const resultMessage = `Rejected proposed AGENTS.md updates for ${activeWiki}. No changes made.`;
      setMessage(resultMessage);
      setStatus('done');
      onResult?.(resultMessage);
    } catch (err) {
      setMessage((err as Error).message);
      setStatus('error');
    }
  };

  const newFolders = structural.changes.filter((change) => change.type === 'new-folder');
  const newPageTypes = structural.changes.filter((change) => change.type === 'new-page-type');
  const hunkLines = diff ? diffHunks(diff) : [];
  const viewportLines = status === 'diff' ? FULL_DIFF_LINES : COMPACT_DIFF_LINES;
  const maxScroll = Math.max(0, hunkLines.length - viewportLines);

  useInput(
    (input, key) => {
      if (status === 'loading') {
        return;
      }
      if (key.escape) {
        if (status === 'diff') {
          setStatus('ready');
          return;
        }
        onBack();
        return;
      }
      if (status === 'done' || status === 'error') {
        if (key.return) {
          onBack();
        }
        return;
      }
      if (proposal !== null && (status === 'ready' || status === 'diff')) {
        if (input === 'a' || input === 'A') {
          void accept();
          return;
        }
        if (input === 'r' || input === 'R') {
          void reject();
          return;
        }
      }
      if (status === 'diff') {
        if (key.upArrow) {
          setScrollOffset((offset) => Math.max(0, offset - DIFF_LINE_STEP));
        } else if (key.downArrow) {
          setScrollOffset((offset) => Math.min(maxScroll, offset + DIFF_LINE_STEP));
        }
        return;
      }
      if (status === 'ready') {
        if (proposal !== null) {
          if (key.upArrow || key.downArrow) {
            if (key.upArrow) {
              setScrollOffset((offset) => Math.max(0, offset - DIFF_LINE_STEP));
            } else {
              setScrollOffset((offset) => Math.min(maxScroll, offset + DIFF_LINE_STEP));
            }
            return;
          }
          if (input === 'v' || input === 'V') {
            setScrollOffset(0);
            setStatus('diff');
            return;
          }
        }
        if (key.return) {
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
      <Text bold>Review AGENTS.md Updates</Text>
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
      {status === 'loading' && <LoadingSpinner label="Loading proposal..." />}
      {status === 'error' && <ErrorBox message={message} />}
      {status === 'done' && <SuccessBox message={message} />}
      {(status === 'ready' || status === 'diff') && proposal === null && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>No proposal found for this wiki.</Text>
          <Text dimColor>Run an ingest with AGENTS.md updates enabled (Ingest screen toggle or --update-agents).</Text>
          {newFolders.length === 0 && newPageTypes.length === 0 ? null : (
            <Text dimColor>Structural changes are logged under View Structural Changes.</Text>
          )}
        </Box>
      )}
      {status === 'ready' && proposal !== null && diff !== null && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Proposed changes:</Text>
          {newFolders.length === 0 && newPageTypes.length === 0 ? (
            <Text> (no structural changes logged)</Text>
          ) : (
            <>
              {newFolders.map((change) => (
                <Text key={`f-${change.path}`}> + Added folder: {change.path}</Text>
              ))}
              {newPageTypes.map((change) => (
                <Text key={`t-${change.path}`}> + Added page type: {change.path}</Text>
              ))}
            </>
          )}
          <Text>
            Diff: {diff.added} lines added, {diff.removed} removed
          </Text>
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Diff preview:</Text>
            {hunkLines.slice(scrollOffset, scrollOffset + COMPACT_DIFF_LINES).map((line, index) => (
              <Text
                key={index}
                color={line.startsWith('+') ? 'green' : line.startsWith('-') ? 'red' : undefined}
                dimColor={line === '...' || line.startsWith('  ')}
              >
                {line}
              </Text>
            ))}
            {hunkLines.length > COMPACT_DIFF_LINES && (
              <Text dimColor>
                (showing {scrollOffset + 1}-{Math.min(scrollOffset + COMPACT_DIFF_LINES, hunkLines.length)} of {hunkLines.length}; Up/Down to scroll)
              </Text>
            )}
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text>[A] Accept   [R] Reject   [V] View Full Diff</Text>
          </Box>
        </Box>
      )}
      {status === 'diff' && diff !== null && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Full Diff ({diff.added} added, {diff.removed} removed):</Text>
          {hunkLines.slice(scrollOffset, scrollOffset + FULL_DIFF_LINES).map((line, index) => (
            <Text
              key={index}
              color={line.startsWith('+') ? 'green' : line.startsWith('-') ? 'red' : undefined}
              dimColor={line === '...' || line.startsWith('  ')}
            >
              {line}
            </Text>
          ))}
          {hunkLines.length > FULL_DIFF_LINES && (
            <Text dimColor>
              (showing {scrollOffset + 1}-{Math.min(scrollOffset + FULL_DIFF_LINES, hunkLines.length)} of {hunkLines.length})
            </Text>
          )}
          <Box marginTop={1}>
            <Text>[A] Accept   [R] Reject   [Escape] Back to summary</Text>
          </Box>
        </Box>
      )}
      <Footer
        helpText={
          status === 'diff'
            ? 'Up/Down: scroll | A: accept | R: reject | Escape: back to summary'
            : activeWiki
              ? 'Up/Down: scroll diff | A: accept | R: reject | V: full diff | Escape: back'
              : 'Up/Down: select wiki | Enter: review | Escape: back'
        }
      />
    </Box>
  );
}
