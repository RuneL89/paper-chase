---
title: APACHE
type: entity
wiki: rkkp-akdb
updated: '2026-08-05T19:02:25.332Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: 31-35
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: 31-35
tags:
  - score
---
APACHE is a clinical scoring system originally developed for intensive care unit (ICU) patients. Within the context of the Danish Acute Surgery Database (AKDB) and its national quality development efforts, the APACHE score has been evaluated as a potential tool for preoperative risk assessment and mortality prediction in acute gastrointestinal surgical patients [^src2]. Despite its clinical validity for predicting mortality risk in this specific patient group [^src2], database administrators and clinical evaluators have concluded that the score is overly complex for routine, broad practical application [^src1].

In the ongoing evaluation of clinical quality indicators, such as [[indikator-5|Indikator 5]] (intermediate admission of high-risk patients) and [[indikator-6|Indikator 6]] (intermediate admission), the APACHE score is frequently discussed alongside other risk stratification models like [[p-possum|P-POSSUM]], ASA, Charlson, and the Surgical Apgar score [^src2]. Specifically, both APACHE and [[p-possum|P-POSSUM]] have been formally assessed as too comprehensive and cumbersome for everyday practical use in tracking these national quality indicators [^src1]. Consequently, while recognized for its predictive value in acute surgical settings, APACHE remains a specialized tool rather than a standard metric for broad clinical quality reporting in Danish acute surgery [^src2].

## Mentions
- Page 31: "APACHE scoring" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 31-35) [^src1]
- Page 31: "Man har også vist at APACHE scoring, som er tilegnet intensivpatienter, kan benyttes præ-operativt til at forudsige mortalitets-risiko for akutte mave-tarm kirurgiske patienter." (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 31-35) [^src2]
- Page 31: "Vi har vurderet at P-POSSUM og APACHE er for omfattende til praktisk brug." (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 31-35) [^src2]

## Relationships
Incoming (this entity is the OBJECT of these relationships):
- Subject: indikator-6
  - Predicate: discusses-alternative-scores
  - Object: APACHE
  - Evidence: "Vi har vurderet at P-POSSUM og APACHE er for omfattende til praktisk brug"
  - Page: 31
  - Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 31-35 [^src1]

## Claims
- P-POSSUM og APACHE vurderes som for omfattende til praktisk brug i forbindelse med Indikator 5 [^src1] (p-possum, apache, indikator-5)
  - Type: methodological-assessment
  - Page: 31
  - Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 31-35 [^src2]

## Timeline
(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 31-35
[^src2]: AKDB_2024.pdf, pages 31-35
