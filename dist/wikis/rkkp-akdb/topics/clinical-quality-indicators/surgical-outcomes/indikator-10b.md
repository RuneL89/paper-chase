---
title: Indikator 10b
type: entity
aliases:
  - Indikator 10b
wiki: rkkp-akdb
updated: '2026-08-15T07:53:40.936Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: 66-70
  - file: wikis/rkkp-akdb/raw/AKDB_2025.pdf
    pages: 56-60
tags:
  - quality-indicator
---

**Indikator 10b** is an official Danish clinical quality indicator used within the Acute Surgery Database to measure 30-day postoperative mortality among patients with a [[charlson-comorbiditets-indeks|Charlson Comorbiditets indeks]] score of 1 or 2 [^src1]. It serves as a supplementary version of the primary [[indikator-10|Indikator 10]], enabling healthcare administrators and clinicians to evaluate surgical outcomes with specific risk-adjustment for patients with a moderate pre-existing disease burden [^src1][^src2]. 

The indicator is a core component of the systematic effort to ensure comparable, clinically relevant quality measurements across the Danish healthcare system [^src1][^src2]. According to the 2023 annual report, the analysis for Indikator 10b included a cohort of 1,086 patients [^src1]. Within this group, the 30-day mortality rate following acute surgery was 11.2% (95% CI: 9.4–13.3) [^src1]. Subsequent evaluations, including the draft 2026 annual report, continue to assess and methodologically adjust this supplementary indicator alongside others to maintain robustness and comparability across regions and hospitals [^src2].

## Mentions
- Page 66: "Supplerende indikator til indikator 10b" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 66-70) [^src1]
- Page 57: "Resultater af indikatoranalysen for supplerende indikator 10" (source: wikis/rkkp-akdb/raw/AKDB_2025.pdf, pages 56-60) [^src2]
- Page 58: "Vurdering af indikator supplerende 10" (source: wikis/rkkp-akdb/raw/AKDB_2025.pdf, pages 56-60) [^src2]

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: indikator-10b
  Predicate: has-supplementary-version
  Object: indikator-10b
  Evidence: "Supplerende indikator til indikator 10b"
  Page: 66
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 66-70 [^src1]
- Subject: indikator-10b
  Predicate: is-supplementary-version-of
  Object: indikator-10
  Evidence: "Resultater af indikatoranalysen for supplerende indikator 10"
  Page: 57
  Source: wikis/rkkp-akdb/raw/AKDB_2025.pdf, pages 56-60 [^src2]

Incoming (this entity is the OBJECT of these relationships):
- Subject: charlson-comorbiditets-indeks
  Predicate: is-used-in-definition-of
  Object: indikator-10b
  Evidence: "Supplerende indikator til indikator 10b: Mortalitet indenfor 30 dage efter akut kirurgi, Charlson Score = 1 eller 2"
  Page: 66
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 66-70 [^src1]

## Claims
- Der indgik 1.086 patienter i indikatoranalysen i perioden. Heraf døde 11,2 % (95 % CI: 9,4-13,3) indenfor 30 dage fra operation. [^src1] (indikator-10b)
  Type: statistical
  Page: 66
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 66-70

## Timeline
(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 66-70
[^src2]: AKDB_2025.pdf, pages 56-60
