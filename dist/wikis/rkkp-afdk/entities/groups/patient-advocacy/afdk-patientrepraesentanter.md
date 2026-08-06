---
title: Patientrepræsentanterne i AFDK
type: entity
aliases:
  - Patientrepræsentanterne i AFDK
wiki: rkkp-afdk
updated: '2026-08-05T20:14:42.839Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 76-80
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 1-5
tags:
  - group
---

The **Patientrepræsentanterne i AFDK** (Patient Representatives in AFDK) are a dedicated group within the Danish Atrial Fibrillation database (AFDK) that provides direct user input regarding patient care and education. They play a critical role in advocating for [[struktureret-patientuddannelse]], emphasizing its importance for patient self-determination, a sense of security, and the reduction of unnecessary hospital admissions [^src1]. 

Within the broader context of the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP) quality development program, the patient representatives have been actively involved in addressing systemic shortcomings in care. Specifically, their work intersects with [[indikator-8|Indikator 8]], which measures the proportion of newly diagnosed atrial fibrillation patients receiving a structured education program. The national standard for this indicator is 50%, but annual reports from 2022–2023 and 2024 document a systemic failure to meet this target, with indicator values stagnating since 2018–2019 [^src1], [^src2]. 

To address these challenges, the Patientrepræsentanterne i AFDK collaborate closely with the [[afdk-styregruppe|Styregruppen for AFDK]] (AFDK Steering Group). Together, they have taken initiatives to ensure that structured patient education—and thereby better patient involvement—becomes a standard offering across all Danish regions [^src2]. Furthermore, the steering group and the patient representatives are working jointly on initiatives for a simple operationalization of the education component to improve compliance and overall patient outcomes [^src1].

## Mentions

- Page 79: "Fra patientrepræsentanterne: Patientrepræsentanterne i styregruppen understreger vigtigheden af en struktureret patientundervisning..." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 76-80) [^src1]
- Page 4: "Patientrepræsentanterne i styregruppen for AFDK fremhævede den store værdi af struktureret patientuddannelse og
har sammen med styregruppen for AFDK taget initiativer, der kan sikre, at struktureret patientuddannelse og dermed
bedre patientinvolvering bliver et tilbud i alle regioner." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 1-5) [^src2]

## Relationships

Outgoing (this entity is the SUBJECT of these relationships):
- Subject: afdk-patientrepraesentanter
  Predicate: advocates-for
  Object: struktureret-patientuddannelse
  Evidence: "Patientrepræsentanterne i styregruppen for AFDK fremhævede den store værdi af struktureret patientuddannelse"
  Page: 4
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 1-5 [^src2]

Incoming (this entity is the OBJECT of these relationships):
- Subject: indikator-8
  Predicate: measures
  Object: (this entity)
  Evidence: "Indikator 8 opgør, hvor stor en andel af patienter med nydiagnosticeret atrieflimren, som modtager et struktureret undervisningsprogram..."
  Page: 79
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 76-80 [^src1]
- Subject: afdk-styregruppe
  Predicate: collaborates-with
  Object: (this entity)
  Evidence: "Styregruppen for AFDK vil i samarbejde med patientrepræsentanterne i AFDK tage initiativer til en simpel operationalisering af undervisningsdelen"
  Page: 79
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 76-80 [^src1]

## Claims

(none)

## Timeline

(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 76-80
[^src2]: AFDK_2024.pdf, pages 1-5
