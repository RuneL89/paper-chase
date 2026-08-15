---
title: UXUC81
type: entity
wiki: rkkp-afdk
updated: '2026-08-14T20:32:48.979Z'
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
UXUC81 is a specific medical procedure code used in the Danish healthcare system to designate transesophageal echocardiography [^src1]. It serves as a critical data point in the national quality measurement of diagnostic practices for patients with [[atrieflimren]] [^src1]. By capturing this specific procedure in the Danish National Health Service Register (Sygesikringsregisteret), healthcare authorities can systematically monitor and evaluate the standard of care provided to cardiovascular patients across the country [^src1].

Within the framework of clinical quality indicators managed by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP), UXUC81 is formally categorized under the broader indicator area for [[ekkokardiografi|Ekkokardiografi]] [^src3]. This indicator area relies on a specific set of procedure codes to calculate quality metrics, explicitly including [[uxuc80c|UXUC80C]], [[uxuc80d|UXUC80D]], [[uxuc80e|UXUC80E]], UXUC81, and [[uxuc81c|UXUC81C]] [^src1]. These codes are used to define the numerators and denominators for national registries, ensuring that diagnostic interventions are accurately tracked and compared regionally [^src2]. 

The code's persistent presence in national reporting underscores its stability and importance in health data infrastructure. It is consistently documented as the code for transesophageal echocardiography in the annual "Atrial Fibrillation in Denmark" (AFDK) reports spanning from 2023 [^src1] to 2024 [^src2] and 2025 [^src3], functioning as a technical reference for implementing evidence-based clinical standards in the Danish healthcare system.

## Mentions
- Page 116: "UXUC81 (transøsofageal ekkokardiografi)" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120) [^src1]
- Page 105: "UXUC81 (transøsofageal ekkokardiografi)" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105) [^src2]
- Page 91: "UXUC81 (transøsofageal ekkokardiografi)" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95) [^src3]

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: uxuc81
  Predicate: is-procedure-code-for
  Object: atrieflimren
  Evidence: "UXUC81 (transøsofageal ekkokardiografi)"
  Page: 116
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120 [^src1]
- Subject: uxuc81
  Predicate: is-code-for
  Object: ekkokardiografi
  Evidence: "UXUC81 (transøsofageal ekkokardiografi)"
  Page: 91
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95 [^src3]

Incoming (this entity is the OBJECT of these relationships):
- Subject: ekkokardiografi
  Predicate: coded-as
  Object: (this entity)
  Evidence: "UXUC81 (transøsofageal ekkokardiografi)"
  Page: 105
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105 [^src2]

## Claims
- Indikatorområdet for ekkokardiografi inkluderer koderne UXUC80C, UXUC80D, UXUC80E, UXUC81 og UXUC81C [^src1] (uxuc80c, uxuc80d, uxuc80e, uxuc81, uxuc81c)
  Type: procedural
  Page: 116
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120 [^src1]

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 116-120
[^src2]: AFDK_2024.pdf, pages 101-105
[^src3]: AFDK_2025.pdf, pages 91-95
