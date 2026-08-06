---
title: Indikator 11
type: entity
aliases:
  - Indikator 11
wiki: rkkp-akdb
updated: '2026-08-05T18:40:21.142Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '51-55, 56-60, 6-10'
tags:
  - indicator
---
**Indikator 11** is a clinical result indicator within the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] (AKDB) that measures [[90-dages-mortalitet|90-dages-mortalitet]] (90-day mortality) for patients undergoing acute surgery with relevant diagnosis and procedure codes [^src1]. It is the second mortality-related indicator tracked by the database and is highlighted in both the overall indicator overview and the specific result overviews [^src1]. The established quality standard for Indikator 11 requires the 90-day mortality rate to be strictly less than 20% [^src1].

For the measurement period spanning September 1, 2022, to August 31, 2023, the national 90-day mortality rate was 15.1% (95% CI: 13.8–16.4), indicating that the national cohort successfully met the < 20% standard [^src2]. However, the data reveals significant institutional variations and specific outliers that failed to meet the threshold. [[rigshospitalet|Rigshospitalet]] reported a 90-day mortality rate of 29.3% (95% CI: 18.1–42.7), thereby failing the standard [^src2]. Similarly, [[holbaek-sygehus|Holbæk Sygehus]] failed to meet the benchmark with a rate of 20.3% (95% CI: 13.5–28.7) [^src2]. Data quality issues were also identified at [[nykoebing-f-sygehus|Nykøbing F Sygehus]], which reported a 100.0% mortality rate but with invalid or missing numerator and denominator counts (recorded as '#/#') [^src2].

To provide context for these outcomes, the AKDB report includes supplementary analyses on patient composition, specifically focusing on the distribution of cancer diagnoses among operated patients [^src3]. Because comorbidities such as cancer are known predictors of postoperative outcomes, this data serves as a critical background for assessing Indikator 11 and supports the risk adjustment of the indicator across different regions and hospitals [^src3].

## Mentions
- Page 6: "Indikator 11: Andelen af patienter, der dør indenfor 90 dage fra operationsdato for alle opererede (med relevant diagnosekode og procedurekode)" [^src1]
- Page 7: "Indikator 11: Andelen af patienter, der dør indenfor 90 dage fra operationsdato for alle opererede (med relevant diagnosekode og procedurekode)" [^src1]
- Page 51: "Indikator 11: Mortalitet indenfor 90 dage efter akut kirurgi. Alle opererede (med relevant diagnosekode og procedurekode)" [^src2]
- Page 56: "Supplerende opgørelse over fordelingen af cancer" [^src3]

## Relationships
**Outgoing (this entity is the SUBJECT of these relationships):**
- **Subject:** indikator-11 | **Predicate:** belongs-to-database | **Object:** akut-kirurgi-databasen
  **Evidence:** "Indikator 11: Andelen af patienter, der dør indenfor 90 dage fra operationsdato for alle opererede (med relevant diagnosekode og procedurekode)" [^src1]
- **Subject:** indikator-11 | **Predicate:** measures | **Object:** 90-dages-mortalitet
  **Evidence:** "Indikator 11: Mortalitet indenfor 90 dage efter akut kirurgi. Alle opererede (med relevant diagnosekode og procedurekode)" [^src2]
- **Subject:** indikator-11 | **Predicate:** is-calculated-from | **Object:** akut-kirurgi-databasen
  **Evidence:** "Indikator 11 beskriver andelen af patienter, der dør indenfor 90 dage fra tidspunkt for operation for alle med relevant operation og diagnose" [^src3]

**Incoming (this entity is the OBJECT of these relationships):**
- **Subject:** rigshospitalet | **Predicate:** fails-standard-for | **Object:** indikator-11
  **Evidence:** "Rigshospitalet Nej 17 / 58 0 (0) 29,3 (18,1-42,7) 49,1 39,2" [^src2]
- **Subject:** holbaek-sygehus | **Predicate:** fails-standard-for | **Object:** indikator-11
  **Evidence:** "Holbæk Sygehus Nej 24 / 118 0 (0) 20,3 (13,5-28,7) 27,7 31,8" [^src2]
- **Subject:** nykoebing-f-sygehus | **Predicate:** has-invalid-data-for | **Object:** indikator-11
  **Evidence:** "Nykøbing F Sygehus Nej #/# 0 (0) 100,0 (15,8-100,0) 0,0 0,0" [^src2]

## Claims
- **standard**: Indikator 11 har en standard på < 20 % for andelen af patienter, der dør indenfor 90 dage fra operationsdato for alle opererede med relevant diagnosekode og procedurekode [^src1]
- **compliance**: Standard for Indikator 11 er < 20 % [^src1]
- **statistical**: National andel for Indikator 11 i perioden 01.09.2022 – 31.08.2023 er 15,1 % (95 % CI: 13,8–16,4) [^src1]
- **statistical**: Rigshospitalet har en 90-dages mortalitet på 29,3 % (95 % CI: 18,1–42,7) for Indikator 11 og opfylder derfor ikke standarden [^src1]
- **statistical**: Holbæk Sygehus har en 90-dages mortalitet på 20,3 % (95 % CI: 13,5–28,7) for Indikator 11 og opfylder derfor ikke standarden [^src1]
- **data-quality**: Nykøbing F Sygehus har en rapporteret 90-dages mortalitet på 100,0 % (95 % CI: 15,8–100,0) for Indikator 11, men med manglende tæller/nævner-data ('#/#') [^src1]

## Timeline
- 2022-09-01: Start af måleperioden for indikatorresultaterne (01.09.2022 – 31.08.2023) (indikator-1, indikator-3, indikator-4, indikator-5, indikator-6, indikator-7, indikator-8, indikator-9, indikator-10, indikator-11) [^src1]
- 2023-08-31: Afslutning af måleperioden for indikatorresultaterne (01.09.2022 – 31.08.2023) (indikator-1, indikator-3, indikator-4, indikator-5, indikator-6, indikator-7, indikator-8, indikator-9, indikator-10, indikator-11) [^src1]
- 2022-09-01: Start af dataindsamlingsperiode for Indikator 11 (01.09.2022 – 31.08.2023) (indikator-11) [^src2]
- 2023-08-31: Afslutning af dataindsamlingsperiode for Indikator 11 (01.09.2022 – 31.08.2023) (indikator-11) [^src2]

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 51-55
[^src3]: AKDB_2023.pdf, pages 56-60
