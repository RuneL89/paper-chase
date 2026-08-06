---
title: NPU18016 (P-Kreatinin)
type: entity
aliases:
  - NPU18016 (P-Kreatinin)
  - NPU18016
wiki: rkkp-afdk
updated: '2026-08-05T20:45:42.662Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 116-120
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '106-110, 41-45'
tags:
  - laboratory-test-code
---
**NPU18016 (P-Kreatinin)** is a specific laboratory test code utilized within the Danish healthcare system to measure serum creatinine levels. In the context of national clinical quality monitoring, it is one of two designated codes used to track kidney function assessments for patients with [[atrieflimren]] who are undergoing Direct Oral Anticoagulant (DOAC) therapy [^src1]. Ensuring regular kidney function checks—at least once annually—is a critical quality indicator for this patient population, as DOAC medications require careful renal monitoring [^src3].

Within the national databases managed by the Danish Regions' Clinical Quality Development Programme (RKKP), NPU18016 functions as an alternative laboratory code to [[npu04998-p-kreatinin|NPU04998 (P-Kreatinin)]] for identifying P-creatinine measurements [^src2]. Because different regions in Denmark may utilize different laboratory information systems and coding practices, the national quality indicators must account for multiple codes to ensure accurate data capture. Specifically, the NPU18016 code is predominantly used in [[region-syddanmark|Region Syddanmark]] and [[region-nordjylland|Region Nordjylland]] [^src3]. By aggregating data from both NPU18016 and NPU04998, health authorities can accurately evaluate Indicator 4b, which measures the proportion of DOAC-treated [[atrieflimren]] patients receiving their required annual kidney function tests [^src3].

## Mentions
- Page 117: "NPU18016 (P-Kreatinin)" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120)
- Page 106: "NPU18016 (P-Kreatinin)" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 106-110)
- Page 43: "NPU18016" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45)

## Relationships
- Subject: npu18016-p-kreatinin
  Predicate: is-laboratory-test-for
  Object: atrieflimren
  Evidence: "Kode:
NPU18016 (P-Kreatinin)"
  Page: 117
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120
- Subject: npu18016-p-kreatinin
  Predicate: is-alternative-lab-test-for
  Object: npu04998-p-kreatinin
  Evidence: "NPU04998 (P-Kreatinin)
NPU18016 (P-Kreatinin)"
  Page: 106
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 106-110
- Subject: npu18016-p-kreatinin
  Predicate: is-used-in-region
  Object: region-syddanmark
  Evidence: "NPU18016, som overvejende anvendes i Region Syddanmark og Region Nordjylland."
  Page: 43
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45
- Subject: npu18016-p-kreatinin
  Predicate: is-used-in-region
  Object: region-nordjylland
  Evidence: "NPU18016, som overvejende anvendes i Region Syddanmark og Region Nordjylland."
  Page: 43
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45

## Claims
- For kontrol af nyrefunktion hos patienter på DOAC anvendes koderne NPU04998 (P-Kreatinin) og NPU18016 (P-Kreatinin) [^src1] (npu04998-p-kreatinin, npu18016-p-kreatinin)
  Type: laboratory
  Page: 117
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 116-120
[^src2]: AFDK_2024.pdf, pages 106-110
[^src3]: AFDK_2024.pdf, pages 41-45
