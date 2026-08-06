---
title: UXUC80D
type: entity
wiki: rkkp-afdk
updated: '2026-08-05T20:39:37.728Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 116-120
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 101-105
tags:
  - procedure-code
---

UXUC80D is a specific medical procedure code designating transthoracic 3-D echocardiography. Within the Danish healthcare system, this code is utilized in the national health registers and plays a critical role in the clinical quality measurement of diagnostic practices for patients with [[atrieflimren]] [^src1]. The code is tracked by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP) as part of the national Database for Atrial Fibrillation in Denmark, supporting standardized data collection and cross-regional comparison of cardiovascular care.

In the context of clinical quality indicators, UXUC80D is grouped within the broader indicator area for [[ekkokardiografi|Ekkokardiografi]]. It is explicitly listed alongside related procedure codes, including [[uxuc80c|UXUC80C]], [[uxuc80e|UXUC80E]], [[uxuc81|UXUC81]], and [[uxuc81c|UXUC81C]], to comprehensively capture the various types of echocardiographic examinations performed on patients [^src1]. These precise codes are essential for calculating standardized quality metrics—such as defining the numerators, denominators, and exclusion criteria for the echocardiography indicator—which ensures that atrial fibrillation patients receive appropriate and timely diagnostic imaging [^src2]. 

## Mentions
- Page 116: "UXUC80D (transthorakal 3-D ekkokardiografi)" [^src1]
- Page 105: "UXUC80D (transthorakal 3-D ekkokardiografi)" [^src2]

## Relationships
**Outgoing**
- Subject: uxuc80d
  Predicate: is-procedure-code-for
  Object: atrieflimren
  Evidence: "UXUC80D (transthorakal 3-D ekkokardiografi)"
  Page: 116
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120 [^src1]

**Incoming**
- Subject: ekkokardiografi
  Predicate: coded-as
  Object: (this entity)
  Evidence: "UXUC80D (transthorakal 3-D ekkokardiografi)"
  Page: 105
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105 [^src2]

## Claims
- Indikatorområdet for ekkokardiografi inkluderer koderne UXUC80C, UXUC80D, UXUC80E, UXUC81 og UXUC81C [^src1] (uxuc80c, uxuc80d, uxuc80e, uxuc81, uxuc81c)
  Type: procedural
  Page: 116
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 116-120
[^src2]: AFDK_2024.pdf, pages 101-105
