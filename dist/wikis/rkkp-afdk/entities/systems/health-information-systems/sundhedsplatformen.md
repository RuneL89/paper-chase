---
title: Sundhedsplatformen
type: entity
wiki: rkkp-afdk
updated: '2026-08-14T21:09:38.328Z'
sources:
  - file: wikis/rkkp-afdk/raw/AFDK_2024.pdf
    pages: 16-20
  - file: wikis/rkkp-afdk/raw/AFDK_2025.pdf
    pages: '16-20, 56-60'
tags:
  - system
---
Sundhedsplatformen is a common health information system utilized by various hospital departments within the Danish healthcare infrastructure. It plays a dual role in the management and evaluation of cardiovascular care, acting as both a facilitator of clinical workflows and a source of systemic data limitations.

A major challenge associated with the system is its impact on national health data registries. Validation work conducted by steering committees has revealed a significant degree of missing service reporting for echocardiography procedures to the [[landspatientregisteret|Landspatientregisteret]], particularly from departments operating under Sundhedsplatformen [^src1], [^src2]. This underreporting creates a substantial limitation for quality assurance, as it directly compromises the validity of the results for [[indikator-2|Indikator 2]], which tracks whether newly diagnosed atrial fibrillation patients receive an echocardiogram [^src1]. 

Conversely, the system also enables the automation of quality improvement initiatives. For example, to support patient education and the metrics tracked by [[indikator-4a|Indikator 4a]], the offer for group-based patient education has been integrated directly into Sundhedsplatformen [^src3]. This integration allows the system to automatically generate referrals for group teaching, streamlining the educational pathway for newly diagnosed patients [^src3].

## Mentions
- Page 19: "især fra afdelinger, der arbejder under Sundhedsplatformen." (source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 16-20) [^src1]
- Page 19: "Valideringsarbejde udført af styregruppen har tidligere vist, at der forekommer en betydelig grad af manglende ydelses-rapportering af ekkokardiografi til Landspatientregisteret, især fra afdelinger, der arbejder under Sundhedsplatformen." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 16-20) [^src2]
- Page 57: "Tilbuddet er bygget ind i Sundhedsplatformen der dermed automatisk genererer en henvisning til holdundervisning." (source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 56-60) [^src3]

## Relationships
- Subject: sundhedsplatformen
  Predicate: associated-with-poor-reporting-to
  Object: landspatientregisteret
  Evidence: "især fra afdelinger, der arbejder under Sundhedsplatformen."
  Page: 19
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 16-20 [^src1]
- Subject: sundhedsplatformen
  Predicate: causes-reporting-deficiency-in
  Object: landspatientregisteret
  Evidence: "Valideringsarbejde udført af styregruppen har tidligere vist, at der forekommer en betydelig grad af manglende ydelses-rapportering af ekkokardiografi til Landspatientregisteret, især fra afdelinger, der arbejder under Sundhedsplatformen."
  Page: 19
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 16-20 [^src2]
- Subject: sundhedsplatformen
  Predicate: enables-automation-of
  Object: indikator-4a
  Evidence: "Tilbuddet er bygget ind i Sundhedsplatformen der dermed automatisk genererer en henvisning til holdundervisning."
  Page: 57
  Source: wikis/rkkp-afdk/raw/AFDK_2025.pdf, pages 56-60 [^src3]

## Claims
- Valideringsarbejde har vist en betydelig grad af manglende ydelses-rapportering af ekkokardiografi til Landspatientregisteret, især fra afdelinger under Sundhedsplatformen [^src1] (indikator-2, sundhedsplatformen, landspatientregisteret)
  Type: limitation
  Page: 19
  Source: wikis/rkkp-afdk/raw/AFDK_2024.pdf, pages 16-20

## Timeline
(none)

## Sources

[^src1]: AFDK_2024.pdf, pages 16-20
[^src2]: AFDK_2025.pdf, pages 16-20
[^src3]: AFDK_2025.pdf, pages 56-60
