---
title: LPR
type: entity
wiki: rkkp-adhd
tags:
  - organization
updated: '2026-08-03T19:14:17.067Z'
sources:
  - file: ADHD_2024.pdf
    pages: '56-60, 66-70'
  - file: ADHD_2023.pdf
    pages: 41-45
---

# LPR

LPR — the Landspatientregisteret, Denmark's National Patient Registry — is the data source the ADHD-databasen (ADHD Database) relies on to track diagnosis and treatment pathways for children, young people, and, as of 2024, adults with ADHD. Rather than asking clinicians to enter data twice, the ADHD Database pulls directly from LPR, which the source material describes plainly: "ADHD-databasen bruger data fra LPR, hvorved klinikerne undgår dobbelt registreringer i en separat database" [^src2] [^src3].

Two specific LPR "forløbsmarkører" (pathway markers) form the backbone of how patients are counted in the database. Første kriterium for inklusion af et udredningsforløb er LPR-forløbsmarkøren 'ADHD udredning start' (AGX01A) [^src1]. Inklusion af et behandlingsforløb i behandlingspopulation kræver LPR-forløbsmarkøren 'BUP ADHD: pakkeforløb start' (AHB01A) eller 'ADHD: pakkeforløb start' (AGB12A) og mindst en diagnosekode (A-, B- eller tillægsdiagnose) for ADHD (DF 90.0, 90.1, 90.8, 98.8C) [^src1]. Nøglekoderne for inklusion i databasen 'ADHD-udredning start' og 'ADHD-pakkeforløb start' er i LPR3-forløbsmarkører [^src1].

The reliance on LPR is not without cost. Til forløbsmarkører findes ikke direkte information om indberettende afdeling [^src1]. Derfor udvælges den forløbsansvarlige afdeling efter overgangen til LPR3 som den afdeling, der har den første kontakt i udredningsforløbet/pakkeforløbet [^src1]. Dette defineres som første kontakt på eller efter dato for forløbsmarkøren [^src1]. Der inddrages i den forbindelse kun kontakter, der er givet under samme forløbselement som forløbsmarkøren og som er givet på afdelinger med enten psykiatri eller børne- og ungdomspsykiatri som speciale (begge krav skal være opfyldt) [^src1].

More fundamentally, missing registration in LPR is ambiguous. Brug af LPR-data har dog den ulempe, at manglende registrering både kan dække over, at proceduren ikke er udført, eller at den ikke er registreret [^src1]. Når der ikke er angivet en procedurekode, tolkes det i indikatorberegningerne som, at proceduren ikke er udført, men en anden mulighed er, at proceduren er udført, men ikke indberettet, hvilket vil føre til en underestimering af det reelle indikatorresultat [^src1]. Dette kan være et problem mht. fortolkningen af resultaterne, bl.a. når vi sammenligner indikatorresultater, da vi ikke ved, om variationen mellem regioner og afdelinger skyldes forskellig registreringspraksis eller reelle forskelle i klinisk praksis [^src1].

LPR sits at the center of the broader documentary context: the ADHD Database is a nationwide Danish quality-monitoring database covering assessment and treatment of ADHD in children, young people, and adults, and LPR is explicitly the mechanism that lets the database avoid duplicate data entry while also being flagged as a source of interpretive risk in the 2024 annual report — for instance in explaining large regional variation in Indicator 11 results (85% in Region Nordjylland versus 37% in Region Hovedstaden), which the report attributes more likely to registration difficulties than to real clinical differences.

## Mentions

- Page 41: "ADHD-databasen bruger data fra LPR, hvorved klinikerne undgår dobbelt registreringer i en separat database" (source: wikis/rkkp-adhd/raw/ADHD_2023.pdf, pages 41-45) [^src2]
- Page 56: "ADHD-databasen bruger data fra LPR, hvorved klinikerne undgår dobbeltregistreringer i en separat database" (source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 56-60) [^src3]
- Page 56: "Brug af LPR-data har dog den ulempe, at manglende registrering både kan dække over, at proceduren ikke er udført, eller at den ikke er registreret" (source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 56-60) [^src3]
- Page 66: "Første kriterium for inklusion af et udredningsforløb er LPR-forløbsmarkøren 'ADHD udredning start' (AGX01A)." (source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 66-70) [^src4]
- Page 67: "Inklusion af et behandlingsforløb i behandlingspopulation kræver LPR-forløbsmarkøren 'BUP ADHD: pakkeforløb start' (AHB01A) eller 'ADHD: pakkeforløb start' (AGB12A)" (source: wikis/rkkp-adhd/raw/ADHD_2024.pdf, pages 66-70) [^src4]

## Relationships

(none)

## Claims

**Observation**
- Brug af LPR-data har dog den ulempe, at manglende registrering både kan dække over, at proceduren ikke er udført, eller at den ikke er registreret [^src1]
- Når der ikke er angivet en procedurekode, tolkes det i indikatorberegningerne som, at proceduren ikke er udført, men en anden mulighed er, at proceduren er udført, men ikke indberettet, hvilket vil føre til en underestimering af det reelle indikatorresultat [^src1]
- Dette kan være et problem mht. fortolkningen af resultaterne, bl.a. når vi sammenligner indikatorresultater, da vi ikke ved, om variationen mellem regioner og afdelinger skyldes forskellig registreringspraksis eller reelle forskelle i klinisk praksis [^src1]
- til forløbsmarkører findes ikke direkte information om indberettende afdeling [^src1]

**Methodology**
- Nøglekoderne for inklusion i databasen 'ADHD-udredning start' og 'ADHD-pakkeforløb start' er i LPR3-forløbsmarkører [^src1]
- Derfor udvælges den forløbsansvarlige afdeling efter overgangen til LPR3 som den afdeling, der har den første kontakt i udredningsforløbet/pakkeforløbet [^src1]
- Dette defineres som første kontakt på eller efter dato for forløbsmarkøren [^src1]
- Der inddrages i den forbindelse kun kontakter, der er givet under samme forløbselement som forløbsmarkøren og som er givet på afdelinger med enten psykiatri eller børne- og ungdomspsykiatri som speciale (begge krav skal være opfyldt) [^src1]

**Procedural**
- Første kriterium for inklusion af et udredningsforløb er LPR-forløbsmarkøren 'ADHD udredning start' (AGX01A) [^src1]
- Inklusion af et behandlingsforløb i behandlingspopulation kræver LPR-forløbsmarkøren 'BUP ADHD: pakkeforløb start' (AHB01A) eller 'ADHD: pakkeforløb start' (AGB12A) og mindst en diagnosekode (A-, B- eller tillægsdiagnose) for ADHD (DF 90.0, 90.1, 90.8, 98.8C) [^src1]

## Timeline

(none)

## Sources

[^src1]: ADHD_2024.pdf, pages 56-60, 66-70
[^src2]: ADHD_2023.pdf, pages 41-45
[^src3]: ADHD_2024.pdf, pages 56-60
[^src4]: ADHD_2024.pdf, pages 66-70
