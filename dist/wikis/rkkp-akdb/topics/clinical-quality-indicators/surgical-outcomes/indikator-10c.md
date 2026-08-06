---
title: Indikator 10c
type: entity
aliases:
  - Indikator 10c
wiki: rkkp-akdb
updated: '2026-08-05T19:10:59.073Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '66-70, 71-75'
tags:
  - quality-indicator
---
**Indikator 10c** is an official Danish quality indicator for acute surgery that specifically focuses on patients with a higher comorbidity risk. It operates within the broader quality measurement framework of the Akut Kirurgi Databasen (Acute Surgery Database), managed by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP). The indicator is designed to evaluate clinical quality and healthcare performance by measuring 30-day mortality following acute surgical procedures, stratified by the patient's pre-existing disease burden.

The primary focus of the documented results is the supplementary version of Indikator 10c. This supplementary indicator describes the proportion of patients who die within 30 days from the date of surgery among all operated patients (with relevant diagnosis and procedure codes) who have a [[charlson-score|Charlson Score]] ≥ 3, which corresponds to a high level of registered comorbidity [^src1] [^src2]. By utilizing the [[charlson-comorbiditets-indeks|Charlson Comorbiditets indeks]], the database ensures that mortality rates are risk-adjusted, allowing for fair and clinically relevant comparisons across different regions and hospitals in the Danish healthcare system [^src1] [^src2].

For the most recent analysis period, which ran from September 1, 2022, to August 31, 2023, a total of 729 patients were included in the indicator analysis [^src2]. The results showed that 20.2% (95% CI: 17.3-23.3) of these high-comorbidity patients died within 30 days of their operation [^src2]. These detailed statistics form a central component of the national evaluation of acute surgical care quality, highlighting a systematic effort to ensure comparable, risk-adjusted quality measurements in the Danish healthcare system.

## Mentions
- Page 66: "Supplerende indikator til indikator 10c" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 66-70)
- Page 71: "Supplerende indikator til Indikator 10c beskriver andelen af patienter, der dør indenfor 30 dage fra tidspunkt for operation, for patienter med Charlson Score ≥ 3, svarende til høj registreret komorbiditet." (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 71-75)

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: indikator-10c
  Predicate: has-supplementary-version
  Object: indikator-10c
  Evidence: "Supplerende indikator til indikator 10c"
  Page: 66
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 66-70
- Subject: indikator-10c
  Predicate: has-supplementary-indicator
  Object: indikator-10c
  Evidence: "Supplerende indikator til Indikator 10c beskriver andelen af patienter, der dør indenfor 30 dage fra tidspunkt for operation, for patienter med Charlson Score ≥ 3"
  Page: 71
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 71-75

Incoming (this entity is the OBJECT of these relationships):
- Subject: charlson-comorbiditets-indeks
  Predicate: is-used-in-definition-of
  Object: (this entity)
  Evidence: "Supplerende indikator til 10c: Mortalitet indenfor 30 dage efter akut kirurgi, hvis Charlson Score ≥ 3"
  Page: 66
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 66-70
- Subject: charlson-score
  Predicate: defines-inclusion-criteria-for
  Object: (this entity)
  Evidence: "Supplerende indikator til Indikator 10c beskriver andelen af patienter, der dør indenfor 30 dage fra tidspunkt for operation, for patienter med Charlson Score ≥ 3"
  Page: 71
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 71-75

## Claims
- Supplerende indikator til indikator 10c beskriver andelen af patienter, der dør indenfor 30 dage fra operationsdato for alle opererede (med relevant diagnosekode og procedurekode), og som har Charlson Score ≥ 3 [^src1] (indikator-10c, charlson-comorbiditets-indeks)
  Type: definition
  Page: 66
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 66-70
- Supplerende indikator til Indikator 10c beskriver andelen af patienter, der dør indenfor 30 dage fra tidspunkt for operation, for patienter med Charlson Score ≥ 3, svarende til høj registreret komorbiditet [^src1] (indikator-10c, charlson-score)
  Type: clinical
  Page: 71
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 71-75
- Der indgik 729 patienter i indikatoranalysen i perioden [^src1] (indikator-10c)
  Type: statistical
  Page: 71
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 71-75
- Heraf døde 20,2 % (95 % CI: 17,3-23,3) indenfor 30 dage fra operation [^src1] (indikator-10c)
  Type: statistical
  Page: 71
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 71-75

## Timeline
- 2022-09-01: Start af den aktuelle analyseperiode for supplerende indikator til indikator 10c (indikator-10c)
- 2023-08-31: Afslutning af den aktuelle analyseperiode for supplerende indikator til indikator 10c (indikator-10c)

## Sources

[^src1]: AKDB_2023.pdf, pages 66-70
[^src2]: AKDB_2023.pdf, pages 71-75
