---
title: Lægemiddelstatistikregisteret
type: entity
aliases:
  - Lægemiddelstatistikregisteret
  - Lægemiddelstatistikregistret
wiki: rkkp-afdk
updated: '2026-08-03T19:14:15.322Z'
sources:
  - file: AFDK_2023.pdf
    pages: '11-15, 46-50, 51-55'
  - file: AFDK_2024.pdf
    pages: '11-15, 36-40, 41-45'
tags:
  - organization
---

# Lægemiddelstatistikregisteret

Lægemiddelstatistikregisteret is a Danish pharmaceutical statistics register that serves as one of the two primary data sources for Indicator 4a, the quality indicator tracking whether patients with an indication for anticoagulation therapy actually redeem prescriptions for that treatment[^src1]. It is repeatedly cited across the annual reports of [[databasen-for-atrieflimren-i-danmark|Databasen for Atrieflimren i Danmark]] as a key registry underpinning several quality indicators used to monitor treatment of [[atrieflimren|Atrieflimren]] (atrial fibrillation) in Denmark.

Across both the 2023 and 2024 annual reports, the register is named alongside Landspatientregisteret (the National Patient Register) as the data foundation for calculating Indicator 4a: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret"[^src1][^src3]. For Indicator 4b, which measures whether patients on direct oral anticoagulants (DOAC) receive at least one annual P-creatinin measurement, the register additionally supplies ATC-code data, appearing together with Landspatientregisteret and Laboratorieregistret: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret"[^src2][^src4]. It is also cited as a data foundation for [[indikator-1-antikoagulation-waiting-time|Indikator 1]], which tracks whether newly diagnosed atrial fibrillation patients begin anticoagulation therapy within 30 days of diagnosis: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)"[^src5][^src6].

Taken together, these mentions show Lægemiddelstatistikregisteret functioning as a recurring, foundational data source cited consistently across multiple indicators and multiple report years (2023 and 2024), reflecting its role as a standard reference registry within the Danish clinical quality databases underpinning atrial fibrillation care monitoring.

## Mentions

- Page 47: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret." [^src1]
- Page 53: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret." [^src2]
- Page 37: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret." [^src3]
- Page 43: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret" [^src4]
- Page 15: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregistret (LPR)" [^src5]
- Page 14: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)" [^src6]

## Relationships

**Outgoing (Lægemiddelstatistikregisteret as subject):**

- Subject: laegemiddelstatistikregisteret — Predicate: provides-data-for — Object: atrieflimren
  Evidence: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret." (Page 37) [^src3]
- Subject: laegemiddelstatistikregisteret — Predicate: provides-data-for — Object: indikator-4b
  Evidence: "Data til beregning af indikatoren indhentes fra Lægemiddelstatistikregisteret (ATC-koder)" (Page 43) [^src4]

**Incoming (Lægemiddelstatistikregisteret as object):**

- Subject: databasen-for-atrieflimren-i-danmark — Predicate: uses-data-from — Object: (this entity)
  Evidence: "Data til beregning af indikatoren er indhentet fra Lægemiddelstatistikregisteret" (Page 47) [^src1]
- Subject: databasen-for-atrieflimren-i-danmark — Predicate: uses-data-from — Object: (this entity)
  Evidence: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret" (Page 53) [^src2]
- Subject: databasen-for-atrieflimren-i-danmark — Predicate: uses-data-from — Object: (this entity)
  Evidence: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregistret (LPR)" (Page 15) [^src5]
- Subject: indikator-1-antikoagulation-waiting-time — Predicate: uses-data-from — Object: (this entity)
  Evidence: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)" (Page 14) [^src6]

## Claims

(none)

## Timeline

(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 46-50
[^src2]: AFDK_2023.pdf, pages 51-55
[^src3]: AFDK_2024.pdf, pages 36-40
[^src4]: AFDK_2024.pdf, pages 41-45
[^src5]: AFDK_2023.pdf, pages 11-15
[^src6]: AFDK_2024.pdf, pages 11-15
