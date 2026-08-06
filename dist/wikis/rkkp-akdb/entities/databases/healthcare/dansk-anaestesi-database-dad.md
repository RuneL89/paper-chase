---
title: Dansk Anæstesi Database (DAD)
type: entity
aliases:
  - Dansk Anæstesi Database (DAD)
wiki: rkkp-akdb
updated: '2026-08-05T19:15:32.401Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: 81-85
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '31-35, 46-50, 86-90'
tags:
  - database
---
Dansk Anæstesi Database (DAD) is a national clinical database in Denmark that serves as a critical external data source for healthcare quality measurement, specifically within the realm of acute surgery. It is one of the supplementary registries integrated into the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] (AKDB), alongside other national registers such as the [[sygehusmedicinregisteret|Sygehusmedicinregisteret]] [^src1] [^src4]. The reliance on DAD highlights the cross-sectoral and multi-register approach of the Danish healthcare system's quality development programs, which combine data from various sources to ensure standardized, reliable, and ethically responsible monitoring of real-world clinical practices.

Within the AKDB framework, DAD provides specific clinical data points that are essential for evaluating surgical and anesthesiological care. Notably, DAD is the source for the [[asa-score|ASA]] (American Society of Anesthesiologists physical status classification), a key metric for assessing patient risk. However, because DAD does not record a specific timestamp for when the ASA score was assigned, the AKDB integrates this data by matching records solely on the patient's CPR number [^src2]. 

Additionally, DAD supplies detailed data regarding the administration of epidural anesthesia, categorizing it into cervical, thoracic, lumbar, sacral, and spinal types [^src3]. This specific dataset is foundational for calculating [[indikator-8|Indikator 8]], which measures the proportion of acute surgical patients who receive an epidural [^src3]. By feeding these specialized anesthesiological data points into the broader acute surgery database, DAD enables comprehensive evaluations of treatment standards, regional variations, and overall care quality for high-risk and acute abdominal surgery patients across Denmark.

## Mentions
- Page 81: "Dansk Anæstesi Database (DAD)" [^src1]
- Page 31: "Bemærk, at ASA-scoren er indhentet fra Dansk Anæstesi Database, hvor man ikke har en tidsangivelse for scoren." [^src2]
- Page 46: "Data om epidural stammer fra Dansk Anæstesi Database, og inkluderer følgende typer af epidural: Cervical, thoracal, lumbal, sarkral, spinal." [^src3]
- Page 86: "Dansk Anæstesi Database (DAD)" [^src4]

## Relationships
**Outgoing (this entity is the SUBJECT of these relationships):**
- **Subject:** dansk-anaestesi-database-dad | **Predicate:** provides-source-for | **Object:** asa-score
  **Evidence:** "Bemærk, at ASA-scoren er indhentet fra Dansk Anæstesi Database, hvor man ikke har en tidsangivelse for scoren."
  **Page:** 31 [^src2]

**Incoming (this entity is the OBJECT of these relationships):**
- **Subject:** akut-kirurgi-databasen | **Predicate:** uses-data-from | **Object:** dansk-anaestesi-database-dad
  **Evidence:** "De øvrige datakilder er
- Den Nationale Labdatabank (DNL)
- Dansk Anæstesi Database (DAD)
- Sygehusmedicinregisteret (SMR)"
  **Page:** 81 [^src1]
- **Subject:** akut-kirurgi-databasen | **Predicate:** integrates-with | **Object:** dansk-anaestesi-database-dad
  **Evidence:** "Bemærk, at ASA-scoren er indhentet fra Dansk Anæstesi Database, hvor man ikke har en tidsangivelse for scoren. Der er således alene matchet på CPR-nummer."
  **Page:** 31 [^src2]
- **Subject:** indikator-8 | **Predicate:** relies-on-data-from | **Object:** dansk-anaestesi-database-dad
  **Evidence:** "Data om epidural stammer fra Dansk Anæstesi Database"
  **Page:** 46 [^src3]
- **Subject:** akut-kirurgi-databasen | **Predicate:** uses-data-from | **Object:** dansk-anaestesi-database-dad
  **Evidence:** "De øvrige datakilder er
- Den Nationale Labdatabank (DNL)
- Dansk Anæstesi Database (DAD)
- Sygehusmedicinregisteret (SMR)"
  **Page:** 86 [^src4]

## Claims
- **data-source:** Databasen benytter også data fra Dansk Anæstesi Database (DAD) og Sygehusmedicinregisteret (SMR) [^src1] (akut-kirurgi-databasen, dansk-anaestesi-database-dad, sygehusmedicinregisteret)

## Timeline
(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 81-85
[^src2]: AKDB_2024.pdf, pages 31-35
[^src3]: AKDB_2024.pdf, pages 46-50
[^src4]: AKDB_2024.pdf, pages 86-90
