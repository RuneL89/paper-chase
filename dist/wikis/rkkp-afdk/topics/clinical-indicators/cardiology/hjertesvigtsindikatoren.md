---
title: Hjertesvigtsindikatoren
type: entity
wiki: rkkp-afdk
updated: '2026-08-14T21:16:35.768Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 81-85
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: 61-65
tags:
  - topic
---
**Hjertesvigtsindikatoren** (The Heart Failure Indicator) is a central clinical quality metric used in the Danish healthcare system to monitor the development of heart failure among patients newly diagnosed with atrial fibrillation. As detailed in the [[atrieflimren-i-danmark|Atrieflimren i Danmark]] reports published by the Regionernes Kliniske Kvalitetsudviklingsprogram (RKKP), this indicator specifically tracks the proportion of newly diagnosed atrial fibrillation patients—who did not previously have a heart failure diagnosis—who receive a hospital diagnosis of heart failure within their first year [^src1]. In the context of the 2025 reporting period, it is formally designated as [[indikator-15|Indikator 15]] [^src2].

The indicator relies on data from the [[landspatientregisteret|Landspatientregisteret]] (National Patient Registry) [^src1]. Heart failure is strictly defined as a hospital contact where heart failure is recorded as an A or B diagnosis using a specific set of ICD-10 codes, including [[di50-star|DI50*]], [[di110-star|DI110*]], [[di130-star|DI130*]], [[di132-star|DI132*]], [[di420-star|DI420*]], [[di426-star|DI426*]], [[di427-star|DI427*]], [[di428-star|DI428*]], and [[di429-star|DI429*]] [^src1]. This broad definition encompasses all types of heart failure, including atrial fibrillation-induced heart failure, tachycardia-induced heart failure, and heart failure with preserved (HFpEF) or reduced (HFrEF) ejection fraction [^src1]. The lifetime risk of developing heart failure after an atrial fibrillation diagnosis is notably high at 40% [^src1].

Statistical tracking of the indicator has shown a positive, continuous trend in reducing early heart failure complications. According to the 2024 report, 6.1% of patients were registered with a heart failure diagnosis within the first year of their atrial fibrillation diagnosis, representing a marked decrease from 9.0% over the preceding three reporting periods [^src1]. The 2025 report confirmed this ongoing improvement, noting that the proportion had fallen further to 5.8% [^src2]. Geographically, the 2024 data showed regional variation between 5.5% and 7.0%, and cluster-level variation between 4.5% and 7.5% [^src1]. The 2025 data reported slightly wider variations, with regions ranging from 5.4% to 7.2% and clusters from 4.5% to 9.0% [^src2].

Methodologically, the indicator is subject to ongoing refinement to improve its clinical relevance. A recent policy decision retained the indicator but applied a retroactive change to its measurement window: it now measures the occurrence of a heart failure diagnosis in the period from 3 months to 12 months after the initial atrial fibrillation diagnosis, rather than starting from day zero [^src2]. This adjustment helps account for prevalent, undiagnosed heart failure present at the time of the atrial fibrillation diagnosis, addressing some of the data limitations inherent in registry-based tracking.

## Mentions
- **Page 81:** "Hjertesvigtsindikatoren opgøres for ny diagnosticerede patienter med en atrieflimren-diagnose, som ikke havde en hjertesvigtsdiagnose i forvejen." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 81-85) [^src1]
- **Page 62:** "Hjertesvigtsindikatoren opgøres for ny diagnosticerede patienter med en atrieflimren-diagnose, som ikke havde en hjertesvigtsdiagnose i forvejen." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65) [^src2]

## Relationships
- **Subject:** hjertesvigtsindikatoren
  **Predicate:** is-calculated-using
  **Object:** landspatientregisteret
  **Evidence:** "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*) og er identificeret via data fra Landspatientregistret."
  **Page:** 81
  **Source:** wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 81-85 [^src1]

- **Subject:** hjertesvigtsindikatoren
  **Predicate:** uses-data-from
  **Object:** landspatientregisteret
  **Evidence:** "og er identificeret via data fra Landspatientregistret."
  **Page:** 62
  **Source:** wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65 [^src2]

- **Subject:** hjertesvigtsindikatoren
  **Predicate:** uses-diagnosis-code
  **Object:** di50-star
  **Evidence:** "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*)"
  **Page:** 62
  **Source:** wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65 [^src2]

- **Subject:** hjertesvigtsindikatoren
  **Predicate:** uses-diagnosis-code
  **Object:** di110-star
  **Evidence:** "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*)"
  **Page:** 62
  **Source:** wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65 [^src2]

- **Subject:** hjertesvigtsindikatoren
  **Predicate:** uses-diagnosis-code
  **Object:** di130-star
  **Evidence:** "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*)"
  **Page:** 62
  **Source:** wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65 [^src2]

- **Subject:** hjertesvigtsindikatoren
  **Predicate:** uses-diagnosis-code
  **Object:** di132-star
  **Evidence:** "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*)"
  **Page:** 62
  **Source:** wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65 [^src2]

- **Subject:** hjertesvigtsindikatoren
  **Predicate:** uses-diagnosis-code
  **Object:** di420-star
  **Evidence:** "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*)"
  **Page:** 62
  **Source:** wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65 [^src2]

- **Subject:** hjertesvigtsindikatoren
  **Predicate:** uses-diagnosis-code
  **Object:** di426-star
  **Evidence:** "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*)"
  **Page:** 62
  **Source:** wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65 [^src2]

- **Subject:** hjertesvigtsindikatoren
  **Predicate:** uses-diagnosis-code
  **Object:** di427-star
  **Evidence:** "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*)"
  **Page:** 62
  **Source:** wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65 [^src2]

- **Subject:** hjertesvigtsindikatoren
  **Predicate:** uses-diagnosis-code
  **Object:** di428-star
  **Evidence:** "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*)"
  **Page:** 62
  **Source:** wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65 [^src2]

- **Subject:** hjertesvigtsindikatoren
  **Predicate:** uses-diagnosis-code
  **Object:** di429-star
  **Evidence:** "Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*)"
  **Page:** 62
  **Source:** wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65 [^src2]

- **Subject:** indikator-15
  **Predicate:** is-defined-by
  **Object:** (this entity)
  **Evidence:** "Hjertesvigtsindikatoren opgøres for ny diagnosticerede patienter med en atrieflimren-diagnose, som ikke havde en hjertesvigtsdiagnose i forvejen."
  **Page:** 62
  **Source:** wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 61-65 [^src2]

## Claims

### Definition
- Hjertesvigtsindikatoren opgøres for ny diagnosticerede patienter med en atrieflimren-diagnose, som ikke havde en hjertesvigtsdiagnose i forvejen [^src1] (hjertesvigtsindikatoren, atrieflimren-i-danmark)
- Hjertesvigt er defineret som en hospitalskontakt med hjertesvigt som A eller B diagnose (DI50*, DI110*, DI130*, DI132*, DI420*, DI426*, DI427*, DI428*, DI429*) [^src1] (hjertesvigtsindikatoren, landspatientregisteret)
- Hjertesvigt efter atrieflimren omfatter alle typer af hjertesvigt, herunder atrieflimren-induceret hjertesvigt, takykardi-induceret hjertesvigt samt hjertesvigt med (HFpEF) og uden (HFrEF) bevaret systolefunktion [^src1] (hjertesvigtsindikatoren)

### Statistical
- Indenfor det første år efter AF diagnosen blev 6,1% registreret med en hjertesvigtsdiagnose [^src1] (hjertesvigtsindikatoren)
- På regionalt niveau varierer andelen fra 5,5-7,0% [^src1] (hjertesvigtsindikatoren)
- På klyngeniveau varierer andelen fra 4,5-7,5% [^src1] (hjertesvigtsindikatoren)
- Livstidsrisikoen for hjertesvigt efter atrieflimren er 40% [^src1] (hjertesvigtsindikatoren)
- Indenfor det første år efter AF diagnosen blev 5,8% registreret med en hjertesvigtsdiagnose. Der ses et kontinuerligt fald i andelen på tværs af år. [^src1] (indikator-15, hjertesvigtsindikatoren)
- På regionalt niveau varierer andelen fra 5,4-7,2%. [^src1] (indikator-15, hjertesvigtsindikatoren)
- På klyngeniveau varierer andelen fra 4,5-9%. [^src1] (indikator-15, hjertesvigtsindikatoren)

### Trend
- Der ses et markant fald i andelen i løbet af de seneste tre årsrapportsperioder fra 9,0-6,1% [^src1] (hjertesvigtsindikatoren)

### Policy-decision
- Indikatoren fastholdes, men ændres med tilbagevirkende kraft så der måles på forekomsten af hjertesvigtsdiagnose i perioden 3 måneder efter atrieflimren diagnose til 12 måneder efter. [^src1] (indikator-15, hjertesvigtsindikatoren)

## Timeline
No timeline events recorded.

## Sources

[^src1]: AFDK_2024.pdf, pages 81-85
[^src2]: AFDK_2025.pdf, pages 61-65
