---
title: Laboratoriedatabasen
type: entity
wiki: rkkp-afdk
updated: '2026-08-05T21:13:20.327Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 21-25
tags:
  - database
---

**Laboratoriedatabasen** is a database administered by [[sundhedsdatastyrelsen|Sundhedsdatastyrelsen]] that integrates TSH (Thyroid Stimulating Hormone) measurement data from the National Lab Data Bank (Den Nationale Labdatabank) [^src1]. It plays a critical role in national healthcare quality reporting, specifically serving as the foundational data source used to calculate [[indikator-3|Indikator 3]], which tracks TSH measurements at the time of new atrial fibrillation diagnoses [^src1].

The database is highlighted in the 'Atrieflimren i Danmark' (Atrial Fibrillation in Denmark) report published by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP). The report discusses systemic challenges in implementing clinical standards, noting that incomplete data coverage from laboratories can hinder the fulfillment of quality targets. Because Laboratoriedatabasen is the direct pipeline for these measurements, understanding its data sources and inherent limitations is essential for accurately interpreting the results and shortcomings of Indicator 3 [^src1].

## Mentions

- Page 24: "Data om måling af TSH er indhentet via kobling med Laboratoriedatabasen." [^src1]

## Relationships

**Outgoing**
- **Subject:** laboratoriedatabasen
- **Predicate:** is-administered-by
- **Object:** sundhedsdatastyrelsen
- **Evidence:** "Laboratoriedatabasen hos Sundhedsdatastyrelsen"
- **Page:** 24 [^src1]

**Incoming**
- **Subject:** indikator-3
- **Predicate:** relies-on-data-from
- **Object:** (this entity)
- **Evidence:** "Data om måling af TSH er indhentet via kobling med Laboratoriedatabasen."
- **Page:** 24 [^src1]

## Claims

(none)

## Timeline

(none)

## Sources

[^src1]: AFDK_2024.pdf, pages 21-25
