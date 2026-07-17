import React, { useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import TextInput from 'ink-text-input';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { LoadingSpinner } from './components/spinner';
import { ErrorBox } from './components/error-box';
import { SuccessBox } from './components/success-box';
import { init } from '../commands/init';

export interface ScreenProps {
  onBack: () => void;
  onResult?: (result: string) => void;
}

export interface InitScreenProps extends ScreenProps {
  /** Pre-filled value for the Workspace field (used by tests; default './'). */
  defaultWorkspace?: string;
}

type FieldName = 'slug' | 'title' | 'workspace' | 'create' | 'back';
const FIELD_ORDER: FieldName[] = ['slug', 'title', 'workspace', 'create', 'back'];

type FormStatus = 'editing' | 'busy' | 'success' | 'error';

/**
 * Create New Wiki form (phase doc §5.1): Wiki Slug (required), Title
 * (optional), Workspace (default './'). Tab/arrows move between fields,
 * Enter on "Create Wiki" runs init(), Escape/Back returns to the menu.
 */
export function InitScreen({ onBack, onResult, defaultWorkspace = './' }: InitScreenProps) {
  const { isRawModeSupported } = useStdin();
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [workspace, setWorkspace] = useState(defaultWorkspace);
  const [focusIndex, setFocusIndex] = useState(0);
  const [status, setStatus] = useState<FormStatus>('editing');
  const [message, setMessage] = useState('');
  const [validationError, setValidationError] = useState('');

  const focus = FIELD_ORDER[focusIndex];

  const submit = async () => {
    if (slug.trim().length === 0) {
      setValidationError('Wiki slug is required.');
      setFocusIndex(0);
      return;
    }
    setValidationError('');
    setStatus('busy');
    try {
      const result = await init(slug.trim(), {
        title: title.trim().length > 0 ? title.trim() : undefined,
        workspace: workspace.trim().length > 0 ? workspace.trim() : '.',
      });
      setStatus('success');
      setMessage(result.message);
      onResult?.(result.message);
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
      if (key.return) {
        if (focus === 'create') {
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

  return (
    <Box flexDirection="column">
      <Header />
      <Text bold>Create New Wiki</Text>
      {isRawModeSupported ? (
        editing ? (
          <Box flexDirection="column" marginTop={1}>
            <Box>
              <Text>Wiki Slug: </Text>
              <TextInput value={slug} onChange={setSlug} focus={focus === 'slug'} onSubmit={() => setFocusIndex(1)} />
            </Box>
            <Box>
              <Text>Title (optional): </Text>
              <TextInput value={title} onChange={setTitle} focus={focus === 'title'} onSubmit={() => setFocusIndex(2)} />
            </Box>
            <Box>
              <Text>Workspace: </Text>
              <TextInput
                value={workspace}
                onChange={setWorkspace}
                focus={focus === 'workspace'}
                onSubmit={() => setFocusIndex(3)}
              />
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
          <Text>Wiki Slug: {slug}</Text>
          <Text>Title (optional): {title}</Text>
          <Text>Workspace: {workspace}</Text>
          <Text>[ Create Wiki ] [ Back ]</Text>
          <Text dimColor>Interactive form requires a TTY.</Text>
        </Box>
      )}
      {status === 'busy' && <LoadingSpinner label="Creating wiki..." />}
      {status === 'success' && <SuccessBox message={message} />}
      {status === 'error' && <ErrorBox message={message} />}
      <Footer helpText="Tab: next field | Enter: select | Press Escape to go back" />
    </Box>
  );
}
