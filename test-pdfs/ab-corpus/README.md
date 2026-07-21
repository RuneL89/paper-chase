# A/B Corpus (Phase 10)

Controlled fixtures for the pdfjs-vs-opendataloader engine evaluation. Like the
golden masters, these PDFs are **immutable** once committed — never regenerate,
edit, move, or delete them (`scripts/create-ab-corpus.ts` documents how they
were made and must not be re-run against the committed files).

`manifest.json` is the machine-readable version (filenames, SHA-256, page
counts, expected strings/tables/diacritics, notes). Human summary:

| Fixture | What it tests | "Correct" looks like |
| --- | --- | --- |
| `multi-column.pdf` | Two-column reading order | Each column's text contiguous; left column before right (markers `ALFA-113` / `BRAVO-227`) |
| `tables.pdf` | Bordered + borderless tables | Region/Units/Margin (4x3) and Product/Price/Stock (3x3) survive; opendataloader mangles the drawn-grid table — recorded divergence |
| `headers-footers.pdf` | Running header/footer + footnote | Body markers `CHARLIE-331` / `DELTA-442` present; opendataloader drops the header/footer by default — recorded divergence |
| `danish-diacritics.pdf` | æ/ø/å verbatim | `Søren Møller`, `Åse Lindberg`, `København`, `Æbleskiver`, `Rødgrød med fløde` intact |
| `financial-dense.pdf` | Dense financial page | Every figure/date/name verbatim (`$312.6 million`, `14.7%`, `February 28, 2025`, `FOXTROT-664`) |
| `scanned-page.pdf` | OCR gap | Empty extraction under BOTH engines is a valid data point, not a failure |
