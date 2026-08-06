---
title: DEXA-scanning
type: entity
aliases:
  - DEXA-skanning
wiki: rkkp-danibd
updated: '2026-08-05T06:44:31.821Z'
sources:
  - file: wikis/rkkp-danibd/raw/DANIBD_2024.pdf
    pages: '1-5, 21-25, 46-47'
tags:
  - procedure
---
**DEXA-scanning** is a diagnostic procedure used to assess bone mineral density. In the context of the Danish Inflammatory Bowel Disease ([[ibd|IBD]]) database (DANIBD), it serves as a critical quality indicator (Indicator 4) required for patients over 50 years old who are receiving systemic steroid treatment, aiming to prevent osteoporosis and osteopenia [^src2]. The Danish endocrinological treatment guidelines recommend that a DEXA scan should be performed when a patient is planned for systemic steroid treatment for three months [^src2].

Despite its clinical importance, national performance on this indicator has been significantly below targets. During the reporting period from October 1, 2022, to September 30, 2023, only 37% of patients over 50 nationwide received a DEXA scan when prescribed steroids [^src1], [^src2]. The national development target is that at least 80% of such steroid courses should be accompanied by a DEXA scan [^src2]. All regions and departments fall far short of this goal, with the highest regional compliance at just 41% and the highest departmental compliance at 58% [^src2]. Specific departments reporting data on this indicator include [[nordsjaelland-kirurgisk-overafdeling|Nordsjælland Kirurgisk overafdeling]], [[slb-vejle-medicinsk-afdeling|SLB Vejle Medicinsk Afdeling]], and [[rigshospitalet-med-klinik-mave-tarm-lever|Rigshospitalet Med. Klinik Mave-, Tarm- og Leversygd.]] [^src2].

To address these shortfalls, administrative and operational changes are being explored at the regional level. [[region-nordjylland|Region Nordjylland]] has expressed a desire to increase its target for this indicator by investigating workflow changes [^src3]. This includes exploring the possibility of allowing nurses and secretaries in the Medical Gastroenterology department to directly order DEXA scans [^src3]. Furthermore, the region plans to retrospectively register and order DEXA scans for patients who will be included in the upcoming 2025 annual report [^src3].

## Mentions

- Page 1: "Indikator 4. DEXA-scanning, steroidbehandling" (source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 1-5)
- Page 21: "Knogleskørhed og osteopeni diagnosticeres bedst ved osteodensitometri (DEXA-scanning), som måler knoglemineraltætheden." (source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 21-25)
- Page 47: "Indikator 4: Andelen af steroidkure givet til patienter over 50 år med IBD, hvor patienten har fået foretaget
DEXA-skanning
RHN har et ønske om at øge egen målsætning ift. denne indikator. Vi vil derfor se på muligheden for en
ændret arbejdsgang, således det bliver muligt for sygeplejersker og sekretærer tilknyttet Med. Mave og
Tarmsygdomme fremadrettet at bestille en DEXA-skanning. Desuden er det besluttet, at vi vil forsøge at få
efterregistreret og bestilt DEXA-skanning på de patienter, som vil blive inkluderet i årsrapporten 2025." (source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 46-47)

## Relationships

**Outgoing (this entity is the SUBJECT of these relationships):**
- Subject: dexa-scanning
  Predicate: is-recommended-for
  Object: ibd
  Evidence: "Den danske endokrinologiske behandlingsvejledning anbefaler, at DEXA bør foretages ved planlagt systemisk behandling med steroid i 3 måneder."
  Page: 21
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 21-25

**Incoming (this entity is the OBJECT of these relationships):**
- Subject: nordsjaelland-kirurgisk-overafdeling
  Predicate: reports-indicator-4-data
  Object: (this entity)
  Evidence: "Nordsjælland Kirurgisk Afdeling 33 / 65 51 (38-63)"
  Page: 21
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 21-25
- Subject: slb-vejle-medicinsk-afdeling
  Predicate: reports-indicator-4-data
  Object: (this entity)
  Evidence: "SLB Vejle Medicinsk Afdeling 18 / 58 31 (20-45)"
  Page: 21
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 21-25
- Subject: rigshospitalet-med-klinik-mave-tarm-lever
  Predicate: reports-indicator-4-data
  Object: (this entity)
  Evidence: "Rigshospitalet Mave-, Tarm- og Leversygd. 5 / 16 31 (11-59)"
  Page: 21
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 21-25

## Claims

**quality-indicator**
- I indikatoren ”Medicinsk behandling, steroid” er kun 37 % af patienterne over 50 år på landsplan, der får foretaget DEXA scanning, når de får steroid [^src1] (dexa-scanning)
  Type: quality-indicator
  Page: 1
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 1-5

**quality-target**
- Udviklingsmålet for Indikator 4 er, at mindst 80 % af steroidkure givet til patienter over 50 år med IBD skal have foretaget DEXA-scanning [^src1] (ibd, dexa-scanning)
  Type: quality-target
  Page: 21
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 21-25

**performance-statistic**
- På landsplan er der udført DEXA-scanning inden for tidsrammen ved 37 % af steroidkurene [^src1] (dexa-scanning)
  Type: performance-statistic
  Page: 21
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 21-25

**performance-assessment**
- Alle regioner og afdelinger ligger langt fra udviklingsmålet, da regionen med højst andel DEXA-scanninger er på 41 % og afdelingsniveau på 58 % [^src1] (dexa-scanning)
  Type: performance-assessment
  Page: 21
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 21-25

**administrative**
- Region Nordjylland vil se på muligheden for en ændret arbejdsgang, så sygeplejersker og sekretærer kan bestille DEXA-skanning [^src1] (region-nordjylland, dexa-scanning)
  Type: administrative
  Page: 47
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 46-47
- Region Nordjylland vil forsøge at efterregistrere og bestille DEXA-skanning på patienter til årsrapporten 2025 [^src1] (region-nordjylland, dexa-scanning)
  Type: administrative
  Page: 47
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 46-47

## Timeline

- 01.10.2022 - 30.09.2023: Opgørelsesperiode for Indikator 4 (DEXA-scanning, steroidbehandling) (ibd, dexa-scanning)

## Sources

[^src1]: DANIBD_2024.pdf, pages 1-5
[^src2]: DANIBD_2024.pdf, pages 21-25
[^src3]: DANIBD_2024.pdf, pages 46-47
