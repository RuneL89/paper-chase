import React from 'react';
import { TreeBrowser } from './components/tree-browser';
import type { ScreenProps } from './init-screen';

export interface DoxBrowserProps extends ScreenProps {
  workspace?: string;
  wiki?: string;
}

/**
 * Browse the DOX contract hierarchy for a wiki.
 *
 * Displays the tree of index.md files and content pages, excluding raw/
 * (source PDFs) and .state/ (tooling state). Selecting an index.md shows the
 * contract content; selecting a content page opens the file viewer.
 */
export function DoxBrowser({ onBack, workspace = '.', wiki }: DoxBrowserProps) {
  return (
    <TreeBrowser
      workspace={workspace}
      wiki={wiki}
      rootFolder=""
      rootName={wiki ? `${wiki}/` : 'wiki/'}
      title="Browse DOX Contracts"
      excludeFolders={['raw', '.state']}
      excludeFiles={['AGENTS.md']}
      onBack={onBack}
    />
  );
}
