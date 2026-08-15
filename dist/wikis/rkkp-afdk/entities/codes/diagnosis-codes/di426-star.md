---
title: '"DI426*"'
type: entity
aliases:
  - DI426*
sparse: true
wiki: rkkp-afdk
updated: '2026-08-14T21:27:38.549Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 61-65
tags:
  - diagnosis-code
---
**DI426*** is a group of ICD-10 diagnosis codes used within the Danish healthcare system to identify cases of heart failure. Specifically, it is utilized to extract and classify data from the Danish National Patient Register (Landspatientregisteret) [^src1]. 

In the context of the Danish Atrial Fibrillation Database (AFDK) and its 2025 reporting, DI426* forms a critical part of the technical definition for [[hjertesvigtsindikatoren|Hjertesvigtsindikatoren]] (Indicator 15) [^src1]. This indicator measures the occurrence of heart failure within one year following a new diagnosis of atrial fibrillation. To be counted under this indicator, a patient must have a hospital contact where heart failure is registered as either a primary (A) or secondary (B) diagnosis using a specific set of ICD-10 codes, which includes DI426* alongside others such as DI50*, DI110*, and DI429* [^src1]. 

While the code itself is a technical identifier, its application is central to evaluating the quality of care, calculating indicator results (such as the reported 5.8% incidence rate), and tracking cardiovascular outcomes for atrial fibrillation patients nationwide [^src1].

## Mentions
- Page 62: "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*) og er identificeret via data fra Landspatientregistret." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65) [^src1]

## Relationships
Incoming (this entity is the OBJECT of these relationships):
- Subject: hjertesvigtsindikatoren
  Predicate: uses-diagnosis-code
  Object: (this entity)
  Evidence: "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*)"
  Page: 62
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65 [^src1]

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AFDK_2025.pdf, pages 61-65
