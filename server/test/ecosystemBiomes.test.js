const test = require('node:test');
const assert = require('node:assert/strict');
const createApp = require('../app');
const prisma = require('../db/prisma');

const TAXONOMY_ROLE = 'taxonomy:write';

const originalPrisma = {
  ecosystemBiome: {
    findMany: prisma.ecosystemBiome?.findMany,
    findUnique: prisma.ecosystemBiome?.findUnique,
    create: prisma.ecosystemBiome?.create,
    update: prisma.ecosystemBiome?.update,
    delete: prisma.ecosystemBiome?.delete,
  },
  ecosystem: {
    findUnique: prisma.ecosystem?.findUnique,
  },
  biome: {
    findUnique: prisma.biome?.findUnique,
  },
};

const ecosystemRecords = new Map();
const biomeRecords = new Map();
const ecosystemBiomeStore = new Map();
let idCounter = 1;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function resetData() {
  ecosystemRecords.clear();
  ecosystemRecords.set('ecosystem-1', {
    id: 'ecosystem-1',
    slug: 'ecosystem-1',
    name: 'Ecosystem One',
  });
  ecosystemRecords.set('ecosystem-2', {
    id: 'ecosystem-2',
    slug: 'ecosystem-2',
    name: 'Ecosystem Two',
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

  ecosystemBiomeStore.clear();
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
    if (a.ecosystemId !== b.ecosystemId) return a.ecosystemId.localeCompare(b.ecosystemId);
    if (a.biomeId !== b.biomeId) return a.biomeId.localeCompare(b.biomeId);
    return 0;
  });
}

function hasDuplicateCombination(id, ecosystemId, biomeId) {
  for (const [storedId, record] of ecosystemBiomeStore.entries()) {
    if (storedId === id) continue;
    if (record.ecosystemId === ecosystemId && record.biomeId === biomeId) {
      return true;
    }
  }
  return false;
}

function mockPrisma() {
  prisma.ecosystem.findUnique = async ({ where }) => {
    if (!where) return null;
    if (where.id) return clone(ecosystemRecords.get(where.id)) || null;
    return null;
  };

  prisma.biome.findUnique = async ({ where }) => {
    if (!where) return null;
    if (where.id) return clone(biomeRecords.get(where.id)) || null;
    return null;
  };

  prisma.ecosystemBiome.findMany = async ({ where } = {}) => {
    const items = Array.from(ecosystemBiomeStore.values()).filter(item => matchesWhere(item, where));
    return sortRecords(items).map(clone);
  };

  prisma.ecosystemBiome.findUnique = async ({ where }) => {
    if (!where || !where.id) return null;
    const found = ecosystemBiomeStore.get(where.id);
    return clone(found) || null;
  };

  prisma.ecosystemBiome.create = async ({ data }) => {
    if (hasDuplicateCombination(null, data.ecosystemId, data.biomeId)) {
      const error = new Error('Unique constraint failed');
      error.code = 'P2002';
      throw error;
    }
    const id = `eb_${idCounter++}`;
    const record = { id, ...data };
    ecosystemBiomeStore.set(id, clone(record));
    return clone(record);
  };

  prisma.ecosystemBiome.update = async ({ where, data }) => {
    if (!where || !where.id) throw new Error('Missing id in update');
    const existing = ecosystemBiomeStore.get(where.id);
    if (!existing) throw new Error('Record not found');
    if (hasDuplicateCombination(where.id, data.ecosystemId ?? existing.ecosystemId, data.biomeId ?? existing.biomeId)) {
      const error = new Error('Unique constraint failed');
      error.code = 'P2002';
      throw error;
    }
    const next = { ...existing, ...data };
    ecosystemBiomeStore.set(where.id, clone(next));
    return clone(next);
  };

  prisma.ecosystemBiome.delete = async ({ where }) => {
    if (!where || !where.id) throw new Error('Missing id in delete');
    const existing = ecosystemBiomeStore.get(where.id);
    if (!existing) throw new Error('Record not found');
    ecosystemBiomeStore.delete(where.id);
    return clone(existing);
  };
}

function restorePrisma() {
  if (originalPrisma.ecosystemBiome.findMany) prisma.ecosystemBiome.findMany = originalPrisma.ecosystemBiome.findMany;
  if (originalPrisma.ecosystemBiome.findUnique) prisma.ecosystemBiome.findUnique = originalPrisma.ecosystemBiome.findUnique;
  if (originalPrisma.ecosystemBiome.create) prisma.ecosystemBiome.create = originalPrisma.ecosystemBiome.create;
  if (originalPrisma.ecosystemBiome.update) prisma.ecosystemBiome.update = originalPrisma.ecosystemBiome.update;
  if (originalPrisma.ecosystemBiome.delete) prisma.ecosystemBiome.delete = originalPrisma.ecosystemBiome.delete;
  if (originalPrisma.ecosystem.findUnique) prisma.ecosystem.findUnique = originalPrisma.ecosystem.findUnique;
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

async function createEcosystemBiome(data = {}) {
  return prisma.ecosystemBiome.create({
    data: {
      ecosystemId: 'ecosystem-1',
      biomeId: 'biome-1',
      proportion: 0.5,
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

test('GET /api/ecosystem-biomes filters by ecosystemId', async () => {
  resetData();
  await createEcosystemBiome({ ecosystemId: 'ecosystem-1', biomeId: 'biome-1' });
  await createEcosystemBiome({ ecosystemId: 'ecosystem-2', biomeId: 'biome-2', proportion: 0.8 });

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/ecosystem-biomes?ecosystemId=ecosystem-2`);
  const body = await response.json();
  await closeServer(server);

  assert.equal(response.status, 200);
  assert.equal(Array.isArray(body), true);
  assert.equal(body.length, 1);
  assert.equal(body[0].ecosystemId, 'ecosystem-2');
  assert.equal(body[0].biomeId, 'biome-2');
});

test('POST /api/ecosystem-biomes creates a new entry for authorized users', async () => {
  resetData();

  const { server, baseUrl } = await startServer();
  const payload = {
    ecosystemId: 'ecosystem-1',
    biomeId: 'biome-2',
    proportion: 0.4,
    notes: 'Primary biome',
  };

  const response = await fetch(`${baseUrl}/api/ecosystem-biomes`, {
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
  assert.equal(body.ecosystemId, payload.ecosystemId);
  assert.equal(body.biomeId, payload.biomeId);
  assert.equal(body.proportion, payload.proportion);
  assert.equal(body.notes, payload.notes);
});

test('POST /api/ecosystem-biomes denies access to unauthorized users', async () => {
  resetData();

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/ecosystem-biomes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ecosystemId: 'ecosystem-1',
      biomeId: 'biome-1',
    }),
  });
  await closeServer(server);

  assert.equal(response.status, 403);
});

test('POST /api/ecosystem-biomes validates required identifiers', async () => {
  resetData();

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/ecosystem-biomes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
    body: JSON.stringify({
      biomeId: 'biome-1',
    }),
  });
  const body = await response.json();
  await closeServer(server);

  assert.equal(response.status, 400);
  assert.equal(body.error, 'ecosystemId is required');
});

test('POST /api/ecosystem-biomes validates referenced records', async () => {
  resetData();

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/ecosystem-biomes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
    body: JSON.stringify({
      ecosystemId: 'missing',
      biomeId: 'biome-1',
    }),
  });
  const body = await response.json();
  await closeServer(server);

  assert.equal(response.status, 400);
  assert.equal(body.error, 'Invalid ecosystemId');
});

test('POST /api/ecosystem-biomes rejects invalid proportion values', async () => {
  resetData();

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/ecosystem-biomes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
    body: JSON.stringify({
      ecosystemId: 'ecosystem-1',
      biomeId: 'biome-1',
      proportion: 'not-a-number',
    }),
  });
  const body = await response.json();
  await closeServer(server);

  assert.equal(response.status, 400);
  assert.equal(body.error, 'proportion must be a number');
});

test('POST /api/ecosystem-biomes returns 409 when the relation already exists', async () => {
  resetData();
  await createEcosystemBiome({ ecosystemId: 'ecosystem-1', biomeId: 'biome-1' });

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/ecosystem-biomes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
    body: JSON.stringify({
      ecosystemId: 'ecosystem-1',
      biomeId: 'biome-1',
    }),
  });
  await closeServer(server);

  assert.equal(response.status, 409);
});

test('PATCH /api/ecosystem-biomes/:id returns 404 for missing records', async () => {
  resetData();

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/ecosystem-biomes/missing`, {
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

test('PATCH /api/ecosystem-biomes/:id updates existing records', async () => {
  resetData();
  const created = await createEcosystemBiome({ notes: 'Old notes' });

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/ecosystem-biomes/${created.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
    body: JSON.stringify({
      proportion: 0.9,
      notes: 'Updated notes',
    }),
  });
  const body = await response.json();
  await closeServer(server);

  assert.equal(response.status, 200);
  assert.equal(body.id, created.id);
  assert.equal(body.proportion, 0.9);
  assert.equal(body.notes, 'Updated notes');
});

test('PATCH /api/ecosystem-biomes/:id validates referenced records when updating', async () => {
  resetData();
  const created = await createEcosystemBiome();

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/ecosystem-biomes/${created.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
    body: JSON.stringify({
      biomeId: 'missing',
    }),
  });
  const body = await response.json();
  await closeServer(server);

  assert.equal(response.status, 400);
  assert.equal(body.error, 'Invalid biomeId');
});

test('DELETE /api/ecosystem-biomes/:id removes existing records', async () => {
  resetData();
  const created = await createEcosystemBiome();

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/ecosystem-biomes/${created.id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
  });
  await closeServer(server);

  assert.equal(response.status, 204);
  assert.equal(ecosystemBiomeStore.has(created.id), false);
});

test('DELETE /api/ecosystem-biomes/:id returns 404 for missing records', async () => {
  resetData();

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/ecosystem-biomes/missing`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
  });
  await closeServer(server);

  assert.equal(response.status, 404);
});
