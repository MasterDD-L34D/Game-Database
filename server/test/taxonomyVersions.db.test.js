const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, closeServer } = require('./utils');
const prisma = require('../db/prisma');

// Requires a real Postgres (migrated + seeded + backfilled). Exercises the full
// version lifecycle and the release snapshot parity against live masters.

const ADMIN = { 'X-Roles': 'admin', 'Content-Type': 'application/json' };
const TAG = 'v9.9.9-b1test';

async function cleanupTag(tag) {
  const v = await prisma.taxonomyVersion.findUnique({ where: { tag } });
  if (!v) return;
  await prisma.traitVersion.deleteMany({ where: { versionId: v.id } });
  await prisma.biomeVersion.deleteMany({ where: { versionId: v.id } });
  await prisma.speciesVersion.deleteMany({ where: { versionId: v.id } });
  await prisma.ecosystemVersion.deleteMany({ where: { versionId: v.id } });
  await prisma.taxonomyVersion.delete({ where: { id: v.id } });
}

test.after(async () => {
  try {
    await cleanupTag(TAG);
    await cleanupTag('v9.9.8-b1draft');
  } finally {
    await prisma.$disconnect();
  }
});

test('full lifecycle: create draft -> release (parity) -> retire', async () => {
  const { server, baseUrl } = await startServer();
  try {
    await cleanupTag(TAG); // clean any leftover from a prior failed run

    const created = await fetch(`${baseUrl}/api/taxonomy/versions`, {
      method: 'POST', headers: ADMIN, body: JSON.stringify({ tag: TAG }),
    });
    assert.equal(created.status, 201);

    const rel = await fetch(`${baseUrl}/api/taxonomy/versions/${TAG}/release`, { method: 'POST', headers: ADMIN });
    assert.equal(rel.status, 200);
    const relBody = await rel.json();
    assert.equal(relBody.version.status, 'released');

    const [traits, biomes, species, ecosystems] = await Promise.all([
      prisma.trait.count(), prisma.biome.count(), prisma.species.count(), prisma.ecosystem.count(),
    ]);
    assert.equal(relBody.counts.trait, traits);
    assert.equal(relBody.counts.biome, biomes);
    assert.equal(relBody.counts.species, species);
    assert.equal(relBody.counts.ecosystem, ecosystems);

    const ret = await fetch(`${baseUrl}/api/taxonomy/versions/${TAG}/retire`, { method: 'POST', headers: ADMIN });
    assert.equal(ret.status, 200);
    assert.equal((await ret.json()).version.status, 'retired');
  } finally {
    await closeServer(server);
  }
});

test('single-draft: a second concurrent draft is rejected (409)', async () => {
  const { server, baseUrl } = await startServer();
  try {
    await cleanupTag('v9.9.8-b1draft');
    const a = await fetch(`${baseUrl}/api/taxonomy/versions`, {
      method: 'POST', headers: ADMIN, body: JSON.stringify({ tag: 'v9.9.8-b1draft' }),
    });
    assert.equal(a.status, 201);
    const b = await fetch(`${baseUrl}/api/taxonomy/versions`, {
      method: 'POST', headers: ADMIN, body: JSON.stringify({ tag: 'v9.9.7-b1draft' }),
    });
    assert.equal(b.status, 409);
    assert.equal((await b.json()).code, 'DRAFT_EXISTS');
    await fetch(`${baseUrl}/api/taxonomy/versions/v9.9.8-b1draft`, { method: 'DELETE', headers: ADMIN });
  } finally {
    await closeServer(server);
  }
});
