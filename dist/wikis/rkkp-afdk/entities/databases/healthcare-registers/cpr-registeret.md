---
title: CPR-registeret
type: entity
wiki: rkkp-afdk
updated: '2026-08-05T20:38:07.113Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 106-110
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 86-90
tags:
  - database
---
The **CPR-registeret** (Civil Registration System) is the national population register in Denmark. In the context of clinical quality development and epidemiological research, it serves as a foundational data source for verifying the vital status—specifically whether a patient is dead or alive—of individuals included in national health analyses [^src1]. 

Within the national quality reports for [[atrieflimren]] published by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP), the CPR-registeret is linked with other national databases, such as the Landspatientregisteret (National Patient Register), to track patient outcomes over time [^src2]. By cross-referencing clinical records with the CPR-registeret, researchers can accurately determine mortality and ensure that vital status data is reliably captured for the atrial fibrillation patient population [^src2].

This data linkage is critically important for [[indikator-10|Indikator 10]], a key quality indicator that measures mortality among existing (prevalent) atrial fibrillation patients [^src1]. By leveraging the CPR-registeret, analysts can verify patient deaths, ensuring correct inclusion in the numerator for Indikator 10 and allowing for precise, methodologically transparent mortality tracking at the national, regional, and municipal levels [^src1].

## Mentions
- Page 109: "Oplysningerne vedrørende vitalstatus (død/levende) er indhentet via kobling med CPR-registeret." [^src1]
- Page 86: "CPR-registeret" [^src2]

## Relationships
**Outgoing**
- **Subject:** cpr-registeret
  **Predicate:** provides-vital-status-for
  **Object:** atrieflimren
  **Evidence:** "Oplysningerne vedrørende vitalstatus (død/levende) er indhentet via kobling med CPR-registeret"
  **Page:** 86 [^src2]

**Incoming**
- **Subject:** indikator-10
  **Predicate:** uses-vital-status-from
  **Object:** cpr-registeret
  **Evidence:** "Oplysningerne vedrørende vitalstatus (død/levende) er indhentet via kobling med CPR-registeret."
  **Page:** 109 [^src1]

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 106-110
[^src2]: AFDK_2024.pdf, pages 86-90
