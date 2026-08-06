---
title: NPU-kode
type: entity
wiki: rkkp-danibd
updated: '2026-08-05T06:50:31.584Z'
sources:
  - file: wikis/rkkp-danibd/raw/DANIBD_2024.pdf
    pages: 26-30
tags:
  - code
---

The **NPU-kode** (specifically the local code PTP00001 'F-calprotectin POC') is a specific local laboratory code used for the point-of-care measurement of [[calprotectin]] [^src1]. In the context of the Danish Inflammatory Bowel Disease (DANIBD) registry, this code plays a role in tracking Indicator 5, which monitors F-calprotectin measurements in patients undergoing treatment with modern biologics and JAK-inhibitors [^src1]. 

The integration of this local NPU code was documented in the 2024 DANIBD report as a direct methodological follow-up to a previous audit [^src1]. Its inclusion ensures that point-of-care testing data is accurately captured and analyzed alongside national registry data. Currently, this specific code is utilized at [[nordsjaellands-hospital|Nordsjællands Hospital]] [^src1].

## Mentions
- Page 26: "Som opfølgning på sidste audit er den lokale NPU-kode for måling af F-calprotectin også inkluderet (PTP00001 F-calprotectin POC). Koden anvendes på Nordsjællands Hospital." [^src1]

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: npu-kode
  Predicate: used-at
  Object: nordsjaellands-hospital
  Evidence: "Koden anvendes på Nordsjællands Hospital."
  Page: 26
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 26-30 [^src1]

Incoming (this entity is the OBJECT of these relationships):
- Subject: calprotectin
  Predicate: measured-with-npu-code
  Object: (this entity)
  Evidence: "Som opfølgning på sidste audit er den lokale NPU-kode for måling af F-calprotectin også inkluderet (PTP00001 F-calprotectin POC)."
  Page: 26
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 26-30 [^src1]

## Claims
- Som opfølgning på sidste audit er den lokale NPU-kode for måling af F-calprotectin også inkluderet (PTP00001 F-calprotectin POC) [^src1] (calprotectin, npu-kode)
  Type: administrative
  Page: 26
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 26-30
- Koden anvendes på Nordsjællands Hospital [^src1] (npu-kode, nordsjaellands-hospital)
  Type: administrative
  Page: 26
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 26-30

## Timeline
- 2024: Den lokale NPU-kode for måling af F-calprotectin (PTP00001 F-calprotectin POC) blev inkluderet i DANIBD-rapporten som opfølgning på sidste audit (calprotectin, npu-kode) [^src1]

## Sources

[^src1]: DANIBD_2024.pdf, pages 26-30
