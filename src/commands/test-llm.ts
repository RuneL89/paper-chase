import { createLLMClient } from '../llm/client.js';
import { CLIError } from '../errors.js';

interface TestLlmOptions {
  workspace: string;
  prompt?: string;
  verbose?: boolean;
}

export async function testLlmCommand(options: TestLlmOptions): Promise<void> {
  const client = createLLMClient(options.workspace);

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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CLIError(`LLM connection failed: ${message}`, 2);
  }
}
