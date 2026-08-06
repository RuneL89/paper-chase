---
title: Sygesikringsregisteret
type: entity
wiki: rkkp-afdk
updated: '2026-08-05T19:57:56.168Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '116-120, 21-25'
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 16-20
tags:
  - organization
---
```yaml
---
title: "Sygesikringsregisteret"
type: entity
wiki: rkkp-afdk
updated: "2024-05-24T10:00:00Z"
sources:
  - file: "wikis/rkkp-afdk/raw/AFDK_2023.pdf"
    pages: "21-25, 116-120"
  - file: "wikis/rkkp-afdk/raw/AFDK_2024.pdf"
    pages: "16-20"
---
```

Sygesikringsregisteret is a national health register in Denmark that plays a critical role in tracking and evaluating the quality of care for patients with atrial fibrillation [^src1]. As part of the broader national effort managed by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP) to ensure standardized and quantifiable quality in atrial fibrillation treatment, the register serves as a primary data source for clinical quality indicators [^src1]. Specifically, it provides essential data on echocardiographic examinations performed in practicing specialist clinics, which is used to calculate [[indikator-2|Indikator 2]] [^src1]. This indicator measures the proportion of newly diagnosed atrial fibrillation patients who undergo an echocardiogram [^src2].

A unique operational characteristic of Sygesikringsregisteret is its temporal resolution. Unlike other registers, it only records the specific week in which a service is reported to the register, rather than the exact date the service was actually provided [^src1]. This limitation necessitates specific adjustments in the calculation rules for [[indikator-2|Indikator 2]] to accurately track patient care timelines [^src1].

To capture the full scope of echocardiographic procedures, the register utilizes a specific set of billing and service codes. These include codes for standard and advanced echocardiography, transesophageal echocardiography, stress echocardiography, and other specific variations such as [[2208-ekkocardiografi|2208 Ekkocardiografi]], [[3810-ekkocardiografi-standardundersoegelse|3810 Ekkocardiografi, standardundersøgelse]], [[3811-ekkocardiografi-avanceret-undersoegelse|3811 Ekkocardiografi, avanceret undersøgelse]], [[5101-ekko-cardiografi|5101 EKKO-cardiografi]], [[5102-transsofageal-ekko|5102 Transsøfofagal ekko.]], [[5103-stress-ekkocardiogra|5103 Stress ekkocardiogra]], [[6402-ekkocardiografi|6402 Ekkocardiografi]], [[6408-ekkocardiografi|6408 Ekkocardiografi]], and [[0906-ekko-kardiografi|0906 Ekko-kardiografi]] [^src3]. Data from Sygesikringsregisteret is often combined with data from the Landspatientregisteret to ensure comprehensive coverage of both private specialist clinics and hospital-based examinations for quality reporting [^src1].

## Mentions
- Page 22: "Data vedrørende ekkokardiografi stammer både fra Landspatientregisteret og fra Sygesikringsregisteret." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 21-25) [^src1]
- Page 22: "Fra Sygesikringsregisteret er det kun muligt at trække oplysninger om i hvilken uge en ydelse er indberettet til registeret og ikke hvilken dato, den rent faktisk er blevet ydet." (source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 21-25) [^src1]
- Page 19: "Data vedrørende ekkokardiografi stammer både fra Landspatientregisteret og fra Sygesikringsregisteret." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 16-20) [^src2]

## Relationships
- Subject: indikator-2
  Predicate: is-based-on-data-from
  Object: (this entity)
  Evidence: "Data vedrørende ekkokardiografi stammer både fra Landspatientregisteret og fra Sygesikringsregisteret."
  Page: 22
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 21-25 [^src1]
- Subject: 2208-ekkocardiografi
  Predicate: is-registered-in
  Object: (this entity)
  Evidence: "Koder for ekkokardiografi i Sygesikringsregisteret: 2208 Ekkocardiografi"
  Page: 116
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120 [^src3]
- Subject: 3810-ekkocardiografi-standardundersoegelse
  Predicate: is-registered-in
  Object: (this entity)
  Evidence: "Koder for ekkokardiografi i Sygesikringsregisteret: 3810 Ekkocardiografi, standardundersøgelse"
  Page: 116
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120 [^src3]
- Subject: 3811-ekkocardiografi-avanceret-undersoegelse
  Predicate: is-registered-in
  Object: (this entity)
  Evidence: "Koder for ekkokardiografi i Sygesikringsregisteret: 3811 Ekkocardiografi, avanceret undersøgelse"
  Page: 116
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120 [^src3]
- Subject: 5101-ekko-cardiografi
  Predicate: is-registered-in
  Object: (this entity)
  Evidence: "Koder for ekkokardiografi i Sygesikringsregisteret: 5101 EKKO-cardiografi"
  Page: 116
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120 [^src3]
- Subject: 5102-transsofageal-ekko
  Predicate: is-registered-in
  Object: (this entity)
  Evidence: "Koder for ekkokardiografi i Sygesikringsregisteret: 5102 Transsøfofagal ekko."
  Page: 116
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120 [^src3]
- Subject: 5103-stress-ekkocardiogra
  Predicate: is-registered-in
  Object: (this entity)
  Evidence: "Koder for ekkokardiografi i Sygesikringsregisteret: 5103 Stress ekkocardiogra"
  Page: 116
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120 [^src3]
- Subject: 6402-ekkocardiografi
  Predicate: is-registered-in
  Object: (this entity)
  Evidence: "| 6402 | Ekkocardiografi |"
  Page: 116
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120 [^src3]
- Subject: 6408-ekkocardiografi
  Predicate: is-registered-in
  Object: (this entity)
  Evidence: "| 6408 | Ekkocardiografi |"
  Page: 116
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120 [^src3]
- Subject: 0906-ekko-kardiografi
  Predicate: is-registered-in
  Object: (this entity)
  Evidence: "| 0906 | Ekko-kardiografi |"
  Page: 116
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 116-120 [^src3]
- Subject: indikator-2
  Predicate: uses-data-from
  Object: (this entity)
  Evidence: "Data vedrørende ekkokardiografi stammer både fra Landspatientregisteret og fra Sygesikringsregisteret."
  Page: 19
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 16-20 [^src2]

## Claims
(none)

## Timeline
(none)

## Sources

[^src1]: AFDK_2023.pdf, pages 21-25
[^src2]: AFDK_2024.pdf, pages 16-20
[^src3]: AFDK_2023.pdf, pages 116-120
