import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { CLIError } from '../errors.js';
import { loadLLMConfig } from '../llm/client.js';
import { prompt, promptHidden, confirm, isInteractive } from '../prompt.js';
import { testLlmCommand } from './test-llm.js';
import { buildRunLog, writeRunLog } from '../log.js';

const KNOWN_PROVIDERS = ['openai', 'anthropic', 'openai-compatible', 'kimi', 'test'];

interface ConfigureLlmOptions {
  workspace: string;
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  interactive?: boolean;
}

export async function configureLlmCommand(options: ConfigureLlmOptions): Promise<void> {
  const workspace = path.resolve(options.workspace);
  if (!existsSync(workspace)) {
    throw new CLIError(`Workspace not found: ${workspace}`, 2);
  }

  const interactive = options.interactive ?? (!options.apiKey && isInteractive());

  let provider = options.provider ?? 'kimi';
  if (!KNOWN_PROVIDERS.includes(provider)) {
    throw new CLIError(
      `Unknown provider "${provider}". Supported providers: ${KNOWN_PROVIDERS.join(', ')}`,
      2,
    );
  }

  let model = options.model;
  let baseUrl = options.baseUrl;
  let apiKey = options.apiKey?.trim();

  if (interactive) {
    console.log('LLM Configuration Wizard');
    console.log('========================');
    console.log('');
    console.log(`Supported providers: ${KNOWN_PROVIDERS.join(', ')}`);
    console.log('');

    provider = await prompt('Provider', provider);
    if (!KNOWN_PROVIDERS.includes(provider)) {
      throw new CLIError(
        `Unknown provider "${provider}". Supported providers: ${KNOWN_PROVIDERS.join(', ')}`,
        2,
      );
    }

    model = await prompt('Model', model ?? defaultModel(provider));
    baseUrl = await prompt('Base URL', baseUrl ?? defaultBaseUrl(provider) ?? 'none');
    if (baseUrl === 'none') {
      baseUrl = undefined;
    }

    apiKey = await promptHidden('API key');
    if (!apiKey) {
      throw new CLIError('API key is required.', 2);
    }
  } else {
    if (!apiKey) {
      throw new CLIError(
        'API key is required. Pass it with --api-key, or run the wizard interactively.',
        2,
      );
    }
  }

  const finalModel = model ?? defaultModel(provider);
  const finalBaseUrl = baseUrl ?? defaultBaseUrl(provider);

  const kimiDir = path.join(workspace, '.kimi-code');
  if (!existsSync(kimiDir)) {
    mkdirSync(kimiDir, { recursive: true });
  }

  const configPath = path.join(kimiDir, 'config.json');
  const existing = existsSync(configPath)
    ? (JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>)
    : {};

  const updated = {
    ...existing,
    llm: {
      enabled: true,
      provider,
      model: finalModel,
      apiKey,
      baseUrl: finalBaseUrl,
    },
  };

  writeFileSync(configPath, JSON.stringify(updated, null, 2) + '\n', 'utf-8');

  const log = buildRunLog('configure-llm', workspace, {
    llmProvider: provider,
    llmModel: finalModel,
    status: 'success',
  });
  writeRunLog(workspace, log);

  console.log('');
  console.log(`LLM configuration saved to ${configPath}`);
  console.log(`  Provider: ${provider}`);
  console.log(`  Model: ${finalModel}`);
  console.log(`  Base URL: ${finalBaseUrl ?? '(none)'}`);
  console.log('  API key: ***');
  console.log('');

  if (interactive) {
    const runTest = await confirm('Test the connection now?', true);
    if (runTest) {
      console.log('');
      await testLlmCommand({ workspace });
    } else {
      console.log('');
      console.log('Run `llm-wiki-cli test-llm` to verify the connection later.');
    }
  } else {
    console.log('Run `llm-wiki-cli test-llm` to verify the connection.');
  }
}

function defaultModel(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'gpt-4o';
    case 'anthropic':
      return 'claude-3-5-sonnet-20241022';
    case 'kimi':
      return 'k2.7-code';
    case 'test':
      return 'test';
    default:
      return 'unknown';
  }
}

function defaultBaseUrl(provider: string): string | undefined {
  switch (provider) {
    case 'kimi':
      return 'https://api.kimi.com/coding';
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'anthropic':
      return 'https://api.anthropic.com/v1';
    default:
      return undefined;
  }
}

export function isKnownProvider(value: string): boolean {
  return KNOWN_PROVIDERS.includes(value);
}

export { loadLLMConfig };
