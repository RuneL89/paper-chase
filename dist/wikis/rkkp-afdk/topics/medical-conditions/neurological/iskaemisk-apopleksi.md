---
title: Iskæmisk apopleksi
type: entity
aliases:
  - Iskæmisk apopleksi
wiki: rkkp-afdk
updated: '2026-08-05T20:38:17.358Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 96-100
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '106-110, 41-45, 46-50, 56-60, 6-10, 71-75'
tags:
  - medical-condition
---
**Iskæmisk apopleksi** (ischemic stroke) is a severe medical condition and a primary clinical complication of [[atrieflimren]]. In the context of [[danmark|Danmark]]'s healthcare system quality monitoring, it represents a central consequence of untreated or insufficiently treated atrial fibrillation, underscoring the critical need for effective [[antikoagulationsbehandling]] [^src1] [^src4]. 

The condition is systematically tracked in the [[atrieflimren-i-danmark|Atrieflimren i Danmark]] registry through specific clinical quality indicators. [[indikator-5|Indikator 5]] measures the incidence of ischemic stroke among prevalent atrial fibrillation patients, with a national quality standard set at ≤ 0.8% [^src2]. During the reporting period, the national incidence was recorded at 0.8% (95% CI: 0.8-0.9) [^src3], with exact figures showing 0.83% (1,132 out of 135,958) of prevalent patients developing the condition [^src4]. Additionally, Indicator 14 tracks the proportion of newly diagnosed patients who develop ischemic stroke within one year [^src1] [^src4]. For the period of July 1, 2021, to June 30, 2022, this proportion was 1.1% [^src1], and it rose slightly to 1.3% (95% CI: 1.1–1.4) for the period of July 1, 2022, to June 30, 2023 [^src4].

Risk assessment and data tracking for ischemic stroke rely on several interconnected medical and administrative tools. The [[cha2ds2-vasc|CHA2DS2-VASc]] score is utilized to assess the risk for the condition [^src1] [^src4], while the [[landspatientregisteret|Landspatientregisteret]] serves as the primary data source for identifying hospital admissions [^src4]. In clinical coding, the condition is identified using the ICD-10 codes [[di63|DI63]] (cerebral infarction) and [[di64|DI64]] (stroke, unspecified) [^src7]. Furthermore, ischemic stroke is classified as a subtype of [[alvorlig-bloedning|Alvorlig blødning]] in certain analytical contexts within the reports [^src6]. 

Despite the availability of preventative treatments, pharmacovigilance data reveals gaps in care: nationally, only 65.5% of atrial fibrillation patients admitted with ischemic stroke or stroke of unknown type had redeemed a prescription for oral anticoagulation within 100 days prior to their admission [^src4].

## Mentions
- Page 96: "Andel af nydiagnosticerede patienter med atrieflimren der har iskæmisk apopleksi 1 år efter diagnosedato." [^src1]
- Page 6: "Incidens af apopleksi blandt prævalente patienter med atrieflimren." [^src2]
- Page 44: "Incidens Iskæmisk Apopleksi" [^src3]
- Page 45: "Incidens af apopleksi blandt prævalente patienter med atrieflimren" [^src3]
- Page 71: "Andel af atrieflimren patienter indlagt med iskæmisk apopleksi/apopleksi af ukendt type" [^src4]
- Page 72: "Indikator 14: Andelen af nydiagnosticerede patienter med atriflimren, som udvikler iskæmisk apopleksi inden for 1 år" [^src4]

## Relationships
**Outgoing**
- Subject: iskaemisk-apopleksi | Predicate: is-complication-of | Object: atrieflimren
  Evidence: "Andel af nydiagnosticerede patienter med atrieflimren der har iskæmisk apopleksi 1 år efter diagnosedato."
  Page: 96 [^src1]
- Subject: iskaemisk-apopleksi | Predicate: is-complication-of | Object: atrieflimren
  Evidence: "Incidens af apopleksi blandt prævalente patienter med atrieflimren."
  Page: 6 [^src2]

**Incoming**
- Subject: cha2ds2-vasc | Predicate: is-used-to-assess-risk-for | Object: (this entity)
  Evidence: "Supplerende analyse: indikator 6
Fordeling af CHA2DS2VASc score blandt prævalente atrieflimren patienter med intrakraniel blødning"
  Page: 98 [^src1]
- Subject: indikator-5 | Predicate: measures | Object: (this entity)
  Evidence: "Indikator 5: Incidens af iskæmisk apopleksi blandt prævalente patienter med atrieflimren."
  Page: 44 [^src3]
- Subject: indikator-5 | Predicate: measures-incidence-of | Object: (this entity)
  Evidence: "Indikator 5: Incidens af iskæmisk apopleksi blandt prævalente patienter med atrieflimren."
  Page: 47 [^src5]
- Subject: alvorlig-bloedning | Predicate: includes-subtype | Object: (this entity)
  Evidence: "Alvorlige blødninger defineres som intrakranielle blødninger, gastrointestinale blødninger, urinvejsblødninger og blødninger fra lungerne."
  Page: 60 [^src6]
- Subject: antikoagulationsbehandling | Predicate: is-used-for | Object: (this entity)
  Evidence: "Indikator 14: Andelen af nydiagnosticerede patienter med atriflimren, som udvikler iskæmisk apopleksi inden for 1 år"
  Page: 72 [^src4]
- Subject: cha2ds2-vasc | Predicate: is-used-to-assess-risk-for | Object: (this entity)
  Evidence: "CHA2DS2VASc Score
blandt prævalente
atrieflimren patienter
med intrakraniel
blødning"
  Page: 74 [^src4]
- Subject: landspatientregisteret | Predicate: is-source-for | Object: (this entity)
  Evidence: "Andel af atrieflimren patienter indlagt med iskæmisk apopleksi/apopleksi af ukendt type, som har
indløst recept på oral AK-behandling indenfor 100 dage før dato for indlæggelse med apopleksi
Andel af atrieflimren
patienter indlagt med I63 +
I64 (LPR baseret)"
  Page: 71 [^src4]
- Subject: di63 | Predicate: identifies-condition | Object: (this entity)
  Evidence: "Koder:
A-diagnose
DI63 (hjerneinfarkt)"
  Page: 107 [^src7]
- Subject: di64 | Predicate: identifies-condition | Object: (this entity)
  Evidence: "DI64 (slagtilfælde uden oplysning om blødning eller infarkt)"
  Page: 107 [^src7]

## Claims
- Andelen af nydiagnosticerede patienter med atrieflimren, som udvikler iskæmisk apopleksi inden for 1 år, var 1,1 % i Danmark i perioden 01.07.2021–30.06.2022 [^src1]
  Type: clinical-outcome
  Page: 96
- Indikator 5 har standarden ≤ 0,8 % for incidensen af apopleksi blandt prævalente patienter med atrieflimren [^src1]
  Type: quality-standard
  Page: 6
- På landsplan er incidensen af apopleksi blandt prævalente patienter med atrieflimren 0,8% (95% CI: 0,8-0,9) [^src3]
  Type: epidemiological
  Page: 45
- Andelen af atrieflimren-patienter indlagt med iskæmisk apopleksi/apopleksi af ukendt type, som havde indløst recept på oral antikoagulationsbehandling inden for 100 dage før indlæggelsen, var 65,5 % på nationalt plan [^src1]
  Type: pharmacovigilance
  Page: 71
- Indikator 14: Andelen af nydiagnosticerede atrieflimren-patienter, der udvikler iskæmisk apopleksi inden for 1 år, var 1,3 % i Danmark for perioden 01.07.2022–30.06.2023 (95 % CI: 1,1–1,4) [^src1]
  Type: clinical-outcome
  Page: 72
- Prævalente atrieflimren-patienter, der udvikler iskæmisk apopleksi i opgørelsesperioden: 0,83 % (1132 ud af 135958) [^src1]
  Type: epidemiology
  Page: 73

## Timeline
- 01.07.2022–30.06.2023: Opgørelsesperiode for Indikator 14 (iskæmisk apopleksi) og Indikator 13 (intrakraniel blødning) [^src4]

## Sources

[^src1]: AFDK_2023.pdf, pages 96-100
[^src2]: AFDK_2024.pdf, pages 6-10
[^src3]: AFDK_2024.pdf, pages 41-45
[^src4]: AFDK_2024.pdf, pages 71-75
[^src5]: AFDK_2024.pdf, pages 46-50
[^src6]: AFDK_2024.pdf, pages 56-60
[^src7]: AFDK_2024.pdf, pages 106-110
