---
title: Indikator 6
type: entity
aliases:
  - Indikator 6
wiki: rkkp-akdb
updated: '2026-08-05T18:35:50.240Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '31-35, 6-10'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '101-105, 36-40, 6-10, 96-100'
tags:
  - indicator
---
**Indikator 6** is a clinical quality indicator within the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] (AKDB), a national database monitoring the quality of acute surgical care in [[danmark|Danmark]]. The indicator is reported by the [[sundhedsvaesenets-kvalitetsinstitut|Sundhedsvæsenets Kvalitetsinstitut]] and is notable for a major definitional shift between the 2023 and 2024 reporting periods, transitioning from a focus on postoperative intermediate care to early patient mobilization.

### Definitional Shift: From Intermediate Care to Early Mobilization
In the 2023 AKDB report (covering the period from September 1, 2022, to August 31, 2023), Indikator 6 was defined as "Intermediær indlæggelse" (intermediate admission) [^src1]. It measured the proportion of elderly (≥ 75 years) or severely ill ([[asa-score|ASA]] ≥ 3) patients who were monitored for at least 24 hours postoperatively in an intermediate or similar unit [^src1]. During this period, the indicator relied on specific registration codes, namely [[nabb|NABB]], [[nabe|NABE]], and [[nabc|NABC]] [^src2]. Uniquely among the database's indicators, the 2023 version of Indikator 6 did not have a specified percentage standard, relying only on the formulation "Andel" (Proportion), though an 80% target was proposed for the following year [^src1]. The national result for this period was just 19.2%, with researchers suspecting significant underreporting due to registration practices [^src2]. To improve future accuracy, the AKDB proposed transitioning to [[sor-koder|SOR koder]] to better capture high-risk patient stays [^src2]. The database committee also evaluated alternative risk-scoring systems for this indicator, ultimately rejecting [[p-possum|P-POSSUM]], [[apache|APACHE]], and the [[surgical-apgar-score|Surgical Apgar Score]] as either too comprehensive for practical use or exclusionary to certain risk patients [^src2].

By the 2024 AKDB report (covering September 1, 2023, to August 31, 2024), Indikator 6 was completely redefined as "Tidlig mobilisering" (early mobilization) [^src3]. Informed by the [[eras|ERAS]] (Enhanced Recovery After Surgery) program, the new indicator measures the proportion of patients mobilized within 24 hours after surgery [^src4]. Mobilization is strictly defined as the patient leaving the bed to assume a sitting or standing position [^src4]. Data for this metric is drawn from the [[landspatientregisteret|Landspatientregisteret]] using the codes [[zzp0030a|ZZP0030A]] (early mobilization initiated) and [[zzp0030c|ZZP0030C]] (no indication for early mobilization) [^src4].

### Performance and Regional Variation
For the 2024 early mobilization metric, the performance standard was set at ≥ 90% [^src3]. However, national performance fell significantly short of this goal. Out of 3,185 operated patients, only 1,133 were mobilized within 24 hours, yielding a national average of 35.6% [^src4] [^src5]. Consequently, none of the reporting units met the 90% development target [^src4]. 

There was substantial regional variation in the results. The proportion of early mobilization ranged from a low of 20.3% in [[region-nordjylland|Region Nordjylland]] to a high of 46.4% in [[region-midtjylland|Region Midtjylland]] [^src4]. Regional feedback, such as comments from Regionshospital Nordjylland, highlighted systematic registration challenges in electronic health records (like NordEPJ), noting that current documentation practices make it difficult for healthcare professionals to intuitively register these specific indicators, thereby threatening the validity of the data [^src6].

***

## Mentions
- Page 6: "Indikator 6: Andelen af ældre (>= 75 år) eller svært syge (ASA >= 3) patienter, der monitoreres >= 24 timer postoperativt på et intermediært afsnit eller et lignende afsnit." (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10)
- Page 7: "Indikator 6: Andelen af ældre (>= 75 år) eller svært syge (ASA >= 3) patienter, der monitoreres >= 24 timer postoperativt på et intermediært afsnit eller et lignende afsnit." (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10)
- Page 31: "Indikator 6: Intermediær indlæggelse" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 31-35)
- Page 6: "Indikator 6: Andelen af patienter, der mobiliseres indenfor 24 timer efter operation" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10)
- Page 36: "Indikatorbeskrivelse for indikator 6" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 36-40)
- Page 36: "Indikator 6 beskriver andelen af patienter, der mobiliseres indenfor 24 timer efter operation." (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 36-40)
- Page 96: "Indikator 6: Tidlig mobilisering" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 96-100)
- Page 101: "Ift. indikator 6 og 7: Regionalt har vi en registreringsudfordring ift. indikator 6 og 7. Der arbejdes på optimering af nuværende registreringspraksis, således det bliver lettere og mere intuitivt for den sundhedsprofessionelle med dokumentation af disse." (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 101-105)

## Relationships
- Subject: indikator-6
  Predicate: belongs-to-database
  Object: akut-kirurgi-databasen
  Evidence: "Indikator 6: Andelen af ældre (>= 75 år) eller svært syge (ASA >= 3) patienter, der monitoreres >= 24 timer postoperativt på et intermediært afsnit eller et lignende afsnit."
  Page: 6
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10
- Subject: indikator-6
  Predicate: uses-code
  Object: nabb
  Evidence: "Tallene for 2023 dækker udelukkende indberetninger, hvor der er anvendt NABB (intensiv terapi), NABE (intensiv observation) eller NABC (intermediær observation) koder"
  Page: 31
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 31-35
- Subject: indikator-6
  Predicate: uses-code
  Object: nabe
  Evidence: "Tallene for 2023 dækker udelukkende indberetninger, hvor der er anvendt NABB (intensiv terapi), NABE (intensiv observation) eller NABC (intermediær observation) koder"
  Page: 31
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 31-35
- Subject: indikator-6
  Predicate: uses-code
  Object: nabc
  Evidence: "Tallene for 2023 dækker udelukkende indberetninger, hvor der er anvendt NABB (intensiv terapi), NABE (intensiv observation) eller NABC (intermediær observation) koder"
  Page: 31
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 31-35
- Subject: indikator-6
  Predicate: proposed-replacement-code
  Object: sor-koder
  Evidence: "AKDB foreslår, at der fremadrettet anvendes SOR koder til at afgøre, om en højrisikopatient har haft ophold de første 24 timer postoperativt på en afdeling med et behandlingsniveau niveau højere end en almindelig sengeafdeling"
  Page: 31
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 31-35
- Subject: indikator-6
  Predicate: relies-on
  Object: asa-score
  Evidence: "Indikator 6 beskriver andelen af patienter, der får vurderet postoperativ risiko høj (ASA ≥ 3) eller har høj alder (alder ≥ 75 år)"
  Page: 31
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 31-35
- Subject: indikator-6
  Predicate: discusses-alternative-scores
  Object: p-possum
  Evidence: "Vi har vurderet at P-POSSUM og APACHE er for omfattende til praktisk brug"
  Page: 31
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 31-35
- Subject: indikator-6
  Predicate: discusses-alternative-scores
  Object: apache
  Evidence: "Vi har vurderet at P-POSSUM og APACHE er for omfattende til praktisk brug"
  Page: 31
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 31-35
- Subject: indikator-6
  Predicate: discusses-alternative-scores
  Object: surgical-apgar-score
  Evidence: "I forhold til surgical apgar score mener vi, at denne ekskluderer risikopatienter, der ikke er fysiologisk stressede peroperativt"
  Page: 31
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 31-35
- Subject: indikator-6
  Predicate: is-defined-in
  Object: akut-kirurgi-databasen
  Evidence: "Indikator 6 beskriver andelen af patienter, der mobiliseres indenfor 24 timer efter operation."
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 36-40
- Subject: indikator-6
  Predicate: uses-code
  Object: zzp0030a
  Evidence: "Mobilisering registreres i LPR ved at angive koderne ZZP0030A (tidlig mobilisering påbegyndt) og ZZP0030C (vurderet ingen indikation for tidlig mobilisering)."
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 36-40
- Subject: indikator-6
  Predicate: uses-code
  Object: zzp0030c
  Evidence: "Mobilisering registreres i LPR ved at angive koderne ZZP0030A (tidlig mobilisering påbegyndt) og ZZP0030C (vurderet ingen indikation for tidlig mobilisering)."
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 36-40
- Subject: indikator-6
  Predicate: is-reported-by
  Object: sundhedsvaesenets-kvalitetsinstitut
  Evidence: "Sundhedsvæsenets Kvalitetsinstitut udgiver den endelige version til offentliggørelse."
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 36-40
- Subject: indikator-6
  Predicate: is-based-on-data-from
  Object: landspatientregisteret
  Evidence: "Mobilisering registreres i LPR ved at angive koderne ZZP0030A og ZZP0030C."
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 36-40
- Subject: indikator-6
  Predicate: is-informed-by
  Object: eras
  Evidence: "Med udgangspunkt i “Enhanced Recovery After Surgery” (ERAS), skal mobilisering ske på det første postoperative døgn."
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 36-40

## Claims
- Indikator 6 har ingen angivet procentstandard, kun formuleringen 'Andel' for overvågning af ældre eller svært syge patienter postoperativt [^src1] (indikator-6)
  Type: standard
  Page: 6
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10
- Standarden for Indikator 6 sættes fra næste år til 80 % [^src1] (indikator-6)
  Type: policy
  Page: 31
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 31-35
- Resultatet for Indikator 6 i 2023 viser en andel på 19,2 % (95 % CI: 17,4–21,1) for Danmark [^src1] (indikator-6)
  Type: statistical
  Page: 31
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 31-35
- Dette års resultat for Indikator 6 må formodes at underrapporterer i forhold til, hvad der i virkeligheden er praksis [^src1] (indikator-6)
  Type: assessment
  Page: 31
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 31-35
- Indikator 6 har en standard på ≥ 90 % for andelen af patienter, der mobiliseres inden for 24 timer efter operation [^src1] (indikator-6)
  Type: performance-standard
  Page: 6
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10
- Indikator 6 beskriver andelen af patienter, der mobiliseres indenfor 24 timer efter operation [^src1] (indikator-6)
  Type: definitional
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 36-40
- I alt 1.133 af de 3.185 opererede patienter i opgørelsesperioden blev mobiliserede indenfor 24 timer efter operation, svarende til at 35,6 % nationalt blev mobiliserede indenfor 24 timer efter operation (95 % CI: 33,9-37,3) [^src1] (indikator-6, danmark)
  Type: statistical
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 36-40
- Regionalt varierede andelen fra 20,3 % i Region Nordjylland til 46,4 % i Region Midtjylland [^src1] (indikator-6, region-nordjylland, region-midtjylland)
  Type: statistical
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 36-40
- Ingen af de indberettende enheder opfyldte udviklingsmålet på ≥ 90 % [^src1] (indikator-6)
  Type: performance
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 36-40
- Mobilisering er defineret ved mobilisering fra liggende stilling til enten siddende eller stående stilling, hvor patienten har forladt sengen [^src1] (indikator-6)
  Type: definitional
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 36-40
- Ud af 3.185 opererede patienter blev 1.133 mobiliseret inden for 24 timer, hvilket svarer til 35,6 % på landsplan [^src1] (indikator-6)
  Type: performance
  Page: 96
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 96-100

## Timeline
- 2022-09-01: Start af måleperioden for indikatorresultaterne (01.09.2022 – 31.08.2023) (indikator-1, indikator-3, indikator-4, indikator-5, indikator-6, indikator-7, indikator-8, indikator-9, indikator-10, indikator-11)
- 2023-08-31: Afslutning af måleperioden for indikatorresultaterne (01.09.2022 – 31.08.2023) (indikator-1, indikator-3, indikator-4, indikator-5, indikator-6, indikator-7, indikator-8, indikator-9, indikator-10, indikator-11)
- 01.09.2022 - 31.08.2023: Indikator 6 og Indikator 7 rapporteres for perioden 01.09.2022 – 31.08.2023 i AKDB's endelige version til offentliggørelse 2024.26.02 (indikator-6, indikator-7, akut-kirurgi-databasen)
- 01.09.2023 - 31.08.2024: Opgørelsesperiode for Indikator 6 i Akut Kirurgi Databasen (indikator-6, akut-kirurgi-databasen)

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 31-35
[^src3]: AKDB_2024.pdf, pages 6-10
[^src4]: AKDB_2024.pdf, pages 36-40
[^src5]: AKDB_2024.pdf, pages 96-100
[^src6]: AKDB_2024.pdf, pages 101-105
