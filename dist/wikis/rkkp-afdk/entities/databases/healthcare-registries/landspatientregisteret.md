---
title: Landspatientregisteret
type: entity
aliases:
  - Landspatientregistret
  - LPR
  - Landspatientregisteret (LPR)
wiki: rkkp-afdk
updated: '2026-08-05T19:24:43.390Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: >-
      1-5, 106-110, 11-15, 111-115, 21-25, 46-50, 51-55, 56-60, 61-65, 71-75,
      76-80, 81-85, 91-95
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: >-
      1-5, 11-15, 16-20, 36-40, 41-45, 46-50, 51-55, 56-60, 61-65, 66-70, 71-75,
      81-85, 86-90
tags:
  - database
---
The **Landspatientregisteret** (Danish National Patient Register, often abbreviated as LPR) is a national health database that serves as the primary data source for identifying patients with [[atrieflimren|atrieflimren]] (atrial fibrillation) in Denmark. Within the context of the [[databasen-for-atrieflimren-i-danmark|Databasen for Atrieflimren i Danmark]] (AFDK) and its annual reports, the register forms the foundational dataset for calculating nearly all clinical quality indicators and epidemiological metrics [^src1] [^src23].

The register captures diagnostic and procedural data from public hospitals, utilizing ICD-10 codes such as [[di48|DI48]] to identify atrial fibrillation cases [^src16] [^src19]. It is instrumental in defining both incident and prevalent patient populations; for example, prevalent populations are frequently defined as individuals alive on a specific snapshot date (such as July 1, 2022, or July 1, 2023) who received an atrial fibrillation diagnosis in the register at least once within the preceding 10 years [^src12] [^src13]. Beyond atrial fibrillation, the LPR provides critical data on comorbidities and outcomes, including heart failure (used for the [[hjertesvigtsindikatoren|Hjertesvigtsindikatoren]]) [^src17], [[iskaemisk-apopleksi|iskæmisk apopleksi]] [^src26], and [[intrakraniel-bloedning|intrakraniel blødning]] [^src5]. Consequently, it is the underlying data source for a vast array of quality indicators, including [[indikator-1|Indikator 1]] [^src21], [[indikator-2|Indikator 2]] [^src24], [[indikator-4a|Indikator 4a]] [^src3], [[indikator-4a3|Indikator 4a3]] [^src11], [[indikator-4b|Indikator 4b]] [^src4], [[indikator-5|Indikator 5]] [^src22], [[indikator-6|Indikator 6]] [^src14], [[indikator-7|Indikator 7]] [^src6], [[indikator-8|Indikator 8]] [^src15], and [[indikator-10|Indikator 10]] [^src8].

Despite its central role, the AFDK reports highlight significant limitations and data quality issues associated with the Landspatientregisteret. The validity of the atrial fibrillation diagnosis is generally considered high based on historical validation studies, but the reports acknowledge the presence of false-positive diagnoses [^src23]. Furthermore, there is a known issue with underreporting of specific procedures; for instance, validation work has revealed a substantial lack of performance reporting for echocardiography to the register, particularly from hospital departments operating under the [[sundhedsplatformen|Sundhedsplatformen]] [^src2] [^src24]. Additionally, the register lacks data from private hospitals because the [[sundhedsdatastyrelsen|Sundhedsdatastyrelsen]] does not deliver these specific records, creating gaps in the overall clinical picture [^src2] [^src24]. There is also a recognized risk that patients with competing severe illnesses may not have their atrial fibrillation diagnosis reported to the register, even if it was clinically established [^src19].

## Mentions

- Page 5: "Rapporten omfatter alle patienter med diagnosen atrieflimren indberettet til Landspatientregisteret fra offentlige sygehuse" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 1-5)
- Page 22: "Data vedrørende ekkokardiografi stammer både fra Landspatientregisteret og fra Sygesikringsregisteret." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 21-25)
- Page 22: "Ekkokardiografi, som er foretaget på privathospitaler og indberettet til Landspatientregisteret, indgår ikke, da Sundhedsdatastyrelsen ikke leverer disse data." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 21-25)
- Page 22: "Valideringsarbejde udført af styregruppen har vist, at der forekommer en betydelig grad af manglende ydelses-rapportering af ekkokardiografi til Landspatientregisteret, især fra afdelinger, der arbejder under Sundhedsplatformen." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 21-25)
- Page 47: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 46-50)
- Page 53: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 51-55)
- Page 65: "Oplysningerne vedrørende intrakraniel blødning indhentes fra Landspatientregistret og omfatter følgende diagnoser: DI60 (subaraknoidal blødning), DI61 (hjerneblødning), DI62 (andre ikke-traumatiske intrakranielle blødninger), DS064 (traumatisk epidural blødning), DS065 (traumatisk subdural blødning) og DS066 (traumatisk subarachnoidal blødning)." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 61-65)
- Page 72: "alle personer, som var i live pr. 1. juli 2022, og som har fået diagnosen registeret i Landspatientregisteret mindst én gang inden for de foregående 10 år." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 71-75)
- Page 72: "Større blødning er defineret som en akut indlæggelse med blødning og er identificeret via data fra Landspatientregistret." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 71-75)
- Page 79: "Information omkring patienters deltagelse i et struktureret undervisningsprogram indhentes fra Landspatientregisteret..." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 76-80)
- Page 109: "alle personer, som var i live pr. 1. juli 2022, og som har fået diagnosen registeret i Landspatientregisteret mindst én gang inden for de foregående 10 år" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 106-110)
- Page 112: "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*) og er identificeret via data fra Landspatientregistret." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 111-115)
- Page 115: "Koder for ekkokardiografi i
Landspatientregisteret:
UXUC80 (transthorakal
ekkokardiografi)
UXUC80A (transthorakal stress
ekkokardiografi);
UXUC80B (transthorakal
ekkokardiografi med dobutamin test)" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 111-115)
- Page 14: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 11-15)
- Page 37: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 36-40)
- Page 48: "Indikatoren er opgjort på baggrund af data om akut apopleksi fra LPR frem for databasen DanStroke." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 46-50)
- Page 48: "Datagrundlag og beregningsregler
Indikator 5 opgøres for alle prævalente patienter med en atrieflimren-diagnose, dvs. alle personer, som var i live pr.
1. juli 2023, og som havde fået diagnosen registeret i Landspatientregisteret (LPR) mindst én gang inden for de
foregående 10 år." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 46-50)
- Page 54: "opgøres for alle prævalente patienter med en atrieflimren-diagnose, dvs. alle personer, som var i live pr. 1. juli 2023, og som har fået diagnosen registeret i Landspatientregisteret mindst én gang inden for de foregående 10 år." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 51-55)
- Page 60: "Landspatientregistret. Alvorlige blødninger defineres som intrakranielle blødninger, gastrointestinale blødninger, urinvejsblødninger og blødninger fra lungerne." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 56-60)
- Page 65: "Information omkring patienters deltagelse i et struktureret undervisningsprogram indhentes fra Landspatientregisteret." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 61-65)
- Page 67: "Patienter med atrieflimren omfatter patienter, som er blevet registreret i Landspatientregisteret og i praksissystemerne hos de praktiserende kardiologer med ICD-10 diagnosen DI48" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 66-70)
- Page 68: "Patienterne er identificeret via et udtræk fra Landspatientregisteret samt praksissystemerne" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 66-70)
- Page 81: "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*) og er identificeret via data fra Landspatientregistret." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 81-85)
- Page 86: "Landspatientregisteret" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 86-90)
- Page 81: "Patienter med atrieflimren omfatter patienter, som er blevet registreret i Landspatientregistret med ICD-10 diagnosen DI48 (inkl. alle subkoder) som enten aktions- eller bidiagnose." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 81-85)
- Page 81: "Patienterne er identificeret via et udtræk fra Landspatientregisteret, og databasen er således per definition komplet, såfremt patienterne er blevet indberettet korrekt til Landspatientregisteret." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 81-85)
- Page 92: "Andel af atrieflimren patienter indlagt med I63 + I64 (LPR baseret)" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 91-95)
- Page 92: "Prævalente patienter med atrieflimren, der udvikler iskæmisk apopleksi i opgørelses perioden (LPR-baseret)" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 91-95)
- Page 15: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 11-15)
- Page 58: "Datagrundlag og beregningsregler
Indikator 5 opgøres for alle prævalente patienter med en atrieflimren-diagnose, dvs. alle personer, som var i
live pr. 1. juli 2022, og som havde fået diagnosen registeret i Landspatientregisteret (LPR) mindst én gang
inden for de foregående 10 år." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 56-60)
- Page 4: "alle patienter med diagnosen atrieflimren indberettet til
Landspatientregisteret fra offentlige sygehuse" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 1-5)
- Page 4: "falsk positive diagnoser for atrieflimren i Landspatientregisteret" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 1-5)
- Page 19: "Data vedrørende ekkokardiografi stammer både fra Landspatientregisteret og fra Sygesikringsregisteret." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 16-20)
- Page 43: "Landspatientregisteret" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45)
- Page 71: "Andel af atrieflimren patienter indlagt med iskæmisk apopleksi/apopleksi af ukendt type, som har
indløst recept på oral AK-behandling indenfor 100 dage før dato for indlæggelse med apopleksi
Andel af atrieflimren
patienter indlagt med I63 +
I64 (LPR baseret)" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 71-75)
- Page 73: "Prævalente patienter med atrieflimren, der
udvikler iskæmisk apopleksi i opgørelses perioden
(LPR-baseret)" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 71-75)

## Relationships

Outgoing (this entity is the SUBJECT of these relationships):
- Subject: landspatientregisteret
  Predicate: provides-data-to
  Object: indikator-4a
  Evidence: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret."
  Page: 47
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 46-50
- Subject: landspatientregisteret
  Predicate: supports
  Object: atrieflimren
  Evidence: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)"
  Page: 14
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 11-15
- Subject: landspatientregisteret
  Predicate: provides-diagnosis-data-for
  Object: atrieflimren
  Evidence: "diagnosen registeret i Landspatientregisteret mindst én gang inden for de foregående 10 år"
  Page: 86
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 86-90
- Subject: landspatientregisteret
  Predicate: is-primary-data-source-for
  Object: atrieflimren-i-danmark
  Evidence: "alle patienter med diagnosen atrieflimren indberettet til Landspatientregisteret"
  Page: 4
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 1-5
- Subject: landspatientregisteret
  Predicate: does-not-contain-data-from
  Object: sundhedsdatastyrelsen
  Evidence: "da Sundhedsdatastyrelsen ikke leverer disse data."
  Page: 19
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 16-20
- Subject: landspatientregisteret
  Predicate: is-source-for
  Object: iskaemisk-apopleksi
  Evidence: "Andel af atrieflimren patienter indlagt med iskæmisk apopleksi/apopleksi af ukendt type, som har
indløst recept på oral AK-behandling indenfor 100 dage før dato for indlæggelse med apopleksi
Andel af atrieflimren
patienter indlagt med I63 +
I64 (LPR baseret)"
  Page: 71
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 71-75
- Subject: landspatientregisteret
  Predicate: is-source-for
  Object: intrakraniel-bloedning
  Evidence: "Prævalente patienter med atrieflimren, der
udvikler intrakraniel blødning i opgørelses
perioden"
  Page: 74
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 71-75

Incoming (this entity is the OBJECT of these relationships):
- Subject: indikator-2
  Predicate: is-based-on-data-from
  Object: (this entity)
  Evidence: "Data vedrørende ekkokardiografi stammer både fra Landspatientregisteret og fra Sygesikringsregisteret."
  Page: 22
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 21-25
- Subject: indikator-4b
  Predicate: is-calculated-using
  Object: (this entity)
  Evidence: "Populationen i Indikator 4b udgøres af den prævalente gruppe af patienter med en atrieflimren-diagnose, som er i DOAC-behandling... Den prævalente population defineres som alle personer, som var i live pr. 1. juli 2022, og som havde fået diagnosen registreret i Landspatientregisteret mindst én gang inden for de foregående 10 år."
  Page: 53
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 51-55
- Subject: indikator-5
  Predicate: is-calculated-using
  Object: (this entity)
  Evidence: "Indikator 5: Incidens af iskæmisk apopleksi blandt prævalente patienter med atrieflimren."
  Page: 54
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 51-55
- Subject: indikator-6
  Predicate: is-calculated-from
  Object: (this entity)
  Evidence: "Oplysningerne vedrørende intrakraniel blødning indhentes fra Landspatientregistret"
  Page: 65
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 61-65
- Subject: indikator-7
  Predicate: is-calculated-using-data-from
  Object: (this entity)
  Evidence: "Indikator 7 opgøres for alle prævalente patienter med en atrieflimren-diagnose [...] og større blødning er identificeret via data fra Landspatientregistret"
  Page: 72
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 71-75
- Subject: indikator-8
  Predicate: uses-data-from
  Object: (this entity)
  Evidence: "Information omkring patienters deltagelse i et struktureret undervisningsprogram indhentes fra Landspatientregisteret"
  Page: 79
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 76-80
- Subject: indikator-10
  Predicate: uses-data-from
  Object: (this entity)
  Evidence: "Mortaliteten opgøres for alle prævalente patienter med en atrieflimren-diagnose, dvs. alle personer, som var i live pr. 1. juli 2022, og som har fået diagnosen registeret i Landspatientregisteret mindst én gang inden for de foregående 10 år."
  Page: 109
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 106-110
- Subject: indikator-4a3
  Predicate: is-calculated-from
  Object: (this entity)
  Evidence: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret."
  Page: 37
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 36-40
- Subject: indikator-5
  Predicate: uses-data-from
  Object: (this entity)
  Evidence: "Indikatoren er opgjort på baggrund af data om akut apopleksi fra LPR frem for databasen DanStroke."
  Page: 48
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 46-50
- Subject: indikator-6
  Predicate: uses-data-source
  Object: (this entity)
  Evidence: "opgøres for alle prævalente patienter med en atrieflimren-diagnose, dvs. alle personer, som var i live pr. 1. juli 2023, og som har fået diagnosen registeret i Landspatientregisteret mindst én gang inden for de foregående 10 år."
  Page: 54
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 51-55
- Subject: indikator-7
  Predicate: uses-data-from
  Object: (this entity)
  Evidence: "Større blødning er defineret som en akut indlæggelse med blødning og er identificeret via data fra Landspatientregistret."
  Page: 60
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 56-60
- Subject: indikator-8
  Predicate: relies-on-data-from
  Object: (this entity)
  Evidence: "Information omkring patienters deltagelse i et struktureret undervisningsprogram indhentes fra Landspatientregisteret."
  Page: 65
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 61-65
- Subject: databasen-for-atrieflimren-i-danmark
  Predicate: uses
  Object: (this entity)
  Evidence: "Patienterne er identificeret via et udtræk fra Landspatientregisteret samt praksissystemerne"
  Page: 68
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 66-70
- Subject: hjertesvigtsindikatoren
  Predicate: is-calculated-using
  Object: (this entity)
  Evidence: "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*) og er identificeret via data fra Landspatientregistret."
  Page: 81
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 81-85
- Subject: databasen-for-atrieflimren-i-danmark
  Predicate: is-populated-from
  Object: (this entity)
  Evidence: "Patienterne er identificeret via et udtræk fra Landspatientregisteret"
  Page: 81
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 81-85
- Subject: di48
  Predicate: is-used-in
  Object: (this entity)
  Evidence: "Patienter med atrieflimren omfatter patienter, som er blevet registreret i Landspatientregistret med ICD-10 diagnosen DI48"
  Page: 81
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 81-85
- Subject: indikator-5
  Predicate: has-primary-dataset
  Object: (this entity)
  Evidence: "Andel af atrieflimren patienter indlagt med I63 + I64 (LPR baseret)"
  Page: 92
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 91-95
- Subject: indikator-1
  Predicate: uses-data-from
  Object: (this entity)
  Evidence: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)."
  Page: 15
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 11-15
- Subject: indikator-5
  Predicate: uses-data-from
  Object: (this entity)
  Evidence: "I modsætning til tidligere er indikatoren i år opgjort på baggrund af data om akut apopleksi fra LPR frem for databasen DanStroke."
  Page: 58
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 56-60
- Subject: indikator-2
  Predicate: uses-data-from
  Object: (this entity)
  Evidence: "Data vedrørende ekkokardiografi stammer både fra Landspatientregisteret og fra Sygesikringsregisteret."
  Page: 19
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 16-20
- Subject: sundhedsplatformen
  Predicate: associated-with-poor-reporting-to
  Object: (this entity)
  Evidence: "især fra afdelinger, der arbejder under Sundhedsplatformen."
  Page: 19
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 16-20
- Subject: indikator-4b
  Predicate: uses-data-from
  Object: (this entity)
  Evidence: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret."
  Page: 43
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45
- Subject: indikator-5
  Predicate: uses-data-from
  Object: (this entity)
  Evidence: "Indikator 5: Incidens af apopleksi blandt prævalente patienter med atrieflimren (LPR-baseret)"
  Page: 45
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45

## Claims

- I alt er der identificeret 19.671 incidente patienter og 134.810 prævalente patienter med atrieflimren [^src1] (afdk-aarsrapport-2023, landspatientregisteret)
  Type: epidemiological
  Page: 5
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 1-5
- Indikator 5 er opgjort for alle prævalente patienter med en atrieflimren-diagnose, dvs. alle personer, som var i live pr. 1. juli 2023, og som havde fået diagnosen registeret i Landspatientregisteret (LPR) mindst én gang inden for de foregående 10 år [^src1] (indikator-5, landspatientregisteret)
  Type: definition
  Page: 48
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 46-50
- Patienter med atrieflimren omfatter patienter, som er blevet registreret i Landspatientregisteret og i praksissystemerne hos de praktiserende kardiologer med ICD-10 diagnosen DI48 (inkl. alle subkoder) [^src2] (databasen-for-atrieflimren-i-danmark, landspatientregisteret, di48)
  Type: definition
  Page: 67
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 66-70
- Patientforløb, validitet er ikke opgjort, men skønnes meget høj på baggrund af tidligere valideringsstudier i Landspatientregisteret af atrieflimren diagnosen (se bl.a. Sundbøl et al. BMJ Open. 2016;6(11):e01283 og Rix et al. Scand Cardiovasc J. 2012;46:149-53) [^src4] (databasen-for-atrieflimren-i-danmark, landspatientregisteret)
  Type: validation
  Page: 69
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 66-70
- Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*) [^src1] (hjertesvigtsindikatoren, landspatientregisteret)
  Type: definition
  Page: 81
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 81-85
- Patienter med atrieflimren omfatter patienter, som er blevet registreret i Landspatientregistret med ICD-10 diagnosen DI48 (inkl. alle subkoder) som enten aktions- eller bidiagnose [^src1] (databasen-for-atrieflimren-i-danmark, landspatientregisteret, di48)
  Type: definition
  Page: 81
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 81-85
- Der vil formentlig forekomme patienter med atrieflimren og andre konkurrerende sygdomme, hvor atrieflimren ikke bliver indberettet til Landspatientregisteret til trods for, at diagnosen er blevet stillet klinisk [^src1] (databasen-for-atrieflimren-i-danmark, landspatientregisteret)
  Type: limitation
  Page: 81
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 81-85
- Patientforløb, validitet er ikke opgjort, men skønnes meget høj på baggrund af tidligere valideringsstudier i Landspatientregisteret af atrieflimren diagnosen (se bl.a. Sundbøl et al. BMJ Open. 2016;6(11):e01283 og Rix et al. Scand Cardiovasc J. 2012;46:149-53) [^src1] (databasen-for-atrieflimren-i-danmark, landspatientregisteret)
  Type: validity-assessment
  Page: 82
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 81-85
- I alt er der identificeret 22.073 incidente patienter og 136.420 prævalente patienter med atrieflimren [^src1] (atrieflimren-i-danmark, landspatientregisteret)
  Type: epidemiological
  Page: 4
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 1-5
- Valideringsarbejde har vist en betydelig grad af manglende ydelses-rapportering af ekkokardiografi til Landspatientregisteret, især fra afdelinger under Sundhedsplatformen [^src1] (indikator-2, sundhedsplatformen, landspatientregisteret)
  Type: limitation
  Page: 19
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 16-20

## Timeline

- 2022-07-01: Definition af den prævalente population for Indikator 4b: Alle personer, som var i live pr. 1. juli 2022, og som havde fået diagnosen registreret i Landspatientregisteret mindst én gang inden for de foregående 10 år (indikator-4b, landspatientregisteret)

## Sources

[^src1]: AFDK_2023.pdf, pages 1-5
[^src2]: AFDK_2023.pdf, pages 21-25
[^src3]: AFDK_2023.pdf, pages 46-50
[^src4]: AFDK_2023.pdf, pages 51-55
[^src5]: AFDK_2023.pdf, pages 61-65
[^src6]: AFDK_2023.pdf, pages 71-75
[^src7]: AFDK_2023.pdf, pages 76-80
[^src8]: AFDK_2023.pdf, pages 106-110
[^src9]: AFDK_2023.pdf, pages 111-115
[^src10]: AFDK_2024.pdf, pages 11-15
[^src11]: AFDK_2024.pdf, pages 36-40
[^src12]: AFDK_2024.pdf, pages 46-50
[^src13]: AFDK_2024.pdf, pages 51-55
[^src14]: AFDK_2024.pdf, pages 56-60
[^src15]: AFDK_2024.pdf, pages 61-65
[^src16]: AFDK_2024.pdf, pages 66-70
[^src17]: AFDK_2024.pdf, pages 81-85
[^src18]: AFDK_2024.pdf, pages 86-90
[^src19]: AFDK_2023.pdf, pages 81-85
[^src20]: AFDK_2023.pdf, pages 91-95
[^src21]: AFDK_2023.pdf, pages 11-15
[^src22]: AFDK_2023.pdf, pages 56-60
[^src23]: AFDK_2024.pdf, pages 1-5
[^src24]: AFDK_2024.pdf, pages 16-20
[^src25]: AFDK_2024.pdf, pages 41-45
[^src26]: AFDK_2024.pdf, pages 71-75
