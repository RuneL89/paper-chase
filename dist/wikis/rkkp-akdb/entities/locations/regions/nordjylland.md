---
title: Nordjylland
type: entity
wiki: rkkp-akdb
updated: '2026-08-15T07:53:00.024Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '21-25, 36-40, 6-10, 61-65, 76-80'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: 6-10
tags:
  - location
---
Nordjylland (North Denmark Region) is one of the five administrative regions of [[danmark|Danmark]]. It is actively monitored in the national clinical quality databases for acute surgery, specifically the Acute Surgery Database (AKDB) managed by the Regions' Clinical Quality Development Program. The region's healthcare performance is evaluated across multiple clinical indicators, including antibiotic administration, surgical intervention times, and mortality rates.

In the period from September 1, 2022, to August 31, 2023, Nordjylland's performance for [[indikator-1|Indikator 1]] (antibiotic treatment within 3 hours) was 29.3% (95% CI: 23.7–35.5), which remained close to the national average [^src1]. For the supplementary [[indikator-5x|Indikator 5x]], which measures the speed of surgical intervention for life-threatening conditions like perforation, ischemia, or bleeding, 21 out of 93 patients in the region were operated on within 6 hours, yielding a proportion of 22.6% (95% CI: 14.6–32.4) [^src2]. Furthermore, regarding 30-day mortality after acute surgery for patients with mild to moderate comorbidity ([[charlson-score-1-2|Charlson Score = 1 eller 2]]), the region recorded 13 deaths out of 76 patients, corresponding to a rate of 17.1% (95% CI: 9.4–27.5) [^src4].

In the subsequent reporting period from September 1, 2023, to August 31, 2024, the region's fulfillment rate for Indikator 1 improved to 36.7% (95% CI: 30.4–43.4) [^src6]. 

Demographic and clinical baseline comparisons across the five Danish regions—including [[hovedstaden|Hovedstaden]], [[midtjylland|Midtjylland]], Nordjylland, [[sjaelland|Sjælland]], and [[syddanmark|Syddanmark]]—revealed no significant regional differences in patient [[alder|alder]] or [[asa-score|ASA]] scores [^src5]. Within the region, specific hospitals such as [[aalborg-universitetshospital|Aalborg Universitetshospital]] and [[regionshospital-nordjylland|Regionshospital Nordjylland]] contribute to the regional surgical volumes and outcomes [^src4].

## Mentions

- Page 8: "Nordjylland Nej 71 / 242 0 (0) 29,3 (23,7-35,5) 25,4 17,9" [^src1]
- Page 21: "Nordjylland Nej 21 / 93 0 (0) 22,6 (14,6-32,4)" [^src2]
- Page 36: "Nordjylland 17 / 270 0 (0) 6,3 (3,7-9,9) 0,5 0,0" [^src3]
- Page 61: "Nordjylland 13 / 76 0 (0) 17,1 (9,4-27,5) 17,1 11,6" [^src4]
- Page 76: "Hovedstaden Midtjylland Nordjylland Sjælland Syddanmark" [^src5]
- Page 6: "Nordjylland Nej 83 / 226 0 (0) 36,7 (30,4-43,4) 29,4 25,4" [^src6]

## Relationships

**Outgoing (this entity is the SUBJECT of these relationships):**

- **Subject:** nordjylland
  **Predicate:** has-indicator-result
  **Object:** indikator-1
  **Evidence:** "Nordjylland Nej 71 / 242 0 (0) 29,3 (23,7-35,5) 25,4 17,9"
  **Page:** 8
  **Source:** wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10 [^src1]

- **Subject:** nordjylland
  **Predicate:** contains-hospital
  **Object:** aalborg-universitetshospital
  **Evidence:** "Nordjylland 13 / 76 [...] Aalborg Universitetshospital 7 / 46"
  **Page:** 61
  **Source:** wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65 [^src4]

- **Subject:** nordjylland
  **Predicate:** contains-hospital
  **Object:** regionshospital-nordjylland
  **Evidence:** "Nordjylland 13 / 76 [...] Regionshospital Nordjylland 6 / 30"
  **Page:** 61
  **Source:** wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65 [^src4]

- **Subject:** nordjylland
  **Predicate:** has-indicator-result-for
  **Object:** indikator-1
  **Evidence:** "Nordjylland Nej 83 / 226 0 (0) 36,7 (30,4-43,4) 29,4 25,4"
  **Page:** 6
  **Source:** wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10 [^src6]

**Incoming (this entity is the OBJECT of these relationships):**

- **Subject:** danmark
  **Predicate:** contains-region
  **Object:** (this entity)
  **Evidence:** "Nordjylland er en dansk region"
  **Page:** 21
  **Source:** wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25 [^src2]

- **Subject:** danmark
  **Predicate:** contains-region
  **Object:** (this entity)
  **Evidence:** "Danmark 122 / 1.090 [...] Nordjylland 13 / 76"
  **Page:** 61
  **Source:** wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 61-65 [^src4]

- **Subject:** asa-score
  **Predicate:** is-compared-across
  **Object:** (this entity)
  **Evidence:** "Hovedstaden Midtjylland Nordjylland Sjælland Syddanmark"
  **Page:** 76
  **Source:** wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 76-80 [^src5]

- **Subject:** alder
  **Predicate:** is-compared-across
  **Object:** (this entity)
  **Evidence:** "Hovedstaden Midtjylland Nordjylland Sjælland Syddanmark"
  **Page:** 76
  **Source:** wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 76-80 [^src5]

## Claims

- For Indikator 1 var andelen i Region Nordjylland i perioden 01.09.2022–31.08.2023 29,3 % (95 % CI: 23,7–35,5) [^src1] (indikator-1, nordjylland)
- I Region Nordjylland blev 21 ud af 93 patienter opereret inden for 6 timer for perforation, iskæmi eller blødning, svarende til en andel på 22,6 % (95 % CI: 14,6–32,4) [^src1] (nordjylland, indikator-5x)
- Nordjylland: 13 / 76 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (17,1 %; 95 % CI: 9,4-27,5) [^src1] (nordjylland, charlson-score-1-2)
- Denne supplerende opgørelse viser, at ASA-scoren for de opererede ikke er væsentligt forskellig regionerne imellem [^src1] (asa-score, hovedstaden, midtjylland, nordjylland, sjaelland, syddanmark)
- Figuren viser, at der ikke er væsentlig forskel på patienternes alder, regionerne imellem [^src2] (alder, hovedstaden, midtjylland, nordjylland, sjaelland, syddanmark)
- For Indikator 1 var opfyldelsen i Region Nordjylland i perioden 01.09.2023–31.08.2024 36,7 % (95 % CI: 30,4–43,4) [^src1] (indikator-1, nordjylland)

## Timeline

(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 21-25
[^src3]: AKDB_2023.pdf, pages 36-40
[^src4]: AKDB_2023.pdf, pages 61-65
[^src5]: AKDB_2023.pdf, pages 76-80
[^src6]: AKDB_2024.pdf, pages 6-10
