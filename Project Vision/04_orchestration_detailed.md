# Paper Chase — Orchestration (Detailed)

This document explains how Paper Chase orchestrates the `ingest` flow. It is written for someone with no prior knowledge of the project, so they can understand exactly what happens to a PDF from the moment it enters the system until it becomes part of the wiki.

---

## 1. The Pipeline

The orchestrator is not a distributed system of 7 agents. It is a **five-layer pipeline** with two LLM calls per chunk (Extractor and optional Synthesis Writer), two per-ingest curation calls during materialization (topic curation and entity curation — amended 2026-07-23, user-ratified), one LLM pass at the end (DOX Writer), and an optional **Cross-Wiki Discovery** pass (Phase 24) that runs after the workspace DOX pass. The optional Synthesis Writer may rewrite entity, topic, and document pages.

```
PDF → Chunker → Layer 1 (Raw Pages) → Layer 2 (Extractor) → Layer 3 (Materializer → Curation) → Layer 4 (Synthesis Writer) → Layer 5 (DOX Writer) → Layer 6 (Cross-Wiki Discovery, Phase 24)
```

The local deterministic code handles the boring parts: reading files, extracting text, computing hashes, writing files, validating schemas, and checking links. The LLM handles the thinking parts: extraction, classification, synthesis, curation judgments, and writing navigation contracts.

**Concurrency (amended 2026-07-23, user-ratified):** within Layer 4, the entity-synthesis and topic-synthesis stages may process their pages concurrently through a bounded worker pool with a fixed cap of 4 concurrent calls; pages are independent of one another, and reports and on-disk output are written in deterministic page order regardless of completion order. Everything else is always sequential: extraction (chunks share rolling-memory context), the curation calls, the DOX Writer (bottom-up level dependencies), the workspace pass, the optional Cross-Wiki Discovery pass (Phase 24), and the AGENTS.md Updater. **Transport tuning for the pool (amended 2026-07-25, user-ratified):** concurrent large-output streams put more pressure on the API than sequential calls, so transport settings account for the pool — generous header timeouts for large-output calls, slightly staggered worker dispatch instead of simultaneous starts, and backoff between transport retries.

**Per-PDF sequential ingestion (amended 2026-08-26, user-ratified — the default run shape):** the layers above now compose at PDF scope, not run scope. Each selected PDF runs its own complete mini-pipeline — chunk → extract → materialize (including the curation calls, which run per PDF) → synthesize-or-amend — and only when that PDF is fully finished does the next PDF begin. The DOX Writer, the workspace pass, Cross-Wiki Discovery, and the AGENTS.md Updater are unchanged: each still runs exactly once, deferred until every PDF of the run has finished. The purpose is incremental page-building: the first PDF to mention an entity/topic/comparison writes the page with normal full synthesis; every later PDF that adds evidence for an existing page AMENDS it with a patch that carries only the new information (Step 9's amendment synthesis), so synthesis output cost scales with the new evidence a PDF brings, never with the accumulated size of the page. Chunk extraction within one PDF stays sequential (rolling memory), the synthesis pool cap 4 stays per PDF, and per-PDF checkpointing (Step 11) lands exactly where it always did — at each PDF's completion.

---

## 2. Before Anything: `init`

Before the pipeline runs, the user creates a wiki with the `init <slug>` command. This command:

- Creates the workspace and wiki folders.
- Creates an empty `raw/` folder for the PDFs.
- Creates the top-level folders: `documents/`, `sources/`, `entities/`, `topics/`.
- Creates `.state/` for internal tracking.
- Copies `templates/AGENTS.md` to `wikis/<slug>/AGENTS.md`.
- Records the wiki's output language in `AGENTS.md` and `.state/language.json` (default: English; see §9).
- Opens `AGENTS.md` in the user's editor (or prints a message to edit it).

`init` does not call the LLM. It just sets up the workspace. The user then edits `AGENTS.md` and copies PDFs into `raw/`.

---

## 3. The `ingest` Command: Building the Wiki

The `ingest` command is the main workhorse. It processes the PDFs in chunks and writes or updates the wiki pages.

### 3.1 Incremental Ingestion

`ingest` is incremental. It tracks every PDF by SHA-256 hash:

- **New PDFs** are processed in full.
- **Changed PDFs** are re-processed and their derived pages are updated.
- **Removed PDFs** cause their derived pages to be marked as stale.
- **Unchanged PDFs** are skipped.

This makes re-running `ingest` efficient and ensures the wiki compounds over time.

### 3.2 Step-by-Step Ingestion Flow

**Loop scope (amended 2026-08-26, user-ratified):** Steps 3-9 below run once per selected PDF, in order, inside the per-PDF loop (§1); a PDF is checkpointed as ingested when its own pass through Steps 3-9 completes, and only then does the next PDF start. Steps 10-11 (DOX/workspace/cross-wiki/Updater, final state) run once after the loop. Within a single PDF's pass the mechanics of every step are unchanged from the batch description that follows — the Materializer of Step 6 simply runs against the extraction JSON accumulated so far (this PDF's chunks plus every earlier PDF's), which is exactly what the on-disk `.state/extracted/` set already provides.

#### Step 1: Read `AGENTS.md` and Rolling Memory

The system reads:
- `AGENTS.md` — **the constitution of the wiki.** This is the ultimate law that every LLM call must follow. It defines the folder structure, page types, citation format, naming conventions, writing rules, and ingest workflow. Generated automatically from the template at `init` time. The LLM reads the full AGENTS.md at every call and complies with its rules.
- `.state/rolling-memory.json` — what the wiki already contains (entities, folders, sources).
- `.state/ingestion.json` — which PDFs have been processed and their hashes.

#### Step 2: Select PDFs to Process

Using SHA-256 hashes, the system determines which PDFs need processing. Unchanged PDFs are skipped entirely.

#### Step 3: Chunk the PDFs

Each PDF is split into **page-based chunks**. A chunk is one or more consecutive pages that fit within the configured LLM context window. The system never splits a page, table, or figure across chunks.

#### Step 4: Extract Text (Layer 1)

For each chunk, `pdfjs-dist` extracts the raw text and writes it to:
```
documents/<source-slug>-part-001.md
```

The document page contains:
- YAML frontmatter with `title`, `type: document`, `sources` array.
- The raw extracted text.
- Tables preserved as markdown tables.
- Figure descriptions.

This is deterministic. No LLM is involved.

#### Step 5: Extract Structured Data (Layer 2)

For each chunk, the system calls the **Extractor** (one LLM call):

**Input:**
- The chunk text.
- The page range.
- `AGENTS.md` (full text).
- Rolling memory (existing entities, folders, sources).
- The language directive: the input language of the chunk and the wiki's output language (§9).

**Output:** JSON saved to `.state/extracted/<chunk-id>.json`:
```json
{
  "entities": [
    {
      "name": "John Smith",
      "type": "person",
      "slug": "john-smith",
      "folder": "entities/people/executives",
      "mentions": [
        {"page": 1, "context": "John Smith, CEO of Acme Corp"}
      ]
    }
  ],
  "relationships": [
    {
      "subject": "john-smith",
      "predicate": "is-ceo-of",
      "object": "acme-corp",
      "evidence": "John Smith, CEO of Acme Corp",
      "page": 1
    }
  ],
  "claims": [
    {
      "text": "Revenue was $42.5M in Q3 2024",
      "type": "financial",
      "entities": ["acme-corp"],
      "page": 2
    }
  ]
}
```

The Extractor is the only LLM call in the core pipeline. It does everything: entities, relationships, claims, and folder assignments.

#### Step 6: Materialize Pages (Layer 3)

After a PDF's chunks are extracted (per-PDF loop, amended 2026-08-26), the **Materializer** reads all `.state/extracted/*.json` files accumulated so far, aggregates them, curates the aggregate (the curation calls run once per PDF inside the loop — amended 2026-08-26, user-ratified: identity is settled before that PDF's synthesis so amendments always target canonical pages), and writes or updates pages:

1. **Create folders:** For each entity, create the folder path (including intermediate folders) if it does not exist.
2. **Aggregate data:** For each unique entity slug, collect all mentions, relationships, and claims across all chunks; group claims by type into candidate topics. No topic or entity pages are written yet.
3. **Curate the aggregate:** two per-ingest LLM calls — one **topic-curation** call and one **entity-curation** call, which may run in parallel — review the candidates together with the existing on-disk topics and entities, so update runs re-curate everything:
   - *Topic curation* returns a strict JSON decision list (`merge` / `drop` / `keep`). Themes duplicated under different wording, plural, or form merge into one topic; candidates that are not a theme, concept, or issue a journalist would search for — meta-descriptors of the documents' rhetoric such as `statistical`, `temporal`, or `methodological` — are dropped (`05_page_types_specification.md` §7). A dropped topic's claims remain on their entity and document pages, so no evidence is lost.
   - *Entity curation* is **merge-only** and never drops: it merges name variants, abbreviations, translations, and word-order permutations of the SAME real-world thing into one canonical page (`05_page_types_specification.md` §6). It never merges a sub-unit into its parent, never merges colocated-but-distinct things, and treats uncertain pairs as keep.
   - Each decision list is validated deterministically before anything is applied: every slug exists in the input set, every input slug appears in exactly one bucket, every merge target is itself kept, there are no self-merges, and merge chains are resolved by union-find. Violations are retried with validator feedback (§6); on exhaustion or transport failure the curation is skipped entirely — the **keep-all fallback**, which writes all candidates exactly as the uncurated aggregate produced them (no data loss, logged, self-healing on the next successful ingest).
   - **Decision-list sizing (amended 2026-07-25, user-ratified):** a single curation call must produce a decision list that fits its output-token ceiling, so the `keep` bucket is never listed in the output schema — kept candidates are the deterministic complement (input minus merges, drops, and `unsure`), computed by code, and any per-decision justification is capped. Above that size the candidate set is split deterministically into lexical-stem buckets (one validated call per bucket) with a single reconciliation call over the survivors — the trigger is the estimated decision-list size approaching the ceiling, not a fixed candidate count (a verbose list can overflow the ceiling well below the old ~250-candidate threshold, and truncation is a failure the reask cannot repair).
4. **Apply and write pages:** the validated decisions are applied deterministically, all-or-nothing — topic merges union claims (deduplicated) into the kept topic; entity merges union mentions, relationships, claims, and timeline into the kept entity, rewrite relationship slug references, accumulate variant titles as `aliases`, and rewrite wikilinks to merged-away slugs across all content pages (exact target-segment match). Existing pages that were manually edited are never auto-merged (hash-mismatch skip, logged as a conflict). Then entity and topic pages are written or updated as before: for new entities/topics, create the page; for existing ones, load the current page, merge new data, and rewrite. Merged-away or dropped existing pages and folders are removed deterministically. Merges, drops, skips, and fallback events are recorded in `.state/curation-report.json` for audit, and a human-editable `.state/curation-overrides.json` never-merge list is honored on subsequent runs.
5. **Update rolling memory:** Add new entities, folders, and sources — after curation, so the memory reflects the curated set.

**Update Mode:**
When an entity page already exists:
- Load the existing page.
- Merge new mentions, relationships, and claims.
- If the page has been manually edited (hash mismatch with `.state/ingestion.json`), skip the update and log a conflict.
- Otherwise, rewrite the page with the merged data.

**Preservation Check:**
After writing an updated page, verify that every existing citation (`[^srcN]`) and every existing wikilink is still present. If the check fails, log the conflict and skip the update.

#### Step 6b: Disambiguate Generic Labels (Layer 3, added 2026-08-26, user-ratified)

During aggregation — before curation candidates are built — the Materializer runs a **generic-label disambiguation pass** (`02_WIKI_concept_detailed.md` §4.6 class 6, `05_page_types_specification.md` §6 class 6):

1. **Deterministic proposal.** Flag every slug (entity or topic) that (a) matches a generic-label pattern (`indikator-N`/`indicator-N` and the same shape: `table-N`, `section-N`, `appendix-N`, `figure-N`) AND (b) carries evidence from two or more source files whose sample claims/significance have low substantive-token overlap (the label's own tokens and stopwords excluded). Both conditions are required: a generic label that means the same thing across sources (one register's indicator across report years) is never flagged.
2. **LLM heterogeneity judgment.** One lightweight call per flagged slug, fed the slug, its title, and the sample claims/significance grouped by source file, returns strict JSON: `split: false` (same meaning — keep one page) or `split: true` with one member per distinct meaning (`{slug, title, sources[]}` — the member slug derived from the meaning or its source register, never a bare re-numbering). The call follows the standard validation/reask/keep-one-page fallback posture of the curation calls.
3. **Deterministic application.** A confirmed split becomes a class-6 composite page at the generic slug (members = the per-meaning identities, evidence grouped per member); the decision is recorded as a sticky `disambiguate` record (source-file → member mapping included) in `.state/curation-decisions.json` and pre-applied deterministically on every later run, so the judgment is paid for once. New evidence from a known source routes to that source's member; evidence from a NEW source with a new meaning re-enters the judgment for that member only.
4. **Escape hatch.** The `splits` list dissolves a disambiguation composite exactly as it dissolves any cluster (member pages rebuilt, reversal logged).

The pass never fires on non-generic slugs and never proposes merges — its only power is separating one label's distinct meanings, the inverse of curation's merge power.

#### Step 7: Write Source Pages (Deterministic)

For each processed PDF, write a `source` page with provenance: file path, SHA-256 hash, page count, extraction timestamp, warnings.

#### Step 8: Validate Content Pages (Deterministic)

Scan all materialized content pages for `[[Page Title]]` wikilinks, `[^srcN]` citations, and valid YAML frontmatter. Report broken links, invalid citations, and schema issues. The DOX Writer will not run until this validation passes.

#### Step 9: Write Synthesis (Layer 4, Phase 5+)

After the core content pages are validated, the optional **Synthesis Writer** runs per entity, topic, and document page:

1. Read the structured entity page.
2. Call the LLM with the synthesis prompt, passing the entity data and `AGENTS.md`.
3. Run a preservation check to ensure no mentions, relationships, claims, or citations were dropped.
4. If the check passes, replace the structured page with the synthesized page.
5. If the check fails, log a conflict and keep the structured page.

Layer 1 prose is written in the wiki's output language; Layer 2 detail is preserved verbatim in the source language (§9). This step is opt-in (`ingest --synthesis`).

**Synthesis resume (amended 2026-07-25, user-ratified):** every page that passes synthesis (strict or permissive) is recorded in `.state/synthesis-state.json` with a fingerprint of its underlying aggregate data. On later runs, a page whose fingerprint is unchanged is NOT re-synthesized and NOT rewritten by the Materializer — the finished page is preserved byte-for-byte (an aborted run costs only the pages still in flight, never the pages already paid for). Pages that fell back to the template are retried on the next run (a transient-caused template deserves a second chance). Any change to the page's aggregate data — new evidence, a curation merge — changes the fingerprint and re-synthesizes the page normally.

**Amendment synthesis — patch output (amended 2026-08-26, user-ratified):** under the per-PDF loop, a changed-fingerprint page that already carries a successful synthesis record (strict or permissive) is NOT re-written in full. Instead the **Amendment Writer** receives (a) the existing page content and (b) only the NEW evidence — the delta between the recorded aggregate the page was last synthesized from and the current aggregate — and emits a **structured patch**: a strict-JSON list of patch operations (add evidence items to an existing section or composite-member group; add a new member or section when the page shape grows; make bounded prose edits such as the lead sentence; flag a contradiction with both sides quoted). The LLM performs the semantic diff — deciding what is new, what is already covered, and what contradicts existing text — because deterministic text-diff cannot (near-synonymous restatements must be recognized as duplicates, not additions). Deterministic code only validates the patch schema, applies it to the page, and re-runs the preservation check over the MERGED page — every previously-preserved evidence item AND every new item must be present verbatim. A failed patch (unparseable output, unknown anchor, preservation failure) enters the standard reask loop (≤3 attempts, validator errors fed back) and on exhaustion falls back to normal full synthesis from the aggregate — the amendment path can never lose data or leave a page half-patched. A successfully patched page records a new synthesis-state entry (mode `patch-amended`, skip-eligible like strict/permissive). New pages, template-fallback pages, and pages whose page kind changed (e.g. becoming a class-6 composite) take the normal full-synthesis path — patching applies only to a synthesized page of the same shape. Contradiction flags render as marked blocks in the page quoting both sides with their citations; they never delete the older claim.

#### Step 10: Write DOX Contracts (Layer 5)

After all content pages are finalized, the **DOX Writer** runs:

1. Scan the entire wiki tree.
2. For each folder and the wiki root, read the folder contents, `AGENTS.md`, and rolling memory.
3. Call the LLM once per folder with a structured prompt to write a rich `index.md` (prose in the wiki's output language, §9).
4. Verify that the LLM-generated `index.md` uses the exact children list and statistics supplied by deterministic code.
5. Write the final `index.md` files.
6. Run a final validation pass over the entire wiki, including the new DOX pages.
7. Run the workspace pass — the topmost step of the same bottom-up chain (folder indexes → wiki root index → workspace index). Two parts, two ownership rules (amended 2026-07-21, user-ratified): (a) the coherent workspace prose — an LLM synthesis reading ALL wikis' freshly-written root `index.md` contracts (never their content pages), regenerated ONLY when the set of wikis changes or no prose exists yet, in the regenerating run's output language (§9), otherwise preserved byte-for-byte; (b) the `## Wikis` catalog — one LLM call writes ONLY the triggering wiki's own line in this run's output language, preserving every other wiki's line byte-for-byte. Deterministic code re-imposes the children list, statistics, and stitching over all wikis.
8. Run the optional **Cross-Wiki Discovery** pass (Phase 24) — only when the workspace contains more than one wiki. It builds a derived `wikis/cross-wiki/` artifact set (entity registry, relationship graph, topic clusters, and their indexes) by reading the per-wiki root DOX contracts, per-wiki entity/relationship artifacts, and the workspace index; it never reads raw content pages. The workspace index gains a `## Cross-Wiki Discovery` section linking to `cross-wiki/index.md` (amended 2026-08-09, user-ratified).

This is an LLM-driven step. It produces the navigation contracts that describe the finalized wiki and the workspace above it.

#### Step 11: Update State

Write `.state/ingestion.json` and `.state/rolling-memory.json` for the next run.

**Checkpointing (amended 2026-07-25, user-ratified):** state is not only written at the end of the run. Each PDF is recorded as ingested in `.state/ingestion.json` as soon as its own processing completes, so an aborted run never re-extracts finished PDFs; per-page synthesis records (Step 9) are likewise written as pages complete. The end-of-run write remains the final, complete record.

---

## 4. The Synthesis Writer (Layer 4, Phase 5+)

After the core content pages are validated, the optional **Synthesis Writer** turns structured entity, topic, and document pages into readable two-layer pages:

**Input:** The structured data for one entity, topic, or document page (e.g., mentions, relationships, claims, timeline, context, significance, disambiguation, or extracted chunk text).
**Output:** A readable markdown page with synthesis at the top and preserved detail below.

The Synthesis Writer runs per entity page after the Materializer has aggregated the data. It replaces the structured template with LLM-written prose, but only if the preservation check confirms that no data was dropped.

**Amendment mode (added 2026-08-26, user-ratified):** the same writer family has a second mode. When the page already exists with a successful synthesis and the per-PDF loop brings new evidence, the Amendment Writer (Step 9) emits a patch instead of a page — same prompts' citation and language rules, same preservation law applied to the merged result, same reask-and-fallback posture on failure. Full synthesis remains the first-PDF path and the universal fallback.

**Preservation Check:** After the Writer returns a page, verify that every mention, relationship, and claim from the structured data still exists in the written page. If the check fails, reject the output and keep the structured template. For an amended page the same check runs over the PATCHED page against the union of previously-preserved and new evidence (`07_validation_and_quality.md` §3).

---

## 5. Rolling Memory

Rolling memory is a JSON file at `.state/rolling-memory.json`:

```json
{
  "entities": [
    {"slug": "john-smith", "folder": "entities/people/executives", "mentionCount": 3}
  ],
  "topics": ["financial/revenue-recognition"],
  "sources": ["annual-report-2023"],
  "folderStructure": [
    "entities/people/executives",
    "entities/companies/offshore"
  ]
}
```

**When it is loaded:** Before processing each chunk, the system loads rolling memory and passes it to the Extractor.

**When it is updated:** After the Materializer finishes, the system updates rolling memory with new entities, topics, and folders.

**Why it matters:** Without rolling memory, chunk 20 of a 2000-page leak would not know that chunk 3 established "Acme BVI" as a shell company. The Extractor might classify it as a regular company.

---

## 6. Validation Order

Validation runs at multiple points in the pipeline:

1. **Schema validation** — Is the Extractor JSON valid? Does it match the expected schema?
2. **Folder validation** — Does every entity folder start with `entities/` or `topics/`? No path traversal?
3. **Preservation check** — After the Synthesis Writer (if used), does the markdown page contain every mention, relationship, and claim from the structured data for entity and topic pages, and all preserved tables, figures, and extracted sections for document pages?
4. **Content-page validation** — After materialization (and optional synthesis), do all `[[Page Title]]` links resolve, all `[^srcN]` citations map to sources, and all pages have valid frontmatter?
5. **DOX-page validation** — After the DOX Writer writes the `index.md` contracts, do the new DOX pages have valid frontmatter, accurate children lists, and no broken links?
6. **Cross-wiki validation (Phase 24)** — After the Cross-Wiki Discovery pass, are the `wikis/cross-wiki/*.md` files and their `.state/cross-wiki/*.json` mirrors schema-valid, do path-qualified wikilinks resolve, and do they contain no unsourced factual claims?

If any check fails, the error is logged. **Retry policy (amended 2026-07-20; feedback-retry carve-out amended 2026-07-23, user-ratified):** the system distinguishes four failure classes.

- **Deterministic failures** — HTTP 4xx responses (auth failures, quota, unknown model) — are **never retried**: retrying them would mask configuration problems and burn tokens; the user fixes the key, the model, or the configuration and re-runs `ingest`.
- **Content-defect failures** — invalid Extractor JSON, Extractor schema-validation errors, and the quality failures below — are retried with **validator feedback** (the "reask" pattern): the LLM receives its previous output plus the validator's exact error list and is asked to correct only the listed violations, up to **3 total attempts**, each attempt logged to `.state/llm-calls.json`. A feedback retry is not a blind repeat — the validator's errors are new information, and these defects are partly LLM variance, not necessarily prompt defects.
- **Transient transport failures** (HTTP 429/5xx, network errors, timeouts) are retried with backoff, up to 3 total attempts per call, each attempt logged. **Per-page transport fallback (amended 2026-07-25, user-ratified):** when a transient failure is still throwing after the bounded retries at a **per-page stage** (entity or topic synthesis), the error is caught for THAT page and the page falls back to the deterministic structured template — one hiccup costs one page's prose, never the run. The fallback is logged loudly and counted in metrics. **Outage detector:** the abort returns when transport-failed pages reach **5 consecutively** (no successful call in between) or **more than 10% of a stage's pages** — that signature means a real outage, and the run aborts with the transport error (fail loud). HTTP 4xx NEVER gets a per-page fallback — a configuration problem must not silently template a whole wiki. Other stages are unchanged: the Extractor's thrown errors still abort (its per-chunk fail-loud), and DOX/workspace/updater already catch thrown errors once per target into their deterministic fallbacks.
- **Quality failures** — a synthesis page that fails the preservation check, a patch output that is unparseable, references an anchor/member that does not exist, or whose MERGED page fails the preservation check (added 2026-08-26: patched pages fall back to normal full synthesis after reask exhaustion, never to a half-patched page), a DOX Writer / workspace-pass response that is unparseable or missing required sections, an AGENTS.md Updater response missing required sections, or a curation decision list that fails deterministic validation — use the same feedback-retry loop (≤3 total attempts) before the deterministic fallback (structured template / full synthesis / deterministic index body / deterministic workspace line / deterministic updater fallback / keep-all curation skip). Every fallback is still logged as before.

**Exhaustion:** an Extractor content defect that still fails after feedback retries rejects the chunk and aborts the ingest with the validation error (fail loud — unchanged). Synthesis/DOX/workspace/updater exhaustions use their deterministic fallbacks, logged as before.

**Repair-rate warning:** when an elevated share of a run's LLM calls needed feedback repair (more than 25% of the run's LLM calls, or 5 or more repairs in one run), the system warns that the underlying prompt may need attention — the loop must never silently mask a systematic prompt defect.

**Output-token ceilings (amended 2026-07-23, user-ratified):** per-call `max_tokens` values are safety ceilings sized above the largest legitimate output (synthesis family 32768, DOX Writer 8192, Extractor 32768 — raised from 16384 on 2026-07-24 after a dense chunk's extraction JSON structurally exceeded it, user-ratified), never length controllers — the model does not see the ceiling, so a low ceiling yields truncated output, never shorter output. A truncated response surfaces as the quality failure it causes (unparseable JSON, missing sections, failed preservation) and follows the feedback-retry loop above; worst-case per-call cost stays bounded by the ≤3-attempt limits.

---

## 7. Who Decides What

| Decision | Authority | Mechanism |
|---|---|---|
| High-level wiki purpose | LLM | Inferred from corpus content during ingestion |
| Wiki output language | Human | Chosen at `init`, recorded in `AGENTS.md` and `.state/language.json` (§9) |
| Input language per ingest run | Human | `--input-language` flag or TUI selector (§9) |
| Which PDFs to ingest | Human | Files placed in `raw/` |
| Exact folder structure | LLM | Extractor proposes sub-folders under `entities/` and `topics/` |
| Entity classification | LLM | Extractor assigns type and folder |
| Page content (synthesis) | LLM | Synthesis Writer generates readable pages |
| Text extraction, hashing, file I/O | Deterministic code | `pdfjs-dist`, `fs`, `crypto` |
| Validation | Deterministic code | Schema checks, link checks, preservation checks |
| Navigation contracts | LLM | DOX Writer reads finalized pages and writes `index.md` |
| Structural change review | Human | After-the-fact via `.state/proposals/` log |

---

## 8. Example Walkthrough: One PDF

Here is what happens to a single 100-page PDF of political-donation filings.

1. **User runs `init donations-2024 --title "Political Donations 2024"`.** The system creates the workspace, folders, and generates `AGENTS.md` automatically from the template. The user does not edit `AGENTS.md`. The LLM will infer the corpus purpose from the content during ingestion.

2. **User copies the PDF into `raw/` and runs `ingest`.** The system sees the PDF is new and processes it. It splits the PDF into chunks of 10 pages each.

3. **Chunk 1 (pages 1–10).** Layer 1 extracts text and writes `documents/donations-2024-part-001.md`. Layer 2 calls the Extractor, which reads the automatically generated `AGENTS.md` and the chunk text. It discovers politicians, parties, and donors, then proposes the folder structure: `entities/people/politicians/`, `entities/people/donors/`, and `entities/organizations/parties/`. It returns JSON with entities assigned to these folders.

4. **Materializer.** After all 10 chunks are extracted, the Materializer reads all JSON files. It creates the folders the Extractor proposed, writes entity pages for each politician and donor, and writes topic pages for "Campaign Finance" and "Donation Thresholds."

5. **Synthesis Writer (optional).** If the user ran `ingest --synthesis`, the Synthesis Writer reads each structured entity page, calls the LLM to write readable prose, and runs a preservation check. Pages that pass the check now start with a narrative summary of the entity.

6. **DOX Writer.** After all content pages are finalized, the DOX Writer scans the wiki, reads each folder's pages and `AGENTS.md`, and calls the LLM to write rich `index.md` navigation contracts for every folder and the wiki root.

7. **User opens the wiki in Obsidian.** They see a folder structure with politicians, donors, and parties that the LLM created based on the actual content. They click `[[senator-x|Senator X]]` and see every donation mentioned in the PDF, with citations to exact pages.

8. **User adds a second PDF and runs `ingest` again.** The system skips the first PDF (hash unchanged) and processes the second. New entities are added. Existing entity pages are updated with new mentions. The Synthesis Writer (if enabled) and the DOX Writer regenerate their outputs. The AGENTS.md updater (if enabled) proposes updates to `AGENTS.md` based on the newly discovered structure.

---

## 9. Multilingual Ingestion

The pipeline ingests PDFs in several European languages, and the language of the wiki's prose is independent of the language of the source PDFs. Two settings govern this.

### 9.1 Two Language Settings

- **Output language** — the language the wiki is written in. A per-wiki setting chosen at `init` (default: English), recorded in the wiki's `AGENTS.md` constitution and in `.state/language.json`. It stays fixed for the life of the wiki so the wiki reads as one coherent document.
- **Input language** — the language of the PDFs being ingested in one run. Chosen per `ingest` run (CLI `--input-language` flag or TUI selector; default: English). A wiki can ingest English PDFs today and Danish PDFs tomorrow.

Both settings draw from a small curated set of European languages (English, Danish, German, French, Spanish, Norwegian, Swedish), each with a deterministic transliteration map (§9.3).

### 9.2 The Language of Each Layer (Binding)

The two-layer page model (`02_WIKI_concept_detailed.md` §3) fixes which language appears where:

- **Layer 1 (synthesis prose)** is written in the **output language**. This holds for the Synthesis Writer's Layer 1 prose and for the DOX Writer's `index.md` descriptions.
- **Layer 2 (preserved detail)** always stays in the **source language, verbatim**: mention quotes, relationship evidence, claim text, extracted text, tables. Never translated, never reworded. The preservation check (§6) is a verbatim substring check, so translating Layer 2 would fail validation — and would break provenance, because a quote the reader verifies against the PDF must match the PDF's words (`06_citation_and_provenance.md` §8).
- **The Extractor works in the input language**: context, significance, claims, and timeline text are written in the input language; mention contexts are verbatim quotes from the chunk, as always.
- **Folder taxonomy follows the output language**: new sub-folder names are output-language words in transliterated kebab-case. Existing folders are always reused first (unchanged rule), so a wiki whose output language never changes keeps one consistent taxonomy.

Example: an English wiki ingesting a Danish PDF gets English narrative prose with Danish evidence sections — readable at the top, verifiable at the bottom.

### 9.3 Slugs and Transliteration

Slugs remain lowercase ASCII kebab-case (every run of non-`[a-z0-9]` characters becomes one `-`). Before slugifying, names pass through the **input language's transliteration map** so non-ASCII characters survive meaningfully instead of collapsing to hyphens: "Søren" → `soeren` (not `s-ren`), "København" → `koebenhavn`, "Müller" → `mueller`, "Årsrapport 2024.pdf" → source slug `aarsrapport-2024`.

**Maps:** Danish and Norwegian æ→ae, ø→oe, å→aa; German ä→ae, ö→oe, ü→ue, ß→ss; Swedish å→a, ä→a, ö→o. After the explicit map, all languages get Unicode NFD diacritic stripping (é→e, ñ→n, ç→c). When no language (or English) is set, slugify behaves exactly as it did before multilingual support — byte-identical, protecting existing wikis, tests, and the frozen Phase 0 surface.

**Mixed-language caution:** ingesting the same wiki with a different input language than a previous run can produce different slugs for the same name (slug forking → duplicate pages). The system warns when a run's input language differs from the last recorded run; re-ingests after a language change should be reviewed.

### 9.4 Mechanism

No per-language prompt files. Every LLM prompt template carries a `{languageDirective}` placeholder, filled at runtime from the two settings (empty when both are English, keeping default behavior byte-identical). The wiki constitution template states the output language, so every LLM call — which always reads `AGENTS.md` — inherits the rule. Deterministic code (extraction, chunking, materialization, validation) is language-neutral and unchanged.

The per-ingest curation prompts (§3.2 Step 6) follow the same `{languageDirective}` convention. The topic identities the curation pass judges are output-language: claim types become topic folder names, and folder names follow the output language (`05_page_types_specification.md` §2.1). The sample claim and mention texts the curation pass also sees stay verbatim in the source language, as always.
