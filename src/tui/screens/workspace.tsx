import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { existsSync } from 'fs';
import path from 'path';

interface WorkspaceScreenProps {
  workspace: string;
  onSelect: (workspace: string) => void;
  onCancel: () => void;
}

export function WorkspaceScreen({ workspace, onSelect, onCancel }: WorkspaceScreenProps): React.ReactElement {
  const [value, setValue] = useState(workspace);
  const [error, setError] = useState<string | undefined>(undefined);

  function handleSubmit(): void {
    const resolved = path.resolve(value);
    if (!existsSync(resolved)) {
      setError(`Directory does not exist: ${resolved}`);
      return;
    }
    setError(undefined);
    onSelect(resolved);
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text>Enter the workspace directory path:</Text>
      <Box>
        <Text>{'> '}</Text>
        <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />
      </Box>
      {error && <Text color="red">{error}</Text>}
      <Text dimColor>Press Enter to confirm, Esc to cancel</Text>
    </Box>
  );
}
