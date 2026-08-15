---
title: UXUC80C
type: entity
wiki: rkkp-afdk
updated: '2026-08-14T20:31:43.738Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 116-120
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 101-105
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 91-95
tags:
  - procedure-code
---
```yaml
---
title: "UXUC80C"
type: procedure-code
wiki: rkkp-afdk
updated: "2024-05-24T10:00:00Z"
sources:
  - file: "wikis/rkkp-afdk/raw/AFDK_2023.pdf"
    pages: "116-120"
  - file: "wikis/rkkp-afdk/raw/AFDK_2024.pdf"
    pages: "101-105"
  - file: "wikis/rkkp-afdk/raw/AFDK_2025.pdf"
    pages: "91-95"
---
```

UXUC80C is a specific medical procedure code used in the Danish healthcare system to designate transthoracic echocardiography with contrast [^src1]. It is one of several codes utilized to track and measure the quality of diagnostic practices for patients with [[atrieflimren]] [^src1]. Within the national quality indicators managed by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP), UXUC80C is grouped alongside other related codes such as [[uxuc80d|UXUC80D]], [[uxuc80e|UXUC80E]], [[uxuc81|UXUC81]], and [[uxuc81c|UXUC81C]] to define the indicator area for [[ekkokardiografi|Ekkokardiografi]] [^src1]. 

The code has been consistently referenced across multiple annual reports of the Danish Atrial Fibrillation Database (AFDK) from 2023 to 2025, underscoring its ongoing role in standardized data collection and regional comparisons of cardiovascular care [^src1] [^src2] [^src3]. By capturing instances where contrast-enhanced transthoracic echocardiography is performed, the code helps ensure that patients receive appropriate diagnostic imaging, which is a critical step in the clinical management and follow-up of atrial fibrillation [^src2] [^src3].

## Mentions
- Page 116: "UXUC80C (transthorakal ekkokardiografi med kontrast)" [^src1]
- Page 104: "UXUC80C (transthorakal ekkokardiografi med kontrast)" [^src2]
- Page 91: "UXUC80C (transthorakal ekkokardiografi med kontrast)" [^src3]

## Relationships

**Outgoing (this entity is the SUBJECT of these relationships):**
- **Subject:** uxuc80c | **Predicate:** is-procedure-code-for | **Object:** atrieflimren
  - **Evidence:** "UXUC80C (transthorakal ekkokardiografi med kontrast)"
  - **Page:** 116 | **Source:** [^src1]
- **Subject:** uxuc80c | **Predicate:** is-code-for | **Object:** ekkokardiografi
  - **Evidence:** "UXUC80C (transthorakal ekkokardiografi med kontrast)"
  - **Page:** 91 | **Source:** [^src3]

**Incoming (this entity is the OBJECT of these relationships):**
- **Subject:** ekkokardiografi | **Predicate:** coded-as | **Object:** uxuc80c
  - **Evidence:** "UXUC80C (transthorakal ekkokardiografi med kontrast)"
  - **Page:** 104 | **Source:** [^src2]

## Claims
- Indikatorområdet for ekkokardiografi inkluderer koderne UXUC80C, UXUC80D, UXUC80E, UXUC81 og UXUC81C [^src1] (uxuc80c, uxuc80d, uxuc80e, uxuc81, uxuc81c)
  - **Type:** procedural
  - **Page:** 116
  - **Source:** [^src1]

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 116-120
[^src2]: AFDK_2024.pdf, pages 101-105
[^src3]: AFDK_2025.pdf, pages 91-95
