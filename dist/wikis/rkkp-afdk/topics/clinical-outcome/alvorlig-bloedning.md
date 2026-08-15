---
title: Alvorlig blødning
type: entity
aliases:
  - Alvorlig blødning
wiki: rkkp-afdk
updated: '2026-08-14T21:13:08.533Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '106-110, 56-60'
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: '46-50, 71-75, 91-95'
tags:
  - clinical-condition
---
# Alvorlig blødning

**Alvorlig blødning** (severe bleeding) is a critical clinical condition and the primary outcome variable for Indicator 7 in the Danish national quality assurance program for atrial fibrillation, managed under the [[regionernes-kliniske-kvalitetsudviklingsprogram|Regionernes Kliniske Kvalitetsudviklingsprogram]]. It serves as a central metric for evaluating the safety of [[antikoagulationsbehandling|anticoagulation therapy]] among [[praevalente-patienter-med-atrieflimren|prevalent patients with atrial fibrillation]]. 

In this context, severe bleeding is specifically defined using adapted criteria from the [[international-society-of-thrombosis-and-hemostasis|International Society of Thrombosis and Hemostasis]] (ISTH) [^src5]. The condition encompasses [[intrakraniel-bloedning|intracranial bleeding]], gastrointestinal bleeding, urinary tract bleeding, and pulmonary bleeding [^src1]. These events are systematically identified through the Danish National Patient Register (Landspatientregisteret) using a comprehensive set of ICD-10 diagnosis codes, ranging from gastric ulcers (e.g., [[dk25-0|DK25.0]]) to hematemesis ([[dk92-0|DK92.0]]) and airway bleeding ([[dr04|DR04]]) [^src4].

Epidemiological data from the annual "Atrial Fibrillation in Denmark" (AFDK) reports highlight the clinical burden and pharmacovigilance implications of this condition. Across the reporting periods, approximately 2.2% to 2.22% of prevalent patients with [[atrieflimren|atrial fibrillation]] were admitted to the hospital with a severe bleeding event [^src1] [^src3]. Notably, 43.7% of these bleeding events occurred in patients with a low stroke risk profile, indicated by a [[cha2ds2-vasc|CHA2DS2-VASc]] score of 0 or 1 [^src1]. 

The data also provides comparative insights into the safety profiles of different anticoagulants. The incidence of severe bleeding was compared between patients treated with [[doac|DOACs]] (Direct Oral Anticoagulants) and [[marevan|Marevan]] (warfarin). In the 2024 report, the rates were 2.30% for DOAC and 2.38% for Marevan [^src1], while the 2025 report noted rates of 2.40% for DOAC and 2.54% for Marevan [^src2]. Furthermore, patients receiving a combination of both DOAC and Marevan exhibited a significantly higher bleeding rate of 4.68%, whereas those without any anticoagulation therapy had a rate of 1.37% [^src3]. Geographically, the incidence of severe bleeding showed slight variations across Danish [[regioner|regions]] (between 1.9% and 2.3%) and [[sundhedsklynger|health clusters]] (between 1.9% and 2.7%) [^src1] [^src2].

## Mentions

- Page 60: "Alvorlige blødninger defineres som intrakranielle blødninger, gastrointestinale blødninger, urinvejsblødninger og blødninger fra lungerne." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 56-60)
- Page 46: "Indikator 7: Incidens alvorlig blødning" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 46-50)
- Page 50: "Større blødning er defineret som en akut indlæggelse med blødning og er identificeret via data fra Landspatientregistret. Alvorlige blødninger defineres som intrakranielle blødninger, gastrointestinale blødninger, urinvejsblødninger og blødninger fra lungerne." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 46-50)
- Page 71: "Alvorlig blødning" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 71-75)

## Relationships

### Outgoing

- Subject: alvorlig-bloedning
  Predicate: includes-subtype
  Object: intrakraniel-bloedning
  Evidence: "Alvorlige blødninger defineres som intrakranielle blødninger, gastrointestinale blødninger, urinvejsblødninger og blødninger fra lungerne."
  Page: 60
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 56-60
- Subject: alvorlig-bloedning
  Predicate: includes-subtype
  Object: iskaemisk-apopleksi
  Evidence: "Alvorlige blødninger defineres som intrakranielle blødninger, gastrointestinale blødninger, urinvejsblødninger og blødninger fra lungerne."
  Page: 60
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 56-60
- Subject: alvorlig-bloedning
  Predicate: is-complication-of
  Object: antikoagulationsbehandling
  Evidence: "Alvorlig blødning"
  Page: 71
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 71-75

### Incoming

- Subject: international-society-of-thrombosis-and-hemostasis
  Predicate: provides-criteria-for
  Object: (this entity)
  Evidence: "tillempede International Sociaty of
Thrombosis and
Hemostasis (ISTH)
kriterier"
  Page: 107
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 106-110
- Subject: dk25-0
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK25.0 (akut mavesår med blødning)"
  Page: 94
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dk25-2
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK25.2 (akut mavesår med blødning og perforation)"
  Page: 94
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dk25-4
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK25.4 (kronisk eller ikke specificeret mavesår med blødning)"
  Page: 94
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dk25-6
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK25.6 (kronisk eller ikke specificeret mavesår med blødning og perforation)"
  Page: 94
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dk26-0
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK26.0 (akut duodenalulcus med blødning)"
  Page: 94
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dk26-2
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK26.2 (akut duodenalulcus med blødning og perforation)"
  Page: 94
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dk26-4
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK26.4 (kronisk eller ikke specificeret duodenalulcus med blødning)"
  Page: 94
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dk26-6
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK26.6 (kronisk eller ikke specificeret duodenalulcus med blødning og perforation)"
  Page: 94
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dk27-0
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK27.0 (akut gastroduodenalt ulcus med blødning)"
  Page: 94
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dk27-2
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK27.2 (akut gastroduodenalt ulcus med blødning og perforation)"
  Page: 94
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dk27-4
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK27.4 (kronisk eller ikke specificeret gastroduodenalt ulcus med blødning)"
  Page: 95
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dk27-6
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK27.6 (kronisk eller ikke specificeret gastroduodenalt ulcus med blødning og perforation)"
  Page: 95
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dk28-0
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK28.0 (akut gastrointestinalt sår med blødning)"
  Page: 95
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dk28-2
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK28.2 (akut gastrointestinalt sår med blødning og perforation)"
  Page: 95
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dk28-4
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK28.4 (kronisk eller ikke specificeret gastrointestinalt sår med blødning)"
  Page: 95
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dk28-6
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK28.6 (kronisk eller ikke specificeret gastrointestinalt sår med blødning og perforation)"
  Page: 95
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dk29-0
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK29.0 (akut blødende gastritis)"
  Page: 95
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dk29-8a
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK29.8A (akut blødende duodenitis)"
  Page: 95
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dk92-0
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK92.0 (hæmatemese)"
  Page: 95
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dk92-1
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK92.1 (melæna)"
  Page: 95
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dk92-2
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DK92.2 (gastrointestinal blødning UNS)"
  Page: 95
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dj942
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DJ942 (hæmothorax)"
  Page: 95
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dn02
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DN02 (tilbagevendende og vedvarende blod I urinen)"
  Page: 95
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dr04
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DR04 (blødning fra luftveje)"
  Page: 95
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95
- Subject: dr31
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DR31 (blod i urinen uden nærmere specificering)"
  Page: 95
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95

## Claims

### epidemiological
- I alt blev 2,2% af de prævalente patienter med atrieflimren indlagt med alvorlig blødning i løbet af opgørelsesperioden [^src1] (praevalente-patienter-med-atrieflimren, alvorlig-bloedning)
  Type: epidemiological
  Page: 60
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 56-60
- På regionsniveau varierede andelen som blev indlagt med alvorlig blødning mellem 1,9-2,2% [^src1] (alvorlig-bloedning, regionernes-kliniske-kvalitetsudviklingsprogram)
  Type: epidemiological
  Page: 60
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 56-60
- 43,7% af blødningerne optrådte blandt patienter med en CHA2DS2-VASc score på 0 eller 1 [^src1] (cha2ds2-vasc, alvorlig-bloedning)
  Type: epidemiological
  Page: 60
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 56-60
- Andelen af patienter med alvorlig blødning 1 år efter diagnosedato (incidente patienter) er på landsplan 3,2% og varierer regionalt fra 2,8-3,8% [^src1] (alvorlig-bloedning, praevalente-patienter-med-atrieflimren)
  Type: epidemiological
  Page: 60
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 56-60
- I alt blev 2,2% af de prævalente patienter med atrieflimren indlagt med alvorlig blødning i løbet af opgørelsesperioden [^src1] (praevalente-patienter-med-atrieflimren, alvorlig-bloedning)
  Type: epidemiological
  Page: 50
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 46-50
- På regionsniveau varierede andelen som blev indlagt med alvorlig blødning mellem 2,1-2,3% [^src1] (regioner, alvorlig-bloedning)
  Type: epidemiological
  Page: 50
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 46-50
- På klyngeniveau varierede andelen med alvorlig blødning mellem 1,9-2,7% [^src1] (sundhedsklynger, alvorlig-bloedning)
  Type: epidemiological
  Page: 50
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 46-50

### pharmacovigilance
- Andelen af patienter med alvorlig blødning er 2,30% for DOAC og 2,38% for marevan [^src1] (doac, marevan, alvorlig-bloedning)
  Type: pharmacovigilance
  Page: 60
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 56-60

### comparative-result
- Andelen af patienter med alvorlig blødning er 2,40% for DOAC og 2,54% for marevan [^src1] (doac, marevan, alvorlig-bloedning)
  Type: comparative-result
  Page: 50
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 46-50

### incidence-rate
- Andelen af prævalente patienter med atrieflimren, som udvikler alvorlig blødning, er 2,22% på landsplan [^src1] (alvorlig-bloedning, praevalente-patienter-med-atrieflimren)
  Type: incidence-rate
  Page: 71
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 71-75
- Andelen af prævalente patienter med atrieflimren, som udvikler alvorlig blødning, er 2,40% blandt dem på AK-behandling [^src1] (alvorlig-bloedning, antikoagulationsbehandling)
  Type: incidence-rate
  Page: 71
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 71-75
- Andelen af prævalente patienter med atrieflimren, som udvikler alvorlig blødning, er 2,54% blandt dem på Marevan [^src1] (alvorlig-bloedning, marevan)
  Type: incidence-rate
  Page: 71
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 71-75
- Andelen af prævalente patienter med atrieflimren, som udvikler alvorlig blødning, er 4,68% blandt dem på både DOAC og Marevan [^src1] (alvorlig-bloedning, doac, marevan)
  Type: incidence-rate
  Page: 71
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 71-75
- Andelen af prævalente patienter med atrieflimren, som udvikler alvorlig blødning, er 1,37% blandt dem uden AK-behandling [^src1] (alvorlig-bloedning, praevalente-patienter-med-atrieflimren)
  Type: incidence-rate
  Page: 71
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 71-75

### quality-indicator
- Indikator 7: Incidens af alvorlig blødning (tillempede International Society of Thrombosis and Hemostasis (ISTH) kriterier) blandt prævalente patienter med atrieflimren [^src1] (alvorlig-bloedning, atrieflimren)
  Type: quality-indicator
  Page: 93
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95

## Timeline

(none)

## Sources

[^src1]: AFDK_2024.pdf, pages 56-60
[^src2]: AFDK_2025.pdf, pages 46-50
[^src3]: AFDK_2025.pdf, pages 71-75
[^src4]: AFDK_2025.pdf, pages 91-95
[^src5]: AFDK_2024.pdf, pages 106-110
