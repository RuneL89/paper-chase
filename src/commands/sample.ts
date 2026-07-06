import { mkdirSync, existsSync } from 'fs';
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
import { runSampleOrchestrator } from '../orchestrator/index.js';
import { buildRunLog, writeRunLog } from '../log.js';
import { createLLMClient, type LLMCallRecord } from '../llm/client.js';
import type { ExtractionResult } from '../extractor/types.js';
import type { OrchestratorResult } from '../orchestrator/types.js';

export async function sampleCommand(
  workspace: string,
  slug: string,
  pdfPath: string,
): Promise<number> {
  if (!slug || !pdfPath) {
    throw new CLIError(
      'Please provide a wiki slug and a path to a PDF. ' +
        'Example: llm-wiki-cli sample acme wikis/acme/raw/annual-report.pdf',
    );
  }

  ensureWikiExists(workspace, slug);

  if (!isInsideRawFolder(workspace, slug, pdfPath)) {
    throw new CLIError(
      `The PDF must be inside the wiki's raw folder: wikis/${slug}/raw/. ` +
      `Received: ${pdfPath}`,
    );
  }

  const resolvedPdfPath = path.resolve(workspace, pdfPath);

  let config: Config;
  const wikiConfigPath = path.join(wikiPath(workspace, slug), 'config.json');
  if (existsSync(wikiConfigPath)) {
    config = loadConfig(workspace, slug);
  } else {
    config = buildConfig(workspace, slug);
  }

  const result = await extractPdf(resolvedPdfPath);
  result.filePath = toRelativePath(workspace, pdfPath);
  const { structure, strategy, chunks } = analyzeAndChunk(result, config);

  // Optional LLM enhancement: only metadata and extracted text are sent; raw PDFs are not.
  const llmClient = createLLMClient(workspace);
  let llmRecord: LLMCallRecord | undefined;
  if (llmClient.isEnabled()) {
    const prompt = buildSamplePrompt(result, structure);
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
  );

  for (const chunk of chunks) {
    writeDocumentPage(
      path.join(documentsDir, `${chunk.id}.md`),
      chunk,
      config,
    );
  }

  writeSourcePage(path.join(sourcesDir, `${path.basename(resolvedPdfPath, path.extname(resolvedPdfPath))}.md`), result);

  for (const page of result.pages) {
    if (page.isScanned) {
      writeRawPage(
        path.join(
          rawDir,
          `${path.basename(resolvedPdfPath, path.extname(resolvedPdfPath))}-page-${page.physicalPage}.md`,
        ),
        result,
        page,
      );
    }
  }

  printSummary(slug, result, chunks, structure, orchestratorResult.wikiIndexPath, orchestratorResult.folderIndexes);
  writeSampleRunLog(workspace, slug, result, chunks, orchestratorResult, llmRecord);
  return 0;
}

function buildSamplePrompt(result: ExtractionResult, structure: { summary: string }): string {
  return [
    'You are helping structure a PDF for a wiki.',
    `File: ${result.fileName}`,
    `Pages: ${result.physicalPages}`,
    `Title: ${result.metadata.title || 'unknown'}`,
    `Structure: ${structure.summary}`,
    'Provide a one-sentence scope summary for this wiki.',
  ].join('\n');
}

function writeSampleRunLog(
  workspace: string,
  slug: string,
  result: ExtractionResult,
  chunks: { id: string; title: string; pageRange: string; content: string }[],
  orchestratorResult: OrchestratorResult,
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
  });
  writeRunLog(workspace, log);
}

function printSummary(
  slug: string,
  result: ExtractionResult,
  chunks: { title: string; belowMin: boolean }[],
  structure: { scannedPages: number[] },
  wikiIndexPath: string,
  folderIndexes: string[],
): void {
  console.log(`Sample ingestion complete for wiki "${slug}".`);
  console.log(`Source PDF: ${result.fileName}`);
  console.log(`  Pages: ${result.physicalPages}`);
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
  console.log(`  - ${wikiIndexPath}`);
  for (const folderIndex of folderIndexes) {
    console.log(`  - ${folderIndex}`);
  }
  console.log('  - config.json');
  console.log(`  - ${chunks.length} document page(s) in output/documents/`);
  console.log('  - 1 source page in output/sources/');
  if (result.pages.some((p) => p.isScanned)) {
    console.log('  - raw page(s) in output/raw/ for scanned pages');
  }
  console.log('');
  console.log('You can review the chunking strategy, then run full ingestion with:');
  console.log(`  llm-wiki-cli ingest ${slug}`);
}
