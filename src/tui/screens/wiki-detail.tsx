import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { readdirSync, existsSync } from 'fs';
import path from 'path';
import { wikiRawPath } from '../../workspace.js';
import { loadConfig } from '../../config.js';

interface WikiDetailScreenProps {
  workspace: string;
  slug: string;
  onBack: () => void;
  onStartOperation: (type: 'sample' | 'ingest', slug: string, pdfPath?: string) => void;
}

export function WikiDetailScreen({
  workspace,
  slug,
  onBack,
  onStartOperation,
}: WikiDetailScreenProps): React.ReactElement {
  const [pdfs, setPdfs] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('unknown');

  useEffect(() => {
    const rawDir = wikiRawPath(workspace, slug);
    if (existsSync(rawDir)) {
      const files = readdirSync(rawDir)
        .filter((f) => f.toLowerCase().endsWith('.pdf'))
        .sort();
      setPdfs(files);
    }
    try {
      const config = loadConfig(workspace, slug);
      setStatus(config.status ?? 'unknown');
    } catch {
      setStatus('unknown');
    }
  }, [workspace, slug]);

  const items = [
    { label: 'Run sample', value: 'sample' },
    { label: 'Run full ingestion', value: 'ingest' },
    { label: 'Add PDFs (copy files to raw/)', value: 'add' },
    { label: 'Back', value: 'back' },
  ];

  function handleSelect(item: { value: string }): void {
    switch (item.value) {
      case 'sample':
        onStartOperation('sample', slug);
        break;
      case 'ingest':
        onStartOperation('ingest', slug);
        break;
      case 'add':
        // For now, just show instructions.
        break;
      case 'back':
        onBack();
        break;
    }
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold>Wiki: {slug}</Text>
        <Text color={status === 'ready' ? 'green' : 'yellow'}>Status: {status}</Text>
      </Box>
      <Box>
        <Text>PDFs in raw/: {pdfs.length}</Text>
      </Box>
      <Box marginY={1}>
        <Text dimColor>{pdfs.slice(0, 10).join(', ')}{pdfs.length > 10 ? '...' : ''}</Text>
      </Box>
      <SelectInput items={items} onSelect={handleSelect} />
    </Box>
  );
}
