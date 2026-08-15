---
title: Hovedstaden
type: entity
wiki: rkkp-akdb
updated: '2026-08-15T07:50:01.186Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '21-25, 36-40, 6-10, 61-65, 76-80'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: 6-10
tags:
  - location
---
Hovedstaden (the Capital Region) is one of the five administrative regions of [[danmark|Danmark]]. It plays a significant role in the national healthcare quality monitoring system, specifically within the Acute Surgery Database (AKDB) managed by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP). The region encompasses several major hospitals, including [[amager-og-hvidovre-hospital|Amager og Hvidovre Hospital]], [[bispebjerg-og-frederiksberg-hospitaler|Bispebjerg og Frederiksberg Hospitaler]], [[herlev-og-gentofte-hospital|Herlev og Gentofte Hospital]], [[hospitalerne-i-nordsjaelland|Hospitalerne i Nordsjælland]], and [[rigshospitalet|Rigshospitalet]]. (Note: [[bornholms-hospital|Bornholms Hospital]] is sometimes erroneously linked to Hovedstaden in raw data extractions, but it is geographically and administratively associated with [[sjaelland|Sjælland]]).

In the context of clinical quality indicators for the period 01.09.2022–31.08.2023, Hovedstaden demonstrated notable performance metrics. For [[indikator-1|Indikator 1]] (antibiotic treatment within 3 hours), the region achieved a compliance rate of 31.8% (95% CI: 29.0–34.7), which was higher than the national average [^src1]. Regarding [[indikator-5x|Indikator 5x]], which measures surgery within 6 hours for life-threatening conditions like perforation, ischemia, or bleeding, 80 out of 406 patients in the region were operated on within the timeframe, yielding a rate of 19.7% (95% CI: 15.9–23.9) [^src2]. Furthermore, Hovedstaden recorded the highest regional compliance for [[indikator-8|Indikator 8]] (early nutritional assessment) at 32.4% (95% CI: 29.6–35.3) [^src3]. In terms of outcomes, 36 out of 396 patients with a [[charlson-score-1-2|Charlson Score = 1 eller 2]] died within 30 days after acute surgery, representing a mortality rate of 9.1% (95% CI: 6.4-12.4) [^src4].

When comparing Hovedstaden to the other Danish regions ([[midtjylland|Midtjylland]], [[nordjylland|Nordjylland]], [[sjaelland|Sjælland]], and [[syddanmark|Syddanmark]]), supplementary analyses revealed no significant regional differences in patient [[alder]] or [[asa-score|ASA]] scores among the operated patients [^src5]. 

For the subsequent reporting period (01.09.2023–31.08.2024), Hovedstaden's compliance for [[indikator-1|Indikator 1]] slightly improved to 33.1% (95% CI: 30.2–36.1) [^src6].

## Mentions
- Page 8: "Hovedstaden Nej 340 / 1.069 0 (0) 31,8 (29,0-34,7) 27,2 27,1" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10) [^src1]
- Page 21: "Hovedstaden Nej 80 / 406 0 (0) 19,7 (15,9-23,9)" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25) [^src2]
- Page 36: "Hovedstaden 354 / 1.093 0 (0) 32,4 (29,6-35,3) 20,2 0,1" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 36-40) [^src3]
- Page 61: "Hovedstaden 36 / 396 0 (0) 9,1 (6,4-12,4) 11,8 11,6" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65) [^src4]
- Page 76: "Hovedstaden Midtjylland Nordjylland Sjælland Syddanmark" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 76-80) [^src5]
- Page 6: "Hovedstaden Nej 335 / 1.012 0 (0) 33,1 (30,2-36,1) 31,7 27,2" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10) [^src6]

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: hovedstaden
  Predicate: has-indicator-result
  Object: indikator-1
  Evidence: "Hovedstaden Nej 340 / 1.069 0 (0) 31,8 (29,0-34,7) 27,2 27,1"
  Page: 8
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10 [^src1]
- Subject: hovedstaden
  Predicate: contains-hospital
  Object: amager-og-hvidovre-hospital
  Evidence: "Amager og Hvidovre Hospital er beliggende i Region Hovedstaden"
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25 [^src2]
- Subject: hovedstaden
  Predicate: contains-hospital
  Object: bispebjerg-og-frederiksberg-hospitaler
  Evidence: "Bispebjerg og Frederiksberg Hospitaler er beliggende i Region Hovedstaden"
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25 [^src2]
- Subject: hovedstaden
  Predicate: contains-hospital
  Object: bornholms-hospital
  Evidence: "Bornholms Hospital er beliggende i Region Sjælland — dette er en fejl i relationen; Bornholms Hospital er ikke i Hovedstaden — korrekt relation er 'sjælland contains-bornholms-hospital'"
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25 [^src2]
- Subject: hovedstaden
  Predicate: contains-hospital
  Object: herlev-og-gentofte-hospital
  Evidence: "Herlev og Gentofte Hospital er beliggende i Region Hovedstaden"
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25 [^src2]
- Subject: hovedstaden
  Predicate: contains-hospital
  Object: hospitalerne-i-nordsjaelland
  Evidence: "Hospitalerne i Nordsjælland er beliggende i Region Hovedstaden"
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25 [^src2]
- Subject: hovedstaden
  Predicate: contains-hospital
  Object: rigshospitalet
  Evidence: "Rigshospitalet er beliggende i Region Hovedstaden"
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25 [^src2]
- Subject: hovedstaden
  Predicate: contains-hospital
  Object: amager-og-hvidovre-hospital
  Evidence: "Hovedstaden 36 / 396 [...] Amager og Hvidovre Hospital 7 / 90"
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65 [^src4]
- Subject: hovedstaden
  Predicate: contains-hospital
  Object: bispebjerg-og-frederiksberg-hospitaler
  Evidence: "Hovedstaden 36 / 396 [...] Bispebjerg og Frederiksberg Hospitaler 5 / 83"
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65 [^src4]
- Subject: hovedstaden
  Predicate: contains-hospital
  Object: bornholms-hospital
  Evidence: "Hovedstaden 36 / 396 [...] Bornholms Hospital 0 / 7"
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65 [^src4]
- Subject: hovedstaden
  Predicate: contains-hospital
  Object: herlev-og-gentofte-hospital
  Evidence: "Hovedstaden 36 / 396 [...] Herlev og Gentofte Hospital 13 / 117"
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65 [^src4]
- Subject: hovedstaden
  Predicate: has-indicator-result-for
  Object: indikator-1
  Evidence: "Hovedstaden Nej 335 / 1.012 0 (0) 33,1 (30,2-36,1) 31,7 27,2"
  Page: 6
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10 [^src6]

Incoming (this entity is the OBJECT of these relationships):
- Subject: danmark
  Predicate: contains-region
  Object: (this entity)
  Evidence: "Hovedstaden er en dansk region"
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25 [^src2]
- Subject: danmark
  Predicate: contains-region
  Object: (this entity)
  Evidence: "Danmark 122 / 1.090 [...] Hovedstaden 36 / 396"
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65 [^src4]
- Subject: asa-score
  Predicate: is-compared-across
  Object: (this entity)
  Evidence: "Hovedstaden Midtjylland Nordjylland Sjælland Syddanmark"
  Page: 76
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 76-80 [^src5]
- Subject: alder
  Predicate: is-compared-across
  Object: (this entity)
  Evidence: "Hovedstaden Midtjylland Nordjylland Sjælland Syddanmark"
  Page: 76
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 76-80 [^src5]

## Claims
- For Indikator 1 var andelen i Region Hovedstaden i perioden 01.09.2022–31.08.2023 31,8 % (95 % CI: 29,0–34,7) [^src1] (indikator-1, hovedstaden)
  Type: performance
  Page: 7
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10
- I Region Hovedstaden blev 80 ud af 406 patienter opereret inden for 6 timer for perforation, iskæmi eller blødning, svarende til en andel på 19,7 % (95 % CI: 15,9–23,9) [^src1] (hovedstaden, indikator-5x)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25
- Region Hovedstaden havde den højeste regionale opfyldelse af Indikator 8 med 32,4 % (95 % CI: 29,6–35,3) [^src1] (hovedstaden, indikator-8)
  Type: statistical
  Page: 36
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 36-40
- Hovedstaden: 36 / 396 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (9,1 %; 95 % CI: 6,4-12,4) [^src1] (hovedstaden, charlson-score-1-2)
  Type: regional-statistic
  Page: 61
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65
- Denne supplerende opgørelse viser, at ASA-scoren for de opererede ikke er væsentligt forskellig regionerne imellem [^src1] (asa-score, hovedstaden, midtjylland, nordjylland, sjaelland, syddanmark)
  Type: conclusion
  Page: 76
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 76-80
- Figuren viser, at der ikke er væsentlig forskel på patienternes alder, regionerne imellem [^src2] (alder, hovedstaden, midtjylland, nordjylland, sjaelland, syddanmark)
  Type: conclusion
  Page: 76
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 76-80
- For Indikator 1 var opfyldelsen i Region Hovedstaden i perioden 01.09.2023–31.08.2024 33,1 % (95 % CI: 30,2–36,1) [^src1] (indikator-1, hovedstaden)
  Type: performance-result
  Page: 6
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10

## Timeline
(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 21-25
[^src3]: AKDB_2023.pdf, pages 36-40
[^src4]: AKDB_2023.pdf, pages 61-65
[^src5]: AKDB_2023.pdf, pages 76-80
[^src6]: AKDB_2024.pdf, pages 6-10
