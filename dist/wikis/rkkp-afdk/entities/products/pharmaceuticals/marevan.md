---
title: marevan
type: entity
wiki: rkkp-afdk
updated: '2026-08-05T20:13:01.353Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '101-105, 61-65, 66-70, 71-75, 91-95, 96-100'
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '46-50, 51-55, 56-60, 71-75, 76-80'
tags:
  - product
---
# marevan

Marevan (warfarin) is a classic oral [[antikoagulationsbehandling]] used in the treatment of [[atrieflimren]] in Denmark [^src1][^src5]. In national clinical quality reports, Marevan is frequently compared with [[doac|DOAC]] (direct oral anticoagulants) to evaluate treatment safety and efficacy, particularly regarding the risks of [[intrakraniel-bloedning|Intrakraniel blødning]] and [[alvorlig-bloedning|Alvorlig blødning]] among [[praevalente-patienter-med-atrieflimren|Prævalente patienter med atrieflimren]] [^src2][^src9].

According to the 2023 annual report from the Danish Atrial Fibrillation Database, the proportion of patients experiencing intracranial bleeding was 0.46% for those treated with Marevan, compared to 0.52% for DOAC [^src1]. However, the risk of severe bleeding was slightly higher for Marevan at 2.44%, versus 2.33% for DOAC [^src3]. The report noted an expectation that the overall risk of intracranial bleeding would decrease over time due to the broader introduction of DOACs, which have a lower risk of complicating intracranial bleeding compared to Marevan [^src2]. For context, patients with atrial fibrillation who received neither DOAC nor Marevan had a 0.53% rate of developing ischemic stroke [^src4].

Data from the subsequent 2024 report shows updated comparative outcomes. The incidence of ischemic stroke (tracked under [[indikator-5|Indikator 5]]) was 0.51% for Marevan and 0.89% for DOAC [^src7]. The rate of intracranial bleeding (tracked under [[indikator-6|Indikator 6]]) was 0.82% for Marevan compared to 0.53% for DOAC [^src8]. The proportion of patients experiencing severe bleeding was 2.38% for Marevan and 2.30% for DOAC [^src9]. These metrics are critical for evaluating the safety of [[atrieflimren-behandling]] and guiding clinical practices across [[atrieflimren-i-danmark|Atrieflimren i Danmark]] [^src10][^src11].

## Mentions

- Page 65: "I Appendiks rapporteres andele af patienter i behandling med DOAC og/eller marevan, eller ingen af disse, der har haft en intrakraniel blødning i årsrapportsperioden. Andelen af patienter med intrakraniel blødning er 0,52% for DOAC og 0,46% for marevan." [^src1]
- Page 66: "Det forventes, at risikoen for intrakraniel blødning vil aftage over tid som følge af introduktionen af DOAC (direkte orale antikoagulantia), der har lavere risiko for komplicerende intrakraniel blødning sammenlignet med Marevan." [^src2]
- Page 72: "Andelen af patienter med alvorlig blødning er 2,33% for DOAC og 2,44% for marevan." [^src3]
- Page 92: "DOAC
Marevan 8486 99.44 48 0.56" [^src4]
- Page 98: "Marevan 8495 99.54 39 0.46" [^src5]
- Page 101: "Marevan 8326 97.56 208 2.44" [^src6]
- Page 49: "I Appendiks rapporteres andele af patienter i behandling med DOAC og/eller marevan, eller ingen af disse, der har
haft en iskæmisk apopleksi i årsrapportsperioden. Andelen af patienter med iskæmisk apopleksi er 0,89% for DOAC
og 0,51% for marevan." [^src7]
- Page 54: "og 0,82% for marevan" [^src8]
- Page 60: "Andelen af patienter med alvorlig blødning er 2,30% for DOAC og 2,38% for marevan." [^src9]
- Page 73: "Marevan 6442 99.49 33 0.51" [^src10]
- Page 74: "Marevan 6422 99.18 53 0.82" [^src10]
- Page 77: "Marevan 6321 97.62 154 2.38" [^src11]

## Relationships

**Outgoing (this entity is the SUBJECT of these relationships):**

- **Subject:** marevan
  **Predicate:** is-treatment-for
  **Object:** atrieflimren
  **Evidence:** "andele af patienter i behandling med DOAC og/eller marevan, eller ingen af disse, der har haft en intrakraniel blødning i årsrapportsperioden"
  **Page:** 65 [^src1]

- **Subject:** marevan
  **Predicate:** is-used-for
  **Object:** atrieflimren-behandling
  **Evidence:** "DOAC
Marevan 8486 99.44 48 0.56"
  **Page:** 92 [^src4]

- **Subject:** marevan
  **Predicate:** is-anticoagulant-used-in-treatment-of
  **Object:** atrieflimren
  **Evidence:** "Marevan 8495 99.54 39 0.46"
  **Page:** 98 [^src5]

- **Subject:** marevan
  **Predicate:** associated-with
  **Object:** indikator-5
  **Evidence:** "Andelen af patienter med iskæmisk apopleksi er 0,89% for DOAC og 0,51% for marevan."
  **Page:** 49 [^src7]

- **Subject:** marevan
  **Predicate:** is-treatment-for
  **Object:** praevalente-patienter-med-atrieflimren
  **Evidence:** "Andelen af patienter med alvorlig blødning er 2,30% for DOAC og 2,38% for marevan."
  **Page:** 60 [^src9]

- **Subject:** marevan
  **Predicate:** is-type-of
  **Object:** antikoagulationsbehandling
  **Evidence:** "Marevan 6442 99.49 33 0.51"
  **Page:** 73 [^src10]

- **Subject:** marevan
  **Predicate:** is-used-in-treatment-of
  **Object:** atrieflimren-i-danmark
  **Evidence:** "Marevan 6321 97.62 154 2.38"
  **Page:** 77 [^src11]

**Incoming (this entity is the OBJECT of these relationships):**

- **Subject:** doac
  **Predicate:** has-lower-risk-than
  **Object:** marevan
  **Evidence:** "DOAC har lavere risiko for komplicerende intrakraniel blødning sammenlignet med Marevan."
  **Page:** 66 [^src2]

- **Subject:** doac
  **Predicate:** is-compared-with
  **Object:** marevan
  **Evidence:** "Andelen af patienter med alvorlig blødning er 2,33% for DOAC og 2,44% for marevan."
  **Page:** 72 [^src3]

- **Subject:** indikator-6
  **Predicate:** compares-treatment-effects-of
  **Object:** marevan
  **Evidence:** "og 0,82% for marevan"
  **Page:** 54 [^src8]

## Claims

- Andelen af patienter med intrakraniel blødning er 0,52% for DOAC og 0,46% for marevan [^src1]
  **Type:** pharmacovigilance
  **Page:** 65

- Andelen af patienter med alvorlig blødning er 2,33% for DOAC og 2,44% for marevan [^src1]
  **Type:** pharmacological
  **Page:** 72

- For patienter med atrieflimren, der ikke modtog DOAC eller Marevan, var andelen, der udviklede iskæmisk apopleksi, 0,53 % [^src1]
  **Type:** clinical
  **Page:** 92

- For patienter med atrieflimren, der modtog Marevan-behandling, var andelen af intrakraniel blødning 0,46 % [^src1]
  **Type:** pharmacovigilance
  **Page:** 98

- Andelen af patienter med iskæmisk apopleksi er 0,89% for DOAC og 0,51% for marevan [^src1]
  **Type:** comparative-result
  **Page:** 49

- Andelen af patienter med intrakraniel blødning er 0,53% for DOAC og 0,82% for marevan [^src1]
  **Type:** pharmacovigilance
  **Page:** 54

- Andelen af patienter med alvorlig blødning er 2,30% for DOAC og 2,38% for marevan [^src1]
  **Type:** pharmacovigilance
  **Page:** 60

## Timeline

*(No timeline events extracted for this entity.)*

## Sources

[^src1]: AFDK_2023.pdf, pages 61-65
[^src2]: AFDK_2023.pdf, pages 66-70
[^src3]: AFDK_2023.pdf, pages 71-75
[^src4]: AFDK_2023.pdf, pages 91-95
[^src5]: AFDK_2023.pdf, pages 96-100
[^src6]: AFDK_2023.pdf, pages 101-105
[^src7]: AFDK_2024.pdf, pages 46-50
[^src8]: AFDK_2024.pdf, pages 51-55
[^src9]: AFDK_2024.pdf, pages 56-60
[^src10]: AFDK_2024.pdf, pages 71-75
[^src11]: AFDK_2024.pdf, pages 76-80
