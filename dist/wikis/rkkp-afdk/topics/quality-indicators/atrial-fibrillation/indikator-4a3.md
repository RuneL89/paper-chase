---
title: Indikator 4a3
type: entity
aliases:
  - Indikator 4a3
wiki: rkkp-afdk
updated: '2026-08-05T21:15:30.086Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '31-35, 36-40'
tags:
  - quality-indicator
---
**Indikator 4a3** is an extended quality indicator defined by the [[regionernes-kliniske-kvalitetsudviklingsprogram|Regionernes Kliniske Kvalitetsudviklingsprogram]] (RKKP) to monitor long-term treatment adherence in the Danish healthcare system [^src1]. Specifically, it measures the proportion of patients diagnosed with [[atrieflimren]] who have an indication for [[antikoagulationsbehandling]] and are still receiving this treatment five years after their initial diagnosis (index date) [^src1]. The indicator is a critical component of the national quality program for atrial fibrillation, utilized to generate national maps, trend graphs, and detailed tables at both the regional and cluster levels to ensure evidence-based, safe treatment and prevent strokes across Denmark [^src1].

Data for Indikator 4a3 is calculated using records from the [[landspatientregisteret|Landspatientregisteret]] and the [[laegemiddelstatistikregisteret|Lægemiddelstatistikregisteret]] [^src2]. The established performance standard for this indicator, as well as for other follow-up periods, is [[standard|Standard: ≥90 %]] [^src1]. However, on a national level, this standard has not been met in any of the follow-up periods; nationally, 89.1% of patients were on anticoagulation 1 year post-diagnosis, 88.6% after 2 years, and 87.3% after 5 years [^src2]. Despite falling short of the 90% target, there has been an observed increase in treatment persistence since 2016, and the overall persistence levels remain high compared to other countries [^src2]. Consequently, the decision has been made to maintain both the indicator and its standard [^src2].

Geographically, performance varies across regions and local health clusters. For the measurement period spanning July 1, 2018, to June 30, 2019, [[region-nordjylland|Region Nordjylland]] successfully met the standard across all follow-up periods [^src2]. [[region-midtjylland|Region Midtjylland]] also met the standard at the 2-year follow-up mark [^src2]. Conversely, several local clusters failed to meet the standard, including [[sundhedsklynge-sydvestjylland|Sundhedsklynge Sydvestjylland]] and [[goedstrupklyngen|Gødstrupklyngen]] [^src2]. These geographic variations underscore the need for targeted quality improvement initiatives at the regional and local levels to ensure consistent long-term cardiovascular care [^src2].

## Mentions
- Page 33: "Indikator 4a3: Andelen af patienter med atrieflimren, med indikation for antikoagulationsbehandling, der modtager behandling 5 år efter indeksdato" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 31-35)
- Page 34: "Indikator 4a3: Andelen af patienter med atrieflimren, med indikation for antikoagulationsbehandling, der modtager behandling 5 år efter indeksdato" (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 31-35)
- Page 36: "Indikator 4a3: Andelen af patienter med atrieflimren, med indikation for antikoagulationsbehandling, der modtager behandling 5 år efter indeksdato. Kontroldiagram på regionsniveau." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 36-40)

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: indikator-4a3
  Predicate: measures-treatment-of
  Object: atrieflimren
  Evidence: "Indikator 4a3: Andelen af patienter med atrieflimren, med indikation for antikoagulationsbehandling, der modtager behandling 5 år efter indeksdato"
  Page: 33
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 31-35
- Subject: indikator-4a3
  Predicate: is-defined-by
  Object: regionernes-kliniske-kvalitetsudviklingsprogram
  Evidence: "Regionernes Kliniske Kvalitetsudviklingsprogram"
  Page: 33
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 31-35
- Subject: indikator-4a3
  Predicate: is-calculated-from
  Object: landspatientregisteret
  Evidence: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret."
  Page: 37
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 36-40
- Subject: indikator-4a3
  Predicate: is-calculated-from
  Object: laegemiddelstatistikregisteret
  Evidence: "Data til beregning af indikatoren er indhentet fra Landspatientregisteret og Lægemiddelstatistikregisteret."
  Page: 37
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 36-40

Incoming (this entity is the OBJECT of these relationships):
- Subject: standard-90-percent
  Predicate: applies-to
  Object: (this entity)
  Evidence: "Standard ≥ 90% Tæller/ antal 01.07.2018 - 30.06.2019"
  Page: 34
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 31-35
- Subject: region-nordjylland
  Predicate: meets-standard-for
  Object: (this entity)
  Evidence: "På regionalt niveau opfylder Region Nordjylland standarden på tværs af alle opfølgningsperioder."
  Page: 38
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 36-40
- Subject: region-midtjylland
  Predicate: meets-standard-for
  Object: (this entity)
  Evidence: "Også Region Midtjylland opfylder standarden 2 år efter indeksdato."
  Page: 38
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 36-40
- Subject: sundhedsklynge-sydvestjylland
  Predicate: does-not-meet-standard-for
  Object: (this entity)
  Evidence: "4 klynger (Klyngerne SYD og NORD i Region Nordjylland, Gødstrupklyngen i Midtjylland samt Sundhedsklynge Sydvestjylland)."
  Page: 38
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 36-40
- Subject: goedstrupklyngen
  Predicate: does-not-meet-standard-for
  Object: (this entity)
  Evidence: "4 klynger (Klyngerne SYD og NORD i Region Nordjylland, Gødstrupklyngen i Midtjylland samt Sundhedsklynge Sydvestjylland)."
  Page: 38
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 36-40

## Claims
- Indikator 4a3 måler andelen af patienter med atrieflimren, med indikation for antikoagulationsbehandling, der modtager behandling 5 år efter indeksdato [^src1] (indikator-4a3, atrieflimren, antikoagulationsbehandling)
  Type: clinical-practice-decision
  Page: 33
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 31-35
- På landsplan var 89,1% af patienterne med atrieflimren i AK-behandling 1 år efter diagnosen blev stillet, 88,6% efter 2 år og 87,3% efter 5 år [^src1] (indikator-4a3)
  Type: clinical-outcome
  Page: 38
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 36-40
- For alle opfølgningsperioder er standarden 90%, og den er således ikke opfyldt på nationalt niveau i nogen af opfølgningsperioderne [^src1] (indikator-4a3)
  Type: policy-decision
  Page: 38
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 36-40
- Der er observeret stigende persistens til antikoagulationsbehandling i perioden siden 2016, som generelt ligger på et højt niveau sammenlignet med andre lande [^src1] (indikator-4a3)
  Type: epidemiology
  Page: 38
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 36-40
- Indikatoren og standarden fastholdes [^src1] (indikator-4a3)
  Type: policy-decision
  Page: 38
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 36-40

## Timeline
- 2018-07-01: Start af måleperiode for indikator 4a3 (01.07.2018–30.06.2019) (indikator-4a3)
- 2019-06-30: Slut på måleperiode for indikator 4a3 (01.07.2018–30.06.2019) (indikator-4a3)
- 2016: Startpunkt for observation af stigende persistens til antikoagulationsbehandling (indikator-4a3)

## Sources

[^src1]: AFDK_2024.pdf, pages 31-35
[^src2]: AFDK_2024.pdf, pages 36-40
