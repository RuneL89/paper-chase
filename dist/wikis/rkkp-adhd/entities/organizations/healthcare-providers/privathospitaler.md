---
title: Privathospitaler
type: entity
wiki: rkkp-adhd
updated: '2026-08-05T18:24:02.675Z'
sources:
  - file: wikis/rkkp-adhd/raw/ADHD_2024.pdf
    pages: '11-15, 16-20, 21-25, 31-35, 41-45, 51-55, 56-60'
tags:
  - organization
---
**Privathospitaler** (Private Hospitals) represent a distinct and highly anomalous category within the Danish national ADHD quality reporting system. Reporting to the [[adhd-databasen|ADHD-DATABASEN]], private hospitals are tracked alongside public regional psychiatric departments to measure compliance with national clinical guidelines [^src4]. However, their inclusion in the annual quality reports is characterized by severe data scarcity, registration anomalies, and an inability to draw reliable clinical conclusions due to an exceptionally low patient volume [^src7].

The steering group has noted the private hospitals' data as highly unusual. For example, their proportion of somatic investigations is recorded at 0 %, a discrepancy whose root cause remains unknown because the representative for the private hospitals was absent from the steering group meeting [^src1]. This near-total lack of reported courses makes it methodologically impossible to accurately assess whether private hospitals are meeting national quality standards [^src7]. In one specific metric, their recorded share dropped drastically from 84 % the previous year to just 7 %, though analysts caution that the narrow data basis requires heavy reservations [^src3]. 

Across multiple specific quality indicators, the private hospitals consistently report zero compliance or missing data:
* **[[indikator-2a|Indikator 2a]]** (clinical environmental observation for ages 0–5): Achieved a 0 % compliance rate [^src2].
* **[[indikator-3|Indikator 3]]** (diagnostic conference): Recorded the lowest performance, with exactly 16 registered courses and none fulfilling the indicator's requirements [^src3].
* **[[indikator-5|Indikator 5]]** and **[[indikator-8|Indikator 8]]** (psychoeducation): Zero patients across the private hospitals were registered as having started ADHD psychoeducation, indicating either a complete failure to provide the service or a systemic failure to register it [^src4], [^src5].
* **[[indikator-10|Indikator 10]]** (assessment of social support needs): Scored 0 %, placing them among a small group of departments failing this newly introduced metric [^src6].

The only indicator showing a high compliance rate is **[[indikator-11|Indikator 11]]** (pharmacological treatment for adults), where private hospitals scored 90 % (9 out of 10 patients) [^src7]. Nevertheless, the overarching narrative in the 2024 report is that the private hospitals' data is too sparse and fragmented to serve as a reliable benchmark for clinical quality, highlighting systemic challenges in integrating private providers into the national ADHD monitoring infrastructure.

## Mentions

- Page 11: "Privathospitaler" [^src1]
- Page 16: "Privathospitaler" [^src2]
- Page 21: "Privathospitalerne opnåede en andel på 7 %, hvor de året forinden lå på 84 %. Dog skal der tages forbehold for det smalle datagrundlag." [^src3]
- Page 21: "Der var i alt 16 registrerede forløb på privathospitaler og ingen af disse opfyldte indikatoren." [^src3]
- Page 31: "Privathospitaler" [^src4]
- Page 41: "Ingen af patienterne på privathospitalerne er registreret som påbegyndt ADHD-psykoedukation." [^src5]
- Page 51: "| Privathospitaler | Nej | 0 | / | 10 | 0 | (0-31) |" [^src6]
- Page 56: "Privathospitaler 9 / 10 90 (55-100)" [^src7]

## Relationships

- Subject: privathospitaler
  Predicate: has-lowest-performance-for
  Object: indikator-3
  Evidence: "Der var i alt 16 registrerede forløb på privathospitaler og ingen af disse opfyldte indikatoren."
  Page: 21
  Source: [^src3]

- Subject: privathospitaler
  Predicate: reports-to
  Object: adhd-databasen
  Evidence: "Privathospitaler"
  Page: 31
  Source: [^src4]

- Subject: privathospitaler
  Predicate: reports-zero-score-on
  Object: indikator-8
  Evidence: "Ingen af patienterne på privathospitalerne er registreret som påbegyndt ADHD-psykoedukation."
  Page: 41
  Source: [^src5]

- Subject: privathospitaler
  Predicate: has-result-for
  Object: indikator-11
  Evidence: "Privathospitaler 9 / 10 90 (55-100)"
  Page: 56
  Source: [^src7]

## Claims

- Privathospitalerne opnåede en andel på 0 % for Indikator 2a [^src1] (privathospitaler, indikator-2a)
  Type: performance
  Page: 16
  Source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 16-20

- Ingen er registreret som påbegyndt psykoedukation på de private hospitaler [^src1] (privathospitaler, indikator-5)
  Type: performance
  Page: 31
  Source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 31-35

- Ingen af patienterne på privathospitalerne er registreret som påbegyndt ADHD-psykoedukation.[^src1] (privathospitaler)
  Type: non-compliance
  Page: 41
  Source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 41-45

- Der er seks afdelinger med et resultat på 0 % for Indikator 10 (otte hvis privathospitalerne tælles med)[^src1] (indikator-10, privathospitaler)
  Type: performance
  Page: 51
  Source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 51-55

- Det næsten ikkeeksisterende antal forløb indrapporteret fra privathospitaler gør det ikke muligt at vurdere om de lever op til kvalitetsindikatorerne[^src1]. (privathospitaler, indikator-11)
  Type: methodological
  Page: 56
  Source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 56-60

## Timeline

(none)

## Sources

[^src1]: ADHD_2024.pdf, pages 11-15
[^src2]: ADHD_2024.pdf, pages 16-20
[^src3]: ADHD_2024.pdf, pages 21-25
[^src4]: ADHD_2024.pdf, pages 31-35
[^src5]: ADHD_2024.pdf, pages 41-45
[^src6]: ADHD_2024.pdf, pages 51-55
[^src7]: ADHD_2024.pdf, pages 56-60
