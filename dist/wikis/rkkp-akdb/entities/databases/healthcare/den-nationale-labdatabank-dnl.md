---
title: Den Nationale Labdatabank (DNL)
type: entity
aliases:
  - Den Nationale Labdatabank (DNL)
wiki: rkkp-akdb
updated: '2026-08-05T19:13:48.320Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: 81-85
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: 86-90
tags:
  - database
---
**Den Nationale Labdatabank (DNL)** is a national database in Denmark that serves as a supplementary data source for the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] (AKDB), a key component of the national quality development program for acute surgery. The database is intended to help construct the patient population and calculate quality indicators alongside other major national registries, specifically the [[cpr-registeret|CPR-registeret]] and the [[landspatientregisteret|Landspatientregisteret]] (LPR) [^src1] [^src2]. 

Despite its designated role in the AKDB's methodological framework, DNL does not currently have data available for use in the national quality databases [^src2]. However, the technical guidelines for the AKDB explicitly state that once DNL's data becomes accessible, it will be integrated into the calculation of the database's clinical quality indicators [^src2]. This planned integration underscores the broader ambition of the Danish healthcare system to combine multiple national registries for comprehensive, cross-sectional clinical quality measurement of acute abdominal surgical patients [^src2].

## Mentions
- Page 81: "Den Nationale Labdatabank (DNL)" [^src1]
- Page 86: "Den Nationale Labdatabank (DNL)" [^src2]

## Relationships
Incoming (this entity is the OBJECT of these relationships):
- Subject: akut-kirurgi-databasen
  Predicate: uses-data-from
  Object: (this entity)
  Evidence: "Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL)"
  Page: 81
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 81-85 [^src1]
- Subject: akut-kirurgi-databasen
  Predicate: uses-data-from
  Object: (this entity)
  Evidence: "Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL)"
  Page: 86
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 86-90 [^src2]

## Claims
- Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL) [^src1] (cpr-registeret, landspatientregisteret, den-nationale-labdatabank-dnl)
  Type: data-source
  Page: 81
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 81-85 [^src1]
- Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL) [^src1] (akut-kirurgi-databasen, cpr-registeret, landspatientregisteret, den-nationale-labdatabank-dnl)
  Type: data-source
  Page: 86
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 86-90 [^src2]
- DNL har aktuelt ikke data til rådighed i de nationale kvalitetsdatabaser, men når data bliver tilgængelige, vil de indgå i indikatorberegningen i AKDB [^src1] (den-nationale-labdatabank-dnl, akut-kirurgi-databasen)
  Type: data-availability
  Page: 86
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 86-90 [^src2]

## Timeline
(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 81-85
[^src2]: AKDB_2024.pdf, pages 86-90
