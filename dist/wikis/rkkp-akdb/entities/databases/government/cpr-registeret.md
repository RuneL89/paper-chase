---
title: CPR-registeret
type: entity
wiki: rkkp-akdb
updated: '2026-08-05T19:13:52.102Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: 81-85
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: 86-90
tags:
  - database
---
The CPR-registeret is a central database in the Danish healthcare system that plays a critical role in the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] (AKDB). It is one of the three primary data sources used to construct the patient population and clinical indicators for the AKDB, ensuring the unambiguous identification of patients [^src1]. 

As part of the national quality development program for acute surgery, the AKDB integrates data from multiple national registers to evaluate treatment quality for acute abdominal surgical patients. Specifically, data for the construction of the database's population and indicators is systematically retrieved from the CPR-registeret, the [[landspatientregisteret|Landspatientregisteret]] (LPR), and the [[den-nationale-labdatabank-dnl|Den Nationale Labdatabank (DNL)]] [^src2]. While the LPR serves as the primary registration platform, the CPR-registeret provides the essential demographic and identity framework that supports data privacy, uncertainty measurement, and standardized, ethically responsible quality assessment across Danish hospitals [^src2].

## Mentions
- Page 81: "CPR-registeret" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 81-85) [^src1]
- Page 86: "CPR-registeret" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 86-90) [^src2]

## Relationships
- Subject: akut-kirurgi-databasen
  Predicate: uses-data-from
  Object: CPR-registeret
  Evidence: "Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL)"
  Page: 81
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 81-85 [^src1]

- Subject: akut-kirurgi-databasen
  Predicate: uses-data-from
  Object: CPR-registeret
  Evidence: "Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL)"
  Page: 86
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 86-90 [^src2]

## Claims
- Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL) [^src1] (cpr-registeret, landspatientregisteret, den-nationale-labdatabank-dnl)
  Type: data-source
  Page: 81
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 81-85

- Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL) [^src2] (akut-kirurgi-databasen, cpr-registeret, landspatientregisteret, den-nationale-labdatabank-dnl)
  Type: data-source
  Page: 86
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 86-90

## Timeline
(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 81-85
[^src2]: AKDB_2024.pdf, pages 86-90
