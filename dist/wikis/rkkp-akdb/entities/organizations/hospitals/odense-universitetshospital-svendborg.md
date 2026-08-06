---
title: Odense Universitetshospital - Svendborg
type: entity
aliases:
  - Odense Universitetshospital - Svendborg
  - OUH Odense Universitetshospital (Svendborg)
wiki: rkkp-akdb
updated: '2026-08-05T18:51:21.727Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '41-45, 56-60, 6-10, 61-65, 71-75'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '6-10, 66-70'
tags:
  - organization
---
# Odense Universitetshospital - Svendborg

Odense Universitetshospital - Svendborg is a hospital operating within [[region-syddanmark|Region Syddanmark]] [^src3]. It is regularly evaluated in the Danish national clinical quality reports for acute surgery (Akut Kirurgi Databasen, AKDB), which monitor process and outcome indicators for high-risk abdominal surgical patients under the Danish Regions' Clinical Quality Development Programme (RKKP).

A significant point of note for the hospital is its performance on [[indikator-1|Indikator 1]], which measures antibiotic treatment within three hours. For the reporting period of September 1, 2022, to August 31, 2023, the hospital recorded a proportion of 7.9% (95% CI: 4.4–12.8) [^src1]. This figure is notable as it represents the lowest result among all hospitals displayed in the 2023 document for this specific indicator [^src1]. The hospital's continued monitoring for Indikator 1 is also reflected in the 2024 report covering the subsequent year [^src5]. 

In terms of other process indicators, the hospital meets the standard for [[indikator-9|Indikator 9]] (epidural catheter placement during surgery), achieving a compliance rate of 60.9% (95% CI: 54.2–67.2) for the 2022–2023 period [^src2]. 

The hospital's clinical outcomes regarding 30-day mortality after acute surgery are tracked with risk adjustment based on patient comorbidity. During the 2022–2023 period, 10 out of 86 patients with a [[charlson-score-1-2|Charlson Score = 1 eller 2]] (mild to moderate comorbidity) died within 30 days, resulting in an 11.6% mortality rate (95% CI: 5.7–20.3) [^src3]. In the following 2023–2024 period, the hospital recorded 15 deaths within 30 days among 70 included patients with a Charlson Score of 1 or 2 ([[indikator-9b|Indikator 9b]]) [^src6]. For patients with severe comorbidity (Charlson Score ≥ 3), the hospital similarly recorded 15 deaths within 30 days among 70 included patients during the 2023–2024 period ([[indikator-9c|Indikator 9c]]) [^src6]. Additionally, the hospital's patient demographics, age and gender distributions, and cancer diagnosis profiles are tracked to support risk adjustment for broader mortality indicators [^src4] [^src7].

## Mentions

- Page 9: "Odense Universitetshospital - Svendborg Nej 14 / 178 0 (0) 7,9 (4,4-12,8) 5,6 3,6" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10) [^src1]
- Page 41: "Odense Universitetshospital - Svendborg" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 41-45) [^src2]
- Page 61: "Odense Universitetshospital - Svendborg 10 / 86 0 (0) 11,6 (5,7-20,3) 11,5 13,3" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65) [^src3]
- Page 71: "Odense Universitetshospital - Svendborg 300 41,2 57,00 72,00 65,28 79,00" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 71-75) [^src4]
- Page 6: "Odense Universitetshospit al - Svendborg Nej 64 / 281 0 (0) 22,8 (18,0-28,1) 7,9 6,1" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10) [^src5]
- Page 66: "Odense Universitetshospital - Svendborg" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 66-70) [^src6]
- Page 56: "OUH Odense Universitetshospital (Svendborg)" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60) [^src7]

## Relationships

Outgoing (this entity is the SUBJECT of these relationships):
- Subject: odense-universitetshospital-svendborg
  Predicate: has-indicator-result
  Object: indikator-1
  Evidence: "Odense Universitetshospital - Svendborg Nej 14 / 178 0 (0) 7,9 (4,4-12,8) 5,6 3,6"
  Page: 9
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10 [^src1]
- Subject: odense-universitetshospital-svendborg
  Predicate: meets-standard-of
  Object: indikator-9
  Evidence: "Odense Universitetshospital - Svendborg Ja 140 / 230 0 (0) 60,9 (54,2-67,2) 28,9 5,7"
  Page: 41
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 41-45 [^src2]

Incoming (this entity is the OBJECT of these relationships):
- Subject: region-syddanmark
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Syddanmark 21 / 213 [...] Odense Universitetshospital - Svendborg 10 / 86"
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65 [^src3]

## Claims

- For Indikator 1 var andelen ved Odense Universitetshospital - Svendborg i perioden 01.09.2022–31.08.2023 7,9 % (95 % CI: 4,4–12,8) [^src1] (indikator-1, odense-universitetshospital-svendborg)
  Type: performance
  Page: 9
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10
- Odense Universitetshospital - Svendborg: 10 / 86 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (11,6 %; 95 % CI: 5,7-20,3) [^src1] (odense-universitetshospital-svendborg, charlson-score-1-2)
  Type: hospital-statistic
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65
- For perioden 01.09.2023 – 31.08.2024 blev der registreret 15 patienter med død inden for 30 dage efter akut kirurgi ved Odense Universitetshospital - Svendborg blandt 70 inkluderede patienter med Charlson Score = 1 eller 2 [^src1] (odense-universitetshospital-svendborg, indikator-9b)
  Type: clinical-outcome
  Page: 66
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 66-70
- For perioden 01.09.2023 – 31.08.2024 blev der registreret 15 patienter med død inden for 30 dage efter akut kirurgi ved Odense Universitetshospital - Svendborg blandt 70 inkluderede patienter med Charlson Score ≥ 3 [^src1] (odense-universitetshospital-svendborg, indikator-9c)
  Type: clinical-outcome
  Page: 66
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 66-70

## Timeline

(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 41-45
[^src3]: AKDB_2023.pdf, pages 61-65
[^src4]: AKDB_2023.pdf, pages 71-75
[^src5]: AKDB_2024.pdf, pages 6-10
[^src6]: AKDB_2024.pdf, pages 66-70
[^src7]: AKDB_2023.pdf, pages 56-60
