---
title: Laboratorieregistret
type: entity
wiki: rkkp-afdk
updated: '2026-08-14T20:09:22.484Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 51-55
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 41-45
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 31-35
tags:
  - organization
---
Laboratorieregistret is a Danish health data registry that serves as a critical infrastructure component for monitoring clinical quality in cardiovascular care. Specifically, it delivers plasma creatinine (p-creatinin) measurements identified via NPU codes (NPU04998 and NPU18016), which are essential for assessing kidney function [^src1]. This data is the foundational source for calculating [[indikator-4b|Indikator 4b]], a key clinical quality indicator that measures adherence to annual kidney function monitoring among patients receiving Direct Oral Anticoagulant (DOAC) therapy for atrial fibrillation [^src1].

The registry operates within a broader national data infrastructure. Laboratory results from the country's major laboratories are initially made available through [[den-nationale-labdatabank|Den Nationale Labdatabank]] [^src1]. From there, the data is ingested into the Laboratory Database managed by the Danish Health Data Authority (Sundhedsdatastyrelsen), effectively feeding into Laboratorieregistret to support national health quality measurements [^src1].

Laboratorieregistret's role as a primary data source for [[indikator-4b|Indikator 4b]] has been consistently documented across multiple annual reports from the Danish Atrial Fibrillation Database (AFDK). It is explicitly cited alongside the National Patient Register (Landspatientregisteret) and the Register of Medicinal Product Statistics (Lægemiddelstatistikregisteret) as one of the core registries used to calculate the indicator in the 2022–2023 [^src1], 2024 [^src2], and 2025 [^src3] reporting cycles. By providing reliable, standardized laboratory data, Laboratorieregistret enables the ongoing evaluation of clinical safety and systemic quality in anticoagulation treatment across Denmark's healthcare sectors [^src3].

## Mentions
- Page 53: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 51-55) [^src1]
- Page 43: "Laboratorieregistret" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45) [^src2]
- Page 34: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 31-35) [^src3]

## Relationships
**Outgoing**
- **Subject:** laboratorieregistret
  **Predicate:** feeds-into
  **Object:** den-nationale-labdatabank
  **Evidence:** "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen."
  **Page:** 53
  **Source:** wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 51-55 [^src1]

**Incoming**
- **Subject:** indikator-4b
  **Predicate:** is-calculated-using
  **Object:** Laboratorieregistret
  **Evidence:** "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret."
  **Page:** 53
  **Source:** wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 51-55 [^src1]

- **Subject:** indikator-4b
  **Predicate:** uses-data-from
  **Object:** Laboratorieregistret
  **Evidence:** "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret."
  **Page:** 43
  **Source:** wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45 [^src2]

- **Subject:** indikator-4b
  **Predicate:** uses-data-from
  **Object:** Laboratorieregistret
  **Evidence:** "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret."
  **Page:** 34
  **Source:** wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 31-35 [^src3]

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 51-55
[^src2]: AFDK_2024.pdf, pages 41-45
[^src3]: AFDK_2025.pdf, pages 31-35
