import React from 'react';
import { Box, Text } from 'ink';

export interface ErrorBoxProps {
  message: string;
}

export function ErrorBox({ message }: ErrorBoxProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={1} marginTop={1}>
      <Text bold color="red">
        Error
      </Text>
      <Text>{message}</Text>
      <Text dimColor>Press any key to continue</Text>
    </Box>
  );
}
