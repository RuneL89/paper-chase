---
title: ABC Pathway
type: entity
aliases:
  - ABC Pathway
wiki: rkkp-afdk
updated: '2026-08-05T21:20:02.160Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 96-100
tags:
  - clinical-tool
---
The **ABC Pathway** is an integrated treatment model designed for patients with atrial fibrillation. It structures clinical management into three distinct steps: A (Avoid stroke), B (Better symptom management), and C (Cardiovascular risk reduction) [^src1]. This framework serves as a foundational basis for both clinical treatment recommendations and structured [[patientuddannelse|Patientuddannelse]] (patient education) within the Danish healthcare system [^src1].

The pathway's implementation in Denmark is closely tied to international standards, specifically the 2021 ESC guidelines authored by Hindricks et al., which recommend patient education for atrial fibrillation patients and form the evidentiary basis for the ABC Pathway [^src1]. Within the broader context of the Regionernes Kliniske Kvalitetsudviklingsprogram (AFDK) report on atrial fibrillation in Denmark, the ABC Pathway is central to "Indicator 8," which focuses on structured patient education [^src1]. The model connects patient education directly to clinical goals and quality measurement, ensuring that educational content is tailored to the individual needs of the patient and the specific steps of the pathway [^src1].

In clinical practice, the ABC Pathway integrates various risk assessment tools. For instance, the [[cha2ds2-vasc|CHA2DS2-VASc]] score is utilized within the "A" (Avoid stroke) step of the pathway to guide decisions regarding anticoagulation therapy [^src1]. By aligning educational materials with the ESC guidelines and the ABC Pathway, the Danish cardiovascular health system aims to systematically improve quality and patient-centered care [^src1].

## Mentions
- Page 97: "The ABC Pathway" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 96-100) [^src1]
- Page 98: "ABC pathway" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 96-100) [^src1]
- Page 99: "ABC Pathway indeholder 3 trin:" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 96-100) [^src1]
- Page 100: "I relation til The ABC Pathway anbefaler AFDK, at patientundervisningen bør indeholde informationer listet i nedenstående tabel" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 96-100) [^src1]

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: abc-pathway
  Predicate: informs
  Object: patientuddannelse
  Evidence: "Det bør tilstræbes, på baggrund af AFDK’s anbefalinger, at patientundervisningsmaterialet tager udgangspunkt i ESC guidelines fra 2020 (Hindricks et al., 2021). Guidelines bygger på ”The ABC Pathway”"
  Page: 97
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 96-100 [^src1]

Incoming (this entity is the OBJECT of these relationships):
- Subject: cha2ds2-vasc
  Predicate: guides-treatment-in
  Object: (this entity)
  Evidence: "A - Avoid stroke - omhandlende CHA₂DS₂-VASc Score og antikoagulation"
  Page: 99
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 96-100 [^src1]

## Claims
(none)

## Timeline
- 2021: ESC guidelines fra Hindricks et al. anbefaler patientuddannelse til patienter med atrieflimren og danner grundlag for ABC Pathway (esc-guidelines, atrieflimren, abc-pathway) [^src1]

## Sources

[^src1]: AFDK_2024.pdf, pages 96-100
