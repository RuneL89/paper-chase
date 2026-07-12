import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { discoverWikis } from '../../workspace.js';
import { loadConfig } from '../../config.js';
import type { WikiSummary } from '../types.js';

interface DashboardScreenProps {
  workspace: string;
  onWikiSelected: (slug: string) => void;
  onCreateWiki: () => void;
  onConfigureLlm: () => void;
}

export function DashboardScreen({
  workspace,
  onWikiSelected,
  onCreateWiki,
  onConfigureLlm,
}: DashboardScreenProps): React.ReactElement {
  const [wikis, setWikis] = useState<WikiSummary[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    try {
      const slugs = discoverWikis(workspace);
      const summaries = slugs.map((slug) => {
        const config = loadConfig(workspace, slug);
        return {
          slug,
          title: config.wiki.title,
          description: config.wiki.description,
          status: config.status ?? 'unknown',
          sourceCount: 0,
          documentCount: 0,
          entityCount: 0,
          topicCount: 0,
          rawCount: 0,
        };
      });
      setWikis(summaries);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [workspace]);

  const items = [
    ...wikis.map((wiki) => ({
      label: `${wiki.slug} — ${wiki.title} (${wiki.status})`,
      value: wiki.slug,
    })),
    { label: 'Create new wiki', value: 'create' },
    { label: 'Configure LLM', value: 'llm' },
  ];

  function handleSelect(item: { value: string }): void {
    if (item.value === 'create') {
      onCreateWiki();
    } else if (item.value === 'llm') {
      onConfigureLlm();
    } else {
      onWikiSelected(item.value);
    }
  }

  if (error) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="red">Could not load wikis: {error}</Text>
        <Text dimColor>Make sure the workspace has a wikis/ folder.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Wikis in workspace</Text>
      {wikis.length === 0 && (
        <Text dimColor>No wikis found. Create one to get started.</Text>
      )}
      <SelectInput items={items} onSelect={handleSelect} />
    </Box>
  );
}
