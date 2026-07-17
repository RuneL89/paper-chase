import React from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import SelectInput from 'ink-select-input';
import { Header } from './components/header';
import { Footer } from './components/footer';
import type { Screen } from './app';

export interface MenuItem {
  label: string;
  value: Screen;
}

export const MENU_ITEMS: MenuItem[] = [
  { label: 'Create New Wiki (init)', value: 'init' },
  { label: 'Ingest PDFs (ingest)', value: 'ingest' },
  // User-directed extension 2026-07-17: copy PDFs into raw/ from the TUI
  // (compliance log entry "2026-07-17 10:20"; supersedes gate 0.7's 5-item menu).
  { label: 'Add PDFs (copy into raw/)', value: 'add-pdfs' },
  { label: 'Run Tests', value: 'test' },
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
}

export function MenuScreen({ onSelect, lastResult }: MenuScreenProps) {
  // Only activate input handling when raw mode is available (a real TTY);
  // otherwise Ink 7 throws on non-TTY stdin (e.g. piped output, test runner).
  const { isRawModeSupported } = useStdin();
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
