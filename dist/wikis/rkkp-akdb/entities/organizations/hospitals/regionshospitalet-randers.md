---
title: Regionshospitalet Randers
type: entity
aliases:
  - Regionshospitalet Randers
wiki: rkkp-akdb
updated: '2026-08-05T18:53:57.204Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '41-45, 56-60, 6-10, 61-65, 71-75'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '11-15, 51-55, 6-10, 61-65, 66-70, 71-75'
tags:
  - organization
---
**Regionshospitalet Randers** is a hospital located in [[region-midtjylland|Region Midtjylland]], Denmark, that participates in the national clinical quality monitoring program for acute high-risk abdominal surgery. Its performance is tracked in the annual Akut Kirurgi Databasen (AKDB) reports, managed by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP) and Sundhedsvæsenets Kvalitetsinstitut, which evaluate process and outcome indicators to ensure treatment safety and quality across the Danish healthcare system.

In the 2023 AKDB report, covering the period from September 1, 2022, to August 31, 2023, Regionshospitalet Randers recorded a 36.5% fulfillment rate for [[indikator-1|Indikator 1]] (early antibiotic treatment) [^src1]. The hospital also reported a 30-day mortality rate of 14.3% (6 deaths out of 42 patients) for acute surgery patients with a [[charlson-score-1-2|Charlson Score = 1 eller 2]] [^src4]. During this reporting cycle, the hospital proposed modifying [[indikator-9|Indikator 9]], suggesting it be made voluntary or removed entirely due to the heavy administrative burden of retrospective registration [^src2]. 

By the 2024 AKDB report, covering September 1, 2023, to August 31, 2024, the hospital demonstrated notable progress. Its fulfillment rate for [[indikator-1|Indikator 1]] improved to 50.8% [^src6], and the report explicitly noted that "Randers is on track to meet the goal" ("Randers er på vej i mål") [^src7]. Regarding mortality outcomes in the 2024 report, the hospital recorded 6 deaths within 30 days out of 25 included patients for both [[indikator-9b|Indikator 9b]] (Charlson Score = 1 or 2) and [[indikator-9c|Indikator 9c]] (Charlson Score ≥ 3) [^src10]. The hospital's data is also utilized in broader national analyses of patient demographics, such as age distribution and cancer comorbidity, to support risk adjustment and clinical benchmarking [^src3] [^src5] [^src11].

## Mentions
- Page 9: "Regionshospitalet Randers Nej 42 / 115 0 (0) 36,5 (27,7-46,0) 36,4 16,7" [^src1]
- Page 41: "Regionshospitalet Randers" [^src2]
- Page 56: "Regionshospitalet Randers" [^src3]
- Page 61: "Regionshospitalet Randers 6 / 42 0 (0) 14,3 (5,4-28,5) 21,1 17,1" [^src4]
- Page 71: "Regionshospitalet Randers 148 18,5 59,00 71,00 67,59 80,00" [^src5]
- Page 6: "Regionshospitalet Randers Nej 64 / 126 0 (0) 50,8 (41,7-59,8) 36,3 36,4" [^src6]
- Page 11: "Regionshospitalet Randers" [^src7]
- Page 51: "Regionshospitalet Randers Ja 15 / 127 0 (0) 11,8 (6,8-18,7) 10,4 16,5" [^src8]
- Page 61: "Regionshospitalet Randers 4 / 54 0 (0) 7,4 (2,1-17,9) 9,1 9,6" [^src9]
- Page 66: "Regionshospitalet Randers" [^src10]
- Page 71: "Regionshospitalet Randers 145 18,0 60,00 71,00 67,93 80,00" [^src11]

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: regionshospitalet-randers
  Predicate: has-indicator-result
  Object: indikator-1
  Evidence: "Regionshospitalet Randers Nej 42 / 115 0 (0) 36,5 (27,7-46,0) 36,4 16,7"
  Page: 9
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10 [^src1]
- Subject: regionshospitalet-randers
  Predicate: proposes-to-modify
  Object: indikator-9
  Evidence: "Fra Randers foreslås det, at indikatoren gøres frivillig eller fjernes, da den kræver meget efterregistrering."
  Page: 41
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 41-45 [^src2]
- Subject: regionshospitalet-randers
  Predicate: shows-improvement-in
  Object: indikator-1
  Evidence: "Randers er på vej i mål"
  Page: 11
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 11-15 [^src7]

Incoming (this entity is the OBJECT of these relationships):
- Subject: region-midtjylland
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Midtjylland 24 / 225 [...] Regionshospitalet Randers 6 / 42"
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65 [^src4]

## Claims
- Regionshospitalet Randers: 6 / 42 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (14,3 %; 95 % CI: 5,4-28,5) [^src1] (regionshospitalet-randers, charlson-score-1-2) [^src4]
  Type: hospital-statistic
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65
- For perioden 01.09.2023 – 31.08.2024 blev der registreret 6 patienter med død inden for 30 dage efter akut kirurgi ved Regionshospitalet Randers blandt 25 inkluderede patienter med Charlson Score = 1 eller 2 [^src1] (regionshospitalet-randers, indikator-9b) [^src10]
  Type: clinical-outcome
  Page: 66
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 66-70
- For perioden 01.09.2023 – 31.08.2024 blev der registreret 6 patienter med død inden for 30 dage efter akut kirurgi ved Regionshospitalet Randers blandt 25 inkluderede patienter med Charlson Score ≥ 3 [^src1] (regionshospitalet-randers, indikator-9c) [^src10]
  Type: clinical-outcome
  Page: 66
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 66-70

## Timeline
(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 41-45
[^src3]: AKDB_2023.pdf, pages 56-60
[^src4]: AKDB_2023.pdf, pages 61-65
[^src5]: AKDB_2023.pdf, pages 71-75
[^src6]: AKDB_2024.pdf, pages 6-10
[^src7]: AKDB_2024.pdf, pages 11-15
[^src8]: AKDB_2024.pdf, pages 51-55
[^src9]: AKDB_2024.pdf, pages 61-65
[^src10]: AKDB_2024.pdf, pages 66-70
[^src11]: AKDB_2024.pdf, pages 71-75
