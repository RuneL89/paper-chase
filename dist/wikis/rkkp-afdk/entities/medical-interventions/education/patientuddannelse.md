---
title: Patientuddannelse
type: entity
aliases:
  - Patientundervisning
wiki: rkkp-afdk
updated: '2026-08-14T21:19:17.805Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '106-110, 96-100'
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: '1-5, 81-85, 86-90, 91-95'
tags:
  - clinical-intervention
---
```yaml
---
title: "Patientuddannelse"
type: clinical-intervention
wiki: rkkp-afdk
updated: "2026-07-17T10:00:00Z"
sources:
  - file: "wikis/rkkp-afdk/raw/AFDK_2024.pdf"
    pages: "96-100, 106-110"
  - file: "wikis/rkkp-afdk/raw/AFDK_2025.pdf"
    pages: "1-5, 81-85, 86-90, 91-95"
---
```

**Patientuddannelse** (patient education) is a structured, evidence-based clinical intervention designed to improve survival rates and reduce hospital readmissions among patients diagnosed with [[atrieflimren]] (AF) [^src1]. The primary goal of this intervention is to strengthen patients' self-care, competence, and self-determination, ultimately improving their health status and quality of life while equipping them with tools to manage a chronic illness [^src2]. According to a 2020 meta-analysis by [[palm-et-al-2020|Palm et al., 2020]], patient education yields a 22% reduction in mortality and readmissions compared to control groups receiving no education [^src2].

The intervention is heavily endorsed by major clinical authorities. The [[esc-guidelines|ESC guidelines]] recommend patient education for AF patients and their relatives as a central, integrated component of basic treatment [^src2]. Similarly, the 2019 Danish National Clinical Guideline by [[risom-2019|Risom, 2019]] strongly recommends that newly diagnosed AF patients participate in cardiac rehabilitation that includes patient education [^src2]. To standardize this, the [[abc-pathway|ABC Pathway]] informs the educational material, ensuring it aligns with contemporary European standards [^src1]. Furthermore, [[afdk-anbefaler|AFDK anbefaler]] that the education be tailored to the individual patient's situation and the format of the teaching (individual or group), covering specific information outlined in [[tabel-1|Tabel 1]] [^src1]. Effective methods primarily include individual and group sessions lasting 30 to 150 minutes, with follow-ups every 2 to 3 months over a period of up to 24 months [^src2].

In the Danish healthcare system, the delivery of this intervention is tracked via [[indikator-8|Indikator 8]], which measures the proportion of newly diagnosed AF patients who receive a structured educational program within the first year of their diagnosis [^src2]. The intervention is also coded in the national registers using [[bfkb|BFKB]] (Patient education in atrial fibrillation and atrial flutter) [^src6]. Despite its proven benefits and strong guideline recommendations, structured patient education is still provided to a limited extent in Denmark, highlighting a need for sharper focus on its implementation across the patient pathway [^src2].

## Mentions

- Page 97: "Indikator 8: Struktureret patientuddannelse" [^src1]
- Page 97: "patientuddannelse til patienter med atrieflimren (AF) og deres pårørende" [^src1]
- Page 97: "patientundervisning" [^src1]
- Page 97: "patientuddannelse/-undervisning til AFDK" [^src1]
- Page 100: "patientundervisningen bør indeholde informationer listet i nedenstående tabel" [^src1]
- Page 3: "Indikator 8: Patientuddannelse/undervisning" [^src2]
- Page 4: "Struktureret patientuddannelse ydes fortsat i begrænset omfang og der bør være skærpet opmærksomhed på implementeringen af denne vigtige del af patientforløbet" [^src2]
- Page 82: "11. Bilag – Struktureret Patientuddannelse" [^src3]
- Page 86: "AFDK anbefaler at patientundervisningen bør indeholde informationer listet i nedenstående tabel" [^src4]

## Relationships

- Subject: indikator-8
  Predicate: measures
  Object: (this entity)
  Evidence: "Indikator 8: Struktureret patientuddannelse"
  Page: 97
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 96-100 [^src1]
- Subject: abc-pathway
  Predicate: informs
  Object: (this entity)
  Evidence: "Det bør tilstræbes, på baggrund af AFDK’s anbefalinger, at patientundervisningsmaterialet tager udgangspunkt i ESC guidelines fra 2020 (Hindricks et al., 2021). Guidelines bygger på ”The ABC Pathway”"
  Page: 97
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 96-100 [^src1]
- Subject: esc-guidelines
  Predicate: recommends
  Object: (this entity)
  Evidence: "De europæiske guidelines fra ESC anbefaler patientuddannelse til patienter med atrieflimren (AF) og deres pårørende"
  Page: 97
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 96-100 [^src1]
- Subject: palm-et-al-2020
  Predicate: provides-evidence-for
  Object: (this entity)
  Evidence: "Meta-analysen indeholdt fem randomiseret interventions studier og et ikke-randomiseret interventionsstudie med i alt 2007 patienter og viste, til fordel for interventionsgruppen der modtog patientundervisning, en reduktion på død og genindlæggelse på 22%"
  Page: 97
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 96-100 [^src1]
- Subject: bfkb
  Predicate: codes-for
  Object: (this entity)
  Evidence: "BFKB (Patientuddannelse i
atrieflimren og atrieflagren)"
  Page: 109
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 106-110 [^src6]
- Subject: afdk-anbefaler
  Predicate: anbefaler-indhold-i
  Object: (this entity)
  Evidence: "AFDK anbefaler at patientundervisningen bør indeholde informationer listet i nedenstående tabel"
  Page: 86
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 86-90 [^src4]
- Subject: tabel-1
  Predicate: indeholder
  Object: (this entity)
  Evidence: "Tabel 1. AFDK anbefaler at patientundervisningen bør indeholde informationer listet i nedenstående tabel"
  Page: 86
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 86-90 [^src4]

## Claims

### clinical-outcome
- Meta-analysen indeholdt fem randomiseret interventions studier og et ikke-randomiseret interventionsstudie med i alt 2007 patienter og viste, til fordel for interventionsgruppen der modtog patientundervisning, en reduktion på død og genindlæggelse på 22% (Risk Ratio 0.78, CI 95% 0.63-0.97) i forhold til gruppen der ingen patientundervisning havde fået (Palm et al., 2020) [^src1]
- En meta-analyse (Palm et al., 2020) viser en reduktion på død og genindlæggelse på 22 % (Risk Ratio 0.78, CI 95% 0.63–0.97) for patienter, der modtog patientuddannelse, sammenlignet med kontrolgruppe uden uddannelse [^src2]

### definition
- Formålet med patientuddannelse er at styrke patienternes egenomsorg, handlekompetencer og selvbestemmelse, og hermed øge patienternes helbredsstatus og livskvalitet samt give dem redskaber til at leve livet med en kronisk sygdom (Risom, 2019) [^src2]

### procedural
- Ved datafangst måles andelen af ny-diagnosticerede patienter med atrieflimren, som får et struktureret undervisningsprogram inden for det 1. år efter at diagnosen er stillet [^src3]

### clinical-guideline
- ESC-guidelines fra 2024 anbefaler patientuddannelse til patienter med atrieflimren og deres pårørende som en central og integreret del af grundlæggende behandling [^src2]
- Den danske Nationale Kliniske Retningslinje fra 2019 giver en stærk anbefaling for, at patienter med ny atrieflimren-diagnose deltager i hjerterehabilitering indeholdende patientuddannelse [^src2]

### clinical-practice
- Patientuddannelse bør forankres i en teoretisk model og udføres i aktivt samarbejde mellem patient, pårørende og sundhedsprofessionelle [^src2]
- Effektive metoder til patientuddannelse inkluderer primært individuel undervisning og gruppeundervisning, med varighed mellem 30 og 150 minutter pr. gang og opfølgning 1–5 gange hver 2.–3. måned over op til 24 måneder [^src2]

### quality-indicator
- Indikator 8 måler andelen af ny-diagnosticerede patienter med atrieflimren, som får et struktureret undervisningsprogram inden for det 1. år efter diagnosen er stillet [^src2]
- Indikator 8: Andelen af nydiagnosticerede patienter med atrieflimren, som har fået et struktureret undervisningsprogram indenfor 1 år efter diagnosen er stillet [^src1]

### guideline-recommendation
- AFDK anbefaler at patientundervisningen bør indeholde informationer listet i nedenstående tabel tilpasset den enkelte patients situation og den form for undervisning man gennemfører (individuel, hold) [^src1]

## Timeline

- 2019: Risom udgiver den danske Nationale Kliniske Retningslinje for rehabilitering til patienter med atrieflimren med stærk anbefaling for patientuddannelse (risom-2019, atrieflimren, patientuddannelse) [^src1] [^src2]
- 2020: Palm et al. publicerer en meta-analyse, der viser 22% reduktion i død og genindlæggelse ved patientuddannelse for atrieflimren (palm-et-al-2020, patientuddannelse, atrieflimren) [^src1] [^src2]

## Sources

[^src1]: AFDK_2024.pdf, pages 96-100
[^src2]: AFDK_2025.pdf, pages 1-5
[^src3]: AFDK_2025.pdf, pages 81-85
[^src4]: AFDK_2025.pdf, pages 86-90
[^src5]: AFDK_2025.pdf, pages 91-95
[^src6]: AFDK_2024.pdf, pages 106-110
