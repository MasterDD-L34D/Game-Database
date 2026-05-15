const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, closeServer, createTaxonomyTestContext } = require('./utils');

const taxonomy = createTaxonomyTestContext();

taxonomy.mock();

if (typeof test.after === 'function') {
  test.after(() => {
    taxonomy.restore();
  });
} else {
  process.on('exit', taxonomy.restore);
}

if (typeof test.beforeEach === 'function') {
  test.beforeEach(() => {
    taxonomy.reset();
  });
}

test('GET /api/species returns paginated species', async () => {
  taxonomy.reset();
  taxonomy.createSpecies({ scientificName: 'Specimen Example', commonName: 'Example species' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/species`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 1);
    assert.equal(body.items[0].scientificName, 'Specimen Example');
  } finally {
    await closeServer(server);
  }
});

test('GET /api/species/:id resolves slugs', async () => {
  taxonomy.reset();
  const species = taxonomy.createSpecies({ scientificName: 'Specimen Slug', slug: 'specimen-slug' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/species/${species.slug}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.id, species.id);
  } finally {
    await closeServer(server);
  }
});

test('GET /api/traits returns paginated traits', async () => {
  taxonomy.reset();
  taxonomy.createTrait({ name: 'Leaf Size', dataType: 'NUMERIC', unit: 'cm' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/traits`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 1);
    assert.equal(body.items[0].name, 'Leaf Size');
  } finally {
    await closeServer(server);
  }
});

test('GET /api/traits/:id resolves slugs', async () => {
  taxonomy.reset();
  const trait = taxonomy.createTrait({ name: 'Flower Color', slug: 'flower-color' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/traits/${trait.slug}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.id, trait.id);
  } finally {
    await closeServer(server);
  }
});

test('GET /api/traits/glossary returns all traits in glossary format', async () => {
  taxonomy.reset();
  taxonomy.createTrait({ name: 'Ali Ioniche', slug: 'ali-ioniche', dataType: 'TEXT', description: 'Volo ionico' });
  taxonomy.createTrait({ name: 'Coda Frusta', slug: 'coda-frusta', dataType: 'NUMERIC', description: 'Attacco coda' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/traits/glossary`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(Array.isArray(body.traits));
    assert.equal(body.traits.length, 2);
    const first = body.traits[0];
    assert.ok(first._id, 'glossary entry must have _id');
    assert.ok(first.labels && first.labels.it, 'glossary entry must have labels.it');
    assert.ok(first.descriptions, 'glossary entry must have descriptions');
    const ali = body.traits.find(t => t._id === 'ali-ioniche');
    assert.equal(ali.labels.it, 'Ali Ioniche');
    assert.equal(ali.descriptions.it, 'Volo ionico');
  } finally {
    await closeServer(server);
  }
});

test('GET /api/biomes returns paginated biomes', async () => {
  taxonomy.reset();
  taxonomy.createBiome({ name: 'Temperate Forest' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/biomes`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 1);
    assert.equal(body.items[0].name, 'Temperate Forest');
  } finally {
    await closeServer(server);
  }
});

test('GET /api/biomes/:id resolves slugs', async () => {
  taxonomy.reset();
  const biome = taxonomy.createBiome({ name: 'Rainforest', slug: 'rainforest' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/biomes/${biome.slug}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.id, biome.id);
  } finally {
    await closeServer(server);
  }
});

test('GET /api/ecosystems returns paginated ecosystems', async () => {
  taxonomy.reset();
  taxonomy.createEcosystem({ name: 'Savannah' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/ecosystems`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 1);
    assert.equal(body.items[0].name, 'Savannah');
  } finally {
    await closeServer(server);
  }
});

test('GET /api/ecosystems/:id resolves slugs', async () => {
  taxonomy.reset();
  const ecosystem = taxonomy.createEcosystem({ name: 'Coral Reef', slug: 'coral-reef' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/ecosystems/${ecosystem.slug}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.id, ecosystem.id);
  } finally {
    await closeServer(server);
  }
});

test('GET /api/species returns 400 for invalid pagination query', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/species?page=-1`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.deepEqual(body, {
      code: 'VALIDATION_ERROR',
      message: 'page must be an integer >= 0',
      details: { field: 'page', location: 'query' },
    });
  } finally {
    await closeServer(server);
  }
});

test('GET /api/traits/:id returns 404 when trait is missing', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/traits/missing-trait`);
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.deepEqual(body, {
      code: 'NOT_FOUND',
      message: 'Trait not found',
      details: { identifier: 'missing-trait' },
    });
  } finally {
    await closeServer(server);
  }
});

test('GET /api/biomes returns 400 for invalid pagination query', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/biomes?page=-1`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.deepEqual(body, {
      code: 'VALIDATION_ERROR',
      message: 'page must be an integer >= 0',
      details: { field: 'page', location: 'query' },
    });
  } finally {
    await closeServer(server);
  }
});

test('GET /api/ecosystems returns 400 for invalid pageSize query', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/ecosystems?pageSize=101`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.deepEqual(body, {
      code: 'VALIDATION_ERROR',
      message: 'pageSize must be an integer between 1 and 100',
      details: { field: 'pageSize', location: 'query' },
    });
  } finally {
    await closeServer(server);
  }
});

test('GET /api/ecosystems/:id returns 404 when ecosystem is missing', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/ecosystems/missing-ecosystem`);
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.deepEqual(body, {
      code: 'NOT_FOUND',
      message: 'Ecosystem not found',
      details: { identifier: 'missing-ecosystem' },
    });
  } finally {
    await closeServer(server);
  }
});

test('POST /api/biomes validates pagination query before creating records', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const createResponse = await fetch(`${baseUrl}/api/biomes?page=-1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
      body: JSON.stringify({ name: 'Should Not Be Created' }),
    });
    assert.equal(createResponse.status, 400);
    const createBody = await createResponse.json();
    assert.deepEqual(createBody, {
      code: 'VALIDATION_ERROR',
      message: 'page must be an integer >= 0',
      details: { field: 'page', location: 'query' },
    });

    const listResponse = await fetch(`${baseUrl}/api/biomes`);
    assert.equal(listResponse.status, 200);
    const listBody = await listResponse.json();
    assert.equal(listBody.total, 0);
  } finally {
    await closeServer(server);
  }
});

test('POST /api/ecosystems validates pagination query before creating records', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const createResponse = await fetch(`${baseUrl}/api/ecosystems?pageSize=101`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
      body: JSON.stringify({ name: 'Should Not Be Created' }),
    });
    assert.equal(createResponse.status, 400);
    const createBody = await createResponse.json();
    assert.deepEqual(createBody, {
      code: 'VALIDATION_ERROR',
      message: 'pageSize must be an integer between 1 and 100',
      details: { field: 'pageSize', location: 'query' },
    });

    const listResponse = await fetch(`${baseUrl}/api/ecosystems`);
    assert.equal(listResponse.status, 200);
    const listBody = await listResponse.json();
    assert.equal(listBody.total, 0);
  } finally {
    await closeServer(server);
  }
});

test('POST /api/species returns 403 when user lacks taxonomy write permission', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/species`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'viewer' },
      body: JSON.stringify({ scientificName: 'No Permission Species' }),
    });
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.deepEqual(body, {
      code: 'FORBIDDEN',
      message: 'Insufficient permissions',
    });
  } finally {
    await closeServer(server);
  }
});

test('POST /api/traits returns 400 for invalid input', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/traits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
      body: JSON.stringify({ name: 'Trait invalid', dataType: 'WRONG_TYPE' }),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.deepEqual(body, {
      code: 'VALIDATION_ERROR',
      message: 'dataType has an invalid value',
      details: {
        field: 'dataType',
        location: 'body',
        allowedValues: ['BOOLEAN', 'NUMERIC', 'CATEGORICAL', 'TEXT'],
      },
    });
  } finally {
    await closeServer(server);
  }
});

test('DELETE /api/species/:id returns 403 when user lacks taxonomy write permission', async () => {
  taxonomy.reset();
  const species = taxonomy.createSpecies({ scientificName: 'Delete Me' });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/species/${species.id}`, {
      method: 'DELETE',
      headers: { 'X-Roles': 'viewer' },
    });
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.deepEqual(body, {
      code: 'FORBIDDEN',
      message: 'Insufficient permissions',
    });
  } finally {
    await closeServer(server);
  }
});

test('DELETE /api/species/:id returns 404 for missing species', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/species/missing-id`, {
      method: 'DELETE',
      headers: { 'X-Roles': 'taxonomy:write' },
    });
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.deepEqual(body, {
      code: 'NOT_FOUND',
      message: 'Species not found',
      details: { identifier: 'missing-id' },
    });
  } finally {
    await closeServer(server);
  }
});

test('DELETE /api/species/:id removes existing species', async () => {
  taxonomy.reset();
  const species = taxonomy.createSpecies({ scientificName: 'Species to delete' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/species/${species.id}`, {
      method: 'DELETE',
      headers: { 'X-Roles': 'taxonomy:write' },
    });
    assert.equal(response.status, 200);

    // Deletion responds with fetchPaginatedSpecies which should now be empty
    const body = await response.json();
    assert.equal(body.total, 0);
    assert.deepEqual(body.items, []);

    // Verify it's actually deleted by doing a GET
    const getResponse = await fetch(`${baseUrl}/api/species/${species.id}`);
    assert.equal(getResponse.status, 404);
  } finally {
    await closeServer(server);
  }
});
