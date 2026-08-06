---
title: IMA
type: entity
wiki: rkkp-akdb
updated: '2026-08-05T19:33:22.173Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: 106-107
tags:
  - location
---
**IMA** (Intensiv Medicinsk Afdeling, or Intensive Medical Department) is a specialized hospital location within the Danish healthcare system that plays a specific role in the coding and quality measurement of acute surgical care. 

The department is significant in the context of institutional coding policies, particularly regarding the application of procedure codes for patient pre-optimization. During technical and clinical reconciliation documentation between the Capital Region of Denmark (Region Hovedstaden, RHN) and the Danish Health Authority's Quality Institute (Sundhedsvæsenets Kvalitetsinstitut), RHN raised questions about the strict operationalization of national quality goals in the Acute Surgery Database (Akut Kirurgi Databasen) [^src1]. Specifically, RHN questioned whether the procedure code [[sks-kode-naaz42|SKS-koden NAAZ42]] could only be applied if a patient's pre-optimization took place at IMA or the [[ita-afsnit|ITA-afsnit]] [^src1].

This highlights a broader challenge where regional authorities face practical difficulties transitioning from complex clinical practices to rigid, database-driven quality measurements [^src1]. For example, RHN sought clarification on whether an [[anaestesiolog|anæstesiolog]] (anesthesiologist) is prohibited from using the NAAZ42 code if the pre-optimization occurs outside of the IMA or ITA departments [^src1]. This indicates that the coding rules and indicator logic may not fully capture the nuances of acute surgical treatment pathways, creating uncertainty for medical staff documenting care.

## Mentions
- Page 106: "Må anæstesiologen så ikke anvende procedurekoden NAAZ42 eller må den kun anvendes, hvis patienten præoptimeres enten på IMA eller ITA-afsnit?" [^src1]

## Relationships
- **Subject:** sks-kode-naaz42
  **Predicate:** applies-to-location
  **Object:** IMA
  **Evidence:** "Må anæstesiologen så ikke anvende procedurekoden NAAZ42 eller må den kun anvendes, hvis patienten præoptimeres enten på IMA eller ITA-afsnit?"
  **Page:** 106
  **Source:** wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 106-107 [^src1]

## Claims
- **Type:** coding-uncertainty
  Der er usikkerhed om, hvorvidt procedurekoden NAAZ42 må anvendes, hvis patienten præoptimeres af en anæstesiolog uden for IMA eller ITA-afsnit [^src1] (sks-kode-naaz42, anaestesiolog, ima, ita-afsnit)
  **Page:** 106
  **Source:** wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 106-107 [^src1]

## Timeline
*No timeline events recorded.*

## Sources

[^src1]: AKDB_2024.pdf, pages 106-107
