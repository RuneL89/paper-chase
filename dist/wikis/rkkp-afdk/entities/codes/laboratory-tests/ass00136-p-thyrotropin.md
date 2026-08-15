---
title: ASS00136
type: entity
aliases:
  - ASS00136
wiki: rkkp-afdk
updated: '2026-08-14T21:22:22.598Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 101-105
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 91-95
tags:
  - code
---

ASS00136 is a laboratory test code used within the Danish healthcare system to identify measurements of thyrotropin, commonly known as thyroid-stimulating hormone [[thyreoideastimulerende-hormon-tsh|thyreoideastimulerende hormon (TSH)]] [^src1]. It holds specific significance in the national "Atrial Fibrillation in Denmark" (Atrieflimren i Danmark) program, managed by the Danish Regions' Clinical Quality Development Programme (RKKP), where it is officially recognized as one of the valid codes that count toward a performed TSH measurement for clinical quality indicator 3 [^src1]. 

This code is documented in technical guidelines that define the numerators, denominators, and exclusion criteria for monitoring the quality of atrial fibrillation treatment and diagnostics [^src2]. In the 2024 version of the AFDK report, ASS00136 is listed alongside other identifiers such as NPU27547 and DNK35895 to capture TSH laboratory tests in health registries [^src1]. The subsequent 2025 guidelines maintain ASS00136 in this core list while expanding the accepted code set to include additional identifiers like AS000646, ASS00650, EPC00002, and RSD03382 [^src2]. These coding references function as essential technical tools for registry analysis and the calculation of healthcare quality metrics across the Danish health system [^src2].

## Mentions
- Page 105: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647" [^src1]
- Page 92: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647, AS000646, ASS00650, EPC00002, RSD03382" [^src2]

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: ass00136-p-thyrotropin
  Predicate: is-laboratory-test-code-for
  Object: thyreoideastimulerende-hormon-tsh
  Evidence: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647, AS000646, ASS00650, EPC00002, RSD03382"
  Page: 92
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95 [^src2]

Incoming (this entity is the OBJECT of these relationships):
- Subject: thyreoideastimulerende-hormon-tsh
  Predicate: coded-as
  Object: (this entity)
  Evidence: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647"
  Page: 105
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105 [^src1]

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AFDK_2024.pdf, pages 101-105
[^src2]: AFDK_2025.pdf, pages 91-95
