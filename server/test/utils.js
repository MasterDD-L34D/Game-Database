const createApp = require('../app');
const prisma = require('../db/prisma');
const { normalizeSlug } = require('../utils/slug');

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function matchesValue(record, key, condition) {
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
  };

  const counters = {
    species: 1,
    trait: 1,
    biome: 1,
    ecosystem: 1,
  };

  // Master ids that have a snapshot under a *released* version. Drives the
  // *Version.count mock used by the Phase A immutability delete guard.
  const releasedSnapshots = {
    species: new Set(),
    trait: new Set(),
    biome: new Set(),
    ecosystem: new Set(),
  };

  // Phase B1: in-memory TaxonomyVersion rows + snapshot rows for route tests.
  const versionStore = new Map(); // id -> version row
  let versionCounter = 1;
  const snapshotRows = {
    traitVersion: [],
    biomeVersion: [],
    speciesVersion: [],
    ecosystemVersion: [],
  };

  const original = {
    auditLog: {
      create: prisma.auditLog?.create,
    },
    traitVersion: { count: prisma.traitVersion?.count, createMany: prisma.traitVersion?.createMany },
    biomeVersion: { count: prisma.biomeVersion?.count, createMany: prisma.biomeVersion?.createMany },
    speciesVersion: { count: prisma.speciesVersion?.count, createMany: prisma.speciesVersion?.createMany },
    ecosystemVersion: { count: prisma.ecosystemVersion?.count, createMany: prisma.ecosystemVersion?.createMany },
    taxonomyVersion: {
      create: prisma.taxonomyVersion?.create,
      findUnique: prisma.taxonomyVersion?.findUnique,
      findFirst: prisma.taxonomyVersion?.findFirst,
      findMany: prisma.taxonomyVersion?.findMany,
      update: prisma.taxonomyVersion?.update,
      delete: prisma.taxonomyVersion?.delete,
    },
    $transaction: prisma.$transaction,
    species: {
      count: prisma.species?.count,
      findMany: prisma.species?.findMany,
      findFirst: prisma.species?.findFirst,
      findUnique: prisma.species?.findUnique,
      delete: prisma.species?.delete,
      update: prisma.species?.update,
    },
    trait: {
      count: prisma.trait?.count,
      findMany: prisma.trait?.findMany,
      findFirst: prisma.trait?.findFirst,
      findUnique: prisma.trait?.findUnique,
      update: prisma.trait?.update,
      delete: prisma.trait?.delete,
    },
    biome: {
      count: prisma.biome?.count,
      findMany: prisma.biome?.findMany,
      findFirst: prisma.biome?.findFirst,
      findUnique: prisma.biome?.findUnique,
      update: prisma.biome?.update,
      delete: prisma.biome?.delete,
    },
    ecosystem: {
      count: prisma.ecosystem?.count,
      findMany: prisma.ecosystem?.findMany,
      findFirst: prisma.ecosystem?.findFirst,
      findUnique: prisma.ecosystem?.findUnique,
      update: prisma.ecosystem?.update,
      delete: prisma.ecosystem?.delete,
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

    prisma[model].update = async ({ where, data } = {}) => {
      if (!where || !where.id) return null;
      const found = store.get(where.id);
      if (!found) {
        const err = new Error('Record to update not found.');
        err.code = 'P2025';
        throw err;
      }
      const updated = { ...found, ...data };
      if (data && Object.prototype.hasOwnProperty.call(data, 'slug')) {
        ensureUniqueSlug(store, data.slug, where.id);
        updated.slug = data.slug;
      }
      store.set(where.id, updated);
      return clone(updated);
    };

    prisma[model].delete = async ({ where } = {}) => {
      if (!where || !where.id) return null;
      const found = store.get(where.id);
      if (found) {
        store.delete(where.id);
        return clone(found);
      }
      return null;
    };
  }


  function createVersionMock(model) {
    const fk = `${model}Id`;
    const delegate = `${model}Version`;
    prisma[delegate] = prisma[delegate] || {};
    prisma[delegate].count = async ({ where = {} } = {}) => {
      if (where.versionId !== undefined) {
        return snapshotRows[delegate].filter((r) => r.versionId === where.versionId).length;
      }
      const isReleased = where.version && where.version.status === 'released';
      const masterId = where[fk];
      return isReleased && masterId != null && releasedSnapshots[model].has(masterId) ? 1 : 0;
    };
    prisma[delegate].createMany = async ({ data = [] } = {}) => {
      for (const row of data) snapshotRows[delegate].push(row);
      return { count: data.length };
    };
  }

  function markReleased(model, masterId) {
    releasedSnapshots[model].add(masterId);
  }

  function mock() {
    prisma.auditLog = prisma.auditLog || {};
    prisma.auditLog.create = async () => ({ id: 'audit-mock-id' });
    createModelMock('species', stores.species, 'scientificName');
    createModelMock('trait', stores.trait, 'name');
    createModelMock('biome', stores.biome, 'name');
    createModelMock('ecosystem', stores.ecosystem, 'name');
    createVersionMock('species');
    createVersionMock('trait');
    createVersionMock('biome');
    createVersionMock('ecosystem');
    prisma.$transaction = async (fn) => fn(prisma);
    prisma.taxonomyVersion = prisma.taxonomyVersion || {};
    prisma.taxonomyVersion.create = async ({ data }) => {
      if ([...versionStore.values()].some((v) => v.tag === data.tag)) {
        const err = new Error('Unique constraint failed');
        err.code = 'P2002';
        err.meta = { target: ['tag'] };
        throw err;
      }
      const id = `ver-${versionCounter}`;
      versionCounter += 1;
      const row = {
        id,
        tag: data.tag,
        status: data.status || 'draft',
        description: data.description ?? null,
        releasedAt: data.releasedAt ?? null,
        releasedBy: data.releasedBy ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      versionStore.set(id, { ...row });
      return { ...row };
    };
    prisma.taxonomyVersion.findUnique = async ({ where = {} } = {}) => {
      if (where.id) return versionStore.has(where.id) ? { ...versionStore.get(where.id) } : null;
      if (where.tag) {
        const found = [...versionStore.values()].find((v) => v.tag === where.tag);
        return found ? { ...found } : null;
      }
      return null;
    };
    // NOTE: the single-draft invariant is DB-enforced (partial unique index) in
    // production; this mock only does first-match and cannot surface a duplicate-draft bug.
    prisma.taxonomyVersion.findFirst = async ({ where = {} } = {}) => {
      const found = [...versionStore.values()].find((v) => !where.status || v.status === where.status);
      return found ? { ...found } : null;
    };
    // NOTE: only the list-endpoint query shape (`where.status.not`) is modeled.
    prisma.taxonomyVersion.findMany = async ({ where = {} } = {}) => {
      let rows = [...versionStore.values()];
      if (where.status && where.status.not) rows = rows.filter((v) => v.status !== where.status.not);
      rows.sort((a, b) => {
        const av = a.releasedAt ? new Date(a.releasedAt).getTime() : Infinity;
        const bv = b.releasedAt ? new Date(b.releasedAt).getTime() : Infinity;
        return bv - av; // releasedAt desc, nulls (drafts) first
      });
      return rows.map((v) => ({ ...v }));
    };
    prisma.taxonomyVersion.update = async ({ where = {}, data = {} } = {}) => {
      const row = versionStore.get(where.id);
      if (!row) {
        const err = new Error('Record to update not found.');
        err.code = 'P2025';
        throw err;
      }
      const updated = { ...row, ...data, updatedAt: new Date() };
      versionStore.set(where.id, updated);
      return { ...updated };
    };
    prisma.taxonomyVersion.delete = async ({ where = {} } = {}) => {
      const row = versionStore.get(where.id);
      if (!row) {
        const err = new Error('Record to delete does not exist.');
        err.code = 'P2025';
        throw err;
      }
      versionStore.delete(where.id);
      return { ...row };
    };
  }

  function restore() {
    if (original.auditLog && original.auditLog.create) prisma.auditLog.create = original.auditLog.create;
    else if (prisma.auditLog) delete prisma.auditLog.create;
    if (original.species.count) prisma.species.count = original.species.count;
    if (original.species.findMany) prisma.species.findMany = original.species.findMany;
    if (original.species.findFirst) prisma.species.findFirst = original.species.findFirst;
    if (original.species.findUnique) prisma.species.findUnique = original.species.findUnique;
    if (original.species.update) prisma.species.update = original.species.update;
    if (original.species.delete) prisma.species.delete = original.species.delete;

    if (original.trait.count) prisma.trait.count = original.trait.count;
    if (original.trait.findMany) prisma.trait.findMany = original.trait.findMany;
    if (original.trait.findFirst) prisma.trait.findFirst = original.trait.findFirst;
    if (original.trait.findUnique) prisma.trait.findUnique = original.trait.findUnique;
    if (original.trait.update) prisma.trait.update = original.trait.update;
    if (original.trait.delete) prisma.trait.delete = original.trait.delete;

    if (original.biome.count) prisma.biome.count = original.biome.count;
    if (original.biome.findMany) prisma.biome.findMany = original.biome.findMany;
    if (original.biome.findFirst) prisma.biome.findFirst = original.biome.findFirst;
    if (original.biome.findUnique) prisma.biome.findUnique = original.biome.findUnique;
    if (original.biome.update) prisma.biome.update = original.biome.update;
    if (original.biome.delete) prisma.biome.delete = original.biome.delete;

    if (original.ecosystem.count) prisma.ecosystem.count = original.ecosystem.count;
    if (original.ecosystem.findMany) prisma.ecosystem.findMany = original.ecosystem.findMany;
    if (original.ecosystem.findFirst) prisma.ecosystem.findFirst = original.ecosystem.findFirst;
    if (original.ecosystem.findUnique) prisma.ecosystem.findUnique = original.ecosystem.findUnique;
    if (original.ecosystem.update) prisma.ecosystem.update = original.ecosystem.update;
    if (original.ecosystem.delete) prisma.ecosystem.delete = original.ecosystem.delete;

    for (const delegate of ['traitVersion', 'biomeVersion', 'speciesVersion', 'ecosystemVersion']) {
      if (original[delegate] && original[delegate].count) prisma[delegate].count = original[delegate].count;
      else if (prisma[delegate]) delete prisma[delegate].count;
      if (original[delegate] && original[delegate].createMany) prisma[delegate].createMany = original[delegate].createMany;
      else if (prisma[delegate]) delete prisma[delegate].createMany;
    }
    if (original.$transaction) prisma.$transaction = original.$transaction;
    if (prisma.taxonomyVersion) {
      for (const op of ['create', 'findUnique', 'findFirst', 'findMany', 'update', 'delete']) {
        if (original.taxonomyVersion && original.taxonomyVersion[op]) prisma.taxonomyVersion[op] = original.taxonomyVersion[op];
        else delete prisma.taxonomyVersion[op];
      }
    }
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
    releasedSnapshots.species.clear();
    releasedSnapshots.trait.clear();
    releasedSnapshots.biome.clear();
    releasedSnapshots.ecosystem.clear();
    versionStore.clear();
    versionCounter = 1;
    snapshotRows.traitVersion.length = 0;
    snapshotRows.biomeVersion.length = 0;
    snapshotRows.speciesVersion.length = 0;
    snapshotRows.ecosystemVersion.length = 0;
  }

  return {
    mock,
    restore,
    reset,
    markReleased,
    createSpecies,
    createTrait,
    createBiome,
    createEcosystem,
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
