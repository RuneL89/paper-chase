---
title: LABKA
type: entity
wiki: rkkp-afdk
updated: '2026-08-14T20:05:10.748Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 26-30
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 21-25
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 21-25
tags:
  - system
---

LABKA is the national laboratory information system in Denmark where clinical laboratory results, such as measurements of [[thyreoideastimulerende-hormon-tsh|thyreoideastimulerende hormon (TSH)]], are registered [^src1]. It serves as a foundational data source for national clinical quality registries, including the Danish Atrial Fibrillation registry (AFDK) managed under the Danish Regions' Clinical Quality Development Programme (RKKP). 

Within the context of atrial fibrillation care, LABKA is critical for tracking [[indikator-3|Indikator 3]], a quality metric that measures whether patients receive a TSH test upon a new diagnosis of atrial fibrillation to rule out underlying thyroid disease [^src1]. However, the [[afdk-styregruppe|Styregruppen for AFDK]] has identified LABKA's internal coding practices as a structural barrier to complete and accurate data registration [^src1]. Specifically, the existence of multiple different codes for a single TSH measurement within the system has created challenges in capturing comprehensive data for national reporting [^src2]. 

To address these systemic barriers and improve data coverage, technical adjustments have been noted to ensure that all variations of TSH measurement codes in LABKA are successfully captured and transferred to [[sundk|SundK]], the national health data platform [^src3]. This integration is vital for overcoming the limitations of voluntary reporting and ensuring that clinical quality indicators accurately reflect nationwide practices.

## Mentions
- Page 29: "forskellige koder for en TSH måling i LABKA" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 26-30)
- Page 24: "forskellige koder for en TSH måling i LABKA" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 21-25)
- Page 24: "der kan være udfordringer med forskellige koder for en TSH måling i LABKA" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 21-25)
- Page 24: "alle koder for TSH målinger i LABKA bliver ”fanget” og overført til SundK." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 21-25)

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: labka
  Predicate: contains-codes-for
  Object: thyreoideastimulerende-hormon-tsh
  Evidence: "forskellige koder for en TSH måling i LABKA"
  Page: 29
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 26-30
- Subject: labka
  Predicate: codes-test-for
  Object: thyreoideastimulerende-hormon-tsh
  Evidence: "forskellige koder for en TSH måling i LABKA"
  Page: 24
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 21-25
- Subject: labka
  Predicate: is-used-in
  Object: sundk
  Evidence: "alle koder for TSH målinger i LABKA bliver ”fanget” og overført til SundK."
  Page: 24
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 21-25

Incoming (this entity is the OBJECT of these relationships):
- Subject: sundk
  Predicate: receives-data-from
  Object: (this entity)
  Evidence: "alle koder for TSH målinger i LABKA bliver ”fanget” og overført til SundK."
  Page: 24
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 21-25

## Claims
- Styregruppen vurderer, at der dels kan være udfordringer med forskellige koder for en TSH måling i LABKA og dels bør der sættes større fokus på at få målt TSH hos patienter med nydiagnosticeret atrieflimren [^src1] (afdk-styregruppe, indikator-3, labka, thyreoideastimulerende-hormon-tsh)
  Type: policy-assessment
  Page: 29
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 26-30

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 26-30
[^src2]: AFDK_2024.pdf, pages 21-25
[^src3]: AFDK_2025.pdf, pages 21-25
