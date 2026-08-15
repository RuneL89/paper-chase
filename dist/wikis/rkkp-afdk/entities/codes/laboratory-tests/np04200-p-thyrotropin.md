---
title: NPU04200
type: entity
aliases:
  - NPU04200
wiki: rkkp-afdk
updated: '2026-08-14T21:19:45.496Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 101-105
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 91-95
tags:
  - code
---

NPU04200 is a specific laboratory test code used within the Danish healthcare system to identify measurements of [[thyreoideastimulerende-hormon-tsh|thyreoideastimulerende hormon (TSH)]] [^src1] [^src2]. It serves as a critical data point in the national clinical quality database for atrial fibrillation ("Atrieflimren i Danmark"), a program overseen by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP) to monitor and improve diagnostic and treatment standards across the country [^src1] [^src2]. 

Within the technical guidelines for registry analysis, NPU04200 is listed among a specific set of valid laboratory codes that count as a performed TSH measurement for clinical quality indicator 3 [^src1] [^src2]. This indicator tracks whether patients diagnosed with atrial fibrillation receive necessary thyroid function testing, which is an essential step in comprehensive cardiovascular risk assessment and management [^src1] [^src2]. The code is utilized alongside other identifiers (such as NPU27547 and NPU04199) to ensure that health data infrastructure accurately captures these diagnostic procedures, accommodating variations across different hospital systems and laboratory information systems in the Danish regions [^src1] [^src2].

## Mentions
- Page 105: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647" [^src1]
- Page 92: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647, AS000646, ASS00650, EPC00002, RSD03382" [^src2]

## Relationships
- **Subject:** np04200-p-thyrotropin
  **Predicate:** is-laboratory-test-code-for
  **Object:** thyreoideastimulerende-hormon-tsh
  **Evidence:** "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647, AS000646, ASS00650, EPC00002, RSD03382"
  **Page:** 92
  **Source:** wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95 [^src2]

- **Subject:** thyreoideastimulerende-hormon-tsh
  **Predicate:** coded-as
  **Object:** (this entity)
  **Evidence:** "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647"
  **Page:** 105
  **Source:** wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105 [^src1]

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AFDK_2024.pdf, pages 101-105
[^src2]: AFDK_2025.pdf, pages 91-95
