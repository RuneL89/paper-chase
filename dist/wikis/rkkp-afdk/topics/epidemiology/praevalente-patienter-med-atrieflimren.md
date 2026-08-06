---
title: Prævalente patienter med atrieflimren
type: entity
aliases:
  - Prævalente patienter med atrieflimren
wiki: rkkp-afdk
updated: '2026-08-05T21:16:32.088Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 56-60
tags:
  - patient-population
---
**Prævalente patienter med atrieflimren** (prevalent patients with atrial fibrillation) is a specific patient population that serves as the denominator for Indicator 7 in the Danish clinical quality database for atrial fibrillation. This population is strictly defined as all individuals who were alive as of July 1, 2023, and had at least one registered diagnosis of atrial fibrillation in the Danish National Patient Register (Landspatientregisteret) within the preceding 10 years [^src1]. 

This demographic is central to evaluating the safety of anticoagulation therapy in Denmark. Indicator 7 specifically measures the incidence of [[alvorlig-bloedning|Alvorlig blødning]] among these prevalent patients, acting as a critical quality parameter that directly influences treatment decisions and clinical guidelines [^src1]. The evaluation relies on customized ISTH criteria to define severe bleeding, which allows for consistent comparisons across regions and time periods, while also highlighting clinical challenges such as high bleeding rates among low-risk patients (CHA2DS2-VASc score 0–1).

The management of this population primarily involves anticoagulant treatments such as [[doac|DOAC]] and [[marevan|marevan]]. During the reporting period, 2.2% of the prevalent patients with atrial fibrillation were admitted to the hospital with severe bleeding [^src1]. For broader context regarding new diagnoses, the national proportion of patients experiencing severe bleeding one year after their diagnosis date (incident patients) was 3.2%, with regional variations ranging from 2.8% to 3.8% [^src1].

## Mentions

- Page 60: "Indikator 7 opgøres for alle prævalente patienter med en atrieflimren-diagnose, dvs. alle personer, som var i live pr. 1. juli 2023, og som har fået diagnosen registeret i Landspatientregisteret mindst én gang inden for de foregående 10 år." [^src1]

## Relationships

- Subject: doac
  Predicate: is-treatment-for
  Object: (this entity)
  Evidence: "Andelen af patienter med alvorlig blødning er 2,30% for DOAC og 2,38% for marevan."
  Page: 60
  Source: [^src1]

- Subject: marevan
  Predicate: is-treatment-for
  Object: (this entity)
  Evidence: "Andelen af patienter med alvorlig blødning er 2,30% for DOAC og 2,38% for marevan."
  Page: 60
  Source: [^src1]

## Claims

- I alt blev 2,2% af de prævalente patienter med atrieflimren indlagt med alvorlig blødning i løbet af opgørelsesperioden [^src1] (praevalente-patienter-med-atrieflimren, alvorlig-bloedning)
  Type: epidemiological
  Page: 60
  Source: [^src1]

- Andelen af patienter med alvorlig blødning 1 år efter diagnosedato (incidente patienter) er på landsplan 3,2% og varierer regionalt fra 2,8-3,8% [^src1] (alvorlig-bloedning, praevalente-patienter-med-atrieflimren)
  Type: epidemiological
  Page: 60
  Source: [^src1]

## Timeline

*No timeline events recorded for this entity.*

## Sources

[^src1]: AFDK_2024.pdf, pages 56-60
