/**
 * Generates test-pdfs/ab-corpus/*.pdf — the Phase 10 A/B evaluation corpus
 * (pdf-lib). Run ONCE with: npx tsx scripts/create-ab-corpus.ts
 *
 * These fixtures are IMMUTABLE once committed (same discipline as the golden
 * masters, see test-pdfs/AGENTS.md): never re-run this script against the
 * committed fixtures. The script exists to document how they were made.
 * SHA-256 hashes are printed after generation and recorded in
 * test-pdfs/ab-corpus/manifest.json and .state/phase-10-status.json.
 */
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import { writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';
import { join, resolve } from 'node:path';

const PAGE_WIDTH = 612; // US Letter
const PAGE_HEIGHT = 792;
const MARGIN = 72;
const BODY_SIZE = 12;
const HEADING_SIZE = 18;
const LINE_HEIGHT = 16;

interface Corpus {
  headingFont: PDFFont;
  bodyFont: PDFFont;
}

async function newDoc(): Promise<{ doc: PDFDocument; fonts: Corpus }> {
  const doc = await PDFDocument.create();
  const fonts = {
    headingFont: await doc.embedFont(StandardFonts.HelveticaBold),
    bodyFont: await doc.embedFont(StandardFonts.Helvetica),
  };
  return { doc, fonts };
}

function drawLine(page: PDFPage, text: string, y: number, font: PDFFont, size = BODY_SIZE, x = MARGIN): number {
  page.drawText(text, { x, y, size, font });
  return y - LINE_HEIGHT;
}

/** two-column newsletter page: reading-order fixture. */
async function buildMultiColumn(): Promise<Uint8Array> {
  const { doc, fonts } = await newDoc();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const leftX = MARGIN;
  const rightX = 320;

  page.drawText('Left Column Ledger', { x: leftX, y: PAGE_HEIGHT - MARGIN, size: HEADING_SIZE, font: fonts.headingFont });
  page.drawText('Right Column Review', { x: rightX, y: PAGE_HEIGHT - MARGIN, size: HEADING_SIZE, font: fonts.headingFont });

  let y = PAGE_HEIGHT - MARGIN - LINE_HEIGHT * 2;
  for (const line of [
    'Left column first story',
    'Nordwind Traders report',
    'left marker ALFA-113',
    'left column closing note',
  ]) {
    page.drawText(line, { x: leftX, y, size: BODY_SIZE, font: fonts.bodyFont });
    y -= LINE_HEIGHT;
  }

  y = PAGE_HEIGHT - MARGIN - LINE_HEIGHT * 2;
  for (const line of [
    'Right column second story',
    'Borealis Holdings update',
    'right marker BRAVO-227',
    'right column closing note',
  ]) {
    page.drawText(line, { x: rightX, y, size: BODY_SIZE, font: fonts.bodyFont });
    y -= LINE_HEIGHT;
  }

  return doc.save();
}

/** one bordered table (drawn grid) + one borderless table with known cells. */
async function buildTables(): Promise<Uint8Array> {
  const { doc, fonts } = await newDoc();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  page.drawText('Table Fixtures', { x: MARGIN, y, size: HEADING_SIZE, font: fonts.headingFont });
  y -= LINE_HEIGHT * 2;

  // Bordered table: 3 columns x 4 rows (header + 3 data rows). Rows drawn as
  // single padded text runs (same technique as the golden master) so both
  // engines collapse them into equal-token lines; grid drawn as rectangles.
  const borderedRows = [
    'Region    Units       Margin',
    'North     1200        18%',
    'South     950         12%',
    'West      1430        21%',
  ];
  const tableTop = y + 6;
  const rowHeight = LINE_HEIGHT;
  for (const row of borderedRows) {
    y = drawLine(page, row, y, fonts.bodyFont);
  }
  const tableBottom = tableTop - rowHeight * borderedRows.length;
  // Outer border + horizontal row separators + two vertical column separators.
  page.drawRectangle({
    x: MARGIN - 6,
    y: tableBottom - 4,
    width: 200,
    height: tableTop - tableBottom + 4,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });
  for (let r = 1; r < borderedRows.length; r++) {
    const lineY = tableTop - rowHeight * r - 4;
    page.drawLine({ start: { x: MARGIN - 6, y: lineY }, end: { x: MARGIN + 194, y: lineY }, thickness: 0.5 });
  }
  for (const colX of [MARGIN + 66, MARGIN + 132]) {
    page.drawLine({
      start: { x: colX, y: tableBottom - 4 },
      end: { x: colX, y: tableTop },
      thickness: 0.5,
    });
  }

  y -= LINE_HEIGHT * 2;
  y = drawLine(page, 'Borderless inventory table follows.', y, fonts.bodyFont);
  y -= LINE_HEIGHT;
  const borderlessRows = [
    'Product    Price      Stock',
    'Widget     19.99      340',
    'Gadget     49.50      125',
  ];
  for (const row of borderlessRows) {
    y = drawLine(page, row, y, fonts.bodyFont);
  }

  return doc.save();
}

/** running header + footer with page numbers + footnote, distinct body per page. */
async function buildHeadersFooters(): Promise<Uint8Array> {
  const { doc, fonts } = await newDoc();
  const bodies = [
    [
      'Body page one discusses Meridian Analytics.',
      'First page body marker CHARLIE-331.',
      'The opening section reviews quarterly onboarding.',
    ],
    [
      'Body page two covers Halcyon Partners.',
      'Second page body marker DELTA-442.',
      'The closing section summarises covenant terms.',
    ],
  ];
  bodies.forEach((bodyLines, index) => {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    // Running header / footer with page number.
    page.drawText('CONFIDENTIAL Meridian Annual Review', {
      x: MARGIN,
      y: PAGE_HEIGHT - 36,
      size: 9,
      font: fonts.bodyFont,
    });
    page.drawText(`Page ${index + 1} of ${bodies.length}`, { x: MARGIN, y: 36, size: 9, font: fonts.bodyFont });
    let y = PAGE_HEIGHT - MARGIN - LINE_HEIGHT;
    for (const line of bodyLines) {
      y = drawLine(page, line, y, fonts.bodyFont);
    }
    y -= LINE_HEIGHT;
    y = drawLine(page, '1 Covenant terms subject to the 2024 restatement.', y, fonts.bodyFont, 9);
  });
  return doc.save();
}

/** Danish diacritics (æ/ø/å) — extends the Phase 7 coverage. */
async function buildDanishDiacritics(): Promise<Uint8Array> {
  const { doc, fonts } = await newDoc();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  page.drawText('Dansk Sprogprøve', { x: MARGIN, y, size: HEADING_SIZE, font: fonts.headingFont });
  y -= LINE_HEIGHT * 2;
  for (const line of [
    'Søren Møller og Åse Lindberg mødtes i København.',
    'Æbleskiver serveres med fløde og rød saft.',
    'Rødgrød med fløde er en klassisk dansk dessert.',
    'diacritic marker ECHO-553 æ ø å Æ Ø Å',
  ]) {
    y = drawLine(page, line, y, fonts.bodyFont);
  }
  return doc.save();
}

/** dense financial/legal page: figures, percentages, dates, names, small table. */
async function buildFinancialDense(): Promise<Uint8Array> {
  const { doc, fonts } = await newDoc();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  page.drawText('Q4 Consolidated Filing', { x: MARGIN, y, size: HEADING_SIZE, font: fonts.headingFont });
  y -= LINE_HEIGHT * 2;
  for (const line of [
    'Meridian Analytics A/S filed form 10-K on February 28, 2025.',
    'Net revenue rose 14.7% to $312.6 million (2024: $272.4 million).',
    'Operating margin narrowed by 230 basis points to 11.2%.',
    'Halcyon Partners LLP holds a 7.85% equity stake as of 2025-01-31.',
    'Long-term debt stands at $88.1 million maturing June 30, 2029.',
    'financial marker FOXTROT-664',
  ]) {
    y = drawLine(page, line, y, fonts.bodyFont);
  }
  y -= LINE_HEIGHT;
  const rows = [
    'Segment    Revenue     Margin',
    'Nordic     $148.2M     13.5%',
    'Iberia     $96.4M      9.1%',
    'DACH       $68.0M      10.8%',
  ];
  for (const row of rows) {
    y = drawLine(page, row, y, fonts.bodyFont);
  }
  return doc.save();
}

// --- Minimal grayscale PNG encoder (no dependencies) for the scanned page ---
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makeGrayscalePng(width: number, height: number, pixelAt: (x: number, y: number) => number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // colour type: grayscale
  const raw = Buffer.alloc(height * (1 + width));
  for (let row = 0; row < height; row++) {
    raw[row * (1 + width)] = 0; // filter: none
    for (let col = 0; col < width; col++) {
      raw[row * (1 + width) + 1 + col] = pixelAt(col, row);
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Image-only page (simulated scan): a PNG of grey "text line" stripes with NO
 * text layer. Documents the OCR gap honestly — both engines extract empty
 * text here without OCR, which is a valid A/B data point, not a failure.
 */
async function buildScannedPage(): Promise<Uint8Array> {
  const { doc } = await newDoc();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const png = makeGrayscalePng(400, 500, (x, y) => {
    // Horizontal dark stripes of varying length — crude "scanned text" look.
    const stripeRow = Math.floor(y / 24) % 2 === 0;
    if (!stripeRow) return 255;
    const length = 60 + ((Math.floor(y / 48) * 137) % 320);
    return x < length ? 40 : 255;
  });
  const image = await doc.embedPng(png);
  page.drawImage(image, { x: MARGIN, y: PAGE_HEIGHT - MARGIN - 500, width: 400, height: 500 });
  return doc.save();
}

async function main(): Promise<void> {
  const outDir = resolve(process.cwd(), 'test-pdfs', 'ab-corpus');
  await mkdir(outDir, { recursive: true });

  const fixtures: Array<[string, () => Promise<Uint8Array>]> = [
    ['multi-column.pdf', buildMultiColumn],
    ['tables.pdf', buildTables],
    ['headers-footers.pdf', buildHeadersFooters],
    ['danish-diacritics.pdf', buildDanishDiacritics],
    ['financial-dense.pdf', buildFinancialDense],
    ['scanned-page.pdf', buildScannedPage],
  ];

  for (const [name, build] of fixtures) {
    const bytes = await build();
    await writeFile(join(outDir, name), bytes);
    const sha = createHash('sha256').update(bytes).digest('hex');
    console.log(`${name}  sha256:${sha}  bytes:${bytes.length}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
