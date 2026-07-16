import React from 'react';
import { Box, Text } from 'ink';

export interface HeaderProps {
  currentWiki?: string;
}

export function Header({ currentWiki }: HeaderProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
      <Text bold color="cyan">
        LLM Wiki CLI v2.0
      </Text>
      {currentWiki ? <Text>Wiki: {currentWiki}</Text> : null}
    </Box>
  );
}
