---
title: BFKB
type: entity
aliases:
  - BFKB-koden
wiki: rkkp-afdk
updated: '2026-08-05T20:57:04.980Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 116-120
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '106-110, 61-65, 96-100'
tags:
  - intervention-code
---
**BFKB** is a specific intervention code used within the Danish healthcare system to register structured [[patientuddannelse|Patientuddannelse]] (patient education) for individuals diagnosed with [[atrieflimren|atrial fibrillation]] and atrial flutter [^src1]. Tracked in the national Atrial Fibrillation database (AFDK) under the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP), the code is essential for measuring the quality of care and ensuring that newly diagnosed patients receive evidence-based education aligned with international standards, such as the ESC guidelines and the ABC Pathway [^src4].

The primary significance of the BFKB code lies in its direct link to [[indikator-8|Indikator 8]], a national quality indicator that measures the proportion of newly diagnosed atrial fibrillation patients who receive structured patient education within their first year of diagnosis [^src3]. While other codes such as [[bqf-star|BQF*]], [[bvds|BVDS]], and [[bvdy-star|BVDY*]] have historically been associated with patient education interventions [^src1], a major procedural shift occurred at the beginning of 2023. As of January 1, 2023, BFKB became the exclusive SKS (Sundhedsvæsenets Klassifikations System) code capable of fulfilling the target metrics for Indikator 8 [^src2]. 

This strict coding requirement was implemented to standardize data collection across regions and health clusters. However, annual reports have noted that a lack of harmonized teaching offerings and the failure to consistently implement the BFKB code in patient journals remain systemic barriers to achieving the national standard of ≥50% target fulfillment [^src4]. Proper registration of the BFKB code in the patient's journal is therefore a mandatory procedural step for clinics aiming to document compliance with national clinical guidelines and achieve quality targets [^src4].

## Mentions
- Page 119: "Koder:
BFKB (Patientuddannelse i
atrieflimren og atrieflagren)" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120)
- Page 65: "Fra og med 1.1.2023 er det alene SKS-koden BFKB der kan resultere i målopfyldelse for indikatoren." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 61-65)
- Page 109: "Koder:
BFKB (Patientuddannelse i
atrieflimren og atrieflagren)" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 106-110)
- Page 97: "BFKB-koden: "Patientuddannelse i atrieflimren"" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 96-100)

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: bfkb
  Predicate: is-intervention-code-for
  Object: atrieflimren
  Evidence: "BFKB (Patientuddannelse i
atrieflimren og atrieflagren)"
  Page: 119
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120
- Subject: bfkb
  Predicate: codes-for
  Object: patientuddannelse
  Evidence: "BFKB (Patientuddannelse i
atrieflimren og atrieflagren)"
  Page: 109
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 106-110

Incoming (this entity is the OBJECT of these relationships):
- Subject: indikator-8
  Predicate: requires-code
  Object: (this entity)
  Evidence: "Fra og med 1.1.2023 er det alene SKS-koden BFKB der kan resultere i målopfyldelse for indikatoren."
  Page: 65
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 61-65

## Claims
- For patientuddannelse anvendes koden BFKB (Patientuddannelse i atrieflimren og atrieflagren) samt BQF*, BVDS og BVDY* [^src1] (bfkb, bqf-star, bvds, bvdy-star)
  Type: interventional
  Page: 119
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120
- Indrapportering af indikator 8, patientuddannelse/-undervisning til AFDK skal kodes i journalen med BFKB-koden: "Patientuddannelse i atrieflimren" [^src3] (indikator-8, bfkb, atrieflimren)
  Type: procedural
  Page: 97
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 96-100

## Timeline
- 2023-01-01: Fra og med 1. januar 2023 er det alene SKS-koden BFKB, der kan resultere i målopfyldelse for Indikator 8. (bfkb, indikator-8)

## Sources

[^src1]: AFDK_2023.pdf, pages 116-120
[^src2]: AFDK_2024.pdf, pages 61-65
[^src3]: AFDK_2024.pdf, pages 106-110
[^src4]: AFDK_2024.pdf, pages 96-100
