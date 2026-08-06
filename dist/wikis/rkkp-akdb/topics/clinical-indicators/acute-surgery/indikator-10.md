---
title: Indikator 10
type: entity
aliases:
  - Indikator 10
wiki: rkkp-akdb
updated: '2026-08-05T18:39:09.414Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '46-50, 51-55, 6-10'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '101-105, 51-55, 56-60, 6-10, 96-100'
tags:
  - indicator
---
**Indikator 10** is a clinical quality result indicator within the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] (AKDB), which monitors the quality of acute high-risk abdominal surgery in [[danmark|Danmark]]. It is one of two mortality-related indicators in the database, designed to track postoperative survival and drive quality improvement across regions and hospitals.

### Evolution of the Metric: From 30 to 90 Days
Initially, Indikator 10 measured [[30-dages-mortalitet|30-day mortality]], defined as the proportion of patients who died within 30 days of their surgery date among all operated patients with relevant diagnosis and procedure codes [^src1]. The national standard for this metric was set at < 15% [^src1]. Data for the indicator is derived from the [[landspatientregisteret|Landspatientregisteret]] (LPR), applying strict exclusion criteria such as invalid CPR numbers, patients under 18, and those not primarily operated [^src2].

In the 2023 annual report (covering the period up to August 31, 2023), the national 30-day mortality was 11.3% across 3,142 patient courses, successfully meeting the < 15% standard for the fourth consecutive year [^src3]. Regional performance varied, with the lowest mortality in [[region-midtjylland|Region Midtjylland]] (9.9%) and the highest in [[region-nordjylland|Region Nordjylland]] (14.1%) [^src3]. Because roughly 30% of postoperative deaths occur between day 30 and day 90, the database later expanded its focus to capture a more comprehensive picture of postoperative survival [^src6].

By the 2024 annual report, Indikator 10 was redefined to measure [[mortality-within-90-days|90-day mortality]] [^src4]. The new performance standard and development goal was set at < 18% [^src4], [^src5]. For the measurement period of September 1, 2023, to August 31, 2024, the national 90-day mortality was 16.6% (529 deaths out of 3,179 courses), thereby fulfilling the national development goal [^src5], [^src6], [^src7]. Regional variation persisted, ranging from 15.7% in [[region-sjaelland|Region Sjælland]] to 19.6% in [[region-nordjylland|Region Nordjylland]] [^src6].

### Methodology and Clinical Critiques
To ensure fair benchmarking, the AKDB has proposed implementing the [[charlson-score|Charlson Score]] for risk adjustment, allowing mortality indicators (including Indikator 10 and [[indikator-9|Indikator 9]]) to be stratified by comorbidity groups [^src6]. 

Despite its utility, Indikator 10 has faced scrutiny regarding data quality and clinical relevance. [[regionshospital-nordjylland|Regionshospital Nordjylland]] highlighted a significant clinical nuance: many patients included in the indicator's denominator ultimately die from their underlying primary disease rather than postoperative complications, often being older with multiple comorbidities [^src8]. Furthermore, data inconsistencies have been identified, such as a discrepancy between the national count of operated patients (3,668) and the sum of patients with documented arrival and operation times (2,452) [^src8].

## Mentions
- Page 6: "Indikator 10: Andelen af patienter, der dør indenfor 30 dage fra operationsdato for alle opererede (med relevant diagnosekode og procedurekode)" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10)
- Page 7: "Indikator 10: Andelen af patienter, der dør indenfor 30 dage fra operationsdato for alle opererede (med relevant diagnosekode og procedurekode)" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10)
- Page 46: "Indikator 10: Mortalitet indenfor 30 dage for opererede. Resultater på afdelingsniveau" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 46-50)
- Page 51: "Indikator 10: Mortalitet indenfor 30 dage for opererede. Trendgraf over resultater på regionalt niveau" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 51-55)
- Page 6: "Indikator 10: Andelen af patienter, der dør indenfor 90 dage fra operationsdato for alle opererede (med relevant diagnosekode og procedurekode)" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10)
- Page 51: "Indikator 10: Mortalitet indenfor 90 dage efter akut kirurgi. Alle opererede (med relevant diagnosekode og procedurekode)" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 51-55)
- Page 56: "Supplerende opgørelser" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 56-60)
- Page 96: "Indikator 10: Mortalitet indenfor 90 dage efter akut kirurgi. Alle opererede (med relevant diagnosekode og procedurekode)" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 96-100)
- Page 101: "Er det muligt ift. indikator 10, så har Regionshospital Nordjylland gennemgået deres forløb og fundet at mange af de patienter som inkluderes dør af deres grundlidelse og ikke at postoperative komplikationer pga. et AHA forløb. Flere af disse patienter har ofte ældre og har flere comorbide diagnoser." (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 101-105)

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: indikator-10
  Predicate: belongs-to-database
  Object: akut-kirurgi-databasen
  Evidence: "Indikator 10: Andelen af patienter, der dør indenfor 30 dage fra operationsdato for alle opererede (med relevant diagnosekode og procedurekode)"
  Page: 6
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10
- Subject: indikator-10
  Predicate: measures
  Object: mortalitet-indenfor-30-dage
  Evidence: "Indikator 10: Mortalitet indenfor 30 dage efter akut kirurgi. Alle opererede (med relevant diagnosekode og procedurekode)"
  Page: 46
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 46-50
- Subject: indikator-10
  Predicate: measures
  Object: 30-dages-mortalitet
  Evidence: "Indikator 10 beskriver andelen af patienter, der dør indenfor 30 dage fra tidspunkt for operation"
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 51-55
- Subject: indikator-10
  Predicate: is-calculated-from
  Object: akut-kirurgi-databasen
  Evidence: "Indikator 10: Mortalitet indenfor 90 dage efter akut kirurgi. Alle opererede (med relevant diagnosekode og procedurekode)"
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 51-55
- Subject: indikator-10
  Predicate: has-development-goal
  Object: indikator-10-development-goal
  Evidence: "Udviklingsmål < 18 %"
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 51-55
- Subject: indikator-10
  Predicate: measures
  Object: mortality-within-90-days
  Evidence: "Indikator 10 beskriver andelen af patienter, der dør indenfor 90 dage fra tidspunkt for operation for alle med relevant operation og diagnose."
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 56-60

Incoming (this entity is the OBJECT of these relationships):
- Subject: landspatientregisteret
  Predicate: provides-codes-for
  Object: (this entity)
  Evidence: "Nævner Operationer, hvor patienter har operationstidspunkt og relevant diagnosekode og procedurekode"
  Page: 46
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 46-50
- Subject: region-midtjylland
  Predicate: has-lowest-30-day-mortality
  Object: (this entity)
  Evidence: "Regionalt varierede andelen fra 9,9 % i Region Midtjylland til 14,1 % i Region Nordjylland"
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 51-55
- Subject: region-nordjylland
  Predicate: has-highest-30-day-mortality
  Object: (this entity)
  Evidence: "Regionalt varierede andelen fra 9,9 % i Region Midtjylland til 14,1 % i Region Nordjylland"
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 51-55
- Subject: charlson-score
  Predicate: is-used-for-risk-adjustment-of
  Object: (this entity)
  Evidence: "Charlson Scoren ønskes indført, sådan at mortalitetsindikatorerne (Indikator 10, 11 og supplerende til indikator 10 og 11) kan opdeles baseret på komorbiditet i grupperne 0, 1 -2 og ≥ 3."
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 56-60
- Subject: regionshospital-nordjylland
  Predicate: identifies-data-inconsistency-in
  Object: (this entity)
  Evidence: "Er det muligt ift. indikator 10, så har Regionshospital Nordjylland gennemgået deres forløb og fundet at mange af de patienter som inkluderes dør af deres grundlidelse og ikke at postoperative komplikationer pga. et AHA forløb."
  Page: 101
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 101-105

## Claims
- Indikator 10 har en standard på < 15 % for andelen af patienter, der dør indenfor 30 dage fra operationsdato for alle opererede med relevant diagnosekode og procedurekode [^src1] (indikator-10)
  Type: standard
  Page: 6
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10
- Eksklusion: 53 Ugyldigt CPRnummer. 173 Patienten er under 18 år. 6.178 Patienten er ikke opereret. 5 Patienten er registreret i CPR-registeret som 'Inaktiv, uden bopæl i dansk/grønlandsk folkeregister men tildelt personnummer af skattehensyn (kommunekoderne 0010, 0011, 0012 og 0019)'. 474 Operationen er ikke den første operation i hospitalsopholdet. [^src1] (indikator-10)
  Type: exclusion-criteria
  Page: 46
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 46-50
- Der indgik 3.142 forløb i indikatoranalysen i perioden. Heraf døde 11,3 % (95 % CI: 10,2–12,5) indenfor 30 dage fra ankomst til sygehus [^src1] (indikator-10)
  Type: statistical
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 51-55
- Standarden på < 15 % var opfyldt på nationalt niveau for Indikator 10 [^src1] (indikator-10)
  Type: compliance
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 51-55
- Regionalt varierede andelen fra 9,9 % i Region Midtjylland til 14,1 % i Region Nordjylland for Indikator 10 [^src1] (region-midtjylland, region-nordjylland, indikator-10)
  Type: regional-comparison
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 51-55
- Alle regioner opfyldte standarden i perioden for Indikator 10 [^src1] (indikator-10)
  Type: compliance
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 51-55
- I alt 16 af de 21 indberettende enheder opfyldte standarden i perioden for Indikator 10 [^src1] (indikator-10)
  Type: compliance
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 51-55
- Det at mortaliteten nationalt er for 4. år i træk under indikator grænsen på 15%, tyder på at de seneste års indsatser allerede har slået igennem [^src1] (indikator-10)
  Type: interpretive
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 51-55
- Der foreslås at ny national standard er en mortalitet på 12% for Indikator 10 [^src1] (indikator-10)
  Type: policy-recommendation
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 51-55
- Indikator 10 har en standard på < 18 % for 90-dages mortalitet blandt alle opererede patienter med relevant diagnose- og procedurekode [^src1] (indikator-10)
  Type: performance-standard
  Page: 6
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10
- Indikator 10 har udviklingsmål på < 18 % [^src1] (indikator-10)
  Type: performance-goal
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 51-55
- Nationalt var andelen af patienter, der døde indenfor 90 dage fra operationsdato, 16,6 % (95 % CI: 15,4–18,0) i perioden 01.09.2023 – 31.08.2024 [^src1] (indikator-10, danmark)
  Type: clinical-outcome
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 51-55
- I perioden 01.09.2023 – 31.08.2024 indgik 3.179 forløb i indikatoranalysen for Indikator 9 og Indikator 10 [^src1] (indikator-9, indikator-10)
  Type: data-volume
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 51-55
- For Indikator 10 var antallet af døde patienter 529 ud af 3.179 forløb på nationalt plan [^src1] (indikator-10, danmark)
  Type: clinical-outcome
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 51-55
- Der indgik 3.179 patienter i indikatoranalysen for Indikator 10 i perioden [^src2] (indikator-10)
  Type: statistical
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 56-60
- Heraf døde 529 personer, svarende til 16,6 % (95 % CI: 15,4-18,0) indenfor 90 dage fra ankomst til sygehus [^src2] (indikator-10)
  Type: statistical
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 56-60
- Udviklingsmålet på < 18 % var opfyldt på nationalt niveau [^src2] (indikator-10)
  Type: performance
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 56-60
- Regionalt varierede andelen fra 15,7 % i Region Sjælland til 19,6 % i Region Nordjylland [^src2] (indikator-10, region-sjaelland, region-nordjylland)
  Type: statistical
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 56-60
- Blandt de indberettende enheder opfyldte 15 af de 20 udviklingsmålet i perioden [^src2] (indikator-10)
  Type: performance
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 56-60
- Ca. 30% af dødsfald efter indgreb er i perioden fra dag 30 til dag 90 [^src2] (indikator-10)
  Type: statistical
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 56-60
- Der indgik 3.179 patienter i indikatoranalysen i perioden. Heraf døde 529 personer, svarende til 16,6 % indenfor 90 dage fra ankomst til sygehus [^src1] (indikator-10)
  Type: outcome
  Page: 96
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 96-100
- Der er en uoverensstemmelse mellem det nationale antal opererede patienter (3668) og summen af patienter med angivet ankomst- og operations-tidspunkt (2452) i forbindelse med indikator 10 [^src1] (indikator-10)
  Type: data-inconsistency
  Page: 101
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 101-105

## Timeline
- 2022-09-01: Start af måleperioden for indikatorresultaterne (01.09.2022 – 31.08.2023) (indikator-1, indikator-3, indikator-4, indikator-5, indikator-6, indikator-7, indikator-8, indikator-9, indikator-10, indikator-11)
- 2023-08-31: Afslutning af måleperioden for indikatorresultaterne (01.09.2022 – 31.08.2023) (indikator-1, indikator-3, indikator-4, indikator-5, indikator-6, indikator-7, indikator-8, indikator-9, indikator-10, indikator-11)
- 2023-09-01: Start af måleperioden for Indikator 9 og Indikator 10 i 2024-årsrapporten (indikator-9, indikator-10)
- 2024-08-31: Afslutning af måleperioden for Indikator 9 og Indikator 10 i 2024-årsrapporten (indikator-9, indikator-10)
- 01.09.2023 - 31.08.2024: Indikator 10 målte mortalitet inden for 90 dage fra operation for patienter i perioden (indikator-10)

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 46-50
[^src3]: AKDB_2023.pdf, pages 51-55
[^src4]: AKDB_2024.pdf, pages 6-10
[^src5]: AKDB_2024.pdf, pages 51-55
[^src6]: AKDB_2024.pdf, pages 56-60
[^src7]: AKDB_2024.pdf, pages 96-100
[^src8]: AKDB_2024.pdf, pages 101-105
