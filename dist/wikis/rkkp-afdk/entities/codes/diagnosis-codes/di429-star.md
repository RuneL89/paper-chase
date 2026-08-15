---
title: '"DI429*"'
type: entity
aliases:
  - DI429*
sparse: true
wiki: rkkp-afdk
updated: '2026-08-14T21:28:01.344Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 61-65
tags:
  - diagnosis-code
---
DI429* is a group of ICD-10 diagnosis codes used within the Danish healthcare system to identify cases of heart failure. Specifically, these codes are utilized to extract and track clinical data from the Danish National Patient Register (Landspatientregisteret) [^src1]. 

The primary significance of DI429* lies in its role as a foundational component of the [[hjertesvigtsindikatoren|Hjertesvigtsindikatoren]] (Heart Failure Indicator), which is designated as Indicator 15 in the Danish Atrial Fibrillation Database (AFDK) [^src1]. This indicator is designed to measure the incidence of heart failure within one year following a new diagnosis of atrial fibrillation [^src1]. According to the AFDK's technical definitions, a heart failure event is formally identified when a patient has a hospital contact where heart failure is registered as either a primary (A) or secondary (B) diagnosis. This identification relies on a specific string of ICD-10 codes that includes DI429* alongside others such as DI50*, DI110*, and DI428* [^src1]. 

The application of DI429* and its associated diagnostic codes is situated within the broader AFDK initiative to monitor, evaluate, and improve the quality of atrial fibrillation treatment nationwide [^src1]. However, the 2025 AFDK report highlights several systemic limitations regarding the data infrastructure that captures these codes. These limitations include a lack of data coverage for general practice settings, the underregistration of unrecognized atrial fibrillation, and reporting inconsistencies driven by DRG (Diagnosis-Related Group) reimbursement structures, all of which can affect the accuracy of indicators relying on these hospital-based codes [^src1].

## Mentions
- Page 62: "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*) og er identificeret via data fra Landspatientregistret." [^src1]

## Relationships
- **Subject:** hjertesvigtsindikatoren
  **Predicate:** uses-diagnosis-code
  **Object:** DI429*
  **Evidence:** "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*)"
  **Page:** 62
  **Source:** [^src1]

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AFDK_2025.pdf, pages 61-65
