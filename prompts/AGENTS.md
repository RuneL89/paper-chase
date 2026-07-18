# prompts/ — DOX contract

## Purpose

LLM prompt files for the agent pipeline (Extractor, Synthesis Writer, DOX Writer). The Extractor prompt landed with Phase 2, the Synthesis Writer prompts with Phase 5, and the DOX Writer prompt with Phase 6.

## Ownership

* `extractor.prompt.txt` — Phase 2: the Extractor's prompt. Fixed system instructions (8 extraction rules, entity page format, citation format per phase doc §2.1) + an explicit JSON-only OUTPUT FORMAT section (exact schema incl. the gates-2.9–2.12 extended fields `timeline`, `context`, `significance`, `disambiguation`) + runtime placeholders `{agentsMd}`, `{existingFolders}`, `{existingEntities}`, `{sourceFile}`, `{pageRange}`, `{chunkText}` substituted by `src/agents/extractor.ts`
* `synthesis.prompt.txt` — Phase 5: the strict entity Synthesis Writer's prompt. System instructions for writing a two-layer markdown article (readable synthesis + preserved detail sections) where every mention context, relationship evidence, and claim text appears verbatim in the output + runtime placeholders `{entityName}`, `{entityType}`, `{significance}`, `{disambiguation}`, `{mentions}`, `{relationships}`, `{claims}`, `{timeline}`, `{context}` substituted by `src/agents/synthesis.ts`; the wiki constitution `{agentsMd}` is appended by the agent before calling the LLM
* `synthesis-permissive.prompt.txt` — Phase 5 (UAT refinement): the permissive entity Synthesis Writer fallback prompt. Used for dense entities where strict synthesis fails preservation; the model may summarize in Layer 1 but must preserve the exact mention contexts, relationship evidence, and claim text verbatim in the structured Layer 2 sections
* `synthesis-topic.prompt.txt` — Phase 5: the strict topic Synthesis Writer prompt. System instructions for a two-layer topic article with readable synthesis at the top and verbatim `## Claims` / `## Sources` sections below + runtime placeholders `{topicName}`, `{entities}`, `{claims}`, `{sources}`, `{context}` substituted by `src/agents/synthesis.ts`; the wiki constitution is appended by the agent
* `synthesis-topic-permissive.prompt.txt` — Phase 5: the permissive topic Synthesis Writer fallback prompt. The model may summarize in Layer 1 but must preserve the exact claim text verbatim in the `## Claims` section
* `dox-writer.prompt.txt` — Phase 6: the DOX Writer's prompt, loaded and filled by `src/dox-writer.ts` and sent once per folder plus the wiki root. Explains the DOX Writer role (map, not territory), gives the exact output format (YAML frontmatter + body: title heading, rich description, `## Pages` + `## Navigation` for folders or `## Start Here` for the root, `## Statistics`), instructs verbatim use of the supplied children list and statistics, requires following the supplied wiki AGENTS.md writing rules (plain language, journalist test, no invented facts, `[[Page Title]]` wikilinks only for pages that exist), and shows one folder-level and one wiki-level example (phase doc §3.3/§3.4). Runtime placeholders: `{wikiSlug}`, `{folderPath}` (`(root)` for the wiki root), `{folderTitle}`, `{children}`, `{subFolders}`, `{pages}`, `{navigation}`, `{statistics}`, `{pageContents}`, `{agentsMd}`, `{rollingMemory}`. Deterministic enforcement in `src/dox-writer.ts` always discards the returned frontmatter and replaces the `## Statistics` section, so the prompt's prose quality matters but its frontmatter/counts are never trusted

## Local Contracts

* One prompt file per agent role, named `<agent>.prompt.txt`, created only by its implementing phase per the phase document
* Prompts are read by code in `src/`; keep them free of secrets and environment specifics
* Runtime placeholders use `{single-brace}` names (phase doc convention) — distinct from the `{{DOUBLE_BRACE}}` init-time placeholders in `templates/`; every placeholder must be substituted by the owning agent code before the call
* Prompt text must keep instructing: JSON-only output, folders only under `entities/`/`topics/` (max 3 levels below), lowercase kebab-case slugs, page numbers within the given range, empty chunk → empty arrays, and reuse of existing folders/entities from rolling memory — the Phase 2 gates depend on these behaviors

## Work Guidance

## Verification

* Phase 2 gates 2.1–2.12 in `tests/phase-02.test.ts` exercise this prompt live (self-skip without `ANTHROPIC_API_KEY`)
* Phase 5 gates 5.1–5.4 in `tests/phase-05.test.ts` exercise the synthesis prompt with a mocked `callLLM` or live when an API key is present
* Phase 6 gates 6.7–6.8 in `tests/phase-06.test.ts` exercise the DOX Writer's LLM path with an injected `writeDoxIndexFn` stub (LLM-free); the prompt file itself is only read on live runs

## Child DOX Index

No child folders.
