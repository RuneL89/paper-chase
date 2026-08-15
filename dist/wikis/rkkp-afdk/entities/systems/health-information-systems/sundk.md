---
title: SundK
type: entity
wiki: rkkp-afdk
updated: '2026-08-14T21:23:36.230Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 21-25
tags:
  - system
---

SundK is the national health information system in Denmark, serving as a central hub for healthcare quality monitoring and data aggregation [^src1]. In the context of the national quality report for atrial fibrillation, SundK is the designated destination for critical laboratory data required to evaluate clinical performance [^src1]. 

Specifically, SundK receives TSH (thyroid-stimulating hormone) measurement data transferred from the laboratory system [[labka|LABKA]] [^src1]. This data pipeline is essential for the calculation of Indicator 3, a quality metric that tracks whether patients receive a TSH measurement upon a new diagnosis of atrial fibrillation to rule out underlying thyroid disease [^src1]. Additionally, clinical data from general practice (*almen praksis*) is also transferred to SundK to support these national evaluations [^src1].

The reliability of this data transfer is a significant factor in healthcare quality reporting. During the 2024–2025 measurement period, systemic barriers related to coding in LABKA and the subsequent transfer of data to SundK were identified as critical issues [^src1]. Missing or incomplete data transfers to SundK are a known source of error, potentially skewing the geographic and national results of the quality indicators [^src1].

## Mentions
- Page 24: "alle koder for TSH målinger i LABKA bliver ”fanget” og overført til SundK." [^src1]
- Page 24: "når data fra almen praksis bliver overført til SundK." [^src1]

## Relationships
**Outgoing (this entity is the SUBJECT of these relationships):**
- **Subject:** sundk
  **Predicate:** receives-data-from
  **Object:** labka
  **Evidence:** "alle koder for TSH målinger i LABKA bliver ”fanget” og overført til SundK."
  **Page:** 24
  **Source:** wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 21-25 [^src1]

**Incoming (this entity is the OBJECT of these relationships):**
- **Subject:** labka
  **Predicate:** is-used-in
  **Object:** (this entity)
  **Evidence:** "alle koder for TSH målinger i LABKA bliver ”fanget” og overført til SundK."
  **Page:** 24
  **Source:** wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 21-25 [^src1]

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AFDK_2025.pdf, pages 21-25
