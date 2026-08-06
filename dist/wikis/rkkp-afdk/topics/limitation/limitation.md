---
title: Limitation
type: topic
wiki: rkkp-afdk
updated: '2026-08-05T21:37:28.736Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '121-121, 81-85'
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '16-20, 66-70'
tags:
  - limitation
---
# Limitation

The **Limitation** topic encompasses the various structural, systemic, and operational constraints affecting data completeness and accuracy within the [[databasen-for-atrieflimren-i-danmark|Databasen for Atrieflimren i Danmark]] (AFDK) and its associated quality indicators. These limitations range from inherent coverage gaps in patient populations to technical failures in data capture across regional health platforms.

### Coverage and Prevalence Limitations
The AFDK is fundamentally restricted in its patient coverage. It exclusively relies on patients diagnosed with atrial fibrillation during hospital admissions, which includes ambulatory hospital contacts [^src1]. Consequently, the database currently excludes patients who are treated solely in general practice or by private specialist practitioners [^src1]. Furthermore, the true prevalence of atrial fibrillation in the population is systematically underestimated by the database; screening studies have demonstrated a significant number of patients living with unrecognized atrial fibrillation [^src1], [^src3]. There is also a risk of underreporting for patients with atrial fibrillation and competing comorbidities, where the diagnosis is made clinically but never formally registered in the [[landspatientregisteret|Landspatientregisteret]] [^src1].

### Data Collection and Reporting Issues
Operational workflows and cross-sector referrals introduce significant data blind spots. For instance, when hospital departments refer patients to private hospitals, the subsequent treatment courses often fail to fulfill the requirements of [[indikator-2|Indikator 2]] due to missing data from the private facilities [^src2]. Additionally, validation efforts have uncovered a substantial lack of performance reporting for echocardiography procedures to the [[landspatientregisteret|Landspatientregisteret]], a problem that is particularly pronounced in departments operating under the [[sundhedsplatformen|Sundhedsplatformen]] [^src2].

### System and Local Constraints
Technical limitations in how local laboratories code blood tests also hinder quality monitoring. At [[sygehus-soenderjylland|Sygehus Sønderjylland]], the low target fulfillment for [[indikator-3|Indikator 3]] was traced back to the [[fælles-akut-modtagelse|Fælles Akut Modtagelse]] (FAM), where "diagnostic TSH" is ordered as part of a broader blood test package rather than as an individual test [^src4]. Audits revealed that TSH tests bundled in these packages are assigned a local blood test code instead of the official NPU code required for data extraction. As a result, these tests are entirely missed by the [[regionernes-kliniske-kvalitetsudviklingsprogram|Regionernes Kliniske Kvalitetsudviklingsprogram]] (RKKP) data capture systems, and it remains technically unfeasible for RKKP to capture data using these local codes [^src4].

## Claims

- Patientregistreringen i AFDK vil kun afspejle patienter med erkendt atrieflimren. Den sande prævalens af atrieflimren undervurderes således, idet screeningsundersøgelser har påvist, at der findes et betydeligt antal patienter med uerkendt atrieflimren (Svennberg et al. Circulation 2015;131:2176-84) [^src1] (databasen-for-atrieflimren-i-danmark)
  Type: limitation
  Page: 81
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 81-85
- Der vil formentlig forekomme patienter med atrieflimren og andre konkurrerende sygdomme, hvor atrieflimren ikke bliver indberettet til Landspatientregisteret til trods for, at diagnosen er blevet stillet klinisk [^src1] (databasen-for-atrieflimren-i-danmark, landspatientregisteret)
  Type: limitation
  Page: 81
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 81-85
- Nogle afdelinger henviser patienter til privathospitaler, hvilket medfører, at disse forløb ikke opfylder indikatoren grundet manglende data fra privathospitalet [^src1] (indikator-2)
  Type: limitation
  Page: 19
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 16-20
- Valideringsarbejde har vist en betydelig grad af manglende ydelses-rapportering af ekkokardiografi til Landspatientregisteret, især fra afdelinger under Sundhedsplatformen [^src1] (indikator-2, sundhedsplatformen, landspatientregisteret)
  Type: limitation
  Page: 19
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 16-20
- Den sande prævalens af atrieflimren undervurderes, idet screeningsundersøgelser har påvist, at der findes et betydeligt antal patienter med uerkendt atrieflimren (Svennberg et al. Circulation 2015;131:2176-84) [^src3] (databasen-for-atrieflimren-i-danmark)
  Type: limitation
  Page: 68
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 66-70
- AFDK omfatter ikke aktuelt patienter, som udelukkende behandles i almen praksis [^src3] (databasen-for-atrieflimren-i-danmark)
  Type: limitation
  Page: 68
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 66-70
- AFDK er udelukkende baseret på patienter, som er blevet diagnosticeret med atrieflimren i forbindelse med en hospitalsindlæggelse, inklusiv ambulante hospitalskontakter [^src1] (databasen-for-atrieflimren-i-danmark)
  Type: coverage-limitation
  Page: 81
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 81-85
- AFDK omfatter ikke aktuelt patienter, som udelukkende behandles i almen praksis eller speciallæge praksis [^src1] (databasen-for-atrieflimren-i-danmark)
  Type: coverage-limitation
  Page: 81
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 81-85
- Sygehus Sønderjylland har identificeret at den lave målopfyldelse for Indikator 3 skyldes, at man på Sygehus Sønderjyllands Fælles Akut Modtagelse bestiller ”diagnostisk TSH” som en del af en blodprøvepakke i stedet for TSH enkeltvis [^src1] (sygehus-soenderjylland, indikator-3, faelles-akut-modtagelse)
  Type: data-collection-issue
  Page: 121
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 121-121
- Auditering har vist, at TSH prøver der indgår i pakker ikke er med i den datafangst der laves fra RKKP, da TSH i ”pakken” afrapporteres på en lokal blodprøve kode og ikke den officielle NPU kode, som RKKP anvender til datafangst [^src1] (regionernes-kliniske-kvalitetsudviklingsprogram, faelles-akut-modtagelse)
  Type: data-collection-issue
  Page: 121
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 121-121
- Det er fortsat ikke muligt for RKKP at sikre datafangst på disse koder [^src1] (regionernes-kliniske-kvalitetsudviklingsprogram)
  Type: system-limitation
  Page: 121
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 121-121

## Sources

[^src1]: AFDK_2023.pdf, pages 81-85
[^src2]: AFDK_2024.pdf, pages 16-20
[^src3]: AFDK_2024.pdf, pages 66-70
[^src4]: AFDK_2023.pdf, pages 121-121
