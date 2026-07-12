import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { configureLlmCommand } from '../../commands/configure-llm.js';

const PROVIDERS = ['kimi', 'openai', 'anthropic', 'openai-compatible', 'test'];

interface LlmConfigScreenProps {
  workspace: string;
  onBack: () => void;
  onSaved: () => void;
}

export function LlmConfigScreen({ workspace, onBack, onSaved }: LlmConfigScreenProps): React.ReactElement {
  const [provider, setProvider] = useState('kimi');
  const [model, setModel] = useState('k2.7-code');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [field, setField] = useState(0);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const fields = [
    { label: 'Provider', value: provider, set: setProvider },
    { label: 'Model', value: model, set: setModel },
    { label: 'Base URL (optional)', value: baseUrl, set: setBaseUrl },
    { label: 'API Key', value: apiKey, set: setApiKey },
  ];

  async function handleSubmit(): Promise<void> {
    try {
      setStatus('Saving...');
      setError(undefined);
      await configureLlmCommand({
        workspace,
        provider,
        model,
        baseUrl: baseUrl || undefined,
        apiKey,
        interactive: false,
      });
      setStatus('Saved and tested.');
      setTimeout(() => onSaved(), 800);
    } catch (err) {
      setStatus(undefined);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Configure LLM</Text>
      {fields.map((f, index) => (
        <Box key={f.label} flexDirection="row" gap={1}>
          <Text color={index === field ? 'cyan' : undefined}>{f.label}:</Text>
          {index === field ? (
            <TextInput
              value={f.value}
              onChange={f.set}
              onSubmit={() => {
                if (index === fields.length - 1) {
                  handleSubmit();
                } else {
                  setField(index + 1);
                }
              }}
              mask={f.label === 'API Key' ? '*' : undefined}
            />
          ) : (
            <Text>{f.value ? (f.label === 'API Key' ? '•'.repeat(f.value.length) : f.value) : '(empty)'}</Text>
          )}
        </Box>
      ))}
      {status && <Text color="green">{status}</Text>}
      {error && <Text color="red">{error}</Text>}
      <Text dimColor>Tab/Enter next • Enter on last field saves</Text>
    </Box>
  );
}
