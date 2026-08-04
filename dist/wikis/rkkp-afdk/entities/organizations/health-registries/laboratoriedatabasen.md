---
title: Laboratoriedatabasen
type: entity
wiki: rkkp-afdk
updated: '2026-08-03T19:14:15.317Z'
sources:
  - file: AFDK_2024.pdf
    pages: '21-25, 41-45'
tags:
  - organization
---

# Laboratoriedatabasen

Laboratoriedatabasen hos Sundhedsdatastyrelsen indeholder laboratoriesvar fra landets større laboratorier og er kilden til TSH-målingsdata for denne indikator.

## Mentions

- Page 24: "Data om måling af TSH er indhentet via kobling med Laboratoriedatabasen. Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." [^src1]
- Page 43: "hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen" [^src2]

## Relationships

- [[den-nationale-labdatabank|Den Nationale Labdatabank]] — receives-data-from [^src1]. Evidence: "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen" (Page 24)
- [[sundhedsdatastyrelsen|Sundhedsdatastyrelsen]] — administered-by [^src1]. Evidence: "Laboratoriedatabasen hos Sundhedsdatastyrelsen" (Page 24)
- [[sundhedsdatastyrelsen|Sundhedsdatastyrelsen]] — managed-by [^src2]. Evidence: "Laboratoriedatabasen hos Sundhedsdatastyrelsen" (Page 43)
- [[indikator-3-tsh-measurement|Indikator 3: Andelen af nydiagnosticerede patienter med atrieflimren, som får målt TSH fra 2 måneder før, til 1 måned efter 1. diagnosedato]] — uses-data-from (incoming) — "Data om måling af TSH er indhentet via kobling med Laboratoriedatabasen" [^src1] (Page 24)
- [[den-nationale-labdatabank|Den Nationale Labdatabank]] — feeds-into (incoming) — "Laboratoriesvar fra Den Nationale Labdatabank indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen" [^src2] (Page 43)

## Claims

- Laboratoriesvar, hvor patienten har givet negativt samtykke til at udveksle oplysninger, videresendes ikke til Den Nationale Labdatabank, og dermed heller ikke til Laboratoriedatabasen ([[den-nationale-labdatabank|Den Nationale Labdatabank]], [[laboratoriedatabasen|Laboratoriedatabasen]])

## Sources

[^src1]: AFDK_2024.pdf, pages 21-25
[^src2]: AFDK_2024.pdf, pages 41-45
