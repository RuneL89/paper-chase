---
title: Landspatientregisteret
type: entity
aliases:
  - Landspatientregisteret (LPR)
wiki: rkkp-danibd
updated: '2026-08-05T06:32:26.081Z'
sources:
  - file: wikis/rkkp-danibd/raw/DANIBD_2023.pdf
    pages: '11-15, 16-20'
  - file: wikis/rkkp-danibd/raw/DANIBD_2024.pdf
    pages: '26-30, 36-40'
tags:
  - database
---
The **Landspatientregisteret** (LPR), or the Danish National Patient Register, is a comprehensive national database that serves as the foundational data source for the [[dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme|Dansk Kvalitetsdatabase for Inflammatoriske Tarmsygdomme]] (DANIBD) [^src1]. The LPR is primarily used to identify patients with [[ibd|IBD]] through specific action diagnoses, effectively defining the inclusion criteria for the national patient cohort [^src1]. To be included in DANIBD, patients must have at least two hospital contacts registered in the LPR with specific diagnostic codes, such as [[crohns-sygdom|Crohns sygdom]] (DK50*), [[colitis-ulcerosa|Colitis ulcerosa]] (DK51*), [[korttarmssyndrom|korttarmssyndrom]] (DK912B) with an IBD secondary diagnosis, or [[psc|Primær skleroserende kolangitis (PSC)]] (DK830F) [^src1]. These contacts can be either physical visits or virtual consultations (telephone/video) occurring on different dates [^src3].

The reliability of the LPR for identifying IBD patients has been rigorously validated. A 2022 study by [[jacobsen-ha-et-al|Jacobsen HA et al.]] demonstrated a high positive predictive value (PPV) of 0.95 (95% CI, 0.95–0.96) for IBD diagnoses in the LPR when validated against the regional [[gastrobio|GASTROBIO]] database [^src1] [^src3]. This high validity ensures that the epidemiological and quality monitoring data derived from the LPR is robust. Furthermore, the LPR is utilized to track surgical interventions; for instance, [[indikator-6|Indikator 6]] relies on specific LPR procedure codes (e.g., KJFA*, KJFB*) to define primary surgical procedures and re-operations within 30 days [^src4].

The LPR is continuously updated to reflect new medical treatments. In 2024, new treatment codes were established in the LPR for modern biologics and JAK inhibitors, including [[upadacitinib|upadacitinib]], [[filgotinib|filgotinib]], [[risankizumab|risankizumab]], [[mirikizumab|mirikizumab]], and [[ozanimod|ozanimod]] [^src2]. This update was crucial for tracking patients undergoing treatment with [[bmsl|Biologiske og målrettede syntetiske lægemidler]] (BMSL) [^src2]. Despite these advancements, operational challenges remain. DANIBD is still awaiting the ability to automatically extract medical treatment information from the [[sygehusmedicinregisteret|Sygehusmedicinregisteret]] (SMR) to prevent the double registration of treatments in the LPR by clinical staff [^src2].

## Mentions
- Page 19: "DANIBD omfatter patienter med IBD behandlet på et offentligt dansk hospital. [...] Det organisatoriske tilhørsforhold er som udgangspunkt bestemt ved den enhed, hvor patienten har haft en hospitalskontakt for IBD i LPR" (source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 16-20)
- Page 20: "DANIBD er baseret på aktionsdiagnoser for inflammatoriske tarmsygdomme registreret i Landspatientregisteret (LPR)" (source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 16-20)
- Page 26: "I 2024 blev der oprettet nye behandlingskoder for upadacitinib, filgotinib og risankizumab samt mirikizumab og ozanimod i landspatientregisteret (LPR)." (source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 26-30)
- Page 36: "Landspatientregisteret (LPR)" (source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 36-40)
- Page 11: "BMSL omfatter i denne årsrapport behandling med [...] registreret i landspatientregisteret (LPR)." (source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 11-15)
- Page 14: "Et primært kirurgisk indgreb omfatter procedurekoder: KJFA*, KJFB*, KJFC* KJFF*, KJFH*, KJFW* i LPR..." (source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 11-15)

## Relationships
Outgoing (this entity is the SUBJECT of these relationships):
- Subject: landspatientregisteret
  Predicate: is-validated-against
  Object: gastrobio
  Evidence: "I studiet af Jacobsen et al fra 2022 undersøges den positive prædiktive værdi (PPV) af IBD-diagnoser i LPR ift. den regionale IBD database GASTROBIO."
  Page: 36
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 36-40

Incoming (this entity is the OBJECT of these relationships):
- Subject: dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme
  Predicate: is-based-on
  Object: (this entity)
  Evidence: "DANIBD er baseret på aktionsdiagnoser for inflammatoriske tarmsygdomme registreret i Landspatientregisteret (LPR)"
  Page: 20
  Source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 16-20
- Subject: bmsl
  Predicate: has-new-treatment-code-in
  Object: (this entity)
  Evidence: "I 2024 blev der oprettet nye behandlingskoder for upadacitinib, filgotinib og risankizumab samt mirikizumab og ozanimod i landspatientregisteret (LPR)."
  Page: 26
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 26-30
- Subject: dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme
  Predicate: is-based-on
  Object: (this entity)
  Evidence: "DANIBD identificerer patienter med IBD ved mindst to hospitalskontakter for IBD i Landspatientregisteret (LPR)"
  Page: 36
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 36-40
- Subject: indikator-6
  Predicate: relies-on
  Object: (this entity)
  Evidence: "Indikator 6 anvender procedurekoder fra LPR til at definere primære indgreb og re-operationer"
  Page: 14
  Source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 11-15

## Claims
- Patienter med IBD skal have mindst to hospitalskontakter med følgende aktionsdiagnoser registreret i LPR: DK50* ‘Crohns sygdom’, DK51* ‘Ulcerøs colitis’, DK912B ‘Korttarmssyndrom’ med DK50*/DK51* som b-diagnose, eller DK830F ‘Primær skleroserende kolangitis’ [^src3] (ibd, psc, landspatientregisteret)
  Type: eligibility-criteria
  Page: 19
  Source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 16-20
- Den positive prædiktive værdi (PPV) af IBD-diagnoser i LPR er 0,95 (95% CI, 0,95–0,96) ift. GASTROBIO [^src4] (landspatientregisteret, gastrobio)
  Type: validation
  Page: 20
  Source: wikis/rkkp-danibd/raw/DANIBD_2023.pdf, pages 16-20
- I 2024 blev der oprettet nye behandlingskoder for upadacitinib, filgotinib og risankizumab samt mirikizumab og ozanimod i landspatientregisteret (LPR) [^src1] (upadacitinib, filgotinib, risankizumab, mirikizumab, ozanimod, landspatientregisteret)
  Type: administrative
  Page: 26
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 26-30
- DANIBD afventer stadig muligheden for automatisk at trække informationer om medicinsk behandling via Sygehusmedicinregisteret (SMR), så klinikken ikke behøver at dobbelt registrere behandlingen i LPR [^src1] (sygehusmedicinregisteret, landspatientregisteret)
  Type: operational
  Page: 26
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 26-30
- DANIBD omfatter alle patienter med IBD i Danmark, der har mindst to hospitalskontakter med aktionsdiagnoser DK50*, DK51*, DK830F eller DK912B i Landspatientregisteret [^src1] (dansk-kvalitetsdatabase-for-inflammatoriske-tarmsygdomme, landspatientregisteret, crohns-sygdom, colitis-ulcerosa, psc, korttarmssyndrom)
  Type: eligibility-criteria
  Page: 36
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 36-40
- Mindst to hospitalskontakter defineres som to fysiske fremmøder (ALCA00) eller virtuelle kontakter (ALCA03; telefon-/videokonsultation) i LPR [admin.konttype], der ligger på forskellige datoer [^src1] (landspatientregisteret)
  Type: operational
  Page: 36
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 36-40
- Forfatterne af Jacobsen et al. (2022) finder en høj PPV for to IBD-diagnoser svarende til en PPV på 0,95 (95% CI, 0,95–0,96) [^src2] (jacobsen-ha-et-al, landspatientregisteret, gastrobio)
  Type: validation
  Page: 36
  Source: wikis/rkkp-danibd/raw/DANIBD_2024.pdf, pages 36-40

## Timeline
- 2022: Jacobsen HA et al. publicerer valideringsstudiet om IBD-diagnoser i LPR (jacobsen-ha-et-al, landspatientregisteret)
- 2024: Der blev oprettet nye behandlingskoder for upadacitinib, filgotinib, risankizumab, mirikizumab og ozanimod i Landspatientregisteret (LPR) (upadacitinib, filgotinib, risankizumab, mirikizumab, ozanimod, landspatientregisteret)

## Sources

[^src1]: DANIBD_2023.pdf, pages 16-20
[^src2]: DANIBD_2024.pdf, pages 26-30
[^src3]: DANIBD_2024.pdf, pages 36-40
[^src4]: DANIBD_2023.pdf, pages 11-15
