const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, closeServer } = require('./utils');
const prisma = require('../db/prisma');

// Requires a real Postgres (migrated + seeded + backfilled) with the baseline
// released version v1.0.0 populated. Exercises the versioned read path for biome, species, and ecosystem.

const TAG = 'v1.0.0';
const DRAFT_TAG = 'v9.9.6-cdraft-taxonomy';

test.after(async () => {
  try {
    const d = await prisma.taxonomyVersion.findUnique({ where: { tag: DRAFT_TAG } });
    if (d) await prisma.taxonomyVersion.delete({ where: { id: d.id } });
  } finally {
    await prisma.$disconnect();
  }
});

// Helper for testing versioned list endpoints
async function testVersionedList(baseUrl, endpoint, sampleSnap, idField) {
  const res = await fetch(`${baseUrl}/api/${endpoint}?versionId=${TAG}&pageSize=1&page=0`);
  assert.equal(res.status, 200, `${endpoint} status should be 200`);
  const body = await res.json();
  assert.equal(body._version, TAG, `${endpoint} should have correct _version`);
  assert.equal(typeof body.total, 'number', `${endpoint} should have numeric total`);
  assert.ok(body.total >= 1, `${endpoint} total should be >= 1`);
  assert.equal(body.items.length, 1, `${endpoint} should return 1 item`);

  const item = body.items[0];
  assert.equal(item.id, sampleSnap[idField], `${endpoint} id should map to master ${idField}`);
  assert.equal(item.slug, sampleSnap.slug, `${endpoint} slug should match`);
  assert.equal('versionId' in item, false, `${endpoint} should not leak versionId`);
  assert.equal('capturedAt' in item, false, `${endpoint} should not leak capturedAt`);
}

test('versioned lists: items mapped, _version set, id is master fk', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const version = await prisma.taxonomyVersion.findUnique({ where: { tag: TAG } });
    assert.ok(version, 'v1.0.0 must exist');

    const sampleBiome = await prisma.biomeVersion.findFirst({ where: { versionId: version.id }, orderBy: { name: 'asc' } });
    assert.ok(sampleBiome, 'v1.0.0 must have biome snapshots');
    await testVersionedList(baseUrl, 'biomes', sampleBiome, 'biomeId');

    const sampleSpecies = await prisma.speciesVersion.findFirst({ where: { versionId: version.id }, orderBy: { scientificName: 'asc' } });
    assert.ok(sampleSpecies, 'v1.0.0 must have species snapshots');
    await testVersionedList(baseUrl, 'species', sampleSpecies, 'speciesId');

    const sampleEcosystem = await prisma.ecosystemVersion.findFirst({ where: { versionId: version.id }, orderBy: { name: 'asc' } });
    assert.ok(sampleEcosystem, 'v1.0.0 must have ecosystem snapshots');
    await testVersionedList(baseUrl, 'ecosystems', sampleEcosystem, 'ecosystemId');
  } finally {
    await closeServer(server);
  }
});

test('unknown tag -> 404 VERSION_NOT_FOUND', async () => {
  const { server, baseUrl } = await startServer();
  try {
    for (const endpoint of ['biomes', 'species', 'ecosystems']) {
      const res = await fetch(`${baseUrl}/api/${endpoint}?versionId=v0.0.0-nope`);
      assert.equal(res.status, 404, `${endpoint} unknown tag status should be 404`);
      assert.equal((await res.json()).code, 'VERSION_NOT_FOUND', `${endpoint} unknown tag code should match`);
    }
  } finally {
    await closeServer(server);
  }
});

test('draft tag -> 400 VERSION_NOT_RELEASED', async () => {
  const { server, baseUrl } = await startServer();
  try {
    await prisma.taxonomyVersion.deleteMany({ where: { tag: DRAFT_TAG } });
    await prisma.taxonomyVersion.create({ data: { tag: DRAFT_TAG, status: 'draft' } });

    for (const endpoint of ['biomes', 'species', 'ecosystems']) {
      const res = await fetch(`${baseUrl}/api/${endpoint}?versionId=${DRAFT_TAG}`);
      assert.equal(res.status, 400, `${endpoint} draft tag status should be 400`);
      assert.equal((await res.json()).code, 'VERSION_NOT_RELEASED', `${endpoint} draft tag code should match`);
    }
  } finally {
    await closeServer(server);
  }
});

test('q filter on versioned lists returns a correct subset', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const version = await prisma.taxonomyVersion.findUnique({ where: { tag: TAG } });

    // Biomes
    const sampleBiome = await prisma.biomeVersion.findFirst({ where: { versionId: version.id }, orderBy: { name: 'asc' } });
    let term = sampleBiome.name.slice(0, 3);
    let res = await fetch(`${baseUrl}/api/biomes?versionId=${TAG}&q=${encodeURIComponent(term)}&pageSize=100&page=0`);
    let body = await res.json();
    assert.ok(body.total >= 1);
    for (const item of body.items) {
      assert.ok(`${item.name} ${item.slug}`.toLowerCase().includes(term.toLowerCase()));
    }

    // Species
    const sampleSpecies = await prisma.speciesVersion.findFirst({ where: { versionId: version.id }, orderBy: { scientificName: 'asc' } });
    term = sampleSpecies.scientificName.slice(0, 3);
    res = await fetch(`${baseUrl}/api/species?versionId=${TAG}&q=${encodeURIComponent(term)}&pageSize=100&page=0`);
    body = await res.json();
    assert.ok(body.total >= 1);
    for (const item of body.items) {
      const hay = `${item.scientificName} ${item.commonName || ''} ${item.slug}`.toLowerCase();
      assert.ok(hay.includes(term.toLowerCase()));
    }

    // Ecosystems
    const sampleEcosystem = await prisma.ecosystemVersion.findFirst({ where: { versionId: version.id }, orderBy: { name: 'asc' } });
    term = sampleEcosystem.name.slice(0, 3);
    res = await fetch(`${baseUrl}/api/ecosystems?versionId=${TAG}&q=${encodeURIComponent(term)}&pageSize=100&page=0`);
    body = await res.json();
    assert.ok(body.total >= 1);
    for (const item of body.items) {
      assert.ok(`${item.name} ${item.slug}`.toLowerCase().includes(term.toLowerCase()));
    }
  } finally {
    await closeServer(server);
  }
});

test('no versionId -> live path unchanged (regression guard)', async () => {
  const { server, baseUrl } = await startServer();
  try {
    for (const endpoint of ['biomes', 'species', 'ecosystems']) {
      const res = await fetch(`${baseUrl}/api/${endpoint}?pageSize=1&page=0`);
      assert.equal(res.status, 200, `${endpoint} live path status should be 200`);
      const body = await res.json();
      assert.equal('_version' in body, false, `${endpoint} live path should not have _version`);
      assert.deepEqual(Object.keys(body).sort(), ['items', 'page', 'pageSize', 'total'], `${endpoint} live path keys should match`);
    }
  } finally {
    await closeServer(server);
  }
});
