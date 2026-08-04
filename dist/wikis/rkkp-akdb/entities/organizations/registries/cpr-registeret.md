---
title: CPR-registeret
type: entity
wiki: rkkp-akdb
updated: '2026-08-03T16:38:33.318Z'
sources:
  - file: wikis/rkkp-akdb/raw/AKDB_2023.pdf
    pages: 81-85
  - file: wikis/rkkp-akdb/raw/AKDB_2024.pdf
    pages: '51-55, 66-70, 86-90'
tags:
  - organization
---

## Mentions

- Page 81: "Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL)." [^src1]
- Page 51: "Patienter uden gyldigt CPR-nummer, patienter under 18 år på operationstidspunktet, patienter med inaktivt (patienter uden bopæl, annullerede eller slettede personnumre, ændrede personnumre) CPR-nummer" [^src2]
- Page 66: "Patienten er registreret i CPR-registeret som 'Inaktiv, uden bopæl i dansk/grønlandsk folkeregister men tildelt personnummer af skattehensyn (kommunekoderne 0010, 0011, 0012 og 0019)'" [^src3]
- Page 86: "Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL)" [^src4]

## Relationships

- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Uses Data From (incoming) — "Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL)." [^src1]
- [[akut-kirurgi-databasen|Akut Kirurgi Databasen]] — Uses Data From (incoming) — "Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret" [^src4]

## Claims

- Patienter uden gyldigt CPR-nummer, patienter under 18 år på operationstidspunktet, patienter med inaktivt CPR-nummer er ekskluderede [^src2] ([[indikator-9|Indikator 9]], [[cpr-registeret|CPR-registeret]])
- 6 patienter ekskluderet fordi patienten er registreret i CPR-registeret som 'Inaktiv, uden bopæl i dansk/grønlandsk folkeregister men tildelt personnummer af skattehensyn' [^src2] ([[indikator-9|Indikator 9]], [[cpr-registeret|CPR-registeret]])
- 75 patienter blev ekskluderet på grund af ugyldigt CPR-nummer [^src3] ([[cpr-registeret|CPR-registeret]])
- 6 patienter blev ekskluderet fordi de var registreret i CPR-registeret som 'Inaktiv, uden bopæl i dansk/grønlandsk folkeregister men tildelt personnummer af skattehensyn' [^src3] ([[cpr-registeret|CPR-registeret]])
- Data til konstruktion af populationen og indikatorerne indhentes fra CPR-registeret, Landspatientregisteret (LPR) og Den Nationale Labdatabank (DNL) [^src4] ([[akut-kirurgi-databasen|Akut Kirurgi Databasen]], [[cpr-registeret|CPR-registeret]], [[landspatientregisteret|Landspatientregisteret]], [[den-nationale-labdatabank|Den Nationale Labdatabank]])

## Sources

[^src1]: AKDB_2023.pdf, pages 81-85
[^src2]: AKDB_2024.pdf, pages 51-55
[^src3]: AKDB_2024.pdf, pages 66-70
[^src4]: AKDB_2024.pdf, pages 86-90

