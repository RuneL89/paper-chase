---
title: Sygehus Sønderjylland
type: entity
aliases:
  - Sygehus Sønderjylland
wiki: rkkp-akdb
updated: '2026-08-05T18:50:35.759Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '56-60, 6-10, 61-65, 71-75'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '51-55, 6-10, 61-65, 66-70, 71-75'
tags:
  - organization
---
**Sygehus Sønderjylland** is a hospital located in [[region-syddanmark|Region Syddanmark]] that participates in the national clinical quality monitoring program for acute high-risk abdominal surgery in Denmark [^src3]. Its performance is systematically tracked and benchmarked by the Danish Regions' Clinical Quality Development Programme (RKKP) across multiple process and outcome indicators.

In the reporting period from September 1, 2022, to August 31, 2023, the hospital's compliance with [[indikator-1|Indikator 1]] (administration of antibiotics within three hours prior to surgery) was recorded at 17.8% [^src1]. By the following year, covering the period from September 1, 2023, to August 31, 2024, the hospital's compliance rate for Indikator 1 increased to 27.4% [^src5]. 

The hospital's postoperative outcomes are closely monitored, particularly 30-day mortality rates stratified by patient comorbidity. During the 2022–2023 period, 3 out of 45 patients with a [[charlson-score-1-2|Charlson Score = 1 eller 2]] died within 30 days of acute surgery, yielding a mortality rate of 6.7% [^src3]. In the 2023–2024 period, the hospital reported 5 deaths within 30 days among 23 patients with a Charlson Score of 1 or 2, a metric associated with [[indikator-9b|Indikator 9b]] [^src8]. For patients with severe comorbidity (Charlson Score ≥ 3), the hospital also recorded 5 deaths out of 23 patients within 30 days, tracked under [[indikator-9c|Indikator 9c]] [^src8]. Furthermore, the hospital's patient demographics, including age distribution and the prevalence of cancer diagnoses among operated patients, are documented to facilitate risk adjustment and regional benchmarking [^src2] [^src4] [^src6] [^src9].

## Mentions
- Page 9: "Sygehus Sønderjylland Nej 19 / 107 0 (0) 17,8 (11,0-26,3) 16,3 9,0" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10)
- Page 56: "Sygehus Sønderjylland" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60)
- Page 61: "Sygehus Sønderjylland 3 / 45 0 (0) 6,7 (1,4-18,3) 15,2 16,0" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65)
- Page 71: "Sygehus Sønderjylland 140 19,2 63,00 73,50 70,01 81,00" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 71-75)
- Page 6: "Sygehus Sønderjylland Nej 29 / 106 0 (0) 27,4 (19,1-36,9) 17,6 16,3" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10)
- Page 51: "Sygehus Sønderjylland Ja 12 / 113 0 (0) 10,6 (5,6-17,8) 12,6 17,3" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 51-55)
- Page 61: "Sygehus Sønderjylland 0 / 42 0 (0) 0,0 (0,0-8,4) 10,6 11,6" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 61-65)
- Page 66: "Sygehus Sønderjylland" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 66-70)
- Page 71: "Sygehus Sønderjylland 141 19,1 63,00 74,00 70,08 81,00" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 71-75)

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: sygehus-soenderjylland
  Predicate: has-indicator-result
  Object: indikator-1
  Evidence: "Sygehus Sønderjylland Nej 19 / 107 0 (0) 17,8 (11,0-26,3) 16,3 9,0"
  Page: 9
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10

Incoming (this entity is the OBJECT of these relationships):
- Subject: region-syddanmark
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Syddanmark 21 / 213 [...] Sygehus Sønderjylland 3 / 45"
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65

## Claims
- Sygehus Sønderjylland: 3 / 45 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (6,7 %; 95 % CI: 1,4-18,3) [^src1] (sygehus-soenderjylland, charlson-score-1-2)
  Type: hospital-statistic
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65
- For perioden 01.09.2023 – 31.08.2024 blev der registreret 5 patienter med død inden for 30 dage efter akut kirurgi ved Sygehus Sønderjylland blandt 23 inkluderede patienter med Charlson Score = 1 eller 2 [^src1] (sygehus-soenderjylland, indikator-9b)
  Type: clinical-outcome
  Page: 66
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 66-70
- For perioden 01.09.2023 – 31.08.2024 blev der registreret 5 patienter med død inden for 30 dage efter akut kirurgi ved Sygehus Sønderjylland blandt 23 inkluderede patienter med Charlson Score ≥ 3 [^src1] (sygehus-soenderjylland, indikator-9c)
  Type: clinical-outcome
  Page: 66
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 66-70

## Timeline
(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 56-60
[^src3]: AKDB_2023.pdf, pages 61-65
[^src4]: AKDB_2023.pdf, pages 71-75
[^src5]: AKDB_2024.pdf, pages 6-10
[^src6]: AKDB_2024.pdf, pages 51-55
[^src7]: AKDB_2024.pdf, pages 61-65
[^src8]: AKDB_2024.pdf, pages 66-70
[^src9]: AKDB_2024.pdf, pages 71-75
