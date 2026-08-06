---
title: Hovedstaden Region i alt
type: entity
aliases:
  - Hovedstaden Region i alt
wiki: rkkp-akdb
updated: '2026-08-05T19:05:55.435Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '56-60, 71-75'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '61-65, 71-75'
tags:
  - organization
---
**Hovedstaden Region i alt** (Capital Region Total) is the aggregate statistical and reporting entity for the Capital Region of [[danmark|Danmark]] within the national clinical quality databases for acute surgery. It functions as the comprehensive data unit that consolidates patient records from all major hospitals in the region, enabling national-level analysis of patient composition, comorbidities, and cancer distribution among acutely operated patients.

As a structural component of the [[regionernes-kliniske-kvalitetsudviklingsprogram|Regionernes Kliniske Kvalitetsudviklingsprogram]] (RKKP), this regional aggregate is essential for benchmarking and evaluating clinical quality indicators [^src1]. The data compiled under this entity directly supports the assessment of critical metrics, such as 30-day and 90-day postoperative mortality, particularly for vulnerable cohorts like patients with high comorbidity (Charlson Comorbidity Index ≥ 3) and those with concurrent cancer diagnoses. The aggregated statistics are central to the annual reports of the Acute Surgery Database (AKDB), specifically covering periods such as September 1, 2022, to August 31, 2023.

In terms of clinical demographics, the aggregate unit provides detailed breakdowns of cancer prevalence among surgical patients. For instance, in the 2023 reporting cycle, the region recorded 1,095 operated patients, of which 54 (1.71%) had gastrointestinal cancers, 4 (0.13%) had gynecological cancers, 19 (0.60%) had other types of cancer, and 1,018 (32.31%) had no cancer diagnosis [^src1]. Broader demographic and age-distribution tables also track the region's total surgical volume, noting 1,294 cases in one 2023 dataset [^src2] and 1,296 cases in the subsequent 2024 publication [^src4]. Furthermore, the entity aggregates specific mortality outcomes and confidence intervals for risk-adjusted indicators [^src3].

The regional total is composed of data submitted by its constituent hospital units. These include [[amager-og-hvidovre-hospital|Amager og Hvidovre Hospital]], [[bispebjerg-og-frederiksberg-hospitaler|Bispebjerg og Frederiksberg Hospitaler]], [[bornholms-hospital|Bornholms Hospital]], [[herlev-og-gentofte-hospital|Herlev og Gentofte Hospital]], and [[rigshospitalet|Rigshospitalet]], all of which are listed under this regional umbrella in national quality tables [^src1].

## Mentions

- Page 56: "Hovedstaden Region i alt" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60)
- Page 71: "Hovedstaden Region i alt 1.294 100,0 53,00 69,00 64,26 78,00" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 71-75)
- Page 61: "Hovedstaden Region i alt 36 / 421 0 (0) 8,6 (6,1-11,6) 6,1 6,7" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 61-65)
- Page 71: "Hovedstaden Region i alt 1.296 100,0 53,50 69,00 64,28 78,00" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 71-75)

## Relationships

Outgoing (this entity is the SUBJECT of these relationships):
- Subject: hovedstaden-region-i-alt
  Predicate: is-part-of
  Object: regionernes-kliniske-kvalitetsudviklingsprogram
  Evidence: "Hovedstaden Region i alt er en del af Regionernes Kliniske Kvalitetsudviklingsprogram"
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60

Incoming (this entity is the OBJECT of these relationships):
- Subject: amager-og-hvidovre-hospital
  Predicate: is-part-of
  Object: (this entity)
  Evidence: "Amager og Hvidovre Hospital er listet under Hovedstaden Region i alt i tabellen"
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60
- Subject: bispebjerg-og-frederiksberg-hospitaler
  Predicate: is-part-of
  Object: (this entity)
  Evidence: "Bispebjerg og Frederiksberg Hospitaler er listet under Hovedstaden Region i alt i tabellen"
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60
- Subject: bornholms-hospital
  Predicate: is-part-of
  Object: (this entity)
  Evidence: "Bornholms Hospital er listet under Hovedstaden Region i alt i tabellen"
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60
- Subject: herlev-og-gentofte-hospital
  Predicate: is-part-of
  Object: (this entity)
  Evidence: "Herlev og Gentofte Hospital er listet under Hovedstaden Region i alt i tabellen"
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60
- Subject: rigshospitalet
  Predicate: is-part-of
  Object: (this entity)
  Evidence: "Rigshospitalet er listet under Hovedstaden Region i alt i tabellen"
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60
- Subject: danmark
  Predicate: has-subregion
  Object: (this entity)
  Evidence: "Danmark 9.906 100,00 ... Hovedstaden Region i alt 2.794 100,00"
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 61-65

## Claims

- Hovedstaden Region i alt: 1.095 opererede patienter, hvoraf 54 (1,71 %) havde gastrointestinale kræftsygdomme, 4 (0,13 %) gynækologiske kræftsygdomme, 19 (0,60 %) resten af kræftsygdomme og 1.018 (32,31 %) ingen kræftdiagnose [^src1] (hovedstaden-region-i-alt)
  Type: cancer-distribution
  Page: 56
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 56-60

## Timeline

(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 56-60
[^src2]: AKDB_2023.pdf, pages 71-75
[^src3]: AKDB_2024.pdf, pages 61-65
[^src4]: AKDB_2024.pdf, pages 71-75
