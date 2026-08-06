---
title: SKS-koder
type: entity
wiki: rkkp-afdk
updated: '2026-08-05T20:15:36.482Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 76-80
tags:
  - coding-system
---

# SKS-koder

**SKS-koder** (Sundhedsvæsenets Klassifikations System codes) refers to the classification and coding system used within the Danish healthcare system to register specific clinical, administrative, and educational activities. In the context of the Danish Atrial Fibrillation Database (AFDK) and the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP), specific SKS codes are critical for measuring the quality of care and patient education provided to newly diagnosed atrial fibrillation patients.

Historically, structured patient education—a key quality metric tracked under [[indikator-8|Indikator 8]]—was defined by the registration of any of four specific SKS codes in the Danish National Patient Register (Landspatientregisteret). These codes were BFKB (patient education in atrial fibrillation and flutter), BQF* (preventive consultations and special preventive interventions), BVDS (treatment in school), and BVDY* (pedagogical actions not classified elsewhere) [^src1]. 

A significant policy change regarding this coding system took effect on January 1, 2023. From this date forward, the calculation rules for [[indikator-8|Indikator 8]] were narrowed so that only the BFKB code is used to define and measure structured patient education [^src1]. As a result, the AFDK annual report covering the period from July 1, 2022, to June 30, 2023, serves as the final report to include the broader historical set of codes (BQF*, BVDS, and BVDY*) in its calculations before the stricter BFKB-only rule fully applies [^src1]. This coding transition occurs during a period where the database has documented a systemic failure to meet the national standard of 50% for patient education, with indicator values showing no improvement since 2018–2019, prompting strategic improvement initiatives from both professional and patient representative stakeholders.

## Mentions

- Page 79: "Information omkring patienters deltagelse i et struktureret undervisningsprogram indhentes fra Landspatientregisteret og defineres som indberetning af en af følgende SKS-koder: BFKB (Patientuddannelse i atrieflimren og atrieflagren), BQF* (Forebyggelsessamtaler og særlige forebyggelses-interventioner), BVDS (Behandling i skole) eller BVDY* (pædagogiske handlinger ikke klassificeret andetsteds)." [^src1]

## Relationships

- **Subject:** indikator-8
  **Predicate:** defined-by
  **Object:** SKS-koder
  **Evidence:** "defineres som indberetning af en af følgende SKS-koder: BFKB (Patientuddannelse i atrieflimren og atrieflagren), BQF* (Forebyggelsessamtaler og særlige forebyggelses-interventioner), BVDS (Behandling i skole) eller BVDY* (pædagogiske handlinger ikke klassificeret andetsteds)"
  **Page:** 79
  **Source:** [^src1]

## Claims

- **policy-change:** Fra og med 1.1.2023 er det alene SKS-koden BFKB der anvendes og denne årsrapport er således den sidste hvor de øvrige indgår i beregningen[^src1] (indikator-8, sks-koder) [^src1]

## Timeline

- **2023-01-01:** Ændring i beregningsregler for Indikator 8: Kun SKS-koden BFKB anvendes fra denne dato (indikator-8, sks-koder) [^src1]

## Sources

[^src1]: AFDK_2023.pdf, pages 76-80
