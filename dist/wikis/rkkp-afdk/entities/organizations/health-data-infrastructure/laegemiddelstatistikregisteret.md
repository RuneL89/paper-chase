---
title: Lægemiddelstatistikregisteret
type: entity
aliases:
  - Lægemiddelstatistikregisteret
  - Lægemiddelstatistikregistret
wiki: rkkp-afdk
updated: '2026-08-14T20:08:12.939Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '11-15, 46-50, 51-55'
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '11-15, 36-40, 41-45'
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: '11-15, 26-30, 31-35'
tags:
  - organization
---

**Lægemiddelstatistikregisteret** (The Danish National Registry of Medicinal Product Statistics) is a central national database in Denmark that tracks medicinal product prescriptions and redemptions [^src3]. Within the context of the Danish healthcare system's quality assurance programs, it serves as a critical data infrastructure component for evaluating cardiovascular care, specifically for patients with atrial fibrillation [^src1]. 

The registry is extensively utilized by the Atrial Fibrillation in Denmark (AFDK) database to monitor and assess the quality of clinical treatments [^src6]. By capturing Anatomical Therapeutic Chemical (ATC) codes, it enables health authorities to track whether patients are redeeming their prescribed medications [^src2]. This data is particularly vital for identifying and monitoring [[antikoagulationsbehandling]] (anticoagulation treatment), as the registry tracks prescription redemptions within specific timeframes, such as 90 days before and after clinical timestamps [^src3]. 

To provide a comprehensive view of patient care, Lægemiddelstatistikregisteret is frequently cross-referenced with other national databases, most notably the Landspatientregisteret (LPR) and the Laboratory Registry [^src2]. Together, these registries form the evidentiary backbone for calculating several national clinical quality indicators. For instance, the registry's prescription data is essential for calculating [[indikator-1]], which measures the timely initiation of anticoagulation therapy in newly diagnosed patients [^src6]. It also underpins [[indikator-4a]] and [[indikator-4a3]], which evaluate long-term treatment persistence and coverage over time [^src4]. Furthermore, when combined with laboratory data, the registry helps calculate [[indikator-4b]], which monitors safety practices such as annual renal function checks for patients on Direct Oral Anticoagulants (DOACs) [^src8]. 

Through these integrations, Lægemiddelstatistikregisteret plays an indispensable role in Denmark's decentralized but data-driven healthcare quality management system, ensuring that treatments are not only initiated correctly but maintained and monitored safely over time [^src7].

## Mentions

- Page 47: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 46-50) [^src1]
- Page 53: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 51-55) [^src2]
- Page 14: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 11-15) [^src3]
- Page 37: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 36-40) [^src4]
- Page 43: "Lægemiddelstatistikregisteret (ATC-koder)" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45) [^src5]
- Page 14: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 11-15) [^src6]
- Page 29: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 26-30) [^src7]
- Page 34: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 31-35) [^src8]
- Page 15: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 11-15) [^src9]

## Relationships

**Outgoing**
- Subject: laegemiddelstatistikregisteret | Predicate: provides-data-to | Object: indikator-4a | Evidence: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret." | Page: 47 | Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 46-50 [^src1]
- Subject: laegemiddelstatistikregisteret | Predicate: supports | Object: antikoagulationsbehandling | Evidence: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)" | Page: 14 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 11-15 [^src3]

**Incoming**
- Subject: indikator-4b | Predicate: is-calculated-using | Object: (this entity) | Evidence: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret." | Page: 53 | Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 51-55 [^src2]
- Subject: indikator-4a3 | Predicate: is-calculated-from | Object: (this entity) | Evidence: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret." | Page: 37 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 36-40 [^src4]
- Subject: indikator-4b | Predicate: uses-data-from | Object: (this entity) | Evidence: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret." | Page: 43 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45 [^src5]
- Subject: indikator-1 | Predicate: uses-data-from | Object: (this entity) | Evidence: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)." | Page: 14 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 11-15 [^src6]
- Subject: indikator-4a | Predicate: uses-data-from | Object: (this entity) | Evidence: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret." | Page: 29 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 26-30 [^src7]
- Subject: indikator-4b | Predicate: uses-data-from | Object: (this entity) | Evidence: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret." | Page: 34 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 31-35 [^src8]
- Subject: indikator-1 | Predicate: uses-data-from | Object: (this entity) | Evidence: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)." | Page: 15 | Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 11-15 [^src9]

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
[^src6]: AFDK_2025.pdf, pages 11-15
[^src7]: AFDK_2025.pdf, pages 26-30
[^src8]: AFDK_2025.pdf, pages 31-35
[^src9]: AFDK_2023.pdf, pages 11-15
