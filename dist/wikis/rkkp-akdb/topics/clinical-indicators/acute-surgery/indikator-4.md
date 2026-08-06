---
title: Indikator 4
type: entity
aliases:
  - Indikator 4
wiki: rkkp-akdb
updated: '2026-08-05T18:33:11.618Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '16-20, 6-10'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '6-10, 96-100'
tags:
  - indicator
---
**Indikator 4** is a clinical process indicator within the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] (AKDB), designed to monitor and improve the quality of care for acute high-risk abdominal surgery patients in Denmark [^src1] [^src3]. The indicator's definition and focus evolved significantly between the 2023 and 2024 annual reports, reflecting ongoing methodological adjustments in the national quality monitoring program [^src2] [^src4].

In the 2023 report, Indikator 4 was defined as measuring the proportion of patients receiving "preoperative optimization or direct to surgery" (*præoperativ optimering eller direkte til operation*), with a stringent performance standard of ≥ 90% [^src1]. This was the first time the indicator was calculated in the annual report [^src2]. To capture this data, hospital departments were required to code pre-optimized patients using [[sks-kode-naaz42|SKS-koden NAAZ42]], which was established for reporting starting October 1, 2022 [^src2]. However, due to coding uncertainties, the database administrators recommended a transition to [[sor-koder|SOR koder]] to more accurately determine if a patient had stayed in an intensive, intermediate, or recovery bed prior to surgery [^src2]. The initial national results for this iteration were stark: out of 3,151 patients in the denominator, only 218 received preoperative optimization or went directly to surgery, yielding a national fulfillment rate of just 6.9% (95% CI 6.1–7.9), which fell far short of the 90% standard [^src2].

By the 2024 report, the indicator's focus had shifted to measuring the proportion of patients operated on within six hours (360 minutes) of hospital arrival, specifically among those operated on within 24 hours [^src3]. The performance standard was also revised to ≥ 80% for this new definition [^src3]. Under this updated framework, national performance data showed that out of 2,059 patients operated on within 24 hours, 618 were operated on within the 6-hour window, resulting in a national fulfillment rate of 30.0% [^src4]. This continued shortfall highlights systemic challenges and regional variations in implementing evidence-based processes, reducing wait times, and ensuring early hemodynamic stabilization for acute surgical patients across the Danish healthcare system [^src4].

The primary measurement period for these initial indicator results spanned from September 1, 2022, to August 31, 2023, aligning with the introduction of the new SKS code and the database's broader efforts to enforce transparency and clinical quality improvement [^src1] [^src2].

## Mentions
- Page 6: "Indikator 4: Præoperativ optimering eller direkte til operation" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10) [^src1]
- Page 7: "Indikator 4: Præoperativ optimering eller direkte til operation" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10) [^src1]
- Page 16: "Indikator 4: Præoperativ optimering eller direkte til operation" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 16-20) [^src2]
- Page 6: "Indikator 4: Andelen af patienter, der opereres indenfor seks timer (360 minutter) efter ankomst til sygehus for patienter, der er opereret indenfor 24 timer efter ankomst til sygehus." (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10) [^src3]
- Page 96: "Indikator 4: Operation indenfor 6 timer" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 96-100) [^src4]

## Relationships
- **Subject:** indikator-4 | **Predicate:** belongs-to-database | **Object:** akut-kirurgi-databasen
  - **Evidence:** "Indikator 4: Præoperativ optimering eller direkte til operation"
  - **Page:** 6
  - **Source:** wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10 [^src1]
- **Subject:** indikator-4 | **Predicate:** is-coded-by | **Object:** sks-kode-naaz42
  - **Evidence:** "For at kunne trække data skal afdelingerne kode patienterne, der præoptimeres med SKS-koden NAAZ42"
  - **Page:** 16
  - **Source:** wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 16-20 [^src2]
- **Subject:** indikator-4 | **Predicate:** is-recommended-to-be-measured-via | **Object:** sor-koder
  - **Evidence:** "Vi anbefaler at man skifter til SOR koder for at afgøre, om patienten har opholdt sig på en intensiv/intermediær eller opvågningsplads inden operation"
  - **Page:** 16
  - **Source:** wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 16-20 [^src2]

## Claims
- Indikator 4 har en standard på ≥ 90 % for andelen af patienter med præoperativ optimering eller direkte til operation [^src1] (indikator-4)
  Type: standard
  Page: 6
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10
- Indikator 4 er opgjort for første gang i indeværende årsrapport [^src1] (indikator-4)
  Type: procedural
  Page: 16
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 16-20
- I alt 3.151 patienter indgik i nævneren for Indikator 4, og heraf fik 218 enten præoperativ optimering eller gik direkte til operation [^src1] (indikator-4)
  Type: statistical
  Page: 16
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 16-20
- Den nationale andel for Indikator 4 er 6,9 % (95 % CI 6,1–7,9), hvilket ligger langt under standarden på ≥ 90 % [^src1] (indikator-4)
  Type: statistical
  Page: 16
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 16-20
- Indikator 4 har en standard på ≥ 80 % for andelen af patienter, der opereres inden for seks timer efter ankomst (blandt dem, der opereres inden for 24 timer) [^src1] (indikator-4)
  Type: performance-standard
  Page: 6
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10
- Ud af 2.059 patienter, der blev opereret inden for 24 timer, blev 618 opereret inden for 6 timer. Det svarer til 30,0 % på landsplan [^src1] (indikator-4)
  Type: performance
  Page: 96
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 96-100

## Timeline
- **2022-09-01:** Start af måleperioden for indikatorresultaterne (01.09.2022 – 31.08.2023) [^src1]
- **2022-09-01:** Måleperioden for Indikator 4 og 5 starter den 1. september 2022 [^src1]
- **2022-10-01:** SKS-koden NAAZ42 for præoperativ optimering blev oprettet og kan indberettes fra dette tidspunkt [^src2]
- **2023-08-31:** Afslutning af måleperioden for indikatorresultaterne (01.09.2022 – 31.08.2023) [^src1]

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 16-20
[^src3]: AKDB_2024.pdf, pages 6-10
[^src4]: AKDB_2024.pdf, pages 96-100
