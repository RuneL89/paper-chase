---
title: Den Nationale Labdatabank
type: entity
aliases:
  - Den Nationale Labdatabank
wiki: rkkp-afdk
updated: '2026-08-14T20:04:04.676Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '26-30, 51-55'
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '21-25, 41-45'
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: '21-25, 31-35'
tags:
  - organization
---

**Den Nationale Labdatabank** is a national health data infrastructure organization in Denmark that acts as the central hub for collecting and distributing laboratory results. It retrieves test results from the country's major connected laboratories and forwards them to the [[sundhedsdatastyrelsen|Danish Health Data Authority]]'s [[laboratoriedatabasen|Laboratory Database]] [^src1] [^src2] [^src5]. This data pipeline is a foundational component of the Danish healthcare system's quality monitoring, directly populating national clinical registries such as the Atrial Fibrillation Database in Denmark (AFDK) [^src3] [^src4] [^src6]. Through this infrastructure, the AFDK can evaluate clinical quality indicators, such as thyroid screening (TSH) at the time of diagnosis and annual kidney function monitoring (creatinine) for patients on DOAC therapy [^src3] [^src4] [^src6]. However, laboratory results are only transferred to the AFDK via this pipeline if the patient has provided positive consent [^src1].

The entity operates as a critical bridge in the national data ecosystem, receiving feeds from the [[laboratorieregistret|Laboratory Registry]] and supplying the [[laboratoriedatabasen|Laboratory Database]] [^src2] [^src5]. Despite its central role, the system has faced structural barriers, including incomplete data coverage from certain laboratories, issues with LABKA coding, and a reliance on voluntary reporting without strict legal mandates [^src4]. Integration across Denmark's regions has been gradual. A significant organizational milestone was reached when [[region-midtjylland|Region Central Jutland]] systematically began transferring its test results to Den Nationale Labdatabank for the first time during a specific annual reporting period, marking a step forward in achieving comprehensive national data coverage [^src6]. 

## Mentions

- **Page 29**: "laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank" [^src1]
- **Page 53**: "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." [^src2]
- **Page 53**: "Nærværende årsrapportsperiode er den første hvor Region Midtjylland systematisk har overført prøvesvar til Den Nationale Labdatabank." [^src2]
- **Page 24**: "Den Nationale Labdatabank" [^src3]
- **Page 43**: "Den Nationale Labdatabank" [^src4]
- **Page 24**: "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." [^src5]
- **Page 34**: "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." [^src6]

## Relationships

**Outgoing (this entity is the SUBJECT of these relationships):**

- **Subject**: den-nationale-labdatabank
  **Predicate**: feeds-into
  **Object**: sundhedsdatastyrelsen
  **Evidence**: "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen."
  **Page**: 29
  **Source**: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 26-30 [^src1]

- **Subject**: den-nationale-labdatabank
  **Predicate**: feeds-into
  **Object**: sundhedsdatastyrelsen
  **Evidence**: "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen."
  **Page**: 53
  **Source**: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 51-55 [^src2]

- **Subject**: den-nationale-labdatabank
  **Predicate**: feeds-into
  **Object**: sundhedsdatastyrelsen
  **Evidence**: "Laboratoriesvar [...] videresendes ikke til Den Nationale Labdatabank, og dermed heller ikke til Laboratoriedatabasen [hos Sundhedsdatastyrelsen]."
  **Page**: 43
  **Source**: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45 [^src4]

**Incoming (this entity is the OBJECT of these relationships):**

- **Subject**: laboratorieregistret
  **Predicate**: feeds-into
  **Object**: (this entity)
  **Evidence**: "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen."
  **Page**: 53
  **Source**: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 51-55 [^src2]

- **Subject**: laboratoriedatabasen
  **Predicate**: is-populated-from
  **Object**: (this entity)
  **Evidence**: "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen."
  **Page**: 24
  **Source**: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 21-25 [^src5]

## Claims

- Nærværende årsrapportsperiode er den første hvor Region Midtjylland systematisk har overført prøvesvar til Den Nationale Labdatabank [^src1] (region-midtjylland, den-nationale-labdatabank)
  **Type**: organizational-change
  **Page**: 34
  **Source**: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 31-35 [^src6]

## Timeline

*(No explicit timeline events provided in the source data.)*

## Sources

[^src1]: AFDK_2023.pdf, pages 26-30
[^src2]: AFDK_2023.pdf, pages 51-55
[^src3]: AFDK_2024.pdf, pages 21-25
[^src4]: AFDK_2024.pdf, pages 41-45
[^src5]: AFDK_2025.pdf, pages 21-25
[^src6]: AFDK_2025.pdf, pages 31-35
