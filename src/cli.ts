#!/usr/bin/env node
import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import React from 'react';
import { render } from 'ink';
import { App } from './tui/app';
import { init } from './commands/init';
import { ingest, formatIngestSummary } from './commands/ingest';
import { serializeWorkerEvent, workerFaultAfterProgress, workerFaultBeforeResult, type WorkerEvent } from './commands/worker-protocol';
import { loadWorkspaceRegistry, registerWorkspace } from './tui/workspace-bootstrap';
import { isPackaged } from './utils/app-root';

export const program = new Command();

program
  .name('chase')
  .description('The paper chase, automated. Turn PDFs into citation-backed markdown wikis.')
  .version('1.0.0');

// TUI mode (default: no subcommand). 2026-08-28: the workspace bootstrap —
// the persisted registry (which folders hold wikis) is loaded from the launch
// folder's `.paper-chase.json` and the active workspace gets its one-time
// settings migration; a bootstrap failure never blocks the TUI (default '.').
program.action(async () => {
  let registry: string[] = [];
  let active = '.';
  try {
    const bootstrap = await loadWorkspaceRegistry();
    registry = bootstrap.workspaces.length > 0 ? bootstrap.workspaces : [bootstrap.active];
    active = bootstrap.active;
    await registerWorkspace(active);
  } catch {
    registry = ['.'];
    active = '.';
  }
  render(
    React.createElement(App, {
      workspaces: registry,
      workspace: active,
      onWorkspaceRegistered: (workspace) => {
        void registerWorkspace(workspace).catch(() => {});
      },
    }),
  );
});

// CLI commands (for power users and scripts)
program
  .command('init <slug>')
  .description('Create a new wiki')
  .option('--title <title>', 'Wiki title')
  .option('-w, --workspace <workspace>', 'Workspace directory', '.')
  .option('--output-language <code>', 'Output language (en, da, de, fr, es, no, sv)', 'en')
  .action(async (slug: string, options: { title?: string; workspace: string; outputLanguage?: string }) => {
    try {
      const result = await init(slug, {
        title: options.title,
        workspace: options.workspace,
        outputLanguage: options.outputLanguage as import('./utils/language').LanguageCode | undefined,
      });
      console.log(result.message);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exitCode = 1;
    }
  });

program
  .command('ingest <slug>')
  .description('Ingest PDFs into a wiki')
  .option('-w, --workspace <workspace>', 'Workspace directory', '.')
  .option('--synthesis', 'Enable LLM synthesis for entity, topic, and document pages (Phase 5)')
  .option('--update-agents', 'Propose AGENTS.md updates after ingest (Phase 9); saves to .state/proposed-agents.md for review')
  .option('--no-extract', 'Skip the Layer 2 Extractor (Layer 1 document pages only)')
  .option('--no-dox-llm', 'Skip the LLM DOX Writer (deterministic index.md contracts only)')
  .option('--no-cross-wiki', 'Skip the cross-wiki discovery pass (Phase 24)')
  .option('--force-cross-wiki', 'Force the cross-wiki discovery pass to run (Phase 24)')
  .option('--input-language <code>', 'Input language of this run\'s PDFs (en, da, de, fr, es, no, sv)')
  .option('--output-language <code>', 'Override the wiki output language for this run (en, da, de, fr, es, no, sv)')
  .option('--verbose', 'Verbose output')
  .action(async (slug: string, options: { workspace: string; synthesis?: boolean; updateAgents?: boolean; extract?: boolean; doxLlm?: boolean; crossWiki?: boolean; forceCrossWiki?: boolean; inputLanguage?: string; outputLanguage?: string; verbose?: boolean }) => {
    // --synthesis is Phase 5: opt-in LLM synthesis of entity, topic, and document pages after extraction.
    // --update-agents is Phase 9: opt-in AGENTS.md update proposal written to
    // .state/proposed-agents.md after the ingest (never auto-applied).
    // Extraction (Layer 2) is ON by default per the phase doc; --no-extract
    // opts out (e.g. offline/key-less Layer 1-only runs).
    // The LLM DOX Writer (Phase 6) is ON by default for production runs;
    // --no-dox-llm opts out (deterministic index.md contracts, no LLM calls).
    // The cross-wiki discovery pass (Phase 24) is ON by default for production
    // runs; --no-cross-wiki opts out (it self-skips when the workspace holds
    // fewer than two wikis or nothing relevant changed).
    try {
      const result = await ingest(slug, {
        workspace: options.workspace,
        extract: options.extract,
        synthesis: options.synthesis,
        doxLlm: options.doxLlm,
        crossWiki: options.crossWiki,
        forceCrossWiki: options.forceCrossWiki,
        updateAgents: options.updateAgents,
        inputLanguage: options.inputLanguage as import('./utils/language').LanguageCode | undefined,
        outputLanguage: options.outputLanguage as import('./utils/language').LanguageCode | undefined,
        onProgress: (message) => console.log(message),
      });
      if (options.verbose) {
        for (const source of result.ingested) {
          for (const page of source.documentPages) {
            console.log(`  wrote ${page}`);
          }
        }
        for (const extraction of result.extractions) {
          console.log(`  extracted .state/extracted/${extraction.chunkId}.json`);
        }
        if (result.synthesized !== undefined) {
          console.log(`  synthesized ${result.synthesized} entity page(s)`);
          if (result.synthesizedTopics !== undefined) {
            console.log(`  synthesized ${result.synthesizedTopics} topic page(s)`);
          }
        }
        if (result.crossWiki?.ran) {
          console.log(
            `  cross-wiki: ${result.crossWiki.entities ?? 0} entities, ${result.crossWiki.edges ?? 0} edges, ` +
              `${result.crossWiki.clusters ?? 0} clusters, ${result.crossWiki.uncertain ?? 0} uncertain matches held for review`,
          );
        }
        const totalConflicts = (result.synthesisConflicts ?? 0) + (result.topicConflicts ?? 0);
        if (totalConflicts > 0) {
          console.log(
            `  ${totalConflicts} synthesis conflict(s) logged ` +
              `(entities: ${result.synthesisConflicts ?? 0}, topics: ${result.topicConflicts ?? 0})`,
          );
        }
      }
      console.log(formatIngestSummary(result));
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exitCode = 1;
    }
  });

program
  .command('test')
  .description('Run the test suite')
  .action(async () => {
    // shell: true is mandatory on Windows — Node >= 20.12.2 refuses to spawn
    // .cmd files (npm is npm.cmd) without a shell and throws EINVAL.
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npmCmd, ['test'], { stdio: 'inherit', shell: true });
    child.on('close', (code) => process.exit(code ?? 1));
  });

// Phase 27 (vision `04` §1 Worker-process isolation amendment, user-ratified
// 2026-09-02): the headless per-PDF worker spawned by the TUI conductor.
// Exactly ONE of --pdf / --finalize selects the run scope; the worker emits
// the Phase 27 JSONL event protocol on stdout (progress lines streamed, one
// terminal result|fatal event last — see src/commands/worker-protocol.ts)
// and keeps stderr as raw diagnostics for the conductor to capture on a
// crash. NOT for direct human use — plain `ingest` remains the user-facing
// command.
program
  .command('ingest-worker <slug>')
  .description('Internal: run ONE PDF (or the finalize tail) and speak the worker event protocol (Phase 27)')
  .option('-w, --workspace <workspace>', 'Workspace directory', '.')
  .option('--pdf <file>', 'Process exactly this raw/ PDF (per-PDF loop scope)')
  .option('--finalize', 'Run only the deferred tail (validation, DOX, workspace, cross-wiki, updater)')
  .option('--idle-fallback', 'With --finalize: also run the all-skipped repair pass (conductor sets this when nothing was ingested)')
  .option('--synthesis', 'Enable LLM synthesis (passed through to ingest)')
  .option('--update-agents', 'Propose AGENTS.md updates after ingest (passed through)')
  .option('--no-extract', 'Skip the Layer 2 Extractor (passed through)')
  .option('--no-dox-llm', 'Skip the LLM DOX Writer (passed through)')
  .option('--no-cross-wiki', 'Skip the cross-wiki discovery pass (passed through)')
  .option('--force-cross-wiki', 'Force the cross-wiki discovery pass (passed through)')
  .option('--input-language <code>', 'Input language of this run\'s PDFs (passed through)')
  .option('--output-language <code>', 'Override the wiki output language for this run (passed through)')
  .action(
    async (
      slug: string,
      options: {
        workspace: string;
        pdf?: string;
        finalize?: boolean;
        idleFallback?: boolean;
        synthesis?: boolean;
        updateAgents?: boolean;
        extract?: boolean;
        doxLlm?: boolean;
        crossWiki?: boolean;
        forceCrossWiki?: boolean;
        inputLanguage?: string;
        outputLanguage?: string;
      },
    ) => {
      // Worker events MUST be the only thing on stdout: silence any stray
      // console.log from deep pipeline code (warnings etc.) by redirecting
      // the console to stderr for the lifetime of this process.
      const originalConsoleLog = console.log;
      console.log = (...args: unknown[]) => console.error(...args);
      const emit = (event: WorkerEvent): void => {
        process.stdout.write(serializeWorkerEvent(event));
      };
      try {
        if (Boolean(options.pdf) === Boolean(options.finalize)) {
          throw new Error('ingest-worker requires exactly one of --pdf <file> or --finalize.');
        }
        const result = await ingest(slug, {
          workspace: options.workspace,
          onlyPdfs: options.pdf !== undefined ? [options.pdf] : undefined,
          finalizeOnly: options.finalize === true,
          idleFallback: options.idleFallback === true,
          extract: options.extract,
          synthesis: options.synthesis,
          doxLlm: options.doxLlm,
          crossWiki: options.crossWiki,
          forceCrossWiki: options.forceCrossWiki,
          updateAgents: options.updateAgents,
          inputLanguage: options.inputLanguage as import('./utils/language').LanguageCode | undefined,
          outputLanguage: options.outputLanguage as import('./utils/language').LanguageCode | undefined,
          onProgress: (message) => {
            workerFaultAfterProgress();
            emit({ type: 'progress', line: message });
          },
          // Phase 27 v1.0.1: the structured stall event rides the same
          // channel so the conductor can hand the screen a live countdown
          // (the plain text stall line still flows through onProgress).
          onStall: (info) => {
            emit({ type: 'stall', info });
          },
        });
        workerFaultBeforeResult();
        emit({ type: 'result', result });
        process.exitCode = 0;
      } catch (err) {
        const error = err as Error;
        emit({ type: 'fatal', error: error.message, stack: error.stack });
        process.exitCode = 1;
      } finally {
        console.log = originalConsoleLog;
      }
    },
  );

// Parse guard: only run program.parse() when this file is executed directly,
// never when it is imported (e.g. by Gate 0.5 in vitest). The VITEST env var
// check covers the test runner; the argv[1] vs import.meta.url comparison
// covers direct execution via tsx/node. In the esbuild CJS bundle import.meta
// is empty, so argv[1] stands in for the module path (the bundle is only ever
// executed directly); inside a pkg exe the guard short-circuits on
// isPackaged(). On Windows the comparison is done case-insensitively because
// drive-letter casing can differ.
const entryPath = process.argv[1] ? resolve(process.argv[1]) : '';
const modulePath = import.meta.url ? fileURLToPath(import.meta.url) : entryPath;
const isDirectExecution =
  isPackaged() ||
  entryPath === modulePath ||
  (process.platform === 'win32' && entryPath.toLowerCase() === modulePath.toLowerCase());

if (!process.env.VITEST && isDirectExecution) {
  program.parse();
}
