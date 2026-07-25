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
 *  - No external dependency.
 */
export async function runPool<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  options: { concurrency: number },
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let failed = false;
  let failure: unknown;

  const workerLoop = async (): Promise<void> => {
    while (!failed) {
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
