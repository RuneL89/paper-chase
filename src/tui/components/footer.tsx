import React from 'react';
import { Box, Text } from 'ink';

export interface FooterProps {
  helpText?: string;
}

export function Footer({ helpText }: FooterProps) {
  return (
    <Box marginTop={1}>
      <Text dimColor>{helpText ?? 'Arrow keys: navigate | Enter: select | Escape: back'}</Text>
    </Box>
  );
}
