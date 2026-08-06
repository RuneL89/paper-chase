---
title: SKS-koden NAAZ42
type: entity
aliases:
  - SKS-koden NAAZ42
wiki: rkkp-akdb
updated: '2026-08-05T19:00:51.477Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: 16-20
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '106-107, 16-20, 21-25'
tags:
  - code
---
**SKS-koden NAAZ42** is a specific medical procedure code in the Danish healthcare registration system, carrying the text "Anæstesiologisk præoperativ optimering" (Anesthesiological preoperative optimization). It was introduced to accurately register preoperative optimization procedures in the [[landspatientregisteret|Landspatientregisteret]] (LPR) and is a critical component for measuring clinical quality in the Acute Surgery Database (Akut Kirurgi Databasen).

The code was officially created and became available for reporting on October 1, 2022 [^src2]. Its primary significance lies in its use for tracking [[indikator-3|Indikator 3]] and [[indikator-4|Indikator 4]], which measure whether acute abdominal surgical patients receive preoperative optimization or are taken directly to surgery within specific timeframes (such as 240 minutes) [^src1]. Correct application of NAAZ42 is essential for the validity of these national quality indicators [^src1]. It is explicitly noted that the older or different code, SKS-kode NAAZ4 ("Anæstesiologisk tilsyn"), cannot be used as a substitute for this specific optimization tracking [^src3].

Despite its clear administrative purpose, the implementation of NAAZ42 has faced practical and clinical ambiguities. For instance, [[regionshospital-nordjylland|Regionshospital Nordjylland]] has raised questions regarding the code's application, specifically asking whether an [[anaestesiolog|anæstesiolog]] is permitted to use the procedure code if the pre-optimization takes place outside of designated departments like the [[ima|IMA]] or [[ita-afsnit|ITA-afsnit]] [^src4]. This highlights the broader challenges of translating complex, real-world acute surgical workflows into standardized database metrics.

## Mentions
- Page 16: "For at kunne trække data skal afdelingerne kode patienterne, der præoptimeres med SKS-koden NAAZ42, der har teksten ” Anæstesiologisk præoperativ optimering”." (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 16-20)
- Page 16: "SKS-koden NAAZ42 Præoperativ optimering er oprettet pr. 1/10-2022 og kan således indberettes fra dette tidspunkt." (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 16-20)
- Page 21: "For at kunne trække data skal afdelingerne kode patienterne, der præoptimeres med SKS-koden NAAZ42, der har teksten ” Anæstesiologisk præoperativ optimering”." (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 21-25)
- Page 106: "Må anæstesiologen så ikke anvende procedurekoden NAAZ42 eller må den kun anvendes, hvis patienten præoptimeres enten på IMA eller ITA-afsnit?" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 106-107)

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: sks-kode-naaz42
  Predicate: is-required-for
  Object: indikator-3
  Evidence: "For at kunne trække data skal afdelingerne kode patienterne, der præoptimeres med SKS-koden NAAZ42, der har teksten ” Anæstesiologisk præoperativ optimering”."
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 21-25
- Subject: sks-kode-naaz42
  Predicate: applies-to-location
  Object: ima
  Evidence: "Må anæstesiologen så ikke anvende procedurekoden NAAZ42 eller må den kun anvendes, hvis patienten præoptimeres enten på IMA eller ITA-afsnit?"
  Page: 106
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 106-107
- Subject: sks-kode-naaz42
  Predicate: applies-to-location
  Object: ita-afsnit
  Evidence: "Må anæstesiologen så ikke anvende procedurekoden NAAZ42 eller må den kun anvendes, hvis patienten præoptimeres enten på IMA eller ITA-afsnit?"
  Page: 106
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 106-107

Incoming (this entity is the OBJECT of these relationships):
- Subject: indikator-4
  Predicate: is-coded-by
  Object: (this entity)
  Evidence: "For at kunne trække data skal afdelingerne kode patienterne, der præoptimeres med SKS-koden NAAZ42"
  Page: 16
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 16-20
- Subject: indikator-3
  Predicate: uses-code
  Object: (this entity)
  Evidence: "SKS-koden NAAZ42 Præoperativ optimering er oprettet pr. 1/10-2022 og kan således indberettes fra dette tidspunkt."
  Page: 16
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 16-20
- Subject: landspatientregisteret
  Predicate: hosts-code-for
  Object: (this entity)
  Evidence: "idet der pr. 1/10-2022 blev oprettet en kode til angivelse af at der er udført præoperativ optimering via LPR."
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 21-25
- Subject: regionshospital-nordjylland
  Predicate: questions-code-application-for
  Object: (this entity)
  Evidence: "Må anæstesiologen så ikke anvende procedurekoden NAAZ42 eller må den kun anvendes, hvis patienten præoptimeres enten på IMA eller ITA-afsnit?"
  Page: 106
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 106-107

## Claims
- SKS-koden NAAZ42 Præoperativ optimering er oprettet pr. 1/10-2022 og kan således indberettes fra dette tidspunkt [^src1] (sks-kode-naaz42)
  Type: administrative
  Page: 16
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 16-20
- SKS-koden NAAZ4 'Anæstesiologisk tilsyn' ikke kan bruges til dette [^src1] (sks-kode-naaz42)
  Type: definitional
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 21-25
- Der er usikkerhed om, hvorvidt procedurekoden NAAZ42 må anvendes, hvis patienten præoptimeres af en anæstesiolog uden for IMA eller ITA-afsnit [^src1] (sks-kode-naaz42, anaestesiolog, ima, ita-afsnit)
  Type: coding-uncertainty
  Page: 106
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 106-107

## Timeline
- 2022-10-01: SKS-koden NAAZ42 for præoperativ optimering blev oprettet og kan indberettes fra dette tidspunkt (sks-kode-naaz42, indikator-4)
- 2022-10-01: SKS-koden NAAZ42 for præoperativ optimering blev oprettet og kan indberettes fra dette tidspunkt (sks-kode-naaz42)

## Sources

[^src1]: AKDB_2023.pdf, pages 16-20
[^src2]: AKDB_2024.pdf, pages 16-20
[^src3]: AKDB_2024.pdf, pages 21-25
[^src4]: AKDB_2024.pdf, pages 106-107
