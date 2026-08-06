---
title: B01AA
type: entity
wiki: rkkp-afdk
updated: '2026-08-05T20:43:36.113Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 116-120
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '101-105, 106-110'
tags:
  - drug-class-code
---
B01AA is the Anatomical Therapeutic Chemical (ATC) classification code for Vitamin K antagonists. Within the Danish healthcare system's clinical quality databases, this code is significant because it identifies one of the two main groups of medications used for [[antikoagulationsbehandling]] (anticoagulation treatment) in patients diagnosed with [[atrieflimren]] (atrial fibrillation) [^src1]. 

The tracking of B01AA is a core component of the national quality indicators managed by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP). These indicators measure the quality of diagnosis, treatment, and follow-up care. When calculating metrics such as the waiting time for anticoagulation treatment, B01AA is categorized under the specific codes for oral anticoagulation therapy [^src3]. It is grouped alongside other direct oral anticoagulant codes, namely [[b01ae07|B01AE07]] (dabigatran), [[b01af01|B01AF01]] (rivaroxaban), [[b01af02|B01AF02]] (apixaban), and [[b01af03|B01AF03]] (edoxaban) [^src1]. By standardizing these medication codes, the database ensures consistent data collection and enables reliable comparisons of cardiovascular treatment practices across Danish regions [^src2].

## Mentions
- Page 117: "B01AA (vitamin K antagonister)" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120)
- Page 104: "B01AA (vitamin K antagonister)" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105)
- Page 106: "Koder for oral AK-behandling:
B01AA (vitamin K antagonister)" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 106-110)

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: b01aa
  Predicate: is-drug-class-for
  Object: atrieflimren
  Evidence: "B01AA (vitamin K antagonister)"
  Page: 117
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120
- Subject: b01aa
  Predicate: is-drug-class-for
  Object: antikoagulationsbehandling
  Evidence: "Koder for oral AK-behandling:
B01AA (vitamin K antagonister)"
  Page: 106
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 106-110

Incoming (this entity is the OBJECT of these relationships):
- Subject: antikoagulationsbehandling
  Predicate: includes-drug-class
  Object: (this entity)
  Evidence: "B01AA (vitamin K antagonister)"
  Page: 104
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105

## Claims
- Antikoagulationsbehandling inkluderer B01AA (vitamin K antagonister) samt B01AE07 (dabigatran), B01AF01 (rivaroxaban), B01AF02 (apixaban) og B01AF03 (edoxaban) [^src1] (b01aa, b01ae07, b01af01, b01af02, b01af03)
  Type: pharmaceutical
  Page: 117
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 116-120
[^src2]: AFDK_2024.pdf, pages 101-105
[^src3]: AFDK_2024.pdf, pages 106-110
