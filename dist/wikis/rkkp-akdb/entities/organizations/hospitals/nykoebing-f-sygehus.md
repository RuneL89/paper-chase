---
title: Nykøbing F Sygehus
type: entity
aliases:
  - Nykøbing F Sygehus
  - Nykøbing Falster
wiki: rkkp-akdb
updated: '2026-08-15T07:52:11.008Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '21-25, 51-55, 56-60, 6-10, 61-65, 71-75'
tags:
  - organization
---
**Nykøbing F Sygehus** is a hospital located in the [[sjaelland|Sjælland]] region of Denmark. It is included in the national clinical quality monitoring program for acute high-risk abdominal surgical patients, as detailed in the 2023 Acute Surgery Database (AKDB) report. The hospital's performance is evaluated across several process and outcome indicators, though its relatively low patient volumes for specific metrics often result in high statistical uncertainty.

For the reporting period of September 1, 2022, to August 31, 2023, Nykøbing F Sygehus's results for [[indikator-1|Indikator 1]] (which measures antibiotic treatment within three hours) showed a compliance rate of 50.0% [^src1]. However, the 95% confidence interval for this metric was extremely wide (1.3–98.7%), indicating a very small data volume and high statistical uncertainty [^src1]. 

In terms of surgical intervention speed for life-threatening conditions, the hospital performed well on the supplementary [[indikator-5x|Indikator 5x]], meeting the standard with a 100.0% compliance rate (95% CI: 2.5–100.0) [^src2]. 

Conversely, outcome indicators related to mortality reveal significant data quality limitations due to low case numbers. For [[indikator-11|Indikator 11]] (90-day mortality), the hospital reported a 100.0% rate (95% CI: 15.8–100.0), but the underlying numerator and denominator data were missing or invalid ('#/#') [^src3]. Similarly, when evaluating 30-day mortality after acute surgery specifically for patients with a [[charlson-score-1-2|Charlson Score = 1 or 2]] (indicating mild to moderate comorbidity), the hospital again recorded a 100.0% rate (95% CI: 2.5–100.0) alongside missing count data [^src4]. These wide confidence intervals and missing data flags underscore the challenges of benchmarking smaller hospitals on rare or highly specific postoperative outcomes.

## Mentions
- Page 9: "Nykøbing F Sygehus Nej #/# 0 (0) 50,0 (1,3-98,7) 0,0 0,0" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10) [^src1]
- Page 21: "Nykøbing F Sygehus Ja #/# 0 (0) 100,0 (2,5-100,0)" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25) [^src2]
- Page 51: "Nykøbing F Sygehus" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 51-55) [^src3]
- Page 61: "Nykøbing F Sygehus #/# 0 (0) 100,0 (2,5-100,0) 0,0" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65) [^src4]
- Page 71: "Nykøbing F Sygehus # 0,3 83,00 87,50 87,50 92,00" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 71-75) [^src5]
- Page 56: "Nykøbing Falster" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60) [^src6]

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: nykoebing-f-sygehus
  Predicate: has-indicator-result
  Object: indikator-1
  Evidence: "Nykøbing F Sygehus Nej #/# 0 (0) 50,0 (1,3-98,7) 0,0 0,0"
  Page: 9
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10 [^src1]
- Subject: nykoebing-f-sygehus
  Predicate: has-invalid-data-for
  Object: indikator-11
  Evidence: "Nykøbing F Sygehus Nej #/# 0 (0) 100,0 (15,8-100,0) 0,0 0,0"
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 51-55 [^src3]

Incoming (this entity is the OBJECT of these relationships):
- Subject: sjaelland
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Nykøbing F Sygehus er beliggende i Region Sjælland"
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25 [^src2]
- Subject: sjaelland
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Sjælland 28 / 180 [...] Nykøbing F Sygehus #/#"
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65 [^src4]

## Claims
- Nykøbing F Sygehus opfyldte standarden for supplerende indikator 5x med 100,0 % (95 % CI: 2,5–100,0) [^src1] (nykoebing-f-sygehus, indikator-5x)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25 [^src2]
- Nykøbing F Sygehus har en rapporteret 90-dages mortalitet på 100,0 % (95 % CI: 15,8–100,0) for Indikator 11, men med manglende tæller/nævner-data ('#/#') [^src1] (nykoebing-f-sygehus, indikator-11)
  Type: data-quality
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 51-55 [^src3]
- Nykøbing F Sygehus: #/# døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (100,0 %; 95 % CI: 2,5-100,0) [^src1] (nykoebing-f-sygehus, charlson-score-1-2)
  Type: hospital-statistic
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65 [^src4]

## Timeline
(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 21-25
[^src3]: AKDB_2023.pdf, pages 51-55
[^src4]: AKDB_2023.pdf, pages 61-65
[^src5]: AKDB_2023.pdf, pages 71-75
[^src6]: AKDB_2023.pdf, pages 56-60
