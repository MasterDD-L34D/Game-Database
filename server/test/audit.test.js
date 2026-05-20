const test = require('node:test');
const assert = require('node:assert/strict');
const createApp = require('../app');
const prisma = require('../db/prisma');

const originalAuditLog = {
  count: prisma.auditLog?.count,
  findMany: prisma.auditLog?.findMany,
  findUnique: prisma.auditLog?.findUnique,
  create: prisma.auditLog?.create,
};

const originalTrait = {
  findUnique: prisma.trait?.findUnique,
  create: prisma.trait?.create,
};

const traitStore = new Map();

const store = [];
let idCounter = 1;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function resetStore() {
  store.length = 0;
  idCounter = 1;
  traitStore.clear();
}

function seedAuditLog(data = {}) {
  const id = data.id ?? `audit-${idCounter++}`;
  const record = {
    id,
    entity: data.entity ?? 'Trait',
    entityId: data.entityId ?? 'trait-1',
    action: data.action ?? 'CREATE',
    user: data.user ?? null,
    payload: data.payload ?? null,
    createdAt: data.createdAt ?? new Date(`2026-01-${String(idCounter).padStart(2, '0')}T00:00:00Z`),
  };
  store.push(record);
  return clone(record);
}

function matchesWhere(record, where = {}) {
  for (const [key, value] of Object.entries(where)) {
    if (key === 'createdAt' && value && typeof value === 'object') {
      const recordTime = record.createdAt instanceof Date ? record.createdAt.getTime() : new Date(record.createdAt).getTime();
      if (value.gte !== undefined) {
        const gteTime = value.gte instanceof Date ? value.gte.getTime() : new Date(value.gte).getTime();
        if (recordTime < gteTime) return false;
      }
      if (value.lte !== undefined) {
        const lteTime = value.lte instanceof Date ? value.lte.getTime() : new Date(value.lte).getTime();
        if (recordTime > lteTime) return false;
      }
      continue;
    }
    if (record[key] !== value) return false;
  }
  return true;
}

function applyOrder(items, orderBy) {
  if (!orderBy) return items.slice();
  const entries = Object.entries(orderBy);
  return items.slice().sort((a, b) => {
    for (const [key, direction] of entries) {
      const factor = direction === 'desc' ? -1 : 1;
      const av = a[key];
      const bv = b[key];
      if (av < bv) return -1 * factor;
      if (av > bv) return 1 * factor;
    }
    return 0;
  });
}

function installMock() {
  prisma.auditLog = prisma.auditLog || {};
  prisma.auditLog.count = async ({ where = {} } = {}) => store.filter(r => matchesWhere(r, where)).length;
  prisma.auditLog.findMany = async ({ where = {}, skip = 0, take, orderBy } = {}) => {
    const filtered = store.filter(r => matchesWhere(r, where));
    const ordered = applyOrder(filtered, orderBy || { createdAt: 'desc' });
    const end = typeof take === 'number' ? skip + take : undefined;
    return ordered.slice(skip, end).map(clone);
  };
  prisma.auditLog.findUnique = async ({ where } = {}) => {
    if (!where || !where.id) return null;
    const found = store.find(r => r.id === where.id);
    return found ? clone(found) : null;
  };
  prisma.auditLog.create = async ({ data } = {}) => {
    const record = {
      id: data.id ?? `audit-${idCounter++}`,
      entity: data.entity,
      entityId: data.entityId,
      action: data.action,
      user: data.user ?? null,
      payload: data.payload ?? null,
      createdAt: new Date(),
    };
    store.push(record);
    return clone(record);
  };

  prisma.trait = prisma.trait || {};
  prisma.trait.findUnique = async ({ where } = {}) => {
    if (!where) return null;
    if (where.id) {
      const found = traitStore.get(where.id);
      return found ? clone(found) : null;
    }
    if (where.slug) {
      for (const record of traitStore.values()) {
        if (record.slug === where.slug) return clone(record);
      }
      return null;
    }
    return null;
  };
  prisma.trait.create = async ({ data } = {}) => {
    if (traitStore.has(data.id)) {
      throw new Error('Unique constraint failed (id)');
    }
    for (const record of traitStore.values()) {
      if (record.slug && record.slug === data.slug) {
        throw new Error('Unique constraint failed (slug)');
      }
    }
    const record = { ...data };
    traitStore.set(data.id, clone(record));
    return clone(record);
  };
}

function restoreMock() {
  if (originalAuditLog.count) prisma.auditLog.count = originalAuditLog.count;
  if (originalAuditLog.findMany) prisma.auditLog.findMany = originalAuditLog.findMany;
  if (originalAuditLog.findUnique) prisma.auditLog.findUnique = originalAuditLog.findUnique;
  if (originalAuditLog.create) prisma.auditLog.create = originalAuditLog.create;
  if (originalTrait.findUnique) prisma.trait.findUnique = originalTrait.findUnique;
  if (originalTrait.create) prisma.trait.create = originalTrait.create;
}

installMock();

if (typeof test.after === 'function') {
  test.after(restoreMock);
} else {
  process.on('exit', restoreMock);
}

if (typeof test.beforeEach === 'function') {
  test.beforeEach(() => {
    resetStore();
    delete process.env.AUDIT_READ_ROLES;
  });
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

// ---- Happy path: GET /api/audit -------------------------------------------

test('GET /api/audit returns paginated audit log entries (default sort newest first)', async () => {
  resetStore();
  seedAuditLog({ entity: 'Trait', entityId: 'trait-1', action: 'CREATE', createdAt: new Date('2026-01-01T00:00:00Z') });
  seedAuditLog({ entity: 'Trait', entityId: 'trait-1', action: 'UPDATE', createdAt: new Date('2026-01-02T00:00:00Z') });
  seedAuditLog({ entity: 'Biome', entityId: 'biome-1', action: 'CREATE', createdAt: new Date('2026-01-03T00:00:00Z') });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 3);
    assert.equal(body.items.length, 3);
    // Newest first
    assert.equal(body.items[0].entity, 'Biome');
    assert.equal(body.items[2].entity, 'Trait');
    assert.equal(body.items[2].action, 'CREATE');
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit filters by entity', async () => {
  resetStore();
  seedAuditLog({ entity: 'Trait', entityId: 'trait-1', action: 'CREATE' });
  seedAuditLog({ entity: 'Biome', entityId: 'biome-1', action: 'CREATE' });
  seedAuditLog({ entity: 'Trait', entityId: 'trait-2', action: 'DELETE' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?entity=Trait`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 2);
    assert.ok(body.items.every(i => i.entity === 'Trait'));
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit filters by entityId', async () => {
  resetStore();
  seedAuditLog({ entity: 'Trait', entityId: 'trait-1', action: 'CREATE' });
  seedAuditLog({ entity: 'Trait', entityId: 'trait-1', action: 'UPDATE' });
  seedAuditLog({ entity: 'Trait', entityId: 'trait-2', action: 'CREATE' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?entity=Trait&entityId=trait-1`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 2);
    assert.ok(body.items.every(i => i.entityId === 'trait-1'));
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit filters by action (uppercased)', async () => {
  resetStore();
  seedAuditLog({ action: 'CREATE' });
  seedAuditLog({ action: 'UPDATE' });
  seedAuditLog({ action: 'DELETE' });
  seedAuditLog({ action: 'UPDATE' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?action=update`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 2);
    assert.ok(body.items.every(i => i.action === 'UPDATE'));
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit filters by user', async () => {
  resetStore();
  seedAuditLog({ user: 'alice@example.com' });
  seedAuditLog({ user: 'bob@example.com' });
  seedAuditLog({ user: 'alice@example.com' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?user=alice@example.com`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 2);
    assert.ok(body.items.every(i => i.user === 'alice@example.com'));
  } finally {
    await closeServer(server);
  }
});

// ---- Pagination ----------------------------------------------------------

test('GET /api/audit respects pageSize', async () => {
  resetStore();
  for (let i = 0; i < 10; i++) {
    seedAuditLog({ entity: 'Trait', entityId: `trait-${i}` });
  }

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?pageSize=4`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 10);
    assert.equal(body.items.length, 4);
    assert.equal(body.pageSize, 4);
    assert.equal(body.page, 0);
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit respects page (offset pagination)', async () => {
  resetStore();
  for (let i = 0; i < 6; i++) {
    seedAuditLog({ entity: 'Trait', entityId: `trait-${i}`, createdAt: new Date(`2026-01-0${i + 1}T00:00:00Z`) });
  }

  const { server, baseUrl } = await startServer();
  try {
    const page0 = await (await fetch(`${baseUrl}/api/audit?pageSize=2&page=0`)).json();
    const page1 = await (await fetch(`${baseUrl}/api/audit?pageSize=2&page=1`)).json();
    const page2 = await (await fetch(`${baseUrl}/api/audit?pageSize=2&page=2`)).json();

    assert.equal(page0.items[0].entityId, 'trait-5');
    assert.equal(page1.items[0].entityId, 'trait-3');
    assert.equal(page2.items[0].entityId, 'trait-1');
  } finally {
    await closeServer(server);
  }
});

// ---- Validation errors ----------------------------------------------------

test('GET /api/audit returns 400 for invalid pagination', async () => {
  resetStore();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?pageSize=999`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit returns 400 for invalid action', async () => {
  resetStore();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?action=INVALID_ACTION`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.match(body.message, /action must be one of/);
  } finally {
    await closeServer(server);
  }
});

// ---- RBAC: AUDIT_READ_ROLES env --------------------------------------------

test('GET /api/audit is open when AUDIT_READ_ROLES env unset (default)', async () => {
  resetStore();
  delete process.env.AUDIT_READ_ROLES;
  seedAuditLog({ entity: 'Trait' });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit`);
    assert.equal(response.status, 200);
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit returns 403 when AUDIT_READ_ROLES gated and caller lacks role', async () => {
  resetStore();
  process.env.AUDIT_READ_ROLES = 'audit:read,admin';
  seedAuditLog({ entity: 'Trait' });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit`, {
      headers: { 'X-Roles': 'viewer' },
    });
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.code, 'FORBIDDEN');
  } finally {
    await closeServer(server);
    delete process.env.AUDIT_READ_ROLES;
  }
});

test('GET /api/audit returns 200 when AUDIT_READ_ROLES gated and caller has role', async () => {
  resetStore();
  process.env.AUDIT_READ_ROLES = 'audit:read,admin';
  seedAuditLog({ entity: 'Trait' });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit`, {
      headers: { 'X-Roles': 'audit:read' },
    });
    assert.equal(response.status, 200);
  } finally {
    await closeServer(server);
    delete process.env.AUDIT_READ_ROLES;
  }
});

// ---- Codex P2 regression: empty-string entity / entityId returns 400 ------

test('GET /api/audit returns 400 when entity= is explicit empty string', async () => {
  resetStore();
  seedAuditLog({ entity: 'Trait' });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?entity=`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.match(body.message, /entity must be non-empty/);
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit returns 400 when entityId= is explicit empty string', async () => {
  resetStore();
  seedAuditLog({ entity: 'Trait', entityId: 'trait-1' });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?entityId=`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.match(body.message, /entityId must be non-empty/);
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit returns 400 when entity= is whitespace-only', async () => {
  resetStore();
  seedAuditLog({ entity: 'Trait' });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?entity=%20%20`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit returns 400 when action= is explicit empty string', async () => {
  resetStore();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?action=`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.match(body.message, /action must be one of/);
  } finally {
    await closeServer(server);
  }
});

// ---- Date range filter (Fase 2 9/N: ?since / ?until) --------------------

test('GET /api/audit filters by since (gte createdAt)', async () => {
  resetStore();
  seedAuditLog({ id: 'a1', entity: 'Trait', createdAt: new Date('2026-01-01T00:00:00Z') });
  seedAuditLog({ id: 'a2', entity: 'Trait', createdAt: new Date('2026-03-15T00:00:00Z') });
  seedAuditLog({ id: 'a3', entity: 'Trait', createdAt: new Date('2026-06-30T00:00:00Z') });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?since=2026-03-01T00:00:00Z`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 2);
    assert.ok(body.items.every((i) => new Date(i.createdAt) >= new Date('2026-03-01T00:00:00Z')));
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit filters by until (lte createdAt)', async () => {
  resetStore();
  seedAuditLog({ id: 'a1', entity: 'Trait', createdAt: new Date('2026-01-01T00:00:00Z') });
  seedAuditLog({ id: 'a2', entity: 'Trait', createdAt: new Date('2026-03-15T00:00:00Z') });
  seedAuditLog({ id: 'a3', entity: 'Trait', createdAt: new Date('2026-06-30T00:00:00Z') });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?until=2026-04-01T00:00:00Z`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 2);
    assert.ok(body.items.every((i) => new Date(i.createdAt) <= new Date('2026-04-01T00:00:00Z')));
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit combines since + until for a window', async () => {
  resetStore();
  seedAuditLog({ id: 'a1', entity: 'Trait', createdAt: new Date('2026-01-01T00:00:00Z') });
  seedAuditLog({ id: 'a2', entity: 'Trait', createdAt: new Date('2026-03-15T00:00:00Z') });
  seedAuditLog({ id: 'a3', entity: 'Trait', createdAt: new Date('2026-06-30T00:00:00Z') });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?since=2026-02-01T00:00:00Z&until=2026-04-01T00:00:00Z`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 1);
    assert.equal(body.items[0].id, 'a2');
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit returns 400 for invalid since (tz-suffixed but unparseable)', async () => {
  resetStore();
  const { server, baseUrl } = await startServer();
  try {
    // "not-a-dateZ" passes TZ_REGEX (ends with Z) but Date.parse → NaN
    const response = await fetch(`${baseUrl}/api/audit?since=not-a-dateZ`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.match(body.message, /since must be a valid ISO date/);
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit returns 400 for invalid until (tz-suffixed but unparseable)', async () => {
  resetStore();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?until=bogusZ`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.match(body.message, /until must be a valid ISO date/);
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit returns 400 for empty since=', async () => {
  resetStore();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?since=`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.message, /since must be non-empty/);
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit returns 400 when since > until', async () => {
  resetStore();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?since=2026-06-01T00:00:00Z&until=2026-01-01T00:00:00Z`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.message, /since must be <= until/);
  } finally {
    await closeServer(server);
  }
});

// Codex P1 regression (PR #137): tz-naive datetime strings rejected as
// ambiguous to prevent server-local vs browser-local tz boundary drift.
test('GET /api/audit returns 400 when since lacks explicit timezone', async () => {
  resetStore();
  const { server, baseUrl } = await startServer();
  try {
    // No Z, no +HH:MM offset — ambiguous wall-clock string
    const response = await fetch(`${baseUrl}/api/audit?since=2026-05-20T10:00:00`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.message, /since must include an explicit timezone offset/);
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit returns 400 when until lacks explicit timezone', async () => {
  resetStore();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?until=2026-05-20T10:00`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.message, /until must include an explicit timezone offset/);
  } finally {
    await closeServer(server);
  }
});

// ---- CSV export (Fase 2 11/N) -------------------------------------------

test('GET /api/audit?format=csv returns text/csv with header row', async () => {
  resetStore();
  seedAuditLog({
    id: 'a1', entity: 'Trait', entityId: 't-1', action: 'CREATE',
    user: 'alice@example.com', createdAt: new Date('2026-01-01T00:00:00Z'),
  });
  seedAuditLog({
    id: 'a2', entity: 'Trait', entityId: 't-1', action: 'UPDATE',
    user: 'bob@example.com', createdAt: new Date('2026-02-01T00:00:00Z'),
  });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?format=csv`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /text\/csv/);
    assert.match(response.headers.get('content-disposition') || '', /attachment; filename=".*\.csv"/);

    const body = await response.text();
    const lines = body.trim().split('\n');
    // header + 2 data rows
    assert.equal(lines.length, 3);
    assert.equal(lines[0], 'id,entity,entityId,action,user,createdAt,payload');
    // newest-first ordering
    assert.match(lines[1], /a2,Trait,t-1,UPDATE,bob@example.com/);
    assert.match(lines[2], /a1,Trait,t-1,CREATE,alice@example.com/);
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit?format=csv respects entity/action filters', async () => {
  resetStore();
  seedAuditLog({ id: 'a1', entity: 'Trait', entityId: 't-1', action: 'CREATE' });
  seedAuditLog({ id: 'a2', entity: 'Trait', entityId: 't-1', action: 'UPDATE' });
  seedAuditLog({ id: 'a3', entity: 'Biome', entityId: 'b-1', action: 'CREATE' });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?format=csv&entity=Trait&action=UPDATE`);
    assert.equal(response.status, 200);
    const body = await response.text();
    const lines = body.trim().split('\n');
    // header + only a2 (Trait UPDATE)
    assert.equal(lines.length, 2);
    assert.match(lines[1], /a2,Trait/);
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit?format=csv escapes payload JSON containing commas and quotes', async () => {
  resetStore();
  seedAuditLog({
    id: 'a1',
    entity: 'Trait',
    entityId: 't-1',
    action: 'CREATE',
    payload: { description: 'Has, comma "and" quotes', count: 5 },
  });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?format=csv`);
    const body = await response.text();
    // The payload cell must be quoted + internal quotes doubled
    assert.match(body, /"\{""description"":""Has, comma \\""and\\"" quotes""/);
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit?format=csv with no results returns header-only file', async () => {
  resetStore();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit?format=csv&entity=Trait`);
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.equal(body, 'id,entity,entityId,action,user,createdAt,payload\n');
  } finally {
    await closeServer(server);
  }
});

test('GET /api/audit accepts explicit positive offset (+02:00)', async () => {
  resetStore();
  seedAuditLog({ id: 'tz1', entity: 'Trait', createdAt: new Date('2026-03-15T08:00:00Z') });
  const { server, baseUrl } = await startServer();
  try {
    // 2026-03-15T10:00:00+02:00 = 2026-03-15T08:00:00Z — record at exact bound
    const response = await fetch(`${baseUrl}/api/audit?since=2026-03-15T10:00:00%2B02:00&until=2026-03-15T11:00:00%2B02:00`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 1);
  } finally {
    await closeServer(server);
  }
});

// ---- POST /api/audit/:logId/revert (Fase 2 undo) -------------------------

test('POST /api/audit/:logId/revert resurrects DELETE-tombstoned trait', async () => {
  resetStore();
  // Seed a DELETE audit entry for a Trait
  const traitData = {
    id: 'trait-revert-1',
    slug: 'foo',
    name: 'Foo',
    dataType: 'TEXT',
    description: 'pre-delete description',
  };
  const auditEntry = seedAuditLog({
    id: 'audit-delete-1',
    entity: 'Trait',
    entityId: traitData.id,
    action: 'DELETE',
    payload: traitData,
  });

  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit/${auditEntry.id}/revert`, {
      method: 'POST',
      headers: { 'X-Roles': 'taxonomy:write' },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.id, traitData.id);
    assert.equal(body.entity, 'Trait');
    assert.equal(body.revertedFrom, auditEntry.id);

    // Verify trait actually exists now in mock store
    const recreated = await prisma.trait.findUnique({ where: { id: traitData.id } });
    assert.ok(recreated, 'trait should exist after revert');
    assert.equal(recreated.slug, 'foo');
    assert.equal(recreated.name, 'Foo');

    // Verify a new audit entry was created for the revert
    const allAudit = store.filter((r) => r.entity === 'Trait');
    const createEntry = allAudit.find((r) => r.action === 'CREATE');
    assert.ok(createEntry, 'a CREATE audit entry should be logged for the revert');
    assert.equal(createEntry.payload._revertedFrom, auditEntry.id);
  } finally {
    await closeServer(server);
  }
});

test('POST /api/audit/:logId/revert returns 404 for missing log', async () => {
  resetStore();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit/missing-log-id/revert`, {
      method: 'POST',
      headers: { 'X-Roles': 'taxonomy:write' },
    });
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.code, 'NOT_FOUND');
  } finally {
    await closeServer(server);
  }
});

test('POST /api/audit/:logId/revert returns 400 for UPDATE actions (not revertable in v1)', async () => {
  resetStore();
  const auditEntry = seedAuditLog({
    id: 'audit-update-1',
    entity: 'Trait',
    entityId: 'trait-1',
    action: 'UPDATE',
    payload: { name: 'New Name' },
  });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit/${auditEntry.id}/revert`, {
      method: 'POST',
      headers: { 'X-Roles': 'taxonomy:write' },
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, 'NOT_REVERTABLE');
    assert.match(body.message, /Only DELETE actions can be reverted/);
  } finally {
    await closeServer(server);
  }
});

test('POST /api/audit/:logId/revert returns 400 for CREATE actions', async () => {
  resetStore();
  const auditEntry = seedAuditLog({
    id: 'audit-create-1',
    entity: 'Trait',
    entityId: 'trait-1',
    action: 'CREATE',
    payload: { id: 'trait-1', slug: 'x', name: 'X', dataType: 'TEXT' },
  });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit/${auditEntry.id}/revert`, {
      method: 'POST',
      headers: { 'X-Roles': 'taxonomy:write' },
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, 'NOT_REVERTABLE');
  } finally {
    await closeServer(server);
  }
});

test('POST /api/audit/:logId/revert returns 403 without taxonomy:write role', async () => {
  resetStore();
  const auditEntry = seedAuditLog({
    id: 'audit-delete-403',
    entity: 'Trait',
    entityId: 'trait-1',
    action: 'DELETE',
    payload: { id: 'trait-1', slug: 'x', name: 'X', dataType: 'TEXT' },
  });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit/${auditEntry.id}/revert`, {
      method: 'POST',
      headers: { 'X-Roles': 'viewer' },
    });
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.code, 'FORBIDDEN');
  } finally {
    await closeServer(server);
  }
});

test('POST /api/audit/:logId/revert returns 409 when entity already exists', async () => {
  resetStore();
  // Pre-seed an existing trait + a DELETE audit log for the same id
  traitStore.set('trait-conflict', { id: 'trait-conflict', slug: 'c', name: 'C', dataType: 'TEXT' });
  const auditEntry = seedAuditLog({
    id: 'audit-delete-conflict',
    entity: 'Trait',
    entityId: 'trait-conflict',
    action: 'DELETE',
    payload: { id: 'trait-conflict', slug: 'c', name: 'C', dataType: 'TEXT' },
  });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit/${auditEntry.id}/revert`, {
      method: 'POST',
      headers: { 'X-Roles': 'taxonomy:write' },
    });
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.code, 'CONFLICT');
  } finally {
    await closeServer(server);
  }
});

test('POST /api/audit/:logId/revert returns 400 for unknown entity (junction/non-master)', async () => {
  resetStore();
  const auditEntry = seedAuditLog({
    id: 'audit-junction-1',
    entity: 'SpeciesTrait',
    entityId: 'st-1',
    action: 'DELETE',
    payload: { id: 'st-1' },
  });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit/${auditEntry.id}/revert`, {
      method: 'POST',
      headers: { 'X-Roles': 'taxonomy:write' },
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, 'NOT_REVERTABLE');
    assert.match(body.message, /master entities only/);
  } finally {
    await closeServer(server);
  }
});

// Codex P2 regression (PR #130 review): slug @unique collision must surface
// as 409 CONFLICT (not fall-through Prisma P2002 → 500 INTERNAL_ERROR).
test('POST /api/audit/:logId/revert returns 409 when slug now claimed by another entity', async () => {
  resetStore();
  // Another trait already has the slug `taken-slug` after the original was deleted
  traitStore.set('trait-other', { id: 'trait-other', slug: 'taken-slug', name: 'Other', dataType: 'TEXT' });
  const auditEntry = seedAuditLog({
    id: 'audit-slug-collision',
    entity: 'Trait',
    entityId: 'trait-original',
    action: 'DELETE',
    payload: { id: 'trait-original', slug: 'taken-slug', name: 'Original', dataType: 'TEXT' },
  });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit/${auditEntry.id}/revert`, {
      method: 'POST',
      headers: { 'X-Roles': 'taxonomy:write' },
    });
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.code, 'CONFLICT');
    assert.match(body.message, /Slug "taken-slug" is now used by another/);
    assert.equal(body.details.conflictingId, 'trait-other');
  } finally {
    await closeServer(server);
  }
});

test('POST /api/audit/:logId/revert returns 400 when payload has no id', async () => {
  resetStore();
  const auditEntry = seedAuditLog({
    id: 'audit-no-id',
    entity: 'Trait',
    entityId: 'trait-noid',
    action: 'DELETE',
    payload: { slug: 'no-id', name: 'NoId', dataType: 'TEXT' }, // intentionally missing id
  });
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/audit/${auditEntry.id}/revert`, {
      method: 'POST',
      headers: { 'X-Roles': 'taxonomy:write' },
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, 'NOT_REVERTABLE');
    assert.match(body.message, /missing or has no id/);
  } finally {
    await closeServer(server);
  }
});
