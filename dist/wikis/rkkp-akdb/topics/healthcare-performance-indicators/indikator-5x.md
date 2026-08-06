---
title: Indikator 5x
type: entity
aliases:
  - Indikator 5x
  - Supplerende indikator 5x
wiki: rkkp-akdb
updated: '2026-08-05T19:02:37.085Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '21-25, 26-30'
tags:
  - topic
---
**Indikator 5x** is a supplementary national quality indicator within the Danish Acute Surgery Database (AKDB) designed to measure the speed of surgical intervention for patients presenting with life-threatening conditions, specifically [[perforation-iskaemi-bloedning|perforation, ischemia, or bleeding]] [^src1]. It was developed by the database's [[styregruppen|steering group]] as an experimental tool to sharpen the clinical focus on the most critical patient groups [^src2]. This metric was introduced as a supplementary version of [[indikator-5|Indikator 5]] after the original indicator—which tracked 6-hour operation times for all acute surgical procedures—revealed severe systemic failures in meeting its ≥ 80% standard [^src2]. 

The standard for Indikator 5x requires that ≥ 90% of eligible patients are operated on within 6 hours (360 minutes) of arriving at the hospital [^src2]. The measurement period for this specific indicator ran from September 1, 2022, to August 31, 2023 [^src1]. 

Despite the strict target, national and regional results documented a systematic failure to meet the standard, highlighting profound structural challenges in acute surgical capacity and triage across [[danmark|Denmark]] [^src2]. Nationally, only 21.2% (242 out of 1,141) of patients with perforation, ischemia, or bleeding were operated on within the 6-hour window [^src2]. Regional performance varied, with [[region-midtjylland|Region Midtjylland]] achieving the highest proportion at 27.2% [^src2], followed by [[region-nordjylland|Region Nordjylland]] at 22.6% [^src2], [[region-sjaelland|Region Sjælland]] at 19.9% [^src2], [[region-hovedstaden|Region Hovedstaden]] at 19.7% [^src2], and [[region-syddanmark|Region Syddanmark]] recording the lowest regional compliance at 17.8% [^src2].

At the hospital level, the disparity in treatment speed was even more pronounced. [[nykoebing-f-sygehus|Nykøbing F Sygehus]] was the only facility to meet the standard, reporting a 100.0% compliance rate, though this was based on a very small sample size [^src2]. [[bornholms-hospital|Bornholms Hospital]] recorded the second-highest proportion at 54.5% [^src2]. Conversely, several major hospitals struggled significantly: [[holbaek-sygehus|Holbæk Sygehus]] reached 26.8% [^src2], [[hospitalerne-i-nordsjaelland|Hospitalerne i Nordsjælland]] 25.3% [^src2], [[bispebjerg-og-frederiksberg-hospitaler|Bispebjerg og Frederiksberg Hospitaler]] 22.6% [^src2], [[herlev-og-gentofte-hospital|Herlev og Gentofte Hospital]] 21.8% [^src2], and [[naestved-slagese-og-ringsted-sygehuse|Næstved, Slagelse og Ringsted sygehuse]] 15.6% [^src2]. The lowest estimates were recorded at [[amager-og-hvidovre-hospital|Amager og Hvidovre Hospital]] (10.9%) [^src2] and [[rigshospitalet|Rigshospitalet]] (6.3%) [^src2].

## Mentions
- Page 26: "Supplerende indikator til indikator 5x" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 26-30) [^src1]
- Page 21: "Supplerende indikator 5x: Operation indenfor 6 timer (360 minutter) (Perforation, iskæmi, blødning)" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25) [^src2]

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: indikator-5x
  Predicate: measures-treatment-for
  Object: perforation-iskaemi-bloedning
  Evidence: "Indikator 5x beskriver andelen af patienter, der bliver opereret indenfor 6 timer efter ankomst til sygehus ud af de patienter, der opereres indenfor højst 24 timer, og hvor diagnosen er, perforation, iskæmi eller blødning."
  Page: 26
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 26-30 [^src1]
- Subject: indikator-5x
  Predicate: is-evaluated-by
  Object: styregruppen
  Evidence: "vurderes af Styregruppen for databasen forud for indførelse"
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25 [^src2]

Incoming (this entity is the OBJECT of these relationships):
- Subject: indikator-5
  Predicate: has-supplementary-version
  Object: (this entity)
  Evidence: "Supplerende indikator 5x er en supplerende indikator til Indikator 5"
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25 [^src2]

## Claims
- Supplerende indikator 5x har en standard på ≥ 90 % [^src1] (indikator-5x)
  Type: quality-standard
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25
- Nationalt blev 242 ud af 1.141 patienter opereret inden for 6 timer for perforation, iskæmi eller blødning, svarende til en andel på 21,2 % (95 % CI: 18,9–23,7) [^src1] (danmark, indikator-5x)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25
- I Region Hovedstaden blev 80 ud af 406 patienter opereret inden for 6 timer for perforation, iskæmi eller blødning, svarende til en andel på 19,7 % (95 % CI: 15,9–23,9) [^src1] (region-hovedstaden, indikator-5x)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25
- I Region Sjælland blev 38 ud af 191 patienter opereret inden for 6 timer for perforation, iskæmi eller blødning, svarende til en andel på 19,9 % (95 % CI: 14,5–26,3) [^src1] (region-sjaelland, indikator-5x)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25
- I Region Syddanmark blev 37 ud af 208 patienter opereret inden for 6 timer for perforation, iskæmi eller blødning, svarende til en andel på 17,8 % (95 % CI: 12,8–23,7) [^src1] (region-syddanmark, indikator-5x)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25
- I Region Midtjylland blev 66 ud af 243 patienter opereret inden for 6 timer for perforation, iskæmi eller blødning, svarende til en andel på 27,2 % (95 % CI: 21,7–33,2) [^src1] (region-midtjylland, indikator-5x)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25
- I Region Nordjylland blev 21 ud af 93 patienter opereret inden for 6 timer for perforation, iskæmi eller blødning, svarende til en andel på 22,6 % (95 % CI: 14,6–32,4) [^src1] (region-nordjylland, indikator-5x)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25
- Amager og Hvidovre Hospital havde en andel på 10,9 % (95 % CI: 5,6–18,7) for supplerende indikator 5x [^src1] (amager-og-hvidovre-hospital, indikator-5x)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25
- Bispebjerg og Frederiksberg Hospitaler havde en andel på 22,6 % (95 % CI: 14,2–33,0) for supplerende indikator 5x [^src1] (bispebjerg-og-frederiksberg-hospitaler, indikator-5x)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25
- Bornholms Hospital havde en andel på 54,5 % (95 % CI: 23,4–83,3) for supplerende indikator 5x [^src1] (bornholms-hospital, indikator-5x)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25
- Herlev og Gentofte Hospital havde en andel på 21,8 % (95 % CI: 13,7–32,0) for supplerende indikator 5x [^src1] (herlev-og-gentofte-hospital, indikator-5x)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25
- Hospitalerne i Nordsjælland havde en andel på 25,3 % (95 % CI: 16,7–35,5) for supplerende indikator 5x [^src1] (hospitalerne-i-nordsjaelland, indikator-5x)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25
- Rigshospitalet havde et punktestimat på 6,3 % (95 % CI: 0,8–20,8) for supplerende indikator 5x [^src1] (rigshospitalet, indikator-5x)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25
- Holbæk Sygehus havde en andel på 26,8 % (95 % CI: 14,2–42,9) for supplerende indikator 5x [^src1] (holbaek-sygehus, indikator-5x)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25
- Nykøbing F Sygehus opfyldte standarden for supplerende indikator 5x med 100,0 % (95 % CI: 2,5–100,0) [^src1] (nykoebing-f-sygehus, indikator-5x)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25
- Næstved, Slagelse og Ringsted sygehuse havde en andel på 15,6 % (95 % CI: 7,8–26,9) for supplerende indikator 5x [^src1] (naestved-slagese-og-ringsted-sygehuse, indikator-5x)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 21-25

## Timeline
- 2022-09-01: Start af måleperioden for supplerende indikator 5x: 01.09.2022 – 31.08.2023 (indikator-5x) [^src1]
- 2023-08-31: Afslutning af måleperioden for supplerende indikator 5x: 01.09.2022 – 31.08.2023 (indikator-5x) [^src1]

## Sources

[^src1]: AKDB_2023.pdf, pages 26-30
[^src2]: AKDB_2023.pdf, pages 21-25
