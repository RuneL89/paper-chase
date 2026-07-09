import { entityExtractor } from './src/orchestrator/agents.js';
import { LLMClient } from './src/llm/client.js';
import { DEFAULT_LLM_CONFIG } from './src/llm/types.js';

function makeChunk() {
  return {
    id: 'annual-report-part-001',
    title: 'Part 1: annual-report',
    pageRange: '1',
    boundaryType: 'page',
    content: 'Annual report page one. Acme Corp reported record earnings for the fiscal year and announced plans for market expansion. Acme Corp and Globex Inc are strategic partners.',
    sources: [{ id: 'src1', file: 'wikis/acme/raw/annual-report.pdf', pages: '1', extracted: '2026-07-08T00:00:00.000Z', sha256: 'a'.repeat(64) }],
    tags: ['document'],
    belowMin: false,
    charCount: 58,
  };
}

function makeExtractionResult() {
  return {
    fileName: 'annual-report.pdf',
    filePath: 'wikis/acme/raw/annual-report.pdf',
    physicalPages: 1,
    logicalPages: 1,
    metadata: { title: 'Annual Report' },
    pages: [{
      physicalPage: 1,
      logicalPage: 1,
      text: 'Annual report page one. Acme Corp reported record earnings alongside Globex Inc. Acme Corp and Globex Inc are partners.',
      isScanned: false,
      estimatedHeadings: ['Annual Report'],
    }],
    tables: [],
    figures: [],
    warnings: [],
    ingested: '2026-07-08T00:00:00.000Z',
  };
}

function makeClient(json: unknown) {
  return new LLMClient(
    { ...DEFAULT_LLM_CONFIG, enabled: true, provider: 'openai', model: 'gpt-4o', apiKey: 'test' },
    async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify(json) } }] }),
      json: async () => ({ choices: [{ message: { content: JSON.stringify(json) } }] }),
    }) as unknown as typeof fetch,
  );
}

const llmJson = {
  entities: [{
    name: 'Acme Corporation',
    canonical: 'acme-corp',
    aliases: ['Acme Corp'],
    type: 'organization',
    count: 2,
    mentions: [{ page: 1, context: 'Acme Corp reported record earnings.' }],
    confidence: 0.9,
  }],
};

const r = await entityExtractor(makeExtractionResult(), [makeChunk()], makeClient(llmJson));
console.log('entities:', r.entities.length);
for (const e of r.entities) console.log('name:', e.name, 'canonical:', e.canonical, 'aliases:', e.aliases, 'conf:', e.confidence);
