---
title: BFKB
type: entity
aliases:
  - BFKB-koden
wiki: rkkp-afdk
updated: '2026-08-14T20:52:41.212Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 116-120
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '106-110, 61-65, 96-100'
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: '81-85, 96-98'
tags:
  - intervention-code
---

BFKB is a specific medical intervention code used in the Danish healthcare system to register structured [[patientuddannelse|patient education]] for individuals diagnosed with [[atrieflimren]] and atrial flutter. Managed under the clinical quality databases coordinated by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP), the code is formally defined as "Patientuddannelse i atrieflimren og atrieflagren" [^src1]. It serves as a critical data point for tracking whether newly diagnosed patients receive the structured teaching programs recommended by both national and international guidelines, such as the ESC guidelines and the ABC Pathway [^src4].

The primary significance of the BFKB code lies in its direct relationship with [[indikator-8|Indikator 8]], a national quality indicator that measures the proportion of eligible patients receiving this education [^src4]. Historically, multiple codes could be used to track this intervention, including [[bqf-star|BQF*]], [[bvds|BVDS]], and [[bvdy-star|BVDY*]] [^src1]. However, a major policy shift occurred on January 1, 2023, when it was mandated that BFKB would be the sole SKS code capable of fulfilling the target for [[indikator-8|Indikator 8]] [^src2]. Consequently, any reporting of [[patientuddannelse|patient education]] to the Atrial Fibrillation Database (AFDK) must now be logged in the patient's journal specifically with the BFKB code [^src6].

Despite its clear definition, the implementation of BFKB has highlighted systemic challenges in clinical data registration. Reports have noted severe discrepancies between the actual delivery of patient education in clinical practice and the numbers registered via the BFKB code, with regions like Region Sjælland pointing out that poor coding practices artificially deflate the measured performance of [[indikator-8|Indikator 8]] [^src5]. This underscores the broader narrative within Danish cardiovascular quality development: standardizing intervention codes is essential not just for data collection, but for ensuring that evidence-based, patient-centered care is accurately reflected and adequately resourced across all health clusters [^src4].

## Mentions
- Page 119: "Koder:
BFKB (Patientuddannelse i
atrieflimren og atrieflagren)" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120)
- Page 65: "Fra og med 1.1.2023 er det alene SKS-koden BFKB der kan resultere i målopfyldelse for indikatoren." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 61-65)
- Page 109: "Koder:
BFKB (Patientuddannelse i
atrieflimren og atrieflagren)" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 106-110)
- Page 96: "BFKB (Patientuddannelse i atrieflimren og atrieflagren)" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 96-98)
- Page 97: "BFKB-koden: "Patientuddannelse i atrieflimren"" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 96-100)
- Page 84: "Indrapportering af indikator 8, patientuddannelse/-undervisning til AFDK skal kodes i journalen med BFKB-koden: "Patientuddannelse i atrieflimren"." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 81-85)

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
- Subject: indikator-8
  Predicate: is-defined-by-code
  Object: (this entity)
  Evidence: "BFKB (Patientuddannelse i atrieflimren og atrieflagren)"
  Page: 96
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 96-98
- Subject: indikator-8
  Predicate: uses-code
  Object: (this entity)
  Evidence: "Indrapportering af indikator 8, patientuddannelse/-undervisning til AFDK skal kodes i journalen med BFKB-koden: "Patientuddannelse i atrieflimren"."
  Page: 84
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 81-85

## Claims
- For patientuddannelse anvendes koden BFKB (Patientuddannelse i atrieflimren og atrieflagren) samt BQF*, BVDS og BVDY* [^src1] (bfkb, bqf-star, bvds, bvdy-star)
  Type: interventional
  Page: 119
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120
- BFKB-koden anvendes som tæller for indikator 8 [^src1] (bfkb, indikator-8)
  Type: coding-assignment
  Page: 96
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 96-98
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
[^src4]: AFDK_2025.pdf, pages 96-98
[^src5]: AFDK_2024.pdf, pages 96-100
[^src6]: AFDK_2025.pdf, pages 81-85
