import React from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { Header } from './components/header';
import { Footer } from './components/footer';
import type { ScreenProps } from './init-screen';

export function IngestScreen({ onBack }: ScreenProps) {
  const { isRawModeSupported } = useStdin();
  useInput(
    (_input, key) => {
      if (key.escape) {
        onBack();
      }
    },
    { isActive: isRawModeSupported === true },
  );

  return (
    <Box flexDirection="column">
      <Header />
      <Text bold>Ingest PDFs</Text>
      <Text>Coming in Phase 1+: ingest PDFs into a wiki.</Text>
      <Footer helpText="Press Escape to go back" />
    </Box>
  );
}
