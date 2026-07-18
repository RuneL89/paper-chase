#!/usr/bin/env node
import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import React from 'react';
import { render } from 'ink';
import { App } from './tui/app';
import { init } from './commands/init';
import { ingest } from './commands/ingest';

export const program = new Command();

program
  .name('llm-wiki-cli')
  .description('Turn PDFs into citation-backed markdown wikis')
  .version('2.0.0');

// TUI mode (default: no subcommand)
program.action(() => {
  render(React.createElement(App));
});

// CLI commands (for power users and scripts)
program
  .command('init <slug>')
  .description('Create a new wiki')
  .option('--title <title>', 'Wiki title')
  .option('-w, --workspace <workspace>', 'Workspace directory', '.')
  .action(async (slug: string, options: { title?: string; workspace: string }) => {
    try {
      const result = await init(slug, { title: options.title, workspace: options.workspace });
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
  .option('--update-agents', 'Update AGENTS.md (no-op in Phase 1)')
  .option('--no-extract', 'Skip the Layer 2 Extractor (Layer 1 document pages only)')
  .option('--no-dox-llm', 'Skip the LLM DOX Writer (deterministic index.md contracts only)')
  .option('--verbose', 'Verbose output')
  .action(async (slug: string, options: { workspace: string; synthesis?: boolean; updateAgents?: boolean; extract?: boolean; doxLlm?: boolean; verbose?: boolean }) => {
    // --synthesis is Phase 5: opt-in LLM synthesis of entity, topic, and document pages after extraction.
    // --update-agents is accepted for forward compatibility; it is a no-op here.
    // Extraction (Layer 2) is ON by default per the phase doc; --no-extract
    // opts out (e.g. offline/key-less Layer 1-only runs).
    // The LLM DOX Writer (Phase 6) is ON by default for production runs;
    // --no-dox-llm opts out (deterministic index.md contracts, no LLM calls).
    try {
      const result = await ingest(slug, {
        workspace: options.workspace,
        extract: options.extract,
        synthesis: options.synthesis,
        doxLlm: options.doxLlm,
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
        const totalConflicts = (result.synthesisConflicts ?? 0) + (result.topicConflicts ?? 0);
        if (totalConflicts > 0) {
          console.log(
            `  ${totalConflicts} synthesis conflict(s) logged ` +
              `(entities: ${result.synthesisConflicts ?? 0}, topics: ${result.topicConflicts ?? 0})`,
          );
        }
      }
      console.log(`Ingest complete: ${result.ingested.length} ingested, ${result.skipped.length} skipped.`);
      if (result.synthesized !== undefined) {
        const entityTotal = (result.synthesized ?? 0) + (result.synthesizedPermissive ?? 0);
        const topicTotal = (result.synthesizedTopics ?? 0) + (result.synthesizedTopicsPermissive ?? 0);
        const totalSynthesized = entityTotal + topicTotal;
        const totalConflicts = (result.synthesisConflicts ?? 0) + (result.topicConflicts ?? 0);
        console.log(
          `Synthesis: ${totalSynthesized} page(s) written ` +
            `(entities: ${entityTotal}, topics: ${topicTotal}), ` +
            `${totalConflicts} conflict(s).`,
        );
      }
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

// Parse guard: only run program.parse() when this file is executed directly,
// never when it is imported (e.g. by Gate 0.5 in vitest). The VITEST env var
// check covers the test runner; the argv[1] vs import.meta.url comparison
// covers direct execution via tsx/node. On Windows the comparison is done
// case-insensitively because drive-letter casing can differ.
const entryPath = process.argv[1] ? resolve(process.argv[1]) : '';
const modulePath = fileURLToPath(import.meta.url);
const isDirectExecution =
  entryPath === modulePath ||
  (process.platform === 'win32' && entryPath.toLowerCase() === modulePath.toLowerCase());

if (!process.env.VITEST && isDirectExecution) {
  program.parse();
}
