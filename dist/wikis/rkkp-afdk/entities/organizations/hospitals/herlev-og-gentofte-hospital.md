---
title: Herlev og Gentofte Hospital
type: entity
aliases:
  - Herlev og Gentofte Hospital
wiki: rkkp-afdk
updated: '2026-08-14T19:50:42.549Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '16-20, 36-40, 41-45, 6-10'
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 56-60
tags:
  - organization
---
```yaml
---
title: "Herlev og Gentofte Hospital"
type: entity
wiki: rkkp-afdk
updated: "2024-05-24T10:00:00Z"
sources:
  - file: "wikis/rkkp-afdk/raw/AFDK_2023.pdf"
    pages: "6-10, 16-20, 36-40, 41-45"
  - file: "wikis/rkkp-afdk/raw/AFDK_2025.pdf"
    pages: "56-60"
---
```

# Herlev og Gentofte Hospital

Herlev og Gentofte Hospital is a major healthcare institution located within [[region-hovedstaden|Region Hovedstaden]] [^src4]. It is actively monitored in the Danish national clinical quality databases for atrial fibrillation, specifically featuring in detailed hospital-level analyses for various quality indicators tracking diagnosis, treatment, and long-term care [^src1], [^src2], [^src3], [^src4]. 

In the reporting period from July 1, 2022, to June 30, 2023, the hospital's performance was evaluated across multiple metrics. For [[indikator-2|Indikator 2]], which measures the proportion of newly diagnosed atrial fibrillation patients receiving an echocardiography, Herlev og Gentofte Hospital achieved a compliance rate of 63.0% (95% CI: 60.3–65.7), failing to meet the national standard [^src2]. The hospital also appears in the data tables for other indicators, including those tracking waiting times for anticoagulation therapy and long-term treatment coverage [^src1], [^src3], [^src4].

Beyond quantitative metrics, the hospital is recognized for its specific clinical practices in patient education. On the cardiology department at Herlev og Gentofte Hospital, group education is an integrated part of the offering for patients diagnosed with atrial fibrillation, serving as a concrete implementation model for [[indikator-4a|Indikator 4a]] [^src5]. The educational sessions last a total of 2.5 hours and are conducted in groups of either 14–16 patients plus relatives or larger groups of up to 35 patients plus relatives [^src5]. The curriculum is delivered by one or two arrhythmia nurses who cover anatomy, physiology, causes of atrial fibrillation, stroke risk, lifestyle, and living with the disease [^src5]. Additionally, a cardiologist participates for approximately 30 minutes, focusing specifically on the medical treatment of atrial fibrillation [^src5].

## Mentions

- Page 9: "Herlev og Gentofte Hospital Nej 753 / 841 0 (0) 89,5 (87,3-91,5) 801 / 903 88,7 88,2" [^src1]
- Page 16: "Herlev og Gentofte Hospital Nej 793 / 1.259 0 (0) 63,0 (60,3-65,7) 1.057 / 1.685 62,7 62,6" [^src2]
- Page 36: "Herlev og Gentofte Hospital Nej 386 / 434 0 (0) 88,9 (85,6-91,7) 553 / 632 87,5 86,8" [^src3]
- Page 42: "Herlev og Gentofte Hospital Nej 336 / 392 0 (0) 85,7 (81,9-89,0) 434 / 506 85,8" [^src4]
- Page 57: "På Herlev og Gentofte Hospitals hjerteafdeling er holdundervisning en integreret del af tilbuddet til patienter der får diagnosen atrieflimren." [^src5]

## Relationships

**Outgoing (this entity is the SUBJECT of these relationships):**
- Subject: herlev-og-gentofte-hospital
  Predicate: implements
  Object: indikator-4a
  Evidence: "På Herlev og Gentofte Hospitals hjerteafdeling er holdundervisning en integreret del af tilbuddet til patienter der får diagnosen atrieflimren."
  Page: 57
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 56-60 [^src5]

**Incoming (this entity is the OBJECT of these relationships):**
- Subject: indikator-2
  Predicate: measures
  Object: (this entity)
  Evidence: "Herlev og Gentofte Hospital er en af de institutioner, der rapporteres i tabellen for Indikator 2."
  Page: 16
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 16-20 [^src2]
- Subject: region-hovedstaden
  Predicate: contains-hospital
  Object: (this entity)
  Evidence: "Hovedstaden Nej [...] Herlev og Gentofte Hospital Nej [...]"
  Page: 42
  Source: wikis/rkkp-afdk/raw/AFDK_2023.pdf, pages 41-45 [^src4]

## Claims

**Clinical**
- Herlev og Gentofte Hospital opfyldte Indikator 2 hos 63,0 % (95 % CI: 60,3–65,7) af nydiagnosticerede patienter med atrieflimren i perioden 1. juli 2022 – 30. juni 2023 [^src1] (herlev-og-gentofte-hospital, indikator-2)

**Clinical-Practice**
- Holdundervisningen varer i alt i 2,5 timer og holdene består af enten 14-16 patienter plus pårørende eller større hold på op til 35 patienter plus pårørende [^src1] (herlev-og-gentofte-hospital)
- En eller to arytmi-sygeplejersker forestår undervisningen om anatomi og fysiologi, årsager til atrieflimren, risiko for stroke, samt livsstil og risikofaktorer, og livet med sygdom [^src1] (herlev-og-gentofte-hospital)
- En kardiolog deltager i ca. 30 min og har fokus på behandling af atrieflimren [^src1] (herlev-og-gentofte-hospital)

## Timeline

*(No timeline events extracted for this entity)*

## Sources

[^src1]: AFDK_2023.pdf, pages 6-10
[^src2]: AFDK_2023.pdf, pages 16-20
[^src3]: AFDK_2023.pdf, pages 36-40
[^src4]: AFDK_2023.pdf, pages 41-45
[^src5]: AFDK_2025.pdf, pages 56-60
