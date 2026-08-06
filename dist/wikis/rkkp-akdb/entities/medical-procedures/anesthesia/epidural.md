---
title: epidural
type: entity
wiki: rkkp-akdb
updated: '2026-08-05T19:04:50.203Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: 46-50
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '46-50, 96-100'
tags:
  - medical-procedure
---
Epidural anesthesia and analgesia is a specific pain management and anesthesia method used in acute abdominal surgery, such as acute laparotomy, peritonitis, and ileus [^src2]. In the context of the Danish Acute Surgery Database (AKDB), the use of epidurals is a major focus for clinical quality development and is tracked through specific national indicators, notably [[indikator-8|Indikator 8]] and [[indikator-9|Indikator 9]] [^src1] [^src2]. 

The application of epidural pain management is strongly supported by evidence, including the [[aha-studiet|AHA study]], which demonstrated that standard use of epidurals for high-risk abdominal patients contributed to an overall reduction in mortality [^src2]. Clinically, epidural analgesia is recommended because it provides superior pain relief, accelerates the return of bowel function, and improves survival rates for patients undergoing surgery [^src3]. 

Despite its proven benefits, the implementation of epidural pain management varies significantly across Danish hospitals [^src2]. For instance, there is a stark contrast in whether patients are offered epidural pain treatment for acute abdomen between institutions like [[amager-og-hvidovre-hospital|Amager og Hvidovre Hospital]] and [[naestved-slagese-og-ringsted-sygehuse|Næstved, Slagelse og Ringsted sygehuse]] [^src2]. This inter-hospital variation highlights a geographical disparity in patient care within Denmark [^src2].

Furthermore, the national standards for epidural use have undergone adjustments to reflect clinical realities. In 2022, the target for [[indikator-8|Indikator 8]] (the proportion of patients operated on with an epidural) was lowered from 90% to 60% [^src2]. This policy change was made because many patients are highly comorbid and receive anticoagulant (AK) treatment, which can contraindicate the placement of an epidural catheter on the day of surgery [^src2].

## Mentions
- Page 46: "epidural" (source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 46-50)
- Page 46: "Som patient i Danmark er der altså stor forskel på, om man får tilbudt epidural smertebehandeling i forbindelse med operation for akut abdomen." (source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 46-50)

## Relationships
Incoming (this entity is the OBJECT of these relationships):
- Subject: indikator-9
  Predicate: measures
  Object: (this entity)
  Evidence: "Indikator 9 beskriver andelen af patienter, der får anlagt epidural i forbindelse med operationen"
  Page: 46
  Source: wikis/rkkp-akdb/raw/AKDB_2023.pdf, pages 46-50
- Subject: indikator-8
  Predicate: measures
  Object: (this entity)
  Evidence: "Indikator 8: Andel opererede med epidural"
  Page: 46
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 46-50
- Subject: aha-studiet
  Predicate: supports-use-of
  Object: (this entity)
  Evidence: "Standard brug af epidural til abdominal høj risikopatienter var en del af AHA studiet som overordnet set nedbragte mortaliteten."
  Page: 46
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 46-50
- Subject: indikator-8
  Predicate: relates-to-procedure
  Object: (this entity)
  Evidence: "Epidural som smertedækning anbefales, da man er bedre smertedækket, får hurtigere gang i maven, og flere overlever operationen, hvis de er bedøvede med epidural."
  Page: 96
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 96-100

## Claims
- Indikator 8 blev i 2022 ændret fra 90 % til 60 % idet mange patienter er komorbide og får AK behandling, hvilket kan kontraindicere epidural anlæggelse i operationsdøgnet [^src1] (indikator-8, epidural)
  Type: policy-change
  Page: 46
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 46-50
- Der er stor forskel mellem sygehusene i forhold til at tilbyde smertebehandling med epiduralkateter [^src1] (epidural, amager-og-hvidovre-hospital, naestved-slagese-og-ringsted-sygehuse)
  Type: inter-hospital-variation
  Page: 46
  Source: wikis/rkkp-akdb/raw/AKDB_2024.pdf, pages 46-50

## Timeline
(none)

## Sources

[^src1]: AKDB_2023.pdf, pages 46-50
[^src2]: AKDB_2024.pdf, pages 46-50
[^src3]: AKDB_2024.pdf, pages 96-100
