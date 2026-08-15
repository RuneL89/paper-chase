---
title: Iskæmisk apopleksi
type: entity
aliases:
  - Iskæmisk apopleksi
wiki: rkkp-afdk
updated: '2026-08-14T20:30:42.685Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: 96-100
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '106-110, 41-45, 46-50, 56-60, 6-10, 71-75'
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: '31-35, 66-70, 91-95'
tags:
  - medical-condition
---
**Iskæmisk apopleksi** (ischemic stroke) is a severe medical condition and the primary clinical complication of [[atrieflimren|atrial fibrillation]] when left untreated or inadequately managed with [[antikoagulationsbehandling|anticoagulant therapy]] [^src1] [^src4]. In the Danish healthcare system, tracking and preventing this condition is a central priority within the Danish Atrial Fibrillation Database ([[atrieflimren-i-danmark|Atrieflimren i Danmark]]), where it serves as a critical outcome measure for evaluating the quality and safety of clinical care across the country [^src3] [^src6].

The condition is systematically monitored through specific clinical quality indicators. [[indikator-5|Indikator 5]] measures the incidence of ischemic stroke among prevalent patients with atrial fibrillation, with a national quality standard set at ≤ 0.8% [^src2]. In recent reporting periods, the national incidence among prevalent patients was 0.8% (95% CI: 0.8-0.9), with 1,169 out of 139,972 prevalent patients developing the condition [^src3] [^src6]. Additionally, indicators tracking newly diagnosed patients (referred to as Indikator 14 in 2024 and Indikator 13 in 2025) measure the proportion of patients who develop ischemic stroke within one year of their diagnosis [^src4] [^src6]. For the period of July 1, 2022, to June 30, 2023, this proportion was 1.3% nationally, with regional variations ranging from 0.7% in [[region-midtjylland|Region Midtjylland]] to 1.4% in [[region-sjaelland|Region Sjælland]] [^src4] [^src6].

To identify cases, Danish healthcare registries—specifically the [[landspatientregisteret|Danish National Patient Register]]—utilize specific diagnosis codes, primarily [[di63|DI63]] (cerebral infarction) and [[di64|DI64]] (stroke without mention of hemorrhage or infarction), sometimes in combination with [[dz501|DZ501]] for rehabilitation contacts [^src4] [^src7] [^src10]. The risk of ischemic stroke is closely tied to the use of anticoagulants. Among patients who suffered a stroke, a significant proportion had redeemed a prescription for oral anticoagulation within 100 days prior to admission, though this adherence varied by region [^src4] [^src6]. Furthermore, the type of anticoagulant plays a role in outcomes; for instance, prevalent patients on [[doac|DOAC]] therapy had an incidence of 0.86%, while those on [[marevan|Marevan]] had an incidence of 0.88%, and those on both had a notably higher incidence of 4.06% [^src6]. Risk assessment tools like the [[cha2ds2-vasc|CHA2DS2-VASc]] score are also utilized to evaluate the risk profile of patients who experience severe events, including [[alvorlig-bloedning|severe bleeding]] and stroke [^src1] [^src4]. Ultimately, preventing iskæmisk apopleksi remains a defining benchmark for the success of atrial fibrillation management in [[danmark|Denmark]] [^src5] [^src6].

## Mentions

- Page 96: "Andel af nydiagnosticerede patienter med atrieflimren der har iskæmisk apopleksi 1 år efter diagnosedato." [^src1]
- Page 6: "Incidens af apopleksi blandt prævalente patienter med atrieflimren." [^src2]
- Page 44: "Incidens Iskæmisk Apopleksi" [^src3]
- Page 45: "Incidens af apopleksi blandt prævalente patienter med atrieflimren" [^src3]
- Page 71: "Andel af atrieflimren patienter indlagt med iskæmisk apopleksi/apopleksi af ukendt type" [^src4]
- Page 72: "Indikator 14: Andelen af nydiagnosticerede patienter med atriflimren, som udvikler iskæmisk apopleksi inden for 1 år" [^src4]
- Page 35: "Indikator 5: Incidens Iskæmisk Apopleksi
Indikator 5: Incidens af iskæmisk apopleksi blandt prævalente patienter med atrieflimren." [^src5]
- Page 68: "Supplerende analyser 5: Incidens Iskæmisk Apopleksi" [^src6]
- Page 68: "Indikator 13: Andelen af nydiagnosticerede patienter med atriflimren, som udvikler iskæmisk apopleksi inden for 1 år" [^src6]

## Relationships

**Outgoing (this entity is the SUBJECT of these relationships):**

- Subject: iskaemisk-apopleksi
  Predicate: is-complication-of
  Object: atrieflimren
  Evidence: "Andel af nydiagnosticerede patienter med atrieflimren der har iskæmisk apopleksi 1 år efter diagnosedato."
  Page: 96
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 96-100 [^src1]

- Subject: iskaemisk-apopleksi
  Predicate: is-complication-of
  Object: atrieflimren
  Evidence: "Incidens af apopleksi blandt prævalente patienter med atrieflimren."
  Page: 6
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 6-10 [^src2]

**Incoming (this entity is the OBJECT of these relationships):**

- Subject: cha2ds2-vasc
  Predicate: is-used-to-assess-risk-for
  Object: (this entity)
  Evidence: "Supplerende analyse: indikator 6
Fordeling af CHA2DS2VASc score blandt prævalente atrieflimren patienter med intrakraniel blødning"
  Page: 98
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 96-100 [^src1]

- Subject: indikator-5
  Predicate: measures
  Object: (this entity)
  Evidence: "Indikator 5: Incidens af iskæmisk apopleksi blandt prævalente patienter med atrieflimren."
  Page: 44
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45 [^src3]

- Subject: indikator-5
  Predicate: measures-incidence-of
  Object: (this entity)
  Evidence: "Indikator 5: Incidens af iskæmisk apopleksi blandt prævalente patienter med atrieflimren."
  Page: 47
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 46-50 [^src8]

- Subject: alvorlig-bloedning
  Predicate: includes-subtype
  Object: (this entity)
  Evidence: "Alvorlige blødninger defineres som intrakranielle blødninger, gastrointestinale blødninger, urinvejsblødninger og blødninger fra lungerne."
  Page: 60
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 56-60 [^src9]

- Subject: antikoagulationsbehandling
  Predicate: is-used-for
  Object: (this entity)
  Evidence: "Indikator 14: Andelen af nydiagnosticerede patienter med atriflimren, som udvikler iskæmisk apopleksi inden for 1 år"
  Page: 72
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 71-75 [^src4]

- Subject: cha2ds2-vasc
  Predicate: is-used-to-assess-risk-for
  Object: (this entity)
  Evidence: "CHA2DS2VASc Score
blandt prævalente
atrieflimren patienter
med intrakraniel
blødning"
  Page: 74
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 71-75 [^src4]

- Subject: landspatientregisteret
  Predicate: is-source-for
  Object: (this entity)
  Evidence: "Andel af atrieflimren patienter indlagt med iskæmisk apopleksi/apopleksi af ukendt type, som har
indløst recept på oral AK-behandling indenfor 100 dage før dato for indlæggelse med apopleksi
Andel af atrieflimren
patienter indlagt med I63 +
I64 (LPR baseret)"
  Page: 71
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 71-75 [^src4]

- Subject: di63
  Predicate: identifies-condition
  Object: (this entity)
  Evidence: "Koder:
A-diagnose
DI63 (hjerneinfarkt)"
  Page: 107
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 106-110 [^src10]

- Subject: di64
  Predicate: identifies-condition
  Object: (this entity)
  Evidence: "DI64 (slagtilfælde uden oplysning om blødning eller infarkt)"
  Page: 107
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 106-110 [^src10]

- Subject: indikator-5
  Predicate: measures
  Object: (this entity)
  Evidence: "Indikator 5: Incidens af iskæmisk apopleksi blandt prævalente patienter med atrieflimren."
  Page: 35
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 31-35 [^src5]

- Subject: di63
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DI63 (hjerneinfarkt)"
  Page: 93
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95 [^src7]

- Subject: di64
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DI64 (slagtilfælde uden oplysning om blødning eller infarkt)"
  Page: 93
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95 [^src7]

- Subject: dz501
  Predicate: is-diagnosis-code-for
  Object: (this entity)
  Evidence: "DZ501 (Kontakt mhp. anden fysioterapi ) & B-diagnose DI63 eller DI64"
  Page: 93
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 91-95 [^src7]

## Claims

**clinical-outcome**
- Andelen af nydiagnosticerede patienter med atrieflimren, som udvikler iskæmisk apopleksi inden for 1 år, var 1,1 % i Danmark i perioden 01.07.2021–30.06.2022 [^src1] (atrieflimren, iskaemisk-apopleksi, danmark)
- Indikator 14: Andelen af nydiagnosticerede atrieflimren-patienter, der udvikler iskæmisk apopleksi inden for 1 år, var 1,3 % i Danmark for perioden 01.07.2022–30.06.2023 (95 % CI: 1,1–1,4) [^src1] (atrieflimren-i-danmark, iskaemisk-apopleksi)
- I Danmark udviklede 235 ud af 21.846 nydiagnosticerede patienter med atrieflimren iskæmisk apopleksi inden for 1 år, hvilket svarer til en andel på 1,1 % (95 % CI: 0,9–1,2) [^src2] (danmark, iskaemisk-apopleksi)
- I Region Hovedstaden udviklede 72 ud af 6.106 nydiagnosticerede patienter med atrieflimren iskæmisk apopleksi inden for 1 år, hvilket svarer til en andel på 1,2 % (95 % CI: 0,9–1,5) [^src2] (region-hovedstaden, iskaemisk-apopleksi)
- I Region Sjælland udviklede 49 ud af 3.566 nydiagnosticerede patienter med atrieflimren iskæmisk apopleksi inden for 1 år, hvilket svarer til en andel på 1,4 % (95 % CI: 1,0–1,8) [^src2] (region-sjaelland, iskaemisk-apopleksi)
- I Region Syddanmark udviklede 49 ud af 4.780 nydiagnosticerede patienter med atrieflimren iskæmisk apopleksi inden for 1 år, hvilket svarer til en andel på 1,0 % (95 % CI: 0,8–1,4) [^src2] (region-syddanmark, iskaemisk-apopleksi)
- I Region Midtjylland udviklede 36 ud af 5.061 nydiagnosticerede patienter med atrieflimren iskæmisk apopleksi inden for 1 år, hvilket svarer til en andel på 0,7 % (95 % CI: 0,5–1,0) [^src2] (region-midtjylland, iskaemisk-apopleksi)
- I Region Nordjylland udviklede 29 ud af 2.333 nydiagnosticerede patienter med atrieflimren iskæmisk apopleksi inden for 1 år, hvilket svarer til en andel på 1,2 % (95 % CI: 0,8–1,8) [^src2] (region-nordjylland, iskaemisk-apopleksi)
- Af de 139.972 prævalente patienter med atrieflimren udviklede 1.169 (0,83 %) iskæmisk apopleksi i opgørelsesperioden [^src4] (danmark, iskaemisk-apopleksi)
- Af de 107.541 prævalente patienter med atrieflimren og på DOAC-behandling udviklede 936 (0,86 %) iskæmisk apopleksi i opgørelsesperioden [^src4] (doac, iskaemisk-apopleksi)
- Af de 5.043 prævalente patienter med atrieflimren og på Marevan-behandling udviklede 45 (0,88 %) iskæmisk apopleksi i opgørelsesperioden [^src4] (marevan, iskaemisk-apopleksi)
- Af de 779 prævalente patienter med atrieflimren og på både DOAC og Marevan udviklede 33 (4,06 %) iskæmisk apopleksi i opgørelsesperioden [^src4] (doac, marevan, iskaemisk-apopleksi)
- Af de 26.609 prævalente patienter med atrieflimren uden DOAC eller Marevan udviklede 155 (0,58 %) iskæmisk apopleksi i opgørelsesperioden [^src4] (iskaemisk-apopleksi)

**quality-standard**
- Indikator 5 har standarden ≤ 0,8 % for incidensen af apopleksi blandt prævalente patienter med atrieflimren [^src1] (atrieflimren, iskaemisk-apopleksi, indikator-5)

**epidemiological**
- På landsplan er incidensen af apopleksi blandt prævalente patienter med atrieflimren 0,8% (95% CI: 0,8-0,9) [^src3] (indikator-5, atrieflimren, iskaemisk-apopleksi)

**pharmacovigilance**
- Andelen af atrieflimren-patienter indlagt med iskæmisk apopleksi/apopleksi af ukendt type, som havde indløst recept på oral antikoagulationsbehandling inden for 100 dage før indlæggelsen, var 65,5 % på nationalt plan [^src1] (atrieflimren-i-danmark, iskaemisk-apopleksi, antikoagulationsbehandling)

**epidemiology**
- Prævalente atrieflimren-patienter, der udvikler iskæmisk apopleksi i opgørelsesperioden: 0,83 % (1132 ud af 135958) [^src1] (atrieflimren-i-danmark, iskaemisk-apopleksi)

**clinical-practice**
- Af alle patienter med atrieflimren, der blev indlagt med iskæmisk apopleksi/apopleksi af ukendt type, havde 772 (67,3 %) indløst recept på oral antikoagulationsbehandling inden for 100 dage før indlæggelse [^src3] (danmark, antikoagulationsbehandling, iskaemisk-apopleksi)
- Af alle patienter med atrieflimren, der blev indlagt med iskæmisk apopleksi/apopleksi af ukendt type, havde 248 (64,8 %) i Region Hovedstaden indløst recept på oral antikoagulationsbehandling inden for 100 dage før indlæggelse [^src3] (region-hovedstaden, antikoagulationsbehandling, iskaemisk-apopleksi)
- Af alle patienter med atrieflimren, der blev indlagt med iskæmisk apopleksi/apopleksi af ukendt type, havde 117 (59,1 %) i Region Sjælland indløst recept på oral antikoagulationsbehandling inden for 100 dage før indlæggelse [^src3] (region-sjaelland, antikoagulationsbehandling, iskaemisk-apopleksi)
- Af alle patienter med atrieflimren, der blev indlagt med iskæmisk apopleksi/apopleksi af ukendt type, havde 183 (73,5 %) i Region Syddanmark indløst recept på oral antikoagulationsbehandling inden for 100 dage før indlæggelse [^src3] (region-syddanmark, antikoagulationsbehandling, iskaemisk-apopleksi)
- Af alle patienter med atrieflimren, der blev indlagt med iskæmisk apopleksi/apopleksi af ukendt type, havde 132 (67,7 %) i Region Midtjylland indløst recept på oral antikoagulationsbehandling inden for 100 dage før indlæggelse [^src3] (region-midtjylland, antikoagulationsbehandling, iskaemisk-apopleksi)
- Af alle patienter med atrieflimren, der blev indlagt med iskæmisk apopleksi/apopleksi af ukendt type, havde 92 (75,4 %) i Region Nordjylland indløst recept på oral antikoagulationsbehandling inden for 100 dage før indlæggelse [^src3] (region-nordjylland, antikoagulationsbehandling, iskaemisk-apopleksi)

**quality-indicator**
- Indikator 5: Incidens af iskæmisk apopleksi blandt prævalente patienter med atrieflimren [^src1] (iskaemisk-apopleksi, atrieflimren)

## Timeline

- 01.07.2022–30.06.2023: Opgørelsesperiode for Indikator 14 (iskæmisk apopleksi) og Indikator 13 (intrakraniel blødning) [^src4] (atrieflimren-i-danmark, iskaemisk-apopleksi, intrakraniel-bloedning)

## Sources

[^src1]: AFDK_2023.pdf, pages 96-100
[^src2]: AFDK_2024.pdf, pages 6-10
[^src3]: AFDK_2024.pdf, pages 41-45
[^src4]: AFDK_2024.pdf, pages 71-75
[^src5]: AFDK_2025.pdf, pages 31-35
[^src6]: AFDK_2025.pdf, pages 66-70
[^src7]: AFDK_2025.pdf, pages 91-95
[^src8]: AFDK_2024.pdf, pages 46-50
[^src9]: AFDK_2024.pdf, pages 56-60
[^src10]: AFDK_2024.pdf, pages 106-110
