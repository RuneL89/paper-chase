import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { MenuScreen } from './menu';
import { InitScreen } from './init-screen';
import { IngestScreen } from './ingest-screen';
import { AddPdfsScreen } from './add-pdfs-screen';
import { SettingsScreen } from './settings-screen';
import { AgentsReviewScreen } from './agents-review-screen';
import type { WikiRef } from './hooks/use-wiki-list';

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
   * Initial workspace seed — the legacy single-workspace prop (default '.').
   * Threaded into every screen; tests pass a temp workspace so driving the
   * App stays hermetic without chdir.
   */
  workspace?: string;
  /**
   * 2026-08-28 workspace registry (user-reported bug fix): every folder the
   * TUI knows about, most recently used last. Production (cli.ts) passes the
   * persisted registry; `workspace` stays the single-folder fallback so
   * existing callers behave as a one-entry registry.
   */
  workspaces?: string[];
  /**
   * 2026-08-28: production persistence hook (cli.ts) — fired when a wiki is
   * created in a workspace, so the folder is registered in the launch
   * folder's `.paper-chase.json`. Omitted by tests (the registry then stays
   * in-memory, keeping <App /> renders free of filesystem side effects).
   */
  onWorkspaceRegistered?: (workspace: string) => void;
  /**
   * Folder-picker implementation threaded into InitScreen (test-only, the
   * ingestFn precedent) — tests inject a stub so no real dialog spawns while
   * driving the continuous-workflow create.
   */
  pickFolder?: (initial?: string) => Promise<string | null>;
  /**
   * Injectable ingestion implementation (test-only, Phase 11 v1.6.0).
   * Threaded into the Ingest screen so app-level flow tests can complete an
   * ingest without disk-heavy PDF work or LLM calls.
   */
  ingestFn?: (slug: string, options: Record<string, unknown>) => Promise<unknown>;
}

export function App({ workspace = '.', workspaces, onWorkspaceRegistered, pickFolder, ingestFn }: AppProps) {
  const [screen, setScreen] = useState<Screen>('menu');
  const [lastResult, setLastResult] = useState<string>('');
  // 2026-08-28: the workspace registry is App STATE so a wiki created in any
  // folder activates that folder for every screen in the session (the
  // pre-fix bug left every other screen on the cwd-based seed). The last
  // entry is the active workspace: it seeds the Create New Wiki form and
  // targets the Settings screen.
  const [registered, setRegistered] = useState<string[]>(() => workspaces ?? [workspace]);
  const active = registered[registered.length - 1] ?? '.';
  // Phase 11 (phase doc §2.4, Gate 11.4): the continuous workflow wiki — its
  // slug AND its workspace (2026-08-28). Set when Create New Wiki succeeds
  // (carried into Add PDFs, skipping the wiki selector) and when the
  // post-add "Start ingesting now?" prompt is confirmed (carried into Ingest
  // PDFs as the pre-selected wiki). Cleared whenever the user navigates via
  // the menu or backs out of a screen.
  const [flowWiki, setFlowWiki] = useState<WikiRef | undefined>(undefined);

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
          workspace={active}
        />
      )}
      {screen === 'init' && (
        <InitScreen
          onBack={goToMenu}
          onResult={setLastResult}
          defaultWorkspace={active}
          pickFolder={pickFolder}
          // Continuous workflow: a successful create activates its workspace
          // (2026-08-28 — the pre-fix bug dropped it and Add PDFs copied into
          // the launch folder instead) and flows straight into Add PDFs with
          // the new wiki pre-selected (no return to menu).
          onCreated={(created) => {
            setFlowWiki({ slug: created.slug, workspace: created.workspace });
            setRegistered((previous) => [
              ...previous.filter((entry) => entry !== created.workspace),
              created.workspace,
            ]);
            onWorkspaceRegistered?.(created.workspace);
            setScreen('add-pdfs');
          }}
        />
      )}
      {screen === 'add-pdfs' && (
        <AddPdfsScreen
          onBack={goToMenu}
          onResult={setLastResult}
          workspaces={registered}
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
          workspaces={registered}
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
          workspace={flowWiki?.workspace ?? active}
          wiki={flowWiki?.slug}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen onBack={goToMenu} onResult={setLastResult} workspace={active} />
      )}
    </Box>
  );
}
