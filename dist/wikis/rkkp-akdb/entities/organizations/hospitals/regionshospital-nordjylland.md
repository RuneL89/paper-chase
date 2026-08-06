---
title: Regionshospital Nordjylland
type: entity
aliases:
  - Regionshospital Nordjylland
  - Regionshospital Nordjylland Ven
  - RHN
wiki: rkkp-akdb
updated: '2026-08-05T18:59:06.941Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '41-45, 56-60, 6-10, 61-65, 71-75'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '101-105, 106-107, 11-15, 51-55, 6-10, 61-65, 66-70, 71-75'
tags:
  - organization
---
Regionshospital Nordjylland (RHN), located in Hjørring, is a hospital within [[region-nordjylland|Region Nordjylland]] that actively participates in the Danish national clinical quality monitoring program for acute surgery (AKDB) [^src11]. The hospital's performance is systematically benchmarked against national standards across various clinical indicators, reflecting its role in the broader landscape of Danish healthcare quality measurement and transparency.

In the reporting period from September 1, 2022, to August 31, 2023, RHN's compliance with [[indikator-1|Indikator 1]] (early antibiotic treatment) was recorded at 26.7% [^src1]. The hospital also reported outcomes related to 30-day mortality following acute surgery. For patients with a [[charlson-score-1-2|Charlson Score = 1 eller 2]], 6 out of 30 patients died within 30 days, representing a mortality rate of 20.0% [^src3]. In the subsequent period from September 1, 2023, to August 31, 2024, the hospital recorded 5 deaths among 16 included patients with a Charlson Score of 1 or 2 (tracked under [[indikator-9b|Indikator 9b]]) [^src9], and 5 deaths among 16 patients with a [[charlson-score|Charlson Score]] ≥ 3 (tracked under [[indikator-9c|Indikator 9c]]) [^src9]. Furthermore, RHN did not meet the standard for [[indikator-9|Indikator 9]] during the 2022-2023 period [^src2].

Beyond passive reporting, Regionshospital Nordjylland actively audits and critiques the methodology and data quality of the AKDB indicators. During a thorough review of the annual report, RHN raised significant concerns regarding the validity of the Charlson Score calculations, identifying that none of the patients in the "score 0" population actually fulfilled the criteria due to their high age, though unclear background variables prevented full data application [^src11]. The hospital also identified data inconsistencies in [[indikator-10|Indikator 10]], noting that many included patients died from their underlying primary disease rather than postoperative complications [^src11]. Additionally, RHN questioned the clinical relevance and definitions of [[indikator-3|Indikator 3]], specifically seeking clarification on whether an anesthesiologist could apply the procedure code [[sks-kode-naaz42|SKS-koden NAAZ42]] for pre-optimization outside of specific intensive care units [^src11] [^src13].

## Mentions

- Page 9: "Regionshospital Nordjylland Nej 23 / 86 0 (0) 26,7 (17,8-37,4) 26,0 16,2" [^src1]
- Page 41: "Regionshospital Nordjylland" [^src2]
- Page 61: "Regionshospital Nordjylland 6 / 30 0 (0) 20,0 (7,7-38,6) 6,3 7,4" [^src3]
- Page 71: "Regionshospital Nordjylland 102 33,2 63,00 74,00 70,71 80,00" [^src4]
- Page 6: "Regionshospital Nordjylland Nej 38 / 96 0 (0) 39,6 (29,7-50,1) 26,7 26,0" [^src5]
- Page 11: "Regionshospital Nordjylland" [^src6]
- Page 51: "Regionshospital Nordjylland Nej 12 / 98 0 (0) 12,2 (6,5-20,4) 15,8 8,9" [^src7]
- Page 61: "Regionshospital Nordjylland 4 / 54 0 (0) 7,4 (2,1-17,9) 5,3 10,0" [^src8]
- Page 66: "Regionshospital Nordjylland" [^src9]
- Page 71: "Regionshospital Nordjylland 102 32,9 63,00 74,00 70,71 80,00" [^src10]
- Page 101: "Regionshospital Nordjylland (RHN) i Hjørring har følgende spørgsmål til hhv. indikator 1 og 3 ifm. deres grundige gennemgang af årsrapporten samt efterfølgende audit" [^src11]
- Page 56: "Regionshospital Nordjylland Ven" [^src12]
- Page 106: "patienter? RHN tænker umiddelbart, at denne indikator er mest relevant for 4X patienter." [^src13]
- Page 106: "Vedr. indikator 3:
RHN har behov for en afklaring." [^src13]

## Relationships

**Outgoing**
- Subject: regionshospital-nordjylland | Predicate: has-indicator-result | Object: indikator-1
  Evidence: "Regionshospital Nordjylland Nej 23 / 86 0 (0) 26,7 (17,8-37,4) 26,0 16,2" [^src1]
- Subject: regionshospital-nordjylland | Predicate: does-not-meet-standard-of | Object: indikator-9
  Evidence: "Regionshospital Nordjylland Nej 28 / 95 0 (0) 29,5 (20,6-39,7) 34,2 43,0" [^src2]
- Subject: regionshospital-nordjylland | Predicate: audits | Object: indikator-1
  Evidence: "Regionshospital Nordjylland (RHN) i Hjørring har følgende spørgsmål til hhv. indikator 1 og 3 ifm. deres grundige gennemgang af årsrapporten samt efterfølgende audit" [^src11]
- Subject: regionshospital-nordjylland | Predicate: audits | Object: indikator-3
  Evidence: "Regionshospital Nordjylland (RHN) i Hjørring har følgende spørgsmål til hhv. indikator 1 og 3 ifm. deres grundige gennemgang af årsrapporten samt efterfølgende audit" [^src11]
- Subject: regionshospital-nordjylland | Predicate: criticizes | Object: charlson-score
  Evidence: "Der findes at Charlescon scorer ikke passer, der er således ingen af patienter i score 0 populationen der burde være score 0, idet de alle har høj alder, men idet det er uklaart hvor baggrundsvariabler til udregning er hentet fra er det ikke muligt helt at anvende data." [^src11]
- Subject: regionshospital-nordjylland | Predicate: identifies-data-inconsistency-in | Object: indikator-10
  Evidence: "Er det muligt ift. indikator 10, så har Regionshospital Nordjylland gennemgået deres forløb og fundet at mange af de patienter som inkluderes dør af deres grundlidelse og ikke at postoperative komplikationer pga. et AHA forløb." [^src11]
- Subject: regionshospital-nordjylland | Predicate: questions-definition-of | Object: indikator-3
  Evidence: "RHN har behov for en afklaring. Hvis patienten køres på OP og præoptimeres af en anæstesiolog inden selve operationen." [^src13]
- Subject: regionshospital-nordjylland | Predicate: questions-code-application-for | Object: sks-kode-naaz42
  Evidence: "Må anæstesiologen så ikke anvende procedurekoden NAAZ42 eller må den kun anvendes, hvis patienten præoptimeres enten på IMA eller ITA-afsnit?" [^src13]

**Incoming**
- Subject: region-nordjylland | Predicate: contains-hospital | Object: regionshospital-nordjylland
  Evidence: "Nordjylland 13 / 76 [...] Regionshospital Nordjylland 6 / 30" [^src3]

## Claims

- Regionshospital Nordjylland: 6 / 30 døde indenfor 30 dage efter akut kirurgi med Charlson Score = 1 eller 2 (20,0 %; 95 % CI: 7,7-38,6) [^src1] (regionshospital-nordjylland, charlson-score-1-2)
  Type: hospital-statistic
- For perioden 01.09.2023 – 31.08.2024 blev der registreret 5 patienter med død inden for 30 dage efter akut kirurgi ved Regionshospital Nordjylland blandt 16 inkluderede patienter med Charlson Score = 1 eller 2 [^src1] (regionshospital-nordjylland, indikator-9b)
  Type: clinical-outcome
- For perioden 01.09.2023 – 31.08.2024 blev der registreret 5 patienter med død inden for 30 dage efter akut kirurgi ved Regionshospital Nordjylland blandt 16 inkluderede patienter med Charlson Score ≥ 3 [^src1] (regionshospital-nordjylland, indikator-9c)
  Type: clinical-outcome
- Regionshospital Nordjylland har identificeret, at ingen af patienterne i 'score 0'-populationen for Charlson-score faktisk opfylder kriterierne, idet de alle har høj alder [^src1] (regionshospital-nordjylland, charlson-score)
  Type: clinical-assessment
- RHN tænker umiddelbart, at denne indikator er mest relevant for 4X patienter [^src1] (regionshospital-nordjylland, indikator-3)
  Type: relevance-assessment

## Timeline

(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 41-45
[^src3]: AKDB_2023.pdf, pages 61-65
[^src4]: AKDB_2023.pdf, pages 71-75
[^src5]: AKDB_2024.pdf, pages 6-10
[^src6]: AKDB_2024.pdf, pages 11-15
[^src7]: AKDB_2024.pdf, pages 51-55
[^src8]: AKDB_2024.pdf, pages 61-65
[^src9]: AKDB_2024.pdf, pages 66-70
[^src10]: AKDB_2024.pdf, pages 71-75
[^src11]: AKDB_2024.pdf, pages 101-105
[^src12]: AKDB_2023.pdf, pages 56-60
[^src13]: AKDB_2024.pdf, pages 106-107
