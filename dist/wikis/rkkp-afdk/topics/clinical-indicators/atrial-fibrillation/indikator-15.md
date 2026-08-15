---
title: Indikator 15
type: entity
aliases:
  - Indikator 15
wiki: rkkp-afdk
updated: '2026-08-14T21:15:17.126Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 76-80
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: '56-60, 6-10, 61-65'
tags:
  - topic
---
**Indikator 15** is a clinical quality indicator used within the Danish healthcare system to monitor the outcomes of patients newly diagnosed with atrial fibrillation ([[atrieflimren]]). Specifically, it measures the proportion of these patients who develop heart failure within one year of their diagnosis. It is a core metric featured in the national [[atrieflimren-i-danmark|Atrieflimren i Danmark]] reports, which serve as essential tools for quality improvement, benchmarking, and political governance in Danish cardiovascular care.

The indicator is closely tied to the [[hjertesvigtsindikatoren|Hjertesvigtsindikatoren]] (Heart Failure Indicator), which calculates this metric for patients with a new atrial fibrillation diagnosis who did not previously have a heart failure diagnosis. Recently, a policy decision was made to retain Indikator 15 but alter its methodology retroactively: the measurement window for the occurrence of a heart failure diagnosis was shifted to the period between 3 months and 12 months after the initial atrial fibrillation diagnosis [^src4].

Statistical results from the reports highlight both national trends and regional variations across [[danmark|Danmark]]. For the period spanning July 1, 2022, to June 30, 2023, the national proportion of newly diagnosed atrial fibrillation patients who developed heart failure within a year was 6.1% (95% CI: 5.7–6.4) [^src1]. During this same period, the specific cluster of [[klynge-vest|Klynge VEST]] reported a lower rate of 4.7% (95% CI: 2.6–8.0) [^src1]. More recent data indicates a continuous decrease in this proportion across years, with the national rate dropping to 5.8% (95% CI: 5.5–6.2) [^src2]. Within the first year after an AF diagnosis, 5.8% of patients were registered with a heart failure diagnosis [^src4]. Geographically, the proportion varies between 5.4% and 7.2% at the regional level, and between 4.5% and 9% at the health cluster level [^src4].

The calculation of Indikator 15 relies on data from the Danish National Patient Register (Landspatientregisteret) using specific ICD-10 codes. However, the reports also acknowledge several systemic limitations affecting the data. These include a lack of coverage for general practice, the underreporting of unrecognized atrial fibrillation, and reporting issues tied to the DRG (Diagnosis Related Groups) system [^src4]. The measurement period for Indikator 15, alongside several other key indicators, officially started on July 1, 2024.

## Mentions
- Page 79: "Indikator 15: Andelen af nydiagnosticerede patienter med atrieflimren, som udvikler hjertesvigt inden for 1 år" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 76-80)
- Page 6: "Indikator 15: Andelen af nydiagnosticerede patienter med atrieflimren, som udvikler hjertesvigt inden for 1 år" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 6-10)
- Page 58: "Indikator 15: Hjertesvigt efter atrieflimren" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 56-60)
- Page 59: "Indikator 15: Andelen af nydiagnosticerede patienter med atriflimren, som udvikler hjertesvigt inden for 1 år" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 56-60)
- Page 61: "Indikator 15: Andelen af nydiagnosticerede patienter med atrieflimren, som udvikler hjertesvigt inden for 1 år." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65)

## Relationships
- Subject: indikator-15
  Predicate: is-part-of-report
  Object: atrieflimren-i-danmark
  Evidence: "Indikator 15: Andelen af nydiagnosticerede patienter med atrieflimren, som udvikler hjertesvigt inden for 1 år"
  Page: 79
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 76-80
- Subject: indikator-15
  Predicate: measures-outcome-of
  Object: atrieflimren
  Evidence: "Indikator 15: Andelen af nydiagnosticerede patienter med atrieflimren, som udvikler hjertesvigt inden for 1 år."
  Page: 61
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65
- Subject: indikator-15
  Predicate: is-defined-by
  Object: hjertesvigtsindikatoren
  Evidence: "Hjertesvigtsindikatoren opgøres for ny diagnosticerede patienter med en atrieflimren-diagnose, som ikke havde en hjertesvigtsdiagnose i forvejen."
  Page: 62
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65

## Claims
- I perioden 01.07.2022–30.06.2023 var andelen af nydiagnosticerede patienter med atrieflimren, som udviklede hjertesvigt inden for 1 år, 6,1 % (95 % CI: 5,7–6,4) for hele Danmark [^src1] (indikator-15, danmark)
  Type: clinical-indicator
  Page: 79
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 76-80
- For Klynge VEST var andelen af nydiagnosticerede patienter med atrieflimren, som udviklede hjertesvigt inden for 1 år, 4,7 % (95 % CI: 2,6–8,0) i perioden 01.07.2022–30.06.2023 [^src1] (indikator-15, klynge-vest)
  Type: clinical-indicator
  Page: 80
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 76-80
- For Indikator 15 var andelen for hele Danmark 5,8 % (95 % CI: 5,5–6,2) i perioden 01.07.2024–30.06.2025 [^src2] (indikator-15, danmark)
  Type: quality-indicator-result
  Page: 7
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 6-10
- Indenfor det første år efter AF diagnosen blev 5,8% registreret med en hjertesvigtsdiagnose. Der ses et kontinuerligt fald i andelen på tværs af år. [^src1] (indikator-15, hjertesvigtsindikatoren)
  Type: statistical
  Page: 62
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65
- På regionalt niveau varierer andelen fra 5,4-7,2%. [^src1] (indikator-15, hjertesvigtsindikatoren)
  Type: statistical
  Page: 62
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65
- På klyngeniveau varierer andelen fra 4,5-9%. [^src1] (indikator-15, hjertesvigtsindikatoren)
  Type: statistical
  Page: 62
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65
- Indikatoren fastholdes, men ændres med tilbagevirkende kraft så der måles på forekomsten af hjertesvigtsdiagnose i perioden 3 måneder efter atrieflimren diagnose til 12 måneder efter. [^src1] (indikator-15, hjertesvigtsindikatoren)
  Type: policy-decision
  Page: 62
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65

## Timeline
- 2024-07-01: Start af målingsperiode for Indikator 1, Indikator 2, Indikator 3, Indikator 4b, Indikator 5, Indikator 6, Indikator 7 og Indikator 15 (indikator-1, indikator-2, indikator-3, indikator-4b, indikator-5, indikator-6, indikator-7, indikator-15)

## Sources

[^src1]: AFDK_2024.pdf, pages 76-80
[^src2]: AFDK_2025.pdf, pages 6-10
[^src3]: AFDK_2025.pdf, pages 56-60
[^src4]: AFDK_2025.pdf, pages 61-65
