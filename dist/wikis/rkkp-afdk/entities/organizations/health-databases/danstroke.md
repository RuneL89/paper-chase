---
title: DanStroke
type: entity
wiki: rkkp-afdk
updated: '2026-08-05T20:09:32.388Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '56-60, 91-95'
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 46-50
tags:
  - organization
---
DanStroke is a former clinical database in [[danmark|Denmark]] that was historically used to register and track stroke (apoplexy) cases. It played a key role in national clinical quality assurance, particularly for monitoring complications related to atrial fibrillation. Specifically, it served as a primary data source for [[indikator-5|Indicator 5]], which measures the incidence of ischemic stroke as an indicator of insufficient anticoagulation therapy.

During the 2022–2023 reporting period, the Danish healthcare system transitioned away from using DanStroke for official quality indicators. For the calculation of Indicator 5, DanStroke was officially replaced by data from the National Patient Registry (LPR) [^src1]. This methodological shift was necessitated by severe reporting deficiencies within DanStroke [^src1]. The missing registrations of stroke cases were caused by a combination of the database's transition to a new reporting model and the simultaneous migration of certain regions to new Electronic Patient Record (EPJ) systems [^src1] [^src3]. Consequently, subsequent reports, including the 2024 annual report, continue to exclude DanStroke in favor of LPR data to ensure reliable regional and national benchmarking [^src3].

Although excluded from the primary indicator calculations in recent years, DanStroke data is still referenced in the corpus for specific analyses. For example, alternative dataset calculations based on DanStroke recorded the national proportion of atrial fibrillation patients suffering an ischemic stroke between July 1, 2022, and June 30, 2023, at 0.6% (95% CI: 0.5–0.6) [^src2].

## Mentions
- Page 58: "I modsætning til tidligere er indikatoren i år opgjort på baggrund af data om akut apopleksi fra LPR frem for
databasen DanStroke. Det skyldes, at DanStroke har været ramt af manglende indberetninger af
apopleksitilfælde grundet overgangen til en ny indberetningsmodel i databasen samt enkelt regioners
omlægning til nyt EPJ system." [^src1]
- Page 93: "Indikator 5 baseret på DanStroke" [^src2]
- Page 48: "Indikatoren er opgjort på baggrund af data om akut apopleksi fra LPR frem for databasen DanStroke." [^src3]
- Page 48: "Det skyldes, at DanStroke har været ramt af manglende indberetninger af apopleksitilfælde grundet overgangen til en ny
indberetningsmodel i databasen samt enkelt regioners omlægning til nyt EPJ system." [^src3]

## Relationships
- Subject: indikator-5
  Predicate: replaces-data-source
  Object: (this entity)
  Evidence: "Det skyldes, at DanStroke har været ramt af manglende indberetninger af apopleksitilfælde grundet overgangen til en ny indberetningsmodel i databasen samt enkelt regioners omlægning til nyt EPJ system."
  Page: 58
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 56-60 [^src1]
- Subject: indikator-5
  Predicate: has-alternative-dataset
  Object: (this entity)
  Evidence: "Indikator 5 baseret på DanStroke"
  Page: 93
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 91-95 [^src2]
- Subject: indikator-5
  Predicate: excludes
  Object: (this entity)
  Evidence: "Indikatoren er opgjort på baggrund af data om akut apopleksi fra LPR frem for databasen DanStroke."
  Page: 48
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 46-50 [^src3]

## Claims
- Den nationale andel af atrieflimren-patienter med iskæmisk apopleksi i perioden 01.07.2022–30.06.2023 var 0,6 % (95 % CI: 0,5–0,6) ifølge DanStroke-data [^src1] (danmark, danstroke, indikator-5)
  Type: clinical
  Page: 93
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 91-95

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 56-60
[^src2]: AFDK_2023.pdf, pages 91-95
[^src3]: AFDK_2024.pdf, pages 46-50
