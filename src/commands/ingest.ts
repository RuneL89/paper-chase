import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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
import { writeSourcePage } from '../pages/source-page';
import { extractDocumentChunk, type ChunkExtraction } from './extract-chunk';
import { materialize, type MaterializeResult } from '../materializer';
import { writeDoxContracts, writeWorkspaceIndex, type DoxIndexContext, type DoxWorkspaceIndexContext } from '../dox-writer';
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
   * synthesis pipeline without an API key.
   */
  synthesizeEntityFn?: (
    entityData: EntityPageData,
    agentsMd: string,
    logPath?: string,
    language?: { input: LanguageCode; output: LanguageCode },
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
   * `doxLlm: true` without an API key.
   */
  writeDoxIndexFn?: (context: DoxIndexContext) => Promise<string>;
  /**
   * Injectable workspace index writer (test-only pass-through to
   * writeWorkspaceIndex). Defaults to the real LLM implementation.
   */
  writeWorkspaceIndexFn?: (context: DoxWorkspaceIndexContext) => Promise<string>;
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
}

const DEFAULT_PAGES_PER_CHUNK = 5;

/**
 * Phase 7 v1.1.0 (bounded retry amendment, vision `04` §6 / `07` §5): each
 * synthesis mode gets up to 3 total attempts on preservation failure — a
 * quality failure, partly LLM variance — before the chain moves to the next
 * mode. Language-agnostic: applies to every ingest in every wiki.
 * Deterministic LLM errors (HTTP 4xx) still abort immediately.
 */
const SYNTHESIS_MAX_ATTEMPTS = 3;

interface SynthesisModeResult<C> {
  /** The synthesized page when a preservation check passed, else null. */
  page: string | null;
  attempts: number;
  lastCheck: C;
}

async function trySynthesisMode<C extends { passed: boolean }>(
  runSynthesis: () => Promise<string>,
  runCheck: (page: string) => C,
  label: string,
): Promise<SynthesisModeResult<C>> {
  let attempts = 0;
  let lastCheck: C | null = null;
  while (attempts < SYNTHESIS_MAX_ATTEMPTS) {
    attempts++;
    const page = await runSynthesis();
    const check = runCheck(page);
    lastCheck = check;
    if (check.passed) {
      return { page, attempts, lastCheck };
    }
    if (attempts < SYNTHESIS_MAX_ATTEMPTS) {
      console.warn(
        `Preservation failed for ${label} (attempt ${attempts}/${SYNTHESIS_MAX_ATTEMPTS}); retrying.`,
      );
    }
  }
  return { page: null, attempts, lastCheck: lastCheck as C };
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
 */
export async function ingest(slug: string, options: IngestOptions = {}): Promise<IngestResult> {
  const pagesPerChunk = options.pagesPerChunk ?? DEFAULT_PAGES_PER_CHUNK;
  const extract = options.extract ?? true;
  const synthesis = options.synthesis ?? false;
  if (!Number.isInteger(pagesPerChunk) || pagesPerChunk < 1) {
    throw new Error(`pagesPerChunk must be a positive integer, got ${pagesPerChunk}.`);
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
    progress(`No PDFs found in wikis/${slug}/raw/.`);
    // Phase 7: remember the chosen input language even for an empty run.
    await writeWikiLanguage(dir, { outputLanguage: languageState.outputLanguage, lastInputLanguage: input });
    return result;
  }

  const state = await readIngestionState(dir);
  const now = new Date().toISOString();
  let lastMaterializeResult: MaterializeResult | undefined;

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
    for (const oldPage of existing?.documentPages ?? []) {
      await rm(join(dir, oldPage), { force: true });
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
      }
    }

    // Layer 3 (phase doc §2.5): after a source's chunks are extracted,
    // materialize all entity, topic, and document pages from every .state/extracted/*.json.
    if (extract) {
      lastMaterializeResult = await materialize(slug, { workspace: options.workspace });
      progress('Materialized entity, topic, and document pages.');
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

    state.sources[sourceSlug] = { hash, documentPages, ingestedAt: now };
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

  await writeIngestionState(dir, state);

  // Phase 5: optional synthesis after materialization and before validation.
  // Order: entities first, then topics. Document pages keep their deterministic
  // Phase 1 format and are not synthesized.
  if (extract && synthesis && lastMaterializeResult) {
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
        () => runEntitySynthesis(entityPage, agentsMd, llmLogPath, language),
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
        () => runEntityPermissiveSynthesis(entityPage, agentsMd, llmLogPath, language),
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
        await logConflict(dir, entityPage.slug, permissive.lastCheck, 'entity');
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
        () => runTopicSynthesis(topicPage, agentsMd, llmLogPath, language),
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
        () => runTopicPermissiveSynthesis(topicPage, agentsMd, llmLogPath, language),
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
        await logConflict(dir, topicPage.slug, permissive.lastCheck, 'topic');
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

  // Phase 6 (2026-07-20 amendment): the workspace pass tops the bottom-up
  // chain — folder indexes -> wiki root index -> workspace index. It runs at
  // the end of every ingest and reads only the freshly-written wiki root
  // contracts (never the wikis' content pages), so it always reflects the
  // just-written root index of this wiki plus the current contracts of every
  // other wiki in the workspace. Prose follows this run's output language.
  await writeWorkspaceIndex({
    workspace: options.workspace,
    doxLlm: options.doxLlm,
    writeWorkspaceIndexFn: options.writeWorkspaceIndexFn,
    outputLanguage: getLanguage(output).name,
    logPath: join(dir, '.state', 'llm-calls.json'),
  });
  progress('Workspace index updated.');

  // Phase 7: persist the run's input language for the next run's pre-selection
  // and slug-forking detection. The stored output language is NOT overwritten
  // by a per-run override — it stays the wiki's fixed setting (vision 04 §9.1).
  await writeWikiLanguage(dir, { outputLanguage: languageState.outputLanguage, lastInputLanguage: input });

  progress('Done!');
  return result;
}
