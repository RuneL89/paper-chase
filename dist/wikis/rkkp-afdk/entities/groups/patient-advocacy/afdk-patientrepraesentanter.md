---
title: Patientrepræsentanterne i AFDK
type: entity
aliases:
  - Patientrepræsentanterne i AFDK
wiki: rkkp-afdk
updated: '2026-08-14T20:19:05.038Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 76-80
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 1-5
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: '1-5, 56-60'
tags:
  - group
---
**Patientrepræsentanterne i AFDK** (The Patient Representatives in AFDK) is an advocacy group that provides direct user input within the Danish Atrial Fibrillation Database (AFDK). They emphasize the critical importance of [[struktureret-patientuddannelse|structured patient education]], highlighting its role in promoting patient self-determination, providing a sense of security, and reducing unnecessary hospital admissions [^src1]. 

As formal members of the [[afdk-styregruppe|Styregruppen for AFDK]] (AFDK Steering Committee) [^src3], the patient representatives collaborate closely with the committee to operationalize and improve educational initiatives [^src1]. Together, they have launched initiatives aimed at ensuring that structured patient education—and thereby better patient involvement—becomes a standard offering across all Danish regions [^src2]. The representatives stress that patients have a significant need to be offered a structured educational program shortly after receiving their diagnosis [^src4].

Their advocacy and input are directly tied to the database's quality metrics. They advocate for the objectives measured by [[indikator-4a|Indikator 4a]], which focuses on patient education and clinical outcomes for newly diagnosed individuals [^src4]. Furthermore, their push for early and structured educational programs aligns with the goals of [[indikator-8|Indikator 8]], which tracks the proportion of newly diagnosed atrial fibrillation patients who actually receive such structured education [^src1]. Through their ongoing participation, the patient representatives help bridge the gap between clinical data and the lived patient experience, shaping both local improvements and national healthcare strategies.

## Mentions
- Page 79: "Fra patientrepræsentanterne: Patientrepræsentanterne i styregruppen understreger vigtigheden af en struktureret patientundervisning..." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 76-80)
- Page 4: "Patientrepræsentanterne i styregruppen for AFDK fremhævede den store værdi af struktureret patientuddannelse og
har sammen med styregruppen for AFDK taget initiativer, der kan sikre, at struktureret patientuddannelse og dermed
bedre patientinvolvering bliver et tilbud i alle regioner." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 1-5)
- Page 4: "Patientrepræsentanterne i styregruppen for AFDK fremhævede den store værdi af struktureret patientuddannelse og har sammen med styregruppen for AFDK taget initiativer, der kan sikre, at struktureret patientuddannelse og dermed bedre patientinvolvering bliver et tilbud i alle regioner." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 1-5)
- Page 56: "Fra patientrepræsentanterne: Patienterne ser et stort behov for et tilbud om et struktureret undervisningsforløb kort tid efter, diagnosen er stillet." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 56-60)

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: afdk-patientrepraesentanter
  Predicate: advocates-for
  Object: struktureret-patientuddannelse
  Evidence: "Patientrepræsentanterne i styregruppen for AFDK fremhævede den store værdi af struktureret patientuddannelse"
  Page: 4
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 1-5
- Subject: afdk-patientrepraesentanter
  Predicate: advocates-for
  Object: indikator-4a
  Evidence: "Fra patientrepræsentanterne: Patienterne ser et stort behov for et tilbud om et struktureret undervisningsforløb kort tid efter, diagnosen er stillet."
  Page: 56
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 56-60

Incoming (this entity is the OBJECT of these relationships):
- Subject: indikator-8
  Predicate: measures
  Object: (this entity)
  Evidence: "Indikator 8 opgør, hvor stor en andel af patienter med nydiagnosticeret atrieflimren, som modtager et struktureret undervisningsprogram..."
  Page: 79
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 76-80
- Subject: afdk-styregruppe
  Predicate: collaborates-with
  Object: (this entity)
  Evidence: "Styregruppen for AFDK vil i samarbejde med patientrepræsentanterne i AFDK tage initiativer til en simpel operationalisering af undervisningsdelen"
  Page: 79
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 76-80
- Subject: afdk-styregruppe
  Predicate: includes-member
  Object: (this entity)
  Evidence: "Patientrepræsentanterne i styregruppen for AFDK"
  Page: 4
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 1-5

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 76-80
[^src2]: AFDK_2024.pdf, pages 1-5
[^src3]: AFDK_2025.pdf, pages 1-5
[^src4]: AFDK_2025.pdf, pages 56-60
