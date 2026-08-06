---
title: calprotectin
type: entity
aliases:
  - F-calpro
  - F-calprotectin
wiki: rkkp-danibd
updated: '2026-08-05T06:46:16.125Z'
sources:
  - file: wikis/rkkp-danibd/raw/DANIBD_2023.pdf
    pages: '11-15, 26-29, 6-10'
  - file: wikis/rkkp-danibd/raw/DANIBD_2024.pdf
    pages: '21-25, 26-30, 6-10'
tags:
  - biomarker
---
Calprotectin is a central biomarker used to assess mucosal inflammation in patients with [[ibd|IBD]] [^src3]. It plays a critical role in clinical decision-making and treatment adjustment, particularly for patients undergoing therapy with [[bmsl|Biologiske og målrettede syntetiske lægemidler]] (BMSL) [^src3]. There is strong international consensus that monitoring calprotectin at least once a year is a minimum criterion for follow-up in BMSL patients [^src3]. The biomarker can be measured via standard laboratory analysis or as a point-of-care (POC) test, such as through the [[constant-care|Constant – Care]] app [^src1]. For "resting" IBD patients at [[nordsjaellands-hospital|Nordsjællands Hospital]], the target is one annual calprotectin measurement, whereas measurement frequencies for patients in active biological treatment are individualized [^src1].

The measurement of calprotectin is tracked nationally through the DANIBD quality indicators to ensure standardized care. In the 2022–2023 period, [[indikator-4|Indikator 4]] monitored the proportion of BMSL patients receiving fecal calprotectin tests [^src5]. During this time, the national fulfillment rate for annual measurement was 78%, falling just short of the 80% standard [^src4]. By the 2023–2024 period, [[indikator-5|Indikator 5]] specifically tracked this metric, achieving an 83% fulfillment rate nationally [^src2]. The ongoing development target for Indikator 5 remains that at least 80% of BMSL patients should have fecal calprotectin measured at least once annually [^src3]. Departmental reporting for Indikator 5 reveals significant regional variation: [[nordsjaelland-kirurgisk-overafdeling|Nordsjælland Kirurgisk overafdeling]] reported an 88% fulfillment rate [^src3], [[slb-vejle-medicinsk-afdeling|SLB Vejle Medicinsk Afdeling]] reported 56% [^src3], and [[rigshospitalet-med-klinik-mave-tarm-lever|Rigshospitalet Med. Klinik Mave-, Tarm- og Leversygd.]] reported just 14% [^src3].

Accurate tracking of calprotectin relies heavily on data infrastructure and specific laboratory codes. The primary national code used to retrieve fecal calprotectin data from the Laboratory Database is NPU19717 [^src5]. However, to capture point-of-care tests that were previously missed, a local [[npu-kode|NPU-kode]] (PTP00001 F-calprotectin POC) used at Nordsjællands Hospital was officially included in the 2024 reporting as a follow-up to a previous audit [^src6]. This integration highlights the ongoing efforts to align local clinical practices with national quality registries.

## Mentions

- Page 28: "måling af calpro." [^src1]
- Page 28: "måling af calprotectin" [^src1]
- Page 8: "Indikator 5: Fæces calprotectin måling, BMSL1 ≥ 80" [^src2]
- Page 21: "Biomarkøren calprotectin afspejler graden af inflammatorisk aktivitet i tarmmukosa. Der er stærk anbefaling for og bred international enighed om, at monitorering af calprotectin en gang årligt er et minimumskriterium for opfølgning hos patienter i behandling med BMSL." [^src3]
- Page 7: "F-calpro" [^src4]
- Page 9: "F-calpro mindst én gang årligt" [^src4]
- Page 11: "Oplysninger om F-calpro fås fra Laboratoriedatabasen ved koden NPU19717." [^src5]
- Page 11: "På landsplan har 78 % af patienterne i BMSL fået målt F-calpro en gang årligt, hvormed standarden på mindst 80 % er tæt på at være opfyldt." [^src5]
- Page 26: "Som opfølgning på sidste audit er den lokale NPU-kode for måling af F-calprotectin også inkluderet (PTP00001 F-calprotectin POC). Koden anvendes på Nordsjællands Hospital." [^src6]

## Relationships

**Outgoing**
- Subject: calprotectin | Predicate: is-measured-via | Object: constantcare
  Evidence: "I denne app indgår måling af calprotectin som en poc prøve" [^src1]
- Subject: calprotectin | Predicate: is-biomarker-for | Object: ibd
  Evidence: "Biomarkøren calprotectin afspejler graden af inflammatorisk aktivitet i tarmmukosa." [^src3]
- Subject: calprotectin | Predicate: monitors | Object: ibd
  Evidence: "Biomarkøren calprotectin afspejler graden af inflammatorisk aktivitet i tarmmukosa" [^src4]
- Subject: calprotectin | Predicate: measured-with-npu-code | Object: npu-kode
  Evidence: "Som opfølgning på sidste audit er den lokale NPU-kode for måling af F-calprotectin også inkluderet (PTP00001 F-calprotectin POC)." [^src6]

**Incoming**
- Subject: indikator-5 | Predicate: measures | Object: calprotectin
  Evidence: "Indikator 5: Fæces calprotectin måling, BMSL1 ≥ 80" [^src2]
- Subject: nordsjaelland-kirurgisk-overafdeling | Predicate: reports-indicator-5-data | Object: calprotectin
  Evidence: "Nordsjælland Kirurgisk Afdeling 452 / 498 0 (0) 91 (88-93) 88" [^src3]
- Subject: slb-vejle-medicinsk-afdeling | Predicate: reports-indicator-5-data | Object: calprotectin
  Evidence: "SLB Vejle Medicinsk Afdeling 551 / 690 0 (0) 80 (77-83) 56" [^src3]
- Subject: rigshospitalet-med-klinik-mave-tarm-lever | Predicate: reports-indicator-5-data | Object: calprotectin
  Evidence: "Rigshospitalet Mave-, Tarm- og Leversygd. 43 / 263 0 (0) 16 (12-21) 14" [^src3]
- Subject: indikator-4 | Predicate: measures | Object: calprotectin
  Evidence: "Indikator 4 monitorerer andelen af patienter i BMSL, der får målt F-calpro" [^src5]
- Subject: indikator-5 | Predicate: measures-frequency-of | Object: calprotectin
  Evidence: "Denne indikator viser en udvikling i forhold til sidste år, og det er tydeligt, at der er fokus på at måle f-calprotectin hos denne patientgruppe." [^src6]

## Claims

**clinical-guideline**
- Målet for 'hvilende' IBD-patienter på NOH er én årlig calprotectin-måling, mens målingsrater for patienter i biologisk behandling er individualiserede [^src1]

**quality-indicator**
- Indikator 5: Fæces calprotectin måling, BMSL, har en opfyldelse på 83 % (95 % CI: 82–84) i perioden 01.10.2023–30.09.2024 [^src1]
- Andelen af patienter med IBD i behandling med BMSL, der får målt F-calpro mindst én gang årligt, er 78 % (95 % CI: 77–79) på landsplan for perioden 1. oktober 2022 til 30. september 2023 [^src1]

**quality-target**
- Udviklingsmålet for Indikator 5 er, at mindst 80 % af patienter i behandling med BMSL skal få målt F-calprotectin mindst én gang årligt [^src1]

**quality-metric**
- På landsplan har 78 % af patienterne i BMSL fået målt F-calpro en gang årligt [^src1]

**administrative**
- Som opfølgning på sidste audit er den lokale NPU-kode for måling af F-calprotectin også inkluderet (PTP00001 F-calprotectin POC) [^src1]

## Timeline

- 01.10.2023 - 30.09.2024: Opgørelsesperiode for Indikator 5 (Fæces calprotectin måling, BMSL) [^src2]
- 2024: Den lokale NPU-kode for måling af F-calprotectin (PTP00001 F-calprotectin POC) blev inkluderet i DANIBD-rapporten som opfølgning på sidste audit [^src6]

## Sources

[^src1]: DANIBD_2023.pdf, pages 26-29
[^src2]: DANIBD_2024.pdf, pages 6-10
[^src3]: DANIBD_2024.pdf, pages 21-25
[^src4]: DANIBD_2023.pdf, pages 6-10
[^src5]: DANIBD_2023.pdf, pages 11-15
[^src6]: DANIBD_2024.pdf, pages 26-30
