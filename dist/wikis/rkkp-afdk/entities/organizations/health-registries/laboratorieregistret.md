---
title: Laboratorieregistret
type: entity
wiki: rkkp-afdk
updated: '2026-08-03T19:14:15.319Z'
sources:
  - file: AFDK_2023.pdf
    pages: 51-55
  - file: AFDK_2024.pdf
    pages: 41-45
tags:
  - organization
---

# Laboratorieregistret

Laboratorieregistret (the Laboratory Registry) is one of three national Danish data sources used to calculate quality indicators for the [[databasen-for-atrieflimren-i-danmark|Databasen for Atrieflimren i Danmark]], the national atrial fibrillation quality database. Alongside Landspatientregisteret and Lægemiddelstatistikregisteret (ATC codes), it supplies the laboratory data — specifically P-creatinine measurements — needed to monitor kidney function in patients treated with direct oral anticoagulants (DOAC) [^src1] [^src2].

The registry's data does not originate from a single central source but is aggregated from the country's larger laboratories, which are connected to [[den-nationale-labdatabank|Den Nationale Labdatabank]]. Test results are transmitted from these laboratories into the national lab database, from which they flow into the Laboratory Database maintained by Sundhedsdatastyrelsen (the Danish Health Data Authority) [^src1].

Within the atrial fibrillation quality reporting framework, Laboratorieregistret plays a specific and recurring role: it provides the data used to calculate [[indikator-4b|Indikator 4b]], the indicator tracking annual measurement of kidney function (P-creatinine) among patients on DOAC treatment [^src2]. This function is documented consistently across both the 2023 and 2024 annual reports of the Databasen for Atrieflimren i Danmark, which cover reporting periods including 1 July 2022 to 30 June 2023, underscoring the registry's ongoing, structural role in Denmark's national monitoring of anticoagulation safety and renal function surveillance in atrial fibrillation care [^src1] [^src2].

## Mentions

- Page 53: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret." [^src1]
- Page 43: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret" [^src2]

## Relationships

**Outgoing (this entity is the SUBJECT of these relationships):**

- Subject: laboratorieregistret — Predicate: receives-data-from — Object: den-nationale-labdatabank
  Evidence: "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen" (Page 53) [^src1]
- Subject: laboratorieregistret — Predicate: provides-data-for — Object: indikator-4b
  Evidence: "Data til beregning af indikatoren indhentes fra Laboratorieregistret" (Page 43) [^src2]

**Incoming (this entity is the OBJECT of these relationships):**

- Subject: databasen-for-atrieflimren-i-danmark — Predicate: uses-data-from — Object: (this entity)
  Evidence: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret" (Page 53) [^src1]

## Claims

(none)

## Timeline

(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 51-55
[^src2]: AFDK_2024.pdf, pages 41-45
