---
title: Kolding Sygehus
type: entity
aliases:
  - Kolding Sygehus
wiki: rkkp-afdk
updated: '2026-08-05T19:47:28.330Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '101-105, 111-115, 16-20, 21-25, 31-35, 36-40, 41-45, 6-10, 96-100'
tags:
  - organization
---
**Kolding Sygehus** is a hospital located in [[region-syddanmark|Region Syddanmark]], Denmark [^src8]. It plays a notable role in the national clinical quality monitoring of atrial fibrillation treatment, as documented in the Danish Atrial Fibrillation Database (AFDK) annual report covering the period from July 1, 2022, to June 30, 2023. However, a recurring methodological issue affects the interpretation of its standalone data: indicator results for Kolding Sygehus and [[vejle-sygehus|Vejle Sygehus]] were not correctly distributed between the two units in the registry [^src3]. Consequently, their data must be interpreted collectively as a single entity, [[sygehus-lillebaelt|Sygehus Lillebælt]] [^src4], [^src6].

Despite the consolidation caveat, the hospital's specific performance metrics are detailed across several clinical quality indicators. For [[indikator-2|Indikator 2]], which tracks the proportion of newly diagnosed atrial fibrillation patients who receive an echocardiogram, Kolding Sygehus reported a compliance rate of 63.7% (95% CI: 54.1–72.6), which did not meet the national standard [^src2]. In the 5-year analysis for [[indikator-4a|Indikator 4a]], measuring anticoagulation treatment coverage, the hospital recorded the lowest proportion among all listed facilities at 71.1% (95% CI: 54.1–84.6) [^src6]. 

The registry also tracks severe adverse outcomes for newly diagnosed patients at the hospital. According to [[indikator-12|Indikator 12]], 6.0% (95% CI: 3.0–10.5) of patients experienced severe bleeding within one year of diagnosis [^src8]. Furthermore, [[indikator-13|Indikator 13]] data shows that the one-year mortality rate for these patients was 21.3% (95% CI: 15.6–28.0) [^src8]. Throughout the report, Kolding Sygehus's statistical entries are consistently marked with an asterisk to remind readers of the data consolidation with Vejle Sygehus [^src1], [^src5], [^src7].

## Mentions

- Page 9: "Kolding Sygehus* Ja 83 / 86 0 (0) 96,5 (90,1-99,3) 103 / 111 92,8 89,7" [^src1]
- Page 16: "Kolding Sygehus* Nej 72 / 113 0 (0) 63,7 (54,1-72,6) 85 / 192 44,3 50,5" [^src2]
- Page 23: "Kolding Sygehus* Nej 131 / 146 0 (0) 89,7 (83,6-94,1) 163 / 192 84,9 82,4" [^src3]
- Page 24: "*Indikatorresultaterne for Kolding Sygehus og Vejle Sygehus er ikke fordelt korrekt imellem de to enheder og skal derfor fortolkes samlet som ét Sygehus Lillebælt" [^src3]
- Page 31: "*Indikatorresultaterne for Kolding Sygehus og Vejle Sygehus er ikke fordelt korrekt imellem de to enheder og skal derfor fortolkes samlet som ét Sygehus Lillebælt" [^src4]
- Page 36: "Kolding Sygehus* Ja 43 / 46 0 (0) 93,5 (82,1-98,6) 57 / 66 86,4 81,3" [^src5]
- Page 42: "Kolding Sygehus* Nej 27 / 38 0 (0) 71,1 (54,1-84,6) 32 / 40 80,0" [^src6]
- Page 96: "Kolding Sygehus* 6 / 183 0 (0) 3,3 (1,2-7,0) # / # 1,0 2,0" [^src7]
- Page 99: "Kolding Sygehus* # / # 0 (0) 1,6 (0,3-4,7) # / # 0,5 1,5" [^src7]
- Page 102: "Kolding Sygehus* 11 / 183 0 (0) 6,0 (3,0-10,5) 5 / 195 2,6 5,4" [^src8]
- Page 104: "Kolding Sygehus* 39 / 183 0 (0) 21,3 (15,6-28,0) 55 / 195 28,2 22,9" [^src8]

## Relationships

**Outgoing**
- **Subject:** kolding-sygehus | **Predicate:** is-part-of | **Object:** sygehus-lillebaelt
  **Evidence:** "Indikatorresultaterne for Kolding Sygehus og Vejle Sygehus er ikke fordelt korrekt imellem de to enheder og skal derfor fortolkes samlet som ét Sygehus Lillebælt"
  **Page:** 24 [^src3]
- **Subject:** kolding-sygehus | **Predicate:** is-consolidated-with | **Object:** vejle-sygehus
  **Evidence:** "Indikatorresultaterne for Kolding Sygehus og Vejle Sygehus er ikke fordelt korrekt imellem de to enheder og skal derfor fortolkes samlet som ét Sygehus Lillebælt"
  **Page:** 31 [^src4]
- **Subject:** kolding-sygehus | **Predicate:** is-part-of-hospital-group-with | **Object:** vejle-sygehus
  **Evidence:** "*Indikatorresultaterne for Kolding Sygehus og Vejle Sygehus er ikke fordelt korrekt imellem de to enheder og skal derfor fortolkes samlet som ét Sygehus Lillebælt"
  **Page:** 98 [^src7]
- **Subject:** kolding-sygehus | **Predicate:** is-part-of | **Object:** region-syddanmark
  **Evidence:** "Syddanmark 174 / 5.069 0 (0) 3,4 (2,9-4,0) 161 / 5.004 3,2 3,0
Esbjerg Sygehus Grindsted Sygehus
28 / 798 0 (0) 3,5 (2,3-5,0) 26 / 714 3,6 4,0
Kolding Sygehus* 11 / 183 0 (0) 6,0 (3,0-10,5) 5 / 195 2,6 5,4"
  **Page:** 102 [^src8]

**Incoming**
- **Subject:** indikator-2 | **Predicate:** measures | **Object:** kolding-sygehus
  **Evidence:** "Kolding Sygehus* er en af de institutioner, der rapporteres i tabellen for Indikator 2."
  **Page:** 16 [^src2]
- **Subject:** vejle-sygehus | **Predicate:** is-consolidated-with | **Object:** kolding-sygehus
  **Evidence:** "Indikatorresultaterne for Kolding Sygehus og Vejle Sygehus er ikke fordelt korrekt imellem de to enheder og skal derfor fortolkes samlet som ét Sygehus Lillebælt"
  **Page:** 31 [^src4]
- **Subject:** sygehus-lillebaelt | **Predicate:** represents | **Object:** kolding-sygehus
  **Evidence:** "Indikatorresultaterne for Kolding Sygehus og Vejle Sygehus er ikke fordelt korrekt imellem de to enheder og skal derfor fortolkes samlet som ét Sygehus Lillebælt"
  **Page:** 31 [^src4]
- **Subject:** region-syddanmark | **Predicate:** contains-hospital | **Object:** kolding-sygehus
  **Evidence:** "Syddanmark Nej [...] Kolding Sygehus* Nej [...]"
  **Page:** 42 [^src6]
- **Subject:** sygehus-lillebaelt | **Predicate:** comprises-hospitals | **Object:** kolding-sygehus
  **Evidence:** "*Indikatorresultaterne for Kolding Sygehus og Vejle Sygehus er ikke fordelt korrekt imellem de to enheder og skal derfor fortolkes samlet som ét Sygehus Lillebælt"
  **Page:** 111 [^src9]

## Claims

- **clinical**: Kolding Sygehus opfyldte Indikator 2 hos 63,7 % (95 % CI: 54,1–72,6) af nydiagnosticerede patienter med atrieflimren i perioden 1. juli 2022 – 30. juni 2023 [^src1] (kolding-sygehus, indikator-2)
- **performance**: Kolding Sygehus har den laveste andel blandt alle listede sygehuse, nemlig 71,1 % (95 % CI: 54,1–84,6) ved 5-årsanalyse [^src1] (kolding-sygehus, indikator-4a)
- **methodological-note**: Indikatorresultaterne for Kolding Sygehus og Vejle Sygehus er ikke fordelt korrekt imellem de to enheder og skal derfor fortolkes samlet som ét Sygehus Lillebælt [^src1] (kolding-sygehus, vejle-sygehus, sygehus-lillebaelt)
- **statistical**: For Kolding Sygehus er andelen af nydiagnosticerede patienter med atrieflimren, som får alvorlig blødning inden for 1 år, 6,0 % (95 % CI: 3,0–10,5) [^src1] (indikator-12, kolding-sygehus)
- **statistical**: For Kolding Sygehus er andelen af nydiagnosticerede patienter med atrieflimren, som dør inden for 1 år, 21,3 % (95 % CI: 15,6–28,0) [^src1] (indikator-13, kolding-sygehus)

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
