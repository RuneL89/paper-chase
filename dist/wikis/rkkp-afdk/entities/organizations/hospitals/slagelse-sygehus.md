---
title: Slagelse Sygehus
type: entity
aliases:
  - Slagelse Sygehus
  - Slagelse
wiki: rkkp-afdk
updated: '2026-08-05T20:16:16.268Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '16-20, 36-40, 41-45, 6-10, 71-75, 76-80, 91-95'
tags:
  - organization
---
Slagelse Sygehus is a hospital located in [[region-sjaelland|Region Sjælland]] that is actively monitored for its clinical quality in treating atrial fibrillation [^src5]. It is evaluated in the annual report from the Danish Atrial Fibrillation Database (AFDK) for the period of July 1, 2022, to June 30, 2023, published by the Danish Regions' Clinical Quality Development Programme (RKKP) to benchmark healthcare quality across national, regional, and local levels.

In the context of the AFDK's quality metrics, Slagelse Sygehus demonstrates varied performance across different clinical indicators. Notably, it is one of the few hospitals that successfully met the 50% national standard for Indicator 8, which measures the provision of structured patient education to newly diagnosed atrial fibrillation patients within their first year [^src1]. However, this achievement is based on a very small patient cohort of just 20 individuals, limiting the statistical weight of the result [^src1]. 

Conversely, for [[indikator-2|Indikator 2]], which evaluates the completion of echocardiography for newly diagnosed patients, the hospital achieved a compliance rate of 76.7% (95% CI: 73.0–80.1) [^src3]. This performance falls below the required national standard of ≥80% [^src3]. Beyond these specific metrics, the hospital's clinical data is extensively tracked throughout the report across multiple other indicators, including early anticoagulation treatment, long-term anticoagulation coverage two years post-diagnosis, and the incidence of severe bleeding among prevalent patients [^src2], [^src4], [^src6], [^src7].

## Mentions
- Page 79: "Standarden er opfyldt på Slagelse Sygehus og Hospitalsenhed Midt samt Næstved Sygehus der dog har et meget lille patientgrundlag (20 patienter)." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 76-80)
- Page 9: "Slagelse Nej 319 / 364 0 (0) 87,6 (83,8-90,8) 425 / 472 90,0 89,7" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 6-10)
- Page 16: "Slagelse Nej 431 / 562 0 (0) 76,7 (73,0-80,1) 638 / 827 77,1 81,5" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 16-20)
- Page 36: "Slagelse Nej 259 / 290 0 (0) 89,3 (85,2-92,6) 325 / 371 87,6 88,7" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 36-40)
- Page 42: "Slagelse Nej 177 / 209 0 (0) 84,7 (79,1-89,3) 236 / 308 76,6" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 41-45)
- Page 73: "Slagelse Ja 396 / 754 0 (0) 52,5 (48,9-56,1) 399 / 866 46,1 52,2" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 71-75)
- Page 94: "Slagelse Ja 13 / 2.122 0 (0) 0,6 (0,3-1,0) 12 / 2.127 0,6 0,8" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 91-95)

## Relationships
Incoming (this entity is the OBJECT of these relationships):
- Subject: indikator-2
  Predicate: measures
  Object: (this entity)
  Evidence: "Slagelse er en af de institutioner, der rapporteres i tabellen for Indikator 2."
  Page: 16
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 16-20
- Subject: region-sjaelland
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Sjælland Nej [...] Slagelse Nej [...]"
  Page: 42
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 41-45

## Claims
- Slagelse opfyldte Indikator 2 hos 76,7 % (95 % CI: 73,0–80,1) af nydiagnosticerede patienter med atrieflimren i perioden 1. juli 2022 – 30. juni 2023 [^src1] (slagelse-sygehus, indikator-2)
  Type: clinical
  Page: 16
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 16-20

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 76-80
[^src2]: AFDK_2023.pdf, pages 6-10
[^src3]: AFDK_2023.pdf, pages 16-20
[^src4]: AFDK_2023.pdf, pages 36-40
[^src5]: AFDK_2023.pdf, pages 41-45
[^src6]: AFDK_2023.pdf, pages 71-75
[^src7]: AFDK_2023.pdf, pages 91-95
