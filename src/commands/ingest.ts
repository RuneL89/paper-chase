import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import { extractText, getPageCount } from '../extraction/pdf';
import { renderTablesAsMarkdown } from '../extraction/markdown-tables';
import { sha256 } from '../utils/hash';
import { sourceSlugForFile } from '../utils/slug';
import { aliasesForTitle, enforceAliasesInMarkdown } from '../utils/aliases';
import { getLanguage, type LanguageCode } from '../utils/language';
import { sourcePdfPath, wikiDir, wikiRelativePath } from '../utils/paths';
import { readIngestionState, writeIngestionState } from '../state/ingestion-state';
import { readWikiLanguage, writeWikiLanguage } from '../state/language';
import { readFullRollingMemory } from '../state/rolling-memory';
import { readConflicts } from '../state/conflicts';
import { writeMetrics, sumLlmUsageSince, countLlmCallsSince, type IngestionMetrics } from '../state/metrics';
import { setModelRouting } from '../llm/client';
import { beginReaskRun, reaskRepairs, runWithFeedbackRetry } from '../llm/reask';
import { loadSettings } from '../tui/settings';
import { writeSourcePage } from '../pages/source-page';
import { extractDocumentChunk, type ChunkExtraction } from './extract-chunk';
import { materialize, type MaterializeResult } from '../materializer';
import { writeDoxContracts, writeWorkspaceIndex, type DoxIndexContext, type DoxWorkspaceEntryContext, type DoxWorkspaceProseContext } from '../dox-writer';
import { proposeAgentsUpdate, type AgentsUpdaterOptions } from '../agents/agents-updater';
import { validateWiki, logValidation, type ValidationSummary } from '../validation';
import {
  writeEntitySynthesis,
  writePermissiveEntitySynthesis,
  writeTopicSynthesis,
  writePermissiveTopicSynthesis,
} from '../agents/synthesis';
import { checkPreservation, checkTopicPreservation } from '../validation/preservation-check';
import { logConflict } from '../state/conflicts';
import { logSynthesisReport } from '../state/synthesis-report';
import type { EntityPageData } from '../pages/entity-page';
import type { TopicPageData } from '../pages/topic-page';

export interface IngestOptions {
  /** Workspace directory containing wikis/; defaults to '.'. */
  workspace?: string;
  /** Pages per document-page chunk; defaults to 5. A page is never split. */
  pagesPerChunk?: number;
  /**
   * Run the Layer 2 Extractor on each newly-written chunk and save
   * `.state/extracted/<chunk-id>.json` (phase doc §2.3). Defaults to true
   * (CLI `ingest` extracts per the phase doc). Tests and key-less runs pass
   * `extract: false` to stay deterministic and LLM-free; when extraction is
   * enabled but the API key is missing, the Extractor's error propagates.
   */
  extract?: boolean;
  /**
   * Phase 5: run the optional Synthesis Writer after extraction, materialization,
   * and validation. Only has effect when `extract` is true. Defaults to false.
   */
  synthesis?: boolean;
  /** Progress callback (CLI prints these lines; the TUI renders them). */
  onProgress?: (message: string) => void;
  /**
   * Injectable extraction implementation (test-only). Defaults to the real
   * Layer 2 pipeline so the CLI and TUI make live LLM calls; tests can inject
   * a deterministic stub to exercise `extract: true` without an API key.
   */
  extractChunkFn?: (wikiDir: string, chunkId: string) => Promise<ChunkExtraction>;
  /**
   * Injectable synthesis implementation (test-only). Defaults to the real
   * Synthesis Writer; tests can inject a deterministic stub to exercise the
   * synthesis pipeline without an API key. Phase 12: the trailing `feedback`
   * (correction block on repair attempts) and `attempt` (1-based attempt
   * number) are optional — stubs that ignore them keep working.
   */
  synthesizeEntityFn?: (
    entityData: EntityPageData,
    agentsMd: string,
    logPath?: string,
    language?: { input: LanguageCode; output: LanguageCode },
    feedback?: string,
    attempt?: number,
  ) => Promise<string>;
  /**
   * Injectable permissive synthesis implementation (test-only). Defaults to the
   * real permissive Synthesis Writer; tests can inject a deterministic stub.
   */
  synthesizeEntityPermissiveFn?: (
    entityData: EntityPageData,
    agentsMd: string,
    logPath?: string,
    language?: { input: LanguageCode; output: LanguageCode },
    feedback?: string,
    attempt?: number,
  ) => Promise<string>;
  /**
   * Injectable topic synthesis implementation (test-only). Defaults to the real
   * topic Synthesis Writer; tests can inject a deterministic stub.
   */
  synthesizeTopicFn?: (
    topicData: TopicPageData,
    agentsMd: string,
    logPath?: string,
    language?: { input: LanguageCode; output: LanguageCode },
    feedback?: string,
    attempt?: number,
  ) => Promise<string>;
  /**
   * Injectable permissive topic synthesis implementation (test-only). Defaults to
   * the real permissive topic Synthesis Writer; tests can inject a deterministic stub.
   */
  synthesizeTopicPermissiveFn?: (
    topicData: TopicPageData,
    agentsMd: string,
    logPath?: string,
    language?: { input: LanguageCode; output: LanguageCode },
    feedback?: string,
    attempt?: number,
  ) => Promise<string>;
  /**
   * Phase 6: run the DOX Writer in LLM mode — one LLM call per folder plus the
   * wiki root writes rich, content-based `index.md` descriptions. Deterministic
   * code always re-imposes the frontmatter and statistics over the LLM output,
   * and any LLM failure falls back to the deterministic contract. Defaults to
   * false (the library default stays deterministic and LLM-free); production
   * callers (CLI, TUI) pass true.
   */
  doxLlm?: boolean;
  /**
   * Injectable DOX index writer (test-only pass-through to writeDoxContracts).
   * Defaults to the real LLM implementation; tests inject a stub to exercise
   * `doxLlm: true` without an API key. Phase 12: optional trailing `feedback`
   * (correction block on repairs) and `attempt` (1-based attempt number).
   */
  writeDoxIndexFn?: (context: DoxIndexContext, feedback?: string, attempt?: number) => Promise<string>;
  /**
   * Injectable workspace index writer (test-only pass-through to
   * writeWorkspaceIndex). Defaults to the real LLM implementation.
   */
  writeWorkspaceIndexFn?: (context: DoxWorkspaceEntryContext, feedback?: string, attempt?: number) => Promise<string>;
  /**
   * Injectable workspace prose writer (test-only pass-through to
   * writeWorkspaceIndex, 2026-07-21 prose amendment). Defaults to the real
   * LLM implementation; needed so ingest-level `doxLlm: true` tests stay
   * LLM-free when the workspace prose regenerates.
   */
  writeWorkspaceProseFn?: (context: DoxWorkspaceProseContext, feedback?: string, attempt?: number) => Promise<string>;
  /**
   * Phase 7 (vision `04` §9.1): input language of this run's PDFs. Resolution
   * order: this flag → `lastInputLanguage` in `.state/language.json` → 'en'.
   * Persisted as `lastInputLanguage` after the run.
   */
  inputLanguage?: LanguageCode;
  /**
   * Phase 7 (vision `04` §9.1): output language override for this run.
   * Resolution order: this flag → `outputLanguage` in `.state/language.json`
   * → 'en'. Also forwarded (as the language's English name) to the DOX
   * Writer's workspace pass prose.
   */
  outputLanguage?: LanguageCode;
  /**
   * Phase 9: after the DOX contracts and workspace index are written, run the
   * AGENTS.md Updater — one LLM call proposing an updated wiki constitution,
   * saved to `.state/proposed-agents.md` for human review. The original
   * AGENTS.md is never overwritten. Defaults to false (opt-in via the CLI
   * `--update-agents` flag or the TUI ingest toggle).
   */
  updateAgents?: boolean;
  /**
   * Injectable AGENTS.md updater (test-only). Defaults to the real
   * proposeAgentsUpdate; tests inject a deterministic stub to exercise
   * `updateAgents: true` without an API key.
   */
  proposeAgentsUpdateFn?: (wikiSlug: string, options: AgentsUpdaterOptions) => Promise<string>;
}

export interface IngestedSource {
  source: string;
  file: string;
  pageCount: number;
  documentPages: string[];
  warnings: string[];
  tablesFound: number;
}

/** Per-chunk extraction counts (Phase 2, additive). */
export interface ChunkExtractionSummary {
  chunkId: string;
  entities: number;
  relationships: number;
  claims: number;
}

export interface IngestResult {
  wiki: string;
  wikiDir: string;
  ingested: IngestedSource[];
  /** Source slugs skipped because their SHA-256 is unchanged. */
  skipped: string[];
  /** One entry per extracted chunk (Phase 2, additive; empty when extract: false). */
  extractions: ChunkExtractionSummary[];
  /** Phase 4: deterministic validation summary produced after materialization. */
  validation?: ValidationSummary;
  /**
   * Phase 6: validation summary produced AFTER the DOX Writer wrote the
   * `index.md` contracts, so the final pass covers the DOX pages too. The
   * persisted `.state/validation-report.json` reflects this final pass.
   */
  finalValidation?: ValidationSummary;
  /** Phase 5: number of entity pages successfully synthesized. */
  synthesized?: number;
  /** Phase 5: number of entity pages successfully synthesized using the permissive fallback. */
  synthesizedPermissive?: number;
  /** Phase 5: number of topic pages successfully synthesized. */
  synthesizedTopics?: number;
  /** Phase 5: number of topic pages successfully synthesized using the permissive fallback. */
  synthesizedTopicsPermissive?: number;
  /** Phase 5: number of entity pages where preservation check failed. */
  synthesisConflicts?: number;
  /** Phase 5: number of topic pages where preservation check failed. */
  topicConflicts?: number;
  /** Phase 7: the resolved input/output languages of this run. */
  languages?: { input: LanguageCode; output: LanguageCode };
  /** Phase 9: true when the AGENTS.md Updater wrote `.state/proposed-agents.md`. */
  agentsUpdateProposed?: boolean;
  /**
   * Phase 11: true when the Synthesis Writer stage ran this run (so result
   * banners can show the Synthesis segment only then — the synthesized
   * counters themselves are always present and zero-initialized).
   */
  synthesisRan?: boolean;
}

const DEFAULT_PAGES_PER_CHUNK = 5;

/**
 * Phase 7 v1.1.0 (bounded retry amendment, vision `04` §6 / `07` §5): each
 * synthesis mode gets up to 3 total attempts on preservation failure — a
 * quality failure, partly LLM variance — before the chain moves to the next
 * mode. Language-agnostic: applies to every ingest in every wiki.
 * Deterministic LLM errors (HTTP 4xx) still abort immediately.
 * Phase 12 (feedback-retry amendment, user-ratified 2026-07-23): the retry is
 * no longer blind — attempts 2+ carry the preservation check's exact dropped
 * items back to the writer via runWithFeedbackRetry.
 */
const SYNTHESIS_MAX_ATTEMPTS = 3;

interface SynthesisModeResult<C> {
  /** The synthesized page when a preservation check passed, else null. */
  page: string | null;
  attempts: number;
  /** The most recent preservation check; null only when the LLM call threw. */
  lastCheck: C | null;
}

/**
 * Build the validator-feedback error list from a preservation check: every
 * dropped mention context, relationship evidence, claim text, and citation
 * marker, verbatim (the reask prompt must carry the exact substrings the
 * writer must restore).
 */
function preservationFeedbackErrors(check: { passed: boolean }): string[] {
  const dropped = check as {
    droppedMentions?: string[];
    droppedRelationships?: string[];
    droppedClaims?: string[];
    droppedCitations?: string[];
  };
  const errors: string[] = [];
  for (const mention of dropped.droppedMentions ?? []) {
    errors.push(`Dropped mention (restore this exact text): ${mention}`);
  }
  for (const evidence of dropped.droppedRelationships ?? []) {
    errors.push(`Dropped relationship evidence (restore this exact text): ${evidence}`);
  }
  for (const claim of dropped.droppedClaims ?? []) {
    errors.push(`Dropped claim (restore this exact text): ${claim}`);
  }
  for (const citation of dropped.droppedCitations ?? []) {
    errors.push(`Dropped citation (restore this exact marker): ${citation}`);
  }
  return errors.length > 0 ? errors : ['The preservation check failed; restore all dropped content verbatim.'];
}

async function trySynthesisMode<C extends { passed: boolean }>(
  runSynthesis: (feedback: string | null, attempt: number) => Promise<string>,
  runCheck: (page: string) => C,
  label: string,
): Promise<SynthesisModeResult<C>> {
  let lastCheck: C | null = null;
  let attemptsMade = 0;
  const outcome = await runWithFeedbackRetry<string>(
    (feedback, attempt) => {
      attemptsMade = attempt;
      return runSynthesis(feedback, attempt);
    },
    (page) => {
      const check = runCheck(page);
      lastCheck = check;
      return check.passed
        ? { valid: true, errors: [] }
        : { valid: false, errors: preservationFeedbackErrors(check) };
    },
    {
      maxAttempts: SYNTHESIS_MAX_ATTEMPTS,
      label,
      onRepair: () => {
        console.warn(
          `Preservation failed for ${label} (attempt ${attemptsMade}/${SYNTHESIS_MAX_ATTEMPTS}); retrying with validator feedback.`,
        );
      },
    },
  );
  return { page: outcome.output, attempts: outcome.attempts, lastCheck };
}

function loadAgentsMd(wikiDir: string): string {
  const path = join(wikiDir, 'AGENTS.md');
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Phase 11 (phase doc §2.4): the end-of-ingest result banner, shared by the
 * CLI and the TUI so both say exactly the same thing:
 * `Ingest complete: X ingested, Y skipped. Synthesis: A pages written
 * (B strict, C permissive), D conflicts. Validation passed.`
 * The Synthesis segment appears only when the Synthesis Writer stage ran;
 * the Validation segment only when a validation pass ran.
 */
export function formatIngestSummary(result: IngestResult): string {
  let summary = `Ingest complete: ${result.ingested.length} ingested, ${result.skipped.length} skipped.`;
  if (result.synthesisRan === true) {
    const strict = (result.synthesized ?? 0) + (result.synthesizedTopics ?? 0);
    const permissive = (result.synthesizedPermissive ?? 0) + (result.synthesizedTopicsPermissive ?? 0);
    const conflicts = (result.synthesisConflicts ?? 0) + (result.topicConflicts ?? 0);
    summary +=
      ` Synthesis: ${strict + permissive} pages written ` +
      `(${strict} strict, ${permissive} permissive), ${conflicts} conflicts.`;
  }
  const validation = result.finalValidation ?? result.validation;
  if (validation) {
    const issues =
      validation.links.broken.length +
      validation.citations.invalid.length +
      validation.citations.missingSource.length +
      validation.schema.invalid.length;
    summary += issues === 0 ? ' Validation passed.' : ' Validation found issues.';
  }
  return summary;
}

/**
 * Ingest every PDF in `wikis/<slug>/raw/` into raw document pages
 * (phase doc §2.2, Layer 1) and, unless `extract: false`, run the Layer 2
 * Extractor on each newly-written chunk (phase doc §2.3).
 *
 * For each PDF: SHA-256 hash, skip when unchanged (`.state/ingestion.json`),
 * extract text page-by-page with the frozen Phase 0 `extractText`, chunk
 * consecutive whole pages (default 5 per chunk), render detected plaintext
 * tables as markdown tables, and write `documents/<source>-part-NNN.md` with
 * YAML frontmatter (gray-matter). Then refresh the deterministic source page
 * and the ingestion state. Re-running is idempotent: unchanged PDFs are
 * skipped and changed PDFs rewrite (never duplicate) their pages.
 *
 * Layer 2 (per chunk, vision `04` §3.2 Step 5): the Extractor reads the
 * chunk's document page, the wiki constitution (AGENTS.md), and rolling
 * memory (read-only here; Phase 3 updates it) and its JSON is saved to
 * `.state/extracted/<chunk-id>.json`. Unchanged (hash-skipped) PDFs are
 * skipped entirely — no extraction (vision `04` §3.1). Extraction failures
 * (invalid JSON, schema errors, missing API key) throw and abort the ingest;
 * the system does not retry (vision `04` §6).
 *
 * Phase 5/6 (phase doc §3.5 pipeline order): after materialization, if
 * `synthesis` is true, the Synthesis Writer runs per entity/topic page,
 * replacing the structured template with a synthesized two-layer page only
 * when the preservation check passes. Then the content pages are validated
 * (`result.validation`), the DOX Writer writes the `index.md` contracts, and
 * a final validation pass covers the whole wiki including the DOX pages
 * (`result.finalValidation`).
 *
 * Phase 8 (phase doc §2.2-§2.5): removed PDFs (in state, no longer in raw/)
 * log a warning and keep their derived pages; changed PDFs are re-processed
 * under the current run's input language (with a warning when it differs
 * from the language they were originally extracted under) and their stale
 * extraction JSON is deleted first; the Materializer skips manually-edited
 * pages (content-hash mismatch vs `.state/ingestion.json` `pageHashes`) and
 * logs them to `.state/conflicts.json`; every run ends by writing the
 * compounding metrics to `.state/metrics.json` for the TUI Ingestion Log.
 */
export async function ingest(slug: string, options: IngestOptions = {}): Promise<IngestResult> {
  // Phase 12 (vision `04` §6): reset the per-run feedback-repair counter so
  // metrics.feedbackRepairs and the end-of-run prompt-quality warning reflect
  // exactly this run's reask activity across all five LLM call sites.
  beginReaskRun();

  const pagesPerChunk = options.pagesPerChunk ?? DEFAULT_PAGES_PER_CHUNK;
  const extract = options.extract ?? true;
  const synthesis = options.synthesis ?? false;
  if (!Number.isInteger(pagesPerChunk) || pagesPerChunk < 1) {
    throw new Error(`pagesPerChunk must be a positive integer, got ${pagesPerChunk}.`);
  }

  // Phase 11 (phase doc §2.2): per-call LLM model routing from the workspace
  // TUI settings (`.paper-chase.json`). This is the single integration point
  // — it covers both the CLI and the TUI because both call ingest(). A
  // settings failure must never break an ingest, so it is best-effort.
  // Phase 11 v1.5.0: the Settings-stored API keys ride along on the routing
  // config (they win over the environment per provider in the client).
  try {
    const tuiSettings = await loadSettings(options.workspace ?? '.');
    setModelRouting({ ...tuiSettings.models, apiKeys: tuiSettings.apiKeys });
  } catch {
    // Keep whatever routing was already in effect.
  }

  const dir = wikiDir(options.workspace, slug);
  if (!existsSync(dir)) {
    throw new Error(`Wiki '${slug}' not found at ${dir}. Run 'init ${slug}' first.`);
  }
  const rawDir = join(dir, 'raw');
  if (!existsSync(rawDir)) {
    throw new Error(`Wiki '${slug}' has no raw/ directory. Run 'init ${slug}' to repair it.`);
  }

  const progress = options.onProgress ?? (() => {});

  // Phase 7 (vision `04` §9.1): resolve the run's language pair. Output:
  // CLI flag → .state/language.json → 'en'. Input: CLI flag →
  // lastInputLanguage → 'en'. Invalid codes throw via getLanguage.
  const languageState = await readWikiLanguage(dir);
  const output = getLanguage(options.outputLanguage ?? languageState.outputLanguage).code;
  const input = getLanguage(options.inputLanguage ?? languageState.lastInputLanguage).code;
  const language = { input, output };

  // Phase 7 (vision `04` §9.3 slug-forking caution): warn before processing
  // when the resolved input language differs from the last run and the wiki
  // already has extractions — the same name can slugify differently under a
  // different input language and fork into duplicate pages.
  if (input !== languageState.lastInputLanguage) {
    const extractedDir = join(dir, '.state', 'extracted');
    const hasExtractions =
      existsSync(extractedDir) &&
      (await readdir(extractedDir)).some((file) => file.endsWith('.json'));
    if (hasExtractions) {
      console.log(
        `Warning: input language '${input}' differs from the last run ('${languageState.lastInputLanguage}'). ` +
          `Re-ingesting the same names under a different language can create duplicate pages (slug forking).`,
      );
    }
  }

  const pdfFiles = (await readdir(rawDir))
    .filter((file) => file.toLowerCase().endsWith('.pdf'))
    .sort();

  const result: IngestResult = {
    wiki: slug,
    wikiDir: dir,
    ingested: [],
    skipped: [],
    extractions: [],
    synthesized: 0,
    synthesizedPermissive: 0,
    synthesizedTopics: 0,
    synthesizedTopicsPermissive: 0,
    synthesisConflicts: 0,
    topicConflicts: 0,
    languages: language,
  };

  if (pdfFiles.length === 0) {
    // Phase 8 (phase doc §2.2): warn about removed PDFs even when raw/ is
    // now empty — recorded sources whose files are gone are exactly the
    // removed-PDF case. Derived pages are kept either way.
    const emptyRunState = await readIngestionState(dir);
    for (const recordedSlug of Object.keys(emptyRunState.sources)) {
      progress(
        `Warning: ${recordedSlug} is recorded in ingestion state but its PDF is no longer in raw/. Derived pages were kept.`,
      );
    }
    progress(`No PDFs found in wikis/${slug}/raw/.`);
    // Phase 7: remember the chosen input language even for an empty run.
    await writeWikiLanguage(dir, { outputLanguage: languageState.outputLanguage, lastInputLanguage: input });
    return result;
  }

  const state = await readIngestionState(dir);
  const now = new Date().toISOString();
  let lastMaterializeResult: MaterializeResult | undefined;

  // Phase 8 (phase doc §2.2/§5.1): capture the run's starting point for the
  // compounding metrics — ISO timestamp (LLM cost window), rolling memory
  // (entity/mention diff), conflicts count, and the set of already-known
  // source slugs (so "new PDFs" means first-time-ingested only).
  const runStartedAt = now;
  const runStartMs = Date.now();
  const memoryBefore = await readFullRollingMemory(dir);
  const conflictsBefore = (await readConflicts(dir)).conflicts.length;
  const knownSlugsAtStart = new Set(Object.keys(state.sources));

  // Phase 11 (phase doc §2.6): per-run extraction accumulators for the
  // extended metrics (claims are also counted by type for claimsByType).
  let relationshipsExtracted = 0;
  let claimsExtracted = 0;
  const claimsByType: Record<string, number> = {};

  // Phase 8 (phase doc §2.2): removed PDFs — recorded in the ingestion state
  // but no longer present in raw/. Warn only; derived pages are KEPT so the
  // journalist can review before removal (nothing is deleted).
  const presentSlugs = new Set(pdfFiles.map((file) => sourceSlugForFile(file)));
  for (const recordedSlug of Object.keys(state.sources)) {
    if (!presentSlugs.has(recordedSlug)) {
      progress(
        `Warning: ${recordedSlug} is recorded in ingestion state but its PDF is no longer in raw/. Derived pages were kept.`,
      );
    }
  }

  // Phase 8 (phase doc §2.5): working copy of the recorded page hashes.
  // Updated after every materialize call so pages written earlier in THIS
  // run are never mistaken for manual edits by a later call in the same run.
  const workingPageHashes: Record<string, string> = { ...(state.pageHashes ?? {}) };
  const writtenPagePaths = new Set<string>();
  const conflictSkippedSlugs = new Set<string>();

  // Layer 3 (phase doc §2.5): materialize all entity, topic, and document
  // pages from every .state/extracted/*.json. The recorded page hashes flow
  // in so manually-edited pages are skipped (conflict logged) instead of
  // overwritten; the pages each call writes fold back into the working hash
  // map for the next call.
  const runMaterialize = async (): Promise<void> => {
    lastMaterializeResult = await materialize(slug, {
      workspace: options.workspace,
      pageHashes: workingPageHashes,
    });
    for (const written of lastMaterializeResult.writtenPages) {
      workingPageHashes[written.path] = written.hash;
      writtenPagePaths.add(written.path);
    }
    for (const conflictPath of lastMaterializeResult.conflicts) {
      const conflictSlug = conflictPath.split('/').pop()?.replace(/\.md$/, '');
      if (conflictSlug) {
        conflictSkippedSlugs.add(conflictSlug);
      }
      progress(`Skipping update of ${conflictPath} (manually edited). Conflict logged.`);
    }
    // Fork reconciliation (UAT fix): the Materializer deleted unmodified
    // duplicate pages left behind by an earlier cross-run folder fork. Drop
    // their recorded hashes so the deleted files are never tracked again.
    for (const removed of lastMaterializeResult.removedDuplicates) {
      delete workingPageHashes[removed.path];
      progress(`Removed duplicate page ${removed.path} (entity now lives at ${removed.canonicalPath}).`);
    }
    progress('Materialized entity, topic, and document pages.');
  };

  for (const fileName of pdfFiles) {
    const pdfPath = join(rawDir, fileName);
    const sourceSlug = sourceSlugForFile(fileName);
    const hash = await sha256(pdfPath);
    const existing = state.sources[sourceSlug];

    if (existing && existing.hash === hash) {
      progress(`Skipping ${fileName} (unchanged)`);
      result.skipped.push(sourceSlug);
      continue;
    }

    // Phase 8 (phase doc §2.2 + vision `04` §9.3): a changed PDF is
    // re-processed under the CURRENT run's input language; warn when that
    // differs from the language it was originally extracted under.
    if (existing && existing.hash !== hash && existing.language && existing.language !== input) {
      progress(
        `Warning: ${fileName} was originally extracted under input language '${existing.language}'; re-processing under '${input}'.`,
      );
    }

    progress(`Extracting text from ${fileName}...`);
    const pageCount = await getPageCount(pdfPath);
    const pageTexts: string[] = [];
    const warnings: string[] = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const pageText = await extractText(pdfPath, pageNumber, pageNumber);
      if (pageText.trim().length === 0) {
        warnings.push(`Page ${pageNumber} extracted to empty text`);
      }
      pageTexts.push(pageText);
    }

    const chunkCount = Math.max(1, Math.ceil(pageCount / pagesPerChunk));

    // Re-ingesting a changed PDF: remove its previous document pages first so
    // a shorter PDF never leaves stale part-NNN files behind (idempotency).
    // Phase 8 (phase doc §2.2): the old extraction JSON is replaced too —
    // remove each old chunk's `.state/extracted/<chunk-id>.json` so stale
    // extractions never feed the Materializer after re-processing.
    for (const oldPage of existing?.documentPages ?? []) {
      await rm(join(dir, oldPage), { force: true });
      const oldChunkId = oldPage.split('/').pop()?.replace(/\.md$/, '');
      if (oldChunkId) {
        await rm(join(dir, '.state', 'extracted', `${oldChunkId}.json`), { force: true });
      }
    }

    const documentPages: string[] = [];
    let tablesFound = 0;
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
      const startPage = chunkIndex * pagesPerChunk + 1;
      const endPage = Math.min((chunkIndex + 1) * pagesPerChunk, pageCount);
      progress(`Chunk ${chunkIndex + 1}/${chunkCount} (pages ${startPage}-${endPage})`);

      const rawChunkText = pageTexts.slice(startPage - 1, endPage).join('\n');
      const rendered = renderTablesAsMarkdown(rawChunkText);
      tablesFound += rendered.tablesFound;

      const part = String(chunkIndex + 1).padStart(3, '0');
      const docFileName = `${sourceSlug}-part-${part}.md`;
      const docTitle = `${sourceSlug}-part-${part}`;
      // Alias rule applied uniformly (UAT 6.3 fix): a document page's title
      // always equals its chunk-id basename, so this is always undefined and
      // document pages never carry an aliases field.
      const docAliases = aliasesForTitle(docTitle, docFileName.replace(/\.md$/, ''));
      const frontmatter = {
        title: docTitle,
        type: 'document',
        ...(docAliases ? { aliases: docAliases } : {}),
        wiki: slug,
        sources: [
          {
            file: sourcePdfPath(slug, fileName),
            pages: `${startPage}-${endPage}`,
            extracted: now,
            sha256: hash,
          },
        ],
        updated: now,
      };
      const body = `\n## Extracted Text: Pages ${startPage}-${endPage}\n\n${rendered.text}\n`;

      await mkdir(join(dir, 'documents'), { recursive: true });
      await writeFile(join(dir, 'documents', docFileName), matter.stringify(body, frontmatter), 'utf-8');
      documentPages.push(wikiRelativePath('documents', docFileName));

      // Layer 2 (phase doc §2.3): run the Extractor on the chunk just written
      // and save `.state/extracted/<chunk-id>.json`. extractDocumentChunk
      // reads the document page back from disk so the ingest path and the TUI
      // Test Extractor screen share one code path.
      if (extract) {
        const chunkId = docFileName.replace(/\.md$/, '');
        // Phase 7: the default extraction path threads the run's language pair
        // into the Extractor (language directive + slug transliteration).
        const run = options.extractChunkFn ?? ((d: string, id: string) => extractDocumentChunk(d, id, language));
        const extraction = await run(dir, chunkId);
        progress(
          `Extracted ${extraction.result.entities.length} entities, ${extraction.result.relationships.length} relationships, ` +
            `${extraction.result.claims.length} claims from chunk ${chunkId}.`,
        );
        result.extractions.push({
          chunkId,
          entities: extraction.result.entities.length,
          relationships: extraction.result.relationships.length,
          claims: extraction.result.claims.length,
        });
        // Phase 11: accumulate the run's extraction metrics.
        relationshipsExtracted += extraction.result.relationships.length;
        claimsExtracted += extraction.result.claims.length;
        for (const claim of extraction.result.claims) {
          claimsByType[claim.type] = (claimsByType[claim.type] ?? 0) + 1;
        }
      }
    }

    // Layer 3: after a source's chunks are extracted, materialize all
    // entity, topic, and document pages from every .state/extracted/*.json.
    if (extract) {
      await runMaterialize();
    }

    await writeSourcePage(dir, {
      wiki: slug,
      fileName,
      filePath: sourcePdfPath(slug, fileName),
      sourceSlug,
      sha256: hash,
      pageCount,
      ingested: existing?.ingestedAt ?? now,
      updated: now,
      warnings,
      documentPages,
    });

    // Phase 8 (vision `04` §9.3): record the input language this source was
    // extracted under so a later changed-PDF re-process can warn on drift.
    state.sources[sourceSlug] = { hash, documentPages, ingestedAt: now, language: input };
    progress(`Ingested ${fileName} -> ${documentPages.length} document page(s)`);
    result.ingested.push({
      source: sourceSlug,
      file: fileName,
      pageCount,
      documentPages,
      warnings,
      tablesFound,
    });
  }

  // Phase 8 (UAT fork fix): materialize also runs when EVERY PDF was
  // skipped, so an already-forked wiki is repaired by one more ingest even
  // when nothing changed (re-deriving pages from the same extraction set is
  // idempotent; recorded hashes prevent false manual-edit conflicts). Runs
  // only when extractions exist so a wiki without Layer-2 data keeps its
  // rolling memory untouched.
  if (extract && lastMaterializeResult === undefined) {
    const extractedDir = join(dir, '.state', 'extracted');
    const hasExtractions =
      existsSync(extractedDir) &&
      (await readdir(extractedDir)).some((file) => file.toLowerCase().endsWith('.json'));
    if (hasExtractions) {
      await runMaterialize();
    }
  }

  await writeIngestionState(dir, state);

  // Phase 5: optional synthesis after materialization and before validation.
  // Order: entities first, then topics. Document pages keep their deterministic
  // Phase 1 format and are not synthesized.
  if (extract && synthesis && lastMaterializeResult) {
    result.synthesisRan = true;
    const agentsMd = loadAgentsMd(dir);
    const llmLogPath = join(dir, '.state', 'llm-calls.json');
    const runEntitySynthesis = options.synthesizeEntityFn ?? writeEntitySynthesis;
    const runEntityPermissiveSynthesis =
      options.synthesizeEntityPermissiveFn ?? writePermissiveEntitySynthesis;
    const runTopicSynthesis = options.synthesizeTopicFn ?? writeTopicSynthesis;
    const runTopicPermissiveSynthesis =
      options.synthesizeTopicPermissiveFn ?? writePermissiveTopicSynthesis;

    // 1. Entity synthesis
    const entityCount = lastMaterializeResult.entityPages.length;
    if (entityCount > 0) {
      progress(`Writing synthesis for ${entityCount} entity page(s)...`);
    }

    for (const entityPage of lastMaterializeResult.entityPages) {
      // Strict synthesis first (readable prose that preserves exact
      // mention/relationship/claim strings), retried up to
      // SYNTHESIS_MAX_ATTEMPTS times on preservation failure (Phase 7
      // v1.1.0 bounded retry amendment — applies to every language).
      const strict = await trySynthesisMode(
        (feedback, attempt) => runEntitySynthesis(entityPage, agentsMd, llmLogPath, language, feedback ?? undefined, attempt),
        (page) => checkPreservation(entityPage, page),
        entityPage.slug,
      );
      if (strict.page !== null) {
        const folderPath = join(dir, entityPage.folder);
        // UAT 6.3 fix: re-impose the aliases frontmatter field over the
        // model-written page (deterministic; the LLM's frontmatter is not
        // trusted for the alias rule).
        await writeFile(
          join(folderPath, `${entityPage.slug}.md`),
          enforceAliasesInMarkdown(strict.page, entityPage.title, entityPage.slug),
          'utf-8',
        );
        result.synthesized = (result.synthesized ?? 0) + 1;
        await logSynthesisReport(dir, {
          timestamp: new Date().toISOString(),
          pageType: 'entity',
          slug: entityPage.slug,
          strict: { attempted: true, passed: true, attempts: strict.attempts },
          permissive: { attempted: false, passed: false },
          finalMode: 'strict-synthesis',
        });
        continue;
      }

      // Fallback: permissive synthesis (prose summary + verbatim structured
      // data), also retried up to SYNTHESIS_MAX_ATTEMPTS times.
      console.warn(
        `Strict synthesis failed preservation for ${entityPage.slug} after ${strict.attempts} attempt(s). Trying permissive fallback.`,
      );
      const permissive = await trySynthesisMode(
        (feedback, attempt) => runEntityPermissiveSynthesis(entityPage, agentsMd, llmLogPath, language, feedback ?? undefined, attempt),
        (page) => checkPreservation(entityPage, page),
        entityPage.slug,
      );
      if (permissive.page !== null) {
        const folderPath = join(dir, entityPage.folder);
        await writeFile(
          join(folderPath, `${entityPage.slug}.md`),
          enforceAliasesInMarkdown(permissive.page, entityPage.title, entityPage.slug),
          'utf-8',
        );
        result.synthesizedPermissive = (result.synthesizedPermissive ?? 0) + 1;
        await logSynthesisReport(dir, {
          timestamp: new Date().toISOString(),
          pageType: 'entity',
          slug: entityPage.slug,
          strict: { attempted: true, passed: false, attempts: strict.attempts },
          permissive: { attempted: true, passed: true, attempts: permissive.attempts },
          finalMode: 'permissive-synthesis',
        });
      } else {
        console.warn(
          `Permissive synthesis also failed preservation for ${entityPage.slug} after ${permissive.attempts} attempt(s). Keeping structured template.`,
        );
        if (permissive.lastCheck !== null) {
          await logConflict(dir, entityPage.slug, permissive.lastCheck, 'entity');
        }
        result.synthesisConflicts = (result.synthesisConflicts ?? 0) + 1;
        await logSynthesisReport(dir, {
          timestamp: new Date().toISOString(),
          pageType: 'entity',
          slug: entityPage.slug,
          strict: { attempted: true, passed: false, attempts: strict.attempts },
          permissive: { attempted: true, passed: false, attempts: permissive.attempts },
          finalMode: 'structured-template',
        });
      }
    }

    // 2. Topic synthesis
    const topicCount = lastMaterializeResult.topicPages.length;
    if (topicCount > 0) {
      progress(`Writing synthesis for ${topicCount} topic page(s)...`);
    }

    for (const topicPage of lastMaterializeResult.topicPages) {
      const strict = await trySynthesisMode(
        (feedback, attempt) => runTopicSynthesis(topicPage, agentsMd, llmLogPath, language, feedback ?? undefined, attempt),
        (page) => checkTopicPreservation(topicPage, page),
        `topic ${topicPage.slug}`,
      );
      if (strict.page !== null) {
        const folderPath = join(dir, topicPage.folder);
        await writeFile(
          join(folderPath, `${topicPage.slug}.md`),
          enforceAliasesInMarkdown(strict.page, topicPage.title, topicPage.slug),
          'utf-8',
        );
        result.synthesizedTopics = (result.synthesizedTopics ?? 0) + 1;
        await logSynthesisReport(dir, {
          timestamp: new Date().toISOString(),
          pageType: 'topic',
          slug: topicPage.slug,
          strict: { attempted: true, passed: true, attempts: strict.attempts },
          permissive: { attempted: false, passed: false },
          finalMode: 'strict-synthesis',
        });
        continue;
      }

      console.warn(
        `Strict synthesis failed preservation for topic ${topicPage.slug} after ${strict.attempts} attempt(s). Trying permissive fallback.`,
      );
      const permissive = await trySynthesisMode(
        (feedback, attempt) => runTopicPermissiveSynthesis(topicPage, agentsMd, llmLogPath, language, feedback ?? undefined, attempt),
        (page) => checkTopicPreservation(topicPage, page),
        `topic ${topicPage.slug}`,
      );
      if (permissive.page !== null) {
        const folderPath = join(dir, topicPage.folder);
        await writeFile(
          join(folderPath, `${topicPage.slug}.md`),
          enforceAliasesInMarkdown(permissive.page, topicPage.title, topicPage.slug),
          'utf-8',
        );
        result.synthesizedTopicsPermissive = (result.synthesizedTopicsPermissive ?? 0) + 1;
        await logSynthesisReport(dir, {
          timestamp: new Date().toISOString(),
          pageType: 'topic',
          slug: topicPage.slug,
          strict: { attempted: true, passed: false, attempts: strict.attempts },
          permissive: { attempted: true, passed: true, attempts: permissive.attempts },
          finalMode: 'permissive-synthesis',
        });
      } else {
        console.warn(
          `Permissive synthesis also failed preservation for topic ${topicPage.slug} after ${permissive.attempts} attempt(s). Keeping structured template.`,
        );
        if (permissive.lastCheck !== null) {
          await logConflict(dir, topicPage.slug, permissive.lastCheck, 'topic');
        }
        result.topicConflicts = (result.topicConflicts ?? 0) + 1;
        await logSynthesisReport(dir, {
          timestamp: new Date().toISOString(),
          pageType: 'topic',
          slug: topicPage.slug,
          strict: { attempted: true, passed: false, attempts: strict.attempts },
          permissive: { attempted: true, passed: false, attempts: permissive.attempts },
          finalMode: 'structured-template',
        });
      }
    }
  }

  // Phase 8 (phase doc §2.5): after synthesis (which may have replaced the
  // structured pages the Materializer wrote), re-hash every page written
  // this run FROM DISK so the recorded hashes always reflect the tool's own
  // final writes — the tool's own writes are never flagged as manual edits.
  if (extract && writtenPagePaths.size > 0) {
    for (const relativePath of writtenPagePaths) {
      try {
        const content = await readFile(join(dir, relativePath), 'utf-8');
        workingPageHashes[relativePath] = createHash('sha256').update(content, 'utf-8').digest('hex');
      } catch {
        // Page vanished between materialization and now; keep the old hash.
      }
    }
    state.pageHashes = workingPageHashes;
    await writeIngestionState(dir, state);
  }

  // Phase 8 (phase doc §5.1): the compounding metrics that power the TUI
  // Ingestion Log screen. New/updated entities come from a rolling-memory
  // diff across the whole run; updated entities whose page update was
  // skipped (manual-edit conflict) are reported as conflicts, not updates.
  // Computed identically for the preliminary and the final write — the only
  // differences are the fields derived from stages that have not run yet at
  // the preliminary point (final validation counts, the full LLM cost/token
  // window, and the final wall-clock time).
  // Phase 11 (phase doc §2.6): the field set is extended additively with
  // chunk/relationship/claim/page/folder/conflict/token/wall-clock counters.
  let memoryAfterEntityCount = 0;
  const buildRunMetrics = async (): Promise<IngestionMetrics> => {
    const memoryAfter = await readFullRollingMemory(dir);
    memoryAfterEntityCount = memoryAfter?.entities.length ?? 0;
    const beforeCounts = new Map((memoryBefore?.entities ?? []).map((entity) => [entity.slug, entity.mentionCount]));
    const beforeFolders = new Set(memoryBefore?.folderStructure ?? []);
    const titleBySlug = new Map<string, string>();
    for (const page of lastMaterializeResult?.entityPages ?? []) {
      titleBySlug.set(page.slug, page.title);
    }
    const conflictsState = await readConflicts(dir);
    const conflictsAfter = conflictsState.conflicts.length;
    // Phase 11: this run's conflicts split by kind — manual-edit entries
    // carry `type: 'manual-edit'`; preservation failures carry a pageType.
    let conflictsManualEdit = 0;
    let conflictsPreservation = 0;
    for (const entry of conflictsState.conflicts) {
      if (entry.timestamp < runStartedAt) {
        continue;
      }
      if ('type' in entry && entry.type === 'manual-edit') {
        conflictsManualEdit += 1;
      } else {
        conflictsPreservation += 1;
      }
    }
    const newEntities = (memoryAfter?.entities ?? [])
      .filter((entity) => !beforeCounts.has(entity.slug))
      .map((entity) => ({
        slug: entity.slug,
        title: titleBySlug.get(entity.slug) ?? entity.slug,
        folder: entity.folder,
      }));
    const updatedEntities = (memoryAfter?.entities ?? [])
      .filter(
        (entity) =>
          beforeCounts.has(entity.slug) &&
          entity.mentionCount > (beforeCounts.get(entity.slug) ?? 0) &&
          !conflictSkippedSlugs.has(entity.slug),
      )
      .map((entity) => ({
        slug: entity.slug,
        title: titleBySlug.get(entity.slug) ?? entity.slug,
        addedMentions: entity.mentionCount - (beforeCounts.get(entity.slug) ?? 0),
      }));
    // Phase 11: pages created/updated this run by type — entity/topic pages
    // actually written by the Materializer (conflict-skips excluded) plus the
    // document pages written by this run's Layer 1 pass.
    const pagesByType: Record<string, number> = {};
    for (const written of lastMaterializeResult?.writtenPages ?? []) {
      const type = written.path.split('/')[0] === 'topics' ? 'topic' : 'entity';
      pagesByType[type] = (pagesByType[type] ?? 0) + 1;
    }
    const documentPagesWritten = result.ingested.reduce((count, source) => count + source.documentPages.length, 0);
    if (documentPagesWritten > 0) {
      pagesByType.document = documentPagesWritten;
    }
    const llmUsage = await sumLlmUsageSince(dir, runStartedAt);
    const validation = result.finalValidation ?? result.validation;
    return {
      run: runStartedAt,
      newPdfs: result.ingested
        .filter((source) => !knownSlugsAtStart.has(source.source))
        .map((source) => source.file),
      newEntities,
      updatedEntities,
      conflicts: conflictsAfter - conflictsBefore,
      totalCost: llmUsage.cost,
      chunksProcessed: documentPagesWritten,
      // Skipped chunks = the recorded document pages of hash-skipped PDFs.
      chunksSkipped: result.skipped.reduce(
        (count, sourceSlug) => count + (state.sources[sourceSlug]?.documentPages.length ?? 0),
        0,
      ),
      chunksFailed: 0,
      entitiesNew: newEntities.length,
      entitiesUpdated: updatedEntities.length,
      relationshipsExtracted,
      claimsExtracted,
      claimsByType: { ...claimsByType },
      pagesByType,
      foldersCreated: (memoryAfter?.folderStructure ?? []).filter((folder) => !beforeFolders.has(folder)).length,
      brokenLinks: validation?.links.broken.length ?? 0,
      orphanedPages: validation?.links.orphaned.length ?? 0,
      conflictsManualEdit,
      conflictsPreservation,
      totalTokens: llmUsage.inputTokens + llmUsage.outputTokens,
      wallClockMs: Date.now() - runStartMs,
      // Phase 12 (vision `04` §6): validator-feedback repairs so far this run
      // (preliminary write = pre-DOX stages; final write = the whole run).
      feedbackRepairs: reaskRepairs(),
    };
  };

  // Phase 8 (UAT crash-safe finalization fix): persist the end-of-run state
  // NOW — before the validation/DOX/workspace stages, which run a full suite
  // of LLM calls even when every PDF was skipped — so an interruption in
  // that window never leaves the run unrecorded. Both writes are auxiliary:
  // a failure warns and the ingest continues. The final writes below refresh
  // the language state and re-write the metrics with the final totalCost.
  try {
    await writeWikiLanguage(dir, { outputLanguage: languageState.outputLanguage, lastInputLanguage: input });
    await writeMetrics(dir, await buildRunMetrics());
  } catch (err) {
    progress(`Warning: could not record preliminary ingestion metrics: ${(err as Error).message}`);
  }

  // Phase 4/6 pipeline order (phase doc §3.5): content validation -> DOX
  // Writer -> final validation. The first validation covers the content pages
  // (post-materialization, post-synthesis) and runs whenever extraction was
  // requested so the TUI and CLI always report link, citation, and schema
  // health at the end of an ingest.
  if (extract) {
    const validation = await validateWiki(slug, options.workspace);
    logValidation(validation, dir);
    result.validation = validation;
  }

  // Phase 6: the DOX Writer writes index.md navigation contracts for every
  // folder and the wiki root. Runs in both extract and non-extract modes; the
  // dox options pass through so doxLlm/writeDoxIndexFn are respected either way.
  await writeDoxContracts(slug, {
    workspace: options.workspace,
    doxLlm: options.doxLlm,
    writeDoxIndexFn: options.writeDoxIndexFn,
    language,
  });
  progress('DOX contracts updated.');

  // Phase 6: final validation pass over the whole wiki, including the new DOX
  // pages. The persisted validation-report.json reflects this final pass.
  if (extract) {
    const finalValidation = await validateWiki(slug, options.workspace);
    logValidation(finalValidation, dir);
    result.finalValidation = finalValidation;
  }

  // Phase 6 (2026-07-20 amendment, per-wiki segments 2026-07-21): the
  // workspace pass tops the bottom-up chain — folder indexes -> wiki root
  // index -> workspace index. It runs at the end of every ingest and writes
  // ONLY this wiki's own segment (prose in this run's output language);
  // every other wiki's segment is preserved byte-for-byte.
  await writeWorkspaceIndex({
    workspace: options.workspace,
    wikiSlug: slug,
    doxLlm: options.doxLlm,
    writeWorkspaceIndexFn: options.writeWorkspaceIndexFn,
    writeWorkspaceProseFn: options.writeWorkspaceProseFn,
    outputLanguage: getLanguage(output).name,
    logPath: join(dir, '.state', 'llm-calls.json'),
  });
  progress('Workspace index updated.');

  // Phase 9 (phase doc §2.3): the AGENTS.md Updater runs after the DOX
  // contracts (and the workspace pass) when explicitly opted in. It writes a
  // PROPOSAL to .state/proposed-agents.md for human review — the original
  // AGENTS.md is never overwritten automatically (gate 9.4).
  if (options.updateAgents) {
    const runPropose = options.proposeAgentsUpdateFn ?? proposeAgentsUpdate;
    await runPropose(slug, { workspace: options.workspace });
    result.agentsUpdateProposed = true;
    progress('Proposed AGENTS.md updates saved to .state/proposed-agents.md. Review and apply manually.');
  }

  // Phase 7: persist the run's input language for the next run's pre-selection
  // and slug-forking detection. The stored output language is NOT overwritten
  // by a per-run override — it stays the wiki's fixed setting (vision 04 §9.1).
  // (Also written by the crash-safe preliminary pass above; harmless refresh.)
  await writeWikiLanguage(dir, { outputLanguage: languageState.outputLanguage, lastInputLanguage: input });

  // Phase 8 (phase doc §5.1): persist the compounding metrics that power the
  // TUI Ingestion Log screen, now with the FINAL totalCost (the preliminary
  // write above ran before the DOX/workspace LLM calls). Metrics are
  // auxiliary: a failure here must never fail an otherwise-successful run.
  // Phase 11 (phase doc §2.6): also emit a compact metrics summary line so
  // the CLI and the TUI progress view both show the run's shape.
  try {
    const metrics = await buildRunMetrics();
    await writeMetrics(dir, metrics);
    progress(
      `Metrics: ${metrics.chunksProcessed} chunks, ${memoryAfterEntityCount} entities ` +
        `(${metrics.entitiesNew} new), ${metrics.relationshipsExtracted} relationships, ` +
        `${metrics.claimsExtracted} claims, $${metrics.totalCost.toFixed(4)}, ` +
        `${Math.round(metrics.wallClockMs / 1000)}s`,
    );
  } catch (err) {
    progress(`Warning: could not record ingestion metrics: ${(err as Error).message}`);
  }

  // Phase 12 (vision `04` §6 repair-rate warning): an elevated feedback-repair
  // rate means the loop may be masking a systematic prompt defect. Warn at ≥5
  // repairs in the run OR repairs above 25% of the run's logged LLM calls
  // (calls counted from `.state/llm-calls.json` entries at/after run start;
  // the ratio check is skipped when no calls were logged). Accounting is
  // auxiliary — it must never fail the run.
  try {
    const repairs = reaskRepairs();
    const llmCalls = await countLlmCallsSince(dir, runStartedAt);
    if (repairs >= 5 || (llmCalls > 0 && repairs / llmCalls > 0.25)) {
      progress(
        `Warning: ${repairs} of ${llmCalls} LLM calls this run needed validator-feedback repair — the underlying prompt may need attention.`,
      );
    }
  } catch {
    // Best-effort accounting only.
  }

  progress('Done!');
  return result;
}
