---
title: SOR koder
type: entity
aliases:
  - SOR koder
  - SOR
wiki: rkkp-akdb
updated: '2026-08-15T07:52:36.386Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '16-20, 31-35'
  - file: wikis/rkkp-akdb/raw/AKDB_2025.pdf
    pages: 36-40
tags:
  - code
---
SOR codes (*SOR koder*) are a classification and coding system used within the Danish healthcare system, specifically highlighted in the context of the Acute Surgery Database (AKDB). They are proposed as a more precise alternative method for identifying and tracking patient stays in specialized care units—such as intensive care, intermediate care, or recovery beds—both before and after surgery [^src1] [^src3]. Because SOR codes can effectively distinguish these specialized beds from regular ward beds, they are considered crucial for improving the accuracy of clinical quality indicators and overcoming previous uncertainties in coding practices [^src1].

In the context of the AKDB's quality monitoring efforts, SOR codes have been formally recommended for measuring specific clinical indicators. For [[indikator-4|Indikator 4]], which focuses on preoperative optimization or direct surgery, the database recommends switching to SOR codes to determine whether a patient stayed in an intensive, intermediate, or recovery bed prior to their operation [^src1]. Furthermore, for [[indikator-6|Indikator 6]], which tracks intermediate admission and postoperative observation of high-risk patients, the AKDB has proposed using SOR codes as a replacement coding method to verify if a high-risk patient spent their first 24 postoperative hours in a department with a treatment level higher than a standard ward [^src3]. 

Looking ahead, drafts for future reports indicate that the AKDB will continue to explore the use of SOR codes to ascertain postoperative observation levels for high-risk patients [^src2]. This shift toward SOR codes reflects a broader strategic recommendation within the AKDB to standardize reporting, adjust measurement methodologies, and improve the underlying data foundation for acute surgical quality metrics [^src3].

## Mentions
- Page 16: "Vi anbefaler at man skifter til SOR koder for at afgøre, om patienten har opholdt sig på en intensiv/intermediær eller opvågningsplads inden operation." [^src1]
- Page 36: "AKDB vil afsøge muligheden for at anvendes SOR koder til at afgøre, om en højrisikopatient har været observeret de første 24 timer postoperativt på en afdeling med et behandlingsniveau svarende til en opvågningsafdeling." [^src2]
- Page 31: "SOR koder" [^src3]

## Relationships
- Subject: indikator-4
  Predicate: is-recommended-to-be-measured-via
  Object: SOR koder
  Evidence: "Vi anbefaler at man skifter til SOR koder for at afgøre, om patienten har opholdt sig på en intensiv/intermediær eller opvågningsplads inden operation"
  Page: 16
  Source: [^src1]

- Subject: indikator-6
  Predicate: proposed-replacement-code
  Object: SOR koder
  Evidence: "AKDB foreslår, at der fremadrettet anvendes SOR koder til at afgøre, om en højrisikopatient har haft ophold de første 24 timer postoperativt på en afdeling med et behandlingsniveau niveau højere end en almindelig sengeafdeling"
  Page: 31
  Source: [^src3]

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 16-20
[^src2]: AKDB_2025.pdf, pages 36-40
[^src3]: AKDB_2023.pdf, pages 31-35
