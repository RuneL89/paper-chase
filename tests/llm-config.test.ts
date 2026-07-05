import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { configureLlmCommand, isKnownProvider } from '../src/commands/configure-llm.js';
import { testLlmCommand } from '../src/commands/test-llm.js';
import { CLIError } from '../src/errors.js';

describe('configure-llm command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'llm-wiki-cli-configure-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('TAC-001: creates a workspace config with Kimi defaults', async () => {
    await configureLlmCommand({
      workspace: tmpDir,
      provider: 'kimi',
      apiKey: 'sk-kimi-test',
    });

    const configPath = path.join(tmpDir, '.kimi-code', 'config.json');
    expect(existsSync(configPath)).toBe(true);

    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as {
      llm: {
        enabled: boolean;
        provider: string;
        model: string;
        apiKey: string;
        baseUrl: string;
      };
    };

    expect(config.llm.enabled).toBe(true);
    expect(config.llm.provider).toBe('kimi');
    expect(config.llm.model).toBe('k2.7-code');
    expect(config.llm.apiKey).toBe('sk-kimi-test');
    expect(config.llm.baseUrl).toBe('https://api.kimi.com/coding');
  });

  it('TAC-002: rejects an unknown provider', async () => {
    await expect(
      configureLlmCommand({
        workspace: tmpDir,
        provider: 'not-a-provider',
        apiKey: 'test',
      }),
    ).rejects.toBeInstanceOf(CLIError);
  });

  it('TAC-003: requires an API key', async () => {
    await expect(
      configureLlmCommand({
        workspace: tmpDir,
        provider: 'kimi',
      }),
    ).rejects.toBeInstanceOf(CLIError);
  });

  it('TAC-004: preserves existing config fields', async () => {
    const configDir = path.join(tmpDir, '.kimi-code');
    const configPath = path.join(configDir, 'config.json');

    await configureLlmCommand({
      workspace: tmpDir,
      provider: 'kimi',
      apiKey: 'first-key',
    });

    const firstConfig = JSON.parse(readFileSync(configPath, 'utf-8')) as { llm: { apiKey: string } };
    expect(firstConfig.llm.apiKey).toBe('first-key');

    await configureLlmCommand({
      workspace: tmpDir,
      provider: 'openai',
      apiKey: 'second-key',
    });

    const secondConfig = JSON.parse(readFileSync(configPath, 'utf-8')) as {
      llm: { provider: string; apiKey: string };
    };
    expect(secondConfig.llm.provider).toBe('openai');
    expect(secondConfig.llm.apiKey).toBe('second-key');
  });
});

describe('test-llm command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'llm-wiki-cli-test-llm-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('TAC-005: fails when LLM is not configured', async () => {
    await expect(testLlmCommand({ workspace: tmpDir })).rejects.toBeInstanceOf(CLIError);
  });
});

describe('isKnownProvider', () => {
  it('TAC-006: recognizes Kimi as a known provider', () => {
    expect(isKnownProvider('kimi')).toBe(true);
  });

  it('TAC-007: rejects unknown providers', () => {
    expect(isKnownProvider('unknown')).toBe(false);
  });
});
