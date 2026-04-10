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
