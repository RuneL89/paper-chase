#!/usr/bin/env node
import { Command } from 'commander';
import { sampleCommand } from './commands/sample.js';
import { ingestCommand } from './commands/ingest.js';
import { ingestAllCommand } from './commands/ingest-all.js';
import { statusCommand } from './commands/status.js';
import { configureLlmCommand } from './commands/configure-llm.js';
import { testLlmCommand } from './commands/test-llm.js';
import { initCommand } from './commands/init.js';
import { applyProposalCommand } from './commands/apply-proposal.js';
import { CLIError } from './errors.js';
import { buildRunLog, writeRunLog } from './log.js';

function addWorkspaceOption(command: Command): Command {
  return command.option(
    '-w, --workspace <path>',
    'path to the workspace directory',
    process.cwd(),
  );
}

const program = new Command();

program
  .name('llm-wiki-cli')
  .version('0.0.1')
  .description(
    'LLM Wiki CLI turns a folder of source PDFs into a citation-backed markdown wiki-of-wikis.',
  )
  .addHelpText(
    'after',
    `
Examples:
  $ llm-wiki-cli --help
  $ llm-wiki-cli status -w ./my-workspace
  $ llm-wiki-cli init donations --title "Political Donations" --description "Annual filings..."
  $ llm-wiki-cli sample acme                    # corpus-centric sample
  $ llm-wiki-cli sample acme wikis/acme/raw/annual-report.pdf
  $ llm-wiki-cli ingest acme
  $ llm-wiki-cli ingest-all
  $ llm-wiki-cli configure-llm             # interactive wizard
  $ llm-wiki-cli configure-llm --provider kimi --api-key <key>
  $ llm-wiki-cli test-llm
  $ llm-wiki-cli test-llm --verbose
`,
  );

const init = addWorkspaceOption(
  new Command('init')
    .description('Initialize a new wiki folder and skeleton ingestion guide.')
    .argument('<wiki-slug>', 'slug of the wiki to create')
    .option('--title <title>', 'human-readable title for the wiki')
    .option('--description <description>', 'short description of the wiki scope')
    .option('--force', 're-initialize an existing wiki')
    .action(async (slug: string, options: { workspace: string; title?: string; description?: string; force?: boolean }) => {
      await initCommand({ workspace: options.workspace, slug, title: options.title, description: options.description, force: options.force });
    }),
);

const sample = addWorkspaceOption(
  new Command('sample')
    .description('Run sample ingestion for a wiki and produce the four starter artifacts.')
    .argument('<wiki-slug>', 'slug of the wiki to work on')
    .argument('[path-to-pdf]', 'optional path to a representative PDF inside wikis/<wiki-slug>/raw/ (defaults to the first PDF found)')
    .action(async (slug: string, pdfPath: string | undefined, options: { workspace: string }) => {
      await sampleCommand(options.workspace, slug, pdfPath);
    }),
);

const ingest = addWorkspaceOption(
  new Command('ingest')
    .description('Run full ingestion for a single wiki according to its config.json.')
    .argument('<wiki-slug>', 'slug of the wiki to ingest')
    .option('--resume', 'skip chunks with a completed state file and resume from the failed chunk', false)
    .option('--yes', 'auto-approve simple structural-change proposals', false)
    .action(async (slug: string, options: { workspace: string; resume?: boolean; yes?: boolean }) => {
      await ingestCommand(options.workspace, slug, options.resume ?? false, options.yes ?? false);
    }),
);

const ingestAll = addWorkspaceOption(
  new Command('ingest-all')
    .description('Run full ingestion for every wiki in the workspace.')
    .option('--yes', 'auto-approve simple structural-change proposals', false)
    .action(async (options: { workspace: string; yes?: boolean }) => {
      await ingestAllCommand(options.workspace, options.yes ?? false);
    }),
);

const applyProposal = addWorkspaceOption(
  new Command('apply-proposal')
    .description('Apply an approved structural-change proposal to a wiki.')
    .argument('<wiki-slug>', 'slug of the wiki')
    .argument('<proposal-file>', 'path or name of the proposal markdown file')
    .option('--skip-manual-edits', 'skip pages that have been manually edited instead of overwriting them', false)
    .action(async (slug: string, proposalFile: string, options: { workspace: string; skipManualEdits?: boolean }) => {
      await applyProposalCommand(options.workspace, slug, proposalFile, { skipManualEdits: options.skipManualEdits });
    }),
);

const status = addWorkspaceOption(
  new Command('status')
    .description('Show the workspace status: wikis, source counts, and warnings.')
    .action(async (options: { workspace: string }) => {
      await statusCommand(options.workspace);
    }),
);

const configureLlm = addWorkspaceOption(
  new Command('configure-llm')
    .description('Configure the LLM provider and API key for the workspace.')
    .option('--provider <provider>', 'LLM provider (openai, anthropic, openai-compatible, kimi, test)', 'kimi')
    .option('--model <model>', 'LLM model name')
    .option('--api-key <key>', 'API key for the provider')
    .option('--base-url <url>', 'Base URL for the provider API')
    .action(async (options: { workspace: string; provider?: string; model?: string; apiKey?: string; baseUrl?: string }) => {
      await configureLlmCommand(options);
    }),
);

const testLlm = addWorkspaceOption(
  new Command('test-llm')
    .description('Send a test prompt to the configured LLM and report the response.')
    .option('--prompt <text>', 'Custom test prompt')
    .option('--verbose', 'Print the raw LLM response for debugging')
    .action(async (options: { workspace: string; prompt?: string; verbose?: boolean }) => {
      await testLlmCommand(options);
    }),
);

program.addCommand(init);
program.addCommand(sample);
program.addCommand(ingest);
program.addCommand(ingestAll);
program.addCommand(applyProposal);
program.addCommand(status);
program.addCommand(configureLlm);
program.addCommand(testLlm);

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    try {
      const workspace = program.opts().workspace || process.cwd();
      const command = process.argv[2] || 'unknown';
      const log = buildRunLog(command, workspace, {
        status: 'failed',
        errors: [error instanceof Error ? error.message : String(error)],
      });
      writeRunLog(workspace, log);
    } catch {
      // If logging itself fails, continue to emit the original error.
    }

    if (error instanceof CLIError) {
      console.error(error.message);
      process.exit(error.exitCode);
    } else {
      console.error('An unexpected error occurred.');
      if (error instanceof Error) {
        console.error(error.message);
      }
      process.exit(1);
    }
  }
}

main();
