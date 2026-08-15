---
title: Laboratoriedatabasen
type: entity
wiki: rkkp-afdk
updated: '2026-08-14T21:10:09.265Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 21-25
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: '21-25, 31-35'
tags:
  - database
---
Laboratoriedatabasen is a national health database administered by [[sundhedsdatastyrelsen|Sundhedsdatastyrelsen]] [^src2]. It functions as a central repository for laboratory results, which are transferred from the country's larger laboratories via their connection to [[den-nationale-labdatabank|Den Nationale Labdatabank]] [^src2]. 

In the context of the national quality reporting for atrial fibrillation in Denmark, Laboratoriedatabasen is highly significant because it provides the foundational data for [[indikator-3|Indikator 3]] [^src1]. Specifically, data concerning the measurement of Thyroid Stimulating Hormone (TSH) at the time of a new atrial fibrillation diagnosis are retrieved through linkage with this database [^src1] [^src2]. Because the database's data sources and structural limitations directly impact the completeness of the laboratory data, understanding its mechanics is essential for accurately interpreting the results and systemic barriers associated with Indikator 3 [^src2].

## Mentions
* Page 24: "Data om måling af TSH er indhentet via kobling med Laboratoriedatabasen." [^src1]
* Page 24: "Data om måling af TSH er indhentet via kobling med Laboratoriedatabasen." [^src2]
* Page 34: "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." [^src3]

## Relationships

**Outgoing (this entity is the SUBJECT of these relationships):**
* **Subject:** laboratoriedatabasen | **Predicate:** is-administered-by | **Object:** sundhedsdatastyrelsen
  * **Evidence:** "Laboratoriedatabasen hos Sundhedsdatastyrelsen" (Page 24) [^src1]
* **Subject:** laboratoriedatabasen | **Predicate:** is-populated-from | **Object:** den-nationale-labdatabank
  * **Evidence:** "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." (Page 24) [^src2]

**Incoming (this entity is the OBJECT of these relationships):**
* **Subject:** indikator-3 | **Predicate:** relies-on-data-from | **Object:** laboratoriedatabasen
  * **Evidence:** "Data om måling af TSH er indhentet via kobling med Laboratoriedatabasen." (Page 24) [^src1]
* **Subject:** indikator-3 | **Predicate:** is-calculated-from | **Object:** laboratoriedatabasen
  * **Evidence:** "Data om måling af TSH er indhentet via kobling med Laboratoriedatabasen." (Page 24) [^src2]
* **Subject:** sundhedsdatastyrelsen | **Predicate:** administers | **Object:** laboratoriedatabasen
  * **Evidence:** "hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." (Page 24) [^src2]

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AFDK_2024.pdf, pages 21-25
[^src2]: AFDK_2025.pdf, pages 21-25
[^src3]: AFDK_2025.pdf, pages 31-35
