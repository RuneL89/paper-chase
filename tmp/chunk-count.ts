import { extractPdf } from '../src/extractor/pdf.js';
import { analyzeAndChunk } from '../src/chunking/chunker.js';
import { defaultConfig } from '../src/config.js';
const start = Date.now();
const result = await extractPdf('C:/Users/atavi/Documents/NIB-annual-report.pdf');
const { chunks } = analyzeAndChunk(result, defaultConfig);
const elapsed = (Date.now() - start) / 1000;
console.log(`Extracted ${result.physicalPages} pages in ${elapsed.toFixed(1)}s`);
console.log(`Chunks: ${chunks.length}`);
for (const c of chunks) {
  console.log(`  ${c.id}: ${c.pageRange} (${c.charCount} chars, ${c.boundaryType})`);
}
