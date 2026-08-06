---
title: SOR koder
type: entity
aliases:
  - SOR koder
  - SOR
sparse: true
wiki: rkkp-akdb
updated: '2026-08-05T18:57:10.587Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '16-20, 31-35'
tags:
  - code
---
**SOR koder** (SOR codes) are proposed as a more precise alternative method for identifying patient stays in intensive care, intermediate care, or recovery units. Because these codes can effectively distinguish specialized care beds from regular ward beds, they are being recommended to improve the accuracy of clinical quality measurements within the Danish healthcare system's acute surgery framework.

In the final version of the Acute Surgery Database (AKDB) report published in February 2024, which covers the measurement period from September 2022 to August 2023, the need for methodological adjustments and future standardization is heavily emphasized. To address coding uncertainties, the report recommends switching to SOR codes to determine whether a patient stayed in an intensive, intermediate, or recovery bed prior to their operation, a change that directly impacts the measurement of [[indikator-4|Indikator 4]] [^src1]. 

Additionally, SOR codes are proposed as a forward-looking replacement coding method for [[indikator-6|Indikator 6]] [^src2]. The AKDB suggests using these codes to accurately verify if a high-risk patient spent their first 24 postoperative hours in a department with a treatment level higher than a standard ward [^src2]. This strategic shift toward SOR codes is part of a broader effort to standardize reporting, improve data reliability, and adjust quality targets across the national clinical quality development program.

## Mentions
- Page 16: "Vi anbefaler at man skifter til SOR koder for at afgøre, om patienten har opholdt sig på en intensiv/intermediær eller opvågningsplads inden operation." [^src1]
- Page 31: "SOR koder" [^src2]

## Relationships
- **Subject:** indikator-4
  **Predicate:** is-recommended-to-be-measured-via
  **Object:** SOR koder
  **Evidence:** "Vi anbefaler at man skifter til SOR koder for at afgøre, om patienten har opholdt sig på en intensiv/intermediær eller opvågningsplads inden operation" [^src1]

- **Subject:** indikator-6
  **Predicate:** proposed-replacement-code
  **Object:** SOR koder
  **Evidence:** "AKDB foreslår, at der fremadrettet anvendes SOR koder til at afgøre, om en højrisikopatient har haft ophold de første 24 timer postoperativt på en afdeling med et behandlingsniveau niveau højere end en almindelig sengeafdeling" [^src2]

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 16-20
[^src2]: AKDB_2023.pdf, pages 31-35
