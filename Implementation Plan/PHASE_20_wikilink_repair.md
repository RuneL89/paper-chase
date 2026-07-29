# Phase 20: Wikilink Repair (+ One-Time Remediation)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-020`
**Version:** 1.0.0
**Status:** Complete — user-accepted 2026-07-29
**Date:** 2026-07-29
**Dependencies:** Phases 0-9, 11-17
**Estimated Time:** 2-3 hours
**LLM Token Budget:** $0 (all gate tests and the remediation are LLM-free)

**Canon basis:** `Project Vision/02_WIKI_concept_detailed.md` §2 (no page is an island; links are the connection substrate); `07_validation_and_quality.md` §2.5 (broken wikilinks are reported); `05_page_types_specification.md` §2 (aliases as lookup aid). Backlog **B20**. Evidence: 2026-07-28/29 live runs — 12 broken links in afdk, 6 in akdb, all near-miss paraphrases of real slugs (`[[indikator-2]]` vs `indikator-2-ekkokardiografi`, `[[thyreoideastimulerende-hormon]]`). Compliance pre-check: compliance-log [2026-07-29 09:10].

---

## 1. Objective

The model writes wikilinks to slugs that almost exist; the checker reports them and nobody repairs them. Add a deterministic repair pass (conservative: only unambiguous fixes), apply it to every synthesized page going forward, and run a one-time remediation over the current `dist/wikis` so the user never fixes a link by hand — with hash re-convergence so the remediation cannot create B19-class false-flags.

## 2. What to Build

### 2.1 The repair rule

**Files:** NEW `src/utils/wikilink-repair.ts`, `src/validation/link-checker.ts` (share the slug universe)

- For each wikilink whose target does not resolve (existing checker semantics: path-form first, then basename-slug):
  1. **Unique-prefix match:** exactly one page slug in the wiki starts with the target (`indikator-2` → `indikator-2-ekkokardiografi`). Repair to the full slug, display text untouched.
  2. **Alias match:** exactly one page whose frontmatter `aliases` slugifies to the target. Repair to that page's slug.
  3. **Otherwise (zero or multiple matches):** leave broken; report as unrepairable with the candidate list. Never guess.
- Index pages and `sources/`/`documents/` paths are out of scope (their links are DOX/deterministic concerns).

### 2.2 Pipeline application

**Files:** `src/utils/wikilink-repair.ts` (the pass); wiring in `src/commands/ingest.ts` is the orchestrator's seam

- A pure function `repairWikilinksInMarkdown(markdown, slugUniverse): { markdown, repairs, unrepairable }`. Applied to entity/topic pages at the synthesis write points (with the frontmatter/Sources enforcers), so new pages ship repaired. Repairs are logged per page.

### 2.3 One-time remediation over `dist/wikis` (user-directed)

**Files:** NEW `scripts/repair-wikilinks.ts`

- Walks every wiki in a workspace (`dist/wikis` by default), applies §2.1 to every entity/topic page, rewrites changed pages, and **re-converges `pageHashes` for every modified page** (updates `.state/ingestion.json` so the next ingest sees tool-written content, not false "manual edits"). Prints a per-wiki report: repaired (old → new), unrepairable with candidates, unchanged counts.
- Dry-run flag (`--dry`) prints the report without writing.

## 3. Technical Approval Gates

All gates LLM-free.

- **Gate 20.1:** unique-prefix repair: `[[indikator-2|Indikator 2]]` → `[[indikator-2-ekkokardiografi|Indikator 2]]` when exactly one slug matches; display text and surrounding prose byte-identical; the repaired link resolves in the checker.
- **Gate 20.2:** ambiguity stays broken: `[[region]]` with two `region-*` pages is unchanged and reported with both candidates; zero matches unchanged.
- **Gate 20.3:** alias-based repair: a target matching a page's `aliases` (slugified) repairs to that page's slug.
- **Gate 20.4:** hash re-convergence: after remediation on a fixture wiki, every modified page's `pageHashes` entry equals its new disk hash; unmodified pages' entries untouched.
- **Gate 20.5:** remediation dry-run prints the exact report without writing a byte.
- **Gate 20.6:** full key-less suite: Phase 17/18/19 baselines plus the new phase-20 tests, zero unenumerated regressions; `npx tsc --noEmit` clean.

## 4. User Acceptance Tests (UAT)

- **UAT 20.1 (live, $0):** run `tsx scripts/repair-wikilinks.ts dist/wikis` (dry first, then real). Expected: afdk broken 12 → 0 (or listed unrepairable with candidates), akdb broken 6 → 0; next ingest shows no new manual-edit false-flags from the touched pages.
- **UAT 20.2 (next live ingest, observational):** new pages ship with zero repairable broken links (repairs logged per page).

## 5. Approval Checklist

- [ ] All 6 gates pass; `npx tsc --noEmit` clean
- [ ] Ambiguous targets are never guessed (gate 20.2)
- [ ] Remediation re-converges hashes (gate 20.4) — no B19-class side effects
- [ ] UAT 20.1 report attached to the status file
- [ ] Compliance log shows no unresolved contradictions; unified verification (with Phases 18/19) passed

## 6. Integration Notes

**Depends on:** Phase 4 (link checker semantics), Phase 14 (aliases), Phase 17 (synthesis write points).
**Produces:** the repair rule + pipeline application + one-time remediation with hash re-convergence.
**Contract:** conservative (unique matches only); display text never rewritten; every repair and every non-repair logged.
