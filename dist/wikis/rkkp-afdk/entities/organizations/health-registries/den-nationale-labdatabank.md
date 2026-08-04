---
title: Den Nationale Labdatabank
type: entity
aliases:
  - Den Nationale Labdatabank
wiki: rkkp-afdk
updated: '2026-08-03T19:14:15.313Z'
sources:
  - file: AFDK_2023.pdf
    pages: '26-30, 51-55'
  - file: AFDK_2024.pdf
    pages: '21-25, 41-45'
tags:
  - organization
---

# Den Nationale Labdatabank

Denne nationale database indeholder laboratorieresultater fra landets større laboratorier og fungerer som kilde til TSH-målingsdata for indikatoren.

## Mentions

- Page 29: "Data om måling af TSH er indhentet via kobling med Laboratoriedatabasen. Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank" [^src1]
- Page 53: "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." [^src2]
- Page 24: "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." [^src3]
- Page 43: "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen" [^src4]

## Relationships

- [[sundhedsdatastyrelsen|Sundhedsdatastyrelsen]] — provides-data-to [^src1]. Evidence: "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen" (Page 29)
- [[laboratoriedatabasen|Laboratoriedatabasen]] — feeds-into [^src4]. Evidence: "Laboratoriesvar fra Den Nationale Labdatabank indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen" (Page 43)
- [[laboratorieregistret|Laboratorieregistret]] — receives-data-from (incoming) — "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen" [^src2] (Page 53)
- [[laboratoriedatabasen|Laboratoriedatabasen]] — receives-data-from (incoming) — "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen" [^src3] (Page 24)
- [[region-midtjylland|Region Midtjylland]] — reports-to (incoming) — "Nærværende årsrapportsperiode er den første hvor Region Midtjylland systematisk har overført prøvesvar til Den Nationale Labdatabank" [^src4] (Page 43)

## Claims

- Nærværende årsrapportsperiode er den første hvor Region Midtjylland systematisk har overført prøvesvar til Den Nationale Labdatabank ([[region-midtjylland|Region Midtjylland]], [[den-nationale-labdatabank|Den Nationale Labdatabank]])
- Laboratoriesvar, hvor patienten har givet negativt samtykke til at udveksle oplysninger, videresendes ikke til Den Nationale Labdatabank, og dermed heller ikke til Laboratoriedatabasen ([[den-nationale-labdatabank|Den Nationale Labdatabank]], [[laboratoriedatabasen|Laboratoriedatabasen]])
- Laboratoriesvar, hvor patienten har givet negativt samtykke til at udveksle oplysninger, videresendes ikke til Den Nationale Labdatabank ([[den-nationale-labdatabank|Den Nationale Labdatabank]])

## Sources

[^src1]: AFDK_2023.pdf, pages 26-30
[^src2]: AFDK_2023.pdf, pages 51-55
[^src3]: AFDK_2024.pdf, pages 21-25
[^src4]: AFDK_2024.pdf, pages 41-45
