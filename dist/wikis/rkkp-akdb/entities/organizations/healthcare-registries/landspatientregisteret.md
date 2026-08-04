---
title: Landspatientregisteret
type: entity
wiki: rkkp-akdb
updated: '2026-08-03T16:38:33.167Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '1-5, 81-85, 86-90'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '1-5, 56-60, 86-90, 91-95, 96-100'
tags:
  - organization
---

## Mentions

- Page 1: "datakilden er ens egen indtastning til Landspatientregisteret (LPR)" [^src1]
- Page 81: "Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL)." [^src2]
- Page 81: "Registrering af data til databasen foregår som indberetning til LPR." [^src2]
- Page 82: "Kontakterne identificeres i LPR." [^src2]
- Page 84: "Data til Akut Kirurgi Databasen dannes som beskrevet på baggrund af LPR." [^src2]
- Page 89: "Data til Akut Kirurgi Databasen dannes på baggrund af Landspatientregisteret (LPR). Det er et register, hvor enhver kontakt mellem en person og et sygehus registreres" [^src3]
- Page 1: "Når man som afdeling læser dette, skal man huske at datakilden er ens egen indtastning til Landspatientregisteret (LPR)." [^src4]
- Page 58: "ønskes nu at supplere med data fra LPR til beregning af indikator 9" [^src5]
- Page 58: "Desuden er det værd at bemærke, at den LPR opdaterer indberetningsvejledningen sådan at tidspunktet for operationsstart fremover skal svare til tidspunktet for knivtid start" [^src5]
- Page 86: "Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL). Registrering af data til databasen foregår som indberetning til LPR." [^src6]
- Page 91: "Kontakterne identificeres i LPR" [^src7]
- Page 93: "Data til Akut Kirurgi Databasen dannes som beskrevet på baggrund af LPR" [^src7]
- Page 99: "Data til Akut Kirurgi Databasen dannes på baggrund af Landspatientregisteret (LPR). Det er et register, hvor enhver kontakt mellem en person og et sygehus registreres." [^src8]

## Relationships

- [[indikator-9|Indikator 9]] — Provides Data For [^src5]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Uses Data From (incoming) — "datakilden er ens egen indtastning til Landspatientregisteret (LPR). Det er derfor vigtigt, at man ledelsesmæssigt prioriterer at validere egen afdelings indberetning, således at der er overensstemmelse mellem indberetning til LPR og sande data" [^src1]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Uses Data From (incoming) — "Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL)." [^src2]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Uses Data From (incoming) — "Data til Akut Kirurgi Databasen dannes på baggrund af Landspatientregisteret (LPR)" [^src3]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Uses Data From (incoming) — "Databasen tager udgangspunkt i data fra Landspatientregisteret, som er hospitalernes egen indtastning" [^src4]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Uses Data From (incoming) — "Data til konstruktion af populationen og indikatorerne indhentes fra Landspatientregisteret (LPR)" [^src6]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Is Based On (incoming) — "Data til Akut Kirurgi Databasen dannes som beskrevet på baggrund af LPR" [^src7]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Uses Data From (incoming) — "Data til Akut Kirurgi Databasen dannes på baggrund af Landspatientregisteret (LPR)" [^src8]

## Claims

- Databasen er under omlægning og dette er fjerde år baseret på LPR [^src1] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]], [[landspatientregisteret|Landspatientregisteret]])
- Registrering af data til databasen foregår som indberetning til LPR [^src2] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]], [[landspatientregisteret|Landspatientregisteret]])
- Kontakterne identificeres i LPR. Følgende inklusionskriterier er gældende: kontakt med fysisk fremmøde [ALCA00] og prioritet: 'akut' [ATA1*] i LPR [^src2] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]], [[landspatientregisteret|Landspatientregisteret]])
- Patientforløb i AKDB dannes ved at samle alle LPR kontakter som på hinanden følgende er ≤ 4 timer mellem hinanden [^src2] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]], [[landspatientregisteret|Landspatientregisteret]])
- AKDB er under omlægning og dette er fjerde år baseret på LPR [^src4] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]], [[landspatientregisteret|Landspatientregisteret]])
- Den LPR opdaterer indberetningsvejledningen sådan at tidspunktet for operationsstart fremover skal svare til tidspunktet for knivtid start. Hidtil har tidspunktet været starttidspunktet for anæstesi [^src5] ([[landspatientregisteret|Landspatientregisteret]])
- Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL) [^src6] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]], [[cpr-registeret|CPR-registeret]], [[landspatientregisteret|Landspatientregisteret]], [[den-nationale-labdatabank|Den Nationale Labdatabank]])
- Registrering af data til databasen foregår som indberetning til LPR [^src6] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]], [[landspatientregisteret|Landspatientregisteret]])
- Kontakterne identificeres i LPR gennem kontakt med fysisk fremmøde [ALCA00] og prioritet 'akut' [ATA1*] [^src7] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]], [[landspatientregisteret|Landspatientregisteret]])

## Sources

[^src1]: AKDB_2023.pdf, pages 1-5
[^src2]: AKDB_2023.pdf, pages 81-85
[^src3]: AKDB_2023.pdf, pages 86-90
[^src4]: AKDB_2024.pdf, pages 1-5
[^src5]: AKDB_2024.pdf, pages 56-60
[^src6]: AKDB_2024.pdf, pages 86-90
[^src7]: AKDB_2024.pdf, pages 91-95
[^src8]: AKDB_2024.pdf, pages 96-100

