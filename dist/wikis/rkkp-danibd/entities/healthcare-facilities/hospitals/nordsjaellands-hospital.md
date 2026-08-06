---
title: Nordsjællands Hospital
type: entity
aliases:
  - Nordsjællands Hospital
  - NOH
wiki: rkkp-danibd
updated: '2026-08-05T06:53:26.238Z'
sources:
  - file: wikis/rkkp-danibd/raw/DANIBD_2023.pdf
    pages: 26-29
  - file: wikis/rkkp-danibd/raw/DANIBD_2024.pdf
    pages: 26-30
tags:
  - healthcare-facility
---
**Nordsjællands Hospital** (often abbreviated as NOH) is a healthcare facility located in [[region-hovedstaden|Region Hovedstaden]] (the Capital Region of Denmark) [^src2]. It plays a significant role in the national quality measurement and treatment of [[ibd|IBD]] (Inflammatory Bowel Disease) in Denmark, as documented in the DANIBD reports [^src1], [^src2].

The hospital is particularly notable for its integration of a local [[npu-kode|NPU-kode]] (NPU code) for point-of-care [[calprotectin|calprotectin]] measurements (PTP00001 F-calprotectin POC) [^src1]. This local code implementation directly contributes to the data for Indicator 5 in the DANIBD 2024 report, which tracks fecal calprotectin measurements in patients receiving biological treatments [^src1]. Clinically, the hospital's guidelines mandate one annual calprotectin measurement for "quiescent" (resting) IBD patients, while measurement frequencies for patients on biological therapy are individualized [^src2].

Operationally, Nordsjællands Hospital has achieved high adoption of digital monitoring and patient education tools. Approximately 85–90% of its IBD patients are monitored via the [[constant-care|Constant – Care]] app [^src2]. Patient education at the facility is conducted ad hoc during onboarding to the Constant – Care app and at the initiation of medication [^src2]. Furthermore, the hospital hosts a patient school twice a year, providing instruction from a multidisciplinary team of nurses, doctors, dietitians, and social workers [^src2].

In the broader context of the DANIBD 2023 report, Nordsjællands Hospital provided detailed regional comments on behalf of Region Hovedstaden regarding biomarker monitoring and patient education [^src2]. These insights revealed both local successes—such as the high utilization of digital monitoring apps—and systemic barriers, notably the lack of a national coding system for digital tests [^src2].

## Mentions
- Page 26: "Som opfølgning på sidste audit er den lokale NPU-kode for måling af F-calprotectin også inkluderet (PTP00001 F-calprotectin POC). Koden anvendes på Nordsjællands Hospital." (source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 26-30)
- Page 28: "Nordsjællands Hospital" (source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 26-29)
- Page 28: "NOH" (source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 26-29)

## Relationships
**Outgoing**
- **Subject:** nordsjaellands-hospital
  **Predicate:** is-located-in
  **Object:** region-hovedstaden
  **Evidence:** "Region Hovedstaden
Nordsjællands Hospital"
  **Page:** 28
  **Source:** wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 26-29

**Incoming**
- **Subject:** npu-kode
  **Predicate:** used-at
  **Object:** nordsjaellands-hospital
  **Evidence:** "Koden anvendes på Nordsjællands Hospital."
  **Page:** 26
  **Source:** wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 26-30
- **Subject:** constant-care
  **Predicate:** is-used-by
  **Object:** nordsjaellands-hospital
  **Evidence:** "På NOH monitoreres ca. 85-90 % af vores IBD patienter via vores app Constant – Care"
  **Page:** 28
  **Source:** wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 26-29

## Claims
- Koden anvendes på Nordsjællands Hospital [^src1] (npu-kode, nordsjaellands-hospital)
  **Type:** administrative
  **Page:** 26
  **Source:** wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 26-30
- På Nordsjællands Hospital monitoreres ca. 85–90 % af IBD-patienterne via appen Constant – Care [^src1] (nordsjaellands-hospital, constant-care, ibd)
  **Type:** operational
  **Page:** 28
  **Source:** wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 26-29
- Målet for 'hvilende' IBD-patienter på NOH er én årlig calprotectin-måling, mens målingsrater for patienter i biologisk behandling er individualiserede [^src1] (nordsjaellands-hospital, calprotectin, ibd)
  **Type:** clinical-guideline
  **Page:** 28
  **Source:** wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 26-29
- Patientundervisning på NOH foregår ad hoc ved indrulning i Constant – Care og ved opstart af medicin, samt to gange årligt via patientskole med undervisning af sygeplejersker, læger, diætister og socialrådgivere [^src1] (nordsjaellands-hospital, constant-care)
  **Type:** operational
  **Page:** 28
  **Source:** wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 26-29

## Timeline
(none)

## Sources

[^src1]: DANIBD_2024.pdf, pages 26-30
[^src2]: DANIBD_2023.pdf, pages 26-29
