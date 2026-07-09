const { PDFDocument, StandardFonts } = require('pdf-lib');
const { writeFileSync } = require('fs');

async function makePdf(filePath, text) {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: 50, y: 700, size: 12, font });
  writeFileSync(filePath, Buffer.from(await doc.save()));
}

(async () => {
  await makePdf('C:/temp/wiki-test-cross/wikis/acme/raw/doc-a.pdf', 'Acme Corp reported revenue. Acme Corp is the focus.');
  await makePdf('C:/temp/wiki-test-cross/wikis/globex/raw/doc-b.pdf', 'Acme Corp acquired Globex. Acme Corp is the buyer.');
  console.log('done');
})();
