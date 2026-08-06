---
title: Hospitalsenhed Midt
type: entity
aliases:
  - Hospitalsenhed Midt
wiki: rkkp-afdk
updated: '2026-08-05T19:50:59.906Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '111-115, 16-20, 31-35, 36-40, 41-45, 6-10, 71-75, 76-80'
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 66-70
tags:
  - organization
---
Hospitalsenhed Midt is a hospital unit located in [[region-midtjylland|Region Midtjylland]], Denmark. It plays a significant role in the national monitoring of cardiovascular healthcare quality, frequently appearing in the annual reports of the Danish Atrial Fibrillation Database (AFDK) published by the Regions' Clinical Quality Development Programme (RKKP). The unit is noted for meeting national clinical standards across several quality indicators and is recognized for its systematic approach to patient care and education.

In the reporting period from July 1, 2022, to June 30, 2023, Hospitalsenhed Midt demonstrated strong clinical performance. For [[indikator-2|Indikator 2]], which measures the execution of echocardiography in newly diagnosed atrial fibrillation patients, the unit achieved a compliance rate of 91.9% (95% CI: 90.0–93.5), successfully meeting the national standard [^src2]. Similarly, for [[indikator-4a|Indikator 4a]], which tracks anticoagulation treatment coverage, the hospital unit recorded a treatment rate of 92.3% (95% CI: 89.4–94.7) during the same period [^src3]. The unit also fulfilled specific standards alongside other hospitals like Slagelse Sygehus and Næstved Sygehus [^src7], and was evaluated for indicators concerning severe bleeding (Indikator 7) and structured patient education (Indikator 8) [^src6]. Furthermore, the unit reported a low incidence of heart failure following atrial fibrillation, with 61 out of 1,282 patients (4.8%) affected [^src8].

Beyond quantitative metrics, Hospitalsenhed Midt is recognized for its organizational practices in patient education. The cardiology department at the unit has worked systematically with patient training, yielding positive results [^src9]. A key component of this effort is the interdisciplinary [[atrieflimren-klinik|Atrieflimren-klinik]], which was established at Hospitalsenhed Midt in 2012 [^src9]. Since its inception, the clinic has maintained a continuous focus on educating patients and their relatives about atrial fibrillation [^src9]. The unit's clinical and educational efforts are represented by medical professionals such as Lars Frost, Overlæge, dr. med. [^src9].

## Mentions

- Page 10: "Hospitalsenhed Midt Ja 609 / 636 0 (0) 95,8 (93,9-97,2) 639 / 684 93,4 93,5" [^src1]
- Page 17: "Hospitalsenhed Midt Ja 916 / 997 0 (0) 91,9 (90,0-93,5) 1.170 / 1.288 90,8 88,5" [^src2]
- Page 31: "Hospitalsenhed Midt Ja 398 / 431 0 (0) 92,3 (89,4-94,7) 483 / 535 90,3 90,4" [^src3]
- Page 37: "Hospitalsenhed Midt Ja 313 / 346 0 (0) 90,5 (86,9-93,3) 472 / 527 89,6 91,7" [^src4]
- Page 43: "Hospitalsenhed Midt Nej 218 / 247 0 (0) 88,3 (83,6-92,0) 315 / 345 91,3" [^src5]
- Page 74: "Hospitalsenhed Midt Ja 730 / 1.172 0 (0) 62,3 (59,4-65,1) 667 / 1.077 61,9 55,0" [^src6]
- Page 79: "Standarden er opfyldt på Slagelse Sygehus og Hospitalsenhed Midt samt Næstved Sygehus der dog har et meget lille patientgrundlag (20 patienter)." [^src7]
- Page 111: "Hospitalsenhed Midt 61 / 1.282 0 (0) 4,8 (3,7-6,1) 81 / 1.179 6,9 7,5" [^src8]
- Page 66: "Her beskriver Hjertesygdomme på Hospitalsenhed Midt hvordan de har arbejdet systematisk med patientuddannelse/undervisning og opnået gode resultater." [^src9]
- Page 66: "Siden etableringen af vores tværfaglige Atrieflimren-klinik i 2012 har vi haft vedvarende fokus på uddannelse af patienten og deres pårørende." [^src9]
- Page 70: "Lars Frost, Overlæge, dr. med., Hospitalsenhed Midt" [^src9]

## Relationships

**Outgoing**
- Subject: hospitalsenhed-midt
  Predicate: is-part-of
  Object: region-midtjylland
  Evidence: "Hospitalsenhed Midt er en hospitalsenhed i Region Midtjylland"
  Page: 31 [^src3]
- Subject: hospitalsenhed-midt
  Predicate: hosts
  Object: atrieflimren-klinik
  Evidence: "Siden etableringen af vores tværfaglige Atrieflimren-klinik i 2012"
  Page: 66 [^src9]

**Incoming**
- Subject: indikator-2
  Predicate: measures
  Object: hospitalsenhed-midt
  Evidence: "Hospitalsenhed Midt er en af de institutioner, der rapporteres i tabellen for Indikator 2."
  Page: 17 [^src2]
- Subject: region-midtjylland
  Predicate: contains-hospital
  Object: hospitalsenhed-midt
  Evidence: "Midtjylland Nej [...] Hospitalsenhed Midt Nej [...]"
  Page: 43 [^src5]
- Subject: region-midtjylland
  Predicate: contains-hospital
  Object: hospitalsenhed-midt
  Evidence: "Midtjylland [...] Hospitalsenhed Midt 61 / 1.282..."
  Page: 111 [^src8]

## Claims

**Clinical**
- Hospitalsenhed Midt opfyldte Indikator 2 hos 91,9 % (95 % CI: 90,0–93,5) af nydiagnosticerede patienter med atrieflimren i perioden 1. juli 2022 – 30. juni 2023 [^src1] (hospitalsenhed-midt, indikator-2)
- For Hospitalsenhed Midt var andelen af patienter, der modtog behandling, 92,3 % (95 % CI: 89,4–94,7) i perioden 1. juli 2022 – 30. juni 2023 [^src1] (hospitalsenhed-midt, indikator-4a)

**Organizational-practice**
- Siden etableringen af vores tværfaglige Atrieflimren-klinik i 2012 har vi haft vedvarende fokus på uddannelse af patienten og deres pårørende [^src1] (atrieflimren-klinik, hospitalsenhed-midt)

## Timeline

- 2012: Etablering af tværfaglig Atrieflimren-klinik ved Hospitalsenhed Midt (atrieflimren-klinik, hospitalsenhed-midt) [^src9]

## Sources

[^src1]: AFDK_2023.pdf, pages 6-10
[^src2]: AFDK_2023.pdf, pages 16-20
[^src3]: AFDK_2023.pdf, pages 31-35
[^src4]: AFDK_2023.pdf, pages 36-40
[^src5]: AFDK_2023.pdf, pages 41-45
[^src6]: AFDK_2023.pdf, pages 71-75
[^src7]: AFDK_2023.pdf, pages 76-80
[^src8]: AFDK_2023.pdf, pages 111-115
[^src9]: AFDK_2024.pdf, pages 66-70
