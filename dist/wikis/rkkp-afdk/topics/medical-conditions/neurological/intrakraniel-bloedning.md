---
title: Intrakraniel blødning
type: entity
aliases:
  - Intrakraniel blødning
wiki: rkkp-afdk
updated: '2026-08-14T20:31:34.822Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 96-100
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '106-110, 46-50, 51-55, 56-60, 6-10, 71-75'
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: '41-45, 46-50, 66-70, 91-95'
tags:
  - medical-condition
---
**Intrakraniel blødning** (intracranial hemorrhage) is a severe medical condition and a critical complication in the management of [[atrieflimren]]. In the context of the [[atrieflimren-i-danmark|Atrieflimren i Danmark]] (AFDK) quality database, it represents the primary bleeding risk that clinicians must balance against the risk of thrombosis when prescribing [[antikoagulationsbehandling]]. It is formally classified as a subtype of [[alvorlig-bloedning|Alvorlig blødning]] (severe bleeding) [^src10].

### Quality Indicators and Measurement
To monitor patient safety and treatment efficacy, intracranial hemorrhage is tracked through specific national quality indicators. [[indikator-6|Indikator 6]] measures the incidence of intracranial hemorrhage among prevalent patients with [[atrieflimren]], with a strict quality standard set at ≤ 0.6% [^src2]. Additionally, [[indikator-7|Indikator 7]] monitors the broader incidence of severe bleeding using adapted criteria from the [[international-society-of-thrombosis-and-hemostasis|International Society of Thrombosis and Hemostasis]] (ISTH) [^src2]. 

Data for these indicators are sourced directly from the [[landspatientregisteret|Landspatientregisteret]] (Danish National Patient Registry) [^src6]. Cases are identified using a specific set of ICD-10 diagnosis codes, including non-traumatic hemorrhages ([[di60|DI60]], [[di61|DI61]], [[di62|DI62]]) and traumatic hemorrhages ([[ds064|DS064]], [[ds065|DS065]], [[ds066|DS066]]) [^src4], [^src11].

### Epidemiology and Clinical Outcomes
The incidence of intracranial hemorrhage has been closely monitored across successive reporting periods in [[danmark|Danmark]]. Among newly diagnosed patients, the proportion experiencing an intracranial hemorrhage within one year of diagnosis was 0.7% in the 2021–2022 period [^src1], and 0.8% in the 2022–2023 period [^src5]. 

Among prevalent patients, the rates have remained relatively stable and consistently near or below the national [[udviklingsmaal|Udviklingsmål]] (development goal). The incidence was 0.53% (711 out of 134,710 patients) in the 2023 report [^src1], 0.5% in the 2024 report [^src4], and 0.56% (797 out of 140,344 patients) in the 2025 report [^src8]. In the most recent assessment, the national incidence reached 0.6%, successfully fulfilling the development goal [^src6]. Geographically, the incidence varies slightly, ranging from 0.5% to 0.7% at the regional level, and from 0.3% to 1.1% at the local health cluster level [^src6].

### Risk Factors and Pharmacovigilance
A significant clinical challenge is that a large proportion of intracranial hemorrhages occur in patients with lower thromboembolic risk profiles. In the 2023 report, 36.7% of prevalent patients who suffered an intracranial hemorrhage had a [[cha2ds2-vasc|CHA2DS2-VASc]] score of 1 [^src1]. By the 2024 report, 41.1% of such bleeding events occurred in patients with a score of 0 or 1 [^src4].

Pharmacovigilance data highlights the safety profiles of different anticoagulants. In the 2023 report, the bleeding rate was 0.52% for patients on NOACs and 0.46% for those on [[marevan]] [^src1]. In the 2024 report, the rate was 0.53% for [[doac|DOAC]] users compared to 0.82% for [[marevan]] users [^src4]. The 2025 report showed rates of 0.57% for [[doac|DOAC]], 0.63% for [[marevan]], 0.62% for patients on both, and 0.52% for patients on neither medication [^src6], [^src8]. Overall, among all prevalent patients on any form of [[antikoagulationsbehandling]], 0.57% developed an intracranial hemorrhage in the latest period [^src8].

---

## Mentions
- Page 98: "Fordeling af CHA2DS2VASc score blandt prævalente atrieflimren patienter med intrakraniel blødning" [^src1]
- Page 99: "Andel af nydiagnosticerede patienter med atrieflimren der har intrakraniel blødning 1 år efter diagnosedato." [^src1]
- Page 6: "Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren." [^src2]
- Page 50: "Indikator 6: Incidens Intrakraniel blødning
Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren." [^src3]
- Page 51: "Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren" [^src4]
- Page 74: "Supplerende analyser 6: Intrakraniel blødning" [^src5]
- Page 75: "Indikator 13: Andelen af nydiagnosticerede patienter med atriflimren, som får intrakraniel blødning inden for 1 år" [^src5]
- Page 41: "Indikator 6: Incidens Intrakraniel blødning" [^src6]
- Page 42: "Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren" [^src6]
- Page 45: "Oplysningerne vedrørende intrakraniel blødning indhentes fra Landspatientregistret" [^src6]
- Page 50: "Alvorlige blødninger defineres som intrakranielle blødninger, gastrointestinale blødninger, urinvejsblødninger og blødninger fra lungerne." [^src7]
- Page 69: "Supplerende analyser 6: Intrakraniel blødning" [^src8]

## Relationships

### Outgoing
- **Subject:** intrakraniel-bloedning | **Predicate:** is-complication-of | **Object:** atrieflimren
  - **Evidence:** "Andel af nydiagnosticerede patienter med atrieflimren der har intrakraniel blødning 1 år efter diagnosedato."
  - **Page:** 99 [^src1]
- **Subject:** intrakraniel-bloedning | **Predicate:** is-complication-of | **Object:** atrieflimren
  - **Evidence:** "Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren."
  - **Page:** 6 [^src2]
- **Subject:** intrakraniel-bloedning | **Predicate:** is-coded-by | **Object:** di60
  - **Evidence:** "DI60 (subaraknoidal blødning)"
  - **Page:** 54 [^src4]
- **Subject:** intrakraniel-bloedning | **Predicate:** is-coded-by | **Object:** di61
  - **Evidence:** "DI61 (hjerneblødning)"
  - **Page:** 54 [^src4]
- **Subject:** intrakraniel-bloedning | **Predicate:** is-coded-by | **Object:** di62
  - **Evidence:** "DI62 (andre ikke-traumatiske intrakranielle blødninger)"
  - **Page:** 54 [^src4]
- **Subject:** intrakraniel-bloedning | **Predicate:** is-coded-by | **Object:** ds064
  - **Evidence:** "DS064 (traumatisk epidural blødning)"
  - **Page:** 54 [^src4]
- **Subject:** intrakraniel-bloedning | **Predicate:** is-coded-by | **Object:** ds065
  - **Evidence:** "DS065 (traumatisk subdural blødning)"
  - **Page:** 54 [^src4]
- **Subject:** intrakraniel-bloedning | **Predicate:** is-coded-by | **Object:** ds066
  - **Evidence:** "DS066 (traumatisk subarachnoidal blødning)"
  - **Page:** 54 [^src4]
- **Subject:** intrakraniel-bloedning | **Predicate:** is-complication-of | **Object:** atrieflimren
  - **Evidence:** "Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren."
  - **Page:** 41 [^src6]

### Incoming
- **Subject:** international-society-of-thrombosis-and-hemostasis | **Predicate:** provides-criteria-for | **Object:** (this entity)
  - **Evidence:** "alvorlig blødning (tillempede International Society of Thrombosis and Hemostasis (ISTH) kriterier)"
  - **Page:** 6 [^src2]
- **Subject:** indikator-6 | **Predicate:** measures-incidence-of | **Object:** (this entity)
  - **Evidence:** "Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren."
  - **Page:** 50 [^src3]
- **Subject:** indikator-6 | **Predicate:** measures-incidence-of | **Object:** (this entity)
  - **Evidence:** "Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren"
  - **Page:** 51 [^src4]
- **Subject:** alvorlig-bloedning | **Predicate:** includes-subtype | **Object:** (this entity)
  - **Evidence:** "Alvorlige blødninger defineres som intrakranielle blødninger, gastrointestinale blødninger, urinvejsblødninger og blødninger fra lungerne."
  - **Page:** 60 [^src10]
- **Subject:** antikoagulationsbehandling | **Predicate:** is-associated-with-risk-of | **Object:** (this entity)
  - **Evidence:** "Supplerende analyser 6: Intrakraniel blødning"
  - **Page:** 74 [^src5]
- **Subject:** landspatientregisteret | **Predicate:** is-source-for | **Object:** (this entity)
  - **Evidence:** "Prævalente patienter med atrieflimren, der
udvikler intrakraniel blødning i opgørelses
perioden"
  - **Page:** 74 [^src5]
- **Subject:** di60 | **Predicate:** identifies-condition | **Object:** (this entity)
  - **Evidence:** "DI60 (subaraknoidal blødning)"
  - **Page:** 107 [^src11]
- **Subject:** di61 | **Predicate:** identifies-condition | **Object:** (this entity)
  - **Evidence:** "DI61 (hjerneblødning)"
  - **Page:** 107 [^src11]
- **Subject:** di62 | **Predicate:** identifies-condition | **Object:** (this entity)
  - **Evidence:** "DI62 (andre ikke-traumatiske
intrakranielle blødninger)"
  - **Page:** 107 [^src11]
- **Subject:** ds064 | **Predicate:** identifies-condition | **Object:** (this entity)
  - **Evidence:** "DS064 (traumatisk epidural blødning)"
  - **Page:** 107 [^src11]
- **Subject:** ds065 | **Predicate:** identifies-condition | **Object:** (this entity)
  - **Evidence:** "DS065 (traumatisk subdural blødning)"
  - **Page:** 107 [^src11]
- **Subject:** ds066 | **Predicate:** identifies-condition | **Object:** (this entity)
  - **Evidence:** "DS066 (traumatisk subarachnoidal
blødning)"
  - **Page:** 107 [^src11]
- **Subject:** landspatientregisteret | **Predicate:** provides-data-for | **Object:** (this entity)
  - **Evidence:** "Oplysningerne vedrørende intrakraniel blødning indhentes fra Landspatientregistret"
  - **Page:** 45 [^src6]
- **Subject:** di60 | **Predicate:** codes-for | **Object:** (this entity)
  - **Evidence:** "DI60 (subaraknoidal blødning)"
  - **Page:** 45 [^src6]
- **Subject:** di61 | **Predicate:** codes-for | **Object:** (this entity)
  - **Evidence:** "DI61 (hjerneblødning)"
  - **Page:** 45 [^src6]
- **Subject:** di62 | **Predicate:** codes-for | **Object:** (this entity)
  - **Evidence:** "DI62 (andre ikke-traumatiske intrakranielle blødninger)"
  - **Page:** 45 [^src6]
- **Subject:** ds064 | **Predicate:** codes-for | **Object:** (this entity)
  - **Evidence:** "DS064 (traumatisk epidural blødning)"
  - **Page:** 45 [^src6]
- **Subject:** ds065 | **Predicate:** codes-for | **Object:** (this entity)
  - **Evidence:** "DS065 (traumatisk subdural blødning)"
  - **Page:** 45 [^src6]
- **Subject:** ds066 | **Predicate:** codes-for | **Object:** (this entity)
  - **Evidence:** "DS066 (traumatisk subarachnoidal blødning)"
  - **Page:** 45 [^src6]
- **Subject:** di60 | **Predicate:** is-diagnosis-code-for | **Object:** (this entity)
  - **Evidence:** "DI60 (subaraknoidal blødning)"
  - **Page:** 93 [^src9]
- **Subject:** di61 | **Predicate:** is-diagnosis-code-for | **Object:** (this entity)
  - **Evidence:** "DI61 (hjerneblødning)"
  - **Page:** 93 [^src9]
- **Subject:** di62 | **Predicate:** is-diagnosis-code-for | **Object:** (this entity)
  - **Evidence:** "DI62 (andre ikke-traumatiske intrakranielle blødninger)"
  - **Page:** 93 [^src9]
- **Subject:** ds064 | **Predicate:** is-diagnosis-code-for | **Object:** (this entity)
  - **Evidence:** "DS064 (traumatisk epidural blødning)"
  - **Page:** 93 [^src9]
- **Subject:** ds065 | **Predicate:** is-diagnosis-code-for | **Object:** (this entity)
  - **Evidence:** "DS065 (traumatisk subdural blødning)"
  - **Page:** 93 [^src9]
- **Subject:** ds066 | **Predicate:** is-diagnosis-code-for | **Object:** (this entity)
  - **Evidence:** "DS066 (traumatisk subarachnoidal blødning)"
  - **Page:** 93 [^src9]

## Claims

### clinical-outcome
- Andelen af nydiagnosticerede patienter med atrieflimren, som får intrakraniel blødning inden for 1 år, var 0,7 % i Danmark i perioden 01.07.2021–30.06.2022 [^src1]
- Indikator 13: Andelen af nydiagnosticerede atrieflimren-patienter, der får intrakraniel blødning inden for 1 år, var 0,8 % i Danmark for perioden 01.07.2022–30.06.2023 (95 % CI: 0,7–0,9) [^src1]
- I alt blev 0,6% af de prævalente patienter med atrieflimren indlagt med intrakraniel blødning i den aktuelle opgørelsesperiode og udviklingsmålet (0,6%) er således opfyldt [^src1]
- De seneste to år var andelen 0,5%, men det er for tidligt at tale om en stigning af betydning [^src1]
- På regionalt niveau varierer andelen fra 0,5-0,7% [^src1]
- På klyngeniveau varierer andelen fra 0,3-1,1% [^src1]
- Af de 140.344 prævalente patienter med atrieflimren udviklede 797 (0,56 %) intrakraniel blødning i opgørelsesperioden [^src5]
- Af de 107.855 prævalente patienter med atrieflimren og på antikoagulationsbehandling udviklede 622 (0,57 %) intrakraniel blødning i opgørelsesperioden [^src5]
- Af de 5.056 prævalente patienter med atrieflimren og på Marevan udviklede 32 (0,63 %) intrakraniel blødning i opgørelsesperioden [^src5]
- Af de 807 prævalente patienter med atrieflimren og på både DOAC og Marevan udviklede 5 (0,62 %) intrakraniel blødning i opgørelsesperioden [^src5]
- Af de 26.626 prævalente patienter med atrieflimren uden DOAC eller Marevan udviklede 138 (0,52 %) intrakraniel blødning i opgørelsesperioden [^src5]

### epidemiological
- I Danmark udgjorde antallet af prævalente atrieflimren-patienter med intrakraniel blødning 711 ud af 134.710 patienter, hvilket svarer til 0,53 % [^src1]
- I den aktuelle opgørelsesperiode (01.07.2023 - 30.06.2024) blev 0,5% af de prævalente patienter med atrieflimren indlagt med intrakraniel blødning [^src1]

### clinical-risk-distribution
- Blandt prævalente atrieflimren-patienter med intrakraniel blødning i Danmark havde 36,7 % en CHA2DS2-VASc-score på 1 [^src1]
- 41,1% af intrakranielle blødninger optrådte blandt patienter med en CHA2DS2-VASc score på 0 eller 1 [^src1]

### pharmacovigilance
- For patienter med atrieflimren, der modtog NOAC-behandling, var andelen af intrakraniel blødning 0,52 % [^src1]
- For patienter med atrieflimren, der modtog Marevan-behandling, var andelen af intrakraniel blødning 0,46 % [^src1]
- Andelen af patienter med intrakraniel blødning er 0,53% for DOAC og 0,82% for marevan [^src1]
- Andelen af patienter med intrakraniel blødning er 0,57 % for DOAC [^src1]
- Andelen af patienter med intrakraniel blødning er 0,63% for marevan [^src1]

### quality-standard
- Indikator 6 har standarden ≤ 0,6 % for incidensen af intrakraniel blødning blandt prævalente patienter med atrieflimren [^src1]
- Indikator 7 har ingen angivet standard, men rapporterer incidensen af alvorlig blødning (tillempede ISTH-kriterier) blandt prævalente patienter med atrieflimren [^src1]

### incidence-rate
- På landsplan udvikler 0,8% af den incidente population intrakraniel blødning 1 år efter diagnosen atrieflimren er stillet [^src1]

### epidemiology
- Prævalente atrieflimren-patienter, der udvikler intrakraniel blødning i opgørelsesperioden: 0,53 % (733 ud af 136357) [^src1]

### quality-indicator
- Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren [^src1]

## Timeline
- **01.07.2022–30.06.2023:** Opgørelsesperiode for Indikator 14 (iskæmisk apopleksi) og Indikator 13 (intrakraniel blødning) (atrieflimren-i-danmark, iskaemisk-apopleksi, intrakraniel-bloedning) [^src5]

## Sources

[^src1]: AFDK_2023.pdf, pages 96-100
[^src2]: AFDK_2024.pdf, pages 6-10
[^src3]: AFDK_2024.pdf, pages 46-50
[^src4]: AFDK_2024.pdf, pages 51-55
[^src5]: AFDK_2024.pdf, pages 71-75
[^src6]: AFDK_2025.pdf, pages 41-45
[^src7]: AFDK_2025.pdf, pages 46-50
[^src8]: AFDK_2025.pdf, pages 66-70
[^src9]: AFDK_2025.pdf, pages 91-95
[^src10]: AFDK_2024.pdf, pages 56-60
[^src11]: AFDK_2024.pdf, pages 106-110
