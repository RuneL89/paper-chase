---
title: Sygehus Sønderjylland
type: entity
aliases:
  - Sygehus Sønderjylland
wiki: rkkp-afdk
updated: '2026-08-05T19:47:21.853Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '121-121, 16-20, 36-40, 41-45, 6-10'
tags:
  - organization
---
**Sygehus Sønderjylland** is a hospital in Denmark, operating within [[region-syddanmark|Region Syddanmark]]. It is evaluated in the Danish Atrial Fibrillation Database (AFDK) annual report for the period from July 1, 2022, to June 30, 2023, across multiple clinical quality indicators. 

For [[indikator-2|Indikator 2]], which measures the proportion of newly diagnosed atrial fibrillation patients receiving an echocardiogram, Sygehus Sønderjylland achieved a fulfillment rate of 83.0% (95% CI: 80.1–85.6), successfully meeting the national standard [^src2]. The hospital also reported data for other indicators, including anticoagulation treatment coverage two years post-diagnosis [^src3], and initial diagnostic indicators [^src1] [^src4].

Regarding [[indikator-3|Indikator 3]], which tracks TSH measurements for newly diagnosed patients, the hospital identified that its low target fulfillment was due to a data collection issue rather than a clinical omission. Specifically, the [[faelles-akut-modtagelse|Fælles Akut Modtagelse]] (FAM) at Sygehus Sønderjylland orders "diagnostic TSH" as part of a standard blood test package instead of ordering TSH individually, which affects how the data is captured in the registry [^src5]. Despite this reporting discrepancy, the hospital decided to continue its unchanged practice at FAM, as ordering the comprehensive blood test package is considered the most appropriate approach for patient pathways [^src5].

## Mentions
- Page 10: "Sygehus Sønderjylland Nej 488 / 543 0 (0) 89,9 (87,0-92,3) 560 / 613 91,4 91,8" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 6-10) [^src1]
- Page 16: "Sygehus Sønderjylland Ja 634 / 764 0 (0) 83,0 (80,1-85,6) 826 / 1.017 81,2 79,3" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 16-20) [^src2]
- Page 36: "Sygehus Sønderjylland Ja 339 / 369 0 (0) 91,9 (88,6-94,4) 344 / 387 88,9 89,8" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 36-40) [^src3]
- Page 42: "Sygehus Sønderjylland Nej 165 / 186 0 (0) 88,7 (83,3-92,9) 263 / 298 88,3" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 41-45) [^src4]
- Page 121: "Sygehus Sønderjylland
Indikator 3: Andel af nydiagnosticerede patienter med atrieflimren, som får målt TSH fra 30 dage før til 10 dage efter 1. diagnosedato. Sygehus Sønderjylland har identificeret at den lave målopfyldelse skyldes, at man på Sygehus Sønderjyllands Fælles Akut Modtagelse bestiller ”diagnostisk TSH” som en del af en blodprøvepakke i stedet for TSH enkeltvis." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 121-121) [^src5]

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: sygehus-soenderjylland
  Predicate: belongs-to
  Object: region-syddanmark
  Evidence: "Region Syddanmark:
Sygehus Sønderjylland"
  Page: 121
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 121-121 [^src5]

Incoming (this entity is the OBJECT of these relationships):
- Subject: indikator-2
  Predicate: measures
  Object: (this entity)
  Evidence: "Sygehus Sønderjylland er en af de institutioner, der rapporteres i tabellen for Indikator 2."
  Page: 16
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 16-20 [^src2]
- Subject: region-syddanmark
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Syddanmark Nej [...] Sygehus Sønderjylland Nej [...]"
  Page: 42
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 41-45 [^src4]
- Subject: faelles-akut-modtagelse
  Predicate: part-of
  Object: (this entity)
  Evidence: "Sygehus Sønderjyllands Fælles Akut Modtagelse"
  Page: 121
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 121-121 [^src5]

## Claims
- Sygehus Sønderjylland opfyldte Indikator 2 hos 83,0 % (95 % CI: 80,1–85,6) af nydiagnosticerede patienter med atrieflimren i perioden 1. juli 2022 – 30. juni 2023 [^src1] (sygehus-soenderjylland, indikator-2)
  Type: clinical
  Page: 16
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 16-20
- Sygehus Sønderjylland har identificeret at den lave målopfyldelse for Indikator 3 skyldes, at man på Sygehus Sønderjyllands Fælles Akut Modtagelse bestiller ”diagnostisk TSH” som en del af en blodprøvepakke i stedet for TSH enkeltvis [^src1] (sygehus-soenderjylland, indikator-3, faelles-akut-modtagelse)
  Type: data-collection-issue
  Page: 121
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 121-121
- SHS fortsætter uændret praksis på FAM, da dette vurderes mest hensigtsmæssig ift. patientforløbene [^src1] (sygehus-soenderjylland, faelles-akut-modtagelse)
  Type: clinical-practice-decision
  Page: 121
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 121-121

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 6-10
[^src2]: AFDK_2023.pdf, pages 16-20
[^src3]: AFDK_2023.pdf, pages 36-40
[^src4]: AFDK_2023.pdf, pages 41-45
[^src5]: AFDK_2023.pdf, pages 121-121
