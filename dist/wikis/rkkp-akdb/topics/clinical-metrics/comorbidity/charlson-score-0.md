---
title: Charlson Score = 0
type: entity
aliases:
  - Charlson Score = 0
wiki: rkkp-akdb
updated: '2026-08-05T19:10:07.719Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: 61-65
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: 61-65
tags:
  - clinical-indicator
---
**Charlson Score = 0** is a clinical indicator utilized within the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] to identify patients who have no registered comorbidities. In the context of acute surgery quality assessments, this specific score serves as a central clinical definition to isolate a baseline patient group. By evaluating patients with a Charlson Score of 0, analysts can assess pure surgical mortality without the confounding variables introduced by underlying disease burden.

Within the database's reporting framework, this metric is deployed as a supplementary indicator to measure the proportion of patients who die within 30 days from the time of their operation [^src1] [^src2]. Methodologically, the calculation of the Charlson Score relies on diagnostic data retrieved from a 10-year lookback period to ensure comprehensive comorbidity tracking [^src2]. 

In a recent analysis period documented by the database, 1,324 patients were included in the indicator analysis for this specific zero-comorbidity cohort [^src2]. Among these patients, the 30-day postoperative mortality rate was 6.2% (95% CI: 5.0-7.6) [^src2]. This data is part of a broader stratification effort by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP) to benchmark treatment quality, identify variations in clinical safety, and evaluate improvement initiatives across national, regional, and individual hospital levels.

## Mentions
- Page 61: "Supplerende indikator til 10a: Mortalitet indenfor 30 dage efter akut kirurgi, Charlson Score = 0. Alle opererede. Resultater på afdelingsniveau" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65) [^src1]
- Page 61: "Supplerende indikator til Indikator 9a beskriver andelen af patienter, der dør indenfor 30 dage fra tidspunkt for operation, for patienter med Charlson Score 0, svarende til ingen registreret komorbiditet." (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 61-65) [^src2]

## Relationships
- **Subject:** charlson-score-0 | **Predicate:** is-basis-for | **Object:** akut-kirurgi-databasen
  - **Evidence:** "Supplerende indikator til 10a: Mortalitet indenfor 30 dage efter akut kirurgi, Charlson Score = 0. Alle opererede. Resultater på afdelingsniveau"
  - **Page:** 61 [^src1]
  - **Source:** wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65
- **Subject:** charlson-score-0 | **Predicate:** is-used-in | **Object:** akut-kirurgi-databasen
  - **Evidence:** "Supplerende indikator til Indikator 9a beskriver andelen af patienter, der dør indenfor 30 dage fra tidspunkt for operation, for patienter med Charlson Score 0"
  - **Page:** 61 [^src2]
  - **Source:** wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 61-65

## Claims
- Supplerende indikator til Indikator 9a beskriver andelen af patienter, der dør indenfor 30 dage fra tidspunkt for operation, for patienter med Charlson Score 0, svarende til ingen registreret komorbiditet [^src1] (akut-kirurgi-databasen, charlson-score-0)
  - **Type:** clinical-indicator
  - **Page:** 61
  - **Source:** wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 61-65 [^src2]
- Der indgik 1.324 patienter i indikatoranalysen i perioden. Heraf døde 6,2 % (95 % CI: 5,0-7,6) indenfor 30 dage fra operation [^src1] (akut-kirurgi-databasen, charlson-score-0)
  - **Type:** clinical-outcome
  - **Page:** 61
  - **Source:** wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 61-65 [^src2]
- Diagnoser til brug i beregning af Charlson Score er hentet 10 år tilbage i tid [^src1] (charlson-score-0)
  - **Type:** methodological
  - **Page:** 61
  - **Source:** wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 61-65 [^src2]

## Timeline
*(No timeline events provided)*

## Sources

[^src1]: AKDB_2023.pdf, pages 61-65
[^src2]: AKDB_2024.pdf, pages 61-65
