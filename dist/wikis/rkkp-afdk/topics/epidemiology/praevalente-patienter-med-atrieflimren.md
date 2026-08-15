---
title: Prævalente patienter med atrieflimren
type: entity
aliases:
  - Prævalente patienter med atrieflimren
wiki: rkkp-afdk
updated: '2026-08-14T21:14:02.776Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 56-60
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: '41-45, 46-50, 71-75'
tags:
  - patient-population
---
**Prævalente patienter med atrieflimren** (Prevalent patients with atrial fibrillation) is a strictly defined patient population cohort that serves as a foundational denominator in the Danish national healthcare quality indicators for atrial fibrillation. Specifically, this population forms the denominator for Indicator 7, which monitors the safety of anticoagulation therapy by measuring the incidence of [[alvorlig-bloedning|severe bleeding]] (alvorlig blødning) [^src1]. The cohort is formally defined as all individuals who were alive as of July 1, 2023, and had at least one registered atrial fibrillation diagnosis in the Danish National Patient Register (Landspatientregisteret) within the preceding 10 years [^src1].

This population is central to the annual "Atrieflimren i [[danmark|Danmark]]" reports published by the Danish Regions and the Danish Healthcare Quality Programme (RKKP). Across the 2024 and 2025 reporting cycles, the cohort is utilized to evaluate multiple critical clinical outcomes, including intracranial bleeding (Indicator 6) [^src2], severe bleeding (Indicator 7) [^src3], and overall mortality ([[indikator-9|Indicator 9]]) [^src4]. During the specific reporting period from July 1, 2024, to June 30, 2025, the national count of prevalent patients with atrial fibrillation reached 138,889 [^src4].

Epidemiological tracking of this cohort provides vital insights into the safety and efficacy of anticoagulant treatments such as [[doac|DOAC]] and [[marevan|marevan]]. Data shows that 2.2% of the prevalent patients were hospitalized with severe bleeding during the reporting period [^src1] [^src3]. Nationally, the proportion of prevalent patients developing severe bleeding was recorded at 2.22%, compared to 1.37% among those not receiving anticoagulant therapy [^src4]. When comparing specific treatments within this broader patient context, the rate of severe bleeding was 2.30% for patients on DOAC and 2.38% for those on marevan [^src1]. Furthermore, for incident patients (one year post-diagnosis), the national rate of severe bleeding was 3.2%, with regional variations ranging from 2.8% to 3.8% [^src1].

Methodologically, the reports apply adapted International Society of Thrombosis and Hemostasis (ISTH) criteria to define severe bleeding events, allowing for standardized comparisons across regions and time. However, the reports also note a critical methodological limitation: unadjusted proportions carry a risk of case-mix effects, making direct comparisons between healthcare units problematic without adjusting for underlying demographic and clinical factors [^src4].

## Mentions
- Page 60: "Indikator 7 opgøres for alle prævalente patienter med en atrieflimren-diagnose, dvs. alle personer, som var i live pr. 1. juli 2023, og som har fået diagnosen registeret i Landspatientregisteret mindst én gang inden for de foregående 10 år." [^src1]
- Page 41: "Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren." [^src2]
- Page 42: "Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren" [^src2]
- Page 45: "blandt prævalente patienter med atrieflimren" [^src2]
- Page 46: "Incidens af alvorlig blødning (tillempede International Society of Thrombosis and Hemostasis (ISTH) kriterier) blandt prævalente patienter med atrieflimren." [^src3]
- Page 47: "Incidens af alvorlig blødning (tillempede International Society of Thrombosis and Hemostasis (ISTH) kriterier) blandt prævalente patienter med atrieflimren" [^src3]
- Page 71: "Prævalente patienter med atrieflimren, der udvikler alvorlig blødning i opgørelses perioden" [^src4]
- Page 72: "Andelen af prævalente patienter med diagnosen atrieflimren som dør i opgørelsesperioden" [^src4]

## Relationships
**Outgoing**
- **Subject:** praevalente-patienter-med-atrieflimren | **Predicate:** are-subject-of | **Object:** indikator-9
  **Evidence:** "Andelen af prævalente patienter med diagnosen atrieflimren som dør i opgørelsesperioden" (Page 72) [^src4]

**Incoming**
- **Subject:** doac | **Predicate:** is-treatment-for | **Object:** praevalente-patienter-med-atrieflimren
  **Evidence:** "Andelen af patienter med alvorlig blødning er 2,30% for DOAC og 2,38% for marevan." (Page 60) [^src1]
- **Subject:** marevan | **Predicate:** is-treatment-for | **Object:** praevalente-patienter-med-atrieflimren
  **Evidence:** "Andelen af patienter med alvorlig blødning er 2,30% for DOAC og 2,38% for marevan." (Page 60) [^src1]

## Claims
**Epidemiological**
- I alt blev 2,2% af de prævalente patienter med atrieflimren indlagt med alvorlig blødning i løbet af opgørelsesperioden [^src1]
- Andelen af patienter med alvorlig blødning 1 år efter diagnosedato (incidente patienter) er på landsplan 3,2% og varierer regionalt fra 2,8-3,8% [^src1]
- I alt blev 2,2% af de prævalente patienter med atrieflimren indlagt med alvorlig blødning i løbet af opgørelsesperioden [^src1]

**Demographic**
- Antallet af prævalente patienter med atrieflimren var 138.889 på landsplan i opgørelsesperioden 01.07.2024–30.06.2025 [^src1]

**Incidence-rate**
- Andelen af prævalente patienter med atrieflimren, som udvikler alvorlig blødning, er 2,22% på landsplan [^src1]
- Andelen af prævalente patienter med atrieflimren, som udvikler alvorlig blødning, er 1,37% blandt dem uden AK-behandling [^src1]

## Timeline
*(No timeline events extracted for this entity)*

## Sources

[^src1]: AFDK_2024.pdf, pages 56-60
[^src2]: AFDK_2025.pdf, pages 41-45
[^src3]: AFDK_2025.pdf, pages 46-50
[^src4]: AFDK_2025.pdf, pages 71-75
