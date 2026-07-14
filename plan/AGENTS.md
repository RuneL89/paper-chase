# plan/ — Plans and Implementation Tracker

## Purpose

This folder contains sprint plans, implementation trackers, UAT documents, and other planning artifacts.

## Ownership

- **Human user** owns sprint priorities and acceptance criteria.
- **LLM agents** draft plan documents based on user direction and update trackers as work is completed.
- Deterministic code does not own plan documents.

## Local Contracts

- `plan/SPRINT_INSTRUCTIONS.md` is the active sprint tracker.
- `plan/e2e-prompt.md` is the canonical two-phase E2E verification prompt. It is a UAT artifact that must be followed during E2E runs.
- During E2E / verification runs, the only plan documents that may be modified are the E2E artifacts: `plan/e2e-bug-report.md` and `plan/fix-suggestions.md`. All other plan documents should not be modified during a run; report findings in the conversation instead.
- UAT documents should be standalone and testable.
- Completed plans should be marked or archived, not deleted, unless the user requests removal.

## Work Guidance

- When starting a new sprint, read `plan/SPRINT_INSTRUCTIONS.md`.
- When finishing a feature, update the relevant plan/UAT document to reflect the current state.
- When creating a UAT, make it independent of the implementation details so a human can run it.

## Verification

- Plan documents are checked by human review.
- UAT documents are validated by manual or automated runs described inside them.

## Child DOX Index

No nested child docs needed.
