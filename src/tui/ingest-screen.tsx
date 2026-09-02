import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { LoadingSpinner } from './components/spinner';
import { ErrorBox } from './components/error-box';
import { SuccessBox } from './components/success-box';
import { useWikiList, type WikiRef } from './hooks/use-wiki-list';
import { useWikiDetails } from './hooks/use-wiki-details';
import { ingest, formatIngestSummary, type IngestResult } from '../commands/ingest';
import {
  runIngestConductor,
  type CrashPanelState,
  type CrashDecision,
} from './ingest-conductor';
import { loadSettings } from './settings';
import { readWikiLanguage, type WikiLanguageState } from '../state/language';
import { SUPPORTED_LANGUAGES } from '../utils/language';
import { wikiDir } from '../utils/paths';
import type { ScreenProps } from './init-screen';

export interface IngestScreenProps extends ScreenProps {
  /** Workspace directory containing wikis/ (used by tests; default '.'). */
  workspace?: string;
  /**
   * 2026-08-28: every registered workspace — the selector aggregates the
   * wikis of ALL of them (workspace labels shown when there is more than
   * one). Falls back to `[workspace ?? '.']` so single-workspace callers
   * behave exactly as before.
   */
  workspaces?: string[];
  /**
   * Passed through to ingest() (Phase 2, additive): run the Layer 2 Extractor
   * on each new chunk. Defaults to true; tests pass false to stay LLM-free.
   */
  extract?: boolean;
  /**
   * Phase 11 (phase doc §2.4, Gate 11.4): continuous workflow — pre-select
   * this wiki in the list (set after the post-add "Start ingesting now?"
   * prompt is confirmed). 2026-08-28: the workspace rides along so the run
   * targets the wiki's own folder.
   */
  initialWiki?: WikiRef;
  /**
   * Injectable ingestion implementation (test-only). Defaults to the real
   * ingest command; tests can inject a stub to avoid disk I/O / LLM calls.
   */
  ingestFn?: (slug: string, options: Record<string, unknown>) => Promise<unknown>;
  /**
   * Phase 27 (test-only): injectable conductor — defaults to the real
   * `runIngestConductor`. When `ingestFn` is ALSO provided the in-process
   * seam wins (existing tests keep the pre-Phase-27 byte-identical path).
   */
  conductorFn?: typeof import('./ingest-conductor').runIngestConductor;
  /**
   * Phase 11 v1.6.0 (user directive 2026-07-23): post-ingest review shortcut.
   * When a run completes with `agentsUpdateProposed: true`, the success state
   * shows a hint and pressing `p` invokes this callback with the ingested
   * wiki (the App routes to the flow-only AGENTS.md review screen).
   */
  onReviewAgents?: (wiki: WikiRef) => void;
}

type IngestStatus = 'idle' | 'confirm' | 'running' | 'success' | 'error';
type FocusedControl = 'wiki' | 'input' | 'output';
const FOCUS_ORDER: FocusedControl[] = ['wiki', 'input', 'output'];

const MAX_PROGRESS_LINES = 8;

function formatTimestamp(iso: string | null): string {
  return iso ? iso.slice(0, 16).replace('T', ' ') : 'never';
}

function languageIndexOf(code: string): number {
  const index = SUPPORTED_LANGUAGES.findIndex((language) => language.code === code);
  return index >= 0 ? index : 0;
}

const CHUNK_PROGRESS_PATTERN = /^Chunk (\d+)\/(\d+)/;
const PROGRESS_BAR_CELLS = 10;

/**
 * Phase 11 (phase doc §2.4): prefix "Chunk X/Y ..." progress lines with a
 * plain-text progress bar, e.g. "[██████████] Chunk 1/1 (pages 1-3)". No
 * external progress-bar library; proportional fill.
 */
function withProgressBar(line: string): string {
  const match = CHUNK_PROGRESS_PATTERN.exec(line);
  if (!match) {
    return line;
  }
  const current = Number(match[1]);
  const total = Number(match[2]);
  const filled = total > 0 ? Math.round((current / total) * PROGRESS_BAR_CELLS) : 0;
  const bar = '█'.repeat(filled) + '░'.repeat(PROGRESS_BAR_CELLS - filled);
  return `[${bar}] ${line}`;
}

/**
 * Ingest PDFs screen (phase doc §5.2): lists existing wikis, shows the PDF
 * count in raw/ and the last ingest timestamp for the selected wiki, and
 * runs ingest() with a spinner and live progress lines
 * ("Extracting text...", "Chunk X/Y...", "Done!").
 *
 * Phase 5: adds an "Enable Synthesis" checkbox pre-checked from
 * `.paper-chase.json`. When checked, ingest runs with `synthesis: true`.
 *
 * Phase 7 (vision `04` §9): Input Language and Output Language dropdown
 * selectors (Tab moves focus between the wiki list and the dropdowns,
 * Up/Down or Left/Right cycles the focused dropdown). Input pre-selects the
 * wiki's `lastInputLanguage`, Output the wiki's `outputLanguage`. When the
 * chosen input language differs from the last run and the wiki already has
 * extractions, an inline slug-forking warning appears and starting requires
 * an explicit confirm (Enter to proceed, Escape to cancel).
 */
export function IngestScreen({
  onBack,
  onResult,
  workspace,
  workspaces,
  extract = true,
  initialWiki,
  ingestFn,
  conductorFn,
  onReviewAgents,
}: IngestScreenProps) {
  const { isRawModeSupported } = useStdin();
  const list = workspaces ?? [workspace ?? '.'];
  const wikis = useWikiList(list);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedWiki = wikis.length > 0 ? wikis[Math.min(selectedIndex, wikis.length - 1)] : undefined;
  const [refreshKey, setRefreshKey] = useState(0);
  const details = useWikiDetails(selectedWiki?.workspace ?? list[0], selectedWiki?.slug, refreshKey);
  const [status, setStatus] = useState<IngestStatus>('idle');
  const [progressLines, setProgressLines] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [synthesis, setSynthesis] = useState(false);
  // Phase 9: opt-in AGENTS.md update proposal (phase doc §2.3 CLI flag made
  // TUI-accessible per the 2026-07-17 all-workflows-in-TUI user preference).
  const [updateAgents, setUpdateAgents] = useState(false);
  // Phase 24 (user-ratified extension 2026-08-14): force the Cross-Wiki Discovery
  // pass to run even when the deterministic preflight would skip it.
  const [forceCrossWiki, setForceCrossWiki] = useState(false);
  const [focus, setFocus] = useState<FocusedControl>('wiki');
  const [languageState, setLanguageState] = useState<WikiLanguageState>({
    outputLanguage: 'en',
    lastInputLanguage: 'en',
  });
  const [hasExtractions, setHasExtractions] = useState(false);
  const [inputIndex, setInputIndex] = useState(0);
  const [outputIndex, setOutputIndex] = useState(0);
  // Phase 11 v1.6.0: the wiki whose last completed run proposed AGENTS.md
  // updates (drives the post-ingest `p` review shortcut). Null when the last
  // run wrote no proposal — no hint is shown and `p` does nothing.
  const [proposalWiki, setProposalWiki] = useState<WikiRef | null>(null);
  // Phase 27 (vision `04` §1 Worker-process isolation): the crash-recovery
  // panel state (null = no panel) and the resolver for the pending R/S/A
  // decision the conductor awaits. The panel is the phase's only new UI —
  // healthy runs render byte-identically to the pre-Phase-27 screen.
  const [crashPanel, setCrashPanel] = useState<CrashPanelState | null>(null);
  const decisionResolverRef = useRef<((decision: CrashDecision) => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Phase 11: apply the continuous-workflow pre-selection exactly once (the
  // wiki list loads asynchronously).
  const appliedInitialWiki = useRef(false);

  useEffect(() => {
    if (appliedInitialWiki.current || !initialWiki) {
      return;
    }
    const index = wikis.findIndex(
      (wiki) => wiki.slug === initialWiki.slug && wiki.workspace === initialWiki.workspace,
    );
    if (index >= 0) {
      setSelectedIndex(index);
      appliedInitialWiki.current = true;
    }
  }, [wikis, initialWiki]);

  useEffect(() => {
    let mounted = true;
    // 2026-08-28: the toggles follow the SELECTED wiki's workspace config
    // (settings are per-workspace, and the list now spans several folders).
    loadSettings(selectedWiki?.workspace ?? list[0])
      .then((s) => {
        if (mounted) {
          setSynthesis(s.synthesis);
          // Phase 9: pre-select the AGENTS.md update proposal toggle from the
          // persisted setting (same convention as Synthesis).
          setUpdateAgents(s.updateAgents);
        }
      })
      .catch(() => {
        // Keep default false on settings load failure.
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWiki?.workspace]);

  // Phase 7: load the selected wiki's language state (.state/language.json)
  // and whether it already has extractions (for the slug-forking warning).
  // The selectors pre-select from the stored values whenever the wiki changes.
  useEffect(() => {
    let mounted = true;
    if (!selectedWiki) {
      return;
    }
    const dir = wikiDir(selectedWiki.workspace, selectedWiki.slug);
    readWikiLanguage(dir)
      .then(async (state) => {
        let extracted = false;
        try {
          extracted = (await readdir(join(dir, '.state', 'extracted'))).some((file) =>
            file.endsWith('.json'),
          );
        } catch {
          // No .state/extracted yet — normal on a young wiki.
        }
        if (mounted) {
          setLanguageState(state);
          setHasExtractions(extracted);
          setInputIndex(languageIndexOf(state.lastInputLanguage));
          setOutputIndex(languageIndexOf(state.outputLanguage));
        }
      })
      .catch(() => {
        // Keep the English defaults on load failure.
      });
    return () => {
      mounted = false;
    };
  }, [selectedWiki?.workspace, selectedWiki?.slug, refreshKey]);

  const selectedInput = SUPPORTED_LANGUAGES[inputIndex];
  const selectedOutput = SUPPORTED_LANGUAGES[outputIndex];
  const slugForkingRisk = hasExtractions && selectedInput.code !== languageState.lastInputLanguage;

  // 2026-08-28: the workspace label is shown only when the list spans more
  // than one workspace — single-workspace frames stay byte-identical.
  const multiWorkspace = new Set(wikis.map((wiki) => wiki.workspace)).size > 1;
  const wikiLabel = (wiki: WikiRef) => (multiWorkspace ? `${wiki.slug} (${wiki.workspace})` : wiki.slug);
  const wikiKey = (wiki: WikiRef) => `${wiki.workspace}/${wiki.slug}`;

  const runIngest = async (wiki: WikiRef) => {
    setStatus('running');
    setProgressLines([]);
    setProposalWiki(null);
    setCrashPanel(null);
    const abort = new AbortController();
    abortRef.current = abort;
    const onSigint = () => abort.abort();
    process.once('SIGINT', onSigint);
    try {
      let result: IngestResult & { agentsUpdateProposed?: boolean };
      if (ingestFn !== undefined) {
        // Test seam — the in-process path, byte-identical to pre-Phase-27.
        result = (await ingestFn(wiki.slug, {
          workspace: wiki.workspace,
          extract,
          synthesis,
          inputLanguage: selectedInput.code,
          outputLanguage: selectedOutput.code,
          updateAgents,
          doxLlm: true,
          crossWiki: true,
          forceCrossWiki,
          onProgress: (line: string) => setProgressLines((prev) => [...prev, line].slice(-MAX_PROGRESS_LINES)),
        })) as IngestResult & { agentsUpdateProposed?: boolean };
      } else {
        // Phase 27: the production path — one worker process per PDF, the
        // finalize tail in its own worker, progress relayed to the same
        // lines, crash recovery per the 2026-09-02 vision amendment.
        const conductor = conductorFn ?? runIngestConductor;
        const run = await conductor(wiki.slug, {
          workspace: wiki.workspace,
          ingest: {
            extract,
            synthesis,
            updateAgents,
            doxLlm: true,
            crossWiki: true,
            forceCrossWiki,
            inputLanguage: selectedInput.code,
            outputLanguage: selectedOutput.code,
          },
          onProgress: (line: string) => setProgressLines((prev) => [...prev, line].slice(-MAX_PROGRESS_LINES)),
          onCrashPanel: setCrashPanel,
          requestDecision: () =>
            new Promise<CrashDecision>((resolveDecision) => {
              decisionResolverRef.current = resolveDecision;
            }),
          signal: abort.signal,
        });
        if (run.status === 'aborted') {
          setStatus('error');
          const abortMessage =
            'Ingest aborted — everything already landed is saved on disk. Start the ingest again to resume where it stopped.';
          setMessage(abortMessage);
          onResult?.(`Error: ${abortMessage}`);
          return;
        }
        result = run.result;
      }
      // Phase 11 (phase doc §2.4): the result banner is the shared
      // formatIngestSummary string (same text the CLI prints).
      let summary = formatIngestSummary(result);
      if (result.agentsUpdateProposed) {
        summary +=
          ' AGENTS.md update proposal saved to .state/proposed-agents.md (review and apply manually).';
        // Phase 11 v1.6.0: arm the post-ingest `p` review shortcut.
        setProposalWiki(wiki);
      }
      setStatus('success');
      setMessage(summary);
      onResult?.(summary);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      const errorMessage = (err as Error).message;
      setStatus('error');
      setMessage(errorMessage);
      onResult?.(`Error: ${errorMessage}`);
    } finally {
      process.removeListener('SIGINT', onSigint);
      abortRef.current = null;
      decisionResolverRef.current = null;
      setCrashPanel(null);
    }
  };

  const startIngest = (wiki: WikiRef) => {
    // Phase 7: slug-forking caution (vision `04` §9.3) — an input-language
    // change on a wiki with existing extractions requires explicit confirm.
    if (slugForkingRisk) {
      setStatus('confirm');
      return;
    }
    void runIngest(wiki);
  };

  useInput(
    (_input, key) => {
      // Phase 27: the crash-recovery panel outranks every other binding —
      // the conductor is blocked awaiting this decision (R/S/A; Skip is a
      // PDF-worker option only — deferral never applies to the finalize
      // pass, and it is ALWAYS the user's explicit choice, never automatic).
      if (crashPanel !== null) {
        const lower = _input.toLowerCase();
        if (lower === 'r') {
          decisionResolverRef.current?.('retry');
          decisionResolverRef.current = null;
        } else if (lower === 's' && crashPanel.phase === 'pdf') {
          decisionResolverRef.current?.('skip');
          decisionResolverRef.current = null;
        } else if (lower === 'a') {
          decisionResolverRef.current?.('abort');
          decisionResolverRef.current = null;
        }
        return;
      }
      if (status === 'running') {
        return;
      }
      if (key.escape) {
        if (status === 'confirm') {
          setStatus('idle');
          return;
        }
        onBack();
        return;
      }
      if (status === 'confirm') {
        // Explicit confirm gate: Enter proceeds, anything else is ignored.
        if (key.return && selectedWiki) {
          void runIngest(selectedWiki);
        }
        return;
      }
      if (status === 'success' || status === 'error') {
        // Phase 11 v1.6.0: `p` (for "proposal") opens the AGENTS.md review
        // screen — only in the success state and only when the run actually
        // wrote a proposal. Documented key choice: `r` was free too, but `p`
        // reads better and never collides with a future "retry" binding.
        if (status === 'success' && proposalWiki && (_input === 'p' || _input === 'P')) {
          onReviewAgents?.(proposalWiki);
          return;
        }
        if (key.return) {
          onBack();
        }
        return;
      }
      if (wikis.length === 0) {
        return;
      }
      if (key.tab) {
        const current = FOCUS_ORDER.indexOf(focus);
        const delta = key.shift ? FOCUS_ORDER.length - 1 : 1;
        setFocus(FOCUS_ORDER[(current + delta) % FOCUS_ORDER.length]);
        return;
      }
      if (focus === 'wiki' && key.upArrow) {
        setSelectedIndex((selectedIndex + wikis.length - 1) % wikis.length);
        return;
      }
      if (focus === 'wiki' && key.downArrow) {
        setSelectedIndex((selectedIndex + 1) % wikis.length);
        return;
      }
      if (focus !== 'wiki' && (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow)) {
        const delta = key.downArrow || key.rightArrow ? 1 : SUPPORTED_LANGUAGES.length - 1;
        if (focus === 'input') {
          setInputIndex((inputIndex + delta) % SUPPORTED_LANGUAGES.length);
        } else {
          setOutputIndex((outputIndex + delta) % SUPPORTED_LANGUAGES.length);
        }
        return;
      }
      if (_input === ' ') {
        setSynthesis((prev) => !prev);
        return;
      }
      if (_input === 'a' || _input === 'A') {
        setUpdateAgents((prev) => !prev);
        return;
      }
      if (_input === 'f' || _input === 'F') {
        setForceCrossWiki((prev) => !prev);
        return;
      }
      if (key.return && selectedWiki) {
        startIngest(selectedWiki);
      }
    },
    { isActive: isRawModeSupported === true },
  );

  const languageLabel = (language: (typeof SUPPORTED_LANGUAGES)[number]): string =>
    `${language.nativeName} (${language.name})`;

  return (
    <Box flexDirection="column">
      <Header />
      <Text bold>Ingest PDFs</Text>
      {wikis.length === 0 ? (
        <Text dimColor>
          {list.length === 1
            ? `No wikis found in ${list[0]}/wikis. Create one first (init).`
            : 'No wikis found in the registered workspaces. Create one first (init).'}
        </Text>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Text>Select Wiki:</Text>
          {isRawModeSupported ? (
            wikis.map((wiki, index) => (
              <Text key={wikiKey(wiki)} color={focus === 'wiki' && index === selectedIndex ? 'cyan' : undefined}>
                {focus === 'wiki' && index === selectedIndex ? '> ' : '  '}
                {wikiLabel(wiki)}
              </Text>
            ))
          ) : (
            // Non-TTY fallback (piped output, test runner): interactive
            // selection requires raw mode, so list wikis statically instead
            // of crashing (same contract as menu.tsx).
            wikis.map((wiki) => <Text key={wikiKey(wiki)}> {wikiLabel(wiki)}</Text>)
          )}
          <Box flexDirection="column" marginTop={1}>
            <Text>PDFs in raw/: {details.pdfCount === null ? '...' : `${details.pdfCount} file(s)`}</Text>
            <Text>Last ingest: {formatTimestamp(details.lastIngest)}</Text>
          </Box>
          <Box flexDirection="column" marginTop={1}>
            <Box>
              <Text>Input Language: </Text>
              <Text inverse={focus === 'input'} color={focus === 'input' ? 'cyan' : undefined}>
                [‹ {languageLabel(selectedInput)} ›]
              </Text>
            </Box>
            <Box>
              <Text>Output Language: </Text>
              <Text inverse={focus === 'output'} color={focus === 'output' ? 'cyan' : undefined}>
                [‹ {languageLabel(selectedOutput)} ›]
              </Text>
            </Box>
          </Box>
          <Box flexDirection="column" marginTop={1}>
            <Text>[{synthesis ? '✓' : ' '}] Enable Synthesis (Space to toggle)</Text>
            <Text>[{updateAgents ? '✓' : ' '}] Propose AGENTS.md Updates (A to toggle)</Text>
            <Text>[{forceCrossWiki ? '✓' : ' '}] Force Cross-Wiki Discovery (F to toggle)</Text>
          </Box>
          {slugForkingRisk && status !== 'running' ? (
            <Box flexDirection="column" marginTop={1}>
              <Text color="yellow">
                ⚠ Input language differs from the last run (
                {SUPPORTED_LANGUAGES[languageIndexOf(languageState.lastInputLanguage)].name}).
                Slug forking can duplicate pages.
              </Text>
              {status === 'confirm' ? (
                <Text color="yellow" bold>
                  Press Enter to confirm and start, or Escape to cancel.
                </Text>
              ) : null}
            </Box>
          ) : null}
        </Box>
      )}
      {status === 'running' && <LoadingSpinner label="Running ingest..." />}
      {progressLines.map((line, index) => (
        <Text key={index} dimColor={status === 'running'}>
          {withProgressBar(line)}
        </Text>
      ))}
      {crashPanel !== null ? (
        // Phase 27 (§2.3): the crash-recovery panel — the phase's only new
        // UI element. Rendered only while a worker died, the auto-retry cap
        // is exhausted, and the conductor awaits the user's decision.
        <Box flexDirection="column" borderStyle="round" borderColor="red" marginTop={1} paddingX={1}>
          <Text color="red" bold>
            Worker for {crashPanel.pdf ?? 'the finalize pass'} exited unexpectedly (code{' '}
            {crashPanel.exitCode ?? 'none'}, attempt {crashPanel.attempt})
          </Text>
          {crashPanel.stderrTail.length > 0
            ? crashPanel.stderrTail
                .split('\n')
                .slice(-10)
                .map((line, index) => (
                  <Text key={index} color="gray">
                    {line}
                  </Text>
                ))
            : null}
          <Text bold>
            [R] Retry{crashPanel.phase === 'pdf' ? '   [S] Skip PDF (re-attempted next ingest)' : ''}{' '}
            [A] Abort run
          </Text>
        </Box>
      ) : null}
      {status === 'success' && <SuccessBox message={message} />}
      {status === 'success' && proposalWiki && isRawModeSupported ? (
        // Phase 11 v1.6.0: post-ingest review shortcut hint (only when a
        // proposal was written; the non-TTY fallback never renders it).
        <Text>AGENTS.md update proposed — press [P] to review the diff.</Text>
      ) : null}
      {status === 'error' && <ErrorBox message={message} />}
      <Footer helpText="Up/Down: select wiki | Tab: language | Space: synthesis | A: AGENTS.md updates | F: force cross-wiki | Enter: run ingest | Escape: back" />
    </Box>
  );
}
