import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import matter from 'gray-matter';
import { callLLM, type CallLLMOptions } from '../llm/client';
import { runWithFeedbackRetry } from '../llm/reask';
import { wikiDir } from '../utils/paths';
import { appRoot } from '../utils/app-root';
import { readStructuralChanges } from '../state/structural-changes';

const PROMPT_DIR = join(appRoot(), 'prompts');

let promptCache: string | undefined;

async function loadPromptTemplate(): Promise<string> {
  if (promptCache === undefined) {
    promptCache = await readFile(join(PROMPT_DIR, 'agents-updater.prompt.txt'), 'utf-8');
  }
  return promptCache;
}

function fillPromptTemplate(template: string, values: Record<string, string>): string {
  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.split(`{${key}}`).join(value);
  }
  return output;
}

/** Strip a single wrapping markdown code fence, if the model added one. */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/);
  return match ? match[1] : trimmed;
}

/**
 * Sections a valid proposal must keep (Phase 9 gates: the proposal contains
 * all required sections of the wiki constitution; the `## Language` section
 * is additionally re-imposed verbatim by deterministic code below).
 */
const REQUIRED_SECTIONS = ['## Folder Structure', '## Page Types', '## Language'];

/**
 * Phase 7 v1.1.0 bounded retry amendment (vision `04` §6 / `07` §5), applied
 * to the Phase 9 updater: quality failures — the call throwing, or a proposal
 * missing required sections — get up to this many TOTAL attempts before the
 * deterministic fallback. Language-agnostic; transient transport retries are
 * handled inside callLLM (maxRetries).
 */
const AGENTS_UPDATER_MAX_ATTEMPTS = 3;

export interface AgentsUpdaterOptions {
  /** Workspace directory containing wikis/; defaults to '.'. */
  workspace?: string;
  /**
   * Injectable LLM implementation (test-only). Defaults to the real callLLM;
   * tests inject a deterministic stub to exercise the updater without an API
   * key. Phase 12: the first argument is the COMPOSED prompt (attempt 2+
   * carries the validator-feedback correction block appended); the options
   * argument carries the numbered log context when the default wrapper is used.
   */
  callLLMFn?: (prompt: string, system?: string, options?: CallLLMOptions) => Promise<string>;
  /**
   * Optional path to a JSON-lines LLM call log. Defaults to the wiki's
   * `.state/llm-calls.json` (same convention as the other pipeline agents).
   * Ignored when `callLLMFn` is injected.
   */
  logPath?: string;
}

interface WikiStructureSummary {
  /** Folder paths relative to the wiki root, forward slashes, sorted. */
  folders: string[];
  /** Page types in use with page counts, sorted by type. */
  pageTypes: Array<{ type: string; count: number }>;
}

/**
 * Scan the wiki tree (excluding `raw/` and `.state/`, per the DOX Writer
 * convention) and summarize folders plus the page types declared in each
 * markdown file's frontmatter.
 */
export async function collectWikiStructure(wikiDirPath: string): Promise<WikiStructureSummary> {
  const folders: string[] = [];
  const typeCounts = new Map<string, number>();

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === 'raw' || entry.name === '.state') {
          continue;
        }
        const folderPath = relative(wikiDirPath, join(dir, entry.name)).split('\\').join('/');
        folders.push(folderPath);
        await walk(join(dir, entry.name));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const raw = await readFile(join(dir, entry.name), 'utf-8');
          const type = (matter(raw).data as { type?: unknown }).type;
          if (typeof type === 'string' && type.length > 0) {
            typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
          }
        } catch {
          // Unparseable frontmatter: the page simply does not contribute a type.
        }
      }
    }
  }

  await walk(wikiDirPath);
  folders.sort((a, b) => a.localeCompare(b));
  const pageTypes = Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => a.type.localeCompare(b.type));
  return { folders, pageTypes };
}

function formatStructure(structure: WikiStructureSummary): string {
  const folderLines = structure.folders.length > 0
    ? structure.folders.map((folder) => `- ${folder}`).join('\n')
    : '(none)';
  const typeLines = structure.pageTypes.length > 0
    ? structure.pageTypes.map((entry) => `- ${entry.type} (${entry.count} page(s))`).join('\n')
    : '(none)';
  return `Folders:\n${folderLines}\n\nPage types in use:\n${typeLines}`;
}

/** Extract a `## <name>` section (heading through the line before the next `## `). */
function extractSection(markdown: string, heading: string): string | null {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) {
    return null;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n').trim();
}

/**
 * Deterministic enforcement (same philosophy as the DOX Writer re-imposing
 * frontmatter/statistics): the proposal's `## Language` section is replaced
 * with the current constitution's, character for character, so the Phase 7
 * output-language binding can never be reworded by the model (prompt rule 4;
 * compliance-log [2026-07-21 12:00] item 7).
 */
function enforceLanguageSection(proposal: string, currentAgentsMd: string): string {
  const currentSection = extractSection(currentAgentsMd, '## Language');
  if (currentSection === null) {
    return proposal;
  }
  const proposalSection = extractSection(proposal, '## Language');
  if (proposalSection === null || proposalSection === currentSection) {
    return proposal;
  }
  return proposal.replace(proposalSection, currentSection);
}

/**
 * Phase 12 reask amendment: validate the LLM output and report the EXACT
 * failures so they can be fed back verbatim as a correction block. A valid
 * proposal is a plausible complete AGENTS.md: at least 200 characters and
 * containing every required section heading.
 */
function validateProposal(output: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const stripped = stripCodeFences(output).trim();
  if (stripped.length < 200) {
    errors.push(
      `proposal is too short (${stripped.length} chars); a complete AGENTS.md must be at least 200 characters`,
    );
  }
  for (const section of REQUIRED_SECTIONS) {
    if (!stripped.includes(section)) {
      errors.push(`missing required section: ${section}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Deterministic fallback (bounded retry amendment): when every LLM attempt
 * fails, the proposal is the CURRENT AGENTS.md (so gate 9.4's spirit holds —
 * nothing is lost) plus a deterministic additions section listing the new
 * folders and page types from the structural change log.
 */
function buildDeterministicFallback(
  currentAgentsMd: string,
  newFolders: Array<{ path: string; reason: string }>,
  newPageTypes: Array<{ path: string; reason: string }>,
): string {
  const folderLines = newFolders.length > 0
    ? newFolders.map((folder) => `- ${folder.path} — ${folder.reason}`).join('\n')
    : '- (none)';
  const typeLines = newPageTypes.length > 0
    ? newPageTypes.map((type) => `- ${type.path} — ${type.reason}`).join('\n')
    : '- (none)';
  return (
    `${currentAgentsMd.trimEnd()}\n\n` +
    `## Proposed Additions (deterministic fallback)\n\n` +
    `The LLM proposal was unavailable; these additions were generated deterministically from \`.state/proposals/structural-changes.json\`.\n\n` +
    `### New Folders Created\n\n${folderLines}\n\n` +
    `### New Page Types Discovered\n\n${typeLines}\n`
  );
}

/**
 * Phase 9 (phase doc §2.2): the AGENTS.md Updater. Runs after ingestion when
 * `--update-agents` is passed. Reads the current wiki constitution, the
 * completed wiki structure, and the structural change log; asks the LLM for a
 * complete updated AGENTS.md; saves the proposal to
 * `.state/proposed-agents.md` for human review.
 *
 * The original AGENTS.md is NEVER overwritten here (gate 9.4) — the human
 * applies the proposal manually or via the TUI Review screen.
 *
 * Returns the proposal markdown that was saved.
 */
export async function proposeAgentsUpdate(
  wikiSlug: string,
  options: AgentsUpdaterOptions = {},
): Promise<string> {
  const dir = wikiDir(options.workspace, wikiSlug);
  const agentsMdPath = join(dir, 'AGENTS.md');
  let currentAgentsMd: string;
  try {
    currentAgentsMd = await readFile(agentsMdPath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Wiki '${wikiSlug}' has no AGENTS.md at ${agentsMdPath}. Run 'init ${wikiSlug}' first.`);
    }
    throw err;
  }

  const structure = await collectWikiStructure(dir);
  const structuralLog = await readStructuralChanges(dir);
  const newFolders = structuralLog.changes
    .filter((change) => change.type === 'new-folder')
    .map((change) => ({ path: change.path, reason: change.reason }));
  const newPageTypes = structuralLog.changes
    .filter((change) => change.type === 'new-page-type')
    .map((change) => ({ path: change.path, reason: change.reason }));

  const template = await loadPromptTemplate();
  const prompt = fillPromptTemplate(template, {
    currentAgentsMd,
    wikiStructure: formatStructure(structure),
    newFolders: newFolders.length > 0
      ? newFolders.map((folder) => `- ${folder.path} — ${folder.reason}`).join('\n')
      : '(none)',
    newPageTypes: newPageTypes.length > 0
      ? newPageTypes.map((type) => `- ${type.path} — ${type.reason}`).join('\n')
      : '(none)',
  });

  const runLlm =
    options.callLLMFn ??
    ((promptText: string, _system?: string, callOptions?: CallLLMOptions) =>
      callLLM(promptText, undefined, {
        maxTokens: 8192,
        callType: 'agents-updater',
        context: wikiSlug,
        logPath: options.logPath ?? join(dir, '.state', 'llm-calls.json'),
        // Bounded retry amendment: transient transport failures (429/5xx,
        // network) get 2 extra attempts; deterministic 4xx throws immediately.
        maxRetries: 2,
        ...callOptions,
      }));

  // Phase 12 reask amendment (vision `04` §6 / `07` §5): content-defect
  // failures — a proposal that is too short or missing required sections — are
  // retried through the shared helper with the validator's exact errors fed
  // back as a correction block, up to 3 total attempts, then the deterministic
  // fallback. Attempt 1 is byte-identical to the pre-Phase-12 prompt (feedback
  // is null). The injected callLLMFn seam receives the composed prompt as its
  // first argument, unchanged.
  let proposal: string | null = null;
  let attemptsMade = 0;
  try {
    const outcome = await runWithFeedbackRetry<string>(
      (feedback, attempt) => {
        attemptsMade = attempt;
        const composed = feedback === null ? prompt : `${prompt}\n\n${feedback}`;
        return runLlm(composed, undefined, {
          context: attempt === 1 ? wikiSlug : `${wikiSlug}#attempt${attempt}`,
        });
      },
      (output) => validateProposal(output),
      {
        label: wikiSlug,
        onRepair: (errors) => {
          console.warn(
            `AGENTS.md Updater: proposal failed validation (attempt ${attemptsMade}/${AGENTS_UPDATER_MAX_ATTEMPTS}); retrying with validator feedback. ${errors.join('; ')}`,
          );
        },
      },
    );
    if (outcome.output !== null) {
      proposal = stripCodeFences(outcome.output).trim() + '\n';
    } else {
      console.warn(
        `AGENTS.md Updater: proposal failed validation after ${AGENTS_UPDATER_MAX_ATTEMPTS} attempts (${outcome.lastErrors.join('; ')}); writing the deterministic fallback proposal instead.`,
      );
    }
  } catch (err) {
    // Deterministic transport failure (HTTP 4xx) or exhausted transient
    // retries: never re-asked. Single warning, then the deterministic
    // fallback — the fallback guarantee is unchanged.
    console.warn(
      `AGENTS.md Updater: LLM call failed (${(err as Error).message}); writing the deterministic fallback proposal instead.`,
    );
  }

  if (proposal === null) {
    proposal = buildDeterministicFallback(currentAgentsMd, newFolders, newPageTypes);
  }

  // Deterministic enforcement: the `## Language` section is always the
  // current constitution's, verbatim (Phase 7 binding).
  proposal = enforceLanguageSection(proposal, currentAgentsMd);

  const proposalPath = join(dir, '.state', 'proposed-agents.md');
  await mkdir(dirname(proposalPath), { recursive: true });
  await writeFile(proposalPath, proposal, 'utf-8');

  console.log('Proposed AGENTS.md updates saved to .state/proposed-agents.md. Review and apply manually.');
  return proposal;
}
