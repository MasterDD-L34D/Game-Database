const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../db/prisma');
const { startServer, closeServer } = require('./utils');

// The route runs inside prisma.$transaction(cb), calling tx.$queryRaw twice
// (set_limit, then the search). Stub $transaction to supply a fake tx whose
// $queryRaw returns the fixture rows for the search call (and a no-op for
// set_limit). Capture the search SQL object for assertions.
function stubTransaction(rows, onSearchSql) {
  const original = prisma.$transaction;
  prisma.$transaction = async (cb) => {
    let call = 0;
    const tx = {
      $queryRaw: async (sqlObj) => {
        call += 1;
        if (call === 1) return [{ set_limit: 0.3 }]; // set_limit
        if (onSearchSql) onSearchSql(sqlObj);
        return rows;
      },
    };
    return cb(tx);
  };
  return () => {
    prisma.$transaction = original;
  };
}

test('GET /api/search returns shaped ranked results', async () => {
  const restore = stubTransaction([
    { entity: 'Species', id: 'sp1', slug: 'lynx-lynx', label: 'Lynx lynx', score: 0.45 },
    { entity: 'Trait', id: 'tr1', slug: 'lince', label: 'Lince', score: 0.31 },
  ]);
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/search?q=lynks`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.q, 'lynks');
    assert.equal(body.results.length, 2);
    assert.deepEqual(body.results[0], {
      entity: 'Species',
      id: 'sp1',
      slug: 'lynx-lynx',
      label: 'Lynx lynx',
      score: 0.45,
    });
  } finally {
    await closeServer(server);
    restore();
  }
});

test('GET /api/search 400 on empty q', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/search?q=%20%20`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
  } finally {
    await closeServer(server);
  }
});

test('GET /api/search 400 on unknown entity', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/search?q=x&entities=trait,dragon`);
    assert.equal(res.status, 400);
  } finally {
    await closeServer(server);
  }
});

test('GET /api/search clamps limit and passes it through', async () => {
  let capturedSql = null;
  const restore = stubTransaction([], (sqlObj) => {
    capturedSql = sqlObj;
  });
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/search?q=x&limit=9999`);
    assert.equal(res.status, 200);
    assert.equal(capturedSql.values[capturedSql.values.length - 1], 50);
  } finally {
    await closeServer(server);
    restore();
  }
});
