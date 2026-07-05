# Sprint 8 — Ingest Orchestrator & Dynamic Hierarchy

## Goal
Implement the full ingestion orchestrator. The LLM ingests the PDF one chunk at a time, guided by the wiki-level and folder-level `index.md` contracts. It creates and updates markdown pages in a dynamic deep hierarchy, preserving all relevant details so small connections can be found by a journalist or research AI.

## Acceptance Criteria
1. The `ingest` command runs the orchestrator over the entire document chunk by chunk.
2. Each chunk is processed by the seven sub-agents with rolling memory.
3. The Critic sub-agent reviews the output before deterministic and schema validation.
4. New pages are created in the dynamic hierarchy determined by the sample phase.
5. Existing pages are updated with new evidence/mentions; no detail is lost.
6. Each markdown page has frontmatter with `type: "page"`, `wiki`, `source`, `chunk`, `updated`, and related tags.
7. Page content includes source citations and links to related entities/topics.
8. If the structure needs to change, the orchestrator pauses and proposes the change with pros/cons; accepted changes restart ingestion.
9. On restart, rolling memory is reconstructed from existing pages.

## Technical Gate
- `tsc --noEmit` passes.
- `npm test` passes.
- Ingest command completes on a test PDF without errors.
- Deterministic validation checks that no required frontmatter is missing.

## Validation Gate
- Reviewer confirms pages are citation-backed and linkable.
- Reviewer confirms dynamic hierarchy is deeper than a flat list and has folder-level index.md files.
- Reviewer confirms restart preserves existing data and updates it correctly.

## Files to Create/Modify
- `src/orchestrator/ingest.ts` (new)
- `src/orchestrator/validation.ts` (new)
- `src/commands/ingest.ts` (modify)
- `src/commands/ingest-all.ts` (modify)
- `plan/sprint-8/NOTES.md` (new)

## Dependencies
- Sprint 7 complete
- Chunking system
- Custom orchestrator skill

## Implementation Notes
- Rolling memory reconstruction: scan existing wiki pages and summarize them into the rolling memory state.
- Restart ingestion from the beginning of the document; the rolling memory will prevent duplicate work by recognizing already-processed chunks.
- Keep all original data: the markdown is the source of truth; no external DB is required.
