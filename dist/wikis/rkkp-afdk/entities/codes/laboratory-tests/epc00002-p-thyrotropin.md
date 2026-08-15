---
title: EPC00002
type: entity
aliases:
  - EPC00002
wiki: rkkp-afdk
updated: '2026-08-14T21:33:44.399Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 91-95
tags:
  - code
---

**EPC00002** is a laboratory database code used in the Danish healthcare system to identify measurements of p-thyrotropin (thyroid-stimulating hormone). It functions as a technical identifier for [[thyreoideastimulerende-hormon-tsh|thyreoideastimulerende hormon (TSH)]] within national health registries [^src1].

The code is detailed in the "Atrieflimren i Danmark" (Atrial Fibrillation in Denmark) report, a technical reference published by Sundhedsvæsenets Kvalitetsinstitut to monitor and assess treatment quality for atrial fibrillation patients [^src1]. Specifically, EPC00002 is deployed in **Quality Indicator 3** to identify and extract relevant laboratory measurements associated with an atrial fibrillation diagnosis [^src1]. 

When calculating the numerators, denominators, and exclusion criteria for the national AFDK quality indicators, registry analysts rely on EPC00002 alongside a broader set of codes—including various NPU, DNK, ASS, and RSD identifiers—to ensure accurate data retrieval for lab measurements, echocardiography, anticoagulation, and complication tracking [^src1].

## Mentions
- Page 92: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647, AS000646, ASS00650, EPC00002, RSD03382" [^src1]

## Relationships
- **Subject:** epc00002-p-thyrotropin
  **Predicate:** is-laboratory-test-code-for
  **Object:** thyreoideastimulerende-hormon-tsh
  **Evidence:** "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647, AS000646, ASS00650, EPC00002, RSD03382" [^src1]

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AFDK_2025.pdf, pages 91-95
