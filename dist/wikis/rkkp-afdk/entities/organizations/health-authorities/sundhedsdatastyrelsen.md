---
title: Sundhedsdatastyrelsen
type: entity
wiki: rkkp-afdk
updated: '2026-08-05T19:59:11.536Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '21-25, 26-30, 51-55'
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '16-20, 21-25, 41-45'
tags:
  - organization
---

Sundhedsdatastyrelsen (the Danish Health Data Authority) is a central governmental organization responsible for managing, securing, and supplying national health data in Denmark. Within the context of the national clinical quality databases managed by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP)—such as the Danish Atrial Fibrillation Database (AFDK)—the authority plays a vital role in the underlying data infrastructure while simultaneously being the source of specific, systematic data limitations.

One of the most significant limitations attributed to Sundhedsdatastyrelsen in the AFDK annual reports concerns the tracking of echocardiography procedures (Indicator 2) for newly diagnosed atrial fibrillation patients. The authority does not deliver echocardiography data originating from private hospitals to the [[landspatientregisteret|Landspatientregisteret]] [^src1], [^src4]. Because the national quality indicators rely heavily on this register, this omission creates a systematic data blind spot, meaning that echocardiograms performed in the private healthcare sector are entirely excluded from the national quality assessments [^src1], [^src4].

In addition to patient registry data, Sundhedsdatastyrelsen is deeply involved in the national laboratory data infrastructure. The authority hosts and administers the [[laboratoriedatabasen|Laboratoriedatabasen]] [^src2], [^src5]. Laboratory results from major Danish laboratories that are connected to the [[den-nationale-labdatabank|Den Nationale Labdatabank]] are transferred and loaded into Sundhedsdatastyrelsen's database [^src2], [^src3]. This data flow is essential for monitoring clinical quality indicators that depend on blood tests, such as TSH screening (Indicator 3) and annual kidney function monitoring for patients on DOAC treatment (Indicator 4b). However, the reports note that if laboratory answers are not forwarded to the national databank, they consequently fail to reach the Laboratoriedatabasen at Sundhedsdatastyrelsen, further complicating complete national data coverage and impacting the accuracy of quality measurements [^src6].

## Mentions

- Page 22: "Ekkokardiografi, som er foretaget på privathospitaler og indberettet til Landspatientregisteret, indgår ikke, da Sundhedsdatastyrelsen ikke leverer disse data." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 21-25) [^src1]
- Page 29: "Laboratoriedatabasen hos Sundhedsdatastyrelsen" (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 26-30) [^src2]
- Page 53: "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 51-55) [^src3]
- Page 19: "da Sundhedsdatastyrelsen ikke leverer disse data." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 16-20) [^src4]
- Page 24: "Laboratoriedatabasen hos Sundhedsdatastyrelsen" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 21-25) [^src5]
- Page 43: "Laboratoriedatabasen hos Sundhedsdatastyrelsen" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45) [^src6]

## Relationships

**Outgoing (this entity is the SUBJECT of these relationships):**

- Subject: sundhedsdatastyrelsen
  Predicate: hosts
  Object: laboratoriedatabasen
  Evidence: "Laboratoriedatabasen hos Sundhedsdatastyrelsen"
  Page: 29
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 26-30 [^src2]

**Incoming (this entity is the OBJECT of these relationships):**

- Subject: den-nationale-labdatabank
  Predicate: feeds-into
  Object: sundhedsdatastyrelsen
  Evidence: "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen."
  Page: 29
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 26-30 [^src2]

- Subject: den-nationale-labdatabank
  Predicate: feeds-into
  Object: sundhedsdatastyrelsen
  Evidence: "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen."
  Page: 53
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 51-55 [^src3]

- Subject: landspatientregisteret
  Predicate: does-not-contain-data-from
  Object: sundhedsdatastyrelsen
  Evidence: "da Sundhedsdatastyrelsen ikke leverer disse data."
  Page: 19
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 16-20 [^src4]

- Subject: laboratoriedatabasen
  Predicate: is-administered-by
  Object: sundhedsdatastyrelsen
  Evidence: "Laboratoriedatabasen hos Sundhedsdatastyrelsen"
  Page: 24
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 21-25 [^src5]

- Subject: den-nationale-labdatabank
  Predicate: feeds-into
  Object: sundhedsdatastyrelsen
  Evidence: "Laboratoriesvar [...] videresendes ikke til Den Nationale Labdatabank, og dermed heller ikke til Laboratoriedatabasen [hos Sundhedsdatastyrelsen]."
  Page: 43
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45 [^src6]

## Claims

(none)

## Timeline

(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 21-25
[^src2]: AFDK_2023.pdf, pages 26-30
[^src3]: AFDK_2023.pdf, pages 51-55
[^src4]: AFDK_2024.pdf, pages 16-20
[^src5]: AFDK_2024.pdf, pages 21-25
[^src6]: AFDK_2024.pdf, pages 41-45
