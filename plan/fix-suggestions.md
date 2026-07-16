# Fix Suggestions — Independent E2E Verification Run

**Date:** 2026-07-15

Each issue from `plan/e2e-bug-report.md` lists the fix that was applied (verified against the Project Vision before implementation) and, where more than one vision-aligned path existed, the strongest alternative considered. Confidence scores reflect likelihood of resolving the issue; suggestions below 80% confidence or violating the vision were rejected and are not listed.

---

## Bug 1 — Test suite overwrote committed fixture PDFs

### Suggestion 1A (APPLIED): generate PDFs into a per-run temp directory — confidence 95%
- **What:** `fixturePath()` resolves into `mkdtempSync(os.tmpdir()/…)`; all generator helpers return the temp path; committed PDFs stay untouched for tests that read them by literal path.
- **Pros:** Working tree stays clean through any test/E2E run; zero changes to consumer tests (they all use the returned path); matches the suite's existing `mkdtempSync` idiom.
- **Cons:** Fixtures regenerate per run (negligible time); committed PDFs and generators can theoretically drift apart.
- **Verified:** focused + full suite green; `git status` clean of fixture changes.

### Suggestion 1B: untrack the PDFs (`git rm --cached`) + `.gitignore` + global setup generation — confidence 90%
- **Pros:** Single source of truth (generators); no committed binaries.
- **Cons:** `tests/sample.test.ts`/`tests/ingest.test.ts` read fixtures by literal path and would need a setup hook ordering guarantee; new contributors must generate fixtures; larger repo change than needed. Not chosen for scope reasons.

## Bug 2 — `refreshPageState` re-baselined manual edits

### Suggestion 2A (APPLIED): re-baseline only pages written this run — confidence 95%
- **What:** `refreshPageState(state, wikiDir, writtenPaths)`; unmatched divergent pages keep their old baseline.
- **Pros:** Manual-edit conflicts stay detectable forever (07 §3.1); deleted files pruned; write-time `updatePageState` in the materializer remains the precise path.
- **Cons:** The engine must maintain the written-paths set as new writers are added (documented in `src/ingestion/AGENTS.md`).

### Suggestion 2B: every writer records state at write time; delete `refreshPageState` — confidence 85%
- **Pros:** No inference at all; each write is its own baseline.
- **Cons:** Touches every writer call site (document/source/raw/contract writers) and risks missing one, which would permanently mark a system page as manually edited; larger blast radius mid-E2E. 2A achieves the same invariant with one function.

## Bug 3 — Root-level files tracked as content pages (AGENTS.md deletion hazard)

### Suggestion 3A (APPLIED): exclude root-level files and `.state/`/`lint/` from page-state tracking — confidence 95%
- **Pros:** Removes the delete/move hazard at its source; root files are contracts/guides, not typed content pages, so nothing legitimate is lost.
- **Cons:** If a future design places typed content pages at the wiki root, they would be untracked (contract documented).

### Suggestion 3B: keep tracking, but exempt known root files inside `buildReingestPlan` — confidence 82%
- **Pros:** Page-state stays a complete inventory.
- **Cons:** Two lists to keep in sync (tracking + exemption); any new root file re-opens the hazard; fails "delete stale rules at the source". Not chosen.

## Bug 4 — Legacy entity migration bypassed manual-edit detection

### Suggestion 4A (APPLIED): manual-edit check against the legacy path BEFORE rename + `movePageState` re-keying — confidence 92%
- **Pros:** Exactly implements 07 §3.1 ordering (detect before any mutation); detection continues on the new path; consistent with how reingest re-keys moves.
- **Cons:** Slightly more code in the materializer's hot loop (one extra existence check per entity).

### Suggestion 4B: move the state re-keying inside `migrateLegacyEntityPage` — confidence 80%
- **Pros:** Single call site owns the whole migration.
- **Cons:** The entities module would need access to `IngestionState`, inverting the current dependency direction (writers stay state-free); the manual-edit skip still has to live in the materializer anyway. Not chosen.

## Bug 5 — Partial batch writer output silently skipped

### Suggestion 5A (APPLIED): completeness validation + one repair naming missing pages + abort — confidence 90%
- **Pros:** Literal 07 §8 semantics; merged first/second outputs waste nothing; case-insensitive matching avoids spurious aborts.
- **Cons:** A model that persistently omits one page aborts the run (by design — visible failure beats silent evidence loss).

### Suggestion 5B: per-page single-item retry for only the missing pages — confidence 85%
- **Pros:** Cheaper repair calls; isolates the problem page.
- **Cons:** Loses batch context (cross-page wikilink guidance); more call-shape variants to maintain; the batch repair already converges in practice. Not chosen.

## Bugs 6/16 — Overwrite escape hatch; approval-era leftovers; log accuracy

### Applied (single suggestion; only one vision-aligned path) — confidence 95%
- Removing `skipManualEdits:false`, dead approval-era code, and false "applied" claims for removals has no alternative that keeps the vision's invariants. Folder removals are recorded as "absent from the latest plan (NOT removed)" because removal-by-omission would risk data loss the vision never authorizes; a future explicit-removal plan field (LLM-emitted) is the path if removal is ever wanted (documented below under "Future suggestions").

## Bug 7 — Chunks committed despite failed validation

### Suggestion 7A (APPLIED): abort after the retry loop when blocking/validation issues remain — confidence 90%
- **Pros:** Literal 07 §8/06 §6; no unvalidated content can enter the wiki; surfaced the four false-positive validator bugs (21–23, 28) that silent commits had been masking.
- **Cons:** The pipeline is only as good as its validators — false positives become aborts (which is why Bugs 21–23/28 had to be fixed in the same run).

### Suggestion 7B: abort only on citation/completeness failures; downgrade Critic blocking issues to warnings — confidence 55% — REJECTED (below threshold; contradicts 07 §2.1's blocking semantics).

## Bugs 8/9 — Deterministic fabrication of LLM-owned frontmatter; schema violations

### Suggestion 8A (APPLIED): extend the writer contract (LLM returns `tags`/`related`); writers refuse deterministic substitutes; schema opened/corrected — confidence 90%
- **Pros:** Principle 1 end-to-end: every synthesized frontmatter field is LLM-authored with repair-then-abort; open taxonomy finally makes LLM-created page types (05 §9) reachable; `mentions` matches both the vision and the writer.
- **Cons:** Bigger LLM output contract (slightly higher token cost per batch).

### Suggestion 8B: source `tags` from the PagePlanner's page plans instead of the page writer — confidence 80%
- **Pros:** No writer-contract change; tags planned once.
- **Cons:** The materializer updates pages across chunks/sources where no plan entry exists (rolling-memory entities), so plan-sourced tags would be unavailable exactly where updates happen most; would need a fallback — which is the forbidden pattern. Not chosen.

## Bug 10 — PagePlanner blind to chunks; deterministic default page plan

### Applied (single vision-aligned path) — confidence 92%
- The vision is unambiguous (LLM plans all pages; no deterministic substitution): give the planner the chunk list, validate coverage, repair once, abort. The deterministic default plan had no compliant variant. Verified live: plans now cover every chunk (wikis #1–#2).

## Bug 11 — Deterministic n-gram topic discovery

### Suggestion 11A (APPLIED): topics exclusively from LLM plans + rolling memory; last-chunk catch-all — confidence 88%
- **Pros:** 02 §4 authority restored; topic pages are intentional; the catch-all guarantees every planned topic materializes at least once per source.
- **Cons:** Topic recall now depends on the PagePlanner's diligence (mitigated by its prompt minimums: 2–3 topics).

### Suggestion 11B: keep `extractTopics` output but only as a hint section in the PagePlanner prompt — confidence 82%
- **Pros:** Preserves the n-gram signal for recall without deciding existence.
- **Cons:** Prompt bloat for marginal benefit; the planner already sees the full text. Worth revisiting if topic recall proves weak in production corpora.

## Bugs 12/13/14/15 — EntityCritic mismatch; ChunkingPlanner k2.6; ChunkWriter contract; critic.md stale note

### Applied (largely single-path) — confidence 90%
- Parser tolerance for prompt-declared-optional `issues` + `callAgentWithRepair` routing is the only reading consistent with 07 §8. Provider-gating the Kimi-only model override is strictly correct. The explicit required-fields list plus `sources[].id` validation directly hardens the exact surface of the 2026-07-14 failure. Deleting the false "appended by deterministic code" note is mandatory (it described a Principle 1 violation as fact). Critic temperature 0.2 matches every other agent; alternative (documented, intentional 1.0 for diverse critique) was rejected because JSON reliability dominates.

## Bug 17 — ChunkWriter output truncation (the historical blocker)

### Suggestion 17A (APPLIED): 32k output budget + smaller default chunks + parse-failure diagnostics — confidence 90% (validated live)
- **Pros:** Attacks both sides (budget and demand); Principle 5 explicitly prefers smaller chunks; permanent diagnostics mean any recurrence is self-explaining.
- **Cons:** More chunks → more LLM calls per document (cost/time), accepted by the vision's own principle.

### Suggestion 17B: stream-and-continue (multi-turn continuation when `stop_reason == max_tokens`) — confidence 60% — REJECTED (below threshold: JSON continuation across turns is brittle, and the provider's continuation behavior is undocumented).

## Bugs 18/19/20 — AGENTS.md writer budget; PagePlanner empty placements; Kimi thinking starvation

### Applied (single-path each, all validated live) — confidence 92%
- Explicit budgets + repair-then-abort are the vision's own protocol; `structuredOutputOptions` inside `callAgentWithRepair` covers every JSON agent uniformly (probe-verified that `k2.7-code` accepts `thinking: {type:"disabled"}` and returns complete long outputs with it — 28.9k chars vs 9.4k truncated with thinking on).

## Bugs 21/22/23 — Critic preview blindness; completeness normalization; known-titles divergence

### Applied (single-path each) — confidence 93% (validated live: wikis #1–#2 chunks pass the Critic with real reviews)
- 07 §4 literally lists what the Critic must receive; normalized-vs-normalized comparison is the only correct form of the table check; writer/critic known-title symmetry is a consistency requirement with no alternative.

## Bug 24 — Lowercased topic titles in writer prompts

### Applied (single-path) — confidence 90%
- Presenting exact page titles in the Known-topics list is the only fix that keeps lint strict (case-sensitive titles) while making links resolvable. Alternative (case-insensitive lint matching) was rejected: it would mask real title drift and weaken the contract check.

## Bug 25 — Generated AGENTS.md invented citation/link/naming schemes

### Suggestion 25A (APPLIED): system-wide invariants embedded in the guide-writer prompt — confidence 88% (validated live on regeneration)
- **Pros:** The guide stays corpus-tailored where the vision wants (structure, page types, special instructions) and canonical where the vision fixes syntax (06 §2); one prompt governs all future wikis.
- **Cons:** Prompt-level enforcement; a sufficiently wayward model could still deviate (the Critic/lint layers then catch it).

### Suggestion 25B: deterministic post-check that rejects generated guides contradicting the invariants (regex scan → repair → abort) — confidence 85%
- **Pros:** Hard enforcement, same repair-then-abort shape as other agents.
- **Cons:** Reliable "contradiction detection" by regex is fuzzy (risk of false rejects); worth adding later as a belt-and-suspenders check. Recommended as follow-up, not blocking.

## Bug 26 — Verbatim preservation unreliable on large chunks

### Applied: `max_chunk_size` 30k → 15k — confidence 85% (validated live on wiki #2)
- **Pros:** Vision Principle 5 verbatim ("errs on the side of more, smaller chunks"); halves the verbatim-reproduction burden per call.
- **Cons:** ~2× LLM calls per document. Alternative (chunk-content hashing with partial-body stitching) rejected: deterministic body assembly would violate Principle 1.

## Bug 27 — Piped-wikilink prohibition

### Applied (single-path) — confidence 95% (validated live)
- The vision requires valid targets, not a pipe ban; both validators already parsed pipes. Dropping the prompt-level dogma removed an unwinnable fight with standard wiki syntax.

## Bug 28 — Critic table check stricter than the vision

### Applied: judge data completeness, not formatting; explicit describe-option for unreconstructable tables — confidence 87% (validated live: all 4 chunks of wiki #2 pass)
- The deterministic completeness check remains the hard backstop for data presence, so this cannot mask genuinely dropped tables.

## Bug 29 — Hallucinated `sources.file` paths

### Suggestion 29A (APPLIED): deterministic provenance enforcement (`enforceSourceProvenance`) — confidence 93% (validated live)
- **Pros:** The authority matrix owns extraction/file paths; the LLM keeps citation authorship (`id`, `pages`, `[^srcN]` placement); citation integrity (Principle 2) becomes structurally guaranteed for the file dimension.
- **Cons:** If multi-PDF chunks ever exist, the single-source assumption needs revisiting (documented).

### Suggestion 29B: validation-only (reject wrong paths → repair → abort) — confidence 70% — REJECTED (below threshold: the live run showed the model persistently re-slugging the path across attempts; aborting runs over a value the LLM cannot know is worse vision service than deterministic provenance, which the vision assigns to deterministic code anyway).

---

## Future suggestions (non-blocking, for review)

1. **Duplicate source entries on repeatedly-updated entity/topic pages** — `buildMergedSources` appends a new entry per chunk update even when file+pages match an existing entry (e.g., src4–src6 duplicating src1–src3 on `the-coca-cola-company.md` after re-ingestion). Suggest deduplicating by (file, pages) while preserving ids referenced by existing body citations. Confidence 90%; pure deterministic metadata hygiene; no authorship impact.
2. **Explicit LLM-driven folder removal** — extend the PagePlanner output with an explicit `removeFolders` field (with per-folder page relocation plans) so removals become intentional LLM decisions rather than inferred-from-omission (currently retained + logged). Confidence 85%.
3. **Generated-guide contradiction check** — Suggestion 25B above.
4. **StructureAnalyst page excerpts** — it sees only the first 200 chars per page; raising this would improve heading/section quality at token cost. Confidence 80%.
5. **Test-provider relocation** — move `generateMockResponse` out of the production client into an injected test fixture so no deterministic content generator ships in `src/llm/client.ts`. Confidence 85%; note the current error message no longer advertises it.
