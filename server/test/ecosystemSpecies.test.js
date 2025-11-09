const test = require('node:test');
const assert = require('node:assert/strict');
const createApp = require('../app');
const prisma = require('../db/prisma');

const TAXONOMY_ROLE = 'taxonomy:write';

const originalPrisma = {
  ecosystemSpecies: {
    findMany: prisma.ecosystemSpecies?.findMany,
    findUnique: prisma.ecosystemSpecies?.findUnique,
    create: prisma.ecosystemSpecies?.create,
    update: prisma.ecosystemSpecies?.update,
    delete: prisma.ecosystemSpecies?.delete,
  },
  ecosystem: {
    findUnique: prisma.ecosystem?.findUnique,
  },
  species: {
    findUnique: prisma.species?.findUnique,
  },
};

const ecosystemRecords = new Map();
const speciesRecords = new Map();
const ecosystemSpeciesStore = new Map();
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

  ecosystemSpeciesStore.clear();
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
  return items
    .slice()
    .sort((a, b) => {
      if (a.ecosystemId !== b.ecosystemId) {
        return a.ecosystemId.localeCompare(b.ecosystemId);
      }
      if (a.speciesId !== b.speciesId) {
        return a.speciesId.localeCompare(b.speciesId);
      }
      return a.role.localeCompare(b.role);
    });
}

function hasDuplicateCombination(id, ecosystemId, speciesId, role) {
  for (const [storedId, record] of ecosystemSpeciesStore.entries()) {
    if (storedId === id) continue;
    if (
      record.ecosystemId === ecosystemId &&
      record.speciesId === speciesId &&
      record.role === role
    ) {
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

  prisma.species.findUnique = async ({ where }) => {
    if (!where) return null;
    if (where.id) return clone(speciesRecords.get(where.id)) || null;
    return null;
  };

  prisma.ecosystemSpecies.findMany = async ({ where } = {}) => {
    const items = Array.from(ecosystemSpeciesStore.values()).filter(item =>
      matchesWhere(item, where),
    );
    return sortRecords(items).map(clone);
  };

  prisma.ecosystemSpecies.findUnique = async ({ where }) => {
    if (!where || !where.id) return null;
    const found = ecosystemSpeciesStore.get(where.id);
    return clone(found) || null;
  };

  prisma.ecosystemSpecies.create = async ({ data }) => {
    if (hasDuplicateCombination(null, data.ecosystemId, data.speciesId, data.role)) {
      const error = new Error('Unique constraint failed');
      error.code = 'P2002';
      throw error;
    }
    const id = `es_${idCounter++}`;
    const record = { id, ...data };
    ecosystemSpeciesStore.set(id, clone(record));
    return clone(record);
  };

  prisma.ecosystemSpecies.update = async ({ where, data }) => {
    if (!where || !where.id) throw new Error('Missing id in update');
    const existing = ecosystemSpeciesStore.get(where.id);
    if (!existing) throw new Error('Record not found');
    if (
      hasDuplicateCombination(
        where.id,
        data.ecosystemId ?? existing.ecosystemId,
        data.speciesId ?? existing.speciesId,
        data.role ?? existing.role,
      )
    ) {
      const error = new Error('Unique constraint failed');
      error.code = 'P2002';
      throw error;
    }
    const next = { ...existing, ...data };
    ecosystemSpeciesStore.set(where.id, clone(next));
    return clone(next);
  };

  prisma.ecosystemSpecies.delete = async ({ where }) => {
    if (!where || !where.id) throw new Error('Missing id in delete');
    const existing = ecosystemSpeciesStore.get(where.id);
    if (!existing) throw new Error('Record not found');
    ecosystemSpeciesStore.delete(where.id);
    return clone(existing);
  };
}

function restorePrisma() {
  if (originalPrisma.ecosystemSpecies.findMany) prisma.ecosystemSpecies.findMany = originalPrisma.ecosystemSpecies.findMany;
  if (originalPrisma.ecosystemSpecies.findUnique) prisma.ecosystemSpecies.findUnique = originalPrisma.ecosystemSpecies.findUnique;
  if (originalPrisma.ecosystemSpecies.create) prisma.ecosystemSpecies.create = originalPrisma.ecosystemSpecies.create;
  if (originalPrisma.ecosystemSpecies.update) prisma.ecosystemSpecies.update = originalPrisma.ecosystemSpecies.update;
  if (originalPrisma.ecosystemSpecies.delete) prisma.ecosystemSpecies.delete = originalPrisma.ecosystemSpecies.delete;
  if (originalPrisma.ecosystem.findUnique) prisma.ecosystem.findUnique = originalPrisma.ecosystem.findUnique;
  if (originalPrisma.species.findUnique) prisma.species.findUnique = originalPrisma.species.findUnique;
}

mockPrisma();
if (typeof test.after === 'function') {
  test.after(() => {
    restorePrisma();
  });
} else {
  process.on('exit', restorePrisma);
}

async function createEcosystemSpecies(data = {}) {
  return prisma.ecosystemSpecies.create({
    data: {
      ecosystemId: 'ecosystem-1',
      speciesId: 'species-1',
      role: 'keystone',
      abundance: 0.3,
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

test('POST /api/ecosystem-species creates a new entry for authorized users', async () => {
  resetData();

  const { server, baseUrl } = await startServer();
  const payload = {
    ecosystemId: 'ecosystem-1',
    speciesId: 'species-2',
    role: 'keystone',
    abundance: 0.2,
    notes: 'Important species',
  };

  const response = await fetch(`${baseUrl}/api/ecosystem-species`, {
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
  assert.equal(body.ecosystemId, payload.ecosystemId);
  assert.equal(body.speciesId, payload.speciesId);
  assert.equal(body.role, payload.role);
  assert.equal(body.notes, payload.notes);
  assert.equal(body.abundance, payload.abundance);
});

test('POST /api/ecosystem-species returns 403 without taxonomy role', async () => {
  resetData();

  const { server, baseUrl } = await startServer();
  const payload = {
    ecosystemId: 'ecosystem-1',
    speciesId: 'species-2',
    role: 'keystone',
  };

  const response = await fetch(`${baseUrl}/api/ecosystem-species`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  await closeServer(server);

  assert.equal(response.status, 403);
});

test('PATCH /api/ecosystem-species/:id returns 404 for missing record', async () => {
  resetData();

  const { server, baseUrl } = await startServer();

  const response = await fetch(`${baseUrl}/api/ecosystem-species/missing`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
    body: JSON.stringify({ notes: 'Updated' }),
  });

  await closeServer(server);

  assert.equal(response.status, 404);
});

test('POST /api/ecosystem-species returns 409 when duplicate combination is created', async () => {
  resetData();
  await createEcosystemSpecies({
    ecosystemId: 'ecosystem-1',
    speciesId: 'species-1',
    role: 'keystone',
  });

  const { server, baseUrl } = await startServer();

  const response = await fetch(`${baseUrl}/api/ecosystem-species`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
    body: JSON.stringify({
      ecosystemId: 'ecosystem-1',
      speciesId: 'species-1',
      role: 'keystone',
    }),
  });

  await closeServer(server);

  assert.equal(response.status, 409);
});
