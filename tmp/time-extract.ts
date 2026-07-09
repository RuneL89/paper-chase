import { extractPdf } from '../src/extractor/pdf.js';
const start = Date.now();
const result = await extractPdf('C:/Users/atavi/Documents/NIB-annual-report.pdf');
const elapsed = (Date.now() - start) / 1000;
console.log(`Extracted ${result.physicalPages} pages in ${elapsed.toFixed(1)}s`);
console.log(`Scanned pages: ${result.pages.filter(p => p.isScanned).length}`);
console.log(`Tables: ${result.tables.length}, Figures: ${result.figures.length}`);
