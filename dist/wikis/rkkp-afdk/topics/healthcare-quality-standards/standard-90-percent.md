---
title: '"Standard: ≥90 %"'
type: entity
aliases:
  - 'Standard: ≥90 %'
wiki: rkkp-afdk
updated: '2026-08-14T20:06:37.808Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 41-45
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 31-35
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 31-35
tags:
  - topic
---
The "Standard: ≥90 %" is the national quality target benchmark for [[indikator-4a|Indikator 4a]], which measures the treatment coverage of [[antikoagulationsbehandling]] among patients diagnosed with [[atrieflimren]] in Denmark [^src1]. This standard defines the threshold that a region or hospital must meet to fulfill the requirement for adequate anticoagulation treatment coverage [^src1]. It is a central component of the Danish Regions' Clinical Quality Development Programme (RKKP) strategy to monitor and improve cardiovascular care, specifically aiming to prevent strokes in atrial fibrillation patients [^src2].

The ≥90% benchmark applies not only to the primary 2-year treatment coverage metric ([[indikator-4a|Indikator 4a]]) [^src1] but also extends to the 5-year treatment coverage metric ([[indikator-4a3|Indikator 4a3]]) [^src2]. Furthermore, it serves as a foundational target for related indicators, such as [[indikator-4b|Indikator 4b]], which tracks development goals (e.g., aiming for ≥95%) [^src3]. 

Performance against this standard varies across the Danish healthcare system. For instance, in a 5-year analysis, [[region-nordjylland|Region Nordjylland]] was the only region to meet the ≥90% standard, achieving a treatment coverage rate of 92.4% (95% CI: 89.8–94.5) [^src1]. The continuous tracking of this standard across national, regional, and local cluster levels highlights its significance in evaluating healthcare quality and ensuring adherence to clinical guidelines for atrial fibrillation management [^src2].

## Mentions
- Page 42: "Standard: ≥90 %" [^src1]
- Page 31: "Standard Uoplyst Aktuelle år Tidligere år
≥ 90% Tæller/ antal 01.07.2021 - 30.06.2022 2020/21 2019/20" [^src2]
- Page 34: "Standard Uoplyst Aktuelle år Tidligere år
≥ 90% Tæller/ antal 01.07.2018 - 30.06.2019 2017/18 2016/17" [^src2]
- Page 35: "Standard Uoplyst Aktuelle år Tidligere år
≥ 90% Tæller/ antal 01.07.2018 - 30.06.2019 2017/18 2016/17" [^src2]

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: standard-90-percent
  Predicate: is-target-for
  Object: indikator-4a
  Evidence: "Standard: ≥90 %"
  Page: 42
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 41-45 [^src1]

- Subject: standard-90-percent
  Predicate: applies-to
  Object: indikator-4a3
  Evidence: "Standard ≥ 90% Tæller/ antal 01.07.2018 - 30.06.2019"
  Page: 34
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 31-35 [^src2]

Incoming (this entity is the OBJECT of these relationships):
- Subject: indikator-4b
  Predicate: has-target
  Object: (this entity)
  Evidence: "Udviklingsmål ≥ 95%"
  Page: 31
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 31-35 [^src3]

## Claims
- Standarden for Indikator 4a er ≥90 % [^src1] (standard-90-percent, indikator-4a)
  Type: standard
  Page: 42
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 41-45
- Nordjylland er den eneste region, der opfylder standarden på ≥90 %, med en andel på 92,4 % (95 % CI: 89,8–94,5) ved 5-årsanalyse [^src1] (region-nordjylland, standard-90-percent, indikator-4a)
  Type: performance
  Page: 42
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 41-45
- Standarden for behandlingsdækning med antikoagulation hos patienter med atrieflimren er ≥ 90 % [^src1] (standard-90-percent, atrieflimren, antikoagulationsbehandling)
  Type: healthcare-quality-standards
  Page: 31
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 31-35

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 41-45
[^src2]: AFDK_2024.pdf, pages 31-35
[^src3]: AFDK_2025.pdf, pages 31-35
