# Plan: Real Phase 21–23 ingestion on the three wikis using Kimi K2.7 as the project LLM, monitored in-session

## Why this replaces the subagent bridge
Real model calls through the real `callLLM` path: the Phase 21 curation judgments, Phase 23 extractor tables, and Phase 22/23 composite/comparison synthesis all happen naturally — no queue protocol, no answer generators, no watcher misrouting fix, no pre-validation scaffolding. Monitoring in this session replaces the abort/fix role I had in the bridge run.

## Step 0 — Key + endpoint smoke test (before touching anything else)
- Validate the provided key with zero-spend calls: `GET https://api.moonshot.cn/v1/models` (fallback: `api.moonshot.ai`) with the key as a Bearer token — confirms auth and lists the exact available model ids (find the real `kimi-k2.7*` id).
- Then one minimal chat completion (`max_tokens: 16`, "reply with OK") to confirm chat completions work and to see whether the endpoint accepts/rejects `max_completion_tokens` (determines the patch shape).
- Key handling: used only via env var / gitignored `.paper-chase.json`; never printed, never logged, never committed. User will delete the key after the test.
- If the key/endpoint fails, STOP and report — nothing else changes.

## Step 1 — Minimal client patch (`src/llm/client.ts` only)
- Add an `OPENAI_BASE_URL` env override for the OpenAI-compatible endpoint (default stays `https://api.openai.com/v1/chat/completions` — byte-identical behavior when unset).
- When the override is active, send `max_tokens` instead of `max_completion_tokens` (Moonshot schema), keeping the GPT-5.6 path untouched.
- Keep pricing fallback (unknown model id → default price row; cost figures in `llm-calls.json` will be estimates — noted, not a blocker).
- Run `npx tsc --noEmit` + the llm-client tests to prove no regression.

## Step 2 — Configure the sandbox workspace
- Write `.state/upgrade/sandbox/.paper-chase.json` (gitignored): provider `openai`, all four model slots (`default`, `extractor`, `synthesis`, `dox`, `curation`) set to the verified Kimi model id, `apiKeys.openai` = the provided key. Export `OPENAI_BASE_URL` for the run.
- Safety backup: copy the three sandbox wikis to `.state/upgrade/backups-pre-kimi/` for rollback.

## Step 3 — Pilot run: rkkp-danibd (smallest)
- Run headless: `npx tsx src/cli.ts ingest rkkp-danibd --workspace .state/upgrade/sandbox` as a background task with output teed to a log; no `callLLM` spy — the real pipeline.
- Monitor in-session: tail the log; watch `.state/llm-calls.json` grow (call types, token counts, cost); watch for the curation report (confirmed clusters), `type: composite` pages, and `comparisons/` pages appearing.
- Standing directive honored: if anything looks like pollution (validator blowups, repeated preservation/template fallbacks, cost runaway), abort the run, diagnose, fix, restart — ingest is resumable via the synthesis-state checkpoints.
- After ingest: run `verify`, then `repair-wiki-pages.mts`, then re-verify. Gate: `type: composite` pages > 0, `comparisons/` with `type: comparison` pages > 0, validators clean.

## Step 4 — rkkp-afdk and rkkp-adhd
- Same headless ingest + monitor + verify + repair per wiki (afdk is the largest — expect the bulk of the time/cost here; the 2026-07-28 live run took ~1h/wiki at pool size 4).

## Step 5 — Sync, compare, close out
- Sync verified sandbox wikis to `dist/wikis/`, repair + re-verify both copies.
- Re-run the comparison scripts: confirm the wikis now reflect the Phase 21–23 intended change (composite pages, comparison articles, confirmed-cluster curation reports) vs the pre-upgrade backups.
- Update `.state/upgrade/FINAL_REPORT.md` (per-wiki results, real LLM call counts/cost from `llm-calls.json`, validator diffs), append a `.state/compliance-log.md` entry, DOX pass on `.state/AGENTS.md`.

## Explicitly reported to the user at the end
- Total real Kimi calls and estimated cost per wiki (from `llm-calls.json`).
- Feature checklist: composite pages, comparison articles, confirmed clusters — per wiki.
- Validator status for sandbox + dist.
- Reminder to delete the API key.