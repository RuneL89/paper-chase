---
title: Charlson Score = 1 eller 2
type: entity
aliases:
  - Charlson Score = 1 eller 2
wiki: rkkp-akdb
updated: '2026-08-05T19:12:43.994Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: 61-65
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: 61-65
tags:
  - clinical-indicator
---
**Charlson Score = 1 eller 2** is a clinical risk classification used within the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] (Acute Surgery Database) to identify patients with mild to moderate comorbidity. By isolating this specific patient cohort, healthcare administrators and clinicians can evaluate 30-day mortality rates following acute surgery, enabling transparent benchmarking and quality improvement across different comorbidity levels.

In the database's reporting framework, this risk group serves as the foundation for specific supplementary quality indicators. In the 2023 annual report, it was the basis for supplementary indicator 10b, while in the 2024 report, it was utilized for supplementary indicator 9b [^src1] [^src2]. The data collection period for the 2023 report's indicator 10b spanned from September 1, 2022, to August 31, 2023 [^src1]. 

Nationally, the 30-day mortality rate for patients in this comorbidity group showed slight variations between reporting periods. According to the 2023 report, 122 out of 1,090 patients in [[danmark|Danmark]] died within 30 days of acute surgery, resulting in a mortality rate of 11.2% (95% CI: 9.4-13.2) [^src1]. In the subsequent 2024 report, the national mortality rate was 12.5%, with 143 deaths among 1,144 patients [^src2].

The data reveals significant regional and hospital-level variations, which are used to identify areas for clinical quality development. For instance, in the 2023 dataset, [[region-nordjylland|Region Nordjylland]] recorded the highest regional mortality rate at 17.1% (13 out of 76 patients) [^src1], whereas [[region-hovedstaden|Region Hovedstaden]] reported the lowest at 9.1% (36 out of 396 patients) [^src1]. At the individual hospital level, mortality rates ranged from 0.0% at [[bornholms-hospital|Bornholms Hospital]] (0 out of 7 patients) [^src1] to 25.0% at [[holbaek-sygehus|Holbæk Sygehus]] (12 out of 48 patients) [^src1]. Other notable hospital outcomes included a 6.0% mortality rate at [[bispebjerg-og-frederiksberg-hospitaler|Bispebjerg og Frederiksberg Hospitaler]] [^src1] and a 20.0% rate at [[regionshospital-nordjylland|Regionshospital Nordjylland]] [^src1]. These stratified statistics are essential for evaluating treatment safety and guiding targeted improvement initiatives across the Danish healthcare system.

## Mentions

- Page 61: "Supplerende indikator til 10b: Mortalitet indenfor 30 dage efter akut kirurgi, hvis Charlson Score = 1 eller 2. Alle opererede (med relevant diagnosekode og procedurekode)" [^src1]
- Page 61: "Supplerende indikator til 9b: Mortalitet indenfor 30 dage efter akut kirurgi, hvis Charlson Score = 1 eller 2. Alle opererede (med relevant diagnosekode og procedurekode)" [^src2]

## Relationships

- **Subject:** charlson-score-1-2
  **Predicate:** is-basis-for
  **Object:** akut-kirurgi-databasen
  **Evidence:** "Supplerende indikator til 10b: Mortalitet indenfor 30 dage efter akut kirurgi, hvis Charlson Score = 1 eller 2. Alle opererede (med relevant diagnosekode og procedurekode)"
  **Page:** 61
  **Source:** wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65 [^src1]

- **Subject:** charlson-score-1-2
  **Predicate:** is-used-in
  **Object:** akut-kirurgi-databasen
  **Evidence:** "Supplerende indikator til 9b: Mortalitet indenfor 30 dage efter akut kirurgi, hvis Charlson Score = 1 eller 2. Alle opererede (med relevant diagnosekode og procedurekode)"
  **Page:** 61
  **Source:** wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 61-65 [^src2]

## Claims

**clinical-indicator-definition**
- Supplerende indikator til 10b: Mortalitet indenfor 30 dage efter akut kirurgi, hvis Charlson Score = 1 eller 2. Alle opererede (med relevant diagnosekode og procedurekode) [^src1]

**regional-statistic**
- Danmark: 122 / 1.090 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (11,2 %; 95 % CI: 9,4-13,2) [^src1]
- Hovedstaden: 36 / 396 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (9,1 %; 95 % CI: 6,4-12,4) [^src1]
- Sjælland: 28 / 180 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (15,6 %; 95 % CI: 10,6-21,7) [^src1]
- Syddanmark: 21 / 213 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (9,9 %; 95 % CI: 6,2-14,7) [^src1]
- Midtjylland: 24 / 225 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (10,7 %; 95 % CI: 7,0-15,5) [^src1]
- Nordjylland: 13 / 76 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (17,1 %; 95 % CI: 9,4-27,5) [^src1]

**hospital-statistic**
- Amager og Hvidovre Hospital: 7 / 90 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (7,8 %; 95 % CI: 3,2-15,4) [^src1]
- Bispebjerg og Frederiksberg Hospitaler: 5 / 83 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (6,0 %; 95 % CI: 2,0-13,5) [^src1]
- Bornholms Hospital: 0 / 7 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (0,0 %; 95 % CI: 0,0-41,0) [^src1]
- Herlev og Gentofte Hospital: 13 / 117 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (11,1 %; 95 % CI: 6,1-18,3) [^src1]
- Hospitalerne i Nordsjælland: 8 / 69 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (11,6 %; 95 % CI: 5,1-21,6) [^src1]
- Rigshospitalet: 3 / 30 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (10,0 %; 95 % CI: 2,1-26,5) [^src1]
- Holbæk Sygehus: 12 / 48 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (25,0 %; 95 % CI: 13,6-39,6) [^src1]
- Nykøbing F Sygehus: #/# døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (100,0 %; 95 % CI: 2,5-100,0) [^src1]
- Næstved, Slagelse og Ringsted sygehuse: 6 / 59 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (10,2 %; 95 % CI: 3,8-20,8) [^src1]
- Sjællands Universitetshospital: 9 / 72 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (12,5 %; 95 % CI: 5,9-22,4) [^src1]
- Esbjerg Sygehus Grindsted Sygehus: 6 / 49 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (12,2 %; 95 % CI: 4,6-24,8) [^src1]
- Odense Universitetshospital - Svendborg: 10 / 86 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (11,6 %; 95 % CI: 5,7-20,3) [^src1]
- Sygehus Lillebælt: #/# døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (6,1 %; 95 % CI: 0,7-20,2) [^src1]
- Sygehus Sønderjylland: 3 / 45 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (6,7 %; 95 % CI: 1,4-18,3) [^src1]
- Aarhus Universitetshospital: 3 / 45 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (6,7 %; 95 % CI: 1,4-18,3) [^src1]
- Hospitalsenhed Midt: 6 / 48 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (12,5 %; 95 % CI: 4,7-25,2) [^src1]
- Regionshospitalet Gødstrup: 3 / 58 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (5,2 %; 95 % CI: 1,1-14,4) [^src1]
- Regionshospitalet Horsens: 6 / 32 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (18,8 %; 95 % CI: 7,2-36,4) [^src1]
- Regionshospitalet Randers: 6 / 42 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (14,3 %; 95 % CI: 5,4-28,5) [^src1]
- Aalborg Universitetshospital: 7 / 46 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (15,2 %; 95 % CI: 6,3-28,9) [^src1]
- Regionshospital Nordjylland: 6 / 30 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (20,0 %; 95 % CI: 7,7-38,6) [^src1]

**clinical-indicator**
- Supplerende indikator til 9b: Mortalitet indenfor 30 dage efter akut kirurgi, hvis Charlson Score = 1 eller 2. Alle opererede (med relevant diagnosekode og procedurekode) [^src1]

**clinical-outcome**
- Danmark: 143 / 1.144 patienter døde indenfor 30 dage efter akut kirurgi ved Charlson Score = 1 eller 2, svarende til 12,5 % (95 % CI: 10,6-14,6) [^src1]

## Timeline

- **2022-09-01:** Start af dataindsamlingsperioden for supplerende indikator til 10b: 01.09.2022 - 31.08.2023 [^src1]
- **2023-08-31:** Afslutning af dataindsamlingsperioden for supplerende indikator til 10b: 01.09.2022 - 31.08.2023 [^src1]

## Sources

[^src1]: AKDB_2023.pdf, pages 61-65
[^src2]: AKDB_2024.pdf, pages 61-65
