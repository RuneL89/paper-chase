/**
 * Generates test-pdfs/golden-master.pdf — the 3-page control document for the
 * whole project. Run once with: npx tsx scripts/create-golden-master.ts
 *
 * This PDF must never change after it is committed. Every word on every page
 * is known and asserted by the infrastructure tests (Gates 0.1 / 0.2).
 */
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const PAGE_WIDTH = 612; // US Letter
const PAGE_HEIGHT = 792;
const MARGIN = 72;
const BODY_SIZE = 12;
const HEADING_SIZE = 18;
const LINE_HEIGHT = 16;

async function main(): Promise<void> {
  const doc = await PDFDocument.create();
  const headingFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await doc.embedFont(StandardFonts.Helvetica);

  const drawLine = (
    page: ReturnType<PDFDocument['addPage']>,
    text: string,
    y: number,
    font = bodyFont,
    size = BODY_SIZE,
  ): number => {
    page.drawText(text, { x: MARGIN, y, size, font });
    return y - LINE_HEIGHT;
  };

  // ---- Page 1: Executive Summary ----
  const page1 = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  page1.drawText('Executive Summary', { x: MARGIN, y, size: HEADING_SIZE, font: headingFont });
  y -= LINE_HEIGHT * 2;
  y = drawLine(page1, 'John Smith presented the annual results of Acme Corp on March 15, 2024.', y);
  y = drawLine(page1, 'The company reported strong performance across all divisions, with', y);
  y = drawLine(page1, 'particular growth in the enterprise services segment.', y);

  // ---- Page 2: Revenue by Quarter ----
  const page2 = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  y = PAGE_HEIGHT - MARGIN;
  page2.drawText('Revenue by Quarter', { x: MARGIN, y, size: HEADING_SIZE, font: headingFont });
  y -= LINE_HEIGHT * 2;
  // Table drawn as real text rows (not curves), 4 rows x 3 columns.
  const rows = [
    'Quarter    Revenue      Growth',
    'Q1         $9.8M        +4%',
    'Q2         $10.4M       +6%',
    'Q3         $11.1M       +7%',
  ];
  for (const row of rows) {
    y = drawLine(page2, row, y);
  }
  y -= LINE_HEIGHT;
  y = drawLine(page2, 'Total revenue for the year reached $42.5 million, exceeding the', y);
  y = drawLine(page2, 'target set by the board at the start of the fiscal year.', y);

  // ---- Page 3: Board Members ----
  const page3 = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  y = PAGE_HEIGHT - MARGIN;
  page3.drawText('Board Members', { x: MARGIN, y, size: HEADING_SIZE, font: headingFont });
  y -= LINE_HEIGHT * 2;
  y = drawLine(page3, '- John Smith', y);
  y = drawLine(page3, '- Jane Doe', y);
  y = drawLine(page3, '- Robert Brown', y);
  y -= LINE_HEIGHT;
  y = drawLine(page3, 'John Smith is the CEO of Acme Corp and has served on the board', y);
  y = drawLine(page3, 'since 2010.', y);

  const outDir = resolve(process.cwd(), 'test-pdfs');
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, 'golden-master.pdf');
  await writeFile(outPath, await doc.save());
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
