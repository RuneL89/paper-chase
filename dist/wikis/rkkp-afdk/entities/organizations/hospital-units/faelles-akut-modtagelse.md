---
title: Fælles Akut Modtagelse
type: entity
aliases:
  - Fælles Akut Modtagelse
wiki: rkkp-afdk
updated: '2026-08-05T20:57:59.504Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 121-121
tags:
  - organization
---
Fælles Akut Modtagelse (FAM) is an emergency receiving unit at [[sygehus-soenderjylland|Sygehus Sønderjylland]]. The unit is notable in the context of the Danish Atrial Fibrillation Database for a specific clinical practice that inadvertently caused data collection failures for [[indikator-3|Indikator 3]] [^src1]. 

The core issue stems from how FAM orders thyroid-stimulating hormone (TSH) tests. Instead of ordering TSH individually, the unit orders "diagnostic TSH" as part of a broader blood test package [^src1]. Audits conducted by the [[regionernes-kliniske-kvalitetsudviklingsprogram|Regionernes Kliniske Kvalitetsudviklingsprogram]] (RKKP) revealed that TSH tests bundled in these packages fail to be captured in the national database [^src1]. This technical discrepancy occurs because the bundled TSH is reported under a local blood test code rather than the official NPU code required by RKKP for automated data extraction [^src1].

Despite the resulting low target fulfillment for Indikator 3, Sygehus Sønderjylland has opted not to change the ordering practices at FAM [^src1]. The hospital administration concluded that maintaining the bundled blood test packages is the most appropriate and efficient method for managing patient care pathways, prioritizing clinical workflow over database reporting mechanics [^src1].

## Mentions
- Page 121: "Sygehus Sønderjyllands Fælles Akut Modtagelse bestiller ”diagnostisk TSH” som en del af en blodprøvepakke i stedet for TSH enkeltvis." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 121-121)

## Relationships
- Subject: faelles-akut-modtagelse
  Predicate: part-of
  Object: sygehus-soenderjylland
  Evidence: "Sygehus Sønderjyllands Fælles Akut Modtagelse"
  Page: 121
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 121-121

## Claims
- Sygehus Sønderjylland har identificeret at den lave målopfyldelse for Indikator 3 skyldes, at man på Sygehus Sønderjyllands Fælles Akut Modtagelse bestiller ”diagnostisk TSH” som en del af en blodprøvepakke i stedet for TSH enkeltvis [^src1] (sygehus-soenderjylland, indikator-3, faelles-akut-modtagelse)
  Type: data-collection-issue
  Page: 121
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 121-121
- Auditering har vist, at TSH prøver der indgår i pakker ikke er med i den datafangst der laves fra RKKP, da TSH i ”pakken” afrapporteres på en lokal blodprøve kode og ikke den officielle NPU kode, som RKKP anvender til datafangst [^src1] (regionernes-kliniske-kvalitetsudviklingsprogram, faelles-akut-modtagelse)
  Type: data-collection-issue
  Page: 121
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 121-121
- SHS fortsætter uændret praksis på FAM, da dette vurderes mest hensigtsmæssig ift. patientforløbene [^src1] (sygehus-soenderjylland, faelles-akut-modtagelse)
  Type: clinical-practice-decision
  Page: 121
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 121-121

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 121-121
