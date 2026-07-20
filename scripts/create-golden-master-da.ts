/**
 * Generates test-pdfs/golden-master-da.pdf — the 2-page Danish control
 * document for Phase 7 (multilingual ingestion). Run ONCE with:
 *   npx tsx scripts/create-golden-master-da.ts
 *
 * This PDF must never change after it is committed (same contract as
 * scripts/create-golden-master.ts — see test-pdfs/AGENTS.md). Every word on
 * every page is known and asserted by the Phase 7 gates/UAT:
 *   - Person names with Danish characters: "Søren Møller", "Åse Lindberg"
 *   - Place names with Danish characters: "København", "Aarhus"
 *   - Company: "Møbler A/S"
 *   - Danish-formatted financial figures: "12,5 millioner kr." (page 1),
 *     "3,2 millioner kr." (page 2)
 *
 * Danish æ/ø/å are all in the WinAnsi encoding, so the pdf-lib standard
 * fonts encode them losslessly and pdfjs extracts them as proper Unicode.
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

  // ---- Page 1: Årsrapport 2024 ----
  const page1 = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  page1.drawText('Årsrapport 2024', { x: MARGIN, y, size: HEADING_SIZE, font: headingFont });
  y -= LINE_HEIGHT * 2;
  y = drawLine(page1, 'Søren Møller præsenterede årsresultatet for Møbler A/S den', y);
  y = drawLine(page1, '12. marts 2025 på hovedkontoret i København.', y);
  y -= LINE_HEIGHT;
  y = drawLine(page1, 'Virksomheden omsatte for 12,5 millioner kr. i 2024, en stigning', y);
  y = drawLine(page1, 'på 8 procent i forhold til året før. Resultatet blev godkendt', y);
  y = drawLine(page1, 'enstemmigt af bestyrelsen.', y);

  // ---- Page 2: Bestyrelse og marked ----
  const page2 = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  y = PAGE_HEIGHT - MARGIN;
  page2.drawText('Bestyrelse og marked', { x: MARGIN, y, size: HEADING_SIZE, font: headingFont });
  y -= LINE_HEIGHT * 2;
  y = drawLine(page2, 'Åse Lindberg er bestyrelsesformand for Møbler A/S og har siddet', y);
  y = drawLine(page2, 'i bestyrelsen siden 2015.', y);
  y -= LINE_HEIGHT;
  y = drawLine(page2, 'Virksomheden åbnede en ny fabrik i Aarhus i september 2024 med', y);
  y = drawLine(page2, 'en investering på 3,2 millioner kr. Fabrikken skaber 45 nye', y);
  y = drawLine(page2, 'arbejdspladser i regionen.', y);

  const outDir = resolve(process.cwd(), 'test-pdfs');
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, 'golden-master-da.pdf');
  await writeFile(outPath, await doc.save());
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
