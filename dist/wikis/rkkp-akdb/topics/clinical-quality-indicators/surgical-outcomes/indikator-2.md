---
title: Indikator 2
type: entity
aliases:
  - Indikator 2
wiki: rkkp-akdb
updated: '2026-08-05T19:25:43.206Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '11-15, 16-20, 6-10, 96-100'
tags:
  - indicator
---

**Indikator 2** is a clinical process indicator used within the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] to measure the proportion of patients who receive a [[ct-skanning|CT-skanning]] within two hours (120 minutes) of arriving at the hospital [^src1]. It serves as a critical metric for evaluating diagnostic speed and logistical efficiency in acute abdominal surgery across the Danish healthcare system [^src1]. 

The official performance standard and development target for Indikator 2 require that at least 90% of eligible patients be scanned within this two-hour window [^src1]. This threshold is directly aligned with the clinical guidelines established by [[lkt-akut-kirurgi|LKT Akutkirurgi]] [^src3]. The clinical rationale behind this strict timeframe is to ensure that patients suspected of suffering from severe conditions—such as bowel ischemia, perforated hollow organs, or ileus—can undergo necessary surgical interventions within six hours of admission [^src3]. 

Despite these clear targets, national performance data for the period between September 1, 2023, and August 31, 2024, reveals significant shortfalls. Out of 3,073 eligible patients, only 995 received a CT scan within the required timeframe, resulting in a national compliance rate of just 32.4% (95% CI: 30.7–34.1) [^src2]. Consequently, the 90% development target was not achieved [^src3]. Regional disparities were also pronounced, with compliance rates ranging from a low of 25.9% in [[region-sjaelland|Region Sjælland]] to a high of 41.8% in [[region-midtjylland|Region Midtjylland]] [^src3]. Another national result presentation notes that 30.1% of patients were scanned within 2 hours [^src3]. Overall, only 32.4% of patients were scanned within two hours, which is far from the target [^src4].

In light of these systemic logistical challenges, the [[styregruppen|Styregruppen]] has decided to prioritize Indikator 2 for focused review in an upcoming evidence report [^src3]. Clinical recommendations continue to emphasize that CT scanning with contrast should be initiated as rapidly as possible for high-risk patients to facilitate timely surgical treatment [^src3].

## Mentions
- Page 6: "Indikator 2: Andelen af CT-skannede patienter, der får lavet CT-skanning indenfor 120 minutter efter ankomst til sygehus" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10)
- Page 11: "Indikator 2: CT-skanning" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 11-15)
- Page 16: "Indikator 2: CT-skanning. Forest plot på afdelingsniveau" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 16-20)
- Page 96: "Indikator 2: CT-skanning" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 96-100)

## Relationships
- Subject: indikator-2
  Predicate: measures-timing-of
  Object: ct-skanning
  Evidence: "Indikator 2: Andelen af CT-skannede patienter, der får lavet CT-skanning indenfor to timer (120 minutter) efter ankomst til sygehus"
  Page: 11
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 11-15
- Subject: indikator-2
  Predicate: is-measured-by
  Object: akut-kirurgi-databasen
  Evidence: "Indikator 2: CT-skanning. Forest plot på afdelingsniveau"
  Page: 16
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 16-20
- Subject: indikator-2
  Predicate: is-aligned-with
  Object: lkt-akut-kirurgi
  Evidence: "Udviklingsmålet er at mindst 90 % skannes indenfor 120 minutter, hvilket er i overensstemmelse med LKT for Akutkirurgi."
  Page: 16
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 16-20
- Subject: indikator-2
  Predicate: is-reviewed-by
  Object: styregruppen
  Evidence: "Styregruppen beslutter, at man i forbindelse med kommende evidensrapport vil have fokus på denne indikator."
  Page: 16
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 16-20

## Claims
- Indikator 2 har en standard på ≥ 90 % for andelen af CT-skannede patienter, der får udført CT-skanning inden for to timer efter ankomst til sygehus [^src1] (indikator-2)
  Type: performance-standard
  Page: 6
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10
- Andelen af CT-skannede patienter, der får lavet CT-skanning indenfor to timer (120 minutter) efter ankomst til sygehus, har udviklingsmål på ≥ 90 % [^src1] (indikator-2)
  Type: performance-target
  Page: 11
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 11-15
- I perioden 01.09.2023 – 31.08.2024 blev der for Danmark registreret 995 patienter med CT-skanning inden for to timer ud af 3.073 i nævneren, svarende til 32,4 % (95 % CI: 30,7–34,1) [^src1] (indikator-2)
  Type: performance
  Page: 11
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 11-15
- Indikator 2 beskriver andelen af patienter, der får en CT-skanning og som blev skannede indenfor 2 timer efter ankomst til sygehus [^src1] (indikator-2)
  Type: definition
  Page: 16
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 16-20
- I alt 3.073 patienter blev skannede, og heraf blev 995 skannede indenfor to timer, svarende til en andel på 32,4 % (95 % CI 30,7–34,1) nationalt [^src1] (indikator-2)
  Type: statistical
  Page: 16
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 16-20
- Udviklingsmålet på ≥ 90 % var således ikke opnået [^src1] (indikator-2)
  Type: evaluation
  Page: 16
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 16-20
- Regionalt varierede resultaterne fra 25,9 % i Region Sjælland til 41,8 % i Region Midtjylland [^src1] (indikator-2, region-sjaelland, region-midtjylland)
  Type: statistical
  Page: 16
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 16-20
- Resultatet nationalt viser at 30,1 % af patienterne er scannet inden for 2 timer [^src1] (indikator-2)
  Type: statistical
  Page: 16
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 16-20
- Det anbefales at alle patienter med mistanke om tarm iskæmi, perforeret hulorgan eller ileus gennemgår CT scanning med kontrast så hurtigt som muligt i deres indlæggelsesforløb [^src1] (indikator-2)
  Type: recommendation
  Page: 16
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 16-20
- CT-scanning bør startes indenfor 2 timer da vi ønsker at disse patienter opereres indenfor 6 timer efter indlæggelse [^src1] (indikator-2)
  Type: recommendation
  Page: 16
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 16-20
- Kun 32,4 % af patienterne blev skannet inden for to timer, hvilket er langt fra målet [^src1] (indikator-2)
  Type: performance
  Page: 96
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 96-100

## Timeline
(none)

## Sources

[^src1]: AKDB_2024.pdf, pages 6-10
[^src2]: AKDB_2024.pdf, pages 11-15
[^src3]: AKDB_2024.pdf, pages 16-20
[^src4]: AKDB_2024.pdf, pages 96-100
