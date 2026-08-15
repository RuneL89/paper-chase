---
title: Sundhedsdatastyrelsen
type: entity
wiki: rkkp-afdk
updated: '2026-08-14T20:00:56.629Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2023.pdf
    pages: '21-25, 26-30, 51-55'
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: '16-20, 21-25, 41-45'
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: '21-25, 31-35, 61-65'
tags:
  - organization
---
Sundhedsdatastyrelsen is the national authority responsible for managing health data infrastructure and clinical quality registries in Denmark. Within the context of cardiovascular care, it plays a central role in hosting and administering the [[laboratoriedatabasen|Laboratoriedatabasen]] (Laboratory Database) [^src2] [^src7]. This database aggregates laboratory results from the country's major laboratories, which are connected to and feed into the system via the [[den-nationale-labdatabank|Den Nationale Labdatabank]] (National Lab Databank) [^src3] [^src8]. However, the data pipeline is not seamless; structural barriers exist where certain laboratory responses are not forwarded to the National Lab Databank and consequently fail to reach the Laboratoriedatabasen at Sundhedsdatastyrelsen, resulting in incomplete data coverage for national quality measurements [^src6].

Beyond data hosting, the authority holds significant regulatory power over clinical quality databases. It serves as the official approving body for the [[databasen-for-atrieflimren-i-danmark|Databasen for Atrieflimren i Danmark]] (AFDK) [^src9]. Following Sundhedsdatastyrelsen's formal approval of the AFDK, the implementation of the database made it legally mandatory for all hospitals—and eventually general medical practices—to report their clinical data [^src9].

Despite its foundational role in the national health data ecosystem, Sundhedsdatastyrelsen is identified as the cause of a systematic data source limitation affecting Indicator 2, which measures the performance of echocardiography in newly diagnosed atrial fibrillation patients. The authority does not deliver echocardiography data originating from private hospitals to the [[landspatientregisteret|Landspatientregisteret]] (National Patient Register) [^src1] [^src4]. Because Sundhedsdatastyrelsen withholds or does not provide these specific data points, echocardiograms performed at private hospitals and reported to the National Patient Register are systematically excluded from the national quality indicators [^src1] [^src4].

## Mentions

- Page 22: "Ekkokardiografi, som er foretaget på privathospitaler og indberettet til Landspatientregisteret, indgår ikke, da Sundhedsdatastyrelsen ikke leverer disse data." [^src1]
- Page 29: "Laboratoriedatabasen hos Sundhedsdatastyrelsen" [^src2]
- Page 53: "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." [^src3]
- Page 19: "da Sundhedsdatastyrelsen ikke leverer disse data." [^src4]
- Page 24: "Laboratoriedatabasen hos Sundhedsdatastyrelsen" [^src5]
- Page 43: "Laboratoriedatabasen hos Sundhedsdatastyrelsen" [^src6]
- Page 24: "hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." [^src7]
- Page 34: "hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." [^src8]
- Page 63: "Med Sundhedsdatastyrelsens godkendelse af AFDK bliver det ved implementeringen af databasen lovpligtigt for alle sygehuse og på sigt lægepraksis at indrapportere." [^src9]

## Relationships

**Outgoing**
- **Subject:** sundhedsdatastyrelsen | **Predicate:** hosts | **Object:** laboratoriedatabasen | **Evidence:** "Laboratoriedatabasen hos Sundhedsdatastyrelsen" | **Page:** 29 | **Source:** [^src2]
- **Subject:** sundhedsdatastyrelsen | **Predicate:** administers | **Object:** laboratoriedatabasen | **Evidence:** "hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." | **Page:** 24 | **Source:** [^src7]

**Incoming**
- **Subject:** den-nationale-labdatabank | **Predicate:** feeds-into | **Object:** sundhedsdatastyrelsen | **Evidence:** "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." | **Page:** 29 | **Source:** [^src2]
- **Subject:** den-nationale-labdatabank | **Predicate:** feeds-into | **Object:** sundhedsdatastyrelsen | **Evidence:** "Laboratoriesvar er tilgængelige fra landets større laboratorier, som er tilsluttet Den Nationale Labdatabank, hvorfra de indlæses i Laboratoriedatabasen hos Sundhedsdatastyrelsen." | **Page:** 53 | **Source:** [^src3]
- **Subject:** landspatientregisteret | **Predicate:** does-not-contain-data-from | **Object:** sundhedsdatastyrelsen | **Evidence:** "da Sundhedsdatastyrelsen ikke leverer disse data." | **Page:** 19 | **Source:** [^src4]
- **Subject:** laboratoriedatabasen | **Predicate:** is-administered-by | **Object:** sundhedsdatastyrelsen | **Evidence:** "Laboratoriedatabasen hos Sundhedsdatastyrelsen" | **Page:** 24 | **Source:** [^src5]
- **Subject:** den-nationale-labdatabank | **Predicate:** feeds-into | **Object:** sundhedsdatastyrelsen | **Evidence:** "Laboratoriesvar [...] videresendes ikke til Den Nationale Labdatabank, og dermed heller ikke til Laboratoriedatabasen [hos Sundhedsdatastyrelsen]." | **Page:** 43 | **Source:** [^src6]
- **Subject:** databasen-for-atrieflimren-i-danmark | **Predicate:** is-godkendt-by | **Object:** sundhedsdatastyrelsen | **Evidence:** "Med Sundhedsdatastyrelsens godkendelse af AFDK bliver det ved implementeringen af databasen lovpligtigt for alle sygehuse og på sigt lægepraksis at indrapportere." | **Page:** 63 | **Source:** [^src9]

## Claims

*(No explicit claims extracted outside of relationships and mentions)*

## Timeline

*(No explicit timeline events extracted)*

## Sources

[^src1]: AFDK_2023.pdf, pages 21-25
[^src2]: AFDK_2023.pdf, pages 26-30
[^src3]: AFDK_2023.pdf, pages 51-55
[^src4]: AFDK_2024.pdf, pages 16-20
[^src5]: AFDK_2024.pdf, pages 21-25
[^src6]: AFDK_2024.pdf, pages 41-45
[^src7]: AFDK_2025.pdf, pages 21-25
[^src8]: AFDK_2025.pdf, pages 31-35
[^src9]: AFDK_2025.pdf, pages 61-65
