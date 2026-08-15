---
title: '"DI420*"'
type: entity
aliases:
  - DI420*
sparse: true
wiki: rkkp-afdk
updated: '2026-08-14T21:27:29.667Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 61-65
tags:
  - diagnosis-code
---
DI420* is a classification group of ICD-10 diagnosis codes used to identify heart failure within the Danish National Patient Register (Landspatientregisteret) [^src1]. It functions as a foundational data element for tracking cardiovascular complications and hospital contacts in national health registries.

In the context of the 2025 AFDK (Atrial Fibrillation Database) report, DI420* is listed among a specific set of A and B diagnoses (including DI50*, DI110*, DI130*, and others) that formally define a hospital contact for heart failure [^src1]. This technical definition serves as the operational basis for the [[hjertesvigtsindikatoren|Hjertesvigtsindikatoren]] (Heart Failure Indicator), which is designated as Indicator 15 in the database's framework [^src1]. Indicator 15 measures the incidence of heart failure within one year following a new diagnosis of atrial fibrillation. The precise identification of heart failure via codes like DI420* is essential for evaluating the quality of cardiovascular care, tracking patient outcomes nationwide, and understanding data limitations such as underreporting or DRG-related registration issues [^src1].

## Mentions
- Page 62: "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*) og er identificeret via data fra Landspatientregistret." [^src1]

## Relationships
- Subject: hjertesvigtsindikatoren
  Predicate: uses-diagnosis-code
  Object: DI420*
  Evidence: "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*)"
  Page: 62
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65 [^src1]

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AFDK_2025.pdf, pages 61-65
