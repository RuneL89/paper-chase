---
title: Bornholms Hospital
type: entity
aliases:
  - Bornholms Hospital
wiki: rkkp-akdb
updated: '2026-08-05T18:42:39.168Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '21-25, 56-60, 6-10, 61-65, 71-75'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '51-55, 6-10, 61-65, 71-75'
tags:
  - organization
---
Bornholms Hospital is a Danish hospital evaluated in the national Acute Surgery Database (AKDB) reports published by the Danish Regions' Clinical Quality Development Programme (RKKP). The hospital is tracked across multiple clinical quality indicators measuring the safety, efficiency, and outcomes of acute abdominal surgery.

In the 2023 AKDB report, Bornholms Hospital gained particular attention for its results on [[indikator-1|Indikator 1]], which measures antibiotic treatment within three hours. For the period from September 1, 2022, to August 31, 2023, the hospital achieved a compliance rate of 63.3% (95% CI: 43.9–80.1) [^src1]. This result was noted as the absolute highest among all listed hospitals and significantly above the national average [^src1]. The hospital was also assessed on the supplementary [[indikator-5x|Indikator 5x]], which tracks the speed of surgical intervention for life-threatening conditions like perforation or ischemia, achieving a rate of 54.5% (95% CI: 23.4–83.3) [^src2].

Regarding patient outcomes and demographics, the 2023 report indicates that out of 30 operated patients at Bornholms Hospital, none had a cancer diagnosis [^src3]. Furthermore, when evaluating 30-day mortality for patients with light to moderate comorbidity ([[charlson-score-1-2|Charlson Score = 1 eller 2]]), the hospital reported zero deaths out of 7 patients (0.0%; 95% CI: 0.0–41.0) [^src4]. 

The hospital's regional classification within the database presents a notable discrepancy in the extracted data. While it is grouped under [[hovedstaden-region-i-alt|Hovedstaden Region i alt]] and [[region-hovedstaden|Region Hovedstaden]] in the database's tables [^src3] [^src4], an analytical note within the evidence explicitly asserts that Bornholms Hospital is located in Region Sjælland and labels the Region Hovedstaden classification as an error [^src2]. 

The 2024 AKDB report continues to track the hospital's performance across similar metrics. It records an Indikator 1 compliance of 38.5% (10 out of 26 patients) [^src6], a supplementary indicator rate of 11.5% (3 out of 26) [^src7], and ongoing monitoring of mortality and demographic distributions [^src8] [^src9].

## Mentions
- Page 8: "Bornholms Hospital Nej 19 / 30 0 (0) 63,3 (43,9-80,1) 31,8 41,4" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10)
- Page 21: "Bornholms Hospital Nej 6 / 11 0 (0) 54,5 (23,4-83,3)" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25)
- Page 56: "Bornholms Hospital" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60)
- Page 61: "Bornholms Hospital 0 / 7 0 (0) 0,0 (0,0-41,0) 12,5 9,1" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65)
- Page 71: "Bornholms Hospital 32 2,5 47,00 68,00 64,48 82,00" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 71-75)
- Page 6: "Bornholms Hospital Nej 10 / 26 0 (0) 38,5 (20,2-59,4) 63,3 31,8" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10)
- Page 51: "Bornholms Hospital Ja 3 / 26 0 (0) 11,5 (2,4-30,2) 10,0 13,0" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 51-55)
- Page 61: "Bornholms Hospital 0 / 10 0 (0) 0,0 (0,0-30,8) 0,0 14,3" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 61-65)
- Page 71: "Bornholms Hospital 32 2,5 47,00 68,00 64,48 82,00" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 71-75)

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: bornholms-hospital
  Predicate: has-indicator-result
  Object: indikator-1
  Evidence: "Bornholms Hospital Nej 19 / 30 0 (0) 63,3 (43,9-80,1) 31,8 41,4"
  Page: 8
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10
- Subject: bornholms-hospital
  Predicate: is-part-of
  Object: hovedstaden-region-i-alt
  Evidence: "Bornholms Hospital er listet under Hovedstaden Region i alt i tabellen"
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60

Incoming (this entity is the OBJECT of these relationships):
- Subject: region-hovedstaden
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Bornholms Hospital er beliggende i Region Sjælland — dette er en fejl i relationen; Bornholms Hospital er ikke i Hovedstaden — korrekt relation er 'sjælland contains-bornholms-hospital'"
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25
- Subject: region-hovedstaden
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Hovedstaden 36 / 396 [...] Bornholms Hospital 0 / 7"
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65

## Claims
- For Indikator 1 var andelen ved Bornholms Hospital i perioden 01.09.2022–31.08.2023 63,3 % (95 % CI: 43,9–80,1) [^src1] (indikator-1, bornholms-hospital)
  Type: performance
  Page: 8
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10
- Bornholms Hospital havde en andel på 54,5 % (95 % CI: 23,4–83,3) for supplerende indikator 5x [^src1] (bornholms-hospital, indikator-5x)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25
- Bornholms Hospital: 30 opererede patienter, hvoraf ingen havde kræftdiagnose [^src1] (bornholms-hospital)
  Type: cancer-distribution
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60
- Bornholms Hospital: 0 / 7 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (0,0 %; 95 % CI: 0,0-41,0) [^src1] (bornholms-hospital, charlson-score-1-2)
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
