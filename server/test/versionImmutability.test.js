const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, closeServer, createTaxonomyTestContext } = require('./utils');

// RFC #1 Phase B (Q7): masters captured in a *released* taxonomy version are
// soft-deletable. Soft-delete only sets deletedAt -- the row (and its frozen
// released snapshots) survives, so the FK onDelete: Cascade never fires. The
// Phase A hard-delete guard (409 VERSION_IMMUTABLE) is therefore superseded:
// DELETE now hides the master from default reads while preserving its history.

const taxonomy = createTaxonomyTestContext();
taxonomy.mock();

if (typeof test.after === 'function') {
  test.after(() => taxonomy.restore());
} else {
  process.on('exit', taxonomy.restore);
}
if (typeof test.beforeEach === 'function') {
  test.beforeEach(() => taxonomy.reset());
}

const CASES = [
  { entity: 'trait', path: 'traits', create: (t) => t.createTrait({ name: 'Versioned trait' }) },
  { entity: 'biome', path: 'biomes', create: (t) => t.createBiome({ name: 'Versioned biome' }) },
  { entity: 'species', path: 'species', create: (t) => t.createSpecies({ scientificName: 'Versioned sp.' }) },
  { entity: 'ecosystem', path: 'ecosystems', create: (t) => t.createEcosystem({ name: 'Versioned eco' }) },
];

for (const { entity, path, create } of CASES) {
  test(`DELETE /api/${path}/:id soft-deletes (200) even when captured in a released version`, async () => {
    taxonomy.reset();
    const master = create(taxonomy);
    taxonomy.markReleased(entity, master.id);

    const { server, baseUrl } = await startServer();
    try {
      const res = await fetch(`${baseUrl}/api/${path}/${master.id}`, {
        method: 'DELETE',
        headers: { 'X-Roles': 'taxonomy:write' },
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);

      // Soft-delete hides the master from default reads...
      const hidden = await fetch(`${baseUrl}/api/${path}/${master.id}`);
      assert.equal(hidden.status, 404);

      // ...but the row survives (not hard-deleted), so its released snapshots
      // are never cascade-erased. It stays fetchable with includeDeleted.
      const survived = await fetch(`${baseUrl}/api/${path}/${master.id}?includeDeleted=true`);
      assert.equal(survived.status, 200);
    } finally {
      await closeServer(server);
    }
  });

  test(`DELETE /api/${path}/:id is allowed (200) when not in any released version`, async () => {
    taxonomy.reset();
    const master = create(taxonomy);

    const { server, baseUrl } = await startServer();
    try {
      const res = await fetch(`${baseUrl}/api/${path}/${master.id}`, {
        method: 'DELETE',
        headers: { 'X-Roles': 'taxonomy:write' },
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
    } finally {
      await closeServer(server);
    }
  });
}
