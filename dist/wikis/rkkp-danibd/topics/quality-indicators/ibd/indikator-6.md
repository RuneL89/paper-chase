---
title: Indikator 6
type: entity
aliases:
  - Indikator 6
wiki: rkkp-danibd
updated: '2026-08-05T06:20:57.655Z'
sources:
  - file: wikis/rkkp-danibd/raw/DANIBD_2023.pdf
    pages: 11-15
  - file: wikis/rkkp-danibd/raw/DANIBD_2024.pdf
    pages: '26-30, 41-45, 46-47'
tags:
  - topic
---
**Indikator 6** is a clinical quality metric administered by the [[dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme|Dansk Kvalitetsdatabase for Inflammatoriske Tarmsygdomme]] (DANIBD). It is designed to measure the rate of [[re-operation|re-operations]] occurring within 30 days following primary surgical interventions in patients with [[ibd|IBD]] (Inflammatory Bowel Disease). The primary objective of this indicator is to serve as a proxy for surgical quality, with a national target that no more than 8% of primary surgical procedures should result in a re-operation within 30 days.

To calculate this metric, Indikator 6 relies on procedure codes extracted from the [[landspatientregisteret|Landspatientregisteret]] (LPR) to identify both the primary surgical interventions and the subsequent re-operations. During the reporting period from October 1, 2022, to September 30, 2023, a total of 780 surgical interventions were performed on 722 IBD patients [^src1]. Within this cohort, there were 28 re-operations within the 30-day window, yielding a re-operation rate of 4%, which successfully meets the ≤8% quality target [^src1]. The data also reveals that the majority of these re-operations happen early, with 54% occurring within the first 7 days after the initial surgery [^src1].

The specific types of surgeries tracked under this indicator vary. For instance, [[kjfb21-laparoskopisk-ileocokal-resektion|KJFB21]] (laparoscopic ileocecal resection) was performed 114 times, accounting for 10.8% of all IBD surgical interventions [^src3]. When re-operations were necessary, [[kjah00-eksplorativ-laparotomi|KJAH00]] (explorative laparotomy) was the most frequently utilized procedure, recorded in 27 instances (27.6%) [^src3]. 

Despite its national implementation, Indikator 6 has faced scrutiny and operational challenges. An audit conducted by the [[styregruppen-for-danibd|Styregruppen for DANIBD]] highlighted uncertainties regarding the accuracy of clinical coding in the LPR related to this indicator [^src1]. Furthermore, local hospital evaluations have questioned the metric's clinical validity. [[regionshospitalet-goedstrup|Regionshospitalet Gødstrup]] conducted a journal audit reviewing 7 specific re-operation cases. While all 7 re-operations were performed due to suspected surgical complications, actual complications were only found in 3 cases, with the remaining 4 showing no signs of surgical failure [^src4]. Consequently, Regionshospitalet Gødstrup has formally criticized the re-operation rate as a poor measure of IBD treatment quality, arguing that patients may require re-operation due to the body's natural surgical stress response rather than surgical error, and noting that anastomotic leakage is a preferred quality metric in cancer surgery [^src4].

The chronological tracking of Indikator 6 is structured into specific reporting periods. The data evaluated in the 2023 annual report covered the period from October 1, 2022, to September 30, 2023 [^src1]. A subsequent counting period for surgical interventions under Indikator 6 (alongside indicators 5 and 7) commenced on October 1, 2023, and is scheduled to conclude on September 30, 2024 [^src2].

## Mentions

- Page 12: "Indikator 6. Re-operation" [^src1]
- Page 12: "Målsætningen er, at der maksimalt må være re-operation indenfor 30 dage for 8 % af de foretagne kirurgiske indgreb." [^src1]
- Page 26: "Indikator 6. Re-operation" [^src2]
- Page 44: "Appendikstabel 6. Typer af kirurgiske indgreb foretaget på patienter med IBD (indikator 6)" [^src3]
- Page 45: "Appendikstabel 7. Typer af re-operationer foretaget på patienter med IBD (indikator 6)" [^src3]
- Page 46: "Regionshospitalet Gødstrup har lavet journalaudit på indikator 6, Re-operation. I alt er 7 forløb med re-
operation gennemgået. Alle er re-opereret på mistanke om kirurgiske komplikationer. I 3 forløb fandt man
kirurgiske komplikationer, mens man i 4 forløb ikke fandt tegn på kirurgiske komplikationer.
Journalgennemgangen giver for indeværende ikke anledning til yderligere tiltag i relation til den operative
behandling af patienter med IBD i Regionshospitalet Gødstrup. Regionshospitalet Gødstrup betragter re-
operationsrate som et dårligt mål for kvaliteten, idet man kan stå med en patient som er dårlig efter en
operation, men som det kirurgiske stress-respons. Indenfor cancerkirurgi er re-operationsrate ikke et mål for
kvalitet. Det er derimod anastomoselækage." [^src4]

## Relationships

**Outgoing**
- Subject: indikator-6 | Predicate: relies-on | Object: landspatientregisteret | Evidence: "Indikator 6 anvender procedurekoder fra LPR til at definere primære indgreb og re-operationer" | Page: 14 [^src1]
- Subject: indikator-6 | Predicate: measures-rate-of | Object: re-operation | Evidence: "Indikatoren monitorerer derfor andelen af patienter, der re-opereres indenfor 30 dage." | Page: 26 [^src2]
- Subject: indikator-6 | Predicate: measures-surgery-on | Object: ibd | Evidence: "Appendikstabel 6. Typer af kirurgiske indgreb foretaget på patienter med IBD (indikator 6)" | Page: 44 [^src3]

**Incoming**
- Subject: dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme | Predicate: administers | Object: (this entity) | Evidence: "DANIBD introducerer og præsenterer Indikator 6 på side 12" | Page: 12 [^src1]
- Subject: styregruppen-for-danibd | Predicate: conducts-audit-of | Object: (this entity) | Evidence: "En audit på udvalgte afdelinger, foretaget af styregruppen, har vist usikkerhed vedrørende kodning i forbindelse med Indikator 6" | Page: 14 [^src1]
- Subject: regionshospitalet-goedstrup | Predicate: conducted-audit-of | Object: (this entity) | Evidence: "Regionshospitalet Gødstrup har lavet journalaudit på indikator 6, Re-operation." | Page: 46 [^src4]

## Claims

- Der er foretaget 780 kirurgiske indgreb i perioden svarende til 722 patienter med IBD [^src1] (indikator-6)
  Type: surgical-count
- Der er foretaget 28 re-operationer indenfor 30 dage svarende til 4 % [^src1] (indikator-6)
  Type: quality-metric
- Halvdelen af re-operationerne sker inden for de første 7 dage (54 %) [^src1] (indikator-6)
  Type: timeline-distribution
- KJFB21 (laparoskopisk ileocøkal resektion) blev foretaget 114 gange og udgjorde 10,8 % af alle kirurgiske indgreb ved IBD [^src3] (kjfb21-laparoskopisk-ileocokal-resektion, indikator-6)
  Type: procedural
- KJAH00 (eksplorativ laparotomi) var den hyppigste reoperationsprocedur med 27 forekomster (27,6 %) [^src4] (kjah00-eksplorativ-laparotomi, indikator-6)
  Type: procedural
- Regionshospitalet Gødstrup har gennemgået 7 forløb med re-operation [^src1] (regionshospitalet-goedstrup, indikator-6)
  Type: clinical
- Alle de 7 re-operationer på Regionshospitalet Gødstrup blev foretaget på mistanke om kirurgiske komplikationer [^src1] (regionshospitalet-goedstrup, indikator-6)
  Type: clinical
- I 3 af de 7 re-operationer på Regionshospitalet Gødstrup fandtes kirurgiske komplikationer [^src1] (regionshospitalet-goedstrup, indikator-6)
  Type: clinical
- I 4 af de 7 re-operationer på Regionshospitalet Gødstrup fandtes ikke tegn på kirurgiske komplikationer [^src1] (regionshospitalet-goedstrup, indikator-6)
  Type: clinical
- Regionshospitalet Gødstrup betragter re-operationsrate som et dårligt mål for kvaliteten af IBD-behandling [^src1] (regionshospitalet-goedstrup, indikator-6)
  Type: evaluative

## Timeline

- 01.10.2022 - 30.09.2023: Aktuel opgørelsesperiode for alle tre indikatorer (4, 6 og 7) (indikator-4, indikator-6, indikator-7) [^src1]
- 2023-10-01: Start af opgørelsesperioden for BMSL-behandlinger og kirurgiske indgreb i indikator 5, 6 og 7 (indikator-5, indikator-6, indikator-7) [^src2]
- 2024-09-30: Slut på opgørelsesperioden for BMSL-behandlinger og kirurgiske indgreb i indikator 5, 6 og 7 (indikator-5, indikator-6, indikator-7) [^src2]

## Sources

[^src1]: DANIBD_2023.pdf, pages 11-15
[^src2]: DANIBD_2024.pdf, pages 26-30
[^src3]: DANIBD_2024.pdf, pages 41-45
[^src4]: DANIBD_2024.pdf, pages 46-47
