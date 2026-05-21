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

    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.id, species.id);

    // Verify it's actually deleted by doing a GET
    const getResponse = await fetch(`${baseUrl}/api/species/${species.id}`);
    assert.equal(getResponse.status, 404);
  } finally {
    await closeServer(server);
  }
});


test('PUT /api/ecosystems/:id updates an existing ecosystem', async () => {
  taxonomy.reset();
  const eco = taxonomy.createEcosystem({ name: 'Old Name', description: 'Old Description' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/ecosystems/${eco.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
      body: JSON.stringify({ name: 'New Name', description: 'New Description' }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.id, eco.id);
    assert.equal(body.name, 'New Name');
    assert.equal(body.description, 'New Description');
  } finally {
    await closeServer(server);
  }
});

test('PUT /api/ecosystems/:id returns 409 for slug conflict', async () => {
  taxonomy.reset();
  taxonomy.createEcosystem({ name: 'Ecosystem One', slug: 'eco-1' });
  const eco2 = taxonomy.createEcosystem({ name: 'Ecosystem Two', slug: 'eco-2' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/ecosystems/${eco2.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
      body: JSON.stringify({ name: 'Ecosystem One', slug: 'eco-1' }),
    });
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.code, 'CONFLICT');
  } finally {
    await closeServer(server);
  }
});

test('PUT /api/ecosystems/:id returns 404 for missing ecosystem', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/ecosystems/missing-id`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
      body: JSON.stringify({ name: 'Whatever', slug: 'whatever' }),
    });
    assert.equal(response.status, 404);
  } finally {
    await closeServer(server);
  }
});

test('PUT /api/ecosystems/:id returns 403 when user lacks taxonomy:write permission', async () => {
  taxonomy.reset();
  const eco = taxonomy.createEcosystem({ name: 'Permission Test' });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/ecosystems/${eco.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'viewer' },
      body: JSON.stringify({ name: 'Should fail' }),
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


// ---- PUT /api/traits/:id ---------------------------------------------------

test('PUT /api/traits/:id updates an existing trait', async () => {
  taxonomy.reset();
  const trait = taxonomy.createTrait({ name: 'Old Trait', description: 'Old description' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/traits/${trait.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
      body: JSON.stringify({ name: 'New Trait', dataType: 'TEXT', description: 'New description' }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(Array.isArray(body.items), 'response should contain paginated items');
    const updated = body.items.find(item => item.id === trait.id);
    assert.ok(updated, 'updated trait should be in items');
    assert.equal(updated.name, 'New Trait');
    assert.equal(updated.description, 'New description');
  } finally {
    await closeServer(server);
  }
});

test('PUT /api/traits/:id returns 409 for slug conflict', async () => {
  taxonomy.reset();
  taxonomy.createTrait({ name: 'Trait One', slug: 'trait-one' });
  const t2 = taxonomy.createTrait({ name: 'Trait Two', slug: 'trait-two' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/traits/${t2.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
      body: JSON.stringify({ name: 'Trait One', dataType: 'TEXT', slug: 'trait-one' }),
    });
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.code, 'CONFLICT');
  } finally {
    await closeServer(server);
  }
});

test('PUT /api/traits/:id returns 404 for missing trait', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/traits/missing-id`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
      body: JSON.stringify({ name: 'Whatever', dataType: 'TEXT' }),
    });
    assert.equal(response.status, 404);
  } finally {
    await closeServer(server);
  }
});

test('PUT /api/traits/:id returns 403 when user lacks taxonomy:write permission', async () => {
  taxonomy.reset();
  const trait = taxonomy.createTrait({ name: 'Permission Test' });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/traits/${trait.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'viewer' },
      body: JSON.stringify({ name: 'Should fail', dataType: 'TEXT' }),
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


// ---- PUT /api/biomes/:id ---------------------------------------------------

test('PUT /api/biomes/:id updates an existing biome', async () => {
  taxonomy.reset();
  const biome = taxonomy.createBiome({ name: 'Old Biome', description: 'Old description' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/biomes/${biome.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
      body: JSON.stringify({ name: 'New Biome', description: 'New description' }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(Array.isArray(body.items), 'response should contain paginated items');
    const updated = body.items.find(item => item.id === biome.id);
    assert.ok(updated, 'updated biome should be in items');
    assert.equal(updated.name, 'New Biome');
    assert.equal(updated.description, 'New description');
  } finally {
    await closeServer(server);
  }
});

test('PUT /api/biomes/:id returns 409 for slug conflict', async () => {
  taxonomy.reset();
  taxonomy.createBiome({ name: 'Biome One', slug: 'biome-one' });
  const b2 = taxonomy.createBiome({ name: 'Biome Two', slug: 'biome-two' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/biomes/${b2.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
      body: JSON.stringify({ name: 'Biome One', slug: 'biome-one' }),
    });
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.code, 'CONFLICT');
  } finally {
    await closeServer(server);
  }
});

test('PUT /api/biomes/:id returns 404 for missing biome', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/biomes/missing-id`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
      body: JSON.stringify({ name: 'Whatever' }),
    });
    assert.equal(response.status, 404);
  } finally {
    await closeServer(server);
  }
});

test('PUT /api/biomes/:id returns 403 when user lacks taxonomy:write permission', async () => {
  taxonomy.reset();
  const biome = taxonomy.createBiome({ name: 'Permission Test' });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/biomes/${biome.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'viewer' },
      body: JSON.stringify({ name: 'Should fail' }),
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


// ---- PUT /api/species/:id --------------------------------------------------

test('PUT /api/species/:id updates an existing species', async () => {
  taxonomy.reset();
  const species = taxonomy.createSpecies({ scientificName: 'Old Scientific', commonName: 'Old Common' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/species/${species.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
      body: JSON.stringify({ scientificName: 'New Scientific', commonName: 'New Common' }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(Array.isArray(body.items), 'response should contain paginated items');
    const updated = body.items.find(item => item.id === species.id);
    assert.ok(updated, 'updated species should be in items');
    assert.equal(updated.scientificName, 'New Scientific');
  } finally {
    await closeServer(server);
  }
});

test('PUT /api/species/:id returns 409 for slug conflict', async () => {
  taxonomy.reset();
  taxonomy.createSpecies({ scientificName: 'Species One', slug: 'species-one' });
  const s2 = taxonomy.createSpecies({ scientificName: 'Species Two', slug: 'species-two' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/species/${s2.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
      body: JSON.stringify({ scientificName: 'Species One', slug: 'species-one' }),
    });
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.code, 'CONFLICT');
  } finally {
    await closeServer(server);
  }
});

test('PUT /api/species/:id returns 404 for missing species', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/species/missing-id`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
      body: JSON.stringify({ scientificName: 'Whatever' }),
    });
    assert.equal(response.status, 404);
  } finally {
    await closeServer(server);
  }
});

test('PUT /api/species/:id returns 403 when user lacks taxonomy:write permission', async () => {
  taxonomy.reset();
  const species = taxonomy.createSpecies({ scientificName: 'Permission Test' });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/species/${species.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'viewer' },
      body: JSON.stringify({ scientificName: 'Should fail' }),
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


// ---- DELETE /api/traits/:id ------------------------------------------------

test('DELETE /api/traits/:id removes an existing trait', async () => {
  taxonomy.reset();
  const trait = taxonomy.createTrait({ name: 'Trait to delete' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/traits/${trait.id}`, {
      method: 'DELETE',
      headers: { 'X-Roles': 'taxonomy:write' },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.id, trait.id);

    const getResponse = await fetch(`${baseUrl}/api/traits/${trait.id}`);
    assert.equal(getResponse.status, 404);
  } finally {
    await closeServer(server);
  }
});

test('DELETE /api/traits/:id returns 404 for missing trait', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/traits/missing-id`, {
      method: 'DELETE',
      headers: { 'X-Roles': 'taxonomy:write' },
    });
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.code, 'NOT_FOUND');
  } finally {
    await closeServer(server);
  }
});

test('DELETE /api/traits/:id returns 403 when user lacks taxonomy:write permission', async () => {
  taxonomy.reset();
  const trait = taxonomy.createTrait({ name: 'Permission Test' });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/traits/${trait.id}`, {
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


// ---- DELETE /api/biomes/:id ------------------------------------------------

test('DELETE /api/biomes/:id removes an existing biome', async () => {
  taxonomy.reset();
  const biome = taxonomy.createBiome({ name: 'Biome to delete' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/biomes/${biome.id}`, {
      method: 'DELETE',
      headers: { 'X-Roles': 'taxonomy:write' },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.id, biome.id);

    const getResponse = await fetch(`${baseUrl}/api/biomes/${biome.id}`);
    assert.equal(getResponse.status, 404);
  } finally {
    await closeServer(server);
  }
});

test('DELETE /api/biomes/:id returns 404 for missing biome', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/biomes/missing-id`, {
      method: 'DELETE',
      headers: { 'X-Roles': 'taxonomy:write' },
    });
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.code, 'NOT_FOUND');
  } finally {
    await closeServer(server);
  }
});

test('DELETE /api/biomes/:id returns 403 when user lacks taxonomy:write permission', async () => {
  taxonomy.reset();
  const biome = taxonomy.createBiome({ name: 'Permission Test' });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/biomes/${biome.id}`, {
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


// ---- DELETE /api/ecosystems/:id --------------------------------------------

test('DELETE /api/ecosystems/:id removes an existing ecosystem', async () => {
  taxonomy.reset();
  const eco = taxonomy.createEcosystem({ name: 'Ecosystem to delete' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/ecosystems/${eco.id}`, {
      method: 'DELETE',
      headers: { 'X-Roles': 'taxonomy:write' },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.id, eco.id);

    const getResponse = await fetch(`${baseUrl}/api/ecosystems/${eco.id}`);
    assert.equal(getResponse.status, 404);
  } finally {
    await closeServer(server);
  }
});

test('DELETE /api/ecosystems/:id returns 404 for missing ecosystem', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/ecosystems/missing-id`, {
      method: 'DELETE',
      headers: { 'X-Roles': 'taxonomy:write' },
    });
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.code, 'NOT_FOUND');
  } finally {
    await closeServer(server);
  }
});

test('DELETE /api/ecosystems/:id returns 403 when user lacks taxonomy:write permission', async () => {
  taxonomy.reset();
  const eco = taxonomy.createEcosystem({ name: 'Permission Test' });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/ecosystems/${eco.id}`, {
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


// ---- PUT guard: editing a soft-deleted master is blocked --------------------

test('PUT /api/traits/:id returns 409 when the trait is soft-deleted', async () => {
  taxonomy.reset();
  const trait = taxonomy.createTrait({ name: 'Deleted Trait', deletedAt: new Date() });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/traits/${trait.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
      body: JSON.stringify({ name: 'Should not edit', dataType: 'TEXT' }),
    });
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.code, 'DELETED_ENTITY');
    assert.deepEqual(body.details, { id: trait.id });
  } finally {
    await closeServer(server);
  }
});

test('PUT /api/biomes/:id returns 409 when the biome is soft-deleted', async () => {
  taxonomy.reset();
  const biome = taxonomy.createBiome({ name: 'Deleted Biome', deletedAt: new Date() });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/biomes/${biome.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
      body: JSON.stringify({ name: 'Should not edit' }),
    });
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.code, 'DELETED_ENTITY');
    assert.deepEqual(body.details, { id: biome.id });
  } finally {
    await closeServer(server);
  }
});

test('PUT /api/species/:id returns 409 when the species is soft-deleted', async () => {
  taxonomy.reset();
  const species = taxonomy.createSpecies({ scientificName: 'Deleted Species', deletedAt: new Date() });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/species/${species.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
      body: JSON.stringify({ scientificName: 'Should not edit' }),
    });
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.code, 'DELETED_ENTITY');
    assert.deepEqual(body.details, { id: species.id });
  } finally {
    await closeServer(server);
  }
});

test('PUT /api/ecosystems/:id returns 409 when the ecosystem is soft-deleted', async () => {
  taxonomy.reset();
  const eco = taxonomy.createEcosystem({ name: 'Deleted Ecosystem', deletedAt: new Date() });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/ecosystems/${eco.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
      body: JSON.stringify({ name: 'Should not edit' }),
    });
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.code, 'DELETED_ENTITY');
    assert.deepEqual(body.details, { id: eco.id });
  } finally {
    await closeServer(server);
  }
});
