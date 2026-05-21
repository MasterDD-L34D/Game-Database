const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, closeServer, createTaxonomyTestContext } = require('./utils');

// RFC #1 Phase A immutability guard: a master row captured in a *released*
// taxonomy version must not be hard-deletable (the FK onDelete: Cascade would
// otherwise erase its frozen released snapshots). The route guard returns 409
// VERSION_IMMUTABLE in that case. Soft-delete is deferred to Phase B (Q7).

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
  test(`DELETE /api/${path}/:id is blocked (409) when captured in a released version`, async () => {
    taxonomy.reset();
    const master = create(taxonomy);
    taxonomy.markReleased(entity, master.id);

    const { server, baseUrl } = await startServer();
    try {
      const res = await fetch(`${baseUrl}/api/${path}/${master.id}`, {
        method: 'DELETE',
        headers: { 'X-Roles': 'taxonomy:write' },
      });
      assert.equal(res.status, 409);
      const body = await res.json();
      assert.equal(body.code, 'VERSION_IMMUTABLE');

      // Master must survive the blocked delete.
      const stillThere = await fetch(`${baseUrl}/api/${path}/${master.id}`);
      assert.equal(stillThere.status, 200);
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
