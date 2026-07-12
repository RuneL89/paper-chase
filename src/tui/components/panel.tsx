import React from 'react';
import { Box, Text } from 'ink';

interface PanelProps {
  title?: string;
  children: React.ReactNode;
  flexGrow?: number;
  flexBasis?: number;
  height?: number;
}

export function Panel({ title, children, flexGrow, flexBasis, height }: PanelProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      flexGrow={flexGrow}
      flexBasis={flexBasis}
      height={height}
      borderStyle="round"
      borderColor="blue"
      padding={1}
    >
      {title && (
        <Box marginBottom={1}>
          <Text bold color="cyan">{title}</Text>
        </Box>
      )}
      {children}
    </Box>
  );
}
