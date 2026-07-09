import { readFileSync } from 'fs';
const text = readFileSync('C:/temp/wiki-uat-sprint-05/wikis/pubmed/documents/pubmed_intro-part-001.md', 'utf-8');
const names = ['NLM', 'NCBI', 'NIH', 'LSTRC', 'PMC'];
for (const name of names) {
  const pattern = new RegExp(`\\b[A-Z][a-zA-Z\\s]+ \\(${name}\\)`, 'g');
  const matches = text.match(pattern);
  console.log(name, 'matches:', matches);
}
