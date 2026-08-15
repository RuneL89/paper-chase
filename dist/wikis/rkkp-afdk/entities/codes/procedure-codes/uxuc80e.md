---
title: UXUC80E
type: entity
wiki: rkkp-afdk
updated: '2026-08-14T20:32:53.412Z'
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
title: "UXUC80E"
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

**UXUC80E** is a specific medical procedure code used within the Danish healthcare system to designate transthoracic [[ekkokardiografi|Ekkokardiografi]] with tissue Doppler [^src1]. It serves as a critical data point in the national quality measurement of diagnostic practices for patients diagnosed with [[atrieflimren]] [^src1]. By standardizing how this specific imaging procedure is recorded in health registries, UXUC80E enables systematic data collection and cross-regional comparison of cardiovascular care quality [^src1].

In the context of clinical quality indicators, UXUC80E is not used in isolation. It forms part of a defined set of procedure codes that make up the echocardiography indicator area, which also includes [[uxuc80c|UXUC80C]], [[uxuc80d|UXUC80D]], [[uxuc81|UXUC81]], and [[uxuc81c|UXUC81C]] [^src1]. This grouping ensures that various forms and complexities of echocardiographic examinations are comprehensively tracked when evaluating the diagnostic workup of [[atrieflimren]] patients [^src3].

The code's definition and application have remained consistent across recent national reporting periods. It is explicitly detailed in the technical guidelines and calculation rules for clinical quality indicators published in the annual "Atrial Fibrillation in Denmark" reports spanning 2023, 2024, and 2025 [^src1] [^src2] [^src3]. These reports, produced by organizations such as the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP), rely on UXUC80E to accurately calculate denominators and numerators for registry-based quality metrics [^src2].

## Mentions
- Page 116: "UXUC80E (transthorakal ekkokardiografi med vævsdoppler)" [^src1]
- Page 105: "UXUC80E (transthorakal ekkokardiografi med vævsdoppler)" [^src2]
- Page 91: "UXUC80E (transthorakal ekkokardiografi med vævsdoppler)" [^src3]

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: uxuc80e
  Predicate: is-procedure-code-for
  Object: atrieflimren
  Evidence: "UXUC80E (transthorakal ekkokardiografi med vævsdoppler)"
  Page: 116 [^src1]
- Subject: uxuc80e
  Predicate: is-code-for
  Object: ekkokardiografi
  Evidence: "UXUC80E (transthorakal ekkokardiografi med vævsdoppler)"
  Page: 91 [^src3]

Incoming (this entity is the OBJECT of these relationships):
- Subject: ekkokardiografi
  Predicate: coded-as
  Object: (this entity)
  Evidence: "UXUC80E (transthorakal ekkokardiografi med vævsdoppler)"
  Page: 105 [^src2]

## Claims
- Indikatorområdet for ekkokardiografi inkluderer koderne UXUC80C, UXUC80D, UXUC80E, UXUC81 og UXUC81C [^src1] (uxuc80c, uxuc80d, uxuc80e, uxuc81, uxuc81c)
  Type: procedural
  Page: 116 [^src1]

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 116-120
[^src2]: AFDK_2024.pdf, pages 101-105
[^src3]: AFDK_2025.pdf, pages 91-95
