import { createLLMClient } from '../llm/client.js';
import { CLIError } from '../errors.js';
import { buildRunLog, writeRunLog } from '../log.js';

interface TestLlmOptions {
  workspace: string;
  prompt?: string;
  verbose?: boolean;
}

export async function testLlmCommand(options: TestLlmOptions): Promise<void> {
  const client = createLLMClient(options.workspace);
  const workspace = options.workspace;

  if (!client.isEnabled()) {
    throw new CLIError(
      'LLM is not configured. Run `llm-wiki-cli configure-llm` first.',
      2,
    );
  }

  const prompt = options.prompt?.trim() ?? 'Say "LLM connection is working" and nothing else.';

  console.log('Sending test prompt to LLM...');
  console.log('');

  try {
    const response = await client.call(prompt, {
      maxTokens: 50,
      temperature: 0,
      verbose: options.verbose,
    });

    console.log('Connection successful.');
    console.log(`  Provider: ${response.provider}`);
    console.log(`  Model: ${response.model}`);
    console.log(`  Estimated tokens: ${response.estimatedTokens}`);
    console.log(`  Estimated cost: $${response.estimatedCost.toFixed(6)}`);
    console.log('');
    console.log('Response:');
    console.log(response.text);

    const log = buildRunLog('test-llm', workspace, {
      llmProvider: response.provider,
      llmModel: response.model,
      llmTokens: response.estimatedTokens,
      status: 'success',
    });
    writeRunLog(workspace, log);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const log = buildRunLog('test-llm', workspace, {
      errors: [message],
      status: 'failed',
    });
    writeRunLog(workspace, log);
    throw new CLIError(`LLM connection failed: ${message}`, 2);
  }
}
