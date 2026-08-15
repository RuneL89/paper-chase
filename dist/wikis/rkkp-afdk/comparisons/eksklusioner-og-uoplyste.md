---
title: Eksklusioner og uoplyste
type: comparison
aliases:
  - Eksklusioner og uoplyste
wiki: rkkp-afdk
updated: '2026-08-14T22:19:00.696Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '106-110, 11-15, 15, 71-75, 76-80, 79, 86-90, 96-100'
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: >-
      101-105, 11-15, 14, 21-25, 31-35, 41-45, 51-55, 56-60, 6-10, 61-65, 66-70,
      71-75, 86-90, 91-95
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: >-
      1-5, 11-15, 26-30, 41-45, 51-55, 6-10, 61-65, 66-70, 71-75, 76-80, 81-85,
      86-90, 91-95, 96-98
tags:
  - comparison
---
The comparison analyzes the reasons for patient exclusions from clinical quality indicators related to [[atrieflimren|atrial fibrillation]], specifically focusing on [[indikator-1|Indikator 1]] and [[indikator-8|Indikator 8]]. Understanding these exclusions is critical for evaluating the denominator of quality metrics and ensuring that patients are appropriately filtered based on clinical guidelines, such as the [[cha2ds2-vasc|CHA2DS2-VASc]] score for [[antikoagulationsbehandling|anticoagulation therapy]].

For [[indikator-1|Indikator 1]], the leading reason for exclusion in both the 2023 and 2024 reports is the lack of indication for [[antikoagulationsbehandling|anticoagulation therapy]] (defined as a [[cha2ds2-vasc|CHA2DS2-VASc]] score < 2) [^src1] [^src3]. In 2023, this accounted for 8,262 excluded patients [^src1]. By 2024, this number increased to 9,158 patients, remaining the overwhelming leader among exclusion criteria [^src3]. The trailer (lowest value) for [[indikator-1|Indikator 1]] in 2023 was the exclusion due to lacking Danish residency or having a replacement CPR number, with 269 patients [^src1]. In 2024, the lowest value was an outlier category for patients with an unknown municipality of residence, accounting for only 9 exclusions [^src3].

Comparing the 2023 and 2024 data for [[indikator-1|Indikator 1]] reveals an upward trend in the primary exclusion category (lack of [[antikoagulationsbehandling|anticoagulation]] indication), which grew from 8,262 to 9,158 [^src1] [^src3]. Exclusions due to death within 30 days of diagnosis slightly decreased from 471 in 2023 [^src1] to 430 in 2024 [^src3]. Exclusions for non-Danish residency or replacement CPR numbers remained relatively flat, moving from 269 [^src1] to 274 [^src3]. The 2024 data also introduces new exclusion categories not present in the 2023 table, such as non-incident patients (773 exclusions) and unknown municipality (9 exclusions) [^src3].

For [[indikator-8|Indikator 8]], the 2023 data shows a different set of exclusion criteria [^src2]. The leader here is death within one year after the diagnosis date, accounting for 2,242 exclusions [^src2]. The trailer is the lack of Danish residency or replacement CPR number, with 237 exclusions [^src2]. This highlights how different indicators apply distinct temporal and clinical filters to the [[atrieflimren|atrial fibrillation]] patient population.

## Table: AFDK_2023.pdf, p. 15

Rows compare: Årsag · Columns show: Antal

| Antal | Årsag |
| --- | --- |
| 269 | Eksklusion: Patienten har ikke bopæl i DK eller har et erstatnings CPRnr |
| 8.262 | Patienten har ikke indikation for AK behandling (CHAD2DS2-VASc < 2) |
| 471 | Patienten dør inden for 30 dage efter diagnosedato |

Entities: indikator-1

Summary: Tabellen viser antallet og årsagen til eksklusioner fra Indikator 1-beregningen, hvor størstedelen (8.262) udelukkes pga. manglende indikation for antikoagulationsbehandling.

## Table: AFDK_2023.pdf, p. 79

Rows compare: Årsag · Columns show: Antal

| Årsag | Antal |
| --- | --- |
| Eksklusion: 237 Patienten har ikke bopæl i DK eller har et erstatnings CPRnr | 237 |
| 2.242 Patienten dør inden for 1 år efter diagnosedato | 2242 |

Entities: indikator-8

Summary: Tabellen viser antallet af patienter ekskluderet fra beregningen af Indikator 8, fordelt på to årsager: manglende bopæl i Danmark eller erstatnings-CPR-nummer (237 personer) og død inden for 1 år efter diagnosedato (2.242 personer).

## Table: AFDK_2024.pdf, p. 14

Rows compare: årsag-til-eksklusion · Columns show: antal

| Årsag | Antal |
| --- | --- |
| Eksklusion: 274 | Patienten har ikke bopæl i DK eller har en erstatnings CPRnr |
| 773 | Patienten er ikke incident (har en anden AF diagnose inden for de sidste 10 år) |
| 9.158 | Patienten har ikke indikation for AK-behandling (CHAD2DS2-VASc < 2) |
| 9 | Patientens bopælskommune er ukendt |
| 430 | Patienten dør inden for 30 dage efter diagnosedato |

Entities: atrieflimren, antikoagulationsbehandling, cha2ds2-vasc

Summary: Tabellen viser antallet af patienter ekskluderet fra Indikator 1-beregningen og de specifikke årsager, hvoraf den største gruppe (9.158) mangler indikation for antikoagulationsbehandling ifølge CHA2DS2-VASc-score < 2.

## Related comparisons in prose

- "Standarden for behandlingsdækning med antikoagulation hos patienter med atrieflimren er ≥ 90 %" — see [[healthcare-quality-standards|Healthcare Quality Standards]] ([[atrieflimren]], [[antikoagulationsbehandling]]) [^src4]
- "Standard for Indikator 8 er ≥50%" — see [[quality-standard|Quality Standard]] ([[indikator-8|Indikator 8]]) [^src5]
- "Indikator 1 har standarden ≥ 90 % for andelen af nydiagnosticerede patienter med atrieflimren, der har ventetid på max. 30 dage fra diagnosticering til opstart i antikoagulations behandling (hvor antikoagulations behandling er indiceret)" — see [[quality-standard|Quality Standard]] ([[atrieflimren]], [[antikoagulationsbehandling]], [[indikator-1|Indikator 1]]) [^src6]
- "Indikator 2 har standarden ≥ 80 % for andelen af nydiagnosticerede patienter med atrieflimren, der har fået udført ekkokardiografi fra 6 måneder før til 3 måneder efter 1. diagnosedato" — see [[quality-standard|Quality Standard]] ([[atrieflimren]]) [^src6]
- "Indikator 3 har standarden ≥ 95 % for andelen af nydiagnosticerede patienter med atrieflimren, som får målt TSH fra 2 måneder før, til 1 måned efter 1. diagnosedato" — see [[quality-standard|Quality Standard]] ([[atrieflimren]]) [^src6]
- "Indikator 4a1 har standarden ≥ 90 % for andelen af patienter med atrieflimren, med indikation for antikoagulationsbehandling, der modtager behandling 1 år efter indeksdato" — see [[quality-standard|Quality Standard]] ([[atrieflimren]], [[antikoagulationsbehandling]]) [^src6]
- "Indikator 4a2 har standarden ≥ 90 % for andelen af patienter med atrieflimren, med indikation for antikoagulationsbehandling, der modtager behandling 2 år efter indeksdato" — see [[quality-standard|Quality Standard]] ([[atrieflimren]], [[antikoagulationsbehandling]]) [^src6]
- "Indikator 4a3 har standarden ≥ 90 % for andelen af patienter med atrieflimren, med indikation for antikoagulationsbehandling, der modtager behandling 5 år efter indeksdato" — see [[quality-standard|Quality Standard]] ([[atrieflimren]], [[antikoagulationsbehandling]]) [^src6]
- "Indikator 4b har standarden ≥ 95 % for andelen af prævalente patienter med atrieflimren i Direkte Orale antikoagulantia (DOAC) med mindst 1 måling af S-creatinin årligt" — see [[quality-standard|Quality Standard]] ([[atrieflimren]]) [^src6]
- "Indikator 5 har standarden ≤ 0,8 % for incidensen af apopleksi blandt prævalente patienter med atrieflimren" — see [[quality-standard|Quality Standard]] ([[atrieflimren]]) [^src6]
- "Indikator 6 har standarden ≤ 0,6 % for incidensen af intrakraniel blødning blandt prævalente patienter med atrieflimren" — see [[quality-standard|Quality Standard]] ([[atrieflimren]]) [^src6]
- "Indikator 7 har ingen angivet standard, men rapporterer incidensen af alvorlig blødning (tillempede ISTH-kriterier) blandt prævalente patienter med atrieflimren" — see [[quality-standard|Quality Standard]] ([[atrieflimren]]) [^src6]
- "Indikator 8 har standarden ≥ 50 % for andelen af nydiagnosticerede patienter med atrieflimren, som får et struktureret undervisningsprogram indenfor det 1. år efter at diagnosen er stillet" — see [[quality-standard|Quality Standard]] ([[atrieflimren]], [[indikator-8|Indikator 8]]) [^src6]
- "Standarden for Indikator 8 er ≥ 50%" — see [[quality-standard|Quality Standard]] ([[indikator-8|Indikator 8]]) [^src7]
- "På landsplan blev 92% af de nydiagnosticerede atrieflimren patienter med en CHA2DS2-VASc score ≥2 sat i oral antikoagulationsbehandling senest 30 dage efter diagnosticering" — see [[performance|Performance]] ([[indikator-1|Indikator 1]], [[atrieflimren]], [[antikoagulationsbehandling]], [[cha2ds2-vasc|CHA2DS2-VASc]]) [^src8]
- "Standarden på ≥ 90% er således opfyldt på landsplan og har været det de sidste to årsrapportsperioder" — see [[performance|Performance]] ([[indikator-1|Indikator 1]]) [^src8]
- "På regionsplan varierede andelen mellem 90 – 95% og standarden er således for første gang opfyldt i alle regioner" — see [[performance|Performance]] ([[indikator-1|Indikator 1]]) [^src8]
- "På hospitalsniveau opfyldte 20 standarden hvilket også er det højeste antal hidtil" — see [[performance|Performance]] ([[indikator-1|Indikator 1]]) [^src8]
- "Laveste opfyldelse for en hospitalsenhed er 84%" — see [[performance|Performance]] ([[indikator-1|Indikator 1]]) [^src8]
- "I alt havde 35% af de nydiagnosticerede patienter med atrieflimren modtaget struktureret patientundervisning inden for det første år efter atrieflimren diagnosen blev stillet og standarden på mindst 50% er således ikke opfyldt" — see [[performance|Performance]] ([[indikator-8|Indikator 8]]) [^src9]
- "Regionalt varierede andelen fra 24-43% og ingen regioner opfylder således standarden" — see [[performance|Performance]] ([[indikator-8|Indikator 8]]) [^src9]
- "På landsplan blev 92% af de nydiagnosticerede atrieflimren patienter med en CHA2DS2-VASc score ≥2 sat i oral AK-behandling senest 30 dage efter diagnosticering" — see [[performance|Performance]] ([[atrieflimren]], [[antikoagulationsbehandling]], [[cha2ds2-vasc|CHA2DS2-VASc]]) [^src10]
- "Standarden på ≥ 90% er således opfyldt på landsplan og har ligget kontinuerligt over grænsen de sidste tre årsrapportsperioder" — see [[performance|Performance]] ([[atrieflimren]], [[antikoagulationsbehandling]]) [^src10]
- "På regionsplan varierede andelen mellem 91 – 93% og standarden er således opfyldt i alle regioner" — see [[performance|Performance]] ([[atrieflimren]], [[antikoagulationsbehandling]]) [^src10]
- "Regionernes resultater er meget homogene, men Midtjylland og Nordjylland har marginalt højere målopfyldelse (ca. 93%) end de øvrige (ca. 91%)" — see [[performance|Performance]] ([[atrieflimren]], [[antikoagulationsbehandling]]) [^src10]
- "På Sundhedklyngeniveau opfylder langt størstedelen af klyngerne (18/22) standarden" — see [[performance|Performance]] ([[atrieflimren]], [[antikoagulationsbehandling]]) [^src10]
- "I de fire klynger hvor standarden ikke er opfyldt ligger målopfyldelsen i niveauet 87,5-89,9%" — see [[performance|Performance]] ([[atrieflimren]], [[antikoagulationsbehandling]]) [^src10]
- "Ca. 56% af patienterne havde indløst en recept vedrørende oral AK-behandling inden for 120 dage op til diagnosen stilles i hospitalsregi" — see [[performance|Performance]] ([[atrieflimren]], [[antikoagulationsbehandling]]) [^src10]
- "På landsplan fik 76% af de nydiagnosticerede patienter med atrieflimren målt TSH i perioden fra 60 dage før til 30 dage efter diagnosedatoen" — see [[performance|Performance]] ([[atrieflimren]]) [^src11]
- "På landsplan fik 93,9% den prævalente population af patienter med atrieflimren, som var i DOAC-behandling, målt p-creatinin mindst én gang årligt" — see [[performance|Performance]] ([[atrieflimren]]) [^src12]
- "På landsplan blev 91,6% af de nydiagnosticerede atrieflimren-patienter med indikation for AK-behandling sat i oral AK-behandling senest 30 dage efter diagnosticering" — see [[performance|Performance]] ([[indikator-1|Indikator 1]]) [^src13]
- "Resultaterne har ligget stabilt over grænsen de seneste tre årsrapporter" — see [[performance|Performance]] ([[indikator-1|Indikator 1]]) [^src13]
- "På regionsniveau varierede andelen mellem 90,3% og 93,8%" — see [[performance|Performance]] ([[indikator-1|Indikator 1]]) [^src13]
- "Ca. 55% af patienterne havde indløst en recept vedrørende oral AK-behandling inden for 120 dage op til diagnosen stilles i hospitalsregi" — see [[performance|Performance]] ([[indikator-1|Indikator 1]]) [^src13]
- "For Indikator 1 blev den nationale opfyldelse i perioden 01.07.2023–30.06.2024 målt til 91,6 % (95 % CI: 91,1–92,0)" — see [[performance-data|Performance Data]] ([[indikator-1|Indikator 1]]) [^src6]
- "For Indikator 8 blev den nationale opfyldelse i perioden 01.07.2022–30.06.2023 målt til 15,9 % (95 % CI: 15,4–16,4)" — see [[performance-data|Performance Data]] ([[indikator-8|Indikator 8]]) [^src6]
- "Patienter med en ventetid på max. 30 dage fra diagnosticering til opstart i antikoagulationsbehandling opfylder indikatoren" — see [[definitional|Definitional]] ([[indikator-1|Indikator 1]], [[antikoagulationsbehandling]]) [^src8]
- "Ca. 53% af patienterne havde indløst en recept vedrørende oral antikoagulationsbehandling inden for 120 dage op til diagnosen stilles i hospitalsregi" — see [[pre-hospital-treatment|Pre Hospital Treatment]] ([[antikoagulationsbehandling]]) [^src8]
- "For indikator 1 er nævneren incidente patienter med CHA2DS2-VASc ≥2" — see [[definition|Definition]] ([[cha2ds2-vasc|CHA2DS2-VASc]]) [^src14]
- "For indikator 1 er tælleren patienter i nævneren som har ventetid til opstart i oral AK-behandling inden for tidsrammen 120 dage før til 30 dage efter 1. diagnosedato (udskrivelsesdato ved indlagte forløb)" — see [[definition|Definition]] ([[antikoagulationsbehandling]]) [^src14]
- "For indikator 2 er nævneren hele den incidente population" — see [[definition|Definition]] ([[atrieflimren]]) [^src14]
- "For indikator 3 er nævneren hele den incidente population" — see [[definition|Definition]] ([[atrieflimren]]) [^src14]
- "Indikator 8 måler andelen af nydiagnosticerede patienter med atrieflimren, som får et struktureret undervisningsprogram inden for det første år efter diagnosen" — see [[definition|Definition]] ([[indikator-8|Indikator 8]]) [^src15]
- "Styregruppen har valgt at anse en 90 % målopfyldelse for antikoagulationsbehandling som værende god klinisk praksis" — see [[policy-decision|Policy Decision]] ([[antikoagulationsbehandling]]) [^src16]
- "Andelen af atrieflimren-patienter indlagt med iskæmisk apopleksi/apopleksi af ukendt type, som havde indløst recept på oral antikoagulationsbehandling inden for 100 dage før indlæggelsen, var 65,5 % på nationalt plan" — see [[pharmacovigilance|Pharmacovigilance]] ([[antikoagulationsbehandling]]) [^src17]
- "Flere end 20.000 danskere diagnosticeres årligt med atrieflimren og flere end 130.000 danskere lever med sygdommen" — see [[epidemiology|Epidemiology]] ([[atrieflimren]]) [^src18]
- "Der er observeret stigende persistens til antikoagulationsbehandling i perioden siden 2016, som generelt ligger på et højt niveau sammenlignet med andre lande" — see [[epidemiology|Epidemiology]] ([[antikoagulationsbehandling]]) [^src19]
- "I Danmark udgjorde antallet af prævalente atrieflimren-patienter med intrakraniel blødning 711 ud af 134.710 patienter, hvilket svarer til 0,53 %" — see [[epidemiological|Epidemiological]] ([[atrieflimren]]) [^src20]
- "På landsplan er incidensen af apopleksi blandt prævalente patienter med atrieflimren 0,8% (95% CI: 0,8-0,9)" — see [[epidemiological|Epidemiological]] ([[atrieflimren]]) [^src12]
- "I den aktuelle opgørelsesperiode (01.07.2023 - 30.06.2024) blev 0,5% af de prævalente patienter med atrieflimren indlagt med intrakraniel blødning" — see [[epidemiological|Epidemiological]] ([[atrieflimren]]) [^src21]
- "43,7% af blødningerne optrådte blandt patienter med en CHA2DS2-VASc score på 0 eller 1" — see [[epidemiological|Epidemiological]] ([[cha2ds2-vasc|CHA2DS2-VASc]]) [^src22]
- "Danmark: Gennemsnitsalder for atrieflimren-patienter er 70 år, spredning 12, median 72, minimum 0, maximum 105, antal prævalente patienter 136420." — see [[epidemiological|Epidemiological]] ([[atrieflimren]]) [^src23]
- "Livstidsrisikoen for hjertesvigt efter atrieflimren er 40%, og hjertesvigt er globalt den hyppigste kardiovaskulære dødsårsag blandt patienter med atrieflimren." — see [[epidemiological|Epidemiological]] ([[atrieflimren]]) [^src24]
- "Flere end 20.000 danskere diagnosticeres årligt med atrieflimren og flere end 130.000 danskere lever med sygdommen." — see [[epidemiological|Epidemiological]] ([[atrieflimren]]) [^src24]
- "Fra og med 1.1.2023 er det alene SKS-koden BFKB der anvendes og denne årsrapport er således den sidste hvor de øvrige indgår i beregningen" — see [[policy-change|Policy Change]] ([[indikator-8|Indikator 8]]) [^src9]
- "Den sande prævalens af atrieflimren undervurderes, idet screeningsundersøgelser har påvist, at der findes et betydeligt antal patienter med uerkendt atrieflimren (Svennberg et al. Circulation 2015;131:2176-84)." — see [[limitation|Limitation]] ([[atrieflimren]]) [^src24]
- "Der vil formentlig forekomme patienter med atrieflimren og andre konkurrerende sygdomme, hvor atrieflimren ikke bliver indberettet til Landspatientregisteret til trods for, at diagnosen er blevet stillet klinisk." — see [[limitation|Limitation]] ([[atrieflimren]]) [^src24]
- "På landsplan udvikler 0,8% af den incidente population intrakraniel blødning 1 år efter diagnosen atrieflimren er stillet" — see [[incidence-rate|Incidence Rate]] ([[atrieflimren]]) [^src21]
- "Incidensen af atrieflimren i Danmark var 3,7 pr. 1000 indbyggere i 2023/2024" — see [[incidence-rate|Incidence Rate]] ([[atrieflimren]]) [^src25]
- "Andelen af prævalente patienter med atrieflimren, som udvikler alvorlig blødning, er 2,40% blandt dem på AK-behandling" — see [[incidence-rate|Incidence Rate]] ([[antikoagulationsbehandling]]) [^src26]
- "Indikator 16: Andelen af nydiagnosticerede patienter med atrieflimren, som udvikler hjertesvigt inden for 1 år, var 6,5% (95% CI: 6,1–6,8) for Danmark i perioden 01.07.2021 – 30.06.2022" — see [[incidence-statistic|Incidence Statistic]] ([[atrieflimren]]) [^src27]
- "Mortaliteten for prævalente patienter med atrieflimren var 7,3% på landsplan i perioden 1. juli 2023 til 30. juni 2024" — see [[mortality-rate|Mortality Rate]] ([[atrieflimren]]) [^src25]
- "Andelen af nydiagnosticerede patienter med atrieflimren, der dør inden for 1 år, var 12,5%" — see [[mortality-rate|Mortality Rate]] ([[atrieflimren]]) [^src25]
- "Andelen af prævalente patienter med atrieflimren, som døde i opgørelsesperioden var 7,6% på landsplan" — see [[mortality-statistic|Mortality Statistic]] ([[atrieflimren]]) [^src27]
- "Andelen der dør 1 år efter diagnose er 13,1% med en regional variation på 12,6-14,1%" — see [[mortality-statistic|Mortality Statistic]] ([[atrieflimren]]) [^src27]
- "For incidente patienter anvendes ≥2 som skæringpunkt for indikation for antikoagulationsbehandling hos begge køn, da der ikke gives point for kvindekøn i CHA2DS2-VASc-beregningen" — see [[clinical-guideline|Clinical Guideline]] ([[cha2ds2-vasc|CHA2DS2-VASc]], [[antikoagulationsbehandling]]) [^src28]
- "Der er ved beregningen af CHA2DS2-VASc score ikke givet point for kvindekøn, og ≥2 er derfor anvendt som skæringpunkt for indikation for antikoagulationsbehandling hos begge køn." — see [[clinical-policy|Clinical Policy]] ([[cha2ds2-vasc|CHA2DS2-VASc]], [[antikoagulationsbehandling]]) [^src23]
- "Andelen af nydiagnosticerede patienter med atrieflimren, som udvikler iskæmisk apopleksi inden for 1 år, var 1,1 % i Danmark i perioden 01.07.2021–30.06.2022" — see [[clinical-outcome|Clinical Outcome]] ([[atrieflimren]]) [^src20]
- "Andelen af nydiagnosticerede patienter med atrieflimren, som får intrakraniel blødning inden for 1 år, var 0,7 % i Danmark i perioden 01.07.2021–30.06.2022" — see [[clinical-outcome|Clinical Outcome]] ([[atrieflimren]]) [^src20]
- "I perioden 01.07.2018–30.06.2019 var den nationale andel af patienter med atrieflimren, der modtog antikoagulationsbehandling, 87,3 % (95 % CI: 86,5–88,1)" — see [[clinical-outcome|Clinical Outcome]] ([[atrieflimren]], [[antikoagulationsbehandling]]) [^src4]
- "I perioden 01.07.2018–30.06.2019 var andelen af patienter med atrieflimren, der modtog antikoagulationsbehandling, i Nordjylland 91,1 % (95 % CI: 88,7–93,0)" — see [[clinical-outcome|Clinical Outcome]] ([[atrieflimren]], [[antikoagulationsbehandling]]) [^src4]
- "I perioden 01.07.2018–30.06.2019 var andelen af patienter med atrieflimren, der modtog antikoagulationsbehandling, i Sundhedsklynge Bornholm 80,0 % (95 % CI: 67,7–89,2)" — see [[clinical-outcome|Clinical Outcome]] ([[atrieflimren]], [[antikoagulationsbehandling]]) [^src4]
- "I perioden 01.07.2018–30.06.2019 var andelen af patienter med atrieflimren, der modtog antikoagulationsbehandling, i Klynge NORD 94,1 % (95 % CI: 90,3–96,7)" — see [[clinical-outcome|Clinical Outcome]] ([[atrieflimren]], [[antikoagulationsbehandling]]) [^src4]
- "I perioden 01.07.2018–30.06.2019 var andelen af patienter med atrieflimren, der modtog antikoagulationsbehandling, i Klynge SYD 94,3 % (95 % CI: 88,5–97,7)" — see [[clinical-outcome|Clinical Outcome]] ([[atrieflimren]], [[antikoagulationsbehandling]]) [^src4]
- "I perioden 01.07.2018–30.06.2019 var andelen af patienter med atrieflimren, der modtog antikoagulationsbehandling, i Klynge VEST 83,1 % (95 % CI: 73,3–90,5)" — see [[clinical-outcome|Clinical Outcome]] ([[atrieflimren]], [[antikoagulationsbehandling]]) [^src4]
- "I alt blev 0,6% af de prævalente patienter med atrieflimren indlagt med intrakraniel blødning i den aktuelle opgørelsesperiode og udviklingsmålet (0,6%) er således opfyldt" — see [[clinical-outcome|Clinical Outcome]] ([[atrieflimren]]) [^src29]
- "De seneste to år var andelen 0,5%, men det er for tidligt at tale om en stigning af betydning" — see [[clinical-outcome|Clinical Outcome]] ([[atrieflimren]]) [^src29]
- "På regionalt niveau varierer andelen fra 0,5-0,7%" — see [[clinical-outcome|Clinical Outcome]] ([[atrieflimren]]) [^src29]
- "På klyngeniveau varierer andelen fra 0,3-1,1%" — see [[clinical-outcome|Clinical Outcome]] ([[atrieflimren]]) [^src29]
- "Af de 107.855 prævalente patienter med atrieflimren og på antikoagulationsbehandling udviklede 622 (0,57 %) intrakraniel blødning i opgørelsesperioden" — see [[clinical-outcome|Clinical Outcome]] ([[antikoagulationsbehandling]]) [^src30]
- "Blandt prævalente atrieflimren-patienter med intrakraniel blødning i Danmark havde 36,7 % en CHA2DS2-VASc-score på 1" — see [[clinical-risk-distribution|Clinical Risk Distribution]] ([[cha2ds2-vasc|CHA2DS2-VASc]]) [^src20]
- "41,1% af intrakranielle blødninger optrådte blandt patienter med en CHA2DS2-VASc score på 0 eller 1" — see [[clinical-risk-distribution|Clinical Risk Distribution]] ([[cha2ds2-vasc|CHA2DS2-VASc]]) [^src21]
- "Indikator 4a måler andelen af patienter med atrieflimren med indikation for antikoagulationsbehandling, der modtager behandling 2 år efter diagnosen atrieflimren" — see [[clinical-practice-decision|Clinical Practice Decision]] ([[atrieflimren]], [[antikoagulationsbehandling]]) [^src4]
- "Indikator 4a3 måler andelen af patienter med atrieflimren, med indikation for antikoagulationsbehandling, der modtager behandling 5 år efter indeksdato" — see [[clinical-practice-decision|Clinical Practice Decision]] ([[atrieflimren]], [[antikoagulationsbehandling]]) [^src4]
- "Indikator 1 måler andelen af nydiagnosticerede patienter med atrieflimren, der har ventetid på max. 30 dage fra diagnosticering til opstart i antikoagulations-behandling (hvor antikoagulations-behandling er indiceret)" — see [[quality-indicator|Quality Indicator]] ([[atrieflimren]], [[antikoagulationsbehandling]]) [^src14]
- "Indikator 2 måler andelen af nydiagnosticerede patienter med atrieflimren, der har fået udført ekkokardiografi fra 6 måneder før til 3 måneder efter 1. diagnosedato" — see [[quality-indicator|Quality Indicator]] ([[atrieflimren]]) [^src14]
- "Indikator 3 måler andelen af nydiagnosticerede patienter med atrieflimren, som får målt TSH fra 60 dage før til 30 dage efter 1. diagnosedato" — see [[quality-indicator|Quality Indicator]] ([[atrieflimren]]) [^src14]
- "Indikator 8 måler andelen af ny-diagnosticerede patienter med atrieflimren, som får et struktureret undervisningsprogram inden for det 1. år efter diagnosen er stillet" — see [[quality-indicator|Quality Indicator]] ([[indikator-8|Indikator 8]]) [^src31]
- "Indikator 3: Andelen af nydiagnosticerede patienter med atrieflimren, som får målt TSH fra 150 dage før til 30 dage efter 1. diagnosedato" — see [[quality-indicator|Quality Indicator]] ([[atrieflimren]]) [^src32]
- "Indikator 4a: Andelen af patienter med atrieflimren, med indikation for antikoagulationsbehandling, der modtager behandling (ud af den population hvor det er indiceret)" — see [[quality-indicator|Quality Indicator]] ([[antikoagulationsbehandling]], [[atrieflimren]]) [^src32]
- "Indikator 4b: Andelen af patienter med atrieflimren i behandling med direkte orale antikoagulantia (DOAC) med mindst 1 måling af P-creatinin årligt" — see [[quality-indicator|Quality Indicator]] ([[antikoagulationsbehandling]], [[atrieflimren]]) [^src32]
- "Indikator 5: Incidens af iskæmisk apopleksi blandt prævalente patienter med atrieflimren" — see [[quality-indicator|Quality Indicator]] ([[atrieflimren]]) [^src32]
- "Indikator 6: Incidens af intrakraniel blødning blandt prævalente patienter med atrieflimren" — see [[quality-indicator|Quality Indicator]] ([[atrieflimren]]) [^src32]
- "Indikator 7: Incidens af alvorlig blødning (tillempede International Society of Thrombosis and Hemostasis (ISTH) kriterier) blandt prævalente patienter med atrieflimren" — see [[quality-indicator|Quality Indicator]] ([[atrieflimren]]) [^src32]
- "Indikator 8: Andelen af nydiagnosticerede patienter med atrieflimren, som har fået et struktureret undervisningsprogram indenfor 1 år efter diagnosen er stillet" — see [[quality-indicator|Quality Indicator]] ([[atrieflimren]]) [^src32]
- "Indikator 2: Ekkokardiografi: Andel af nydiagnosticerede patienter med atrieflimren, der har fået udført ekkokardiografi fra 6 måneder før til 3 måneder efter 1. diagnosedato" — see [[clinical-indicators|Clinical Indicator]] ([[atrieflimren]]) [^src10]
- "Gennemsnitsalderen for incidente patienter med atrieflimren i Danmark var 74 år" — see [[clinical-indicators|Clinical Indicator]] ([[atrieflimren]]) [^src25]
- "Gennemsnits-CHA2DS2-VASc-scoren for incidente patienter med atrieflimren i Danmark var 1,75" — see [[clinical-indicators|Clinical Indicator]] ([[atrieflimren]], [[cha2ds2-vasc|CHA2DS2-VASc]]) [^src25]
- "60,21% af de incidente patienter med atrieflimren i Danmark havde en CHA2DS2-VASc-score på ≥2" — see [[clinical-indicators|Clinical Indicator]] ([[atrieflimren]], [[cha2ds2-vasc|CHA2DS2-VASc]]) [^src25]
- "Region Syddanmark har den højeste andel blandt regionerne for Indikator 8 i 2023/24 med 20,3 % (95 % CI: 19,1–21,6)" — see [[comparative-result|Comparative Result]] ([[indikator-8|Indikator 8]]) [^src15]
- "Region Sjælland har den laveste andel blandt regionerne for Indikator 8 i 2023/24 med 4,3 % (95 % CI: 3,6–5,0)" — see [[comparative-result|Comparative Result]] ([[indikator-8|Indikator 8]]) [^src15]
- "Midtklyngen er den eneste sundhedsklynge, der opfylder målsætningen på ≥ 50 % for Indikator 8 i 2023/24 med 62,1 % (95 % CI: 58,8–65,3)" — see [[comparative-result|Comparative Result]] ([[indikator-8|Indikator 8]]) [^src15]
- "Sundhedsklyngen SUH har den laveste andel blandt alle klynger for Indikator 8 i 2023/24 med 0,1 % (95 % CI: 0,0–0,5)" — see [[comparative-result|Comparative Result]] ([[indikator-8|Indikator 8]]) [^src15]
- "Atrieflimren er forbundet med øget risiko for slagtilfælde, hjertesvigt, demens, og død" — see [[clinical-risk|Clinical Risk]] ([[atrieflimren]]) [^src18]
- "Gennemsnitsværdien af CHA₂DS₂-VASc-scoren for incidente patienter med atrieflimren i Danmark var 2,60" — see [[clinical-risk|Clinical Risk]] ([[cha2ds2-vasc|CHA2DS2-VASc]]) [^src33]
- "Gennemsnitsværdien af CHA₂DS₂-VASc-scoren for prævalente patienter med atrieflimren i Danmark var 2,02" — see [[clinical-risk|Clinical Risk]] ([[cha2ds2-vasc|CHA2DS2-VASc]]) [^src33]
- "Patientforløb, validitet er ikke opgjort, men skønnes meget høj på baggrund af tidligere valideringsstudier i Landspatientregisteret af atrieflimren diagnosen (se bl.a. Sundbøl et al. BMJ Open. 2016;6(11):e01283 og Rix et al. Scand Cardiovasc J. 2012;46:149-53)." — see [[validation|Validation]] ([[atrieflimren]]) [^src24]
- "Start på antikoagulationsbehandling: 55,6 % af patienterne startede behandlingen inden for 4 måneder før diagnose, mens 44,4 % startede inden for 30 dage efter udskrivelse" — see [[clinical-practice|Clinical Practice]] ([[antikoagulationsbehandling]]) [^src17]
- "I Danmark blev 8.129 patienter startet på antikoagulationsbehandling inden for 4 måneder inden diagnose, hvilket udgør 53,1 % af alle patienter i AK-behandling" — see [[clinical-practice|Clinical Practice]] ([[antikoagulationsbehandling]]) [^src30]
- "I Region Hovedstaden blev 2.086 patienter startet på antikoagulationsbehandling inden for 4 måneder inden diagnose, hvilket udgør 50,6 % af alle patienter i AK-behandling" — see [[clinical-practice|Clinical Practice]] ([[antikoagulationsbehandling]]) [^src30]
- "I Region Sjælland blev 1.221 patienter startet på antikoagulationsbehandling inden for 4 måneder inden diagnose, hvilket udgør 50,5 % af alle patienter i AK-behandling" — see [[clinical-practice|Clinical Practice]] ([[antikoagulationsbehandling]]) [^src30]
- "I Region Syddanmark blev 1.900 patienter startet på antikoagulationsbehandling inden for 4 måneder inden diagnose, hvilket udgør 53,7 % af alle patienter i AK-behandling" — see [[clinical-practice|Clinical Practice]] ([[antikoagulationsbehandling]]) [^src30]
- "I Region Midtjylland blev 1.970 patienter startet på antikoagulationsbehandling inden for 4 måneder inden diagnose, hvilket udgør 56,3 % af alle patienter i AK-behandling" — see [[clinical-practice|Clinical Practice]] ([[antikoagulationsbehandling]]) [^src30]
- "I Region Nordjylland blev 952 patienter startet på antikoagulationsbehandling inden for 4 måneder inden diagnose, hvilket udgør 55,1 % af alle patienter i AK-behandling" — see [[clinical-practice|Clinical Practice]] ([[antikoagulationsbehandling]]) [^src30]
- "Af alle patienter med atrieflimren, der blev indlagt med iskæmisk apopleksi/apopleksi af ukendt type, havde 772 (67,3 %) indløst recept på oral antikoagulationsbehandling inden for 100 dage før indlæggelse" — see [[clinical-practice|Clinical Practice]] ([[antikoagulationsbehandling]]) [^src30]
- "Af alle patienter med atrieflimren, der blev indlagt med iskæmisk apopleksi/apopleksi af ukendt type, havde 248 (64,8 %) i Region Hovedstaden indløst recept på oral antikoagulationsbehandling inden for 100 dage før indlæggelse" — see [[clinical-practice|Clinical Practice]] ([[antikoagulationsbehandling]]) [^src30]
- "Af alle patienter med atrieflimren, der blev indlagt med iskæmisk apopleksi/apopleksi af ukendt type, havde 117 (59,1 %) i Region Sjælland indløst recept på oral antikoagulationsbehandling inden for 100 dage før indlæggelse" — see [[clinical-practice|Clinical Practice]] ([[antikoagulationsbehandling]]) [^src30]
- "Af alle patienter med atrieflimren, der blev indlagt med iskæmisk apopleksi/apopleksi af ukendt type, havde 183 (73,5 %) i Region Syddanmark indløst recept på oral antikoagulationsbehandling inden for 100 dage før indlæggelse" — see [[clinical-practice|Clinical Practice]] ([[antikoagulationsbehandling]]) [^src30]
- "Af alle patienter med atrieflimren, der blev indlagt med iskæmisk apopleksi/apopleksi af ukendt type, havde 132 (67,7 %) i Region Midtjylland indløst recept på oral antikoagulationsbehandling inden for 100 dage før indlæggelse" — see [[clinical-practice|Clinical Practice]] ([[antikoagulationsbehandling]]) [^src30]
- "Af alle patienter med atrieflimren, der blev indlagt med iskæmisk apopleksi/apopleksi af ukendt type, havde 92 (75,4 %) i Region Nordjylland indløst recept på oral antikoagulationsbehandling inden for 100 dage før indlæggelse" — see [[clinical-practice|Clinical Practice]] ([[antikoagulationsbehandling]]) [^src30]
- "Indikator 1 måler andelen af nydiagnosticerede patienter med atrieflimren, der har ventetid på max. 30 dage fra diagnosticering til opstart i antikoagulationsbehandling, hvor behandlingen er indiceret" — see [[quality-indicator-definition|Quality Indicator Definition]] ([[antikoagulationsbehandling]], [[cha2ds2-vasc|CHA2DS2-VASc]]) [^src34]
- "Indikator 8 måler andelen af patienter med atrieflimren, som får et struktureret undervisningsprogram indenfor 1 år efter diagnosen er stillet" — see [[quality-indicator-definition|Quality Indicator Definition]] ([[indikator-8|Indikator 8]]) [^src35]
- "Indikator 1 har et udviklingsmål på ≥ 90 %" — see [[quality-indicator-target|Quality Indicator Target]] ([[indikator-1|Indikator 1]]) [^src36]
- "Indikator 8 har et udviklingsmål på ≥ 50 %" — see [[quality-indicator-target|Quality Indicator Target]] ([[indikator-8|Indikator 8]]) [^src36]
- "For Indikator 1 var andelen for hele Danmark 91,6 % (95 % CI: 91,2–92,0) i perioden 01.07.2024–30.06.2025" — see [[quality-indicator-result|Quality Indicator Result]] ([[indikator-1|Indikator 1]]) [^src36]
- "For Indikator 8 var andelen for hele Danmark 19,2 % (95 % CI: 18,6–19,7) i perioden 01.07.2023–30.06.2024" — see [[quality-indicator-result|Quality Indicator Result]] ([[indikator-8|Indikator 8]]) [^src36]
- "Målsætningen for Indikator 8 er ≥ 50 %" — see [[policy-target|Policy Target]] ([[indikator-8|Indikator 8]]) [^src15]
- "BFKB-koden anvendes som tæller for indikator 8" — see [[coding-assignment|Coding Assignment]] ([[indikator-8|Indikator 8]]) [^src35]
- "Patienter, som dør under den primære indlæggelse, ekskluderes fra beregningen af indikator 8" — see [[exclusion-criteria|Exclusion Criteria]] ([[indikator-8|Indikator 8]]) [^src35]
- "Region Sjælland vurderer, at resultaterne for indikator 8 ikke stemmer overens med den kliniske virkelighed" — see [[critical-assessment|Critical Assessment]] ([[indikator-8|Indikator 8]]) [^src35]
- "Region Sjælland har iværksat en intern undersøgelse af registrerings- og dataflow-fejl i forbindelse med indikator 8" — see [[quality-improvement-action|Quality Improvement Action]] ([[indikator-8|Indikator 8]]) [^src35]

## Sources

[^src1]: AFDK_2023.pdf, pages 15
[^src2]: AFDK_2023.pdf, pages 79
[^src3]: AFDK_2024.pdf, pages 14
[^src4]: AFDK_2024.pdf, pages 31-35
[^src5]: AFDK_2023.pdf, pages 71-75
[^src6]: AFDK_2024.pdf, pages 6-10
[^src7]: AFDK_2024.pdf, pages 61-65
[^src8]: AFDK_2023.pdf, pages 11-15
[^src9]: AFDK_2023.pdf, pages 76-80
[^src10]: AFDK_2024.pdf, pages 11-15
[^src11]: AFDK_2024.pdf, pages 21-25
[^src12]: AFDK_2024.pdf, pages 41-45
[^src13]: AFDK_2025.pdf, pages 11-15
[^src14]: AFDK_2024.pdf, pages 101-105
[^src15]: AFDK_2025.pdf, pages 51-55
[^src16]: AFDK_2025.pdf, pages 1-5
[^src17]: AFDK_2024.pdf, pages 71-75
[^src18]: AFDK_2024.pdf, pages 66-70
[^src19]: AFDK_2025.pdf, pages 26-30
[^src20]: AFDK_2023.pdf, pages 96-100
[^src21]: AFDK_2024.pdf, pages 51-55
[^src22]: AFDK_2024.pdf, pages 56-60
[^src23]: AFDK_2024.pdf, pages 91-95
[^src24]: AFDK_2025.pdf, pages 61-65
[^src25]: AFDK_2024.pdf, pages 86-90
[^src26]: AFDK_2025.pdf, pages 71-75
[^src27]: AFDK_2023.pdf, pages 106-110
[^src28]: AFDK_2023.pdf, pages 86-90
[^src29]: AFDK_2025.pdf, pages 41-45
[^src30]: AFDK_2025.pdf, pages 66-70
[^src31]: AFDK_2025.pdf, pages 81-85
[^src32]: AFDK_2025.pdf, pages 91-95
[^src33]: AFDK_2025.pdf, pages 76-80
[^src34]: AFDK_2025.pdf, pages 86-90
[^src35]: AFDK_2025.pdf, pages 96-98
[^src36]: AFDK_2025.pdf, pages 6-10
