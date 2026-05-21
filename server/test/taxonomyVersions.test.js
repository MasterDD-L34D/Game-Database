const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, closeServer, createTaxonomyTestContext } = require('./utils');

const taxonomy = createTaxonomyTestContext();
taxonomy.mock();

if (typeof test.after === 'function') test.after(() => taxonomy.restore());
else process.on('exit', taxonomy.restore);
if (typeof test.beforeEach === 'function') test.beforeEach(() => taxonomy.reset());

const ADMIN = { 'X-Roles': 'admin', 'Content-Type': 'application/json' };
const WRITER = { 'X-Roles': 'taxonomy:write', 'Content-Type': 'application/json' };

async function createDraft(baseUrl, tag, headers = ADMIN) {
  return fetch(`${baseUrl}/api/taxonomy/versions`, {
    method: 'POST', headers, body: JSON.stringify({ tag }),
  });
}

test('POST creates a draft with a valid semver tag', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const res = await createDraft(baseUrl, 'v1.1.0');
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.version.tag, 'v1.1.0');
    assert.equal(body.version.status, 'draft');
  } finally { await closeServer(server); }
});

test('POST rejects an invalid tag (400)', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const res = await createDraft(baseUrl, 'not-semver');
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, 'VALIDATION_ERROR');
  } finally { await closeServer(server); }
});

test('POST rejects a duplicate tag (409 TAG_EXISTS)', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    await createDraft(baseUrl, 'v1.1.0');
    await fetch(`${baseUrl}/api/taxonomy/versions/v1.1.0/release`, { method: 'POST', headers: ADMIN });
    const res = await createDraft(baseUrl, 'v1.1.0');
    assert.equal(res.status, 409);
    assert.equal((await res.json()).code, 'TAG_EXISTS');
  } finally { await closeServer(server); }
});

test('POST rejects a second draft (409 DRAFT_EXISTS)', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    await createDraft(baseUrl, 'v1.1.0');
    const res = await createDraft(baseUrl, 'v1.2.0');
    assert.equal(res.status, 409);
    assert.equal((await res.json()).code, 'DRAFT_EXISTS');
  } finally { await closeServer(server); }
});

test('POST requires admin (403 for taxonomy:write)', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const res = await createDraft(baseUrl, 'v1.1.0', WRITER);
    assert.equal(res.status, 403);
  } finally { await closeServer(server); }
});

test('GET / lists versions and hides retired by default', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    await createDraft(baseUrl, 'v1.1.0');
    await fetch(`${baseUrl}/api/taxonomy/versions/v1.1.0/release`, { method: 'POST', headers: ADMIN });
    await fetch(`${baseUrl}/api/taxonomy/versions/v1.1.0/retire`, { method: 'POST', headers: ADMIN });
    const def = await (await fetch(`${baseUrl}/api/taxonomy/versions`)).json();
    assert.equal(def.versions.length, 0, 'retired hidden by default');
    const all = await (await fetch(`${baseUrl}/api/taxonomy/versions?includeRetired=true`)).json();
    assert.equal(all.versions.length, 1);
  } finally { await closeServer(server); }
});

test('GET /:tag returns version + per-entity counts', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    await createDraft(baseUrl, 'v1.1.0');
    const res = await fetch(`${baseUrl}/api/taxonomy/versions/v1.1.0`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.version.tag, 'v1.1.0');
    assert.deepEqual(body.counts, { trait: 0, biome: 0, species: 0, ecosystem: 0 });
  } finally { await closeServer(server); }
});

test('GET /:tag 404 for unknown tag', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/taxonomy/versions/v9.9.9`);
    assert.equal(res.status, 404);
  } finally { await closeServer(server); }
});

test('release flips draft -> released and snapshots masters (counts)', async () => {
  taxonomy.reset();
  taxonomy.createTrait({ name: 'T1' });
  taxonomy.createBiome({ name: 'B1' });
  const { server, baseUrl } = await startServer();
  try {
    await createDraft(baseUrl, 'v1.1.0');
    const res = await fetch(`${baseUrl}/api/taxonomy/versions/v1.1.0/release`, { method: 'POST', headers: ADMIN });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.version.status, 'released');
    assert.ok(body.version.releasedAt, 'releasedAt set');
    assert.equal(body.counts.trait, 1);
    assert.equal(body.counts.biome, 1);
  } finally { await closeServer(server); }
});

test('release on a non-draft is rejected (409 INVALID_STATE)', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    await createDraft(baseUrl, 'v1.1.0');
    await fetch(`${baseUrl}/api/taxonomy/versions/v1.1.0/release`, { method: 'POST', headers: ADMIN });
    const res = await fetch(`${baseUrl}/api/taxonomy/versions/v1.1.0/release`, { method: 'POST', headers: ADMIN });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).code, 'INVALID_STATE');
  } finally { await closeServer(server); }
});

test('retire on a non-released is rejected (409)', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    await createDraft(baseUrl, 'v1.1.0');
    const res = await fetch(`${baseUrl}/api/taxonomy/versions/v1.1.0/retire`, { method: 'POST', headers: ADMIN });
    assert.equal(res.status, 409);
  } finally { await closeServer(server); }
});

test('DELETE removes a draft but not a released version', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    await createDraft(baseUrl, 'v1.1.0');
    const okDel = await fetch(`${baseUrl}/api/taxonomy/versions/v1.1.0`, { method: 'DELETE', headers: ADMIN });
    assert.equal(okDel.status, 200);

    await createDraft(baseUrl, 'v1.2.0');
    await fetch(`${baseUrl}/api/taxonomy/versions/v1.2.0/release`, { method: 'POST', headers: ADMIN });
    const badDel = await fetch(`${baseUrl}/api/taxonomy/versions/v1.2.0`, { method: 'DELETE', headers: ADMIN });
    assert.equal(badDel.status, 409);
  } finally { await closeServer(server); }
});
