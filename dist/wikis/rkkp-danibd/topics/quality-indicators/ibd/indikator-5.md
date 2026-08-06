---
title: Indikator 5
type: entity
aliases:
  - Indikator 5
wiki: rkkp-danibd
updated: '2026-08-05T06:52:37.556Z'
sources:
  - file: wikis/rkkp-danibd/raw/DANIBD_2024.pdf
    pages: '26-30, 41-45'
tags:
  - quality-indicator
---
**Indikator 5** is a central quality indicator in the Danish IBD quality database (DANIBD) report. It is designed to monitor the proportion of [[ibd|IBD]] patients receiving treatment with [[bmsl|Biologiske og målrettede syntetiske lægemidler]] (BMSL) who undergo an annual measurement of [[calprotectin|calprotectin]] (specifically fecal calprotectin) [^src1]. In 2024, the indicator successfully reached its national development goal, achieving a measurement rate of at least 80% across the country [^src1]. This milestone reflects a systemic focus on monitoring this specific patient group and highlights recent methodological improvements, such as the integration of a local NPU code for point-of-care fecal calprotectin measurements and the implementation of new treatment codes in the National Patient Registry for modern biologics and JAK inhibitors [^src1].

The indicator tracks a substantial patient population. During the most recent reporting period, a total of 407 children and 11,464 adult patients were treated with BMSL nationally [^src2]. The pediatric cohort had an average age of 14 years (median 15), while the adult cohort averaged 43 years of age (median 41) [^src2]. 

The data underpinning Indikator 5, alongside indicators 6 and 7, is drawn from a specific reporting period for BMSL treatments and surgical procedures that began on October 1, 2023, and concluded on September 30, 2024 [^src2]. Detailed appendix tables in the DANIBD 2024 report provide the quantitative foundation for this indicator, breaking down patient characteristics, treatment frequencies, and specific BMSL preparations at both national and departmental levels [^src2].

## Mentions

- Page 26: "Sorteret resultat af indikator 5 med konfidensinterval på lands- og afdelingsniveau for aktuelle opgørelsesperiode" [^src1]
- Page 41: "Appendikstabel 3. Karakteristika for patienter i behandling med BMSL på landsplan (indikator 5)" [^src2]
- Page 42: "Appendikstabel 4. Karakteristika for patienter i behandling med BMSL på afdelingsniveau (indikator 5)" [^src2]
- Page 43: "Appendikstabel 5. Type og antal behandlinger med BMSL (indikator 5)" [^src2]

## Relationships

**Outgoing**
- Subject: indikator-5 | Predicate: measures-frequency-of | Object: calprotectin
  - Evidence: "Denne indikator viser en udvikling i forhold til sidste år, og det er tydeligt, at der er fokus på at måle f-calprotectin hos denne patientgruppe."
  - Page: 26 [^src1]
- Subject: indikator-5 | Predicate: measures-treatment-of | Object: ibd
  - Evidence: "Appendikstabel 5. Type og antal behandlinger med BMSL (indikator 5)"
  - Page: 43 [^src2]

**Incoming**
- Subject: bmsl | Predicate: is-used-for | Object: indikator-5
  - Evidence: "Appendikstabel 3. Karakteristika for patienter i behandling med BMSL på landsplan (indikator 5)"
  - Page: 41 [^src2]

## Claims

**Demographic**
- I alt 407 børn og 11.464 voksne patienter var i behandling med BMSL på landsplan i perioden [^src1] (bmsl, indikator-5)
- For børn var gennemsnitsalderen 14 år (min;max: 0;18) og medianen 15 år (Q1;Q3: 13;16) [^src1] (bmsl, indikator-5)
- For voksne var gennemsnitsalderen 43 år (min;max: 17;97) og medianen 41 år (Q1;Q3: 30;56) [^src1] (bmsl, indikator-5)

## Timeline

- 2023-10-01: Start af opgørelsesperioden for BMSL-behandlinger og kirurgiske indgreb i indikator 5, 6 og 7 [^src2]
- 2024-09-30: Slut på opgørelsesperioden for BMSL-behandlinger og kirurgiske indgreb i indikator 5, 6 og 7 [^src2]

## Sources

[^src1]: DANIBD_2024.pdf, pages 26-30
[^src2]: DANIBD_2024.pdf, pages 41-45
