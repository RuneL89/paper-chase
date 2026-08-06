---
title: Indikator 7a
type: entity
aliases:
  - Indikator 7a
wiki: rkkp-adhd
updated: '2026-08-05T18:03:59.323Z'
sources:
  - file: wikis/rkkp-adhd/raw/ADHD_2023.pdf
    pages: '36-40, 6-10'
  - file: wikis/rkkp-adhd/raw/ADHD_2024.pdf
    pages: '36-40, 6-10'
tags:
  - indicator
---
**Indikator 7a** is a result indicator utilized in the Danish healthcare system's national quality monitoring for ADHD. It measures the proportion of young people in the [[adhd-udredningspopulation|ADHD-udredningspopulation]] (ADHD assessment population) who successfully pass the primary school leaving exam (*folkeskolens afgangseksamen*) before reaching the age of 17 [^src2]. By tracking this specific educational milestone, the indicator highlights the long-term educational challenges and structural deficits faced by youth undergoing ADHD assessment [^src4].

The indicator is managed and hosted by the [[adhd-databasen|ADHD-DATABASEN]], which includes it in its annual quality reports alongside other metrics like Indikator 7b (which tracks the treatment population) and Indikator 6 [^src1]. To calculate the metric, Indikator 7a relies on data from [[danmarks-statistik|Danmarks Statistik]] [^src4]. The denominator consists of young people in the assessment population who turned 17 in the calendar year prior to the end of the reporting period [^src2].

Recent data underscores a persistent educational lag for this demographic. In 2023, the pass rate for the assessment population was 55% [^src2]. However, performance data from the 2024 annual report (covering the period from April 1, 2024, to March 31, 2025) shows a decline, with Indikator 7a reaching 53% (95% CI: 51–55), down from 59% in the 2022/23 period [^src3]. These figures are systematically compared against the general background population to evaluate the broader impact of ADHD on educational attainment and to inform national strategies and regional support mechanisms [^src4].

## Mentions
- Page 6: "Indikator 7a: Andelen af unge i "ADHD-udredningspopulation", der har bestået folkeskolens afgangseksamen inden han/hun er fyldt 17 år" (source: wikis/rkkp-adhd/raw/ADHD_2023.pdf, pages 6-10)
- Page 36: "Resultatindikator 7a og 7b: Bestået folkeskolens afgangseksamen
Indikator 7a: Andelen af unge i "ADHD-udredningspopulation", der har bestået folkeskolens afgangseksamen inden han/hun er fyldt 17 år" (source: wikis/rkkp-adhd/raw/ADHD_2023.pdf, pages 36-40)
- Page 6: "Indikator 7a: Andelen af unge i ’ADHD-udredningspopulation’, der har bestået folkeskolens afgangseksamen inden han/hun er fyldt 17 år" (source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 6-10)
- Page 36: "Indikator 7a: Bestået folkeskolens afgangseksamen" (source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 36-40)

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: indikator-7a
  Predicate: measures
  Object: adhd-udredningspopulation
  Evidence: "Indikatorpopulation (nævner): Antal unge i "ADHD udredningspopulation"*, der er fyldt 17 år i kalenderåret før opgørelsesperiodens afslutning"
  Page: 36
  Source: wikis/rkkp-adhd/raw/ADHD_2023.pdf, pages 36-40
- Subject: indikator-7a
  Predicate: measures-outcome-of
  Object: adhd-udredningspopulation
  Evidence: "Indikator 7a: Andelen af unge i "ADHD-udredningspopulation", der har bestået folkeskolens afgangseksamen inden han/hun er fyldt 17 år"
  Page: 36
  Source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 36-40
- Subject: indikator-7a
  Predicate: uses-data-from
  Object: danmarks-statistik
  Evidence: "Indikatoren er baseret på data fra Danmarks Statistik."
  Page: 36
  Source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 36-40

Incoming (this entity is the OBJECT of these relationships):
- Subject: adhd-databasen
  Predicate: manages
  Object: (this entity)
  Evidence: "Indikator 7a: Andelen af unge i "ADHD-udredningspopulation", der har bestået folkeskolens afgangseksamen inden han/hun er fyldt 17 år"
  Page: 6
  Source: wikis/rkkp-adhd/raw/ADHD_2023.pdf, pages 6-10
- Subject: adhd-databasen
  Predicate: hosts
  Object: (this entity)
  Evidence: "ADHD-DATABASEN
Resultatindikator 7a og 7b: Bestået folkeskolens afgangseksamen"
  Page: 36
  Source: wikis/rkkp-adhd/raw/ADHD_2023.pdf, pages 36-40
- Subject: adhd-databasen
  Predicate: manages
  Object: (this entity)
  Evidence: "Indikator 7a er en del af det samlede sæt af kvalitetsindikatorer, der afrapporteres i ADHD-DATABASEN's årsrapport."
  Page: 6
  Source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 6-10

## Claims
- Andelen af unge i ADHD-udredningspopulationen, der har bestået folkeskolens afgangseksamen inden fylde 17 år, var 55 % i 2023 [^src1] (indikator-7a, adhd-udredningspopulation)
  Type: statistical
  Page: 36
  Source: wikis/rkkp-adhd/raw/ADHD_2023.pdf, pages 36-40
- Indikator 7a opnåede 53 % (95 % CI: 51–55) i perioden 01.04.2024–31.03.2025, hvilket er en nedgang fra 59 % i 2022/23 [^src1] (indikator-7a)
  Type: performance
  Page: 6
  Source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 6-10

## Timeline
- 2023-04-01: Start af opgørelsesperioden for Indikator 6 og 7a/7b i årsrapport 2023/24 (indikator-6, indikator-7a, indikator-7b)
- 2024-03-31: Afslutning af opgørelsesperioden for Indikator 6 og 7a/7b i årsrapport 2023/24 (indikator-6, indikator-7a, indikator-7b)
- 2024: Opgørelse af indikator 7a og 7b for unge, der i 2024 blev 17 år (indikator-7a, indikator-7b)

## Sources

[^src1]: ADHD_2023.pdf, pages 6-10
[^src2]: ADHD_2023.pdf, pages 36-40
[^src3]: ADHD_2024.pdf, pages 6-10
[^src4]: ADHD_2024.pdf, pages 36-40
