import React, { useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import TextInput from 'ink-text-input';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { LoadingSpinner } from './components/spinner';
import { ErrorBox } from './components/error-box';
import { SuccessBox } from './components/success-box';
import { init } from '../commands/init';
import { slugify, isValidWikiSlug } from '../utils/slug';
import { SUPPORTED_LANGUAGES } from '../utils/language';

export interface ScreenProps {
  onBack: () => void;
  onResult?: (result: string) => void;
}

export interface InitScreenProps extends ScreenProps {
  /** Pre-filled value for the Workspace field (used by tests; default './'). */
  defaultWorkspace?: string;
  /**
   * Phase 11 (phase doc §2.4, Gate 11.4): continuous workflow — invoked with
   * the new wiki's slug as soon as init() succeeds, so the app can navigate
   * straight to Add PDFs instead of waiting for Enter-to-go-back. When
   * omitted (e.g. tests rendering the screen directly), the success banner
   * stays and Enter still goes back.
   */
  onCreated?: (wiki: string) => void;
}

type FieldName = 'title' | 'workspace' | 'language' | 'create' | 'back';
const FIELD_ORDER: FieldName[] = ['title', 'workspace', 'language', 'create', 'back'];

type FormStatus = 'editing' | 'busy' | 'success' | 'error';

/**
 * Create New Wiki form: Title (required, converted to kebab-case slug),
 * Workspace (default './'), Output Language (Phase 7 dropdown, English
 * pre-selected; Title and Workspace remain the only text inputs per the
 * 2026-07-18 user decision). Tab/arrows move between fields, Left/Right cycles
 * the language dropdown, Enter on "Create Wiki" runs init(), Escape/Back
 * returns to the menu.
 */
export function InitScreen({ onBack, onResult, defaultWorkspace = './', onCreated }: InitScreenProps) {
  const { isRawModeSupported } = useStdin();
  const [title, setTitle] = useState('');
  const [workspace, setWorkspace] = useState(defaultWorkspace);
  const [languageIndex, setLanguageIndex] = useState(0); // English
  const [focusIndex, setFocusIndex] = useState(0);
  const [status, setStatus] = useState<FormStatus>('editing');
  const [message, setMessage] = useState('');
  const [validationError, setValidationError] = useState('');

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
        if (focus === 'create' || focus === 'language') {
          // Enter on the language dropdown (the last input) submits, keeping
          // the Title → Tab → Tab → Enter flow from before Phase 7 intact.
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
                onChange={setWorkspace}
                focus={focus === 'workspace'}
                onSubmit={() => setFocusIndex(2)}
              />
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
          </Box>
        ) : null
      ) : (
        // Non-TTY fallback (piped output, test runner): text inputs and input
        // handling require raw mode, so render the form statically instead of
        // crashing (same contract as menu.tsx).
        <Box flexDirection="column" marginTop={1}>
          <Text>Title: {title}</Text>
          <Text>Workspace: {workspace}</Text>
          <Text>Output Language: {selectedLanguage.nativeName} ({selectedLanguage.name})</Text>
          <Text>[ Create Wiki ] [ Back ]</Text>
          <Text dimColor>Interactive form requires a TTY.</Text>
        </Box>
      )}
      {status === 'busy' && <LoadingSpinner label="Creating wiki..." />}
      {status === 'success' && <SuccessBox message={message} />}
      {status === 'error' && <ErrorBox message={message} />}
      <Footer helpText="Tab: field | Left/Right: language | Enter: select | Press Escape to go back" />
    </Box>
  );
}
