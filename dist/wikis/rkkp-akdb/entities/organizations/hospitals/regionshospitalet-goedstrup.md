---
title: Regionshospitalet Gødstrup
type: entity
aliases:
  - Regionshospitalet Gødstrup
wiki: rkkp-akdb
updated: '2026-08-05T18:52:43.202Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '41-45, 56-60, 6-10, 61-65, 71-75'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '51-55, 6-10, 61-65, 66-70, 71-75'
tags:
  - organization
---
**Regionshospitalet Gødstrup** is a hospital located in [[region-midtjylland|Region Midtjylland]], Denmark. It is actively monitored through the Acute Surgery Database (AKDB), a national quality assurance program managed by the Danish Regions' Clinical Quality Development Programme (RKKP) that tracks clinical outcomes and processes for acute high-risk surgical patients [^src1]. 

For the reporting period of September 1, 2022, to August 31, 2023, the hospital's results for [[indikator-1|Indikator 1]] (timely antibiotic treatment) showed a compliance rate of 38.7% [^src1]. During the same period, the hospital successfully met the standard for [[indikator-9|Indikator 9]] [^src10]. When evaluating 30-day mortality outcomes for patients with light to moderate comorbidity ([[charlson-score-1-2|Charlson Score = 1 or 2]]), the hospital recorded 3 deaths out of 58 patients (5.2%) [^src3].

In the subsequent reporting period (September 1, 2023, to August 31, 2024), the database tracked further mortality outcomes stratified by comorbidity. Regionshospitalet Gødstrup recorded 11 deaths within 30 days among 37 included patients with a Charlson Score of 1 or 2, tracked under [[indikator-9b|Indikator 9b]] [^src8]. Additionally, for patients with high comorbidity (Charlson Score ≥ 3), the hospital registered 11 deaths within the same 30-day postoperative window under [[indikator-9c|Indikator 9c]] [^src8]. These figures are utilized for national benchmarking, risk adjustment, and clinical quality development across the Danish healthcare sector [^src3].

## Mentions
- Page 9: "Regionshospitalet Gødstrup Nej 60 / 155 0 (0) 38,7 (31,0-46,9) 36,3 17,8" [^src1]
- Page 56: "Regionshospitalet Gødstrup" [^src2]
- Page 61: "Regionshospitalet Gødstrup 3 / 58 0 (0) 5,2 (1,1-14,4) 19,6 16,4" [^src3]
- Page 71: "Regionshospitalet Gødstrup 185 23,1 58,00 72,00 67,76 79,00" [^src4]
- Page 6: "Regionshospitalet Gødstrup Nej 79 / 167 0 (0) 47,3 (39,5-55,2) 39,1 36,3" [^src5]
- Page 51: "Regionshospitalet Gødstrup Nej 21 / 172 0 (0) 12,2 (7,7-18,1) 8,2 14,0" [^src6]
- Page 61: "Regionshospitalet Gødstrup 4 / 88 0 (0) 4,5 (1,3-11,2) 1,7 6,5" [^src7]
- Page 66: "Regionshospitalet Gødstrup" [^src8]
- Page 71: "Regionshospitalet Gødstrup 186 23,0 58,00 72,00 67,79 79,00" [^src9]
- Page 41: "Regionshospitalet Gødstrup" [^src10]

## Relationships
### Outgoing
- **Subject:** regionshospitalet-goedstrup
  **Predicate:** has-indicator-result
  **Object:** indikator-1
  **Evidence:** "Regionshospitalet Gødstrup Nej 60 / 155 0 (0) 38,7 (31,0-46,9) 36,3 17,8"
  **Page:** 9 [^src1]

- **Subject:** regionshospitalet-goedstrup
  **Predicate:** meets-standard-of
  **Object:** indikator-9
  **Evidence:** "Regionshospitalet Gødstrup Ja 100 / 158 0 (0) 63,3 (55,3-70,8) 59,7 47,8"
  **Page:** 41 [^src10]

### Incoming
- **Subject:** region-midtjylland
  **Predicate:** contains-hospital
  **Object:** regionshospitalet-goedstrup
  **Evidence:** "Midtjylland 24 / 225 [...] Regionshospitalet Gødstrup 3 / 58"
  **Page:** 61 [^src3]

## Claims
- Regionshospitalet Gødstrup: 3 / 58 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (5,2 %; 95 % CI: 1,1-14,4) [^src1] (regionshospitalet-goedstrup, charlson-score-1-2) [^src3]
  **Type:** hospital-statistic
  **Page:** 61

- For perioden 01.09.2023 – 31.08.2024 blev der registreret 11 patienter med død inden for 30 dage efter akut kirurgi ved Regionshospitalet Gødstrup blandt 37 inkluderede patienter med Charlson Score = 1 eller 2 [^src1] (regionshospitalet-goedstrup, indikator-9b) [^src8]
  **Type:** clinical-outcome
  **Page:** 66

- For perioden 01.09.2023 – 31.08.2024 blev der registreret 11 patienter med død inden for 30 dage efter akut kirurgi ved Regionshospitalet Gødstrup blandt 37 inkluderede patienter med Charlson Score ≥ 3 [^src1] (regionshospitalet-goedstrup, indikator-9c) [^src8]
  **Type:** clinical-outcome
  **Page:** 66

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
[^src10]: AKDB_2023.pdf, pages 41-45
