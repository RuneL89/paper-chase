---
title: Vejle Sygehus
type: entity
aliases:
  - Vejle Sygehus
wiki: rkkp-afdk
updated: '2026-08-05T19:48:53.855Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '101-105, 111-115, 16-20, 21-25, 31-35, 36-40, 41-45, 6-10, 96-100'
tags:
  - organization
---
**Vejle Sygehus** is a hospital in Denmark that plays a notable role in the national monitoring of atrial fibrillation treatment quality, as tracked by the Danish Atrial Fibrillation Database (AFDK). Administratively, it is located within [[region-syddanmark|Region Syddanmark]] [^src8] and is closely linked to [[kolding-sygehus|Kolding Sygehus]], with both forming part of the broader [[sygehus-lillebaelt|Sygehus Lillebælt]] hospital group [^src3] [^src4].

A critical methodological caveat defines the reporting of Vejle Sygehus in the AFDK's 2022–2023 annual report (covering July 1, 2022, to June 30, 2023). The report explicitly notes that indicator results for Kolding Sygehus and Vejle Sygehus were not correctly distributed between the two units in the underlying data registries [^src3]. As a result, analysts and clinicians are instructed to interpret their performance data collectively as a single entity, Sygehus Lillebælt [^src4] [^src9].

Despite this data allocation issue, Vejle Sygehus is individually listed across multiple clinical quality indicators in the report. Most notably, the hospital met the national standard for [[indikator-2|Indikator 2]], which measures the performance of echocardiography in newly diagnosed atrial fibrillation patients, achieving a compliance rate of 91.5% (95% CI: 89.2–93.4) [^src2]. The hospital is also tracked for long-term anticoagulation treatment coverage (Indicator 4a), recording rates of 90.0% at two years post-diagnosis [^src5] and 90.1% at five years [^src6]. Furthermore, the facility's patient outcomes are monitored for severe complications, including ischemic stroke (Indicator 15) [^src7], intracranial bleeding (Indicator 14) [^src7], severe bleeding (Indicator 12), and one-year mortality (Indicator 13) [^src8]. 

Through these metrics, Vejle Sygehus remains a key subject in the Danish healthcare system's ongoing efforts to evaluate and improve cardiovascular care, even as data infrastructure challenges require aggregated reporting for the Sygehus Lillebælt network.

## Mentions

- Page 10: "Vejle Sygehus* Ja 497 / 528 0 (0) 94,1 (91,8-96,0) 508 / 553 91,9 91,3" [^src1]
- Page 16: "Vejle Sygehus* Ja 687 / 751 0 (0) 91,5 (89,2-93,4) 873 / 973 89,7 90,1" [^src2]
- Page 23: "Vejle Sygehus* Nej 682 / 914 0 (0) 74,6 (71,7-77,4) 724 / 973 74,4 72,3" [^src3]
- Page 24: "*Indikatorresultaterne for Kolding Sygehus og Vejle Sygehus er ikke fordelt korrekt imellem de to enheder og skal derfor fortolkes samlet som ét Sygehus Lillebælt" [^src3]
- Page 31: "*Indikatorresultaterne for Kolding Sygehus og Vejle Sygehus er ikke fordelt korrekt imellem de to enheder og skal derfor fortolkes samlet som ét Sygehus Lillebælt" [^src4]
- Page 36: "Vejle Sygehus* Ja 324 / 360 0 (0) 90,0 (86,4-92,9) 376 / 421 89,3 90,0" [^src5]
- Page 42: "Vejle Sygehus* Ja 201 / 223 0 (0) 90,1 (85,4-93,7) 260 / 296 87,8" [^src6]
- Page 96: "Vejle Sygehus* 6 / 967 0 (0) 0,6 (0,2-1,3) 7 / 1.065 0,7 0,7" [^src7]
- Page 99: "Vejle Sygehus* 7 / 967 0 (0) 0,7 (0,3-1,5) 9 / 1.065 0,8 0,5" [^src7]
- Page 102: "Vejle Sygehus* 30 / 967 0 (0) 3,1 (2,1-4,4) 37 / 1.065 3,5 2,2" [^src8]
- Page 104: "Vejle Sygehus* 101 / 967 0 (0) 10,4 (8,6-12,5) 113 / 1.065 10,6 10,1" [^src8]

## Relationships

### Outgoing

- **Subject:** vejle-sygehus
  **Predicate:** is-part-of
  **Object:** sygehus-lillebaelt
  **Evidence:** "Indikatorresultaterne for Kolding Sygehus og Vejle Sygehus er ikke fordelt korrekt imellem de to enheder og skal derfor fortolkes samlet som ét Sygehus Lillebælt"
  **Page:** 24
  **Source:** [^src3]

- **Subject:** vejle-sygehus
  **Predicate:** is-consolidated-with
  **Object:** kolding-sygehus
  **Evidence:** "Indikatorresultaterne for Kolding Sygehus og Vejle Sygehus er ikke fordelt korrekt imellem de to enheder og skal derfor fortolkes samlet som ét Sygehus Lillebælt"
  **Page:** 31
  **Source:** [^src4]

- **Subject:** vejle-sygehus
  **Predicate:** is-part-of
  **Object:** region-syddanmark
  **Evidence:** "Syddanmark 174 / 5.069 0 (0) 3,4 (2,9-4,0) 161 / 5.004 3,2 3,0
Esbjerg Sygehus Grindsted Sygehus
28 / 798 0 (0) 3,5 (2,3-5,0) 26 / 714 3,6 4,0
Kolding Sygehus* 11 / 183 0 (0) 6,0 (3,0-10,5) 5 / 195 2,6 5,4
Vejle Sygehus* 30 / 967 0 (0) 3,1 (2,1-4,4) 37 / 1.065 3,5 2,2"
  **Page:** 102
  **Source:** [^src8]

### Incoming

- **Subject:** indikator-2
  **Predicate:** measures
  **Object:** vejle-sygehus
  **Evidence:** "Vejle Sygehus* er en af de institutioner, der rapporteres i tabellen for Indikator 2."
  **Page:** 16
  **Source:** [^src2]

- **Subject:** kolding-sygehus
  **Predicate:** is-consolidated-with
  **Object:** vejle-sygehus
  **Evidence:** "Indikatorresultaterne for Kolding Sygehus og Vejle Sygehus er ikke fordelt korrekt imellem de to enheder og skal derfor fortolkes samlet som ét Sygehus Lillebælt"
  **Page:** 31
  **Source:** [^src4]

- **Subject:** sygehus-lillebaelt
  **Predicate:** represents
  **Object:** vejle-sygehus
  **Evidence:** "Indikatorresultaterne for Kolding Sygehus og Vejle Sygehus er ikke fordelt korrekt imellem de to enheder og skal derfor fortolkes samlet som ét Sygehus Lillebælt"
  **Page:** 31
  **Source:** [^src4]

- **Subject:** region-syddanmark
  **Predicate:** contains-hospital
  **Object:** vejle-sygehus
  **Evidence:** "Syddanmark Nej [...] Vejle Sygehus* Ja [...]"
  **Page:** 42
  **Source:** [^src6]

- **Subject:** kolding-sygehus
  **Predicate:** is-part-of-hospital-group-with
  **Object:** vejle-sygehus
  **Evidence:** "*Indikatorresultaterne for Kolding Sygehus og Vejle Sygehus er ikke fordelt korrekt imellem de to enheder og skal derfor fortolkes samlet som ét Sygehus Lillebælt"
  **Page:** 98
  **Source:** [^src7]

- **Subject:** sygehus-lillebaelt
  **Predicate:** comprises-hospitals
  **Object:** vejle-sygehus
  **Evidence:** "*Indikatorresultaterne for Kolding Sygehus og Vejle Sygehus er ikke fordelt korrekt imellem de to enheder og skal derfor fortolkes samlet som ét Sygehus Lillebælt"
  **Page:** 111
  **Source:** [^src9]

## Claims

### Clinical
- Vejle Sygehus opfyldte Indikator 2 hos 91,5 % (95 % CI: 89,2–93,4) af nydiagnosticerede patienter med atrieflimren i perioden 1. juli 2022 – 30. juni 2023 [^src1]

### Methodological-note
- Indikatorresultaterne for Kolding Sygehus og Vejle Sygehus er ikke fordelt korrekt imellem de to enheder og skal derfor fortolkes samlet som ét Sygehus Lillebælt [^src1]

## Timeline

*(No timeline events extracted for this entity)*

## Sources

[^src1]: AFDK_2023.pdf, pages 6-10
[^src2]: AFDK_2023.pdf, pages 16-20
[^src3]: AFDK_2023.pdf, pages 21-25
[^src4]: AFDK_2023.pdf, pages 31-35
[^src5]: AFDK_2023.pdf, pages 36-40
[^src6]: AFDK_2023.pdf, pages 41-45
[^src7]: AFDK_2023.pdf, pages 96-100
[^src8]: AFDK_2023.pdf, pages 101-105
[^src9]: AFDK_2023.pdf, pages 111-115
