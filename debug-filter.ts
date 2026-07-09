import { readFileSync } from 'fs';
import { entityExtractor } from './src/orchestrator/agents.js';
import { LLMClient } from './src/llm/client.js';
import { DEFAULT_LLM_CONFIG } from './src/llm/types.js';
import type { Chunk } from './src/chunking/types.js';
import type { ExtractionResult } from './src/extractor/types.js';

const content = readFileSync('C:/temp/wiki-uat-sprint-05/wikis/pubmed/documents/pubmed_intro-part-001.md', 'utf-8');
const detailStart = content.indexOf('## Preserved Extracted Detail');
const text = detailStart >= 0 ? content.slice(detailStart) : content;

const chunk: Chunk = {
  id: 'pubmed-intro-part-001',
  title: 'Part 1: PubMed Intro',
  pageRange: '1-2',
  boundaryType: 'page',
  content: text,
  sources: [],
  tags: ['document'],
  belowMin: false,
  charCount: text.length,
};

const result: ExtractionResult = {
  fileName: 'pubmed_intro.pdf',
  filePath: 'wikis/pubmed/raw/pubmed_intro.pdf',
  physicalPages: 12,
  logicalPages: 12,
  metadata: { title: 'PubMed: The Bibliographic Database' },
  pages: [{ physicalPage: 1, logicalPage: 1, text, isScanned: false, estimatedHeadings: ['PubMed: The Bibliographic Database'] }],
  tables: [],
  figures: [],
  warnings: [],
  ingested: new Date().toISOString(),
};

const client = new LLMClient({ ...DEFAULT_LLM_CONFIG, enabled: false });

const output = await entityExtractor(result, [chunk], client);
console.log('Filtered fallback entities:', output.entities.length);
for (const e of output.entities) {
  console.log(e.name, '|', e.type, '|', e.count, '| aliases:', e.aliases.join(', '));
}
