---
title: Indikator 9
type: entity
aliases:
  - Indikator 9
wiki: rkkp-afdk
updated: '2026-08-14T21:17:31.069Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 81-85
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 71-75
tags:
  - topic
---

**Indikator 9** is a supplementary quality indicator within the Danish healthcare system that measures the mortality rate among [[praevalente-patienter-med-atrieflimren|Prævalente patienter med atrieflimren]] (prevalent patients with atrial fibrillation) during a given reporting period [^src1] [^src2]. Functioning as a [[supplerende-indikator-mortalitet|Supplerende indikator: Mortalitet]], it is primarily utilized to benchmark and compare healthcare outcomes across regions and hospital clusters in [[danmark|Danmark]] [^src1] [^src2].

The indicator relies on vital status data (alive/dead) obtained through direct linkage with the [[cpr-registeret|CPR-registeret]] [^src2]. For the reporting period spanning July 1, 2024, to June 30, 2025, the national mortality rate for this specific patient group was recorded at 7.1% [^src1]. 

While Indikator 9 provides valuable epidemiological insights into patient outcomes, it carries notable methodological limitations. The reported figures are unadjusted proportions, meaning that differences observed at the hospital level may be attributed to varying patient populations (case-mix) rather than actual differences in the quality of clinical care [^src1]. Consequently, direct comparisons between different healthcare units are problematic without proper statistical adjustment for demographic and clinical factors [^src2].

The indicator is tracked on an annual basis. Recent reporting periods include the year from July 1, 2023, to June 30, 2024 [^src1], and the subsequent period from July 1, 2024, to June 30, 2025, which aligns with the tracking of severe bleeding complications under Supplerende analyser 7 [^src2].

## Mentions
- Page 82: "Indikator 9: Andelen af prævalente patienter med diagnosen atrieflimren som dør i opgørelsesperioden" [^src1]
- Page 72: "Indikator 9: Andelen af prævalente patienter med diagnosen atrieflimren som dør i opgørelsesperioden" [^src2]

## Relationships
**Outgoing**
- Subject: indikator-9 | Predicate: measures-mortality-of | Object: danmark | Evidence: "Indikator 9: Andelen af prævalente patienter med diagnosen atrieflimren som dør i opgørelsesperioden" | Page: 82 [^src1]
- Subject: indikator-9 | Predicate: measures | Object: supplerende-indikator-mortalitet | Evidence: "Indikator 9: Andelen af prævalente patienter med diagnosen atrieflimren som dør i opgørelsesperioden" | Page: 72 [^src2]

**Incoming**
- Subject: praevalente-patienter-med-atrieflimren | Predicate: are-subject-of | Object: indikator-9 | Evidence: "Andelen af prævalente patienter med diagnosen atrieflimren som dør i opgørelsesperioden" | Page: 72 [^src2]
- Subject: cpr-registeret | Predicate: provides-data-for | Object: indikator-9 | Evidence: "Oplysningerne vedrørende vitalstatus (død/levende) er indhentet via kobling med CPR-registeret." | Page: 74 [^src2]

## Claims
- Andelen af prævalente patienter med atrieflimren, som døde i opgørelsesperioden 01.07.2024–30.06.2025, var 7,1% på landsplan [^src1] (indikator-9, danmark)
  Type: mortality-rate
  Page: 72
- Der er betydelig risiko for, at forskellene på hospitalsniveau kan tilskrives forskellige populationer (case-mix) snarere end forskelle i behandlingskvaliteten [^src1] (indikator-9)
  Type: limitation
  Page: 74

## Timeline
- 01.07.2023 - 30.06.2024: Aktuel år for Indikator 9 med opgørelse af mortalitet blandt prævalente patienter med atrieflimren (indikator-9) [^src1]
- 2024-07-01: Start af opgørelsesperioden for Indikator 9 og Supplerende analyser 7 (indikator-9, supplerende-analyser-7-alvorlig-bloedning) [^src2]
- 2025-06-30: Afslutning af opgørelsesperioden for Indikator 9 og Supplerende analyser 7 (indikator-9, supplerende-analyser-7-alvorlig-bloedning) [^src2]

## Sources

[^src1]: AFDK_2024.pdf, pages 81-85
[^src2]: AFDK_2025.pdf, pages 71-75
