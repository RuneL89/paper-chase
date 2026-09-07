# Paper Chase — Backlog

**Document ID:** `LLM-WIKI-CLI-IMPL-BACKLOG`
**Version:** 1.0.6
**Status:** Living
**Date:** 2026-09-07

The up-next queue, open issues, and accepted residuals. Entries are **not** scheduled phases: each records the mechanism, the evidence, and the fix direction. When an item is scheduled or fixed, it moves into a `PHASE_XX_<slug>.md` doc (or is resolved directly) and is removed from this list — the phase doc and `.state/compliance-log.md` are the record.

*Last refreshed: 2026-09-07 (B25 refined via the AskUserQuestion gate — six outcomes: `_provenance` envelope store, chunks + stage markers, coverage through synthesis/amendment, explicit in-flight synthesis journal, full crash-telemetry fix, one dim resume line — and scheduled as its own phase, `PHASE_28_fine_grained_crash_resume.md`; removed from the queue).*

---

## Up next

Queued for scheduling. **Every item in this queue carries a mandatory refinement gate (user directive, 2026-09-05):** before any phase doc is written or any implementation begins, the user is interviewed in-conversation using the AskUserQuestion tool — iterating until every aspect, constraint, scope boundary, and the preferred solution is fully understood. The refinement outcomes are recorded in the item, and only then is it scheduled into a `PHASE_XX_<slug>.md` doc.

### B8. Multi-format ingestion (user-directed, 2026-07-25)

Today Layer 1 is PDF-text-only (`pdfjs-dist`). The user wants ingestion to grow to:

- **DOCX** — Word documents (parse to markdown; same chunk → Extract → Materialize pipeline downstream).
- **Non-text / scanned PDFs** — pages where `pdfjs-dist` extracts nothing (today they become `raw` placeholder pages); needs an OCR or vision-LLM extraction path so scanned pages yield real content.
- **Images** — standalone image files (photos of documents, screenshots) via the same vision path.

Design notes for when this is scheduled: it is a Layer-1 concern with downstream ripple (chunk identity, source-page provenance per format, and the vision-language rule — scanned text becomes "extracted text" that must stay verbatim in Layer 2); a vision-LLM extraction path is a new call type with its own routing-slot question; the frozen Phase 0 extraction surface (`extractText` signature) must stay additive. Start from `Project Vision/06_citation_and_provenance.md` (provenance per format) and `01` §4.4 (chunking) before writing a phase doc.

---

## Near-term fixes

### B26. Conductor death is unobservable and unrecoverable — the TUI process is a single point of failure (user-directed, 2026-09-06)

- **Mechanism:** Phase 27's crash recovery is conductor-watches-worker — the conductor captures worker stderr, appends `.state/crash-log.jsonl`, and auto-retries. **Nothing watches the conductor.** The crash-log writer IS the conductor, so a conductor death writes no app record by construction. Worker children are spawned with plain piped stdio, no job object and no `detached` (`src/tui/ingest-conductor.ts:81-99`), so when the conductor dies the worker survives only until its next stdout write to the dead parent's pipe — an EPIPE-class cascade that kills the whole tree without a trace. The 2026-09-02 post-mortem fixed the "one do-everything process dies silently" class for *workers* only; conductor death remains in exactly that class, and it also ends the run (no retry, no defer, no panel).
- **Evidence (2026-09-06 zero-trace run death, full post-mortem):** the production rkkp run (conductor PID 18992, up ~36h, DAH_2025 worker mid-synthesis) went silent between 20:00:15 and 21:00 Helsinki with the user confirming no manual closure. Forensics ruled out every OS-level cause: no reboot (machine up since 08/28), no sleep (zero Power-Troubleshooter events in 3 days), no shutdown/initiated-restart events, no resource-exhaustion (2004), no Application Error (1000) or WER app-crash for node.exe or ANY app, and no app crash-log entry; the event log was provably recording at 20:06:39 (NTP clock-sync events). The initially suspicious 15:14/19:53 LiveKernelEvent "storms" proved to be WER re-reporting an old dump (`WATCHDOG-20260824-1054.dmp` — captured Aug 24), not a live driver event. Process-termination auditing (Security 4689) is disabled on the machine, so an external kill would be equally invisible. Remaining candidates — a conductor-internal silent exit (V8 heap OOM in a 36h-old ink TUI famously leaves no Windows event; its stderr died with the console) or an unlogged external kill — are indistinguishable post-hoc, which is itself the finding. Contrast: the worker crash on 2026-09-05 09:28 was correctly auto-retried, proving the worker-side machinery works.
- **Fix direction:** (1) **Out-of-process death audit** — something must outlive the conductor and record its exit: a small detached watchdog (spawned by the conductor at run start, polls the conductor PID, writes a crash-log-style record on disappearance) or a Windows scheduled-task equivalent. (2) **Run survival** — since resume is checkpoint-safe by design, the watchdog (or a relaunch policy) can auto-restart `chase ingest` after a conductor death, converting silent run-death into a recoverable blip; alternatively decouple the run from the console session (detached/job-object configuration so a console close cannot take the tree). (3) **Minimum viable UX** — on TUI launch, detect an un-finalized run (pending PDFs + recent worker state, no completion record) and offer one-click resume. (4) **User-side forensic enablement (recommendation):** turn on Windows process auditing (`auditpol /set /subcategory:"Process Termination" /success:enable`) so future external kills are traceable. (5) **Conductor longevity (investigate):** RSS was ~900 MB after ~12h in the prior conductor — profile for a slow leak that could reach the V8 heap limit over multi-day runs.
- **Law compatibility:** no change to the 2026-09-02 Phase 27 canon (workers one-at-a-time, checkpoints, auto-retry cap) — this adds a supervisor one level UP from the conductor, the same pattern Phase 27 applied to workers. Interacts with Phase 28 (former B25 — a watchdog-restarted run benefits directly from per-chunk checkpoints).

### B11. Bare-slug wikilinks are ambiguous in the single-vault workspace

- **Mechanism:** entity/topic pages link by bare slug (`[[region-hovedstaden|…]]`), and `wikis/` is designed to open as one Obsidian vault (vision `03` §6: "every link resolves"). Obsidian resolves duplicate basenames by shortest path — with `.obsidian/app.json` empty (default resolution), a link written in one wiki can silently resolve to another wiki's page.
- **Evidence:** 2026-07-28 audit of `dist/wikis`: ~60 page basenames exist in 2–4 wikis (all five regions in all four wikis, ~25 hospitals, ~15 topics incl. `indikator-5`); `.obsidian/app.json` is `{}`.
- **Fix direction (needs a design decision):** wiki-qualify link targets that exist in more than one wiki (path-form links or shortest-unique-path), or pin Obsidian link resolution in the generated `.obsidian` config; the wikilink validator/repair must then check uniqueness vault-wide, not per-wiki.

### B13. Name variants merged at slug level never reach `aliases`

- **Mechanism:** `aliases` accumulate only from curation merges; name variants that slugify identically merge in the Materializer before curation runs (first name wins, `src/materializer.ts:638-645`), so the losing variant is recorded nowhere — Obsidian alias search cannot find the page by that name.
- **Evidence:** 2026-07-28: "ADHD-foreningen" (2024 report, hyphenated) is not an alias of `adhd-foreningen.md`; the variant survives only inside a Layer-2 mention quote.
- **Fix direction (small):** when a merged entity record's name differs from the canonical first-wins name, append the variant to the page's `aliases` during materialization (the same field curation already maintains).

### B15. First-wins on name/significance/disambiguation silently discards later extractor data

- **Mechanism:** vision `03` §3.2 specifies only first-*folder*-wins; the Materializer additionally applies first-wins to the entity's display name, `significance`, and `disambiguation` (`src/materializer.ts:638-645`). Later chunks' variants of these fields are dropped with no record anywhere — significance and disambiguation are extractor prose, not Layer-2 items, so the preservation check never sees them. In tension with `01` Principle 3 ("no detail is lost").
- **Evidence:** 2026-07-28 (`dist/wikis/rkkp-adhd`): the 2024 chunk's significance for `adhd-foreningen` ("Patientorganisation repræsenteret i styregruppens arbejde gennem formand Trish Nymark.") was discarded in favor of the 2023 record — the only extracted sentence naming the entity's chair. The same rule picks the canonical display name (feeding B13's alias gap) and, applied independently per wiki, produces opposite canonical choices across wikis ("LPR" in rkkp-adhd vs "Landspatientregisteret" in rkkp-akdb — the cross-wiki canonical-name fork the Phase 24 registry surfaces).
- **Fix direction:** replace first-wins with update-aware rules — prefer the record with richer evidence (or concatenate differing significances), let later disambiguation fill an empty slot, and record losing name variants in `aliases` (B13's fix covers the alias side). The discarded significance text may also name related parties the Phase 17 relationship slots never see. Note: a significance/disambiguation change alters the page's aggregate fingerprint, so affected pages re-synthesize once under the existing synthesis-resume rule.

---

## Accepted residuals (watch items)

### B4. Pathological-dense pages degrade to the structured template

- **Mechanism:** the very densest pages (`adhd-databasen`, `indikator-3`, `topic performance`) carry a Layer-2 payload that structurally exceeds the 32768 output ceiling, so strict and permissive synthesis cannot fit and the page keeps the deterministic template (bounded ~$0.65/page).
- **Options:** (A) accept — data is complete, ~2% of pages (current); (B) sub-page splitting, vision `02` §4.7's own remedy — split by source/period with an index (Phase-18-sized); (C) evidence excerpting (L6 in `Project Vision/optimizations/optimizations.md`) — biggest canon surgery.
- **Decision trigger:** revisit after the full-corpus run shows how many pages land in this bucket.

---

## Housekeeping

### B7. With-key suite profile before release

- All phase budgets were $0; the live-gated tests (Phase 2 live gates, gate 0.4, e2e) have not been re-run since Phase 11 v1.6.0. Run once with `ANTHROPIC_API_KEY` loaded (and `RUN_E2E=1` for the full e2e) before any release.

### B9. Wiki display title is slug-derived, not the init title

- **Mechanism:** the DOX Writer derives the wiki root `index.md` title (and the workspace catalog display name + workspace prose) as `titleCase(slug)` (`src/dox-writer.ts:344,798`) — the `--title` given at `init` lives only in the constitution's H1 and is never read back. `rkkp-adhd` renders as "Rkkp Adhd" where the user named it "RKKP ADHD" (same behavior as "Adhd Wiki").
- **Fix direction (small, needs a design decision):** read the display title from the constitution H1 when present, falling back to `titleCase(slug)` — noting that `init` defaults the title to the raw slug, so the fallback rule needs care (slug-looking H1 → titleCase it?). Update the DOX root-index gates accordingly.
