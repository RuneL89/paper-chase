---
title: Landspatientregisteret
type: entity
aliases:
  - LPR
  - Landspatientregisteret (LPR)
wiki: rkkp-akdb
updated: '2026-08-05T18:28:33.844Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '1-5, 46-50, 81-85'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '1-5, 21-25, 36-40, 46-50, 86-90, 91-95, 96-100'
tags:
  - organization
---
**Landspatientregisteret** (LPR), or the Danish National Patient Register, is a central national health registry in Denmark. Within the context of acute surgical quality monitoring, it serves as the primary data source and registration platform for the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] (AKDB) [^src1], [^src8]. The registry is fundamental to the database's operations, as patient pathways and clinical quality indicators are constructed directly from LPR submissions, making it the key to data completeness, validity, and geographical comparability across Danish regions [^src2], [^src8].

To construct the patient population and calculate quality indicators, AKDB relies on data from LPR in combination with the [[cpr-registeret|CPR-registeret]] and the [[den-nationale-labdatabank-dnl|Den Nationale Labdatabank (DNL)]] [^src7], [^src10]. Rather than using a separate, dedicated data entry system, the registration of data to AKDB is integrated into routine clinical workflows by requiring hospitals to report directly to LPR [^src7], [^src10]. This structural integration means that AKDB's data quality is entirely dependent on the accuracy and timeliness of local LPR coding [^src2].

LPR hosts and provides specific procedure and diagnosis codes that drive AKDB's clinical indicators. For example, LPR provides the operation times and procedure codes necessary for evaluating indicators like [[indikator-8|Indikator 8]] (epidural anesthesia) and [[indikator-10|Indikator 10]] (30-day mortality) [^src4], [^src9]. A specific methodological requirement for these indicators is that the time of anesthesia must fall within the timeframe of the surgical procedure as registered in LPR [^src4], [^src9]. Furthermore, early mobilization ([[indikator-6|Indikator 6]]) is tracked using specific LPR codes (ZZP0030A and ZZP0030C) [^src6]. 

The registry's coding infrastructure has evolved to support new quality measurements. On October 1, 2022, a new code was created in LPR to indicate preoperative optimization, which enabled the quantitative measurement of Indikator 3 for the first time [^src5]. This is associated with the implementation of [[sks-kode-naaz42|SKS-koden NAAZ42]] [^src5]. Later, on December 24, 2022, AKDB received approval from the Danish Health Data Authority (SDS) to use the BABZ00 code from LPR [^src4]. 

Despite its central role, relying on LPR presents challenges. The 2023 and 2024 AKDB annual reports highlight that while LPR offers a standardized national framework, variations in local coding practices and data infrastructure can impact data quality [^src8]. Consequently, hospitals and regions are required to perform local validation, comparing their internal electronic patient records (EPJ) against the data reported to LPR to ensure the registered population accurately reflects clinical reality [^src2].

## Mentions

- Page 4: "datakilden er ens egen indtastning til Landspatientregisteret (LPR)" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 1-5)
- Page 4: "det er disse data der primært er kilden til forløbsdannelsen" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 1-5)
- Page 91: "Landspatientregisteret" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 91-95)
- Page 96: "Data til Akut Kirurgi Databasen dannes på baggrund af Landspatientregisteret (LPR)." (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 96-100)
- Page 46: "BABZ00 fra LPR" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 46-50)
- Page 21: "idet der pr. 1/10-2022 blev oprettet en kode til angivelse af at der er udført præoperativ optimering via LPR." (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 21-25)
- Page 36: "Mobilisering registreres i LPR ved at angive koderne ZZP0030A (tidlig mobilisering påbegyndt) og ZZP0030C (vurderet ingen indikation for tidlig mobilisering)." (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 36-40)
- Page 81: "registrering til LPR" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 81-85)
- Page 4: "datakilden er ens egen indtastning til Landspatientregisteret (LPR)" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 1-5)
- Page 4: "det er disse data der primært er kilden til forløbsdannelsen" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 1-5)
- Page 46: "Samtidigt er der krav om, at tidspunktet for anæstesi skal ligge indenfor tidspunktet for den procedure, hvor selve operationen er angivet i LPR." (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 46-50)
- Page 86: "Landspatientregisteret (LPR)" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 86-90)

## Relationships

**Outgoing (this entity is the SUBJECT of these relationships):**

- Subject: landspatientregisteret
  Predicate: provides-codes-for
  Object: indikator-10
  Evidence: "Nævner Operationer, hvor patienter har operationstidspunkt og relevant diagnosekode og procedurekode"
  Page: 46
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 46-50
- Subject: landspatientregisteret
  Predicate: hosts-code-for
  Object: sks-kode-naaz42
  Evidence: "idet der pr. 1/10-2022 blev oprettet en kode til angivelse af at der er udført præoperativ optimering via LPR."
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 21-25

**Incoming (this entity is the OBJECT of these relationships):**

- Subject: akut-kirurgi-databasen
  Predicate: relies-on-data-from
  Object: (this entity)
  Evidence: "datakilden er ens egen indtastning til Landspatientregisteret (LPR)"
  Page: 4
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 1-5
- Subject: akut-kirurgi-databasen
  Predicate: is-based-on
  Object: (this entity)
  Evidence: "Data til Akut Kirurgi Databasen dannes som beskrevet på baggrund af LPR."
  Page: 91
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 91-95
- Subject: akut-kirurgi-databasen
  Predicate: is-based-on
  Object: (this entity)
  Evidence: "Data til Akut Kirurgi Databasen dannes på baggrund af Landspatientregisteret (LPR)."
  Page: 96
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 96-100
- Subject: indikator-6
  Predicate: is-based-on-data-from
  Object: (this entity)
  Evidence: "Mobilisering registreres i LPR ved at angive koderne ZZP0030A og ZZP0030C."
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 36-40
- Subject: akut-kirurgi-databasen
  Predicate: uses-data-from
  Object: (this entity)
  Evidence: "Registrering af data til databasen foregår som indberetning til LPR"
  Page: 81
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 81-85
- Subject: akut-kirurgi-databasen
  Predicate: relies-on-data-from
  Object: (this entity)
  Evidence: "datakilden er ens egen indtastning til Landspatientregisteret (LPR)"
  Page: 4
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 1-5
- Subject: indikator-8
  Predicate: uses-operation-time-from
  Object: (this entity)
  Evidence: "tidspunktet for anæstesi skal ligge indenfor tidspunktet for den procedure, hvor selve operationen er angivet i LPR"
  Page: 46
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 46-50
- Subject: akut-kirurgi-databasen
  Predicate: uses-data-from
  Object: (this entity)
  Evidence: "Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL)"
  Page: 86
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 86-90

## Claims

- Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL) [^src1] (cpr-registeret, landspatientregisteret, den-nationale-labdatabank-dnl)
  Type: data-source
  Page: 81
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 81-85
- Registrering af data til databasen foregår som indberetning til LPR [^src1] (akut-kirurgi-databasen, landspatientregisteret)
  Type: data-collection-method
  Page: 81
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 81-85
- Akut Kirurgi Databasen er i fjerde år baseret på Landspatientregisteret (LPR) [^src1] (akut-kirurgi-databasen, landspatientregisteret)
  Type: structural
  Page: 4
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 1-5
- Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL) [^src1] (akut-kirurgi-databasen, cpr-registeret, landspatientregisteret, den-nationale-labdatabank-dnl)
  Type: data-source
  Page: 86
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 86-90
- Registrering af data til databasen foregår som indberetning til LPR [^src1] (akut-kirurgi-databasen, landspatientregisteret)
  Type: registration-method
  Page: 86
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 86-90

## Timeline

- 2022-12-24: AKDB modtog godkendelse fra SDS på at anvende koden BABZ00 fra LPR (akut-kirurgi-databasen, sds, landspatientregisteret)
- 2022-10-01: En kode til angivelse af præoperativ optimering blev oprettet i LPR, hvilket muliggjorde første gang kvantitativ måling af Indikator 3 som kvalitetsindikator. (landspatientregisteret, indikator-3)

## Sources

[^src1]: AKDB_2023.pdf, pages 1-5
[^src2]: AKDB_2024.pdf, pages 91-95
[^src3]: AKDB_2024.pdf, pages 96-100
[^src4]: AKDB_2023.pdf, pages 46-50
[^src5]: AKDB_2024.pdf, pages 21-25
[^src6]: AKDB_2024.pdf, pages 36-40
[^src7]: AKDB_2023.pdf, pages 81-85
[^src8]: AKDB_2024.pdf, pages 1-5
[^src9]: AKDB_2024.pdf, pages 46-50
[^src10]: AKDB_2024.pdf, pages 86-90
