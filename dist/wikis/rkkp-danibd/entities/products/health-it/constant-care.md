---
title: Constant – Care
type: entity
aliases:
  - Constant – Care
wiki: rkkp-danibd
updated: '2026-08-05T06:42:56.337Z'
sources:
  - file: wikis/rkkp-danibd/raw/DANIBD_2023.pdf
    pages: 26-29
tags:
  - product
---
**Constant – Care** is a digital patient application designed for the remote monitoring and management of patients with [[ibd|IBD]] (Inflammatory Bowel Disease). It serves as a central clinical tool for tracking patient health and facilitating point-of-care (POC) biomarker measurements, specifically the testing of [[calprotectin|calprotectin]] [^src1]. 

The application is a cornerstone of daily operations at [[nordsjaellands-hospital|Nordsjællands Hospital]] (NOH) in the Capital Region of Denmark. According to regional operational reports, approximately 85–90% of all IBD patients at NOH are actively monitored via the Constant – Care app [^src1]. Beyond remote clinical monitoring, the app is deeply integrated into the hospital's patient education framework. Patients receive ad hoc training when they are enrolled in the system and when initiating new medical treatments [^src1]. This digital onboarding is supplemented by biannual, in-person patient schooling led by multidisciplinary teams that include nurses, physicians, dietitians, and social workers [^src1].

While Constant – Care represents a significant local clinical success at Nordsjællands Hospital, it also illustrates broader systemic challenges within Denmark's healthcare data infrastructure. In the context of the 2023 DANIBD national quality measurement, the app's technical architecture—specifically its lack of a standardized national or international coding system for its digital tests—was identified as a structural barrier to comprehensive national data collection. This highlights the ongoing friction between localized digital health innovations and the technical requirements for nationwide clinical registries.

## Mentions
- Page 28: "vores app Constant – Care" [^src1]

## Relationships
**Outgoing (this entity is the SUBJECT of these relationships):**
- **Subject:** constant-care
  **Predicate:** is-used-by
  **Object:** nordsjaellands-hospital
  **Evidence:** "På NOH monitoreres ca. 85-90 % af vores IBD patienter via vores app Constant – Care" [^src1]
  **Page:** 28
  **Source:** wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 26-29

**Incoming (this entity is the OBJECT of these relationships):**
- **Subject:** calprotectin
  **Predicate:** is-measured-via
  **Object:** (this entity)
  **Evidence:** "I denne app indgår måling af calprotectin som en poc prøve" [^src1]
  **Page:** 28
  **Source:** wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 26-29

## Claims
**Operational**
- På Nordsjællands Hospital monitoreres ca. 85–90 % af IBD-patienterne via appen Constant – Care [^src1] (nordsjaellands-hospital, constant-care, ibd)
  **Page:** 28
  **Source:** wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 26-29
- Patientundervisning på NOH foregår ad hoc ved indrulning i Constant – Care og ved opstart af medicin, samt to gange årligt via patientskole med undervisning af sygeplejersker, læger, diætister og socialrådgivere [^src1] (nordsjaellands-hospital, constant-care)
  **Page:** 28
  **Source:** wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 26-29

## Timeline
*(No chronological events extracted for this entity)*

## Sources

[^src1]: DANIBD_2023.pdf, pages 26-29
