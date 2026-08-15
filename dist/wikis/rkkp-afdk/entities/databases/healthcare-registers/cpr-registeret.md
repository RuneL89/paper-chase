---
title: CPR-registeret
type: entity
wiki: rkkp-afdk
updated: '2026-08-14T20:30:43.387Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 106-110
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 86-90
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 71-75
tags:
  - database
---
**CPR-registeret** (the Civil Registration System) is the national population register in Denmark. Within the context of the Danish Atrial Fibrillation Database (AFDK) and the annual reports published by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP), it serves as a critical data infrastructure for verifying the vital status (dead/alive) of patients [^src1]. This verification is essential for ensuring correct inclusion in the numerators of clinical quality indicators, such as [[indikator-10|Indikator 10]], which measures mortality among prevalent [[atrieflimren|atrial fibrillation]] patients [^src1]. Additionally, the register provides foundational mortality data for [[indikator-9|Indikator 9]] [^src3].

Methodologically, the reliance on CPR-registeret dictates the scope of the AFDK analyses: the calculations and reports only include patients who possess a Danish CPR number and reside in Denmark [^src3]. Data from the register is linked with the Danish National Patient Register (Landspatientregisteret) to generate detailed national, regional, and municipal statistics on atrial fibrillation outcomes [^src1]. The consistent use of CPR-registeret across multiple reporting years—specifically documented in the 2023, 2024, and 2025 AFDK reports—underscores its role as the definitive source for survival and mortality tracking in Danish cardiovascular quality assurance [^src1] [^src2] [^src3].

## Mentions
- Page 109: "Oplysningerne vedrørende vitalstatus (død/levende) er indhentet via kobling med CPR-registeret." [^src1]
- Page 86: "CPR-registeret" [^src2]
- Page 74: "Oplysningerne vedrørende vitalstatus (død/levende) er indhentet via kobling med CPR-registeret." [^src3]

## Relationships
- Subject: cpr-registeret | Predicate: provides-vital-status-for | Object: atrieflimren
  Evidence: "Oplysningerne vedrørende vitalstatus (død/levende) er indhentet via kobling med CPR-registeret" [^src2]
- Subject: cpr-registeret | Predicate: provides-data-for | Object: indikator-9
  Evidence: "Oplysningerne vedrørende vitalstatus (død/levende) er indhentet via kobling med CPR-registeret." [^src3]
- Subject: indikator-10 | Predicate: uses-vital-status-from | Object: cpr-registeret
  Evidence: "Oplysningerne vedrørende vitalstatus (død/levende) er indhentet via kobling med CPR-registeret." [^src1]

## Claims
- Opgørelsen omfatter kun patienter med dansk cpr-nr. og dansk bopæl [^src1]
  Type: methodological-definition

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 106-110
[^src2]: AFDK_2024.pdf, pages 86-90
[^src3]: AFDK_2025.pdf, pages 71-75
