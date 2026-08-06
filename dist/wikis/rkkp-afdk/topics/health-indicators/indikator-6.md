---
title: Indikator 6
type: entity
aliases:
  - Indikator 6
wiki: rkkp-afdk
updated: '2026-08-05T20:09:27.185Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '56-60, 61-65'
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '46-50, 51-55, 6-10'
tags:
  - topic
---
**Indikator 6** is a central clinical quality and safety indicator within the [[databasen-for-atrieflimren-i-danmark|Databasen for Atrieflimren i Danmark]] (Danish Atrial Fibrillation Database). Administered by the [[regionernes-kliniske-kvalitetsudviklingsprogram|Regionernes Kliniske Kvalitetsudviklingsprogram]] (RKKP), it measures the incidence of intracranial hemorrhage ([[intrakraniel-blodning|intrakraniel-blodning]] / [[intrakraniel-bloedning|Intrakraniel blødning]]) among prevalent patients diagnosed with [[atrieflimren|atrial fibrillation]] [^src1] [^src2] [^src3] [^src4] [^src5]. While Indikator 5 monitors for under-treatment (ischemic stroke), Indikator 6 serves as a critical safety metric for over-anticoagulation, ensuring that blood-thinning treatments do not cause severe bleeding complications [^src2] [^src4].

### Methodology and Data Sources
The indicator calculates the incidence of intracranial bleeding using data exclusively from the [[landspatientregisteret|Landspatientregisteret]] (National Patient Registry) [^src2] [^src4]. The target population includes all prevalent patients with an atrial fibrillation diagnosis—specifically, individuals alive on July 1st of the preceding year who have had the diagnosis registered in the Landspatientregisteret at least once within the previous 10 years [^src4]. To provide deeper clinical insights, the indicator's reporting incorporates risk stratification using the [[cha2ds2-vasc|CHA2DS2-VASc]] score and compares the bleeding rates between different anticoagulant therapies, such as [[doac|DOAC]] (0.53%) and [[marevan|Marevan]] (0.82%) [^src4].

### Quality Standards and Performance
The official quality standard ([[standarden|standarden]]) for Indikator 6 is set at an incidence rate of ≤ 0.6% [^src1] [^src4] [^src5]. Performance is evaluated annually based on specific reporting periods:

*   **2022–2023 Period (July 1, 2022 – June 30, 2023):** Nationally, 0.5% of prevalent atrial fibrillation patients were admitted with intracranial hemorrhage, meaning the national standard was met [^src2]. However, at the regional level, [[region-hovedstaden|Region Hovedstaden]] marginally failed the standard with an incidence of 0.7%, while other regions remained between 0.4% and 0.5% [^src1] [^src2]. For the incident population during this time, 0.7% developed bleeding, with only modest regional variation (0.6–0.8%) [^src2].
*   **2023–2024 Period (July 1, 2023 – June 30, 2024):** The national incidence was measured at 0.5% (95% CI: 0.5–0.6) [^src5]. During this period, 0.5% of prevalent patients were admitted with intracranial bleeding, and the ≤ 0.6% standard was successfully met both nationally and across all Danish regions [^src4].

Through these continuous evaluations, Indikator 6 plays a vital role in guiding cardiovascular health policies and anticoagulation strategies across the Danish healthcare system [^src4].

## Mentions
- Page 60: "Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med
atrieflimren." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 56-60)
- Page 63: "Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 61-65)
- Page 50: "Indikator 6: Incidens Intrakraniel blødning
Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 46-50)
- Page 51: "Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 51-55)

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: indikator-6
  Predicate: is-calculated-from
  Object: landspatientregisteret
  Evidence: "Oplysningerne vedrørende intrakraniel blødning indhentes fra Landspatientregistret"
  Page: 65
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 61-65
- Subject: indikator-6
  Predicate: measures-incidence-of
  Object: intrakraniel-blodning
  Evidence: "Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren."
  Page: 63
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 61-65
- Subject: indikator-6
  Predicate: measures-incidence-of
  Object: intrakraniel-bloedning
  Evidence: "Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren."
  Page: 50
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 46-50
- Subject: indikator-6
  Predicate: measures-incidence-of
  Object: intrakraniel-bloedning
  Evidence: "Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren"
  Page: 51
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 51-55
- Subject: indikator-6
  Predicate: applies-to-population-with-diagnosis
  Object: atrieflimren
  Evidence: "Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren"
  Page: 51
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 51-55
- Subject: indikator-6
  Predicate: is-administered-by
  Object: regionernes-kliniske-kvalitetsudviklingsprogram
  Evidence: "Regionernes Kliniske Kvalitetsudviklingsprogram"
  Page: 51
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 51-55
- Subject: indikator-6
  Predicate: uses-data-source
  Object: landspatientregisteret
  Evidence: "opgøres for alle prævalente patienter med en atrieflimren-diagnose, dvs. alle personer, som var i live pr. 1. juli 2023, og som har fået diagnosen registeret i Landspatientregisteret mindst én gang inden for de foregående 10 år."
  Page: 54
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 51-55
- Subject: indikator-6
  Predicate: uses-risk-stratification-tool
  Object: cha2ds2-vasc
  Evidence: "fordelingen af CHA2DS2-VASc score blandt patienterne med intrakraniel blødning"
  Page: 54
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 51-55
- Subject: indikator-6
  Predicate: compares-treatment-effects-of
  Object: doac
  Evidence: "Andelen af patienter med intrakraniel blødning er 0,53% for DOAC"
  Page: 54
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 51-55
- Subject: indikator-6
  Predicate: compares-treatment-effects-of
  Object: marevan
  Evidence: "og 0,82% for marevan"
  Page: 54
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 51-55

Incoming (this entity is the OBJECT of these relationships):
- Subject: region-hovedstaden
  Predicate: fails-indicator
  Object: (this entity)
  Evidence: "Hovedstaden Nej 245 / 37.128 0 (0) 0,7 (0,6-0,7) 234 / 37.251 0,6 0,7"
  Page: 60
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 56-60
- Subject: region-hovedstaden
  Predicate: fails-standard-for
  Object: (this entity)
  Evidence: "På regionalt niveau adskiller Hovedstaden sig marginalt og med en andel på 0,7% er standarden ikke opfyldt her"
  Page: 65
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 61-65
- Subject: atrieflimren
  Predicate: has-indicator
  Object: (this entity)
  Evidence: "Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren."
  Page: 6
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 6-10
- Subject: standarden
  Predicate: is-applied-to
  Object: (this entity)
  Evidence: "Standard ≤ 0,6%"
  Page: 51
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 51-55

## Claims
- Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren [^src1] (indikator-6)
  Type: health
  Page: 60
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 56-60
- Standard for indikator 6 er ≤ 0,6% [^src1] (indikator-6)
  Type: health
  Page: 60
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 56-60
- I alt blev 0,5% af de prævalente patienter med atrieflimren indlagt med intrakraniel blødning i den aktuelle opgørelsesperiode og standarden (0,6%) er således opfyldt [^src1] (databasen-for-atrieflimren-i-danmark, indikator-6)
  Type: health-statistic
  Page: 65
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 61-65
- På regionalt niveau adskiller Hovedstaden sig marginalt og med en andel på 0,7% er standarden ikke opfyldt her, i modsætning til de øvrige regioner, der ligger i niveauet 0,4–0,5% [^src1] (region-hovedstaden, indikator-6)
  Type: health-statistic
  Page: 65
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 61-65
- På landsplan udvikler 0,7% af den incidente population blødning og der ses kun beskeden regional variation (0,6–0,8%) [^src1] (indikator-6)
  Type: epidemiology
  Page: 65
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 61-65
- Indikator 6 har standarden ≤ 0,6 % for incidensen af intrakraniel blødning blandt prævalente patienter med atrieflimren [^src1] (atrieflimren, intrakraniel-bloedning, indikator-6)
  Type: quality-standard
  Page: 6
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 6-10
- For Indikator 6 blev den nationale incidens i perioden 01.07.2023–30.06.2024 målt til 0,5 % (95 % CI: 0,5–0,6) [^src1] (indikator-6)
  Type: performance-data
  Page: 7
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 6-10
- Standarden for Indikator 6 er ≤ 0,6% [^src1] (indikator-6, standarden)
  Type: policy
  Page: 51
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 51-55
- I den aktuelle opgørelsesperiode (01.07.2023 - 30.06.2024) blev 0,5% af de prævalente patienter med atrieflimren indlagt med intrakraniel blødning [^src1] (indikator-6, atrieflimren, intrakraniel-bloedning)
  Type: epidemiological
  Page: 54
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 51-55
- Standarden (0,6%) er opfyldt nationalt og i alle regioner [^src1] (standarden, indikator-6)
  Type: policy-decision
  Page: 55
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 51-55

## Timeline
- 2022-07-01: Start af opgørelsesperioden for Indikator 6 i årsrapporten for Databasen for Atrieflimren i Danmark (indikator-6, databasen-for-atrieflimren-i-danmark)
- 2023-06-30: Afslutning af opgørelsesperioden for Indikator 6 i årsrapporten for Databasen for Atrieflimren i Danmark (indikator-6, databasen-for-atrieflimren-i-danmark)
- 2023-07-01: Start af den aktuelle opgørelsesperiode for Indikator 6 (indikator-6)
- 2024-06-30: Slut på den aktuelle opgørelsesperiode for Indikator 6 (indikator-6)

## Sources

[^src1]: AFDK_2023.pdf, pages 56-60
[^src2]: AFDK_2023.pdf, pages 61-65
[^src3]: AFDK_2024.pdf, pages 46-50
[^src4]: AFDK_2024.pdf, pages 51-55
[^src5]: AFDK_2024.pdf, pages 6-10
