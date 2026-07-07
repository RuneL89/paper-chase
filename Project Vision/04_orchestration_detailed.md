# LLM Wiki CLI — Agent Orchestration (Detailed)

This document explains how the LLM Wiki CLI orchestrates the `sample` and `ingest` flows. It is written for someone with no prior knowledge of the project, so they can understand exactly what happens to a PDF from the moment it enters the system until it becomes part of the wiki.

---

## 1. What the Orchestrator Is

The **orchestrator** is the brain of the LLM Wiki CLI. It is not a single function; it is a pipeline of seven specialized sub-agents that run in sequence. The orchestrator decides what pages to create, what those pages should say, how they should link to each other, and whether the output is good enough to keep.

The seven sub-agents are:

1. **StructureAnalyst**
2. **EntityExtractor**
3. **RelationshipExtractor**
4. **EvidenceCollector**
5. **PagePlanner**
6. **ChunkWriter**
7. **Critic**

The orchestrator runs during both the `sample` command and the `ingest` command. The difference is what each command is trying to achieve:

- **`sample`** discovers the shape of the wiki: the folder structure, the page types, the conventions, and the initial `AGENTS.md`.
- **`ingest`** processes the full corpus (or the changed parts) and writes or updates the actual wiki pages.

The local deterministic code handles the boring parts: reading files from disk, extracting text with `pdfjs-dist`, computing SHA-256 hashes, writing files, validating schemas, and checking links. The orchestrator handles the thinking parts.

---

## 2. Before Anything: `init`

Before the orchestrator runs, the user creates a wiki with the `init <slug>` command. This command:

- Creates the workspace and wiki folders.
- Creates an empty `raw/` folder for the PDFs.
- Writes a skeleton `AGENTS.md` file with the user's high-level description of the wiki.
- Creates a skeleton wiki-level `index.md`.

`init` does not call the LLM. It just sets up the workspace. The user then copies PDFs into `raw/` and runs `sample`.

---

## 3. The `sample` Command: Discovering the Wiki

The `sample` command is the first time the LLM sees the corpus. Its job is to understand the documents and plan the wiki. The output of `sample` is:

- A folder structure for the wiki.
- A set of default page types and, optionally, new page types discovered from the corpus.
- A set of naming conventions and citation rules.
- An updated `AGENTS.md` that encodes the discovered conventions.
- A wiki-level `index.md` and folder-level `index.md` contracts.
- Optionally, draft content pages for the sampled portions.

### 3.1 Step-by-Step Sampling Flow

#### Step 1: Read `AGENTS.md`

The orchestrator first reads the current `AGENTS.md`. At this point, it is usually a skeleton with the user's high-level intent. The LLM uses it as context but does not treat it as fixed law yet; it will be updated based on what the corpus actually contains.

#### Step 2: Classify the Documents

The orchestrator analyzes the PDFs in `raw/` and classifies them into categories:

- **Single very large document** (e.g., a 2,000-page leak).
- **Collection of similar, manageable-sized documents** (e.g., annual reports).
- **Collection of similar but very large documents** (e.g., yearly donation filings).
- **Mixed corpus** (a combination of the above).

If the corpus is mixed, the orchestrator applies a different sampling strategy to each group.

#### Step 3: Apply the Sampling Strategy

The sampling strategy depends on the document category:

| Category | Strategy |
|---|---|
| Single very large document | Look for a Table of Contents in the first 50 pages. If found, use it. If not, perform a full read of the document in chunks. |
| Similar, manageable-sized documents | Read one document fully, then sample a subset of pages from each remaining document. |
| Similar but very large documents | Read the first document fully to create the strategy, then process the rest with `ingest`. |
| Mixed corpus | Classify each document and apply the appropriate strategy per group. |

#### Step 4: Run the Sub-Agents on the Sample

For the sampled material, the orchestrator runs the seven sub-agents in order:

1. **StructureAnalyst** — identifies headings, sections, tables, figures, and page boundaries.
2. **EntityExtractor** — extracts people, organizations, companies, locations, and other named entities.
3. **RelationshipExtractor** — identifies relationships between entities (e.g., "John Smith is the CEO of Acme Corp").
4. **EvidenceCollector** — collects claims, numbers, dates, and other evidence, each with its source location.
5. **PagePlanner** — proposes the folder structure, page types, and page plans based on what was found.
6. **ChunkWriter** — drafts the initial markdown pages and the `index.md` contracts.
7. **Critic** — reviews the drafted pages and plans for quality, consistency, and completeness. If issues are found, the Critic blocks and the sample is reprocessed with feedback.

#### Step 5: Handle Structural Change Proposals

If the PagePlanner proposes a folder structure that does not match the existing skeleton, the orchestrator must get human approval. The proposal includes:

- The reason for the change.
- The affected pages and folders.
- The proposed new structure.
- Pros and cons.
- Required contract updates.

For simple changes, the CLI asks the user interactively. For complex changes, the proposal is written to a file (e.g., `.kimi-code/proposals/`) for later review. If the user rejects the proposal, the orchestrator falls back to the existing structure. If accepted, the new structure is used and the contracts are updated.

#### Step 6: Write the Contracts and `AGENTS.md`

Once the structure is approved, the orchestrator writes:

- The wiki-level `index.md`.
- The folder-level `index.md` files.
- The updated `AGENTS.md` with the discovered conventions.
- Optionally, draft content pages for the sampled material.

The `sample` command ends here. The user can now review the structure and `AGENTS.md` before running `ingest`.

---

## 4. The `ingest` Command: Building the Wiki

The `ingest` command is the main workhorse. It processes the PDFs in chunks and writes or updates the wiki pages. It uses the structure and conventions discovered during `sample`.

### 4.1 Incremental Ingestion

`ingest` is incremental. It tracks every PDF by SHA-256 hash:

- **New PDFs** are processed in full.
- **Changed PDFs** are re-processed and their derived pages are updated.
- **Removed PDFs** cause their derived pages to be marked as stale or removed.
- **Unchanged PDFs** are skipped.

This makes re-running `ingest` efficient and ensures the wiki compounds over time.

### 4.2 Step-by-Step Ingestion Flow

#### Step 1: Read `AGENTS.md` and the Current State

The orchestrator reads the current `AGENTS.md` (the schema/system prompt for the LLM) and the rolling memory state (if this is a continuation of a previous run). This ensures the LLM follows the latest conventions and knows what pages already exist.

#### Step 2: Select the PDFs to Process

Using SHA-256 hashes, the orchestrator determines which PDFs need to be processed. It skips unchanged PDFs.

#### Step 3: Chunk the PDFs

Each PDF is split into **page-based chunks**. A chunk is one or more consecutive pages that fit within the configured LLM context window. The system never splits a page, table, or figure across chunks. If a document is large, it becomes a sequence of chunks.

#### Step 4: Run the Sub-Agents on Each Chunk

For each chunk, the orchestrator runs the seven sub-agents in order:

##### 4.4.1 StructureAnalyst

**Purpose:** Understand the structure of the chunk.

**What it does:**

- Identifies headings and section boundaries.
- Detects tables and their structures.
- Detects figures and images.
- Notes page numbers and source locations.

**Output:** A structured description of the chunk, including headings, tables, figures, and page ranges.

##### 4.4.2 EntityExtractor

**Purpose:** Find all named entities in the chunk.

**What it does:**

- Extracts names of people, organizations, companies, locations, products, and other named objects.
- Normalizes names where possible.
- Checks the rolling memory to see if an entity already has a canonical page.

**Output:** A list of extracted entities with their types, normalized names, and locations in the source.

##### 4.4.3 RelationshipExtractor

**Purpose:** Find relationships between entities.

**What it does:**

- Identifies co-occurrences and explicit relationships (e.g., "X is the CEO of Y").
- Records the source location of each relationship.
- Checks the rolling memory to see if the relationship is new or already known.

**Output:** A list of relationships between entities, with evidence and citations.

##### 4.4.4 EvidenceCollector

**Purpose:** Collect claims and facts.

**What it does:**

- Extracts specific claims, numbers, dates, and quotes.
- Records the source location of each piece of evidence.
- Groups related evidence together.

**Output:** A list of claims and evidence items, each with a citation.

##### 4.4.5 PagePlanner

**Purpose:** Decide what pages to create or update.

**What it does:**

- Reads the output of the previous agents.
- Reads the current `AGENTS.md` and the rolling memory.
- Decides which existing pages should be updated with new evidence.
- Decides which new pages should be created.
- Decides where each page belongs in the folder structure.
- Proposes new page types if the corpus demands them (auto-approved inside existing folders).
- Proposes new folders if the existing structure cannot accommodate the corpus (requires human approval).

**Output:** A page plan listing every page to create or update, with its type, folder, and source material.

##### 4.4.6 ChunkWriter

**Purpose:** Write the actual markdown content.

**What it does:**

- Receives the page plan and all extracted material.
- Writes the markdown body of each page, including:
  - LLM-written synthesis and summaries.
  - Faithful transcription of extracted text, tables, and figures.
  - Inline citations (`[^srcN]`).
  - Wikilinks to related pages.
- Updates existing pages by appending new evidence and mentions without losing existing detail.
- Updates the `index.md` contracts to include new pages and page types.

**Output:** A set of markdown files (new pages and updated pages) with valid YAML frontmatter.

##### 4.4.7 Critic

**Purpose:** Review the output before it is committed.

**What it does:**

- Reviews the LLM-written pages for quality, consistency, and completeness.
- Checks that every factual claim has a citation.
- Checks that tables and figures are preserved.
- Checks that links are sensible.
- Checks that the page plan was followed.
- If blocking issues are found, it halts the pipeline and sends feedback to the ChunkWriter (and earlier agents if needed) for reprocessing.

**Output:** A review result. If approved, the pipeline continues. If issues are found, the chunk is reprocessed.

#### Step 5: Deterministic Validation

After the Critic approves, the local deterministic code runs additional checks:

1. **Completeness check** — Compare the LLM-written pages against the extracted input to ensure no text, table, or figure was dropped or materially altered.
2. **Link check** — Verify that all `[[Page Name]]` wikilinks point to existing pages.
3. **Citation check** — Verify that every `[^srcN]` maps to a valid source entry in the frontmatter, and that the source PDF exists.
4. **Schema check** — Verify that every page has valid YAML frontmatter with the required fields.

If any check fails, the orchestrator is notified and the chunk is reprocessed.

#### Step 6: Update Rolling Memory

After the chunk is validated, the orchestrator updates the rolling memory:

- The compressed natural-language summary is updated with what the chunk contained.
- The structured state object is updated with new pages, entities, relationships, evidence, and source hashes.
- The rolling memory is persisted to disk so the next chunk (or the next `ingest` run) can start from it.

#### Step 7: Write the Pages and Contracts

Finally, the orchestrator writes the updated pages to disk:

- Content pages (`document`, `entity`, `topic`, etc.).
- Source pages.
- Raw pages.
- Wiki-level and folder-level `index.md` contracts.
- Updated `AGENTS.md` if conventions changed.

#### Step 8: Move to the Next Chunk

The orchestrator repeats Steps 4–7 for the next chunk. Because rolling memory is persisted, each chunk knows what has already been discovered and written.

### 4.3 After `ingest` Finishes

When all chunks are processed, the orchestrator writes the final state and updates the `index-of-indexes.md` if this is a multi-wiki workspace. The wiki now contains all extracted material from the processed PDFs, organized into pages, linked, and cited.

---

## 5. Rolling Memory: How the Orchestrator Remembers

Because PDFs can be large and because `ingest` is incremental, the orchestrator needs to remember what it has already seen. This is done through **rolling memory**.

Rolling memory has two parts:

1. **Compressed natural-language summary** — A short text passed to the LLM as context. It describes the corpus so far: what pages exist, what entities are important, what themes have been found, and what the overall structure is.
2. **Structured state object** — A machine-readable record persisted to disk. It contains:
   - A list of all pages.
   - A list of all entities with their canonical pages and mention counts.
   - A list of relationships between entities.
   - A list of claims and evidence.
   - A map of source PDFs to their SHA-256 hashes and derived pages.

When the orchestrator starts a new chunk, it reads the rolling memory. When it finishes a chunk, it updates the rolling memory. This allows the system to handle very large documents and to resume or re-run ingestion efficiently.

---

## 6. What the Sub-Agents Produce and Consume

| Sub-Agent | Input | Output | Decides |
|---|---|---|---|
| **StructureAnalyst** | Extracted chunk text + metadata | Headings, tables, figures, page ranges | What the chunk looks like structurally. |
| **EntityExtractor** | Chunk text + rolling memory | List of entities and mentions | What named things appear in this chunk. |
| **RelationshipExtractor** | Entities + chunk text | Relationships between entities | How entities are connected. |
| **EvidenceCollector** | Chunk text + entities | Claims and evidence with citations | What facts are asserted and where they come from. |
| **PagePlanner** | All previous outputs + `AGENTS.md` + rolling memory | Page plan (new pages, updates, folders) | What pages should exist and where they go. |
| **ChunkWriter** | Page plan + all extracted material | Markdown pages with frontmatter and citations | What each page says and how it links to others. |
| **Critic** | LLM-written pages + page plan | Approval or list of blocking issues | Whether the output is good enough to keep. |

---

## 7. Who Decides What

A common question is: who is in charge at each step? Here is the division of authority:

- **The user (human)** decides:
  - The high-level purpose of the wiki (via `init` and `AGENTS.md`).
  - Which PDFs are in the corpus (by placing them in `raw/`).
  - Whether to approve structural changes that create new folders or modify the wiki organization.
  - When to run `sample`, `ingest`, or other commands.

- **The LLM orchestrator** decides:
  - The exact folder structure and page types.
  - The content of every page.
  - Which entities, relationships, and evidence to extract.
  - How to link pages and cite sources.
  - Whether a new page type is needed inside an existing folder.
  - Whether to reprocess a chunk based on the Critic's feedback.

- **Local deterministic code** decides:
  - How to extract text from PDFs.
  - How to compute hashes and track incremental changes.
  - Whether links, citations, and schemas are valid.
  - Whether the LLM-written pages preserve all extracted detail.

- **The Critic** decides:
  - Whether the LLM-written pages are good enough to commit.
  - Whether to block the pipeline and request reprocessing.

---

## 8. Example Walkthrough: One PDF

To make this concrete, here is what happens to a single 100-page PDF of political-donation filings.

1. **User runs `sample`.** The orchestrator classifies this as a "similar, manageable-sized document" and reads it in full (because it is the first document of its type). It runs the seven sub-agents, discovers the structure, and creates folders like `donors/`, `recipients/`, and `donations/`. It writes `AGENTS.md` and the `index.md` contracts.

2. **User runs `ingest`.** The orchestrator sees this PDF is new and processes it. It splits the PDF into chunks of, say, 10 pages each.

3. **Chunk 1 (pages 1–10).** The StructureAnalyst finds the table of contents and introduction. The EntityExtractor finds names of politicians and parties. The RelationshipExtractor finds that "Party X received donations from donors Y and Z." The EvidenceCollector records the donation amounts. The PagePlanner decides to create or update pages for Party X, donors Y and Z, and a topic page for "2024 Election Donations." The ChunkWriter drafts those pages. The Critic reviews them and approves. Deterministic checks confirm no detail was lost. Rolling memory is updated.

4. **Chunk 2 (pages 11–20).** The orchestrator reads the updated rolling memory. It finds more donors, some of whom already have pages from Chunk 1. The PagePlanner updates those existing pages with new mentions. The ChunkWriter appends the new evidence without losing the old. The Critic approves. Rolling memory is updated again.

5. **Repeat** for chunks 3–10.

6. **After all chunks.** The source page for the PDF is updated with its hash, page count, and warnings. The `index.md` contracts are updated to include the new pages. The user can now open the wiki and navigate from the donor to the recipient to the source PDF.

---

## 9. Summary

The orchestrator is a pipeline of seven sub-agents that turns raw PDFs into a structured wiki. The `sample` command discovers the wiki's shape; the `ingest` command fills it with content. At every step, the LLM is the author, the human is the curator, and the deterministic code is the quality checker. Rolling memory carries context across chunks, and the Critic ensures that only good output is committed. The result is a compounding, citation-backed knowledge base that a journalist or research agent can navigate without re-reading the original documents.
