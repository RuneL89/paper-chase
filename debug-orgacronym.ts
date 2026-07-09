import { isOrganizationAcronym } from './src/orchestrator/agents.js';

const text = `U.S. National Library of Medicine
(NLM) and National Center for Biotechnology Information (NCBI). National Institutes of Health (NIH).`;

console.log('NLM:', isOrganizationAcronym('NLM', text));
console.log('NCBI:', isOrganizationAcronym('NCBI', text));
console.log('NIH:', isOrganizationAcronym('NIH', text));

// Also test from actual chunk if possible
const fs = await import('fs');
const path = 'C:/temp/wiki-uat-sprint-05/wikis/pubmed/documents/index.md';
if (fs.existsSync(path)) {
  const chunkText = fs.readFileSync(path, 'utf8');
  console.log('NLM in chunk:', isOrganizationAcronym('NLM', chunkText));
}
