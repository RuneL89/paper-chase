---
title: Primær skleroserende kolangitis (PSC)
type: entity
aliases:
  - Primær skleroserende kolangitis (PSC)
  - primær skleroserende kolangitis
wiki: rkkp-danibd
updated: '2026-08-05T06:28:00.284Z'
sources:
  - file: wikis/rkkp-danibd/raw/DANIBD_2023.pdf
    pages: '1-5, 11-15, 16-20, 26-29, 6-10'
  - file: wikis/rkkp-danibd/raw/DANIBD_2024.pdf
    pages: '1-5, 31-35, 36-40, 6-10'
tags:
  - disease
---
Primary sclerosing cholangitis (PSC) is a chronic liver disease that is frequently associated with [[ibd|IBD]] [^src2]. Within the Danish healthcare system, the management and monitoring of PSC are critically important because patients with this condition face a significantly increased risk of developing [[kolorektalkraeft|colorectal cancer]] [^src8]. To mitigate this risk, there is strong evidence and broad international consensus recommending that all PSC patients undergo systematic annual follow-ups, typically involving a [[koloskopi|colonoscopy]] [^src6], [^src8].

In Denmark, the quality of care for PSC patients is tracked by the [[dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme|Danish Quality Database for Inflammatory Bowel Disease (DANIBD)]] [^src3]. Specifically, [[indikator-7|Indicator 7]] measures the proportion of PSC patients who receive a colonoscopy within an 18-month window, with a national development target of at least 80% compliance [^src8]. Patients are included in the DANIBD registry if they have specific action diagnoses recorded in the [[landspatientregisteret|National Patient Register]], including the PSC diagnosis code DK830F [^src9].

During the reporting period from October 1, 2022, to September 30, 2023, a total of 325 patients were monitored for PSC and IBD, with 35 newly diagnosed cases of PSC [^src2]. In this period, 85% of PSC patients received a colonoscopy within 18 months, successfully meeting the quality target [^src4]. Demographically, PSC patients in this cohort were predominantly male (67%) with an average age of 46 years [^src2].

In the subsequent period from October 1, 2023, to September 30, 2024, 345 patients were monitored, including 31 new diagnoses [^src8]. Nationally, 81% of PSC patients underwent a colonoscopy within the required 18-month timeframe, again fulfilling the ≥80% development goal [^src8]. All five Danish regions met this target, with regional compliance rates ranging from 79% to 85% [^src8]. The demographic profile remained consistent, with 68% of patients being male and the average age remaining at 46 years [^src8]. Despite these overall successes, the DANIBD steering group has noted with some concern that certain hospital departments report relatively few PSC patients, suggesting potential variations in diagnostic coding or patient registration [^src6].

## Mentions
- Page 15: "Indikatorens formål er at sikre systematisk opfølgning på patienter med primær skleroserende kolangitis (PSC), da studier har vist, at de er i en markant øget risiko for at udvikle kolorektalkræft." [^src1]
- Page 16: "Patienter med PSC defineres som patienter med PSC som a-diagnose med IBD som b-diagnose og omvendt, samt PSC som a-diagnose for patienter, der tidligere har haft minimum to IBD a-diagnoser." [^src2]
- Page 17: "I alt 325 patienter har været kontrolleret for PSC og IBD i perioden, hvoraf 35 er nydiagnosticerede." [^src2]
- Page 19: "DK830F ‘Primær skleroserende kolangitis’:" [^src2]
- Page 27: "patienter med PSC" [^src3]
- Page 27: "DK830F Primær skleroserende kolangitis" [^src3]
- Page 6: "DK830F Primær skleroserende kolangitis" [^src4]
- Page 7: "Indikator 7. PSC, opfølgning" [^src4]
- Page 5: "DK830F Primær skleroserende kolangitis1 # (1) # (0)" [^src5]
- Page 1: "Indikator 7. PSC, opfølgning" [^src5]
- Page 1: "Indikator 7. PSC, opfølgning" [^src6]
- Page 1: "Generelt får patienter med PSC foretaget koloskopi årligt, men styregruppen undrer sig over, at der er så relativt få patienter med PSC på visse afdelinger." [^src6]
- Page 6: "DK830F Primær skleroserende kolangitis" [^src7]
- Page 32: "Indikator 7. PSC, opfølgning" [^src8]
- Page 32: "patienter med primær skleroserende kolangitis (PSC)" [^src8]
- Page 32: "Patienter med PSC defineres som patienter med PSC som a-diagnose med IBD som b-diagnose og omvendt, samt PSC som a-diagnose for patienter, der tidligere har haft minimum to IBD a-diagnoser." [^src8]
- Page 36: "DK830F ‘Primær skleroserende kolangitis’" [^src9]

## Relationships
**Outgoing**
- Subject: psc | Predicate: is-comorbidity-of | Object: inflammatoriske-tarmsygdomme
  Evidence: "Generelt får patienter med PSC foretaget koloskopi årligt" [^src6]
- Subject: psc | Predicate: increases-risk-of | Object: kolorektalkraeft
  Evidence: "patienter med primær skleroserende kolangitis (PSC) også er i markant øget risiko for at udvikle kolorektalkræft." [^src8]

**Incoming**
- Subject: indikator-7 | Predicate: concerns | Object: (this entity)
  Evidence: "Indikator 7 er defineret som andelen af patienter med primær skleroserende kolangitis (PSC), der får koloskopi" [^src1]
- Subject: dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme | Predicate: maintains-register-for | Object: (this entity)
  Evidence: "Appendikstabel 7. Karakteristika for patienter med PSC" [^src3]
- Subject: ibd | Predicate: has-associated-condition | Object: (this entity)
  Evidence: "DK830F Primær skleroserende kolangitis" [^src4]
- Subject: inflammatoriske-tarmsygdomme | Predicate: associated-with-comorbidity | Object: (this entity)
  Evidence: "DK830F Primær skleroserende kolangitis1 # (1) # (0)" [^src5]
- Subject: indikator-7 | Predicate: concerns-follow-up-of | Object: (this entity)
  Evidence: "Indikator 7: PSC, opfølgning ≥ 80" [^src7]
- Subject: dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme | Predicate: includes-diagnosis | Object: (this entity)
  Evidence: "Patienter med IBD skal have mindst to hospitalskontakter med følgende aktionsdiagnoser registreret i LPR: ▪ DK830F ‘Primær skleroserende kolangitis’" [^src9]

## Claims
**Epidemiological**
- I alt 325 patienter har været kontrolleret for PSC og IBD i perioden, hvoraf 35 er nydiagnosticerede [^src1] (psc, ibd)
- Patienter med PSC er oftest mænd (67 %) og gennemsnitsalderen er 46 år [^src1] (psc)
- I perioden 01.10.2023 – 30.09.2024 blev 345 patienter kontrolleret for PSC, hvoraf 31 var nydiagnosticerede [^src1] (psc)

**Eligibility-criteria**
- Patienter med IBD skal have mindst to hospitalskontakter med følgende aktionsdiagnoser registreret i LPR: DK50* ‘Crohns sygdom’, DK51* ‘Ulcerøs colitis’, DK912B ‘Korttarmssyndrom’ med DK50*/DK51* som b-diagnose, eller DK830F ‘Primær skleroserende kolangitis’ [^src3] (ibd, psc, landspatientregisteret)
- DANIBD omfatter alle patienter med IBD i Danmark, der har mindst to hospitalskontakter med aktionsdiagnoser DK50*, DK51*, DK830F eller DK912B i Landspatientregisteret [^src1] (dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme, landspatientregisteret, crohns-sygdom, colitis-ulcerosa, psc, korttarmssyndrom)

**Statistical**
- Appendikstabel 7 viser, at der i perioden 1/10/2022–30/09/2023 blev diagnosticeret 35 nye tilfælde af PSC (DK830F), mens der var 213 prævalente PSC-patienter med hospitalskontakt i perioden [^src1] (dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme, psc)

**Quality-indicator**
- Andelen af patienter med primær skleroserende kolangitis, der får foretaget koloskopi inden for 18 måneder, er 85 % (95 % CI: 81–89) [^src1] (psc)
- Indikator 7: PSC, opfølgning, har en opfyldelse på 81 % (95 % CI: 77–85) i perioden 01.10.2023–30.09.2024 [^src1] (indikator-7, psc)
- Udviklingsmålet for Indikator 7 er, at 80 % af voksne patienter med PSC får foretaget systematisk opfølgning med koloskopi inden for 18 måneder [^src1] (indikator-7, psc, koloskopi)
- På landsplan har 81 % af patienterne med PSC fået foretaget en koloskopi inden for 18 måneder, hvilket opfylder udviklingsmålet på mindst 80 % [^src1] (indikator-7, psc, koloskopi)
- Alle fem regioner har et resultat for Indikator 7, der lever op til udviklingsmålet på mindst 80 %, med regional variation fra 79 % til 85 % [^src1] (indikator-7, psc)

**Demographic**
- Patienter med PSC er oftest mænd (68 %) og gennemsnitsalderen er 46 år [^src1] (psc)

**Clinical-practice**
- Der er stærk evidens for og bred international enighed om, at tilbyde alle patienter med PSC årlige systematiske opfølgninger [^src1] (psc)

## Timeline
- 01.10.2023 - 30.09.2024: Opgørelsesperiode for Indikator 7, hvor 345 patienter med PSC blev kontrolleret [^src8] (indikator-7, psc)

## Sources

[^src1]: DANIBD_2023.pdf, pages 11-15
[^src2]: DANIBD_2023.pdf, pages 16-20
[^src3]: DANIBD_2023.pdf, pages 26-29
[^src4]: DANIBD_2023.pdf, pages 6-10
[^src5]: DANIBD_2023.pdf, pages 1-5
[^src6]: DANIBD_2024.pdf, pages 1-5
[^src7]: DANIBD_2024.pdf, pages 6-10
[^src8]: DANIBD_2024.pdf, pages 31-35
[^src9]: DANIBD_2024.pdf, pages 36-40
