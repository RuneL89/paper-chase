---
title: Rigshospitalet
type: entity
wiki: rkkp-akdb
updated: '2026-08-05T18:45:27.426Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '21-25, 36-40, 51-55, 56-60, 6-10, 61-65, 71-75'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '51-55, 6-10, 61-65, 71-75'
tags:
  - organization
---
**Rigshospitalet** is a major hospital located in [[region-hovedstaden|Region Hovedstaden]], Denmark, and is a key participant in the national acute surgery quality monitoring program managed by the Danish Regions' Clinical Quality Development Program (RKKP). Its performance is systematically tracked in the annual Acute Surgery Database (AKDB) reports, which evaluate clinical indicators for high-risk abdominal surgical patients.

In the AKDB reporting period from September 1, 2022, to August 31, 2023, Rigshospitalet struggled with several key quality metrics. Notably, it recorded the lowest fulfillment rate among the evaluated hospitals for [[indikator-1|Indikator 1]] (antibiotic treatment administered within three hours), achieving a compliance rate of only 17.5% [^src1]. In the subsequent 2024 report (covering September 2023 to August 2024), its Indikator 1 compliance slightly increased to 19.2% [^src8]. The hospital also recorded the lowest unit fulfillment for [[indikator-8|Indikator 8]] (early nutritional assessment), reaching just 5.2% [^src3]. Furthermore, it failed to meet the standard for [[indikator-11|Indikator 11]], reporting a 90-day mortality rate of 29.3% (95% CI: 18.1–42.7) [^src4]. For the supplementary [[indikator-5x|Indikator 5x]], which measures the speed of surgical intervention for life-threatening conditions, the hospital's point estimate was 6.3% [^src2].

Beyond standard process and mortality indicators, the database tracks patient composition and comorbidities to adjust quality benchmarks. Among 58 operated patients analyzed for cancer distribution, 3 were noted as having remaining cancer diseases [^src5]. When evaluating 30-day mortality for patients with light to moderate comorbidities—specifically those with a [[charlson-score-1-2|Charlson Score = 1 eller 2]]—Rigshospitalet reported a mortality rate of 10.0% (3 out of 30 patients) [^src6]. 

Administratively and statistically, Rigshospitalet is aggregated under the [[hovedstaden-region-i-alt|Hovedstaden Region i alt]] (Capital Region total) category in the database's regional tables [^src5]. However, in certain supplementary mortality tables stratified by comorbidity, its data appears adjacent to or within groupings associated with [[region-sjaelland|Region Sjælland]], reflecting the complex regional benchmarking structure of the AKDB reports [^src6].

## Mentions
- Page 8: "Rigshospitalet Nej 10 / 57 0 (0) 17,5 (8,7-29,9) 29,6 17,3" [^src1]
- Page 21: "Rigshospitalet Nej #/# 0 (0) 6,3 (0,8-20,8)" [^src2]
- Page 36: "Rigshospitalet 3 / 58 0 (0) 5,2 (1,1-14,4) 1,8 0,0" [^src3]
- Page 51: "Rigshospitalet" [^src4]
- Page 56: "Rigshospitalet" [^src5]
- Page 61: "Rigshospitalet 3 / 30 0 (0) 10,0 (2,1-26,5) 36,4 33,3" [^src6]
- Page 71: "Rigshospitalet 109 8,4 38,00 63,00 51,22 74,00" [^src7]
- Page 6: "Rigshospitalet Nej 10 / 52 0 (0) 19,2 (9,6-32,5) 15,8 29,1" [^src8]
- Page 51: "Rigshospitalet Nej 16 / 53 0 (0) 30,2 (18,3-44,3) 29,3 50,0" [^src9]
- Page 61: "Rigshospitalet #/# 0 (0) 9,1 (0,2-41,3) 30,0 36,4" [^src10]
- Page 71: "Rigshospitalet 109 8,4 38,00 63,00 51,22 74,00" [^src11]

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: rigshospitalet
  Predicate: has-indicator-result
  Object: indikator-1
  Evidence: "Rigshospitalet Nej 10 / 57 0 (0) 17,5 (8,7-29,9) 29,6 17,3"
  Page: 8
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10 [^src1]
- Subject: rigshospitalet
  Predicate: fails-standard-for
  Object: indikator-11
  Evidence: "Rigshospitalet Nej 17 / 58 0 (0) 29,3 (18,1-42,7) 49,1 39,2"
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 51-55 [^src4]
- Subject: rigshospitalet
  Predicate: is-part-of
  Object: hovedstaden-region-i-alt
  Evidence: "Rigshospitalet er listet under Hovedstaden Region i alt i tabellen"
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60 [^src5]

Incoming (this entity is the OBJECT of these relationships):
- Subject: region-hovedstaden
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Rigshospitalet er beliggende i Region Hovedstaden"
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25 [^src2]
- Subject: region-sjaelland
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Sjælland 28 / 180 [...] Rigshospitalet 3 / 30"
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65 [^src6]

## Claims
- Rigshospitalet havde et punktestimat på 6,3 % (95 % CI: 0,8–20,8) for supplerende indikator 5x [^src1] (rigshospitalet, indikator-5x)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25 [^src2]
- Rigshospitalet havde den laveste enhedsopfyldelse af Indikator 8 med 5,2 % (95 % CI: 1,1–14,4) [^src1] (rigshospitalet, indikator-8)
  Type: statistical
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 36-40 [^src3]
- Rigshospitalet har en 90-dages mortalitet på 29,3 % (95 % CI: 18,1–42,7) for Indikator 11 og opfylder derfor ikke standarden [^src1] (rigshospitalet, indikator-11)
  Type: statistical
  Page: 51
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 51-55 [^src4]
- Rigshospitalet: 58 opererede patienter, hvoraf 3 (0,10 %) havde resten af kræftsygdomme [^src1] (rigshospitalet)
  Type: cancer-distribution
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60 [^src5]
- Rigshospitalet: 3 / 30 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (10,0 %; 95 % CI: 2,1-26,5) [^src1] (rigshospitalet, charlson-score-1-2)
  Type: hospital-statistic
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65 [^src6]

## Timeline
(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 21-25
[^src3]: AKDB_2023.pdf, pages 36-40
[^src4]: AKDB_2023.pdf, pages 51-55
[^src5]: AKDB_2023.pdf, pages 56-60
[^src6]: AKDB_2023.pdf, pages 61-65
[^src7]: AKDB_2023.pdf, pages 71-75
[^src8]: AKDB_2024.pdf, pages 6-10
[^src9]: AKDB_2024.pdf, pages 51-55
[^src10]: AKDB_2024.pdf, pages 61-65
[^src11]: AKDB_2024.pdf, pages 71-75
