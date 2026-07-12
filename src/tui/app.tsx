import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { TuiScreen } from './types.js';
import { WelcomeScreen } from './screens/welcome.js';
import { WorkspaceScreen } from './screens/workspace.js';
import { DashboardScreen } from './screens/dashboard.js';
import { WikiDetailScreen } from './screens/wiki-detail.js';
import { LlmConfigScreen } from './screens/llm-config.js';
import { CreateWikiScreen } from './screens/create-wiki.js';
import { ProgressScreen } from './screens/progress.js';
import { ResultScreen } from './screens/result.js';
import { StatusBar } from './components/status-bar.js';

export interface AppProps {
  workspace: string;
  nonInteractive?: boolean;
}

export function App({ workspace: initialWorkspace, nonInteractive }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [screen, setScreen] = useState<TuiScreen>('welcome');
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [selectedWiki, setSelectedWiki] = useState<string | undefined>(undefined);
  const [operation, setOperation] = useState<{ type: 'sample' | 'ingest'; slug: string; pdfPath?: string } | undefined>(undefined);
  const [result, setResult] = useState<{ slug: string; summary: string; failed?: boolean } | undefined>(undefined);
  const [operationComplete, setOperationComplete] = useState(false);

  useEffect(() => {
    if (nonInteractive) {
      return;
    }
    if (workspace !== process.cwd() && workspace) {
      setScreen('dashboard');
    }
  }, [workspace, nonInteractive]);

  function navigateTo(next: TuiScreen): void {
    setScreen(next);
  }

  function handleWorkspaceSelected(newWorkspace: string): void {
    setWorkspace(newWorkspace);
    setScreen('dashboard');
  }

  function handleWikiSelected(slug: string): void {
    setSelectedWiki(slug);
    setScreen('wiki-detail');
  }

  function handleStartOperation(type: 'sample' | 'ingest', slug: string, pdfPath?: string): void {
    setOperation({ type, slug, pdfPath });
    setOperationComplete(false);
    setScreen('progress');
  }

  function handleOperationComplete(slug: string, summary: string, failed = false): void {
    setResult({ slug, summary, failed });
    setOperation(undefined);
    setOperationComplete(true);
    setScreen('result');
  }

  function handleOperationCancel(): void {
    setOperation(undefined);
    setOperationComplete(true);
    setScreen('dashboard');
  }

  return (
    <Box flexDirection="column" height="100%" width="100%" padding={1} gap={1}>
      {!nonInteractive && (
        <KeyHandler
          screen={screen}
          operationComplete={operationComplete}
          onExit={exit}
          onNavigate={navigateTo}
        />
      )}
      <Box flexDirection="row" justifyContent="space-between" alignItems="center">
        <Text bold color="cyan">LLM Wiki CLI</Text>
        <Text dimColor>{workspace}</Text>
      </Box>

      <Box flexGrow={1}>
        {screen === 'welcome' && (
          <WelcomeScreen
            workspace={workspace}
            onWorkspaceSelected={handleWorkspaceSelected}
            onChangeWorkspace={() => setScreen('workspace')}
            onConfigureLlm={() => setScreen('llm-config')}
            onCreateWiki={() => setScreen('dashboard')}
          />
        )}
        {screen === 'workspace' && (
          <WorkspaceScreen
            workspace={workspace}
            onSelect={handleWorkspaceSelected}
            onCancel={() => setScreen('welcome')}
          />
        )}
        {screen === 'dashboard' && (
          <DashboardScreen
            workspace={workspace}
            onWikiSelected={handleWikiSelected}
            onCreateWiki={() => setScreen('create-wiki')}
            onConfigureLlm={() => setScreen('llm-config')}
          />
        )}
        {screen === 'wiki-detail' && selectedWiki && (
          <WikiDetailScreen
            workspace={workspace}
            slug={selectedWiki}
            onBack={() => setScreen('dashboard')}
            onStartOperation={handleStartOperation}
          />
        )}
        {screen === 'llm-config' && (
          <LlmConfigScreen
            workspace={workspace}
            onBack={() => setScreen('welcome')}
            onSaved={() => setScreen('dashboard')}
          />
        )}
        {screen === 'create-wiki' && (
          <CreateWikiScreen
            workspace={workspace}
            onBack={() => setScreen('dashboard')}
            onCreated={(slug) => {
              setSelectedWiki(slug);
              setScreen('wiki-detail');
            }}
          />
        )}
        {screen === 'progress' && operation && (
          <ProgressScreen
            workspace={workspace}
            operation={operation}
            onComplete={handleOperationComplete}
            onCancel={handleOperationCancel}
          />
        )}
        {screen === 'result' && result && (
          <ResultScreen
            slug={result.slug}
            summary={result.summary}
            failed={result.failed}
            onBack={() => setScreen('dashboard')}
            onConfigureLlm={() => setScreen('llm-config')}
          />
        )}
      </Box>

      <StatusBar screen={screen} />
    </Box>
  );
}

interface KeyHandlerProps {
  screen: TuiScreen;
  operationComplete: boolean;
  onExit: () => void;
  onNavigate: (screen: TuiScreen) => void;
}

function KeyHandler({ screen, operationComplete, onExit, onNavigate }: KeyHandlerProps): null {
  useInput((input, key) => {
    if (key.escape) {
      if (screen === 'welcome') {
        onExit();
      } else if (screen === 'progress' && !operationComplete) {
        // Do not allow escaping during a running operation.
      } else if (screen === 'result') {
        onNavigate('dashboard');
      } else {
        onNavigate('welcome');
      }
    }
  });

  return null;
}
