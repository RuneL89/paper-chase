import React from 'react';
import { Box, Text } from 'ink';

export interface SuccessBoxProps {
  message: string;
}

export function SuccessBox({ message }: SuccessBoxProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1} marginTop={1}>
      <Text bold color="green">
        Success
      </Text>
      <Text>{message}</Text>
    </Box>
  );
}
