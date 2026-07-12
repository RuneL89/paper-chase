import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';

interface WelcomeScreenProps {
  workspace: string;
  onWorkspaceSelected: (workspace: string) => void;
  onChangeWorkspace: () => void;
  onConfigureLlm: () => void;
  onCreateWiki: () => void;
}

export function WelcomeScreen({
  workspace,
  onWorkspaceSelected,
  onChangeWorkspace,
  onConfigureLlm,
  onCreateWiki,
}: WelcomeScreenProps): React.ReactElement {
  const items = [
    { label: `Open workspace: ${workspace}`, value: 'open' },
    { label: 'Choose different workspace', value: 'workspace' },
    { label: 'Configure LLM', value: 'llm' },
    { label: 'Create or manage wikis', value: 'create' },
    { label: 'Quit', value: 'quit' },
  ];

  function handleSelect(item: { value: string }): void {
    switch (item.value) {
      case 'open':
        onWorkspaceSelected(workspace);
        break;
      case 'workspace':
        onChangeWorkspace();
        break;
      case 'llm':
        onConfigureLlm();
        break;
      case 'create':
        onCreateWiki();
        break;
      case 'quit':
        process.exit(0);
        break;
    }
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column" alignItems="center" marginBottom={1}>
        <Text bold color="cyan">Welcome to LLM Wiki CLI</Text>
        <Text dimColor>Turn PDF collections into citation-backed wikis</Text>
      </Box>

      <Box flexDirection="column" gap={1}>
        <Text>What would you like to do?</Text>
        <SelectInput items={items} onSelect={handleSelect} />
      </Box>
    </Box>
  );
}
