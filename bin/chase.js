#!/usr/bin/env node
/**
 * `chase` launcher (Phase 11, phase doc §2.1).
 *
 * Runs the TypeScript CLI (src/cli.ts) through the project's local tsx — no
 * build step. The package root is resolved relative to this script's own
 * location so `chase` works from any cwd after `npm link`.
 *
 * The local tsx CLI is spawned with the current Node executable and an argv
 * array (no shell): this is the only form that survives install paths
 * containing spaces (npx through a Windows shell mangles both unquoted and
 * quoted backslash paths) and it avoids the Node >= 20.12.2 EINVAL on
 * spawning .cmd shims without a shell. If the local tsx is missing
 * (dependencies not installed), we fall back to `npx tsx`, which needs a
 * shell on Windows because npx is npx.cmd.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = resolve(pkgRoot, 'src', 'cli.ts');
const tsxCli = resolve(pkgRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');

let command;
let args;
let shell = false;
if (existsSync(tsxCli)) {
  command = process.execPath;
  args = [tsxCli, cliPath, ...process.argv.slice(2)];
} else {
  command = 'npx';
  args = ['tsx', cliPath, ...process.argv.slice(2)];
  shell = process.platform === 'win32';
}

const child = spawn(command, args, { stdio: 'inherit', shell });
child.on('close', (code) => process.exit(code ?? 1));
