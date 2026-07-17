import React from 'react';
import { TreeBrowser } from './components/tree-browser';
import type { ScreenProps } from './init-screen';

export interface EntityBrowserProps extends ScreenProps {
  workspace?: string;
  wiki?: string;
}

export function EntityBrowser({ onBack, workspace = '.', wiki }: EntityBrowserProps) {
  return (
    <TreeBrowser
      workspace={workspace}
      wiki={wiki}
      rootFolder="entities/"
      title="Browse Entities"
      onBack={onBack}
    />
  );
}
