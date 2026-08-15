---
title: NPU18016 (P-Kreatinin)
type: entity
aliases:
  - NPU18016 (P-Kreatinin)
  - NPU18016
wiki: rkkp-afdk
updated: '2026-08-14T20:41:16.121Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 116-120
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '106-110, 41-45'
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: '31-35, 91-95'
tags:
  - laboratory-test-code
---

**NPU18016 (P-Kreatinin)** is a specific laboratory test code used within the Danish healthcare system to measure [[p-creatinin|P-creatinin]] (plasma creatinine) levels [^src4]. It plays a critical role in the national clinical quality assurance framework for patients diagnosed with [[atrieflimren]] [^src1]. Specifically, it is one of two designated codes—alongside its alternative, [[npu04998-p-kreatinin|NPU04998 (P-Kreatinin)]]—used to verify that patients receiving Direct Oral Anticoagulant (DOAC) therapy undergo mandatory annual kidney function monitoring [^src1]. 

The use of NPU18016 exhibits a distinct geographic distribution across Denmark's healthcare regions. While NPU04998 is predominantly used in the Capital Region and Region Zealand, NPU18016 is the primary code utilized in [[region-syddanmark|Region Syddanmark]] and [[region-nordjylland|Region Nordjylland]] [^src5]. By capturing these laboratory results from the national Laboratory Registry, the code directly feeds into the calculation of [[indikator-4b|Indikator 4b]], a key quality metric that tracks the proportion of DOAC-treated patients who receive timely renal function checks [^src3]. 

Ultimately, NPU18016 is a foundational data element in the annual reports published by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP) and the Danish Atrial Fibrillation Database (AFDK) [^src2]. Its standardized application allows health authorities to evaluate clinical safety, monitor systemic quality in anticoagulation treatment, and compare healthcare performance across different regional infrastructures [^src3].

## Mentions

- Page 117: "NPU18016 (P-Kreatinin)" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120) [^src1]
- Page 106: "NPU18016 (P-Kreatinin)" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 106-110) [^src2]
- Page 34: "Fra Laboratorieregistret indhentes informationer om p-creatinin vha. to NPU-koder: NPU04998, som overvejende anvendes i Region Hovedstaden og Region Sjælland, og NPU18016, som overvejende anvendes i Region Syddanmark og Region Nordjylland." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 31-35) [^src3]
- Page 92: "NPU18016 (P-Kreatinin)" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95) [^src4]
- Page 43: "NPU18016" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45) [^src5]

## Relationships

**Outgoing (this entity is the SUBJECT of these relationships):**
- Subject: npu18016-p-kreatinin
  Predicate: is-laboratory-test-for
  Object: atrieflimren
  Evidence: "Kode:
NPU18016 (P-Kreatinin)"
  Page: 117
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120 [^src1]

- Subject: npu18016-p-kreatinin
  Predicate: is-alternative-lab-test-for
  Object: npu04998-p-kreatinin
  Evidence: "NPU04998 (P-Kreatinin)
NPU18016 (P-Kreatinin)"
  Page: 106
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 106-110 [^src2]

- Subject: npu18016-p-kreatinin
  Predicate: is-laboratory-test-code-for
  Object: p-creatinin
  Evidence: "NPU18016 (P-Kreatinin)"
  Page: 92
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95 [^src4]

- Subject: npu18016-p-kreatinin
  Predicate: is-used-in-region
  Object: region-syddanmark
  Evidence: "NPU18016, som overvejende anvendes i Region Syddanmark og Region Nordjylland."
  Page: 43
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45 [^src5]

- Subject: npu18016-p-kreatinin
  Predicate: is-used-in-region
  Object: region-nordjylland
  Evidence: "NPU18016, som overvejende anvendes i Region Syddanmark og Region Nordjylland."
  Page: 43
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45 [^src5]

**Incoming (this entity is the OBJECT of these relationships):**
- Subject: indikator-4b
  Predicate: is-calculated-using
  Object: (this entity)
  Evidence: "Fra Laboratorieregistret indhentes informationer om p-creatinin vha. to NPU-koder: NPU04998, som overvejende anvendes i Region Hovedstaden og Region Sjælland, og NPU18016, som overvejende anvendes i Region Syddanmark og Region Nordjylland."
  Page: 34
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 31-35 [^src3]

## Claims

- For kontrol af nyrefunktion hos patienter på DOAC anvendes koderne NPU04998 (P-Kreatinin) og NPU18016 (P-Kreatinin) [^src1] (npu04998-p-kreatinin, npu18016-p-kreatinin)
  Type: laboratory
  Page: 117
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120 [^src1]

## Timeline

(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 116-120
[^src2]: AFDK_2024.pdf, pages 106-110
[^src3]: AFDK_2025.pdf, pages 31-35
[^src4]: AFDK_2025.pdf, pages 91-95
[^src5]: AFDK_2024.pdf, pages 41-45
