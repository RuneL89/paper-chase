import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findPackageRoot(startDir: string): string {
  let current = startDir;
  while (current !== path.dirname(current)) {
    if (existsSync(path.join(current, 'package.json'))) {
      return current;
    }
    current = path.dirname(current);
  }
  throw new Error('Could not find package root; ensure a package.json exists.');
}

const packageRoot = findPackageRoot(__dirname);

// Prompts live as source files in src/orchestrator/prompts. When running from
// compiled dist/ we need to be able to find them in src/ as well. A build copy
// step would also work, but resolving from the package root is more robust for
// a local CLI that is not published as a bundle.
const PROMPTS_DIRS = [
  path.join(packageRoot, 'dist', 'orchestrator', 'prompts'),
  path.join(packageRoot, 'src', 'orchestrator', 'prompts'),
];

/**
 * Loads a static agent prompt from `src/orchestrator/prompts/` (or the compiled
 * copy in `dist/orchestrator/prompts/`).
 *
 * Prompts are first-class artifacts; keeping them in files makes versioning
 * and iteration safer.
 */
export function loadPrompt(name: string): string {
  for (const dir of PROMPTS_DIRS) {
    const filePath = path.join(dir, `${name}.md`);
    if (existsSync(filePath)) {
      return readFileSync(filePath, 'utf-8');
    }
  }
  throw new Error(`Failed to load prompt "${name}" from any of: ${PROMPTS_DIRS.join(', ')}`);
}

export function buildPrompt(name: string, context: string): string {
  const staticPrompt = loadPrompt(name);
  return `${staticPrompt}\n\n---\n\n## Prompt context\n\n${context}`;
}
