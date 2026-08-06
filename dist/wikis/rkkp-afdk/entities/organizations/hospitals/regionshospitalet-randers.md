---
title: Regionshospitalet Randers
type: entity
aliases:
  - Regionshospitalet Randers
wiki: rkkp-afdk
updated: '2026-08-05T19:51:29.569Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '111-115, 16-20, 31-35, 36-40, 41-45, 6-10'
tags:
  - organization
---
Regionshospitalet Randers is a regional hospital located in [[region-midtjylland|Region Midtjylland]] [^src3]. It is one of the healthcare institutions evaluated in the Danish Atrial Fibrillation Database (AFDK) annual report, which monitors the clinical quality of atrial fibrillation treatment across Denmark for the period from July 1, 2022, to June 30, 2023 [^src1]. The hospital's performance is tracked across multiple clinical quality indicators to ensure compliance with national healthcare standards set by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP) [^src2].

In terms of specific clinical outcomes, Regionshospitalet Randers demonstrated strong compliance with national benchmarks. For [[indikator-2|Indikator 2]], which measures the proportion of newly diagnosed atrial fibrillation patients who undergo echocardiography, the hospital achieved a compliance rate of 87.5% (95% CI: 84.5–90.0), successfully meeting the national standard of ≥80% [^src2]. Furthermore, for [[indikator-4a|Indikator 4a]], which tracks anticoagulation treatment coverage, the hospital reported that 95.0% (95% CI: 91.6–97.3) of relevant patients received treatment, exceeding the ≥90% standard [^src3]. 

The hospital is also evaluated on several other indicators throughout the report. It met the standard for Indikator 1, achieving a 95.2% rate in one measured cohort [^src1]. Additional data tables detail its performance across other metrics, including a 92.9% rate on page 37 [^src4], an 89.6% rate where it did not meet a specific standard on page 43 [^src5], and a 6.6% rate for another specific metric (such as heart failure incidence) on page 111 [^src6]. Overall, Regionshospitalet Randers serves as a key data point in the RKKP's systematic monitoring and benchmarking of cardiovascular health quality within the Danish healthcare system [^src6].

## Mentions
- Page 10: "Regionshospitalet Randers Ja 375 / 394 0 (0) 95,2 (92,6-97,1) 409 / 431 94,9 93,5" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 6-10)
- Page 17: "Regionshospitalet Randers Ja 509 / 582 0 (0) 87,5 (84,5-90,0) 646 / 769 84,0 85,1" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 16-20)
- Page 31: "Regionshospitalet Randers Ja 248 / 261 0 (0) 95,0 (91,6-97,3) 322 / 347 92,8 92,9" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 31-35)
- Page 37: "Regionshospitalet Randers Ja 223 / 240 0 (0) 92,9 (88,9-95,8) 243 / 264 92,0 85,1" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 36-40)
- Page 43: "Regionshospitalet Randers Nej 172 / 192 0 (0) 89,6 (84,4-93,5) 190 / 216 88,0" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 41-45)
- Page 111: "Regionshospitalet Randers 50 / 758 0 (0) 6,6 (4,9-8,6) 56 / 774 7,2 9,7" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 111-115)

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: regionshospitalet-randers
  Predicate: is-part-of
  Object: region-midtjylland
  Evidence: "Regionshospitalet Randers er et regionalt hospital i Region Midtjylland"
  Page: 31
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 31-35

Incoming (this entity is the OBJECT of these relationships):
- Subject: indikator-2
  Predicate: measures
  Object: (this entity)
  Evidence: "Regionshospitalet Randers er en af de institutioner, der rapporteres i tabellen for Indikator 2."
  Page: 17
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 16-20
- Subject: region-midtjylland
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Midtjylland Nej [...] Regionshospitalet Randers Nej [...]"
  Page: 43
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 41-45
- Subject: region-midtjylland
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Midtjylland [...] Regionshospitalet Randers 50 / 758..."
  Page: 111
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 111-115

## Claims
- Regionshospitalet Randers opfyldte Indikator 2 hos 87,5 % (95 % CI: 84,5–90,0) af nydiagnosticerede patienter med atrieflimren i perioden 1. juli 2022 – 30. juni 2023 [^src1] (regionshospitalet-randers, indikator-2)
  Type: clinical
  Page: 17
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 16-20
- For Regionshospitalet Randers var andelen af patienter, der modtog behandling, 95,0 % (95 % CI: 91,6–97,3) i perioden 1. juli 2022 – 30. juni 2023 [^src1] (regionshospitalet-randers, indikator-4a)
  Type: clinical
  Page: 31
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 31-35

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 6-10
[^src2]: AFDK_2023.pdf, pages 16-20
[^src3]: AFDK_2023.pdf, pages 31-35
[^src4]: AFDK_2023.pdf, pages 36-40
[^src5]: AFDK_2023.pdf, pages 41-45
[^src6]: AFDK_2023.pdf, pages 111-115
