---
title: S-creatinin
type: entity
wiki: rkkp-afdk
updated: '2026-08-05T21:15:47.353Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '36-40, 6-10'
tags:
  - laboratory-test
---
S-creatinin (serum creatinine) is a specific laboratory parameter used to assess kidney function in patients with [[atrieflimren|atrial fibrillation]] who are treated with [[doac|DOAC]] (Direct Oral Anticoagulants) [^src2]. Within the Danish national quality program for atrial fibrillation, managed by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP), S-creatinin serves as the core metric for [[indikator-4b|Indicator 4b]] [^src1].

The primary purpose of tracking S-creatinin is to ensure the safe monitoring of kidney function, which is critical for patients on DOACs, as renal impairment can directly affect drug metabolism and safety [^src2]. To fulfill the requirements of Indicator 4b, prevalent patients with atrial fibrillation on DOAC treatment must have at least one S-creatinin measurement recorded annually [^src2]. The national quality standard mandates that ≥ 95% of these patients receive this annual monitoring [^src2]. 

While the broader RKKP report highlights progress in areas like treatment persistence, it also points out challenges such as geographic variations in laboratory monitoring and the failure to meet certain national standards, underscoring the necessity for targeted regional and local quality improvement efforts regarding tests like S-creatinin [^src2].

## Mentions
- Page 40: "Indikator 4b: Andelen af prævalente patienter med atrieflimren i Direkte Orale antikoagulantia (DOAC) med mindst 1 måling af S-creatinin årligt" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 36-40) [^src1]
- Page 6: "med mindst 1 måling af S-creatinin årligt." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 6-10) [^src2]

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: s-creatinin
  Predicate: is-monitoring-test-for
  Object: doac
  Evidence: "prævalente patienter med atrieflimren i Direkte Orale antikoagulantia (DOAC) med mindst 1 måling af S-creatinin årligt."
  Page: 6
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 6-10 [^src2]

Incoming (this entity is the OBJECT of these relationships):
- Subject: indikator-4b
  Predicate: uses-laboratory-parameter
  Object: s-creatinin
  Evidence: "Indikator 4b: Andelen af prævalente patienter med atrieflimren i Direkte Orale antikoagulantia (DOAC) med mindst 1 måling af S-creatinin årligt"
  Page: 40
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 36-40 [^src1]

## Claims
- Indikator 4b har standarden ≥ 95 % for andelen af prævalente patienter med atrieflimren i Direkte Orale antikoagulantia (DOAC) med mindst 1 måling af S-creatinin årligt [^src1] (atrieflimren, doac, s-creatinin, indikator-4b)
  Type: quality-standard
  Page: 6
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 6-10 [^src2]

## Timeline
(none)

## Sources

[^src1]: AFDK_2024.pdf, pages 36-40
[^src2]: AFDK_2024.pdf, pages 6-10
