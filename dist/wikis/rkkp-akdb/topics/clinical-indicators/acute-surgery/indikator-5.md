---
title: Indikator 5
type: entity
aliases:
  - Indikator 5
wiki: rkkp-akdb
updated: '2026-08-05T18:36:05.886Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '16-20, 21-25, 6-10'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '31-35, 6-10, 96-100'
tags:
  - indicator
---
**Indikator 5** is a clinical quality indicator within the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] (AKDB), a national quality monitoring program for acute high-risk abdominal surgical patients in [[danmark|Danmark]]. The indicator has undergone a significant definitional shift between the 2023 and 2024 reporting periods, reflecting evolving clinical priorities and methodological challenges in measuring acute surgical care.

### Original Definition: Time to Surgery (2023 Report)
In the 2023 annual report, Indikator 5 was defined as a process indicator measuring the proportion of patients who were operated on within six hours (360 minutes) of arriving at the hospital, specifically among those who underwent surgery within 24 hours of arrival [^src2]. The performance standard for this metric was set at ≥ 80% [^src1]. However, the initial results showed severe underperformance regarding this standard, prompting the database's steering group to develop a supplementary metric, [[indikator-5x|Indikator 5x]], to sharpen the focus on the most critical patient groups with life-threatening conditions [^src3]. 

### Redefinition: Intermediate Care Admission (2024 Report)
By the 2024 report, Indikator 5 was redefined to focus on postoperative care rather than surgical speed. It now measures [[intermediaer-indlaeggelse]] (intermediate care admission), specifically tracking the proportion of high-risk patients—defined as those aged 75 or older, or those with a preoperative [[asa-score|ASA]] score of ≥ 3—who are monitored for at least 24 hours postoperatively in an intermediate or similar department [^src5]. The performance standard for this redefined indicator remains ≥ 80% [^src4].

Methodological evaluations for the new indicator considered various risk scoring models. [[p-possum|P-POSSUM]] and [[apache|APACHE]] were assessed as too comprehensive for practical, everyday use in connection with Indikator 5 [^src5]. Additionally, the [[surgical-apgar-score|Surgical Apgar Score]] was noted to be unsuitable because it excludes risk patients who are not physiologically stressed during the perioperative phase [^src5].

### Performance and Regional Variations
For the measurement period covering September 1, 2023, to August 31, 2024, the national fulfillment of the new Indikator 5 was significantly below the standard. Out of 2,003 high-risk patients, only 459 (22.9%) were admitted for special postoperative monitoring [^src6]. The overall national proportion was 22.9% (95% CI: 21.1–24.8) [^src5].

There was notable regional variation in compliance, with the proportion of intermediate care admissions ranging from 17.2% in [[region-nordjylland|Region Nordjylland]] to 27.0% in [[region-syddanmark|Region Syddanmark]] [^src5]. Data quality also presented challenges; missing information varied from 1% in [[region-sjaelland|Region Sjælland]] to 15% in [[region-midtjylland|Region Midtjylland]] [^src5]. Overall, 5% of observations lacked necessary information, primarily driven by missing data in Region Midtjylland [^src5].

### Chronology
The timeline for Indikator 5's data collection reflects the transition between its two definitions. The measurement period for the original surgical speed indicator ran from September 1, 2022, to August 31, 2023 [^src1]. Following the redefinition, the registration of data for the new intermediate care indicator took place from September 1, 2023, to August 31, 2024 [^src4].

***

## Mentions

- **Page 6**: "Indikator 5: Andelen af patienter, der opereres indenfor seks timer (360 minutter) efter ankomst til sygehus for patienter, der er opereret indenfor 24 timer efter ankomst til sygehus." [^src1]
- **Page 7**: "Indikator 5: Andelen af patienter, der opereres indenfor seks timer (360 minutter) efter ankomst til sygehus for patienter, der er opereret indenfor 24 timer efter ankomst til sygehus." [^src1]
- **Page 16**: "Indikator 5: Operation indenfor 6 timer" [^src2]
- **Page 21**: "Indikator 5" [^src3]
- **Page 6**: "Indikator 5: Andelen af ældre (>= 75 år) eller svært syge (ASA >= 3) patienter, der monitoreres >= 24 timer postoperativt på et intermediært afsnit eller et lignende afsnit." [^src4]
- **Page 31**: "Indikatorbeskrivelse for indikator 5" [^src5]
- **Page 31**: "Indikator 5 beskriver andelen af patienter, der får vurderet postoperativ risiko høj (ASA ≥ 3) eller har høj alder (alder ≥ 75 år), og som monitoreres ≥ 24 timer postoperativt på et intermediært eller lignende afsnit." [^src5]
- **Page 96**: "Indikator 5: Intermediær indlæggelse" [^src6]

## Relationships

### Outgoing
- **Subject**: indikator-5 | **Predicate**: belongs-to-database | **Object**: akut-kirurgi-databasen
  - **Evidence**: "Indikator 5: Andelen af patienter, der opereres indenfor seks timer (360 minutter) efter ankomst til sygehus for patienter, der er opereret indenfor 24 timer efter ankomst til sygehus."
  - **Page**: 6 [^src1]
- **Subject**: indikator-5 | **Predicate**: has-supplementary-version | **Object**: indikator-5x
  - **Evidence**: "Supplerende indikator 5x er en supplerende indikator til Indikator 5"
  - **Page**: 21 [^src3]
- **Subject**: indikator-5 | **Predicate**: measures | **Object**: intermediaer-indlaeggelse
  - **Evidence**: "Indikator 5 beskriver andelen af patienter, der får vurderet postoperativ risiko høj (ASA ≥ 3) eller har høj alder (alder ≥ 75 år), og som monitoreres ≥ 24 timer postoperativt på et intermediært eller lignende afsnit."
  - **Page**: 31 [^src5]
- **Subject**: indikator-5 | **Predicate**: uses-criteria | **Object**: asa-score
  - **Evidence**: "Vi har valgt at klassificere personer med ASA-score* ≥ 3 (dvs. lav helbredsstatus før operationen) eller som er > 75 år gamle, som personer i høj risiko."
  - **Page**: 96 [^src6]

### Incoming
- **Subject**: region-nordjylland | **Predicate**: has-result-for | **Object**: indikator-5
  - **Evidence**: "Regionalt varierede andelen fra 17,2 % i Region Nordjylland til 27,0 % i Region Syddanmark."
  - **Page**: 31 [^src5]
- **Subject**: region-syddanmark | **Predicate**: has-result-for | **Object**: indikator-5
  - **Evidence**: "Regionalt varierede andelen fra 17,2 % i Region Nordjylland til 27,0 % i Region Syddanmark."
  - **Page**: 31 [^src5]

## Claims

### standard
- Indikator 5 har en standard på ≥ 80 % for andelen af patienter, der opereres indenfor seks timer (360 minutter) efter ankomst til sygehus for patienter, der er opereret indenfor 24 timer efter ankomst til sygehus [^src1]

### regulatory
- Standarden for Indikator 5 er ≥ 80 % [^src1]

### definitional
- Indikator 5 er defineret som andelen af patienter, der opereres inden for seks timer efter ankomst til sygehus for patienter, der er opereret inden for 24 timer efter ankomst til sygehus [^src1]

### performance-standard
- Indikator 5 har en standard på ≥ 80 % for andelen af ældre (≥ 75 år) eller svært syge (ASA ≥ 3) patienter, der monitoreres ≥ 24 timer postoperativt på et intermediært afsnit [^src1]

### clinical-quality
- Andelen af patienter med høj mortalitetsrisiko (ASA ≥ 3 eller alder ≥ 75 år), der monitoreres ≥ 24 timer postoperativt på et intermediært eller lignende afsnit, er 22,9 % (95 % CI: 21,1–24,8) [^src1]

### regional-comparison
- Regionalt varierede andelen af intermediær indlæggelse fra 17,2 % i Region Nordjylland til 27,0 % i Region Syddanmark [^src1]

### data-quality
- Andelen af patienter, der mangler information, varierer fra 1 % i Region Sjælland til 15 % i Region Midtjylland [^src1]
- 5 % af observationerne mangler informationer, primært i Region Midtjylland [^src1]

### methodological-assessment
- P-POSSUM og APACHE vurderes som for omfattende til praktisk brug i forbindelse med Indikator 5 [^src1]
- Surgical Apgar Score ekskluderer risikopatienter, der ikke er fysiologisk stressede peroperativt [^src1]

### performance
- Ud af 2.003 patienter med høj risiko blev 459 (22,9 %) indlagt til særlig overvågning [^src1]

## Timeline

- **2022-09-01**: Start af måleperioden for indikatorresultaterne (01.09.2022 – 31.08.2023) [^src1]
- **2022-09-01**: Måleperioden for Indikator 4 og 5 starter den 1. september 2022 [^src1]
- **2023-08-31**: Afslutning af måleperioden for indikatorresultaterne (01.09.2022 – 31.08.2023) [^src1]
- **01.09.2023 - 31.08.2024**: Registrering af data for Indikator 5 i Akut Kirurgi Databasen [^src4]

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 16-20
[^src3]: AKDB_2023.pdf, pages 21-25
[^src4]: AKDB_2024.pdf, pages 6-10
[^src5]: AKDB_2024.pdf, pages 31-35
[^src6]: AKDB_2024.pdf, pages 96-100
