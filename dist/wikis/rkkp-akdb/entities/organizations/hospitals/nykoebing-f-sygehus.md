---
title: Nykøbing F Sygehus
type: entity
aliases:
  - Nykøbing F Sygehus
  - Nykøbing Falster
wiki: rkkp-akdb
updated: '2026-08-05T18:48:01.000Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '21-25, 51-55, 56-60, 6-10, 61-65, 71-75'
tags:
  - organization
---
**Nykøbing F Sygehus** (also referred to in the data as Nykøbing Falster) is a hospital located in [[region-sjaelland|Region Sjælland]] [^src2], [^src4], [^src6]. It participates in the national quality monitoring program for acute high-risk abdominal surgical patients, as documented in the 2023 Akut Kirurgi Databasen (AKDB) report administered by the Danish Regions' Clinical Quality Development Program [^src1]. 

During the reporting period of September 1, 2022, to August 31, 2023, the hospital's performance across various clinical quality indicators highlighted significant statistical uncertainty due to very small data volumes [^src1], [^src3], [^src4]. For [[indikator-1|Indikator 1]], which measures antibiotic treatment within three hours, the hospital reported a compliance rate of 50.0% (95% CI: 1.3–98.7%), reflecting a minimal patient cohort and rendering the result highly uncertain [^src1]. 

Despite the small sample sizes, the hospital achieved a 100.0% (95% CI: 2.5–100.0) compliance rate for the supplementary [[indikator-5x|Indikator 5x]], which tracks the speed of surgical intervention for life-threatening conditions [^src2]. However, data quality and low procedure volumes severely impacted the reliability of outcome indicators. For [[indikator-11|Indikator 11]] (90-day mortality), the hospital recorded a 100.0% mortality rate (95% CI: 15.8–100.0), but this figure is flagged as invalid due to missing numerator and denominator data [^src3]. Similarly, when evaluating 30-day mortality for patients with mild to moderate comorbidity ([[charlson-score-1-2|Charlson Score = 1 eller 2]]), the hospital reported a 100.0% rate (95% CI: 2.5–100.0), again with missing exact patient counts ('#/#') [^src4]. Additional statistical metrics associated with the hospital (e.g., values of 83.00, 87.50, and 92.00) are also recorded in the database's supplementary analyses [^src5]. 

These findings underscore the challenges of benchmarking and clinical quality management at smaller regional hospitals. Low procedure volumes can lead to extreme percentages and wide confidence intervals, complicating the identification of true clinical outliers versus statistical artifacts in the Danish healthcare sector [^src1], [^src3], [^src4].

## Mentions

- Page 9: "Nykøbing F Sygehus Nej #/# 0 (0) 50,0 (1,3-98,7) 0,0 0,0" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10) [^src1]
- Page 21: "Nykøbing F Sygehus Ja #/# 0 (0) 100,0 (2,5-100,0)" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25) [^src2]
- Page 51: "Nykøbing F Sygehus" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 51-55) [^src3]
- Page 61: "Nykøbing F Sygehus #/# 0 (0) 100,0 (2,5-100,0) 0,0" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65) [^src4]
- Page 71: "Nykøbing F Sygehus # 0,3 83,00 87,50 87,50 92,00" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 71-75) [^src5]
- Page 56: "Nykøbing Falster" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60) [^src6]

## Relationships

**Outgoing (this entity is the SUBJECT of these relationships):**

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

**Incoming (this entity is the OBJECT of these relationships):**

- Subject: region-sjaelland
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Nykøbing F Sygehus er beliggende i Region Sjælland"
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25 [^src2]

- Subject: region-sjaelland
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Sjælland 28 / 180 [...] Nykøbing F Sygehus #/#"
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65 [^src4]

## Claims

**performance-statistic**
- Nykøbing F Sygehus opfyldte standarden for supplerende indikator 5x med 100,0 % (95 % CI: 2,5–100,0) [^src1] (nykoebing-f-sygehus, indikator-5x)

**data-quality**
- Nykøbing F Sygehus har en rapporteret 90-dages mortalitet på 100,0 % (95 % CI: 15,8–100,0) for Indikator 11, men med manglende tæller/nævner-data ('#/#') [^src1] (nykoebing-f-sygehus, indikator-11)

**hospital-statistic**
- Nykøbing F Sygehus: #/# døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (100,0 %; 95 % CI: 2,5-100,0) [^src1] (nykoebing-f-sygehus, charlson-score-1-2)

## Timeline

(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 21-25
[^src3]: AKDB_2023.pdf, pages 51-55
[^src4]: AKDB_2023.pdf, pages 61-65
[^src5]: AKDB_2023.pdf, pages 71-75
[^src6]: AKDB_2023.pdf, pages 56-60
