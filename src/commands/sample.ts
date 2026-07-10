import { mkdirSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { buildConfig, loadConfig, type Config } from '../config.js';
import { ensureWikiExists, isInsideRawFolder, wikiPath, toRelativePath } from '../workspace.js';
import { extractPdf } from '../extractor/pdf.js';
import { CLIError } from '../errors.js';
import { analyzeAndChunk } from '../chunking/chunker.js';
import { writeChunkingStrategy } from '../chunking/strategy-writer.js';
import { writeWikiConfig } from '../writers/config.js';
import { writeDocumentPage } from '../writers/document.js';
import { writeSourcePage } from '../writers/source.js';
import { writeRawPage } from '../writers/raw.js';
import { writeAgentsMd } from '../writers/agents.js';
import { runSampleOrchestrator } from '../orchestrator/index.js';
import { classifyCorpus, type CorpusFileInfo } from '../orchestrator/sampling.js';
import { collectPageTypesPerFolder, updateAgentsMdForNewPageTypes } from '../orchestrator/proposals.js';
import { buildRunLog, writeRunLog } from '../log.js';
import { createLLMClient, type LLMCallRecord } from '../llm/client.js';
import type { ExtractionResult } from '../extractor/types.js';
import type { OrchestratorResult } from '../orchestrator/types.js';

export async function sampleCommand(
  workspace: string,
  slug: string,
  pdfPath?: string,
): Promise<number> {
  if (!slug) {
    throw new CLIError(
      'Please provide a wiki slug. ' +
        'Example: llm-wiki-cli sample acme',
    );
  }

  ensureWikiExists(workspace, slug);

  let resolvedPdfPath: string;
  let relativePdfPath: string;
  if (pdfPath) {
    if (!isInsideRawFolder(workspace, slug, pdfPath)) {
      throw new CLIError(
        `The PDF must be inside the wiki's raw folder: wikis/${slug}/raw/. ` +
        `Received: ${pdfPath}`,
      );
    }
    resolvedPdfPath = path.resolve(workspace, pdfPath);
    relativePdfPath = pdfPath;
  } else {
    resolvedPdfPath = await selectRepresentativePdf(workspace, slug);
    relativePdfPath = toRelativePath(workspace, resolvedPdfPath);
  }

  let config: Config;
  const wikiConfigPath = path.join(wikiPath(workspace, slug), 'config.json');
  if (existsSync(wikiConfigPath)) {
    config = loadConfig(workspace, slug);
  } else {
    config = buildConfig(workspace, slug);
  }

  const result = await extractPdf(resolvedPdfPath);
  result.filePath = toRelativePath(workspace, relativePdfPath);

  const otherFiles = await collectOtherPdfInfo(workspace, slug, resolvedPdfPath);
  const samplingStrategy = classifyCorpus(result, otherFiles, config);

  const { structure, strategy, chunks } = analyzeAndChunk(result, config, samplingStrategy);

  // Optional LLM enhancement: only metadata and extracted text are sent; raw PDFs are not.
  const llmClient = createLLMClient(workspace);
  let llmRecord: LLMCallRecord | undefined;
  if (llmClient.isEnabled()) {
    const prompt = buildSamplePrompt(result, structure, samplingStrategy);
    const llmResult = await llmClient.call(prompt);
    llmRecord = llmClient.toRecord(llmResult);
  }

  const wikiDir = wikiPath(workspace, slug);
  const outputDir = path.join(wikiDir, config.output.dir);
  const documentsDir = path.join(outputDir, 'documents');
  const sourcesDir = path.join(outputDir, 'sources');
  const rawDir = path.join(outputDir, 'raw');

  mkdirSync(documentsDir, { recursive: true });
  mkdirSync(sourcesDir, { recursive: true });
  mkdirSync(rawDir, { recursive: true });

  writeChunkingStrategy(
    path.join(wikiDir, 'chunking-strategy.md'),
    structure,
    strategy,
  );
  writeWikiConfig(workspace, slug, config, structure, strategy);

  const orchestratorResult = await runSampleOrchestrator(
    workspace,
    slug,
    config,
    result,
    chunks,
    llmClient,
    samplingStrategy,
  );

  await writeAgentsMd(
    path.join(wikiDir, 'AGENTS.md'),
    {
      slug,
      title: config.wiki.title,
      description: config.wiki.description,
      structure,
      samplingStrategy,
      folderPlacements: orchestratorResult.memory.state.folderHierarchy
        ? Object.values(orchestratorResult.memory.state.folderHierarchy)
        : undefined,
      memory: orchestratorResult.memory,
    },
    llmClient,
  );

  // Document any new page types discovered during sampling in the AGENTS.md guide.
  if (orchestratorResult.pages) {
    const pageTypesByFolder = collectPageTypesPerFolder(orchestratorResult.pages);
    const agentsMdPath = path.join(wikiDir, 'AGENTS.md');
    for (const [folder, types] of pageTypesByFolder) {
      updateAgentsMdForNewPageTypes(agentsMdPath, folder, Array.from(types));
    }
  }

  for (const chunk of chunks) {
    writeDocumentPage(
      path.join(documentsDir, `${chunk.id}.md`),
      chunk,
      config,
    );
  }

  const documentLinks = chunks.map((chunk) => ({ title: chunk.title, pageRange: chunk.pageRange }));
  const rawLinks = result.pages
    .filter((page) => page.isScanned)
    .map((page) => ({
      title: `Raw fragment: ${result.fileName}, page ${page.physicalPage}`,
      physicalPage: page.physicalPage,
    }));

  writeSourcePage(
    path.join(sourcesDir, `${path.basename(resolvedPdfPath, path.extname(resolvedPdfPath))}.md`),
    result,
    documentLinks,
    rawLinks,
    slug,
  );

  for (const page of result.pages) {
    if (page.isScanned) {
      writeRawPage(
        path.join(
          rawDir,
          `${path.basename(resolvedPdfPath, path.extname(resolvedPdfPath))}-page-${page.physicalPage}.md`,
        ),
        result,
        page,
        slug,
      );
    }
  }

  printSummary(
    slug,
    result,
    chunks,
    structure,
    samplingStrategy,
    orchestratorResult.wikiIndexPath,
    orchestratorResult.folderIndexes,
  );
  writeSampleRunLog(
    workspace,
    slug,
    result,
    chunks,
    orchestratorResult,
    samplingStrategy,
    llmRecord,
  );
  return 0;
}

function buildSamplePrompt(
  result: ExtractionResult,
  structure: { summary: string },
  samplingStrategy: { category: string; reason: string },
): string {
  return [
    'You are helping structure a PDF for a wiki.',
    `File: ${result.fileName}`,
    `Pages: ${result.physicalPages}`,
    `Title: ${result.metadata.title || 'unknown'}`,
    `Structure: ${structure.summary}`,
    `Sampling strategy: ${samplingStrategy.category}`,
    `Sampling reason: ${samplingStrategy.reason}`,
    'Provide a one-sentence scope summary for this wiki.',
  ].join('\n');
}

async function selectRepresentativePdf(workspace: string, slug: string): Promise<string> {
  const rawDir = path.join(wikiPath(workspace, slug), 'raw');
  if (!existsSync(rawDir)) {
    throw new CLIError(`No raw folder found for wiki "${slug}". Add PDFs to wikis/${slug}/raw/ first.`);
  }
  const entries = readdirSync(rawDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.pdf'))
    .map((e) => e.name)
    .sort();
  if (entries.length === 0) {
    throw new CLIError(`No PDFs found in wikis/${slug}/raw/. Add at least one PDF before sampling.`);
  }
  return path.join(rawDir, entries[0]);
}

async function collectOtherPdfInfo(
  workspace: string,
  slug: string,
  sampledPdfPath: string,
): Promise<CorpusFileInfo[]> {
  const rawDir = path.join(wikiPath(workspace, slug), 'raw');
  if (!existsSync(rawDir)) {
    return [];
  }
  const sampledBase = path.basename(sampledPdfPath).toLowerCase();
  const entries = readdirSync(rawDir, { withFileTypes: true });
  const others: CorpusFileInfo[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (path.extname(entry.name).toLowerCase() !== '.pdf') continue;
    if (entry.name.toLowerCase() === sampledBase) continue;
    const otherPath = path.join(rawDir, entry.name);
    try {
      const otherResult = await extractPdf(otherPath);
      others.push({
        fileName: entry.name,
        pageCount: otherResult.physicalPages,
        metadata: otherResult.metadata,
      });
    } catch {
      // Skip files that cannot be parsed for classification purposes.
    }
  }
  return others;
}

function writeSampleRunLog(
  workspace: string,
  slug: string,
  result: ExtractionResult,
  chunks: { id: string; title: string; pageRange: string; content: string }[],
  orchestratorResult: OrchestratorResult,
  samplingStrategy: { category: string; reason: string },
  llmRecord?: LLMCallRecord,
): void {
  const log = buildRunLog('sample', workspace, {
    wikiSlugs: [slug],
    sourceFiles: [result.filePath],
    chunkBoundaries: chunks.map((chunk) => ({
      source: result.filePath,
      boundary: 'page',
      pageRange: chunk.pageRange,
    })),
    pagesGenerated: [
      { type: 'document', count: chunks.length },
      { type: 'source', count: 1 },
      { type: 'raw', count: result.pages.filter((p) => p.isScanned).length },
      { type: 'index', count: 1 + orchestratorResult.folderIndexes.length },
    ],
    warnings: result.warnings,
    errors: orchestratorResult.critic.issues.map((i) => i.message),
    status: 'success',
    llmCalls: llmRecord ? [llmRecord] : [],
    samplingStrategy: {
      category: samplingStrategy.category,
      reason: samplingStrategy.reason,
    },
  });
  writeRunLog(workspace, log);
}

function printSummary(
  slug: string,
  result: ExtractionResult,
  chunks: { title: string; belowMin: boolean }[],
  structure: { scannedPages: number[] },
  samplingStrategy: { category: string; reason: string },
  wikiIndexPath: string,
  folderIndexes: string[],
): void {
  console.log(`Sample ingestion complete for wiki "${slug}".`);
  console.log(`Source PDF: ${result.fileName}`);
  console.log(`  Pages: ${result.physicalPages}`);
  console.log(`  Sampling strategy: ${samplingStrategy.category}`);
  console.log(`  Strategy reason: ${samplingStrategy.reason}`);
  console.log(`  Document chunks: ${chunks.length}`);
  if (structure.scannedPages.length > 0) {
    console.log(`  Scanned pages preserved as raw pages: ${structure.scannedPages.join(', ')}`);
  }
  const smallChunks = chunks.filter((c) => c.belowMin).length;
  if (smallChunks > 0) {
    console.log(`  Small chunks flagged (below minimum size): ${smallChunks}`);
  }
  console.log('');
  console.log('Artifacts created:');
  console.log('  - chunking-strategy.md');
  console.log('  - AGENTS.md');
  console.log(`  - ${wikiIndexPath}`);
  for (const folderIndex of folderIndexes) {
    console.log(`  - ${folderIndex}`);
  }
  console.log('  - config.json');
  console.log(`  - ${chunks.length} document page(s) in documents/`);
  console.log('  - 1 source page in sources/');
  if (result.pages.some((p) => p.isScanned)) {
    console.log('  - raw page(s) in raw/ for scanned pages');
  }
  console.log('');
  console.log('You can review the chunking strategy, then run full ingestion with:');
  console.log(`  llm-wiki-cli ingest ${slug}`);
}
