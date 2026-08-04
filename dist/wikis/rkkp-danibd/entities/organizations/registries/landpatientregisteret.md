---
title: Landpatientregisteret
type: entity
aliases:
  - landspatientregisteret
wiki: rkkp-danibd
updated: '2026-08-03T19:14:18.646Z'
sources:
  - file: DANIBD_2023.pdf
    pages: '11-15, 16-20'
  - file: DANIBD_2024.pdf
    pages: '26-30, 36-40'
tags:
  - organization
---

# Landpatientregisteret

Landpatientregisteret (LPR) er en af de nationale registre, som DANIBD anvender til dataindberetning og til at identificere patienter med IBD baseret på aktionsdiagnoser.

## Mentions

- Page 19: "Hospitalsenheder, der behandler patienter med IBD, er omfattet af dataindberetning til DANIBD via de nationale registre; Landpatientregisteret (LPR)" [^src1]
- Page 19: "Det organisatoriske tilhørsforhold er som udgangspunkt bestemt ved den enhed, hvor patienten har haft en hospitalskontakt for IBD i LPR" [^src1]
- Page 20: "DANIBD baseret på aktionsdiagnoser for inflammatoriske tarmsygdomme registreret i Landspatientregisteret (LPR)" [^src1]
- Page 26: "I 2024 blev der oprettet nye behandlingskoder for upadacitinib, filgotinib og risankizumab samt mirikizumab og ozanimod i landspatientregisteret (LPR)." [^src2]
- Page 36: "Hospitalsenheder, der behandler patienter med IBD, er omfattet af dataindberetning til DANIBD via de nationale registre; Landpatientregisteret (LPR)" [^src3]
- Page 36: "Det organisatoriske tilhørsforhold er som udgangspunkt bestemt ved den enhed, hvor patienten har haft en hospitalskontakt for IBD i LPR" [^src3]
- Page 11: "BMSL omfatter i denne årsrapport behandling med infliximab (BOHJ18A1), adalimumab (BOHJ18A3), golimumab (BOHJ18A4), ustekinumab (BOHJ18B3), vedolizumab (BOHJ19H4) og tofacitinib (BOHJ28D) registreret i landspatientregisteret (LPR)" [^src4]

## Relationships

- [[danibd|DANIBD]] — uses-data-from (incoming) — "Hospitalsenheder, der behandler patienter med IBD, er omfattet af dataindberetning til DANIBD via de nationale registre; Landpatientregisteret (LPR)" [^src1] (Page 19)
- [[jacobsen-ha|Jacobsen HA]] — authored-study-on (incoming) — "I studiet af Jacobsen et al fra 2022 undersøges den positive prædiktive værdi (PPV) af IBD-diagnoser i LPR" [^src1] (Page 20)
- [[upadacitinib|Upadacitinib]] — has-treatment-code-in (incoming) — "I 2024 blev der oprettet nye behandlingskoder for upadacitinib, filgotinib og risankizumab samt mirikizumab og ozanimod i landspatientregisteret (LPR)" [^src2] (Page 26)
- [[filgotinib|Filgotinib]] — has-treatment-code-in (incoming) — "I 2024 blev der oprettet nye behandlingskoder for upadacitinib, filgotinib og risankizumab samt mirikizumab og ozanimod i landspatientregisteret (LPR)" [^src2] (Page 26)
- [[risankizumab]] — has-treatment-code-in (incoming) — "I 2024 blev der oprettet nye behandlingskoder for upadacitinib, filgotinib og risankizumab samt mirikizumab og ozanimod i landspatientregisteret (LPR)" [^src2] (Page 26)
- [[mirikizumab]] — has-treatment-code-in (incoming) — "I 2024 blev der oprettet nye behandlingskoder for upadacitinib, filgotinib og risankizumab samt mirikizumab og ozanimod i landspatientregisteret (LPR)" [^src2] (Page 26)
- [[danibd|DANIBD]] — uses-data-from (incoming) — "Hospitalsenheder, der behandler patienter med IBD, er omfattet af dataindberetning til DANIBD via de nationale registre; Landpatientregisteret (LPR)" [^src3] (Page 36)
- [[danibd|DANIBD]] — uses-data-from (incoming) — "BMSL omfatter i denne årsrapport behandling med infliximab (BOHJ18A1), adalimumab (BOHJ18A3), golimumab (BOHJ18A4), ustekinumab (BOHJ18B3), vedolizumab (BOHJ19H4) og tofacitinib (BOHJ28D) registreret i landspatientregisteret (LPR)" [^src4] (Page 11)

## Claims

- I 2024 blev der oprettet nye behandlingskoder for upadacitinib, filgotinib og risankizumab samt mirikizumab og ozanimod i landspatientregisteret (LPR) ([[upadacitinib|Upadacitinib]], [[filgotinib|Filgotinib]], [[risankizumab]], [[mirikizumab]], [[landpatientregisteret|Landpatientregisteret]])
- Patienter med IBD skal have mindst to hospitalskontakter med følgende aktionsdiagnoser registreret i LPR ([[danibd|DANIBD]], [[landpatientregisteret|Landpatientregisteret]])

## Sources

[^src1]: DANIBD_2023.pdf, pages 16-20
[^src2]: DANIBD_2024.pdf, pages 26-30
[^src3]: DANIBD_2024.pdf, pages 36-40
[^src4]: DANIBD_2023.pdf, pages 11-15
