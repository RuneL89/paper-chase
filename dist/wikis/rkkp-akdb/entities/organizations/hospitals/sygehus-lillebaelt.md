---
title: Sygehus Lillebælt
type: entity
aliases:
  - Sygehus Lillebælt
wiki: rkkp-akdb
updated: '2026-08-05T18:50:07.086Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '6-10, 61-65, 71-75'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '51-55, 6-10, 61-65, 66-70, 71-75'
tags:
  - organization
---
Sygehus Lillebælt is a hospital located in [[region-syddanmark|Region Syddanmark]] that participates in the Danish national clinical quality monitoring program for acute high-risk abdominal surgery, managed by the Regions' Clinical Quality Development Program (RKKP) [^src2]. The hospital's performance is systematically tracked across multiple clinical indicators, including process and outcome measures, to support benchmarking and quality improvement in the Danish healthcare sector [^src1]. 

For the period spanning September 1, 2022, to August 31, 2023, Sygehus Lillebælt reported specific results for [[indikator-1|Indikator 1]], which measures antibiotic treatment within three hours [^src1]. The hospital's compliance rate for this indicator was 14.0% (with a 95% confidence interval of 7.4-23.1) [^src1]. In the subsequent reporting period from September 1, 2023, to August 31, 2024, the hospital's performance on Indikator 1 was also monitored, alongside other metrics such as patient demographics and age distribution [^src4]. 

The hospital's clinical outcomes regarding 30-day mortality after acute surgery are closely evaluated and stratified by patient comorbidity using the Charlson Comorbidity Index. For patients with mild to moderate comorbidity ([[charlson-score-1-2|Charlson Score = 1 or 2]]), the 30-day mortality rate for the 2022-2023 period was 6.1% (95% CI: 0.7-20.2) [^src2]. In the 2023-2024 period, the hospital recorded 4 deaths within 30 days among 20 included patients with a Charlson Score of 1 or 2, contributing to the data for [[indikator-9b|Indikator 9b]] [^src7]. Similarly, for patients with high comorbidity (Charlson Score ≥ 3), which relates to [[indikator-9c|Indikator 9c]], Sygehus Lillebælt also recorded 4 deaths within 30 days among 20 included patients during the 2023-2024 period [^src7]. Additionally, demographic data such as the age and gender distribution of operated patients at the hospital is tracked to provide a comprehensive profile of its surgical patient population across both reporting years [^src3].

## Mentions
- Page 9: "Sygehus Lillebælt Nej 12 / 86 0 (0) 14,0 (7,4-23,1) 10,2 5,6" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10)
- Page 61: "Sygehus Lillebælt #/# 0 (0) 6,1 (0,7-20,2) 10,6 18,8" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65)
- Page 71: "Sygehus Lillebælt 116 15,9 55,00 70,00 65,35 79,00" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 71-75)
- Page 6: "Sygehus Lillebælt Nej 18 / 79 0 (0) 22,8 (14,1-33,6) 14,4 10,2" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10)
- Page 51: "Sygehus Lillebælt Nej 12 / 88 0 (0) 13,6 (7,2-22,6) 4,9 6,6" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 51-55)
- Page 61: "Sygehus Lillebælt #/# 0 (0) 7,7 (0,9-25,1) 0,0 4,8" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 61-65)
- Page 66: "Sygehus Lillebælt" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 66-70)
- Page 71: "Sygehus Lillebælt 122 16,6 55,00 70,00 65,82 79,00" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 71-75)

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: sygehus-lillebaelt
  Predicate: has-indicator-result
  Object: indikator-1
  Evidence: "Sygehus Lillebælt Nej 12 / 86 0 (0) 14,0 (7,4-23,1) 10,2 5,6"
  Page: 9
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10

Incoming (this entity is the OBJECT of these relationships):
- Subject: region-syddanmark
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Syddanmark 21 / 213 [...] Sygehus Lillebælt #/#"
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65

## Claims
- Sygehus Lillebælt: #/# døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (6,1 %; 95 % CI: 0,7-20,2) [^src1] (sygehus-lillebaelt, charlson-score-1-2)
  Type: hospital-statistic
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65
- For perioden 01.09.2023 – 31.08.2024 blev der registreret 4 patienter med død inden for 30 dage efter akut kirurgi ved Sygehus Lillebælt blandt 20 inkluderede patienter med Charlson Score = 1 eller 2 [^src1] (sygehus-lillebaelt, indikator-9b)
  Type: clinical-outcome
  Page: 66
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 66-70
- For perioden 01.09.2023 – 31.08.2024 blev der registreret 4 patienter med død inden for 30 dage efter akut kirurgi ved Sygehus Lillebælt blandt 20 inkluderede patienter med Charlson Score ≥ 3 [^src1] (sygehus-lillebaelt, indikator-9c)
  Type: clinical-outcome
  Page: 66
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 66-70

## Timeline
(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 61-65
[^src3]: AKDB_2023.pdf, pages 71-75
[^src4]: AKDB_2024.pdf, pages 6-10
[^src5]: AKDB_2024.pdf, pages 51-55
[^src6]: AKDB_2024.pdf, pages 61-65
[^src7]: AKDB_2024.pdf, pages 66-70
[^src8]: AKDB_2024.pdf, pages 71-75
