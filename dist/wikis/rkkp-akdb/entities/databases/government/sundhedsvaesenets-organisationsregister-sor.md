---
title: Sundhedsvæsenets Organisationsregister (SOR)
type: entity
aliases:
  - Sundhedsvæsenets Organisationsregister (SOR)
sparse: true
wiki: rkkp-akdb
updated: '2026-08-05T19:15:04.632Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: 81-85
tags:
  - database
---
Sundhedsvæsenets Organisationsregister (SOR) is a comprehensive registry of all actors within the Danish healthcare system [^src1]. In the context of national clinical databases and quality development programs, SOR serves a critical methodological function by defining the boundaries of patient populations. 

Specifically, the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] (AKDB) utilizes SOR to identify and exclude hospital departments with certain medical specialties from its registered population [^src1]. By referencing SOR classifications, the AKDB ensures that patient contacts registered at departments specializing in gynecology and obstetrics, as well as urology, are systematically omitted from the database [^src1]. This application of SOR is central to the precision of the AKDB's inclusion and exclusion criteria, ensuring that the database accurately reflects its intended target population of acute surgical patients without contamination from unrelated medical fields [^src1]. The use of SOR forms part of the broader technical and methodological framework of the AKDB, which relies on standardized, real-world health data and primary registration platforms to ensure high data quality and clinical relevance [^src1].

## Mentions
- Page 81: "SOR*:
- Gynækologi og obstetrik
- Urologi
*SOR står for Sundhedsvæsenets Organisationsregister og er et register over alle aktører i det danske sundhedsvæsen." (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 81-85) [^src1]

## Relationships
Incoming (this entity is the OBJECT of these relationships):
- Subject: akut-kirurgi-databasen
  Predicate: excludes-departments-from
  Object: (this entity)
  Evidence: "Kontakter registreret på afdelinger med følgende specialer, jf. SOR*:
- Gynækologi og obstetrik
- Urologi"
  Page: 81
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 81-85 [^src1]

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 81-85
