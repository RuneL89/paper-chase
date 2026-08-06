---
title: Laboratorieregistret
type: entity
wiki: rkkp-afdk
updated: '2026-08-05T20:07:58.769Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 51-55
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 41-45
tags:
  - organization
---
Laboratorieregistret is a Danish national registry that plays a critical role in monitoring the clinical quality of cardiovascular care, specifically for patients with atrial fibrillation. It provides essential laboratory data, including plasma creatinine (p-creatinin) measurements identified by specific NPU codes (NPU04998 and NPU18016), which are vital for assessing renal function [^src2]. This data is a foundational component for calculating [[indikator-4b|Indikator 4b]], a national quality indicator that tracks whether patients on Direct Oral Anticoagulants (DOACs) receive their required annual kidney function checks [^src1] [^src2].

The registry operates as part of a broader national health data infrastructure. Laboratory results from major laboratories across the country are connected to [[den-nationale-labdatabank|Den Nationale Labdatabank]], from which they are imported into the Laboratory Database at the Danish Health Data Authority (Sundhedsdatastyrelsen) [^src1]. By supplying this data, Laboratorieregistret enables the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP) and the Atrial Fibrillation Database (AFDK) to evaluate and report on healthcare quality, ensuring that patients on blood thinners are safely monitored for kidney impairment [^src1] [^src2].

## Mentions

- Page 53: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret." [^src1]
- Page 43: "Laboratorieregistret" [^src2]

## Relationships

- **laboratorieregistret** -> **feeds-into** -> **den-nationale-labdatabank**
  - Evidence: "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." [^src1]
- **indikator-4b** -> **is-calculated-using** -> **laboratorieregistret**
  - Evidence: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret." [^src1]
- **indikator-4b** -> **uses-data-from** -> **laboratorieregistret**
  - Evidence: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret." [^src2]

## Claims

(none)

## Timeline

(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 51-55
[^src2]: AFDK_2024.pdf, pages 41-45
