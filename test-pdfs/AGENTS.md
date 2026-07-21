# test-pdfs/ — DOX contract

## Purpose

Controlled PDF fixtures for tests. The golden masters are the project's known-content control documents: every word on every page is deliberate and known.

## Ownership

* `golden-master.pdf` — 3-page control document (Phase 0). SHA-256: `1e4f2cbec74a83bf8ae56f3a45035827ec405bd02989d6b38f08929b80ac339d`
* `golden-master-da.pdf` — 2-page Danish control document (Phase 7). SHA-256: `55d040c7dea6e7b797614e602b25f9c77c8c4e8d48aeb593b56ae3b279b3dd29`. Known content: Søren Møller / Åse Lindberg (persons), København / Aarhus (places), Møbler A/S (company), Danish-formatted figures 12,5 millioner kr. (page 1) and 3,2 millioner kr. (page 2) — full text in `.state/phase-7-status.json`
* `golden-master-2.pdf` — 2-page compounding control document (Phase 8). SHA-256: `fd6de6f2ecfb457b2a4cb07c2f0374df98d6a6a1387c3ce1ad52e25b9857fbd2`. Known content: page 1 "Legal Proceedings Update" — John Smith testifies before the Delaware Court of Chancery (2024-06-02, new context for an existing entity), Jane Doe introduced as General Counsel of Acme Corp, legal claim type (lawsuit alleging misstated FY2023 revenue); page 2 "Settlement Negotiations" — Jane Doe confirms negotiations (2024-07-10), $3.1 million proposed settlement, John Smith states operations unaffected. Full verbatim text in the header comment of `scripts/create-golden-master-2.ts`
* `ab-corpus/` — Phase 10 A/B evaluation corpus (six fixtures: `multi-column.pdf`, `tables.pdf`, `headers-footers.pdf`, `danish-diacritics.pdf`, `financial-dense.pdf`, `scanned-page.pdf`) plus `manifest.json` (per-fixture sha256, pageCount, expectedStrings/expectedTables/diacritics, notes) and a human `README.md`. SHA-256s are recorded in the manifest and `.state/phase-10-status.json`

## Local Contracts

* Golden master PDFs **never change** once created (`Implementation Plan/AGENTS.md`). Do not regenerate, edit, move, or delete them; tests and phases depend on their exact bytes
* The `ab-corpus/` fixtures get the same treatment: immutable once committed (Phase 10); `scripts/create-ab-corpus.ts` documents how they were made and must never be re-run against the committed files
* `golden-master-da.pdf` (Phase 7, Danish) and `golden-master-2.pdf` (Phase 8, compounding) are immutable — do not regenerate, edit, move, or delete them
* New fixtures must have fully known content and their SHA-256 recorded in the phase status file

## Work Guidance

## Verification

* Hash check: `certutil -hashfile test-pdfs/golden-master.pdf SHA256` (or `sha256sum`) must match the recorded hash above; Phase 0 Gate 0.1/0.2 strings must extract exactly. The Danish fixture must extract its known Danish text (æ/ø/å intact) via `extractText`

## Child DOX Index

No child folders.
