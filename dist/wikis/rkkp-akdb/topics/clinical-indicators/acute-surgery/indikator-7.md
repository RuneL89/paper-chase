---
title: Indikator 7
type: entity
aliases:
  - Indikator 7
wiki: rkkp-akdb
updated: '2026-08-05T18:35:19.525Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '31-35, 6-10'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '101-105, 41-45, 6-10, 96-100'
tags:
  - indicator
---
**Indikator 7** is a clinical process indicator within the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] (AKDB), a national quality monitoring program for acute high-risk abdominal surgery in Denmark. Over consecutive reporting periods, the indicator has undergone a significant definitional shift, transitioning from a focus on early postoperative mobilization to postoperative nutritional care. This evolution reflects changing clinical priorities but has also sparked ongoing debates regarding data validity, registration practices, and measurement definitions.

In the 2023 annual report (covering the period from September 1, 2022, to August 31, 2023), Indikator 7 was defined as "Tidlig mobilisering" (early mobilization) [^src2]. It measured the proportion of patients mobilized within 24 hours after surgery against a stringent performance standard of ≥ 90% [^src1][^src2]. However, the national fulfillment rate for this period was markedly lower, at just 29.0% (95% CI: 27.5–30.7) [^src2]. 

By the 2024 report, the indicator's focus had shifted entirely to "Ernæring" (nutrition) [^src3][^src4]. The revised metric tracks the proportion of patients whose nutritional status is addressed or who resume nutrition within 48 hours post-surgery [^src3][^src4]. For the 2023–2024 measurement period, the national fulfillment rate was 26.2%, with 834 out of 3,185 operated patients meeting the criteria [^src4][^src5]. Regional disparities were substantial, ranging from a low of 6.8% in [[region-nordjylland|Region Nordjylland]] to a high of 33.1% in [[region-hovedstaden|Region Hovedstaden]] [^src4]. Despite the low fulfillment rates, the [[styregruppen|Styregruppen]] (Steering Group) discussed the indicator and decided to retain it, citing a strong positive focus on nutrition in current clinical practice [^src4]. Furthermore, [[lkt|LKT]] has actively supported the registration efforts, though improvements are still needed [^src4]. Overall, data registration for the indicator has shown an upward trend over the past three reporting years [^src4].

The transition and current definition of Indikator 7 have not been without controversy. Regional feedback, notably from Regionshospital Nordjylland, has highlighted a critical definitional conflict in the 2024 report [^src6]. While the report's prose states the goal is for patients to resume oral nutrition as quickly as possible, the underlying data definition relies on specific registration codes (ZZ2009C/D) [^src6]. This discrepancy creates ambiguity regarding whether the indicator actually measures the patient's oral intake or merely the administrative creation of a nutrition plan, raising concerns about the alignment between the clinical intent and the data being delivered [^src6].

## Mentions

- Page 6: "Indikator 7: Andelen af patienter, der mobiliseres indenfor 24 timer efter operation" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10)
- Page 7: "Indikator 7: Andelen af patienter, der mobiliseres indenfor 24 timer efter operation" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10)
- Page 31: "Indikator 7: Tidlig mobilisering" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 31-35)
- Page 6: "Indikator 7: Andelen af patienter, der genoptager ernæring indenfor 48 timer efter operation" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10)
- Page 41: "Indikatorbeskrivelse for indikator 7" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 41-45)
- Page 41: "Indikator 7 beskriver andelen af patienter, hvor der er taget stilling til ernæring indenfor 48 timer efter operation." (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 41-45)
- Page 96: "Indikator 7: Ernæring" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 96-100)
- Page 101: "Ift. indikator 7 er beskrivelsen tydelig nok, da den bliver tvetydig ift. hvad styregruppen ønsker data på. Er det at patienten så hurtigt som muligt genoptager oral ernæring eller at der bliver udarbejdet en ernæringsplan hvilket er beskrevet i datadefinitionen. Definitionen bør passe med det data, som ønskes leveret ift. indikator 7." (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 101-105)

## Relationships

**Outgoing (this entity is the SUBJECT of these relationships):**
- Subject: indikator-7
  Predicate: belongs-to-database
  Object: akut-kirurgi-databasen
  Evidence: "Indikator 7: Andelen af patienter, der mobiliseres indenfor 24 timer efter operation"
  Page: 6
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10
- Subject: indikator-7
  Predicate: is-part-of
  Object: akut-kirurgi-databasen
  Evidence: "Indikator 7 beskriver andelen af patienter, hvor der er taget stilling til ernæring indenfor 48 timer efter operation."
  Page: 41
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 41-45

**Incoming (this entity is the OBJECT of these relationships):**
- Subject: styregruppen
  Predicate: discusses
  Object: (this entity)
  Evidence: "Indikatoren er diskuteret i styrergruppen, Den store fremgang og det meget positive fokus der er kommet på ernæring gør at den bibeholdes."
  Page: 41
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 41-45
- Subject: lkt
  Predicate: supports-registration-of
  Object: (this entity)
  Evidence: "Det har været gavnligt at LKT har bakket op om registreringen, men der er plads til forbedring."
  Page: 41
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 41-45

## Claims

- Indikator 7 har en standard på ≥ 90 % for andelen af patienter, der mobiliseres indenfor 24 timer efter operation [^src1] (indikator-7)
  Type: standard
  Page: 6
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10
- Standarden for Indikator 7 er ≥ 90 % [^src1] (indikator-7)
  Type: policy
  Page: 31
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 31-35
- Resultatet for Indikator 7 i 2023 viser en andel på 29,0 % (95 % CI: 27,5–30,7) for Danmark [^src1] (indikator-7)
  Type: statistical
  Page: 31
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 31-35
- Indikator 7 har ingen angivet standard, men rapporteres som andel af patienter, der genoptager ernæring inden for 48 timer efter operation [^src1] (indikator-7)
  Type: performance-standard
  Page: 6
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10
- I alt 834 af de 3.185 opererede patienter i opgørelsesperioden fik taget stilling til ernæring indenfor 48 timer efter operation, svarende til 26,2 % nationalt (95 % CI: 24,7-27,7) [^src1] (indikator-7)
  Type: clinical-metric
  Page: 41
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 41-45
- Regionalt varierede andelen fra 6,8 % i Region Nordjylland til 33,1 % i Region Hovedstaden [^src1] (indikator-7, region-nordjylland, region-hovedstaden)
  Type: regional-comparison
  Page: 41
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 41-45
- Udviklingen over tid viser, registreringen for indikatoren er forbedret over de seneste tre årsrapportperioder [^src1] (indikator-7)
  Type: trend
  Page: 41
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 41-45
- Der er enighed om at det er indtaget ernæring hos patienten, der er målet [^src1] (indikator-7)
  Type: policy
  Page: 41
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 41-45
- I alt 834 af de 3.185 opererede patienter i opgørelsesperioden fik taget stilling til ernæring indenfor 48 timer efter operation, svarende til 26,2 % nationalt [^src1] (indikator-7)
  Type: performance
  Page: 96
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 96-100
- Årsrapporten beskriver, at målet for indikator 7 er, at patienter så hurtigt som muligt genoptager oral ernæring, mens datadefinitionen fra marts 2024 kræver brug af ZZ2009C/D-koder — hvilket skaber tvetydighed [^src1] (indikator-7)
  Type: definitional-conflict
  Page: 101
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 101-105

## Timeline

- 2022-09-01: Start af måleperioden for indikatorresultaterne (01.09.2022 – 31.08.2023) (indikator-1, indikator-3, indikator-4, indikator-5, indikator-6, indikator-7, indikator-8, indikator-9, indikator-10, indikator-11)
- 2023-08-31: Afslutning af måleperioden for indikatorresultaterne (01.09.2022 – 31.08.2023) (indikator-1, indikator-3, indikator-4, indikator-5, indikator-6, indikator-7, indikator-8, indikator-9, indikator-10, indikator-11)
- 01.09.2022 - 31.08.2023: Indikator 6 og Indikator 7 rapporteres for perioden 01.09.2022 – 31.08.2023 i AKDB's endelige version til offentliggørelse 2024.26.02 (indikator-6, indikator-7, akut-kirurgi-databasen)
- 01.09.2023 - 31.08.2024: Opgørelsesperiode for indikator 7-resultaterne (indikator-7)

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 31-35
[^src3]: AKDB_2024.pdf, pages 6-10
[^src4]: AKDB_2024.pdf, pages 41-45
[^src5]: AKDB_2024.pdf, pages 96-100
[^src6]: AKDB_2024.pdf, pages 101-105
