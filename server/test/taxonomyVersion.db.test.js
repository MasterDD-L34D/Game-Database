const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../db/prisma');
const { backfillV1Snapshots } = require('../scripts/backfill-v1-snapshots');

// Requires a real Postgres (DATABASE_URL), migrated + seeded + backfilled.
// Baseline version v1.0.0 is created by the taxonomy_versioning migration.

const TEST_DRAFT_PREFIX = 'test-draft-';
const TEST_IMMUT_PREFIX = 'test-immut-';

test.after(async () => {
  try {
    await prisma.taxonomyVersion.deleteMany({ where: { tag: { startsWith: TEST_DRAFT_PREFIX } } });
    await prisma.trait.deleteMany({ where: { slug: { startsWith: TEST_IMMUT_PREFIX } } });
  } finally {
    await prisma.$disconnect();
  }
});

test('baseline v1.0.0 exists and is released', async () => {
  const v = await prisma.taxonomyVersion.findUnique({ where: { tag: 'v1.0.0' } });
  assert.ok(v, 'v1.0.0 must exist');
  assert.equal(v.status, 'released');
});

test('tag uniqueness rejects a duplicate v1.0.0', async () => {
  await assert.rejects(
    () => prisma.taxonomyVersion.create({ data: { tag: 'v1.0.0', status: 'retired' } }),
    (err) => err.code === 'P2002',
    'duplicate tag must violate the unique constraint',
  );
});

test('single-draft partial index allows one draft but rejects a second', async () => {
  await prisma.taxonomyVersion.deleteMany({ where: { tag: { startsWith: TEST_DRAFT_PREFIX } } });
  const first = await prisma.taxonomyVersion.create({
    data: { tag: `${TEST_DRAFT_PREFIX}a`, status: 'draft' },
  });
  assert.equal(first.status, 'draft');
  await assert.rejects(
    () => prisma.taxonomyVersion.create({ data: { tag: `${TEST_DRAFT_PREFIX}b`, status: 'draft' } }),
    (err) => err.code === 'P2002' || /unique/i.test(String(err.message)),
    'a second draft must violate the single-draft partial unique index',
  );
  await prisma.taxonomyVersion.deleteMany({ where: { tag: { startsWith: TEST_DRAFT_PREFIX } } });
});

test('snapshot FK rejects an unknown versionId', async () => {
  const trait = await prisma.trait.findFirst({ orderBy: { id: 'asc' } });
  assert.ok(trait, 'seed must provide at least one trait');
  await assert.rejects(
    () => prisma.traitVersion.create({
      data: {
        traitId: trait.id,
        versionId: 'does-not-exist',
        slug: trait.slug,
        name: trait.name,
        dataType: trait.dataType,
      },
    }),
    (err) => err.code === 'P2003' || /foreign key/i.test(String(err.message)),
    'unknown versionId must violate the FK constraint',
  );
});

test('backfill produced row-count parity per entity under v1.0.0', async () => {
  const baseline = await prisma.taxonomyVersion.findUnique({ where: { tag: 'v1.0.0' } });
  const pairs = [
    ['trait', 'traitVersion'],
    ['biome', 'biomeVersion'],
    ['species', 'speciesVersion'],
    ['ecosystem', 'ecosystemVersion'],
  ];
  for (const [master, snapshot] of pairs) {
    const masterCount = await prisma[master].count();
    const snapCount = await prisma[snapshot].count({ where: { versionId: baseline.id } });
    assert.equal(snapCount, masterCount, `${snapshot} count must equal ${master} count`);
  }
});

test('re-running backfill is a no-op (idempotent)', async () => {
  const baseline = await prisma.taxonomyVersion.findUnique({ where: { tag: 'v1.0.0' } });
  const before = await prisma.traitVersion.count({ where: { versionId: baseline.id } });
  const summary = await backfillV1Snapshots(prisma);
  const after = await prisma.traitVersion.count({ where: { versionId: baseline.id } });
  assert.equal(after, before, 'snapshot count must not change on re-run');
  assert.equal(summary.trait, 0, 'second backfill must insert zero trait snapshots');
});

test('backfill does NOT append newly-created masters to the released v1.0.0 baseline', async () => {
  const baseline = await prisma.taxonomyVersion.findUnique({ where: { tag: 'v1.0.0' } });
  const before = await prisma.traitVersion.count({ where: { versionId: baseline.id } });

  // A master created AFTER the baseline was backfilled must not leak into the
  // released v1.0.0 snapshot when dev:setup re-runs the backfill.
  const probe = await prisma.trait.create({
    data: { slug: `${TEST_IMMUT_PREFIX}${Date.now()}`, name: 'Immutability probe', dataType: 'TEXT' },
  });
  try {
    const summary = await backfillV1Snapshots(prisma);
    const after = await prisma.traitVersion.count({ where: { versionId: baseline.id } });
    assert.equal(after, before, 'released baseline must not grow when new masters exist');
    assert.equal(summary.trait, 0, 'gated backfill must insert zero trait snapshots');

    const probeSnap = await prisma.traitVersion.count({
      where: { versionId: baseline.id, traitId: probe.id },
    });
    assert.equal(probeSnap, 0, 'newly-created master must not be snapshotted into v1.0.0');
  } finally {
    await prisma.trait.delete({ where: { id: probe.id } });
  }
});
