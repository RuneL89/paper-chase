---
title: Næstved Sygehus
type: entity
aliases:
  - Næstved Sygehus
  - Næstved
wiki: rkkp-afdk
updated: '2026-08-05T20:16:36.296Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '16-20, 36-40, 41-45, 6-10, 71-75, 76-80, 91-95'
tags:
  - organization
---
Næstved Sygehus is a hospital operating within [[region-sjaelland|Region Sjælland]] in Denmark [^src5]. It is one of the healthcare institutions evaluated in the Danish Atrial Fibrillation Database (AFDK) annual report, which monitors clinical quality indicators for the treatment of atrial fibrillation across the national healthcare system [^src3].

In the reporting period from July 1, 2022, to June 30, 2023, Næstved Sygehus was assessed across multiple clinical quality metrics. Most notably, it was one of the few hospitals to meet the national standard of 50% for Indicator 8, which measures the provision of structured patient education to newly diagnosed atrial fibrillation patients [^src1]. However, this achievement was based on a very small patient cohort of only 20 individuals [^src1]. 

The hospital is also measured under [[indikator-2|Indikator 2]], which tracks the performance of echocardiography on newly diagnosed patients [^src3]. During the 2022–2023 period, Næstved Sygehus recorded a compliance rate of 70.6% (95% CI: 44.0–89.7) for this indicator, which did not fulfill the national standard [^src3]. Furthermore, the hospital's performance data is documented in the AFDK report's statistical tables for several other indicators, including anticoagulation treatment coverage (Indicator 4a) [^src4], [^src5], bleeding safety and patient education (Indicators 7 and 8) [^src6], and early anticoagulation initiation or stroke prevention (Indicators 1 and 5) [^src7]. Additional baseline data tables from the report also include the hospital's metrics for wait times and initial treatment pathways [^src2].

## Mentions
- Page 79: "Standarden er opfyldt på Slagelse Sygehus og Hospitalsenhed Midt samt Næstved Sygehus der dog har et meget lille patientgrundlag (20 patienter)." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 76-80)
- Page 9: "Næstved Ja 18 / 18 0 (0) 100,0 (81,5-100,0) 12 / 16 75,0 85,7" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 6-10)
- Page 16: "Næstved Nej 12 / 17 0 (0) 70,6 (44,0-89,7) 13 / 20 65,0 37,5" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 16-20)
- Page 36: "Næstved Nej # /# 0 (0) 75,0 (19,4-99,4) 31 / 33 93,9 84,7" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 36-40)
- Page 42: "Næstved Nej 62 / 69 0 (0) 89,9 (80,2-95,8) 40 / 48 83,3" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 41-45)
- Page 73: "Næstved Ja 12 / 20 0 (0) 60,0 (36,1-80,9) 6 / 8 75,0 49,1" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 71-75)
- Page 94: "Næstved Nej 20 / 2.144 0 (0) 0,9 (0,6-1,4) 12 / 2.116 0,6 0,6" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 91-95)

## Relationships
Incoming (this entity is the OBJECT of these relationships):
- Subject: indikator-2
  Predicate: measures
  Object: (this entity)
  Evidence: "Næstved er en af de institutioner, der rapporteres i tabellen for Indikator 2."
  Page: 16
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 16-20
- Subject: region-sjaelland
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Sjælland Nej [...] Næstved Nej [...]"
  Page: 42
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 41-45

## Claims
- Næstved opfyldte Indikator 2 hos 70,6 % (95 % CI: 44,0–89,7) af nydiagnosticerede patienter med atrieflimren i perioden 1. juli 2022 – 30. juni 2023 [^src1] (naestved-sygehus, indikator-2)
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
