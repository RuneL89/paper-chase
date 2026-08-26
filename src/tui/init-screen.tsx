import React, { useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import TextInput from 'ink-text-input';
import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { LoadingSpinner } from './components/spinner';
import { ErrorBox } from './components/error-box';
import { SuccessBox } from './components/success-box';
import { init } from '../commands/init';
import { slugify, isValidWikiSlug } from '../utils/slug';
import { SUPPORTED_LANGUAGES } from '../utils/language';
import { pickFolder as openFolderPicker } from '../utils/folder-dialog';

export interface ScreenProps {
  onBack: () => void;
  onResult?: (result: string) => void;
}

export interface InitScreenProps extends ScreenProps {
  /** Pre-filled value for the Workspace field (used by tests; default './'). */
  defaultWorkspace?: string;
  /**
   * Folder-picker implementation. Defaults to the native Windows
   * FolderBrowserDialog (src/utils/folder-dialog.ts); tests inject a stub so
   * no real dialog spawns (the add-pdfs pickFiles precedent).
   */
  pickFolder?: (initial?: string) => Promise<string | null>;
  /**
   * Phase 11 (phase doc §2.4, Gate 11.4): continuous workflow — invoked with
   * the new wiki's slug as soon as init() succeeds, so the app can navigate
   * straight to Add PDFs instead of waiting for Enter-to-go-back. When
   * omitted (e.g. tests rendering the screen directly), the success banner
   * stays and Enter still goes back.
   */
  onCreated?: (wiki: string) => void;
}

type FieldName = 'title' | 'workspace' | 'browse' | 'language' | 'create' | 'back';
const FIELD_ORDER: FieldName[] = ['title', 'workspace', 'browse', 'language', 'create', 'back'];

type FormStatus = 'editing' | 'busy' | 'success' | 'error';

/**
 * Create New Wiki form: Title (required, converted to kebab-case slug),
 * Workspace (default './'), Output Language (Phase 7 dropdown, English
 * pre-selected; Title and Workspace remain the only text inputs per the
 * 2026-07-18 user decision), Tab/arrows move between fields, Left/Right
 * cycles the language dropdown, Enter on "Create Wiki" runs init(), Escape/Back
 * returns to the menu.
 *
 * 2026-08-24 user directive: the Workspace row gains a [ Browse... ] button
 * (a focus stop between Workspace and Output Language) that opens the native
 * folder picker — the user chooses only the PARENT folder; the wiki folder
 * itself is created automatically. An always-on breadcrumb line under the
 * field shows the resolved absolute target (workspace → \wikis\<title-slug>)
 * from the moment the screen opens, so it is always visible whether the
 * current selection needs changing. Typed paths remain the fallback.
 */
export function InitScreen({ onBack, onResult, defaultWorkspace = './', pickFolder, onCreated }: InitScreenProps) {
  const { isRawModeSupported } = useStdin();
  const [title, setTitle] = useState('');
  const [workspace, setWorkspace] = useState(defaultWorkspace);
  const [languageIndex, setLanguageIndex] = useState(0); // English
  const [focusIndex, setFocusIndex] = useState(0);
  const [status, setStatus] = useState<FormStatus>('editing');
  const [message, setMessage] = useState('');
  const [validationError, setValidationError] = useState('');
  const [busyLabel, setBusyLabel] = useState('Creating wiki...');
  const [pickerNotice, setPickerNotice] = useState('');
  const [pickerError, setPickerError] = useState('');

  const focus = FIELD_ORDER[focusIndex];

  const submit = async () => {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      setValidationError('Title is required.');
      setFocusIndex(0);
      return;
    }
    const slug = slugify(trimmedTitle);
    if (!isValidWikiSlug(slug)) {
      setValidationError(`Title cannot form a valid wiki slug (got "${slug}"). Use letters, digits, and spaces.`);
      setFocusIndex(0);
      return;
    }
    setValidationError('');
    setStatus('busy');
    setBusyLabel('Creating wiki...');
    try {
      const result = await init(slug, {
        title: trimmedTitle,
        workspace: workspace.trim().length > 0 ? workspace.trim() : '.',
        outputLanguage: SUPPORTED_LANGUAGES[languageIndex].code,
      });
      setStatus('success');
      setMessage(result.message);
      onResult?.(result.message);
      // Continuous workflow (Phase 11 §2.4): hand the new slug to the app so
      // it can route straight to Add PDFs. When no callback is wired (direct
      // renders in tests), the success banner stays and Enter goes back.
      onCreated?.(slug);
    } catch (err) {
      const errorMessage = (err as Error).message;
      setStatus('error');
      setMessage(errorMessage);
      onResult?.(`Error: ${errorMessage}`);
    }
  };

  // Native folder picker (2026-08-24): opens pre-selecting the current
  // Workspace value when it names an existing directory. The picked parent
  // folder replaces the field contents; cancel is neutral; a failure keeps
  // the manual text field fully usable (the 2026-07-17 picker contract).
  const runBrowse = async () => {
    const picker = pickFolder ?? openFolderPicker;
    setPickerNotice('');
    setPickerError('');
    let initial: string | undefined;
    const candidate = resolve(workspace.trim().length > 0 ? workspace.trim() : '.');
    try {
      if (existsSync(candidate) && statSync(candidate).isDirectory()) {
        initial = candidate;
      }
    } catch {
      // Unresolvable stat (e.g. an illegal path being typed): open at the default.
    }
    setStatus('busy');
    setBusyLabel('Opening folder picker...');
    let picked: string | null;
    try {
      picked = await picker(initial);
    } catch (err) {
      setStatus('editing');
      setPickerError(
        `The folder picker could not be opened: ${(err as Error).message} ` +
          'Type or paste a folder path in the Workspace field instead.',
      );
      return;
    }
    setStatus('editing');
    if (picked === null) {
      setPickerNotice('No folder selected — workspace unchanged.');
      return;
    }
    setWorkspace(picked);
  };

  useInput(
    (_input, key) => {
      if (status === 'busy') {
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
      if (key.tab || key.downArrow) {
        setFocusIndex((focusIndex + (key.shift ? FIELD_ORDER.length - 1 : 1)) % FIELD_ORDER.length);
        return;
      }
      if (key.upArrow) {
        setFocusIndex((focusIndex + FIELD_ORDER.length - 1) % FIELD_ORDER.length);
        return;
      }
      if (focus === 'language' && (key.leftArrow || key.rightArrow)) {
        const delta = key.rightArrow ? 1 : SUPPORTED_LANGUAGES.length - 1;
        setLanguageIndex((languageIndex + delta) % SUPPORTED_LANGUAGES.length);
        return;
      }
      if (key.return) {
        if (focus === 'browse') {
          void runBrowse();
        } else if (focus === 'create' || focus === 'language') {
          // Enter on the language dropdown (the last input) submits, keeping
          // the Title → Tab×3 → Enter flow intact now that Browse is a stop.
          void submit();
        } else if (focus === 'back') {
          onBack();
        }
        // Text fields advance focus via their own onSubmit handler.
      }
    },
    { isActive: isRawModeSupported === true },
  );

  const editing = status === 'editing' || status === 'busy';
  const selectedLanguage = SUPPORTED_LANGUAGES[languageIndex];

  // Always-on breadcrumb (2026-08-24): the exact folder the wiki will land
  // in, resolved to an absolute path so '.' reads as the real location. The
  // slug placeholder stays until Title forms a valid slug.
  const trimmedWorkspace = workspace.trim();
  const workspaceRoot = trimmedWorkspace.length > 0 ? trimmedWorkspace : '.';
  const derivedSlug = slugify(title.trim());
  const slugLabel = isValidWikiSlug(derivedSlug) ? derivedSlug : '<title-slug>';
  const targetBreadcrumb = join(resolve(workspaceRoot), 'wikis', slugLabel);

  const changeWorkspace = (value: string) => {
    setWorkspace(value);
    setPickerNotice('');
    setPickerError('');
  };

  return (
    <Box flexDirection="column">
      <Header />
      <Text bold>Create New Wiki</Text>
      {isRawModeSupported ? (
        editing ? (
          <Box flexDirection="column" marginTop={1}>
            <Box>
              <Text>Title: </Text>
              <TextInput value={title} onChange={setTitle} focus={focus === 'title'} onSubmit={() => setFocusIndex(1)} />
            </Box>
            <Box>
              <Text>Workspace: </Text>
              <TextInput
                value={workspace}
                onChange={changeWorkspace}
                focus={focus === 'workspace' && status !== 'busy'}
                onSubmit={() => setFocusIndex(2)}
              />
              <Text> </Text>
              <Text
                inverse={focus === 'browse'}
                color={focus === 'browse' ? 'cyan' : undefined}
                bold={focus === 'browse'}
              >
                {focus === 'browse' ? '> ' : '  '}[ Browse... ]
              </Text>
            </Box>
            <Box>
              <Text dimColor> Wiki folder will be created at: {targetBreadcrumb}</Text>
            </Box>
            <Box>
              <Text>Output Language: </Text>
              <Text inverse={focus === 'language'} color={focus === 'language' ? 'cyan' : undefined}>
                [‹ {selectedLanguage.nativeName} ({selectedLanguage.name}) ›]
              </Text>
            </Box>
            <Box marginTop={1} gap={2}>
              <Text inverse={focus === 'create'} color={focus === 'create' ? 'cyan' : undefined}>
                [ Create Wiki ]
              </Text>
              <Text inverse={focus === 'back'} color={focus === 'back' ? 'cyan' : undefined}>
                [ Back ]
              </Text>
            </Box>
            {validationError ? <Text color="red">{validationError}</Text> : null}
            {pickerError ? <Text color="red">{pickerError}</Text> : null}
            {pickerNotice ? <Text dimColor>{pickerNotice}</Text> : null}
          </Box>
        ) : null
      ) : (
        // Non-TTY fallback (piped output, test runner): text inputs and input
        // handling require raw mode, so render the form statically instead of
        // crashing (same contract as menu.tsx).
        <Box flexDirection="column" marginTop={1}>
          <Text>Title: {title}</Text>
          <Text>Workspace: {workspace} [ Browse... ]</Text>
          <Text dimColor> Wiki folder will be created at: {targetBreadcrumb}</Text>
          <Text>Output Language: {selectedLanguage.nativeName} ({selectedLanguage.name})</Text>
          <Text>[ Create Wiki ] [ Back ]</Text>
          <Text dimColor>Interactive form requires a TTY.</Text>
        </Box>
      )}
      {status === 'busy' && <LoadingSpinner label={busyLabel} />}
      {status === 'success' && <SuccessBox message={message} />}
      {status === 'error' && <ErrorBox message={message} />}
      <Footer helpText="Tab: field | Left/Right: language | Enter: select | Press Escape to go back" />
    </Box>
  );
}
