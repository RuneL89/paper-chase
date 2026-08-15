---
title: DanStroke
type: entity
wiki: rkkp-afdk
updated: '2026-08-14T20:11:42.090Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '56-60, 91-95'
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 46-50
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 36-40
tags:
  - organization
---

DanStroke is a former database used for the registration of stroke (apoplexy) cases in [[danmark|Danmark]]. It historically served as a primary data source for monitoring the quality of care for atrial fibrillation patients, specifically for [[indikator-5|Indikator 5]], which tracks the incidence of ischemic stroke as a measure of inadequate anticoagulation [^src1] [^src2].

However, beginning with the 2022–2023 annual reports and continuing through 2024 and 2025, DanStroke was replaced by data from the National Patient Register (LPR) for the calculation of Indikator 5 [^src1] [^src3] [^src4]. This methodological shift was necessitated by severe reporting issues; DanStroke experienced missing registrations of stroke cases due to a transition to a new reporting model within the database, compounded by individual regions migrating to new Electronic Patient Record (EPJ) systems [^src1] [^src3] [^src4]. Consequently, recent annual reports explicitly exclude DanStroke in favor of LPR data to ensure accurate national, regional, and municipal benchmarking [^src3] [^src4].

Despite its replacement for primary indicator tracking, DanStroke data was still referenced for specific historical or parallel clinical claims. For instance, data from DanStroke indicated that the national proportion of atrial fibrillation patients suffering from ischemic stroke between July 1, 2022, and June 30, 2023, was 0.6% (95% CI: 0.5–0.6) [^src2].

## Mentions

- Page 58: "I modsætning til tidligere er indikatoren i år opgjort på baggrund af data om akut apopleksi fra LPR frem for
databasen DanStroke. Det skyldes, at DanStroke har været ramt af manglende indberetninger af
apopleksitilfælde grundet overgangen til en ny indberetningsmodel i databasen samt enkelt regioners
omlægning til nyt EPJ system." [^src1]
- Page 93: "Indikator 5 baseret på DanStroke" [^src2]
- Page 48: "Indikatoren er opgjort på baggrund af data om akut apopleksi fra LPR frem for databasen DanStroke." [^src3]
- Page 48: "Det skyldes, at DanStroke har været ramt af manglende indberetninger af apopleksitilfælde grundet overgangen til en ny
indberetningsmodel i databasen samt enkelt regioners omlægning til nyt EPJ system." [^src3]
- Page 39: "Indikatoren er opgjort på baggrund af data om akut apopleksi fra LPR frem for databasen DanStroke. Det skyldes, at DanStroke har været ramt af manglende indberetninger af apopleksitilfælde grundet overgangen til en ny indberetningsmodel i databasen samt enkelt regioners omlægning til nyt EPJ system." [^src4]

## Relationships

- **Subject:** indikator-5 | **Predicate:** replaces-data-source | **Object:** DanStroke
  **Evidence:** "Det skyldes, at DanStroke har været ramt af manglende indberetninger af apopleksitilfælde grundet overgangen til en ny indberetningsmodel i databasen samt enkelt regioners omlægning til nyt EPJ system." (Page 58) [^src1]
- **Subject:** indikator-5 | **Predicate:** has-alternative-dataset | **Object:** DanStroke
  **Evidence:** "Indikator 5 baseret på DanStroke" (Page 93) [^src2]
- **Subject:** indikator-5 | **Predicate:** excludes | **Object:** DanStroke
  **Evidence:** "Indikatoren er opgjort på baggrund af data om akut apopleksi fra LPR frem for databasen DanStroke." (Page 48) [^src3]
- **Subject:** indikator-5 | **Predicate:** excludes | **Object:** DanStroke
  **Evidence:** "Indikatoren er opgjort på baggrund af data om akut apopleksi fra LPR frem for databasen DanStroke." (Page 39) [^src4]

## Claims

- Den nationale andel af atrieflimren-patienter med iskæmisk apopleksi i perioden 01.07.2022–30.06.2023 var 0,6 % (95 % CI: 0,5–0,6) ifølge DanStroke-data [^src1]

## Timeline

*(No timeline events extracted for this entity.)*

## Sources

[^src1]: AFDK_2023.pdf, pages 56-60
[^src2]: AFDK_2023.pdf, pages 91-95
[^src3]: AFDK_2024.pdf, pages 46-50
[^src4]: AFDK_2025.pdf, pages 36-40
