import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import path from 'path';
import os from 'os';
import { loadConfig } from '../src/config';
import { discoverWikis } from '../src/workspace';

const CLI = path.resolve(__dirname, '../dist/cli.js');
const FIXTURES = path.resolve(__dirname, 'fixtures');
const VALID_WORKSPACE = path.join(FIXTURES, 'valid-workspace');
const BAD_CONFIG_WORKSPACE = path.join(FIXTURES, 'bad-config-workspace');

function makeTempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'wiki-'));
}

function runCli(args: string[], cwd?: string): string {
  return execFileSync('node', [CLI, ...args], {
    cwd,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
}

function runCliExit(args: string[], cwd?: string): number {
  try {
    runCli(args, cwd);
    return 0;
  } catch (e: any) {
    return e.status ?? 1;
  }
}

function runCliError(args: string[], cwd?: string): { status: number; stderr: string } {
  try {
    runCli(args, cwd);
    return { status: 0, stderr: '' };
  } catch (e: any) {
    return { status: e.status ?? 1, stderr: String(e.stderr ?? '') };
  }
}

describe('TAC-001: package.json', () => {
  it('has a bin entry named llm-wiki-cli and declares runtime dependencies', () => {
    const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
    expect(pkg.name).toBe('llm-wiki-cli');
    expect(pkg.bin).toBeDefined();
    expect(pkg.bin['llm-wiki-cli']).toBe('dist/cli.js');
    expect(pkg.dependencies).toBeDefined();
    expect(Object.keys(pkg.dependencies).length).toBeGreaterThan(0);
  });
});

describe('TAC-002: --help', () => {
  it('lists all commands with descriptions and examples', () => {
    const out = runCli(['--help']);
    expect(out).toContain('sample');
    expect(out).toContain('ingest');
    expect(out).toContain('ingest-all');
    expect(out).toContain('status');
    expect(out).toContain('Example');
  });
});

describe('TAC-003: invalid workspace', () => {
  it('emits a clear error and exits non-zero when the workspace has no wikis/ folder', () => {
    const tmp = makeTempDir();
    try {
      const { status, stderr } = runCliError(['status'], tmp);
      expect(status).not.toBe(0);
      expect(stderr).toContain('wikis');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('TAC-004: workspace discovery', () => {
  it('resolves the wiki slug from a valid workspace folder', () => {
    const wikis = discoverWikis(VALID_WORKSPACE);
    expect(wikis).toContain('acme');
  });

  it('reports discovered wikis through the status command', () => {
    const out = runCli(['status'], VALID_WORKSPACE);
    expect(out).toContain('acme');
    expect(out).toContain('Discovered');
  });
});

describe('TAC-005: configuration inheritance', () => {
  it('merges defaults, workspace config, and wiki config with correct precedence', () => {
    const config = loadConfig(VALID_WORKSPACE, 'acme');
    // wiki config overrides workspace default
    expect(config.wiki.title).toBe('Acme Wiki');
    expect(config.chunking.max_chunk_size).toBe(50000);
    // workspace config overrides hard-coded defaults
    expect(config.extraction.engine).toBe('pdf-parse');
  });

  it('throws a plain-language error when a required wiki config field is missing', () => {
    expect(() => loadConfig(BAD_CONFIG_WORKSPACE, 'bad')).toThrow(/slug/);
    expect(() => loadConfig(BAD_CONFIG_WORKSPACE, 'bad')).toThrow(/required/i);
  });
});

describe('TAC-006: command stubs and error handling', () => {
  it('sample exits non-zero with missing arguments', () => {
    const { status, stderr } = runCliError(['sample'], VALID_WORKSPACE);
    expect(status).not.toBe(0);
    expect(stderr).toContain('wiki');
  });

  it('ingest exits non-zero with missing arguments', () => {
    const { status, stderr } = runCliError(['ingest'], VALID_WORKSPACE);
    expect(status).not.toBe(0);
    expect(stderr).toContain('wiki');
  });

  it('sample exits non-zero in an invalid workspace', () => {
    const tmp = makeTempDir();
    try {
      const { status } = runCliError(['sample', 'acme', 'wikis/acme/raw/x.pdf'], tmp);
      expect(status).not.toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('ingest exits non-zero in an invalid workspace', () => {
    const tmp = makeTempDir();
    try {
      const { status } = runCliError(['ingest', 'acme'], tmp);
      expect(status).not.toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('ingest-all exits non-zero in an invalid workspace', () => {
    const tmp = makeTempDir();
    try {
      const status = runCliExit(['ingest-all'], tmp);
      expect(status).not.toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('status exits non-zero in an invalid workspace', () => {
    const tmp = makeTempDir();
    try {
      const status = runCliExit(['status'], tmp);
      expect(status).not.toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
