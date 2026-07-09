import {
  pagePlanner,
  structureAnalyst,
  entityExtractor,
  evidenceCollector,
} from './src/orchestrator/agents.js';
import { LLMClient } from './src/llm/client.js';

const chunk = {
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

const extractionResult = {
  fileName: 'annual-report.pdf',
  filePath: 'wikis/acme/raw/annual-report.pdf',
  physicalPages: 1,
  logicalPages: 1,
  metadata: { title: 'Annual Report' },
  pages: [{ physicalPage: 1, logicalPage: 1, text: 'Annual report page one. Acme Corp reported record earnings alongside Globex Inc. Acme Corp and Globex Inc are partners.', isScanned: false, estimatedHeadings: ['Annual Report'] }],
  tables: [],
  figures: [],
  warnings: [],
  ingested: '2026-07-08T00:00:00.000Z',
};

const disabledClient = new LLMClient({ provider: 'test', model: 'test', apiKey: '', baseUrl: '' });

const structure = await structureAnalyst(extractionResult, [chunk], disabledClient);
const entities = (await entityExtractor(extractionResult, [chunk], disabledClient)).entities;
const evidence = await evidenceCollector(extractionResult, [chunk], disabledClient);

const llmJson = {
  pages: [
    {
      pageType: 'topic',
      title: 'Topic: Earnings Growth',
      fileName: 'earnings-growth.md',
      folder: 'topics',
      tags: ['topic'],
      citations: ['src1'],
      wikilinks: [],
      related: [],
    },
  ],
  folderPlacements: [
    { folder: 'documents', title: 'Documents', description: '', pageTypes: ['document'], children: [] },
    { folder: 'topics', title: 'Topics', description: '', pageTypes: ['topic'], children: [] },
  ],
  wikilinks: [],
  citations: ['src1'],
  discovery: { existingDocument: true, newEntities: false, newTopics: true, hasTablesFigures: false, rawPages: false, newPageType: false },
};

const client = new LLMClient({ provider: 'test', model: 'test', apiKey: '', baseUrl: '' });
// @ts-expect-error override call
client.call = async () => ({ text: JSON.stringify(llmJson), model: 'test', usage: {} });

const result = await pagePlanner(extractionResult, structure, entities, evidence, client);
console.log('pages:', result.pages.map((p) => `${p.pageType}: ${p.title}`));
console.log('topic:', result.pages.find((p) => p.pageType === 'topic'));
