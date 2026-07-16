#!/usr/bin/env node
import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import React from 'react';
import { render } from 'ink';
import { App } from './tui/app';

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
  .action(async (_slug: string, _options: { title?: string; workspace: string }) => {
    // Phase 1 implementation
  });

program
  .command('ingest <slug>')
  .description('Ingest PDFs into a wiki')
  .option('--synthesis', 'Enable LLM synthesis')
  .option('--update-agents', 'Update AGENTS.md')
  .option('--verbose', 'Verbose output')
  .action(async (_slug: string, _options: { synthesis?: boolean; updateAgents?: boolean; verbose?: boolean }) => {
    // Phase 1+ implementation
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
