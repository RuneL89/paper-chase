import React from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { Header } from './components/header';
import { Footer } from './components/footer';

export interface ScreenProps {
  onBack: () => void;
  onResult?: (result: string) => void;
}

export function InitScreen({ onBack }: ScreenProps) {
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
      <Text bold>Create New Wiki</Text>
      <Text>Coming in Phase 1: create a new wiki (init).</Text>
      <Footer helpText="Press Escape to go back" />
    </Box>
  );
}
