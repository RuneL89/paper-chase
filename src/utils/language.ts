/**
 * Language model for multilingual ingestion (Phase 7; vision `04` §9).
 *
 * Two independent settings: the per-wiki OUTPUT language (the language of all
 * generated prose, chosen at init) and the per-run INPUT language (the
 * language of the PDFs in one ingest run). This module is the single home of
 * the supported language set, the per-language transliteration maps (§9.3),
 * and the prompt language directives (§9.4). No new dependencies.
 */

export type LanguageCode = 'en' | 'da' | 'de' | 'fr' | 'es' | 'no' | 'sv';

export interface Language {
  code: LanguageCode;
  /** English display name, e.g. 'Danish' (used in directives and the constitution). */
  name: string;
  /** Native display name, e.g. 'Dansk' (TUI labels). */
  nativeName: string;
  /** Explicit transliteration map applied BEFORE NFD diacritic stripping. */
  transliteration: Record<string, string>;
}

/** Danish/Norwegian map (vision `04` §9.3): æ→ae, ø→oe, å→aa. */
const DA_NO_MAP: Record<string, string> = {
  'æ': 'ae', 'ø': 'oe', 'å': 'aa',
  'Æ': 'Ae', 'Ø': 'Oe', 'Å': 'Aa',
};

/** German map: ä→ae, ö→oe, ü→ue, ß→ss. */
const DE_MAP: Record<string, string> = {
  'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss',
  'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue',
};

/**
 * Swedish map: å→a, ä→a, ö→o — the Swedish convention differs from Danish
 * (å→a, not å→aa), so the maps are deliberately not merged (§9.3).
 */
const SV_MAP: Record<string, string> = {
  'å': 'a', 'ä': 'a', 'ö': 'o',
  'Å': 'A', 'Ä': 'A', 'Ö': 'O',
};

export const SUPPORTED_LANGUAGES: readonly Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', transliteration: {} },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', transliteration: DA_NO_MAP },
  { code: 'de', name: 'German', nativeName: 'Deutsch', transliteration: DE_MAP },
  { code: 'fr', name: 'French', nativeName: 'Français', transliteration: {} },
  { code: 'es', name: 'Spanish', nativeName: 'Español', transliteration: {} },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', transliteration: DA_NO_MAP },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', transliteration: SV_MAP },
];

/** Look up a supported language by ISO 639-1 code; throws on unsupported codes. */
export function getLanguage(code: string): Language {
  const language = SUPPORTED_LANGUAGES.find((entry) => entry.code === code);
  if (!language) {
    throw new Error(
      `Unsupported language code '${code}'. Supported: ${SUPPORTED_LANGUAGES.map((entry) => entry.code).join(', ')}.`,
    );
  }
  return language;
}

/**
 * Transliterate non-ASCII characters for slugifying (vision `04` §9.3): apply
 * the language's explicit map FIRST (so Danish å becomes 'aa', not 'a'), then
 * Unicode NFD normalization and strip combining marks for every language
 * (French/Spanish accents: é→e, ñ→n, ç→c).
 */
export function transliterate(text: string, code: LanguageCode): string {
  const map = getLanguage(code).transliteration;
  let mapped = '';
  for (const char of text) {
    mapped += map[char] ?? char;
  }
  return mapped.normalize('NFD').replace(/\p{M}/gu, '');
}

/**
 * Fill the `{languageDirective}` placeholder every prompt template carries
 * (Phase 7, vision `04` §9.4). The placeholder sits in a block inserted as
 * `=== LANGUAGE ===\n{languageDirective}\n\n` before the first section of each
 * prompt. When the directive is empty (both languages English), the WHOLE
 * block is removed so the filled prompt is byte-identical to the pre-Phase-7
 * template — the phase doc's `buildLanguageDirective` ''-return contract only
 * holds with this cleanup.
 */
export function applyLanguageDirective(prompt: string, directive: string): string {
  if (directive.trim().length === 0) {
    return prompt
      .split('=== LANGUAGE ===\n{languageDirective}\n\n')
      .join('')
      .split('=== LANGUAGE ===\r\n{languageDirective}\r\n\r\n')
      .join('');
  }
  return prompt.split('{languageDirective}').join(directive);
}

/**
 * Build the one-paragraph language directive injected into the LLM prompt of
 * each agent role (vision `04` §9.4 mechanism). Returns the empty string when
 * both languages are English so filled prompts stay byte-identical to the
 * pre-Phase-7 behavior.
 */
export function buildLanguageDirective(
  role: 'extractor' | 'synthesis' | 'dox',
  input: LanguageCode,
  output: LanguageCode,
): string {
  if (input === 'en' && output === 'en') {
    return '';
  }
  const inputName = getLanguage(input).name;
  const outputName = getLanguage(output).name;
  switch (role) {
    case 'extractor':
      return (
        `The document chunk is written in ${inputName}. Write all JSON free-text fields ` +
        `(significance, context, claim text, timeline events, disambiguation) in ${inputName}. ` +
        `Quote mentions verbatim from the chunk. Name any new folders in ${outputName}.`
      );
    case 'synthesis':
      return (
        `Write the Layer 1 synthesis in ${outputName}. Preserve every Layer 2 item ` +
        `(mentions, relationships, claims, timeline, sources) EXACTLY as supplied — never ` +
        `translate or reword them.`
      );
    case 'dox':
      return (
        `Write all prose (the description, \`## Pages\` descriptions, \`## Start Here\` reasons) in ` +
        `${outputName}. Keep page titles and entity names verbatim.`
      );
  }
}
