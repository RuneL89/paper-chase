import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(__dirname, '../../dist/cli.js');

describe('tui command', () => {
  it('TAC-001: renders the non-interactive welcome screen', () => {
    const output = execSync(`node "${cliPath}" tui --non-interactive`, {
      encoding: 'utf-8',
      cwd: path.resolve(__dirname, '../..'),
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    expect(output).toContain('Welcome to LLM Wiki CLI');
    expect(output).toContain('LLM Wiki CLI');
    expect(output).toContain('What would you like to do?');
  });

  it('TAC-002: shows the configured workspace path', () => {
    const workspace = path.resolve(__dirname, '../..');
    const output = execSync(`node "${cliPath}" tui --non-interactive -w "${workspace}"`, {
      encoding: 'utf-8',
      cwd: workspace,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    expect(output).toContain(workspace);
  });
});
