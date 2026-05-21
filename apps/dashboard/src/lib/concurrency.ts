/**
 * Run an async `worker` over `items` with a bounded number of concurrent
 * in-flight calls, returning settled results in input order.
 *
 * Mirrors `Promise.allSettled(items.map(worker))` semantics (never rejects,
 * one result per item, order preserved) but caps concurrency so bulk
 * operations cannot fire N simultaneous requests and exhaust the backend
 * connection pool.
 */
export async function runSettledWithConcurrency<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  limit: number,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function runner(): Promise<void> {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      try {
        const value = await worker(items[index], index);
        results[index] = { status: 'fulfilled', value };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  const runners = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: runners }, () => runner()));
  return results;
}
