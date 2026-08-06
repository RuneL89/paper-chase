---
title: Surgical Apgar Score
type: entity
aliases:
  - Surgical Apgar Score
wiki: rkkp-akdb
updated: '2026-08-05T19:03:32.601Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: 31-35
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: 31-35
tags:
  - score
---

The **Surgical Apgar Score** is a simple intraoperative scoring system used to assess patient risk during acute surgery. However, within the context of the Danish Acute Surgery Database (AKDB), the score has faced methodological criticism regarding its ability to capture all high-risk patients. According to AKDB evaluations, the Surgical Apgar Score relies exclusively on intraoperative observations [^src2]. Because of this narrow focus, database administrators assess that the score is incapable of identifying risk patients who do not exhibit physiological stress during the perioperative period [^src1]. Consequently, it is argued that the score excludes certain high-risk patients from necessary postoperative monitoring [^src1].

Due to these limitations, the AKDB recommends alternative, more inclusive criteria for identifying patients who require extended postoperative observation. Specifically, it is recommended that patients older than 75 years or with an ASA score of 3 or higher should be observed for the first 24 hours after surgery in an intensive care, intermediate care, or recovery unit [^src2]. This discussion forms part of the broader evaluation of clinical quality indicators, such as [[indikator-5|Indikator 5]] and [[indikator-6|Indikator 6]], which aim to standardize and improve the care of high-risk acute surgery patients across Danish regions.

## Mentions

- Page 31: "Surgical Apgar Score" [^src1]
- Page 31: "Surgical Apgar Score tager kun udgangspunkt i inter-operative observationer." [^src2]
- Page 31: "Derfor anbefales det, at patienter, der er ældre end 75 år eller ASA 3 bør observeres de første 24 timer efter operation på et intensiv, intermediær- eller opvågningsafsnit." [^src2]

## Relationships

- Subject: indikator-6
  Predicate: discusses-alternative-scores
  Object: Surgical Apgar Score
  Evidence: "I forhold til surgical apgar score mener vi, at denne ekskluderer risikopatienter, der ikke er fysiologisk stressede peroperativt"
  Page: 31
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 31-35 [^src1]

## Claims

- Surgical Apgar Score ekskluderer risikopatienter, der ikke er fysiologisk stressede peroperativt [^src1] (surgical-apgar-score, indikator-5)
  Type: methodological-assessment
  Page: 31
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 31-35

## Timeline

(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 31-35
[^src2]: AKDB_2024.pdf, pages 31-35
