---
title: ADHD-udredningspopulation
type: entity
aliases:
  - Udredningspopulationen
wiki: rkkp-adhd
updated: '2026-08-05T18:17:02.417Z'
sources:
  - file: wikis/rkkp-adhd/raw/ADHD_2023.pdf
    pages: '36-40, 41-45'
  - file: wikis/rkkp-adhd/raw/ADHD_2024.pdf
    pages: '11-15, 21-25, 26-30, 36-40, 6-10'
tags:
  - population
---
The **ADHD-udredningspopulation** (ADHD diagnostic population) is the national cohort of individuals in Denmark who have undergone an ADHD diagnostic assessment since January 1, 2013 [^src7]. It serves as one of the two primary course-based populations within the [[adhd-databasen|ADHD-DATABASEN]], operating alongside the [[adhd-behandlingspopulation|ADHD treatment population]] to monitor the quality of child and adolescent psychiatric care [^src7].

Demographically, the diagnostic population is substantial and skews male. During the reporting period from April 1, 2023, to March 31, 2024, the population encompassed 5,215 diagnostic courses, with boys accounting for 59% of the total [^src7]. The distribution of these courses varies significantly across the country; for example, [[region-hovedstaden|Region Hovedstaden]] recorded 2,321 diagnostic courses, while [[region-syddanmark|Region Syddanmark]] recorded 1,171 courses in the same timeframe [^src7].

This population is foundational to the national quality monitoring framework, acting as the denominator for several key clinical indicators. It is the baseline population for measuring somatic diagnostics via [[indikator-1|Indicator 1]] and clinical environmental observations for children aged 0–5 via [[indikator-2a|Indicator 2a]] [^src3]. The strategic importance of this cohort has also led to structural revisions in monitoring; notably, [[indikator-4|Indicator 4]] was updated to include the diagnostic population to better capture early cross-sectoral coordination with municipalities during the assessment phase [^src5].

Beyond clinical processes, the diagnostic population is critical for evaluating long-term societal and educational outcomes. [[indikator-7a|Indicator 7a]] tracks the proportion of youths in this cohort who successfully pass the Danish primary school leaving examination (folkeskolens afgangseksamen) before the age of 17 [^src1]. In 2023, the pass rate for this group was 55% [^src1]. By 2024, the pass rate for those turning 17 was 53%, reflecting a persistent educational lag compared to the general background population [^src6]. This metric also exposes stark regional inequalities: the highest pass rate was observed in [[region-hovedstaden|Region Hovedstaden]] at 63%, whereas the lowest was in [[region-nordjylland|Region Nordjylland]] at just 47% [^src6]. These disparities underscore systemic challenges and the urgent need for targeted educational and clinical support for youths undergoing ADHD diagnostics [^src6].

## Mentions
- Page 36: "Indikatorpopulation (nævner): Antal unge i "ADHD udredningspopulation"*, der er fyldt 17 år i kalenderåret før opgørelsesperiodens afslutning og i de to foregående kalenderår" [^src1]
- Page 6: "Indikator 7a: Andelen af unge i ’ADHD-udredningspopulation’, der har bestået folkeskolens afgangseksamen inden han/hun er fyldt 17 år" [^src2]
- Page 11: "Indikatorpopulation (nævner): Antal forløb i "ADHD udredningspopulation", hvor dato for udredningsstart er i opgørelsesperioden" [^src3]
- Page 21: "Indikatorpopulation (nævner): Antal forløb i "ADHD udredningspopulation", hvor dato for udredningsstart er i opgørelsesperioden" [^src4]
- Page 26: "ændret indikatoren til at omfatte udredningspopulationen." [^src5]
- Page 36: "Andelen af unge i "ADHD-udredningspopulation", der har bestået folkeskolens afgangseksamen inden han/hun er fyldt 17 år" [^src6]
- Page 41: "a) Udredningspopulationen
Tabellen viser antal, alders- og kønsfordeling for den periode, der indgår i årsrapporten (1. april 2023 - 31. marts 2024)" [^src7]

## Relationships
**Outgoing**
- Subject: adhd-udredningspopulation | Predicate: is-part-of | Object: adhd-databasen
  Evidence: "ADHD-databasen inkluderer børn og unge under 18 år i to forløbsbaserede populationer: ADHD udredningspopulation og ADHD behandlingspopulation" [^src7]

**Incoming**
- Subject: indikator-7a | Predicate: measures | Object: adhd-udredningspopulation
  Evidence: "Indikatorpopulation (nævner): Antal unge i "ADHD udredningspopulation"*, der er fyldt 17 år i kalenderåret før opgørelsesperiodens afslutning" [^src1]
- Subject: indikator-1 | Predicate: measures | Object: adhd-udredningspopulation
  Evidence: "Indikatorpopulation (nævner): Antal forløb i "ADHD udredningspopulation", hvor dato for udredningsstart er i opgørelsesperioden" [^src3]
- Subject: indikator-2a | Predicate: measures | Object: adhd-udredningspopulation
  Evidence: "Indikatorpopulation (nævner): Antal forløb i "ADHD udredningspopulation", hvor dato for udredningsstart er i opgørelsesperioden" [^src3]
- Subject: indikator-4 | Predicate: now-applies-to | Object: adhd-udredningspopulation
  Evidence: "ændret indikatoren til at omfatte udredningspopulationen." [^src5]
- Subject: indikator-7a | Predicate: measures-outcome-of | Object: adhd-udredningspopulation
  Evidence: "Indikator 7a: Andelen af unge i "ADHD-udredningspopulation", der har bestået folkeskolens afgangseksamen inden han/hun er fyldt 17 år" [^src6]

## Claims
**Statistical**
- Andelen af unge i ADHD-udredningspopulationen, der har bestået folkeskolens afgangseksamen inden fylde 17 år, var 55 % i 2023 [^src1] (indikator-7a, adhd-udredningspopulation)

**Educational-outcome**
- 53 % af de unge, som har været udredt for ADHD på et tidspunkt i databasens levetid (start 1/1 2013), og som i 2024 blev 17 år, har bestået folkeskolens afgangsprøve [^src1] (adhd-udredningspopulation, adhd-databasen)

**Regional-variation**
- Den højeste andel af beståede afgangseksaminer blandt unge i ADHD-udredningspopulationen ses i Hovedstaden (63 %), mens den laveste ses i Nordjylland (47 %) [^src1] (region-hovedstaden, region-nordjylland, adhd-udredningspopulation)

**Demographic**
- Udredningspopulationen omfatter 5.215 udredningsforløb i perioden 1. april 2023 til 31. marts 2024 [^src1] (adhd-udredningspopulation)
- I udredningspopulationen udgør drenge 59 % af det samlede antal [^src1] (adhd-udredningspopulation)

**Regional**
- Region Hovedstaden har 2.321 udredningsforløb og 647 patienter i pakkeforløb [^src1] (region-hovedstaden, adhd-udredningspopulation, adhd-behandlingspopulation)
- Region Syddanmark har 1.171 udredningsforløb og 841 patienter i pakkeforløb [^src1] (region-syddanmark, adhd-udredningspopulation, adhd-behandlingspopulation)

## Timeline
(none)

## Sources

[^src1]: ADHD_2023.pdf, pages 36-40
[^src2]: ADHD_2024.pdf, pages 6-10
[^src3]: ADHD_2024.pdf, pages 11-15
[^src4]: ADHD_2024.pdf, pages 21-25
[^src5]: ADHD_2024.pdf, pages 26-30
[^src6]: ADHD_2024.pdf, pages 36-40
[^src7]: ADHD_2023.pdf, pages 41-45
