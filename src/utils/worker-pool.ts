/**
 * Phase 15 (vision `04` §1 concurrency note, user-ratified 2026-07-23;
 * optimizations.md L5): a bounded worker pool for the entity- and
 * topic-synthesis stages. Pages are independent of one another, so up to
 * `concurrency` pages are processed at once; everything else in the
 * pipeline (extraction, curation, DOX Writer, workspace pass, updater)
 * stays sequential.
 *
 * Contract:
 *  - Exactly `concurrency` workers pull from a shared index; a worker picks
 *    up the next item as soon as its current one settles. The in-flight
 *    count NEVER exceeds `concurrency`.
 *  - Results are returned in INPUT order regardless of completion order, so
 *    callers write reports deterministically.
 *  - A rejected item rejects the pool after the in-flight workers settle
 *    (fail-loud per the existing ingest error semantics — per-page quality
 *    failures are handled inside each page's own chain and do not reject;
 *    only infrastructure errors propagate). No new items are started after
 *    the failure.
 *  - Phase 16 (vision `04` §1 pool transport tuning, user-ratified
 *    2026-07-25): `staggerMs` spreads PICKUPS deterministically — pickup #n
 *    starts no earlier than n x staggerMs after the previous pickup, so a
 *    stage never fires `concurrency` large requests at the same instant.
 *    The stagger only delays dispatch; it never changes per-item semantics,
 *    the cap, ordering, or rejection behavior. Default 0 keeps the plain
 *    Phase 15 behavior for direct callers; `sleepFn` is the test seam for
 *    observing the stagger without wall-clock waiting.
 *  - No external dependency.
 */
export async function runPool<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  options: {
    concurrency: number;
    /** Phase 16: deterministic delay between worker pickups (0 = none). */
    staggerMs?: number;
    /** Phase 16 test seam: replace the stagger sleeper (never in production). */
    sleepFn?: (ms: number) => Promise<void>;
  },
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let failed = false;
  let failure: unknown;

  const staggerMs = options.staggerMs ?? 0;
  const sleepFn =
    options.sleepFn ?? ((ms: number) => new Promise<void>((resolvePromise) => setTimeout(resolvePromise, ms)));
  // Pickup slot chain: each pickup reserves the NEXT slot before awaiting its
  // own, so pickups dispatch one stagger apart in index order regardless of
  // how many workers are waiting. The trailing slot is never awaited by the
  // pool itself, so the pool never lingers after the last pickup.
  let slot: Promise<void> = Promise.resolve();

  const workerLoop = async (): Promise<void> => {
    while (!failed) {
      if (staggerMs > 0) {
        const current = slot;
        slot = current.then(() => sleepFn(staggerMs));
        await current;
        if (failed) {
          return;
        }
      }
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
        return;
      }
    }
  };

  const workerCount = Math.max(1, Math.min(options.concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => workerLoop()));
  if (failed) {
    throw failure;
  }
  return results;
}
