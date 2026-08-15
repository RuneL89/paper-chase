---
title: Charlson Comorbiditets indeks
type: entity
aliases:
  - Charlson Comorbiditets indeks
wiki: rkkp-akdb
updated: '2026-08-15T06:25:59.376Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: 66-70
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '31-35, 66-70'
  - file: wikis/rkkp-akdb/raw/AKDB_2025.pdf
    pages: '31-35, 61-65, 71-75'
tags:
  - medical-concept
---

## Mentions

- Page 66: "Charlson Comorbiditets indeks = 0 eller > 2" [^src1]
- Page 31: "Præ-operative scoringer som f.eks. ASA score og Charlson Comorbidity index tager udgangspunkt i risikofaktorer, der var til stede ved indlæggelse." [^src2]
- Page 66: "Patientens Charlson Comorbiditets indeks = 0 eller > 2" [^src3]
- Page 35: "Præ-operative scoringer som f.eks. ASA score og Charlson Comorbidity index tager udgangspunkt i risikofaktorer, der var til stede ved indlæggelse." [^src4]
- Page 64: "Patientens Charlson Comorbiditets indeks > 0" [^src5]
- Page 72: "Patientens Charlson Comorbiditets indeks = 0 eller > 2" [^src6]

## Relationships

- [[indikator-10b|Indikator 10b]] — Is Used In Definition Of [^src1]
- [[indikator-10c|Indikator 10c]] — Is Used In Definition Of [^src1]
- [[charlson-score-0|Charlson Score = 0]] — Is Basis For [^src5]
- [[indikator-9b|Indikator 9b]] — Has Supplementary Indicator For (incoming) — "Supplerende indikator til indikator 9b: Mortalitet indenfor 30 dage efter akut kirurgi, Charlson Score = 1 eller 2" [^src3]
- [[indikator-9c|Indikator 9c]] — Has Supplementary Indicator For (incoming) — "Supplerende indikator til 9c: Mortalitet indenfor 30 dage efter akut kirurgi, hvis Charlson Score ≥ 3" [^src3]
- [[charlson-score-ge-3|Charlson Score ≥ 3]] — Is Calculated From (incoming) — "Patientens Charlson Comorbiditets indeks = 0 eller > 2" [^src6]

## Claims

- Supplerende indikator til indikator 10c beskriver andelen af patienter, der dør indenfor 30 dage fra operationsdato for alle opererede (med relevant diagnosekode og procedurekode), og som har Charlson Score ≥ 3 [^src1] ([[indikator-10c|Indikator 10c]], [[charlson-comorbiditets-indeks|Charlson Comorbiditets indeks]])
- Eksklusion: 53 Ugyldigt CPRnummer. 172 Patienten er under 18 år. 6.186 Patienten er ikke opereret. 5 Patienten er registreret i CPR-registeret som 'Inaktiv, uden bopæl i dansk/grønlandsk folkeregister men tildelt personnummer af skattehensyn (kommunekoderne 0010, 0011, 0012 og 0019)'. 473 Operationen er ikke den første operation i hospitalsopholdet. 2.395 Patientens Charlson Comorbiditets indeks = 0 eller > 2 [^src1] ([[cpr-nummer|CPR-nummer]], [[charlson-comorbiditets-indeks|Charlson Comorbiditets indeks]])
- I alt blev der ekskluderet 2.468 patienter på grund af Charlson Comorbiditets indeks = 0 eller > 2 [^src3] ([[charlson-comorbiditets-indeks|Charlson Comorbiditets indeks]])
- Diagnoser til brug i beregning af Charlson Score er hentet 10 år tilbage i tid [^src6] ([[charlson-score-ge-3|Charlson Score ≥ 3]], [[charlson-comorbiditets-indeks|Charlson Comorbiditets indeks]])

## Sources

[^src1]: AKDB_2023.pdf, pages 66-70
[^src2]: AKDB_2024.pdf, pages 31-35
[^src3]: AKDB_2024.pdf, pages 66-70
[^src4]: AKDB_2025.pdf, pages 31-35
[^src5]: AKDB_2025.pdf, pages 61-65
[^src6]: AKDB_2025.pdf, pages 71-75

