# Phase 24: Cross-Wiki Discovery Layer (Agent-First, Human-Verifiable)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-024`
**Version:** 1.2.1
**Status:** Ratified — vision amendments applied; frontmatter aligned to `05_page_types_specification.md` §9.1; LLM enhancements #1–4 and preflight run-control added
**Date:** 2026-08-09
**Dependencies:** Phases 0–9, 11–23 (relies on per-wiki entity/topic pages, DOX contracts, and the AGENTS.md updater hook; benefits from Phase 21 sticky curation and Phase 22/23 page-kind machinery)
**Estimated Time:** 12–18 hours
**LLM Token Budget:** $0 for automated gates (all gate tests use injected stubs); live UAT ~$8.00–$12.00

**Canon basis:** `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §3/§7 (workspace/wiki architecture; non-goal is *automatic* connection-finding — this phase supplies derived artifacts to the journalist or downstream agent, it does not decide stories), `03_DOX_concept_detailed.md` §3.1/§4.1/§4.2/§6 (workspace index contract and cross-wiki folder; placement after per-wiki DOX contracts; requires amendment for `wikis/cross-wiki/` and a new workspace-index section), `04_orchestration_detailed.md` §1/§3.2 Step 10 (pipeline ordering; requires amendment to insert the cross-wiki pass), `05_page_types_specification.md` §9 (custom page-type extension point for `cross-wiki-index` and `cross-wiki-topic`), `07_validation_and_quality.md` §2.5/§2.6 (schema validation and link integrity for new page types), Backlog **B14** (cross-wiki identity surface, user-directed 2026-07-28). Evidence: `dist/wikis/rkkp-*` share ~60 page basenames; the B14 audit found slug forks, canonical-name forks, alias-coverage forks, type forks, and folder forks across the four RKKP wikis.

**User decisions recorded 2026-08-09:**
1. Human-readable artifacts live in `wikis/cross-wiki/` and are linked from a new `## Cross-Wiki Discovery` section in `wikis/index-of-indexes.md`.
2. The cross-wiki pass runs after the per-wiki DOX Writer and before the AGENTS.md Updater.
3. Fuzzy entity matches use a cheap LLM; `uncertain` clusters are written to `.state/proposed-cross-wiki-matches.json` for human review, while `match` and `no-match` decisions are applied automatically.
4. Topic clustering is performed by a batched cheap LLM call over topic titles/first-paragraphs, not by a local embedding model or pure keyword overlap.
5. Cross-wiki matching is workspace-wide and cross-language: the LLM compares titles/summaries across output languages directly.
6. Cross-wiki cluster pages make no factual claims; they describe the cluster and list mapped topics, leaving factual claims to the linked per-wiki topic pages.
7. **(v1.1.0)** Entity context summarizer: one cheap LLM call per entity page produces a 1–2 sentence summary, stored in `.state/cross-wiki/entity-summaries.json` and used for disambiguation.
8. **(v1.1.0)** Relationship predicate normalizer: one batched cheap LLM call canonicalizes semantically identical relationship predicates across wikis, stored in `.state/cross-wiki/predicate-map.json`.
9. **(v1.1.0)** Uncertain entity matches are escalated to a batched mid-tier LLM for a second review; remaining uncertain matches are exposed to the downstream agent in `.state/cross-wiki/entity-match-candidates.json`.
10. **(v1.1.0)** Hypothesis signal generator: one batched mid-tier LLM call per connected cross-wiki subgraph produces structured signals in `.state/cross-wiki/proposed-signals.json` for downstream agent review; it writes no new factual claims.
11. **(v1.2.0)** Hypothesis signals live in `.state/cross-wiki/proposed-signals.json` only — they are not published as wiki pages.
12. **(v1.2.0)** The cross-wiki pass auto-runs when ≥2 wikis exist, but only after a deterministic pre-flight check. If the pre-flight detects no relevant changes, the full pass is skipped. An optional cheap-LLM relevance probe may be used when deterministic signals are ambiguous.
13. **(v1.2.0)** Uncertain entity matches are exposed to the downstream agent immediately in `.state/cross-wiki/entity-match-candidates.json`, marked `uncertain`/`unapproved`.
14. **(v1.2.0)** Entity context summaries are generated for **every** entity page in the workspace, not only cross-wiki candidates.

---

## 1. Objective

Add a workspace-level, post-DOX **Cross-Wiki Discovery Layer** that produces small, deterministic, agent-optimized artifacts for querying across many wikis, while keeping the same artifacts human-readable in Obsidian. The layer is **additive**: it does not merge per-wiki entities, does not modify per-wiki content pages, and does not replace `index-of-indexes.md`. It produces:

- A **cross-wiki entity registry** (`wikis/cross-wiki/entities.md` + `.state/cross-wiki/entity-registry.json`) of every entity that appears in ≥2 wikis, enriched with per-member context summaries.
- A **cross-wiki relationship graph** (`wikis/cross-wiki/relationships.md` + `.state/cross-wiki/relationship-graph.json`) of edges whose subject is cross-wiki or whose subject/object span different wikis, with normalized predicates.
- **Semantic topic clusters** (`wikis/cross-wiki/topics/*.md` + `wikis/cross-wiki/topics/index.md` + `.state/cross-wiki/topic-clusters.json`) that map related topics across ≥2 wikis, including across different output languages.
- **Entity context summaries**, a **predicate map**, and **hypothesis signals** in `.state/cross-wiki/` to help a downstream agent discover non-obvious cross-wiki connections.

## 2. What to Build

### 2.1 Component A — Cross-Wiki Entity Resolver

**Files:** NEW `src/cross-wiki/entity-resolver.ts`, `src/pages/cross-wiki/entity-registry-page.ts`, `prompts/cross-wiki-entity-match.prompt.txt`, `prompts/cross-wiki-entity-uncertain-review.prompt.txt`, `src/validation/cross-wiki-schema.ts`

- **Input:** scan YAML frontmatter of every `wikis/<slug>/entities/**/*.md` file in the workspace. Use `title`, `type`, `aliases`, and `sources` for the exact tier and, for the fuzzy tier, include the short context summaries produced by Component E.
- **Exact-match tier (deterministic, $0):** cluster by identical `title` or `alias` strings across all wikis, regardless of output language. Write only clusters that contain ≥2 distinct wikis.
- **Fuzzy/ambiguous tier (batched cheap LLM):** for non-exact candidate pairs/groups, send one batched call per ambiguity cluster to the cheap routing slot (Extractor/default). The model returns `match`, `no-match`, or `uncertain` for each candidate, comparing titles, aliases, and context summaries across output languages as needed.
  - `match` clusters with ≥2 wikis are written to the registry.
  - `no-match` clusters are discarded.
  - `uncertain` clusters are escalated to the uncertain-review sub-step for a stronger-model review before being excluded.
- **Uncertain-review sub-step (batched mid-tier LLM):** re-run candidates the cheap model marked `uncertain` through the mid-tier routing slot (Synthesis/DOX class). The model has access to full context summaries and source provenance. It returns `match`/`no-match`/`uncertain`. Only `match` clusters are written to the registry; remaining `uncertain` clusters are written to `.state/proposed-cross-wiki-matches.json` for human review and to `.state/cross-wiki/entity-match-candidates.json` for the downstream agent.
- **Output:** `wikis/cross-wiki/entities.md` (markdown table) and `.state/cross-wiki/entity-registry.json` (JSON mirror). Each registry entry includes the canonical title, aliases, member list, and the per-member context summary. Single-wiki entities are excluded.
- **Safety net:** if no cross-wiki entities exist, write an honest empty report.

### 2.2 Component B — Workspace-Level Relationship Graph

**Files:** NEW `src/cross-wiki/relationship-graph.ts`, `src/pages/cross-wiki/relationships-page.ts`

- **Input:** parse the `relationships` structure from every entity page (already materialized in Layer 3). Use the canonical predicates produced by Component F.
- **Inclusion rule:** include a relationship if:
  - the subject entity appears in the cross-wiki entity registry, **or**
  - the subject wiki and object wiki differ.
- **Exclusion:** intra-wiki-only edges whose subject is not cross-wiki are omitted to keep the artifact bounded.
- **Output:** `wikis/cross-wiki/relationships.md` (markdown table) and `.state/cross-wiki/relationship-graph.json` (JSON mirror). No LLM calls in this component.

### 2.3 Component C — Topic Clustering Across Wikis

**Files:** NEW `src/cross-wiki/topic-clusterer.ts`, `src/pages/cross-wiki/topic-cluster-page.ts`, `prompts/cross-wiki-topic-cluster.prompt.txt`

- **Input:** extract `title` and the first paragraph of every `wikis/<slug>/topics/**/*.md` page, plus aliases.
- **Clustering:** batched cheap LLM call(s) over topic titles/summaries. The model returns cluster assignments (`clusterId`, `title`, `mappedTopics`, optional `confidence`), including cross-language clusters. Only clusters with ≥2 distinct wikis are kept. The `mappedTopics` array (`{wiki, page, label}`) is stored in `.state/cross-wiki/topic-clusters.json` and used to render the page body.
- **Page generation:** for each cluster, one cheap LLM call writes the cluster page description and fills the `members` frontmatter with path-qualified topic slugs. The prompt carries the run's `{languageDirective}` for Layer-1 prose; mapped topic labels stay verbatim.
- **Output:** `wikis/cross-wiki/topics/<cluster-id>.md`, `wikis/cross-wiki/topics/index.md`, and `.state/cross-wiki/topic-clusters.json`.
- **Empty-cluster safety net:** if no multi-wiki clusters are found, write `topics/index.md` stating so.
- **Citation rule:** cluster pages make **no factual claims**. They describe the cluster and list mapped topics; any factual content lives on the linked per-wiki topic pages and follows the normal citation rules there.

### 2.4 Cross-Wiki DOX Writer

**Files:** extend `src/dox-writer.ts`, NEW `src/pages/cross-wiki/cross-wiki-index-page.ts`

A lightweight pass after Components A–G that writes:

- `wikis/cross-wiki/index.md` — root contract describing the three artifacts and how to use them.
- `wikis/cross-wiki/topics/index.md` — catalog of clusters (Component C already produces the page body; this pass adds deterministic header/footer and children re-imposition if needed).
- A new `## Cross-Wiki Discovery` section in `wikis/index-of-indexes.md` linking to `cross-wiki/index.md`.

This writer reads only the new cross-wiki artifacts, not full per-wiki content pages.

### 2.5 Component E — Entity Context Summarizer

**Files:** NEW `src/cross-wiki/entity-context-summarizer.ts`, `prompts/cross-wiki-entity-context.prompt.txt`

- **Input:** for every entity page in the workspace, read the first paragraph (Layer 1 synthesis) plus the entity's key relationships and aliases. Do not re-read the full preserved-detail Layer 2 block.
- **LLM call:** one cheap call per entity page to produce a 1–2 sentence summary of who/what the entity is and its primary role(s). Use the cheap routing slot (Extractor/default).
- **Output:** `.state/cross-wiki/entity-summaries.json`, keyed by path-qualified entity slug:
  ```json
  {
    "acme-reports/entities/people/executives/john-smith": {
      "title": "John Smith",
      "summary": "CEO of Green Solutions think tank; former policy advisor.",
      "type": "person",
      "sources": ["acme-report-2024.pdf pages 12-14"]
    }
  }
  ```
- **Use:** Component A's fuzzy matcher and uncertain-review sub-step consume these summaries. The entity registry JSON also includes the summary per member.

### 2.6 Component F — Relationship Predicate Normalizer

**Files:** NEW `src/cross-wiki/predicate-normalizer.ts`, `prompts/cross-wiki-predicate-normalize.prompt.txt`

- **Input:** the set of all relationship predicate strings extracted from entity pages across all wikis (e.g. `is-ceo-of`, `leads`, `is-chief-executive-of`, `received-donation-from`, `donated-by`).
- **LLM call:** one batched cheap call to cluster semantically identical predicates into canonical forms. The model receives predicate strings only, plus a few examples, and returns groups with a canonical representative for each group.
- **Output:** `.state/cross-wiki/predicate-map.json`:
  ```json
  {
    "canonical": "is-ceo-of",
    "variants": ["is-ceo-of", "leads", "is-chief-executive-of", "heads"]
  }
  ```
- **Use:** Component B rewrites every relationship edge to use the canonical predicate before writing `relationship-graph.json` and `relationships.md`. This lets a downstream agent query `is-ceo-of` and find all equivalent edges, even if different wikis phrased them differently.

### 2.7 Component G — Cross-Wiki Hypothesis Signal Generator

**Files:** NEW `src/cross-wiki/hypothesis-generator.ts`, `prompts/cross-wiki-hypothesis.prompt.txt`

- **Input:** the entity registry, normalized relationship graph, and topic clusters — all as JSON. Include per-member summaries from Component E.
- **LLM call:** one batched mid-tier call per "signal batch". A signal batch is a connected subgraph that contains at least one cross-wiki entity and at least two distinct wikis. The model returns ranked hypotheses as structured JSON, **not** narrative articles.
- **Output:** `.state/cross-wiki/proposed-signals.json` only — never published as wiki pages. Example:
  ```json
  {
    "hypotheses": [
      {
        "summary": "Bob Baker (MP, Liberal Party) received a donation from Fossil Fuel is Bad while his party proposed fossil-fuel legislation.",
        "type": "person-party-donor-legislation",
        "confidence": "high",
        "entities": ["bob-baker", "liberal-party", "fossil-fuel-is-bad"],
        "wikis": ["parliament", "finance", "foia"],
        "evidence": [
          { "wiki": "parliament", "relationship": "bob-baker → member-of → liberal-party" },
          { "wiki": "finance", "relationship": "bob-baker → received-donation-from → fossil-fuel-is-bad" },
          { "wiki": "foia", "topicCluster": "fossil-fuel-legislation" }
        ]
      }
    ]
  }
  ```
- **Constraint:** the generator makes **no factual claims** beyond those already present in the source artifacts. It produces *signals for review*, not finished stories. The downstream agent is responsible for verification.

### 2.8 Pipeline Integration

**Files:** `src/commands/ingest.ts`, `src/cli.ts`, `src/tui/ingest-screen.tsx`

Before running Components A–G, the cross-wiki pass evaluates whether a full run is worthwhile:

1. **Deterministic pre-flight.** Compare the current workspace state against `.state/cross-wiki/run-fingerprint.json`:
   - Has wiki membership changed (wiki added/removed)?
   - Have any `entities/**/*.md` or `topics/**/*.md` files changed (mtime or hash)?
   - Has the cross-wiki artifact set ever been built?
   If none of these changed, skip the entire cross-wiki pass.
2. **Cheap-LLM relevance probe (optional but recommended).** When the deterministic check detects changes but they appear local to a single wiki (e.g. only typos or a new source page), run one batched cheap call that feeds the changed pages' titles, summaries, and key relationships to the model. The model returns a simple `relevant` / `not-relevant` verdict for cross-wiki discovery. If `not-relevant`, skip the full pass and update the fingerprint.
3. **Run Components A–G** only if the pre-flight indicates cross-wiki relevance.

Insert the cross-wiki pass **after** Layer 5 (DOX Writer) and **before** the AGENTS.md Updater:

```
Layer 5 · DOX Writer → per-wiki index.md contracts
     ↓
NEW · Cross-Wiki Preflight (deterministic fingerprint + optional cheap relevance probe)
     → decides whether to run the full cross-wiki pass
     ↓
NEW · Entity Context Summarizer (cheap LLM, one call per entity page)
     → .state/cross-wiki/entity-summaries.json
NEW · Cross-Wiki Entity Resolver
     → exact-match tier (deterministic)
     → fuzzy tier (batched cheap LLM)
     → uncertain-review sub-step (batched mid-tier LLM)
     → wikis/cross-wiki/entities.md
     → .state/cross-wiki/entity-registry.json
     → .state/proposed-cross-wiki-matches.json (remaining uncertain)
     → .state/cross-wiki/entity-match-candidates.json (all uncertain for agent review)
NEW · Relationship Predicate Normalizer (batched cheap LLM)
     → .state/cross-wiki/predicate-map.json
NEW · Relationship Graph Flattening
     → wikis/cross-wiki/relationships.md
     → .state/cross-wiki/relationship-graph.json
NEW · Topic Clusterer (batched cheap LLM, cross-language)
     → wikis/cross-wiki/topics/*.md
     → .state/cross-wiki/topic-clusters.json
NEW · Cross-Wiki Hypothesis Signal Generator (batched mid-tier LLM)
     → .state/cross-wiki/proposed-signals.json
NEW · Cross-Wiki DOX Writer
     → wikis/cross-wiki/index.md
     → wikis/cross-wiki/topics/index.md
     → updates wikis/index-of-indexes.md with cross-wiki section
     ↓
AGENTS.md Updater (existing, opt-in)
```

The pass is skipped when the workspace has <2 wikis. It may be skipped/resumed using a fingerprint of wiki membership + entity/topic page mtimes stored in `.state/cross-wiki/run-fingerprint.json`. The workspace-pass enumerator in `src/dox-writer.ts` must ignore `wikis/cross-wiki/` when listing wikis.

### 2.9 New Page Types

Add to the page-type taxonomy (`05_page_types_specification.md` §9):

- **`cross-wiki-index`** — for `entities.md`, `relationships.md`, and `cross-wiki/index.md`.
  - Required frontmatter: `title`, `type`, `updated`, `children` (list of member files; follows the `index` page contract in `05` §3.1).
  - Optional: `entityCount`, `edgeCount`.
- **`cross-wiki-topic`** — for cluster pages.
  - Required frontmatter: `title`, `type`, `clusterId`, `members`, `updated` (no `wiki` field; spans wikis).
  - `members: Array<string>` of path-qualified topic slugs (`wiki-slug/topics/<sub-path>.md`).
  - The JSON mirror `.state/cross-wiki/topic-clusters.json` may carry a richer `mappedTopics` array (`{wiki, page, label}`) used to build the page body; the page frontmatter itself uses the canonical `members` field to match `05` §9.1.

Both types are workspace-level artifacts; they have no `wiki` field because they span wikis. They are index/navigation-like, so they are exempt from the orphan rule. `cross-wiki-topic` pages make no factual claims and therefore carry no `sources` frontmatter; factual claims remain on the mapped per-wiki topic pages.

## 3. Technical Approval Gates

All gates are LLM-free unless noted.

- **Gate 24.1:** Exact-match entity resolver produces correct clusters from synthetic multi-wiki frontmatter; single-wiki entities are excluded; JSON mirror matches the markdown table.
- **Gate 24.2:** Relationship graph includes cross-wiki edges and edges whose subject is in the registry; intra-wiki-only edges are excluded; JSON mirror matches the markdown table.
- **Gate 24.3:** Topic clusterer groups synthetic topic summaries into multi-wiki clusters via an injected LLM stub; single-wiki topics are excluded; cross-language candidates are handled.
- **Gate 24.4:** Cluster page prompt is slot-additive and generic — assert it contains no RKKP/registry-specific words, carries the `{languageDirective}` placeholder, and instructs the model to make no factual claims.
- **Gate 24.5:** Cross-wiki DOX Writer produces `wikis/cross-wiki/index.md`, `wikis/cross-wiki/topics/index.md`, and updates `wikis/index-of-indexes.md` with a `## Cross-Wiki Discovery` link; deterministic re-imposition of children lists and statistics.
- **Gate 24.6:** Schema validator accepts `cross-wiki-index` and `cross-wiki-topic` pages and rejects missing required frontmatter fields.
- **Gate 24.7:** Link checker resolves path-qualified wikilinks from cross-wiki pages to per-wiki pages.
- **Gate 24.8:** Resume fingerprint skips the layer when wiki membership and entity/topic pages are unchanged, and re-runs when a wiki is added or a content page is updated.
- **Gate 24.9:** Uncertain entity matches are written to `.state/proposed-cross-wiki-matches.json` and are not included in `entities.md` until reviewed.
- **Gate 24.10:** Entity context summarizer produces a deterministic/LLM summary per entity page and stores it in `.state/cross-wiki/entity-summaries.json`; the summary is included in the registry JSON and in the uncertain-review prompt.
- **Gate 24.11:** Relationship predicate normalizer groups semantically identical predicates into canonical forms and writes `.state/cross-wiki/predicate-map.json`; the relationship graph uses canonical predicates.
- **Gate 24.12:** Uncertain-review sub-step escalates cheap-model `uncertain` verdicts to the mid-tier model; `match` verdicts are added to the registry, remaining `uncertain` verdicts are isolated.
- **Gate 24.13:** Hypothesis signal generator reads the registry, normalized graph, and topic clusters and writes structured candidate signals to `.state/cross-wiki/proposed-signals.json`; signals contain no new factual claims beyond the source artifacts.
- **Gate 24.14:** Full key-less suite: the Phase 23 baseline plus the new Phase 24 tests, zero unenumerated regressions; `npx tsc --noEmit` clean.
- **Gate 24.15:** Cross-wiki preflight correctly skips the full pass when the workspace fingerprint is unchanged, runs the full pass when a relevant entity/topic page changes, and uses the optional cheap relevance probe to skip the pass for obviously local changes.

## 4. User Acceptance Tests (UAT)

- **UAT 24.1 (live, two-wiki workspace):** Ingest two wikis that share an entity (e.g., `rkkp-adhd` and `rkkp-afdk` both mention "Region Hovedstaden"). Open `wikis/cross-wiki/entities.md` and verify the entity appears once with path-qualified links to both wiki pages. Open each link and verify the underlying page cites its source PDF.
- **UAT 24.2 (live):** In the same workspace, open `wikis/cross-wiki/relationships.md` and verify that a relationship whose subject is cross-wiki appears, with path-qualified wikilinks to both subject and object pages.
- **UAT 24.3 (live):** Run a workspace with ≥2 wikis that share a concept (e.g., patient education), possibly in different output languages. Open `wikis/cross-wiki/topics/index.md`, pick a cluster that spans multiple wikis, open its page, and verify it contains only a neutral cluster description and a list of mapped topics with wikilinks — no unsourced factual claims.
- **UAT 24.4 (live failure fallback):** Simulate an LLM failure during the cross-wiki pass (e.g., invalid key) and verify the ingest still succeeds and per-wiki content is preserved.
- **UAT 24.5 (live):** After a fuzzy entity match, verify that an `uncertain` candidate appears in `.state/proposed-cross-wiki-matches.json` but not in `wikis/cross-wiki/entities.md`.
- **UAT 24.6 (live):** Verify that `wikis/cross-wiki/relationships.md` uses canonical predicates (e.g. one consistent form for "is CEO of") even when source wikis used different phrasing, and that `.state/cross-wiki/predicate-map.json` records the variant mapping.
- **UAT 24.7 (live):** In a workspace with ≥3 heterogeneous wikis (e.g. finance, environmental, parliamentary), inspect `.state/cross-wiki/proposed-signals.json` and verify it contains at least one structured signal that joins entities/relationships/topics across multiple wikis, with path-qualified evidence pointers and a confidence field.
- **UAT 24.8 (live):** Run two consecutive ingests on the same workspace with no cross-wiki-relevant changes. Verify that the second ingest skips the full cross-wiki pass (`.state/cross-wiki/run-fingerprint.json` is unchanged and no new LLM calls are made) while still completing successfully.

## 5. Approval Checklist

- [ ] All 15 gates pass; `npx tsc --noEmit` clean
- [ ] `templates/AGENTS.md` documents the new `cross-wiki-index` and `cross-wiki-topic` types (or confirms they are covered by the custom-type rule)
- [ ] Vision amendments recorded: `03_DOX_concept_detailed.md` §3.1/§4.1/§4.2/§6 (cross-wiki folder and workspace-index section), `04_orchestration_detailed.md` §1/§3.2 Step 10 (pipeline ordering), `05_page_types_specification.md` §9 (cross-wiki page types)
- [ ] `wikis/cross-wiki/` is created only when the workspace has ≥2 wikis
- [ ] Uncertain entity matches are isolated in `.state/proposed-cross-wiki-matches.json` and exposed to the downstream agent in `.state/cross-wiki/entity-match-candidates.json`
- [ ] Entity summaries, predicate map, and hypothesis signals are written to `.state/cross-wiki/`
- [ ] Cross-wiki preflight skips irrelevant ingests using deterministic fingerprint + optional cheap relevance probe
- [ ] Compliance log shows no unresolved contradictions; status file updated; DOX pass complete

## 6. Integration Notes

**Depends on:** Phase 6 (DOX Writer workspace pass), Phase 9 (AGENTS.md updater hook), Phase 14/21/22/23 (entity/topic/comparison page kinds and sticky curation).

**Produces:** `wikis/cross-wiki/` artifact tree; `.state/cross-wiki/*.json` mirrors (entity summaries, entity registry, predicate map, relationship graph, topic clusters, proposed signals); `.state/proposed-cross-wiki-matches.json`; `.state/cross-wiki/entity-match-candidates.json`; `cross-wiki-index` and `cross-wiki-topic` page types.

**Contract:** additive, read-only derived view; per-wiki pages are never edited by the cross-wiki pass; failures are logged and do not abort ingest; uncertain matches are held for human review.
