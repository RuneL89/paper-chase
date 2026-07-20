# test-pdfs/ — DOX contract

## Purpose

Controlled PDF fixtures for tests. The golden masters are the project's known-content control documents: every word on every page is deliberate and known.

## Ownership

* `golden-master.pdf` — 3-page control document (Phase 0). SHA-256: `1e4f2cbec74a83bf8ae56f3a45035827ec405bd02989d6b38f08929b80ac339d`
* `golden-master-da.pdf` — 2-page Danish control document (Phase 7). SHA-256: `55d040c7dea6e7b797614e602b25f9c77c8c4e8d48aeb593b56ae3b279b3dd29`. Known content: Søren Møller / Åse Lindberg (persons), København / Aarhus (places), Møbler A/S (company), Danish-formatted figures 12,5 millioner kr. (page 1) and 3,2 millioner kr. (page 2) — full text in `.state/phase-7-status.json`

## Local Contracts

* Golden master PDFs **never change** once created (`Implementation Plan/AGENTS.md`). Do not regenerate, edit, move, or delete them; tests and phases depend on their exact bytes
* `golden-master-da.pdf` (Phase 7, Danish) and `golden-master-2.pdf` (Phase 8) get the same treatment when created
* New fixtures must have fully known content and their SHA-256 recorded in the phase status file

## Work Guidance

## Verification

* Hash check: `certutil -hashfile test-pdfs/golden-master.pdf SHA256` (or `sha256sum`) must match the recorded hash above; Phase 0 Gate 0.1/0.2 strings must extract exactly. The Danish fixture must extract its known Danish text (æ/ø/å intact) via `extractText`

## Child DOX Index

No child folders.
