---
title: P-creatinin
type: entity
wiki: rkkp-afdk
updated: '2026-08-14T21:12:03.913Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '36-40, 41-45'
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: '26-30, 31-35, 91-95'
tags:
  - laboratory-test
---

**P-creatinin** (plasma creatinine) is a laboratory test parameter used in the Danish national quality assurance program for [[atrieflimren]] to monitor kidney function in patients receiving direct oral anticoagulants ([[antikoagulationsbehandling]]) [^src1]. It serves as an alternative to serum creatinine for assessing renal function, specifically within the framework of [[indikator-4b|Indikator 4b]] [^src1].

In the context of the national quality reports (AFDK) for 2024 and 2025, Indikator 4b measures the proportion of atrial fibrillation patients on DOAC therapy who have at least one measurement of P-creatinin annually [^src1] [^src3]. This monitoring is a critical safety measure, as renal function directly impacts the clearance and safe dosing of DOACs [^src2] [^src4]. To capture these laboratory measurements from the Danish Laboratory Register, the national database relies on two specific NPU codes: [[npu04998-p-kreatinin|NPU04998 (P-Kreatinin)]], which is predominantly used in the Capital Region and Region Zealand, and [[npu18016-p-kreatinin|NPU18016 (P-Kreatinin)]], which is primarily used in the Region of Southern Denmark and the North Denmark Region [^src4]. 

The integration of P-creatinin data highlights the complex data infrastructure behind national healthcare quality measurements, bridging clinical safety monitoring with intersectoral laboratory data systems [^src2] [^src4]. While the national target for Indikator 4b aims for high compliance (≥95% in recent reports), geographical variations persist, emphasizing the need for targeted quality improvement at the regional and local levels [^src4].

## Mentions

- **Page 39:** "Indikator 4b: Andel af patienter med atrieflimren i behandling med direkte orale antikoagulantia (DOAC) med mindst 1 måling af P-creatinin årligt." [^src1]
- **Page 42:** "mindst 1 måling af P-creatinin årligt" [^src2]
- **Page 43:** "P-creatinin" [^src2]
- **Page 30:** "mindst 1 måling af P-creatinin årligt." [^src3]
- **Page 32:** "Indikator 4b: Andel af patienter med atrieflimren i behandling med direkte orale antikoagulantia (DOAC) med mindst 1 måling af P-creatinin årligt." [^src4]
- **Page 33:** "Indikator 4b: Andel af patienter med atrieflimren i behandling med direkte orale antikoagulantia (DOAC) med mindst 1 måling af P-creatinin årligt." [^src4]
- **Page 34:** "Fra Laboratorieregistret indhentes informationer om p-creatinin vha. to NPU-koder: NPU04998, som overvejende anvendes i Region Hovedstaden og Region Sjælland, og NPU18016, som overvejende anvendes i Region Syddanmark og Region Nordjylland." [^src4]

## Relationships

- **Subject:** indikator-4b
  **Predicate:** uses-laboratory-parameter
  **Object:** P-creatinin
  **Evidence:** "Indikator 4b: Andel af patienter med atrieflimren i behandling med direkte orale antikoagulantia (DOAC) med mindst 1 måling af P-creatinin årligt."
  **Page:** 39
  **Source:** [^src1]

- **Subject:** indikator-4b
  **Predicate:** depends-on
  **Object:** P-creatinin
  **Evidence:** "Indikator 4b: Andel af patienter med atrieflimren i behandling med direkte orale antikoagulantia (DOAC) med mindst 1 måling af P-creatinin årligt."
  **Page:** 42
  **Source:** [^src2]

- **Subject:** indikator-4b
  **Predicate:** measures
  **Object:** P-creatinin
  **Evidence:** "Indikator 4b: Andel af patienter med atrieflimren i behandling med direkte orale antikoagulantia (DOAC) med mindst 1 måling af P-creatinin årligt."
  **Page:** 30
  **Source:** [^src3]

- **Subject:** indikator-4b
  **Predicate:** measures
  **Object:** P-creatinin
  **Evidence:** "Indikator 4b: Andel af patienter med atrieflimren i behandling med direkte orale antikoagulantia (DOAC) med mindst 1 måling af P-creatinin årligt."
  **Page:** 32
  **Source:** [^src4]

- **Subject:** npu04998-p-kreatinin
  **Predicate:** is-laboratory-test-code-for
  **Object:** P-creatinin
  **Evidence:** "NPU04998 (P-Kreatinin)"
  **Page:** 92
  **Source:** [^src5]

- **Subject:** npu18016-p-kreatinin
  **Predicate:** is-laboratory-test-code-for
  **Object:** P-creatinin
  **Evidence:** "NPU18016 (P-Kreatinin)"
  **Page:** 92
  **Source:** [^src5]

## Claims

- **Type:** quality-indicator
  **Claim:** Indikator 4b: Andelen af patienter med atrieflimren i behandling med direkte orale antikoagulantia (DOAC) med mindst 1 måling af P-creatinin årligt [^src1] (antikoagulationsbehandling, p-creatinin, atrieflimren)
  **Page:** 92
  **Source:** [^src5]

## Timeline

No timeline events are recorded for this entity.

## Sources

[^src1]: AFDK_2024.pdf, pages 36-40
[^src2]: AFDK_2024.pdf, pages 41-45
[^src3]: AFDK_2025.pdf, pages 26-30
[^src4]: AFDK_2025.pdf, pages 31-35
[^src5]: AFDK_2025.pdf, pages 91-95
