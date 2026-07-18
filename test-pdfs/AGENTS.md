# test-pdfs/ — DOX contract

## Purpose

Controlled PDF fixtures for tests. The golden masters are the project's known-content control documents: every word on every page is deliberate and known.

## Ownership

* `golden-master.pdf` — 3-page control document (Phase 0). SHA-256: `1e4f2cbec74a83bf8ae56f3a45035827ec405bd02989d6b38f08929b80ac339d`

## Local Contracts

* Golden master PDFs **never change** once created (`Implementation Plan/AGENTS.md`). Do not regenerate, edit, move, or delete them; tests and phases depend on their exact bytes
* `golden-master-2.pdf` (Phase 8) and `golden-master-da.pdf` (Phase 7, Danish) get the same treatment when created
* New fixtures must have fully known content and their SHA-256 recorded in the phase status file

## Work Guidance

## Verification

* Hash check: `certutil -hashfile test-pdfs/golden-master.pdf SHA256` (or `sha256sum`) must match the recorded hash above; Phase 0 Gate 0.1/0.2 strings must extract exactly

## Child DOX Index

No child folders.
