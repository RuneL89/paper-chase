---
title: Klynge NORD
type: entity
aliases:
  - Klynge NORD
wiki: rkkp-afdk
updated: '2026-08-05T21:13:15.393Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '11-15, 26-30, 31-35, 41-45, 71-75, 76-80, 81-85'
tags:
  - organization
---
Klynge NORD is a healthcare cluster (sundhedsklynge) operating within [[region-nordjylland|Region Nordjylland]] in Denmark. It is monitored as part of the Danish national clinical quality development program (RKKP), specifically within the annual quality reports for the treatment of [[atrieflimren|atrial fibrillation]]. 

The cluster is notable for meeting national clinical standards for atrial fibrillation care. Specifically, it is one of the health clusters that fulfills the standard for Indicator 1, achieving a result of 92.2% for the timely initiation of [[antikoagulationsbehandling|anticoagulation treatment]] in newly diagnosed patients [^src1]. Furthermore, in the period from July 1, 2018, to June 30, 2019, the proportion of atrial fibrillation patients receiving anticoagulation treatment in Klynge NORD was 94.1% (95% CI: 90.3–96.7) [^src3].

Beyond treatment initiation, Klynge NORD's performance is evaluated across a wide range of clinical outcomes and quality indicators. These include long-term treatment coverage (1-year, 2-year, and 5-year) [^src2], the incidence of ischemic stroke ([[indikator-5|Indikator 5]]) [^src4], severe bleeding events within one year of a new diagnosis [^src6], and the development of heart failure and mortality rates [^src7]. The cluster's outcomes are also mapped geographically alongside other Danish health clusters to visualize regional variations in stroke incidence and treatment quality across the national healthcare system [^src4].

## Mentions

- Page 11: "Klynge NORD Ja 403 / 437 0 (0) 92,2 (89,3-94,6) 478 / 498 96,0 93,3" [^src1]
- Page 26: "Klynge NORD Ja 393 / 433 0 (0) 90,8 (87,6-93,3) 326 / 355 91,8 92,7" [^src2]
- Page 30: "Klynge NORD Ja 288 / 318 0 (0) 90,6 (86,8-93,5) 334 / 358 93,3 94,0" [^src2]
- Page 34: "Klynge NORD Ja 224 / 238 0 (0) 94,1 (90,3-96,7) 212 / 224 94,6 88,5" [^src3]
- Page 45: "Klynge NORD Ja 38 / 4.791 0 (0) 0,8 (0,6-1,1) 26 / 4.643 0,6 0,9" [^src4]
- Page 73: "Klynge NORD 11 / 820 0 (0) 1,3 (0,7-2,4) 8 / 754 1,1 1,2" [^src5]
- Page 75: "Klynge NORD 5 / 820 0 (0) 0,6 (0,2-1,4) 6 / 754 0,8 0,5" [^src5]
- Page 78: "Klynge NORD 25 / 820 0 (0) 3,0 (2,0-4,5) 28 / 754 3,7 3,6" [^src6]
- Page 79: "Klynge NORD 50 / 820 0 (0) 6,1 (4,6-8,0) 59 / 754 7,8 9,5" [^src6]
- Page 82: "Klynge NORD 379 / 4.791 0 (0) 7,9 (7,2-8,7) 357 / 4.643 7,7 8,3" [^src7]
- Page 84: "Klynge NORD 108 / 820 0 (0) 13,2 (10,9-15,7) 119 / 754 15,8 13,6" [^src7]

## Relationships

- Subject: klynge-nord
  Predicate: has-indicator-result
  Object: atrieflimren
  Evidence: "Klynge NORD har et resultat på 92,2% for Indikator 1"
  Page: 11
  Source: [^src1]

- Subject: klynge-nord
  Predicate: is-part-of
  Object: region-nordjylland
  Evidence: "Nordjylland 28 / 2.419 0 (0) 1,2 (0,8-1,7) 31 / 2.203 1,4 1,1
Klynge NORD 11 / 820 0 (0) 1,3 (0,7-2,4) 8 / 754 1,1 1,2"
  Page: 73
  Source: [^src5]

## Claims

- I perioden 01.07.2018–30.06.2019 var andelen af patienter med atrieflimren, der modtog antikoagulationsbehandling, i Klynge NORD 94,1 % (95 % CI: 90,3–96,7) [^src1] (klynge-nord, atrieflimren, antikoagulationsbehandling)
  Type: clinical-outcome
  Page: 34
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 31-35

- Danmarkskort på Sundhedsklyngeniveau viser incidens af apopleksi i intervallet [0%-0.8%] til ]2.8%-100%] [^src2] (indikator-5, sundhedsklynge-bornholm, sundhedsklynge-byen, sundhedsklynge-midt, sundhedsklynge-nord, sundhedsklynge-syd, sundhedsklyngen-holbaek, sundhedsklyngen-nykoebing-f, sundhedsklyngen-suh, sundhedsklyngen-slagelse, sundhedsklynge-fyn, sundhedsklynge-lillebaelt, sundhedsklynge-sydvestjylland, sundhedsklynge-soenderjylland, aarhusklyngen, goedstrupklyngen, horsensklyngen, midtklyngen, randersklyngen, klynge-midt, klynge-nord, klynge-syd)
  Type: geographic-distribution
  Page: 44
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 41-45

## Timeline

(none)

## Sources

[^src1]: AFDK_2024.pdf, pages 11-15
[^src2]: AFDK_2024.pdf, pages 26-30
[^src3]: AFDK_2024.pdf, pages 31-35
[^src4]: AFDK_2024.pdf, pages 41-45
[^src5]: AFDK_2024.pdf, pages 71-75
[^src6]: AFDK_2024.pdf, pages 76-80
[^src7]: AFDK_2024.pdf, pages 81-85
