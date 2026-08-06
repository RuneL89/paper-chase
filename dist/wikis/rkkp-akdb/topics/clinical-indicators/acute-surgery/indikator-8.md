---
title: Indikator 8
type: entity
aliases:
  - Indikator 8
  - 'Indikator 8: Ernæring'
wiki: rkkp-akdb
updated: '2026-08-05T18:37:24.892Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '36-40, 41-45, 6-10'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '46-50, 6-10, 96-100'
tags:
  - indicator
---
**Indikator 8** is a clinical quality process indicator within the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] (AKDB), a national monitoring program for acute, high-risk abdominal surgery in [[danmark|Danmark]]. The indicator's specific focus shifted between reporting years, leading to a dual definition in the database's documentation. 

In the 2023 AKDB report, Indikator 8 tracks early postoperative nutrition, specifically measuring the proportion of patients who resume nutrition or have their [[ernaering-vurdering-indenfor-48-timer|ernaering-vurdering-indenfor-48-timer]] (nutritional status assessed within 48 hours) after surgery [^src1], [^src6]. Uniquely among process indicators in that report, it was published with [[ingen-standard-fastsat|ingen-standard-fastsat]] (no specified standard percentage) [^src1]. National fulfillment for this nutrition metric was notably low at 19.6% (617 out of 3,147 patients) [^src2], [^src6]. Performance varied drastically by region and hospital: [[region-hovedstaden|Region Hovedstaden]] achieved the highest regional rate at 32.4%, while [[region-syddanmark|Region Syddanmark]] recorded the lowest at 0.2% [^src6]. At the hospital level, [[bispebjerg-og-frederiksberg-hospitaler|Bispebjerg og Frederiksberg Hospitaler]] led with 53.9%, whereas [[rigshospitalet|Rigshospitalet]] had the lowest fulfillment at 5.2% [^src6]. The indicator's registration and continuation were evaluated by the [[styregruppen|Styregruppen]], with administrative support from [[lkt|LKT]] [^src2].

In the subsequent 2024 AKDB report, the "Indikator 8" label is instead applied to the use of [[epidural|epidural]] anesthesia during surgery [^src3], [^src4]. For this metric, the performance standard was set at >60% [^src3]. This target was lowered from 90% in 2022 because many acute surgical patients are comorbid and receive anticoagulant treatments, which can contraindicate epidural placement on the day of surgery [^src4]. Nationally, 52.2% of operated patients (1,661 out of 3,185) received an epidural [^src5]. Data for this indicator relies on the [[dansk-anaestesi-database-dad|Dansk Anæstesi Database (DAD)]] and cross-references operation times from the [[landspatientregisteret|Landspatientregisteret]] [^src4]. Only five of the 20 reporting units met the >60% development goal [^src4]. [[amager-og-hvidovre-hospital|Amager og Hvidovre Hospital]] recorded the highest epidural rate, while [[naestved-slagese-og-ringsted-sygehuse|Næstved, Slagelse og Ringsted sygehuse]] had the lowest [^src4]. Regionally, [[region-syddanmark|Region Syddanmark]] had the highest fulfillment at 56.8%, and [[region-nordjylland|Region Nordjylland]] the lowest at 41.9% [^src4].

The measurement periods for these indicators span from September 1, 2022, to August 31, 2023 (for the 2023 report), and September 1, 2023, to August 31, 2024 (for the 2024 report).

## Mentions
- Page 6: "Indikator 8: Andelen af patienter, der genoptager ernæring indenfor 48 timer efter operation" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10)
- Page 7: "Indikator 8: Andelen af patienter, der genoptager ernæring indenfor 48 timer efter operation" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10)
- Page 41: "Indikator 8: Ernæring. Resultater på afdelingsniveau" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 41-45)
- Page 6: "Indikator 8: Andelen af patienter, der har fået anlagt epidural i forbindelse med operationen" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10)
- Page 46: "Indikator 8: Andel opererede med epidural" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 46-50)
- Page 96: "Indikator 8: Andel opererede med epidural" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 96-100)
- Page 36: "Indikator 8: Ernæring" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 36-40)

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: indikator-8
  Predicate: belongs-to-database
  Object: akut-kirurgi-databasen
  Evidence: "Indikator 8: Andelen af patienter, der genoptager ernæring indenfor 48 timer efter operation"
  Page: 6
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10
- Subject: indikator-8
  Predicate: is-evaluated-by
  Object: styregruppen
  Evidence: "Der er basis for at tage problemstillingen med registrering og videreførelse af indikatoren til styregruppens årsmøde."
  Page: 41
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 41-45
- Subject: indikator-8
  Predicate: is-supported-by
  Object: lkt
  Evidence: "Det har været gavnligt at LKT har bakket op om registreringen"
  Page: 41
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 41-45
- Subject: indikator-8
  Predicate: measures
  Object: epidural
  Evidence: "Indikator 8: Andel opererede med epidural"
  Page: 46
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 46-50
- Subject: indikator-8
  Predicate: relies-on-data-from
  Object: dansk-anaestesi-database-dad
  Evidence: "Data om epidural stammer fra Dansk Anæstesi Database"
  Page: 46
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 46-50
- Subject: indikator-8
  Predicate: uses-operation-time-from
  Object: landspatientregisteret
  Evidence: "tidspunktet for anæstesi skal ligge indenfor tidspunktet for den procedure, hvor selve operationen er angivet i LPR"
  Page: 46
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 46-50
- Subject: indikator-8
  Predicate: relates-to-procedure
  Object: epidural
  Evidence: "Epidural som smertedækning anbefales, da man er bedre smertedækket, får hurtigere gang i maven, og flere overlever operationen, hvis de er bedøvede med epidural."
  Page: 96
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 96-100
- Subject: indikator-8
  Predicate: measures
  Object: ernaering-vurdering-indenfor-48-timer
  Evidence: "Andelen af patienter, hvor der er taget stilling til ernæring indenfor 48 timer efter operation"
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 36-40
- Subject: indikator-8
  Predicate: has-standard
  Object: ingen-standard-fastsat
  Evidence: "Standard Ikke fastsat"
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 36-40

Incoming (this entity is the OBJECT of these relationships):
- Subject: amager-og-hvidovre-hospital
  Predicate: has-highest-epidural-rate-for
  Object: (this entity)
  Evidence: "Amager/Hvidovre sygehus, der har anlagt 166 epiduralkatetre, i forbindelse med operation af 282 patienter, hvoraf 121 indgreb blev foretaget åbent"
  Page: 46
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 46-50
- Subject: naestved-slagese-og-ringsted-sygehuse
  Predicate: has-lowest-epidural-rate-for
  Object: (this entity)
  Evidence: "Næstved/Slagelse/Ringsted sygehus, der har anlagt 47 epiduralkatetre i forbindelse med 204 operationer, hvoraf 85 blev foretaget åbent."
  Page: 46
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 46-50

## Claims
- Indikator 8 har ingen angivet procentstandard, kun formuleringen 'Andel' for genoptagelse af ernæring indenfor 48 timer efter operation [^src1] (indikator-8)
  Type: standard
  Page: 6
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10
- I alt 617 af de 3.147 opererede patienter i opgørelsesperioden fik taget stilling til ernæring indenfor 48 timer efter operation, svarende til 19,6 % nationalt (95 % CI: 18,2-21,0) [^src1] (indikator-8)
  Type: quality-metric
  Page: 41
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 41-45
- Regionalt varierede andelen fra 0,2 % i Region Syddanmark til 32,4 % i Region Hovedstaden [^src1] (indikator-8)
  Type: quality-metric
  Page: 41
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 41-45
- Indikator 8 har en standard på > 60 % for andelen af patienter, der har fået anlagt epidural i forbindelse med operationen [^src1] (indikator-8)
  Type: performance-standard
  Page: 6
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10
- Udviklingsmålet for Indikator 8 er > 60 % [^src1] (indikator-8)
  Type: performance-target
  Page: 46
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 46-50
- Indikator 8 blev i 2022 ændret fra 90 % til 60 % idet mange patienter er komorbide og får AK behandling, hvilket kan kontraindicere epidural anlæggelse i operationsdøgnet [^src1] (indikator-8, epidural)
  Type: policy-change
  Page: 46
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 46-50
- I alt fem af de 20 indberettende enheder opfyldte udviklingsmålet i perioden [^src1] (indikator-8)
  Type: performance-result
  Page: 46
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 46-50
- Regionalt varierede andelen fra 41,9 % i Region Nordjylland til 56,8 % i Region Syddanmark [^src1] (indikator-8, region-nordjylland, region-syddanmark)
  Type: regional-variation
  Page: 46
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 46-50
- Ud af de 3.185 opererede i perioden, blev 1.661 bedøvede med epidural. Det svarer til en andel på 52,2 % (95 % CI: 50,4-53,9) [^src1] (indikator-8)
  Type: performance
  Page: 96
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 96-100
- Indikator 8: Ernæring måler andelen af patienter, hvor der er taget stilling til ernæring indenfor 48 timer efter operation [^src1] (indikator-8)
  Type: definition
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 36-40
- Nationalt blev 617 ud af 3.147 akut kirurgiske patienter vurderet for ernæring inden for 48 timer efter operation, svarende til 19,6 % (95 % CI: 18,2–21,0) [^src1] (danmark, indikator-8)
  Type: statistical
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 36-40
- Region Hovedstaden havde den højeste regionale opfyldelse af Indikator 8 med 32,4 % (95 % CI: 29,6–35,3) [^src1] (region-hovedstaden, indikator-8)
  Type: statistical
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 36-40
- Bispebjerg og Frederiksberg Hospitaler havde den højeste enhedsopfyldelse af Indikator 8 med 53,9 % (95 % CI: 47,2–60,4) [^src1] (bispebjerg-og-frederiksberg-hospitaler, indikator-8)
  Type: statistical
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 36-40
- Rigshospitalet havde den laveste enhedsopfyldelse af Indikator 8 med 5,2 % (95 % CI: 1,1–14,4) [^src1] (rigshospitalet, indikator-8)
  Type: statistical
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 36-40
- Region Syddanmark havde den laveste regionale opfyldelse af Indikator 8 med 0,2 % (95 % CI: 0,0–0,9) [^src1] (region-syddanmark, indikator-8)
  Type: statistical
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 36-40

## Timeline
- 2022-09-01: Start af måleperioden for indikatorresultaterne (01.09.2022 – 31.08.2023) (indikator-1, indikator-3, indikator-4, indikator-5, indikator-6, indikator-7, indikator-8, indikator-9, indikator-10, indikator-11)
- 2023-08-31: Afslutning af måleperioden for indikatorresultaterne (01.09.2022 – 31.08.2023) (indikator-1, indikator-3, indikator-4, indikator-5, indikator-6, indikator-7, indikator-8, indikator-9, indikator-10, indikator-11)
- 01.09.2022 - 31.08.2023: Rapportperioden for indikator 8 og 9, hvor data blev indsamlet fra Akut Kirurgi Databasen (indikator-8, indikator-9, akut-kirurgi-databasen)
- 01.09.2023 - 31.08.2024: Måleperiode for Indikator 8 i den aktuelle rapportversion (indikator-8)
- 2022: Ændring af udviklingsmål for Indikator 8 fra 90 % til 60 % (indikator-8)

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 41-45
[^src3]: AKDB_2024.pdf, pages 6-10
[^src4]: AKDB_2024.pdf, pages 46-50
[^src5]: AKDB_2024.pdf, pages 96-100
[^src6]: AKDB_2023.pdf, pages 36-40
