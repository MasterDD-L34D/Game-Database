const createApp = require('../app');
const prisma = require('../db/prisma');

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeSlug(value, fallback) {
  if (!value && !fallback) return '';
  const base = value || fallback || '';
  const normalized = base.toString().trim().toLowerCase().replace(/\s+/g, '-');
  return normalized || (fallback || '').toString();
}

function matchesValue(record, key, condition) {
  if (condition && typeof condition === 'object' && Array.isArray(condition.in)) {
    return condition.in.includes(record[key]);
  }
  if (condition && typeof condition === 'object' && 'contains' in condition) {
    const recordValue = (record[key] ?? '').toString().toLowerCase();
    return recordValue.includes(condition.contains.toString().toLowerCase());
  }
  return record[key] === condition;
}

function matchesWhere(record, where = {}) {
  if (!where || !Object.keys(where).length) return true;
  if (Array.isArray(where.OR)) {
    return where.OR.some(condition => matchesWhere(record, condition));
  }
  return Object.entries(where).every(([key, value]) => matchesValue(record, key, value));
}

function applyOrder(items, orderBy) {
  if (!orderBy) return items.slice();
  const entries = Array.isArray(orderBy) ? orderBy : [orderBy];
  return items.slice().sort((a, b) => {
    for (const entry of entries) {
      const [[key, direction]] = Object.entries(entry);
      const factor = direction === 'desc' ? -1 : 1;
      const aValue = a[key] ?? '';
      const bValue = b[key] ?? '';
      const comparison = aValue.toString().localeCompare(bValue.toString());
      if (comparison !== 0) return comparison * factor;
    }
    return 0;
  });
}

function filterRecords(store, where) {
  const items = Array.from(store.values());
  if (!where || !Object.keys(where).length) return items;
  return items.filter(item => matchesWhere(item, where));
}

function findBySlug(store, slug) {
  for (const record of store.values()) {
    if (record.slug === slug) return record;
  }
  return null;
}

function ensureUniqueSlug(store, slug, id) {
  if (!slug) return;
  for (const [storedId, record] of store.entries()) {
    if (storedId !== id && record.slug === slug) {
      throw new Error('Slug already exists');
    }
  }
}

function createTaxonomyTestContext() {
  const stores = {
    species: new Map(),
    trait: new Map(),
    biome: new Map(),
    ecosystem: new Map(),
    speciesTrait: new Map(),
    speciesBiome: new Map(),
    ecosystemBiome: new Map(),
    ecosystemSpecies: new Map(),
  };

  const counters = {
    species: 1,
    trait: 1,
    biome: 1,
    ecosystem: 1,
    speciesTrait: 1,
    speciesBiome: 1,
    ecosystemBiome: 1,
    ecosystemSpecies: 1,
  };

  const original = {
    species: {
      count: prisma.species?.count,
      findMany: prisma.species?.findMany,
      findFirst: prisma.species?.findFirst,
      findUnique: prisma.species?.findUnique,
    },
    trait: {
      count: prisma.trait?.count,
      findMany: prisma.trait?.findMany,
      findFirst: prisma.trait?.findFirst,
      findUnique: prisma.trait?.findUnique,
    },
    biome: {
      count: prisma.biome?.count,
      findMany: prisma.biome?.findMany,
      findFirst: prisma.biome?.findFirst,
      findUnique: prisma.biome?.findUnique,
    },
    ecosystem: {
      count: prisma.ecosystem?.count,
      findMany: prisma.ecosystem?.findMany,
      findFirst: prisma.ecosystem?.findFirst,
      findUnique: prisma.ecosystem?.findUnique,
    },
    speciesTrait: {
      findMany: prisma.speciesTrait?.findMany,
    },
    speciesBiome: {
      findMany: prisma.speciesBiome?.findMany,
    },
    ecosystemBiome: {
      findMany: prisma.ecosystemBiome?.findMany,
    },
    ecosystemSpecies: {
      findMany: prisma.ecosystemSpecies?.findMany,
    },
  };

  function nextId(type) {
    const value = counters[type];
    counters[type] += 1;
    return `${type}-${value}`;
  }

  function createSpecies(data = {}) {
    const id = data.id ?? nextId('species');
    const scientificName = data.scientificName ?? `Species ${id}`;
    const slug = normalizeSlug(data.slug, data.commonName || scientificName || id) || id;
    const record = {
      id,
      slug,
      scientificName,
      commonName: data.commonName ?? null,
      kingdom: data.kingdom ?? null,
      phylum: data.phylum ?? null,
      class: data.class ?? null,
      order: data.order ?? null,
      family: data.family ?? null,
      genus: data.genus ?? null,
      epithet: data.epithet ?? null,
      status: data.status ?? null,
      description: data.description ?? null,
    };
    ensureUniqueSlug(stores.species, record.slug, id);
    stores.species.set(id, clone(record));
    return clone(record);
  }

  function createTrait(data = {}) {
    const id = data.id ?? nextId('trait');
    const name = data.name ?? `Trait ${id}`;
    const slug = normalizeSlug(data.slug, name || id) || id;
    const record = {
      id,
      slug,
      name,
      description: data.description ?? null,
      category: data.category ?? null,
      unit: data.unit ?? null,
      dataType: data.dataType ?? 'TEXT',
      allowedValues: data.allowedValues ?? null,
      rangeMin: data.rangeMin ?? null,
      rangeMax: data.rangeMax ?? null,
    };
    ensureUniqueSlug(stores.trait, record.slug, id);
    stores.trait.set(id, clone(record));
    return clone(record);
  }

  function createBiome(data = {}) {
    const id = data.id ?? nextId('biome');
    const name = data.name ?? `Biome ${id}`;
    const slug = normalizeSlug(data.slug, name || id) || id;
    const record = {
      id,
      slug,
      name,
      description: data.description ?? null,
      climate: data.climate ?? null,
      parentId: data.parentId ?? null,
    };
    ensureUniqueSlug(stores.biome, record.slug, id);
    stores.biome.set(id, clone(record));
    return clone(record);
  }

  function createEcosystem(data = {}) {
    const id = data.id ?? nextId('ecosystem');
    const name = data.name ?? `Ecosystem ${id}`;
    const slug = normalizeSlug(data.slug, name || id) || id;
    const record = {
      id,
      slug,
      name,
      description: data.description ?? null,
      region: data.region ?? null,
      climate: data.climate ?? null,
    };
    ensureUniqueSlug(stores.ecosystem, record.slug, id);
    stores.ecosystem.set(id, clone(record));
    return clone(record);
  }

  function createSpeciesTrait(data = {}) {
    const id = data.id ?? nextId('speciesTrait');
    const record = {
      id,
      speciesId: data.speciesId ?? createSpecies().id,
      traitId: data.traitId ?? createTrait().id,
      value: data.value ?? null,
      num: data.num ?? null,
      bool: data.bool ?? null,
      text: data.text ?? null,
      category: data.category ?? null,
      unit: data.unit ?? null,
      source: data.source ?? null,
      confidence: data.confidence ?? null,
    };
    stores.speciesTrait.set(id, clone(record));
    return clone(record);
  }

  function createSpeciesBiome(data = {}) {
    const id = data.id ?? nextId('speciesBiome');
    const record = {
      id,
      speciesId: data.speciesId ?? createSpecies().id,
      biomeId: data.biomeId ?? createBiome().id,
      presence: data.presence ?? 'resident',
      abundance: data.abundance ?? null,
      notes: data.notes ?? null,
    };
    stores.speciesBiome.set(id, clone(record));
    return clone(record);
  }

  function createEcosystemBiome(data = {}) {
    const id = data.id ?? nextId('ecosystemBiome');
    const record = {
      id,
      ecosystemId: data.ecosystemId ?? createEcosystem().id,
      biomeId: data.biomeId ?? createBiome().id,
      proportion: data.proportion ?? null,
      notes: data.notes ?? null,
    };
    stores.ecosystemBiome.set(id, clone(record));
    return clone(record);
  }

  function createEcosystemSpecies(data = {}) {
    const id = data.id ?? nextId('ecosystemSpecies');
    const record = {
      id,
      ecosystemId: data.ecosystemId ?? createEcosystem().id,
      speciesId: data.speciesId ?? createSpecies().id,
      role: data.role ?? 'common',
      abundance: data.abundance ?? null,
      notes: data.notes ?? null,
    };
    stores.ecosystemSpecies.set(id, clone(record));
    return clone(record);
  }

  function createModelMock(model, store, defaultOrderKey) {
    prisma[model].count = async ({ where } = {}) => filterRecords(store, where).length;
    prisma[model].findMany = async ({ where, skip = 0, take, orderBy } = {}) => {
      const filtered = filterRecords(store, where);
      const ordered = applyOrder(filtered, orderBy || { [defaultOrderKey]: 'asc' });
      const end = typeof take === 'number' ? skip + take : undefined;
      return ordered.slice(skip, end).map(clone);
    };
    prisma[model].findFirst = async ({ where, orderBy } = {}) => {
      const filtered = filterRecords(store, where);
      const ordered = applyOrder(filtered, orderBy || { [defaultOrderKey]: 'asc' });
      const item = ordered[0];
      return item ? clone(item) : null;
    };
    prisma[model].findUnique = async ({ where } = {}) => {
      if (!where) return null;
      if (where.id) {
        const found = store.get(where.id);
        return found ? clone(found) : null;
      }
      if (where.slug) {
        const found = findBySlug(store, where.slug);
        return found ? clone(found) : null;
      }
      return null;
    };
  }

  function mock() {
    createModelMock('species', stores.species, 'scientificName');
    createModelMock('trait', stores.trait, 'name');
    createModelMock('biome', stores.biome, 'name');
    createModelMock('ecosystem', stores.ecosystem, 'name');
    prisma.speciesTrait.findMany = async ({ where, orderBy } = {}) => applyOrder(filterRecords(stores.speciesTrait, where), orderBy).map(clone);
    prisma.speciesBiome.findMany = async ({ where, orderBy } = {}) => applyOrder(filterRecords(stores.speciesBiome, where), orderBy).map(clone);
    prisma.ecosystemBiome.findMany = async ({ where, orderBy } = {}) => applyOrder(filterRecords(stores.ecosystemBiome, where), orderBy).map(clone);
    prisma.ecosystemSpecies.findMany = async ({ where, orderBy } = {}) => applyOrder(filterRecords(stores.ecosystemSpecies, where), orderBy).map(clone);
  }

  function restore() {
    if (original.species.count) prisma.species.count = original.species.count;
    if (original.species.findMany) prisma.species.findMany = original.species.findMany;
    if (original.species.findFirst) prisma.species.findFirst = original.species.findFirst;
    if (original.species.findUnique) prisma.species.findUnique = original.species.findUnique;

    if (original.trait.count) prisma.trait.count = original.trait.count;
    if (original.trait.findMany) prisma.trait.findMany = original.trait.findMany;
    if (original.trait.findFirst) prisma.trait.findFirst = original.trait.findFirst;
    if (original.trait.findUnique) prisma.trait.findUnique = original.trait.findUnique;

    if (original.biome.count) prisma.biome.count = original.biome.count;
    if (original.biome.findMany) prisma.biome.findMany = original.biome.findMany;
    if (original.biome.findFirst) prisma.biome.findFirst = original.biome.findFirst;
    if (original.biome.findUnique) prisma.biome.findUnique = original.biome.findUnique;

    if (original.ecosystem.count) prisma.ecosystem.count = original.ecosystem.count;
    if (original.ecosystem.findMany) prisma.ecosystem.findMany = original.ecosystem.findMany;
    if (original.ecosystem.findFirst) prisma.ecosystem.findFirst = original.ecosystem.findFirst;
    if (original.ecosystem.findUnique) prisma.ecosystem.findUnique = original.ecosystem.findUnique;
    if (original.speciesTrait.findMany) prisma.speciesTrait.findMany = original.speciesTrait.findMany;
    if (original.speciesBiome.findMany) prisma.speciesBiome.findMany = original.speciesBiome.findMany;
    if (original.ecosystemBiome.findMany) prisma.ecosystemBiome.findMany = original.ecosystemBiome.findMany;
    if (original.ecosystemSpecies.findMany) prisma.ecosystemSpecies.findMany = original.ecosystemSpecies.findMany;
  }

  function reset() {
    stores.species.clear();
    stores.trait.clear();
    stores.biome.clear();
    stores.ecosystem.clear();
    counters.species = 1;
    counters.trait = 1;
    counters.biome = 1;
    counters.ecosystem = 1;
    counters.speciesTrait = 1;
    counters.speciesBiome = 1;
    counters.ecosystemBiome = 1;
    counters.ecosystemSpecies = 1;
    stores.speciesTrait.clear();
    stores.speciesBiome.clear();
    stores.ecosystemBiome.clear();
    stores.ecosystemSpecies.clear();
  }

  return {
    mock,
    restore,
    reset,
    createSpecies,
    createTrait,
    createBiome,
    createEcosystem,
    createSpeciesTrait,
    createSpeciesBiome,
    createEcosystemBiome,
    createEcosystemSpecies,
  };
}

async function startServer() {
  const app = createApp();
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const address = server.address();
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function closeServer(server) {
  await new Promise(resolve => server.close(resolve));
}

module.exports = {
  startServer,
  closeServer,
  createTaxonomyTestContext,
};
