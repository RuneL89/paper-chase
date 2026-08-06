---
title: Charlson Score
type: entity
aliases:
  - Charlson Score
wiki: rkkp-akdb
updated: '2026-08-05T19:13:15.744Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: 71-75
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '101-105, 56-60'
tags:
  - topic
---
The **Charlson Score** is a standardized comorbidity assessment tool utilized within the Danish Acute Surgery Database (AKDB) to evaluate patient risk profiles and adjust national quality indicators. In the context of acute surgical care, a Charlson Score of ≥ 3 identifies patients with high registered comorbidity [^src1]. This threshold serves as the inclusion criterion for the supplementary indicator to [[indikator-10c|Indikator 10c]], which specifically measures the proportion of high-comorbidity patients who die within 30 days of their operation [^src1]. 

Beyond its role in defining specific indicator populations, the Charlson Score is central to broader methodological adjustments within the database. It is intended to be used for the risk adjustment of [[indikator-10|Indikator 10]] (and Indikator 11), enabling mortality metrics to be stratified into distinct comorbidity groups: 0, 1–2, and ≥ 3 [^src2]. To calculate the score, diagnoses are retrieved from a 10-year historical lookback period [^src1].

Despite its structural importance, the practical application and data integrity of the Charlson Score have been subject to clinical scrutiny. [[regionshospital-nordjylland|Regionshospital Nordjylland]] conducted an audit of the score's application and identified significant data quality issues. The hospital found that the assigned scores did not align with clinical reality; notably, none of the patients classified in the "score 0" population actually qualified for a zero score, as all were of advanced age. The hospital further criticized the opaque sourcing of the background variables used to calculate the score, concluding that these data limitations make it difficult to fully rely on or apply the Charlson Score for local quality development [^src3].

## Mentions
- Page 71: "Supplerende indikator til Indikator 10c beskriver andelen af patienter, der dør indenfor 30 dage fra tidspunkt for operation, for patienter med Charlson Score ≥ 3, svarende til høj registreret komorbiditet." [^src1]
- Page 56: "Supplerende opgørelser" [^src2]
- Page 101: "I relation til Indikator 9: Andel af patienter der dør indenfor 30 dage, er der supplerende opgørelse på Charleson score. Her har man på begge hospitalet auditeret på patienterne. Der findes at Charlescon scorer ikke passer, der er således ingen af patienter i score 0 populationen der burde være score 0, idet de alle har høj alder, men idet det er uklaart hvor baggrundsvariabler til udregning er hentet fra er det ikke muligt helt at anvende data." [^src3]

## Relationships
**Outgoing**
- Subject: charlson-score | Predicate: defines-inclusion-criteria-for | Object: indikator-10c
  Evidence: "Supplerende indikator til Indikator 10c beskriver andelen af patienter, der dør indenfor 30 dage fra tidspunkt for operation, for patienter med Charlson Score ≥ 3"
  Page: 71 [^src1]
- Subject: charlson-score | Predicate: is-used-for-risk-adjustment-of | Object: indikator-10
  Evidence: "Charlson Scoren ønskes indført, sådan at mortalitetsindikatorerne (Indikator 10, 11 og supplerende til indikator 10 og 11) kan opdeles baseret på komorbiditet i grupperne 0, 1 -2 og ≥ 3."
  Page: 56 [^src2]

**Incoming**
- Subject: regionshospital-nordjylland | Predicate: criticizes | Object: charlson-score
  Evidence: "Der findes at Charlescon scorer ikke passer, der er således ingen af patienter i score 0 populationen der burde være score 0, idet de alle har høj alder, men idet det er uklaart hvor baggrundsvariabler til udregning er hentet fra er det ikke muligt helt at anvende data."
  Page: 101 [^src3]

## Claims
- Supplerende indikator til Indikator 10c beskriver andelen af patienter, der dør indenfor 30 dage fra tidspunkt for operation, for patienter med Charlson Score ≥ 3, svarende til høj registreret komorbiditet [^src1]
  Type: clinical | Page: 71
- Diagnoser til brug i beregning af Charlson Score er hentet 10 år tilbage i tid [^src1]
  Type: methodological | Page: 71
- Regionshospital Nordjylland har identificeret, at ingen af patienterne i 'score 0'-populationen for Charlson-score faktisk opfylder kriterierne, idet de alle har høj alder [^src1]
  Type: clinical-assessment | Page: 101

## Timeline
(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 71-75
[^src2]: AKDB_2024.pdf, pages 56-60
[^src3]: AKDB_2024.pdf, pages 101-105
