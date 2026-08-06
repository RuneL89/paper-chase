---
title: IBD
type: entity
wiki: rkkp-danibd
updated: '2026-08-05T06:19:18.600Z'
sources:
  - file: wikis/rkkp-danibd/raw/DANIBD_2023.pdf
    pages: '16-20, 26-29, 6-10'
  - file: wikis/rkkp-danibd/raw/DANIBD_2024.pdf
    pages: '21-25, 41-45, 6-10'
tags:
  - medical-condition
---
**IBD** (Inflammatory Bowel Disease) is the overarching diagnostic category for chronic inflammatory bowel diseases in Denmark, primarily encompassing the two main forms: [[colitis-ulcerosa|Colitis ulcerosa]] ([[uc|uc]]) and [[crohns-sygdom|Crohns sygdom]] ([[cd|cd]]) [^src2]. It also includes associated conditions and complications such as [[psc|Primær skleroserende kolangitis (PSC)]] and [[korttarmssyndrom|korttarmssyndrom]] [^src1]. IBD affects approximately 70,000 Danes, representing about 1% of the national population [^src2]. Because of the condition's prevalence and complexity, the [[dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme|Dansk Kvalitetsdatabase for Inflammatoriske Tarmsygdomme]] (DANIBD) was established to maintain a national register, monitor treatment quality, and track outcomes for all IBD patients treated at public Danish hospitals [^src2], [^src4].

### Epidemiology and Demographics
The national registry tracks extensive epidemiological data on IBD patients. Between October 1, 2022, and September 30, 2023, 32,641 adults with IBD were in contact with a hospital department, with 7% being newly diagnosed [^src1]. In the subsequent reporting period (October 1, 2023, to September 30, 2024), 34,350 patients had hospital contacts, including 32,641 adults and 751 children and adolescents [^src4]. Among newly diagnosed adults, ulcerative colitis is the most common diagnosis (58%), and the median age at diagnosis is 39 years [^src1], [^src4]. Conversely, among newly diagnosed children, Crohn's disease is the most frequent (64%), predominantly affecting boys (53%), with the vast majority (89%) diagnosed between the ages of 10 and 17 [^src4]. Overall, the median age for prevalent adult IBD patients is 49 years, and 54% are women [^src1]. Demographic variables, such as age at diagnosis, are often categorized according to the [[montreal|Montreal]] classification [^src1].

### Treatment and Quality Monitoring
Management of IBD involves various medical and surgical interventions. [[bmsl|Biologiske og målrettede syntetiske lægemidler]] (BMSL) are utilized for patients with moderate to severe disease activity [^src1], [^src5], while glucocorticosteroids are used when disease activity flares [^src5]. To ensure high standards of care, DANIBD tracks several quality indicators. For instance, national guidelines recommend that patients over 50 receiving steroid treatments undergo a [[dexa-scanning|DEXA-scanning]] to prevent osteoporosis, with a development target of at least 80% compliance [^src5]. Another key indicator measures the annual monitoring of the biomarker [[calprotectin|calprotectin]] for patients on BMSL; nationally, 78% of these patients had their fecal calprotectin measured at least once during the 2022–2023 period [^src1]. 

Specific national metrics, such as [[indikator-1a|Indikator 1a]] for diagnostic workups [^src4], [[indikator-5|Indikator 5]] for BMSL treatments [^src6], and [[indikator-6|Indikator 6]] for surgical procedures [^src6], are used to benchmark regional care. Surgical interventions are closely monitored, with a national re-operation rate within 30 days of 4% [^src1]. At a regional level, innovative monitoring approaches are employed; for example, [[nordsjaellands-hospital|Nordsjællands Hospital]] monitors approximately 85–90% of its IBD patients using the [[constant-care|Constant – Care]] app [^src3]. To be included in the DANIBD registry, patients must have at least two hospital contacts recorded in the [[landspatientregisteret|Landspatientregisteret]] with specific action diagnoses related to Crohn's disease, ulcerative colitis, short bowel syndrome, or PSC [^src2].

***

## Mentions

- Page 6: "voksne med IBD" [^src1]
- Page 6: "nydiagnosticerede med IBD" [^src1]
- Page 7: "patienter med IBD" [^src1]
- Page 9: "patienter med IBD i behandling med BMSL" [^src1]
- Page 9: "patienter med IBD i medicinsk behandling med BMSL" [^src1]
- Page 16: "Resultat af indikator 7 med konfidensinterval på lands- og afdelingsniveau for aktuelle opgørelsesperiode" [^src2]
- Page 17: "I alt 325 patienter har været kontrolleret for PSC og IBD i perioden" [^src2]
- Page 18: "Kronisk inflammatorisk tarmsygdom (inflammatory bowel disease, IBD) dækker over to hovedformer, colitis ulcerosa (UC) og Crohns sygdom (CD)." [^src2]
- Page 19: "DANIBD omfatter patienter med IBD behandlet på et offentligt dansk hospital." [^src2]
- Page 26: "patienter med IBD" [^src3]
- Page 27: "patienter med IBD" [^src3]
- Page 6: "Patienter med IBD i DANIBD" [^src4]
- Page 21: "Når der opstår aktivitet i sygdommen hos patienter med IBD, kan der behandles med glukokortikosteroid (steroid)." [^src5]

## Relationships

**Outgoing**
- Subject: ibd | Predicate: has-subtype | Object: crohns-sygdom | Evidence: "DK50* Crohns sygdom" | Page: 6 [^src1]
- Subject: ibd | Predicate: has-subtype | Object: colitis-ulcerosa | Evidence: "DK51* colitis ulcerosa" | Page: 6 [^src1]
- Subject: ibd | Predicate: has-associated-condition | Object: psc | Evidence: "DK830F Primær skleroserende kolangitis" | Page: 6 [^src1]
- Subject: ibd | Predicate: has-complication | Object: korttarmssyndrom | Evidence: "DK912B Korttarmssyndrom" | Page: 6 [^src1]
- Subject: ibd | Predicate: includes-subtype | Object: uc | Evidence: "Kronisk inflammatorisk tarmsygdom (inflammatory bowel disease, IBD) dækker over to hovedformer, colitis ulcerosa (UC) og Crohns sygdom (CD)." | Page: 18 [^src2]
- Subject: ibd | Predicate: includes-subtype | Object: cd | Evidence: "Kronisk inflammatorisk tarmsygdom (inflammatory bowel disease, IBD) dækker over to hovedformer, colitis ulcerosa (UC) og Crohns sygdom (CD)." | Page: 18 [^src2]
- Subject: ibd | Predicate: includes-diagnosis | Object: crohns-sygdom | Evidence: "Crohns sygdom er en form for IBD" | Page: 21 [^src5]

**Incoming**
- Subject: dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme | Predicate: maintains-register-for | Object: ibd | Evidence: "DANIBD er det danske nationalt register for patienter med inflammatorisk tarmsygdom (IBD)" | Page: 6 [^src1]
- Subject: bmsl | Predicate: is-treatment-for | Object: ibd | Evidence: "Biologiske og målrettede syntetiske lægemidler (BMSL) anvendes i behandlingen af patienter med moderat til svær sygdomsaktivitet" | Page: 9 [^src1]
- Subject: calprotectin | Predicate: monitors | Object: ibd | Evidence: "Biomarkøren calprotectin afspejler graden af inflammatorisk aktivitet i tarmmukosa" | Page: 9 [^src1]
- Subject: montreal | Predicate: classifies | Object: ibd | Evidence: "alder opgjort ift. Montreal for samtlige patienter" | Page: 6 [^src1]
- Subject: dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme | Predicate: maintains-register-for | Object: ibd | Evidence: "Appendikstabel 5. Typer af kirurgiske indgreb foretaget på patienter med IBD" | Page: 26 [^src3]
- Subject: dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme | Predicate: monitors | Object: ibd | Evidence: "DANIBD’s start den 1. oktober 2022 har 40.083 patienter haft en kontakt til et hospital grundet IBD" | Page: 6 [^src4]
- Subject: dexa-scanning | Predicate: is-recommended-for | Object: ibd | Evidence: "Den danske endokrinologiske behandlingsvejledning anbefaler, at DEXA bør foretages ved planlagt systemisk behandling med steroid i 3 måneder." | Page: 21 [^src5]
- Subject: calprotectin | Predicate: is-biomarker-for | Object: ibd | Evidence: "Biomarkøren calprotectin afspejler graden af inflammatorisk aktivitet i tarmmukosa." | Page: 21 [^src5]
- Subject: bmsl | Predicate: is-treatment-for | Object: ibd | Evidence: "Biologiske og målrettede syntetiske lægemidler (BMSL) anvendes i behandlingen af patienter med moderat til svær sygdomsaktivitet." | Page: 21 [^src5]
- Subject: indikator-5 | Predicate: measures-treatment-of | Object: ibd | Evidence: "Appendikstabel 5. Type og antal behandlinger med BMSL (indikator 5)" | Page: 43 [^src6]
- Subject: indikator-6 | Predicate: measures-surgery-on | Object: ibd | Evidence: "Appendikstabel 6. Typer af kirurgiske indgreb foretaget på patienter med IBD (indikator 6)" | Page: 44 [^src6]

## Claims

**Epidemiological**
- Fra 1. oktober 2022 til og med 30. september 2023 har 32.641 voksne med IBD været i kontakt med en hospitalsafdeling [^src1]
- 7 % af de voksne med IBD er nydiagnosticerede [^src1]
- 58 % af de nydiagnosticerede voksne har colitis ulcerosa [^src1]
- I alt 325 patienter har været kontrolleret for PSC og IBD i perioden, hvoraf 35 er nydiagnosticerede [^src1]
- IBD påvirker ca. 70.000 danskere, svarende til ca. 1% af befolkningen [^src2]
- Siden DANIBD’s start den 1. oktober 2022 har 40.083 patienter haft en kontakt til et hospital grundet IBD [^src1]
- I denne årsrapportperiode fra 1. oktober 2023 til og med 30. september 2024 har 34.350 patienter været i kontakt med et af landets hospitaler [^src1]
- I denne årsrapportperiode fra 1. oktober 2023 til og med 30. september 2024 har 751 børn og unge med IBD været i kontakt med en hospitalsafdeling, hvoraf 27 % af børnene er nydiagnosticerede med IBD i perioden [^src1]
- De nydiagnosticerede børn har oftest Crohns sygdom (64 %), er hyppigst drenge (53 %) og hovedparten bliver diagnosticeret i aldersgruppen 10–17 år (89 %) [^src1]
- I alt 32.641 voksne med IBD har været i kontakt med en hospitalsafdeling fra 1. oktober 2023 til og med 30. september 2024 [^src1]
- Heraf er 7 % nydiagnosticerede med IBD, hvoraf flest blev diagnosticeret med colitis ulcerosa (58 %) og halvdelen blev diagnosticeret før de fyldte 40 år (median: 39 år) [^src1]

**Demographic**
- 50 % af de nydiagnosticerede voksne er i alderen 18–39 år [^src1]
- Medianalderen for nydiagnosticerede voksne er 39 år [^src1]
- Medianalderen for prævalente voksne med IBD er 49 år [^src1]
- 54 % af de prævalente voksne med IBD er kvinder [^src1]

**Quality-indicator**
- Andelen af patienter med IBD i behandling med BMSL, der får målt F-calpro mindst én gang årligt, er 78 % (95 % CI: 77–79) på landsplan for perioden 1. oktober 2022 til 30. september 2023 [^src1]
- Andelen af kirurgiske indgreb, hvor der er foretaget re-operation inden for 30 dage, er 4 % (95 % CI: 2–5) [^src1]
- Indikator 1a: Andelen af nydiagnosticerede voksne med IBD, der har fået foretaget relevant udredning, er 79 % (95 % CI: 77–81) for Danmark i perioden 01.10.2022–30.09.2023 [^src1]

**Systemic-observation**
- Der findes i dag ingen præcise tværregionale og uafhængige opgørelser over monitoreringen af behandlingen af IBD og vigtige associerede outcomes [^src2]

**Coverage**
- DANIBD omfatter alle patienter med IBD i Danmark [^src3]

**Eligibility-criteria**
- Patienter med IBD skal have mindst to hospitalskontakter med følgende aktionsdiagnoser registreret i LPR: DK50* ‘Crohns sygdom’, DK51* ‘Ulcerøs colitis’, DK912B ‘Korttarmssyndrom’ med DK50*/DK51* som b-diagnose, eller DK830F ‘Primær skleroserende kolangitis’ [^src3]

**Statistical**
- Appendikstabel 5 viser antal og procent for 27 typer af kirurgiske indgreb foretaget på patienter med IBD i perioden 1/10/2022–30/09/2023, hvoraf 'KJFH11 - Laparoskopisk kolektomi og ileostomi' er det hyppigste med 152 procedurer (16,6 %) [^src1]
- Appendikstabel 6 viser antal og procent for re-operationer på patienter med IBD i samme periode, hvor 'KJFA58 - Endoskopisk dilatation af tyktarm' og 'KJFB00 - Tyndtarmsresektion' begge optræder 6 gange (21,4 % hver) [^src1]

**Operational**
- På Nordsjællands Hospital monitoreres ca. 85–90 % af IBD-patienterne via appen Constant – Care [^src1]

**Clinical-guideline**
- Målet for 'hvilende' IBD-patienter på NOH er én årlig calprotectin-måling, mens målingsrater for patienter i biologisk behandling er individualiserede [^src1]

**Quality-target**
- Udviklingsmålet for Indikator 4 er, at mindst 80 % af steroidkure givet til patienter over 50 år med IBD skal have foretaget DEXA-scanning [^src1]

**Treatment-statistic**
- Der er i opgørelsesperioden givet 917 steroidkure fordelt på 832 unikke patienter [^src1]

**Clinical-consensus**
- Der er generelt enighed om, at osteoporose ved steroidbehandling kan forebygges [^src1]

## Timeline

- 01.10.2022 - 30.09.2023: Opgørelsesperiode for Indikator 4 (DEXA-scanning, steroidbehandling) [^src5]

## Sources

[^src1]: DANIBD_2023.pdf, pages 6-10
[^src2]: DANIBD_2023.pdf, pages 16-20
[^src3]: DANIBD_2023.pdf, pages 26-29
[^src4]: DANIBD_2024.pdf, pages 6-10
[^src5]: DANIBD_2024.pdf, pages 21-25
[^src6]: DANIBD_2024.pdf, pages 41-45
