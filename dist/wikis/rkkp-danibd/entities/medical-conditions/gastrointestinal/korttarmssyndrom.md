---
title: korttarmssyndrom
type: entity
wiki: rkkp-danibd
updated: '2026-08-05T06:15:45.028Z'
sources:
  - file: wikis/rkkp-danibd/raw/DANIBD_2023.pdf
    pages: 6-10
  - file: wikis/rkkp-danibd/raw/DANIBD_2024.pdf
    pages: '36-40, 6-10'
tags:
  - medical-condition
---
Korttarmssyndrom (short bowel syndrome) is a rare medical complication associated with [[ibd|IBD]] (inflammatory bowel disease), a category of chronic conditions that includes [[crohns-sygdom|Crohns sygdom]] and [[colitis-ulcerosa|Colitis ulcerosa]]. In the Danish healthcare system, it is tracked using the specific diagnosis code DK912B. According to the annual reports from the [[dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme|Dansk Kvalitetsdatabase for Inflammatoriske Tarmsygdomme]] (DANIBD), korttarmssyndrom represents a very small fraction of the patient population, accounting for less than 1% of both newly diagnosed and prevalent adult IBD patients [^src2]. 

The condition plays a specific role in the epidemiological tracking and quality assurance of IBD care in Denmark. To be officially included in the DANIBD registry, patients must have at least two hospital contacts recorded in the [[landspatientregisteret|Landspatientregisteret]] with specific action diagnoses. Alongside codes for Crohn's disease, ulcerative colitis, and [[psc|Primær skleroserende kolangitis (PSC)]], the diagnosis code DK912B for korttarmssyndrom (when paired with a primary IBD diagnosis) serves as one of the qualifying criteria for database inclusion [^src3]. This ensures that even rare but severe complications of IBD are systematically monitored to evaluate the quality of care, treatment patterns, and patient outcomes across Danish hospitals [^src1].

## Mentions

* Page 6: "DK912B Korttarmssyndrom" [^src1]
* Page 7: "DK912B Korttarmssyndrom" [^src2]
* Page 36: "DK912B ‘Korttarmssyndrom’ med DK50* eller DK51* som b-diagnose" [^src3]

## Relationships

* **ibd** -> has-complication -> **korttarmssyndrom**
  * Evidence: "DK912B Korttarmssyndrom" (Page 6) [^src1]
* **dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme** -> includes-diagnosis -> **korttarmssyndrom**
  * Evidence: "Patienter med IBD skal have mindst to hospitalskontakter med følgende aktionsdiagnoser registreret i LPR: ▪ DK912B ‘Korttarmssyndrom’ med DK50* eller DK51* som b-diagnose" (Page 36) [^src3]

## Claims

* **eligibility-criteria**: DANIBD omfatter alle patienter med IBD i Danmark, der har mindst to hospitalskontakter med aktionsdiagnoser DK50*, DK51*, DK830F eller DK912B i Landspatientregisteret [^src1]

## Timeline

* No timeline events available.

## Sources

[^src1]: DANIBD_2023.pdf, pages 6-10
[^src2]: DANIBD_2024.pdf, pages 6-10
[^src3]: DANIBD_2024.pdf, pages 36-40
