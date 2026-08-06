---
title: thyreoideastimulerende hormon (TSH)
type: entity
aliases:
  - thyreoideastimulerende hormon (TSH)
  - TSH
wiki: rkkp-afdk
updated: '2026-08-05T20:00:09.927Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 26-30
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '101-105, 16-20, 21-25, 6-10'
tags:
  - biomarker
---
Thyroid-stimulating hormone (TSH), or *thyreoideastimulerende hormon*, is a central biomarker used in the Danish healthcare system to screen for thyroid disease, which can be an underlying cause of [[atrieflimren|atrieflimren]] (atrial fibrillation) [^src1]. Within the Danish Atrial Fibrillation Database (AFDK), the measurement of TSH is a mandatory component of the standardized clinical evaluation for patients receiving a new diagnosis [^src1]. 

To monitor and improve this clinical practice, the [[afdk-styregruppe|Styregruppen for AFDK]] established [[indikator-3|Indikator 3]], a national quality indicator that tracks the proportion of newly diagnosed atrial fibrillation patients who have their TSH levels measured [^src1]. The specific measurement window for this indicator is strictly defined as any time from 60 days (two months) before to 30 days (one month) after the patient's first diagnosis date [^src4]. The national quality standard requires that at least 95% of eligible patients receive this test within the specified timeframe [^src2].

Despite the clear clinical guidelines, national performance has struggled to meet the 95% threshold. Data from the 2023/24 reporting period revealed that only 76% of newly diagnosed atrial fibrillation patients nationally had a TSH measurement recorded within the required window [^src5]. The [[afdk-styregruppe|Styregruppen for AFDK]] has identified systemic and technical barriers contributing to this shortfall. A primary challenge is the inconsistent coding of TSH tests in the [[labka|LABKA]] laboratory database, where a single biomarker can be registered under multiple different codes (such as NPU27547, NPU04199, and others) [^src1]. Due to these data capture issues and actual clinical gaps, the steering group has concluded that there must be a greater focus on ensuring TSH is both measured and correctly registered for newly diagnosed patients [^src1].

## Mentions

- Page 26: "thyreoideastimulerende hormon (TSH)" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 26-30)
- Page 27: "thyreoideastimulerende hormon (TSH)" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 26-30)
- Page 28: "thyreoideastimulerende hormon (TSH)" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 26-30)
- Page 29: "TSH (thyreoideastimulerende hormon)" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 26-30)
- Page 6: "som får målt TSH fra 2 måneder før, til 1 måned efter 1. diagnosedato" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 6-10)
- Page 20: "Indikator 3: Thyreoideastimulerende hormon (TSH) måling" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 16-20)
- Page 105: "Thyreoideastimulerende hormon (TSH) måling" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105)
- Page 105: "Kode: NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105)
- Page 21: "Andelen af nydiagnosticerede patienter med atrieflimren, som får målt TSH fra 2 måneder før, til 1 måned efter 1. diagnosedato" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 21-25)

## Relationships

**Outgoing**
- Subject: thyreoideastimulerende-hormon-tsh
  Predicate: is-measured-for
  Object: atrieflimren
  Evidence: "som får målt TSH fra 2 måneder før, til 1 måned efter 1. diagnosedato"
  Page: 6
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 6-10
- Subject: thyreoideastimulerende-hormon-tsh
  Predicate: coded-as
  Object: np27547-p-thyrotropin
  Evidence: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647"
  Page: 105
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105
- Subject: thyreoideastimulerende-hormon-tsh
  Predicate: coded-as
  Object: np04199-p-thyrotropin
  Evidence: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647"
  Page: 105
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105
- Subject: thyreoideastimulerende-hormon-tsh
  Predicate: coded-as
  Object: np04200-p-thyrotropin
  Evidence: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647"
  Page: 105
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105
- Subject: thyreoideastimulerende-hormon-tsh
  Predicate: coded-as
  Object: np03624-p-thyrotropin
  Evidence: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647"
  Page: 105
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105
- Subject: thyreoideastimulerende-hormon-tsh
  Predicate: coded-as
  Object: np03578-p-thyrotropin
  Evidence: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647"
  Page: 105
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105
- Subject: thyreoideastimulerende-hormon-tsh
  Predicate: coded-as
  Object: dnk35895-p-thyrotropin
  Evidence: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647"
  Page: 105
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105
- Subject: thyreoideastimulerende-hormon-tsh
  Predicate: coded-as
  Object: ass00039-p-thyrotropin
  Evidence: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647"
  Page: 105
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105
- Subject: thyreoideastimulerende-hormon-tsh
  Predicate: coded-as
  Object: ass00136-p-thyrotropin
  Evidence: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647"
  Page: 105
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105
- Subject: thyreoideastimulerende-hormon-tsh
  Predicate: coded-as
  Object: ass00647-p-thyrotropin
  Evidence: "NPU27547, NPU04199, NPU04200, NPU03624, NPU 03578, DNK35895, ASS00039, ASS00136, ASS00647"
  Page: 105
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105

**Incoming**
- Subject: indikator-3
  Predicate: measures
  Object: thyreoideastimulerende-hormon-tsh
  Evidence: "Indikator 3: Andel af nydiagnosticerede patienter med atrieflimren, som får målt thyreoideastimulerende hormon (TSH) fra 60 dage før, til 30 dage efter 1. diagnosedato."
  Page: 26
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 26-30
- Subject: labka
  Predicate: contains-codes-for
  Object: thyreoideastimulerende-hormon-tsh
  Evidence: "forskellige koder for en TSH måling i LABKA"
  Page: 29
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 26-30
- Subject: indikator-3
  Predicate: measures
  Object: thyreoideastimulerende-hormon-tsh
  Evidence: "Indikator 3: Thyreoideastimulerende hormon (TSH) måling"
  Page: 20
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 16-20
- Subject: atrieflimren
  Predicate: requires
  Object: thyreoideastimulerende-hormon-tsh
  Evidence: "Andelen af nydiagnosticerede patienter med atrieflimren, som får målt TSH fra 60 dage før til 30 dage efter 1. diagnosedato"
  Page: 105
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105
- Subject: indikator-3
  Predicate: measures-biomarker
  Object: thyreoideastimulerende-hormon-tsh
  Evidence: "Indikator 3: Andelen af nydiagnosticerede patienter med atrieflimren, som får målt TSH fra 2 måneder før, til 1 måned efter 1. diagnosedato"
  Page: 21
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 21-25
- Subject: labka
  Predicate: codes-test-for
  Object: thyreoideastimulerende-hormon-tsh
  Evidence: "forskellige koder for en TSH måling i LABKA"
  Page: 24
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 21-25

## Claims

**Policy-Assessment**
- Styregruppen vurderer, at der dels kan være udfordringer med forskellige koder for en TSH måling i LABKA og dels bør der sættes større fokus på at få målt TSH hos patienter med nydiagnosticeret atrieflimren [^src1] (afdk-styregruppe, indikator-3, labka, thyreoideastimulerende-hormon-tsh)
  Page: 29
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 26-30

**Quality-Standard**
- Indikator 3 har standarden ≥ 95 % for andelen af nydiagnosticerede patienter med atrieflimren, som får målt TSH fra 2 måneder før, til 1 måned efter 1. diagnosedato [^src1] (atrieflimren, thyreoideastimulerende-hormon-tsh, indikator-3)
  Page: 6
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 6-10

**Quality-Indicator**
- Indikator 3 måler andelen af nydiagnosticerede patienter med atrieflimren, som får målt TSH fra 60 dage før til 30 dage efter 1. diagnosedato [^src1] (atrieflimren, thyreoideastimulerende-hormon-tsh)
  Page: 105
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105

**Definition**
- For indikator 3 er tælleren patienter i nævneren, som har fået målt TSH mindst én gang fra 60 dage før til 30 dage efter 1. diagnosedato [^src1] (thyreoideastimulerende-hormon-tsh)
  Page: 105
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 101-105

**Performance**
- På landsplan fik 76% af de nydiagnosticerede patienter med atrieflimren målt TSH i perioden fra 60 dage før til 30 dage efter diagnosedatoen [^src1] (indikator-3, atrieflimren, thyreoideastimulerende-hormon-tsh)
  Page: 24
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 21-25

## Timeline

(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 26-30
[^src2]: AFDK_2024.pdf, pages 6-10
[^src3]: AFDK_2024.pdf, pages 16-20
[^src4]: AFDK_2024.pdf, pages 101-105
[^src5]: AFDK_2024.pdf, pages 21-25
