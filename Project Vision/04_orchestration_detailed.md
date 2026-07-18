# LLM Wiki CLI — Orchestration (Detailed)

This document explains how the LLM Wiki CLI orchestrates the `ingest` flow. It is written for someone with no prior knowledge of the project, so they can understand exactly what happens to a PDF from the moment it enters the system until it becomes part of the wiki.

---

## 1. The Pipeline

The orchestrator is not a distributed system of 7 agents. It is a **five-layer pipeline** with two LLM calls per chunk (Extractor and optional Synthesis Writer) and one LLM pass at the end (DOX Writer). The optional Synthesis Writer may rewrite entity, topic, and document pages.

```
PDF → Chunker → Layer 1 (Raw Pages) → Layer 2 (Extractor) → Layer 3 (Materializer) → Layer 4 (Synthesis Writer) → Layer 5 (DOX Writer)
```

The local deterministic code handles the boring parts: reading files, extracting text, computing hashes, writing files, validating schemas, and checking links. The LLM handles the thinking parts: extraction, classification, synthesis, and writing navigation contracts.

---

## 2. Before Anything: `init`

Before the pipeline runs, the user creates a wiki with the `init <slug>` command. This command:

- Creates the workspace and wiki folders.
- Creates an empty `raw/` folder for the PDFs.
- Creates the top-level folders: `documents/`, `sources/`, `entities/`, `topics/`.
- Creates `.state/` for internal tracking.
- Copies `templates/AGENTS.md` to `wikis/<slug>/AGENTS.md`.
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

After all chunks are extracted, the **Materializer** reads all `.state/extracted/*.json` files and writes or updates pages:

1. **Create folders:** For each entity, create the folder path (including intermediate folders) if it does not exist.
2. **Aggregate data:** For each unique entity slug, collect all mentions, relationships, and claims across all chunks.
3. **Write entity pages:** For new entities, create the page. For existing entities, load the current page, merge new data, and rewrite.
4. **Write topic pages:** Group claims by type and create/update topic pages.
5. **Update rolling memory:** Add new entities, folders, and sources.

**Update Mode:**
When an entity page already exists:
- Load the existing page.
- Merge new mentions, relationships, and claims.
- If the page has been manually edited (hash mismatch with `.state/ingestion.json`), skip the update and log a conflict.
- Otherwise, rewrite the page with the merged data.

**Preservation Check:**
After writing an updated page, verify that every existing citation (`[^srcN]`) and every existing wikilink is still present. If the check fails, log the conflict and skip the update.

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

This step is opt-in (`ingest --synthesis`).

#### Step 10: Write DOX Contracts (Layer 5)

After all content pages are finalized, the **DOX Writer** runs:

1. Scan the entire wiki tree.
2. For each folder and the wiki root, read the folder contents, `AGENTS.md`, and rolling memory.
3. Call the LLM once per folder with a structured prompt to write a rich `index.md`.
4. Verify that the LLM-generated `index.md` uses the exact children list and statistics supplied by deterministic code.
5. Write the final `index.md` files.
6. Run a final validation pass over the entire wiki, including the new DOX pages.

This is an LLM-driven step. It produces the navigation contracts that describe the finalized wiki.

#### Step 11: Update State

Write `.state/ingestion.json` and `.state/rolling-memory.json` for the next run.

---

## 4. The Synthesis Writer (Layer 4, Phase 5+)

After the core content pages are validated, the optional **Synthesis Writer** turns structured entity, topic, and document pages into readable two-layer pages:

**Input:** The structured data for one entity, topic, or document page (e.g., mentions, relationships, claims, timeline, context, significance, disambiguation, or extracted chunk text).
**Output:** A readable markdown page with synthesis at the top and preserved detail below.

The Synthesis Writer runs per entity page after the Materializer has aggregated the data. It replaces the structured template with LLM-written prose, but only if the preservation check confirms that no data was dropped.

**Preservation Check:** After the Writer returns a page, verify that every mention, relationship, and claim from the structured data still exists in the written page. If the check fails, reject the output and keep the structured template.

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

If any check fails, the error is logged. The system does not retry. The user fixes the prompt or the PDF and re-runs `ingest`.

---

## 7. Who Decides What

| Decision | Authority | Mechanism |
|---|---|---|
| High-level wiki purpose | LLM | Inferred from corpus content during ingestion |
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

7. **User opens the wiki in Obsidian.** They see a folder structure with politicians, donors, and parties that the LLM created based on the actual content. They click `[[Senator X]]` and see every donation mentioned in the PDF, with citations to exact pages.

8. **User adds a second PDF and runs `ingest` again.** The system skips the first PDF (hash unchanged) and processes the second. New entities are added. Existing entity pages are updated with new mentions. The Synthesis Writer (if enabled) and the DOX Writer regenerate their outputs. The AGENTS.md updater (if enabled) proposes updates to `AGENTS.md` based on the newly discovered structure.
