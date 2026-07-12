import React from 'react';
import { Box, Text } from 'ink';

interface ProgressBarProps {
  current: number;
  total: number;
  width?: number;
  label?: string;
}

export function ProgressBar({ current, total, width = 20, label }: ProgressBarProps): React.ReactElement {
  const ratio = total > 0 ? current / total : 0;
  const filled = Math.round(ratio * width);
  const empty = Math.max(0, width - filled);
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  return (
    <Box flexDirection="row" gap={1}>
      {label && <Text>{label}</Text>}
      <Text color="green">{bar}</Text>
      <Text dimColor>{current}/{total}</Text>
    </Box>
  );
}
