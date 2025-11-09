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
