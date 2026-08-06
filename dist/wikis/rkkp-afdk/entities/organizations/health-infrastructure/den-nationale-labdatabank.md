---
title: Den Nationale Labdatabank
type: entity
aliases:
  - Den Nationale Labdatabank
wiki: rkkp-afdk
updated: '2026-08-05T19:59:53.341Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '26-30, 51-55'
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '21-25, 41-45'
tags:
  - organization
---

**Den Nationale Labdatabank** is a national infrastructure in Denmark responsible for retrieving and forwarding laboratory results from connected laboratories across the country [^src1] [^src2]. It serves as a critical data pipeline for national health quality registers, most notably by feeding laboratory data into the [[sundhedsdatastyrelsen|Sundhedsdatastyrelsen]] (Danish Health Data Authority) and its associated Laboratory Database [^src1] [^src2]. This infrastructure is essential for evaluating clinical quality indicators in the Danish Atrial Fibrillation Database (AFDK), such as monitoring thyroid function (TSH) at the time of diagnosis and tracking annual kidney function (P-creatinin) for patients on anticoagulant therapy [^src1] [^src2] [^src4]. Data from the national [[laboratorieregistret|Laboratorieregistret]] (Laboratory Register) also feeds into this system [^src2].

The transmission of data through Den Nationale Labdatabank is subject to strict patient privacy rules; results are only forwarded to the AFDK if the patient has provided positive consent [^src1]. Additionally, the infrastructure faces structural and regional limitations. For example, the 2022–2023 AFDK annual report highlighted that the reporting period was the very first time the Central Denmark Region (Region Midtjylland) systematically transferred its test results to the National Lab Database [^src2]. Furthermore, not all laboratory data is captured by the system; certain test results are not forwarded to the National Lab Database, which consequently prevents them from reaching the Health Data Authority's Laboratory Database [^src4]. These gaps in data coverage and reliance on voluntary reporting without strict legal obligations represent ongoing systemic challenges for national cardiovascular quality measurements [^src3] [^src4].

## Mentions

- Page 29: "laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank" [^src1]
- Page 53: "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." [^src2]
- Page 53: "Nærværende årsrapportsperiode er den første hvor Region Midtjylland systematisk har overført prøvesvar til Den Nationale Labdatabank." [^src2]
- Page 24: "Den Nationale Labdatabank" [^src3]
- Page 43: "Den Nationale Labdatabank" [^src4]

## Relationships

**Outgoing**
- **Subject:** den-nationale-labdatabank | **Predicate:** feeds-into | **Object:** sundhedsdatastyrelsen
  - **Evidence:** "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." [^src1]
- **Subject:** den-nationale-labdatabank | **Predicate:** feeds-into | **Object:** sundhedsdatastyrelsen
  - **Evidence:** "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." [^src2]
- **Subject:** den-nationale-labdatabank | **Predicate:** feeds-into | **Object:** sundhedsdatastyrelsen
  - **Evidence:** "Laboratoriesvar [...] videresendes ikke til Den Nationale Labdatabank, og dermed heller ikke til Laboratoriedatabasen [hos Sundhedsdatastyrelsen]." [^src4]

**Incoming**
- **Subject:** laboratorieregistret | **Predicate:** feeds-into | **Object:** den-nationale-labdatabank
  - **Evidence:** "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." [^src2]

## Claims

(none)

## Timeline

(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 26-30
[^src2]: AFDK_2023.pdf, pages 51-55
[^src3]: AFDK_2024.pdf, pages 21-25
[^src4]: AFDK_2024.pdf, pages 41-45
