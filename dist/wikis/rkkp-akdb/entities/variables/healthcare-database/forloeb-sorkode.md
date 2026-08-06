---
title: Forloeb_SORKode
type: entity
aliases:
  - Forloeb_SORKode
wiki: rkkp-akdb
updated: '2026-08-05T19:31:28.120Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: 91-95
tags:
  - variable
---
`Forloeb_SORKode` is a specific data variable used within the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] (AKDB), a national quality database for acute high-risk abdominal surgery [^src1]. Operating at the hospital level, this variable is essential for identifying and extracting relevant patient episodes (*forløb*) from the database [^src1]. Specifically, it links these clinical episodes to the official SOR codes (Sundhedsvæsenets Organisationsregister) that uniquely identify specific hospitals or departments [^src1].

The variable plays a critical role in the local validation processes undertaken by hospitals and regions to ensure data accuracy [^src1]. During these validation procedures, clinical registrations in the Electronic Patient Record (EPJ) systems are compared against data reported to the National Patient Register (LPR) and subsequently transferred to the AKDB via KKA deliveries in LIS systems [^src1]. By utilizing precise variable definitions at the hospital level, such as `Forloeb_SORKode`, alongside clinical indicators like 'Opereret = 1' and 'T_0', data managers can verify that the reported patient population accurately reflects the underlying clinical reality [^src1]. This rigorous validation is a direct trigger for practical quality improvement work across regions and hospitals, tying into the broader quality development strategy under the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP) [^src1].

## Mentions
- Page 91: "På hospitalsniveau: Variablen Forloeb_SORKode" [^src1]

## Relationships
- **Subject:** akut-kirurgi-databasen
  - **Predicate:** has-variable
  - **Object:** Forloeb_SORKode
  - **Evidence:** "På hospitalsniveau: Variablen Forloeb_SORKode"
  - **Page:** 91
  - **Citation:** [^src1]

## Claims
- **Administrative:** Variablen Forloeb_SORKode anvendes på hospitalsniveau til udtræk [^src1]

## Timeline
*(No timeline events recorded for this entity.)*

## Sources

[^src1]: AKDB_2024.pdf, pages 91-95
