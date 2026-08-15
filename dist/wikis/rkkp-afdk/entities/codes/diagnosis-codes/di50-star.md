---
title: '"DI50*"'
type: entity
aliases:
  - DI50*
sparse: true
wiki: rkkp-afdk
updated: '2026-08-14T21:26:30.750Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 61-65
tags:
  - diagnosis-code
---
DI50* is a group of ICD-10 diagnosis codes used within the Danish healthcare data infrastructure to identify cases of heart failure. It serves as a foundational component for tracking heart failure events in the Danish National Patient Register (Landspatientregisteret) [^src1].

In the context of the Danish Atrial Fibrillation Database (AFDK), DI50* is utilized as part of the technical definition for [[hjertesvigtsindikatoren|Hjertesvigtsindikatoren]] (Indicator 15), which measures the incidence of heart failure within one year following a new diagnosis of atrial fibrillation [^src1]. According to the AFDK 2025 report, a heart failure event is formally defined as a hospital contact where heart failure is registered as either an A (primary) or B (secondary) diagnosis using DI50* alongside a specific set of other ICD-10 codes [^src1]. This coding framework allows health authorities to calculate quality indicators, though the reliance on hospital register data means it is subject to broader systemic limitations, such as the exclusion of general practice diagnoses and potential underreporting driven by DRG-based reporting incentives [^src1].

## Mentions
- Page 62: "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*) og er identificeret via data fra Landspatientregistret." [^src1]

## Relationships
- **Subject:** [[hjertesvigtsindikatoren|Hjertesvigtsindikatoren]]
  - **Predicate:** uses-diagnosis-code
  - **Object:** DI50*
  - **Evidence:** "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*)"
  - **Page:** 62
  - **Source:** [^src1]

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AFDK_2025.pdf, pages 61-65
