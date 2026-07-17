# prompts/ — DOX contract

## Purpose

LLM prompt files for the agent pipeline (Extractor, DOX Writer, Synthesis Writer). The Extractor prompt landed with Phase 2; the remaining agents' prompts arrive with their phases.

## Ownership

* `extractor.prompt.txt` — Phase 2: the Extractor's prompt. Fixed system instructions (8 extraction rules, entity page format, citation format per phase doc §2.1) + an explicit JSON-only OUTPUT FORMAT section (exact schema incl. the gates-2.9–2.12 extended fields `timeline`, `context`, `significance`, `disambiguation`) + runtime placeholders `{agentsMd}`, `{existingFolders}`, `{existingEntities}`, `{sourceFile}`, `{pageRange}`, `{chunkText}` substituted by `src/agents/extractor.ts`

## Local Contracts

* One prompt file per agent role, named `<agent>.prompt.txt`, created only by its implementing phase per the phase document
* Prompts are read by code in `src/`; keep them free of secrets and environment specifics
* Runtime placeholders use `{single-brace}` names (phase doc convention) — distinct from the `{{DOUBLE_BRACE}}` init-time placeholders in `templates/`; every placeholder must be substituted by the owning agent code before the call
* Prompt text must keep instructing: JSON-only output, folders only under `entities/`/`topics/` (max 3 levels below), lowercase kebab-case slugs, page numbers within the given range, empty chunk → empty arrays, and reuse of existing folders/entities from rolling memory — the Phase 2 gates depend on these behaviors

## Work Guidance

## Verification

* Phase 2 gates 2.1–2.12 in `tests/phase-02.test.ts` exercise this prompt live (self-skip without `ANTHROPIC_API_KEY`)

## Child DOX Index

No child folders.
