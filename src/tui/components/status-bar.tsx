import React from 'react';
import { Box, Text } from 'ink';
import type { TuiScreen } from '../types.js';

interface StatusBarProps {
  screen: TuiScreen;
}

export function StatusBar({ screen }: StatusBarProps): React.ReactElement {
  const hints: Record<TuiScreen, string> = {
    welcome: '↑/↓ navigate • Enter select • q quit',
    workspace: 'Enter path • Esc back',
    dashboard: '↑/↓ navigate • Enter select wiki • c create • l configure LLM • Esc back',
    'wiki-detail': 'Enter run action • Esc back',
    'llm-config': 'Tab navigate • Enter save • Esc back',
    'create-wiki': 'Tab navigate • Enter save • Esc back',
    progress: 'Running... wait for completion',
    result: 'Enter continue • Esc dashboard',
  };

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} height={3}>
      <Text dimColor>{hints[screen] ?? 'Esc back'}</Text>
    </Box>
  );
}
