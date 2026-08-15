---
title: UXUC80D
type: entity
wiki: rkkp-afdk
updated: '2026-08-14T20:31:44.459Z'
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
UXUC80D is a specific medical procedure code used in the Danish healthcare system to designate transthoracic 3-D echocardiography [^src1]. It plays a critical role in the national quality measurement and monitoring of diagnostic practices for patients with [[atrieflimren]] [^src1]. As part of the standardized data collection efforts coordinated by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP), this code ensures that advanced imaging procedures are accurately tracked in health registries to evaluate clinical care [^src1].

In the context of clinical quality indicators, UXUC80D is grouped within the broader indicator area for [[ekkokardiografi|Ekkokardiografi]] [^src2]. Specifically, the echocardiography indicator domain includes a defined set of procedure codes: [[uxuc80c|UXUC80C]], UXUC80D, [[uxuc80e|UXUC80E]], [[uxuc81|UXUC81]], and [[uxuc81c|UXUC81C]] [^src1]. By capturing these specific codes, the Danish healthcare system can calculate denominators, numerators, and exclusion criteria for quality metrics, thereby evaluating whether patients receive the appropriate diagnostic imaging following a diagnosis [^src3]. The consistent use of UXUC80D across consecutive annual reports from 2023 to 2025 underscores its established role in the technical guidelines for registry-based quality assessment [^src1] [^src2] [^src3].

## Mentions
- Page 116: "UXUC80D (transthorakal 3-D ekkokardiografi)" [^src1]
- Page 105: "UXUC80D (transthorakal 3-D ekkokardiografi)" [^src2]
- Page 91: "UXUC80D (transthorakal 3-D ekkokardiografi)" [^src3]

## Relationships
Outgoing:
- Subject: uxuc80d
  Predicate: is-procedure-code-for
  Object: atrieflimren
  Evidence: "UXUC80D (transthorakal 3-D ekkokardiografi)"
  Page: 116
  Source: [^src1]
- Subject: uxuc80d
  Predicate: is-code-for
  Object: ekkokardiografi
  Evidence: "UXUC80D (transthorakal 3-D ekkokardiografi)"
  Page: 91
  Source: [^src3]

Incoming:
- Subject: ekkokardiografi
  Predicate: coded-as
  Object: (this entity)
  Evidence: "UXUC80D (transthorakal 3-D ekkokardiografi)"
  Page: 105
  Source: [^src2]

## Claims
- Indikatorområdet for ekkokardiografi inkluderer koderne UXUC80C, UXUC80D, UXUC80E, UXUC81 og UXUC81C [^src1] (uxuc80c, uxuc80d, uxuc80e, uxuc81, uxuc81c)
  Type: procedural
  Page: 116
  Source: [^src1]

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 116-120
[^src2]: AFDK_2024.pdf, pages 101-105
[^src3]: AFDK_2025.pdf, pages 91-95
