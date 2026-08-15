---
title: NPU04199
type: entity
aliases:
  - NPU04199
wiki: rkkp-afdk
updated: '2026-08-14T21:18:33.149Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 101-105
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 91-95
tags:
  - code
---
NPU04199 is a specific laboratory test code used to identify measurements of [[thyreoideastimulerende-hormon-tsh|thyreoideastimulerende hormon (TSH)]] in Danish health registries [^src1] [^src2]. Within the national quality assurance framework for atrial fibrillation, managed by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP), this code is critical for evaluating clinical performance. Specifically, it is one of the designated codes that counts as a valid TSH measurement for calculating clinical quality indicator 3, which tracks whether patients receive necessary diagnostic blood tests during their treatment pathway [^src1].

The code appears in the technical calculation rules for the "Atrial Fibrillation in Denmark" (AFDK) reports. In the 2024 documentation, NPU04199 is listed alongside other laboratory and procedure codes used to define the numerators and denominators for quality indicators [^src1]. The 2025 update of the AFDK guidelines continues to include NPU04199 in its expanded list of approved codes for register analyses, demonstrating its sustained use in monitoring the quality of atrial fibrillation treatment and diagnostics across the Danish healthcare system [^src2].

## Mentions
- **Page 105**: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647" [^src1]
- **Page 92**: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647, AS000646, ASS00650, EPC00002, RSD03382" [^src2]

## Relationships
**Outgoing (this entity is the SUBJECT of these relationships):**
- **Subject**: np04199-p-thyrotropin
  **Predicate**: is-laboratory-test-code-for
  **Object**: thyreoideastimulerende-hormon-tsh
  **Evidence**: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647, AS000646, ASS00650, EPC00002, RSD03382"
  **Page**: 92
  **Source**: [^src2]

**Incoming (this entity is the OBJECT of these relationships):**
- **Subject**: thyreoideastimulerende-hormon-tsh
  **Predicate**: coded-as
  **Object**: NPU04199
  **Evidence**: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647"
  **Page**: 105
  **Source**: [^src1]

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AFDK_2024.pdf, pages 101-105
[^src2]: AFDK_2025.pdf, pages 91-95
