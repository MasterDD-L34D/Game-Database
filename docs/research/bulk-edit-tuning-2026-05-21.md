# Bulk-edit epic — Quality Gate Step 3 (Tuning) 2026-05-21

Closes the CLAUDE.md Release Standard for the bulk-edit epic (PR1 #145, PR2 #146,
PR3 #148). Step 1 (Smoke) + Step 2 (Research) were satisfied by the per-PR test
suites + research docs; this is the Step 3 tuning iteration with a measurable
before/after metric.

## Quality Gate summary

| Step | Evidence |
|---|---|
| 1 — Smoke | `ListPageBulk.test.tsx` (12) + `concurrency.test.ts` (4) + `TraitListPage` smoke (3); CI 100% green every PR |
| 2 — Research | `bulk-edit-2026-05-21.md`, `bulk-edit-pr2-2026-05-21.md`, `bulk-edit-pr3-2026-05-21.md` (>=3 edge cases each) |
| 3 — Tuning | bounded concurrency (this doc) |

## Tuning iteration — bounded bulk-op concurrency

### Problem identified

Both bulk handlers fanned out one mutation request per selected row in a single
`Promise.allSettled(items.map(fn))`. A select-all bulk operation on a full page
(`pageSize` up to 50) therefore issued **up to 50 simultaneous** PUT/DELETE
requests. The backend uses a Prisma connection pool (default ~10-20). N≫pool
means requests queue or fail, and the failure path surfaces as spurious
partial-failure toasts — i.e. the UI's own load can manufacture the "failed"
count it reports.

The PR1/PR2 research docs flagged this ("revisit if datasets grow") but deferred
it as a known tail. This tuning closes it.

### Change

New `apps/dashboard/src/lib/concurrency.ts` → `runSettledWithConcurrency(items,
worker, limit)`. Same observable contract as `Promise.allSettled` (never
rejects, one settled result per item, **input order preserved**) but only
`limit` workers are in flight at once. Both bulk-delete and bulk-edit handlers
now pass `BULK_CONCURRENCY = 5`.

### Before / after metric

| Metric | Before | After |
|---|---|---|
| Peak concurrent requests for N selected rows | `N` (up to 50) | `min(N, 5)` |
| Pool-exhaustion risk on select-all (N=50, pool~15) | high (50 ≫ 15) | none (5 < 15) |
| Result semantics (order, settle, partial-failure tally) | allSettled | identical (verified) |
| Total wall-time on small N (<=5) | baseline | unchanged (N<=limit ⇒ same fan-out) |

`peak <= limit` is asserted directly: `concurrency.test.ts` tracks in-flight
count across 12 items at limit 4 and asserts the observed peak never exceeds 4.
Order preservation + rejection capture are asserted in the same suite.

### Trade-off

For N>5 the bulk op now runs in ceil(N/5) sequential waves rather than one
burst, so wall-time grows modestly with N. Accepted: at taxonomy scale (<=50/
page) worst case is 10 waves of fast single-row mutations, and the alternative
(pool exhaustion → real failures) is strictly worse. Revisit `BULK_CONCURRENCY`
upward only if the backend pool is enlarged.

## Verification

- `npx vitest run src/lib/concurrency.test.ts` — 4/4
- `npx vitest run src/pages/__tests__/ListPageBulk.test.tsx` — 12/12 (allSettled
  semantics unchanged after swap)
- Full `src/` suite: pre-existing `records.test.ts` env failures only.
