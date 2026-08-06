---
title: LABKA
type: entity
wiki: rkkp-afdk
updated: '2026-08-05T20:01:11.730Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 26-30
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 21-25
tags:
  - system
---
LABKA is the national laboratory information system in Denmark where measurements of [[thyreoideastimulerende-hormon-tsh|thyreoideastimulerende hormon (TSH)]] are registered. In the context of the Danish Atrial Fibrillation Database (AFDK) and the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP), LABKA is essential for tracking clinical quality metrics, particularly [[indikator-3|Indikator 3]], which measures the rate of thyroid disease screening via TSH tests for patients newly diagnosed with atrial fibrillation.

However, LABKA's internal coding structures have been identified as a systemic barrier to complete data registration. The [[afdk-styregruppe|Styregruppen for AFDK]] assessed that there are significant challenges arising from the use of different codes for a single TSH measurement within LABKA [^src1]. Because of these coding variations, extracting complete TSH data for national quality reports is hindered [^src1]. In addition to addressing these technical barriers, the steering group emphasized that greater focus must be placed on actually measuring TSH in patients with newly diagnosed atrial fibrillation [^src1]. These coding discrepancies continued to be noted as an ongoing issue in subsequent evaluations [^src2].

## Mentions
- Page 29: "forskellige koder for en TSH måling i LABKA" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 26-30) [^src1]
- Page 24: "forskellige koder for en TSH måling i LABKA" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 21-25) [^src2]

## Relationships
- Subject: labka
  Predicate: contains-codes-for
  Object: thyreoideastimulerende-hormon-tsh
  Evidence: "forskellige koder for en TSH måling i LABKA"
  Page: 29
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 26-30 [^src1]
- Subject: labka
  Predicate: codes-test-for
  Object: thyreoideastimulerende-hormon-tsh
  Evidence: "forskellige koder for en TSH måling i LABKA"
  Page: 24
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 21-25 [^src2]

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
