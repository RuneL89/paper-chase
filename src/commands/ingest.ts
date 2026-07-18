import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';
import { extractText, getPageCount } from '../extraction/pdf';
import { renderTablesAsMarkdown } from '../extraction/markdown-tables';
import { sha256 } from '../utils/hash';
import { sourceSlugForFile } from '../utils/slug';
import { sourcePdfPath, wikiDir, wikiRelativePath } from '../utils/paths';
import { readIngestionState, writeIngestionState } from '../state/ingestion-state';
import { writeSourcePage } from '../pages/source-page';
import { extractDocumentChunk, type ChunkExtraction } from './extract-chunk';
import { materialize, type MaterializeResult } from '../materializer';
import { writeDoxContracts } from '../dox-writer';
import { validateWiki, logValidation, type ValidationSummary } from '../validation';
import {
  writeEntitySynthesis,
  writePermissiveEntitySynthesis,
  writeTopicSynthesis,
  writePermissiveTopicSynthesis,
  writeDocumentSynthesis,
  writePermissiveDocumentSynthesis,
} from '../agents/synthesis';
import { checkPreservation, checkTopicPreservation, checkDocumentPreservation } from '../validation/preservation-check';
import { logConflict } from '../state/conflicts';
import { logSynthesisReport } from '../state/synthesis-report';
import type { EntityPageData } from '../pages/entity-page';
import type { TopicPageData } from '../pages/topic-page';
import type { DocumentPageData } from '../pages/document-page';

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
  ) => Promise<string>;
  /**
   * Injectable permissive synthesis implementation (test-only). Defaults to the
   * real permissive Synthesis Writer; tests can inject a deterministic stub.
   */
  synthesizeEntityPermissiveFn?: (
    entityData: EntityPageData,
    agentsMd: string,
    logPath?: string,
  ) => Promise<string>;
  /**
   * Injectable topic synthesis implementation (test-only). Defaults to the real
   * topic Synthesis Writer; tests can inject a deterministic stub.
   */
  synthesizeTopicFn?: (
    topicData: TopicPageData,
    agentsMd: string,
    logPath?: string,
  ) => Promise<string>;
  /**
   * Injectable permissive topic synthesis implementation (test-only). Defaults to
   * the real permissive topic Synthesis Writer; tests can inject a deterministic stub.
   */
  synthesizeTopicPermissiveFn?: (
    topicData: TopicPageData,
    agentsMd: string,
    logPath?: string,
  ) => Promise<string>;
  /**
   * Injectable document synthesis implementation (test-only). Defaults to the real
   * document Synthesis Writer; tests can inject a deterministic stub.
   */
  synthesizeDocumentFn?: (
    documentData: DocumentPageData,
    agentsMd: string,
    logPath?: string,
  ) => Promise<string>;
  /**
   * Injectable permissive document synthesis implementation (test-only). Defaults
   * to the real permissive document Synthesis Writer; tests can inject a deterministic stub.
   */
  synthesizeDocumentPermissiveFn?: (
    documentData: DocumentPageData,
    agentsMd: string,
    logPath?: string,
  ) => Promise<string>;
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
  /** Phase 5: number of entity pages successfully synthesized. */
  synthesized?: number;
  /** Phase 5: number of entity pages successfully synthesized using the permissive fallback. */
  synthesizedPermissive?: number;
  /** Phase 5: number of topic pages successfully synthesized. */
  synthesizedTopics?: number;
  /** Phase 5: number of topic pages successfully synthesized using the permissive fallback. */
  synthesizedTopicsPermissive?: number;
  /** Phase 5: number of document pages successfully synthesized. */
  synthesizedDocuments?: number;
  /** Phase 5: number of document pages successfully synthesized using the permissive fallback. */
  synthesizedDocumentsPermissive?: number;
  /** Phase 5: number of pages where preservation check failed. */
  synthesisConflicts?: number;
}

const DEFAULT_PAGES_PER_CHUNK = 5;

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
 * Phase 5: after materialization and validation, if `synthesis` is true, the
 * Synthesis Writer runs per entity page, replacing the structured template with
 * a synthesized two-layer page only when the preservation check passes.
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
    synthesizedDocuments: 0,
    synthesizedDocumentsPermissive: 0,
    synthesisConflicts: 0,
  };

  if (pdfFiles.length === 0) {
    progress(`No PDFs found in wikis/${slug}/raw/.`);
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
      const frontmatter = {
        title: `${sourceSlug}-part-${part}`,
        type: 'document',
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
        const run = options.extractChunkFn ?? extractDocumentChunk;
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

  // Phase 4: deterministic quality gate after materialization. Runs whenever
  // extraction was requested so the TUI and CLI always report link, citation,
  // and schema health at the end of an ingest.
  if (extract) {
    const validation = await validateWiki(slug, options.workspace);
    logValidation(validation, dir);
    result.validation = validation;
  }

  // Phase 5: optional synthesis after validation and before DOX contracts.
  // Order: entities first, then topics, then documents.
  if (extract && synthesis && lastMaterializeResult) {
    const agentsMd = loadAgentsMd(dir);
    const llmLogPath = join(dir, '.state', 'llm-calls.json');
    const runEntitySynthesis = options.synthesizeEntityFn ?? writeEntitySynthesis;
    const runEntityPermissiveSynthesis =
      options.synthesizeEntityPermissiveFn ?? writePermissiveEntitySynthesis;
    const runTopicSynthesis = options.synthesizeTopicFn ?? writeTopicSynthesis;
    const runTopicPermissiveSynthesis =
      options.synthesizeTopicPermissiveFn ?? writePermissiveTopicSynthesis;
    const runDocumentSynthesis = options.synthesizeDocumentFn ?? writeDocumentSynthesis;
    const runDocumentPermissiveSynthesis =
      options.synthesizeDocumentPermissiveFn ?? writePermissiveDocumentSynthesis;

    // 1. Entity synthesis
    const entityCount = lastMaterializeResult.entityPages.length;
    if (entityCount > 0) {
      progress(`Writing synthesis for ${entityCount} entity page(s)...`);
    }

    for (const entityPage of lastMaterializeResult.entityPages) {
      // First attempt: strict synthesis (readable prose that preserves exact
      // mention/relationship/claim strings).
      const synthesized = await runEntitySynthesis(entityPage, agentsMd, llmLogPath);
      const check = checkPreservation(entityPage, synthesized);
      if (check.passed) {
        const folderPath = join(dir, entityPage.folder);
        await writeFile(join(folderPath, `${entityPage.slug}.md`), synthesized, 'utf-8');
        result.synthesized = (result.synthesized ?? 0) + 1;
        await logSynthesisReport(dir, {
          timestamp: new Date().toISOString(),
          slug: entityPage.slug,
          strict: { attempted: true, passed: true },
          permissive: { attempted: false, passed: false },
          finalMode: 'strict-synthesis',
        });
        continue;
      }

      // Fallback: permissive synthesis (prose summary + verbatim structured data).
      console.warn(
        `Strict synthesis failed preservation for ${entityPage.slug}. Trying permissive fallback.`,
      );
      const permissive = await runEntityPermissiveSynthesis(entityPage, agentsMd, llmLogPath);
      const permissiveCheck = checkPreservation(entityPage, permissive);
      if (permissiveCheck.passed) {
        const folderPath = join(dir, entityPage.folder);
        await writeFile(join(folderPath, `${entityPage.slug}.md`), permissive, 'utf-8');
        result.synthesizedPermissive = (result.synthesizedPermissive ?? 0) + 1;
        await logSynthesisReport(dir, {
          timestamp: new Date().toISOString(),
          slug: entityPage.slug,
          strict: { attempted: true, passed: false },
          permissive: { attempted: true, passed: true },
          finalMode: 'permissive-synthesis',
        });
      } else {
        console.warn(
          `Permissive synthesis also failed preservation for ${entityPage.slug}. Keeping structured template.`,
        );
        await logConflict(dir, entityPage.slug, permissiveCheck);
        result.synthesisConflicts = (result.synthesisConflicts ?? 0) + 1;
        await logSynthesisReport(dir, {
          timestamp: new Date().toISOString(),
          slug: entityPage.slug,
          strict: { attempted: true, passed: false },
          permissive: { attempted: true, passed: false },
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
      const synthesized = await runTopicSynthesis(topicPage, agentsMd, llmLogPath);
      const check = checkTopicPreservation(topicPage, synthesized);
      if (check.passed) {
        const folderPath = join(dir, topicPage.folder);
        await writeFile(join(folderPath, `${topicPage.slug}.md`), synthesized, 'utf-8');
        result.synthesizedTopics = (result.synthesizedTopics ?? 0) + 1;
        await logSynthesisReport(dir, {
          timestamp: new Date().toISOString(),
          slug: topicPage.slug,
          strict: { attempted: true, passed: true },
          permissive: { attempted: false, passed: false },
          finalMode: 'strict-synthesis',
        });
        continue;
      }

      console.warn(
        `Strict synthesis failed preservation for topic ${topicPage.slug}. Trying permissive fallback.`,
      );
      const permissive = await runTopicPermissiveSynthesis(topicPage, agentsMd, llmLogPath);
      const permissiveCheck = checkTopicPreservation(topicPage, permissive);
      if (permissiveCheck.passed) {
        const folderPath = join(dir, topicPage.folder);
        await writeFile(join(folderPath, `${topicPage.slug}.md`), permissive, 'utf-8');
        result.synthesizedTopicsPermissive = (result.synthesizedTopicsPermissive ?? 0) + 1;
        await logSynthesisReport(dir, {
          timestamp: new Date().toISOString(),
          slug: topicPage.slug,
          strict: { attempted: true, passed: false },
          permissive: { attempted: true, passed: true },
          finalMode: 'permissive-synthesis',
        });
      } else {
        console.warn(
          `Permissive synthesis also failed preservation for topic ${topicPage.slug}. Keeping structured template.`,
        );
        await logConflict(dir, topicPage.slug, permissiveCheck);
        result.synthesisConflicts = (result.synthesisConflicts ?? 0) + 1;
        await logSynthesisReport(dir, {
          timestamp: new Date().toISOString(),
          slug: topicPage.slug,
          strict: { attempted: true, passed: false },
          permissive: { attempted: true, passed: false },
          finalMode: 'structured-template',
        });
      }
    }

    // 3. Document synthesis
    const documentCount = lastMaterializeResult.documentPages.length;
    if (documentCount > 0) {
      progress(`Writing synthesis for ${documentCount} document page(s)...`);
    }

    for (const documentPage of lastMaterializeResult.documentPages) {
      const synthesized = await runDocumentSynthesis(documentPage, agentsMd, llmLogPath);
      const check = checkDocumentPreservation(documentPage, synthesized);
      if (check.passed) {
        const folderPath = join(dir, documentPage.folder);
        await writeFile(join(folderPath, `${documentPage.slug}.md`), synthesized, 'utf-8');
        result.synthesizedDocuments = (result.synthesizedDocuments ?? 0) + 1;
        await logSynthesisReport(dir, {
          timestamp: new Date().toISOString(),
          slug: documentPage.slug,
          strict: { attempted: true, passed: true },
          permissive: { attempted: false, passed: false },
          finalMode: 'strict-synthesis',
        });
        continue;
      }

      console.warn(
        `Strict synthesis failed preservation for document ${documentPage.slug}. Trying permissive fallback.`,
      );
      const permissive = await runDocumentPermissiveSynthesis(documentPage, agentsMd, llmLogPath);
      const permissiveCheck = checkDocumentPreservation(documentPage, permissive);
      if (permissiveCheck.passed) {
        const folderPath = join(dir, documentPage.folder);
        await writeFile(join(folderPath, `${documentPage.slug}.md`), permissive, 'utf-8');
        result.synthesizedDocumentsPermissive = (result.synthesizedDocumentsPermissive ?? 0) + 1;
        await logSynthesisReport(dir, {
          timestamp: new Date().toISOString(),
          slug: documentPage.slug,
          strict: { attempted: true, passed: false },
          permissive: { attempted: true, passed: true },
          finalMode: 'permissive-synthesis',
        });
      } else {
        console.warn(
          `Permissive synthesis also failed preservation for document ${documentPage.slug}. Keeping structured template.`,
        );
        await logConflict(dir, documentPage.slug, permissiveCheck);
        result.synthesisConflicts = (result.synthesisConflicts ?? 0) + 1;
        await logSynthesisReport(dir, {
          timestamp: new Date().toISOString(),
          slug: documentPage.slug,
          strict: { attempted: true, passed: false },
          permissive: { attempted: true, passed: false },
          finalMode: 'structured-template',
        });
      }
    }
  }

  await writeDoxContracts(slug, { workspace: options.workspace });
  progress('DOX contracts updated.');

  progress('Done!');
  return result;
}
