---
title: Amager og Hvidovre Hospital
type: entity
aliases:
  - Amager og Hvidovre Hospital
wiki: rkkp-akdb
updated: '2026-08-05T18:42:32.961Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '21-25, 36-40, 56-60, 6-10, 61-65, 71-75'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '46-50, 51-55, 6-10, 61-65, 71-75'
tags:
  - organization
---
**Amager og Hvidovre Hospital** is a major hospital located in [[region-hovedstaden|Region Hovedstaden]] (the Capital Region of Denmark) [^src2]. It is actively monitored within the national clinical quality database for acute surgery (Akut Kirurgi Databasen, AKDB), contributing critical data to various regional and national quality indicators [^src1]. The hospital's performance is frequently benchmarked against other institutions, such as [[naestved-slagese-og-ringsted-sygehuse|Næstved, Slagelse og Ringsted sygehuse]], to evaluate variations in treatment quality, resource allocation, and patient outcomes across the Danish healthcare sector [^src8].

In terms of clinical processes, the hospital's results for [[indikator-1|Indikator 1]] (antibiotic treatment within 3 hours) showed a compliance rate of 26.9% for the period from September 1, 2022, to August 31, 2023 [^src1]. In the subsequent reporting period (September 1, 2023, to August 31, 2024), the hospital's compliance for Indikator 1 improved to 35.2% [^src7]. The hospital also demonstrates significant activity regarding [[indikator-8|Indikator 8]], which tracks the use of [[epidural|epidural]] catheters for pain management. Notably, Amager og Hvidovre Hospital exhibited the highest epidural rate in the cohort, having placed 166 epidural catheters in connection with the surgery of 282 patients (121 of which were open procedures) [^src8]. This highlights a distinct inter-hospital variation in offering epidural pain treatment [^src8].

Regarding patient outcomes and demographics, the hospital treated 256 operated patients in the 2022–2023 period, of which 15 (0.48%) had gastrointestinal cancer diseases and 4 (0.13%) had other cancer diseases [^src4]. Furthermore, when analyzing 30-day mortality after acute surgery for patients with light to moderate comorbidity ([[charlson-score-1-2|Charlson Score = 1 eller 2]]), 7 out of 90 patients died (7.8%; 95% CI: 3.2-15.4) [^src5]. The hospital also reported a 10.9% rate (95% CI: 5.6–18.7) for the supplementary [[indikator-5x|Indikator 5x]], which measures the speed of surgical intervention for life-threatening conditions [^src2]. In national aggregate reporting, the hospital is consistently listed as a constituent part of the [[hovedstaden-region-i-alt|Hovedstaden Region i alt]] metrics [^src4].

## Mentions

- Page 8: "Amager og Hvidovre Hospital Nej 65 / 242 0 (0) 26,9 (21,4-32,9) 25,2 21,3" [^src1]
- Page 21: "Amager og Hvidovre Hospital Nej 11 / 101 0 (0) 10,9 (5,6-18,7)" [^src2]
- Page 36: "Amager og Hvidovre Hospital 124 / 253 0 (0) 49,0 (42,7-55,3) 22,1 0,0" [^src3]
- Page 56: "Amager og Hvidovre Hospital" [^src4]
- Page 61: "Amager og Hvidovre Hospital 7 / 90 0 (0) 7,8 (3,2-15,4) 6,5 10,9" [^src5]
- Page 71: "Amager og Hvidovre Hospital 301 23,3 48,00 65,00 61,50 76,00" [^src6]
- Page 6: "Amager og Hvidovre Hospital Nej 86 / 244 0 (0) 35,2 (29,3-41,6) 27,0 25,2" [^src7]
- Page 46: "Denne behandlingsforskel er tydeligst mellem Amager/Hvidovre sygehus, der har anlagt 166 epiduralkatetre, i forbindelse med operation af 282 patienter, hvoraf 121 indgreb blev foretaget åbent" [^src8]
- Page 51: "Amager og Hvidovre Hospital Ja 35 / 244 0 (0) 14,3 (10,2-19,4) 13,0 14,6" [^src9]
- Page 61: "Amager og Hvidovre Hospital 7 / 101 0 (0) 6,9 (2,8-13,8) 7,3 4,6" [^src10]
- Page 71: "Amager og Hvidovre Hospital 303 23,4 48,50 65,00 61,60 76,00" [^src11]

## Relationships

**Outgoing**
- **Subject:** amager-og-hvidovre-hospital
  **Predicate:** has-indicator-result
  **Object:** indikator-1
  **Evidence:** "Amager og Hvidovre Hospital Nej 65 / 242 0 (0) 26,9 (21,4-32,9) 25,2 21,3"
  **Page:** 8 [^src1]
- **Subject:** amager-og-hvidovre-hospital
  **Predicate:** is-part-of
  **Object:** hovedstaden-region-i-alt
  **Evidence:** "Amager og Hvidovre Hospital er listet under Hovedstaden Region i alt i tabellen"
  **Page:** 56 [^src4]
- **Subject:** amager-og-hvidovre-hospital
  **Predicate:** has-highest-epidural-rate-for
  **Object:** indikator-8
  **Evidence:** "Amager/Hvidovre sygehus, der har anlagt 166 epiduralkatetre, i forbindelse med operation af 282 patienter, hvoraf 121 indgreb blev foretaget åbent"
  **Page:** 46 [^src8]

**Incoming**
- **Subject:** region-hovedstaden
  **Predicate:** contains-hospital
  **Object:** amager-og-hvidovre-hospital
  **Evidence:** "Amager og Hvidovre Hospital er beliggende i Region Hovedstaden"
  **Page:** 21 [^src2]
- **Subject:** region-hovedstaden
  **Predicate:** contains-hospital
  **Object:** amager-og-hvidovre-hospital
  **Evidence:** "Hovedstaden 36 / 396 [...] Amager og Hvidovre Hospital 7 / 90"
  **Page:** 61 [^src5]

## Claims

**performance-statistic**
- Amager og Hvidovre Hospital havde en andel på 10,9 % (95 % CI: 5,6–18,7) for supplerende indikator 5x [^src1]

**cancer-distribution**
- Amager og Hvidovre Hospital: 256 opererede patienter, hvoraf 15 (0,48 %) havde gastrointestinale kræftsygdomme og 4 (0,13 %) resten af kræftsygdomme [^src1]

**hospital-statistic**
- Amager og Hvidovre Hospital: 7 / 90 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (7,8 %; 95 % CI: 3,2-15,4) [^src1]

**inter-hospital-variation**
- Der er stor forskel mellem sygehusene i forhold til at tilbyde smertebehandling med epiduralkateter [^src1]

## Timeline

*(No timeline events extracted for this entity)*

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 21-25
[^src3]: AKDB_2023.pdf, pages 36-40
[^src4]: AKDB_2023.pdf, pages 56-60
[^src5]: AKDB_2023.pdf, pages 61-65
[^src6]: AKDB_2023.pdf, pages 71-75
[^src7]: AKDB_2024.pdf, pages 6-10
[^src8]: AKDB_2024.pdf, pages 46-50
[^src9]: AKDB_2024.pdf, pages 51-55
[^src10]: AKDB_2024.pdf, pages 61-65
[^src11]: AKDB_2024.pdf, pages 71-75
