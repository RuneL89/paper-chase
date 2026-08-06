---
title: Indikator 2
type: entity
aliases:
  - Indikator 2
wiki: rkkp-danibd
updated: '2026-08-05T06:48:19.862Z'
sources:
  - file: wikis/rkkp-danibd/raw/DANIBD_2024.pdf
    pages: '16-20, 36-40, 46-47'
tags:
  - topic
---
**Indikator 2** is a quality indicator within the [[dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme|Dansk Kvalitetsdatabase for Inflammatoriske Tarmsygdomme]] (DANIBD) system [^src1]. It measures the proportion of newly diagnosed inflammatory bowel disease (IBD) patients who have received structured patient education within one year of their diagnosis [^src1]. This indicator serves as a foundational metric for assessing the implementation and quality of patient education across Danish IBD care [^src1]. 

The indicator was officially introduced into the system on October 1, 2022, coinciding with the availability of the specific registration code, [[bike1-undervisning-i-inflammatorisk-tarmsygdom|BIKE1 - Undervisning i inflammatorisk tarmsygdom]], in the Danish National Patient Register (LPR) [^src1]. The first formal reporting period for Indikator 2 spanned from October 1, 2022, to September 30, 2023 [^src2]. During this initial period, the national average showed that only 13% (95% CI: 11–14) of newly diagnosed patients received education within a year of their diagnosis [^src1]. Among the departments that did register education, the proportion varied significantly, ranging from 1% to 39% [^src1]. Furthermore, 16 departments across four regions had not yet begun registering education for newly diagnosed patients, highlighting significant implementation barriers [^src1]. Notably, [[region-syddanmark|Region Syddanmark]] was specifically mentioned in the context of departments that had not yet started registration [^src1].

Looking toward future quality improvement, the [[styregruppen-for-danibd|Styregruppen for DANIBD]] has recommended setting a development target of 80% for the next annual report [^src1]. Regional responses to the indicator's initial results have varied. For instance, [[region-nordjylland|Region Nordjylland]] has stated it will place greater focus on correct registration practices regarding the proportion of newly diagnosed patients receiving education within a year of diagnosis [^src3]. The ongoing monitoring of Indikator 2 underscores DANIBD's role not just as a national database, but as an active management tool for local quality work, audits, and process improvements in IBD treatment [^src3].

## Mentions
- Page 16: "Indikator 2. Undervisning, nydiagnosticerede" (source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 16-20)
- Page 36: "Andelen af nydiagnosticerede, der har modtaget undervisning inden for ét år efter diagnosen er stillet (indikator 2)" (source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 36-40)
- Page 47: "Indikator 2: Undervisning, nydiagnosticerede
RHN vil have større fokus på fremadrettet på korrekt registreringspraksis ift. andelen af ny diagnosticerede,
der har modtaget undervisning indenfor et år efter diagnosen er stillet. Undervisningen registreres i
journalen efter gennemført undervisning (SKS-kode: BIKE1)" (source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 46-47)

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: indikator-2
  Predicate: is-monitored-by
  Object: dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme
  Evidence: "Indikatoren monitorerer derfor andelen af nydiagnosticerede, der har modtaget undervisning indenfor et år efter diagnosen er stillet."
  Page: 16
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 16-20
- Subject: indikator-2
  Predicate: measures
  Object: bike1-undervisning-i-inflammatorisk-tarmsygdom
  Evidence: "Appendikstabel 2. Andelen af nydiagnosticerede, der har modtaget undervisning inden for ét år efter diagnosen er stillet (indikator 2)"
  Page: 36
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 36-40

Incoming (this entity is the OBJECT of these relationships):
- Subject: bike1-undervisning-i-inflammatorisk-tarmsygdom
  Predicate: is-registration-code-for
  Object: (this entity)
  Evidence: "Undervisningen registreres i journalen efter gennemført undervisning (SKS-kode: BIKE1)."
  Page: 16
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 16-20
- Subject: styregruppen-for-danibd
  Predicate: recommends-development-target-for
  Object: (this entity)
  Evidence: "Styregruppen anbefaler, at udviklingsmålet fastsættes til 80 % i næste årsrapport."
  Page: 16
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 16-20

## Claims
- Den første opgørelse af Indikator 2 viser, at 13 % af de nydiagnosticerede har fået undervisning i året efter, de fik diagnosen [^src1] (indikator-2)
  Type: statistical
  Page: 16
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 16-20
- Blandt de afdelinger, der har registreret undervisning, ligger andelen mellem 1 % til 39 % [^src1] (indikator-2)
  Type: statistical
  Page: 16
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 16-20
- 16 afdelinger fordelt på de fire øvrige regioner ikke er kommet i gang med registreringen af undervisningen af nydiagnosticerede [^src1] (indikator-2, region-syddanmark)
  Type: statistical
  Page: 16
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 16-20
- Indikatoren blev ført i 1. oktober 2022, hvor også koden til registrering blev tilgængelig i LPR [^src1] (indikator-2, bike1-undervisning-i-inflammatorisk-tarmsygdom)
  Type: timeline
  Page: 16
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 16-20
- Appendikstabel 2 rapporterer andelen af nydiagnosticerede, der har modtaget undervisning inden for ét år efter diagnosen er stillet (indikator 2), med landsgennemsnit på 13 % (95 % CI: 11–14) for perioden 01.10.2022–30.09.2023 [^src1] (indikator-2, dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme)
  Type: quality-indicator
  Page: 36
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 36-40
- Region Nordjylland vil have større fokus på korrekt registreringspraksis for andelen af nydiagnosticerede, der har modtaget undervisning inden for et år efter diagnosen [^src1] (region-nordjylland, indikator-2)
  Type: administrative
  Page: 47
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 46-47

## Timeline
- 2022-10-01: Indikator 2 blev ført i systemet, og BIKE1-koden blev tilgængelig i LPR (indikator-2, bike1-undervisning-i-inflammatorisk-tarmsygdom)
- 01.10.2022: Start af opgørelsesperioden for indikator 2 i DANIBD (indikator-2, dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme)
- 30.09.2023: Slut på opgørelsesperioden for indikator 2 i DANIBD (indikator-2, dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme)

## Sources

[^src1]: DANIBD_2024.pdf, pages 16-20
[^src2]: DANIBD_2024.pdf, pages 36-40
[^src3]: DANIBD_2024.pdf, pages 46-47
