---
title: FPIAC
type: entity
wiki: rkkp-danibd
updated: '2026-08-15T07:10:26.008Z'
sources:
  - file: wikis/rkkp-danibd/raw/DANIBD_2025.pdf
    pages: 16-20
tags:
  - medical-condition
---
Food protein-induced allergic proctocolitis (FPIAC) is a non-IgE-mediated food allergy, typically triggered by cow's milk protein, which causes blood in the stool of otherwise well-nourished infants [^src1]. It is crucial to disambiguate FPIAC from inflammatory bowel disease (IBD) or infectious colitis, as it is a distinct condition with a different clinical trajectory and management approach [^src1].

Despite its distinct clinical profile, FPIAC has emerged as a notable source of data contamination within the Danish national IBD registry (DANIBD). Infants presenting with FPIAC are occasionally misclassified and registered with a diagnosis of [[dk51-ulceroes-colitis|DK51* Ulcerøs colitis]] (specifically left-sided ulcerative colitis) without undergoing relevant diagnostic investigations [^src1]. This misclassification directly compromises the data quality for Quality Indicator 1b, a metric designed to evaluate the completeness of diagnostic workups for IBD patients [^src1]. 

The systemic nature of this coding error was highlighted during a 2024 data review at Odense University Hospital (OUH), which identified four infants "caught" in the DANIBD registry with an ulcerative colitis diagnosis who actually had FPIAC [^src1]. The revelation of these misclassified cases has underscored the need for improved coding practices among pediatric physicians [^src1]. Furthermore, it has sparked deep discussions regarding clinically relevant diagnostic workups in light of new international guidelines and prompted a political and clinical agreement to adjust Indicator 1b, demonstrating how registry audits can directly drive quality improvement and evidence-based practice changes in the Danish healthcare system [^src1].

## Mentions
- Page 18: "4 børn ”fanget” i DANIBD med en venstresidig ulcerøs colitis diagnose uden relevante undersøgelser, alle 4 patienter er spædbørn med FPIAC tilstand (food protein induced allergic proctocolitis)" [^src1]

## Relationships
- **Subject:** fpiac | **Predicate:** is-misclassified-as | **Object:** dk51-ulceroes-colitis
  - **Evidence:** "4 børn ”fanget” i DANIBD med en venstresidig ulcerøs colitis diagnose uden relevante undersøgelser, alle 4 patienter er spædbørn med FPIAC tilstand"
  - **Page:** 18
  - **Source:** [^src1]

## Claims
(none)

## Timeline
- **2024:** Data for OUH gennemgås i 2024, hvilket afslører fejlkodning af FPIAC som UC i DANIBD (ouh-odense-kirurgisk-afdeling-a, fpiac, dk51-ulceroes-colitis) [^src1]

## Sources

[^src1]: DANIBD_2025.pdf, pages 16-20
