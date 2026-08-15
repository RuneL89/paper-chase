---
title: Struktureret undervisningsprogram
type: entity
aliases:
  - Struktureret undervisningsprogram
wiki: rkkp-afdk
updated: '2026-08-14T20:55:11.115Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 6-10
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: '51-55, 6-10'
tags:
  - clinical-intervention
---
A **structured education program** (*struktureret undervisningsprogram*) is a clinical intervention designed to provide systematic patient education to individuals recently diagnosed with [[atrieflimren]]. Within the Danish healthcare quality monitoring framework, this intervention is the specific focus of [[indikator-8|Indikator 8]], a process indicator that measures the proportion of newly diagnosed atrial fibrillation patients who receive this systematic education within the first year after their diagnosis [^src1] [^src3].

The implementation of this educational intervention is a key metric for evaluating the quality of cardiovascular care in Denmark. The national quality standard mandates that at least 50% (≥ 50%) of newly diagnosed patients must be enrolled in and receive a structured education program within that first year [^src1]. To ensure accountability and drive quality improvement, the delivery of this program is rigorously tracked and visualized through control charts at both the regional and individual hospital levels [^src3].

## Mentions

- Page 6: "som får et struktureret undervisningsprogram indenfor det 1. år efter at diagnosen er stillet (specifik kode for AF)." [^src1]
- Page 6: "struktureret undervisningsprogram" [^src2]
- Page 51: "Andel af nydiagnosticerede patienter med atrieflimren som får et struktureret undervisningsprogram indenfor det 1. år efter at diagnosen er stillet." [^src3]
- Page 52: "Andel af nydiagnosticerede patienter med atrieflimren som får et struktureret undervisningsprogram indenfor det 1. år efter at diagnosen er stillet (specifik kode for AF)" [^src3]
- Page 54: "Andel af nydiagnosticerede patienter med atrieflimren som får et struktureret undervisningsprogram indenfor det 1. år efter at diagnosen er stillet. Kontroldiagram på regionsniveau." [^src3]
- Page 55: "Andel af nydiagnosticerede patienter med atrieflimren som får et struktureret undervisningsprogram inden for det 1. år efter at diagnosen er stillet. Kontroldiagram på hospitalsniveau." [^src3]

## Relationships

**Outgoing (this entity is the SUBJECT of these relationships):**

- **Subject:** struktureret-undervisningsprogram
  **Predicate:** is-delivered-to
  **Object:** atrieflimren
  **Evidence:** "nydiagnosticerede patienter med atrieflimren som får et struktureret undervisningsprogram indenfor det 1. år efter at diagnosen er stillet"
  **Page:** 6
  **Source:** [^src1]

**Incoming (this entity is the OBJECT of these relationships):**

- **Subject:** indikator-8
  **Predicate:** measures
  **Object:** (this entity)
  **Evidence:** "Andel af nydiagnosticerede patienter med atrieflimren som får et struktureret undervisningsprogram indenfor det 1. år efter at diagnosen er stillet (specifik kode for AF)"
  **Page:** 6
  **Source:** [^src2]

- **Subject:** indikator-8
  **Predicate:** measures-implementation-of
  **Object:** (this entity)
  **Evidence:** "Indikator 8: Andel af nydiagnosticerede patienter med atrieflimren som får et struktureret undervisningsprogram"
  **Page:** 51
  **Source:** [^src3]

## Claims

- Indikator 8 har standarden ≥ 50 % for andelen af nydiagnosticerede patienter med atrieflimren, som får et struktureret undervisningsprogram indenfor det 1. år efter at diagnosen er stillet [^src1] (atrieflimren, struktureret-undervisningsprogram, indikator-8)
  - **Type:** quality-standard
- Indikator 8 måler andelen af nydiagnosticerede patienter med atrieflimren, som får et struktureret undervisningsprogram inden for det første år efter diagnosen [^src1] (indikator-8, struktureret-undervisningsprogram)
  - **Type:** definition

## Timeline

- None

## Sources

[^src1]: AFDK_2024.pdf, pages 6-10
[^src2]: AFDK_2025.pdf, pages 6-10
[^src3]: AFDK_2025.pdf, pages 51-55
