import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';

interface ResultScreenProps {
  slug: string;
  summary: string;
  failed?: boolean;
  onBack: () => void;
  onConfigureLlm?: () => void;
}

export function ResultScreen({ slug, summary, failed = false, onBack, onConfigureLlm }: ResultScreenProps): React.ReactElement {
  const items = [
    { label: 'Back to dashboard', value: 'dashboard' },
    { label: failed ? 'Configure LLM' : 'View wiki files', value: failed ? 'llm-config' : 'files' },
  ];

  function handleSelect(item: { value: string }): void {
    if (item.value === 'dashboard') {
      onBack();
    } else if (item.value === 'llm-config' && onConfigureLlm) {
      onConfigureLlm();
    }
    // 'files' is informational for now.
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row" gap={1}>
        <Text bold color={failed ? 'red' : 'green'}>{failed ? '✗ Failed' : '✓ Done'}</Text>
        <Text>{slug}</Text>
      </Box>
      <Text>{summary}</Text>
      <Box marginY={1}>
        <SelectInput items={items} onSelect={handleSelect} />
      </Box>
    </Box>
  );
}
