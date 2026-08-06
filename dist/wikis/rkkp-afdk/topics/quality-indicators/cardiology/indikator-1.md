---
title: Indikator 1
type: entity
aliases:
  - Indikator 1
wiki: rkkp-afdk
updated: '2026-08-05T19:57:22.175Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '11-15, 91-95'
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 6-10
tags:
  - topic
---
**Indikator 1** is the primary quality metric utilized in the [[databasen-for-atrieflimren-i-danmark|Databasen for Atrieflimren i Danmark]] to evaluate the timeliness of medical intervention for newly diagnosed patients [^src1]. Specifically, it measures the proportion of patients newly diagnosed with [[atrieflimren]] who initiate [[antikoagulationsbehandling]] within a maximum of 30 days from their diagnosis, provided the treatment is clinically indicated [^src1]. The clinical indication for this treatment is determined by a [[cha2ds2-vasc|CHA2DS2-VASc]] score of ≥2 [^src1].

The indicator relies on integrated national registry data, specifically drawing from the [[laegemiddelstatistikregisteret|Lægemiddelstatistikregisteret]] and the [[landspatientregisteret|Landspatientregisteret]] [^src1]. By tracking these metrics, the indicator plays a critical role in the systematic, data-driven quality development of cardiovascular health across [[danmark|Danmark]] [^src2].

### Performance and Standards
The national standard for Indikator 1 requires that at least 90% of eligible patients receive timely anticoagulation therapy [^src3]. During the indicator period from July 1, 2022, to June 30, 2023, this standard was successfully met on a national level, with 92% of newly diagnosed atrial fibrillation patients (with a CHA2DS2-VASc score ≥2) starting oral anticoagulation within 30 days [^src1]. This marked the continuation of a positive trend, as the ≥90% standard had also been met in the two preceding annual reporting periods [^src1]. 

Notably, the 2022–2023 period was the first time the standard was fulfilled across all individual regions in Denmark, with regional compliance rates varying between 90% and 95% [^src1]. The Central Denmark Region (Region Midtjylland) and North Denmark Region (Region Nordjylland) achieved marginally higher compliance rates (93–95%) compared to the other regions, which hovered around 90% [^src1]. At the hospital level, 20 hospital units met the standard—the highest number recorded to date—while the lowest compliance rate for a single hospital unit was 84% [^src1]. 

### Subsequent Reporting Period and Supplementary Analysis
In the following reporting period (July 1, 2023, to June 30, 2024), the national compliance rate for Indikator 1 was measured at 91.6% (95% CI: 91.1–92.0), demonstrating sustained adherence to the ≥90% quality standard [^src3]. Furthermore, supplementary analyses from the 2022–2023 report highlighted that a total of 10,010 patients in Denmark initiated anticoagulation treatment within four months prior to diagnosis or within 30 days after discharge [^src2].

***

## Mentions
- Page 11: "Indikator 1: Andel af nydiagnosticerede patienter med atrieflimren, der har ventetid på max. 30 dage fra diagnosticering til opstart i antikoagulationsbehandling (hvor antikoagulationsbehandling er indiceret)." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 11-15)
- Page 91: "Supplerende analyse: indikator 1
Start på AK behandling" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 91-95)

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: indikator-1
  Predicate: measures-outcome-of
  Object: antikoagulationsbehandling
  Evidence: "Indikator 1: Andel af nydiagnosticerede patienter med atrieflimren, der har ventetid på max. 30 dage fra diagnosticering til opstart i antikoagulationsbehandling"
  Page: 11
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 11-15
- Subject: indikator-1
  Predicate: is-based-on
  Object: cha2ds2-vasc
  Evidence: "Indikation for antikoagulationsbehandling er CHA2DS2-VASc score ≥2."
  Page: 15
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 11-15
- Subject: indikator-1
  Predicate: uses-data-from
  Object: laegemiddelstatistikregisteret
  Evidence: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)."
  Page: 15
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 11-15
- Subject: indikator-1
  Predicate: uses-data-from
  Object: landspatientregisteret
  Evidence: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)."
  Page: 15
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 11-15
- Subject: indikator-1
  Predicate: is-reported-in
  Object: databasen-for-atrieflimren-i-danmark
  Evidence: "Supplerende analyse: indikator 1"
  Page: 91
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 91-95

Incoming (this entity is the OBJECT of these relationships):
- Subject: atrieflimren
  Predicate: has-indicator
  Object: (this entity)
  Evidence: "Indikator 1: Andel af nydiagnosticerede patienter med atrieflimren, der har ventetid på max. 30 dage fra diagnosticering til opstart i antikoagulations behandling (hvor antikoagulations behandling er indiceret)."
  Page: 6
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 6-10

## Claims
- Indikator 1 undersøger ventetiden fra diagnosticering til opstart i antikoagulationsbehandling blandt patienter nydiagnosticeret med atrieflimren i perioden 1. juli 2022 til 30. juni 2023 [^src1] (indikator-1, atrieflimren, antikoagulationsbehandling)
  Type: methodological
  Page: 15
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 11-15
- Patienter med en ventetid på max. 30 dage fra diagnosticering til opstart i antikoagulationsbehandling opfylder indikatoren [^src1] (indikator-1, antikoagulationsbehandling)
  Type: definitional
  Page: 15
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 11-15
- På landsplan blev 92% af de nydiagnosticerede atrieflimren patienter med en CHA2DS2-VASc score ≥2 sat i oral antikoagulationsbehandling senest 30 dage efter diagnosticering [^src1] (indikator-1, atrieflimren, antikoagulationsbehandling, cha2ds2-vasc)
  Type: performance
  Page: 15
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 11-15
- Standarden på ≥ 90% er således opfyldt på landsplan og har været det de sidste to årsrapportsperioder [^src1] (indikator-1)
  Type: performance
  Page: 15
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 11-15
- På regionsplan varierede andelen mellem 90 – 95% og standarden er således for første gang opfyldt i alle regioner [^src1] (indikator-1)
  Type: performance
  Page: 15
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 11-15
- Regionerne Midtjylland og Nordjylland har marginalt højere målopfyldelse (93-95%) end de øvrige (ca. 90%) [^src1] (indikator-1)
  Type: regional-comparison
  Page: 15
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 11-15
- På hospitalsniveau opfyldte 20 standarden hvilket også er det højeste antal hidtil [^src1] (indikator-1)
  Type: performance
  Page: 15
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 11-15
- Laveste opfyldelse for en hospitalsenhed er 84% [^src1] (indikator-1)
  Type: performance
  Page: 15
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 11-15
- I alt 10.010 patienter i Danmark startede antikoagulationsbehandling inden for 4 måneder før diagnose eller inden for 30 dage efter udskrivelse [^src1] (danmark, indikator-1)
  Type: clinical
  Page: 91
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 91-95
- Indikator 1 har standarden ≥ 90 % for andelen af nydiagnosticerede patienter med atrieflimren, der har ventetid på max. 30 dage fra diagnosticering til opstart i antikoagulations behandling (hvor antikoagulations behandling er indiceret) [^src1] (atrieflimren, antikoagulationsbehandling, indikator-1)
  Type: quality-standard
  Page: 6
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 6-10
- For Indikator 1 blev den nationale opfyldelse i perioden 01.07.2023–30.06.2024 målt til 91,6 % (95 % CI: 91,1–92,0) [^src1] (indikator-1)
  Type: performance-data
  Page: 7
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 6-10

## Timeline
- 2022-07-01: Start af indikatorperiode for Indikator 1 (indikator-1) [^src1]
- 2023-06-30: Slut på indikatorperiode for Indikator 1 (indikator-1) [^src1]
- 2023-07-01: Start af dataindsamlingsperiode for Indikator 1, Indikator 2, Indikator 3 og Indikator 4b (indikator-1, indikator-2, indikator-3, indikator-4b) [^src3]

## Sources

[^src1]: AFDK_2023.pdf, pages 11-15
[^src2]: AFDK_2023.pdf, pages 91-95
[^src3]: AFDK_2024.pdf, pages 6-10
