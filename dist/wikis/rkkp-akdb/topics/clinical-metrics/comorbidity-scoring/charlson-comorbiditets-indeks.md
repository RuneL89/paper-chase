---
title: Charlson Comorbiditets indeks
type: entity
aliases:
  - Charlson Comorbiditets indeks
wiki: rkkp-akdb
updated: '2026-08-05T19:12:01.918Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: 66-70
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '31-35, 66-70'
tags:
  - medical-concept
---
# Charlson Comorbiditets indeks

The **Charlson Comorbiditets indeks** (Charlson Comorbidity Index) is a standardized prognostic scale used to quantify the comorbidity burden in patients. Within the Danish Acute Surgery Database (AKDB) and the Regions' Clinical Quality Development Programme (RKKP), it serves as a central tool to adjust for patients' pre-existing disease burden and stratify patient groups according to their risk of 30-day mortality following acute surgery [^src1] [^src3]. It is frequently evaluated alongside other clinical risk scoring models—such as the ASA score, P-POSSUM, APACHE, and the Surgical Apgar score—highlighting the ongoing effort to balance evidence-based medicine with practical implementability in everyday clinical settings [^src2].

The index is fundamentally integrated into the database's quality measurement framework, specifically in the definition of several supplementary clinical quality indicators. It is used to define the patient populations for [[indikator-10b|Indikator 10b]] and [[indikator-9b|Indikator 9b]], which track 30-day mortality for patients with a Charlson Score of 1 or 2 [^src1] [^src3]. Similarly, it defines the higher-risk cohorts for [[indikator-10c|Indikator 10c]] and [[indikator-9c|Indikator 9c]], which measure 30-day mortality for patients with a Charlson Score ≥ 3 [^src1] [^src3]. 

Beyond its use in stratifying target populations, the Charlson Comorbiditets indeks is strictly applied as an exclusion criterion for specific indicator calculations. For example, patients presenting a Charlson score of 0 or > 2 are excluded from the cohorts for indicators 10b and 10c [^src1]. In the 2024 reporting period, a total of 2,468 patients were excluded from the dataset specifically due to having a Charlson Comorbiditets indeks of 0 or > 2 [^src3]. Other general exclusion criteria applied alongside the Charlson score include an invalid [[cpr-nummer|CPR-nummer]], patient age under 18, or the surgery not being the first operation during the hospital stay [^src1].

## Mentions

- Page 66: "Charlson Comorbiditets indeks = 0 eller > 2" [^src1]
- Page 31: "Præ-operative scoringer som f.eks. ASA score og Charlson Comorbidity index tager udgangspunkt i risikofaktorer, der var til stede ved indlæggelse." [^src2]
- Page 66: "Patientens Charlson Comorbiditets indeks = 0 eller > 2" [^src3]

## Relationships

### Outgoing
- **Subject:** charlson-comorbiditets-indeks
  **Predicate:** is-used-in-definition-of
  **Object:** indikator-10b
  **Evidence:** "Supplerende indikator til indikator 10b: Mortalitet indenfor 30 dage efter akut kirurgi, Charlson Score = 1 eller 2"
  **Page:** 66
  **Source:** wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 66-70 [^src1]

- **Subject:** charlson-comorbiditets-indeks
  **Predicate:** is-used-in-definition-of
  **Object:** indikator-10c
  **Evidence:** "Supplerende indikator til 10c: Mortalitet indenfor 30 dage efter akut kirurgi, hvis Charlson Score ≥ 3"
  **Page:** 66
  **Source:** wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 66-70 [^src1]

### Incoming
- **Subject:** indikator-9b
  **Predicate:** has-supplementary-indicator-for
  **Object:** charlson-comorbiditets-indeks
  **Evidence:** "Supplerende indikator til indikator 9b: Mortalitet indenfor 30 dage efter akut kirurgi, Charlson Score = 1 eller 2"
  **Page:** 66
  **Source:** wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 66-70 [^src3]

- **Subject:** indikator-9c
  **Predicate:** has-supplementary-indicator-for
  **Object:** charlson-comorbiditets-indeks
  **Evidence:** "Supplerende indikator til 9c: Mortalitet indenfor 30 dage efter akut kirurgi, hvis Charlson Score ≥ 3"
  **Page:** 66
  **Source:** wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 66-70 [^src3]

## Claims

- Supplerende indikator til indikator 10c beskriver andelen af patienter, der dør indenfor 30 dage fra operationsdato for alle opererede (med relevant diagnosekode og procedurekode), og som har Charlson Score ≥ 3 [^src1] (indikator-10c, charlson-comorbiditets-indeks)
  - **Type:** definition
  - **Page:** 66
  - **Source:** wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 66-70 [^src1]

- Eksklusion: 53 Ugyldigt CPRnummer. 172 Patienten er under 18 år. 6.186 Patienten er ikke opereret. 5 Patienten er registreret i CPR-registeret som 'Inaktiv, uden bopæl i dansk/grønlandsk folkeregister men tildelt personnummer af skattehensyn (kommunekoderne 0010, 0011, 0012 og 0019)'. 473 Operationen er ikke den første operation i hospitalsopholdet. 2.395 Patientens Charlson Comorbiditets indeks = 0 eller > 2 [^src1] (cpr-nummer, charlson-comorbiditets-indeks)
  - **Type:** exclusion-criteria
  - **Page:** 66
  - **Source:** wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 66-70 [^src1]

- I alt blev der ekskluderet 2.468 patienter på grund af Charlson Comorbiditets indeks = 0 eller > 2 [^src1] (charlson-comorbiditets-indeks)
  - **Type:** exclusion-statistic
  - **Page:** 66
  - **Source:** wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 66-70 [^src3]

## Timeline

No timeline events available.

## Sources

[^src1]: AKDB_2023.pdf, pages 66-70
[^src2]: AKDB_2024.pdf, pages 31-35
[^src3]: AKDB_2024.pdf, pages 66-70
