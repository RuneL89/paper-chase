---
title: SKS-koden NAAZ42
type: entity
aliases:
  - SKS-koden NAAZ42
  - NAAZ42
wiki: rkkp-akdb
updated: '2026-08-15T06:25:59.312Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: 16-20
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '106-107, 16-20, 21-25'
  - file: wikis/rkkp-akdb/raw/AKDB_2025.pdf
    pages: 21-25
tags:
  - code
---

## Mentions

- Page 16: "For at kunne trække data skal afdelingerne kode patienterne, der præoptimeres med SKS-koden NAAZ42, der har teksten ” Anæstesiologisk præoperativ optimering”." [^src1]
- Page 16: "SKS-koden NAAZ42 Præoperativ optimering er oprettet pr. 1/10-2022 og kan således indberettes fra dette tidspunkt." [^src2]
- Page 21: "For at kunne trække data skal afdelingerne kode patienterne, der præoptimeres med SKS-koden NAAZ42, der har teksten ” Anæstesiologisk præoperativ optimering”." [^src3]
- Page 106: "Må anæstesiologen så ikke anvende procedurekoden NAAZ42 eller må den kun anvendes, hvis patienten præoptimeres enten på IMA eller ITA-afsnit?" [^src4]
- Page 22: "der pr. 1/10-2022 blev oprettet en SKS kode (NAAZ42) til angivelse af at der er udført præoperativ optimering via LPR." [^src5]
- Page 22: "Patienter indgår i tælleren, hvis den anæstesiologiske ydelse ”præoperativ optimering” dokumenteres med SKS-koden NAAZ42" [^src5]

## Relationships

- [[indikator-3|Indikator 3]] — Is Required For [^src3]
- [[ima|IMA]] — Applies To Location [^src4]
- [[ita-afsnit|ITA-afsnit]] — Applies To Location [^src4]
- [[indikator-4|Indikator 4]] — Is Coded By (incoming) — "For at kunne trække data skal afdelingerne kode patienterne, der præoptimeres med SKS-koden NAAZ42" [^src1]
- [[indikator-3|Indikator 3]] — Uses Code (incoming) — "SKS-koden NAAZ42 Præoperativ optimering er oprettet pr. 1/10-2022 og kan således indberettes fra dette tidspunkt." [^src2]
- [[landspatientregisteret|Landspatientregisteret]] — Hosts Code For (incoming) — "idet der pr. 1/10-2022 blev oprettet en kode til angivelse af at der er udført præoperativ optimering via LPR." [^src3]
- [[regionshospital-nordjylland|Regionshospital Nordjylland]] — Questions Code Application For (incoming) — "Må anæstesiologen så ikke anvende procedurekoden NAAZ42 eller må den kun anvendes, hvis patienten præoptimeres enten på IMA eller ITA-afsnit?" [^src4]
- [[indikator-3|Indikator 3]] — Is Defined By (incoming) — "Indikatoren er endeligt defineret således at den kan måles og afrapporteres som kvalitetsindikator idet der pr. 1/10-2022 blev oprettet en SKS kode (NAAZ42) til angivelse af at der er udført præoperativ optimering via LPR." [^src5]

## Claims

- SKS-koden NAAZ42 Præoperativ optimering er oprettet pr. 1/10-2022 og kan således indberettes fra dette tidspunkt [^src2] ([[sks-kode-naaz42|SKS-koden NAAZ42]])
- SKS-koden NAAZ4 'Anæstesiologisk tilsyn' ikke kan bruges til dette [^src3] ([[sks-kode-naaz42|SKS-koden NAAZ42]])
- Der er usikkerhed om, hvorvidt procedurekoden NAAZ42 må anvendes, hvis patienten præoptimeres af en anæstesiolog uden for IMA eller ITA-afsnit [^src4] ([[sks-kode-naaz42|SKS-koden NAAZ42]], [[anaestesiolog|anæstesiolog]], [[ima|IMA]], [[ita-afsnit|ITA-afsnit]])
- Indikatoren er endeligt defineret således at den kan måles og afrapporteres som kvalitetsindikator idet der pr. 1/10-2022 blev oprettet en SKS kode (NAAZ42) til angivelse af at der er udført præoperativ optimering via LPR [^src5] ([[indikator-3|Indikator 3]], [[sks-kode-naaz42|SKS-koden NAAZ42]])
- Patienter indgår i tælleren, hvis den anæstesiologiske ydelse ”præoperativ optimering” dokumenteres med SKS-koden NAAZ42 eller hvis tiden fra modtagelse til operation er under fire timer [^src5] ([[indikator-3|Indikator 3]], [[sks-kode-naaz42|SKS-koden NAAZ42]])

## Sources

[^src1]: AKDB_2023.pdf, pages 16-20
[^src2]: AKDB_2024.pdf, pages 16-20
[^src3]: AKDB_2024.pdf, pages 21-25
[^src4]: AKDB_2024.pdf, pages 106-107
[^src5]: AKDB_2025.pdf, pages 21-25

