import React, { useEffect, useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { SuccessBox } from './components/success-box';
import { ErrorBox } from './components/error-box';
import { loadSettings, saveSettings, type TuiSettings } from './settings';
import type { ScreenProps } from './init-screen';

export interface SettingsScreenProps extends ScreenProps {
  /** Workspace directory containing `.llm-wiki-cli.json` (default '.'). */
  workspace?: string;
}

type SettingRow = 'synthesis' | 'updateAgents' | 'pdfEngine' | 'save' | 'back';
const ROW_ORDER: SettingRow[] = ['synthesis', 'updateAgents', 'pdfEngine', 'save', 'back'];

const PDF_ENGINE_HINTS: Record<'pdfjs' | 'opendataloader', string> = {
  pdfjs: 'pdfjs — default, no dependencies',
  opendataloader: 'opendataloader — better layouts/tables, requires Java',
};

type SettingsStatus = 'idle' | 'saving' | 'success' | 'error';

/**
 * Settings screen (Phase 5): toggles for synthesis and future options.
 *
 * Up/Down moves between rows. Space or Left/Right toggles the selected option.
 * Enter on "Save" persists to `.llm-wiki-cli.json`.
 */
export function SettingsScreen({ onBack, onResult, workspace = '.' }: SettingsScreenProps) {
  const { isRawModeSupported } = useStdin();
  const [settings, setSettings] = useState<TuiSettings>({ synthesis: false, updateAgents: false });
  const [loaded, setLoaded] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [status, setStatus] = useState<SettingsStatus>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    loadSettings(workspace)
      .then((s) => {
        if (mounted) {
          setSettings(s);
          setLoaded(true);
        }
      })
      .catch((err) => {
        if (mounted) {
          setStatus('error');
          setMessage(`Could not load settings: ${(err as Error).message}`);
          setLoaded(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, [workspace]);

  const save = async () => {
    setStatus('saving');
    try {
      // Phase 10: always persist pdfEngine explicitly so the user's engine
      // choice is durable (absent would silently fall back to pdfjs).
      await saveSettings(workspace, { ...settings, pdfEngine: settings.pdfEngine ?? 'pdfjs' });
      setStatus('success');
      const msg = `Settings saved to ${workspace}/.llm-wiki-cli.json`;
      setMessage(msg);
      onResult?.(msg);
    } catch (err) {
      const errorMessage = (err as Error).message;
      setStatus('error');
      setMessage(`Error saving settings: ${errorMessage}`);
      onResult?.(`Error: ${errorMessage}`);
    }
  };

  useInput(
    (_input, key) => {
      if (status === 'saving') {
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
      if (key.upArrow) {
        setFocusIndex((focusIndex + ROW_ORDER.length - 1) % ROW_ORDER.length);
        return;
      }
      if (key.downArrow) {
        setFocusIndex((focusIndex + 1) % ROW_ORDER.length);
        return;
      }

      const row = ROW_ORDER[focusIndex];
      if (row === 'synthesis' || row === 'updateAgents') {
        if (_input === ' ' || key.leftArrow || key.rightArrow) {
          setSettings((prev) => ({ ...prev, [row]: !prev[row] }));
        }
      }
      if (row === 'pdfEngine') {
        // Phase 10: cycle pdfjs ↔ opendataloader on Space/Left/Right.
        if (_input === ' ' || key.leftArrow || key.rightArrow) {
          setSettings((prev) => ({
            ...prev,
            pdfEngine: (prev.pdfEngine ?? 'pdfjs') === 'pdfjs' ? 'opendataloader' : 'pdfjs',
          }));
        }
      }

      if (key.return) {
        if (row === 'save') {
          void save();
        } else if (row === 'back') {
          onBack();
        }
      }
    },
    { isActive: isRawModeSupported === true },
  );

  const focus = ROW_ORDER[focusIndex];

  const renderToggle = (row: keyof TuiSettings, label: string) => {
    const active = focus === row;
    const on = settings[row] as boolean;
    return (
      <Box key={row}>
        <Text inverse={active} color={active ? 'cyan' : undefined}>
          {active ? '> ' : '  '}
          {label}: [{on ? 'ON' : 'OFF'}]
        </Text>
      </Box>
    );
  };

  const renderPdfEngine = () => {
    const active = focus === 'pdfEngine';
    const engine = settings.pdfEngine ?? 'pdfjs';
    return (
      <Box key="pdfEngine" flexDirection="column">
        <Text inverse={active} color={active ? 'cyan' : undefined}>
          {active ? '> ' : '  '}
          PDF Engine: [‹ {engine} ›]
        </Text>
        <Text dimColor>    {PDF_ENGINE_HINTS[engine]}</Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      <Header />
      <Text bold>Settings</Text>
      {isRawModeSupported ? (
        <Box flexDirection="column" marginTop={1}>
          {renderToggle('synthesis', 'Synthesis')}
          {renderToggle('updateAgents', 'Update Agents')}
          {renderPdfEngine()}
          <Box marginTop={1} gap={2}>
            <Text inverse={focus === 'save'} color={focus === 'save' ? 'cyan' : undefined}>
              [ Save ]
            </Text>
            <Text inverse={focus === 'back'} color={focus === 'back' ? 'cyan' : undefined}>
              [ Back ]
            </Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Text>Synthesis: {settings.synthesis ? 'ON' : 'OFF'}</Text>
          <Text>Update Agents: {settings.updateAgents ? 'ON' : 'OFF'}</Text>
          <Text>PDF Engine: {settings.pdfEngine ?? 'pdfjs'}</Text>
          <Text dimColor>Interactive settings require a TTY.</Text>
        </Box>
      )}
      {!loaded && <Text dimColor>Loading settings...</Text>}
      {status === 'success' && <SuccessBox message={message} />}
      {status === 'error' && <ErrorBox message={message} />}
      <Footer helpText="Up/Down: select | Space/Left/Right: toggle/cycle | Enter: save/back | Escape: back" />
    </Box>
  );
}
