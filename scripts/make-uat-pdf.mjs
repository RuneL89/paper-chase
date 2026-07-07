import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFileSync } from 'fs';

const pdfDoc = await PDFDocument.create();
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

for (let i = 1; i <= 5; i++) {
  const page = pdfDoc.addPage([612, 792]);
  page.drawText('Annual Report', { x: 50, y: 720, size: 18, font });
  page.drawText(`Page ${i} — This is a test page for the Sprint 2 UAT.`, { x: 50, y: 680, size: 12, font });
  page.drawText('Revenue increased year over year, supported by strong performance across all regions.', { x: 50, y: 660, size: 12, font });
}

const pdfBytes = await pdfDoc.save();
writeFileSync(process.argv[2] ?? 'annual-report.pdf', pdfBytes);
console.log('Created 5-page UAT PDF at', process.argv[2] ?? 'annual-report.pdf');
