---
title: Landspatientregisteret
type: entity
aliases:
  - Landspatientregisteret (LPR)
  - LPR
  - LPR3
wiki: rkkp-akdb
updated: '2026-08-15T06:25:59.180Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '1-5, 46-50, 81-85'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '1-5, 21-25, 36-40, 46-50, 86-90, 91-95, 96-100'
  - file: wikis/rkkp-akdb/raw/AKDB_2025.pdf
    pages: '1-5, 101-105, 106-110, 36-40, 56-60, 66-70, 96-100'
tags:
  - organization
---

## Mentions

- Page 4: "datakilden er ens egen indtastning til Landspatientregisteret (LPR)" [^src1]
- Page 4: "det er disse data der primært er kilden til forløbsdannelsen" [^src1]
- Page 91: "Landspatientregisteret" [^src2]
- Page 96: "Data til Akut Kirurgi Databasen dannes på baggrund af Landspatientregisteret (LPR)." [^src3]
- Page 40: "Mobilisering registreres i LPR ved at angive koderne ZZP0030A (tidlig mobilisering påbegyndt) og ZZP0030C (vurderet ingen indikation for tidlig mobilisering)." [^src4]
- Page 100: "Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL)1." [^src5]
- Page 100: "Registrering af data til databasen foregår som indberetning til LPR." [^src5]
- Page 101: "Kontakterne* identificeres i LPR." [^src6]
- Page 109: "Data til Akut Kirurgi Databasen dannes på baggrund af Landspatientregisteret (LPR)." [^src7]
- Page 81: "registrering til LPR" [^src8]
- Page 4: "datakilden er ens egen indtastning til Landspatientregisteret (LPR)" [^src9]
- Page 4: "det er disse data der primært er kilden til forløbsdannelsen" [^src9]
- Page 46: "Samtidigt er der krav om, at tidspunktet for anæstesi skal ligge indenfor tidspunktet for den procedure, hvor selve operationen er angivet i LPR." [^src10]
- Page 86: "Landspatientregisteret (LPR)" [^src11]
- Page 46: "BABZ00 fra LPR" [^src12]
- Page 21: "idet der pr. 1/10-2022 blev oprettet en kode til angivelse af at der er udført præoperativ optimering via LPR." [^src13]
- Page 36: "Mobilisering registreres i LPR ved at angive koderne ZZP0030A (tidlig mobilisering påbegyndt) og ZZP0030C (vurderet ingen indikation for tidlig mobilisering)." [^src14]
- Page 58: "Den LPR opdaterer indberetningsvejledningen sådan at tidspunktet for operationsstart fremover skal svare til tidspunktet for knivtid start." [^src15]
- Page 58: "epidural i behandlingen af patienten. Denne oplysning har hidtil været indsamlet med Dansk Anaestesi Database som datakilde, men for at optimere datagrundlaget ønskes nu at supplere med data fra LPR" [^src15]
- Page 4: "indberetninger til LPR3" [^src16]

## Relationships

- [[indikator-10|Indikator 10]] — Provides Codes For [^src12]
- [[sks-kode-naaz42|SKS-koden NAAZ42]] — Hosts Code For [^src13]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Provides Data For [^src15]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Relies On Data From (incoming) — "datakilden er ens egen indtastning til Landspatientregisteret (LPR)" [^src1]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Is Based On (incoming) — "Data til Akut Kirurgi Databasen dannes som beskrevet på baggrund af LPR." [^src2]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Is Based On (incoming) — "Data til Akut Kirurgi Databasen dannes på baggrund af Landspatientregisteret (LPR)." [^src3]
- [[indikator-6|Indikator 6]] — Is Defined In (incoming) — "Mobilisering registreres i LPR ved at angive koderne ZZP0030A (tidlig mobilisering påbegyndt) og ZZP0030C (vurderet ingen indikation for tidlig mobilisering)." [^src4]
- [[charlson-score|Charlson Score]] — Is Calculated From (incoming) — "Diagnoser til brug i beregning af Charlson Score er hentet 10 år tilbage i tid" [^src17]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Uses Data From (incoming) — "Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL)1." [^src5]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Is Based On (incoming) — "Data til Akut Kirurgi Databasen dannes som beskrevet på baggrund af LPR." [^src6]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Uses Data From (incoming) — "Data til Akut Kirurgi Databasen dannes på baggrund af Landspatientregisteret (LPR)." [^src7]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Uses Data From (incoming) — "Registrering af data til databasen foregår som indberetning til LPR" [^src8]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Relies On Data From (incoming) — "datakilden er ens egen indtastning til Landspatientregisteret (LPR)" [^src9]
- [[indikator-8|Indikator 8]] — Uses Operation Time From (incoming) — "tidspunktet for anæstesi skal ligge indenfor tidspunktet for den procedure, hvor selve operationen er angivet i LPR" [^src10]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Uses Data From (incoming) — "Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL)" [^src11]
- [[indikator-6|Indikator 6]] — Is Based On Data From (incoming) — "Mobilisering registreres i LPR ved at angive koderne ZZP0030A og ZZP0030C." [^src14]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Is Based On (incoming) — "Databasen er omlagt og baseret på LPR-data" [^src16]

## Claims

- Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL)1 [^src5] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]], [[cpr-registeret|CPR-registeret]], [[landspatientregisteret|Landspatientregisteret]], [[den-nationale-labdatabank-dnl|Den Nationale Labdatabank (DNL)]])
- Registrering af data til databasen foregår som indberetning til LPR [^src5] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]], [[landspatientregisteret|Landspatientregisteret]])
- Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL) [^src8] ([[cpr-registeret|CPR-registeret]], [[landspatientregisteret|Landspatientregisteret]], [[den-nationale-labdatabank-dnl|Den Nationale Labdatabank (DNL)]])
- Registrering af data til databasen foregår som indberetning til LPR [^src8] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]], [[landspatientregisteret|Landspatientregisteret]])
- Akut Kirurgi Databasen er i fjerde år baseret på Landspatientregisteret (LPR) [^src9] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]], [[landspatientregisteret|Landspatientregisteret]])
- Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL) [^src11] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]], [[cpr-registeret|CPR-registeret]], [[landspatientregisteret|Landspatientregisteret]], [[den-nationale-labdatabank-dnl|Den Nationale Labdatabank (DNL)]])
- Registrering af data til databasen foregår som indberetning til LPR [^src11] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]], [[landspatientregisteret|Landspatientregisteret]])

## Sources

[^src1]: AKDB_2023.pdf, pages 1-5
[^src2]: AKDB_2024.pdf, pages 91-95
[^src3]: AKDB_2024.pdf, pages 96-100
[^src4]: AKDB_2025.pdf, pages 36-40
[^src5]: AKDB_2025.pdf, pages 96-100
[^src6]: AKDB_2025.pdf, pages 101-105
[^src7]: AKDB_2025.pdf, pages 106-110
[^src8]: AKDB_2023.pdf, pages 81-85
[^src9]: AKDB_2024.pdf, pages 1-5
[^src10]: AKDB_2024.pdf, pages 46-50
[^src11]: AKDB_2024.pdf, pages 86-90
[^src12]: AKDB_2023.pdf, pages 46-50
[^src13]: AKDB_2024.pdf, pages 21-25
[^src14]: AKDB_2024.pdf, pages 36-40
[^src15]: AKDB_2025.pdf, pages 56-60
[^src16]: AKDB_2025.pdf, pages 1-5
[^src17]: AKDB_2025.pdf, pages 66-70

