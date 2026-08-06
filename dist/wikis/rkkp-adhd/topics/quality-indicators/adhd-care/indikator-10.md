---
title: Indikator 10
type: entity
aliases:
  - Indikator 10
wiki: rkkp-adhd
updated: '2026-08-05T18:21:45.055Z'
sources:
  - file: wikis/rkkp-adhd/raw/ADHD_2024.pdf
    pages: '51-55, 6-10'
tags:
  - topic
---
**Indikator 10** is a quality indicator within the Danish national healthcare system that measures the proportion of treatment courses for adults with an ADHD diagnosis in which the patient's social support needs are assessed no later than 120 days after the start of treatment [^src1]. It is part of the comprehensive set of quality indicators managed and reported by the [[adhd-databasen|ADHD-DATABASEN]] in its annual evaluations of clinical practice across [[danmark|Denmark]] [^src1]. The indicator specifically tracks the [[adhd-behandlingspopulation|ADHD-behandlingspopulation]], counting treatment courses where the package course start date falls within the designated reporting period [^src2]. The established development goal for this metric is a fulfillment rate of ≥ 90% [^src1].

The measurement period for the current reporting cycle ran from April 1, 2024, to March 31, 2025 [^src1]. During this timeframe, the national fulfillment rate for Indikator 10 was only 37% (95% CI: 35–38), falling significantly short of the 90% target [^src1]. Furthermore, no single region—[[region-hovedstaden|Region Hovedstaden]], [[region-sjaelland|Region Sjælland]], [[region-syddanmark|Region Syddanmark]], [[region-midtjylland|Region Midtjylland]], or [[region-nordjylland|Region Nordjylland]]—met the indicator's requirements overall [^src2]. Only one hospital department with more than three patients achieved the target: [[pho-klinik-1-for-psykiatriske-lidelser-horsens|PHO Klinik 1 for Psykiatriske Lidelser – Horsens]], which reached a 97% fulfillment rate [^src2]. Conversely, six public departments (and eight if [[privathospitaler|Privathospitaler]] are included) recorded a 0% fulfillment rate [^src2].

The low fulfillment rates are largely attributed to registration practices rather than a lack of actual clinical assessment [^src2]. Often, the social support assessment is documented in a manner that the database fails to capture [^src2]. To address this systemic data issue, the [[styregruppen|Styregruppen]] decided to retain Indikator 10 and instructed regional representatives and stakeholders to work on improving local registration practices [^src2]. Additionally, future work under the [[dmpg-retningslinje|DMPG-retningslinje]] regarding "social screening" is expected to help define and standardize these clinical and administrative practices moving forward [^src2].

## Mentions
- Page 6: "Indikator 10: Andelen af behandlingsforløb, hvor patientens sociale støttebehov er vurderet senest 120 dage efter behandlingsstart" (source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 6-10)
- Page 51: "Indikator 10: Sociale støttebehov" (source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 51-55)
- Page 51: "Indikator 10: Andelen af behandlingsforløb, hvor patientens sociale støttebehov er vurderet senest 120 dage efter behandlingsstart" (source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 51-55)

## Relationships
**Outgoing**
- **Subject:** indikator-10
  **Predicate:** measures
  **Object:** adhd-behandlingspopulation
  **Evidence:** "Indikatorpopulation (nævner): Antal forløb i "ADHD-behandlingspopulation", hvor dato for start af pakkeforløb er i opgørelsesperioden"
  **Page:** 51
  **Source:** wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 51-55

**Incoming**
- **Subject:** adhd-databasen
  **Predicate:** manages
  **Object:** (this entity)
  **Evidence:** "Indikator 10 er en del af det samlede sæt af kvalitetsindikatorer, der afrapporteres i ADHD-DATABASEN's årsrapport."
  **Page:** 6
  **Source:** wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 6-10
- **Subject:** styregruppen
  **Predicate:** approves-retention-of
  **Object:** (this entity)
  **Evidence:** "Beslutning: Indikatoren bibeholdes. Styregruppen aftaler at repræsentanterne for de enkelte regioner og aktører går tilbage og arbejder på bedre registreringspraksis."
  **Page:** 51
  **Source:** wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 51-55
- **Subject:** dmpg-retningslinje
  **Predicate:** defines-practice-for
  **Object:** (this entity)
  **Evidence:** "Her henvises til datadefinitionerne, men også til det kommende arbejde i DMPG-retningslinje regi omkring ”social screening”."
  **Page:** 51
  **Source:** wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 51-55
- **Subject:** adhd-databasen
  **Predicate:** contains-data-for
  **Object:** (this entity)
  **Evidence:** "ADHD-DATABASEN"
  **Page:** 51
  **Source:** wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 51-55

## Claims
- Indikator 10 har et udviklingsmål på ≥ 90 %, men opnåede kun 37 % (95 % CI: 35–38) i perioden 01.04.2024–31.03.2025 [^src1] (indikator-10)
  Type: performance
  Page: 6
  Source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 6-10
- Indikator 10 har et udviklingsmål på ≥ 90 % for perioden 01.04.2024–31.03.2025[^src1] (indikator-10)
  Type: policy
  Page: 51
  Source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 51-55
- På landsplan er 37 % af de voksne ADHD-patienters sociale støttebehov blevet vurderet indenfor tidsfristen[^src1] (indikator-10, danmark)
  Type: performance
  Page: 51
  Source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 51-55
- Der er ingen regioner, der samlet set opfylder Indikator 10[^src1] (indikator-10, region-hovedstaden, region-sjaelland, region-syddanmark, region-midtjylland, region-nordjylland)
  Type: performance
  Page: 51
  Source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 51-55
- Kun én hospitalsafdeling med mere end tre patienter opfylder Indikator 10: PHO Klinik 1 for Psykiatriske Lidelser - Horsens (97 %)[^src1] (indikator-10, pho-klinik-1-for-psykiatriske-lidelser-horsens)
  Type: performance
  Page: 51
  Source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 51-55
- Der er seks afdelinger med et resultat på 0 % for Indikator 10 (otte hvis privathospitalerne tælles med)[^src1] (indikator-10, privathospitaler)
  Type: performance
  Page: 51
  Source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 51-55
- Den lave opfyldelsesgrad for Indikator 10 forklares delvist ved registreringspraksis, da vurderingen oftest registreres på en måde, der ikke opfanges i databasen[^src1] (indikator-10, adhd-databasen)
  Type: explanation
  Page: 51
  Source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 51-55

## Timeline
- 01.04.2024: Start af opgørelsesperioden for Indikator 10 (indikator-10)
- 31.03.2025: Slut på opgørelsesperioden for Indikator 10 (indikator-10)

## Sources

[^src1]: ADHD_2024.pdf, pages 6-10
[^src2]: ADHD_2024.pdf, pages 51-55
