---
title: '"DI427*"'
type: entity
aliases:
  - DI427*
sparse: true
wiki: rkkp-afdk
updated: '2026-08-14T21:27:57.504Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 61-65
tags:
  - diagnosis-code
---

DI427* is a group of ICD-10 diagnosis codes used within the Danish healthcare system to identify cases of heart failure. Specifically, it is one of several code groups utilized to define heart failure events in the Danish National Patient Register (Landspatientregisteret) [^src1]. 

In the context of the AFDK (Atrial Fibrillation Database) 2025 report, DI427* plays a critical role in the calculation of [[hjertesvigtsindikatoren|Hjertesvigtsindikatoren]] (the heart failure indicator), which is designated as Indicator 15 [^src1]. This indicator measures the incidence of heart failure within one year following a new diagnosis of atrial fibrillation [^src1]. Heart failure is formally defined for this indicator as a hospital contact where heart failure is recorded as either an A (primary) or B (secondary) diagnosis, using a specific set of ICD-10 codes that includes DI427* alongside others such as DI50*, DI110*, and DI428* [^src1]. 

The use of DI427* and its associated codes allows the AFDK to track quality development and clinical outcomes in atrial fibrillation treatment on a national scale [^src1]. However, the reliance on these hospital-based diagnosis codes also highlights certain limitations in the underlying data infrastructure, such as the lack of coverage for general practice settings, the underreporting of unrecognized atrial fibrillation, and potential registration issues tied to DRG (Diagnosis Related Groups) reporting practices [^src1].

## Mentions
- Page 62: "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*) og er identificeret via data fra Landspatientregistret." [^src1]

## Relationships
- **Subject:** [[hjertesvigtsindikatoren|Hjertesvigtsindikatoren]]
  **Predicate:** uses-diagnosis-code
  **Object:** DI427*
  **Evidence:** "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*)" [^src1]

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AFDK_2025.pdf, pages 61-65
