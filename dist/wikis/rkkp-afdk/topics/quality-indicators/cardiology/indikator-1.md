---
title: Indikator 1
type: entity
aliases:
  - Indikator 1
wiki: rkkp-afdk
updated: '2026-08-14T19:53:50.868Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '11-15, 91-95'
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 6-10
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: '11-15, 6-10'
tags:
  - topic
---
**Indikator 1** is the primary quality measurement within the [[databasen-for-atrieflimren-i-danmark|Databasen for Atrieflimren i Danmark]] (Danish Atrial Fibrillation Database). It tracks the proportion of newly diagnosed patients with [[atrieflimren|atrial fibrillation]] who initiate [[antikoagulationsbehandling|anticoagulation treatment]] within a maximum of 30 days from their diagnosis, provided the treatment is clinically indicated [^src1] [^src3]. The indicator serves as a critical benchmark for cardiovascular healthcare quality in [[danmark|Danmark]], ensuring timely stroke prevention for at-risk patients [^src1] [^src4].

### Methodology and Data Sources
The indicator's calculations are based on integrated national registry data, specifically utilizing the [[laegemiddelstatistikregisteret|Lægemiddelstatistikregisteret]] (Danish Register of Medicinal Product Statistics) and the [[landspatientregisteret|Landspatientregisteret]] (Danish National Patient Register) [^src1] [^src4]. To be included in the denominator, patients must have a clinical indication for anticoagulation, which is defined by a [[cha2ds2-vasc|CHA2DS2-VASc]] score of ≥ 2 [^src1]. Patients lacking this indication (e.g., a score < 2) are explicitly excluded from the measurement [^src4]. 

### Performance and National Standards
The national quality standard for Indikator 1 is set at ≥ 90% [^src1] [^src5]. Over recent reporting periods, the Danish healthcare system has consistently met this target at the national level. In the 2022–2023 period, 92% of eligible patients received treatment within the 30-day window [^src1]. This performance remained stable in subsequent years, with national fulfillment measured at 91.6% in both the 2023–2024 and 2024–2025 periods [^src4] [^src5]. 

A significant milestone was achieved in the 2022–2023 reporting period when the ≥ 90% standard was met across all Danish regions for the first time, with regional compliance ranging between 90% and 95% [^src1]. By the 2024–2025 period, regional variations narrowed slightly, ranging from 90.3% to 93.8% [^src4]. At the local level, health clusters such as [[klynge-vest|Klynge VEST]] use these metrics for detailed benchmarking and quality development [^src4]. While hospital-level compliance has generally improved—with a record 20 hospital units meeting the standard in 2022–2023—some localized underperformance persists, such as a hospital unit recording an 84% fulfillment rate in the same period [^src1]. 

### Supplementary Insights
Beyond the strict 30-day post-diagnosis window, supplementary analyses have provided broader context on treatment timelines. For instance, in the 2022–2023 period, 10,010 patients started anticoagulation either within four months prior to their diagnosis or within 30 days after discharge [^src2]. Furthermore, data from the 2024–2025 period revealed that approximately 55% of patients had already redeemed a prescription for oral anticoagulants within 120 days before their hospital diagnosis was formally registered [^src4].

---

## Mentions
- Page 11: "Indikator 1: Andel af nydiagnosticerede patienter med atrieflimren, der har ventetid på max. 30 dage fra diagnosticering til opstart i antikoagulationsbehandling (hvor antikoagulationsbehandling er indiceret)." [^src1]
- Page 91: "Supplerende analyse: indikator 1
Start på AK behandling" [^src2]
- Page 6: "Indikator 1: Andel af nydiagnosticerede patienter med atrieflimren, der har ventetid på max. 30 dage fra diagnosticering til opstart i antikoagulations behandling (hvor antikoagulations behandling er indiceret)." [^src3]
- Page 12: "Indikator 1: Andel af nydiagnosticerede patienter med atrieflimren, der har ventetid på max. 30 dage fra
diagnosticering til opstart i antikoagulationsbehandling (hvor antikoagulationsbehandling er indiceret)." [^src4]

## Relationships
**Outgoing**
- Subject: indikator-1 | Predicate: measures-outcome-of | Object: antikoagulationsbehandling | Evidence: "Indikator 1: Andel af nydiagnosticerede patienter med atrieflimren, der har ventetid på max. 30 dage fra diagnosticering til opstart i antikoagulationsbehandling" | Page: 11 [^src1]
- Subject: indikator-1 | Predicate: is-based-on | Object: cha2ds2-vasc | Evidence: "Indikation for antikoagulationsbehandling er CHA2DS2-VASc score ≥2." | Page: 15 [^src1]
- Subject: indikator-1 | Predicate: uses-data-from | Object: laegemiddelstatistikregisteret | Evidence: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)." | Page: 15 [^src1]
- Subject: indikator-1 | Predicate: uses-data-from | Object: landspatientregisteret | Evidence: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)." | Page: 15 [^src1]
- Subject: indikator-1 | Predicate: is-reported-in | Object: databasen-for-atrieflimren-i-danmark | Evidence: "Supplerende analyse: indikator 1" | Page: 91 [^src2]
- Subject: indikator-1 | Predicate: measures | Object: antikoagulationsbehandling | Evidence: "Andel af nydiagnosticerede patienter med atrieflimren, der har ventetid på max. 30 dage fra diagnosticering til opstart i antikoagulations behandling" | Page: 6 [^src3]
- Subject: indikator-1 | Predicate: uses-data-from | Object: laegemiddelstatistikregisteret | Evidence: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)." | Page: 14 [^src4]
- Subject: indikator-1 | Predicate: uses-data-from | Object: landspatientregisteret | Evidence: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)." | Page: 14 [^src4]
- Subject: indikator-1 | Predicate: excludes-based-on | Object: cha2ds2-vasc | Evidence: "5.113 Patienten har ikke indikation for AK-behandling (CHAD2DS2-VASc < 2)" | Page: 14 [^src4]

**Incoming**
- Subject: atrieflimren | Predicate: has-indicator | Object: indikator-1 | Evidence: "Indikator 1: Andel af nydiagnosticerede patienter med atrieflimren, der har ventetid på max. 30 dage fra diagnosticering til opstart i antikoagulations behandling (hvor antikoagulations behandling er indiceret)." | Page: 6 [^src5]
- Subject: atrieflimren-i-danmark | Predicate: contains-indicator | Object: indikator-1 | Evidence: "Indikator 1: Andel af nydiagnosticerede patienter med atrieflimren, der har ventetid på max. 30 dage fra
diagnosticering til opstart i antikoagulationsbehandling (hvor antikoagulationsbehandling er indiceret)." | Page: 12 [^src4]
- Subject: klynge-vest | Predicate: has-indicator-result-for | Object: indikator-1 | Evidence: "Klynge VEST Ja 191 / 209 0 (0) 91,4 (86,7-94,8) 168 / 181 92,8 96,1" | Page: 11 [^src4]

## Claims
**Methodological**
- Indikator 1 undersøger ventetiden fra diagnosticering til opstart i antikoagulationsbehandling blandt patienter nydiagnosticeret med atrieflimren i perioden 1. juli 2022 til 30. juni 2023 [^src1]

**Definitional**
- Patienter med en ventetid på max. 30 dage fra diagnosticering til opstart i antikoagulationsbehandling opfylder indikatoren [^src1]

**Performance**
- På landsplan blev 92% af de nydiagnosticerede atrieflimren patienter med en CHA2DS2-VASc score ≥2 sat i oral antikoagulationsbehandling senest 30 dage efter diagnosticering [^src1]
- Standarden på ≥ 90% er således opfyldt på landsplan og har været det de sidste to årsrapportsperioder [^src1]
- På regionsplan varierede andelen mellem 90 – 95% og standarden er således for første gang opfyldt i alle regioner [^src1]
- På hospitalsniveau opfyldte 20 standarden hvilket også er det højeste antal hidtil [^src1]
- Laveste opfyldelse for en hospitalsenhed er 84% [^src1]
- På landsplan blev 91,6% af de nydiagnosticerede atrieflimren-patienter med indikation for AK-behandling sat i oral AK-behandling senest 30 dage efter diagnosticering [^src1]
- Resultaterne har ligget stabilt over grænsen de seneste tre årsrapporter [^src1]
- På regionsniveau varierede andelen mellem 90,3% og 93,8% [^src1]
- Ca. 55% af patienterne havde indløst en recept vedrørende oral AK-behandling inden for 120 dage op til diagnosen stilles i hospitalsregi [^src1]

**Regional Comparison**
- Regionerne Midtjylland og Nordjylland har marginalt højere målopfyldelse (93-95%) end de øvrige (ca. 90%) [^src1]

**Clinical**
- I alt 10.010 patienter i Danmark startede antikoagulationsbehandling inden for 4 måneder før diagnose eller inden for 30 dage efter udskrivelse [^src1]

**Quality Standard**
- Indikator 1 har standarden ≥ 90 % for andelen af nydiagnosticerede patienter med atrieflimren, der har ventetid på max. 30 dage fra diagnosticering til opstart i antikoagulations behandling (hvor antikoagulations behandling er indiceret) [^src1]

**Performance Data**
- For Indikator 1 blev den nationale opfyldelse i perioden 01.07.2023–30.06.2024 målt til 91,6 % (95 % CI: 91,1–92,0) [^src1]

**Quality Indicator Target**
- Indikator 1 har et udviklingsmål på ≥ 90 % [^src1]

**Quality Indicator Result**
- For Indikator 1 var andelen for hele Danmark 91,6 % (95 % CI: 91,2–92,0) i perioden 01.07.2024–30.06.2025 [^src2]

## Timeline
- 2022-07-01: Start af indikatorperiode for Indikator 1 [^src1]
- 2023-06-30: Slut på indikatorperiode for Indikator 1 [^src1]
- 2023-07-01: Start af dataindsamlingsperiode for Indikator 1, Indikator 2, Indikator 3 og Indikator 4b [^src5]
- 2024-07-01: Start af målingsperiode for Indikator 1, Indikator 2, Indikator 3, Indikator 4b, Indikator 5, Indikator 6, Indikator 7 og Indikator 15 [^src3]
- 01.07.2024 - 30.06.2025: Aktuel år for indikator 1-opgørelse [^src3]
- 2023/24: Tidligere år for indikator 1-opgørelse [^src5]
- 2022/23: Tidligere år for indikator 1-opgørelse [^src1]

## Sources

[^src1]: AFDK_2023.pdf, pages 11-15
[^src2]: AFDK_2023.pdf, pages 91-95
[^src3]: AFDK_2025.pdf, pages 6-10
[^src4]: AFDK_2025.pdf, pages 11-15
[^src5]: AFDK_2024.pdf, pages 6-10
