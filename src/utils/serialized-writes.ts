/**
 * Phase 15 (vision `04` §1 concurrency note, user-ratified 2026-07-23;
 * optimizations.md L5 "shared state files funnel through a single
 * serialized writer"): a per-process serialized write queue — one promise
 * chain per file path. With the synthesis pool running 4 workers, the
 * shared state files would otherwise race: `.state/llm-calls.json` JSONL
 * appends could interleave/tear, and `.state/conflicts.json`
 * read-modify-write appends could lose entries. Funnelling every write
 * through the chain for its path keeps each JSONL line whole (ordered by
 * completion) and each conflicts append atomic. This is the ONE shared
 * mechanism — the LLM client's log writer and the conflicts writer both
 * enqueue here.
 */

const chains = new Map<string, Promise<void>>();

/**
 * Run `task` after every previously-enqueued task for `key` (the file path)
 * has settled. Tasks for the same key run one at a time in enqueue order;
 * tasks for different keys run independently. A task's rejection propagates
 * to its own caller but never breaks the chain for later tasks.
 */
export function enqueueSerializedWrite<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = chains.get(key) ?? Promise.resolve();
  const run = previous.then(() => task());
  chains.set(
    key,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}
