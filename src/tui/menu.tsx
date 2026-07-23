import React, { useEffect, useState } from 'react';
import { existsSync } from 'node:fs';
import { Box, Text, useInput, useStdin } from 'ink';
import SelectInput from 'ink-select-input';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { legacySettingsPath, settingsPath } from './settings';
import type { Screen } from './app';

export interface MenuItem {
  label: string;
  value: Screen;
}

/**
 * Phase 11 (phase doc §2.3): the production menu — exactly these five items,
 * in this order, with clean labels (no parenthetical command suffixes).
 */
export const MENU_ITEMS: MenuItem[] = [
  { label: 'Create New Wiki', value: 'init' },
  { label: 'Add PDFs', value: 'add-pdfs' },
  { label: 'Ingest PDFs', value: 'ingest' },
  { label: 'Settings', value: 'settings' },
  { label: 'Exit', value: 'exit' },
];

/**
 * Pure mapping from a selected menu item value to the screen it navigates to.
 * Exported so navigation can be verified in tests without a TTY.
 */
export function resolveMenuSelection(value: string): Screen {
  const item = MENU_ITEMS.find((i) => i.value === value);
  return item ? item.value : 'menu';
}

export interface MenuScreenProps {
  onSelect: (screen: Screen) => void;
  lastResult: string;
  /** Workspace directory holding the settings file (default '.'). */
  workspace?: string;
}

export function MenuScreen({ onSelect, lastResult, workspace = '.' }: MenuScreenProps) {
  // Only activate input handling when raw mode is available (a real TTY);
  // otherwise Ink 7 throws on non-TTY stdin (e.g. piped output, test runner).
  const { isRawModeSupported } = useStdin();
  // Phase 11 (phase doc §2.4): first-launch welcome splash — shown only when
  // neither `.paper-chase.json` nor the legacy `.llm-wiki-cli.json` exists in
  // the workspace yet. Nothing extra renders while the check is in flight.
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.resolve()
      .then(() => {
        const hasSettings = existsSync(settingsPath(workspace)) || existsSync(legacySettingsPath(workspace));
        if (mounted) {
          setShowSplash(!hasSettings);
        }
      })
      .catch(() => {
        // A settings-file check failure must never break the menu.
      });
    return () => {
      mounted = false;
    };
  }, [workspace]);

  useInput(
    (_input, key) => {
      if (key.escape) {
        onSelect('exit');
      }
    },
    { isActive: isRawModeSupported === true },
  );

  return (
    <Box flexDirection="column">
      <Header />
      {showSplash ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text>Paper Chase v.1.0 — the paper chase, automated.</Text>
          <Text>Create a wiki, add PDFs, then ingest.</Text>
        </Box>
      ) : null}
      {isRawModeSupported ? (
        <SelectInput items={MENU_ITEMS} onSelect={(item: MenuItem) => onSelect(resolveMenuSelection(item.value))} />
      ) : (
        // Non-TTY fallback (piped output, test runner): ink-select-input's
        // input handling requires raw mode, so render the same items
        // statically instead of crashing.
        MENU_ITEMS.map((item) => <Text key={item.value}>{item.label}</Text>)
      )}
      {lastResult ? <Text>Last: {lastResult}</Text> : null}
      <Footer helpText="Arrow keys to navigate, Enter to select, Escape to exit" />
    </Box>
  );
}
