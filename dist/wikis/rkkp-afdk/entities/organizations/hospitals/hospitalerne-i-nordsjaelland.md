---
title: Hospitalerne i Nordsjælland
type: entity
aliases:
  - Hospitalerne i Nordsjælland
wiki: rkkp-afdk
updated: '2026-08-05T19:41:37.127Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '16-20, 21-25, 26-30, 36-40, 41-45, 6-10'
tags:
  - organization
---

**Hospitalerne i Nordsjælland** (Hospitals in North Zealand) is a hospital group operating within the [[region-hovedstaden|Capital Region of Denmark]] (Region Hovedstaden). It is a key participant in the Danish national clinical quality database for atrial fibrillation (Databasen for Atrieflimren i Danmark), which evaluates healthcare units on standardized clinical indicators to ensure high-quality treatment and prevent thromboembolic events.

During the reporting period of July 1, 2022, to June 30, 2023, the hospital group was evaluated across several critical quality indicators. For Indicator 1, which focuses on waiting times for anticoagulation treatment, the group successfully met the national standard [^src1]. 

For [[indikator-2|Indicator 2]], which measures the rate of echocardiography performed on newly diagnosed atrial fibrillation patients, the group achieved a compliance rate of 77.7% (95% CI: 74.9–80.3) [^src2]. This result fell short of the national standard of ≥80% for this specific metric [^src2]. 

Regarding [[indikator-3|Indicator 3]], which tracks TSH measurements to screen for underlying thyroid disease, Hospitalerne i Nordsjælland recorded a high performance rate of 91.1% (95% CI: 89.2–92.7) [^src3]. The annual report notes that this 91-92% performance level is very close to the standard [^src4], although the structured data marks the group as not officially meeting the threshold for this specific indicator [^src3].

The group was also assessed on anticoagulation treatment coverage at later stages post-diagnosis (Indicator 4a). Two years after diagnosis, the treatment rate was 89.0% (95% CI: 85.2–92.1) [^src5], and at the five-year mark, the rate was 85.2% (95% CI: 80.1–89.5) [^src6]. In both of these follow-up metrics, the hospital group narrowly missed the ≥90% national standard [^src5] [^src6]. 

Overall, Hospitalerne i Nordsjælland demonstrates a strong commitment to clinical quality, successfully meeting the standard for initial treatment timelines while remaining highly competitive and close to the targets for diagnostic screening and long-term anticoagulation management.

## Mentions
- Page 9: "Hospitalerne i Nordsjælland Ja 520 / 565 0 (0) 92,0 (89,5-94,1) 549 / 604 90,9 88,0" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 6-10)
- Page 16: "Hospitalerne i Nordsjælland Nej 727 / 936 0 (0) 77,7 (74,9-80,3) 852 / 1.203 70,8 69,6" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 16-20)
- Page 23: "Hospitalerne i Nordsjælland Nej 1.011 / 1.110 0 (0) 91,1 (89,2-92,7) 1.083 / 1.203 90,0 92,0" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 21-25)
- Page 29: "Regionshospitalet Horsens og Hospitalerne i Nordsjælland (91-92%) er tæt på." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 26-30)
- Page 36: "Hospitalerne i Nordsjælland Nej 306 / 344 0 (0) 89,0 (85,2-92,1) 369 / 436 84,6 84,1" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 36-40)
- Page 42: "Hospitalerne i Nordsjælland Nej 202 / 237 0 (0) 85,2 (80,1-89,5) 335 / 406 82,5" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 41-45)

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: hospitalerne-i-nordsjaelland
  Predicate: meets-indicator-3-standard
  Object: false
  Evidence: "Hospitalerne i Nordsjælland Nej 1.011 / 1.110 0 (0) 91,1 (89,2-92,7)"
  Page: 23
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 21-25
- Subject: hospitalerne-i-nordsjaelland
  Predicate: has-high-performance-in
  Object: indikator-3
  Evidence: "Regionshospitalet Horsens og Hospitalerne i Nordsjælland (91-92%) er tæt på [standarden]."
  Page: 29
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 26-30

Incoming (this entity is the OBJECT of these relationships):
- Subject: indikator-2
  Predicate: measures
  Object: (this entity)
  Evidence: "Hospitalerne i Nordsjælland er en af de institutioner, der rapporteres i tabellen for Indikator 2."
  Page: 16
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 16-20
- Subject: region-hovedstaden
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Hovedstaden Nej [...] Hospitalerne i Nordsjælland Nej [...]"
  Page: 42
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 41-45

## Claims
- Hospitalerne i Nordsjælland opfyldte Indikator 2 hos 77,7 % (95 % CI: 74,9–80,3) af nydiagnosticerede patienter med atrieflimren i perioden 1. juli 2022 – 30. juni 2023 [^src1] (hospitalerne-i-nordsjaelland, indikator-2)
  Type: clinical
  Page: 16
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 16-20
- Hospitalerne i Nordsjælland har en Indikator 3-andel på 91,1 % (95 % CI: 89,2–92,7) [^src2] (hospitalerne-i-nordsjaelland, indikator-3)
  Type: health-statistic
  Page: 23
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 21-25

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 6-10
[^src2]: AFDK_2023.pdf, pages 16-20
[^src3]: AFDK_2023.pdf, pages 21-25
[^src4]: AFDK_2023.pdf, pages 26-30
[^src5]: AFDK_2023.pdf, pages 36-40
[^src6]: AFDK_2023.pdf, pages 41-45
