---
title: B01AA
type: entity
wiki: rkkp-afdk
updated: '2026-08-14T20:37:31.145Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 116-120
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '101-105, 106-110'
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: '86-90, 91-95'
tags:
  - drug-class-code
---
B01AA is the Anatomical Therapeutic Chemical (ATC) classification code for vitamin K antagonists, a primary category of oral anticoagulant medications [^src1]. In the context of the Danish healthcare system's quality assurance programs, specifically the Danish Database for Atrial Fibrillation (AFDK) managed by the Regions' Clinical Quality Development Programme (RKKP), B01AA serves as a critical data point for monitoring and evaluating patient care [^src3]. 

Vitamin K antagonists represent one of the two main groups of anticoagulants used in the clinical quality indicators for the [[antikoagulationsbehandling]] of patients diagnosed with [[atrieflimren]] [^src1]. When measuring the quality of care, such as the waiting time for anticoagulation therapy or the overall prevalence of oral anticoagulant use, registry analyses rely on precise ATC codes to identify treated patients [^src4]. The coding specifications for oral anticoagulation therapy explicitly include B01AA alongside direct oral anticoagulants (DOACs) such as [[b01ae07|B01AE07]] (dabigatran), [[b01af01|B01AF01]] (rivaroxaban), [[b01af02|B01AF02]] (apixaban), and [[b01af03|B01AF03]] (edoxaban) [^src1]. 

By standardizing these medication codes, the RKKP ensures that data collection regarding cardiovascular disease management remains consistent across all Danish regions [^src3]. The inclusion of B01AA in these technical guidelines underscores its ongoing relevance in national healthcare quality metrics, bridging the gap between clinical pharmacology and systemic performance monitoring [^src5].

## Mentions
- Page 117: "B01AA (vitamin K antagonister)" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120)
- Page 104: "B01AA (vitamin K antagonister)" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105)
- Page 106: "Koder for oral AK-behandling:
B01AA (vitamin K antagonister)" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 106-110)
- Page 90: "Koder for oral AK-behandling: B01AA (vitamin K antagonister)" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 86-90)
- Page 92: "B01AA (vitamin K antagonister)" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95)

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
- Subject: b01aa
  Predicate: er-kode-for
  Object: antikoagulationsbehandling
  Evidence: "Koder for oral AK-behandling: B01AA (vitamin K antagonister)"
  Page: 90
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 86-90
- Subject: b01aa
  Predicate: is-drug-class-code-for
  Object: antikoagulationsbehandling
  Evidence: "Koder for oral AK-behandling: B01AA (vitamin K antagonister)"
  Page: 92
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95

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
- Koder for oral antikoagulationsbehandling inkluderer B01AA (vitamin K antagonister), B01AE07 (dabigatran), B01AF01 (rivaroxaban), B01AF02 (apixaban) og B01AF03 (edoxaban) [^src5] (b01aa, b01ae07, b01af01, b01af02, b01af03)
  Type: coding-system-specification
  Page: 90
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 86-90

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 116-120
[^src2]: AFDK_2024.pdf, pages 101-105
[^src3]: AFDK_2024.pdf, pages 106-110
[^src4]: AFDK_2025.pdf, pages 86-90
[^src5]: AFDK_2025.pdf, pages 91-95
