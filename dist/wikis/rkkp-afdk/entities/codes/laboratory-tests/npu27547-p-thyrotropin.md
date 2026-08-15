---
title: NPU27547
type: entity
aliases:
  - NPU27547
wiki: rkkp-afdk
updated: '2026-08-14T21:31:46.729Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 101-105
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 91-95
tags:
  - code
---

NPU27547 is a laboratory test code that functions as a LOINC-equivalent identifier for the measurement of plasma thyrotropin, commonly known as [[thyreoideastimulerende-hormon-tsh|thyreoideastimulerende hormon (TSH)]] [^src1]. Within the Danish healthcare system, this specific code is utilized to track and identify relevant laboratory measurements in national health registries [^src1]. 

Specifically, NPU27547 is deployed in "Quality Indicator 3" (TSH measurement) within the "Atrial Fibrillation in Denmark" (AFDK) program, an initiative managed by the Danish Health Data Authority and the Regions' Clinical Quality Development Program (RKKP) [^src2]. The code appears in technical reference documentation that outlines the calculation rules, numerators, denominators, and exclusion criteria for monitoring the diagnostic workup of atrial fibrillation patients [^src2]. By flagging instances where TSH is measured, the code helps auditors and health authorities assess whether evidence-based clinical guidelines for diagnosing and managing atrial fibrillation are being followed [^src2]. In registry analyses, NPU27547 is frequently listed alongside other administrative and clinical codes—such as NPU04199, NPU03624, and DNK35895—which are used to track echocardiography, creatinine measurements, and anticoagulation treatments [^src1].

## Mentions
- Page 92: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647, AS000646, ASS00650, EPC00002, RSD03382" [^src1]
- Page 105: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647" [^src2]

## Relationships
**Outgoing**
- **Subject:** npu27547-p-thyrotropin
  **Predicate:** is-laboratory-test-code-for
  **Object:** thyreoideastimulerende-hormon-tsh
  **Evidence:** "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647, AS000646, ASS00650, EPC00002, RSD03382"
  **Page:** 92
  **Source:** [^src1]

**Incoming**
- **Subject:** thyreoideastimulerende-hormon-tsh
  **Predicate:** coded-as
  **Object:** NPU27547
  **Evidence:** "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647"
  **Page:** 105
  **Source:** [^src2]

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AFDK_2025.pdf, pages 91-95
[^src2]: AFDK_2024.pdf, pages 101-105
