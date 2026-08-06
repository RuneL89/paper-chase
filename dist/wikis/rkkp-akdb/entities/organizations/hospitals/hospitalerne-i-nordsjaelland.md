---
title: Hospitalerne i Nordsjælland
type: entity
aliases:
  - Hospitalerne i Nordsjælland
wiki: rkkp-akdb
updated: '2026-08-05T18:44:53.072Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '21-25, 56-60, 6-10, 61-65, 71-75'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '51-55, 6-10, 61-65, 71-75'
tags:
  - organization
---
# Hospitalerne i Nordsjælland

**Hospitalerne i Nordsjælland** is a hospital unit in Denmark that is tracked in the national clinical quality database for acute surgery (Akut Kirurgi Databasen, AKDB). The unit's performance is monitored across multiple clinical indicators, reflecting its role in the Danish healthcare system's quality assurance and benchmarking efforts. In the AKDB reports, the unit is listed under both [[region-hovedstaden|Region Hovedstaden]] and [[region-sjaelland|Region Sjælland]], and its data is aggregated within the broader [[sjaelland-region-i-alt|Sjælland Region i alt]] category [^src2] [^src3] [^src4].

For the period from September 1, 2022, to August 31, 2023, the unit's compliance with [[indikator-1|Indikator 1]] (which measures timely antibiotic treatment) was 37.1% [^src1]. In the subsequent reporting period (September 1, 2023, to August 31, 2024), this compliance rate improved to 45.8% [^src6]. 

The unit is also evaluated on supplementary indicators. For [[indikator-5x|Indikator 5x]], which measures the speed of surgical intervention for life-threatening conditions, Hospitalerne i Nordsjælland recorded a rate of 25.3% (95% CI: 16.7–35.5) in the 2023 report [^src2]. In the 2024 report, a related metric on pages 51-55 showed a rate of 13.7% (95% CI: 9.3-19.2) [^src7]. 

Regarding patient outcomes and demographics, the 2023 report noted that out of 214 operated patients at the unit, 4 (0.13%) had gastrointestinal cancers and 4 (0.13%) had other cancers [^src3]. When analyzing 30-day mortality after acute surgery for patients with mild to moderate comorbidity ([[charlson-score-1-2|Charlson Score = 1 eller 2]]), 8 out of 69 patients died (11.6%; 95% CI: 5.1-21.6) [^src4]. In the 2024 report, this specific mortality metric showed 4 deaths out of 82 patients (4.9%; 95% CI: 1.3-12.0) [^src8]. The unit's demographic distributions, including age and gender statistics, are also detailed in both the 2023 and 2024 reports [^src5] [^src9].

## Mentions

- Page 8: "Hospitalerne i Nordsjælland Nej 78 / 210 0 (0) 37,1 (30,6-44,1) 29,9 16,2" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10)
- Page 21: "Hospitalerne i Nordsjælland Nej 23 / 91 0 (0) 25,3 (16,7-35,5)" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25)
- Page 56: "Hospitalerne i Nordsjælland" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60)
- Page 61: "Hospitalerne i Nordsjælland 8 / 69 0 (0) 11,6 (5,1-21,6) 6,5 8,2" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65)
- Page 71: "Hospitalerne i Nordsjælland 240 18,5 58,00 71,00 67,95 79,00" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 71-75)
- Page 6: "Hospitalerne i Nordsjælland Nej 92 / 201 0 (0) 45,8 (38,7-52,9) 37,1 29,9" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10)
- Page 51: "Hospitalerne i Nordsjælland Ja 28 / 204 0 (0) 13,7 (9,3-19,2) 19,2 16,4" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 51-55)
- Page 61: "Hospitalerne i Nordsjælland 4 / 82 0 (0) 4,9 (1,3-12,0) 7,6 10,8" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 61-65)
- Page 71: "Hospitalerne i Nordsjælland 240 18,5 58,00 71,00 67,95 79,00" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 71-75)

## Relationships

Outgoing (this entity is the SUBJECT of these relationships):
- Subject: hospitalerne-i-nordsjaelland
  Predicate: has-indicator-result
  Object: indikator-1
  Evidence: "Hospitalerne i Nordsjælland Nej 78 / 210 0 (0) 37,1 (30,6-44,1) 29,9 16,2"
  Page: 8
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10
- Subject: hospitalerne-i-nordsjaelland
  Predicate: is-part-of
  Object: sjaelland-region-i-alt
  Evidence: "Hospitalerne i Nordsjælland er listet under Sjælland Region i alt i tabellen"
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60

Incoming (this entity is the OBJECT of these relationships):
- Subject: region-hovedstaden
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Hospitalerne i Nordsjælland er beliggende i Region Hovedstaden"
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25
- Subject: region-sjaelland
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Sjælland 28 / 180 [...] Hospitalerne i Nordsjælland 8 / 69"
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65

## Claims

- Hospitalerne i Nordsjælland havde en andel på 25,3 % (95 % CI: 16,7–35,5) for supplerende indikator 5x [^src1] (hospitalerne-i-nordsjaelland, indikator-5x)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25
- Hospitalerne i Nordsjælland: 214 opererede patienter, hvoraf 4 (0,13 %) havde gastrointestinale kræftsygdomme og 4 (0,13 %) resten af kræftsygdomme [^src1] (hospitalerne-i-nordsjaelland)
  Type: cancer-distribution
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60
- Hospitalerne i Nordsjælland: 8 / 69 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (11,6 %; 95 % CI: 5,1-21,6) [^src1] (hospitalerne-i-nordsjaelland, charlson-score-1-2)
  Type: hospital-statistic
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65

## Timeline

(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 21-25
[^src3]: AKDB_2023.pdf, pages 56-60
[^src4]: AKDB_2023.pdf, pages 61-65
[^src5]: AKDB_2023.pdf, pages 71-75
[^src6]: AKDB_2024.pdf, pages 6-10
[^src7]: AKDB_2024.pdf, pages 51-55
[^src8]: AKDB_2024.pdf, pages 61-65
[^src9]: AKDB_2024.pdf, pages 71-75
