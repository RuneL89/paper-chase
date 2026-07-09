import { extractPdf } from '../src/extractor/pdf.js';
import { analyzeAndChunk } from '../src/chunking/chunker.js';
import { buildConfig, loadConfig } from '../src/config.js';
import { createLLMClient } from '../src/llm/client.js';
import { runIngestOrchestrator } from '../src/orchestrator/ingest.js';

const workspace = 'C:/temp/llm-wiki-workspace-sprint5-e2e';
const slug = 'nib-annual-report';

const start = Date.now();
const llmClient = createLLMClient(workspace);
const config = buildConfig(workspace, slug, loadConfig(workspace, slug));

const result = await extractPdf(`${workspace}/wikis/${slug}/raw/NIB-annual-report.pdf`);
const extractionDone = Date.now();
console.log(`Extraction: ${((extractionDone - start) / 1000).toFixed(1)}s`);

const { chunks } = analyzeAndChunk(result, config);
const chunkingDone = Date.now();
console.log(`Chunking: ${chunks.length} chunks in ${((chunkingDone - extractionDone) / 1000).toFixed(1)}s`);

await runIngestOrchestrator(workspace, slug, config, result, chunks, llmClient, undefined, undefined);
const orchestratorDone = Date.now();
console.log(`Orchestrator total: ${((orchestratorDone - chunkingDone) / 1000).toFixed(1)}s`);
console.log(`Total: ${((orchestratorDone - start) / 1000).toFixed(1)}s`);
