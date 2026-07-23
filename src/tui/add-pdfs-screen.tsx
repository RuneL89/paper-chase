import React, { useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import TextInput from 'ink-text-input';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { LoadingSpinner } from './components/spinner';
import { ErrorBox } from './components/error-box';
import { SuccessBox } from './components/success-box';
import { useWikiList } from './hooks/use-wiki-list';
import { useRawContents } from './hooks/use-raw-contents';
import { addPdfToWiki } from '../commands/add-pdf';
import { pickPdfFiles } from '../utils/file-dialog';
import { wikiDir } from '../utils/paths';
import type { ScreenProps } from './init-screen';

export interface AddPdfsScreenProps extends ScreenProps {
  /** Workspace directory containing wikis/ (used by tests; default '.'). */
  workspace?: string;
  /**
   * File-picker implementation. Defaults to the native Windows OpenFileDialog
   * (src/utils/file-dialog.ts); tests inject a stub so no real dialog spawns.
   */
  pickFiles?: () => Promise<string[] | null>;
  /**
   * Phase 11 (phase doc §2.4, Gate 11.4): continuous workflow — when set, the
   * screen starts directly in add mode for this wiki (no selector), and
   * Escape from add mode goes back to the menu.
   */
  initialWiki?: string;
  /**
   * Phase 11 (phase doc §2.4): invoked when the post-add "Start ingesting
   * now? [Y/n]" prompt is confirmed. When omitted, confirming falls back to
   * onBack().
   */
  onStartIngest?: (wiki: string) => void;
}

type Mode = 'select' | 'add' | 'confirm-ingest';
type AddStatus = 'idle' | 'busy';
/** Which add-mode control is focused: the native picker (primary) or the manual path input (fallback). */
type AddFocus = 'browse' | 'manual';

const MAX_LISTED_FILES = 10;

/** Current raw/ folder listing for a wiki (shared by both screen modes). */
function RawContents({ wiki, files }: { wiki: string | undefined; files: string[] | null }) {
  if (!wiki) {
    return null;
  }
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>Contents of {wiki}/raw/:</Text>
      {files === null ? (
        <Text dimColor> loading...</Text>
      ) : files.length === 0 ? (
        <Text dimColor> (empty)</Text>
      ) : (
        <>
          {files.slice(0, MAX_LISTED_FILES).map((name) => (
            <Text key={name}> {name}</Text>
          ))}
          {files.length > MAX_LISTED_FILES ? <Text dimColor> ... +{files.length - MAX_LISTED_FILES} more</Text> : null}
        </>
      )}
    </Box>
  );
}

/**
 * Add PDFs screen (user-directed Phase 1 extension, 2026-07-17 — compliance
 * log entries "2026-07-17 10:20" and "2026-07-17 10:55"): copy PDF files into
 * a wiki's raw/ folder without leaving the TUI.
 *
 * Native-picker contract (user decision 10:55): the PRIMARY interaction is an
 * OS-native graphical file picker — after choosing a wiki, the focused
 * control is "[ Browse for PDFs... ]" and Enter opens the Windows
 * OpenFileDialog (PDF-filtered, multi-select, topmost). Every picked file is
 * copied into wikis/<slug>/raw/ via addPdfToWiki; the SuccessBox summarizes
 * the batch and per-file failures are collected into the ErrorBox (successes
 * still count). Cancelling the dialog is neutral ("No files selected."), not
 * an error. Typing a path is the FALLBACK only (demoted to a secondary row,
 * for when the dialog cannot run); Windows drag-drop still pastes a quoted
 * path, which is stripped.
 *
 * The raw/ contents are shown live and refreshed after each add. Escape
 * leaves the add controls back to the wiki selector (or straight back to the
 * menu when the screen was entered with an initialWiki), and leaves the
 * selector back to the menu. Input is gated off while the dialog/copy is in
 * flight.
 *
 * Phase 11 (phase doc §2.4, Gate 11.4): the success banner is
 * "Copied N file(s) to wikis/<slug>/raw/." and every successful add (one file
 * or many) is followed by the "Start ingesting now? [Y/n]" prompt — Y/Enter
 * routes to the Ingest screen with the wiki pre-selected, n/Escape returns
 * to the menu.
 */
export function AddPdfsScreen({
  onBack,
  onResult,
  workspace = '.',
  pickFiles,
  initialWiki,
  onStartIngest,
}: AddPdfsScreenProps) {
  const { isRawModeSupported } = useStdin();
  const wikis = useWikiList(workspace);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedWiki = wikis.length > 0 ? wikis[Math.min(selectedIndex, wikis.length - 1)] : undefined;
  const [mode, setMode] = useState<Mode>(initialWiki ? 'add' : 'select');
  const [activeWiki, setActiveWiki] = useState<string | undefined>(initialWiki);
  const [refreshKey, setRefreshKey] = useState(0);
  const shownWiki = mode === 'select' ? selectedWiki : activeWiki;
  const rawFiles = useRawContents(workspace, shownWiki, refreshKey);
  const [focus, setFocus] = useState<AddFocus>('browse');
  const [pathInput, setPathInput] = useState('');
  const [status, setStatus] = useState<AddStatus>('idle');
  const [busyLabel, setBusyLabel] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [notice, setNotice] = useState('');

  const clearFeedback = () => {
    setSuccessMsg('');
    setErrorMsg('');
    setNotice('');
  };

  /** Record a successful add: banner + the "Start ingesting now?" prompt. */
  const finishSuccessfulAdd = (count: number) => {
    if (!activeWiki) {
      return;
    }
    const summary = `Copied ${count} file(s) to wikis/${activeWiki}/raw/.`;
    setSuccessMsg(summary);
    onResult?.(summary);
    setPathInput(''); // ready for the next file immediately
    setRefreshKey((key) => key + 1);
    setMode('confirm-ingest');
  };

  const runAddManual = async (rawPath: string) => {
    if (!activeWiki) {
      return;
    }
    setStatus('busy');
    setBusyLabel('Copying PDF...');
    clearFeedback();
    try {
      await addPdfToWiki(wikiDir(workspace, activeWiki), rawPath);
      finishSuccessfulAdd(1);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setStatus('idle');
    }
  };

  const runBrowse = async () => {
    if (!activeWiki) {
      return;
    }
    const picker = pickFiles ?? pickPdfFiles;
    setStatus('busy');
    setBusyLabel('Opening file picker...');
    clearFeedback();

    let picked: string[] | null;
    try {
      picked = await picker();
    } catch (err) {
      setStatus('idle');
      setErrorMsg(
        `The file picker could not be opened: ${(err as Error).message} ` +
          'Use the fallback manual path entry below instead.',
      );
      return;
    }

    if (picked === null) {
      // Cancelling the dialog is a neutral outcome, not an error.
      setStatus('idle');
      setNotice('No files selected.');
      return;
    }

    setBusyLabel('Copying PDFs...');
    const added: string[] = [];
    const failures: string[] = [];
    for (const filePath of picked) {
      try {
        const result = await addPdfToWiki(wikiDir(workspace, activeWiki), filePath);
        added.push(result.fileName);
      } catch (err) {
        failures.push(`${filePath}: ${(err as Error).message}`);
      }
    }
    setStatus('idle');

    if (added.length > 0) {
      finishSuccessfulAdd(added.length);
    }
    if (failures.length > 0) {
      setErrorMsg(`Could not add ${failures.length} file(s): ${failures.join('; ')}`);
    }
  };

  const handleChange = (value: string) => {
    setPathInput(value);
    // Typing again dismisses the last feedback.
    clearFeedback();
  };

  const handleSubmit = (value: string) => {
    if (status === 'busy' || value.trim().length === 0) {
      return;
    }
    void runAddManual(value);
  };

  useInput(
    (input, key) => {
      if (status === 'busy') {
        // Input is gated off while the native dialog or a copy is in flight.
        return;
      }
      if (mode === 'confirm-ingest') {
        // "Start ingesting now? [Y/n]" — Y/Enter ingests (default), n/Escape
        // returns to the menu.
        if (key.escape || input === 'n' || input === 'N') {
          onBack();
          return;
        }
        if (key.return || input === 'y' || input === 'Y') {
          if (activeWiki && onStartIngest) {
            onStartIngest(activeWiki);
          } else {
            onBack();
          }
          return;
        }
        return;
      }
      if (key.escape) {
        if (mode === 'add' && !initialWiki) {
          setMode('select');
          setFocus('browse');
          clearFeedback();
          setPathInput('');
        } else {
          onBack();
        }
        return;
      }
      if (mode === 'select') {
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
          setActiveWiki(selectedWiki);
          setMode('add');
          setFocus('browse');
          clearFeedback();
          setPathInput('');
        }
        return;
      }
      // mode === 'add': Browse button is the primary, default-focused control;
      // Up/Down moves between it and the fallback manual path input.
      if (focus === 'browse') {
        if (key.return) {
          void runBrowse();
        } else if (key.upArrow || key.downArrow) {
          setFocus('manual');
        } else if (!key.ctrl && !key.meta && input && input.trim().length > 0) {
          // Convenience: starting to type jumps to the manual input (the
          // typed text is carried over, since the unfocused TextInput
          // ignores input).
          setPathInput((previous) => previous + input);
          setFocus('manual');
        }
        return;
      }
      if (key.upArrow) {
        setFocus('browse');
      }
    },
    { isActive: isRawModeSupported === true },
  );

  const footerText =
    mode === 'confirm-ingest'
      ? 'Y/Enter: start ingesting | n/Escape: back to menu'
      : mode === 'add'
        ? 'Enter: browse for PDFs | Up/Down: switch control | Escape: back'
        : 'Up/Down: select wiki | Enter: choose wiki | Press Escape to go back';

  return (
    <Box flexDirection="column">
      <Header />
      <Text bold>Add PDFs</Text>
      {wikis.length === 0 && !activeWiki ? (
        <Text dimColor>No wikis found in {workspace}/wikis. Create one first (init).</Text>
      ) : !isRawModeSupported ? (
        // Non-TTY fallback (piped output, test runner): the picker and text
        // input require raw mode, so render the wiki list, raw/ contents, and
        // both add controls statically instead of crashing (same contract as
        // menu.tsx).
        <Box flexDirection="column" marginTop={1}>
          <Text>Select Wiki:</Text>
          {(activeWiki ? [activeWiki] : wikis).map((wiki) => (
            <Text key={wiki}> {wiki}</Text>
          ))}
          <RawContents wiki={shownWiki} files={rawFiles} />
          <Text> [ Browse for PDFs... ]</Text>
          <Text dimColor> Fallback: enter path manually (PDF path:)</Text>
          <Text dimColor>Interactive picker and path input require a TTY.</Text>
        </Box>
      ) : mode === 'select' ? (
        <Box flexDirection="column" marginTop={1}>
          <Text>Select Wiki:</Text>
          {wikis.map((wiki, index) => (
            <Text key={wiki} color={index === selectedIndex ? 'cyan' : undefined}>
              {index === selectedIndex ? '> ' : '  '}
              {wiki}
            </Text>
          ))}
          <RawContents wiki={shownWiki} files={rawFiles} />
        </Box>
      ) : mode === 'confirm-ingest' ? (
        <Box flexDirection="column" marginTop={1}>
          <SuccessBox message={successMsg} />
          {errorMsg.length > 0 && <ErrorBox message={errorMsg} />}
          <Text bold>Start ingesting now? [Y/n]</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Text>Adding to: {activeWiki}</Text>
          <RawContents wiki={activeWiki} files={rawFiles} />
          <Box marginTop={1}>
            <Text color={focus === 'browse' ? 'cyan' : undefined} bold={focus === 'browse'}>
              {focus === 'browse' ? '> ' : '  '}[ Browse for PDFs... ]
            </Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text dimColor={focus !== 'manual'}> Fallback: enter path manually</Text>
            <Text dimColor={focus !== 'manual'}>
              {'  '}
              PDF path:{' '}
              <TextInput
                value={pathInput}
                onChange={handleChange}
                onSubmit={handleSubmit}
                focus={focus === 'manual' && status !== 'busy'}
                placeholder="Type or paste a path (drag a PDF into the terminal)"
              />
            </Text>
          </Box>
          {status === 'busy' && <LoadingSpinner label={busyLabel} />}
          {successMsg.length > 0 && <SuccessBox message={successMsg} />}
          {errorMsg.length > 0 && <ErrorBox message={errorMsg} />}
          {notice.length > 0 && <Text dimColor>{notice}</Text>}
        </Box>
      )}
      <Footer helpText={footerText} />
    </Box>
  );
}
