const test = require('node:test');
const assert = require('node:assert/strict');
const { filterSoftDeletedRecords } = require('../scripts/ingest/import-taxonomy');

// fleet-verify 2026-07-03: import must SKIP records whose DB row is
// soft-deleted (deletedAt != null) rather than silently overwrite them.
// These are pure unit tests -- the prisma client is injected as a stub, so
// no live DB is needed (kept out of the *.db.test.js DB-gated set on purpose).

function mkReport(domain = 'traits') {
  return { domain, skipped: 0, skipReasons: {}, skippedSamples: [] };
}

// Stub client: findMany returns the requested slugs that are in `deadSlugs`,
// mirroring `where: { slug: { in }, deletedAt: { not: null } }`.
function fakeClient(deadSlugs) {
  return {
    trait: {
      findMany: async ({ where }) =>
        where.slug.in.filter((s) => deadSlugs.has(s)).map((slug) => ({ slug })),
    },
  };
}

test('skips soft-deleted slugs, keeps live ones, records skipReasons.soft_deleted', async () => {
  const pending = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }];
  const report = mkReport();
  const kept = await filterSoftDeletedRecords(fakeClient(new Set(['b'])), 'trait', pending, report, { dryRun: false });
  assert.deepEqual(kept.map((r) => r.slug), ['a', 'c']);
  assert.equal(report.skipped, 1);
  assert.equal(report.skipReasons.soft_deleted, 1);
  assert.equal(report.skippedSamples.length, 1);
});

test('dryRun returns pending unchanged and never queries the DB', async () => {
  const pending = [{ slug: 'a' }];
  let called = false;
  const client = { trait: { findMany: async () => { called = true; return []; } } };
  const kept = await filterSoftDeletedRecords(client, 'trait', pending, mkReport(), { dryRun: true });
  assert.equal(kept, pending);
  assert.equal(called, false);
});

test('no soft-deleted rows returns pending unchanged (no skips)', async () => {
  const pending = [{ slug: 'a' }, { slug: 'b' }];
  const report = mkReport();
  const kept = await filterSoftDeletedRecords(fakeClient(new Set()), 'trait', pending, report, { dryRun: false });
  assert.equal(kept, pending);
  assert.equal(report.skipped, 0);
});

test('empty pending short-circuits without querying', async () => {
  let called = false;
  const client = { trait: { findMany: async () => { called = true; return []; } } };
  const kept = await filterSoftDeletedRecords(client, 'trait', [], mkReport(), { dryRun: false });
  assert.deepEqual(kept, []);
  assert.equal(called, false);
});

test('all soft-deleted drops every record and keeps none', async () => {
  const pending = [{ slug: 'x' }, { slug: 'y' }];
  const report = mkReport();
  const kept = await filterSoftDeletedRecords(fakeClient(new Set(['x', 'y'])), 'trait', pending, report, { dryRun: false });
  assert.deepEqual(kept, []);
  assert.equal(report.skipped, 2);
  assert.equal(report.skipReasons.soft_deleted, 2);
});
