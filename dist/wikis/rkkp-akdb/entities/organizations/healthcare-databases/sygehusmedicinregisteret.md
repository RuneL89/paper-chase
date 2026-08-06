---
title: Sygehusmedicinregisteret
type: entity
aliases:
  - Sygehusmedicinregisteret (SMR)
wiki: rkkp-akdb
updated: '2026-08-05T18:58:18.497Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '11-15, 81-85, 91-95'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: 86-90
tags:
  - organization
---
Sygehusmedicinregisteret (SMR) is a national Danish healthcare register that serves as a critical data source for clinical quality databases, most notably the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] (AKDB) [^src2]. Established in 2018, it is a relatively new register that had not been previously utilized by these clinical databases prior to its integration [^src4].

Within the AKDB framework, Sygehusmedicinregisteret is the primary source for antibiotic data [^src1]. Specifically, it provides the necessary information on antibiotic treatments to calculate [[indikator-1|Indikator 1]], which measures whether patients receive antibiotic treatment within three hours [^src1], [^src4]. Alongside other registers like the [[dansk-anaestesi-database-dad|Dansk Anæstesi Database (DAD)]] and the National Labdatabank (DNL), SMR forms the backbone of the supplementary data sources used to evaluate treatment quality for acute abdominal surgical patients [^src2], [^src3].

The integration and technical maturation of SMR have been ongoing. A new registration guideline for the register was published on July 1, 2022 [^src4]. Furthermore, technical improvements are continuously being implemented; for instance, a solution designed to automatically send the suspension time (*ophængningstidspunktet*) of antibiotics to SMR was expected to become operational in the summer of 2023 [^src4]. Despite its utility, regional comments have occasionally pointed out technical errors and coding challenges within the registration systems, including SMR, highlighting the operational limitations that the database must navigate to ensure accurate clinical quality measurement [^src4].

## Mentions

- Page 11: "Indikatoren afhænger af data i Sygehusmedicinregisteret, hvorfra AKDB henter informationer om antibiotika." [^src1]
- Page 86: "Sygehusmedicinregisteret (SMR)" [^src2]
- Page 81: "Sygehusmedicinregisteret (SMR)" [^src3]
- Page 94: "Antibiotikabehandling indenfor 3 timer er baseret på data fra Sygehusmedicinregisteret (SMR). SMR er et relativt nyt register, der blev etableret i 2018 og ikke tidligere er blevet brugt af databaserne." [^src4]

## Relationships

**Outgoing**
- **Subject:** sygehusmedicinregisteret | **Predicate:** supports-indicator | **Object:** akut-kirurgi-databasen
  - **Evidence:** "Antibiotikabehandling indenfor 3 timer er baseret på data fra Sygehusmedicinregisteret (SMR)" [^src4]

**Incoming**
- **Subject:** indikator-1 | **Predicate:** depends-on-data-from | **Object:** sygehusmedicinregisteret
  - **Evidence:** "Indikatoren afhænger af data i Sygehusmedicinregisteret, hvorfra AKDB henter informationer om antibiotika." [^src1]
- **Subject:** akut-kirurgi-databasen | **Predicate:** uses-data-from | **Object:** sygehusmedicinregisteret
  - **Evidence:** 
De øvrige datakilder er
- Den Nationale Labdatabank (DNL)
- Dansk Anæstesi Database (DAD)
- Sygehusmedicinregisteret (SMR)
[^src2]
- **Subject:** akut-kirurgi-databasen | **Predicate:** uses-data-from | **Object:** sygehusmedicinregisteret
  - **Evidence:** 
De øvrige datakilder er
- Den Nationale Labdatabank (DNL)
- Dansk Anæstesi Database (DAD)
- Sygehusmedicinregisteret (SMR)
[^src3]

## Claims

- **data-source**: Databasen benytter også data fra Dansk Anæstesi Database (DAD) og Sygehusmedicinregisteret (SMR) [^src1] (akut-kirurgi-databasen, dansk-anaestesi-database-dad, sygehusmedicinregisteret) [^src2]
- **historical**: Sygehusmedicinregisteret (SMR) blev etableret i 2018 [^src1] (sygehusmedicinregisteret) [^src4]
- **administrative**: En ny registreringsvejledning til SMR udkom 1. juli 2022 [^src1] (sygehusmedicinregisteret) [^src4]
- **technical**: En løsning til at sende ophængningstidspunktet til SMR forventes at være i drift i sommeren 2023 [^src1] (sygehusmedicinregisteret) [^src4]

## Timeline

*(No explicit timeline events extracted beyond the chronological claims listed above.)*

## Sources

[^src1]: AKDB_2023.pdf, pages 11-15
[^src2]: AKDB_2024.pdf, pages 86-90
[^src3]: AKDB_2023.pdf, pages 81-85
[^src4]: AKDB_2023.pdf, pages 91-95
