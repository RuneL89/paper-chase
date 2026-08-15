---
title: Indikator 10
type: entity
aliases:
  - Indikator 10
wiki: rkkp-akdb
updated: '2026-08-15T06:25:59.218Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '46-50, 51-55, 6-10'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '101-105, 51-55, 56-60, 6-10, 96-100'
  - file: wikis/rkkp-akdb/raw/AKDB_2025.pdf
    pages: '106-110, 51-55, 56-60, 6-10'
tags:
  - indicator
---

## Mentions

- Page 6: "Indikator 10: Andelen af patienter, der dør indenfor 30 dage fra operationsdato for alle opererede (med relevant diagnosekode og procedurekode)" [^src1]
- Page 7: "Indikator 10: Andelen af patienter, der dør indenfor 30 dage fra operationsdato for alle opererede (med relevant diagnosekode og procedurekode)" [^src1]
- Page 46: "Indikator 10: Mortalitet indenfor 30 dage for opererede. Resultater på afdelingsniveau" [^src2]
- Page 51: "Indikator 10: Mortalitet indenfor 30 dage for opererede. Trendgraf over resultater på regionalt niveau" [^src3]
- Page 6: "Indikator 10: Andelen af patienter, der dør indenfor 90 dage fra operationsdato for alle opererede (med relevant diagnosekode og procedurekode)" [^src4]
- Page 51: "Indikator 10: Mortalitet indenfor 90 dage efter akut kirurgi. Alle opererede (med relevant diagnosekode og procedurekode)" [^src5]
- Page 56: "Supplerende opgørelser" [^src6]
- Page 96: "Indikator 10: Mortalitet indenfor 90 dage efter akut kirurgi. Alle opererede (med relevant diagnosekode og procedurekode)" [^src7]
- Page 101: "Er det muligt ift. indikator 10, så har Regionshospital Nordjylland gennemgået deres forløb og fundet at mange af de patienter som inkluderes dør af deres grundlidelse og ikke at postoperative komplikationer pga. et AHA forløb. Flere af disse patienter har ofte ældre og har flere comorbide diagnoser." [^src8]
- Page 6: "Indikator 10: Andelen af patienter, der dør indenfor 90 dage fra operationsdato for alle opererede (med relevant diagnosekode og procedurekode)" [^src9]
- Page 7: "Indikator 10: Andelen af patienter, der dør indenfor 90 dage fra operationsdato for alle opererede (med relevant diagnosekode og procedurekode)" [^src9]
- Page 54: "Indikator 10: Mortalitet indenfor 90 dage efter akut kirurgi. Alle opererede (med relevant diagnosekode og procedurekode)" [^src10]
- Page 56: "Indikator 10: Mortalitet indenfor 90 dage for opererede. Forest plot på afdelingsniveau" [^src11]
- Page 57: "Indikatorbeskrivelse for indikator 10" [^src11]
- Page 109: "Indikator 10: Mortalitet indenfor 90 dage efter akut kirurgi. Alle opererede (med relevant diagnosekode og procedurekode)" [^src12]

## Relationships

- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Belongs To Database [^src1]
- [[mortalitet-indenfor-30-dage]] — Measures [^src2]
- [[30-dages-mortalitet]] — Measures [^src3]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Is Calculated From [^src5]
- [[indikator-10-development-goal]] — Has Development Goal [^src5]
- [[mortality-within-90-days]] — Measures [^src6]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Is Reported By [^src10]
- [[18-percent]] — Has Target [^src10]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Is Calculated From [^src11]
- [[18-percent]] — Has Target [^src12]
- [[landspatientregisteret|Landspatientregisteret]] — Provides Codes For (incoming) — "Nævner Operationer, hvor patienter har operationstidspunkt og relevant diagnosekode og procedurekode" [^src2]
- [[region-midtjylland|Region Midtjylland — Midtjylland]] — Has Lowest 30 Day Mortality (incoming) — "Regionalt varierede andelen fra 9,9 % i Region Midtjylland til 14,1 % i Region Nordjylland" [^src3]
- [[region-nordjylland|Region Nordjylland — Nordjylland]] — Has Highest 30 Day Mortality (incoming) — "Regionalt varierede andelen fra 9,9 % i Region Midtjylland til 14,1 % i Region Nordjylland" [^src3]
- [[charlson-score|Charlson Score]] — Is Used For Risk Adjustment Of (incoming) — "Charlson Scoren ønskes indført, sådan at mortalitetsindikatorerne (Indikator 10, 11 og supplerende til indikator 10 og 11) kan opdeles baseret på komorbiditet i grupperne 0, 1 -2 og ≥ 3." [^src6]
- [[regionshospital-nordjylland|Regionshospital Nordjylland]] — Identifies Data Inconsistency In (incoming) — "Er det muligt ift. indikator 10, så har Regionshospital Nordjylland gennemgået deres forløb og fundet at mange af de patienter som inkluderes dør af deres grundlidelse og ikke at postoperative komplikationer pga. et AHA forløb." [^src8]
- [[rigshospitalet|Rigshospitalet]] — Has High Mortality In (incoming) — "Rigshospitalet Nej 16 / 46 0 (0) 34,8 (21,4-50,2) 30,2 29,3" [^src10]
- [[charlson-score|Charlson Score]] — Stratifies (incoming) — "Charlson Scoren ønskes indført, sådan at mortalitetsindikatorerne (Indikator 10, 11 og supplerende til indikator 10 og 11) kan opdeles baseret på komorbiditet i grupperne 0, 1 -2 og ≥ 3." [^src11]
- [[region-nordjylland|Region Nordjylland — Nordjylland]] — Has Indicator Result For (incoming) — "Regionalt varierede andelen fra 12,5 % i Region Nordjylland til 15,2 % i Region Syddanmark." [^src11]
- [[region-syddanmark|Region Syddanmark — Syddanmark]] — Has Indicator Result For (incoming) — "Regionalt varierede andelen fra 12,5 % i Region Nordjylland til 15,2 % i Region Syddanmark." [^src11]

## Claims

- Indikator 10 har en standard på < 15 % for andelen af patienter, der dør indenfor 30 dage fra operationsdato for alle opererede med relevant diagnosekode og procedurekode [^src1] ([[indikator-10|Indikator 10]])
- Eksklusion: 53 Ugyldigt CPRnummer. 173 Patienten er under 18 år. 6.178 Patienten er ikke opereret. 5 Patienten er registreret i CPR-registeret som 'Inaktiv, uden bopæl i dansk/grønlandsk folkeregister men tildelt personnummer af skattehensyn (kommunekoderne 0010, 0011, 0012 og 0019)'. 474 Operationen er ikke den første operation i hospitalsopholdet. [^src2] ([[indikator-10|Indikator 10]])
- Der indgik 3.142 forløb i indikatoranalysen i perioden. Heraf døde 11,3 % (95 % CI: 10,2–12,5) indenfor 30 dage fra ankomst til sygehus [^src3] ([[indikator-10|Indikator 10]])
- Standarden på < 15 % var opfyldt på nationalt niveau for Indikator 10 [^src3] ([[indikator-10|Indikator 10]])
- Regionalt varierede andelen fra 9,9 % i Region Midtjylland til 14,1 % i Region Nordjylland for Indikator 10 [^src3] ([[region-midtjylland|Region Midtjylland — Midtjylland]], [[region-nordjylland|Region Nordjylland — Nordjylland]], [[indikator-10|Indikator 10]])
- Alle regioner opfyldte standarden i perioden for Indikator 10 [^src3] ([[indikator-10|Indikator 10]])
- I alt 16 af de 21 indberettende enheder opfyldte standarden i perioden for Indikator 10 [^src3] ([[indikator-10|Indikator 10]])
- Det at mortaliteten nationalt er for 4. år i træk under indikator grænsen på 15%, tyder på at de seneste års indsatser allerede har slået igennem [^src3] ([[indikator-10|Indikator 10]])
- Der foreslås at ny national standard er en mortalitet på 12% for Indikator 10 [^src3] ([[indikator-10|Indikator 10]])
- Indikator 10 har en standard på < 18 % for 90-dages mortalitet blandt alle opererede patienter med relevant diagnose- og procedurekode [^src4] ([[indikator-10|Indikator 10]])
- Indikator 10 har udviklingsmål på < 18 % [^src5] ([[indikator-10|Indikator 10]])
- Nationalt var andelen af patienter, der døde indenfor 90 dage fra operationsdato, 16,6 % (95 % CI: 15,4–18,0) i perioden 01.09.2023 – 31.08.2024 [^src5] ([[indikator-10|Indikator 10]], [[danmark|Danmark]])
- I perioden 01.09.2023 – 31.08.2024 indgik 3.179 forløb i indikatoranalysen for Indikator 9 og Indikator 10 [^src5] ([[indikator-9|Indikator 9]], [[indikator-10|Indikator 10]])
- For Indikator 10 var antallet af døde patienter 529 ud af 3.179 forløb på nationalt plan [^src5] ([[indikator-10|Indikator 10]], [[danmark|Danmark]])
- Der indgik 3.179 patienter i indikatoranalysen for Indikator 10 i perioden [^src6] ([[indikator-10|Indikator 10]])
- Heraf døde 529 personer, svarende til 16,6 % (95 % CI: 15,4-18,0) indenfor 90 dage fra ankomst til sygehus [^src6] ([[indikator-10|Indikator 10]])
- Udviklingsmålet på < 18 % var opfyldt på nationalt niveau [^src6] ([[indikator-10|Indikator 10]])
- Regionalt varierede andelen fra 15,7 % i Region Sjælland til 19,6 % i Region Nordjylland [^src6] ([[indikator-10|Indikator 10]], [[region-sjaelland|Region Sjælland — Sjælland]], [[region-nordjylland|Region Nordjylland — Nordjylland]])
- Blandt de indberettende enheder opfyldte 15 af de 20 udviklingsmålet i perioden [^src6] ([[indikator-10|Indikator 10]])
- Ca. 30% af dødsfald efter indgreb er i perioden fra dag 30 til dag 90 [^src6] ([[indikator-10|Indikator 10]])
- Der indgik 3.179 patienter i indikatoranalysen i perioden. Heraf døde 529 personer, svarende til 16,6 % indenfor 90 dage fra ankomst til sygehus [^src7] ([[indikator-10|Indikator 10]])
- Der er en uoverensstemmelse mellem det nationale antal opererede patienter (3668) og summen af patienter med angivet ankomst- og operations-tidspunkt (2452) i forbindelse med indikator 10 [^src8] ([[indikator-10|Indikator 10]])
- Indikator 10 har et udviklingsmål på < 18 % for andelen af patienter, der dør inden for 90 dage fra operationsdato for alle opererede med relevant diagnosekode og procedurekode [^src9] ([[indikator-10|Indikator 10]])
- For perioden 01.09.2024 – 31.08.2025 er opfyldelsen af Indikator 10 på landsplan 13,7 % (95 % CI: 12,5–14,9) [^src9] ([[indikator-10|Indikator 10]], [[danmark|Danmark]])
- Rigshospitalet har en 90-dagesmortalitet på 34,8 % (95 % CI: 21,4–50,2) i Indikator 10 [^src10] ([[rigshospitalet|Rigshospitalet]], [[indikator-10|Indikator 10]])
- Hvidovre Hospital har en 90-dagesmortalitet på 8,5 % (95 % CI: 5,3–12,7) i Indikator 10 [^src10] ([[amager-og-hvidovre-hospital|Amager og Hvidovre Hospital]], [[indikator-10|Indikator 10]])
- Herlev og Gentofte Hospital har en 90-dagesmortalitet på 11,4 % (95 % CI: 7,8–15,8) i Indikator 10 [^src10] ([[herlev-og-gentofte-hospital|Herlev og Gentofte Hospital]], [[indikator-10|Indikator 10]])
- Danmark har en national 90-dagesmortalitet på 13,7 % (95 % CI: 12,5–14,9) i Indikator 10 [^src10] ([[indikator-10|Indikator 10]])
- Der indgik 3.244 patienter i indikatoranalysen i perioden. Heraf døde 444 personer, svarende til 13,7 % (95 % CI: 12,5-14,9) indenfor 90 dage fra ankomst til sygehus [^src11] ([[indikator-10|Indikator 10]])
- Således var udviklingsmålet på < 18 % opfyldt på nationalt niveau [^src11] ([[indikator-10|Indikator 10]])
- Regionalt varierede andelen fra 12,5 % i Region Nordjylland til 15,2 % i Region Syddanmark [^src11] ([[region-nordjylland|Region Nordjylland — Nordjylland]], [[region-syddanmark|Region Syddanmark — Syddanmark]], [[indikator-10|Indikator 10]])
- Alle regioner opfyldte altså også udviklingsmålet i perioden [^src11] ([[indikator-10|Indikator 10]])
- Blandt de indberettende enheder opfyldte 19 af de 20 udviklingsmålet i perioden [^src11] ([[indikator-10|Indikator 10]])
- En væsentlig andel af dødsfaldene – ca. 30 % – forekommer i perioden fra dag 30 til dag 90 efter indgrebet [^src11] ([[indikator-10|Indikator 10]])
- Udviklingsmålet bør sænkes til 15% på baggrund af national succes over de sidste 5 år, dette forventes fra rapport 2026 [^src11] ([[indikator-10|Indikator 10]])
- Der indgik 3.244 patienter i indikatoranalysen i perioden. Heraf døde 444 personer, svarende til 13,7 % indenfor 90 dage fra ankomst til sygehus [^src12] ([[indikator-10|Indikator 10]])

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 46-50
[^src3]: AKDB_2023.pdf, pages 51-55
[^src4]: AKDB_2024.pdf, pages 6-10
[^src5]: AKDB_2024.pdf, pages 51-55
[^src6]: AKDB_2024.pdf, pages 56-60
[^src7]: AKDB_2024.pdf, pages 96-100
[^src8]: AKDB_2024.pdf, pages 101-105
[^src9]: AKDB_2025.pdf, pages 6-10
[^src10]: AKDB_2025.pdf, pages 51-55
[^src11]: AKDB_2025.pdf, pages 56-60
[^src12]: AKDB_2025.pdf, pages 106-110

