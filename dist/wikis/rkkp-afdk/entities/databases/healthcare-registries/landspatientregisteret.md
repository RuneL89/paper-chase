---
title: Landspatientregisteret
type: entity
aliases:
  - Landspatientregisteret (LPR)
  - Landspatientregistret
  - LPR
wiki: rkkp-afdk
updated: '2026-08-14T19:48:25.001Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: >-
      1-5, 106-110, 11-15, 111-115, 21-25, 46-50, 51-55, 56-60, 61-65, 71-75,
      76-80, 81-85, 91-95
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: >-
      1-5, 11-15, 16-20, 36-40, 41-45, 46-50, 51-55, 56-60, 61-65, 66-70, 71-75,
      81-85, 86-90
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: '1-5, 11-15, 16-20, 26-30, 31-35, 36-40, 41-45, 46-50, 56-60, 6-10, 61-65'
tags:
  - database
---
**Landspatientregisteret** (often abbreviated as LPR) is a national healthcare registry in Denmark that serves as the primary data source for identifying patients with [[atrieflimren|atrial fibrillation]] in the annual reports produced by the [[databasen-for-atrieflimren-i-danmark|Databasen for Atrieflimren i Danmark]] (AFDK) [^src1]. It forms the foundational data infrastructure for calculating nearly all clinical quality indicators monitored by the registry, tracking everything from initial diagnostic procedures to long-term patient outcomes [^src2], [^src5], [^src6], [^src7], [^src8], [^src9].

The registry identifies patient cohorts using specific ICD-10 diagnosis and procedure codes. For instance, atrial fibrillation is primarily identified using the code [[di48|DI48]] [^src35]. The LPR is also utilized to track severe complications and comorbidities, such as [[intrakraniel-bloedning|intracranial bleeding]] (using codes like DI60-DI62 and DS064-DS066) for [[indikator-6|Indikator 6]] [^src5], heart failure for the [[hjertesvigtsindikatoren|heart failure indicator]] [^src9], and major bleeding events for [[indikator-7|Indikator 7]] [^src6]. In recent reporting years, the AFDK explicitly shifted to using LPR data over the DanStroke database to measure the incidence of [[iskaemisk-apopleksi|ischemic stroke]] (codes [[di63|DI63]] and [[di64|DI64]]) for [[indikator-5|Indikator 5]], because DanStroke suffered from missing reports during a system transition [^src24]. The registry also tracks procedural codes, such as those for echocardiography (e.g., UXUC80) used in [[indikator-2|Indikator 2]] [^src2], patient education programs for [[indikator-8|Indikator 8]] [^src7], and rehabilitation contacts like [[dz501|DZ501]] [^src24]. Other indicators relying heavily on LPR data include [[indikator-1|Indikator 1]] (anticoagulation initiation) [^src29], [[indikator-4a|Indikator 4a]] and [[indikator-4b|Indikator 4b]] (treatment persistence and safety monitoring) [^src4], and [[indikator-10|Indikator 10]] (mortality) [^src8].

Despite its central role in Danish health data infrastructure, the LPR has documented limitations that impact data validity. The registry does not include echocardiography data from private hospitals because the [[sundhedsdatastyrelsen|Sundhedsdatastyrelsen]] does not deliver these data [^src32]. Furthermore, validation work has revealed a significant degree of missing service reporting for echocardiography, particularly from hospital departments operating under the [[sundhedsplatformen|Sundhedsplatformen]] electronic health record system [^src21]. There are also concerns regarding false-positive atrial fibrillation diagnoses within the registry [^src31], as well as the likelihood that some clinical AF diagnoses in patients with competing severe diseases are never formally reported to the LPR [^src28].

Epidemiologically, the LPR is used to define both incident and prevalent populations for AFDK indicators. A prevalent patient is typically defined as someone alive on a specific cutoff date (e.g., July 1, 2022, or July 1, 2023) who has had an AF diagnosis registered in the LPR at least once within the preceding 10 years [^src6], [^src12]. Based on LPR data, the 2023 AFDK report identified 19,671 incident and 134,810 prevalent AF patients [^src1], while subsequent reports noted slight increases, such as 22,073 incident and 136,420 prevalent patients in the 2024 report [^src31], and 22,250 incident and 138,889 prevalent patients in the 2025 report [^src19]. Historical validation studies from 2012 and 2016 suggest that the validity of the AF diagnosis in the LPR is generally very high, even though exact validity metrics for patient pathways are not continuously calculated [^src35].

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
- Page 4: "alle patienter med diagnosen atrieflimren indberettet til Landspatientregisteret fra offentlige sygehuse" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 1-5)
- Page 14: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 11-15)
- Page 19: "Data vedrørende ekkokardiografi stammer både fra Landspatientregisteret og fra Sygesikringsregisteret." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 16-20)
- Page 19: "Valideringsarbejde udført af styregruppen har tidligere vist, at der forekommer en betydelig grad af manglende ydelses-rapportering af ekkokardiografi til Landspatientregisteret, især fra afdelinger, der arbejder under Sundhedsplatformen." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 16-20)
- Page 29: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 26-30)
- Page 34: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 31-35)
- Page 39: "Indikatoren er opgjort på baggrund af data om akut apopleksi fra LPR frem for databasen DanStroke. Det skyldes, at DanStroke har været ramt af manglende indberetninger af apopleksitilfælde grundet overgangen til en ny indberetningsmodel i databasen samt enkelt regioners omlægning til nyt EPJ system. Ved at anvende LPR data er nærværende indikator ikke påvirket af de ovenfornævnte forhold i DanStroke." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 36-40)
- Page 39: "Fra Landspatientregisteret er der udtrukket patientforløb med apopleksi (DI63 og DI64) som aktionsdiagnose samt patientforløb med aktionsdiagnosen "Kontakt mhp. anden fysioterapi" (DZ501) i kombination med bi-diagnosen DI63 eller DI64." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 36-40)
- Page 45: "Oplysningerne vedrørende intrakraniel blødning indhentes fra Landspatientregistret" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 41-45)
- Page 50: "Større blødning er defineret som en akut indlæggelse med blødning og er identificeret via data fra Landspatientregistret." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 46-50)
- Page 56: "Information omkring patienters deltagelse i et struktureret undervisningsprogram indhentes fra Landspatientregisteret." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 56-60)
- Page 62: "og er identificeret via data fra Landspatientregistret." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65)
- Page 63: "Patienter med atrieflimren omfatter patienter, som er blevet registreret i Landspatientregisteret og i praksissystemerne hos de praktiserende kardiologer med ICD-10 diagnosen DI48 (inkl. alle subkoder)." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65)
- Page 64: "Patienter, som er registreret med atrieflimren i forbindelse med en hospitalsindlæggelse, inklusiv ambulante hospitalskontakter og kontakter til praktiserende kardiologer. Patienterne er identificeret via et udtræk fra Landspatientregisteret samt praksissystemerne..." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65)
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
- Page 81: "Patienter med atrieflimren omfatter patienter, som er blevet registreret i Landspatientregistret med ICD-10 diagnosen DI48 (inkl. alle subkoder) som enten aktions- eller bidiagnose." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 81-85)
- Page 81: "Patienterne er identificeret via et udtræk fra Landspatientregisteret, og databasen er således per definition komplet, såfremt patienterne er blevet indberettet korrekt til Landspatientregisteret." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 81-85)
- Page 92: "Andel af atrieflimren patienter indlagt med I63 + I64 (LPR baseret)" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 91-95)
- Page 92: "Prævalente patienter med atrieflimren, der udvikler iskæmisk apopleksi i opgørelses perioden (LPR-baseret)" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 91-95)
- Page 6: "LPR-baseret" (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 6-10)

## Relationships

**Outgoing**
- Subject: landspatientregisteret | Predicate: provides-data-to | Object: indikator-4a
  Evidence: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret."
  Page: 47 | Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 46-50
- Subject: landspatientregisteret | Predicate: supports | Object: atrieflimren
  Evidence: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)"
  Page: 14 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 11-15
- Subject: landspatientregisteret | Predicate: provides-diagnosis-data-for | Object: atrieflimren
  Evidence: "diagnosen registeret i Landspatientregisteret mindst én gang inden for de foregående 10 år"
  Page: 86 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 86-90
- Subject: landspatientregisteret | Predicate: provides-data-to | Object: databasen-for-atrieflimren-i-danmark
  Evidence: "alle patienter med diagnosen atrieflimren indberettet til Landspatientregisteret fra offentlige sygehuse"
  Page: 4 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 1-5
- Subject: landspatientregisteret | Predicate: provides-data-for | Object: indikator-2
  Evidence: "Data vedrørende ekkokardiografi stammer både fra Landspatientregisteret og fra Sygesikringsregisteret."
  Page: 19 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 16-20
- Subject: landspatientregisteret | Predicate: contains-code | Object: di63
  Evidence: "Fra Landspatientregisteret er der udtrukket patientforløb med apopleksi (DI63 og DI64) som aktionsdiagnose"
  Page: 39 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 36-40
- Subject: landspatientregisteret | Predicate: contains-code | Object: di64
  Evidence: "Fra Landspatientregisteret er der udtrukket patientforløb med apopleksi (DI63 og DI64) som aktionsdiagnose"
  Page: 39 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 36-40
- Subject: landspatientregisteret | Predicate: contains-code | Object: dz501
  Evidence: "patientforløb med aktionsdiagnosen "Kontakt mhp. anden fysioterapi" (DZ501) i kombination med bi-diagnosen DI63 eller DI64."
  Page: 39 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 36-40
- Subject: landspatientregisteret | Predicate: provides-data-for | Object: intrakraniel-bloedning
  Evidence: "Oplysningerne vedrørende intrakraniel blødning indhentes fra Landspatientregistret"
  Page: 45 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 41-45
- Subject: landspatientregisteret | Predicate: provides-data-for | Object: indikator-4a
  Evidence: "Information omkring patienters deltagelse i et struktureret undervisningsprogram indhentes fra Landspatientregisteret."
  Page: 56 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 56-60
- Subject: landspatientregisteret | Predicate: is-primary-data-source-for | Object: atrieflimren-i-danmark
  Evidence: "alle patienter med diagnosen atrieflimren indberettet til Landspatientregisteret"
  Page: 4 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 1-5
- Subject: landspatientregisteret | Predicate: does-not-contain-data-from | Object: sundhedsdatastyrelsen
  Evidence: "da Sundhedsdatastyrelsen ikke leverer disse data."
  Page: 19 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 16-20
- Subject: landspatientregisteret | Predicate: is-source-for | Object: iskaemisk-apopleksi
  Evidence: "Andel af atrieflimren patienter indlagt med iskæmisk apopleksi/apopleksi af ukendt type, som har
indløst recept på oral AK-behandling indenfor 100 dage før dato for indlæggelse med apopleksi
Andel af atrieflimren
patienter indlagt med I63 +
I64 (LPR baseret)"
  Page: 71 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 71-75
- Subject: landspatientregisteret | Predicate: is-source-for | Object: intrakraniel-bloedning
  Evidence: "Prævalente patienter med atrieflimren, der
udvikler intrakraniel blødning i opgørelses
perioden"
  Page: 74 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 71-75

**Incoming**
- Subject: indikator-2 | Predicate: is-based-on-data-from | Object: (this entity)
  Evidence: "Data vedrørende ekkokardiografi stammer både fra Landspatientregisteret og fra Sygesikringsregisteret."
  Page: 22 | Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 21-25
- Subject: indikator-4b | Predicate: is-calculated-using | Object: (this entity)
  Evidence: "Populationen i Indikator 4b udgøres af den prævalente gruppe af patienter med en atrieflimren-diagnose, som er i DOAC-behandling... Den prævalente population defineres som alle personer, som var i live pr. 1. juli 2022, og som havde fået diagnosen registreret i Landspatientregisteret mindst én gang inden for de foregående 10 år."
  Page: 53 | Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 51-55
- Subject: indikator-5 | Predicate: is-calculated-using | Object: (this entity)
  Evidence: "Indikator 5: Incidens af iskæmisk apopleksi blandt prævalente patienter med atrieflimren."
  Page: 54 | Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 51-55
- Subject: indikator-6 | Predicate: is-calculated-from | Object: (this entity)
  Evidence: "Oplysningerne vedrørende intrakraniel blødning indhentes fra Landspatientregistret"
  Page: 65 | Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 61-65
- Subject: indikator-7 | Predicate: is-calculated-using-data-from | Object: (this entity)
  Evidence: "Indikator 7 opgøres for alle prævalente patienter med en atrieflimren-diagnose [...] og større blødning er identificeret via data fra Landspatientregistret"
  Page: 72 | Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 71-75
- Subject: indikator-8 | Predicate: uses-data-from | Object: (this entity)
  Evidence: "Information omkring patienters deltagelse i et struktureret undervisningsprogram indhentes fra Landspatientregisteret"
  Page: 79 | Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 76-80
- Subject: indikator-10 | Predicate: uses-data-from | Object: (this entity)
  Evidence: "Mortaliteten opgøres for alle prævalente patienter med en atrieflimren-diagnose, dvs. alle personer, som var i live pr. 1. juli 2022, og som har fået diagnosen registeret i Landspatientregisteret mindst én gang inden for de foregående 10 år."
  Page: 109 | Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 106-110
- Subject: indikator-4a3 | Predicate: is-calculated-from | Object: (this entity)
  Evidence: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret."
  Page: 37 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 36-40
- Subject: indikator-5 | Predicate: uses-data-from | Object: (this entity)
  Evidence: "Indikatoren er opgjort på baggrund af data om akut apopleksi fra LPR frem for databasen DanStroke."
  Page: 48 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 46-50
- Subject: indikator-6 | Predicate: uses-data-source | Object: (this entity)
  Evidence: "opgøres for alle prævalente patienter med en atrieflimren-diagnose, dvs. alle personer, som var i live pr. 1. juli 2023, og som har fået diagnosen registeret i Landspatientregisteret mindst én gang inden for de foregående 10 år."
  Page: 54 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 51-55
- Subject: indikator-7 | Predicate: uses-data-from | Object: (this entity)
  Evidence: "Større blødning er defineret som en akut indlæggelse med blødning og er identificeret via data fra Landspatientregistret."
  Page: 60 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 56-60
- Subject: indikator-8 | Predicate: relies-on-data-from | Object: (this entity)
  Evidence: "Information omkring patienters deltagelse i et struktureret undervisningsprogram indhentes fra Landspatientregisteret."
  Page: 65 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 61-65
- Subject: databasen-for-atrieflimren-i-danmark | Predicate: uses | Object: (this entity)
  Evidence: "Patienterne er identificeret via et udtræk fra Landspatientregisteret samt praksissystemerne"
  Page: 68 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 66-70
- Subject: hjertesvigtsindikatoren | Predicate: is-calculated-using | Object: (this entity)
  Evidence: "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*) og er identificeret via data fra Landspatientregistret."
  Page: 81 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 81-85
- Subject: indikator-1 | Predicate: uses-data-from | Object: (this entity)
  Evidence: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)."
  Page: 14 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 11-15
- Subject: sundhedsplatformen | Predicate: causes-reporting-deficiency-in | Object: (this entity)
  Evidence: "Valideringsarbejde udført af styregruppen har tidligere vist, at der forekommer en betydelig grad af manglende ydelses-rapportering af ekkokardiografi til Landspatientregisteret, især fra afdelinger, der arbejder under Sundhedsplatformen."
  Page: 19 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 16-20
- Subject: indikator-4a | Predicate: uses-data-from | Object: (this entity)
  Evidence: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret."
  Page: 29 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 26-30
- Subject: indikator-4b | Predicate: uses-data-from | Object: (this entity)
  Evidence: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret."
  Page: 34 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 31-35
- Subject: indikator-5 | Predicate: is-based-on | Object: (this entity)
  Evidence: "Indikatoren er opgjort på baggrund af data om akut apopleksi fra LPR frem for databasen DanStroke."
  Page: 39 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 36-40
- Subject: indikator-7 | Predicate: uses-data-from | Object: (this entity)
  Evidence: "Større blødning er defineret som en akut indlæggelse med blødning og er identificeret via data fra Landspatientregistret."
  Page: 50 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 46-50
- Subject: hjertesvigtsindikatoren | Predicate: uses-data-from | Object: (this entity)
  Evidence: "og er identificeret via data fra Landspatientregistret."
  Page: 62 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65
- Subject: indikator-1 | Predicate: uses-data-from | Object: (this entity)
  Evidence: "Indikatoren er baseret på data fra Lægemiddelstatistikregistret og Landspatientregisteret (LPR)."
  Page: 15 | Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 11-15
- Subject: indikator-5 | Predicate: uses-data-from | Object: (this entity)
  Evidence: "I modsætning til tidligere er indikatoren i år opgjort på baggrund af data om akut apopleksi fra LPR frem for databasen DanStroke."
  Page: 58 | Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 56-60
- Subject: indikator-2 | Predicate: uses-data-from | Object: (this entity)
  Evidence: "Data vedrørende ekkokardiografi stammer både fra Landspatientregisteret og fra Sygesikringsregisteret."
  Page: 19 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 16-20
- Subject: sundhedsplatformen | Predicate: associated-with-poor-reporting-to | Object: (this entity)
  Evidence: "især fra afdelinger, der arbejder under Sundhedsplatformen."
  Page: 19 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 16-20
- Subject: indikator-4b | Predicate: uses-data-from | Object: (this entity)
  Evidence: "Data til beregning af indikatoren indhentes fra Landspatientregisteret, Lægemiddelstatistikregisteret (ATC-koder) og Laboratorieregistret."
  Page: 43 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45
- Subject: indikator-5 | Predicate: uses-data-from | Object: (this entity)
  Evidence: "Indikator 5: Incidens af apopleksi blandt prævalente patienter med atrieflimren (LPR-baseret)"
  Page: 45 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45
- Subject: databasen-for-atrieflimren-i-danmark | Predicate: is-populated-from | Object: (this entity)
  Evidence: "Patienterne er identificeret via et udtræk fra Landspatientregisteret"
  Page: 81 | Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 81-85
- Subject: di48 | Predicate: is-used-in | Object: (this entity)
  Evidence: "Patienter med atrieflimren omfatter patienter, som er blevet registreret i Landspatientregistret med ICD-10 diagnosen DI48"
  Page: 81 | Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 81-85
- Subject: indikator-5 | Predicate: has-primary-dataset | Object: (this entity)
  Evidence: "Andel af atrieflimren patienter indlagt med I63 + I64 (LPR baseret)"
  Page: 92 | Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 91-95
- Subject: indikator-5 | Predicate: uses-data-source | Object: (this entity)
  Evidence: "Incidens af apopleksi blandt prævalente patienter med atrieflimren (LPR-baseret)"
  Page: 6 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 6-10

## Claims

**Epidemiological**
- I alt er der identificeret 19.671 incidente patienter og 134.810 prævalente patienter med atrieflimren [^src1] (afdk-aarsrapport-2023, landspatientregisteret)
  Page: 5 | Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 1-5
- I alt er der identificeret 22.250 incidente patienter og 138.889 prævalente patienter med atrieflimren [^src1] (atrieflimren-i-danmark, landspatientregisteret)
  Page: 4 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 1-5
- I alt er der identificeret 22.073 incidente patienter og 136.420 prævalente patienter med atrieflimren [^src1] (atrieflimren-i-danmark, landspatientregisteret)
  Page: 4 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 1-5

**Definition**
- Indikator 5 er opgjort for alle prævalente patienter med en atrieflimren-diagnose, dvs. alle personer, som var i live pr. 1. juli 2023, og som havde fået diagnosen registeret i Landspatientregisteret (LPR) mindst én gang inden for de foregående 10 år [^src1] (indikator-5, landspatientregisteret)
  Page: 48 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 46-50
- Patienter med atrieflimren omfatter patienter, som er blevet registreret i Landspatientregisteret og i praksissystemerne hos de praktiserende kardiologer med ICD-10 diagnosen DI48 (inkl. alle subkoder) [^src2] (databasen-for-atrieflimren-i-danmark, landspatientregisteret, di48)
  Page: 67 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 66-70
- Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*) [^src1] (hjertesvigtsindikatoren, landspatientregisteret)
  Page: 81 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 81-85
- Patienter med atrieflimren omfatter patienter, som er blevet registreret i Landspatientregistret med ICD-10 diagnosen DI48 (inkl. alle subkoder) som enten aktions- eller bidiagnose [^src1] (databasen-for-atrieflimren-i-danmark, landspatientregisteret, di48)
  Page: 81 | Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 81-85

**Validation**
- Patientforløb, validitet er ikke opgjort, men skønnes meget høj på baggrund af tidligere valideringsstudier i Landspatientregisteret af atrieflimren diagnosen (se bl.a. Sundbøl et al. BMJ Open. 2016;6(11):e01283 og Rix et al. Scand Cardiovasc J. 2012;46:149-53) [^src4] (databasen-for-atrieflimren-i-danmark, landspatientregisteret)
  Page: 69 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 66-70
- Patientforløb, validitet er ikke opgjort, men skønnes meget høj på baggrund af tidligere valideringsstudier i Landspatientregisteret af atrieflimren diagnosen (se bl.a. Sundbøl et al. BMJ Open. 2016;6(11):e01283 og Rix et al. Scand Cardiovasc J. 2012;46:149-53). [^src1] (landspatientregisteret, atrieflimren)
  Page: 65 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65

**Limitation**
- Der vil formentlig forekomme patienter med atrieflimren og andre konkurrerende sygdomme, hvor atrieflimren ikke bliver indberettet til Landspatientregisteret til trods for, at diagnosen er blevet stillet klinisk. [^src1] (atrieflimren, landspatientregisteret)
  Page: 64 | Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65
- Valideringsarbejde har vist en betydelig grad af manglende ydelses-rapportering af ekkokardiografi til Landspatientregisteret, især fra afdelinger under Sundhedsplatformen [^src1] (indikator-2, sundhedsplatformen, landspatientregisteret)
  Page: 19 | Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 16-20
- Der vil formentlig forekomme patienter med atrieflimren og andre konkurrerende sygdomme, hvor atrieflimren ikke bliver indberettet til Landspatientregisteret til trods for, at diagnosen er blevet stillet klinisk [^src1] (databasen-for-atrieflimren-i-danmark, landspatientregisteret)
  Page: 81 | Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 81-85

**Validity-assessment**
- Patientforløb, validitet er ikke opgjort, men skønnes meget høj på baggrund af tidligere valideringsstudier i Landspatientregisteret af atrieflimren diagnosen (se bl.a. Sundbøl et al. BMJ Open. 2016;6(11):e01283 og Rix et al. Scand Cardiovasc J. 2012;46:149-53) [^src1] (databasen-for-atrieflimren-i-danmark, landspatientregisteret)
  Page: 82 | Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 81-85

## Timeline

- 2022-07-01: Definition af den prævalente population for Indikator 4b: Alle personer, som var i live pr. 1. juli 2022, og som havde fået diagnosen registreret i Landspatientregisteret mindst én gang inden for de foregående 10 år (indikator-4b, landspatientregisteret)
- 2016: Sundbøl et al. publicerede valideringsstudie i BMJ Open om atrieflimren diagnosen i Landspatientregisteret. (landspatientregisteret, atrieflimren)
- 2012: Rix et al. publicerede valideringsstudie i Scand Cardiovasc J om atrieflimren diagnosen i Landspatientregisteret. (landspatientregisteret, atrieflimren)

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
[^src19]: AFDK_2025.pdf, pages 1-5
[^src20]: AFDK_2025.pdf, pages 11-15
[^src21]: AFDK_2025.pdf, pages 16-20
[^src22]: AFDK_2025.pdf, pages 26-30
[^src23]: AFDK_2025.pdf, pages 31-35
[^src24]: AFDK_2025.pdf, pages 36-40
[^src25]: AFDK_2025.pdf, pages 41-45
[^src26]: AFDK_2025.pdf, pages 46-50
[^src27]: AFDK_2025.pdf, pages 56-60
[^src28]: AFDK_2025.pdf, pages 61-65
[^src29]: AFDK_2023.pdf, pages 11-15
[^src30]: AFDK_2023.pdf, pages 56-60
[^src31]: AFDK_2024.pdf, pages 1-5
[^src32]: AFDK_2024.pdf, pages 16-20
[^src33]: AFDK_2024.pdf, pages 41-45
[^src34]: AFDK_2024.pdf, pages 71-75
[^src35]: AFDK_2023.pdf, pages 81-85
[^src36]: AFDK_2023.pdf, pages 91-95
[^src37]: AFDK_2025.pdf, pages 6-10
