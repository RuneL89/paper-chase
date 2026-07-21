# PDF Engine A/B Report (Phase 10)

Generated: 2026-07-20T21:40:45.950Z
Java available: yes
JVM startup overhead: ~227 ms (first opendataloader document vs. steady-state)
Total wall time: pdfjs 416 ms | opendataloader 4339 ms

## multi-column.pdf
_Two-column newsletter page. Correct extraction keeps each column's text contiguous and reads the left column before the right column (both engines do: pdfjs by draw order, opendataloader via xycut reading order)._

| Metric | pdfjs | opendataloader |
| --- | --- | --- |
| Wall time | 304 ms | 522 ms |
| Page count | 1 | 1 |

Expected strings:
- `ALFA-113` — pdfjs: PASS, opendataloader: PASS
- `BRAVO-227` — pdfjs: PASS, opendataloader: PASS
- `Nordwind Traders report` — pdfjs: PASS, opendataloader: PASS
- `Borealis Holdings update` — pdfjs: PASS, opendataloader: PASS

Diacritics integrity: pdfjs PASS, opendataloader PASS
Page alignment: counts agree PASS, per-page non-empty agreement PASS

## tables.pdf
_One bordered table (drawn grid: Region/Units/Margin + North/South/West rows) and one borderless table (Product/Price/Stock + Widget/Gadget rows). Known divergence: the drawn grid lines degrade opendataloader's text layer on the bordered table ('West 1430' arrives mangled as 'West 143 0'); pdfjs is unaffected because it reads the text layer only. 'South 950' survives in both. The borderless table renders as a clean 3-line run under both engines (with keepLineBreaks)._

| Metric | pdfjs | opendataloader |
| --- | --- | --- |
| Wall time | 17 ms | 588 ms |
| Page count | 1 | 1 |

Expected strings:
- `Table Fixtures` — pdfjs: PASS, opendataloader: PASS
- `South 950` — pdfjs: PASS, opendataloader: PASS
- `Product Price Stock` — pdfjs: PASS, opendataloader: PASS
- `Widget 19.99 340` — pdfjs: PASS, opendataloader: PASS
- `Gadget 49.50 125` — pdfjs: PASS, opendataloader: PASS

Table fidelity (after renderTablesAsMarkdown):
- expected `bordered` 4x3
- expected `borderless` 3x3
- detected pdfjs: [{"rows":4,"cols":3},{"rows":3,"cols":3}] — PASS
- detected opendataloader: [{"rows":3,"cols":3}] — FAIL

Diacritics integrity: pdfjs PASS, opendataloader PASS
Page alignment: counts agree PASS, per-page non-empty agreement PASS

## headers-footers.pdf
_Running header ('CONFIDENTIAL Meridian Annual Review') and footer ('Page N of 2') plus a footnote line, with distinct body text per page. Known divergence: opendataloader EXCLUDES headers/footers by default (includeHeaderFooter defaults to false); pdfjs always includes them. Both behaviors are acceptable for Layer 1; the difference is recorded, not treated as a failure._

| Metric | pdfjs | opendataloader |
| --- | --- | --- |
| Wall time | 21 ms | 558 ms |
| Page count | 2 | 2 |

Expected strings:
- `CHARLIE-331` — pdfjs: PASS, opendataloader: PASS
- `DELTA-442` — pdfjs: PASS, opendataloader: PASS
- `Meridian Analytics` — pdfjs: PASS, opendataloader: PASS
- `Halcyon Partners` — pdfjs: PASS, opendataloader: PASS
- `Covenant terms subject to the 2024 restatement.` — pdfjs: PASS, opendataloader: PASS

Diacritics integrity: pdfjs PASS, opendataloader PASS
Page alignment: counts agree PASS, per-page non-empty agreement PASS

## danish-diacritics.pdf
_Danish text exercising æ/ø/å in both cases (extends the Phase 7 golden-master-da coverage). Correct extraction preserves every diacritic verbatim — Layer 2 evidence is never transliterated._

| Metric | pdfjs | opendataloader |
| --- | --- | --- |
| Wall time | 10 ms | 505 ms |
| Page count | 1 | 1 |

Expected strings:
- `Søren Møller` — pdfjs: PASS, opendataloader: PASS
- `Åse Lindberg` — pdfjs: PASS, opendataloader: PASS
- `København` — pdfjs: PASS, opendataloader: PASS
- `Æbleskiver` — pdfjs: PASS, opendataloader: PASS
- `Rødgrød med fløde` — pdfjs: PASS, opendataloader: PASS
- `ECHO-553` — pdfjs: PASS, opendataloader: PASS

Diacritics integrity: pdfjs PASS, opendataloader PASS
Page alignment: counts agree PASS, per-page non-empty agreement PASS

## financial-dense.pdf
_Dense financial/legal page (the project's target domain): figures, percentages, ISO and long-form dates, company names, and a small segment table (Segment/Revenue/Margin + Nordic/Iberia/DACH rows). Correct extraction preserves every figure verbatim._

| Metric | pdfjs | opendataloader |
| --- | --- | --- |
| Wall time | 16 ms | 669 ms |
| Page count | 1 | 1 |

Expected strings:
- `Meridian Analytics A/S` — pdfjs: PASS, opendataloader: PASS
- `February 28, 2025` — pdfjs: PASS, opendataloader: PASS
- `$312.6 million` — pdfjs: PASS, opendataloader: PASS
- `14.7%` — pdfjs: PASS, opendataloader: PASS
- `7.85%` — pdfjs: PASS, opendataloader: PASS
- `$88.1 million` — pdfjs: PASS, opendataloader: PASS
- `FOXTROT-664` — pdfjs: PASS, opendataloader: PASS

Table fidelity (after renderTablesAsMarkdown):
- expected `segment` 4x3
- detected pdfjs: [{"rows":4,"cols":3}] — PASS
- detected opendataloader: [{"rows":4,"cols":3}] — PASS

Diacritics integrity: pdfjs PASS, opendataloader PASS
Page alignment: counts agree PASS, per-page non-empty agreement PASS

## scanned-page.pdf
_Image-only page (embedded PNG of grey 'text' stripes, no text layer) simulating a scan. Documents the OCR gap honestly: BOTH engines extract empty text here (opendataloader's OCR requires the out-of-scope hybrid backend). Empty output is a VALID data point, not a failure._

| Metric | pdfjs | opendataloader |
| --- | --- | --- |
| Wall time | 4 ms | 294 ms |
| Page count | 1 | 1 |

Expected strings:

Diacritics integrity: pdfjs PASS, opendataloader PASS
Page alignment: counts agree PASS, per-page non-empty agreement PASS

## golden-master.pdf
_Phase 0 control document (3 pages). Quarter/Revenue/Growth table on page 2._

| Metric | pdfjs | opendataloader |
| --- | --- | --- |
| Wall time | 28 ms | 602 ms |
| Page count | 3 | 3 |

Expected strings:
- `John Smith` — pdfjs: PASS, opendataloader: PASS
- `Acme Corp` — pdfjs: PASS, opendataloader: PASS
- `March 15, 2024` — pdfjs: PASS, opendataloader: PASS
- `$42.5 million` — pdfjs: PASS, opendataloader: PASS
- `Board Members` — pdfjs: PASS, opendataloader: PASS

Table fidelity (after renderTablesAsMarkdown):
- expected `quarter` 4x3
- detected pdfjs: [{"rows":4,"cols":3}] — PASS
- detected opendataloader: [{"rows":3,"cols":3}] — FAIL

Diacritics integrity: pdfjs PASS, opendataloader PASS
Page alignment: counts agree PASS, per-page non-empty agreement PASS

## golden-master-da.pdf
_Phase 7 Danish control document (2 pages)._

| Metric | pdfjs | opendataloader |
| --- | --- | --- |
| Wall time | 16 ms | 601 ms |
| Page count | 2 | 2 |

Expected strings:
- `Søren Møller` — pdfjs: PASS, opendataloader: PASS
- `København` — pdfjs: PASS, opendataloader: PASS
- `Møbler A/S` — pdfjs: PASS, opendataloader: PASS
- `12,5 millioner kr.` — pdfjs: PASS, opendataloader: PASS
- `3,2 millioner kr.` — pdfjs: PASS, opendataloader: PASS

Diacritics integrity: pdfjs PASS, opendataloader PASS
Page alignment: counts agree PASS, per-page non-empty agreement PASS

## Recommendation

KEEP pdfjs as the default engine. Content-check failures: pdfjs 0, opendataloader 2; opendataloader wall time is 10.4x pdfjs (JVM startup 227.40390000000002 ms) and it adds a hard Java 11+ runtime dependency. pdfjs stays the zero-dependency default; opendataloader remains opt-in.
