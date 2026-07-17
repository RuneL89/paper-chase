import React from 'react';
import { TreeBrowser } from './components/tree-browser';
import type { ScreenProps } from './init-screen';

export interface TopicBrowserProps extends ScreenProps {
  workspace?: string;
  wiki?: string;
}

export function TopicBrowser({ onBack, workspace = '.', wiki }: TopicBrowserProps) {
  return (
    <TreeBrowser
      workspace={workspace}
      wiki={wiki}
      rootFolder="topics/"
      title="Browse Topics"
      onBack={onBack}
    />
  );
}
