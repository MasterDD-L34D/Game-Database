const test = require('node:test');
const assert = require('node:assert/strict');
const createApp = require('../app');
const prisma = require('../db/prisma');

const originalAuditLog = {
  count: prisma.auditLog?.count,
  findMany: prisma.auditLog?.findMany,
};

const store = [];
let idCounter = 1;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function resetStore() {
  store.length = 0;
  idCounter = 1;
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
}

function restoreMock() {
  if (originalAuditLog.count) prisma.auditLog.count = originalAuditLog.count;
  if (originalAuditLog.findMany) prisma.auditLog.findMany = originalAuditLog.findMany;
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
