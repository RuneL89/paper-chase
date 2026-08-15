---
title: NPU04998 (P-Kreatinin)
type: entity
aliases:
  - NPU04998 (P-Kreatinin)
  - NPU04998
wiki: rkkp-afdk
updated: '2026-08-14T20:40:37.918Z'
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
**NPU04998 (P-Kreatinin)** is a specific laboratory test code used in the Danish healthcare system to measure [[p-creatinin|P-creatinin]] levels. It serves as a critical component in the national quality assurance framework for patients with [[atrieflimren]] who are treated with direct oral anticoagulants ([[doac|DOAC]]) [^src1] [^src2]. Specifically, it is one of two designated codes—alongside [[npu18016-p-kreatinin|NPU18016 (P-Kreatinin)]]—used to calculate [[indikator-4b|Indikator 4b]], a national quality indicator that tracks whether these patients receive the required annual monitoring of their kidney function [^src3] [^src5]. 

The use of NPU04998 exhibits distinct regional patterns within Denmark. According to registry data methodologies, NPU04998 is predominantly utilized in [[region-hovedstaden|Region Hovedstaden]] and [[region-sjaelland|Region Sjælland]], whereas the alternative code NPU18016 is more commonly used in Region Syddanmark and Region Nordjylland [^src3] [^src5]. This regional variation in coding practices is explicitly accounted for in the data extraction processes from the Danish Laboratory Register to ensure accurate and comprehensive national reporting on anticoagulation safety [^src3].

By integrating this specific code into the national clinical quality databases, healthcare authorities can systematically evaluate the safety of DOAC prescriptions. Ensuring at least one annual creatinine measurement is a vital safety protocol, as kidney function directly impacts the metabolism and safe dosing of DOAC medications in atrial fibrillation patients [^src1] [^src2] [^src4].

## Mentions

- Page 117: "Kode:
NPU04998 (P-Kreatinin)" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120)
- Page 106: "Kode:
NPU04998 (P-Kreatinin)" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 106-110)
- Page 34: "Fra Laboratorieregistret indhentes informationer om p-creatinin vha. to NPU-koder: NPU04998, som overvejende anvendes i Region Hovedstaden og Region Sjælland, og NPU18016, som overvejende anvendes i Region Syddanmark og Region Nordjylland." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 31-35)
- Page 92: "NPU04998 (P-Kreatinin)" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95)
- Page 43: "NPU04998" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45)

## Relationships

**Outgoing (this entity is the SUBJECT of these relationships):**

- Subject: npu04998-p-kreatinin
  Predicate: is-laboratory-test-for
  Object: atrieflimren
  Evidence: "Andelen af patienter med atrieflimren i behandling med direkte orale antikoagulantia (DOAC) med mindst 1 måling af P-creatinin årligt"
  Page: 117
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120
- Subject: npu04998-p-kreatinin
  Predicate: is-required-lab-test-for
  Object: doac
  Evidence: "Andelen af patienter med atrieflimren i behandling med direkte orale antikoagulantia (DOAC) med mindst 1 måling af P-creatinin årligt"
  Page: 106
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 106-110
- Subject: npu04998-p-kreatinin
  Predicate: is-laboratory-test-code-for
  Object: p-creatinin
  Evidence: "NPU04998 (P-Kreatinin)"
  Page: 92
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: npu04998-p-kreatinin
  Predicate: is-used-in-region
  Object: region-hovedstaden
  Evidence: "NPU04998, som overvejende anvendes i Region Hovedstaden og Region Sjælland"
  Page: 43
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45
- Subject: npu04998-p-kreatinin
  Predicate: is-used-in-region
  Object: region-sjaelland
  Evidence: "NPU04998, som overvejende anvendes i Region Hovedstaden og Region Sjælland"
  Page: 43
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45

**Incoming (this entity is the OBJECT of these relationships):**

- Subject: npu18016-p-kreatinin
  Predicate: is-alternative-lab-test-for
  Object: (this entity)
  Evidence: "NPU04998 (P-Kreatinin)
NPU18016 (P-Kreatinin)"
  Page: 106
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 106-110
- Subject: indikator-4b
  Predicate: is-calculated-using
  Object: (this entity)
  Evidence: "Fra Laboratorieregistret indhentes informationer om p-creatinin vha. to NPU-koder: NPU04998, som overvejende anvendes i Region Hovedstaden og Region Sjælland, og NPU18016, som overvejende anvendes i Region Syddanmark og Region Nordjylland."
  Page: 34
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 31-35

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
[^src3]: AFDK_2025.pdf, pages 31-35
[^src4]: AFDK_2025.pdf, pages 91-95
[^src5]: AFDK_2024.pdf, pages 41-45
