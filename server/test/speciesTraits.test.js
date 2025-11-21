const test = require('node:test');
const assert = require('node:assert/strict');
const createApp = require('../app');
const prisma = require('../db/prisma');

const TAXONOMY_ROLE = 'taxonomy:write';

const originalPrisma = {
  speciesTrait: {
    findMany: prisma.speciesTrait?.findMany,
    findFirst: prisma.speciesTrait?.findFirst,
    findUnique: prisma.speciesTrait?.findUnique,
    create: prisma.speciesTrait?.create,
    update: prisma.speciesTrait?.update,
    delete: prisma.speciesTrait?.delete,
  },
  species: {
    findUnique: prisma.species?.findUnique,
  },
  trait: {
    findUnique: prisma.trait?.findUnique,
  },
};

const speciesRecords = new Map();
const traitRecords = new Map();
const speciesTraitStore = new Map();
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

  traitRecords.clear();
  traitRecords.set('trait-1', {
    id: 'trait-1',
    slug: 'trait-1',
    name: 'Trait One',
    dataType: 'TEXT',
  });
  traitRecords.set('trait-2', {
    id: 'trait-2',
    slug: 'trait-2',
    name: 'Trait Two',
    dataType: 'TEXT',
  });
  traitRecords.set('trait-3', {
    id: 'trait-3',
    slug: 'trait-3',
    name: 'Trait Numeric',
    dataType: 'NUMERIC',
  });
  traitRecords.set('trait-4', {
    id: 'trait-4',
    slug: 'trait-4',
    name: 'Trait Boolean',
    dataType: 'BOOLEAN',
  });
  traitRecords.set('trait-5', {
    id: 'trait-5',
    slug: 'trait-5',
    name: 'Trait Categorical',
    dataType: 'CATEGORICAL',
    allowedValues: ['value-a', 'value-b'],
  });

  speciesTraitStore.clear();
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
    if (a.traitId !== b.traitId) return a.traitId.localeCompare(b.traitId);
    const categoryA = a.category || '';
    const categoryB = b.category || '';
    return categoryA.localeCompare(categoryB);
  });
}

function mockPrisma() {
  prisma.species.findUnique = async ({ where }) => {
    if (!where) return null;
    if (where.id) return clone(speciesRecords.get(where.id)) || null;
    return null;
  };

  prisma.trait.findUnique = async ({ where }) => {
    if (!where) return null;
    if (where.id) return clone(traitRecords.get(where.id)) || null;
    return null;
  };

  prisma.speciesTrait.findMany = async ({ where } = {}) => {
    const items = Array.from(speciesTraitStore.values()).filter(item => matchesWhere(item, where));
    return sortRecords(items).map(clone);
  };

  prisma.speciesTrait.findFirst = async ({ where } = {}) => {
    const items = await prisma.speciesTrait.findMany({ where });
    return items[0] || null;
  };

  prisma.speciesTrait.findUnique = async ({ where }) => {
    if (!where || !where.id) return null;
    const found = speciesTraitStore.get(where.id);
    return clone(found) || null;
  };

  prisma.speciesTrait.create = async ({ data }) => {
    const id = `st_${idCounter++}`;
    const record = { id, ...data };
    speciesTraitStore.set(id, clone(record));
    return clone(record);
  };

  prisma.speciesTrait.update = async ({ where, data }) => {
    if (!where || !where.id) throw new Error('Missing id in update');
    const existing = speciesTraitStore.get(where.id);
    if (!existing) throw new Error('Record not found');
    const next = { ...existing, ...data };
    speciesTraitStore.set(where.id, clone(next));
    return clone(next);
  };

  prisma.speciesTrait.delete = async ({ where }) => {
    if (!where || !where.id) throw new Error('Missing id in delete');
    const existing = speciesTraitStore.get(where.id);
    if (!existing) throw new Error('Record not found');
    speciesTraitStore.delete(where.id);
    return clone(existing);
  };
}

function restorePrisma() {
  if (originalPrisma.speciesTrait.findMany) prisma.speciesTrait.findMany = originalPrisma.speciesTrait.findMany;
  if (originalPrisma.speciesTrait.findFirst) prisma.speciesTrait.findFirst = originalPrisma.speciesTrait.findFirst;
  if (originalPrisma.speciesTrait.findUnique) prisma.speciesTrait.findUnique = originalPrisma.speciesTrait.findUnique;
  if (originalPrisma.speciesTrait.create) prisma.speciesTrait.create = originalPrisma.speciesTrait.create;
  if (originalPrisma.speciesTrait.update) prisma.speciesTrait.update = originalPrisma.speciesTrait.update;
  if (originalPrisma.speciesTrait.delete) prisma.speciesTrait.delete = originalPrisma.speciesTrait.delete;
  if (originalPrisma.species.findUnique) prisma.species.findUnique = originalPrisma.species.findUnique;
  if (originalPrisma.trait.findUnique) prisma.trait.findUnique = originalPrisma.trait.findUnique;
}

mockPrisma();
if (typeof test.after === 'function') {
  test.after(() => {
    restorePrisma();
  });
} else {
  process.on('exit', restorePrisma);
}

async function createSpeciesTrait(data = {}) {
  return prisma.speciesTrait.create({
    data: {
      speciesId: 'species-1',
      traitId: 'trait-1',
      category: 'baseline',
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

test('GET /api/species-traits returns existing records', async () => {
  resetData();
  await createSpeciesTrait({ text: 'Initial trait' });

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/species-traits`);
  await closeServer(server);

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 1);
  assert.equal(body[0].text, 'Initial trait');
});

test('POST /api/species-traits creates a new entry for authorized users', async () => {
  resetData();

  const { server, baseUrl } = await startServer();
  const payload = {
    speciesId: 'species-1',
    traitId: 'trait-2',
    text: 'New trait data',
  };

  const response = await fetch(`${baseUrl}/api/species-traits`, {
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
  assert.equal(body.traitId, payload.traitId);
  assert.equal(body.text, payload.text);
});

test('POST /api/species-traits rejects data incompatible with trait type', async () => {
  resetData();

  const { server, baseUrl } = await startServer();
  const payload = {
    speciesId: 'species-1',
    traitId: 'trait-3',
    text: 'Invalid for numeric trait',
  };

  const response = await fetch(`${baseUrl}/api/species-traits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  await closeServer(server);

  assert.equal(response.status, 400);
  assert.match(body.error, /Fields not allowed/);
});

test('POST /api/species-traits rejects empty values for each trait type', async () => {
  resetData();

  const { server, baseUrl } = await startServer();
  const scenarios = [
    {
      traitId: 'trait-4',
      expected: 'Provide value for boolean trait: bool',
    },
    {
      traitId: 'trait-3',
      expected: 'Provide value for numeric trait: num/confidence/unit',
    },
    {
      traitId: 'trait-5',
      expected: 'Provide value for categorical trait: value/text',
    },
    {
      traitId: 'trait-1',
      expected: 'Provide value for text trait: text/source',
    },
  ];

  for (const scenario of scenarios) {
    const response = await fetch(`${baseUrl}/api/species-traits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Roles': TAXONOMY_ROLE,
      },
      body: JSON.stringify({ speciesId: 'species-1', traitId: scenario.traitId }),
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error, scenario.expected);
  }

  await closeServer(server);
});

test('POST /api/species-traits normalizes numeric and boolean values', async () => {
  resetData();

  const { server, baseUrl } = await startServer();

  const numericResponse = await fetch(`${baseUrl}/api/species-traits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
    body: JSON.stringify({ speciesId: 'species-1', traitId: 'trait-3', num: '42.5' }),
  });
  const numericBody = await numericResponse.json();

  const booleanResponse = await fetch(`${baseUrl}/api/species-traits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
    body: JSON.stringify({ speciesId: 'species-1', traitId: 'trait-4', bool: 'true' }),
  });
  const booleanBody = await booleanResponse.json();

  await closeServer(server);

  assert.equal(numericResponse.status, 201);
  assert.equal(numericBody.num, 42.5);

  assert.equal(booleanResponse.status, 201);
  assert.equal(booleanBody.bool, true);
});

test('POST /api/species-traits rejects invalid categorical values', async () => {
  resetData();

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/species-traits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
    body: JSON.stringify({ speciesId: 'species-1', traitId: 'trait-5', value: '   ' }),
  });
  const body = await response.json();
  await closeServer(server);

  assert.equal(response.status, 400);
  assert.match(body.error, /Invalid value/);
});

test('POST /api/species-traits denies access to unauthorized users', async () => {
  resetData();

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/species-traits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      speciesId: 'species-1',
      traitId: 'trait-1',
    }),
  });
  await closeServer(server);

  assert.equal(response.status, 403);
});

test('PATCH /api/species-traits/:id updates existing entries', async () => {
  resetData();
  const existing = await createSpeciesTrait({ text: 'Before' });

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/species-traits/${existing.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
    body: JSON.stringify({ text: 'After' }),
  });
  const body = await response.json();
  await closeServer(server);

  assert.equal(response.status, 200);
  assert.equal(body.text, 'After');
});

test('PATCH /api/species-traits/:id enforces data type when traitId is unchanged', async () => {
  resetData();
  const numericTrait = await createSpeciesTrait({ traitId: 'trait-3', num: 1.5 });

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/species-traits/${numericTrait.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
    body: JSON.stringify({ text: 'Not allowed' }),
  });
  const body = await response.json();
  await closeServer(server);

  assert.equal(response.status, 400);
  assert.match(body.error, /Fields not allowed/);
});

test('PATCH /api/species-traits/:id returns 404 for missing records', async () => {
  resetData();

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/species-traits/missing`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
    body: JSON.stringify({ text: 'Ignored' }),
  });
  await closeServer(server);

  assert.equal(response.status, 404);
});

test('POST /api/species-traits enforces uniqueness on species, trait and category', async () => {
  resetData();
  await createSpeciesTrait({ category: 'baseline', text: 'Existing' });

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/species-traits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Roles': TAXONOMY_ROLE,
    },
    body: JSON.stringify({
      speciesId: 'species-1',
      traitId: 'trait-1',
      category: 'baseline',
      text: 'Another value',
    }),
  });
  await closeServer(server);

  assert.equal(response.status, 409);
});

test('DELETE /api/species-traits/:id removes an entry', async () => {
  resetData();
  const existing = await createSpeciesTrait();

  const { server, baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}/api/species-traits/${existing.id}`, {
    method: 'DELETE',
    headers: {
      'X-Roles': TAXONOMY_ROLE,
    },
  });
  await closeServer(server);

  assert.equal(response.status, 204);
  const afterDelete = await prisma.speciesTrait.findUnique({ where: { id: existing.id } });
  assert.equal(afterDelete, null);
});
