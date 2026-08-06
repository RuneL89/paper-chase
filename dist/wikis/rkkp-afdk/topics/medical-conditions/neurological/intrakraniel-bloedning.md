---
title: Intrakraniel blødning
type: entity
aliases:
  - Intrakraniel blødning
wiki: rkkp-afdk
updated: '2026-08-05T20:39:02.553Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 96-100
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '106-110, 46-50, 51-55, 56-60, 6-10, 71-75'
tags:
  - medical-condition
---
**Intrakraniel blødning** (intracranial hemorrhage) is a severe medical condition and a critical safety complication monitored within the [[atrieflimren-i-danmark|Atrieflimren i Danmark]] (AFDK) database. In the context of [[atrieflimren|atrieflimren]] management, it represents one of the most serious adverse effects of [[antikoagulationsbehandling|antikoagulationsbehandling]], creating a complex clinical balancing act for physicians who must weigh the risk of thrombosis against the risk of severe bleeding [^src1], [^src2].

### Clinical Significance and Quality Indicators
Within the [[danmark|Danmark]] healthcare quality framework, intracranial hemorrhage is the second central complication measured by the AFDK database. It is primarily tracked through [[indikator-6|Indikator 6]], which measures the incidence of the condition among prevalent atrial fibrillation patients, and through supplementary indicators (such as Indikator 13 and 14) that track incidence among newly diagnosed patients within one year of their diagnosis [^src1], [^src2], [^src5]. The quality standard for Indikator 6 is strictly set at an incidence rate of ≤ 0.6% [^src2]. The condition is classified as a primary subtype of [[alvorlig-bloedning|Alvorlig blødning]], which is defined using adapted criteria from the [[international-society-of-thrombosis-and-hemostasis|International Society of Thrombosis and Hemostasis]] (ISTH) [^src2], [^src6]. National incidence and prevalence data are systematically sourced from the [[landspatientregisteret|Landspatientregisteret]] [^src5].

### Epidemiology and Pharmacovigilance
Recent reporting periods highlight the ongoing risk associated with anticoagulation. For the period of July 1, 2023, to June 30, 2024, 0.5% of prevalent atrial fibrillation patients were admitted with an intracranial hemorrhage [^src4]. Among newly diagnosed patients in the preceding year (July 1, 2022, to June 30, 2023), the 1-year incidence rate was 0.8% [^src5]. Earlier data from July 1, 2021, to June 30, 2022, showed a 1-year incidence of 0.7% among newly diagnosed patients [^src1].

Pharmacovigilance data reveals differences in bleeding risks based on the type of anticoagulant used. In the 2023 report, the rate of intracranial hemorrhage was 0.52% for patients receiving [[doac|DOAC]] (NOAC) treatment and 0.46% for those on [[marevan|marevan]] [^src1]. However, subsequent data indicated a rate of 0.53% for DOAC and 0.82% for marevan, underscoring the variability and importance of continuous monitoring [^src4]. Furthermore, risk stratification using the [[cha2ds2-vasc|CHA2DS2-VASc]] score shows that a significant portion of these bleeding events occur in patients with relatively low thrombosis risk scores; for instance, 41.1% of intracranial hemorrhages occurred in patients with a score of 0 or 1 [^src4], and 36.7% had a score of 1 in an earlier cohort [^src1].

### Diagnostic Coding
In the Danish registries, intracranial hemorrhage is identified using a specific set of ICD-10 diagnosis codes covering both non-traumatic and traumatic etiologies. These include [[di60|DI60]] (subarachnoid hemorrhage), [[di61|DI61]] (intracerebral hemorrhage), [[di62|DI62]] (other non-traumatic intracranial hemorrhage), [[ds064|DS064]] (traumatic epidural hemorrhage), [[ds065|DS065]] (traumatic subdural hemorrhage), and [[ds066|DS066]] (traumatic subarachnoid hemorrhage) [^src4], [^src7].

---

## Mentions
- **Page 98**: "Fordeling af CHA2DS2VASc score blandt prævalente atrieflimren patienter med intrakraniel blødning" [^src1]
- **Page 99**: "Andel af nydiagnosticerede patienter med atrieflimren der har intrakraniel blødning 1 år efter diagnosedato." [^src1]
- **Page 6**: "Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren." [^src2]
- **Page 50**: "Indikator 6: Incidens Intrakraniel blødning
Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren." [^src3]
- **Page 51**: "Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren" [^src4]
- **Page 74**: "Supplerende analyser 6: Intrakraniel blødning" [^src5]
- **Page 75**: "Indikator 13: Andelen af nydiagnosticerede patienter med atriflimren, som får intrakraniel blødning inden for 1 år" [^src5]

## Relationships

### Outgoing (this entity is the SUBJECT)
- **intrakraniel-bloedning** → `is-complication-of` → **atrieflimren**
  - Evidence: "Andel af nydiagnosticerede patienter med atrieflimren der har intrakraniel blødning 1 år efter diagnosedato." (Page 99) [^src1]
- **intrakraniel-bloedning** → `is-complication-of` → **atrieflimren**
  - Evidence: "Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren." (Page 6) [^src2]
- **intrakraniel-bloedning** → `is-coded-by` → **di60**
  - Evidence: "DI60 (subaraknoidal blødning)" (Page 54) [^src4]
- **intrakraniel-bloedning** → `is-coded-by` → **di61**
  - Evidence: "DI61 (hjerneblødning)" (Page 54) [^src4]
- **intrakraniel-bloedning** → `is-coded-by` → **di62**
  - Evidence: "DI62 (andre ikke-traumatiske intrakranielle blødninger)" (Page 54) [^src4]
- **intrakraniel-bloedning** → `is-coded-by` → **ds064**
  - Evidence: "DS064 (traumatisk epidural blødning)" (Page 54) [^src4]
- **intrakraniel-bloedning** → `is-coded-by` → **ds065**
  - Evidence: "DS065 (traumatisk subdural blødning)" (Page 54) [^src4]
- **intrakraniel-bloedning** → `is-coded-by` → **ds066**
  - Evidence: "DS066 (traumatisk subarachnoidal blødning)" (Page 54) [^src4]

### Incoming (this entity is the OBJECT)
- **international-society-of-thrombosis-and-hemostasis** → `provides-criteria-for` → **intrakraniel-bloedning**
  - Evidence: "alvorlig blødning (tillempede International Society of Thrombosis and Hemostasis (ISTH) kriterier)" (Page 6) [^src2]
- **indikator-6** → `measures-incidence-of` → **intrakraniel-bloedning**
  - Evidence: "Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren." (Page 50) [^src3]
- **indikator-6** → `measures-incidence-of` → **intrakraniel-bloedning**
  - Evidence: "Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren" (Page 51) [^src4]
- **alvorlig-bloedning** → `includes-subtype` → **intrakraniel-bloedning**
  - Evidence: "Alvorlige blødninger defineres som intrakranielle blødninger, gastrointestinale blødninger, urinvejsblødninger og blødninger fra lungerne." (Page 60) [^src6]
- **antikoagulationsbehandling** → `is-associated-with-risk-of` → **intrakraniel-bloedning**
  - Evidence: "Supplerende analyser 6: Intrakraniel blødning" (Page 74) [^src5]
- **landspatientregisteret** → `is-source-for` → **intrakraniel-bloedning**
  - Evidence: "Prævalente patienter med atrieflimren, der
udvikler intrakraniel blødning i opgørelses
perioden" (Page 74) [^src5]
- **di60** → `identifies-condition` → **intrakraniel-bloedning**
  - Evidence: "DI60 (subaraknoidal blødning)" (Page 107) [^src7]
- **di61** → `identifies-condition` → **intrakraniel-bloedning**
  - Evidence: "DI61 (hjerneblødning)" (Page 107) [^src7]
- **di62** → `identifies-condition` → **intrakraniel-bloedning**
  - Evidence: "DI62 (andre ikke-traumatiske
intrakranielle blødninger)" (Page 107) [^src7]
- **ds064** → `identifies-condition` → **intrakraniel-bloedning**
  - Evidence: "DS064 (traumatisk epidural blødning)" (Page 107) [^src7]
- **ds065** → `identifies-condition` → **intrakraniel-bloedning**
  - Evidence: "DS065 (traumatisk subdural blødning)" (Page 107) [^src7]
- **ds066** → `identifies-condition` → **intrakraniel-bloedning**
  - Evidence: "DS066 (traumatisk subarachnoidal
blødning)" (Page 107) [^src7]

## Claims

### clinical-outcome
- Andelen af nydiagnosticerede patienter med atrieflimren, som får intrakraniel blødning inden for 1 år, var 0,7 % i Danmark i perioden 01.07.2021–30.06.2022 [^src1]
- Indikator 13: Andelen af nydiagnosticerede atrieflimren-patienter, der får intrakraniel blødning inden for 1 år, var 0,8 % i Danmark for perioden 01.07.2022–30.06.2023 (95 % CI: 0,7–0,9) [^src1]

### epidemiological
- I Danmark udgjorde antallet af prævalente atrieflimren-patienter med intrakraniel blødning 711 ud af 134.710 patienter, hvilket svarer til 0,53 % [^src1]
- I den aktuelle opgørelsesperiode (01.07.2023 - 30.06.2024) blev 0,5% af de prævalente patienter med atrieflimren indlagt med intrakraniel blødning [^src1]
- Prævalente atrieflimren-patienter, der udvikler intrakraniel blødning i opgørelsesperioden: 0,53 % (733 ud af 136357) [^src1]

### clinical-risk-distribution
- Blandt prævalente atrieflimren-patienter med intrakraniel blødning i Danmark havde 36,7 % en CHA2DS2-VASc-score på 1 [^src1]
- 41,1% af intrakranielle blødninger optrådte blandt patienter med en CHA2DS2-VASc score på 0 eller 1 [^src1]

### pharmacovigilance
- For patienter med atrieflimren, der modtog NOAC-behandling, var andelen af intrakraniel blødning 0,52 % [^src1]
- For patienter med atrieflimren, der modtog Marevan-behandling, var andelen af intrakraniel blødning 0,46 % [^src1]
- Andelen af patienter med intrakraniel blødning er 0,53% for DOAC og 0,82% for marevan [^src1]

### quality-standard
- Indikator 6 har standarden ≤ 0,6 % for incidensen af intrakraniel blødning blandt prævalente patienter med atrieflimren [^src1]
- Indikator 7 har ingen angivet standard, men rapporterer incidensen af alvorlig blødning (tillempede ISTH-kriterier) blandt prævalente patienter med atrieflimren [^src1]

### incidence-rate
- På landsplan udvikler 0,8% af den incidente population intrakraniel blødning 1 år efter diagnosen atrieflimren er stillet [^src1]

## Timeline
- **01.07.2022–30.06.2023**: Opgørelsesperiode for Indikator 14 (iskæmisk apopleksi) og Indikator 13 (intrakraniel blødning) [^src5]

## Sources

[^src1]: AFDK_2023.pdf, pages 96-100
[^src2]: AFDK_2024.pdf, pages 6-10
[^src3]: AFDK_2024.pdf, pages 46-50
[^src4]: AFDK_2024.pdf, pages 51-55
[^src5]: AFDK_2024.pdf, pages 71-75
[^src6]: AFDK_2024.pdf, pages 56-60
[^src7]: AFDK_2024.pdf, pages 106-110
