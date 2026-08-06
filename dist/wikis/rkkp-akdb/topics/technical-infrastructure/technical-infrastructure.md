---
title: Technical Infrastructure
type: topic
aliases:
  - Technical Infrastructure
wiki: rkkp-akdb
updated: '2026-08-05T19:48:25.900Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: 101-105
tags:
  - technical-infrastructure
---
Technical infrastructure in the context of clinical quality databases refers to the systemic connections and data mappings that allow information to flow from regional electronic patient journals (EPJ) into national registries. A critical component of this infrastructure is the accurate linking of specific clinical activities to standardized procedure codes, which enables automated data harvesting.

In the case of the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] (AKDB), the database's completeness depends on these technical linkages functioning correctly across different regional systems. A specific infrastructure failure has been identified in the NordEPJ system, where the clinical activity 'ernæringsplan' (nutrition plan) is not connected to the procedure codes [[zz2009c|ZZ2009C]] and [[zz2009d|ZZ2009D]] [^src1]. Because this mapping is missing, the system is unable to harvest this data for the AKDB [^src1]. This issue underscores how localized configuration gaps in regional EPJs can directly impair the data collection capabilities of national clinical databases.

## Claims
- Aktiviteten 'ernæringsplan' i NordEPJ er ikke tilknyttet procedurekoderne ZZ2009C og ZZ2009D, hvilket forhindrer høstning af data til AKDB [^src1] (zz2009c, zz2009d, akut-kirurgi-databasen)
  Type: technical-infrastructure
  Page: 101
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 101-105

## Sources

[^src1]: AKDB_2024.pdf, pages 101-105
