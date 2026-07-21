/**
 * Generates test-pdfs/golden-master-2.pdf — the 2-page compounding control
 * document for Phase 8 (multi-PDF compounding and incremental ingestion).
 * Run ONCE with: npx tsx scripts/create-golden-master-2.ts
 *
 * This PDF must never change after it is committed. Every word on every page
 * is known (see below). It is consistent with the world of
 * test-pdfs/golden-master.pdf (John Smith is the CEO of Acme Corp):
 *
 * - Page 1 "Legal Proceedings Update": mentions John Smith in a NEW context
 *   (court testimony, not annual results) and introduces Jane Doe as Acme
 *   Corp's General Counsel. Claim type: legal.
 * - Page 2 "Settlement Negotiations": Jane Doe confirms settlement talks;
 *   a legal claim about the proposed $3.1 million settlement; John Smith
 *   states operations are unaffected.
 *
 * Known content (verbatim):
 *
 * Page 1:
 *   Legal Proceedings Update
 *   On June 2, 2024, John Smith testified before the Delaware Court of
 *   Chancery in the class-action lawsuit filed against Acme Corp.
 *   Jane Doe, General Counsel of Acme Corp, accompanied John Smith and
 *   presented the company's legal defense strategy to the court.
 *   The lawsuit alleges that Acme Corp misstated revenue figures in its
 *   annual disclosures for fiscal year 2023.
 *
 * Page 2:
 *   Settlement Negotiations
 *   Jane Doe confirmed that Acme Corp entered settlement negotiations with
 *   the plaintiffs on July 10, 2024.
 *   The proposed settlement is valued at $3.1 million and requires court
 *   approval before it becomes final.
 *   John Smith stated that the legal proceedings will not affect the
 *   company's ongoing operations or its board composition.
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

  // ---- Page 1: Legal Proceedings Update ----
  const page1 = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  page1.drawText('Legal Proceedings Update', { x: MARGIN, y, size: HEADING_SIZE, font: headingFont });
  y -= LINE_HEIGHT * 2;
  y = drawLine(page1, 'On June 2, 2024, John Smith testified before the Delaware Court of', y);
  y = drawLine(page1, 'Chancery in the class-action lawsuit filed against Acme Corp.', y);
  y = drawLine(page1, 'Jane Doe, General Counsel of Acme Corp, accompanied John Smith and', y);
  y = drawLine(page1, "presented the company's legal defense strategy to the court.", y);
  y -= LINE_HEIGHT;
  y = drawLine(page1, 'The lawsuit alleges that Acme Corp misstated revenue figures in its', y);
  y = drawLine(page1, 'annual disclosures for fiscal year 2023.', y);

  // ---- Page 2: Settlement Negotiations ----
  const page2 = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  y = PAGE_HEIGHT - MARGIN;
  page2.drawText('Settlement Negotiations', { x: MARGIN, y, size: HEADING_SIZE, font: headingFont });
  y -= LINE_HEIGHT * 2;
  y = drawLine(page2, 'Jane Doe confirmed that Acme Corp entered settlement negotiations with', y);
  y = drawLine(page2, 'the plaintiffs on July 10, 2024.', y);
  y = drawLine(page2, 'The proposed settlement is valued at $3.1 million and requires court', y);
  y = drawLine(page2, 'approval before it becomes final.', y);
  y -= LINE_HEIGHT;
  y = drawLine(page2, 'John Smith stated that the legal proceedings will not affect the', y);
  y = drawLine(page2, "company's ongoing operations or its board composition.", y);

  const outDir = resolve(process.cwd(), 'test-pdfs');
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, 'golden-master-2.pdf');
  await writeFile(outPath, await doc.save());
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
