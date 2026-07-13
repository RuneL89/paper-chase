# plan/ — Plans and Implementation Tracker

## Purpose

This folder contains sprint plans, implementation trackers, UAT documents, and other planning artifacts.

## Ownership

- **Human user** owns sprint priorities and acceptance criteria.
- **LLM agents** draft plan documents based on user direction and update trackers as work is completed.
- Deterministic code does not own plan documents.

## Local Contracts

- `plan/SPRINT_INSTRUCTIONS.md` is the active sprint tracker.
- UAT documents should be standalone and testable.
- Do not modify plan documents during E2E / verification runs; report findings in the conversation instead.
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
