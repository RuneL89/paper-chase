---
title: Lægemiddelstatistikregisteret
type: entity
aliases:
  - Lægemiddelstatistikregisteret
  - Lægemiddelstatistikregistret
wiki: rkkp-afdk
updated: '2026-08-05T20:03:57.714Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '11-15, 46-50, 51-55'
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '11-15, 36-40, 41-45'
tags:
  - organization
---
Lægemiddelstatistikregisteret (The Danish Register of Medicinal Product Statistics) is a central national registry in Denmark that tracks medicinal product prescriptions and redemptions. Within the context of the Danish Atrial Fibrillation Database (AFDK) and its annual quality reports published by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP), the register serves as a foundational data source for evaluating the quality and safety of cardiovascular care [^src1], [^src2], [^src3], [^src4], [^src5], [^src6]. 

Specifically, the registry is instrumental in identifying and tracking [[antikoagulationsbehandling]] among patients diagnosed with atrial fibrillation [^src3], [^src6]. By capturing data on prescription redemptions—often analyzed within specific timeframes, such as 90 days before and after clinical timestamps—it enables precise measurement of treatment coverage and persistence over time [^src1], [^src4]. 

The data from Lægemiddelstatistikregisteret is frequently integrated with other national databases, such as the Landspatientregisteret (National Patient Registry) and the Laboratorieregistret (Laboratory Registry), to calculate several key clinical quality indicators [^src2], [^src5], [^src6]. It directly provides data for [[indikator-1|Indikator 1]], which measures the timely initiation of anticoagulation therapy in newly diagnosed patients [^src6]. It is also the primary data source for [[indikator-4a|Indikator 4a]] and its sub-indicator [[indikator-4a3|Indikator 4a3]], which assess long-term treatment persistence at one, two, and five years post-diagnosis [^src1], [^src4]. Furthermore, the registry's ATC codes are utilized in [[indikator-4b|Indikator 4b]] to identify patients on Direct Oral Anticoagulants (DOACs) who require annual safety monitoring of their kidney function [^src2], [^src5]. 

Through these integrations, Lægemiddelstatistikregisteret underpins the decentralized, data-driven quality management of the Danish healthcare system, allowing for national, regional, and local evaluations of cardiovascular treatment standards [^src3], [^src4], [^src5].

## Mentions
- Page 47: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 46-50) [^src1]
- Page 53: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 51-55) [^src2]
- Page 14: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 11-15) [^src3]
- Page 37: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 36-40) [^src4]
- Page 43: "Lægemiddelstatistikregisteret (ATC-koder)" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45) [^src5]
- Page 15: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 11-15) [^src6]

## Relationships

### Outgoing (this entity is the SUBJECT of these relationships)
- Subject: laegemiddelstatistikregisteret
  Predicate: provides-data-to
  Object: indikator-4a
  Evidence: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret."
  Page: 47
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 46-50 [^src1]

- Subject: laegemiddelstatistikregisteret
  Predicate: supports
  Object: antikoagulationsbehandling
  Evidence: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)"
  Page: 14
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 11-15 [^src3]

### Incoming (this entity is the OBJECT of these relationships)
- Subject: indikator-4b
  Predicate: is-calculated-using
  Object: (this entity)
  Evidence: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret."
  Page: 53
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 51-55 [^src2]

- Subject: indikator-4a3
  Predicate: is-calculated-from
  Object: (this entity)
  Evidence: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret."
  Page: 37
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 36-40 [^src4]

- Subject: indikator-4b
  Predicate: uses-data-from
  Object: (this entity)
  Evidence: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret."
  Page: 43
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45 [^src5]

- Subject: indikator-1
  Predicate: uses-data-from
  Object: (this entity)
  Evidence: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)."
  Page: 15
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 11-15 [^src6]

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 46-50
[^src2]: AFDK_2023.pdf, pages 51-55
[^src3]: AFDK_2024.pdf, pages 11-15
[^src4]: AFDK_2024.pdf, pages 36-40
[^src5]: AFDK_2024.pdf, pages 41-45
[^src6]: AFDK_2023.pdf, pages 11-15
