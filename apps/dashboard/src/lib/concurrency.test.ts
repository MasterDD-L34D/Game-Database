import { describe, expect, it, vi } from 'vitest';
import { runSettledWithConcurrency } from './concurrency';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('runSettledWithConcurrency', () => {
  it('caps the number of in-flight workers at the limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);

    const promise = runSettledWithConcurrency(
      items,
      async (i) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight -= 1;
        return i;
      },
      4,
    );

    const results = await promise;
    expect(peak).toBeLessThanOrEqual(4);
    expect(results).toHaveLength(12);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
  });

  it('preserves input order in results regardless of completion order', async () => {
    const d0 = deferred<string>();
    const d1 = deferred<string>();
    const workers = [d0, d1];

    const promise = runSettledWithConcurrency(
      [0, 1],
      (i) => workers[i].promise,
      2,
    );

    // Resolve out of order: item 1 first, then item 0
    d1.resolve('one');
    d0.resolve('zero');

    const results = await promise;
    expect(results[0]).toEqual({ status: 'fulfilled', value: 'zero' });
    expect(results[1]).toEqual({ status: 'fulfilled', value: 'one' });
  });

  it('captures rejections as settled rejected results without aborting siblings', async () => {
    const worker = vi
      .fn<(i: number) => Promise<number>>()
      .mockImplementation(async (i) => {
        if (i === 1) throw new Error('boom');
        return i;
      });

    const results = await runSettledWithConcurrency([0, 1, 2], worker, 2);

    expect(results[0]).toEqual({ status: 'fulfilled', value: 0 });
    expect(results[1].status).toBe('rejected');
    expect(results[2]).toEqual({ status: 'fulfilled', value: 2 });
    expect(worker).toHaveBeenCalledTimes(3);
  });

  it('handles an empty list', async () => {
    const worker = vi.fn();
    const results = await runSettledWithConcurrency([], worker, 4);
    expect(results).toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });
});
