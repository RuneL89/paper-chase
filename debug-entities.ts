import { readFileSync } from 'fs';
import { extractEntities } from './src/entities/index.js';

const content = readFileSync('C:/temp/wiki-uat-sprint-05/wikis/pubmed/documents/pubmed_intro-part-001.md', 'utf-8');
// Use the preserved extracted detail section, which is closest to raw text.
const detailStart = content.indexOf('## Preserved Extracted Detail');
const text = detailStart >= 0 ? content.slice(detailStart) : content;

const entities = extractEntities(text, { max: 50 });
console.log('Fallback entities:', entities.length);
for (const e of entities) {
  console.log(e.name, '|', e.type, '|', e.count);
}
