---
title: Data Quality
type: topic
aliases:
  - Data Quality
wiki: rkkp-akdb
updated: '2026-08-05T19:36:50.076Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '11-15, 51-55'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '101-105, 31-35'
tags:
  - data-quality
---

Data quality within the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] is a critical factor that directly impacts the reliability of clinical indicators and regional performance assessments. Across the 2023 and 2024 reports, several data inconsistencies and missing information issues have been documented, highlighting ongoing challenges in maintaining complete and accurate registries for acute surgery patients.

One prominent issue involves the exclusion of patient records due to invalid personal identification numbers. Specifically, 53 exclusions were registered due to invalid CPR numbers [^src1]. Such administrative errors reduce the overall completeness of the database and can skew national statistics. Furthermore, missing data fields have led to severe anomalies in reported outcomes. For instance, [[nykoebing-f-sygehus|Nykøbing F Sygehus]] reported a 90-day mortality rate of 100.0% for [[indikator-11|Indikator 11]], but this figure was accompanied by missing numerator and denominator data ('#/#'), rendering the statistic clinically uninterpretable [^src2].

Regional disparities in data completeness also affect the evaluation of specific quality indicators. For [[indikator-5|Indikator 5]], the proportion of patients missing information varies significantly across regions, ranging from 1% in [[region-sjaelland|Region Sjælland]] to 15% in [[region-midtjylland|Region Midtjylland]] [^src3]. Overall, 5% of observations lack necessary information, with the majority of these gaps occurring in Region Midtjylland [^src3]. 

Finally, structural inconsistencies between aggregated national figures and detailed patient-level data have been identified. In the context of [[indikator-10|Indikator 10]], there is a notable discrepancy between the national count of operated patients (3,668) and the sum of patients with recorded arrival and operation times (2,452) [^src4]. These data quality issues underscore the need for rigorous validation protocols to ensure that clinical databases accurately reflect patient care and outcomes.

## Claims

- Der blev registreret 53 eksklusioner på grund af ugyldigt CPR-nummer [^src1] (akut-kirurgi-databasen)
  Type: data-quality
  Page: 11
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 11-15
- Nykøbing F Sygehus har en rapporteret 90-dages mortalitet på 100,0 % (95 % CI: 15,8–100,0) for Indikator 11, men med manglende tæller/nævner-data ('#/#') [^src1] (nykoebing-f-sygehus, indikator-11)
  Type: data-quality
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 51-55
- Andelen af patienter, der mangler information, varierer fra 1 % i Region Sjælland til 15 % i Region Midtjylland [^src1] (region-sjaelland, region-midtjylland, indikator-5)
  Type: data-quality
  Page: 31
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 31-35
- 5 % af observationerne mangler informationer, primært i Region Midtjylland [^src1] (region-midtjylland, indikator-5)
  Type: data-quality
  Page: 31
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 31-35
- Der er en uoverensstemmelse mellem det nationale antal opererede patienter (3668) og summen af patienter med angivet ankomst- og operations-tidspunkt (2452) i forbindelse med indikator 10 [^src1] (indikator-10)
  Type: data-inconsistency
  Page: 101
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 101-105

## Sources

[^src1]: AKDB_2023.pdf, pages 11-15
[^src2]: AKDB_2023.pdf, pages 51-55
[^src3]: AKDB_2024.pdf, pages 31-35
[^src4]: AKDB_2024.pdf, pages 101-105
