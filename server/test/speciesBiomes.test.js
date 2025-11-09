const test = require('node:test');
const assert = require('node:assert/strict');
const createApp = require('../app');
const prisma = require('../db/prisma');

const TAXONOMY_ROLE = 'taxonomy:write';

const originalPrisma = {
  speciesBiome: {
    findMany: prisma.speciesBiome?.findMany,
    findUnique: prisma.speciesBiome?.findUnique,
    create: prisma.speciesBiome?.create,
    update: prisma.speciesBiome?.update,
    delete: prisma.speciesBiome?.delete,
  },
  species: {
    findUnique: prisma.species?.findUnique,
  },
  biome: {
    findUnique: prisma.biome?.findUnique,
  },
};

const speciesRecords = new Map();
const biomeRecords = new Map();
const speciesBiomeStore = new Map();
let idCounter = 1;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function resetData() {
  speciesRecords.clear();
  speciesRecords.set('species-1', {
    id: 'species-1',
    slug: 'species-1',
    scientificName: 'Specimen One',
  });
  speciesRecords.set('species-2', {
    id: 'species-2',
    slug: 'species-2',
    scientificName: 'Specimen Two',
  });

  biomeRecords.clear();
  biomeRecords.set('biome-1', {
    id: 'biome-1',
    slug: 'biome-1',
    name: 'Biome One',
  });
  biomeRecords.set('biome-2', {
    id: 'biome-2',
    slug: 'biome-2',
    name: 'Biome Two',
  });

  speciesBiomeStore.clear();
  idCounter = 1;
}

function matchesWhere(record, where = {}) {
  if (!where || !Object.keys(where).length) return true;
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    return record[key] === value;
  });
}

function sortRecords(items) {
  return items.slice().sort((a, b) => {
    if (a.speciesId !== b.speciesId) return a.speciesId.localeCompare(b.speciesId);
    if (a.biomeId !== b.biomeId) return a.biomeId.localeCompare(b.biomeId);
    return 0;
  });
}

function hasDuplicateCombination(id, speciesId, biomeId) {
  for (const [storedId, record] of speciesBiomeStore.entries()) {
    if (storedId === id) continue;
    if (record.speciesId === speciesId && record.biomeId === biomeId) {
      return true;
    }
  }
  return false;
}

function mockPrisma() {
  prisma.species.findUnique = async ({ where }) => {
    if (!where) return null;
    if (where.id) return clone(speciesRecords.get(where.id)) || null;
    return null;
  };

  prisma.biome.findUnique = async ({ where }) => {
    if (!where) return null;
    if (where.id) return clone(biomeRecords.get(where.id)) || null;
    return null;
  };

  prisma.speciesBiome.findMany = async ({ where } = {}) => {
    const items = Array.from(speciesBiomeStore.values()).filter(item => matchesWhere(item, where));
    return sortRecords(items).map(clone);
  };

  prisma.speciesBiome.findUnique = async ({ where }) => {
    if (!where || !where.id) return null;
    const found = speciesBiomeStore.get(where.id);
    return clone(found) || null;
  };

  prisma.speciesBiome.create = async ({ data }) => {
    if (hasDuplicateCombination(null, data.speciesId, data.biomeId)) {
      const error = new Error('Unique constraint failed');
      error.code = 'P2002';
      throw error;
    }
    const id = `sb_${idCounter++}`;
    const record = { id, ...data };
    speciesBiomeStore.set(id, clone(record));
    return clone(record);
  };

  prisma.speciesBiome.update = async ({ where, data }) => {
    if (!where || !where.id) throw new Error('Missing id in update');
    const existing = speciesBiomeStore.get(where.id);
    if (!existing) throw new Error('Record not found');
    if (hasDuplicateCombination(where.id, data.speciesId ?? existing.speciesId, data.biomeId ?? existing.biomeId)) {
      const error = new Error('Unique constraint failed');
      error.code = 'P2002';
      throw error;
    }
    const next = { ...existing, ...data };
    speciesBiomeStore.set(where.id, clone(next));
    return clone(next);
  };

  prisma.speciesBiome.delete = async ({ where }) => {
    if (!where || !where.id) throw new Error('Missing id in delete');
    const existing = speciesBiomeStore.get(where.id);
    if (!existing) throw new Error('Record not found');
    speciesBiomeStore.delete(where.id);
    return clone(existing);
  };
}

function restorePrisma() {
  if (originalPrisma.speciesBiome.findMany) prisma.speciesBiome.findMany = originalPrisma.speciesBiome.findMany;
  if (originalPrisma.speciesBiome.findUnique) prisma.speciesBiome.findUnique = originalPrisma.speciesBiome.findUnique;
  if (originalPrisma.speciesBiome.create) prisma.speciesBiome.create = originalPrisma.speciesBiome.create;
  if (originalPrisma.speciesBiome.update) prisma.speciesBiome.update = originalPrisma.speciesBiome.update;
  if (originalPrisma.speciesBiome.delete) prisma.speciesBiome.delete = originalPrisma.speciesBiome.delete;
  if (originalPrisma.species.findUnique) prisma.species.findUnique = originalPrisma.species.findUnique;
  if (originalPrisma.biome.findUnique) prisma.biome.findUnique = originalPrisma.biome.findUnique;
}

mockPrisma();
if (typeof test.after === 'function') {
  test.after(() => {
    restorePrisma();
  });
} else {
  process.on('exit', restorePrisma);
}

async function createSpeciesBiome(data = {}) {
  return prisma.speciesBiome.create({
    data: {
      speciesId: 'species-1',
      biomeId: 'biome-1',
      presence: 'resident',
      ...data,
    },
  });
}

async function startServer() {
  const app = createApp();
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { server, baseUrl };
}

async function closeServer(server) {
  await new Promise(resolve => server.close(resolve));
}

test('POST /api/species-biomes creates a new entry for authorized users', async () => {
  resetData();

  const { server, baseUrl } = await startServer();
  const payload = {
    speciesId: 'species-1',
    biomeId: 'biome-2',
    presence: 'resident',
    notes: 'Observed frequently',
  };

  const response = await fetch(`${baseUrl}/api/species-biomes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  await closeServer(server);

  assert.equal(response.status, 201);
  assert.ok(body.id);
  assert.equal(body.speciesId, payload.speciesId);
  assert.equal(body.biomeId, payload.biomeId);
  assert.equal(body.presence, payload.presence);
  assert.equal(body.notes, payload.notes);
});

test('POST /api/species-biomes denies access to unauthorized users', async () => {
  resetData();

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/species-biomes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      speciesId: 'species-1',
      biomeId: 'biome-1',
      presence: 'resident',
    }),
  });
  await closeServer(server);

  assert.equal(response.status, 403);
});

test('PATCH /api/species-biomes/:id returns 404 for missing records', async () => {
  resetData();

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/species-biomes/missing`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
    body: JSON.stringify({ notes: 'Ignored' }),
  });
  await closeServer(server);

  assert.equal(response.status, 404);
});

test('POST /api/species-biomes returns 409 when the relation already exists', async () => {
  resetData();
  await createSpeciesBiome({ speciesId: 'species-1', biomeId: 'biome-1' });

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/species-biomes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
    body: JSON.stringify({
      speciesId: 'species-1',
      biomeId: 'biome-1',
      presence: 'resident',
    }),
  });
  await closeServer(server);

  assert.equal(response.status, 409);
});
