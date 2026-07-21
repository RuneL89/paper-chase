import React, { useEffect, useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { LoadingSpinner } from './components/spinner';
import { ErrorBox } from './components/error-box';
import { SuccessBox } from './components/success-box';
import { useWikiList } from './hooks/use-wiki-list';
import { useWikiDetails } from './hooks/use-wiki-details';
import { ingest } from '../commands/ingest';
import { loadSettings } from './settings';
import { readWikiLanguage, type WikiLanguageState } from '../state/language';
import { SUPPORTED_LANGUAGES } from '../utils/language';
import { wikiDir } from '../utils/paths';
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
   * Phase 4: called after a successful ingest so the app can navigate to a
   * results view for the wiki that was just ingested. Phase 8 (phase doc
   * §5.2): the app routes this to the Ingestion Log (compounding log)
   * screen, superseding the Phase 4 validation-report navigation.
   */
  onViewReport?: (wiki: string) => void;
  /**
   * Injectable ingestion implementation (test-only). Defaults to the real
   * ingest command; tests can inject a stub to avoid disk I/O / LLM calls.
   */
  ingestFn?: (slug: string, options: Record<string, unknown>) => Promise<unknown>;
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

/**
 * Ingest PDFs screen (phase doc §5.2): lists existing wikis, shows the PDF
 * count in raw/ and the last ingest timestamp for the selected wiki, and
 * runs ingest() with a spinner and live progress lines
 * ("Extracting text...", "Chunk X/Y...", "Done!").
 *
 * Phase 5: adds an "Enable Synthesis" checkbox pre-checked from
 * `.llm-wiki-cli.json`. When checked, ingest runs with `synthesis: true`.
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
  const [synthesis, setSynthesis] = useState(false);
  // Phase 9: opt-in AGENTS.md update proposal (phase doc §2.3 CLI flag made
  // TUI-accessible per the 2026-07-17 all-workflows-in-TUI user preference).
  const [updateAgents, setUpdateAgents] = useState(false);
  const [focus, setFocus] = useState<FocusedControl>('wiki');
  const [languageState, setLanguageState] = useState<WikiLanguageState>({
    outputLanguage: 'en',
    lastInputLanguage: 'en',
  });
  const [hasExtractions, setHasExtractions] = useState(false);
  const [inputIndex, setInputIndex] = useState(0);
  const [outputIndex, setOutputIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    loadSettings(workspace)
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
  }, [workspace]);

  // Phase 7: load the selected wiki's language state (.state/language.json)
  // and whether it already has extractions (for the slug-forking warning).
  // The selectors pre-select from the stored values whenever the wiki changes.
  useEffect(() => {
    let mounted = true;
    if (!selectedWiki) {
      return;
    }
    const dir = wikiDir(workspace, selectedWiki);
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
  }, [workspace, selectedWiki, refreshKey]);

  const selectedInput = SUPPORTED_LANGUAGES[inputIndex];
  const selectedOutput = SUPPORTED_LANGUAGES[outputIndex];
  const slugForkingRisk = hasExtractions && selectedInput.code !== languageState.lastInputLanguage;

  const runIngest = async (wiki: string) => {
    setStatus('running');
    setProgressLines([]);
    try {
      const run = ingestFn ?? ingest;
      const result = (await run(wiki, {
        workspace,
        extract,
        synthesis,
        inputLanguage: selectedInput.code,
        outputLanguage: selectedOutput.code,
        // Phase 9: opt-in AGENTS.md update proposal after the ingest.
        updateAgents,
        // Phase 6: production runs are LLM-driven — the DOX Writer writes rich,
        // content-based index.md contracts (deterministic enforcement and
        // fallback still guarantee valid contracts without a key).
        doxLlm: true,
        onProgress: (line: string) => setProgressLines((prev) => [...prev, line].slice(-MAX_PROGRESS_LINES)),
      })) as { ingested: unknown[]; skipped: unknown[]; synthesized?: number; synthesisConflicts?: number; agentsUpdateProposed?: boolean };
      let summary = `Ingest complete: ${result.ingested.length} ingested, ${result.skipped.length} skipped.`;
      if (result.synthesized !== undefined) {
        summary += ` Synthesis: ${result.synthesized} page(s), ${result.synthesisConflicts ?? 0} conflict(s).`;
      }
      if (result.agentsUpdateProposed) {
        summary += ' AGENTS.md update proposal saved (see Review AGENTS.md Updates).';
      }
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

  const startIngest = (wiki: string) => {
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
        <Text dimColor>No wikis found in {workspace}/wikis. Create one first (init).</Text>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Text>Select Wiki:</Text>
          {isRawModeSupported ? (
            wikis.map((wiki, index) => (
              <Text key={wiki} color={focus === 'wiki' && index === selectedIndex ? 'cyan' : undefined}>
                {focus === 'wiki' && index === selectedIndex ? '> ' : '  '}
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
          {line}
        </Text>
      ))}
      {status === 'success' && <SuccessBox message={message} />}
      {status === 'error' && <ErrorBox message={message} />}
      <Footer helpText="Up/Down: select wiki | Tab: language | Space: synthesis | A: AGENTS.md updates | Enter: run ingest | Escape: back" />
    </Box>
  );
}
