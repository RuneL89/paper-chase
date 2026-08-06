---
title: Indikator 9
type: entity
aliases:
  - Indikator 9
wiki: rkkp-akdb
updated: '2026-08-05T18:40:21.241Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '41-45, 46-50, 6-10'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '101-105, 51-55, 6-10, 96-100'
tags:
  - indicator
---
**Indikator 9** is a clinical quality indicator tracked within the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] (AKDB), a national quality monitoring program for acute high-risk abdominal surgery in Denmark. The indicator is evaluated by the database's [[styregruppen|Styregruppen]] (steering group) [^src2]. Notably, the definition and focus of Indikator 9 underwent a significant shift between the 2023 and 2024 annual reports, changing from a process indicator regarding anesthesia to an outcome indicator measuring mortality.

### 2023 Reporting Period: Epidural Anesthesia
During the measurement period from September 1, 2022, to August 31, 2023, Indikator 9 was defined as a process indicator measuring the proportion of patients who received an [[epidural|epidural]] in connection with their surgery [^src1]. The regulatory standard for this indicator was set at > 60% [^src1]. Nationally, 53.0% of the 3,147 operated patients met this standard (95% CI: 51.2-54.7) [^src2]. 

At the hospital level, several institutions successfully met the standard, including [[aarhus-universitetshospital|Aarhus Universitetshospital]] (70.5%), [[regionshospitalet-horsens|Regionshospitalet Horsens]] (66.7%), [[esbjerg-sygehus-grindsted-sygehus|Esbjerg Sygehus Grindsted Sygehus]] (65.6%), [[regionshospitalet-goedstrup|Regionshospitalet Gødstrup]] (63.3%), and [[odense-universitetshospital-svendborg|Odense Universitetshospital - Svendborg]] (60.9%) [^src2]. Conversely, [[regionshospital-nordjylland|Regionshospital Nordjylland]] did not meet the standard, achieving only 29.5% [^src2]. The indicator faced practical implementation challenges; notably, [[regionshospitalet-randers|Regionshospitalet Randers]] proposed that the indicator be made voluntary or removed entirely, citing the heavy administrative burden of retrospective registration [^src2].

### 2024 Reporting Period: 30-Day Mortality
For the subsequent measurement period from September 1, 2023, to August 31, 2024, Indikator 9 was redefined as an outcome indicator measuring 30-day mortality following acute surgery for all operated patients with relevant diagnosis and procedure codes [^src4]. The performance standard and development goal for this new definition was set at < 12% [^src5]. 

In this period, 3,179 patient courses were included in the analysis for Indikator 9 and the related [[indikator-10|Indikator 10]] [^src5]. Of these, 376 patients died within 30 days of hospital arrival, resulting in a national mortality rate of 11.8% (95% CI: 10.7-13.0) [^src6]. Supplementary analyses attempting to correlate mortality with Charlson Comorbidity Index scores encountered data quality issues. Audits revealed discrepancies in the Charlson scores, particularly among patients in the "score 0" population who were of advanced age, rendering the background variables unreliable for precise risk-adjusted calculations [^src7].

---

## Mentions

- Page 6: "Indikator 9: Andelen af patienter, der har fået anlagt epidural i forbindelse med operationen" [^src1]
- Page 7: "Indikator 9: Andelen af patienter, der har fået anlagt epidural i forbindelse med operationen" [^src1]
- Page 41: "Indikator 9: Andel opererede med epidural" [^src2]
- Page 46: "Indikator 9" [^src3]
- Page 6: "Indikator 9: Andelen af patienter, der dør indenfor 30 dage fra operationsdato for alle opererede (med relevant diagnosekode og procedurekode)" [^src4]
- Page 51: "Indikator 9: Mortalitet indenfor 30 dage efter akut kirurgi. Alle opererede (med relevant diagnosekode og procedurekode)" [^src5]
- Page 96: "Indikator 9: Mortalitet indenfor 30 dage efter akut kirurgi. Alle opererede (med relevant diagnosekode og procedurekode)" [^src6]
- Page 101: "I relation til Indikator 9: Andel af patienter der dør indenfor 30 dage, er der supplerende opgørelse på Charleson score. Her har man på begge hospitalet auditeret på patienterne. Der findes at Charlescon scorer ikke passer, der er således ingen af patienter i score 0 populationen der burde være score 0, idet de alle har høj alder, men idet det er uklaart hvor baggrundsvariabler til udregning er hentet fra er det ikke muligt helt at anvende data." [^src7]

## Relationships

### Outgoing
- **Subject:** indikator-9 | **Predicate:** belongs-to-database | **Object:** akut-kirurgi-databasen
  - **Evidence:** "Indikator 9: Andelen af patienter, der har fået anlagt epidural i forbindelse med operationen"
  - **Page:** 6 [^src1]
- **Subject:** indikator-9 | **Predicate:** is-evaluated-by | **Object:** styregruppen
  - **Evidence:** "Styregruppen har modtaget ønske om en kode der hedder ”Ernæring genoptaget”."
  - **Page:** 41 [^src2]
- **Subject:** indikator-9 | **Predicate:** measures | **Object:** epidural
  - **Evidence:** "Indikator 9 beskriver andelen af patienter, der får anlagt epidural i forbindelse med operationen"
  - **Page:** 46 [^src3]
- **Subject:** indikator-9 | **Predicate:** measures-outcome-for | **Object:** akut-kirurgi-databasen
  - **Evidence:** "Indikator 9: Andelen af patienter, der dør indenfor 30 dage fra operationsdato for alle opererede (med relevant diagnosekode og procedurekode)"
  - **Page:** 6 [^src4]
- **Subject:** indikator-9 | **Predicate:** is-calculated-from | **Object:** akut-kirurgi-databasen
  - **Evidence:** "Indikator 9: Mortalitet indenfor 30 dage efter akut kirurgi. Alle opererede (med relevant diagnosekode og procedurekode)"
  - **Page:** 51 [^src5]
- **Subject:** indikator-9 | **Predicate:** has-development-goal | **Object:** indikator-9-development-goal
  - **Evidence:** "Udviklingsmål < 12 %"
  - **Page:** 51 [^src5]

### Incoming
- **Subject:** esbjerg-sygehus-grindsted-sygehus | **Predicate:** meets-standard-of | **Object:** indikator-9
  - **Evidence:** "Esbjerg Sygehus Grindsted Sygehus Ja 86 / 131 0 (0) 65,6 (56,9-73,7) 43,2 38,6"
  - **Page:** 41 [^src2]
- **Subject:** odense-universitetshospital-svendborg | **Predicate:** meets-standard-of | **Object:** indikator-9
  - **Evidence:** "Odense Universitetshospital - Svendborg Ja 140 / 230 0 (0) 60,9 (54,2-67,2) 28,9 5,7"
  - **Page:** 41 [^src2]
- **Subject:** aarhus-universitetshospital | **Predicate:** meets-standard-of | **Object:** indikator-9
  - **Evidence:** "Aarhus Universitetshospital Ja 98 / 139 0 (0) 70,5 (62,2-77,9) 63,7 68,6"
  - **Page:** 41 [^src2]
- **Subject:** regionshospitalet-goedstrup | **Predicate:** meets-standard-of | **Object:** indikator-9
  - **Evidence:** "Regionshospitalet Gødstrup Ja 100 / 158 0 (0) 63,3 (55,3-70,8) 59,7 47,8"
  - **Page:** 41 [^src2]
- **Subject:** regionshospitalet-horsens | **Predicate:** meets-standard-of | **Object:** indikator-9
  - **Evidence:** "Regionshospitalet Horsens Ja 62 / 93 0 (0) 66,7 (56,1-76,1) 58,2 60,2"
  - **Page:** 41 [^src2]
- **Subject:** regionshospitalet-randers | **Predicate:** proposes-to-modify | **Object:** indikator-9
  - **Evidence:** "Fra Randers foreslås det, at indikatoren gøres frivillig eller fjernes, da den kræver meget efterregistrering."
  - **Page:** 41 [^src2]
- **Subject:** regionshospital-nordjylland | **Predicate:** does-not-meet-standard-of | **Object:** indikator-9
  - **Evidence:** "Regionshospital Nordjylland Nej 28 / 95 0 (0) 29,5 (20,6-39,7) 34,2 43,0"
  - **Page:** 41 [^src2]

## Claims

### Standard
- Indikator 9 har en standard på > 60 % for andelen af patienter, der har fået anlagt epidural i forbindelse med operationen [^src1]

### Regulatory Standard
- Standarden for indikator 9 er > 60 % [^src1]

### Quality Metric
- Nationalt opfyldte 53,0 % af de 3.147 opererede patienter indikator 9 (95 % CI: 51,2-54,7) [^src1]

### Performance Standard
- Indikator 9 har en standard på < 12 % for 30-dages mortalitet blandt alle opererede patienter med relevant diagnose- og procedurekode [^src1]

### Performance Goal
- Indikator 9 har udviklingsmål på < 12 % [^src1]

### Data Volume
- I perioden 01.09.2023 – 31.08.2024 indgik 3.179 forløb i indikatoranalysen for Indikator 9 og Indikator 10 [^src1]

### Outcome
- Der indgik 3.179 forløb i indikatoranalysen i perioden. Heraf døde 376 personer, svarende til 11,8 % (95 % CI: 10,7-13,0) indenfor 30 dage fra ankomst til sygehus [^src1]

## Timeline

- **2022-09-01:** Start af måleperioden for indikatorresultaterne (01.09.2022 – 31.08.2023) (indikator-1, indikator-3, indikator-4, indikator-5, indikator-6, indikator-7, indikator-8, indikator-9, indikator-10, indikator-11)
- **2023-08-31:** Afslutning af måleperioden for indikatorresultaterne (01.09.2022 – 31.08.2023) (indikator-1, indikator-3, indikator-4, indikator-5, indikator-6, indikator-7, indikator-8, indikator-9, indikator-10, indikator-11)
- **01.09.2022 - 31.08.2023:** Rapportperioden for indikator 8 og 9, hvor data blev indsamlet fra Akut Kirurgi Databasen (indikator-8, indikator-9, akut-kirurgi-databasen)
- **2023-09-01:** Start af måleperioden for Indikator 9 og Indikator 10 i 2024-årsrapporten (indikator-9, indikator-10)
- **2024-08-31:** Afslutning af måleperioden for Indikator 9 og Indikator 10 i 2024-årsrapporten (indikator-9, indikator-10)

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 41-45
[^src3]: AKDB_2023.pdf, pages 46-50
[^src4]: AKDB_2024.pdf, pages 6-10
[^src5]: AKDB_2024.pdf, pages 51-55
[^src6]: AKDB_2024.pdf, pages 96-100
[^src7]: AKDB_2024.pdf, pages 101-105
