---
title: Eksklusion
type: comparison
wiki: rkkp-akdb
updated: '2026-08-03T16:38:33.790Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: >-
      1-5, 11-15, 26-30, 31-35, 36-40, 41, 41-45, 46-50, 51-55, 56-60, 6-10,
      61-65, 66-70, 71-75, 76-80, 81-85, 86-90
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: >-
      1-5, 36-40, 51-55, 56-60, 61-65, 66-70, 67, 70, 71-75, 76-80, 81-85,
      86-90, 91-95, 96-100
tags:
  - comparison
---

## Table: AKDB_2023.pdf, p. 41

Rows compare: årsager til eksklusion · Columns show: antal patienter

| Antal | Årsag |
| --- | --- |
| 53 | Ugyldigt CPRnummer. |
| 172 | Patienten er under 18 år. |
| 6.186 | Patienten er ikke opereret. |
| 473 | Operationen er ikke den første operation i hospitalsopholdet. |

Entities: [[akut-kirurgi-databasen|Akut Kirurgi Databasen]], [[cpr-nummer|CPR-nummer]]

Summary: Tabellen viser antallet af ekskluderede patienter fordelt på fire årsager; den klart største gruppe er de 6.186 patienter, der ikke er opereret. [^src1]

## Table: AKDB_2024.pdf, p. 67

Rows compare: eksklusionsårsager · Columns show: antal patienter

| Antal | Årsag |
| --- | --- |
| 75 | Ugyldigt CPRnummer. |
| 197 | Patienten er under 18 år. |
| 6.238 | Patienten er ikke opereret. |
| 6 | Patienten er registreret i CPR-registeret som 'Inaktiv, uden bopæl i dansk/grønlandsk folkeregister men tildelt personnummer af skattehensyn (kommunekoderne 0010, 0011, 0012 og 0019)' |
| 493 | Operationen er ikke den første operation i hospitalsopholdet. |
| 2.035 | Patientens Charlson Comorbiditets indeks = 0 eller > 2 |

Entities: [[cpr-nummer|CPR-nummer]], [[cpr-registeret|CPR-registeret]], [[charlson-score|Charlson Score]], supplerende-indikator-9b

Summary: Tabellen opgør eksklusionsårsagerne forud for analysen for supplerende indikator til indikator 9b, hvor ikke-opererede patienter (6.238) og patienter med Charlson-indeks 0 eller over 2 (2.035) udgør langt de største grupper. [^src2]

## Table: AKDB_2024.pdf, p. 70

Rows compare: eksklusionsårsager · Columns show: antal patienter

| Antal | Årsag |
| --- | --- |
| 75 | Ugyldigt CPRnummer. |
| 197 | Patienten er under 18 år. |
| 6.238 | Patienten er ikke opereret. |
| 6 | Patienten er registreret i CPR-registeret som 'Inaktiv, uden bopæl i dansk/grønlandsk folkeregister men tildelt personnummer af skattehensyn (kommunekoderne 0010, 0011, 0012 og 0019)' |
| 493 | Operationen er ikke den første operation i hospitalsopholdet. |
| 2.468 | Patientens Charlson Comorbiditets indeks = 0 eller > 2 |

Entities: [[cpr-nummer|CPR-nummer]], [[cpr-registeret|CPR-registeret]], [[charlson-score|Charlson Score]], supplerende-indikator-9c

Summary: Tabellen opgør eksklusionsårsagerne forud for analysen for supplerende indikator til 9c, hvor ikke-opererede patienter (6.238) er den største gruppe, og 2.468 ekskluderes på grund af Charlson Comorbiditets indeks = 0 eller > 2. [^src3]

## Related comparisons in prose

- "Opgørelsesperioden for årsrapporten er 1. september 2022 – 31. august 2023" — see [[temporal|Temporal]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src4]
- "Rapporten blev offentliggjort 29.02.2024" — see [[temporal|Temporal]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src4]
- "Opgørelsesperioden for årsrapporten er 1. september 2023 – 31. august 2024" — see [[temporal|Temporal]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src5]
- "Årsrapporten blev offentliggjort 28.02.2025" — see [[temporal|Temporal]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src5]
- "Databasen fokuserer på populationen, der har en inklusionsoperation og har inklusionsdiagnose" — see [[methodological|Methodological]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src4]
- "Der er enighed om, at de enkelte indikatorer er udsagn om kvalitet i patientforløbene" — see [[methodological|Methodological]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src4]
- "Det nye i årets rapport er deling af population i en perforation/iskæmi/blødnings del og en Ileus del" — see [[methodological|Methodological]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src4]
- "B-diagnoser inkluderes på lige fod med a-diagnoser i populationsdannelsen" — see [[methodological|Methodological]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src6]
- "Populationsdannelse udvides med koderne KJAK01*, KJAK03* og KJAK04*" — see [[methodological|Methodological]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src6]
- "NAAZ2 (Anæstesiologisk præoperativ optimering) er indført for at sikre, patienterne optimeres præoperativt" — see [[methodological|Methodological]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src6]
- "Charlson Scoren ønskes indført, sådan at mortalitetsindikatorerne kan opdeles baseret på komorbiditet" — see [[methodological|Methodological]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src6]
- "Eksklusionskriterier for indikatoranalysen omfattede 53 patienter med ugyldigt CPR-nummer, 172 patienter under 18 år, 6.186 patienter der ikke var opereret, 5 patienter registreret som inaktive i CPR-registeret, 473 patienter hvor operationen ikke var den første under hospitalsopholdet, og 2.395 patienter med Charlson Comorbiditets indeks = 0 eller > 2" — see [[methodological|Methodological]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src7]
- "Databasen er under omlægning og dette er fjerde år baseret på LPR" — see [[operational|Operational]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src4]
- "Det blev på styregruppens årsmøde i 2018 besluttet at dette var det sidste år med monitorering af blødenede ulcera, fordi der på nationalt niveau har været en tilfredsstillende høj kvalitet i behandlingen og lav mortalitet" — see [[operational|Operational]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src4]
- "Overordnet set, er årets resultater udtryk for en positiv udvikling for alle indikatorer" — see [[outcome|Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src4]
- "Den flotte udvikling indenfor procesindikatorerne er afspejlet i mortaliteten, der fortsat er faldende" — see [[outcome|Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src4]
- "Indikator 1 måler andelen af patienter, der er sat i antibiotisk behandling indenfor 3 time (180 minutter) efter ankomst til sygehus med en standard på > 90 %" — see [[clinical-indicator|Clinical Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src8]
- "Indikator 3 måler andelen af CT-skannede patienter, der får lavet CT-skanning indenfor 120 minutter efter ankomst til sygehus med en standard på ≥ 90 %" — see [[clinical-indicator|Clinical Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src8]
- "Indikator 4 måler præoperativ optimering eller direkte til operation med en standard på ≥ 90 %" — see [[clinical-indicator|Clinical Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src8]
- "Indikator 5 måler andelen af patienter, der opereres indenfor seks timer (360 minutter) efter ankomst til sygehus for patienter, der er opereret indenfor 24 timer efter ankomst til sygehus med en standard på ≥ 80 %" — see [[clinical-indicator|Clinical Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src8]
- "Indikator 6 måler andelen af ældre (>= 75 år) eller svært syge (ASA >= 3) patienter, der monitoreres >= 24 timer postoperativt på et intermediært afsnit eller et lignende afsnit" — see [[clinical-indicator|Clinical Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src8]
- "Indikator 7 måler andelen af patienter, der mobiliseres indenfor 24 timer efter operation med en standard på ≥ 90 %" — see [[clinical-indicator|Clinical Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src8]
- "Indikator 8 måler andelen af patienter, der genoptager ernæring indenfor 48 timer efter operation" — see [[clinical-indicator|Clinical Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src8]
- "Indikator 9 måler andelen af patienter, der har fået anlagt epidural i forbindelse med operationen med en standard på > 60 %" — see [[clinical-indicator|Clinical Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src8]
- "Indikator 10 måler andelen af patienter, der dør indenfor 30 dage fra operationsdato for alle opererede (med relevant diagnosekode og procedurekode) med en standard på < 15 %" — see [[clinical-indicator|Clinical Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src8]
- "Indikator 11 måler andelen af patienter, der dør indenfor 90 dage fra operationsdato for alle opererede (med relevant diagnosekode og procedurekode) med en standard på < 20 %" — see [[clinical-indicator|Clinical Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src8]
- "I alt 617 af de 3.147 opererede patienter i opgørelsesperioden fik taget stilling til ernæring indenfor 48 timer efter operation, svarende til 19,6 % nationalt (95 % CI: 18,2-21,0)" — see [[clinical-indicator|Clinical Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src9]
- "Supplerende indikator til 10a beskriver andelen af patienter, der dør indenfor 30 dage fra tidspunkt for operation, for patienter med Charlson Score 0, svarende til ingen registreret komorbiditet" — see [[clinical-indicator|Clinical Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src10]
- "Supplerende indikator til Indikator 10c beskriver andelen af patienter, der dør indenfor 30 dage fra tidspunkt for operation, for patienter med Charlson Score ≥ 3, svarende til høj registreret komorbiditet" — see [[clinical-indicator|Clinical Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src11]
- "I alt 1.133 af de 3.185 opererede patienter i opgørelsesperioden blev mobiliserede indenfor 24 timer efter operation, svarende til at 35,6 % nationalt blev mobiliserede indenfor 24 timer efter operation (95 % CI: 33,9-37,3)" — see [[clinical-indicator|Clinical Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src12]
- "Supplerende indikator til indikator 9c beskriver andelen af patienter, der dør indenfor 30 dage fra tidspunkt for operation, for patienter med Charlson Score ≥ 3, svarende til høj registreret komorbiditet" — see [[clinical-indicator|Clinical Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]], [[charlson-score|Charlson Score]]) [^src13]
- "Andelen af patienter, der er opereres inden for 6-8 timer efter ankomst til sygehus for patienter med en diagnose for perforation, iskæmi eller postoperativ intraabdominal blødning, og som er opereret før 48 t, var 21,7% (95% CI: 19,0-24,6) på nationalt niveau i perioden 01.09.2023 - 31.08.2024" — see [[clinical-indicator|Clinical Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src14]
- "Andelen af patienter, der er opereres inden for 8-10 timer efter ankomst til sygehus for patienter med en diagnose for perforation, iskæmi eller postoperativ intraabdominal blødning, og som er opereret før 48 t, var 12,8% (95% CI: 10,6-15,2) på nationalt niveau i perioden 01.09.2023 - 31.08.2024" — see [[clinical-indicator|Clinical Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src14]
- "Ca. 31 % af patienterne får antibiotika indenfor tre timer efter ankomst til sygehuset" — see [[clinical-performance|Clinical Performance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "50 % af patienterne har fået antibiotika indenfor 5 timer" — see [[clinical-performance|Clinical Performance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "CT-skanning skete for 25,9 % af de patienter, der blev skannet i årsrapporten" — see [[clinical-performance|Clinical Performance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "215 patienter fik enten præoperativ optimering eller gik direkte til operation, hvilket svarer til 7 %" — see [[clinical-performance|Clinical Performance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "Ca. 26 % (525 patienter) blev opereret indenfor 6 timer efter ankomst til sygehuset blandt dem opereret indenfor 24 timer" — see [[clinical-performance|Clinical Performance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "Ca. 19 % af disse patienter (344 patienter) lå på intermediært afsnit i mindst 24 timer" — see [[clinical-performance|Clinical Performance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "28 % af patienterne har været ude af sengen indenfor 24 timer efter operationen" — see [[clinical-performance|Clinical Performance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "20 % af patienterne har fået taget stilling til ernæring indenfor 48 timer efter operationen" — see [[clinical-performance|Clinical Performance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "Ca. 53 % af patienterne fik epidural som smertedækning" — see [[clinical-performance|Clinical Performance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "11 % af patienterne er døde indenfor 30 dage efter operationen" — see [[clinical-performance|Clinical Performance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "15 % af patienterne er døde indenfor 90 dage efter operationen" — see [[clinical-performance|Clinical Performance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "I Danmark var der i alt 3.785 opererede patienter i perioden 01/09/2023 - 31/08/2024 med en median alder på 70,00 år" — see [[patient-volume|Patient Volume]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src16]
- "I AKDB-rapporteringen blev 53 patienter ekskluderet på grund af ugyldigt CPR-nummer" — see [[data-quality|Data Quality]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src8]
- "I AKDB-rapporteringen blev 170 patienter ekskluderet fordi de var under 18 år" — see [[data-quality|Data Quality]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src8]
- "I AKDB-rapporteringen blev 6.190 patienter ekskluderet fordi de ikke var opereret" — see [[data-quality|Data Quality]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src8]
- "I AKDB-rapporteringen blev 200 patienter ekskluderet fordi præoperativ antibiotikaprofylakse ikke var givet" — see [[data-quality|Data Quality]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src8]
- "I AKDB-rapporteringen blev 470 patienter ekskluderet fordi operationen ikke var den første operation i hospitalsopholdet" — see [[data-quality|Data Quality]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src8]
- "Patienter uden gyldigt CPR-nummer, patienter under 18 år på operationstidspunktet, patienter med inaktivt CPR-nummer er ekskluderede" — see [[data-quality|Data Quality]] ([[cpr-registeret|CPR-registeret]]) [^src17]
- "6 patienter ekskluderet fordi patienten er registreret i CPR-registeret som 'Inaktiv, uden bopæl i dansk/grønlandsk folkeregister men tildelt personnummer af skattehensyn'" — see [[data-quality|Data Quality]] ([[cpr-registeret|CPR-registeret]]) [^src17]
- "75 patienter blev ekskluderet på grund af ugyldigt CPR-nummer" — see [[data-quality|Data Quality]] ([[cpr-nummer|CPR-nummer]]) [^src18]
- "6 patienter blev ekskluderet fordi de var registreret i CPR-registeret som 'Inaktiv, uden bopæl i dansk/grønlandsk folkeregister men tildelt personnummer af skattehensyn'" — see [[data-quality|Data Quality]] ([[cpr-nummer|CPR-nummer]]) [^src18]
- "1.855 patienter blev ekskluderet fordi deres Charlson Comorbiditets indeks var > 0" — see [[data-quality|Data Quality]] ([[charlson-score|Charlson Score]]) [^src18]
- "75 patienter blev ekskluderet på grund af ugyldigt CPR-nummer" — see [[data-quality|Data Quality]] ([[cpr-registeret|CPR-registeret]]) [^src19]
- "6 patienter blev ekskluderet fordi de var registreret i CPR-registeret som 'Inaktiv, uden bopæl i dansk/grønlandsk folkeregister men tildelt personnummer af skattehensyn'" — see [[data-quality|Data Quality]] ([[cpr-registeret|CPR-registeret]]) [^src19]
- "2.468 patienter blev ekskluderet fordi deres Charlson Comorbiditets indeks var = 0 eller > 2" — see [[data-quality|Data Quality]] ([[charlson-score|Charlson Score]]) [^src19]
- "Indikatorresultater, hvor der kun optræder n = 1 eller n = 2 i enten tæller eller nævner, vil af diskretionshensyn blive fjernet og erstattet med # samt en forklaringsnote" — see [[data-quality|Data Quality]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src14]
- "Populationen er valideret ved at afdelinger har fået tilsendt lister med CPR-numre og de procedurer, der er registreret i databasen" — see [[data-quality|Data Quality]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src20]
- "I alt 900 patienter modtog antibiotika indenfor 3 timer ud af de 2.950 med angivet operationstidspunkt" — see [[clinical-outcome|Clinical Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Andelen af patienter der modtog antibiotika indenfor 3 timer var således på 30,5 % (95 % CI: 28,8-32,2), hvilket er langt fra standarden på > 90 %" — see [[clinical-outcome|Clinical Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "99 ud af 2.738 patienter fik antibiotika indenfor en time, svarende til 3,6 % i seneste årsrapport" — see [[clinical-outcome|Clinical Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Andelen for forrige periode er 5,1 %, hvilket indikerer at indberetningen er forbedret bagud i tid" — see [[clinical-outcome|Clinical Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Givet antibiotika indenfor en time for 7,9 % af patienterne i indeværende periode" — see [[clinical-outcome|Clinical Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "De fleste regioner har større andel med antibiotika indenfor tre timer i år sammenlignet med sidste år" — see [[clinical-outcome|Clinical Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Ingen af de indberettende enheder opfyldte standarden på > 90 % i perioden" — see [[clinical-outcome|Clinical Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "3.379 patienter i alt modtog antibiotika. Den mediane tid fra ankomst til antibiotika var 5 timer (IQR: 2-13)" — see [[clinical-outcome|Clinical Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "På nationalt plan er der sket forbedringer af andelen af patienter, der er sat i antibiotisk behandling, men 30,5 % er stadig langt fra målet på 90 %" — see [[clinical-outcome|Clinical Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "I alt 3.027 patienter blev skannede, og heraf blev 911 skannede indenfor to timer, svarende til en andel på 30,1 % (95 % CI 28,5-31,8) nationalt" — see [[clinical-outcome|Clinical Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Standarden på ≥ 90 % var således ikke opfyldt" — see [[clinical-outcome|Clinical Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Standarden på ≥ 90 % er således langt fra opnået" — see [[clinical-outcome|Clinical Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Resultatet nationalt viser at 30,1 % af patienterne er scannet inden for 2 timer. Det er en pæn stigning ift. foregående år" — see [[clinical-outcome|Clinical Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "I alt 914 af de 3.147 opererede patienter i opgørelsesperioden blev mobiliserede indenfor 24 timer efter operation, svarende til at 29,0 % nationalt blev mobiliserede indenfor 24 timer efter operation (95 % CI: 27,5-30,7)" — see [[clinical-outcome|Clinical Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src22]
- "617 af 3.147 patienter (19,6 %, 95 % CI: 18,2-21,0) havde taget stilling til ernæring indenfor 48 timer efter operation nationalt" — see [[clinical-outcome|Clinical Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src22]
- "Ud af de 3.147 opererede i perioden, blev 1.667 bedøvede med epidural. Det svarer til en andel på 53,0 % (95 % CI: 51,2-54,7)" — see [[clinical-outcome|Clinical Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src23]
- "For supplerende indikator til indikator 10c (Mortalitet indenfor 30 dage efter akut kirurgi, Charlson Score ≥ 3) indgik 1.086 patienter i indikatoranalysen i perioden, heraf døde 11,2 % (95 % CI: 9,4-13,3) indenfor 30 dage fra operation" — see [[clinical-outcome|Clinical Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src7]
- "Overordnet set er årets resultater udtryk for en positiv udvikling for alle procesindikatorer" — see [[clinical-outcome|Clinical Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src5]
- "Der indgik 711 patienter i indikatoranalysen i perioden. Heraf døde 151, svarende til 21,2 % (95 % CI: 18,3-24,4) indenfor 30 dage fra operation" — see [[clinical-outcome|Clinical Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src13]
- "I 3 prospektive kohorte studier og et retrospektivt beskriver at CT-abdomen med kontrast hjælper til den korrekte diagnose hurtigere og er et godt værktøj for kirurgen til at planlægge patientens videre forløb" — see [[clinical-evidence|Clinical Evidence]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Det er en ressource der medfører en større sikkerhed i bestemmelse af hvilke patienter der har behov for operation, hvem der kan behandles konservativt, eller hvem der kan udskrives" — see [[clinical-evidence|Clinical Evidence]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Det er beskrevet at patienter der får foretaget CT med kontrast ved indlæggelse har en kortere indlæggelsestid" — see [[clinical-evidence|Clinical Evidence]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "I forhold til tidspunktet for CT-scanning med kontrast er der ikke fundet forskning der direkte understøtter et specifik tidsrum hvori der bør foretages CT" — see [[clinical-evidence|Clinical Evidence]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Det er i et amerikansk studie vist at ventetid på CT udgør ca. 30% af ventetid for patienter henvist til en akutmodtagelse" — see [[clinical-evidence|Clinical Evidence]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Kortere tid til CT-scanning er vist effektiv i 'care bundles' og har formentligt en andel i at nedsætte mortaliteten i disse protokollerede forløb" — see [[clinical-evidence|Clinical Evidence]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Det anbefales at man iværksætter antibiotika hurtigst muligt på patienter mistænkt for ileus, perforeret hulorgan eller iskæmi, uanset om der er feber eller påvirkede infektionstal" — see [[clinical-recommendation|Clinical Recommendation]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Det væsentlige er, om patienterne får antibiotika inden operation" — see [[clinical-recommendation|Clinical Recommendation]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Nationalt skal der fokus på overholdelse af denne indikator" — see [[clinical-recommendation|Clinical Recommendation]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Det anbefales at alle patienter med mistanke om tarm iskæmi, perforeret hulorgan eller ileus gennemgår CT scanning med kontrast så hurtigt som muligt i deres indlæggelsesforløb" — see [[clinical-recommendation|Clinical Recommendation]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Dette for at opnå større sikkerhed i diagnose og for at kunne planlægge evt. operation så hurtigt som muligt" — see [[clinical-recommendation|Clinical Recommendation]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Såfremt patienterne har akut behov for operation og ventetid på CT vil være en forværrende faktor anbefales det at patienten ikke CT scannes men derimod opereres i stedet" — see [[clinical-recommendation|Clinical Recommendation]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Vi anbefaler at CT udføres så tidligt som muligt og at denne scanning prioriteres højt af radiologisk afdeling for at undgå ventetider hos denne patientgruppe med høj mortalitet" — see [[clinical-recommendation|Clinical Recommendation]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "CT-scanning bør startes indenfor 2 timer da vi ønsker at disse patienter opereres indenfor 6 timer efter indlæggelse" — see [[clinical-recommendation|Clinical Recommendation]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Det anbefales at alle hospitaler fortsat arbejder systematisk imod at 90% er scannet inden for 2 timer og bygger videre på de gode erfaringer og processer fra LKT Akutkirurgi" — see [[clinical-recommendation|Clinical Recommendation]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Regionerne og hospitalerne bør sikre CT kapacitet til den akutte patients udredning" — see [[clinical-recommendation|Clinical Recommendation]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Der er behov for en diskussion af prioritering af radiologisk kapacitet, men dette er uden for databasens arbejdsområde og det er en opfordring til andre fora tager diskussionen op" — see [[clinical-recommendation|Clinical Recommendation]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Det er logistisk svært at nå at indgive antibiotika inden for en time grundet det arbejde, der er i forbindelse med modtagelse af en patient. Fx vil en CT-skanning altid blive prioriteret før indgift af antibiotika" — see [[clinical-observation|Clinical Observation]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Figuren viser, at der ikke er væsentlig forskel på patienternes alder, regionerne imellem" — see [[clinical-observation|Clinical Observation]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src24]
- "Det blev sidste år vedtaget, at tid for indgift fremadrettet skulle ændres til 3 timer i stedet for 1 time, som det har været tidligere" — see [[policy-change|Policy Change]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Standard ændres til 60 % idet lokale audits har fundet, at mange patienter ikke er septiske" — see [[policy-change|Policy Change]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Tidsgrænsen fastholdes på 3 timer efter ankomst ud fra argumentet, at det er en afvejning for at undgå forsinkelse af CT-skanning" — see [[policy-decision|Policy Decision]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src21]
- "Der var i alt 1.133 patienter, der blev opereret indenfor 24 timer efter ankomst til sygehus, og hvor diagnosen er perforation, iskæmi eller blødning" — see [[statistical|Statistical]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src25]
- "Heraf blev 236 opereret indenfor 6 timer, svarende til en andel på 20,8 % (95 % CI: 18,5-23,3)" — see [[statistical|Statistical]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src25]
- "Der var i alt 2.000 patienter, der blev opereret indenfor 24 timer efter ankomst til sygehus, og hvor diagnosen ikke er perforation, iskæmi eller blødning" — see [[statistical|Statistical]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src25]
- "Heraf blev 294 opereret indenfor 6 timer, svarende til en andel på 14,7 % (95 % CI: 13,2-16,3)" — see [[statistical|Statistical]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src25]
- "Der er registreret postoperativ høj mortalitetsrisiko for 1.801 patienter i perioden" — see [[statistical|Statistical]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src26]
- "Andelen med høj mortalitetsrisiko, og som efterfølgende blev indlagt på et intermediært eller lignende afsnit, er 19,2 % (95 % CI: 17,4-21,1), svarende til 346 patienter" — see [[statistical|Statistical]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src26]
- "Der indgik 3.142 forløb i indikatoranalysen for Indikator 10 i perioden" — see [[statistical|Statistical]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src27]
- "Der indgik 3.142 patienter i indikatoranalysen i perioden" — see [[statistical|Statistical]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src6]
- "15,1 % (95 % CI: 13,8-16,4) af patienterne døde indenfor 90 dage fra ankomst til sygehus" — see [[statistical|Statistical]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src6]
- "Ca. 30% af dødsfald efter indgreb er i perioden fra dag 30 til dag 90" — see [[statistical|Statistical]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src6]
- "Den mediane tid fra ankomst til sygehus og frem til modtagelse af antibiotika er 5 timer nationalt" — see [[statistical|Statistical]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src6]
- "Der var 1,7 % operationer med koden DK65*, hvorfor den ikke blev fjernet fra databasens population" — see [[statistical|Statistical]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src6]
- "I 2019-2020 var gennemsnitsalderen i begge grupper (opererede vs ikke-opererede) 66 år" — see [[statistical|Statistical]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src6]
- "I 2020-2021 var gennemsnitsalderen også 66 år i begge grupper" — see [[statistical|Statistical]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src6]
- "Danmark havde 3.613 opererede (36,90 %) og 6.178 ikke-opererede (63,10 %) i alt 9.791 patienter" — see [[statistical|Statistical]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src6]
- "Blandt opererede patienter var 159 (5,05 %) med gastrointestinale kræftsygdomme" — see [[statistical|Statistical]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src6]
- "Blandt opererede patienter var 15 (0,48 %) med gynækologiske kræftsygdomme" — see [[statistical|Statistical]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src6]
- "I perioden 01/09/2020 - 31/08/2021 blev der registreret 2.784 opererede patienter i Danmark med 580 uoplyste ASA-scores" — see [[statistical|Statistical]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src28]
- "I perioden 01/09/2021 - 31/08/2022 blev der registreret 3.093 opererede patienter i Danmark med 515 uoplyste ASA-scores" — see [[statistical|Statistical]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src28]
- "I perioden 01/09/2022 - 31/08/2023 blev der registreret 3.168 opererede patienter i Danmark med 445 uoplyste ASA-scores" — see [[statistical|Statistical]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src28]
- "Kontakter registreret på afdelinger med følgende specialer, jf. SOR, er ekskluderet: Gynækologi og obstetrik og Urologi" — see [[exclusion-criteria|Exclusion Criteria]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "Kontakter registreret på afdelinger med specialerne Gynækologi og obstetrik samt Urologi ekskluderes fra AKDB" — see [[exclusion-criteria|Exclusion Criteria]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src20]
- "Alle hospitaler i Danmark har en dødelighed inden for samme sikkerhedsinterval" — see [[quality-standard|Quality Standard]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src27]
- "Standarden på ≥ 90 % ikke opfyldt på nationalt niveau" — see [[performance|Performance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src25]
- "Ingen af de indberettende enheder opfyldte standarden i perioden" — see [[performance|Performance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src25]
- "Standarden på ≥ 90 % ikke opfyldt på nationalt niveau" — see [[performance|Performance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src25]
- "Ingen af de indberettende enheder opfyldte standarden i perioden" — see [[performance|Performance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src25]
- "Standarden på < 20 % var opfyldt på nationalt niveau" — see [[performance|Performance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src6]
- "Alle regioner opfyldte standarden i perioden" — see [[performance|Performance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src6]
- "16 af de 21 indberettende enheder opfyldte standarden i perioden" — see [[performance|Performance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src6]
- "Alle Regioner har oplevet bedring i overlevelse de forrige 2 år" — see [[performance|Performance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src6]
- "Udviklingen over tid viser, registreringen for indikatoren er forbedret over de seneste to årsrapportperioder" — see [[trend|Trend]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src22]
- "AKDB foreslår, at der fremadrettet anvendes SOR koder til at afgøre, om en højrisikopatient har haft ophold de første 24 timer postoperativt på en afdeling med et behandlingsniveau niveau højere end en almindelig sengeafdeling" — see [[recommendation|Recommendation]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src26]
- "Styregruppen anbefaler, koden for 'ingen indikation for tidlig mobilisering' anvendes i relevante tilfælde" — see [[recommendation|Recommendation]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src22]
- "Ingen af de indberettende enheder opfyldte standarden på ≥ 90 %" — see [[standard-compliance|Standard Compliance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src22]
- "Hovedstaden havde 32,4 % (354 / 1.093) patienter hvor der var taget stilling til ernæring indenfor 48 timer" — see [[regional-outcome|Regional Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src22]
- "Syddanmark havde 0,2 % patienter hvor der var taget stilling til ernæring indenfor 48 timer" — see [[regional-outcome|Regional Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src22]
- "Mobilisering registreres i LPR ved at angive koderne ZZP0030A (tidlig mobilisering påbegyndt) og ZZP0030C (vurderet ingen indikation for tidlig mobilisering)" — see [[methodology|Methodology]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src22]
- "Diagnoser til brug i beregning af Charlson Score er hentet 10 år tilbage i tid" — see [[methodology|Methodology]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src10]
- "Diagnoser til brug i beregning af Charlson Score er hentet 10 år tilbage i tid" — see [[methodology|Methodology]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src11]
- "Indikatorsættet er udvalgt med udgangspunkt i en dokumentalistrapport" — see [[methodology|Methodology]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "Der beregnes 95 % konfidensinterval for indikatorresultatet i aktuelle opgørelsesperiode" — see [[methodology|Methodology]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "Patientforløb i AKDB dannes ved at samle alle LPR kontakter som på hinanden følgende er ≤ 4 timer mellem hinanden" — see [[methodology|Methodology]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "Enheden for analyser i indikatorerne altid er forløb. Dvs, hvis den samme patient har fået flere operationer, vil kun den første operation være gældende i indikatorberegningen" — see [[methodology|Methodology]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "Populationsdannelse udvides med koderne KJAK01*, KJAK03* og KJAK04* fordi det er procedurer, der på nogle sygehuse anvendes i behandlingen af de relevante patienter" — see [[methodology|Methodology]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src30]
- "Der var 1,7 % operationer med koden DK65*, hvorfor den ikke blev fjernet fra databasens population" — see [[methodology|Methodology]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src30]
- "Diagnoser til brug i beregning af Charlson Score er hentet 10 år tilbage i tid" — see [[methodology|Methodology]] ([[charlson-score|Charlson Score]]) [^src13]
- "Indikatorsættet er udvalgt med udgangspunkt i en dokumentalistrapport" — see [[methodology|Methodology]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src14]
- "Resultatet er et udtryk for registreringen, og ikke nødvendigvis for den faktiske praksis" — see [[methodology|Methodology]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src14]
- "Der beregnes 95 % konfidensinterval for indikatorresultatet i aktuelle opgørelsesperiode" — see [[methodology|Methodology]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src14]
- "Kontakterne identificeres i LPR gennem kontakt med fysisk fremmøde [ALCA00] og prioritet 'akut' [ATA1*]" — see [[methodology|Methodology]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src20]
- "Patientforløb i AKDB dannes ved at samle alle LPR kontakter som på hinanden følgende er ≤ 4 timer mellem hinanden" — see [[methodology|Methodology]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src20]
- "Enheden for analyser i indikatorerne altid er forløb, således hvis den samme patient har fået flere operationer, vil kun den første operation være gældende i indikatorberegningen" — see [[methodology|Methodology]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src20]
- "Anbefalingen er, at CT-skanning skal ske indenfor to timer efter ankomst til sygehuset" — see [[clinical-guideline|Clinical Guideline]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "Populationen omfatter alle patienter der behandles med akut højrisiko abdominalkirurgi på danske sygehuse" — see [[definition|Definition]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "Standarden for indikator 9 er i år ændret til > 60 %" — see [[standard-change|Standard Change]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src23]
- "Indikatoren blev i 2022 ændret fra 90% til 60% idet mange patienter er komorbide og får AK behandling, hvilket kan kontraindicere epidural anlæggelse i operationsdøgnet" — see [[standard-change|Standard Change]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src23]
- "I alt syv af de 21 indberettende enheder opfyldte standarden i perioden" — see [[compliance|Compliance]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src23]
- "Kort før jul 2022 modtog AKDB godkendelsen fra SDS på at anvende koden BABZ00 fra LPR" — see [[regulatory-approval|Regulatory Approval]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src23]
- "Ud af 3.142 opererede i perioden 01.09.2022 - 31.08.2023 døde 356 indenfor 30 dage, svarende til 11,3 % (95 % CI: 10,2-12,5)" — see [[mortality-outcome|Mortality Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src23]
- "Mortaliteten holder sig under målet" — see [[mortality-outcome|Mortality Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src5]
- "Rigshospitalet havde 4 dødsfald ud af 17 patienter (23,5 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3 i perioden 01.09.2023 - 31.08.2024" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Sjælland region havde 23 dødsfald ud af 128 patienter (18,0 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Holbæk Sygehus havde 9 dødsfald ud af 25 patienter (36,0 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Næstved, Slagelse og Ringsted sygehuse havde 6 dødsfald ud af 38 patienter (15,8 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Sjællands Universitetshospital havde 8 dødsfald ud af 65 patienter (12,3 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Syddanmark region havde 33 dødsfald ud af 158 patienter (20,9 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Esbjerg Sygehus Grindsted Sygehus havde 9 dødsfald ud af 45 patienter (20,0 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Odense Universitetshospital - Svendborg havde 15 dødsfald ud af 70 patienter (21,4 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Sygehus Lillebælt havde 4 dødsfald ud af 20 patienter (20,0 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Sygehus Sønderjylland havde 5 dødsfald ud af 23 patienter (21,7 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Midtjylland region havde 40 dødsfald ud af 152 patienter (26,3 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Aarhus Universitetshospital havde 10 dødsfald ud af 37 patienter (27,0 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Hospitalsenhed Midt havde 7 dødsfald ud af 28 patienter (25,0 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Regionshospitalet Gødstrup havde 11 dødsfald ud af 37 patienter (29,7 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Regionshospitalet Horsens havde 6 dødsfald ud af 25 patienter (24,0 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Regionshospitalet Randers havde 6 dødsfald ud af 25 patienter (24,0 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Nordjylland region havde 13 dødsfald ud af 48 patienter (27,1 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Aalborg Universitetshospital havde 8 dødsfald ud af 32 patienter (25,0 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Regionshospital Nordjylland havde 5 dødsfald ud af 16 patienter (31,3 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Danmark havde 151 dødsfald ud af 711 patienter (21,2 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3 i perioden 01.09.2023 - 31.08.2024" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Hovedstaden region havde 42 dødsfald ud af 225 patienter (18,7 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Amager og Hvidovre Hospital havde 10 dødsfald ud af 52 patienter (19,2 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Bispebjerg og Frederiksberg Hospital havde 6 dødsfald ud af 45 patienter (13,3 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Bornholms Hospital havde 0 dødsfald ud af et uspecificeret antal patienter (0,0 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Herlev og Gentofte Hospital havde 17 dødsfald ud af 72 patienter (23,6 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Hospitalerne i Nordsjælland havde 5 dødsfald ud af 37 patienter (13,5 %) indenfor 30 dage efter akut kirurgi blandt patienter med Charlson Score ≥ 3" — see [[mortality-outcome|Mortality Outcome]] ([[charlson-score|Charlson Score]]) [^src19]
- "Der indgik 3.179 forløb i indikatoranalysen for 30-dages mortalitet. Heraf døde 376 personer, svarende til 11,8 % (95 % CI: 10,7-13,0) indenfor 30 dage fra ankomst til sygehus" — see [[mortality-outcome|Mortality Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Der indgik 3.179 patienter i indikatoranalysen for 90-dages mortalitet. Heraf døde 529 personer, svarende til 16,6 % indenfor 90 dage fra ankomst til sygehus" — see [[mortality-outcome|Mortality Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Mortaliteten er steget i perioden, trods det at procesindikatorerne er forbedrede" — see [[mortality-outcome|Mortality Outcome]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Der indgik 1.309 patienter i indikatoranalysen i perioden. Heraf døde 6,4 % (95 % CI: 5,2-7,9) indenfor 30 dage fra operation" — see [[mortality-statistic|Mortality Statistic]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src10]
- "Der indgik 729 patienter i indikatoranalysen i perioden. Heraf døde 20,2 % (95 % CI: 17,3-23,3) indenfor 30 dage fra operation" — see [[mortality-statistic|Mortality Statistic]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src11]
- "I 2019-2020 var gennemsnitsalderen i begge grupper 66 år og i 2020-2021 var gennemsnitsalderen også 66 år i begge grupper" — see [[demographic|Demographic]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src30]
- "Formålet med databasen er at monitorere og forbedre kvaliteten af pleje, diagnostik og behandling af højrisiko akutte abdominalkirurgiske patienter" — see [[purpose|Purpose]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "Registrering af data til databasen foregår som indberetning til LPR" — see [[process|Process]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "DNL har aktuelt ikke data til rådighed i de nationale kvalitetsdatabaser, men når data bliver tilgængelige, vil de indgå i indikatorberegningen i AKDB" — see [[status|Status]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "Indikatorresultater, hvor der kun optræder n = 1 eller n = 2 i enten tæller eller nævner, vil af diskretionshensyn blive fjernet og erstattet med # samt en forklaringsnote i den offentliggjorte årsrapport på www.sundhed.dk" — see [[policy|Policy]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "Kontakterne identificeres i LPR. Følgende inklusionskriterier er gældende: kontakt med fysisk fremmøde [ALCA00] og prioritet: 'akut' [ATA1*] i LPR" — see [[inclusion-criteria|Inclusion Criteria]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "Denne rapport inkluderer 3.697 patienter, som blev opererede og 6.316 patienter med en relevant diagnose, men som ikke blev opererede i perioden 1. september 2022 til 31. august 2023" — see [[population-statistics|Population Statistics]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "I perioden 2022-2023 var der 10.013 patienter i alt, 3.697 opererede, 6.316 ikke-opererede, svarende til 37% opererede" — see [[population-statistics|Population Statistics]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "I perioden 2021-2022 var der 8.718 patienter i alt, 3.134 opererede, 5.584 ikke-opererede, svarende til 36% opererede" — see [[population-statistics|Population Statistics]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "I perioden 2020-2021 var der 12.389 patienter i alt, 2.600 opererede, 9.789 ikke-opererede, svarende til 21% opererede" — see [[population-statistics|Population Statistics]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "I perioden 2019-2020 var der 11.780 patienter i alt, 6.932 opererede, 4.848 ikke-opererede, svarende til 59% opererede" — see [[population-statistics|Population Statistics]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "Rapporten inkluderer 3.668 patienter, som blev opererede og 6.238 patienter med en relevant diagnose, men som ikke blev opererede i perioden 1. september 2023 til 31. august 2024" — see [[population-statistics|Population Statistics]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src20]
- "I 2023-2024 var der 9.906 patienter i alt, hvoraf 3.668 var opererede og 6.238 ikke-opererede, svarende til 37% opererede" — see [[population-statistics|Population Statistics]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src20]
- "I 2022-2023 var der 10.013 patienter i alt, hvoraf 3.697 var opererede og 6.316 ikke-opererede, svarende til 37% opererede" — see [[population-statistics|Population Statistics]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src20]
- "I 2021-2022 var der 8.718 patienter i alt, hvoraf 3.134 var opererede og 5.584 ikke-opererede, svarende til 36% opererede" — see [[population-statistics|Population Statistics]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src20]
- "I 2020-2021 var der 12.389 patienter i alt, hvoraf 2.600 var opererede og 9.789 ikke-opererede, svarende til 21% opererede" — see [[population-statistics|Population Statistics]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src20]
- "I 2019-2020 var der 11.780 patienter i alt, hvoraf 6.932 var opererede og 4.848 ikke-opererede, svarende til 59% opererede" — see [[population-statistics|Population Statistics]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src20]
- "Udtrækket til analyserne er foretaget d. 30/11-2023" — see [[data-extraction|Data Extraction]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "Udtrækket til analyserne er foretaget d. 14/11-2024" — see [[data-extraction|Data Extraction]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src20]
- "Årsrapporten fra 2022-2023 opgøres i forløb i stedet for operationer" — see [[methodology-change|Methodology Change]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "Data på population og indikatorer har været tilgængelige i de regionale ledelsesinformationssystemer (LIS) siden september 2020" — see [[availability|Availability]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "Populationen er valideret ved at afdelinger har fået tilsendt lister med CPR-numre og de procedurer, der er registreret i databasen til Region Nordjylland, Region Midtjylland, Region Syddanmark og Region Hovedstaden" — see [[validation|Validation]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "Vurderingerne blev foretaget både på CPR-niveau – altså om patienten var relevant, samt på diagnoser og procedurer, altså på om diagnoserne var ens og om de procedurer, der indgår i AKDB kunne genfindes i journalsystemerne" — see [[validation-process|Validation Process]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "Der blev ikke foretaget systematisk dataindsamling, som kan afrapporteres" — see [[limitation|Limitation]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src29]
- "Målsætningen for antibiotikabehandling indenfor 3 timer er > 90 % af patienterne" — see [[clinical-target|Clinical Target]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "Målet for CT-skanning er, at ≥ 90 % af patienter skal skannes indenfor to timer" — see [[clinical-target|Clinical Target]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "Målsætningen for præoperativ optimering eller direkte til operation er 90 %" — see [[clinical-target|Clinical Target]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "Målsætningen for operation indenfor 6 timer er ≥ 80 %" — see [[clinical-target|Clinical Target]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "Målsætningen for tidlig mobilisering er ≥ 90 %" — see [[clinical-target|Clinical Target]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "Målsætningen for epidural som smertedækning er > 60 %" — see [[clinical-target|Clinical Target]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "Målsætningen for mortalitet indenfor 30 dage er < 15 %" — see [[clinical-target|Clinical Target]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "Målsætningen for mortalitet indenfor 90 dage er < 20 %" — see [[clinical-target|Clinical Target]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "Der var 122 patienter, der ikke blev skannet" — see [[clinical-data|Clinical Data]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "I alt 3.133 patienter blev opereret" — see [[clinical-data|Clinical Data]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "Der var næsten 1.800 patienter, som havde brug for at ligge på en intermediær afdeling efter operationen" — see [[clinical-data|Clinical Data]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "Den overordnede trend viser faldende dødelighed over de seneste to perioder" — see [[clinical-trend|Clinical Trend]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src15]
- "AKDB er under omlægning og dette er fjerde år baseret på LPR" — see [[organizational|Organizational]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src5]
- "Det blev på styregruppens årsmøde i 2018 besluttet at dette var det sidste år med monitorering af blødende ulcera, fordi der på nationalt niveau har været en tilfredsstillende høj kvalitet i behandlingen og lav mortalitet" — see [[organizational|Organizational]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src5]
- "Fokus fra LKT i de forrige år har spillet positivt ind på udviklingen af procesindikatorer" — see [[organizational|Organizational]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src5]
- "Formålet med databasen er at monitorere og forbedre kvaliteten af pleje, diagnostik og behandling af højrisiko akutte abdominalkirurgiske patienter" — see [[organizational|Organizational]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src14]
- "Kun 34,4 % af patienterne fik antibiotika inden for tre timer, hvilket er langt fra målet på 90 %" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Dette er en forbedring i forhold til sidste år, hvor kun 30,5 % fik antibiotika inden for tre timer" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Kun 32,4 % af patienterne blev skannet inden for to timer, hvilket er langt fra målet på ≥ 90 %" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "I årets analyse indgår 3.172 patienter for præoperativ optimering. Af dem fik 353 den ønskede behandling, hvilket svarer til 11,1 % på landsplan" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Ingen hospitaler opfylder målet for præoperativ optimering" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Ud af 2.059 patienter, der blev opereret inden for 24 timer, blev 618 opereret inden for 6 timer. Det svarer til 30,0 % på landsplan" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Målet om, at mindst 80 % skulle opereres inden for 6 timer, blev altså ikke nået" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Ingen hospitaler opnåede målet for operation inden for 6 timer i perioden" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Ud af 2.003 patienter med høj risiko blev 459 (22,9 %) indlagt til særlig overvågning" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Der er en generel stigning i andelen af patienter, der efter operation bliver indlagt på en særlig overvågningsafdeling" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Ud af 3.185 opererede patienter blev 1.133 mobiliseret inden for 24 timer, hvilket svarer til 35,6 % på landsplan" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Målet om, at mindst 90 % skulle mobiliseres, blev altså ikke nået" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Registreringen af mobilisering er generelt blevet bedre i løbet af de seneste årsrapportperioder" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Ingen hospitaler levede op til udviklingmålet på 90 % for tidlig mobilisering" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "I alt 834 af de 3.185 opererede patienter i opgørelsesperioden fik taget stilling til ernæring indenfor 48 timer efter operation, svarende til 26,2 % nationalt" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Udviklingen over tid viser, registreringen for ernæring er forbedret over de seneste tre årsrapportperioder" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Ud af de 3.185 opererede i perioden, blev 1.661 bedøvede med epidural. Det svarer til en andel på 52,2 % (95 % CI: 50,4-53,9)" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Udviklingmålet for epidural er > 60 %, og er endnu ikke opfyldt" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Udviklingen over tid viser, der er overordnet fremgang i epidural-behandling i den aktuelle periode sammenlignet med tidligere" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Målsætningen på < 15 % for 30-dages mortalitet var opfyldt på nationalt niveau" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Alle regioner opfyldte udviklingmålet for 30-dages mortalitet i perioden" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Målet på < 20 % for 90-dages mortalitet var opfyldt på nationalt niveau" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Alle regioner opfyldte målet for 90-dages mortalitet i perioden" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Blandt de indberettende enheder opfyldte 17 af de 20 målet for 90-dages mortalitet i perioden" — see [[quality-indicator|Quality Indicator]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src31]
- "Der indgik 1.324 patienter med Charlson Score = 0 i indikatoranalysen i perioden 01.09.2023 - 31.08.2024, hvoraf 82 døde indenfor 30 dage fra operation, svarende til 6,2 % (95 % CI: 5,0-7,6)" — see [[mortality|Mortality]] ([[charlson-score|Charlson Score]]) [^src18]
- "I Hovedstaden Region døde 36 ud af 421 patienter med Charlson Score = 0 indenfor 30 dage fra operation, svarende til 8,6 % (95 % CI: 6,1-11,6)" — see [[mortality|Mortality]] ([[charlson-score|Charlson Score]]) [^src18]
- "I Sjælland Region døde 9 ud af 241 patienter med Charlson Score = 0 indenfor 30 dage fra operation, svarende til 3,7 % (95 % CI: 1,7-7,0)" — see [[mortality|Mortality]] ([[charlson-score|Charlson Score]]) [^src18]
- "I Syddanmark Region døde 17 ud af 250 patienter med Charlson Score = 0 indenfor 30 dage fra operation, svarende til 6,8 % (95 % CI: 4,0-10,7)" — see [[mortality|Mortality]] ([[charlson-score|Charlson Score]]) [^src18]
- "I Midtjylland Region døde 15 ud af 314 patienter med Charlson Score = 0 indenfor 30 dage fra operation, svarende til 4,8 % (95 % CI: 2,7-7,8)" — see [[mortality|Mortality]] ([[charlson-score|Charlson Score]]) [^src18]
- "I Nordjylland Region døde 5 ud af 98 patienter med Charlson Score = 0 indenfor 30 dage fra operation, svarende til 5,1 % (95 % CI: 1,7-11,5)" — see [[mortality|Mortality]] ([[charlson-score|Charlson Score]]) [^src18]
- "Der indgik 1.144 patienter med Charlson Score = 1 eller 2 i indikatoranalysen i perioden 01.09.2023 - 31.08.2024, hvoraf 143 døde indenfor 30 dage fra operation, svarende til 12,5 % (95 % CI: 10,6-14,6)" — see [[mortality|Mortality]] ([[charlson-score|Charlson Score]]) [^src18]
- "I Hovedstaden Region døde 40 ud af 366 patienter med Charlson Score = 1 eller 2 indenfor 30 dage fra operation, svarende til 10,9 % (95 % CI: 7,9-14,6)" — see [[mortality|Mortality]] ([[charlson-score|Charlson Score]]) [^src18]
- "I Sjælland Region døde 29 ud af 204 patienter med Charlson Score = 1 eller 2 indenfor 30 dage fra operation, svarende til 14,2 % (95 % CI: 9,7-19,8)" — see [[mortality|Mortality]] ([[charlson-score|Charlson Score]]) [^src18]
- "I Syddanmark Region døde 27 ud af 250 patienter med Charlson Score = 1 eller 2 indenfor 30 dage fra operation, svarende til 10,8 % (95 % CI: 7,2-15,3)" — see [[mortality|Mortality]] ([[charlson-score|Charlson Score]]) [^src18]
- "I Midtjylland Region døde 32 ud af 235 patienter med Charlson Score = 1 eller 2 indenfor 30 dage fra operation, svarende til 13,6 % (95 % CI: 9,5-18,7)" — see [[mortality|Mortality]] ([[charlson-score|Charlson Score]]) [^src18]
- "I Nordjylland Region døde 15 ud af 89 patienter med Charlson Score = 1 eller 2 indenfor 30 dage fra operation, svarende til 16,9 % (95 % CI: 9,8-26,3)" — see [[mortality|Mortality]] ([[charlson-score|Charlson Score]]) [^src18]
- "I perioden 01/09/2023 - 31/08/2024 blev der i Danmark i alt opereret 3.668 patienter, hvoraf 1.996 (54,42%) fik åben kirurgi og 1.672 (45,58%) fik lukket kirurgi" — see [[clinical-procedure|Clinical Procedure]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src24]
- "I perioden 01/09/2022 - 31/08/2023 blev der i Danmark i alt opereret 3.639 patienter, hvoraf 2.111 (58,01%) fik åben kirurgi og 1.528 (41,99%) fik lukket kirurgi" — see [[clinical-procedure|Clinical Procedure]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src24]
- "I perioden 01/09/2021 - 31/08/2022 blev der i Danmark i alt opereret 3.620 patienter, hvoraf 2.113 (58,37%) fik åben kirurgi og 1.507 (41,63%) fik lukket kirurgi" — see [[clinical-procedure|Clinical Procedure]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src24]
- "Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL)" — see [[data-source|Data Source]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]], [[cpr-registeret|CPR-registeret]]) [^src14]
- "Registrering af data til databasen foregår som indberetning til LPR" — see [[data-source|Data Source]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src14]
- "De øvrige datakilder er Den Nationale Labdatabank (DNL), Dansk Anæstesi Database (DAD) og Sygehusmedicinregisteret (SMR)" — see [[data-source|Data Source]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src14]
- "DNL har aktuelt ikke data til rådighed i de nationale kvalitetsdatabaser, men når data bliver tilgængelige, vil de indgå i indikatorberegningen i AKDB" — see [[data-source|Data Source]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src14]
- "Populationen omfatter alle patienter der behandles med akut højrisiko abdominalkirurgi på danske sygehuse" — see [[population-definition|Population Definition]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src20]
- "Data på population og indikatorer har været tilgængelige i de regionale ledelsesinformationssystemer (LIS) siden september 2020" — see [[data-availability|Data Availability]] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]]) [^src20]

## Sources

[^src1]: AKDB_2023.pdf, pages 41
[^src2]: AKDB_2024.pdf, pages 67
[^src3]: AKDB_2024.pdf, pages 70
[^src4]: AKDB_2023.pdf, pages 1-5
[^src5]: AKDB_2024.pdf, pages 1-5
[^src6]: AKDB_2023.pdf, pages 56-60
[^src7]: AKDB_2023.pdf, pages 66-70
[^src8]: AKDB_2023.pdf, pages 6-10
[^src9]: AKDB_2023.pdf, pages 41-45
[^src10]: AKDB_2023.pdf, pages 61-65
[^src11]: AKDB_2023.pdf, pages 71-75
[^src12]: AKDB_2024.pdf, pages 36-40
[^src13]: AKDB_2024.pdf, pages 71-75
[^src14]: AKDB_2024.pdf, pages 86-90
[^src15]: AKDB_2023.pdf, pages 86-90
[^src16]: AKDB_2024.pdf, pages 76-80
[^src17]: AKDB_2024.pdf, pages 51-55
[^src18]: AKDB_2024.pdf, pages 61-65
[^src19]: AKDB_2024.pdf, pages 66-70
[^src20]: AKDB_2024.pdf, pages 91-95
[^src21]: AKDB_2023.pdf, pages 11-15
[^src22]: AKDB_2023.pdf, pages 36-40
[^src23]: AKDB_2023.pdf, pages 46-50
[^src24]: AKDB_2024.pdf, pages 81-85
[^src25]: AKDB_2023.pdf, pages 26-30
[^src26]: AKDB_2023.pdf, pages 31-35
[^src27]: AKDB_2023.pdf, pages 51-55
[^src28]: AKDB_2023.pdf, pages 76-80
[^src29]: AKDB_2023.pdf, pages 81-85
[^src30]: AKDB_2024.pdf, pages 56-60
[^src31]: AKDB_2024.pdf, pages 96-100

