import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const FIXTURES_DIR = __dirname;

export function fixturePath(name: string): string {
  return path.join(FIXTURES_DIR, name);
}

export async function createTextPdf(
  fileName: string,
  pages: { header: string; body: string }[],
): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const page of pages) {
    const pdfPage = pdfDoc.addPage([612, 792]);
    pdfPage.drawText(page.header, { x: 50, y: 720, size: 18, font });
    pdfPage.drawText(page.body, { x: 50, y: 680, size: 12, font });
  }

  const filePath = fixturePath(fileName);
  const pdfBytes = await pdfDoc.save();
  writeFileSync(filePath, pdfBytes);
  return filePath;
}

export async function createFivePagePdf(): Promise<string> {
  return createTextPdf('five-page.pdf', [
    { header: 'Page 1', body: 'This is the first page of the five page document.' },
    { header: 'Page 2', body: 'This is the second page of the five page document.' },
    { header: 'Page 3', body: 'This is the third page of the five page document.' },
    { header: 'Page 4', body: 'This is the fourth page of the five page document.' },
    { header: 'Page 5', body: 'This is the fifth page of the five page document.' },
  ]);
}

export async function createHundredPagePdf(): Promise<string> {
  const pages: { header: string; body: string }[] = [];
  for (let i = 1; i <= 100; i++) {
    pages.push({
      header: `Page ${i}`,
      body: `This is page ${i} of the one hundred page performance test document.`,
    });
  }
  return createTextPdf('hundred-page.pdf', pages);
}

export async function createTablePdf(): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pdfPage = pdfDoc.addPage([612, 792]);

  pdfPage.drawText('Quarterly Revenue', { x: 50, y: 720, size: 18, font });

  const rows = [
    ['Q1', '$10000'],
    ['Q2', '$15000'],
    ['Q3', '$12000'],
  ];

  let y = 680;
  for (const row of rows) {
    pdfPage.drawText(row[0], { x: 50, y, size: 12, font });
    pdfPage.drawText(row[1], { x: 150, y, size: 12, font });
    y -= 20;
  }

  const filePath = fixturePath('table.pdf');
  const pdfBytes = await pdfDoc.save();
  writeFileSync(filePath, pdfBytes);
  return filePath;
}

export async function createScannedPdf(): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);

  // Draw a filled rectangle to simulate a scanned image with no selectable text.
  page.drawRectangle({
    x: 50,
    y: 50,
    width: 512,
    height: 692,
    color: rgb(0.9, 0.9, 0.9),
  });

  const filePath = fixturePath('scanned.pdf');
  const pdfBytes = await pdfDoc.save();
  writeFileSync(filePath, pdfBytes);
  return filePath;
}

export async function createTextPdfInDir(
  dir: string,
  fileName: string,
  pages: { header: string; body: string }[],
): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const page of pages) {
    const pdfPage = pdfDoc.addPage([612, 792]);
    pdfPage.drawText(page.header, { x: 50, y: 720, size: 18, font });
    pdfPage.drawText(page.body, { x: 50, y: 680, size: 12, font });
  }

  const filePath = path.join(dir, fileName);
  const pdfBytes = await pdfDoc.save();
  writeFileSync(filePath, pdfBytes);
  return filePath;
}

export function createMalformedPdf(): string {
  const filePath = fixturePath('malformed.pdf');
  writeFileSync(filePath, Buffer.from('This is not a valid PDF file.\n%PDF-broken'));
  return filePath;
}
