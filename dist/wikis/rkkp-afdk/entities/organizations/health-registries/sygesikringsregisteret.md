---
title: Sygesikringsregisteret
type: entity
wiki: rkkp-afdk
updated: '2026-08-03T19:14:15.333Z'
sources:
  - file: AFDK_2023.pdf
    pages: 21-25
  - file: AFDK_2024.pdf
    pages: '101-105, 16-20'
tags:
  - organization
---

# Sygesikringsregisteret

Sygesikringsregisteret er en vigtig datakilde for ekkokardiografi-data fra speciallægepraksis og indgår i beregningen af indikator 2.

## Mentions

- Page 22: "Data vedrørende ekkokardiografi stammer både fra Landspatientregisteret og fra Sygesikringsregisteret" [^src1]
- Page 22: "Fra Sygesikringsregisteret er det kun muligt at trække oplysninger om i hvilken uge en ydelse er indberettet til registeret" [^src1]
- Page 19: "Data vedrørende ekkokardiografi stammer både fra Landspatientregisteret og fra Sygesikringsregisteret" [^src2]
- Page 105: "Koder for ekkokardiografi i Sygesikringsregisteret" [^src3]

## Relationships

- [[indikator-2-ekkokardiografi|Indikator 2: Andel af nydiagnosticerede patienter med atrieflimren, der har fået udført ekkokardiografi fra 6 måneder før til 3 måneder efter 1. diagnosedato]] — uses-data-from (incoming) — "Data vedrørende ekkokardiografi stammer både fra Landspatientregisteret og fra Sygesikringsregisteret" [^src2] (Page 19)
- [[ekkokardiografi|Ekkokardiografi]] — is-coded-in (incoming) — "Koder for ekkokardiografi i Sygesikringsregisteret: 2208, 3810, 3811, 5101, 5102, 5103, 6402, 6408, 0906" [^src3] (Page 105)

## Claims

- Data vedrørende ekkokardiografi stammer både fra Landspatientregisteret og fra Sygesikringsregisteret ([[landspatientregisteret|Landspatientregisteret]], [[sygesikringsregisteret|Sygesikringsregisteret]])
- Fra Sygesikringsregisteret er det kun muligt at trække oplysninger om i hvilken uge en ydelse er indberettet til registeret og ikke hvilken dato, den rent faktisk er blevet ydet ([[sygesikringsregisteret|Sygesikringsregisteret]])
- Den store indberetningsuge til Sygesikringsregisteret er den sidste uge i måneden, hvor knap halvdelen af hele månedens afregninger registreres ([[sygesikringsregisteret|Sygesikringsregisteret]])
- Der er ved beregningen af indikatoren medtaget ekkokardiografiske undersøgelser foretaget i praktiserende speciallægepraksis og indberettet til Sygesikringsregisteret op til 4 måneder efter diagnosedatoen i hospitalsregi ([[sygesikringsregisteret|Sygesikringsregisteret]])
- Data vedrørende ekkokardiografi stammer både fra Landspatientregisteret og fra Sygesikringsregisteret ([[landspatientregisteret|Landspatientregisteret]], [[sygesikringsregisteret|Sygesikringsregisteret]])
- Fra Sygesikringsregisteret er det kun muligt at trække oplysninger om i hvilken uge en ydelse er indberettet til registeret og ikke hvilken dato, den rent faktisk er blevet ydet ([[sygesikringsregisteret|Sygesikringsregisteret]])
- Den store indberetningsuge til Sygesikringsregisteret er den sidste uge i måneden, hvor knap halvdelen af hele månedens afregninger registreres ([[sygesikringsregisteret|Sygesikringsregisteret]])
- Ved beregningen af indikatoren er der medtaget ekkokardiografiske undersøgelser foretaget i praktiserende speciallægepraksis og indberettet til Sygesikringsregisteret op til 4 måneder efter diagnosedatoen ([[indikator-2-ekkokardiografi|Indikator 2: Andel af nydiagnosticerede patienter med atrieflimren, der har fået udført ekkokardiografi fra 6 måneder før til 3 måneder efter 1. diagnosedato]], [[sygesikringsregisteret|Sygesikringsregisteret]])

## Sources

[^src1]: AFDK_2023.pdf, pages 21-25
[^src2]: AFDK_2024.pdf, pages 16-20
[^src3]: AFDK_2024.pdf, pages 101-105
