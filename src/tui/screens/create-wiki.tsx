import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { initCommand } from '../../commands/init.js';

interface CreateWikiScreenProps {
  workspace: string;
  onBack: () => void;
  onCreated: (slug: string) => void;
}

export function CreateWikiScreen({ workspace, onBack, onCreated }: CreateWikiScreenProps): React.ReactElement {
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [field, setField] = useState(0);
  const [error, setError] = useState<string | undefined>(undefined);

  const fields = [
    { label: 'Slug', value: slug, set: setSlug },
    { label: 'Title', value: title, set: setTitle },
    { label: 'Description', value: description, set: setDescription },
  ];

  async function handleSubmit(): Promise<void> {
    try {
      setError(undefined);
      await initCommand({
        workspace,
        slug,
        title: title || undefined,
        description: description || undefined,
      });
      onCreated(slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Create new wiki</Text>
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
            />
          ) : (
            <Text>{f.value || '(empty)'}</Text>
          )}
        </Box>
      ))}
      {error && <Text color="red">{error}</Text>}
      <Text dimColor>Tab/Enter next • Enter on last field creates wiki • Esc back</Text>
    </Box>
  );
}
