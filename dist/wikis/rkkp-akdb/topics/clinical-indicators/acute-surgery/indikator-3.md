---
title: Indikator 3
type: entity
aliases:
  - Indikator 3
wiki: rkkp-akdb
updated: '2026-08-05T18:34:29.366Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: '11-15, 6-10'
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '101-105, 106-107, 16-20, 21-25, 6-10, 96-100'
tags:
  - indicator
---
**Indikator 3** is a clinical quality indicator within the [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] (AKDB), designed to monitor and improve the treatment pathways for acute abdominal surgery patients in Denmark. The indicator has undergone a significant definitional shift between the 2023 and 2024 annual reports, transitioning from a focus on diagnostic imaging to preoperative physiological optimization.

In the 2023 AKDB report, Indikator 3 measured the proportion of CT-scanned patients who received their scan within 120 minutes of arriving at the hospital [^src1]. The performance standard was set at ≥ 90%, aligned with recommendations from the [[american-college-of-radiology|American College of radiology]] and the [[dansk-radiologisk-selskab|Dansk Radiologisk Selskab]] [^src2]. However, national performance for the period of September 1, 2022, to August 31, 2023, was only 30.1% [^src2]. Despite missing the target, the national rate showed improvement, a trend attributed in part to the implementation of [[lkt-akut-kirurgi|LKT Akutkirurgi]] guidelines [^src2].

By the 2024 AKDB report, Indikator 3 was redefined to measure [[praoperativ-optimering|præoperativ optimering]] (preoperative optimization) or direct transfer to surgery within 240 minutes (4 hours) of hospital arrival [^src4]. This shift was made possible by the creation of [[sks-kode-naaz42|SKS-koden NAAZ42]] in the Danish National Patient Register on October 1, 2022, which allowed for the quantitative tracking of preoperative optimization for the first time [^src4]. The clinical evidence supporting this new focus is heavily drawn from the mortality-reducing [[aha-studiet|AHA-studiet]] [^src5]. While the target remained ≥ 90%, the national fulfillment rate for the 2024 reporting period was just 11.1%, with regional variations ranging from 4.3% in [[region-hovedstaden|Region Hovedstaden]] to 18.1% in [[region-midtjylland|Region Midtjylland]] [^src5]. [[holbaek-sygehus|Holbæk Sygehus]] was highlighted as a best-practice example, demonstrating that cultural and organizational efforts can significantly improve compliance [^src5].

The redefinition of Indikator 3 has sparked operational and clinical debates. [[regionshospital-nordjylland|Regionshospital Nordjylland]] has questioned the indicator's definition and relevance, arguing that it should primarily apply to "4X" patients (those with perforation, ischemia, or bleeding) and seeking clarification on exclusion criteria and coding practices, such as whether optimization performed by an anesthesiologist directly in the operating room qualifies [^src7], [^src8]. Consequently, there have been calls for the [[styregruppen|Styregruppen]] to revise the indicator's population to ensure it only includes patients for whom optimization or direct surgery is clinically relevant [^src7].

***

## Mentions

- Page 6: "Indikator 3: Andelen af CT-skannede patienter, der får lavet CT-skanning indenfor 120 minutter efter ankomst til sygehus" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10) [^src1]
- Page 7: "Indikator 3: Andelen af CT-skannede patienter, der får lavet CT-skanning indenfor 120 minutter efter ankomst til sygehus" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10) [^src1]
- Page 11: "Indikator 3 beskriver andelen af patienter, der får en CT-skanning og som blev skannede indenfor 2 timer efter ankomst til sygehus." (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 11-15) [^src2]
- Page 6: "Indikator 3: Præoperativ optimering eller direkte til operation" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 6-10) [^src3]
- Page 16: "Indikator 3: Præoperativ optimering. Forest plot på afdelingsniveau" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 16-20) [^src4]
- Page 21: "Indikator 3 beskriver andelen af patienter, der modtager præoperativ optimering eller går direkte til operation." (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 21-25) [^src5]
- Page 96: "Indikator 3: Præoperativ optimering eller direkte til operation" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 96-100) [^src6]
- Page 101: "Der er et ønske om, at man i styregruppen revurderer populationen ift. Indikator 3: Andel af patienter der får præoperativ optimering eller som går direkte til operation, svarende til indenfor 240 min fra ankomst til hospital, så den kun inkludere de patienter hvor optimering/direkte operation er aktuelt. Det kunne være ved kun at opgøre på populationen fra 4X." (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 101-105) [^src7]
- Page 106: "Vedr. indikator 3:" (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 106-107) [^src8]

## Relationships

**Outgoing (this entity is the SUBJECT of these relationships):**

- Subject: indikator-3
  Predicate: belongs-to-database
  Object: akut-kirurgi-databasen
  Evidence: "Indikator 3: Andelen af CT-skannede patienter, der får lavet CT-skanning indenfor 120 minutter efter ankomst til sygehus"
  Page: 6
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 6-10 [^src1]

- Subject: indikator-3
  Predicate: is-informed-by-guidelines-from
  Object: american-college-of-radiology
  Evidence: "American College of radiology anbefaler CT abdomen med kontrast for akutte, ikke lokaliserede, abdominalsmerter og for patienter mistænkt for ileus."
  Page: 11
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 11-15 [^src2]

- Subject: indikator-3
  Predicate: is-informed-by-guidelines-from
  Object: dansk-radiologisk-selskab
  Evidence: "Dansk Radiologisk Selskab er blevet spurgt om holdning."
  Page: 11
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 11-15 [^src2]

- Subject: indikator-3
  Predicate: is-measured-by
  Object: akut-kirurgi-databasen
  Evidence: "Indikator 3: Præoperativ optimering. Forest plot på afdelingsniveau"
  Page: 16
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 16-20 [^src4]

- Subject: indikator-3
  Predicate: is-aligned-with
  Object: lkt-akut-kirurgi
  Evidence: "Udviklingsmålet er at mindst 90 % skannes indenfor 120 minutter, hvilket er i overensstemmelse med LKT for Akutkirurgi."
  Page: 16
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 16-20 [^src4]

- Subject: indikator-3
  Predicate: uses-code
  Object: sks-kode-naaz42
  Evidence: "SKS-koden NAAZ42 Præoperativ optimering er oprettet pr. 1/10-2022 og kan således indberettes fra dette tidspunkt."
  Page: 16
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 16-20 [^src4]

- Subject: indikator-3
  Predicate: measures
  Object: praoperativ-optimering
  Evidence: "Indikator 3 beskriver andelen af patienter, der modtager præoperativ optimering eller går direkte til operation."
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 21-25 [^src5]

**Incoming (this entity is the OBJECT of these relationships):**

- Subject: lkt-akut-kirurgi
  Predicate: has-contributed-to-improvement-of
  Object: (this entity)
  Evidence: "Resultatet nationalt viser at 30,1 % af patienterne er scannet inden for 2 timer. Det er en pæn stigning ift. foregående år og formentlige har LKT for Akutkirurgi bidraget til denne stigning nationalt"
  Page: 11
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 11-15 [^src2]

- Subject: sks-kode-naaz42
  Predicate: is-required-for
  Object: (this entity)
  Evidence: "For at kunne trække data skal afdelingerne kode patienterne, der præoptimeres med SKS-koden NAAZ42, der har teksten ” Anæstesiologisk præoperativ optimering”."
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 21-25 [^src5]

- Subject: aha-studiet
  Predicate: provides-evidence-for
  Object: (this entity)
  Evidence: "I det mortalitets-sænkende AHA-studie, blev patienterne optimeret på IMA / ITA / eller på operationsgangen forud for operation umiddelbart efter det var besluttet at patienten skulle opereres."
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 21-25 [^src5]

- Subject: holbaek-sygehus
  Predicate: exemplifies-best-practice-for
  Object: (this entity)
  Evidence: "Holbæk Hospital viser at der med en indsats der blandt andet adresserer det kulturelle aspekt kan flyttes meget."
  Page: 21
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 21-25 [^src5]

- Subject: regionshospital-nordjylland
  Predicate: audits
  Object: (this entity)
  Evidence: "Regionshospital Nordjylland (RHN) i Hjørring har følgende spørgsmål til hhv. indikator 1 og 3 ifm. deres grundige gennemgang af årsrapporten samt efterfølgende audit"
  Page: 101
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 101-105 [^src7]

- Subject: styregruppen
  Predicate: is-responsible-for-revising
  Object: (this entity)
  Evidence: "Der er et ønske om, at man i styregruppen revurderer populationen ift. Indikator 3: Andel af patienter der får præoperativ optimering eller som går direkte til operation..."
  Page: 101
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 101-105 [^src7]

- Subject: regionshospital-nordjylland
  Predicate: questions-definition-of
  Object: (this entity)
  Evidence: "RHN har behov for en afklaring. Hvis patienten køres på OP og præoptimeres af en anæstesiolog inden selve operationen."
  Page: 106
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 106-107 [^src8]

## Claims

### standard
- Indikator 3 har en standard på ≥ 90 % for andelen af CT-skannede patienter, der får lavet CT-skanning indenfor 120 minutter efter ankomst til sygehus [^src1] (indikator-3)

### clinical-performance
- Andelen af patienter, der blev CT-skannet inden for to timer efter ankomst til sygehus, var 30,1 % (95 % CI: 28,5–31,8) nationalt i perioden 01.09.2022–31.08.2023 [^src1] (indikator-3)
- Standarden for Indikator 3 er ≥ 90 %, men blev ikke opfyldt nationalt eller på nogen regionsniveau [^src1] (indikator-3)

### performance-standard
- Indikator 3 har en standard på ≥ 90 % for andelen af patienter med præoperativ optimering eller direkte til operation [^src1] (indikator-3)

### definition
- Indikator 3 beskriver andelen af patienter, der får præoperativ optimering eller som går direkte til operation, svarende til indenfor 240 minutter efter ankomst til sygehus [^src1] (indikator-3)

### target
- Udviklingsmål for Indikator 3 er ≥ 90 % [^src1] (indikator-3)

### administrative
- Indikatoren er opgjort for anden gang i indeværende årsrapport [^src1] (indikator-3)

### statistical
- I alt 3.172 patienter indgik i nævneren, og heraf fik 353 enten præoperativ optimering, eller gik direkte til operation [^src1] (indikator-3)
- Dette svarende til en andel på 11,1 % (95 % CI 10,1-12,3) nationalt [^src1] (indikator-3)
- Regionalt varierede resultaterne fra 4,3 % i Region Hovedstaden til 18,1 % i Region Midtjylland [^src1] (region-hovedstaden, region-midtjylland, indikator-3)

### evaluative
- Udviklingsmålet på ≥ 90 % er således langt fra opfyldt [^src1] (indikator-3)
- Ingen af de indberettende enheder opfyldte udviklingsmålet [^src1] (indikator-3)

### trend
- Udviklingen over tid er meget positiv siden indberetning blev muligt fra 1/10-2022 [^src1] (indikator-3)

### performance
- Af 3.172 patienter fik 353 den ønskede behandling, hvilket svarer til 11,1 % på landsplan [^src1] (indikator-3)

### relevance-assessment
- RHN tænker umiddelbart, at denne indikator er mest relevant for 4X patienter [^src1] (regionshospital-nordjylland, indikator-3)

### uncertainty-claim
- Der er usikkerhed om, hvorvidt der findes et eksklusionskriterie ift. denne indikator [^src1] (indikator-3)

### inclusion-claim
- Patienter inkluderes ift. indikatoren på trods af indlæggelse i flere dage inden de bliver til en AHA patient [^src1] (indikator-3)

### feasibility-claim
- Det er svært at opfylde kriteriet med antibiotika indenfor tre timer efter ankomst til sygehus [^src1] (indikator-3)

## Timeline

- 2022-09-01: Start af måleperioden for indikatorresultaterne (01.09.2022 – 31.08.2023) [^src1] [^src2] (indikator-1, indikator-3, indikator-4, indikator-5, indikator-6, indikator-7, indikator-8, indikator-9, indikator-10, indikator-11)
- 2022-10-01: En kode til angivelse af præoperativ optimering blev oprettet i LPR, hvilket muliggjorde første gang kvantitativ måling af Indikator 3 som kvalitetsindikator. [^src4] (landspatientregisteret, indikator-3)
- 2022-10-01: Indikator 3 blev indført med mulighed for registrering af præoperativ optimering eller direkte til operation [^src4] (indikator-3)
- 2023-08-31: Afslutning af måleperioden for indikatorresultaterne (01.09.2022 – 31.08.2023) [^src1] [^src2] (indikator-1, indikator-3, indikator-4, indikator-5, indikator-6, indikator-7, indikator-8, indikator-9, indikator-10, indikator-11)
- 01.09.2022: Start af måleperioden for Indikator 1 og Indikator 3 i rapporten [^src1] [^src2] (indikator-1, indikator-3)
- 31.08.2023: Slut på måleperioden for Indikator 1 og Indikator 3 i rapporten [^src1] [^src2] (indikator-1, indikator-3)
- 2023-09-01: Dataindsamling for Indikator 3 dækker perioden 01.09.2023 – 31.08.2024 [^src3] (indikator-3)

## Sources

[^src1]: AKDB_2023.pdf, pages 6-10
[^src2]: AKDB_2023.pdf, pages 11-15
[^src3]: AKDB_2024.pdf, pages 6-10
[^src4]: AKDB_2024.pdf, pages 16-20
[^src5]: AKDB_2024.pdf, pages 21-25
[^src6]: AKDB_2024.pdf, pages 96-100
[^src7]: AKDB_2024.pdf, pages 101-105
[^src8]: AKDB_2024.pdf, pages 106-107
