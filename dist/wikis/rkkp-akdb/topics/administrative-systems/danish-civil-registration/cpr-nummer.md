---
title: CPR-nummer
type: entity
wiki: rkkp-akdb
updated: '2026-08-05T19:12:27.984Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: 66-70
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '31-35, 56-60, 66-70'
tags:
  - administrative-system
---
The **CPR-nummer** is the Danish personal identification number, serving as the foundational administrative system for unique patient identification across the national healthcare system. Within the context of the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] (AKDB), the CPR-nummer is critical for maintaining data quality and ensuring accurate tracking of patient outcomes, such as 30-day and 90-day mortality following acute surgery [^src1], [^src4]. The database, managed under the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP), relies heavily on this identifier to link patient records, evaluate clinical quality indicators, and perform risk adjustments using tools like the [[charlson-comorbiditets-indeks|Charlson Comorbiditets indeks]] [^src1], [^src4].

Because the CPR-nummer is the primary key for matching and validating patient data, invalid or inactive numbers represent one of the most significant reasons for patient exclusion from the database's indicator analyses [^src1], [^src2], [^src4]. For instance, in the 2023 reporting period, 53 patients were excluded specifically due to an invalid CPR number, alongside other exclusion criteria such as age under 18, lack of surgery, or specific inactive statuses in the civil registry [^src1]. In the 2024 report, matching for certain indicators was performed exclusively using the CPR-nummer, and invalid numbers continued to be a primary cause for exclusion, with 75 patients excluded for this reason in one of the analyses [^src2], [^src4]. 

The rigorous exclusion of patients with invalid, inactive, or tax-only CPR numbers (e.g., those without a registered Danish or Greenlandic address but assigned a number for tax purposes) underscores the database's systematic effort to ensure comparable and clinically relevant quality measurements [^src1]. By strictly filtering the patient population based on valid CPR-nummer records, the AKDB ensures that its supplementary calculations and regional comparisons remain statistically sound and methodologically robust [^src3], [^src4].

## Mentions
- Page 66: "Ugyldigt CPRnummer." [^src1]
- Page 31: "Der er således alene matchet på CPR-nummer." [^src2]
- Page 31: "Eksklusion: 75 Ugyldigt CPRnummer." [^src2]
- Page 56: "Supplerende opgørelser" [^src3]
- Page 66: "75 Ugyldigt CPRnummer." [^src4]

## Relationships
- **Subject:** cpr-nummer | **Predicate:** is-used-for-patient-identification-in | **Object:** akut-kirurgi-databasen
  - **Evidence:** "75 Ugyldigt CPRnummer."
  - **Page:** 66
  - **Source:** [^src4]

## Claims
- **exclusion-criteria:** Eksklusion: 53 Ugyldigt CPRnummer. 172 Patienten er under 18 år. 6.186 Patienten er ikke opereret. 5 Patienten er registreret i CPR-registeret som 'Inaktiv, uden bopæl i dansk/grønlandsk folkeregister men tildelt personnummer af skattehensyn (kommunekoderne 0010, 0011, 0012 og 0019)'. 473 Operationen er ikke den første operation i hospitalsopholdet. 2.395 Patientens Charlson Comorbiditets indeks = 0 eller > 2 [^src1] (cpr-nummer, charlson-comorbiditets-indeks)

## Timeline
*(No timeline events recorded for this entity.)*

## Sources

[^src1]: AKDB_2023.pdf, pages 66-70
[^src2]: AKDB_2024.pdf, pages 31-35
[^src3]: AKDB_2024.pdf, pages 56-60
[^src4]: AKDB_2024.pdf, pages 66-70
