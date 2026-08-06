---
title: Regionshospitalet Horsens
type: entity
aliases:
  - Regionshospitalet Horsens
wiki: rkkp-afdk
updated: '2026-08-05T19:49:23.461Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '111-115, 16-20, 21-25, 26-30, 31-35, 36-40, 41-45, 6-10'
tags:
  - organization
---
**Regionshospitalet Horsens** is a regional hospital located in [[region-midtjylland|Region Midtjylland]], Denmark. It is one of the healthcare institutions evaluated in the 2022–2023 annual report of the Danish Atrial Fibrillation Database (Databasen for Atrieflimren i Danmark), which monitors clinical quality and treatment standards for patients with atrial fibrillation across the country [^src2]. 

The hospital's performance is tracked across several national quality indicators. For Indikator 1, Regionshospitalet Horsens successfully met the required standard, achieving a compliance rate of 92.7% [^src1]. In terms of [[indikator-2|Indikator 2]], which measures the performance of echocardiography on newly diagnosed patients, the hospital recorded a rate of 92.7%, comfortably exceeding the national standard of ≥80% [^src2]. 

For [[indikator-3|Indikator 3]], which tracks TSH measurements to screen for underlying thyroid disease, the hospital achieved a compliance rate of 91.5% [^src3]. Although this result technically did not meet the standard, the report noted that Regionshospitalet Horsens was performing at a high level and was "close" to the target, alongside hospitals in North Zealand [^src4]. 

The hospital's anticoagulation treatment rates ([[indikator-4a|Indikator 4a]]) showed strong initial compliance but declined over time. One year after diagnosis, 96.0% of patients received treatment [^src5], and at the two-year mark, the rate was 92.7% [^src6]. However, by the five-year mark, the treatment coverage dropped to 89.0%, failing to meet the ≥90% standard [^src7]. Additionally, data tracking the incidence of heart failure following an atrial fibrillation diagnosis showed a rate of 6.4% at the hospital [^src8].

## Mentions
- Page 10: "Regionshospitalet Horsens Ja 356 / 384 0 (0) 92,7 (89,6-95,1) 330 / 358 92,2 93,6" [^src1]
- Page 17: "Regionshospitalet Horsens Ja 557 / 601 0 (0) 92,7 (90,3-94,6) 635 / 690 92,0 94,1" [^src2]
- Page 24: "Regionshospitalet Horsens Nej 658 / 719 0 (0) 91,5 (89,2-93,4) 634 / 690 91,9 91,8" [^src3]
- Page 29: "Regionshospitalet Horsens og Hospitalerne i Nordsjælland (91-92%) er tæt på." [^src4]
- Page 31: "Regionshospitalet Horsens Ja 215 / 224 0 (0) 96,0 (92,5-98,1) 325 / 348 93,4 94,6" [^src5]
- Page 37: "Regionshospitalet Horsens Ja 203 / 219 0 (0) 92,7 (88,4-95,8) 272 / 287 94,8 93,0" [^src6]
- Page 43: "Regionshospitalet Horsens Nej 130 / 146 0 (0) 89,0 (82,8-93,6) 185 / 209 88,5" [^src7]
- Page 111: "Regionshospitalet Horsens 44 / 685 0 (0) 6,4 (4,7-8,5) 60 / 709 8,5 9,3" [^src8]

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: regionshospitalet-horsens
  Predicate: meets-indicator-3-standard
  Object: false
  Evidence: "Regionshospitalet Horsens Nej 658 / 719 0 (0) 91,5 (89,2-93,4)"
  Page: 24
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 21-25 [^src3]
- Subject: regionshospitalet-horsens
  Predicate: has-high-performance-in
  Object: indikator-3
  Evidence: "Regionshospitalet Horsens og Hospitalerne i Nordsjælland (91-92%) er tæt på [standarden]."
  Page: 29
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 26-30 [^src4]
- Subject: regionshospitalet-horsens
  Predicate: is-part-of
  Object: region-midtjylland
  Evidence: "Regionshospitalet Horsens er et regionalt hospital i Region Midtjylland"
  Page: 31
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 31-35 [^src5]

Incoming (this entity is the OBJECT of these relationships):
- Subject: indikator-2
  Predicate: measures
  Object: (this entity)
  Evidence: "Regionshospitalet Horsens er en af de institutioner, der rapporteres i tabellen for Indikator 2."
  Page: 17
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 16-20 [^src2]
- Subject: region-midtjylland
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Midtjylland Nej [...] Regionshospitalet Horsens Nej [...]"
  Page: 43
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 41-45 [^src7]
- Subject: region-midtjylland
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Midtjylland [...] Regionshospitalet Horsens 44 / 685..."
  Page: 111
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 111-115 [^src8]

## Claims
- Regionshospitalet Horsens opfyldte Indikator 2 hos 92,7 % (95 % CI: 90,3–94,6) af nydiagnosticerede patienter med atrieflimren i perioden 1. juli 2022 – 30. juni 2023 [^src1] (regionshospitalet-horsens, indikator-2)
  Type: clinical
  Page: 17
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 16-20
- Regionshospitalet Horsens har en Indikator 3-andel på 91,5 % (95 % CI: 89,2–93,4) [^src2] (regionshospitalet-horsens, indikator-3)
  Type: health-statistic
  Page: 24
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 21-25
- For Regionshospitalet Horsens var andelen af patienter, der modtog behandling, 96,0 % (95 % CI: 92,5–98,1) i perioden 1. juli 2022 – 30. juni 2023 [^src1] (regionshospitalet-horsens, indikator-4a)
  Type: clinical
  Page: 31
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 31-35

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 6-10
[^src2]: AFDK_2023.pdf, pages 16-20
[^src3]: AFDK_2023.pdf, pages 21-25
[^src4]: AFDK_2023.pdf, pages 26-30
[^src5]: AFDK_2023.pdf, pages 31-35
[^src6]: AFDK_2023.pdf, pages 36-40
[^src7]: AFDK_2023.pdf, pages 41-45
[^src8]: AFDK_2023.pdf, pages 111-115
