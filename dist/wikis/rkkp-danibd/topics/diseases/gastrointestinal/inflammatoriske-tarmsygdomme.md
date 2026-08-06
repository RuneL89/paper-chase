---
title: Inflammatoriske tarmsygdomme
type: entity
aliases:
  - Inflammatoriske tarmsygdomme
wiki: rkkp-danibd
updated: '2026-08-05T06:12:20.493Z'
sources:
  - file: wikis/rkkp-danibd/raw/DANIBD_2023.pdf
    pages: 1-5
  - file: wikis/rkkp-danibd/raw/DANIBD_2024.pdf
    pages: 1-5
tags:
  - topic
---
Inflammatory bowel disease (IBD), known in Danish as *Inflammatoriske tarmsygdomme*, is the primary medical disease area monitored by the [[dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme|Dansk Kvalitetsdatabase for Inflammatoriske Tarmsygdomme]] (DANIBD) [^src1]. It serves as the clinical and epidemiological framework for all data, quality indicators, and patient characteristics tracked in the national database's annual reports [^src1]. 

The condition encompasses several specific diagnoses and subtypes, most notably [[crohns-sygdom|Crohns sygdom]] (including post-operative follow-up) and [[colitis-ulcerosa|Colitis ulcerosa]] [^src1] [^src2]. Additionally, IBD is closely associated with specific comorbidities, such as [[psc|Primær skleroserende kolangitis (PSC)]], which requires specific clinical protocols like annual colonoscopies for affected patients [^src1] [^src2].

Epidemiologically, IBD affects a significant portion of the Danish population. The 2023 DANIBD report estimated that between 50,000 and 70,000 patients in Denmark live with IBD [^src1]. By the 2024 report, this estimate was refined to nearly 70,000 patients [^src2]. Despite this high prevalence, the 2023 report noted that almost 50% of these patients did not have contact with the healthcare system regarding their bowel disease during the reporting period [^src1].

The national database tracks hospital encounters for these patients across different age groups. For the period between October 1, 2022, and September 30, 2023, the annual report covered 740 children and young people alongside 32,641 adults with IBD [^src1]. During this same timeframe, 26% of the pediatric patients were newly diagnosed with the condition [^src1]. In the subsequent reporting period from October 1, 2023, to September 30, 2024, the database recorded 751 children and young people and 33,599 adults receiving hospital care for IBD [^src2].

## Mentions
- Page 1: "Dansk Kvalitetsdatabase for Inflammatoriske Tarmsygdomme" (source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 1-5) [^src1]
- Page 4: "behandling af patienter med inflammatoriske tarmsygdomme (IBD)" (source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 1-5) [^src1]
- Page 1: "inflammatoriske tarmsygdomme (IBD)" (source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 1-5) [^src2]
- Page 1: "patienter med inflammatorisk tarmsygdom" (source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 1-5) [^src2]

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: inflammatoriske-tarmsygdomme
  Predicate: includes-diagnosis
  Object: crohns-sygdom
  Evidence: "DK50* Crohns sygdom"
  Page: 5
  Source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 1-5 [^src1]
- Subject: inflammatoriske-tarmsygdomme
  Predicate: includes-diagnosis
  Object: colitis-ulcerosa
  Evidence: "DK51* Colitis ulcerosa"
  Page: 5
  Source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 1-5 [^src1]
- Subject: inflammatoriske-tarmsygdomme
  Predicate: associated-with-comorbidity
  Object: psc
  Evidence: "DK830F Primær skleroserende kolangitis1 # (1) # (0)"
  Page: 5
  Source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 1-5 [^src1]
- Subject: inflammatoriske-tarmsygdomme
  Predicate: includes-subtype
  Object: crohns-sygdom
  Evidence: "Post-operativ Crohns sygdom, opfølgning"
  Page: 1
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 1-5 [^src2]
- Subject: inflammatoriske-tarmsygdomme
  Predicate: includes-subtype
  Object: colitis-ulcerosa
  Evidence: "klinisk oplagt colitis ulcerosa"
  Page: 1
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 1-5 [^src2]

Incoming (this entity is the OBJECT of these relationships):
- Subject: psc
  Predicate: is-comorbidity-of
  Object: (this entity)
  Evidence: "Generelt får patienter med PSC foretaget koloskopi årligt"
  Page: 1
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 1-5 [^src2]

## Claims
- Dansk Kvalitetsdatabase for Inflammatoriske Tarmsygdomme (DANIBD), der gik i drift d. 1. oktober 2022, præsenterer hermed den første årsrapport, der monitorerer behandlingskvaliteten for patienter med inflammatoriske tarmsygdomme (IBD) [^src1] (dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme, inflammatoriske-tarmsygdomme)
  Type: operational
  Page: 4
  Source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 1-5
- Årsrapporten omfatter de 740 børn og unge samt 32.641 voksne med IBD, der er set på et af landets hospitaler i perioden 1. oktober 2022 til 30. september 2023 [^src1] (dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme, inflammatoriske-tarmsygdomme)
  Type: demographic
  Page: 4
  Source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 1-5
- Der er 50.-70.000 patienter i Danmark med IBD, og dermed har næsten 50% af patienterne ikke haft kontakt til sundhedsvæsenet med deres tarmsygdom i denne periode [^src1] (inflammatoriske-tarmsygdomme)
  Type: epidemiological
  Page: 4
  Source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 1-5
- 26 % af børnene er nydiagnosticerede med IBD i perioden [^src1] (inflammatoriske-tarmsygdomme)
  Type: diagnostic
  Page: 5
  Source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 1-5
- Årsrapporten omfatter de 751 børn og unge samt 33.599 voksne med IBD, der er set på et af landets hospitaler i perioden 1. oktober 2023 til 30. september 2024 [^src1] (dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme, inflammatoriske-tarmsygdomme)
  Type: demographic
  Page: 1
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 1-5
- Der vurderes, at der næsten er 70.000 patienter i Danmark med IBD [^src1] (inflammatoriske-tarmsygdomme)
  Type: epidemiological
  Page: 1
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 1-5

## Timeline
(none)

## Sources

[^src1]: DANIBD_2023.pdf, pages 1-5
[^src2]: DANIBD_2024.pdf, pages 1-5
