import { extractText } from '../src/extraction/pdf';

const full = await extractText('test-pdfs/golden-master.pdf');
console.log('=== FULL TEXT ===');
console.log(full);
console.log('=== CHECKS ===');
const checks = [
  'John Smith',
  'Acme Corp',
  'March 15, 2024',
  '$42.5 million',
  'Board Members',
  'Executive Summary',
  'Revenue by Quarter',
];
let allOk = true;
for (const c of checks) {
  const ok = full.includes(c);
  if (!ok) allOk = false;
  console.log(JSON.stringify(c), ok);
}
const p1 = await extractText('test-pdfs/golden-master.pdf', 1, 1);
console.log('page1 has John Smith:', p1.includes('John Smith'));
console.log('page1 has Board Members:', p1.includes('Board Members'));
const p3 = await extractText('test-pdfs/golden-master.pdf', 3, 3);
console.log('page3 has Board Members:', p3.includes('Board Members'));
if (!allOk || !p1.includes('John Smith') || p1.includes('Board Members')) {
  process.exit(1);
}
