---
title: ASA
type: entity
aliases:
  - ASA
wiki: rkkp-akdb
updated: '2026-08-05T19:02:06.508Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '31-35, 76-80, 86-90'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '31-35, 56-60, 6-10, 76-80, 96-100'
tags:
  - score
---
The **ASA score** (American Society of Anesthesiologists physical status classification) is a pre-operative risk assessment tool used to evaluate how critically ill a patient is before surgery, with scores ranging from 1 (healthy) to 6 (brain dead) [^src8]. Within the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] (AKDB), the ASA score plays a critical role in identifying high-risk patients. Specifically, patients with an ASA score ≥ 3 (indicating poor health status prior to surgery) or those older than 75 are classified as high-risk [^src8]. This classification is central to the evaluation of [[indikator-6|Indikator 6]] in the 2023 report [^src1] and [[indikator-5|Indikator 5]] in the 2024 report [^src8], which measure the quality of care and intermediate admission for these vulnerable populations.

The ASA score data utilized in the AKDB reports is sourced from the [[dansk-anaestesi-database-dad|Dansk Anæstesi Database (DAD)]] [^src5]. However, this data integration presents a notable quality challenge: the DAD does not provide a specific timestamp for when the ASA score was recorded. As a result, the data is matched solely using the patients' CPR numbers, which limits the ability to confirm the exact pre-operative timing of the assessment [^src5].

To understand regional variations in patient complexity, the AKDB conducts supplementary analyses comparing the ASA scores of operated patients across Denmark's five regions: [[region-hovedstaden|Region Hovedstaden]], [[region-midtjylland|Region Midtjylland]], [[region-nordjylland|Region Nordjylland]], [[region-sjaelland|Region Sjælland]], and [[region-syddanmark|Region Syddanmark]] [^src2] [^src7]. Boxplot visualizations covering multiple annual periods reveal that the pre-operative health status of the patient population is broadly uniform across the country. The reports conclude that there are no significant regional differences in the ASA scores of the operated patients [^src2] [^src7].

The tracking of the ASA score in the database spans several distinct registration and reporting periods. Registration periods ran consecutively from September 1, 2020, through August 31, 2023 [^src2]. Subsequent analytical reporting periods covered September 1, 2021, to August 31, 2022; September 1, 2022, to August 31, 2023; and September 1, 2023, to August 31, 2024, providing a multi-year perspective on surgical risk profiles in Danish emergency surgery [^src7].

## Mentions

- Page 31: "ASA ≥ 3" [^src1]
- Page 76: "Supplerende opgørelse af ASA-score for opererede, boxplot" [^src2]
- Page 86: "ASA-score*" [^src3]
- Page 6: "svært syge (ASA >= 3)" [^src4]
- Page 31: "Bemærk, at ASA-scoren er indhentet fra Dansk Anæstesi Database, hvor man ikke har en tidsangivelse for scoren. Der er således alene matchet på CPR-nummer." [^src5]
- Page 56: "Supplerende opgørelser" [^src6]
- Page 76: "Supplerende opgørelse af ASA-score for opererede, boxplot" [^src7]
- Page 96: "ASA-score* ≥ 3 (dvs. lav helbredsstatus før operationen)" [^src8]
- Page 96: "* ASA-score er en angivelse af, hvor kritisk syg en patient er. Scoren går fra 1 (rask) til 6 (hjernedød)." [^src8]

## Relationships

**Outgoing**
- **Subject:** asa-score | **Predicate:** is-analyzed-in | **Object:** akut-kirurgi-databasen
  - **Evidence:** "Supplerende opgørelse af ASA-score for opererede, boxplot" (Page 76) [^src2]
- **Subject:** asa-score | **Predicate:** is-compared-across | **Object:** region-hovedstaden
  - **Evidence:** "Hovedstaden Midtjylland Nordjylland Sjælland Syddanmark" (Page 76) [^src2]
- **Subject:** asa-score | **Predicate:** is-compared-across | **Object:** region-midtjylland
  - **Evidence:** "Hovedstaden Midtjylland Nordjylland Sjælland Syddanmark" (Page 76) [^src2]
- **Subject:** asa-score | **Predicate:** is-compared-across | **Object:** region-nordjylland
  - **Evidence:** "Hovedstaden Midtjylland Nordjylland Sjælland Syddanmark" (Page 76) [^src2]
- **Subject:** asa-score | **Predicate:** is-compared-across | **Object:** region-sjaelland
  - **Evidence:** "Hovedstaden Midtjylland Nordjylland Sjælland Syddanmark" (Page 76) [^src2]
- **Subject:** asa-score | **Predicate:** is-compared-across | **Object:** region-syddanmark
  - **Evidence:** "Hovedstaden Midtjylland Nordjylland Sjælland Syddanmark" (Page 76) [^src2]
- **Subject:** asa-score | **Predicate:** is-measured-in | **Object:** akut-kirurgi-databasen
  - **Evidence:** "Supplerende opgørelse af ASA-score for opererede" (Page 76) [^src7]

**Incoming**
- **Subject:** indikator-6 | **Predicate:** relies-on | **Object:** asa-score
  - **Evidence:** "Indikator 6 beskriver andelen af patienter, der får vurderet postoperativ risiko høj (ASA ≥ 3) eller har høj alder (alder ≥ 75 år)" (Page 31) [^src1]
- **Subject:** dansk-anaestesi-database-dad | **Predicate:** provides-source-for | **Object:** asa-score
  - **Evidence:** "Bemærk, at ASA-scoren er indhentet fra Dansk Anæstesi Database, hvor man ikke har en tidsangivelse for scoren." (Page 31) [^src5]
- **Subject:** indikator-5 | **Predicate:** uses-criteria | **Object:** asa-score
  - **Evidence:** "Vi har valgt at klassificere personer med ASA-score* ≥ 3 (dvs. lav helbredsstatus før operationen) eller som er > 75 år gamle, som personer i høj risiko." (Page 96) [^src8]

## Claims

**Conclusion**
- Denne supplerende opgørelse viser, at ASA-scoren for de opererede ikke er væsentligt forskellig regionerne imellem [^src1] (asa-score, region-hovedstaden, region-midtjylland, region-nordjylland, region-sjaelland, region-syddanmark) [^src2]

**Definition**
- Indikator 6: Patienter med ASA-score ≥ 3 eller > 75 år klassificeres som personer i høj risiko [^src1] (akut-kirurgi-databasen, asa-score) [^src3]

**Interpretive**
- Denne supplerende opgørelse viser, at ASA-scoren for de opererede ikke er væsentligt forskellig regionerne imellem [^src1] (asa-score, region-hovedstaden, region-midtjylland, region-nordjylland, region-sjaelland, region-syddanmark) [^src7]

## Timeline

- **01/09/2020**: Start af første registreringsperiode for ASA-score: 01/09/2020 - 31/08/2021 [^src2]
- **31/08/2021**: Slut på første registreringsperiode for ASA-score: 01/09/2020 - 31/08/2021 [^src2]
- **01/09/2021**: Start af anden registreringsperiode for ASA-score: 01/09/2021 - 31/08/2022 [^src2]
- **2021-09-01**: Startdato for den første rapporterede periode for ASA-score-analyse: 01/09/2021 - 31/08/2022 [^src7]
- **31/08/2022**: Slut på anden registreringsperiode for ASA-score: 01/09/2021 - 31/08/2022 [^src2]
- **01/09/2022**: Start af tredje registreringsperiode for ASA-score: 01/09/2022 - 31/08/2023 [^src2]
- **2022-09-01**: Startdato for den anden rapporterede periode for ASA-score-analyse: 01/09/2022 - 31/08/2023 [^src7]
- **31/08/2023**: Slut på tredje registreringsperiode for ASA-score: 01/09/2022 - 31/08/2023 [^src2]
- **2023-09-01**: Startdato for den tredje rapporterede periode for ASA-score-analyse: 01/09/2023 - 31/08/2024 [^src7]

## Sources

[^src1]: AKDB_2023.pdf, pages 31-35
[^src2]: AKDB_2023.pdf, pages 76-80
[^src3]: AKDB_2023.pdf, pages 86-90
[^src4]: AKDB_2024.pdf, pages 6-10
[^src5]: AKDB_2024.pdf, pages 31-35
[^src6]: AKDB_2024.pdf, pages 56-60
[^src7]: AKDB_2024.pdf, pages 76-80
[^src8]: AKDB_2024.pdf, pages 96-100
