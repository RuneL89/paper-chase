# docs/ — User Documentation

## Purpose

User-facing documentation for the LLM Wiki CLI: quickstart guides, command references, and usage examples.

## Ownership

- **LLM agents** draft user-facing content based on the current CLI behavior.
- **Human user** reviews and approves high-level messaging and examples.
- Deterministic code does not own docs content.

## Local Contracts

- Docs must match the actual CLI commands and flags in `src/cli.ts`.
- Code examples in docs should be runnable without modification.
- Do not document features that do not exist yet.
- Keep docs synchronized with changes to commands or workspace layout.

## Work Guidance

- Update `docs/QUICKSTART.md` when onboarding steps change.
- Update `docs/USAGE.md` when command syntax or options change.
- Update `README.md` for high-level project changes.
- After a docs change, run the CLI manually or via tests to ensure examples still work.

## Verification

- Manual review of examples against the current CLI.
- No separate build step; docs are plain markdown.

## Child DOX Index

No nested child docs needed.
