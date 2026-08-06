---
title: BIKE1 - Undervisning i inflammatorisk tarmsygdom
type: entity
aliases:
  - BIKE1 - Undervisning i inflammatorisk tarmsygdom
wiki: rkkp-danibd
updated: '2026-08-05T06:40:50.545Z'
sources:
  - file: wikis/rkkp-danibd/raw/DANIBD_2023.pdf
    pages: 21-25
  - file: wikis/rkkp-danibd/raw/DANIBD_2024.pdf
    pages: '16-20, 36-40, 46-47'
tags:
  - procedure-code
---
**BIKE1 - Undervisning i inflammatorisk tarmsygdom** is a clinical procedure code (SKS-code) used within the [[dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme|Dansk Kvalitetsdatabase for Inflammatoriske Tarmsygdomme]] (DANIBD) to register the education of patients with inflammatory bowel disease (IBD) [^src2]. It serves as the official registration mechanism for [[indikator-2|Indikator 2]], a quality indicator that tracks the proportion of newly diagnosed patients who receive education within one year of their diagnosis [^src3]. The implementation of this code marks a strategic focus on patient education as a central dimension of healthcare quality in Denmark's national IBD treatment framework [^src2].

The code was officially introduced into the national system on October 1, 2022, coinciding with the launch of Indikator 2 and making the code available in the Danish National Patient Registry (LPR) [^src2]. Following its introduction, departments across Denmark began reporting the code; for instance, data from the period following its launch showed that 308 departments had registered the BIKE1 code for IBD patient education [^src1]. The registration is mandated to occur in the patient's medical journal immediately after the education session is completed [^src4].

Regional implementation and feedback have been actively monitored through DANIBD's annual reports. For example, [[region-nordjylland|Region Nordjylland]] and other regions have provided formal consultation responses regarding the operational use and challenges of specific quality indicators, highlighting the code's role not just as a data point, but as an active management tool for local quality improvement, auditing, and process optimization [^src4]. The broader narrative of DANIBD's quality measurement relies on such standardized coding to enable cross-regional benchmarking, evaluate treatment access, and identify implementation barriers for evidence-based guidelines [^src1].

## Mentions
- Page 23: "BIKE1 - Undervisning i
inflammatorisk tarmsygdom" (source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 21-25)
- Page 16: "Undervisningen registreres i journalen efter gennemført undervisning (SKS-kode: BIKE1)." (source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 16-20)
- Page 36: "undervisning" (source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 36-40)
- Page 47: "Undervisningen registreres i
journalen efter gennemført undervisning (SKS-kode: BIKE1)" (source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 46-47)

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: bike1-undervisning-i-inflammatorisk-tarmsygdom
  Predicate: is-indicator-for
  Object: dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme
  Evidence: "Appendikstabel 2. Afdelinger, der har indrapporteret undervisningskoder i perioden (indikator 2)
BIKE1 - Undervisning i
inflammatorisk tarmsygdom"
  Page: 23
  Source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 21-25
- Subject: bike1-undervisning-i-inflammatorisk-tarmsygdom
  Predicate: is-registration-code-for
  Object: indikator-2
  Evidence: "Undervisningen registreres i journalen efter gennemført undervisning (SKS-kode: BIKE1)."
  Page: 16
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 16-20

Incoming (this entity is the OBJECT of these relationships):
- Subject: indikator-2
  Predicate: measures
  Object: (this entity)
  Evidence: "Appendikstabel 2. Andelen af nydiagnosticerede, der har modtaget undervisning inden for ét år efter diagnosen er stillet (indikator 2)"
  Page: 36
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 36-40
- Subject: region-nordjylland
  Predicate: uses-sks-code
  Object: (this entity)
  Evidence: "Undervisningen registreres i journalen efter gennemført undervisning (SKS-kode: BIKE1)."
  Page: 47
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 46-47

## Claims
- Der blev registreret 308 afdelinger i Danmark, der havde indrapporteret BIKE1-koden for undervisning i inflammatorisk tarmsygdom i perioden [^src1] (bike1-undervisning-i-inflammatorisk-tarmsygdom)
  Type: procedural
  Page: 23
  Source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 21-25
- Indikatoren blev ført i 1. oktober 2022, hvor også koden til registrering blev tilgængelig i LPR [^src1] (indikator-2, bike1-undervisning-i-inflammatorisk-tarmsygdom)
  Type: timeline
  Page: 16
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 16-20

## Timeline
- 2022-10-01: Indikator 2 blev ført i systemet, og BIKE1-koden blev tilgængelig i LPR (indikator-2, bike1-undervisning-i-inflammatorisk-tarmsygdom)

## Sources

[^src1]: DANIBD_2023.pdf, pages 21-25
[^src2]: DANIBD_2024.pdf, pages 16-20
[^src3]: DANIBD_2024.pdf, pages 36-40
[^src4]: DANIBD_2024.pdf, pages 46-47
