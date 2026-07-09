import { extractEntities } from './src/entities/index.js';

const text = 'PubMed is a free resource developed and maintained by the National Center for Biotechnology Information (NCBI), a division of the U.S. National Library of Medicine (NLM), at the National Institutes of Health (NIH).';
const entities = extractEntities(text, { max: 20 });
console.log(entities);
