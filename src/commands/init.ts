import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidWikiSlug } from '../utils/slug';
import { getLanguage, type LanguageCode } from '../utils/language';
import { writeWikiLanguage } from '../state/language';
import { wikiDir } from '../utils/paths';

export interface InitOptions {
  /** Wiki title; defaults to the slug when omitted. */
  title?: string;
  /** Workspace directory containing wikis/; defaults to '.'. */
  workspace?: string;
  /**
   * Phase 7 (vision `04` §9.1): the wiki's output language — the language of
   * all Layer 1 synthesis prose and index.md descriptions. Recorded in the
   * constitution's Language section and `.state/language.json`. Defaults to
   * English.
   */
  outputLanguage?: LanguageCode;
}

export interface InitResult {
  slug: string;
  title: string;
  /** Filesystem path of the created wiki. */
  wikiDir: string;
  /** User-facing success message (printed by the CLI, shown by the TUI). */
  message: string;
}

const WIKI_SUBDIRECTORIES = ['raw', 'documents', 'sources', 'entities', 'topics', '.state'] as const;

/**
 * Resolve templates/AGENTS.md relative to this source file so `init` works
 * regardless of the caller's current working directory.
 */
function templatePath(): string {
  // src/commands/init.ts -> <project root>/templates/AGENTS.md
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', '..', 'templates', 'AGENTS.md');
}

/**
 * Create a new wiki (phase doc §2.1):
 *  - wikis/<slug>/ with raw/, documents/, sources/, entities/, topics/, .state/
 *  - AGENTS.md generated from templates/AGENTS.md with ALL {{WIKI_TITLE}} and
 *    {{SLUG}} placeholders replaced (title defaults to the slug).
 *
 * NOTE: the phase doc says `{wiki-title}`, but the template artifact uses
 * double-brace placeholders (root AGENTS.md templates rule) — recorded as a
 * documented deviation in .state/phase-1-status.json.
 */
export async function init(slug: string, options: InitOptions = {}): Promise<InitResult> {
  if (!isValidWikiSlug(slug)) {
    throw new Error(
      `Invalid wiki slug '${slug}'. Use lowercase kebab-case (letters, digits, hyphens; must start with a letter or digit).`,
    );
  }

  const title = options.title ?? slug;
  const dir = wikiDir(options.workspace, slug);

  if (existsSync(dir)) {
    throw new Error(`Wiki '${slug}' already exists at ${dir}.`);
  }

  for (const subdir of WIKI_SUBDIRECTORIES) {
    await mkdir(join(dir, subdir), { recursive: true });
  }

  const template = await readFile(templatePath(), 'utf-8');
  const outputLanguage = getLanguage(options.outputLanguage ?? 'en');
  const constitution = template
    .replaceAll('{{WIKI_TITLE}}', title)
    .replaceAll('{{SLUG}}', slug)
    .replaceAll('{{OUTPUT_LANGUAGE}}', outputLanguage.name);
  await writeFile(join(dir, 'AGENTS.md'), constitution, 'utf-8');

  // Phase 7: persist the per-wiki language state (.state/language.json). The
  // last input language starts at English; the first ingest run updates it.
  await writeWikiLanguage(dir, {
    outputLanguage: outputLanguage.code,
    lastInputLanguage: 'en',
  });

  return {
    slug,
    title,
    wikiDir: dir,
    message: `Wiki '${slug}' created. Place PDFs in wikis/${slug}/raw/ and run ingest.`,
  };
}
