const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, closeServer } = require('./utils');
const prisma = require('../db/prisma');

// Requires a real Postgres (migrated + seeded + backfilled) with the baseline
// released version v1.0.0 populated. Exercises the versioned trait read path.

const TAG = 'v1.0.0';
const DRAFT_TAG = 'v9.9.6-cdraft';

test.after(async () => {
  // best-effort cleanup of the throwaway draft, then disconnect
  try {
    const d = await prisma.taxonomyVersion.findUnique({ where: { tag: DRAFT_TAG } });
    if (d) await prisma.taxonomyVersion.delete({ where: { id: d.id } });
  } finally {
    await prisma.$disconnect();
  }
});

test('versioned list: items mapped, _version set, id is master traitId', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const version = await prisma.taxonomyVersion.findUnique({ where: { tag: TAG } });
    assert.ok(version, 'v1.0.0 must exist (seeded + backfilled)');
    const sampleSnap = await prisma.traitVersion.findFirst({ where: { versionId: version.id }, orderBy: { name: 'asc' } });
    assert.ok(sampleSnap, 'v1.0.0 must have trait snapshots');

    const res = await fetch(`${baseUrl}/api/traits?versionId=${TAG}&pageSize=1&page=0`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body._version, TAG);
    assert.equal(typeof body.total, 'number');
    assert.ok(body.total >= 1);
    assert.equal(body.items.length, 1);
    // id is the master traitId, not the snapshot row id
    assert.equal(body.items[0].id, sampleSnap.traitId);
    assert.equal(body.items[0].slug, sampleSnap.slug);
    // snapshot-only columns are not leaked
    assert.equal('versionId' in body.items[0], false);
    assert.equal('capturedAt' in body.items[0], false);
  } finally {
    await closeServer(server);
  }
});

test('versioned glossary: schema-identical shape, parity with snapshot count', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const version = await prisma.taxonomyVersion.findUnique({ where: { tag: TAG } });
    const snapCount = await prisma.traitVersion.count({ where: { versionId: version.id } });

    const res = await fetch(`${baseUrl}/api/traits/glossary?versionId=${TAG}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(Object.keys(body), ['traits']); // no version marker (schema lock)
    assert.equal(body.traits.length, snapCount);
    const first = body.traits[0];
    assert.deepEqual(Object.keys(first).sort(), ['_id', 'descriptions', 'labels']);
    assert.equal(typeof first._id, 'string');
    assert.ok('it' in first.labels && 'en' in first.labels);
  } finally {
    await closeServer(server);
  }
});

test('unknown tag -> 404 VERSION_NOT_FOUND', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/traits?versionId=v0.0.0-nope`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).code, 'VERSION_NOT_FOUND');
  } finally {
    await closeServer(server);
  }
});

test('draft tag -> 400 VERSION_NOT_RELEASED', async () => {
  const { server, baseUrl } = await startServer();
  try {
    // clean up only our own throwaway tag (never touch other drafts), then
    // create ours. if a foreign draft holds the single-draft index this create
    // fails loudly -- acceptable, and far safer than deleting real data.
    await prisma.taxonomyVersion.deleteMany({ where: { tag: DRAFT_TAG } });
    await prisma.taxonomyVersion.create({ data: { tag: DRAFT_TAG, status: 'draft' } });

    const res = await fetch(`${baseUrl}/api/traits?versionId=${DRAFT_TAG}`);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, 'VERSION_NOT_RELEASED');
  } finally {
    await closeServer(server);
  }
});

test('q filter on versioned list returns a correct subset', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const version = await prisma.taxonomyVersion.findUnique({ where: { tag: TAG } });
    const sample = await prisma.traitVersion.findFirst({ where: { versionId: version.id }, orderBy: { name: 'asc' } });
    const term = sample.name.slice(0, 3);

    const res = await fetch(`${baseUrl}/api/traits?versionId=${TAG}&q=${encodeURIComponent(term)}&pageSize=100&page=0`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.total >= 1);
    for (const item of body.items) {
      const hay = `${item.name} ${item.slug}`.toLowerCase();
      assert.ok(hay.includes(term.toLowerCase()));
    }
  } finally {
    await closeServer(server);
  }
});

test('no versionId -> live path unchanged (regression guard)', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/traits?pageSize=1&page=0`);
    assert.equal(res.status, 200);
    const body = await res.json();
    // live shape has no _version marker
    assert.equal('_version' in body, false);
    assert.deepEqual(Object.keys(body).sort(), ['items', 'page', 'pageSize', 'total']);
  } finally {
    await closeServer(server);
  }
});

test('frozen snapshot ignores a later soft-delete of the live master', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const version = await prisma.taxonomyVersion.findUnique({ where: { tag: TAG } });
    const snap = await prisma.traitVersion.findFirst({ where: { versionId: version.id }, orderBy: { name: 'asc' } });
    // soft-delete the live master this snapshot points at
    await prisma.trait.update({ where: { id: snap.traitId }, data: { deletedAt: new Date() } });
    try {
      const res = await fetch(`${baseUrl}/api/traits?versionId=${TAG}&q=${encodeURIComponent(snap.slug)}&pageSize=100&page=0`);
      assert.equal(res.status, 200);
      const body = await res.json();
      const ids = body.items.map((i) => i.id);
      assert.ok(ids.includes(snap.traitId), 'frozen snapshot still includes the soft-deleted master');
    } finally {
      // always restore the live master so DB state is clean for other tests
      await prisma.trait.update({ where: { id: snap.traitId }, data: { deletedAt: null } });
    }
  } finally {
    await closeServer(server);
  }
});
