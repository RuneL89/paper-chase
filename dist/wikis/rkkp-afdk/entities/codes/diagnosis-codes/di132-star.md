---
title: '"DI132*"'
type: entity
aliases:
  - DI132*
sparse: true
wiki: rkkp-afdk
updated: '2026-08-14T21:27:16.831Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 61-65
tags:
  - diagnosis-code
---

DI132* is a group of ICD-10 diagnosis codes used within the Danish healthcare system to identify cases of heart failure. Specifically, it forms a critical component of the technical definition for [[hjertesvigtsindikatoren|Hjertesvigtsindikatoren]] (the heart failure indicator), which is tracked as Indicator 15 in the AFDK (Atrial Fibrillation Database) quality development initiatives [^src1]. 

Within the Danish National Patient Register (Landspatientregisteret), a heart failure event is formally defined as a hospital contact where heart failure is recorded as either a primary (A) or secondary (B) diagnosis [^src1]. DI132* is utilized alongside a specific set of other ICD-10 codes—including DI50*, DI110*, DI130*, DI420*, DI426*, DI427*, DI428*, and DI429*—to capture these hospital contacts [^src1]. This coding framework allows health authorities and researchers to measure the incidence of heart failure, such as tracking its occurrence within one year of a new atrial fibrillation diagnosis, despite known limitations like underreporting in general practice and DRG-related reporting issues [^src1].

## Mentions
- Page 62: "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*) og er identificeret via data fra Landspatientregistret." [^src1]

## Relationships
- **Subject:** hjertesvigtsindikatoren
  **Predicate:** uses-diagnosis-code
  **Object:** DI132*
  **Evidence:** "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*)" [^src1]

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AFDK_2025.pdf, pages 61-65
