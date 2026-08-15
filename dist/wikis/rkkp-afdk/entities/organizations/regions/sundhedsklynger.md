---
title: Sundhedsklyngerne
type: entity
aliases:
  - Sundhedsklyngerne
  - Sundhedsklynge
wiki: rkkp-afdk
updated: '2026-08-14T20:53:17.184Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '1-5, 91-95'
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: '1-5, 36-40, 46-50'
tags:
  - organization
---
**Sundhedsklyngerne** (the Health Clusters) are 21 geographic regional cooperation units in Denmark that serve as the primary framework for reporting quality results in the national atrial fibrillation reports [^src1] [^src2]. They represent a structural shift toward population-based quality measurement, requiring all healthcare sectors—including general practice, hospitals, and practicing cardiologists—to collaborate on the shared population responsibility for patients with atrial fibrillation [^src1].

Going forward, the results from the [[databasen-for-atrieflimren-i-danmark|Databasen for Atrieflimren i Danmark]] are primarily reported based on the patients' residence within these 21 clusters rather than by individual municipality or hospital [^src1] [^src2]. This geographic stratification is used to evaluate clinical outcomes across the country. For example, [[indikator-7|Indikator 7]], which tracks the incidence of [[alvorlig-bloedning|Alvorlig blødning]] (severe bleeding), is stratified by health cluster, showing variation between 1.9% and 2.7% across the different units [^src5]. Similarly, the incidence of ischemic stroke among prevalent patients varies between 0.5% and 1.1% at the cluster level [^src4]. Because a small number of stroke cases can significantly alter the proportions, reports advise that cluster-level results must be interpreted with a certain degree of caution [^src4].

The 21 clusters encompass specific municipalities and areas. Identified clusters include Sundhedsklynge Bornholm (covering [[bornholm|Bornholm]]), Sundhedsklynge Byen (covering [[koebenhavn|København]] and [[frederiksberg|Frederiksberg]]), as well as clusters designated as Midt, Nord, and Syd [^src3] [^src5]. By analyzing data at this level, the [[atrieflimren-i-danmark|Atrieflimren i Danmark]] reports provide an evidence base for both local clinical quality improvement and national resource allocation [^src3] [^src4].

## Mentions

- Page 4: "alle sektorer har til opgave at samarbejde om det
samlede populationsansvar for patienter med atrieflimren" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 1-5)
- Page 5: "afrapporteres databasens resultater fremadrettet primært med afsæt i
patienternes bopæl i de 21 sundhedsklynger" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 1-5)
- Page 5: "afrapporteres databasens resultater primært med afsæt i patienternes bopæl i de 21 sundhedsklynger" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 1-5)
- Page 93: "Klyngerne" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 91-95)
- Page 36: "Sundhedsklynge" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 36-40)
- Page 38: "Indikator 5: Incidens af iskæmisk apopleksi blandt prævalente patienter med atrieflimren. Kontroldiagram på klyngeniveau." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 36-40)
- Page 39: "Variationen på klyngeniveau er i niveauet 0,5-1,1%. Selvom populationerne med overgangen fra bopælskommune til bopælsklynge er større, er der stadig en vis tilfældig variation i estimaterne, da ganske få stroke tilfælde kan ændre andelene. Resultaterne på klyngeniveau skal således fortolkes med en vis forsigtighed." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 36-40)
- Page 47: "Sundhedsklynge Bornholm" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 46-50)
- Page 47: "Sundhedsklynge Byen" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 46-50)
- Page 47: "Sundhedsklynge Midt" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 46-50)
- Page 47: "Sundhedsklynge Nord" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 46-50)
- Page 47: "Sundhedsklynge Syd" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 46-50)

## Relationships

**Outgoing**
- Subject: sundhedsklynger
  Predicate: is-reporting-unit-for
  Object: atrieflimren-i-danmark
  Evidence: "afrapporteres databasens resultater fremadrettet primært med afsæt i patienternes bopæl i de 21 sundhedsklynger"
  Page: 5
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 1-5
- Subject: sundhedsklynger
  Predicate: are-analytical-units-for
  Object: databasen-for-atrieflimren-i-danmark
  Evidence: "afrapporteres databasens resultater primært med afsæt i patienternes bopæl i de 21 sundhedsklynger"
  Page: 5
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 1-5
- Subject: sundhedsklynger
  Predicate: comprises-municipality
  Object: bornholm
  Evidence: "Sundhedsklynge Bornholm Bornholm"
  Page: 93
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 91-95
- Subject: sundhedsklynger
  Predicate: comprises-municipality
  Object: koebenhavn
  Evidence: "Sundhedsklynge Byen København"
  Page: 93
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 91-95
- Subject: sundhedsklynger
  Predicate: comprises-municipality
  Object: frederiksberg
  Evidence: "Sundhedsklynge Byen Frederiksberg"
  Page: 93
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 91-95

**Incoming**
- Subject: indikator-7
  Predicate: is-stratified-by
  Object: (this entity)
  Evidence: "Sundhedsklynge Bornholm ... Sundhedsklynge Byen ... Sundhedsklynge Midt ... Sundhedsklynge Nord ... Sundhedsklynge Syd"
  Page: 47
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 46-50

## Claims

- Variationen på klyngeniveau er i niveauet 0,5–1,1% [^src1] (sundhedsklynger)
  Type: geographic-distribution
  Page: 39
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 36-40
- På klyngeniveau varierede andelen med alvorlig blødning mellem 1,9-2,7% [^src1] (sundhedsklynger, alvorlig-bloedning)
  Type: epidemiological
  Page: 50
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 46-50

## Timeline

No timeline events are recorded for this entity.

## Sources

[^src1]: AFDK_2024.pdf, pages 1-5
[^src2]: AFDK_2025.pdf, pages 1-5
[^src3]: AFDK_2024.pdf, pages 91-95
[^src4]: AFDK_2025.pdf, pages 36-40
[^src5]: AFDK_2025.pdf, pages 46-50
