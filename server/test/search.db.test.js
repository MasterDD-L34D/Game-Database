const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, closeServer } = require('./utils');

// Requires a real Postgres (DATABASE_URL), migrated + seeded. The seed
// includes species such as "Lynx lynx" (server/prisma/seed*).

test('fuzzy search finds Lynx lynx for the typo "lynks"', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/search?q=lynks`);
    assert.equal(res.status, 200);
    const body = await res.json();
    const labels = body.results.map((r) => r.label);
    assert.ok(labels.includes('Lynx lynx'), `expected Lynx lynx in ${JSON.stringify(labels)}`);
    for (let i = 1; i < body.results.length; i += 1) {
      assert.ok(body.results[i - 1].score >= body.results[i].score, 'results must be score-descending');
    }
  } finally {
    await closeServer(server);
  }
});

test('high threshold filters weak matches', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/search?q=lynks&threshold=0.9`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.results.length, 0, 'threshold 0.9 should exclude the lynks~Lynx match');
  } finally {
    await closeServer(server);
  }
});

test('entities filter scopes results to species only', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/search?q=lynks&entities=species`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.results.every((r) => r.entity === 'Species'));
  } finally {
    await closeServer(server);
  }
});
