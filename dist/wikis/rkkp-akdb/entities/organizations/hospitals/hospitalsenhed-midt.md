---
title: Hospitalsenhed Midt
type: entity
aliases:
  - Hospitalsenhed Midt
wiki: rkkp-akdb
updated: '2026-08-05T18:51:56.355Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '56-60, 6-10, 61-65, 71-75'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '51-55, 6-10, 61-65, 66-70, 71-75'
tags:
  - organization
---
Hospitalsenhed Midt is a hospital unit operating within [[region-midtjylland|Region Midtjylland]] in Denmark. It is systematically evaluated in the national Acute Surgery Database (AKDB) reports, which monitor clinical quality and patient outcomes for high-risk acute abdominal surgery. The unit's performance is tracked across multiple process and outcome indicators to support clinical quality development, risk adjustment, and transparent benchmarking in the Danish healthcare sector.

One of the primary metrics evaluated is [[indikator-1|Indikator 1]], which measures the proportion of patients receiving antibiotic treatment within three hours. For the period from September 1, 2022, to August 31, 2023, Hospitalsenhed Midt achieved a compliance rate of 41.7% [^src1]. In the subsequent reporting period, from September 1, 2023, to August 31, 2024, this rate was recorded at 38.9% [^src5].

The unit is also closely monitored for postoperative mortality, stratified by patient comorbidity using the Charlson Comorbidity Index. For patients with a [[charlson-score-1-2|Charlson Score = 1 eller 2]] (mild to moderate comorbidity), the 30-day mortality rate after acute surgery was 12.5% (6 out of 48 patients) during the 2022–2023 period [^src3]. In the 2023–2024 period, there were 7 deaths within 30 days among 28 included patients in this same comorbidity group, tracked under [[indikator-9b|Indikator 9b]] [^src8]. Furthermore, for patients with high comorbidity (Charlson Score ≥ 3), evaluated under [[indikator-9c|Indikator 9c]], the unit also recorded 7 deaths within 30 days out of 28 included patients during the 2023–2024 period [^src8].

Beyond mortality and antibiotic timing, the AKDB reports detail the unit's patient demographics and case mix. This includes the distribution of cancer diagnoses among operated patients [^src2] and age distributions [^src4], [^src9], which are critical for risk-adjusting quality indicators and understanding the underlying patient population at Hospitalsenhed Midt.

## Mentions
- Page 9: "Hospitalsenhed Midt Nej 60 / 144 0 (0) 41,7 (33,5-50,2) 32,2 22,1" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10) [^src1]
- Page 56: "Hospitalsenhed Midt" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60) [^src2]
- Page 61: "Hospitalsenhed Midt 6 / 48 0 (0) 12,5 (4,7-25,2) 7,8 22,2" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65) [^src3]
- Page 71: "Hospitalsenhed Midt 185 23,1 51,00 66,00 62,81 76,00" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 71-75) [^src4]
- Page 6: "Hospitalsenhed Midt Nej 51 / 131 0 (0) 38,9 (30,5-47,8) 41,7 32,2" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10) [^src5]
- Page 51: "Hospitalsenhed Midt Nej 18 / 139 0 (0) 12,9 (7,9-19,7) 8,2 11,5" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 51-55) [^src6]
- Page 61: "Hospitalsenhed Midt #/# 0 (0) 1,8 (0,0-9,6) 3,5 9,8" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 61-65) [^src7]
- Page 66: "Hospitalsenhed Midt" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 66-70) [^src8]
- Page 71: "Hospitalsenhed Midt 185 22,9 51,00 66,00 62,81 76,00" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 71-75) [^src9]

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: hospitalsenhed-midt
  Predicate: has-indicator-result
  Object: indikator-1
  Evidence: "Hospitalsenhed Midt Nej 60 / 144 0 (0) 41,7 (33,5-50,2) 32,2 22,1"
  Page: 9
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10 [^src1]

Incoming (this entity is the OBJECT of these relationships):
- Subject: region-midtjylland
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Midtjylland 24 / 225 [...] Hospitalsenhed Midt 6 / 48"
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65 [^src3]

## Claims
- Hospitalsenhed Midt: 6 / 48 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (12,5 %; 95 % CI: 4,7-25,2) [^src1] (hospitalsenhed-midt, charlson-score-1-2) [^src3]
  Type: hospital-statistic
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65
- For perioden 01.09.2023 – 31.08.2024 blev der registreret 7 patienter med død inden for 30 dage efter akut kirurgi ved Hospitalsenhed Midt blandt 28 inkluderede patienter med Charlson Score = 1 eller 2 [^src1] (hospitalsenhed-midt, indikator-9b) [^src8]
  Type: clinical-outcome
  Page: 66
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 66-70
- For perioden 01.09.2023 – 31.08.2024 blev der registreret 7 patienter med død inden for 30 dage efter akut kirurgi ved Hospitalsenhed Midt blandt 28 inkluderede patienter med Charlson Score ≥ 3 [^src1] (hospitalsenhed-midt, indikator-9c) [^src8]
  Type: clinical-outcome
  Page: 66
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 66-70

## Timeline
(none provided)

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
