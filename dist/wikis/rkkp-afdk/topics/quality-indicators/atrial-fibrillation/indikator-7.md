---
title: Indikator 7
type: entity
aliases:
  - Indikator 7
wiki: rkkp-afdk
updated: '2026-08-05T20:13:34.688Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 71-75
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '56-60, 6-10'
tags:
  - topic
---
**Indikator 7** is a central quality measurement within the Danish healthcare system's monitoring of [[atrieflimren]] (atrial fibrillation) treatment. Produced by the [[regionernes-kliniske-kvalitetsudviklingsprogram|Regionernes Kliniske Kvalitetsudviklingsprogram]], the indicator tracks the incidence of severe bleeding among prevalent patients with atrial fibrillation to evaluate the safety of anticoagulant therapy [^src1] [^src2] [^src3]. 

The indicator is defined using adapted criteria from the [[international-society-of-thrombosis-and-hemostasis|International Society of Thrombosis and Hemostasis]] (ISTH) [^src1] [^src2]. To identify cases of severe bleeding—defined as acute hospital admissions involving bleeding, including specific events like [[intrakraniel-bloedning|Intrakraniel blødning]]—the metric relies on data extracted from the [[landspatientregisteret|Landspatientregisteret]] (Danish National Patient Register) [^src1] [^src2] [^src3]. While Indikator 7 does not have a predefined target standard, it serves as a crucial surveillance tool for clinical safety [^src3].

Epidemiological data across multiple reporting periods shows a stable national incidence rate. In the 2021/22 and 2022/23 periods, 2.2% of prevalent patients were admitted with severe bleeding [^src1]. For the period spanning July 1, 2023, to June 30, 2024, the national incidence was measured at 2.1% (95% CI: 2.1–2.2) [^src3]. Despite an increased use of anticoagulant treatments over the years, reports note no real national development or trend in the proportion of severe bleedings across the recent annual reporting periods [^src1] [^src2]. Regionally, the proportion of patients admitted with severe bleeding has consistently varied between 1.9% and 2.5% depending on the specific year and region [^src1] [^src2]. For incident patients (one year post-diagnosis), the national rate of severe bleeding was slightly higher at 3.1%, with regional variations between 2.5% and 3.4% [^src1].

Clinical and pharmacological analyses tied to Indikator 7 reveal important safety insights. Notably, 43.7% of severe bleedings occurred among patients with a low stroke risk, indicated by a [[cha2ds2-vasc|CHA2DS2-VASc]] score of 0 or 1 [^src1]. When comparing anticoagulant types, the proportion of patients experiencing severe bleeding was 2.33% for those on [[doac|DOAC]]s and 2.44% for those treated with [[marevan]] [^src1].

## Mentions

- Page 71: "Indikator 7. Incidens af alvorlig blødning (tillempede International Society of Thrombosis and Hemostasis (ISTH) kriterier) blandt prævalente patienter med atrieflimren." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 71-75)
- Page 72: "Indikator 7 opgøres for alle prævalente patienter med en atrieflimren-diagnose" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 71-75)
- Page 56: "Indikator 7: Incidens alvorlig blødning" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 56-60)

## Relationships

**Outgoing (this entity is the SUBJECT of these relationships):**

- Subject: indikator-7
  Predicate: is-calculated-using-data-from
  Object: landspatientregisteret
  Evidence: "Indikator 7 opgøres for alle prævalente patienter med en atrieflimren-diagnose [...] og større blødning er identificeret via data fra Landspatientregistret"
  Page: 72
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 71-75

- Subject: indikator-7
  Predicate: is-defined-by
  Object: international-society-of-thrombosis-and-hemostasis
  Evidence: "Indikator 7. Incidens af alvorlig blødning (tillempede International Society of Thrombosis and Hemostasis (ISTH) kriterier)"
  Page: 56
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 56-60

- Subject: indikator-7
  Predicate: uses-data-from
  Object: landspatientregisteret
  Evidence: "Større blødning er defineret som en akut indlæggelse med blødning og er identificeret via data fra Landspatientregistret."
  Page: 60
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 56-60

- Subject: indikator-7
  Predicate: is-produced-by
  Object: regionernes-kliniske-kvalitetsudviklingsprogram
  Evidence: "Regionernes Kliniske Kvalitetsudviklingsprogram"
  Page: 56
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 56-60

**Incoming (this entity is the OBJECT of these relationships):**

- Subject: atrieflimren
  Predicate: has-indicator
  Object: (this entity)
  Evidence: "Indikator 7: Incidens af alvorlig blødning (tillempede International Society of Thrombosis and Hemostasis (ISTH) kriterier) blandt prævalente patienter med atrieflimren."
  Page: 6
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 6-10

## Claims

**Epidemiological**
- I alt blev 2,2% af de prævalente patienter med atrieflimren indlagt med alvorlig blødning i løbet af opgørelsesperioden [^src1] (indikator-7)
- Der ses ingen reel udvikling i andelen siden 2018-2019 trods øget anvendelse af antikoagulerende behandling [^src1] (indikator-7)
- På regionsniveau varierede andelen som blev indlagt med alvorlig blødning mellem 1,9-2,3% [^src1] (indikator-7)
- Andelen af patienter med alvorlig blødning 1 år efter diagnosedato (incidente patienter) er på landsplan 3,1% og varierer regionalt fra 2,5-3,4% [^src1] (indikator-7)

**Clinical**
- 43,7% af blødningerne optrådte blandt patienter med en CHA2DS2-VASc score på 0 eller 1 [^src1] (cha2ds2-vasc, indikator-7)

**Pharmacological**
- Andelen af patienter med alvorlig blødning er 2,33% for DOAC og 2,44% for marevan [^src1] (doac, marevan, indikator-7)

**Quality-standard**
- Indikator 7 har ingen angivet standard, men rapporterer incidensen af alvorlig blødning (tillempede ISTH-kriterier) blandt prævalente patienter med atrieflimren [^src1] (atrieflimren, intrakraniel-bloedning, international-society-of-thrombosis-and-hemostasis, indikator-7)

**Performance-data**
- For Indikator 7 blev den nationale incidens i perioden 01.07.2023–30.06.2024 målt til 2,1 % (95 % CI: 2,1–2,2) [^src1] (indikator-7)

**Trend**
- Der ses ingen reel udvikling i andelen nationalt i løbet af de seneste tre årsrapportsperioder [^src1] (indikator-7)

## Timeline

- 2022-07-01: Start af opgørelsesperiode for Indikator 7 og Indikator 8 (indikator-7, indikator-8)
- 2023-06-30: Afslutning af opgørelsesperiode for Indikator 7 og Indikator 8 (indikator-7, indikator-8)
- 2021/22: Indikator 7 beregnet for perioden 2021/22 med andele på 2,2% nationalt og 1,9–2,5% regionalt (indikator-7)
- 2022/23: Indikator 7 beregnet for perioden 2022/23 med andele på 2,2% nationalt og 1,9–2,5% regionalt (indikator-7)
- 01.07.2023 - 30.06.2024: Indikator 7 beregnet for perioden 01.07.2023 - 30.06.2024 med national andel på 2,2% og regional variation 1,9–2,2% (indikator-7)

## Sources

[^src1]: AFDK_2023.pdf, pages 71-75
[^src2]: AFDK_2024.pdf, pages 56-60
[^src3]: AFDK_2024.pdf, pages 6-10
