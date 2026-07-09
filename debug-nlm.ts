import { readFileSync } from 'fs';
const text = readFileSync('C:/temp/wiki-uat-sprint-05/wikis/pubmed/documents/pubmed_intro-part-001.md', 'utf-8');
const idx = text.indexOf('(NLM)');
console.log('idx', idx);
console.log(JSON.stringify(text.slice(idx - 80, idx + 10)));
