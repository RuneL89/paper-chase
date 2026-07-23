import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { MenuScreen } from './menu';
import { InitScreen } from './init-screen';
import { IngestScreen } from './ingest-screen';
import { AddPdfsScreen } from './add-pdfs-screen';
import { SettingsScreen } from './settings-screen';
import { AgentsReviewScreen } from './agents-review-screen';

/**
 * Phase 11 (phase doc §2.3): the production screen set — the development and
 * review screens (Run Tests, Test Extractor, Validation Report, Ingestion
 * Log, Entity/Topic/DOX browsers, AGENTS.md review, Structural Changes) are
 * gone; their `.state/` data outputs keep being written by the pipeline and
 * are reviewed as files.
 *
 * Phase 11 v1.6.0 (user directive 2026-07-23): 'agents-review' is restored
 * as a FLOW-ONLY screen — it is NOT in MENU_ITEMS (the main menu stays at
 * exactly five items, gate 11.3) and is reachable only from the post-ingest
 * shortcut (Ingest screen's `p` key when the run proposed AGENTS.md
 * updates).
 */
export type Screen = 'menu' | 'init' | 'add-pdfs' | 'ingest' | 'settings' | 'agents-review' | 'exit';

export interface AppProps {
  /**
   * Workspace directory holding `wikis/` and the settings file (default '.').
   * Threaded into every screen; tests pass a temp workspace so driving the
   * App stays hermetic without chdir.
   */
  workspace?: string;
  /**
   * Injectable ingestion implementation (test-only, Phase 11 v1.6.0).
   * Threaded into the Ingest screen so app-level flow tests can complete an
   * ingest without disk-heavy PDF work or LLM calls.
   */
  ingestFn?: (slug: string, options: Record<string, unknown>) => Promise<unknown>;
}

export function App({ workspace = '.', ingestFn }: AppProps) {
  const [screen, setScreen] = useState<Screen>('menu');
  const [lastResult, setLastResult] = useState<string>('');
  // Phase 11 (phase doc §2.4, Gate 11.4): the continuous workflow wiki. Set
  // when Create New Wiki succeeds (carried into Add PDFs, skipping the wiki
  // selector) and when the post-add "Start ingesting now?" prompt is
  // confirmed (carried into Ingest PDFs as the pre-selected wiki). Cleared
  // whenever the user navigates via the menu or backs out of a screen.
  const [flowWiki, setFlowWiki] = useState<string | undefined>(undefined);

  if (screen === 'exit') {
    return (
      <Box>
        <Text>Goodbye!</Text>
      </Box>
    );
  }

  const goToMenu = () => {
    setFlowWiki(undefined);
    setScreen('menu');
  };

  return (
    <Box flexDirection="column">
      {screen === 'menu' && (
        <MenuScreen
          onSelect={(next) => {
            setFlowWiki(undefined);
            setScreen(next);
          }}
          lastResult={lastResult}
          workspace={workspace}
        />
      )}
      {screen === 'init' && (
        <InitScreen
          onBack={goToMenu}
          onResult={setLastResult}
          defaultWorkspace={workspace}
          // Continuous workflow: a successful create flows straight into
          // Add PDFs with the new wiki pre-selected (no return to menu).
          onCreated={(wiki) => {
            setFlowWiki(wiki);
            setScreen('add-pdfs');
          }}
        />
      )}
      {screen === 'add-pdfs' && (
        <AddPdfsScreen
          onBack={goToMenu}
          onResult={setLastResult}
          workspace={workspace}
          initialWiki={flowWiki}
          onStartIngest={(wiki) => {
            setFlowWiki(wiki);
            setScreen('ingest');
          }}
        />
      )}
      {screen === 'ingest' && (
        <IngestScreen
          onBack={goToMenu}
          onResult={setLastResult}
          workspace={workspace}
          initialWiki={flowWiki}
          ingestFn={ingestFn}
          // Phase 11 v1.6.0: the post-ingest shortcut — when the run wrote
          // `.state/proposed-agents.md`, the success state offers `p` to jump
          // straight into the review screen for that wiki.
          onReviewAgents={(wiki) => {
            setFlowWiki(wiki);
            setScreen('agents-review');
          }}
        />
      )}
      {screen === 'agents-review' && (
        <AgentsReviewScreen
          // Flow-only screen: onBack returns to the MENU (not back to the
          // ingest screen) — the ingest result already persists as the menu's
          // Last: line, so the menu is the simplest coherent landing target.
          onBack={goToMenu}
          onResult={setLastResult}
          workspace={workspace}
          wiki={flowWiki}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen onBack={goToMenu} onResult={setLastResult} workspace={workspace} />
      )}
    </Box>
  );
}
